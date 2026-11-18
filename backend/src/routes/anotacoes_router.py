from flask import Blueprint,request,jsonify
from src.application.services.anotacoes_service import *

bp = Blueprint("Anotacoes",__name__,url_prefix="/anotacoes")

@bp.route("",methods=["GET"])
def listar_anotacoes():
    usuario = request.args.get("usuario","").strip()
    destinatario = request.args.get("destinatario","").strip()
    visao = request.args.get("visao","").strip()

    resultado = ListarAnotacoesService().executar(
        usuario,
        destinatario,
        visao
    )

    if isinstance(resultado,tuple):
        return resultado

    return jsonify(resultado or []),200

@bp.route("",methods=["POST"])
def criar_anotacao():
    data = request.get_json() or {}

    resultado = CriarAnotacaoService().executar(
        data.get("usuario"),
        data.get("titulo"),
        data.get("conteudo"),
        data.get("categoria"),
        data.get("destinatario"),
        data.get("tipo_boleto"),
        data.get("data_vencimento"),
        data.get("cor_postit"),
        data.get("importante"),
        data.get("fixado")
    )

    if isinstance(resultado,tuple):
        return resultado

    return jsonify({"mensagem":"Anotação criada com sucesso"}),201

@bp.route("/<int:id_anotacao>",methods=["PUT"])
def atualizar_anotacao(id_anotacao):
    data = request.get_json() or {}

    resultado = AtualizarAnotacaoService().executar(
        id_anotacao,
        data.get("titulo"),
        data.get("conteudo"),
        data.get("categoria"),
        data.get("tipo_boleto"),
        data.get("data_vencimento"),
        data.get("cor_postit"),
        data.get("importante"),
        data.get("fixado")
    )

    if isinstance(resultado,tuple):
        return resultado

    return jsonify({"mensagem":"Anotação atualizada com sucesso"}),200

@bp.route("/<int:id_anotacao>/preferencias",methods=["PATCH"])
def atualizar_preferencias_anotacao(id_anotacao):
    data = request.get_json() or {}

    resultado = AtualizarPreferenciasAnotacaoService().executar(
        id_anotacao,
        data.get("cor_postit"),
        data.get("importante"),
        data.get("fixado")
    )

    if isinstance(resultado,tuple):
        return resultado

    return jsonify({"mensagem":"Preferências atualizadas com sucesso"}),200

@bp.route("/<int:id_anotacao>",methods=["DELETE"])
def deletar_anotacao(id_anotacao):
    resultado = DeletarAnotacaoService().executar(id_anotacao)

    if isinstance(resultado,tuple):
        return resultado

    return jsonify({"mensagem":"Anotação excluída com sucesso"}),200

@bp.route("/excluir-confirmadas",methods=["DELETE"])
def deletar_anotacoes_confirmadas():
    resultado = ExcluirAnotacoesConfirmadasService().executar()

    if isinstance(resultado,tuple):
        return resultado

    return jsonify({"mensagem":"Anotações confirmadas e manuais excluídas com sucesso"}),200

@bp.route("/<int:id_anotacao>/confirmar",methods=["PUT"])
def confirmar_anotacao(id_anotacao):
    resultado = ConfirmarAnotacaoService().executar(id_anotacao)

    if isinstance(resultado,tuple):
        return resultado

    return jsonify({"mensagem":"Anotação confirmada"}),200
