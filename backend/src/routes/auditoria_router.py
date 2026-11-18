from datetime import date, datetime

from flask import Blueprint, jsonify, request, send_file
from flask_jwt_extended import get_jwt_identity, jwt_required

from src.application.services.auditoria_audio_service import AuditoriaAudioError
from src.application.services.auditoria_service import (
    AuditoriaPermissionError,
    AuditoriaService,
    usuario_pode_acessar_delta,
    usuario_pode_supervisionar,
)
from src.application.services.auditoria_training_provider import AuditoriaTrainingProvider


bp = Blueprint("Auditoria", __name__, url_prefix="/auditorias")


def _serialize(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: _serialize(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_serialize(item) for item in value]
    return value


@bp.errorhandler(AuditoriaPermissionError)
def handle_permission(error):
    return jsonify({"erro": str(error)}), 403


@bp.errorhandler(AuditoriaAudioError)
@bp.errorhandler(ValueError)
def handle_validation(error):
    return jsonify({"erro": str(error)}), 400


@bp.route("", methods=["POST"])
@jwt_required()
def criar_auditoria():
    audit_id = AuditoriaService().criar(str(get_jwt_identity()), request)
    return jsonify({
        "auditoriaId": audit_id,
        "status": "PENDENTE",
        "mensagem": "Ligação recebida e adicionada à fila de análise.",
    }), 202


@bp.route("/<int:audit_id>/status", methods=["GET"])
@jwt_required()
def status_auditoria(audit_id):
    _, result = AuditoriaService().autorizar(str(get_jwt_identity()), audit_id)
    return jsonify(_serialize({
        "id": result["id"], "status": result["status"], "erro": result.get("erro")
    })), 200


@bp.route("/<int:audit_id>/progresso", methods=["GET"])
@jwt_required()
def progresso_auditoria(audit_id):
    service = AuditoriaService()
    service.autorizar(str(get_jwt_identity()), audit_id)
    return jsonify(_serialize(service.repo.obter_progresso(audit_id))), 200


@bp.route("/<int:audit_id>", methods=["GET"])
@jwt_required()
def obter_auditoria(audit_id):
    _, result = AuditoriaService().autorizar(str(get_jwt_identity()), audit_id)
    return jsonify(_serialize(result)), 200


@bp.route("/<int:audit_id>/audio", methods=["GET"])
@jwt_required()
def obter_audio(audit_id):
    service = AuditoriaService()
    service.autorizar(str(get_jwt_identity()), audit_id)
    context = service.repo.obter_contexto(audit_id)
    return send_file(context["STORAGE_KEY"], mimetype=context.get("MIME_TYPE"), conditional=True)


@bp.route("", methods=["GET"])
@jwt_required()
def listar_auditorias():
    service = AuditoriaService()
    cpf = str(get_jwt_identity())
    usuario = service.obter_usuario(cpf)
    page = max(1, request.args.get("page", 1, type=int))
    page_size = min(100, max(1, request.args.get("pageSize", 20, type=int)))
    pode_ver_carteira = usuario_pode_supervisionar(usuario) and usuario_pode_acessar_delta(usuario)
    result = service.repo.listar(cpf, pode_ver_carteira, page, page_size)
    result["totalPages"] = (result["totalItems"] + page_size - 1) // page_size
    return jsonify(_serialize(result)), 200


@bp.route("/<int:audit_id>/reprocessar", methods=["POST"])
@jwt_required()
def reprocessar_auditoria(audit_id):
    service = AuditoriaService()
    usuario, result = service.autorizar(str(get_jwt_identity()), audit_id)
    if not usuario_pode_supervisionar(usuario):
        return jsonify({"erro": "Somente supervisão, qualidade ou treinamento pode reprocessar."}), 403
    if result["status"] not in {"ERRO", "CONCLUIDO"}:
        return jsonify({"erro": "Esta auditoria ainda está em processamento."}), 409
    service.repo.reprocessar(audit_id)
    return jsonify({"mensagem": "Auditoria adicionada novamente à fila.", "status": "PENDENTE"}), 202


@bp.route("/configuracoes/<carteira_id>", methods=["GET"])
@jwt_required()
def obter_configuracao(carteira_id):
    config = AuditoriaTrainingProvider().obter(carteira_id)
    return jsonify({
        "versao": config["versao"], "status": config["status"],
        "criterios": config["criterios"],
    }), 200
