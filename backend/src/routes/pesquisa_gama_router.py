from flask import Blueprint,request,jsonify
from src.application.services.pesquisa_gama_service import GravarPesquisaService

bp = Blueprint("PesquisaGAMA",__name__,url_prefix="/gama")

@bp.post("/enviar-pesquisa")
def enviar_pesquisa():
    try:
        body = request.get_json() or {}

        operador = body.get("operador")
        nm_cliente = body.get("cliente",{}).get("nomeCompleto")
        cpf_cliente = body.get("cliente",{}).get("cpf")
        resposta_1 = body.get("motivo")

        sucesso = GravarPesquisaService().executar(operador,nm_cliente,cpf_cliente,resposta_1)

        if not sucesso:
            return jsonify({"status":False,"mensagem":"Erro ao registrar pesquisa"}),400

        return jsonify({"status":True,"mensagem":"Pesquisa registrada"}),200

    except Exception:
        return jsonify({"status":False,"mensagem":"Houve algum erro ao registrar a mensagem"}),500