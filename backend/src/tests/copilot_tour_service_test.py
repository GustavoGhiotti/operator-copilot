import unittest

from src.application.services.copilot_tour_service import CopilotTourService


class TourRepositoryFake:
    def __init__(self, tem_estrutura=True, registro=None):
        self.tem_estrutura = tem_estrutura
        self.registro = registro
        self.gravados = []
        self.removidos = []

    def estrutura_disponivel(self):
        return self.tem_estrutura

    def obter_conclusao(self, cpf, versao):
        return self.registro

    def registrar_conclusao(self, cpf, versao, concluido):
        self.gravados.append((cpf, versao, concluido))

    def remover_conclusao(self, cpf, versao):
        self.removidos.append((cpf, versao))


class CopilotTourServiceTest(unittest.TestCase):
    def _servico(self, **kwargs):
        repo = TourRepositoryFake(**kwargs)
        return CopilotTourService(repo=repo), repo

    def test_primeiro_acesso_exibe_o_tour(self):
        servico, _ = self._servico()

        resultado = servico.consultar("123")

        self.assertTrue(resultado["deve_exibir"])
        self.assertFalse(resultado["visto"])

    def test_quem_concluiu_nao_ve_de_novo(self):
        servico, _ = self._servico(registro={"CONCLUIDO": True})

        resultado = servico.consultar("123")

        self.assertFalse(resultado["deve_exibir"])
        self.assertTrue(resultado["visto"])
        self.assertTrue(resultado["concluido"])

    def test_quem_pulou_tambem_nao_ve_de_novo(self):
        """Pular é uma resposta: insistir no próximo login vira perseguição."""
        servico, _ = self._servico(registro={"CONCLUIDO": False})

        resultado = servico.consultar("123")

        self.assertFalse(resultado["deve_exibir"])
        self.assertTrue(resultado["visto"])
        self.assertFalse(resultado["concluido"])

    def test_sem_tabela_nao_exibe(self):
        """Sem onde gravar, o tour voltaria a cada carregamento da home."""
        servico, _ = self._servico(tem_estrutura=False)

        resultado = servico.consultar("123")

        self.assertFalse(resultado["deve_exibir"])
        self.assertFalse(resultado["disponivel"])

    def test_registra_conclusao(self):
        servico, repo = self._servico()

        resultado = servico.registrar("123", {"concluido": True})

        self.assertTrue(resultado["registrado"])
        self.assertEqual(repo.gravados, [("123", "copilot-2.0", True)])

    def test_registra_desistencia(self):
        servico, repo = self._servico()

        servico.registrar("123", {"concluido": False})

        self.assertEqual(repo.gravados, [("123", "copilot-2.0", False)])

    def test_registro_sem_corpo_conta_como_desistencia(self):
        servico, repo = self._servico()

        servico.registrar("123", None)

        self.assertEqual(repo.gravados[0][2], False)

    def test_registro_sem_tabela_avisa(self):
        servico, repo = self._servico(tem_estrutura=False)

        resultado = servico.registrar("123", {"concluido": True})

        self.assertFalse(resultado["registrado"])
        self.assertEqual(repo.gravados, [])

    def test_reiniciar_apaga_a_marca(self):
        servico, repo = self._servico(registro={"CONCLUIDO": True})

        resultado = servico.reiniciar("123")

        self.assertTrue(resultado["reiniciado"])
        self.assertEqual(repo.removidos, [("123", "copilot-2.0")])

    def test_reiniciar_sem_tabela_avisa(self):
        servico, repo = self._servico(tem_estrutura=False)

        resultado = servico.reiniciar("123")

        self.assertFalse(resultado["reiniciado"])
        self.assertEqual(repo.removidos, [])


if __name__ == "__main__":
    unittest.main()
