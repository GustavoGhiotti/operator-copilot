from flask import Blueprint, request, jsonify
from src.application.services.simulacao_service import *

bp = Blueprint("Simulacao", __name__, url_prefix="/simulacao")

@bp.route("/cenarios",methods=["GET"])
def obter():
    nome_usuario = request.args.get("nome","").strip().upper()
    centro_custo = request.args.get("centro_custo","").strip().upper()

    if not nome_usuario:
        return jsonify({"erro":"Parâmetro 'nome' é obrigatório"}),400

    cenarios = SimulacaoCenariosService().executar(nome_usuario,centro_custo)

    if not cenarios:
        return jsonify({"erro":"Erro ao buscar cenários"}),500

    return jsonify(cenarios),200


@bp.route("/salvar-respostas",methods=["POST"])
def salvar_respostas_simulacao():
    data = request.get_json() or {}

    resultado = SimulacaoSalvarRespostasService().executar(
        data.get("respostas")
    )

    if isinstance(resultado,tuple):
        return resultado

    return jsonify({"mensagem":"Respostas registradas com sucesso!"}),200


@bp.route("/pontuacao",methods=["GET"])
def obter_pontuacao_simulacao():
    nome_usuario = request.args.get("nome","").strip().upper()

    resultado = SimulacaoPontuacaoService().executar(nome_usuario)

    if isinstance(resultado,tuple):
        return resultado

    return jsonify(resultado),200


@bp.route("/pontuacao-por-cenario",methods=["GET"])
def pontuacao_por_cenario():
    nome = request.args.get("nome","").strip().upper()

    resultado = SimulacaoPontuacaoPorCenarioService().executar(nome)

    if isinstance(resultado,tuple):
        return resultado

    return jsonify(resultado or []),200


@bp.route("/ranking",methods=["GET"])
def ranking_simulacao():
    periodo = request.args.get("periodo","dia").strip().lower()
    nome = request.args.get("nome","").strip().upper()  # opcional

    resultado = SimulacaoRankingService().executar(periodo,nome)

    if isinstance(resultado,tuple):
        return resultado

    return jsonify(resultado or []),200


@bp.route("/admin/cenarios",methods=["POST"])
def criar_cenario():
    data = request.get_json() or {}

    resultado = SimulacaoCriarCenarioService().executar(
        data.get("centro_custo"),
        data.get("title"),
        data.get("description"),
        data.get("icon"),
        data.get("difficulty"),
        data.get("maxPoints")
    )

    if isinstance(resultado,tuple):
        return resultado

    return jsonify({"mensagem":"Cenário criado com sucesso!"}),201


# @bp.route("/admin/cenarios",methods=["GET"])
# def obter_cenarios():
#     nome_usuario = request.args.get("nome","").strip().upper()
#     centro_custo = request.args.get("centro_custo","").strip().upper()

#     resultado = SimulacaoCenariosService().executar(nome_usuario,centro_custo)

#     if isinstance(resultado,tuple):
#         return resultado

#     return jsonify(resultado or []),200


@bp.route("/admin/cenarios",methods=["GET"])
def listar_cenarios():
    resultado = SimulacaoListarCenariosService().executar()

    if isinstance(resultado,tuple):
        return resultado

    return jsonify(resultado or []),200


@bp.route("/admin/cenarios/<int:id_cenario>",methods=["PUT"])
def atualizar_cenario(id_cenario):
    data = request.get_json() or {}

    resultado = SimulacaoAtualizarCenarioService().executar(
        id_cenario,
        data.get("centro_custo"),
        data.get("title"),
        data.get("description"),
        data.get("icon"),
        data.get("difficulty"),
        data.get("maxPoints")
    )

    if isinstance(resultado,tuple):
        return resultado

    return jsonify({"mensagem":"Cenário atualizado com sucesso!"}),200


@bp.route("/admin/cenarios/<int:id_cenario>",methods=["DELETE"])
def deletar_cenario(id_cenario):
    resultado = SimulacaoDeletarCenarioService().executar(id_cenario)

    if isinstance(resultado,tuple):
        return resultado

    return jsonify({"mensagem":"Cenário deletado com sucesso!"}),200


@bp.route("/admin/interacoes",methods=["POST"])
def criar_interacao():
    data = request.get_json() or {}

    resultado = SimulacaoCriarInteracoesService().executar(
        data.get("scenario_id"),
        data.get("interactions")
    )

    if isinstance(resultado,tuple):
        return resultado

    return jsonify({"mensagem":"Interações criadas com sucesso!"}),201


@bp.route("/admin/interacoes",methods=["GET"])
def listar_interacoes():
    scenario_id = request.args.get("scenario_id")

    resultado = SimulacaoListarInteracoesService().executar(scenario_id)

    if isinstance(resultado,tuple):
        return resultado

    return jsonify(resultado),200


@bp.route("/admin/interacoes/<int:id_interacao>",methods=["PUT"])
def atualizar_interacao(id_interacao):
    data = request.get_json() or {}

    resultado = SimulacaoAtualizarInteracaoService().executar(
        id_interacao,
        data.get("ordem"),
        data.get("mensagemCliente")
    )

    if isinstance(resultado,tuple):
        return resultado

    return jsonify({"mensagem":"Interação atualizada com sucesso!"}),200


@bp.route("/admin/interacoes/<int:id_interacao>",methods=["DELETE"])
def deletar_interacao(id_interacao):
    resultado = SimulacaoExcluirInteracaoService().executar(id_interacao)

    if isinstance(resultado,tuple):
        return resultado

    return jsonify({"mensagem":"Interação deletada com sucesso!"}),200


@bp.route("/admin/respostas",methods=["POST"])
def criar_respostas():
    resultado = SimulacaoCriarRespostasService().executar(request.get_json() or {})

    if isinstance(resultado,tuple):
        return resultado

    return jsonify({"mensagem":"Respostas criadas com sucesso!"}),201


@bp.route("/admin/respostas",methods=["GET"])
def listar_respostas():
    resultado = SimulacaoListarRespostasService().executar()

    if isinstance(resultado,tuple):
        return resultado

    return jsonify(resultado),200


@bp.route("/admin/respostas/<int:id_resposta>",methods=["DELETE"])
def deletar_resposta(id_resposta):
    resultado = SimulacaoExcluirRespostaService().executar(id_resposta)

    if isinstance(resultado,tuple):
        return resultado

    return jsonify({"mensagem":"Resposta deletada com sucesso!"}),200


@bp.route("/admin/cenario/<int:id_cenario>",methods=["GET"])
def obter_cenario(id_cenario):
    resultado = SimulacaoBuscarCenarioService().executar(id_cenario)

    if isinstance(resultado,tuple):
        return resultado

    return jsonify(resultado),200


@bp.route("/premiacoes",methods=["GET"])
def listar_premiacoes():
    categoria = request.args.get("categoria")

    resultado = SimulacaoListarPremiacoesService().executar(categoria)

    if isinstance(resultado,tuple):
        return resultado

    return jsonify(resultado),200


@bp.route("/ranking-premiacoes",methods=["GET"])
def ranking_premiacoes():
    categoria = request.args.get("categoria","monthly")
    nome = request.args.get("nome","").strip().upper()

    resultado = SimulacaoRankingPremiacoesService().executar(categoria,nome)

    if isinstance(resultado,tuple):
        return resultado

    return jsonify(resultado),200
