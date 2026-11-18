"""Regras de leitura dos Resultados Operacionais.

O que originou cada teste esta na docstring dele. Em resumo, tres medicoes
feitas no banco antes de escrever a tela mudaram o desenho:

  - so 116 de 1.260 colaboradores tem meta cadastrada, entao "sem meta" tem de
    ser diferente de "0% de atingimento";
  - INFORMACAO_PAGAMENTOS e janela rolante, entao ha periodos sem vega em que
    zero significa "nao da para saber", nao "nao entrou nada";
  - IS_LOGADO nunca volta a zero sozinho, entao presenca precisa de janela de
    inatividade.
"""
import unittest
from datetime import date, datetime, timedelta

from src.application.services.gestao_resultado_service import (
    GestaoResultadoError,
    GestaoResultadoService,
)


class ResultadoRepositoryFake:
    def __init__(self, **kwargs):
        self.resumo = kwargs.get("resumo") or {}
        self.operadores = kwargs.get("operadores") or []
        self.serie = kwargs.get("serie") or []
        self.presenca = kwargs.get("presenca") or []
        self.cobertura = kwargs.get("cobertura") or {
            "QT_OPERADORES": 1260,
            "QT_COM_META": 116,
        }
        self.frescor = kwargs.get("frescor")
        self.chamadas = []

    def obter_resumo(self, *, data_inicio, data_fim, id_carteira=None):
        self.chamadas.append(("resumo", data_inicio, data_fim, id_carteira))
        return dict(self.resumo)

    def contar_cobertura_meta(self, *, data_inicio, data_fim):
        return dict(self.cobertura)

    def listar_ranking_operadores(self, **kwargs):
        self.chamadas.append(("ranking", kwargs))
        return list(self.operadores)

    def listar_serie_mensal(self, **kwargs):
        return list(self.serie)

    def listar_carteiras(self, **kwargs):
        return []

    def obter_ficha_operador(self, **kwargs):
        return {"agregado": {}, "serie": [], "carteiras": []}

    def listar_presenca(self):
        return list(self.presenca)

    def listar_filtros(self):
        return {"carteiras": [], "supervisores": []}

    def obter_frescor(self):
        return self.frescor


def _servico(**kwargs):
    repo = ResultadoRepositoryFake(**kwargs)
    return GestaoResultadoService(repo=repo), repo


class PeriodoTest(unittest.TestCase):
    def test_sem_filtro_usa_o_mes_corrente(self):
        servico, repo = _servico(resumo={"VL_FECHADO": 100})

        servico.obter_resumo({})

        _, inicio, fim, _ = repo.chamadas[0]
        hoje = date.today()
        self.assertEqual(inicio, date(hoje.year, hoje.month, 1))
        self.assertEqual(fim, hoje)

    def test_compara_com_periodo_anterior_do_mesmo_tamanho(self):
        """A faixa de KPI diz "subiu" ou "caiu"; sem base, so o numero solto."""
        servico, repo = _servico(resumo={"VL_FECHADO": 100})

        servico.obter_resumo({"data_inicio": "2026-08-08", "data_fim": "2026-08-10"})

        atual = repo.chamadas[0]
        anterior = [c for c in repo.chamadas if c[0] == "resumo"][1]
        self.assertEqual(atual[1], date(2026, 8, 8))
        self.assertEqual(anterior[1], date(2026, 8, 5))
        self.assertEqual(anterior[2], date(2026, 8, 7))

    def test_data_invertida_e_recusada(self):
        servico, _ = _servico()

        with self.assertRaises(GestaoResultadoError) as caso:
            servico.obter_resumo({"data_inicio": "2026-08-10", "data_fim": "2026-08-01"})

        self.assertEqual(caso.exception.status, 400)

    def test_data_malformada_e_recusada(self):
        servico, _ = _servico()

        with self.assertRaises(GestaoResultadoError) as caso:
            servico.obter_resumo({"data_inicio": "10/08/2026"})

        self.assertEqual(caso.exception.status, 400)

    def test_periodo_absurdo_e_recusado(self):
        """O endpoint antigo nao tinha limite -- e nem parametro."""
        servico, _ = _servico()

        with self.assertRaises(GestaoResultadoError) as caso:
            servico.obter_resumo({"data_inicio": "2020-01-01", "data_fim": "2026-08-01"})

        self.assertEqual(caso.exception.status, 400)


class MetaTest(unittest.TestCase):
    """Sem meta cadastrada nao e atingimento zero.

    Medido: 116 de 1.260 colaboradores tem meta valida em IDEAL_OPERADOR (a
    coluna e varchar(max) e esta nula em 1.167 das 1.287 linhas). O painel
    antigo mostra 0% para o resto, culpando o operador por uma lacuna de
    cadastro.
    """

    def _operador(self, **campos):
        base = {
            "CHAVE_OPERADOR": "111", "CPF_COLABORADOR": "111",
            "NM_OPERADOR": "FULANO", "NM_SUPERVISOR": "BELTRANO",
            "NM_CARTEIRA": "Mu", "POSICAO": 1, "QT_TOTAL": 1,
            "VL_FECHADO": 1000, "VL_RECUPERADO": 500, "QT_ACORDOS": 3,
            "QT_CPC": 10, "QT_DIAS": 5, "VL_META": None,
            "VL_NOTA_QUALIDADE": None,
        }
        base.update(campos)
        return base

    def test_sem_meta_devolve_atingimento_nulo(self):
        servico, _ = _servico(operadores=[self._operador(VL_META=None)])

        operador = servico.listar_operadores({})["operadores"][0]

        self.assertIsNone(operador["meta"])
        self.assertIsNone(operador["atingimento"])

    def test_meta_zero_tambem_conta_como_sem_meta(self):
        """Meta zerada no cadastro nao e meta batida por definicao."""
        servico, _ = _servico(operadores=[self._operador(VL_META=0)])

        operador = servico.listar_operadores({})["operadores"][0]

        self.assertIsNone(operador["atingimento"])

    def test_com_meta_calcula_atingimento(self):
        servico, _ = _servico(
            operadores=[self._operador(VL_META=1000, VL_RECUPERADO=750)]
        )

        operador = servico.listar_operadores({})["operadores"][0]

        self.assertEqual(operador["atingimento"], 75.0)

    def test_resumo_expoe_a_cobertura_da_meta(self):
        """A tela mostra a lacuna em vez de esconde-la atras de zeros."""
        servico, _ = _servico(resumo={"VL_FECHADO": 10})

        resumo = servico.obter_resumo({})

        self.assertEqual(resumo["cobertura_meta"], {"operadores": 1260, "com_meta": 116})


class VegaTest(unittest.TestCase):
    def test_periodo_sem_vega_e_sinalizado(self):
        """INFORMACAO_PAGAMENTOS e janela rolante: fora dela, zero nao e zero.

        Medido: em 2026-07 ela guarda 1.015 linhas onde TB_PARCELAS guarda
        90.598. O grafico do painel antigo desenha por isso uma queda de 99%
        que nunca aconteceu.
        """
        servico, _ = _servico(resumo={"VL_FECHADO": 100, "TEM_VEGA": 0})

        self.assertFalse(servico.obter_resumo({})["tem_vega"])

    def test_evolucao_marca_onde_o_vega_comeca(self):
        servico, _ = _servico(serie=[
            {"MES_CHAVE": "2026-05", "VL_FECHADO": 10, "VL_RECUPERADO": 0, "TEM_VEGA": 0},
            {"MES_CHAVE": "2026-06", "VL_FECHADO": 20, "VL_RECUPERADO": 5, "TEM_VEGA": 1},
            {"MES_CHAVE": "2026-07", "VL_FECHADO": 30, "VL_RECUPERADO": 8, "TEM_VEGA": 1},
        ])

        evolucao = servico.listar_evolucao({"meses": 3})

        self.assertEqual(evolucao["vega_comeca_em"], "2026-06")
        self.assertFalse(evolucao["serie"][0]["tem_vega"])

    def test_evolucao_sem_vega_nenhum_nao_inventa_inicio(self):
        servico, _ = _servico(serie=[
            {"MES_CHAVE": "2026-05", "VL_FECHADO": 10, "VL_RECUPERADO": 0, "TEM_VEGA": 0},
        ])

        self.assertIsNone(servico.listar_evolucao({})["vega_comeca_em"])


class PresencaTest(unittest.TestCase):
    """IS_LOGADO vira 1 no login e so volta a 0 no logout explicito.

    Quem fecha o navegador fica "online" para sempre, e o contador de
    operadores online do painel antigo e inflado por isso. A janela de
    inatividade mora no servico para ser afinada sem migracao.
    """

    def _operador(self):
        return {
            "CHAVE_OPERADOR": "111", "CPF_COLABORADOR": "111",
            "NM_OPERADOR": "FULANO", "NM_SUPERVISOR": "", "NM_CARTEIRA": "X",
            "POSICAO": 1, "QT_TOTAL": 1, "VL_FECHADO": 0, "VL_RECUPERADO": 0,
            "QT_ACORDOS": 0, "QT_CPC": 0, "QT_DIAS": 0, "VL_META": None,
            "VL_NOTA_QUALIDADE": None,
        }

    def test_acesso_recente_e_online(self):
        servico, _ = _servico(
            operadores=[self._operador()],
            presenca=[{
                "CPF_COLABORADOR": "111", "IS_LOGADO": 1,
                "DT_ULTIMO_ACESSO": datetime.now() - timedelta(minutes=2),
            }],
        )

        self.assertEqual(servico.listar_operadores({})["operadores"][0]["status"], "online")

    def test_logado_ha_horas_e_ausente_e_nao_online(self):
        servico, _ = _servico(
            operadores=[self._operador()],
            presenca=[{
                "CPF_COLABORADOR": "111", "IS_LOGADO": 1,
                "DT_ULTIMO_ACESSO": datetime.now() - timedelta(hours=6),
            }],
        )

        self.assertEqual(servico.listar_operadores({})["operadores"][0]["status"], "ausente")

    def test_quem_nao_esta_na_lista_e_offline(self):
        servico, _ = _servico(operadores=[self._operador()], presenca=[])

        self.assertEqual(servico.listar_operadores({})["operadores"][0]["status"], "offline")


class RankingTest(unittest.TestCase):
    def test_ordenacao_desconhecida_e_recusada(self):
        """A coluna entra no ORDER BY: aceitar texto livre seria injecao."""
        servico, _ = _servico()

        with self.assertRaises(GestaoResultadoError) as caso:
            servico.listar_operadores({"ordenar_por": "VL_FECHADO; DROP TABLE X"})

        self.assertEqual(caso.exception.status, 400)

    def test_tamanho_de_pagina_tem_teto(self):
        """Sem teto, uma pagina de 100 mil traria a empresa inteira de novo."""
        servico, repo = _servico()

        servico.listar_operadores({"tamanho": "99999"})

        self.assertEqual(repo.chamadas[0][1]["limite"], 200)

    def test_pagina_vira_offset(self):
        servico, repo = _servico()

        servico.listar_operadores({"pagina": "3", "tamanho": "25"})

        self.assertEqual(repo.chamadas[0][1]["offset"], 50)

    def test_pagina_invalida_cai_para_a_primeira(self):
        servico, repo = _servico()

        servico.listar_operadores({"pagina": "abc"})

        self.assertEqual(repo.chamadas[0][1]["offset"], 0)


class FrescorTest(unittest.TestCase):
    def test_usa_a_execucao_do_worker_e_nao_o_relogio(self):
        """gerente_service.py carimba datetime.now() e faz um dado de 40
        minutos atras parecer do segundo atual."""
        servico, _ = _servico(
            resumo={"VL_FECHADO": 1},
            frescor={"DT_FIM": datetime(2026, 8, 12, 8, 30), "TIPO_CARGA": "INTRADIA"},
        )

        atualizado = servico.obter_resumo({})["atualizado_em"]

        self.assertEqual(atualizado["em"], "2026-08-12T08:30:00")
        self.assertEqual(atualizado["tipo"], "INTRADIA")

    def test_sem_carga_concluida_nao_inventa_horario(self):
        servico, _ = _servico(resumo={"VL_FECHADO": 1}, frescor=None)

        self.assertIsNone(servico.obter_resumo({})["atualizado_em"])


if __name__ == "__main__":
    unittest.main()
