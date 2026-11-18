from flask import Blueprint,request,jsonify
from src.application.services.quebra_service import AtualizarQuebraCombateService, AtualizarQuebraService

bp = Blueprint("Atualizar quebra",__name__,url_prefix="/quebra")

@bp.route("/atualizar",methods=["POST"])
def atualizar():
    data = request.get_json() or {}

    id_cliente = data.get("ID_CLIENTE")
    id_acordo = data.get("ID_ACORDO")
    id_contrato = data.get("ID_CONTRATO")
    carteira = data.get("CARTEIRA")
    comando = data.get("COMANDO")
    quebra = data.get("QUEBRA")

    if not id_cliente or not quebra or not comando or not carteira:
        return jsonify({"erro":"ID_CLIENTE, QUEBRA, CARTEIRA e COMANDO são obrigatórios"}),400

    sucesso = AtualizarQuebraService().executar(
        id_cliente=int(id_cliente),
        quebra=quebra,
        comando=comando,
        id_acordo=int(id_acordo) if id_acordo else None,
        id_contrato=int(id_contrato) if id_contrato else None,
        carteira=carteira
    )

    if not sucesso:
        return jsonify({"erro":"Erro ao atualizar quebra"}),500

    return jsonify({"mensagem":"Quebra atualizada e log registrado com sucesso"}),200


@bp.route("/atualizar-combate",methods=["POST"])
def atualizar_quebra_combate():
    data = request.get_json() or {}

    id_cliente = data.get("ID_CLIENTE")
    quebra = data.get("QUEBRA")
    comando = data.get("COMANDO")
    carteira = data.get("CARTEIRA","")

    if not id_cliente or not quebra:
        return jsonify({"erro":"ID_CLIENTE e QUEBRA são obrigatórios"}),400

    sucesso = AtualizarQuebraCombateService().executar(int(id_cliente),str(carteira),str(comando),str(quebra))

    if not sucesso:
        return jsonify({"erro":"Erro ao atualizar QUEBRA"}),500

    return jsonify({"mensagem":"QUEBRA atualizada e log registrado com sucesso"}),200
