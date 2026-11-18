import os
import uuid

from flask import Blueprint, request, jsonify, send_from_directory
from flask_jwt_extended import get_jwt_identity, jwt_required
from werkzeug.utils import secure_filename
from src.application.services.admin_service import *
from src.application.services.quality_checklist_service import QualityChecklistService


bp = Blueprint("Qualidade",__name__,url_prefix="/qualidade")

QUALITY_LOGO_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "quality_wallet_logos")
)
QUALITY_LOGO_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}


@bp.route("/carteiras/logo", methods=["POST"])
@jwt_required()
def upload_logo_carteira_qualidade():
    if request.content_length and request.content_length > 4 * 1024 * 1024:
        return jsonify({"erro": "A logo deve ter no máximo 4 MB"}), 400
    logo = request.files.get("logo")
    if not logo or not logo.filename:
        return jsonify({"erro": "Selecione uma imagem para a carteira"}), 400

    original = secure_filename(logo.filename)
    extension = original.rsplit(".", 1)[-1].lower() if "." in original else ""
    if extension not in QUALITY_LOGO_EXTENSIONS:
        return jsonify({"erro": "Formato inválido. Use PNG, JPG ou WEBP"}), 400

    os.makedirs(QUALITY_LOGO_DIR, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.{extension}"
    logo.save(os.path.join(QUALITY_LOGO_DIR, filename))
    return jsonify({"url": f"/api/qualidade/carteiras/logos/{filename}"}), 201


@bp.route("/carteiras/logos/<path:filename>", methods=["GET"])
def servir_logo_carteira_qualidade(filename):
    return send_from_directory(QUALITY_LOGO_DIR, filename)


@bp.route("/checklists", methods=["GET"])
@jwt_required()
def listar_checklists_configuraveis():
    published_only = request.args.get("published", "false").lower() == "true"
    return jsonify({"checklists": QualityChecklistService().list(published_only)}), 200


@bp.route("/checklists", methods=["POST"])
@jwt_required()
def salvar_checklist_configuravel():
    definition = request.get_json() or {}
    result, error = QualityChecklistService().save(definition, str(get_jwt_identity()))
    if error:
        return jsonify({"erro": error}), 400
    return jsonify(result), 201


@bp.route("/checklists/<int:version_id>/publicar", methods=["POST"])
@jwt_required()
def publicar_checklist_configuravel(version_id):
    success, error = QualityChecklistService().publish(version_id, str(get_jwt_identity()))
    if error:
        return jsonify({"erro": error}), 400
    return jsonify({"mensagem": "Checklist publicado com sucesso"}), 200


@bp.route("/checklists/<int:config_id>/desativar", methods=["POST"])
@jwt_required()
def desativar_checklist_configuravel(config_id):
    if not QualityChecklistService().deactivate(config_id, str(get_jwt_identity())):
        return jsonify({"erro": "Checklist não encontrado"}), 404
    return jsonify({"mensagem": "Checklist desativado com sucesso"}), 200


@bp.route("/checklists/carteiras/<path:wallet_id>", methods=["DELETE"])
@jwt_required()
def excluir_carteira_checklist(wallet_id):
    data = request.get_json() or {}
    result = QualityChecklistService().delete_wallet(wallet_id, data.get("confirmacao"))
    status = result.get("status")
    if status == "not_found":
        return jsonify({"erro": "Carteira não encontrada"}), 404
    if status == "invalid_confirmation":
        return jsonify({"erro": f"Digite '{result['expected']}' para confirmar"}), 400
    if status == "in_use":
        return jsonify({
            "erro": "Esta carteira já possui monitorias registradas e não pode ser excluída. Inative seus canais para preservar o histórico."
        }), 409
    return jsonify({"mensagem": "Carteira e seus canais excluídos com sucesso"}), 200


#----------------------------------Rotas Qualidade Feedback ----------------------------#
@bp.route("/buscar",methods=["GET"])
@jwt_required()
def buscar_operador_por_nome():
    resultado = BuscarOperadorService().executar(request.args)

    if isinstance(resultado,tuple):
        return resultado

    return jsonify({"operadores":resultado}),200

@bp.route("/feedbacks/criar",methods=["POST"])
@jwt_required()
def criar_feedback():
    resultado = CriarFeedbackService().executar(request)

    if isinstance(resultado,tuple):
        return resultado

    return jsonify({"mensagem":"Feedback registrado com sucesso"}),201

@bp.route('/audios_feedbacks/<path:filename>')
def get_audio_file(filename):
    return send_from_directory('audios_feedbacks', filename)

@bp.route("/feedbacks/deletar",methods=["DELETE"])
@jwt_required()
def deletar_feedback():
    data = request.get_json() or {}

    feedback_id = data.get("feedback_id")
    monitor_nome = data.get("monitor_nome")

    if not feedback_id or not monitor_nome:
        return jsonify({"erro":"Dados obrigatórios ausentes"}),400

    sucesso = DeletarFeedbackService().executar(feedback_id,monitor_nome)

    if not sucesso:
        return jsonify({"erro":"Erro ao remover feedback"}),400

    return jsonify({"mensagem":"Feedback removido com sucesso"}),200

@bp.route("/feedbacks/operador",methods=["GET"])
def listar_feedbacks_operador():
    operador = request.args.get("operador","").strip()

    resultado = ListarFeedbacksOperadorService().executar(operador)

    if isinstance(resultado,tuple):
        return resultado

    return jsonify({"feedbacks":resultado}),200

@bp.route("/feedbacks/detalhe/<int:feedback_id>",methods=["GET"])
@jwt_required()
def detalhe_feedback_monitor(feedback_id):
    monitor_nome = request.args.get("monitor_nome","").strip()

    if not monitor_nome:
        return jsonify({"erro":"Monitor não informado"}),400

    dados = DetalheFeedbackService().executar(feedback_id,monitor_nome)

    if not dados:
        return jsonify({"erro":"Feedback não encontrado"}),404

    return jsonify(dados),200

@bp.route("/feedbacks/stats-monitor",methods=["GET"])
@jwt_required()
def estatisticas_feedback_monitor():
    monitor_nome = request.args.get("monitor_nome","").strip()

    resultado = EstatisticasFeedbackMonitorService().executar(monitor_nome)

    if isinstance(resultado,tuple):
        return resultado

    return jsonify(resultado),200

@bp.route("/feedbacks/recentes-monitor",methods=["GET"])
@jwt_required()
def ultimos_feedbacks_monitor():
    monitor_nome = request.args.get("monitor_nome","").strip()

    resultado = FeedbacksRecentesMonitorService().executar(monitor_nome)

    if isinstance(resultado,tuple):
        return resultado

    return jsonify({"feedbacks":resultado}),200

@bp.route("/analytics/carteira/media",methods=["GET"])
@jwt_required()
def analytics_media_carteira():
    resultado = FeedbackAnalyticsService().media_carteira(
        request.args.get("wallet_id","").strip(),
        request.args.get("periodo","diario").strip(),
        request.args.get("canal_id","").strip(),
        request.args.get("start_date","").strip(),
        request.args.get("end_date","").strip(),
        request.args.get("compare_start_date","").strip(),
        request.args.get("compare_end_date","").strip(),
    )

    if isinstance(resultado,tuple):
        return resultado

    return jsonify(resultado),200

@bp.route("/analytics/carteira/ofensores",methods=["GET"])
@jwt_required()
def analytics_ofensores_carteira():
    resultado = FeedbackAnalyticsService().ofensores_carteira(
        request.args.get("wallet_id","").strip(),
        request.args.get("periodo","diario").strip(),
        request.args.get("canal_id","").strip(),
        request.args.get("start_date","").strip(),
        request.args.get("end_date","").strip(),
        request.args.get("compare_start_date","").strip(),
        request.args.get("compare_end_date","").strip(),
    )

    if isinstance(resultado,tuple):
        return resultado

    return jsonify(resultado),200

@bp.route("/analytics/carteira/operadores",methods=["GET"])
@jwt_required()
def analytics_operadores_carteira():
    resultado = FeedbackAnalyticsService().operadores_carteira(
        request.args.get("wallet_id","").strip(),
        request.args.get("canal_id","").strip()
    )

    if isinstance(resultado,tuple):
        return resultado

    return jsonify(resultado),200

@bp.route("/analytics/operador/media",methods=["GET"])
@jwt_required()
def analytics_media_operador():
    resultado = FeedbackAnalyticsService().media_operador(
        request.args.get("wallet_id","").strip(),
        request.args.get("cpf_operador","").strip(),
        request.args.get("periodo","diario").strip(),
        request.args.get("canal_id","").strip(),
        request.args.get("start_date","").strip(),
        request.args.get("end_date","").strip(),
        request.args.get("compare_start_date","").strip(),
        request.args.get("compare_end_date","").strip(),
    )

    if isinstance(resultado,tuple):
        return resultado

    return jsonify(resultado),200

@bp.route("/analytics/monitores/teleatendimento",methods=["GET"])
@jwt_required()
def analytics_monitores_teleatendimento():
    resultado = FeedbackAnalyticsService().monitores_teleatendimento()

    if isinstance(resultado,tuple):
        return resultado

    return jsonify(resultado),200

@bp.route("/analytics/ia-perguntas",methods=["GET"])
@jwt_required()
def analytics_ia_perguntas():
    resultado = FeedbackAnalyticsService().analytics_perguntas_ia(
        request.args.get("wallet_id","").strip(),
        request.args.get("periodo","diario").strip(),
        request.args.get("centro_custo","").strip(),
        request.args.get("topico","").strip(),
        request.args.get("start_date","").strip(),
        request.args.get("end_date","").strip(),
        request.args.get("compare_start_date","").strip(),
        request.args.get("compare_end_date","").strip(),
    )

    if isinstance(resultado,tuple):
        return resultado

    return jsonify(resultado),200

@bp.route("/analytics/ia-perguntas/conversa/<conversa_id>",methods=["GET"])
@jwt_required()
def analytics_ia_perguntas_conversa(conversa_id):
    resultado = FeedbackAnalyticsService().detalhar_conversa_ia(conversa_id)

    if isinstance(resultado,tuple):
        return resultado

    return jsonify(resultado),200

@bp.route("/analytics/ia-perguntas/operador",methods=["GET"])
@jwt_required()
def analytics_ia_perguntas_operador():
    resultado = FeedbackAnalyticsService().detalhar_operador_ia(
        request.args.get("operador","").strip()
    )

    if isinstance(resultado,tuple):
        return resultado

    return jsonify(resultado),200
