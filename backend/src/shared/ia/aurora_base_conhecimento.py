"""Fachada da base de conhecimento da Aurora.

A implementacao mudou de lugar -- o conteudo agora vem do banco
(`aurora_conhecimento_cache`) e a busca e hibrida
(`aurora_retrieval`) -- mas o contrato deste modulo foi mantido para que
`ia_services` e `auditoria_training_provider` continuem importando daqui sem
alteracao.

Os helpers de texto vivem em `aurora_texto` e sao reexportados com os nomes
privados antigos porque outros pontos do projeto podem depender deles.
"""

from typing import Any

from src.shared.ia.aurora_conhecimento_cache import carregar_base_conhecimento
from src.shared.ia.aurora_retrieval import buscar_conhecimento_relevante, diagnosticar
from src.shared.ia.aurora_texto import (
    STOPWORDS,
    carteira_compativel as _carteira_compativel,
    compactar as _compactar,
    normalizar as _normalizar,
    tokens as _tokens,
)

__all__ = [
    "STOPWORDS",
    "buscar_conhecimento_relevante",
    "carregar_base_conhecimento",
    "diagnosticar",
    "formatar_conhecimento_para_prompt",
    "_carteira_compativel",
    "_compactar",
    "_normalizar",
    "_tokens",
]


def formatar_conhecimento_para_prompt(itens: list[dict[str, Any]]) -> str:
    if not itens:
        return "Nenhum treinamento especifico encontrado para esta pergunta."

    blocos = []
    for item in itens:
        blocos.append(
            "\n".join([
                f"Carteira: {item['carteira']}",
                f"Produto: {item['produto']}",
                f"Categoria: {item['categoria']}",
                f"Descricao: {item['descricao']}",
                f"Conteudo: {item['texto']}",
            ])
        )

    return "\n\n---\n\n".join(blocos)
