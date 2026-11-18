"""Retrieval hibrido da Aurora: o que o modo lexical puro nao conseguia fazer."""

from unittest.mock import patch

from src.shared.ia import aurora_conhecimento_cache as cache
from src.shared.ia import aurora_retrieval as retrieval


def _item(**kwargs):
    """Item ja no formato pos-cache (tokenizado), como `_preparar` devolve."""
    base = {
        "ID_CONHECIMENTO": kwargs.get("id", 1),
        "CARTEIRA": kwargs.get("carteira", "BANCO DELTA"),
        "PRODUTO": kwargs.get("produto", "treinamento"),
        "CATEGORIA": kwargs.get("categoria", "script"),
        "DESCRICAO": kwargs.get("descricao", ""),
        "TEXTO": kwargs.get("texto", ""),
        "SINONIMOS": kwargs.get("sinonimos"),
        "EMBEDDING": None,
    }
    preparado = cache._preparar(base)
    preparado["embedding"] = kwargs.get("embedding")
    preparado["embedding_modelo"] = (
        retrieval.MODELO_EMBEDDING if kwargs.get("embedding") else None
    )
    return preparado


# Vetores unitarios de 3 dimensoes: cosseno vira produto escalar, entao os
# valores esperados sao obvios a olho nu.
VETOR_RENDA = [1.0, 0.0, 0.0]
VETOR_BOLETO = [0.0, 1.0, 0.0]


def test_recupera_por_significado_sem_palavra_em_comum():
    """O caso que motivou o RAG: zero token compartilhado, mesmo assunto."""
    itens = [
        _item(id=1, produto="objecao_renda", descricao="Objecao de renda",
              texto="Quando o devedor alega falta de recursos, ofereca entrada reduzida.",
              embedding=VETOR_RENDA),
        _item(id=2, produto="segunda_via", descricao="Segunda via de boleto",
              texto="Oriente o cliente a acessar o portal para emitir a segunda via.",
              embedding=VETOR_BOLETO),
    ]

    with patch.object(retrieval, "obter_itens", return_value=itens), \
         patch.object(retrieval, "embedding_da_pergunta", return_value=tuple(VETOR_RENDA)):
        resultado = retrieval.buscar_conhecimento_relevante(
            centro_custo="BANCO DELTA",
            pergunta="o cliente disse que esta sem grana"
        )

    assert [item["produto"] for item in resultado] == ["objecao_renda"]


def test_pergunta_sem_relacao_nao_traz_nada():
    """Sem limiar, qualquer item com 1 token em comum entrava no prompt."""
    itens = [
        _item(id=1, produto="objecao_renda", texto="Entrada reduzida para quem alega falta de recursos.",
              embedding=VETOR_RENDA),
    ]
    ortogonal = tuple([0.0, 0.0, 1.0])

    with patch.object(retrieval, "obter_itens", return_value=itens), \
         patch.object(retrieval, "embedding_da_pergunta", return_value=ortogonal):
        resultado = retrieval.buscar_conhecimento_relevante(
            centro_custo="BANCO DELTA",
            pergunta="qual o horario do almoco"
        )

    assert resultado == []


def test_falha_de_embedding_cai_no_lexical_sem_levantar():
    """API fora nao pode derrubar a @IA -- degrada para o comportamento antigo."""
    itens = [
        _item(id=1, produto="tabulacao_acordo", descricao="Tabulacao de acordo",
              texto="Registre a tabulacao ACORDO apos fechar a negociacao.",
              embedding=VETOR_RENDA),
    ]

    with patch.object(retrieval, "obter_itens", return_value=itens), \
         patch.object(retrieval, "embedding_da_pergunta", return_value=None):
        resultado = retrieval.buscar_conhecimento_relevante(
            centro_custo="BANCO DELTA",
            pergunta="como faco a tabulacao do acordo"
        )

    assert [item["produto"] for item in resultado] == ["tabulacao_acordo"]


def test_carteira_sem_conteudo_devolve_vazio():
    itens = [_item(id=1, carteira="BANCO DELTA", texto="Regra do Delta.")]

    with patch.object(retrieval, "obter_itens", return_value=itens):
        resultado = retrieval.buscar_conhecimento_relevante(
            centro_custo="MU",
            pergunta="qual o script de abertura"
        )

    assert resultado == []


def test_vetor_de_outro_modelo_e_ignorado():
    """Vetor de outro modelo nao e comparavel; usar produziria ranking errado."""
    item = _item(id=1, produto="objecao_renda",
                 texto="Entrada reduzida para quem alega falta de recursos.",
                 embedding=VETOR_RENDA)
    item["embedding_modelo"] = "modelo-antigo"

    with patch.object(retrieval, "obter_itens", return_value=[item]), \
         patch.object(retrieval, "embedding_da_pergunta", return_value=tuple(VETOR_RENDA)) as mock_emb:
        resultado = retrieval.buscar_conhecimento_relevante(
            centro_custo="BANCO DELTA",
            pergunta="o cliente esta sem dinheiro"
        )

    # Nem chega a pedir o vetor da pergunta: nao ha vetor utilizavel na carteira.
    mock_emb.assert_not_called()
    assert resultado == []


def test_limite_dinamico_corta_a_cauda():
    """Item muito a frente vai sozinho, em vez dos 4 fixos de antes."""
    itens = [
        _item(id=1, produto="objecao_renda", texto="Falta de recursos: ofereca entrada reduzida.",
              embedding=VETOR_RENDA),
        _item(id=2, produto="segunda_via", texto="Emissao de segunda via no portal.",
              embedding=VETOR_BOLETO),
        _item(id=3, produto="encerramento", texto="Agradeca e confirme o acordo.",
              embedding=[0.0, 0.0, 1.0]),
    ]

    with patch.object(retrieval, "obter_itens", return_value=itens), \
         patch.object(retrieval, "embedding_da_pergunta", return_value=tuple(VETOR_RENDA)):
        resultado = retrieval.buscar_conhecimento_relevante(
            centro_custo="BANCO DELTA",
            pergunta="cliente sem condicoes de pagar"
        )

    assert len(resultado) == 1


def test_diagnosticar_marca_o_que_seria_usado():
    itens = [
        _item(id=1, produto="objecao_renda", texto="Falta de recursos: entrada reduzida.",
              embedding=VETOR_RENDA),
        _item(id=2, produto="segunda_via", texto="Segunda via no portal.",
              embedding=VETOR_BOLETO),
    ]

    with patch.object(retrieval, "obter_itens", return_value=itens), \
         patch.object(retrieval, "embedding_da_pergunta", return_value=tuple(VETOR_RENDA)):
        relatorio = retrieval.diagnosticar(
            centro_custo="BANCO DELTA",
            pergunta="cliente sem grana"
        )

    assert relatorio["modo"] == "hibrido"
    usados = [item for item in relatorio["itens"] if item["usado"]]
    assert [item["produto"] for item in usados] == ["objecao_renda"]
    # Os reprovados continuam no relatorio, para o supervisor entender o corte.
    assert len(relatorio["itens"]) == 2
