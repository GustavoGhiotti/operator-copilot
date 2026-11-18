from flask import Blueprint, jsonify, request
from src.application.services.crmweb_service import *

bp = Blueprint("Crmweb", __name__, url_prefix="")

@bp.route("/consultar-crmweb", methods=["POST"])
def registrar_busca():

    data = request.get_json() or {}

    resultado = RegistrarBuscaService().executar(
        data.get("contrato"),
        data.get("periodo_ate"),
        data.get("data_pagto"),
        data.get("tipo_pagamento"),
        data.get("usuario"),
        data.get("buscar_coobrigado")
    )

    print(resultado)

    if "erro" in resultado:
        return jsonify(resultado), 500

    return jsonify(resultado), 201


@bp.route("/consultar-crmweb-d9", methods=["POST"])
def registrar_buscas_d9():
    data = request.get_json() or {}

    resultado = RegistrarBuscasD9Service().executar(
        data.get("contrato"),
        data.get("tipo_pagamento"),
        data.get("usuario"),
        data.get("buscar_coobrigado"),
    )

    if "erro" in resultado:
        return jsonify(resultado), 500

    return jsonify(resultado), 201


@bp.route("/consultar-crmweb-cache", methods=["GET"])
def buscar_cache():
    contrato = request.args.get("contrato")
    periodo_ate = request.args.get("periodo_ate")
    data_pagto = request.args.get("data_pagto")
    tipo_pagamento = request.args.get("tipo_pagamento", type=int)
    buscar_coobrigado = request.args.get("buscar_coobrigado", type=int)

    resultado = BuscarDadosCacheService().executar(
        contrato,
        periodo_ate,
        data_pagto,
        tipo_pagamento,
        buscar_coobrigado
    )

    print(resultado)

    if not resultado:
        return jsonify({"status": "nao_encontrado", "dados": None}), 404

    return jsonify(resultado), 200

@bp.route("/consultar-crmweb/<id_busca>", methods=["GET"])
def buscar_dados(id_busca):

    try:

        resultado = BuscarDadosService().executar(id_busca)

        if not resultado:
            return jsonify({
                "status": "pendente"
            }), 200

        return jsonify(resultado), 200

    except Exception as e:

        return jsonify({
            "status": "falha na busca",
            "erro": "Erro ao consultar status da busca",
            "detalhe": str(e)
        }), 500
