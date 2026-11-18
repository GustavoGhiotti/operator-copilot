from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from src.application.services.copilot_tour_service import (
    CopilotTourError,
    CopilotTourService,
)

bp = Blueprint("CopilotTour", __name__, url_prefix="/copilot/tour")


def _executar(operacao, status_sucesso=200):
    try:
        return jsonify(operacao()), status_sucesso
    except CopilotTourError as erro:
        return jsonify({"erro": str(erro)}), erro.status
    except Exception:
        current_app.logger.exception("Erro ao tratar o estado do tour")
        return jsonify({
            "erro": "Nao foi possivel consultar o tour guiado."
        }), 500


@bp.route("", methods=["GET"])
@jwt_required()
def consultar_tour():
    return _executar(
        lambda: CopilotTourService().consultar(get_jwt_identity())
    )


@bp.route("", methods=["POST"])
@jwt_required()
def registrar_tour():
    return _executar(
        lambda: CopilotTourService().registrar(
            get_jwt_identity(),
            request.get_json() or {},
        ),
        201,
    )


@bp.route("/reiniciar", methods=["POST"])
@jwt_required()
def reiniciar_tour():
    return _executar(
        lambda: CopilotTourService().reiniciar(get_jwt_identity())
    )
