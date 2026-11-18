from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from src.application.services.copilot_feedback_service import (
    CopilotFeedbackError,
    CopilotFeedbackService,
)

bp = Blueprint("CopilotFeedback", __name__, url_prefix="/copilot/feedback")


def _executar(operacao, status_sucesso=200):
    try:
        return jsonify(operacao()), status_sucesso
    except CopilotFeedbackError as erro:
        return jsonify({"erro": str(erro)}), erro.status
    except Exception:
        current_app.logger.exception("Erro ao tratar o feedback do Copilot")
        return jsonify({
            "erro": "Nao foi possivel registrar o seu feedback."
        }), 500


@bp.route("", methods=["GET"])
@jwt_required()
def consultar_feedback():
    return _executar(
        lambda: CopilotFeedbackService().consultar(get_jwt_identity())
    )


@bp.route("", methods=["POST"])
@jwt_required()
def registrar_feedback():
    return _executar(
        lambda: CopilotFeedbackService().registrar(
            get_jwt_identity(),
            request.get_json() or {},
        ),
        201,
    )
