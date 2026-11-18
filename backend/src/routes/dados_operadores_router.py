from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity, jwt_required
from src.application.services.dados_operadores_service import *
from src.infrastructure.repositories.sql_login_repository import LoginRepository

bp = Blueprint("operadores", __name__, url_prefix="/operadores")

@bp.route("/dados", methods=["POST"])
@jwt_required()
def dados_operadores():
    try:
        body = request.json

        if not body:
            return jsonify({"erro": "Nenhum dado enviado"}), 400

        nome_usuario = body.get("nome_usuario", "").strip()

        service = DadosOperadoresService()
        dados = service.obter_dados(nome_usuario)
        if not dados:
            return jsonify({"erro": "Nenhuma informação encontrada"}), 404

        return jsonify({
            "mensagem": "Dados recuperados com sucesso",
            "dados": dados
        }), 200

    except ValueError as e:
        return jsonify({"erro": str(e)}), 400

    except Exception as e:
        return jsonify({"erro": "Erro inesperado", "detalhes": str(e)}), 500
    

@bp.route("/estatisticas",methods=["GET"])
def estatisticas_operador():
    usuario = request.args.get("usuario","").strip().upper()

    if not usuario:
        return jsonify({"erro":"Usuário não informado"}),400

    dados = EstatisticasOperadorService().executar(usuario)

    if not dados:
        return jsonify({"erro":"Nenhum registro encontrado"}),404

    return jsonify(dados),200


@bp.route("/resultado", methods=["POST", "GET"])
@jwt_required()
def resultado():
    try:
        data = request.get_json()

        if not data:
            return jsonify({"erro": "Requisição inválida, nenhum dado foi enviado"}), 400
        
        cpf_operador = str(get_jwt_identity() or "").strip()
        if not cpf_operador:
            return jsonify({"erro": "Operador não identificado"}), 401

        filtro = data.get("filtro")

        if not filtro:
            return jsonify({"erro": "O campo 'filtro' é obrigatório"}), 400
        
        dados = ResultadoService().executar(cpf_operador, filtro, data)

        if not dados:
            return jsonify({"erro":"Erro ao executar consulta ou nenhum resultado encontrado"}),404

        return jsonify({"mensagem":"Dados recuperados com sucesso","dados":dados}),200
    
    except Exception as e:
        return jsonify({
            "erro": "Erro ao consultar o resultado do operador",
            "detalhes": str(e)
        }), 500

@bp.route("/resultado-cpc", methods=["POST"])
@jwt_required()
def resultado_cpc():
    try:
        body = request.get_json()

        if not body:
            return jsonify({"erro": "Nenhum dado enviado"}), 400

        cpf_operador = str(get_jwt_identity() or "").strip()
        if not cpf_operador:
            return jsonify({"erro": "Operador não identificado"}), 401

        service = ResultadoCPCService()
        dados = service.obter(cpf_operador)

        if not dados:
            return jsonify({"erro": "Nenhum resultado encontrado"}), 404

        return jsonify({
            "mensagem": "Dados CPC recuperados com sucesso",
            "dados_cpc": dados
        }), 200

    except ValueError as e:
        return jsonify({"erro": str(e)}), 400

    except Exception as e:
        return jsonify({
            "erro": "Erro inesperado",
            "detalhes": str(e)
        }), 500

@bp.route("/resultado/feedback",methods=["POST"])
@jwt_required()
def resultado_feedback():
    data = request.get_json() or {}

    centro_custo = data.get("centroCusto")
    operador_data = data.get("operatorData")

    if not centro_custo:
        return jsonify("Centro de custo não informado"),400

    if not operador_data:
        return jsonify({"erro":"operatorData é obrigatório"}),400

    resposta,status = FeedbackResultadoService().executar(centro_custo,operador_data)

    return jsonify(resposta),status

@bp.route("/feedbacks/marcar-lido",methods=["POST"])
@jwt_required()
def marcar_feedback_lido():
    data = request.get_json() or {}
    cpf_operador = get_jwt_identity()

    if not cpf_operador:
        return jsonify({"erro":"Usuário não identificado"}),401

    usuario = LoginRepository(str(cpf_operador)).login()

    if not usuario:
        return jsonify({"erro":"Operador não encontrado"}),404

    nome_operador = str(usuario.get("NM_COLABORADOR") or "").strip().upper()

    resultado = MarcarFeedbackLidoService().executar(
        data.get("feedback_id"),
        nome_operador
    )

    if isinstance(resultado,tuple):
        return resultado

    return jsonify({"mensagem":"Feedback marcado como lido"}),200

@bp.route("/feedbacks/registrar-ciencia",methods=["POST"])
@jwt_required()
def registrar_ciencia_feedback():
    data = request.get_json() or {}
    cpf_operador = get_jwt_identity()

    if not cpf_operador:
        return jsonify({"erro":"Usuário não identificado"}),401

    resultado = RegistrarCienciaFeedbackService().executar(
        data.get("feedback_id"),
        cpf_operador,
        data.get("senha")
    )

    if isinstance(resultado,tuple):
        return resultado

    return jsonify({"mensagem":"Ciência do feedback registrada com sucesso"}),200
