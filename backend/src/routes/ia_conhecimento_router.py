"""Endpoints da tela @Treinamentos -- CRUD da base de conhecimento da Aurora.

A guarda usa `requer_qualquer_area` com a area nova e as duas legadas que ja
concedem o mesmo publico. Assim a tela funciona no dia do deploy, sem esperar
a migracao do cadastro de permissao, que neste projeto e um passo manual
separado.

O autor de toda escrita vem do token, nunca do corpo -- senao qualquer cliente
poderia assinar a alteracao com o nome de outra pessoa.
"""

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity

from src.application.services.ia_conhecimento_service import (
    ConhecimentoError,
    IAConhecimentoService,
)
from src.middleware.permissoes import requer_qualquer_area

bp = Blueprint("IAConhecimento", __name__, url_prefix="/ia/conhecimento")

AREAS = ("aurora.conhecimento", "qualidade.monitoria", "supervisao.operacao")


def _executar(operacao, status_sucesso=200):
    try:
        return jsonify(operacao()), status_sucesso
    except ConhecimentoError as erro:
        return jsonify({"erro": str(erro)}), erro.status
    except Exception:
        current_app.logger.exception("Erro na base de conhecimento da Aurora")
        return jsonify({
            "erro": "Nao foi possivel tratar a base de conhecimento."
        }), 500


def _autor():
    return str(get_jwt_identity() or "")


@bp.route("", methods=["GET"])
@requer_qualquer_area(*AREAS)
def listar():
    return _executar(lambda: IAConhecimentoService().listar({
        "carteira": request.args.get("carteira"),
        "busca": request.args.get("busca"),
        "incluir_inativos": request.args.get("incluir_inativos"),
        "pagina": request.args.get("pagina"),
        "tamanho": request.args.get("tamanho"),
    }))


@bp.route("/carteiras", methods=["GET"])
@requer_qualquer_area(*AREAS)
def listar_carteiras():
    return _executar(
        lambda: {"carteiras": IAConhecimentoService().listar_carteiras()}
    )


@bp.route("/<int:id_conhecimento>", methods=["GET"])
@requer_qualquer_area(*AREAS)
def obter(id_conhecimento):
    return _executar(lambda: IAConhecimentoService().obter(id_conhecimento))


@bp.route("", methods=["POST"])
@requer_qualquer_area(*AREAS)
def criar():
    corpo = request.get_json() or {}
    return _executar(
        lambda: IAConhecimentoService().criar(corpo, _autor()), 201
    )


@bp.route("/<int:id_conhecimento>", methods=["PUT"])
@requer_qualquer_area(*AREAS)
def atualizar(id_conhecimento):
    corpo = request.get_json() or {}
    return _executar(
        lambda: IAConhecimentoService().atualizar(id_conhecimento, corpo, _autor())
    )


@bp.route("/<int:id_conhecimento>", methods=["DELETE"])
@requer_qualquer_area(*AREAS)
def desativar(id_conhecimento):
    """Desativa, nao apaga: a Aurora para de usar e o texto continua no banco."""
    return _executar(
        lambda: IAConhecimentoService().definir_ativo(id_conhecimento, False, _autor())
    )


@bp.route("/<int:id_conhecimento>/reativar", methods=["POST"])
@requer_qualquer_area(*AREAS)
def reativar(id_conhecimento):
    return _executar(
        lambda: IAConhecimentoService().definir_ativo(id_conhecimento, True, _autor())
    )


@bp.route("/<int:id_conhecimento>/reindexar", methods=["POST"])
@requer_qualquer_area(*AREAS)
def reindexar_item(id_conhecimento):
    return _executar(lambda: IAConhecimentoService().reindexar(id_conhecimento))


@bp.route("/reindexar", methods=["POST"])
@requer_qualquer_area(*AREAS)
def reindexar_tudo():
    return _executar(lambda: IAConhecimentoService().reindexar())


@bp.route("/testar", methods=["POST"])
@requer_qualquer_area(*AREAS)
def testar():
    corpo = request.get_json() or {}
    return _executar(lambda: IAConhecimentoService().testar(
        corpo.get("carteira"), corpo.get("pergunta")
    ))


@bp.route("/testar-resposta", methods=["POST"])
@requer_qualquer_area(*AREAS)
def testar_resposta():
    """A resposta final da Aurora. Nao grava no historico nem na analise."""
    corpo = request.get_json() or {}
    return _executar(lambda: IAConhecimentoService().simular_resposta(
        corpo.get("carteira"), corpo.get("pergunta")
    ))
