import unittest
from datetime import date, datetime

from src.application.services.analytics_acessos_service import (
    AnalyticsAcessosError,
    AnalyticsAcessosService,
)


class AnalyticsRepositoryFake:
    def __init__(self, centro_custo="DESENVOLVIMENTO"):
        self.centro_custo = centro_custo
        self.periodo_recebido = None

    def obter_usuario(self, cpf):
        return {
            "cpf": cpf,
            "nome": "Pessoa Desenvolvedora",
            "centro_custo": self.centro_custo,
        }

    def buscar_uso_consultar_contrato(self, periodo):
        self.periodo_recebido = periodo
        return {
            "resumo": {
                "total_consultas": 10,
                "operadores_ativos": 2,
                "supervisores_ativos": 1,
                "resolvidas": 8,
                "falhas": 1,
                "primeira_consulta": datetime(2026, 8, 1, 9, 0),
                "ultima_consulta": datetime(2026, 8, 16, 18, 0),
            },
            "operadores": [
                {
                    "cpf": "123",
                    "nome": "Operador Lider",
                    "supervisor": "Supervisora A",
                    "total_consultas": 7,
                    "resolvidas": 6,
                    "falhas": 1,
                    "ultima_consulta": datetime(2026, 8, 16, 18, 0),
                }
            ],
            "supervisores": [
                {
                    "nome": "Supervisora A",
                    "total_consultas": 10,
                    "operadores": 2,
                    "resolvidas": 8,
                    "ultima_consulta": datetime(2026, 8, 16, 18, 0),
                }
            ],
            "status": [{"status": "resolvido", "total": 8}],
            "evolucao": [
                {"data": date(2026, 8, 16), "total_consultas": 3, "operadores": 2}
            ],
            "recentes": [
                {
                    "status": "resolvido",
                    "contrato": "123456",
                    "data_pagamento": date(2026, 8, 20),
                    "criada_em": datetime(2026, 8, 16, 18, 0),
                    "cpf": "123",
                    "operador": "Operador Lider",
                    "supervisor": "Supervisora A",
                    "possui_resultado": 1,
                }
            ],
        }


class AnalyticsAcessosServiceTest(unittest.TestCase):
    def test_consolida_uso_para_desenvolvimento(self):
        repository = AnalyticsRepositoryFake()
        service = AnalyticsAcessosService(repository)

        resultado = service.executar_uso_consultar_contrato("999", "30")

        self.assertEqual(repository.periodo_recebido, 30)
        self.assertEqual(resultado["ferramenta"], "@ConsultarContrato")
        self.assertEqual(resultado["resumo"]["taxa_resolucao"], 80.0)
        self.assertEqual(
            resultado["resumo"]["operador_lider"]["nome"],
            "Operador Lider",
        )
        self.assertEqual(resultado["evolucao"][0]["data"], "2026-08-16")
        self.assertTrue(resultado["consultas_recentes"][0]["possui_resultado"])

    def test_aceita_variacao_do_centro_de_custo_desenvolvimento(self):
        repository = AnalyticsRepositoryFake("PROJETO - DESENVOLVIMENTO")
        service = AnalyticsAcessosService(repository)

        resultado = service.executar_uso_consultar_contrato("999", "7")

        self.assertEqual(resultado["periodo_dias"], 7)

    def test_aceita_periodo_de_hoje(self):
        repository = AnalyticsRepositoryFake()
        service = AnalyticsAcessosService(repository)

        resultado = service.executar_uso_consultar_contrato("999", "1")

        self.assertEqual(repository.periodo_recebido, 1)
        self.assertEqual(resultado["periodo_dias"], 1)

    def test_recusa_usuario_de_outro_centro_de_custo(self):
        service = AnalyticsAcessosService(AnalyticsRepositoryFake("VEGA"))

        with self.assertRaises(AnalyticsAcessosError) as contexto:
            service.executar_uso_consultar_contrato("999", "30")

        self.assertEqual(contexto.exception.status, 403)

    def test_acessos_legados_nao_aceitam_outro_centro_de_custo(self):
        service = AnalyticsAcessosService(AnalyticsRepositoryFake("VEGA"))

        with self.assertRaises(AnalyticsAcessosError) as contexto:
            service.executar_para_usuario("999", "DELTA")

        self.assertEqual(contexto.exception.status, 403)

    def test_recusa_periodo_fora_da_lista(self):
        service = AnalyticsAcessosService(AnalyticsRepositoryFake())

        with self.assertRaises(AnalyticsAcessosError):
            service.executar_uso_consultar_contrato("999", "31")


if __name__ == "__main__":
    unittest.main()
