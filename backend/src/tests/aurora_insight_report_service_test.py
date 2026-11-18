from datetime import date, datetime

from src.application.services.aurora_insight_report_service import (
    AuroraInsightDailyEmailRenderer,
    AuroraInsightDailyReportService,
    dia_operacional_anterior,
)
from src.shared.ia.temas_perguntas import TEMAS_PERGUNTAS
from src.workers.aurora_insight_daily_report import _data_relatorio


class FakeInsightRepository:
    def listar_mensagens_ia_periodo(self, data_inicio, data_fim):
        return [
            {
                "ID": 1,
                "OPERADOR": "Ana",
                "MENSAGEM": "Pergunta anterior",
                "IS_USER": True,
                "CENTRO_CUSTO": "QUALY",
                "CONVERSA_ID": "anterior",
                "DATA_MENSAGEM": datetime(2026, 7, 25, 10, 0),
                "RESPOSTA_UTIL": None,
            },
            {
                "ID": 2,
                "OPERADOR": "Ana",
                "MENSAGEM": "Como negociar?",
                "IS_USER": True,
                "CENTRO_CUSTO": "QUALY",
                "CONVERSA_ID": "atual",
                "DATA_MENSAGEM": datetime(2026, 7, 26, 9, 0),
                "RESPOSTA_UTIL": None,
            },
            {
                "ID": 3,
                "OPERADOR": "Ana",
                "MENSAGEM": "Resposta da IA",
                "IS_USER": False,
                "CENTRO_CUSTO": "QUALY",
                "CONVERSA_ID": "atual",
                "DATA_MENSAGEM": datetime(2026, 7, 26, 9, 1),
                "RESPOSTA_UTIL": True,
            },
            {
                "ID": 4,
                "OPERADOR": "Bruno",
                "MENSAGEM": "Qual o prazo?",
                "IS_USER": True,
                "CENTRO_CUSTO": "QUALY",
                "CONVERSA_ID": "atual-2",
                "DATA_MENSAGEM": datetime(2026, 7, 26, 11, 0),
                "RESPOSTA_UTIL": None,
            },
        ]

    def listar_analises_perguntas_periodo(self, data_inicio, data_fim):
        return [
            {
                "OPERADOR": "Ana",
                "CARTEIRA": "QUALY",
                "CONVERSA_ID": "anterior",
                "PERGUNTA": "Pergunta anterior",
                "TOPICO": "Outros",
                "JUSTIFICATIVA": "",
                "DATA_PERGUNTA": datetime(2026, 7, 25, 10, 0),
            },
            {
                "OPERADOR": "Ana",
                "CARTEIRA": "QUALY",
                "CONVERSA_ID": "atual",
                "PERGUNTA": "Como negociar?",
                "TOPICO": "Negociação",
                "JUSTIFICATIVA": "",
                "DATA_PERGUNTA": datetime(2026, 7, 26, 9, 0),
            },
            {
                "OPERADOR": "Bruno",
                "CARTEIRA": "QUALY",
                "CONVERSA_ID": "atual-2",
                "PERGUNTA": "Qual o prazo?",
                "TOPICO": "Negociação",
                "JUSTIFICATIVA": "",
                "DATA_PERGUNTA": datetime(2026, 7, 26, 11, 0),
            },
        ]


class FakeMultiWalletRepository(FakeInsightRepository):
    def listar_mensagens_ia_periodo(self, data_inicio, data_fim):
        return super().listar_mensagens_ia_periodo(data_inicio, data_fim) + [
            {
                "ID": 5,
                "OPERADOR": "Carla",
                "MENSAGEM": "Pergunta anterior Delta 1",
                "IS_USER": True,
                "CENTRO_CUSTO": "DELTA",
                "CONVERSA_ID": "delta-anterior-1",
                "DATA_MENSAGEM": datetime(2026, 7, 25, 10, 0),
                "RESPOSTA_UTIL": None,
            },
            {
                "ID": 6,
                "OPERADOR": "Carla",
                "MENSAGEM": "Pergunta anterior Delta 2",
                "IS_USER": True,
                "CENTRO_CUSTO": "DELTA",
                "CONVERSA_ID": "delta-anterior-2",
                "DATA_MENSAGEM": datetime(2026, 7, 25, 11, 0),
                "RESPOSTA_UTIL": None,
            },
            {
                "ID": 7,
                "OPERADOR": "Carla",
                "MENSAGEM": "Como enviar o boleto?",
                "IS_USER": True,
                "CENTRO_CUSTO": "DELTA",
                "CONVERSA_ID": "delta-atual",
                "DATA_MENSAGEM": datetime(2026, 7, 26, 13, 0),
                "RESPOSTA_UTIL": None,
            },
            {
                "ID": 8,
                "OPERADOR": "Carla",
                "MENSAGEM": "Resposta da IA Delta",
                "IS_USER": False,
                "CENTRO_CUSTO": "DELTA",
                "CONVERSA_ID": "delta-atual",
                "DATA_MENSAGEM": datetime(2026, 7, 26, 13, 1),
                "RESPOSTA_UTIL": False,
            },
        ]

    def listar_analises_perguntas_periodo(self, data_inicio, data_fim):
        return super().listar_analises_perguntas_periodo(
            data_inicio,
            data_fim,
        ) + [
            {
                "OPERADOR": "Carla",
                "CARTEIRA": "DELTA",
                "CONVERSA_ID": "delta-anterior-1",
                "PERGUNTA": "Pergunta anterior Delta 1",
                "TOPICO": "Boleto",
                "JUSTIFICATIVA": "",
                "DATA_PERGUNTA": datetime(2026, 7, 25, 10, 0),
            },
            {
                "OPERADOR": "Carla",
                "CARTEIRA": "DELTA",
                "CONVERSA_ID": "delta-anterior-2",
                "PERGUNTA": "Pergunta anterior Delta 2",
                "TOPICO": "Boleto",
                "JUSTIFICATIVA": "",
                "DATA_PERGUNTA": datetime(2026, 7, 25, 11, 0),
            },
            {
                "OPERADOR": "Carla",
                "CARTEIRA": "DELTA",
                "CONVERSA_ID": "delta-atual",
                "PERGUNTA": "Como enviar o boleto?",
                "TOPICO": "Boleto",
                "JUSTIFICATIVA": "",
                "DATA_PERGUNTA": datetime(2026, 7, 26, 13, 0),
            },
        ]


class FakeSundayRepository:
    def listar_mensagens_ia_periodo(self, data_inicio, data_fim):
        return [
            {
                "ID": indice,
                "OPERADOR": "Ana",
                "MENSAGEM": pergunta,
                "IS_USER": True,
                "CENTRO_CUSTO": "QUALY",
                "CONVERSA_ID": f"conversa-{indice}",
                "DATA_MENSAGEM": data_pergunta,
                "RESPOSTA_UTIL": None,
            }
            for indice, pergunta, data_pergunta in [
                (1, "Pergunta de sábado", datetime(2026, 8, 8, 10, 0)),
                (2, "Pergunta de domingo", datetime(2026, 8, 9, 10, 0)),
                (3, "Pergunta de segunda", datetime(2026, 8, 10, 10, 0)),
            ]
        ]

    def listar_analises_perguntas_periodo(self, data_inicio, data_fim):
        return []


def test_dia_operacional_anterior_ignora_somente_domingo():
    assert dia_operacional_anterior(date(2026, 8, 10)) == date(2026, 8, 8)
    assert dia_operacional_anterior(date(2026, 8, 11)) == date(2026, 8, 10)
    assert dia_operacional_anterior(date(2026, 8, 9)) == date(2026, 8, 8)


def test_execucao_automatica_ignora_domingo_e_retorna_sabado_na_segunda():
    assert _data_relatorio(None, hoje=date(2026, 8, 9)) is None
    assert _data_relatorio(None, hoje=date(2026, 8, 10)) == date(2026, 8, 8)
    assert _data_relatorio(None, hoje=date(2026, 8, 11)) == date(2026, 8, 10)
    assert _data_relatorio("2026-08-09", hoje=date(2026, 8, 9)) == date(
        2026,
        8,
        9,
    )


def test_comparacao_de_segunda_usa_sabado_e_exclui_domingo():
    relatorio = AuroraInsightDailyReportService(
        FakeSundayRepository()
    ).gerar(date(2026, 8, 10))

    assert relatorio["data_comparacao"] == date(2026, 8, 8)
    assert relatorio["comparativo"]["current_value"] == 1
    assert relatorio["comparativo"]["previous_value"] == 1


def test_gera_fechamento_exato_do_dia_e_compara_dia_anterior():
    relatorio = AuroraInsightDailyReportService(
        FakeInsightRepository()
    ).gerar(date(2026, 7, 26))

    assert relatorio["summary"]["total_perguntas"] == 2
    assert relatorio["summary"]["operadores_unicos"] == 2
    assert relatorio["summary"]["topico_lider"] == "Negociação"
    assert relatorio["summary"]["taxa_utilidade_respostas"] == 100
    assert relatorio["comparativo"]["current_value"] == 2
    assert relatorio["comparativo"]["previous_value"] == 1
    assert relatorio["comparativo"]["delta_percent"] == 100
    assert relatorio["data_comparacao"] == date(2026, 7, 25)


def test_agrupa_resultado_de_uso_por_carteira():
    relatorio = AuroraInsightDailyReportService(
        FakeMultiWalletRepository()
    ).gerar(date(2026, 7, 26))

    assert [item["carteira"] for item in relatorio["carteiras"]] == [
        "QUALY",
        "DELTA",
    ]

    qualy, delta = relatorio["carteiras"]
    assert qualy["total_perguntas"] == 2
    assert qualy["operadores_unicos"] == 2
    assert qualy["percentual_total"] == 66.67
    assert qualy["variacao_percentual"] == 100
    assert qualy["taxa_utilidade"] == 100

    assert delta["total_perguntas"] == 1
    assert delta["operadores_unicos"] == 1
    assert delta["percentual_total"] == 33.33
    assert delta["variacao_percentual"] == -50
    assert delta["topico_principal"] == "Boleto"
    assert delta["taxa_utilidade"] == 0


def test_email_escapa_conteudo_e_nao_expoe_perguntas_brutas():
    relatorio = AuroraInsightDailyReportService(
        FakeMultiWalletRepository()
    ).gerar(date(2026, 7, 26))
    relatorio["topicos"][0]["topico"] = "<script>alert(1)</script>"
    relatorio["perguntas_recentes"][0]["pergunta"] = "CPF 123.456.789-00"

    renderer = AuroraInsightDailyEmailRenderer()
    html = renderer.html(relatorio)

    assert "<script>alert(1)</script>" not in html
    assert "&lt;script&gt;alert(1)&lt;/script&gt;" in html
    assert "CPF 123.456.789-00" not in html
    assert "Resultado de uso por carteira" in html
    assert "QUALY" in html
    assert "DELTA" in html
    assert "Aurora Insight" in renderer.assunto(relatorio)


def test_colunas_do_mes_acumulam_alem_do_dia():
    relatorio = AuroraInsightDailyReportService(
        FakeMultiWalletRepository()
    ).gerar(date(2026, 7, 26))

    resumo = relatorio["summary"]
    assert resumo["total_perguntas"] == 3
    assert resumo["total_perguntas_mes"] == 6
    assert resumo["operadores_unicos"] == 3
    assert resumo["operadores_unicos_mes"] == 3

    qualy, delta = relatorio["carteiras"]
    assert (qualy["total_perguntas"], qualy["total_perguntas_mes"]) == (2, 3)
    assert qualy["operadores_unicos_mes"] == 2
    assert (delta["total_perguntas"], delta["total_perguntas_mes"]) == (1, 3)
    assert delta["operadores_unicos_mes"] == 1


def test_primeiro_dia_do_mes_tem_mes_igual_ao_dia():
    class FakePrimeiroDia:
        def listar_mensagens_ia_periodo(self, data_inicio, data_fim):
            return [
                {
                    "ID": indice,
                    "OPERADOR": "Ana",
                    "MENSAGEM": pergunta,
                    "IS_USER": True,
                    "CENTRO_CUSTO": "QUALY",
                    "CONVERSA_ID": f"c-{indice}",
                    "DATA_MENSAGEM": data_pergunta,
                    "RESPOSTA_UTIL": None,
                }
                for indice, pergunta, data_pergunta in [
                    (1, "Ultimo dia de julho", datetime(2026, 7, 31, 10, 0)),
                    (2, "Primeiro de agosto", datetime(2026, 8, 1, 10, 0)),
                ]
            ]

        def listar_analises_perguntas_periodo(self, data_inicio, data_fim):
            return []

    relatorio = AuroraInsightDailyReportService(FakePrimeiroDia()).gerar(
        date(2026, 8, 1)
    )

    # A comparacao olha 31/07, que esta fora da janela do mes: o acumulado do
    # mes precisa ficar so com a pergunta do proprio dia 1.
    assert relatorio["data_comparacao"] == date(2026, 7, 31)
    assert relatorio["comparativo"]["previous_value"] == 1
    assert relatorio["summary"]["total_perguntas"] == 1
    assert relatorio["summary"]["total_perguntas_mes"] == 1


def test_email_traz_glossario_e_colunas_novas_nos_dois_corpos():
    relatorio = AuroraInsightDailyReportService(
        FakeMultiWalletRepository()
    ).gerar(date(2026, 7, 26))

    renderer = AuroraInsightDailyEmailRenderer()
    html = renderer.html(relatorio)
    texto = renderer.texto(relatorio)

    assert "Perguntas/mês" in html
    assert "Colab./mês" in html

    assert "Perguntas no mês:" in texto
    assert "Colaboradores distintos no mês:" in texto

    # A quebra por supervisor saiu do e-mail: a fonte do cadastro nao e
    # confiavel (nomes de quem ja saiu, truncados e sem correspondencia).
    assert "supervisor" not in html.lower()

    for tema, definicao in TEMAS_PERGUNTAS.items():
        assert tema in html
        assert definicao in html
        assert f"- {tema}: {definicao}" in texto
