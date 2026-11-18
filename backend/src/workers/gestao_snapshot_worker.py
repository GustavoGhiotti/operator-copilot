"""Carga do snapshot de gestao (TB_GESTAO_OPERADOR_DIA).

Tres modos, todos o mesmo MERGE com janela diferente:

  INTRADIA     hoje                    a cada ~15 min no horario comercial
  INCREMENTAL  D-N ... D0 (padrao 7)   1x/dia de madrugada
  BACKFILL     --de / --ate            manual

Por que a janela movel e nao so o dia corrente: TB_PARCELAS e
INFORMACAO_PAGAMENTOS tem DT_CANCELAMENTO e DT_ATUALIZACAO, ou seja, acordo e
pagamento sao alterados retroativamente. Um snapshot append-only ficaria errado
em silencio.

Nao ha varredura por watermark: seria um scan completo de INFORMACAO_PAGAMENTOS
e TB_PARCELAS, que nao tem indice nenhum. Com o volume medido (25 mil e 4,3
milhoes de linhas), recomputar a janela sai mais barato do que descobrir o que
mudou. Se o volume crescer, o lugar de revisar isto e aqui.

Uso:
    python -m src.workers.gestao_snapshot_worker --modo INTRADIA
    python -m src.workers.gestao_snapshot_worker --modo INCREMENTAL --dias 7
    python -m src.workers.gestao_snapshot_worker --modo BACKFILL --de 2025-06-01 --ate 2026-08-12
    python -m src.workers.gestao_snapshot_worker --modo BACKFILL --de ... --ate ... --dry-run
"""

import argparse
import json
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path

from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
load_dotenv(BACKEND_DIR / ".env")

from src.infrastructure.repositories.sql_gestao_snapshot_repository import (  # noqa: E402
    GestaoSnapshotRepository,
)


DIAS_INCREMENTAL_PADRAO = 7

# Backfill de uma vez so seria uma transacao gigantesca segurando lock na tabela
# inteira. Em fatias, cada mes confirma sozinho e uma falha no meio nao joga
# fora o que ja entrou.
DIAS_POR_FATIA_BACKFILL = 31


def _janela(args, hoje: date) -> tuple[date, date]:
    """Devolve [inicio, fim) -- fim exclusivo, como o MERGE espera."""
    if args.modo == "INTRADIA":
        return hoje, hoje + timedelta(days=1)

    if args.modo == "INCREMENTAL":
        dias = max(1, int(args.dias or DIAS_INCREMENTAL_PADRAO))
        return hoje - timedelta(days=dias - 1), hoje + timedelta(days=1)

    if not args.de or not args.ate:
        raise SystemExit("BACKFILL exige --de e --ate (YYYY-MM-DD).")

    inicio = datetime.strptime(args.de, "%Y-%m-%d").date()
    fim = datetime.strptime(args.ate, "%Y-%m-%d").date()
    if fim < inicio:
        raise SystemExit("--ate nao pode ser anterior a --de.")
    return inicio, fim + timedelta(days=1)


def _fatias(inicio: date, fim: date, dias_por_fatia: int):
    atual = inicio
    while atual < fim:
        proximo = min(atual + timedelta(days=dias_por_fatia), fim)
        yield atual, proximo
        atual = proximo


def executar(
    *,
    modo: str,
    inicio: date,
    fim: date,
    dry_run: bool = False,
    repo: GestaoSnapshotRepository | None = None,
) -> dict:
    repo = repo or GestaoSnapshotRepository()

    if not repo.estrutura_disponivel():
        return {
            "status": "ignorado",
            "motivo": "TB_GESTAO_OPERADOR_DIA nao existe. Rode as migrations 021 e 022.",
        }

    alcance = repo.obter_alcance_fontes()
    tem_indice = repo.indice_de_tabulacoes_existe()
    aviso = None
    if not tem_indice:
        aviso = (
            "IX_TABULACOES_HOJE_66_DATA nao existe (migration 020). Sem ele "
            "cada carga varre os 18 GB da tabela de tabulacoes -- medido em "
            "~20 min, contra os 15 do intervalo do intradiario."
        )
        print(f"AVISO: {aviso}", file=sys.stderr)

    if dry_run:
        return {
            "status": "simulado",
            "modo": modo,
            "janela": [inicio.isoformat(), (fim - timedelta(days=1)).isoformat()],
            "fatias": [
                [de.isoformat(), (ate - timedelta(days=1)).isoformat()]
                for de, ate in _fatias(inicio, fim, DIAS_POR_FATIA_BACKFILL)
            ],
            "alcance_das_fontes": {
                chave.lower(): valor.isoformat() if hasattr(valor, "isoformat") else valor
                for chave, valor in alcance.items()
            },
            "aviso": aviso,
        }

    # Um worker derrubado no meio deixa STATUS='EXECUTANDO' e o indice unico
    # bloquearia todas as execucoes seguintes.
    repo.liberar_execucoes_travadas()

    comeco = time.monotonic()
    id_execucao = repo.abrir_execucao(
        tipo_carga=modo,
        data_inicio=inicio,
        data_fim=fim - timedelta(days=1),
    )

    total = {"inseridas": 0, "atualizadas": 0, "removidas": 0}
    try:
        for de, ate in _fatias(inicio, fim, DIAS_POR_FATIA_BACKFILL):
            contagens = repo.carregar_janela(
                data_inicio=de,
                data_fim=ate,
                id_execucao=id_execucao,
            )
            for chave in total:
                total[chave] += contagens[chave]
    except Exception as erro:
        repo.falhar_execucao(id_execucao=id_execucao, erro=erro)
        raise

    duracao_ms = int((time.monotonic() - comeco) * 1000)
    repo.concluir_execucao(
        id_execucao=id_execucao,
        contagens=total,
        duracao_ms=duracao_ms,
    )

    pendentes = repo.listar_alias_pendentes()

    return {
        "status": "concluida",
        "modo": modo,
        "id_execucao": id_execucao,
        "janela": [inicio.isoformat(), (fim - timedelta(days=1)).isoformat()],
        "duracao_ms": duracao_ms,
        "aviso": aviso,
        **total,
        # Carteira nova nao e adivinhada por substring: entra como "Nao
        # classificada" e aparece aqui para alguem classificar.
        "carteiras_a_classificar": [
            f"{linha['TIPO_ORIGEM']}: {linha['TEXTO_ORIGEM']}" for linha in pendentes
        ],
    }


def main():
    parser = argparse.ArgumentParser(
        description="Carrega o snapshot diario de gestao."
    )
    parser.add_argument(
        "--modo",
        choices=["INTRADIA", "INCREMENTAL", "BACKFILL"],
        default="INTRADIA",
    )
    parser.add_argument(
        "--dias",
        type=int,
        help=f"INCREMENTAL: quantos dias recomputar (padrao {DIAS_INCREMENTAL_PADRAO}).",
    )
    parser.add_argument("--de", help="BACKFILL: primeiro dia (YYYY-MM-DD).")
    parser.add_argument("--ate", help="BACKFILL: ultimo dia (YYYY-MM-DD).")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Mostra a janela, as fatias e o alcance das fontes sem escrever nada.",
    )
    args = parser.parse_args()

    inicio, fim = _janela(args, date.today())
    resultado = executar(
        modo=args.modo,
        inicio=inicio,
        fim=fim,
        dry_run=args.dry_run,
    )
    print(json.dumps(resultado, ensure_ascii=False, indent=2, default=str))


if __name__ == "__main__":
    main()
