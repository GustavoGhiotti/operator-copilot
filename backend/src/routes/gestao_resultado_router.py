from flask import Blueprint, current_app, jsonify, request

from src.application.services.gestao_resultado_service import (
    GestaoResultadoError,
    GestaoResultadoService,
)
from src.middleware.permissoes import requer_area

bp = Blueprint("GestaoResultados", __name__, url_prefix="/gerente/resultados")

AREA = "gerencia.resultados"


def _executar(operacao, status_sucesso=200):
    try:
        return jsonify(operacao()), status_sucesso
    except GestaoResultadoError as erro:
        return jsonify({"erro": str(erro)}), erro.status
    except Exception:
        current_app.logger.exception("Erro ao montar os resultados operacionais")
        return jsonify({
            "erro": "Nao foi possivel carregar os resultados operacionais."
        }), 500


def _filtros() -> dict:
    """Filtros da query string.

    O endpoint antigo (/gerente/painel-executivo) nao lia parametro nenhum:
    calculava a empresa inteira toda vez, sem periodo, sem carteira e sem
    paginacao. Cada endpoint daqui recebe o recorte e devolve so ele.
    """
    return {
        "data_inicio": request.args.get("data_inicio"),
        "data_fim": request.args.get("data_fim"),
        "id_carteira": request.args.get("id_carteira"),
        "supervisor": request.args.get("supervisor"),
        "busca": request.args.get("busca"),
        "ordenar_por": request.args.get("ordenar_por"),
        "pagina": request.args.get("pagina"),
        "tamanho": request.args.get("tamanho"),
        "meses": request.args.get("meses"),
    }


@bp.route("/resumo", methods=["GET"])
@requer_area(AREA)
def resumo():
    return _executar(lambda: GestaoResultadoService().obter_resumo(_filtros()))


@bp.route("/operadores", methods=["GET"])
@requer_area(AREA)
def operadores():
    return _executar(lambda: GestaoResultadoService().listar_operadores(_filtros()))


@bp.route("/operador/<path:chave>", methods=["GET"])
@requer_area(AREA)
def ficha_operador(chave):
    return _executar(lambda: GestaoResultadoService().obter_ficha(chave, _filtros()))


@bp.route("/carteiras", methods=["GET"])
@requer_area(AREA)
def carteiras():
    return _executar(lambda: GestaoResultadoService().listar_carteiras(_filtros()))


@bp.route("/evolucao", methods=["GET"])
@requer_area(AREA)
def evolucao():
    return _executar(lambda: GestaoResultadoService().listar_evolucao(_filtros()))


@bp.route("/filtros", methods=["GET"])
@requer_area(AREA)
def filtros():
    return _executar(lambda: GestaoResultadoService().listar_filtros())
