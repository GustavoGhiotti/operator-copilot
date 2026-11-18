import unittest

from src.application.services.copilot_feedback_service import (
    CopilotFeedbackError,
    CopilotFeedbackService,
)


class FeedbackRepositoryFake:
    def __init__(self, tem_estrutura=True, registro=None):
        self.tem_estrutura = tem_estrutura
        self.registro = registro
        self.salvos = []

    def estrutura_disponivel(self):
        return self.tem_estrutura

    def obter_usuario(self, cpf):
        return {
            "CPF": cpf,
            "NOME": "MARIA DA SILVA",
            "FUNCAO": "OPERADOR(A) COBRADOR(A)       ",
            "CENTRO_CUSTO": "COBRANCA GAMA",
        }

    def obter_feedback(self, cpf, versao):
        return self.registro

    def salvar_feedback(self, *args):
        self.salvos.append(args)


class CopilotFeedbackServiceTest(unittest.TestCase):
    def _servico(self, **kwargs):
        repo = FeedbackRepositoryFake(**kwargs)
        return CopilotFeedbackService(repo=repo), repo

    def test_registra_comentario_com_snapshot_do_colaborador(self):
        servico, repo = self._servico()

        resultado = servico.registrar("123", {
            "nota": 5,
            "comentario": "Ficou muito melhor de usar.",
        })

        self.assertTrue(resultado["registrado"])
        self.assertEqual(len(repo.salvos), 1)
        (cpf, versao, nota, comentario, nome,
         centro, funcao) = repo.salvos[0]
        self.assertEqual(cpf, "123")
        self.assertEqual(versao, "copilot-2.0")
        self.assertEqual(nota, 5)
        self.assertEqual(comentario, "Ficou muito melhor de usar.")
        self.assertEqual(nome, "MARIA DA SILVA")
        self.assertEqual(centro, "COBRANCA GAMA")
        self.assertIn("OPERADOR", funcao)

    def test_aceita_so_comentario_sem_nota(self):
        servico, repo = self._servico()

        resultado = servico.registrar("123", {"comentario": "Gostei da Aurora"})

        self.assertTrue(resultado["registrado"])
        self.assertIsNone(repo.salvos[0][2])

    def test_aceita_so_nota_sem_comentario(self):
        servico, repo = self._servico()

        resultado = servico.registrar("123", {"nota": 4})

        self.assertTrue(resultado["registrado"])
        self.assertIsNone(repo.salvos[0][3])

    def test_recusa_envio_totalmente_vazio(self):
        servico, repo = self._servico()

        with self.assertRaises(CopilotFeedbackError):
            servico.registrar("123", {"comentario": "   "})
        self.assertEqual(repo.salvos, [])

    def test_recusa_nota_fora_da_faixa(self):
        servico, _ = self._servico()

        with self.assertRaises(CopilotFeedbackError):
            servico.registrar("123", {"nota": 9})

    def test_recusa_nota_nao_numerica(self):
        servico, _ = self._servico()

        with self.assertRaises(CopilotFeedbackError):
            servico.registrar("123", {"nota": "otimo"})

    def test_recusa_comentario_acima_do_limite(self):
        servico, repo = self._servico()

        with self.assertRaises(CopilotFeedbackError):
            servico.registrar("123", {"comentario": "a" * 2001})
        self.assertEqual(repo.salvos, [])

    def test_aceita_comentario_exatamente_no_limite(self):
        servico, repo = self._servico()

        servico.registrar("123", {"comentario": "a" * 2000})

        self.assertEqual(len(repo.salvos[0][3]), 2000)

    def test_sem_tabela_avisa_em_vez_de_fingir_que_salvou(self):
        """O operador escreveu um texto — nao pode receber 'obrigado' a toa."""
        servico, repo = self._servico(tem_estrutura=False)

        resultado = servico.registrar("123", {"comentario": "Muito bom"})

        self.assertFalse(resultado["registrado"])
        self.assertEqual(resultado["motivo"], "estrutura_indisponivel")
        self.assertEqual(repo.salvos, [])

    def test_consulta_sem_tabela_nao_quebra(self):
        servico, _ = self._servico(tem_estrutura=False)

        self.assertEqual(
            servico.consultar("123"),
            {"disponivel": False, "respondido": False},
        )

    def test_consulta_sem_resposta_anterior(self):
        servico, _ = self._servico()

        self.assertEqual(
            servico.consultar("123"),
            {"disponivel": True, "respondido": False},
        )

    def test_consulta_devolve_resposta_anterior(self):
        servico, _ = self._servico(registro={
            "NOTA": 4,
            "COMENTARIO": "Achei bonito",
        })

        resultado = servico.consultar("123")

        self.assertTrue(resultado["respondido"])
        self.assertEqual(resultado["nota"], 4)
        self.assertEqual(resultado["comentario"], "Achei bonito")


if __name__ == "__main__":
    unittest.main()
