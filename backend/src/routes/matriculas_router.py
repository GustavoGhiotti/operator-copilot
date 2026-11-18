from flask import Blueprint,request,jsonify
from src.application.services.matriculas_service import *

bp = Blueprint("Matriculas",__name__,url_prefix="/matriculas")

@bp.route("",methods=["GET"])
def listar_todos():

    resultado = ListarMatriculasService().executar()

    if isinstance(resultado,tuple):
        return resultado

    return jsonify(resultado or []),200

@bp.route("/gravar", methods=["POST"])
def nova_matricula():

    data = request.get_json() or {}

    gravar = GravarMatriculaService().executar(
        data.get("nome"),
        data.get("matricula")
    )

    if isinstance(gravar,tuple):
        return gravar

    return jsonify({"mensagem":"Nova matrícula gravada com sucesso"}),201


@bp.route("/gravar_lote", methods=["POST"])
def nova_matricula_lote():
    data = request.get_json() or {}
    registros = data.get("registros", [])

    gravar = GravarMatriculaLoteService().executar(registros)

    if isinstance(gravar, tuple):
        return gravar

    return jsonify(gravar), 201


@bp.route("/<string:matricula>", methods=["PUT"])
def atualizar_matricula(matricula):

    data = request.get_json() or {}

    atualizar = AtualizarMatriculaService().executar(
        matricula,
        data.get("nome"),
        data.get("matricula")
    )

    if isinstance(atualizar,tuple):
        return atualizar

    return jsonify({"mensagem":"Nova matrícula gravada com sucesso"}),201


@bp.delete("/deletar/<string:matricula>")
def deletar_matricula(matricula):
    sucesso = DeletarMatriculaService().executar(matricula)

    if not sucesso:
        return jsonify({"erro":"Erro ao deletar matrícula"}),400

    return jsonify({"mensagem":"Matrícula deletada com sucesso"}),200


@bp.delete("/deletar_mult")
def deletar_multiplas():
    data = request.get_json(silent=True) or {}
    matriculas = data.get("matriculas")

    if not isinstance(matriculas, list) or not matriculas:
        return jsonify({"erro": "matriculas deve ser uma lista não vazia"}), 400

    deletadas = DeletarMultService().executar(matriculas)

    if deletadas <= 0:
        return jsonify({"erro": "Nenhuma matrícula foi deletada"}), 400

    return jsonify({"mensagem": "Matrículas deletadas com sucesso", "deletadas": deletadas}), 200
