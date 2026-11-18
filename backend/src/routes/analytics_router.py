from flask import Blueprint,current_app,request,jsonify
from flask_jwt_extended import get_jwt_identity, jwt_required
from src.application.services.analytics_acessos_service import (
    AnalyticsAcessosError,
    AnalyticsAcessosService,
)

bp = Blueprint("Analytics",__name__,url_prefix="/analytics")

@bp.route("/acessos",methods=["POST"])
@jwt_required()
def acessos():
    data = request.get_json() or {}

    centro_custo = data.get("CENTRO_CUSTO","").strip().upper()

    if not centro_custo:
        return jsonify({"erro":"CENTRO_CUSTO não informado"}),400

    try:
        resultado = AnalyticsAcessosService().executar_para_usuario(
            get_jwt_identity(),
            centro_custo,
        )
        return jsonify(resultado), 200
    except AnalyticsAcessosError as erro:
        return jsonify({"erro": str(erro)}), erro.status


@bp.route("/ferramentas/consultar-contrato", methods=["GET"])
@jwt_required()
def uso_consultar_contrato():
    try:
        resultado = AnalyticsAcessosService().executar_uso_consultar_contrato(
            get_jwt_identity(),
            request.args.get("periodo", "0"),
        )
        return jsonify(resultado), 200
    except AnalyticsAcessosError as erro:
        return jsonify({"erro": str(erro)}), erro.status
    except Exception:
        current_app.logger.exception(
            "Erro ao consultar analytics do ConsultarContrato"
        )
        return jsonify({
            "erro": "Nao foi possivel carregar os resultados da ferramenta."
        }), 500
