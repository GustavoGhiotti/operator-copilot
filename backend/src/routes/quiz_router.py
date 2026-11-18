from flask import Blueprint, request, jsonify
from src.application.services.quiz_service import *

bp = Blueprint("quiz", __name__, url_prefix="/quiz")

# -------------- ROTAS PRINCIPAIS ----------------#
@bp.route("/ranking", methods=["POST"])
def ranking():
    try:
        data = request.get_json() or {}
        periodo = data.get("periodo")

        if not periodo:
            return jsonify({"erro":"Período não informado"}),400

        service = QuizRankingService()
        resultado = service.gerar_ranking(periodo)

        return jsonify({
            "mensagem":"Ranking gerado com sucesso",
            "dados":resultado
        })

    except Exception as e:
        return jsonify({"erro":str(e)}),400

@bp.route("/temas",methods=["GET"])
def listar_temas():
    centro_custo = request.args.get("centro_custo","").strip().upper()

    temas = QuizListarTemasService().executar(centro_custo)

    if not temas:
        return jsonify({"erro":"Não foi possível recuperar os temas"}),404

    return jsonify(temas),200

@bp.route("/perguntas",methods=["GET"])
def listar_perguntas():
    centro_custo = request.args.get("centro_custo","").strip().upper()
    tema_codigo = request.args.get("tema")
    id_usuario = request.args.get("usuario")

    if not tema_codigo or not id_usuario:
        return jsonify({"erro":"Tema e usuário são obrigatórios"}),400

    perguntas = QuizListarPerguntasService().executar(tema_codigo,centro_custo,id_usuario)

    if isinstance(perguntas,dict) and "erro" in perguntas:
        return jsonify(perguntas),perguntas.get("status",400)

    return jsonify(perguntas),200

@bp.route("/pontuacao_total",methods=["GET"])
def pontuacao_total():
    usuario = request.args.get("usuario","").strip().upper()

    if not usuario:
        return jsonify({"erro":"Usuário não informado"}),400

    dados = QuizPontuacaoService().executar(usuario)

    if isinstance(dados,tuple):
        return dados

    return jsonify(dados),200

@bp.route("/concluidos",methods=["GET"])
def concluidos():
    usuario = request.args.get("usuario","").strip().upper()

    if not usuario:
        return jsonify({"erro":"Usuário não informado"}),400

    dados = QuizConcluidosService().executar(usuario)

    if isinstance(dados,tuple):
        return dados

    return jsonify({"concluidos":dados}),200

# -------------- ROTAS OPERADOR ----------------#
@bp.route("/responder",methods=["POST"])
def responder():
    data = request.get_json() or {}

    resultado = QuizResponderService().executar(
        data.get("usuario"),
        data.get("id_tema"),
        data.get("id_resposta"),
        data.get("pontos")
    )

    if isinstance(resultado,tuple):
        return resultado

    return jsonify({"mensagem":"Resposta registrada com sucesso"}),200
    
@bp.route("/finalizar",methods=["POST"])
def finalizar():
    data = request.get_json() or {}

    resultado = QuizFinalizarService().executar(
        data.get("usuario"),
        data.get("id_tema"),
        data.get("pontos")
    )

    if isinstance(resultado,tuple):
        return resultado

    return jsonify({"mensagem":"Resposta registrada com sucesso"}),200
    

# -------------- ROTAS ADMIN ----------------#

# Temas
@bp.route("/temas/criar",methods=["POST"])
def criar_tema():
    data = request.get_json() or {}

    if not data.get("codigo") or not data.get("title"):
        return jsonify({"erro":"Código e título são obrigatórios"}),400

    QuizTemasService().criar(data)

    return jsonify({"msg":"Tema criado"}),201

@bp.route("/temas/<id>",methods=["PUT"])
def atualizar_tema(id):
    data = request.get_json() or {}

    if not data.get("codigo") or not data.get("title"):
        return jsonify({"erro":"Código e título são obrigatórios"}),400

    QuizTemasService().atualizar(id,data)

    return jsonify({"msg":"Tema atualizado"}),200

@bp.route("/temas/<id>",methods=["DELETE"])
def deletar_tema(id):
    QuizTemasService().deletar(id)

    return jsonify({"msg":"Tema deletado"}),200

# Perguntas
@bp.route("/perguntas/listar",methods=["GET"])
def listar_todas():
    perguntas = QuizPerguntasAdminService().listar()

    return jsonify(perguntas),200

@bp.route("/perguntas/criar",methods=["POST"])
def criar():
    data = request.get_json() or {}

    if not data.get("tema_id") or not data.get("question") or not data.get("available_date"):
        return jsonify({"erro":"Dados obrigatórios não informados"}),400

    QuizPerguntasAdminService().criar(data)

    return jsonify({"msg":"Pergunta criada"}),201

@bp.route("/perguntas/<id>",methods=["PUT"])
def atualizar(id):
    data = request.get_json() or {}

    QuizPerguntasAdminService().atualizar(id,data)

    return jsonify({"msg":"Pergunta atualizada"}),200


@bp.route("/perguntas/<id>",methods=["DELETE"])
def deletar(id):
    QuizPerguntasAdminService().deletar(id)

    return jsonify({"msg":"Pergunta deletada"}),200

@bp.route("/respostas/todas",methods=["GET"])
def listar_respostas_todas():
    dados = QuizListarRespostasService().executar()
    return jsonify(dados or []),200

@bp.route("/respostas",methods=["POST"])
def criar_respostas():
    data = request.get_json() or {}

    resultado = QuizCriarRespostasService().executar(
        data.get("question_id"),
        data.get("answers",[])
    )

    if isinstance(resultado,tuple):
        return resultado

    return jsonify({"msg":"Respostas salvas"}),201

@bp.route("/operadores",methods=["GET"])
def listar_operadores():
    nome = request.args.get("nome","").strip().upper()

    dados = QuizOperadoresService().executar(nome)

    if isinstance(dados,tuple):
        return dados

    return jsonify({"operadores":dados}),200

@bp.route("/analise-operador",methods=["GET"])
def analise_operador():
    operador = request.args.get("operador","").strip().upper()

    if not operador:
        return jsonify({"erro":"Nome do operador não informado"}),400

    dados = QuizAnaliseOperadorService().executar(operador)

    if isinstance(dados,tuple):
        return dados

    return jsonify(dados),200

# -------------- ROTAS PREMIO ----------------#
@bp.route("/premios",methods=["GET"])
def listar_premios():
    dados = QuizPremiosService().executar()

    if isinstance(dados,tuple):
        return dados

    return jsonify(dados or []),200

@bp.route("/premios",methods=["POST"])
def criar_premio():
    data = request.get_json() or {}

    resultado = QuizCriarPremioService().executar(
        data.get("nome"),
        data.get("descricao"),
        data.get("pontos_necessarios"),
        data.get("categoria"),
        data.get("icone"),
        data.get("disponivel",True),
        data.get("quantidade_disponivel")
    )

    if isinstance(resultado,tuple):
        return resultado

    return jsonify({"mensagem":"Prêmio criado com sucesso!"}),201

@bp.route("/premios/<int:id>",methods=["PUT"])
def atualizar_premio(id):
    data = request.get_json() or {}

    resultado = QuizAtualizarPremioService().executar(
        id,
        data.get("nome"),
        data.get("descricao"),
        data.get("pontos_necessarios"),
        data.get("categoria"),
        data.get("icone"),
        data.get("disponivel",True),
        data.get("quantidade_disponivel")
    )

    if isinstance(resultado,tuple):
        return resultado

    return jsonify({"mensagem":"Prêmio atualizado com sucesso!"}),200

@bp.route("/premios/<int:id>",methods=["DELETE"])
def excluir_premio(id):
    resultado = QuizExcluirPremioService().executar(id)

    if isinstance(resultado,tuple):
        return resultado

    return jsonify({"mensagem":"Prêmio excluído com sucesso!"}),200

@bp.route("/meus-resgates",methods=["GET"])
def meus_resgates():
    usuario = request.args.get("usuario","").strip().upper()

    resultado = QuizMeusResgatesService().executar(usuario)

    if isinstance(resultado,tuple):
        return resultado

    return jsonify(resultado or []),200

@bp.route("/resgatar-premio",methods=["POST"])
def resgatar_premio():
    data = request.get_json() or {}

    resultado = QuizResgatarPremioService().executar(
        data.get("usuario"),
        data.get("premio_id"),
        data.get("pontos_gastos")
    )

    if isinstance(resultado,tuple):
        return resultado

    return jsonify({"mensagem":"Resgate realizado com sucesso!"}),200