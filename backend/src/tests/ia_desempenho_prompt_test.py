"""O que a Aurora realmente recebe: historico presente e treinamento uma vez so."""

from unittest.mock import MagicMock, patch

from src.application.services.ia_services import IADesempenhoService

TREINAMENTO = [{
    "id": 1,
    "carteira": "BANCO DELTA",
    "produto": "abertura",
    "categoria": "script",
    "descricao": "Roteiro de abertura",
    "texto": "Apresente-se e confirme os dados do titular.",
    "score": 0.81,
}]

CONVERSA = [
    {"IS_USER": 1, "MENSAGEM": "como abro a ligacao?"},
    {"IS_USER": 0, "MENSAGEM": "Apresente-se e confirme os dados."},
]


def _executar(conhecimentos, mensagens_conversa):
    repo = MagicMock()
    repo.buscar_kpis.return_value = {
        "total_pago": 1000.0,
        "total_risco_pago": 500.0,
        "total_acordo": 250.0,
        "qtd_registros": 3,
    }
    repo.buscar_mensagens_conversa.return_value = mensagens_conversa
    repo.buscar_historico_cliente.return_value = []
    repo.salvar_mensagem_bd.return_value = 99

    resposta = MagicMock()
    resposta.choices = [MagicMock(message=MagicMock(content="resposta da IA"))]

    with patch("src.application.services.ia_services.IADesempenhoRepository", return_value=repo), \
         patch("src.application.services.ia_services.buscar_conhecimento_relevante",
               return_value=conhecimentos), \
         patch("src.application.services.ia_services.client") as mock_client, \
         patch.object(IADesempenhoService, "_classificar_e_salvar_pergunta", return_value={}):
        mock_client.chat.completions.create.return_value = resposta
        texto, contexto = IADesempenhoService().executar(
            "Matheus", "e se ele recusar?", False, "BANCO DELTA", "conversa-1"
        )

    messages = mock_client.chat.completions.create.call_args.kwargs["messages"]
    return texto, contexto, messages


def test_historico_entra_mesmo_havendo_treinamento():
    """Antes o historico era descartado justamente quando havia treinamento."""
    _, _, messages = _executar(TREINAMENTO, CONVERSA)

    intermediarias = messages[1:-1]
    assert [m["role"] for m in intermediarias] == ["user", "assistant"]
    assert intermediarias[0]["content"] == "como abro a ligacao?"


def test_treinamento_aparece_uma_unica_vez():
    """Ia tres vezes: lista no contexto, texto formatado e bloco de instrucao."""
    _, _, messages = _executar(TREINAMENTO, CONVERSA)

    corpo = messages[-1]["content"]
    assert corpo.count("Apresente-se e confirme os dados do titular.") == 1
    assert "## TREINAMENTO OFICIAL DA CARTEIRA" in corpo


def test_contexto_devolvido_nao_carrega_o_treinamento():
    """O front so consome kpis/analise/resposta_id; mandar o texto e peso morto."""
    _, contexto, _ = _executar(TREINAMENTO, CONVERSA)

    assert "treinamentos_carteira" not in contexto
    assert "treinamentos_carteira_prompt" not in contexto
    assert contexto["conhecimentos_usados"] == [{"produto": "abertura", "score": 0.81}]
    assert contexto["resposta_id"] == 99


def test_sem_treinamento_o_bloco_nao_aparece():
    _, _, messages = _executar([], CONVERSA)

    corpo = messages[-1]["content"]
    assert "TREINAMENTO OFICIAL" not in corpo
    assert "## PERGUNTA" in corpo


def test_simular_nao_grava_nada():
    """Teste de curadoria nao pode entrar no historico nem na base de analise.

    Se gravasse, o painel de duvidas dos operadores passaria a contar as
    perguntas que a propria Qualidade digitou para testar -- estragando o dado
    que deveria orientar qual ficha escrever em seguida.
    """
    repo = MagicMock()
    resposta = MagicMock()
    resposta.choices = [MagicMock(message=MagicMock(content="resposta simulada"))]

    with patch("src.application.services.ia_services.IADesempenhoRepository", return_value=repo), \
         patch("src.application.services.ia_services.buscar_conhecimento_relevante",
               return_value=TREINAMENTO), \
         patch("src.application.services.ia_services.client") as mock_client:
        mock_client.chat.completions.create.return_value = resposta
        texto, conhecimentos = IADesempenhoService().simular(
            centro_custo="BANCO DELTA", pergunta="como abro a ligacao?"
        )

    assert texto == "resposta simulada"
    assert conhecimentos == TREINAMENTO
    repo.salvar_mensagem_bd.assert_not_called()
    repo.salvar_analise_pergunta.assert_not_called()


def test_simular_usa_o_mesmo_prompt_do_operador():
    """Prompt paralelo divergiria com o tempo e a tela passaria a mentir."""
    resposta = MagicMock()
    resposta.choices = [MagicMock(message=MagicMock(content="ok"))]

    with patch("src.application.services.ia_services.IADesempenhoRepository"), \
         patch("src.application.services.ia_services.buscar_conhecimento_relevante",
               return_value=TREINAMENTO), \
         patch("src.application.services.ia_services.client") as mock_client:
        mock_client.chat.completions.create.return_value = resposta
        IADesempenhoService().simular(
            centro_custo="BANCO DELTA", pergunta="como abro a ligacao?"
        )

    messages = mock_client.chat.completions.create.call_args.kwargs["messages"]
    corpo = messages[-1]["content"]
    assert "## TREINAMENTO OFICIAL DA CARTEIRA" in corpo
    assert "Apresente-se e confirme os dados do titular." in corpo
    assert "## PERGUNTA" in corpo
    # Sem historico: a simulacao e sempre uma pergunta isolada.
    assert len(messages) == 2
