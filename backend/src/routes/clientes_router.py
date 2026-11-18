from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from src.application.services.clientes_service import *

bp = Blueprint("Dados dos Clientes", __name__, url_prefix="/clientes")

@bp.route("/pendentes", methods=["POST"])
def clientes_pendentes():
    data = request.get_json() or {}
    operador = data.get("nome_usuario")

    if not operador:
        return jsonify({"erro": "Operador não informado"}), 400
    
    pendentes = ClientesPendentesService().executar(operador)

    if not pendentes:
        return jsonify({"erro": "Nenhuma informação encontrada"}), 404

    return jsonify({
        "mensagem": "Clientes com parcelas vencendo hoje recuperados com sucesso",
        "dados": pendentes
    }), 200


@bp.route("/lista-combate", methods=["GET"])
def listar_combat():
    user_name = request.args.get("userName", "").strip()

    if not user_name:
        return jsonify({"erro": "Usuário não informado"}), 400

    dados = ListaCombateService().executar(user_name)

    if not dados:
        return jsonify({"erro": "Nenhum registro encontrado"}), 404

    return jsonify(dados), 200


@bp.route("/atualizar-observacao", methods=["POST"])
def atualizar_obs_usuario():
    data = request.get_json() or {}

    id_cliente = data.get("ID_CLIENTE")
    carteira = data.get("CARTEIRA")
    comando = data.get("COMANDO")
    nova_obs = data.get("OBS_USUARIO")

    if not id_cliente or not nova_obs or not carteira:
        return jsonify({
            "erro": "ID_CLIENTE, OBS_USUARIO e CARTEIRA são obrigatórios"
        }), 400

    sucesso = AtualizarObservacaoService().executar(
        id_cliente=int(id_cliente),
        carteira=str(carteira),
        comando=str(comando) if comando else "",
        observacao=str(nova_obs)
    )

    if not sucesso:
        return jsonify({"erro": "Erro ao atualizar observação"}), 500

    return jsonify({
        "mensagem": "OBS_USUARIO atualizado e log registrado com sucesso"
    }), 200


@bp.route("/atualizar-descricao",methods=["POST"])
def atualizar():
    data = request.get_json() or {}

    id_cliente = data.get("ID_CLIENTE")
    id_acordo = data.get("ID_ACORDO")
    id_contrato = data.get("ID_CONTRATO")
    carteira = data.get("CARTEIRA")
    comando = data.get("COMANDO")
    descricao = data.get("OBS_USUARIO")

    if not id_cliente or not descricao or not comando:
        return jsonify({"erro":"ID_CLIENTE, OBS_USUARIO e COMANDO são obrigatórios"}),400

    sucesso = AtualizarDescricaoService().executar(
        id_cliente=int(id_cliente),
        descricao=descricao,
        comando=comando,
        id_acordo=int(id_acordo) if id_acordo else None,
        id_contrato=int(id_contrato) if id_contrato else None,
        carteira=carteira
    )

    if not sucesso:
        return jsonify({"erro":"Erro ao atualizar descrição"}),500

    return jsonify({"mensagem":"Descrição atualizada e log registrado com sucesso"}),200



