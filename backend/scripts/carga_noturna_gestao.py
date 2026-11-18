"""Carga noturna do snapshot de gestao: indice, backfill e reconciliacao.

Existe como script unico porque as tres etapas tem de rodar nesta ordem e sem
plateia:

  1. Cria IX_TABULACOES_HOJE_66_DATA. A edicao aqui e Standard, entao o indice
     sobe sem ONLINE=ON e TRAVA dbo.TB_TABULACOES_HOJE_66 enquanto e criado.
     Medido: sem ele, um SELECT por data nessa tabela leva 130-157s, e cada
     carga do worker passa de 20 minutos.

  2. Recarrega o historico inteiro. A carga que esta no banco hoje foi feita
     antes de descobrirmos que a regua de valor e por ID_CEDENTE, entao Zeta e
     TETA Acme estao gravados por VL_ENTRADA quando deveriam ser VL_RISCO.

  3. Reconcilia contra as fontes e imprime o resultado.

Uso:
    python scripts/carga_noturna_gestao.py                  # tudo
    python scripts/carga_noturna_gestao.py --pular-indice   # se ja existir
    python scripts/carga_noturna_gestao.py --so-indice
"""

import argparse
import subprocess
import sys
import time
from datetime import date, datetime
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
load_dotenv(BACKEND_DIR / ".env")

from src.infrastructure.database.sql_server_connection import SQLServerConnection  # noqa: E402
from src.shared.utils.env_load import DB_HOST_66  # noqa: E402


# TB_PARCELAS comeca em 2025-05. Nao adianta pedir mais do que a origem tem.
BACKFILL_DE = "2025-05-01"
BACKFILL_ATE = date.today().isoformat()

INDICE = "IX_TABULACOES_HOJE_66_DATA"

CRIAR_INDICE = """
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_TABULACOES_HOJE_66_DATA'
      AND object_id = OBJECT_ID('dbo.TB_TABULACOES_HOJE_66')
)
BEGIN
    DECLARE @online VARCHAR(20) = '';
    -- ONLINE = ON so existe no Enterprise/Developer. Aqui e Standard, entao a
    -- tabela fica bloqueada durante a criacao -- por isso este script e noturno.
    IF SERVERPROPERTY('EngineEdition') = 3
        SET @online = ', ONLINE = ON';

    DECLARE @sql NVARCHAR(MAX) = N'
        CREATE NONCLUSTERED INDEX IX_TABULACOES_HOJE_66_DATA
            ON dbo.TB_TABULACOES_HOJE_66 ([DATA])
            INCLUDE (NM_USUARIO, CPC, CE, NCE, CPCA)
            WITH (DATA_COMPRESSION = PAGE, SORT_IN_TEMPDB = ON' + @online + ');';
    EXEC sp_executesql @sql;
END;
"""


def registrar(mensagem):
    carimbo = datetime.now().strftime("%H:%M:%S")
    linha = "[" + carimbo + "] " + str(mensagem)
    print(linha.encode("ascii", "replace").decode(), flush=True)


def consultar(db, query, one=False):
    transacao = db.begin_transaction()
    try:
        return transacao.execute_fetch(query=query, parametros=(), one=one)
    finally:
        transacao.close()


def criar_indice(db):
    ja_existe = consultar(db, """
        SELECT CASE WHEN EXISTS (
            SELECT 1 FROM sys.indexes
            WHERE name = 'IX_TABULACOES_HOJE_66_DATA'
              AND object_id = OBJECT_ID('dbo.TB_TABULACOES_HOJE_66')
        ) THEN 1 ELSE 0 END AS existe
    """, one=True)

    if ja_existe and ja_existe.get("existe"):
        registrar(INDICE + " ja existe. Pulando.")
        return

    registrar("Criando " + INDICE + " -- a tabela fica travada ate terminar.")
    comeco = time.monotonic()

    transacao = db.begin_transaction()
    try:
        transacao.execute_commit(query=CRIAR_INDICE, parametros=())
        transacao.commit()
    except Exception:
        transacao.rollback()
        raise
    finally:
        transacao.close()

    registrar("Indice criado em {:.0f}s.".format(time.monotonic() - comeco))

    comeco = time.monotonic()
    linha = consultar(db, """
        SELECT COUNT(*) AS L, SUM(CPC) AS C
        FROM dbo.TB_TABULACOES_HOJE_66 WITH (NOLOCK)
        WHERE [DATA] = CAST(GETDATE() AS DATE)
    """, one=True)
    registrar(
        "CPC de hoje agora leva {:.2f}s (era ~130s) -- {}".format(
            time.monotonic() - comeco, linha
        )
    )


def rodar_backfill():
    registrar("Backfill de " + BACKFILL_DE + " a " + BACKFILL_ATE + ".")
    comeco = time.monotonic()

    processo = subprocess.run(
        [sys.executable, "-m", "src.workers.gestao_snapshot_worker",
         "--modo", "BACKFILL", "--de", BACKFILL_DE, "--ate", BACKFILL_ATE],
        cwd=str(BACKEND_DIR),
        capture_output=True,
        text=True,
        errors="replace",
    )

    for linha in (processo.stdout or "").splitlines():
        registrar("  " + linha)

    if processo.returncode != 0:
        registrar("FALHOU:")
        for linha in (processo.stderr or "").splitlines()[-15:]:
            registrar("  " + linha)
        raise SystemExit(1)

    registrar("Backfill concluido em {:.1f} min.".format(
        (time.monotonic() - comeco) / 60))


def reconciliar(db):
    registrar("=== RECONCILIACAO ===")

    volume = consultar(db, """
        SELECT COUNT(*) LINHAS, MIN(DATA) DE, MAX(DATA) ATE,
               COUNT(DISTINCT CHAVE_OPERADOR) OPERADORES,
               COUNT(DISTINCT CONVERT(char(7), DATA, 120)) MESES
        FROM dbo.TB_GESTAO_OPERADOR_DIA
    """, one=True)
    registrar("Snapshot: " + str(volume))

    # A prova de que a regua por cedente entrou: nos quatro cedentes o valor
    # gravado tem de ser o risco, e nos demais a entrada.
    registrar("Regua por cedente (deve ser RISCO nos quatro):")
    for linha in consultar(db, """
        SELECT C.NM_CARTEIRA,
               CAST(SUM(F.VL_ENTRADA) AS DECIMAL(18,2)) ENTRADA,
               CAST(SUM(F.VL_RISCO)   AS DECIMAL(18,2)) RISCO,
               CAST(SUM(F.VL_FECHADO) AS DECIMAL(18,2)) GRAVADO
        FROM dbo.TB_GESTAO_OPERADOR_DIA F
        JOIN dbo.TB_GESTAO_CARTEIRA C ON C.ID_CARTEIRA = F.ID_CARTEIRA
        WHERE C.NM_CARTEIRA IN ('Mu','Pi','Zeta','TETA')
        GROUP BY C.NM_CARTEIRA ORDER BY C.NM_CARTEIRA
    """) or []:
        if linha["GRAVADO"] == linha["RISCO"]:
            usa = "RISCO"
        elif linha["GRAVADO"] == linha["ENTRADA"]:
            usa = "ENTRADA   <-- ERRADO"
        else:
            usa = "?"
        registrar("  {:<12} gravado como {}".format(linha["NM_CARTEIRA"], usa))

    registrar("Fechamento: snapshot x TB_PARCELAS, por mes (devem bater):")
    for linha in consultar(db, """
        SELECT S.MES, S.SNAPSHOT, P.ORIGEM, S.SNAPSHOT - P.ORIGEM DIFERENCA
        FROM (SELECT CONVERT(char(7),DATA,120) MES, SUM(QT_ACORDOS) SNAPSHOT
              FROM dbo.TB_GESTAO_OPERADOR_DIA
              GROUP BY CONVERT(char(7),DATA,120)) S
        JOIN (SELECT CONVERT(char(7),DATA,120) MES, COUNT(*) ORIGEM
              FROM dbo.TB_PARCELAS WITH (NOLOCK)
              WHERE NU_PARCELA=1 AND NULLIF(LTRIM(RTRIM(NM_USUARIO)),'') IS NOT NULL
              GROUP BY CONVERT(char(7),DATA,120)) P ON P.MES = S.MES
        ORDER BY S.MES
    """) or []:
        alerta = "" if linha["DIFERENCA"] == 0 else "   <-- CONFERIR"
        registrar("  {}  snapshot={:>7}  origem={:>7}  dif={:>6}{}".format(
            linha["MES"], linha["SNAPSHOT"], linha["ORIGEM"],
            linha["DIFERENCA"], alerta))

    pendentes = consultar(db, """
        SELECT TIPO_ORIGEM, TEXTO_ORIGEM FROM dbo.TB_GESTAO_CARTEIRA_ALIAS
        WHERE ID_CARTEIRA = 0 AND REVISADO = 0 ORDER BY TEXTO_ORIGEM
    """) or []
    if pendentes:
        registrar("Carteiras a classificar ({}):".format(len(pendentes)))
        for linha in pendentes:
            registrar("  " + linha["TIPO_ORIGEM"] + ": " + linha["TEXTO_ORIGEM"])
    else:
        registrar("Nenhuma carteira pendente de classificacao.")


def main():
    parser = argparse.ArgumentParser(
        description="Carga noturna do snapshot de gestao."
    )
    parser.add_argument("--pular-indice", action="store_true",
                        help="Nao tenta criar o indice.")
    parser.add_argument("--so-indice", action="store_true",
                        help="Cria o indice e para.")
    args = parser.parse_args()

    db = SQLServerConnection(DB_HOST_66, "DB_COPILOT_ACME")
    comeco = time.monotonic()
    registrar("Inicio.")

    try:
        if not args.pular_indice:
            criar_indice(db)
        if not args.so_indice:
            rodar_backfill()
            reconciliar(db)
    except Exception as erro:
        registrar("ERRO: " + str(erro))
        raise

    registrar("Fim. Total: {:.1f} min.".format((time.monotonic() - comeco) / 60))


if __name__ == "__main__":
    main()
