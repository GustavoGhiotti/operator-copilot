from functools import wraps

from flask import current_app, jsonify
from flask_jwt_extended import get_jwt_identity, jwt_required

from src.application.services.permissao_service import (
    PermissaoError,
    PermissaoService,
)


def requer_qualquer_area(*areas: str):
    """Passa se o usuario tiver PELO MENOS UMA das areas.

    Existe para telas cujo publico e mais de um papel -- e, na pratica, para
    permitir listar junto a area nova e as legadas que ja concedem o mesmo
    acesso. Neste projeto a migracao do cadastro de permissao e um passo manual
    separado do deploy: sem esta versao, uma tela nova so funcionaria depois
    que alguem lembrasse de rodar o SQL.
    """

    def decorador(funcao):
        @wraps(funcao)
        @jwt_required()
        def wrapper(*args, **kwargs):
            cpf = get_jwt_identity()
            try:
                permitidas = PermissaoService().areas_do_usuario(cpf)
            except PermissaoError as erro:
                return jsonify({"erro": str(erro)}), erro.status
            except Exception:
                current_app.logger.exception(
                    "Falha ao verificar as permissoes das areas %s", areas
                )
                return jsonify({
                    "erro": "Nao foi possivel verificar sua permissao."
                }), 500

            if not permitidas & set(areas):
                return jsonify({"erro": "Voce nao tem acesso a esta area."}), 403

            return funcao(*args, **kwargs)

        return wrapper

    return decorador


def requer_area(area: str):
    """Exige que o usuario do token tenha a area antes de entrar na rota.

    Ate aqui o projeto nao tinha decorator de papel nenhum: cada service
    reimplementava a checagem dentro do proprio metodo, o que deixou pelo menos
    um endpoint sensivel (o reset de senha) sem checagem alguma. Concentrar a
    guarda no decorator torna a ausencia visivel na propria rota.

    Ja aplica `jwt_required`, entao a rota nao precisa dos dois -- e nao ha como
    declarar a area e esquecer o token.
    """

    def decorador(funcao):
        @wraps(funcao)
        @jwt_required()
        def wrapper(*args, **kwargs):
            try:
                PermissaoService().exigir(get_jwt_identity(), area)
            except PermissaoError as erro:
                return jsonify({"erro": str(erro)}), erro.status
            except Exception:
                # Falha ao consultar a permissao nao e "sem permissao". Um 403
                # aqui mandaria o suporte procurar cadastro errado enquanto o
                # problema real e o banco.
                current_app.logger.exception(
                    "Falha ao verificar a permissao da area %s", area
                )
                return jsonify({
                    "erro": "Nao foi possivel verificar sua permissao."
                }), 500

            return funcao(*args, **kwargs)

        return wrapper

    return decorador
