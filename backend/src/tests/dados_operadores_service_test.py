from decimal import Decimal
from unittest.mock import patch
from src.application.services.dados_operadores_service import DadosOperadoresService, ResultadoCPCService


@patch('src.application.services.dados_operadores_service.DadosOperadoresRepository')
def test_get_dados_operadores(mock_repository):

    service = DadosOperadoresService()

    service.repository = mock_repository.return_value

    service.repository.obter_carteira_atualizada.return_value = [
        {
            "AGENTID": "123",
            "NAME": "VEGA",
            "STARTLOGIN": "2024-01-01"
        }
    ]

    resultado = service.obter_carteira_atualizada("123", "123")

    assert resultado == "VEGA"

    service.repository.obter_carteira_atualizada.assert_called_once_with(
        "123",
        "123"
    )


@patch('src.application.services.dados_operadores_service.ResultadoCPCRepository')
def test_resultado_cpc_normaliza_retorno_sql(mock_repository):
    mock_repository.return_value.buscar.return_value = [
        {
            "total_cpc": Decimal("7"),
            "ce_do_dia": None,
            "acionamento": 15,
        }
    ]

    service = ResultadoCPCService()
    resultado = service.obter(" Maria Silva ")

    assert resultado == [
        {
            "total_cpc": 7,
            "ce_do_dia": 0,
            "acionamento": 15,
        }
    ]
    mock_repository.return_value.buscar.assert_called_once_with("Maria Silva")


@patch('src.application.services.dados_operadores_service.ResultadoCPCRepository')
def test_resultado_cpc_aceita_alias_antigos(mock_repository):
    mock_repository.return_value.buscar.return_value = [
        {
            "CPC_DO_DIA": Decimal("3"),
            "CE_DO_DIA": Decimal("2"),
            "ACIONAMENTO": 11,
        }
    ]

    service = ResultadoCPCService()
    resultado = service.obter("Joao")

    assert resultado == [
        {
            "total_cpc": 3,
            "ce_do_dia": 2,
            "acionamento": 11,
        }
    ]


@patch('src.application.services.dados_operadores_service.IADesempenhoRepository')
@patch('src.application.services.dados_operadores_service.DadosOperadoresRepository')
def test_carteira_do_operador_usa_a_sp_quando_ela_resolve(mock_repo, mock_ia):
    mock_repo.return_value.obter_carteira_atualizada.return_value = [
        {"NAME": "MU"}
    ]

    resultado = DadosOperadoresService().obter_carteira_do_operador(
        operador="Marta",
        id_olos_cx="5438",
        id_olos_cob="7562",
    )

    assert resultado == "MU"
    mock_ia.return_value.ultima_carteira_conhecida.assert_not_called()


@patch('src.application.services.dados_operadores_service.IADesempenhoRepository')
@patch('src.application.services.dados_operadores_service.DadosOperadoresRepository')
def test_carteira_do_operador_herda_a_ultima_quando_a_sp_volta_vazia(mock_repo, mock_ia):
    # Operador fora do discador na hora da pergunta: a SP nao devolve nada e a
    # pergunta gravava sem carteira, sumindo dos relatorios.
    mock_repo.return_value.obter_carteira_atualizada.return_value = []
    mock_ia.return_value.ultima_carteira_conhecida.return_value = "MU"

    resultado = DadosOperadoresService().obter_carteira_do_operador(
        operador="Marta",
        id_olos_cx="5438",
        id_olos_cob="7562",
    )

    assert resultado == "MU"
    mock_ia.return_value.ultima_carteira_conhecida.assert_called_once_with("Marta")


@patch('src.application.services.dados_operadores_service.DadosOperadoresRepository')
def test_carteira_atualizada_aceita_um_id_e_nao_manda_none_como_texto(mock_repo):
    mock_repo.return_value.obter_carteira_atualizada.return_value = [
        {"NAME": "MU"}
    ]

    resultado = DadosOperadoresService().obter_carteira_atualizada(None, "7183")

    assert resultado == "MU"
    mock_repo.return_value.obter_carteira_atualizada.assert_called_once_with(
        None,
        "7183",
    )


@patch('src.application.services.dados_operadores_service.DadosOperadoresRepository')
def test_carteira_atualizada_sem_nenhum_id_retorna_none(mock_repo):
    resultado = DadosOperadoresService().obter_carteira_atualizada(None, "  ")

    assert resultado is None
    mock_repo.return_value.obter_carteira_atualizada.assert_not_called()
