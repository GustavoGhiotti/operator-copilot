from unittest.mock import patch

from main import app

@patch("src.routes.ia_router.IADesempenhoService")
@patch("src.routes.ia_router.DadosOperadoresService")
def test_desempenho_sucesso(
    mock_dados_service,
    mock_ia_service
):

    # --------------------------------
    # MOCK CENTRO CUSTO
    # --------------------------------

    mock_dados_service.return_value.obter_carteira_do_operador.return_value = "VEGA"

    # --------------------------------
    # MOCK IA
    # --------------------------------

    mock_ia_service.return_value.executar.return_value = (
        "Resposta IA",
        "Contexto IA"
    )

    client = app.test_client()

    response = client.post(
        "/ia/desempenho",
        json={
            "OPERADOR": "Matheus",
            "PERGUNTA": "Como está o desempenho?",
            "IS_ADMIN": True,
            "ID_OLOS_CX": "123",
            "ID_OLOS_COB": "456",
            "CONVERSA_ID": "abc"
        }
    )

    # --------------------------------
    # ASSERTS
    # --------------------------------

    assert response.status_code == 200

    data = response.get_json()

    assert data["resposta"] == "Resposta IA"

    assert data["contexto"] == "Contexto IA"


def test_desempenho_sem_operador():

    client = app.test_client()

    response = client.post(
        "/ia/desempenho",
        json={}
    )

    assert response.status_code == 400

    data = response.get_json()

    assert data["erro"] == "OPERADOR e PERGUNTA são obrigatórios"

@patch("src.routes.ia_router.IADesempenhoService")
@patch("src.routes.ia_router.DadosOperadoresService")
def test_desempenho_aceita_apenas_um_id_olos(mock_dados_service, mock_ia_service):
    # Operador so de cobranca nao tem ID_OLOS_CX. A SP resolve com um id so,
    # entao a rota nao pode mais exigir os dois.
    mock_dados_service.return_value.obter_carteira_do_operador.return_value = "MU"
    mock_ia_service.return_value.executar.return_value = ("Resposta", "Contexto")

    response = app.test_client().post(
        "/ia/desempenho",
        json={
            "OPERADOR": "Kriscia",
            "PERGUNTA": "Qual o prazo?",
            "ID_OLOS_COB": "7183",
            "CONVERSA_ID": "abc",
        },
    )

    assert response.status_code == 200
    mock_dados_service.return_value.obter_carteira_do_operador.assert_called_once_with(
        operador="Kriscia",
        id_olos_cx=None,
        id_olos_cob="7183",
    )


def test_desempenho_exige_ao_menos_um_id_olos():
    response = app.test_client().post(
        "/ia/desempenho",
        json={"OPERADOR": "Ana", "PERGUNTA": "Como negociar?"},
    )

    assert response.status_code == 400
    assert "ID_OLOS" in response.get_json()["erro"]
