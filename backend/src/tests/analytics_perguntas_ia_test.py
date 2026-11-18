from datetime import datetime, timedelta
from unittest.mock import patch

from src.application.services.admin_service import FeedbackAnalyticsService


def _mensagem(indice, dias_atras, centro_custo="MU", is_user=True):
    data = datetime.now() - timedelta(days=dias_atras)
    return {
        "ID": indice,
        "OPERADOR": f"Operador {indice}",
        "MENSAGEM": f"Pergunta {indice}",
        "IS_USER": is_user,
        "CENTRO_CUSTO": centro_custo,
        "CONVERSA_ID": f"conversa-{indice}",
        "DATA_MENSAGEM": data,
        "RESPOSTA_UTIL": None,
    }


def _analise(indice, dias_atras, centro_custo="MU"):
    return {
        "OPERADOR": f"Operador {indice}",
        "CARTEIRA": centro_custo,
        "CONVERSA_ID": f"conversa-{indice}",
        "PERGUNTA": f"Pergunta {indice}",
        "TOPICO": "Negociação",
        "JUSTIFICATIVA": "",
        "DATA_PERGUNTA": datetime.now() - timedelta(days=dias_atras),
    }


# Uma pergunta hoje e cinco espalhadas pelos dias anteriores, todas dentro dos
# 7 pontos do grafico diario.
MENSAGENS = [_mensagem(0, 0)] + [_mensagem(i, i) for i in range(1, 6)]
ANALISES = [_analise(0, 0)] + [_analise(i, i) for i in range(1, 6)]


@patch("src.application.services.admin_service.IADesempenhoRepository")
def test_cartoes_do_diario_contam_so_hoje(mock_repo):
    """O cartao somava a janela inteira do grafico — 7 dias no diario — mas o
    rotulo diz Diario, e o numero nao batia com o relatorio por e-mail."""
    mock_repo.return_value.listar_mensagens_ia.return_value = MENSAGENS
    mock_repo.return_value.listar_analises_perguntas.return_value = ANALISES

    resultado = FeedbackAnalyticsService().analytics_perguntas_ia(periodo="diario")

    assert resultado["summary"]["total_perguntas"] == 1
    assert resultado["summary"]["operadores_unicos"] == 1
    assert resultado["summary"]["centro_custo_lider_total"] == 1


@patch("src.application.services.admin_service.IADesempenhoRepository")
def test_serie_do_grafico_continua_historica(mock_repo):
    mock_repo.return_value.listar_mensagens_ia.return_value = MENSAGENS
    mock_repo.return_value.listar_analises_perguntas.return_value = ANALISES

    resultado = FeedbackAnalyticsService().analytics_perguntas_ia(periodo="diario")

    assert len(resultado["timeline"]) == FeedbackAnalyticsService.DAILY_POINTS
    assert sum(ponto["total"] for ponto in resultado["timeline"]) == 6


@patch("src.application.services.admin_service.IADesempenhoRepository")
def test_comparativo_nao_zera_mais(mock_repo):
    """_filter_rows_by_date_range lia DATA_REGISTRO, campo que as perguntas da
    IA não têm: toda linha era descartada e o comparativo dava 0 contra 0."""
    mock_repo.return_value.listar_mensagens_ia.return_value = MENSAGENS
    mock_repo.return_value.listar_analises_perguntas.return_value = ANALISES

    comparativo = FeedbackAnalyticsService().analytics_perguntas_ia(
        periodo="diario"
    )["comparativo"]

    assert comparativo["current_value"] == 1
    assert comparativo["previous_value"] == 1
