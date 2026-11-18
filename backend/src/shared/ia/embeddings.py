"""Embeddings da base de conhecimento da Aurora.

Todo vetor sai daqui ja normalizado (norma L2 = 1). Com isso o cosseno vira
produto escalar puro, e a busca deixa de pagar uma raiz quadrada por item --
o que importa porque a similaridade roda em Python puro (nao ha numpy no
requirements) para cada registro da carteira, a cada pergunta.

Nenhuma funcao deste modulo levanta excecao por falha de API. Uma indisponi-
bilidade da OpenAI nao pode derrubar a @IA nem impedir o supervisor de salvar
o texto que acabou de escrever: quem chama recebe `None` e decide o fallback.
"""

import hashlib
import json
import math
import os
import traceback
from array import array
from functools import lru_cache
from typing import Any, Iterable

from src.shared.openai_client import client

MODELO_EMBEDDING = os.getenv("AURORA_EMBEDDING_MODELO", "text-embedding-3-small")

# A API aceita lotes bem maiores, mas 64 mantem cada request curto o bastante
# para que uma falha custe pouco retrabalho na reindexacao.
TAMANHO_LOTE = 64


def texto_para_embedding(item: dict[str, Any]) -> str:
    """O texto que representa um registro no espaco vetorial.

    Precisa ser a MESMA funcao na gravacao, no backfill e no hash -- se a
    montagem divergir em qualquer um dos tres, o hash nunca bate e a base
    reindexa para sempre.
    """
    sinonimos = item.get("sinonimos") or item.get("SINONIMOS") or []
    if isinstance(sinonimos, str):
        try:
            sinonimos = json.loads(sinonimos) or []
        except (ValueError, TypeError):
            sinonimos = []

    partes = [
        f"Carteira: {item.get('carteira') or item.get('CARTEIRA') or ''}",
        f"Produto: {item.get('produto') or item.get('PRODUTO') or ''}",
        f"Categoria: {item.get('categoria') or item.get('CATEGORIA') or ''}",
        f"Descricao: {item.get('descricao') or item.get('DESCRICAO') or ''}",
        f"Sinonimos: {', '.join(str(s) for s in sinonimos)}",
        f"Conteudo: {item.get('texto') or item.get('TEXTO') or ''}",
    ]
    return "\n".join(partes)


def hash_conteudo(texto: str) -> str:
    return hashlib.sha256((texto or "").encode("utf-8")).hexdigest()


def _normalizar_vetor(vetor: Iterable[float]) -> list[float]:
    valores = list(vetor)
    norma = math.sqrt(sum(valor * valor for valor in valores))
    if not norma:
        return valores
    return [valor / norma for valor in valores]


def gerar_embeddings(textos: list[str]) -> list[list[float]] | None:
    """Vetores normalizados, na ordem dos textos. `None` se a API falhar."""
    if not textos:
        return []

    vetores: list[list[float]] = []
    try:
        for inicio in range(0, len(textos), TAMANHO_LOTE):
            lote = textos[inicio:inicio + TAMANHO_LOTE]
            resposta = client.embeddings.create(model=MODELO_EMBEDDING, input=lote)
            # A API devolve `index`, mas nao garante a ordem do array.
            ordenados = sorted(resposta.data, key=lambda item: item.index)
            vetores.extend(_normalizar_vetor(item.embedding) for item in ordenados)
    except Exception:
        traceback.print_exc()
        print("[embeddings] falha ao gerar embeddings; seguindo sem vetor")
        return None

    return vetores


def gerar_embedding(texto: str) -> list[float] | None:
    vetores = gerar_embeddings([texto])
    if not vetores:
        return None
    return vetores[0]


@lru_cache(maxsize=512)
def embedding_da_pergunta(pergunta: str) -> tuple[float, ...] | None:
    """Perguntas se repetem muito no chat; cada repeticao nao precisa pagar API.

    Devolve tupla porque `lru_cache` exige valor hashavel de forma segura --
    uma lista devolvida daqui poderia ser mutada pelo chamador e envenenar o
    cache para todo mundo.
    """
    vetor = gerar_embedding(pergunta)
    return tuple(vetor) if vetor else None


def similaridade(vetor_a, vetor_b) -> float:
    """Cosseno entre dois vetores JA normalizados -- so o produto escalar."""
    if vetor_a is None or vetor_b is None or len(vetor_a) != len(vetor_b):
        return 0.0
    return float(sum(a * b for a, b in zip(vetor_a, vetor_b)))


def serializar(vetor) -> str:
    return json.dumps([round(float(valor), 6) for valor in vetor])


def desserializar(texto: str | None):
    """JSON do banco -> `array('f')`.

    `array` em vez de lista: 1536 floats como objetos Python custam ~50 KB por
    registro; como array, ~6 KB. Com a base crescendo e N workers gunicorn, a
    diferenca deixa de ser detalhe.
    """
    if not texto:
        return None
    try:
        return array("f", json.loads(texto))
    except (ValueError, TypeError):
        return None
