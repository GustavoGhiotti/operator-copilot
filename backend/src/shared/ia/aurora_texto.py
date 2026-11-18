"""Normalizacao e tokenizacao usadas pela busca da base de conhecimento.

Extraido de `aurora_base_conhecimento.py` sem mudanca de comportamento: o
cache e o retrieval precisam das mesmas funcoes, e mante-las la criaria um
ciclo de import (base -> retrieval -> cache -> base).
"""

import re
import unicodedata
from typing import Any

STOPWORDS = {
    "a", "ao", "aos", "as", "como", "da", "das", "de", "do", "dos", "e",
    "em", "eu", "faco", "fazer", "me", "minha", "no", "nos", "o", "os",
    "para", "posso", "pra", "qual", "que", "aurora", "um", "uma",
}


def normalizar(texto: Any) -> str:
    texto = str(texto or "").lower()
    texto = unicodedata.normalize("NFD", texto)
    texto = "".join(char for char in texto if unicodedata.category(char) != "Mn")
    return re.sub(r"[^a-z0-9\s-]", " ", texto)


def compactar(texto: Any) -> str:
    return re.sub(r"[^a-z0-9]", "", normalizar(texto))


def tokens(texto: Any) -> set[str]:
    return {
        token
        for token in re.split(r"\s+", normalizar(texto))
        if len(token) > 2 and token not in STOPWORDS
    }


def carteira_compativel(carteira_item: str, centro_custo: str) -> bool:
    carteira = normalizar(carteira_item)
    centro = normalizar(centro_custo)
    carteira_compacta = compactar(carteira_item)
    centro_compacto = compactar(centro_custo)

    if not carteira or not centro:
        return False

    if carteira == centro or carteira in centro or centro in carteira:
        return True

    if (
        carteira_compacta
        and centro_compacto
        and (
            carteira_compacta == centro_compacto
            or carteira_compacta in centro_compacto
            or centro_compacto in carteira_compacta
        )
    ):
        return True

    carteira_tokens = tokens(carteira_item)
    centro_tokens = tokens(centro_custo)

    return "geral" in carteira_tokens and bool(carteira_tokens & centro_tokens)
