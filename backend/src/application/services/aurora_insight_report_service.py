from collections import Counter
from datetime import date, datetime, time, timedelta
from html import escape

from src.application.services.admin_service import FeedbackAnalyticsService
from src.infrastructure.repositories.sql_ia_repository import IADesempenhoRepository
from src.shared.ia.temas_perguntas import TEMAS_PERGUNTAS


def dia_operacional_anterior(data_referencia: date) -> date:
    """Retorna o dia anterior, desconsiderando somente o domingo."""
    data_anterior = data_referencia - timedelta(days=1)
    if data_anterior.weekday() == 6:
        data_anterior -= timedelta(days=1)
    return data_anterior


class AuroraInsightDailyReportService:
    def __init__(self, repository=None):
        self.repository = repository or IADesempenhoRepository()
        self.analytics = FeedbackAnalyticsService()

    @staticmethod
    def _no_intervalo(row, campo: str, inicio: datetime, fim: datetime) -> bool:
        valor = row.get(campo)
        if isinstance(valor, datetime):
            data_hora = valor
        elif valor:
            try:
                data_hora = datetime.fromisoformat(str(valor))
            except ValueError:
                return False
        else:
            return False
        return inicio <= data_hora < fim

    def _operadores_distintos(self, linhas: list[dict]) -> set[str]:
        return {
            self.analytics._normalize_text(row.get("OPERADOR"))
            for row in linhas
            if self.analytics._normalize_text(row.get("OPERADOR"))
        }

    def _build_wallet_usage(
        self,
        perguntas_atuais: list[dict],
        perguntas_comparacao: list[dict],
        respostas_atuais: list[dict],
        perguntas_mes: list[dict],
    ) -> list[dict]:
        carteiras: dict[str, dict] = {}

        def garantir(nome) -> dict | None:
            label = str(nome or "").strip()
            chave = self.analytics._normalize_text(label)
            if not chave:
                return None
            return carteiras.setdefault(
                chave,
                {
                    "carteira": label,
                    "perguntas": [],
                    "perguntas_anteriores": [],
                    "perguntas_mes": [],
                    "respostas": [],
                },
            )

        for row in perguntas_atuais:
            grupo = garantir(row.get("CARTEIRA"))
            if grupo is not None:
                grupo["perguntas"].append(row)

        for row in perguntas_comparacao:
            grupo = garantir(row.get("CARTEIRA"))
            if grupo is not None:
                grupo["perguntas_anteriores"].append(row)

        for row in perguntas_mes:
            grupo = garantir(row.get("CARTEIRA"))
            if grupo is not None:
                grupo["perguntas_mes"].append(row)

        for row in respostas_atuais:
            grupo = garantir(row.get("CENTRO_CUSTO"))
            if grupo is not None:
                grupo["respostas"].append(row)

        total_geral = len(perguntas_atuais)
        resultado = []
        for grupo in carteiras.values():
            perguntas = grupo["perguntas"]
            perguntas_anteriores = grupo["perguntas_anteriores"]
            operadores = self._operadores_distintos(perguntas)
            topicos = Counter(
                str(row.get("TOPICO") or "Outros").strip() or "Outros"
                for row in perguntas
            )
            feedback = self.analytics._build_ia_feedback_summary(
                grupo["respostas"]
            )
            comparativo = self.analytics._build_metric_comparison(
                len(perguntas),
                len(perguntas_anteriores),
                True,
                "Volume de perguntas da carteira",
            )

            resultado.append(
                {
                    "carteira": grupo["carteira"],
                    "total_perguntas": len(perguntas),
                    "total_perguntas_mes": len(grupo["perguntas_mes"]),
                    "operadores_unicos_mes": len(
                        self._operadores_distintos(grupo["perguntas_mes"])
                    ),
                    "percentual_total": round(
                        (len(perguntas) / total_geral) * 100,
                        2,
                    ) if total_geral else 0,
                    "operadores_unicos": len(operadores),
                    "perguntas_por_operador": round(
                        len(perguntas) / len(operadores),
                        2,
                    ) if operadores else 0,
                    "topico_principal": (
                        topicos.most_common(1)[0][0]
                        if topicos else "Sem dados"
                    ),
                    "total_anterior": len(perguntas_anteriores),
                    "variacao_percentual": comparativo["delta_percent"],
                    "total_feedbacks": feedback["total_feedbacks"],
                    "taxa_utilidade": feedback["taxa_utilidade"],
                    "taxa_feedback": feedback["taxa_feedback"],
                }
            )

        resultado.sort(
            key=lambda item: (
                -item["total_perguntas"],
                -item["total_anterior"],
                item["carteira"].lower(),
            )
        )
        return resultado

    def gerar(self, data_relatorio: date) -> dict:
        inicio = datetime.combine(data_relatorio, time.min)
        fim = inicio + timedelta(days=1)
        data_comparacao = dia_operacional_anterior(data_relatorio)
        comparacao_inicio = datetime.combine(data_comparacao, time.min)
        comparacao_fim = comparacao_inicio + timedelta(days=1)

        mes_inicio = datetime.combine(data_relatorio.replace(day=1), time.min)
        # A janela do mes ja cobre a do dia; a da comparacao pode ficar fora
        # dela (fechamento do dia 1 compara com o ultimo dia do mes anterior),
        # entao a consulta comeca na mais antiga das duas.
        consulta_inicio = min(mes_inicio, comparacao_inicio)

        mensagens = self.repository.listar_mensagens_ia_periodo(
            consulta_inicio,
            fim,
        )
        analises = self.repository.listar_analises_perguntas_periodo(
            consulta_inicio,
            fim,
        )
        perguntas = self.analytics._build_ia_questions_from_messages(
            mensagens,
            analises,
        )

        perguntas_atuais = [
            row for row in perguntas
            if self._no_intervalo(row, "DATA_PERGUNTA", inicio, fim)
        ]
        perguntas_comparacao = [
            row for row in perguntas
            if self._no_intervalo(
                row,
                "DATA_PERGUNTA",
                comparacao_inicio,
                comparacao_fim,
            )
        ]
        perguntas_mes = [
            row for row in perguntas
            if self._no_intervalo(row, "DATA_PERGUNTA", mes_inicio, fim)
        ]
        mensagens_atuais = [
            row for row in mensagens
            if self._no_intervalo(row, "DATA_MENSAGEM", inicio, fim)
            and str(row.get("CENTRO_CUSTO") or "").strip()
        ]
        perguntas_mensagens = [
            row for row in mensagens_atuais if bool(row.get("IS_USER"))
        ]
        respostas_mensagens = [
            row for row in mensagens_atuais if not bool(row.get("IS_USER"))
        ]

        topicos = self.analytics._build_ia_topic_distribution(perguntas_atuais)
        operadores = self.analytics._build_ia_operator_ranking(
            perguntas_atuais,
            limite=None,
        )
        centros_custo = self.analytics._build_ia_centro_custo_distribution(
            perguntas_mensagens
        )
        feedback = self.analytics._build_ia_feedback_summary(
            respostas_mensagens
        )
        comparativo = self.analytics._build_metric_comparison(
            len(perguntas_atuais),
            len(perguntas_comparacao),
            True,
            "Volume de perguntas",
        )
        carteiras = self._build_wallet_usage(
            perguntas_atuais,
            perguntas_comparacao,
            respostas_mensagens,
            perguntas_mes,
        )

        return {
            "data_relatorio": data_relatorio,
            "data_comparacao": data_comparacao,
            "summary": {
                "total_perguntas": len(perguntas_atuais),
                "operadores_unicos": len(
                    self._operadores_distintos(perguntas_atuais)
                ),
                "total_perguntas_mes": len(perguntas_mes),
                "operadores_unicos_mes": len(
                    self._operadores_distintos(perguntas_mes)
                ),
                "topico_lider": (
                    topicos[0]["topico"] if topicos else "Sem dados"
                ),
                "topico_lider_total": (
                    topicos[0]["total"] if topicos else 0
                ),
                "centro_custo_lider": (
                    centros_custo[0]["centro_custo"]
                    if centros_custo else "Sem dados"
                ),
                "centro_custo_lider_total": (
                    centros_custo[0]["total_perguntas"]
                    if centros_custo else 0
                ),
                "taxa_utilidade_respostas": feedback["taxa_utilidade"],
                "taxa_feedback_respostas": feedback["taxa_feedback"],
                "total_feedbacks_respostas": feedback["total_feedbacks"],
            },
            "comparativo": comparativo,
            "carteiras": carteiras,
            "topicos": topicos[:10],
            "operadores": operadores[:10],
            "centros_custo": centros_custo[:10],
            "feedback": feedback,
            "perguntas_recentes": self.analytics._build_ia_recent_questions(
                perguntas_atuais,
                limite=8,
            ),
        }


class AuroraInsightDailyEmailRenderer:
    @staticmethod
    def _formatar_percentual(valor) -> str:
        return f"{float(valor or 0):.2f}%".replace(".", ",")

    @staticmethod
    def _formatar_delta(comparativo: dict) -> str:
        delta = float(comparativo.get("delta_percent") or 0)
        sinal = "+" if delta > 0 else ""
        return f"{sinal}{delta:.2f}%".replace(".", ",")

    @staticmethod
    def _glossario_html() -> str:
        itens = "".join(
            (
                '<div style="margin-top:6px">'
                f'<strong>{escape(tema)}:</strong> {escape(definicao)}'
                "</div>"
            )
            for tema, definicao in TEMAS_PERGUNTAS.items()
        )
        return itens

    @staticmethod
    def _glossario_texto() -> list[str]:
        return [f"- {tema}: {definicao}" for tema, definicao in TEMAS_PERGUNTAS.items()]

    @staticmethod
    def assunto(relatorio: dict) -> str:
        data = relatorio["data_relatorio"].strftime("%d/%m/%Y")
        return f"Aurora Insight — Relatório diário de uso da IA — {data}"

    def texto(self, relatorio: dict) -> str:
        resumo = relatorio["summary"]
        comparativo = relatorio["comparativo"]
        linhas = [
            f"Aurora Insight — {relatorio['data_relatorio'].strftime('%d/%m/%Y')}",
            "",
            f"Perguntas: {resumo['total_perguntas']}",
            f"Operadores únicos: {resumo['operadores_unicos']}",
            f"Perguntas no mês: {resumo['total_perguntas_mes']}",
            (
                "Colaboradores distintos no mês: "
                f"{resumo['operadores_unicos_mes']}"
            ),
            (
                "Variação sobre o último dia operacional: "
                f"{self._formatar_delta(comparativo)}"
            ),
            (
                "Tema principal: "
                f"{resumo['topico_lider']} ({resumo['topico_lider_total']})"
            ),
            (
                "Centro de custo líder: "
                f"{resumo['centro_custo_lider']} "
                f"({resumo['centro_custo_lider_total']})"
            ),
            (
                "Utilidade das respostas avaliadas: "
                f"{self._formatar_percentual(resumo['taxa_utilidade_respostas'])}"
            ),
            (
                "Participação em feedbacks: "
                f"{self._formatar_percentual(resumo['taxa_feedback_respostas'])}"
            ),
            "",
            "Principais temas:",
        ]
        linhas.extend(
            f"- {item['topico']}: {item['total']} ({self._formatar_percentual(item['percentual'])})"
            for item in relatorio["topicos"][:5]
        )
        linhas.append("")
        linhas.append("Uso por carteira:")
        linhas.extend(
            (
                f"- {item['carteira']}: {item['total_perguntas']} perguntas, "
                f"{item['operadores_unicos']} operadores, "
                f"{self._formatar_percentual(item['percentual_total'])} do total, "
                f"variação {self._formatar_delta({'delta_percent': item['variacao_percentual']})}"
                f" | mês: {item['total_perguntas_mes']} perguntas, "
                f"{item['operadores_unicos_mes']} colaboradores"
            )
            for item in relatorio["carteiras"]
        )
        linhas.append("")
        linhas.append("Operadores com maior uso:")
        linhas.extend(
            f"- {item['operador']}: {item['total_perguntas']} perguntas"
            for item in relatorio["operadores"][:5]
        )
        linhas.append("")
        linhas.append("Glossário dos temas:")
        linhas.extend(self._glossario_texto())
        return "\n".join(linhas)

    @staticmethod
    def _linhas_tabela(itens: list[dict], colunas: list[tuple[str, str]]) -> str:
        if not itens:
            return (
                f'<tr><td colspan="{len(colunas)}" style="padding:14px;color:#64748b;'
                'text-align:center">Sem dados no período.</td></tr>'
            )

        linhas = []
        for item in itens:
            celulas = "".join(
                (
                    '<td style="padding:10px 12px;border-bottom:1px solid '
                    f'#e2e8f0;color:#334155">{escape(str(item.get(chave, "")))}</td>'
                )
                for chave, _ in colunas
            )
            linhas.append(f"<tr>{celulas}</tr>")
        return "".join(linhas)

    def html(self, relatorio: dict) -> str:
        resumo = relatorio["summary"]
        comparativo = relatorio["comparativo"]
        data = relatorio["data_relatorio"].strftime("%d/%m/%Y")
        delta = self._formatar_delta(comparativo)
        delta_cor = (
            "#059669"
            if comparativo["delta_value"] > 0
            else "#e11d48"
            if comparativo["delta_value"] < 0
            else "#475569"
        )

        topicos = [
            {
                "nome": item["topico"],
                "total": item["total"],
                "percentual": self._formatar_percentual(item["percentual"]),
            }
            for item in relatorio["topicos"][:5]
        ]
        operadores = [
            {
                "nome": item["operador"],
                "total": item["total_perguntas"],
                "topico": item["topico_principal"],
            }
            for item in relatorio["operadores"][:5]
        ]
        carteiras = [
            {
                "nome": item["carteira"],
                "perguntas": item["total_perguntas"],
                "perguntas_mes": item["total_perguntas_mes"],
                "colaboradores_mes": item["operadores_unicos_mes"],
                "participacao": self._formatar_percentual(
                    item["percentual_total"]
                ),
                "operadores": item["operadores_unicos"],
                "media": f"{float(item['perguntas_por_operador']):.2f}".replace(
                    ".",
                    ",",
                ),
                "variacao": self._formatar_delta(
                    {"delta_percent": item["variacao_percentual"]}
                ),
                "topico": item["topico_principal"],
                "utilidade": (
                    f"{self._formatar_percentual(item['taxa_utilidade'])} "
                    f"({item['total_feedbacks']})"
                    if item["total_feedbacks"]
                    else "Sem avaliações"
                ),
            }
            for item in relatorio["carteiras"]
        ]
        return f"""<!doctype html>
<html lang="pt-BR">
<body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a">
  <div style="max-width:760px;margin:0 auto;padding:24px">
    <div style="background:linear-gradient(135deg,#111827,#1f2937);border-radius:22px;padding:28px;color:#fff">
      <div style="font-size:13px;color:#fdba74;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Aurora Insight</div>
      <h1 style="margin:8px 0 6px;font-size:27px">Uso diário da IA por carteira</h1>
      <div style="color:#cbd5e1">Fechamento de {data}, das 00:00 às 23:59</div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin:16px 0">
      <div style="background:#fff;border-radius:16px;padding:18px">
        <div style="font-size:12px;color:#64748b;text-transform:uppercase">Perguntas</div>
        <div style="font-size:28px;font-weight:700;margin-top:5px">{resumo['total_perguntas']}</div>
        <div style="font-size:12px;color:#64748b;margin-top:3px">{resumo['total_perguntas_mes']} no mês</div>
      </div>
      <div style="background:#fff;border-radius:16px;padding:18px">
        <div style="font-size:12px;color:#64748b;text-transform:uppercase">Operadores únicos</div>
        <div style="font-size:28px;font-weight:700;margin-top:5px">{resumo['operadores_unicos']}</div>
        <div style="font-size:12px;color:#64748b;margin-top:3px">{resumo['operadores_unicos_mes']} no mês</div>
      </div>
      <div style="background:#fff;border-radius:16px;padding:18px">
        <div style="font-size:12px;color:#64748b;text-transform:uppercase">Variação diária</div>
        <div style="font-size:28px;font-weight:700;margin-top:5px;color:{delta_cor}">{delta}</div>
      </div>
      <div style="background:#fff;border-radius:16px;padding:18px">
        <div style="font-size:12px;color:#64748b;text-transform:uppercase">Respostas úteis</div>
        <div style="font-size:28px;font-weight:700;margin-top:5px">{self._formatar_percentual(resumo['taxa_utilidade_respostas'])}</div>
        <div style="font-size:12px;color:#64748b;margin-top:3px">{resumo['total_feedbacks_respostas']} respostas avaliadas</div>
      </div>
    </div>

    <div style="background:#fff;border-radius:16px;padding:20px;margin-bottom:16px">
      <div style="font-size:13px;color:#64748b">Destaques do dia</div>
      <div style="margin-top:10px"><strong>Tema líder:</strong> {escape(str(resumo['topico_lider']))} ({resumo['topico_lider_total']})</div>
      <div style="margin-top:7px"><strong>Centro de custo líder:</strong> {escape(str(resumo['centro_custo_lider']))} ({resumo['centro_custo_lider_total']})</div>
      <div style="margin-top:7px"><strong>Participação em feedbacks:</strong> {self._formatar_percentual(resumo['taxa_feedback_respostas'])}</div>
    </div>

    <div style="background:#fff;border-radius:16px;padding:20px;margin-bottom:16px">
      <h2 style="font-size:17px;margin:0 0 4px">Resultado de uso por carteira</h2>
      <p style="font-size:12px;color:#64748b;margin:0 0 12px">Colunas do dia comparadas com o último dia operacional anterior (domingo desconsiderado). As colunas do mês acumulam do dia 1 até {data}.</p>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="text-align:left;color:#64748b">
            <th style="padding:8px 10px">Carteira</th>
            <th style="padding:8px 10px">Perguntas</th>
            <th style="padding:8px 10px">Perguntas/mês</th>
            <th style="padding:8px 10px">Colab./mês</th>
            <th style="padding:8px 10px">% total</th>
            <th style="padding:8px 10px">Operadores</th>
            <th style="padding:8px 10px">Perg./oper.</th>
            <th style="padding:8px 10px">Variação</th>
            <th style="padding:8px 10px">Tema líder</th>
            <th style="padding:8px 10px">Utilidade</th>
          </tr></thead>
          <tbody>{self._linhas_tabela(carteiras, [('nome', 'Carteira'), ('perguntas', 'Perguntas'), ('perguntas_mes', 'Perguntas/mês'), ('colaboradores_mes', 'Colab./mês'), ('participacao', '% total'), ('operadores', 'Operadores'), ('media', 'Perg./oper.'), ('variacao', 'Variação'), ('topico', 'Tema líder'), ('utilidade', 'Utilidade')])}</tbody>
        </table>
      </div>
    </div>

    <div style="background:#fff;border-radius:16px;padding:20px;margin-bottom:16px">
      <h2 style="font-size:17px;margin:0 0 12px">Principais temas</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="text-align:left;color:#64748b">
          <th style="padding:8px 12px">Tema</th><th style="padding:8px 12px">Perguntas</th><th style="padding:8px 12px">Participação</th>
        </tr></thead>
        <tbody>{self._linhas_tabela(topicos, [('nome', 'Tema'), ('total', 'Perguntas'), ('percentual', 'Participação')])}</tbody>
      </table>
    </div>

    <div style="background:#fff;border-radius:16px;padding:20px;margin-bottom:16px">
      <h2 style="font-size:17px;margin:0 0 12px">Operadores com maior uso</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="text-align:left;color:#64748b">
          <th style="padding:8px 12px">Operador</th><th style="padding:8px 12px">Perguntas</th><th style="padding:8px 12px">Tema principal</th>
        </tr></thead>
        <tbody>{self._linhas_tabela(operadores, [('nome', 'Operador'), ('total', 'Perguntas'), ('topico', 'Tema principal')])}</tbody>
      </table>
    </div>

    <div style="background:#fff;border-radius:16px;padding:20px;margin-bottom:16px">
      <h2 style="font-size:17px;margin:0 0 4px">Glossário dos temas</h2>
      <p style="font-size:12px;color:#64748b;margin:0 0 10px">Cada pergunta é classificada em um único tema desta lista.</p>
      <div style="font-size:12px;color:#334155">{self._glossario_html()}</div>
    </div>

    <div style="font-size:11px;color:#64748b;text-align:center;padding:18px">
      Relatório automático do Copilot · Aurora Insight · O conteúdo bruto das perguntas não é enviado por e-mail.
    </div>
  </div>
</body>
</html>"""
