from flask import Blueprint, jsonify, request
from flask_cors import cross_origin

from src.application.services.roteiro_service import (
    AtualizarFluxoService,
    AtualizarMensagemService,
    DefinirAbaRoteiroService,
    ListarAbasRoteiroService,
    BuscarFluxoPorIdService,
    BuscarFluxoInicialService,
    BuscarMensagemService,
    CriarFluxoService,
    CriarMensagemNoFluxoService,
    CriarSituacaoService,
    CriarTabulacaoService,
    ExcluirFluxoService,
    ExcluirMensagemService,
    ExcluirOpcaoService,
    ListarFluxosService,
    ListarProdutosService,
    ListarTiposLigacaoService,
    ListarTiposClienteService,
)


bp = Blueprint("roteiro_bp", __name__, url_prefix="/roteiro")


@bp.route("/tipos-ligacao", methods=["GET"])
def get_tipos_ligacao():
    try:
        return jsonify(ListarTiposLigacaoService().executar()), 200
    except Exception as e:
        return jsonify({"erro": f"Erro ao buscar tipos de ligação: {str(e)}"}), 500


@bp.route("/produtos", methods=["GET"])
def get_produtos():
    try:
        return jsonify(ListarProdutosService().executar()), 200
    except Exception as e:
        return jsonify({"erro": f"Erro ao buscar produtos: {str(e)}"}), 500


@bp.route("/tipos-cliente", methods=["GET"])
def get_tipos_cliente():
    try:
        return jsonify(ListarTiposClienteService().executar()), 200
    except Exception as e:
        return jsonify({"erro": f"Erro ao buscar tipos de cliente: {str(e)}"}), 500


@bp.route("/abas", methods=["GET"])
def get_abas():
    """Qual fluxo alimenta cada aba do roteiro do operador."""
    try:
        return jsonify(ListarAbasRoteiroService().executar()), 200
    except Exception as e:
        return jsonify({"erro": f"Erro ao buscar abas do roteiro: {str(e)}"}), 500


@bp.route("/abas/<aba>", methods=["PUT"])
@cross_origin()
def put_aba(aba):
    try:
        data = request.get_json() or {}
        resultado = DefinirAbaRoteiroService().executar(
            aba,
            data.get("id_fluxo"),
            data.get("definido_por"),
        )

        if isinstance(resultado, tuple):
            body, status = resultado
            return jsonify(body), status

        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({"erro": f"Erro ao vincular a aba: {str(e)}"}), 500


@bp.route("/fluxos", methods=["GET"])
def get_fluxos():
    try:
        resultado = ListarFluxosService().executar(
            tipo_ligacao=request.args.get("tipo_ligacao"),
            produto=request.args.get("produto"),
            tipo_cliente=request.args.get("tipo_cliente"),
        )
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({"erro": f"Erro ao buscar fluxos: {str(e)}"}), 500


@bp.route("/mensagem-inicial", methods=["GET"])
def get_mensagem_inicial():
    tipo_ligacao = request.args.get("tipo_ligacao")
    produto = request.args.get("produto")
    tipo_cliente = request.args.get("tipo_cliente")

    if not all([tipo_ligacao, produto, tipo_cliente]):
        return jsonify({"erro": "Parâmetros obrigatórios ausentes"}), 400

    try:
        resultado = BuscarFluxoInicialService().executar(
            tipo_ligacao,
            produto,
            tipo_cliente,
        )

        if not resultado:
            return jsonify({"erro": "Fluxo não encontrado"}), 404

        return jsonify(resultado), 200
    except Exception as e:
        return jsonify(
            {
                "erro": "Erro interno ao buscar fluxo",
                "detalhe": str(e),
            }
        ), 500


@bp.route("/fluxo/<id_fluxo>", methods=["GET"])
def get_fluxo_por_id(id_fluxo):
    try:
        resultado = BuscarFluxoPorIdService().executar(id_fluxo)

        if not resultado:
            return jsonify({"erro": "Fluxo não encontrado"}), 404

        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({"erro": f"Erro ao buscar fluxo por id: {str(e)}"}), 500


@bp.route("/mensagem/<id_mensagem>", methods=["GET"])
def get_mensagem_por_id(id_mensagem):
    try:
        resultado = BuscarMensagemService().executar(id_mensagem)

        if not resultado:
            return jsonify({"erro": "Mensagem não encontrada"}), 404

        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({"erro": f"Erro ao buscar mensagem: {str(e)}"}), 500


@bp.route("/mensagem", methods=["PUT"])
@cross_origin()
def put_mensagem_por_id():
    try:
        resultado = AtualizarMensagemService().executar(request.get_json() or {})

        if isinstance(resultado, tuple):
            body, status = resultado
            return jsonify(body), status

        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({"erro": f"Erro ao atualizar mensagem: {str(e)}"}), 500


@bp.route("/opcao/<id_opcao>", methods=["DELETE"])
@cross_origin()
def delete_opcao_por_id(id_opcao):
    try:
        resultado = ExcluirOpcaoService().executar(id_opcao)

        if isinstance(resultado, tuple):
            body, status = resultado
            return jsonify(body), status

        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({"erro": f"Erro ao deletar opção: {str(e)}"}), 500


@bp.route("/mensagem/<id_mensagem>", methods=["DELETE"])
@cross_origin()
def delete_mensagem_por_id(id_mensagem):
    try:
        resultado = ExcluirMensagemService().executar(id_mensagem)

        if isinstance(resultado, tuple):
            body, status = resultado
            return jsonify(body), status

        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({"erro": f"Erro ao deletar mensagem: {str(e)}"}), 500


@bp.route("/fluxo/<id_fluxo>", methods=["DELETE"])
@cross_origin()
def delete_fluxo_por_id(id_fluxo):
    try:
        resultado = ExcluirFluxoService().executar(id_fluxo)

        if isinstance(resultado, tuple):
            body, status = resultado
            return jsonify(body), status

        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({"erro": f"Erro ao deletar fluxo: {str(e)}"}), 500


@bp.route("/fluxo/<id_fluxo>", methods=["PUT"])
@cross_origin()
def put_fluxo_por_id(id_fluxo):
    try:
        resultado = AtualizarFluxoService().executar(id_fluxo, request.get_json() or {})

        if isinstance(resultado, tuple):
            body, status = resultado
            return jsonify(body), status

        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({"erro": f"Erro ao atualizar fluxo: {str(e)}"}), 500


@bp.route("/fluxo", methods=["POST"])
@cross_origin()
def post_fluxo():
    try:
        resultado = CriarFluxoService().executar(request.get_json() or {})

        if isinstance(resultado, tuple):
            body, status = resultado
            return jsonify(body), status

        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({"erro": f"Erro ao criar fluxo: {str(e)}"}), 500


@bp.route("/fluxo/<id_fluxo>/mensagem", methods=["POST"])
@cross_origin()
def post_mensagem_no_fluxo(id_fluxo):
    try:
        resultado = CriarMensagemNoFluxoService().executar(id_fluxo, request.get_json() or {})

        if isinstance(resultado, tuple):
            body, status = resultado
            return jsonify(body), status

        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({"erro": f"Erro ao criar mensagem no fluxo: {str(e)}"}), 500


@bp.route("/tabulacao", methods=["POST"])
@cross_origin()
def post_tabulacao():
    try:
        data = request.get_json() or {}
        resultado = CriarTabulacaoService().executar(
            data.get("titulo"),
            data.get("mensagem"),
        )
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({"erro": f"Erro ao criar tabulação: {str(e)}"}), 500


@bp.route("/situacoes", methods=["POST"])
@cross_origin()
def post_situacao():
    try:
        data = request.get_json() or {}
        resultado = CriarSituacaoService().executar(
            data.get("titulo"),
            data.get("mensagem"),
        )
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({"erro": f"Erro ao criar situação: {str(e)}"}), 500
