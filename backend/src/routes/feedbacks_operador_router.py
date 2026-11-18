from flask import Blueprint,request,jsonify, send_from_directory
from src.application.services.feedbacks_operador_service import FeedbacksOperadorService

bp = Blueprint("FeedbacksOperador",__name__,url_prefix="/feedbacks")

@bp.route("/operador",methods=["GET"])
def listar():
    operador = request.args.get("operador","").strip()

    if not operador:
        return jsonify({"erro":"Parâmetro 'operador' é obrigatório"}),400

    feedbacks = FeedbacksOperadorService().executar(operador)

    if feedbacks is None:
        return jsonify({"erro":"Erro ao buscar feedbacks"}),500

    return jsonify({"feedbacks":feedbacks}),200

@bp.route('/audios_feedbacks/<path:filename>')
def get_audio_file(filename):
    return send_from_directory('audios_feedbacks', filename)