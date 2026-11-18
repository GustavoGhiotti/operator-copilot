from flask import Blueprint, jsonify, request, Flask
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity

from src.extensions.socketio import socketio

from src.application.services.login_service import LoginService
from src.application.services.permissao_service import (
    PermissaoError,
    PermissaoService,
)
from src.shared.errors.login_exception import *
from src.infrastructure.repositories.sql_login_repository import LoginRepository

from datetime import date

bp = Blueprint("Rota de login", __name__, url_prefix="/auth")





@bp.route("/login", methods=["POST"])
def login():
    try:  
        body:dict = request.get_json()

        cpf = body.get("CPF_COLABORADOR")
        senha = body.get("senha")

        if not cpf or not senha:
            raise LoginException("CPF e senha são obrigatórios")
        
        access_token, usuario_info = LoginService.login(cpf, senha)
        return jsonify({
            "mensagem": "Login realizado com sucesso",
            "token": access_token,
            "usuario": usuario_info
        }), 200

    except LoginException as e:
        return jsonify({"erro": str(e)}), 400

    except Exception as e:
        return jsonify({"erro": "Erro inesperado"}), 500
    


@bp.route("/logout", methods=["POST"])
@jwt_required()
def logout():
    try:
        cpf_usuario = get_jwt_identity()

        if not cpf_usuario:
            raise LoginException("Token inválido ou usuário não identificado")

        obj_login = LoginRepository(cpf_usuario)
        obj_login.logout()

        return jsonify({"mensagem": "Logout realizado com sucesso"}), 200

    except LoginException as e:
        return jsonify({"erro": str(e)}), 400

    except Exception:
        return jsonify({"erro": "Erro inesperado ao processar logout"}), 500



@bp.route("/change-password", methods=["POST"])
@jwt_required()
def change_password():
    """Troca da propria senha e reset feito por terceiro, na mesma rota.

    Ate aqui esta rota nao tinha `@jwt_required()` nem checagem de cargo
    nenhuma: quem conhecesse a URL zerava a senha de qualquer colaborador
    informando so o CPF. Sao dois fluxos com donos diferentes, e cada um tem
    agora a sua guarda:

    - com `novaSenha`, e o primeiro acesso trocando a propria senha -> o CPF do
      corpo tem que ser o do token;
    - sem `novaSenha`, e o @Senhas resetando a de outra pessoa -> exige a area
      'senhas.reset'.
    """
    try:
        body: dict = request.json or {}

        cpf = body.get("cpf")
        senha = body.get("novaSenha")

        if not cpf:
            raise LoginException("CPF obrigatório")

        cpf_do_token = str(get_jwt_identity() or "").strip()
        eh_a_propria_senha = str(cpf).strip() == cpf_do_token

        if not (senha and eh_a_propria_senha):
            try:
                PermissaoService().exigir(cpf_do_token, "senhas.reset")
            except PermissaoError as erro:
                return jsonify({"erro": str(erro)}), erro.status

        obj_login = LoginRepository(cpf)
        linhas_afetadas = obj_login.changer_password(senha) if senha else obj_login.reset_password()

        if linhas_afetadas == 0:
            raise LoginException("Usuário não encontrado ou senha não alterada")

        return jsonify({"mensagem": "Senha atualizada com sucesso"}), 200

    except LoginException as e:
        return jsonify({"erro": str(e)}), 400

    except Exception:
        return jsonify({"erro": "Erro inesperado ao atualizar senha"}), 500



@bp.route("/notificar", methods=["POST"])
def notificar():

    data = request.json

    socketio.emit(
        "copilot_event",
        {
            "type": "notification",
            "title": data["title"],
            "message": data["message"],
            "url": data.get("url")
        }
    )

    return {"status": "ok"}



@bp.route("/refresh", methods=["POST"])
@jwt_required()
def refresh():
    cpf = get_jwt_identity()
    novo_token = create_access_token(identity=cpf)
    return jsonify({"token": novo_token}), 200
