from flask import Blueprint, request, jsonify
from src.shared.errors.envio_mensagem_exceptions import *
from backend.src.infrastructure.repositories.sql_delta_repository import PesquisaSatisfacao

bp_delta = Blueprint("Registro de pesquisa", __name__, url_prefix="/delta")



@bp_delta.post("/enviar-pesquisa")
def enviar_pesquisa():
    try:
        body = request.get_json()

        operador = body["operador"]
        nm_cliente = body["cliente"]["nomeCompleto"]
        cpf_cliente = body["cliente"]["cpf"]

        resposta_1 = body["respostas"]["recebeSalarioContaSalario"]
        resposta_2 = body["respostas"]["conhecePortabilidade"]
        resposta_3 = body["respostas"]["trariaParaDelta"]
        resposta_4 = body["respostas"]["motivacaoBeneficio"]
        

        PesquisaSatisfacao.registrar(operador,nm_cliente,cpf_cliente,resposta_1,resposta_2,resposta_3,resposta_4)

        return jsonify({"status": True, "mensagem":"Pesquisa registrada"})
    except Exception as e:
        return jsonify({"status": False, "mensagem":"Houve algum erro ao registrar a mensagem"})
