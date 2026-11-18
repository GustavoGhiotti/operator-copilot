from datetime import date
from flask_jwt_extended import create_access_token
from src.application.services.permissao_service import PermissaoService
from src.infrastructure.repositories.sql_login_repository import LoginRepository
from src.infrastructure.repositories.sql_monitoria_whatsapp_repository import SqlMonitoriaWhatsappRepository
from src.shared.errors.login_exception import *
from src.shared.utils.monitoria_permissoes import (
    funcao_eh_operador_monitoria,
    funcao_eh_supervisor_monitoria,
    normalizar_texto,
    possui_cargo,
)

CENTROS_CUSTO_COM_VISAO_ADMINISTRATIVA = {
    "marketing",
    "gerencia operacional",
    "planejamento",
    "desenvolvimento",
    "ti",
    "qualidade",
}


class LoginService:
    def login(cpf: str, senha: str):
        obj_login = LoginRepository(cpf)
        result = obj_login.login()

        if result is None:
            raise LoginException("Credenciais inválida")

        if senha != result["SENHA"]:
            raise LoginException("Credenciais inválida")

        funcao_normalizada = normalizar_texto(result["FUNCAO_COLABORADOR"])
        centro_custo = result["CENTRO_CUSTO"]
        centro_custo_normalizado = normalizar_texto(centro_custo)

        is_admin = (
            possui_cargo(
                funcao_normalizada,
                [
                    "supervisor(a) de operacoes",
                    "assistente de coordenacao",
                    "supervisor(a) de qualidade",
                    "coordenador(a) qualidade",
                    "monitor de teleatendimento",
                    "coordenador(a) de operacoes jr",
                    "assistente de supervisao",
                    "auxiliar administrativo",
                    "assistente administrativo",
                    "instrutor de treinamento jr",
                    "assistente de desenvolvimento",
                ],
            )
            or centro_custo_normalizado in CENTROS_CUSTO_COM_VISAO_ADMINISTRATIVA
        )

        is_gerente = (
            centro_custo_normalizado == "gerencia operacional"
            or possui_cargo(
                funcao_normalizada,
                [
                    "gerente de operacoes",
                    "gerente de operacoes jr",
                    "gerente de operacoes sr",
                ],
            )
        )

        repo_monitoria = SqlMonitoriaWhatsappRepository()

        carteira_operador = repo_monitoria.obter_carteira_por_centro_custo(
            centro_custo,
            somente_whatsapp=True
        )
        carteira_supervisao = repo_monitoria.obter_carteira_por_centro_custo(
            centro_custo,
            somente_whatsapp=False
        )

        pode_operador_whatsapp = (
            funcao_eh_operador_monitoria(funcao_normalizada)
            and bool(carteira_operador)
        )
        pode_monitoria_whatsapp = (
            funcao_eh_supervisor_monitoria(funcao_normalizada)
            and bool(carteira_supervisao)
        )

        # Areas concedidas em TB_PERMISSAO_VISAO. Vao no payload para a tela
        # saber o que mostrar; quem barra de verdade continua sendo o servidor,
        # que reconsulta a permissao a cada requisicao protegida.
        _permissao = PermissaoService()
        areas = sorted(
            _permissao.areas_para(
                funcao=result["FUNCAO_COLABORADOR"],
                centro_custo=centro_custo,
                cpf=result["CPF_COLABORADOR"],
            )
        )
        # Negadas na tela de acessos. Sem esta lista, as regras legadas do
        # frontend (`centro de custo OU area`) reacendem o que foi tirado.
        areas_negadas = sorted(_permissao.areas_negadas(result["CPF_COLABORADOR"]))

        usuario_info = {
            "userName": str(result["NM_COLABORADOR"]).split(" ", 1)[0].lower().capitalize(),
            "cpf": result["CPF_COLABORADOR"],
            "nomeCompleto": result["NM_COLABORADOR"],
            "funcao": result["FUNCAO_COLABORADOR"],
            "centroCusto": centro_custo,
            "primeiroAcesso": int(result["PRIMEIRO_ACESSO"]) == 1,
            "supervisor": result["SUPERVISOR"],
            "is_admin": is_admin,
            "is_gerente": is_gerente,
            "areas": areas,
            "areas_negadas": areas_negadas,
            "pode_operador_whatsapp": pode_operador_whatsapp,
            "pode_monitoria_whatsapp": pode_monitoria_whatsapp,
            "id_olos_cx": result["ID_OLOS_CX"],
            "id_olos_cob": result["ID_OLOS_COB"]
        }

        access_token = create_access_token(identity=str(usuario_info["cpf"]))

        obj_login.status_login()

        log_registrado = obj_login.validar_log_acesso(date.today())

        if not log_registrado:
            obj_login.inserir_log_acesso(result["NM_COLABORADOR"], date.today())

        return access_token, usuario_info
