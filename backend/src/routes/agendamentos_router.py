from flask import Blueprint,request,jsonify
from src.application.services.agendamentos_service import (
    ListarAgendamentoService,
    CriarAgendamentoService,
    ExcluirAgendamentoService
)

bp = Blueprint("Agendamentos",__name__,url_prefix="/agendamentos")

@bp.route("",methods=["GET"])
def listar():
    usuario = request.args.get("usuario","").strip()

    if not usuario:
        return jsonify({"erro":"Usuário não informado"}),400

    dados = ListarAgendamentoService().executar(usuario)

    return jsonify(dados or []),200

@bp.route("",methods=["POST"])
def criar():
    data = request.get_json() or {}

    resultado = CriarAgendamentoService().executar(
        data.get("usuario"),
        data.get("nome"),
        data.get("cpf"),
        data.get("ec"),
        data.get("horario_retorno")
    )

    if isinstance(resultado,tuple):
        return resultado

    return jsonify({"mensagem":"Agendamento criado com sucesso!"}),201

@bp.route("",methods=["DELETE"])
def excluir():
    agendamento_id = request.args.get("id")

    resultado = ExcluirAgendamentoService().executar(agendamento_id)

    if isinstance(resultado,tuple):
        return resultado

    return jsonify({"mensagem":"Agendamento removido com sucesso"}),200