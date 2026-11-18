"""Busca hibrida (semantica + lexical) na base de conhecimento da Aurora.

O que existia antes era so o lexical: interseccao de tokens entre a pergunta
e o registro. Isso falha exatamente onde mais importa -- o operador raramente
usa as palavras do cadastro. "O cliente disse que ta sem grana" tem zero token
em comum com um treinamento de objecao de renda, entao nada era recuperado e a
Aurora respondia generico.

O lexical nao foi substituido, foi somado: ele e insubstituivel para termo
exato de carteira (nomes de produto, codigos de tabulacao), que o embedding
dilui no meio do significado geral da frase.

Escala: a busca e linear sobre os registros da carteira, em Python puro. Com
a ordem de grandeza atual (dezenas por carteira) roda em poucos milissegundos.
Acima de ~2.000 registros por carteira vale reavaliar o desenho.
"""

import os

from src.shared.ia.embeddings import MODELO_EMBEDDING, embedding_da_pergunta, similaridade
from src.shared.ia.aurora_conhecimento_cache import obter_itens
from src.shared.ia.aurora_texto import carteira_compativel, tokens

PESO_VETORIAL = float(os.getenv("AURORA_RAG_PESO_VETORIAL", "0.65"))
PESO_LEXICAL = 1.0 - PESO_VETORIAL

LIMIAR = float(os.getenv("AURORA_RAG_LIMIAR", "0.35"))
# Acerto semantico forte entra mesmo sem nenhuma palavra em comum -- e o caso
# que o modo antigo perdia por completo.
LIMIAR_VETORIAL_RESGATE = 0.55
# Sem vetor nenhum, o corte tem de ser lexical: 0.30 equivale a score bruto 3,
# ou seja, ao menos um token de metadado (que vale 3) em comum.
LIMIAR_LEXICAL_PURO = 0.30

LIMITE_MAX = 5
# Mantem so o pelotao da frente. Se um item esta muito a frente, ele vai
# sozinho: encher o prompt com o 4o colocado e o que faz a instrucao "responda
# pelo treinamento oficial" apontar para o material errado.
FATOR_CORTE_RELATIVO = 0.60

# Saturacao do score lexical bruto. 6 = meia altura: s=1 -> 0.14, s=6 -> 0.50,
# s=18 -> 0.75. Nao se normaliza pelo maximo do conjunto de proposito -- isso
# daria 1.0 ao melhor item mesmo quando o melhor e ruim.
SATURACAO_LEXICAL = 6.0

# O cosseno do text-embedding-3-small entre textos do mesmo dominio raramente
# cai abaixo de 0.20; sem reescalar, tudo ficaria espremido e o limiar perderia
# poder de discriminacao.
COSSENO_MINIMO = 0.20
COSSENO_FAIXA = 0.60


def _score_lexical_bruto(pergunta_tokens: set[str], item: dict) -> int:
    return (
        len(pergunta_tokens & item["tokens_metadados"]) * 3
        + len(pergunta_tokens & item["tokens_corpo"])
    )


def _normalizar_lexical(bruto: int) -> float:
    return bruto / (bruto + SATURACAO_LEXICAL) if bruto else 0.0


def _normalizar_cosseno(cosseno: float) -> float:
    return max(0.0, min(1.0, (cosseno - COSSENO_MINIMO) / COSSENO_FAIXA))


def _vetor_utilizavel(item: dict):
    """Vetor de outro modelo nao e comparavel -- tratar como se nao houvesse.

    Sem isso, trocar `AURORA_EMBEDDING_MODELO` produziria um ranking errado
    em silencio, que e a pior forma de errar aqui.
    """
    if item.get("embedding") is None:
        return None
    if item.get("embedding_modelo") and item["embedding_modelo"] != MODELO_EMBEDDING:
        return None
    return item["embedding"]


def _pontuar(*, centro_custo: str, pergunta: str) -> list[dict]:
    pergunta_tokens = tokens(pergunta)

    candidatos = [
        item for item in obter_itens()
        if carteira_compativel(item["carteira"], centro_custo)
    ]
    if not candidatos:
        return []

    tem_vetor = any(_vetor_utilizavel(item) is not None for item in candidatos)
    vetor_pergunta = embedding_da_pergunta(pergunta.strip()) if tem_vetor else None
    # Sem vetor da pergunta (API fora, ou base ainda nao indexada) o peso vai
    # todo para o lexical: degrada para o comportamento antigo com limiar, e
    # nunca para erro.
    modo_lexical = vetor_pergunta is None

    avaliados = []
    for item in candidatos:
        bruto = _score_lexical_bruto(pergunta_tokens, item)
        lexical = _normalizar_lexical(bruto)

        cosseno = 0.0
        if not modo_lexical:
            vetor = _vetor_utilizavel(item)
            if vetor is not None:
                cosseno = similaridade(vetor_pergunta, vetor)

        vetorial = _normalizar_cosseno(cosseno)
        final = lexical if modo_lexical else (
            PESO_VETORIAL * vetorial + PESO_LEXICAL * lexical
        )

        avaliados.append({
            "item": item,
            "score": round(final, 4),
            "score_vetorial": round(vetorial, 4),
            "score_lexical": round(lexical, 4),
            "cosseno": round(cosseno, 4),
            "score_bruto": bruto,
            "modo_lexical": modo_lexical,
        })

    avaliados.sort(key=lambda linha: linha["score"], reverse=True)
    return avaliados


def _aprovado(linha: dict) -> bool:
    if linha["modo_lexical"]:
        return linha["score"] >= LIMIAR_LEXICAL_PURO
    return linha["score"] >= LIMIAR or linha["cosseno"] >= LIMIAR_VETORIAL_RESGATE


def _formatar(linha: dict) -> dict[str, str]:
    item = linha["item"]
    return {
        "id": item["id"],
        "carteira": item["carteira"],
        "produto": item["produto"],
        "categoria": item["categoria"],
        "descricao": item["descricao"],
        "texto": item["texto"],
        "score": linha["score"],
        "score_vetorial": linha["score_vetorial"],
        "score_lexical": linha["score_lexical"],
    }


def _selecionar(avaliados: list[dict], limite: int) -> list[dict]:
    aprovados = [linha for linha in avaliados if _aprovado(linha)]
    if not aprovados:
        return []

    corte = max(LIMIAR, FATOR_CORTE_RELATIVO * aprovados[0]["score"])
    selecionados = [linha for linha in aprovados if linha["score"] >= corte]

    # O melhor colocado sempre passa: ele ja passou pelo limiar (ou pelo
    # resgate vetorial) e nao pode ser cortado por um corte relativo calculado
    # a partir dele mesmo.
    return (selecionados or aprovados[:1])[:limite]


def buscar_conhecimento_relevante(
    *,
    centro_custo: str | None,
    pergunta: str,
    limite: int = LIMITE_MAX,
) -> list[dict[str, str]]:
    if not centro_custo or not (pergunta or "").strip():
        return []

    avaliados = _pontuar(centro_custo=centro_custo, pergunta=pergunta)
    return [_formatar(linha) for linha in _selecionar(avaliados, limite)]


def diagnosticar(*, centro_custo: str | None, pergunta: str) -> dict:
    """Mesmo ranking, com os scores expostos -- alimenta a aba Testar da tela.

    E o que permite o supervisor escrever um treinamento e conferir na hora se
    a Aurora vai encontra-lo, em vez de descobrir pelo operador reclamando.
    """
    if not centro_custo or not (pergunta or "").strip():
        return {"itens": [], "modo": "sem_parametros", "limiar": LIMIAR}

    avaliados = _pontuar(centro_custo=centro_custo, pergunta=pergunta)
    selecionados = {id(linha) for linha in _selecionar(avaliados, LIMITE_MAX)}

    return {
        "modo": "lexical" if (avaliados and avaliados[0]["modo_lexical"]) else "hibrido",
        "limiar": LIMIAR,
        "peso_vetorial": PESO_VETORIAL,
        "itens": [
            {
                "id": linha["item"]["id"],
                "carteira": linha["item"]["carteira"],
                "produto": linha["item"]["produto"],
                "categoria": linha["item"]["categoria"],
                "descricao": linha["item"]["descricao"],
                "score": linha["score"],
                "score_vetorial": linha["score_vetorial"],
                "score_lexical": linha["score_lexical"],
                "cosseno": linha["cosseno"],
                "usado": id(linha) in selecionados,
            }
            for linha in avaliados[:15]
        ],
    }
