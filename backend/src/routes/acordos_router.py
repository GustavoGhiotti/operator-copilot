from flask import Blueprint,request,jsonify
from src.application.services.acordos_service import ListaAcordosService

bp = Blueprint("Acordos",__name__,url_prefix="/acordos")

@bp.route("/lista",methods=["GET"])
def listar_acordos():
    user_name = request.args.get("userName","").strip()

    if not user_name:
        return jsonify({"erro":"Parâmetro userName é obrigatório"}),400

    dados = ListaAcordosService().executar(user_name)

    if not dados:
        return jsonify({"erro":"Erro ao buscar a lista de acordos"}),500
    
    return jsonify(dados),200
