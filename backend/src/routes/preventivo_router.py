from flask import Blueprint, request, jsonify
from src.application.services.preventivo_service import AtualizarPreventivoService, AtualizarPreventivoCombateService

bp = Blueprint("Atualizar Preventivo",__name__,url_prefix="/preventivo")

@bp.route("atualizar",methods=["POST"])
def atualizar():
    data = request.get_json() or {}

    id_cliente = data.get("ID_CLIENTE")
    id_acordo = data.get("ID_ACORDO")
    id_contrato = data.get("ID_CONTRATO")
    carteira = data.get("CARTEIRA")
    preventivo = data.get("PREVENTIVO")
    comando = data.get("COMANDO")

    if id_cliente is None or not preventivo or not comando:
        return jsonify({"erro":"ID_CLIENTE, PREVENTIVO e COMANDO são obrigatórios"}),400

    sucesso = AtualizarPreventivoService().executar(
        id_cliente=int(id_cliente),
        preventivo=preventivo,
        comando=comando,
        id_acordo=int(id_acordo) if id_acordo else None,
        id_contrato=int(id_contrato) if id_contrato else None,
        carteira=carteira
    )

    if not sucesso:
        return jsonify({"erro":"Erro ao atualizar preventivo"}),500

    return jsonify({"mensagem":"Preventivo atualizado e log registrado com sucesso"}),200


@bp.route("/atualizar-combate", methods=["POST"])
def atualizar_preventivo_combate():
    data = request.get_json() or {}

    id_cliente = data.get("ID_CLIENTE")
    carteira = data.get("CARTEIRA")
    comando = data.get("COMANDO")
    novo_preventivo = data.get("PREVENTIVO")

    if not id_cliente or novo_preventivo is None or not carteira:
        return jsonify({
            "erro": "ID_CLIENTE, PREVENTIVO e CARTEIRA são obrigatórios"
        }), 400

    sucesso = AtualizarPreventivoCombateService().executar(
        id_cliente=int(id_cliente),
        carteira=str(carteira),
        comando=str(comando) if comando else "",
        preventivo=novo_preventivo
    )

    if not sucesso:
        return jsonify({"erro": "Erro ao atualizar PREVENTIVO"}), 500

    return jsonify({
        "mensagem": "Preventivo atualizado e log registrado com sucesso"
    }), 200



