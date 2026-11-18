"""Migra a base de conhecimento da Aurora do JSON para o banco, com vetores.

O JSON continua no repositorio de proposito: e o fallback usado enquanto a
tabela nao existe ou esta vazia, e o registro do estado inicial. Este script
nao o apaga.

Uso:
    python scripts/migrar_base_conhecimento_ia.py --dry-run       # so relata
    python scripts/migrar_base_conhecimento_ia.py                 # carga inicial
    python scripts/migrar_base_conhecimento_ia.py --so-embeddings # backfill
    python scripts/migrar_base_conhecimento_ia.py --forcar        # reinsere
"""

import argparse
import json
import sys
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
load_dotenv(BACKEND_DIR / ".env")

from src.infrastructure.repositories.sql_ia_conhecimento_repository import (  # noqa: E402
    IAConhecimentoRepository,
)
from src.shared.ia.embeddings import (  # noqa: E402
    MODELO_EMBEDDING,
    gerar_embeddings,
    hash_conteudo,
    serializar,
    texto_para_embedding,
)

BASE_JSON = BACKEND_DIR / "src" / "shared" / "ia" / "aurora_base_conhecimento.json"


def carregar_json() -> list[dict]:
    # encoding explicito: o terminal do Windows e cp1252 e leria o arquivo
    # errado sem isto.
    with BASE_JSON.open("r", encoding="utf-8") as arquivo:
        dados = json.load(arquivo)
    if not isinstance(dados, list):
        raise ValueError("O JSON da base de conhecimento nao e uma lista.")
    return dados


def inserir_registros(repo: IAConhecimentoRepository, registros: list[dict]) -> list[int]:
    ids = []
    for item in registros:
        ids.append(repo.inserir(
            carteira=str(item.get("carteira") or "").strip(),
            produto=str(item.get("produto") or "").strip(),
            categoria=str(item.get("categoria") or "").strip() or None,
            descricao=str(item.get("descricao") or "").strip() or None,
            texto=str(item.get("texto") or "").strip(),
            sinonimos=json.dumps(item.get("sinonimos") or [], ensure_ascii=False),
            origem="JSON_MIGRACAO",
            criado_por="MIGRACAO",
        ))
    return ids


def indexar(repo: IAConhecimentoRepository, linhas: list[dict], dry_run: bool) -> int:
    """Gera e grava os vetores. Devolve quantos foram indexados."""
    if not linhas:
        return 0

    textos = [texto_para_embedding(linha) for linha in linhas]

    if dry_run:
        tokens = sum(len(texto) for texto in textos) // 4
        print(f"  [dry-run] {len(textos)} registros, ~{tokens} tokens estimados")
        return 0

    vetores = gerar_embeddings(textos)
    if vetores is None:
        print("  ERRO: a API de embeddings falhou. Rode de novo com --so-embeddings.")
        return 0

    indexados = 0
    for linha, texto, vetor in zip(linhas, textos, vetores):
        repo.gravar_embedding(
            id_conhecimento=linha["ID_CONHECIMENTO"],
            embedding=serializar(vetor),
            embedding_modelo=MODELO_EMBEDDING,
            embedding_hash=hash_conteudo(texto),
        )
        indexados += 1
    return indexados


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true",
                        help="Nao escreve nada; so relata o que faria.")
    parser.add_argument("--so-embeddings", action="store_true",
                        help="Nao insere; so indexa o que esta sem vetor ou obsoleto.")
    parser.add_argument("--forcar", action="store_true",
                        help="Permite inserir mesmo com a tabela ja populada.")
    args = parser.parse_args()

    repo = IAConhecimentoRepository()

    print(f"Modelo de embedding: {MODELO_EMBEDDING}")
    if not args.dry_run:
        repo.ensure_schema()
        print("Schema garantido.")

    # Em dry-run a tabela pode nao existir ainda. Consultar assim mesmo so
    # geraria erro de SQL na saida de um comando que promete nao escrever nada.
    tabela_existe = repo.tabela_existe()
    if not tabela_existe:
        print("Tabela ainda nao existe (sera criada na execucao real).")

    existentes = repo.contar() if tabela_existe else 0
    print(f"Registros ja na tabela: {existentes}")

    if not args.so_embeddings:
        registros = carregar_json()
        print(f"Registros no JSON: {len(registros)}")

        if existentes and not args.forcar:
            print(
                "\nA tabela ja tem registros. Nao vou duplicar a carga.\n"
                "  - Para so gerar/atualizar vetores: --so-embeddings\n"
                "  - Para inserir mesmo assim:        --forcar"
            )
            return 1

        if args.dry_run:
            tokens = sum(
                len(texto_para_embedding(item)) for item in registros
            ) // 4
            print(
                f"  [dry-run] inseriria {len(registros)} registros "
                f"e indexaria ~{tokens} tokens"
            )
        else:
            ids = inserir_registros(repo, registros)
            print(f"Inseridos: {len(ids)}")

    pendentes = (
        repo.listar_pendentes_embedding(MODELO_EMBEDDING) if tabela_existe else []
    )
    print(f"Pendentes de indexacao: {len(pendentes)}")
    indexados = indexar(repo, pendentes, args.dry_run)
    print(f"Indexados: {indexados}")

    if not args.dry_run:
        restantes = repo.listar_pendentes_embedding(MODELO_EMBEDDING)
        print(f"Ainda sem vetor: {len(restantes)}")
        if restantes:
            print("  Rode novamente com --so-embeddings para completar.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
