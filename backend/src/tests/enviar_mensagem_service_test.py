from unittest.mock import MagicMock, patch

from src.application.services.enviar_mensagem_service import EnvioMensagemWhatsapp
from src.routes.mensagem_whatsapp_router import normalizar_numero_cliente


def test_normalizar_numero_cliente_com_ddd_55_sem_codigo_pais():
    assert normalizar_numero_cliente("55900000001") == "5555900000001"


def test_normalizar_numero_cliente_mantem_numero_com_codigo_pais():
    assert normalizar_numero_cliente("5555900000001") == "5555900000001"


def test_normalizar_numero_cliente_remove_mascara():
    assert normalizar_numero_cliente("(55) 90000-0001") == "5555900000001"


@patch("src.application.services.enviar_mensagem_service.CarteiraRepository")
@patch("src.application.services.enviar_mensagem_service.ConsultarDividasAtivas")
@patch("src.application.services.enviar_mensagem_service.DadosAcordoRepository")
def test_fallback_permite_cliente_sem_divida_da_carteira_53(
    dados_acordo_repository,
    consultar_dividas_ativas,
    carteira_repository,
):
    repository = MagicMock()
    repository.obter_cliente.return_value = None
    repository.obter_cliente_sem_divida.return_value = {
        "ID_CLIENTE": 51184462,
        "ID_CEDENTE": 53,
        "NM_CLIENTE": "Maria",
    }
    dados_acordo_repository.return_value = repository
    consultar_dividas_ativas.return_value.obter_dados_cliente.return_value = None
    carteira_repository.obter_carteira.return_value = {
        "NM_CEDENTE_FORMATADO": "Carteira 53"
    }

    service = EnvioMensagemWhatsapp(
        id_cliente=51184462,
        numero_cliente="5511999999999",
        operador="Operador",
    )

    assert service._obter_carteira_fallback() == {
        "ID_CEDENTE": 53,
        "NM_CLIENTE": "Maria",
        "NM_CEDENTE_FORMATADO": "Carteira 53",
    }
    repository.obter_cliente_sem_divida.assert_called_once_with(51184462)
    carteira_repository.obter_carteira.assert_called_once_with(53)
