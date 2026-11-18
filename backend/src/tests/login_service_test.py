from unittest.mock import patch, MagicMock
import pytest
import src.application.services.login_service as login_service
from src.tests.permissao_seed_fake import permissoes_do_seed

# O login passou a calcular as areas concedidas em TB_PERMISSAO_VISAO. O mock
# devolve o servico real apoiado no seed em memoria, e nao um MagicMock: assim
# o teste exercita a regra de casamento de verdade, sem tocar o banco.
@patch(
    "src.application.services.login_service.PermissaoService",
    side_effect=lambda: permissoes_do_seed(),
)
@patch("src.application.services.login_service.create_access_token")
@patch("src.application.services.login_service.SqlMonitoriaWhatsappRepository")
@patch("src.application.services.login_service.LoginRepository")
def test_login_sucesso(
    mock_login_repo_class,
    mock_monitoria_repo_class,
    mock_create_token,
    mock_permissao_service,
):

    # ---------------------------
    # MOCK LOGIN REPOSITORY
    # ---------------------------

    mock_login_repo = MagicMock()

    mock_login_repo.login.return_value = {
        "NM_COLABORADOR": "Matheus Silva",
        "SENHA": "123",
        "FUNCAO_COLABORADOR": "Supervisor(a) de Operacoes",
        "CPF_COLABORADOR": "12345678900",
        "PRIMEIRO_ACESSO": 1,
        "CENTRO_CUSTO": "QUALIDADE",
        "SUPERVISOR": "João",
        "ID_OLOS_CX": 10,
        "ID_OLOS_COB": 20
    }

    mock_login_repo.validar_log_acesso.return_value = False

    mock_login_repo_class.return_value = mock_login_repo

    # ---------------------------
    # MOCK MONITORIA
    # ---------------------------

    mock_monitoria_repo = MagicMock()

    mock_monitoria_repo.obter_carteira_por_centro_custo.side_effect = (
        lambda centro_custo, somente_whatsapp:
            ["Carteira WhatsApp"] if somente_whatsapp else ["Carteira Completa"]
    )

    mock_monitoria_repo_class.return_value = mock_monitoria_repo

    # ---------------------------
    # MOCK TOKEN
    # ---------------------------

    mock_create_token.return_value = "token_fake"

    # ---------------------------
    # EXECUTA
    # ---------------------------

    token, usuario = login_service.LoginService.login(
        cpf="12345678900",
        senha="123"
    )

    # ---------------------------
    # ASSERTS
    # ---------------------------

    assert token == "token_fake"

    assert usuario["cpf"] == "12345678900"

    assert usuario["is_admin"] is True

    assert usuario["primeiroAcesso"] is True

    # Supervisor em Qualidade: cria campanha na Arena e reseta senha, mas nao
    # alcanca a Central de Gestao.
    assert "arena.supervisor" in usuario["areas"]
    assert "senhas.reset" in usuario["areas"]
    assert "gerencia.gestao" not in usuario["areas"]

    # valida criação token
    mock_create_token.assert_called_once()

    # valida log
    mock_login_repo.status_login.assert_called_once()

    mock_login_repo.inserir_log_acesso.assert_called_once()


@pytest.mark.parametrize(
    "centro_custo",
    [
        "MARKETING",
        "GERENCIA OPERACIONAL                    ",
        "PLANEJAMENTO                            ",
        "DESENVOLVIMENTO",
        "TI",
        "QUALIDADE",
    ],
)
@patch(
    "src.application.services.login_service.PermissaoService",
    side_effect=lambda: permissoes_do_seed(),
)
@patch("src.application.services.login_service.create_access_token")
@patch("src.application.services.login_service.SqlMonitoriaWhatsappRepository")
@patch("src.application.services.login_service.LoginRepository")
def test_login_libera_visao_administrativa_por_centro_custo(
    mock_login_repo_class,
    mock_monitoria_repo_class,
    mock_create_token,
    mock_permissao_service,
    centro_custo,
):
    mock_login_repo = MagicMock()
    mock_login_repo.login.return_value = {
        "NM_COLABORADOR": "Nicolas Acme Fernandes",
        "SENHA": "senha_teste_123",
        "FUNCAO_COLABORADOR": "ESPECIALISTA DE RECUPERACAO DE",
        "CPF_COLABORADOR": "52998224725",
        "PRIMEIRO_ACESSO": 0,
        "CENTRO_CUSTO": centro_custo,
        "SUPERVISOR": None,
        "ID_OLOS_CX": 7921,
        "ID_OLOS_COB": 9324,
    }
    mock_login_repo.validar_log_acesso.return_value = True
    mock_login_repo_class.return_value = mock_login_repo
    mock_monitoria_repo_class.return_value = MagicMock()
    mock_create_token.return_value = "token_fake"

    _, usuario = login_service.LoginService.login(
        cpf="52998224725",
        senha="senha_teste_123",
    )

    assert usuario["is_admin"] is True


@pytest.mark.parametrize(
    "funcao, centro_custo",
    [
        ("GERENTE DE OPERACOES", "COBRANCA GAMA"),
        ("GERENTE DE OPERACOES SR", "COBRANCA GAMA"),
        ("GERENTE DE TI", "TI"),
        # Truncado no cadastro, e com padding: e assim que o valor sai do banco.
        ("ESPECIALISTA DE RECUPERACAO DE    ", "COBRANCA GAMA"),
    ],
)
@patch(
    "src.application.services.login_service.PermissaoService",
    side_effect=lambda: permissoes_do_seed(),
)
@patch("src.application.services.login_service.create_access_token")
@patch("src.application.services.login_service.SqlMonitoriaWhatsappRepository")
@patch("src.application.services.login_service.LoginRepository")
def test_login_entrega_a_visao_da_gerencia_para_as_quatro_funcoes(
    mock_login_repo_class,
    mock_monitoria_repo_class,
    mock_create_token,
    mock_permissao_service,
    funcao,
    centro_custo,
):
    """O que a migration 019 vem entregar.

    Antes dela, so quem estava lotado em 'Gerencia Operacional' alcancava a
    Central de Gestao -- o gerente de TI e o especialista de recuperacao
    respondem pela mesma visao e ficavam de fora.
    """
    mock_login_repo = MagicMock()
    mock_login_repo.login.return_value = {
        "NM_COLABORADOR": "Fulano de Tal",
        "SENHA": "123",
        "FUNCAO_COLABORADOR": funcao,
        "CPF_COLABORADOR": "11122233344",
        "PRIMEIRO_ACESSO": 0,
        "CENTRO_CUSTO": centro_custo,
        "SUPERVISOR": None,
        "ID_OLOS_CX": 1,
        "ID_OLOS_COB": 2,
    }
    mock_login_repo.validar_log_acesso.return_value = True
    mock_login_repo_class.return_value = mock_login_repo
    mock_monitoria_repo_class.return_value = MagicMock()
    mock_create_token.return_value = "token_fake"

    _, usuario = login_service.LoginService.login(cpf="11122233344", senha="123")

    assert "gerencia.gestao" in usuario["areas"]
    assert "gerencia.resultados" in usuario["areas"]
    assert "arena.observatorio" in usuario["areas"]
    assert "senhas.reset" in usuario["areas"]
    # Acompanhar nao e comandar: criar campanha segue com o supervisor.
    assert "arena.supervisor" not in usuario["areas"]
