from flask import Blueprint, jsonify, request
from src.application.services.tabulacoes_service import *

bp = Blueprint("Tabulacoes", __name__, url_prefix="/tabulacoes")


@bp.route("", methods=["GET"])
def listar_tabulacoes():
    try:
        resultado = ListarTabulacoesService().executar()

        return jsonify(resultado), 200

    except Exception as e:
        return jsonify({
            "erro": "Erro ao listar tabulações",
            "detalhe": str(e)
        }), 500
    
@bp.route("/listar/<carteira>", methods=["GET"])
def listar_tabulacoes_operador(carteira):
    try:
        resultado = ListarTabulacoesService().executar_operador(carteira)

        return jsonify(resultado), 200

    except Exception as e:
        return jsonify({
            "erro": "Erro ao listar tabulações",
            "detalhe": str(e)
        }), 500


@bp.route("/<int:id_tabulacao>", methods=["GET"])
def buscar_tabulacao_por_id(id_tabulacao):
    try:
        resultado = BuscarTabulacaoPorIdService().executar(id_tabulacao)

        if not resultado:
            return jsonify({
                "erro": "Tabulação não encontrada"
            }), 404

        return jsonify(resultado), 200

    except Exception as e:
        return jsonify({
            "erro": "Erro ao buscar tabulação",
            "detalhe": str(e)
        }), 500


@bp.route("", methods=["POST"])
def criar_tabulacao():
    try:
        data = request.get_json() or {}

        resultado = CriarTabulacaoService().executar(
            data.get("tabulacao"),
            data.get("descricao"),
            data.get("carteira"),
            data.get("ocultar")
        )

        if "erro" in resultado:
            return jsonify(resultado), 400

        return jsonify(resultado), 201

    except Exception as e:
        return jsonify({
            "erro": "Erro ao criar tabulação",
            "detalhe": str(e)
        }), 500


@bp.route("/<int:id_tabulacao>", methods=["PUT"])
def atualizar_tabulacao(id_tabulacao):
    try:
        data = request.get_json() or {}

        resultado = AtualizarTabulacaoService().executar(
            id_tabulacao,
            data.get("tabulacao"),
            data.get("descricao"),
            data.get("carteira"),
            data.get("ocultar")
        )

        if "erro" in resultado:
            status_code = 404 if resultado.get("erro") == "Tabulação não encontrada" else 400
            return jsonify(resultado), status_code

        return jsonify(resultado), 200

    except Exception as e:
        return jsonify({
            "erro": "Erro ao atualizar tabulação",
            "detalhe": str(e)
        }), 500
    

@bp.route("/<int:id_tabulacao>", methods=["PUT"])
def ocultar_tabulacao(id_tabulacao):
    data = request.get_json() or {}

    try:
        resultado = OcultarTabulacaoService.executar(
            data.get("ocultar"),
            id_tabulacao
        )

        if "erro" in resultado:
            status_code = 404 if resultado.get("erro") == "Tabulação não encontrada" else 400
            return jsonify(resultado), status_code

        return jsonify(resultado), 200

    except Exception as e:
        return jsonify({
            "erro": "Erro ao atualizar tabulação",
            "detalhe": str(e)
        }), 500


@bp.route("/<int:id_tabulacao>", methods=["DELETE"])
def deletar_tabulacao(id_tabulacao):
    try:
        resultado = DeletarTabulacaoService().executar(id_tabulacao)

        if "erro" in resultado:
            return jsonify(resultado), 404

        return jsonify(resultado), 200

    except Exception as e:
        return jsonify({
            "erro": "Erro ao deletar tabulação",
            "detalhe": str(e)
        }), 500