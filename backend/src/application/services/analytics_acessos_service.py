from src.infrastructure.repositories.sql_analytics_acessos_repository import AnalyticsAcessosRepository
from datetime import date, datetime
import unicodedata


class AnalyticsAcessosError(Exception):
    def __init__(self, mensagem: str, status: int = 400):
        super().__init__(mensagem)
        self.status = status

class AnalyticsAcessosService:
    def __init__(self, repository=None):
        self.repository = repository or AnalyticsAcessosRepository()

    def executar(self,centro_custo: str):
        resultado = self.repository.buscar(centro_custo)

        if not resultado:
            return {"mensagem":"Dados de acessos recuperados com sucesso","data":[]}

        data_formatada = []

        for r in resultado:
            data_formatada.append({
                "nome":r["nome"],
                "supervisor":r["supervisor"],
                "total_acessos":r["total_acessos"],
                "ultimo_acesso":r["ultimo_acesso"],
                "total_operadores_supervisor":r["total_operadores_supervisor"]
            })

        return {
            "mensagem":"Dados de acessos recuperados com sucesso",
            "data":data_formatada
        }

    def executar_para_usuario(self, cpf: str, centro_custo: str):
        usuario = self.repository.obter_usuario(str(cpf))
        if not usuario:
            raise AnalyticsAcessosError("Usuario nao encontrado ou inativo.", 403)
        if self._normalizar(usuario.get("centro_custo")) != self._normalizar(
            centro_custo
        ):
            raise AnalyticsAcessosError(
                "Voce nao pode consultar os acessos de outro centro de custo.",
                403,
            )
        return self.executar(centro_custo)

    @staticmethod
    def _normalizar(valor):
        texto = unicodedata.normalize("NFD", str(valor or ""))
        return "".join(
            caractere for caractere in texto
            if unicodedata.category(caractere) != "Mn"
        ).strip().upper()

    @staticmethod
    def _iso(valor):
        if isinstance(valor, (date, datetime)):
            return valor.isoformat()
        return valor

    def executar_uso_consultar_contrato(self, cpf: str, periodo_dias=30):
        usuario = self.repository.obter_usuario(str(cpf))
        if not usuario:
            raise AnalyticsAcessosError("Usuario nao encontrado ou inativo.", 403)

        if "DESENVOLVIMENTO" not in self._normalizar(
            usuario.get("centro_custo")
        ):
            raise AnalyticsAcessosError(
                "Esta analise esta disponivel somente para DESENVOLVIMENTO.",
                403,
            )

        try:
            periodo = int(periodo_dias)
        except (TypeError, ValueError):
            raise AnalyticsAcessosError("Periodo invalido.")
        if periodo not in {0, 1, 7, 30, 90, 180, 365}:
            raise AnalyticsAcessosError("Periodo invalido.")

        dados = self.repository.buscar_uso_consultar_contrato(periodo)
        resumo_bruto = dados.get("resumo") or {}
        total = int(resumo_bruto.get("total_consultas") or 0)
        resolvidas = int(resumo_bruto.get("resolvidas") or 0)

        def inteiro(row, campo):
            return int(row.get(campo) or 0)

        operadores = [
            {
                "cpf": row.get("cpf"),
                "nome": row.get("nome"),
                "supervisor": row.get("supervisor"),
                "total_consultas": inteiro(row, "total_consultas"),
                "resolvidas": inteiro(row, "resolvidas"),
                "falhas": inteiro(row, "falhas"),
                "ultima_consulta": self._iso(row.get("ultima_consulta")),
            }
            for row in dados.get("operadores") or []
        ]
        supervisores = [
            {
                "nome": row.get("nome"),
                "total_consultas": inteiro(row, "total_consultas"),
                "operadores": inteiro(row, "operadores"),
                "resolvidas": inteiro(row, "resolvidas"),
                "ultima_consulta": self._iso(row.get("ultima_consulta")),
            }
            for row in dados.get("supervisores") or []
        ]

        return {
            "ferramenta": "@ConsultarContrato",
            "periodo_dias": periodo,
            "resumo": {
                "total_consultas": total,
                "operadores_ativos": inteiro(resumo_bruto, "operadores_ativos"),
                "supervisores_ativos": inteiro(resumo_bruto, "supervisores_ativos"),
                "resolvidas": resolvidas,
                "falhas": inteiro(resumo_bruto, "falhas"),
                "taxa_resolucao": round((resolvidas / total * 100), 1) if total else 0,
                "primeira_consulta": self._iso(resumo_bruto.get("primeira_consulta")),
                "ultima_consulta": self._iso(resumo_bruto.get("ultima_consulta")),
                "operador_lider": operadores[0] if operadores else None,
                "supervisor_lider": supervisores[0] if supervisores else None,
            },
            "operadores": operadores,
            "supervisores": supervisores,
            "status": [
                {"status": row.get("status"), "total": inteiro(row, "total")}
                for row in dados.get("status") or []
            ],
            "evolucao": [
                {
                    "data": self._iso(row.get("data")),
                    "total_consultas": inteiro(row, "total_consultas"),
                    "operadores": inteiro(row, "operadores"),
                }
                for row in dados.get("evolucao") or []
            ],
            "consultas_recentes": [
                {
                    **row,
                    "criada_em": self._iso(row.get("criada_em")),
                    "data_pagamento": self._iso(row.get("data_pagamento")),
                    "possui_resultado": bool(row.get("possui_resultado")),
                }
                for row in dados.get("recentes") or []
            ],
        }
