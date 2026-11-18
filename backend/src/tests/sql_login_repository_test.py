from unittest.mock import MagicMock, patch
from src.infrastructure.repositories.sql_login_repository import LoginRepository


@patch("src.infrastructure.repositories.sql_login_repository.SQLServerConnection")
def test_login_repository_login(mock_sql_connection):
    # Configurar o mock para retornar um resultado específico
    mock_sql_connection_instance = MagicMock()
    mock_sql_connection_instance.execute_fetch.return_value = {
        "NM_COLABORADOR": "João Silva",
        "SENHA": "senha123",
        "FUNCAO_COLABORADOR": "Operador de Teleatendimento",
        "CPF_COLABORADOR": "12345678900",
        "PRIMEIRO_ACESSO": 1,
        "CENTRO_CUSTO": "Atendimento",
        "SUPERVISOR": "Maria Souza",
        "ID_OLOS_CX": 1,
        "ID_OLOS_COB": 2
    }
    mock_sql_connection.return_value = mock_sql_connection_instance

    # Criar uma instância do repositório e chamar o método login
    repo = LoginRepository("12345678900")
    result = repo.login()

    # Verificar se o método execute_fetch foi chamado com os parâmetros corretos
    mock_sql_connection_instance.execute_fetch.assert_called_once_with(
        query="""  
                SELECT 
                    NM_COLABORADOR,
                    SENHA,
                    FUNCAO_COLABORADOR,
                    CPF_COLABORADOR,
                    PRIMEIRO_ACESSO, 
                    CENTRO_CUSTO, 
                    SUPERVISOR,
                    ID_OLOS_CX,
                    ID_OLOS_COB
                FROM [login].TB_USUARIOS WITH(NOLOCK)
                    WHERE CPF_COLABORADOR = ?
                """,
        parametros="12345678900",
        one=True
    )

    # Verificar se o resultado retornado é o esperado
    assert result == {
        "NM_COLABORADOR": "João Silva",
        "SENHA": "senha123",
        "FUNCAO_COLABORADOR": "Operador de Teleatendimento",
        "CPF_COLABORADOR": "12345678900",
        "PRIMEIRO_ACESSO": 1,
        "CENTRO_CUSTO": "Atendimento",
        "SUPERVISOR": "Maria Souza",
        "ID_OLOS_CX": 1,
        "ID_OLOS_COB": 2
    }

    