"""Quem enxerga o observatorio da Arena e quem pode assumir uma partida.

A guarda e por centro de custo e mora no servidor: este observatorio expoe a
cartela e o desempenho de qualquer operador da empresa.
"""
import unittest

from src.application.services.arena_service import (
    ArenaServiceError,
    ArenaSupervisorService,
)


class ObservatorioRepositoryFake:
    def __init__(self, centro="DESENVOLVIMENTO", dono_atual="999"):
        self.centro = centro
        self.dono_atual = dono_atual
        self.assumidas = []
        self.flags = []

    def obter_usuario(self, cpf):
        return {
            "cpf": cpf,
            "nome": "CARLOS ANDRADE",
            "funcao": "ANALISTA DE DESENVOLVIMENTO PL",
            "centro_custo": self.centro,
        }

    def listar_sessoes_ativas(self):
        return [{
            "id": 77,
            "id_campanha": 42,
            "status": "EM_ANDAMENTO",
            "titulo": "Bingo da Vega",
            "tipo_jogo": "BINGO",
            "na_sala": 8,
            "convidados": 12,
            "total_sorteios": 21,
        }]

    def listar_cartelas_sessao(self, id_sessao):
        return [{"id_cartela": 1, "nome": "Joao", "casas": []}]

    # --- leituras de estado: registram o flag recebido ------------------
    def obter_acesso_sessao(self, id_sessao, cpf, observador=False):
        self.flags.append(("acesso", observador))
        return {
            "id": id_sessao, "id_campanha": 42, "status": "EM_ANDAMENTO",
            "cpf_criador": "999", "id_participante": None,
            "status_participante": None, "pode_iniciar": 0,
            "supervisor": 0, "observador": 1,
        }

    def fechar_janela_bingo(self, id_sessao, janela_segundos=3):
        return {"fechada": False, "empatados": 0}

    def obter_estado_bingo(self, id_sessao, cpf, observador=False):
        self.flags.append(("bingo", observador))
        return {
            "id_sessao": id_sessao, "id_campanha": 42, "titulo": "Bingo",
            "status_sessao": "EM_ANDAMENTO", "papel": "OPERADOR",
            "padrao_vitoria": "LINHA", "sorteios": [], "cartela": [],
            "vitorias": [], "progresso": [],
        }

    def assumir_controle(self, id_sessao, cpf, nome):
        if str(self.dono_atual) == str(cpf):
            raise ValueError("JA_E_O_DONO")
        self.assumidas.append((id_sessao, cpf))
        return {"id_campanha": 42, "supervisor_anterior": "Rebeca"}


class ObservatorioTest(unittest.TestCase):
    def _servico(self, **kwargs):
        servico = ArenaSupervisorService()
        servico.repo = ObservatorioRepositoryFake(**kwargs)
        return servico, servico.repo

    # --- quem entra ----------------------------------------------------
    def test_desenvolvimento_ve_o_observatorio(self):
        servico, _ = self._servico(centro="DESENVOLVIMENTO")

        resultado = servico.listar_observatorio("123")

        self.assertEqual(len(resultado["sessoes"]), 1)
        self.assertTrue(resultado["pode_assumir"])

    def test_gerencia_ve_mas_nao_assume(self):
        """Alcance e controle sao eixos diferentes: Gerência só acompanha."""
        servico, _ = self._servico(centro="GERENCIA OPERACIONAL")

        resultado = servico.listar_observatorio("123")

        self.assertEqual(len(resultado["sessoes"]), 1)
        self.assertFalse(resultado["pode_assumir"])

    def test_operacao_nao_entra(self):
        servico, _ = self._servico(centro="COBRANCA GAMA")

        with self.assertRaises(ArenaServiceError) as caso:
            servico.listar_observatorio("123")

        self.assertEqual(caso.exception.status, 403)

    def test_qualidade_nao_entra(self):
        """Qualidade ficou de fora de propósito — só Dev e Gerência."""
        servico, _ = self._servico(centro="QUALIDADE")

        with self.assertRaises(ArenaServiceError) as caso:
            servico.listar_observatorio("123")

        self.assertEqual(caso.exception.status, 403)

    def test_centro_com_acento_e_reconhecido(self):
        """`_normalizar` tira acento: 'GERÊNCIA' precisa casar."""
        servico, _ = self._servico(centro="Gerência Operacional")

        resultado = servico.listar_observatorio("123")

        self.assertEqual(len(resultado["sessoes"]), 1)

    # --- cartelas ------------------------------------------------------
    def test_lista_cartelas_de_todos(self):
        servico, _ = self._servico()

        resultado = servico.listar_cartelas_observatorio("123", 77)

        self.assertEqual(resultado["id_sessao"], 77)
        self.assertEqual(len(resultado["cartelas"]), 1)

    def test_operacao_nao_ve_cartelas(self):
        servico, _ = self._servico(centro="COBRANCA GAMA")

        with self.assertRaises(ArenaServiceError) as caso:
            servico.listar_cartelas_observatorio("123", 77)

        self.assertEqual(caso.exception.status, 403)

    # --- leitura do jogo -----------------------------------------------
    def test_observador_le_o_estado_do_bingo(self):
        """Regressão: `obter_estado_bingo` tem filtro de acesso PRÓPRIO.

        Corrigir só o `obter_acesso_sessao` não bastava — o observador passava
        no portão e tomava 404 na leitura seguinte.
        """
        servico, repo = self._servico(centro="DESENVOLVIMENTO")

        servico.obter_estado_bingo("123", 77)

        self.assertIn(("bingo", True), repo.flags)
        self.assertIn(("acesso", True), repo.flags)

    def test_operador_le_o_estado_sem_flag_de_observador(self):
        servico, repo = self._servico(centro="COBRANCA GAMA")

        servico.obter_estado_bingo("123", 77)

        self.assertIn(("bingo", False), repo.flags)

    # --- assumir controle ----------------------------------------------
    def test_desenvolvimento_assume_a_partida(self):
        servico, repo = self._servico(centro="DESENVOLVIMENTO")

        resultado = servico.assumir_controle("123", 77)

        self.assertTrue(resultado["assumido"])
        self.assertEqual(resultado["supervisor_anterior"], "Rebeca")
        self.assertEqual(repo.assumidas, [(77, "123")])

    def test_gerencia_nao_assume(self):
        servico, repo = self._servico(centro="GERENCIA OPERACIONAL")

        with self.assertRaises(ArenaServiceError) as caso:
            servico.assumir_controle("123", 77)

        self.assertEqual(caso.exception.status, 403)
        self.assertEqual(repo.assumidas, [])

    def test_operacao_nao_assume(self):
        servico, repo = self._servico(centro="COBRANCA GAMA")

        with self.assertRaises(ArenaServiceError) as caso:
            servico.assumir_controle("123", 77)

        self.assertEqual(caso.exception.status, 403)
        self.assertEqual(repo.assumidas, [])

    def test_recusa_assumir_o_que_ja_e_seu(self):
        servico, repo = self._servico(dono_atual="123")

        with self.assertRaises(ArenaServiceError) as caso:
            servico.assumir_controle("123", 77)

        self.assertEqual(caso.exception.status, 409)
        self.assertEqual(repo.assumidas, [])


if __name__ == "__main__":
    unittest.main()
