"""Cache em memoria da base de conhecimento, com invalidacao entre workers.

O backend roda sob gunicorn com varios workers e cada um tem seu proprio
espaco de memoria. Um cache simples por TTL faria o supervisor editar um
treinamento no worker 1 e continuar vendo a versao antiga vinda dos demais,
por tempo indeterminado.

A saida e o probe de versao: passado o TTL, em vez de recarregar os ~2,5 MB
de vetores, o worker faz um `COUNT + MAX(ATUALIZADO_EM)` (milissegundos, com
indice) e so recarrega se algo mudou de fato. A janela maxima de inconsis-
tencia fica limitada ao TTL, e o worker que atendeu a edicao invalida na hora.

Fallback: se a tabela ainda nao existe (codigo em producao antes da migracao)
ou o banco falha, cai no JSON versionado. Assim nem a @IA nem a @Auditoria
ficam sem material por causa da ordem de deploy.
"""

import json
import os
import time
import traceback
from typing import Any

from src.infrastructure.repositories.sql_ia_conhecimento_repository import (
    IAConhecimentoRepository,
)
from src.shared.ia.embeddings import desserializar
from src.shared.ia.aurora_texto import tokens

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_JSON_PATH = os.path.join(BASE_DIR, "aurora_base_conhecimento.json")

TTL_SEGUNDOS = int(os.getenv("AURORA_KB_CACHE_TTL", "30"))

_estado: dict[str, Any] = {"itens": None, "versao": None, "expira_em": 0.0}


def _sinonimos(valor) -> list[str]:
    if isinstance(valor, list):
        return [str(item) for item in valor]
    if not valor:
        return []
    try:
        carregado = json.loads(valor)
    except (ValueError, TypeError):
        return []
    return [str(item) for item in carregado] if isinstance(carregado, list) else []


def _preparar(linha: dict) -> dict:
    """Linha do banco -> item pronto para a busca.

    Desserializar o vetor e tokenizar aqui, uma vez por recarga, e o que tira
    esse trabalho do caminho de cada pergunta -- hoje a tokenizacao dos 82
    registros e refeita a cada chamada da @IA.
    """
    sinonimos = _sinonimos(linha.get("SINONIMOS"))
    item = {
        "id": linha.get("ID_CONHECIMENTO"),
        "carteira": str(linha.get("CARTEIRA") or ""),
        "produto": str(linha.get("PRODUTO") or ""),
        "categoria": str(linha.get("CATEGORIA") or ""),
        "descricao": str(linha.get("DESCRICAO") or ""),
        "texto": str(linha.get("TEXTO") or ""),
        "sinonimos": sinonimos,
        "embedding": desserializar(linha.get("EMBEDDING")),
        "embedding_modelo": linha.get("EMBEDDING_MODELO"),
    }

    metadados = " ".join([
        item["produto"], item["categoria"], item["descricao"], " ".join(sinonimos),
    ])
    item["tokens_metadados"] = tokens(metadados)
    item["tokens_corpo"] = tokens(item["texto"])
    return item


def _carregar_do_json() -> list[dict]:
    """Rede de seguranca -- a base versionada, sem vetores."""
    try:
        with open(BASE_JSON_PATH, "r", encoding="utf-8") as arquivo:
            dados = json.load(arquivo)
    except Exception:
        traceback.print_exc()
        return []

    if not isinstance(dados, list):
        return []

    return [
        _preparar({
            "ID_CONHECIMENTO": None,
            "CARTEIRA": item.get("carteira"),
            "PRODUTO": item.get("produto"),
            "CATEGORIA": item.get("categoria"),
            "DESCRICAO": item.get("descricao"),
            "TEXTO": item.get("texto"),
            "SINONIMOS": item.get("sinonimos"),
            "EMBEDDING": None,
        })
        for item in dados
    ]


def obter_itens() -> list[dict]:
    agora = time.monotonic()

    if _estado["itens"] is not None and agora < _estado["expira_em"]:
        return _estado["itens"]

    repo = IAConhecimentoRepository()

    try:
        versao = repo.versao()
    except Exception:
        traceback.print_exc()
        if _estado["itens"] is not None:
            # Banco oscilou: servir o cache velho por mais uma janela e melhor
            # que devolver o JSON e trocar a base debaixo do operador.
            _estado["expira_em"] = agora + TTL_SEGUNDOS
            return _estado["itens"]
        print("[aurora] base em banco indisponivel; usando o JSON versionado")
        itens = _carregar_do_json()
        _estado.update(itens=itens, versao=None, expira_em=agora + TTL_SEGUNDOS)
        return itens

    if _estado["itens"] is not None and versao == _estado["versao"]:
        _estado["expira_em"] = agora + TTL_SEGUNDOS
        return _estado["itens"]

    try:
        linhas = repo.listar_todos()
    except Exception:
        traceback.print_exc()
        if _estado["itens"] is not None:
            _estado["expira_em"] = agora + TTL_SEGUNDOS
            return _estado["itens"]
        linhas = []

    if not linhas and versao.get("quantidade", 0) == 0:
        # Tabela existe mas esta vazia: a migracao ainda nao rodou.
        itens = _carregar_do_json()
        _estado.update(itens=itens, versao=versao, expira_em=agora + TTL_SEGUNDOS)
        return itens

    itens = [_preparar(linha) for linha in linhas]
    _estado.update(itens=itens, versao=versao, expira_em=agora + TTL_SEGUNDOS)
    return itens


def invalidar() -> None:
    _estado.update(itens=None, versao=None, expira_em=0.0)


def carregar_base_conhecimento() -> list[dict[str, Any]]:
    """Contrato antigo, preservado para `auditoria_training_provider`.

    Continua devolvendo lista de dicts com carteira/produto/categoria/
    descricao/texto -- so a origem mudou de arquivo para banco.
    """
    return [
        {
            "carteira": item["carteira"],
            "produto": item["produto"],
            "categoria": item["categoria"],
            "descricao": item["descricao"],
            "texto": item["texto"],
            "sinonimos": item["sinonimos"],
        }
        for item in obter_itens()
    ]
