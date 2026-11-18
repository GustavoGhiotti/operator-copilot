import unittest

from src.infrastructure.repositories.sql_copilot_feedback_repository import (
    CopilotFeedbackRepository,
)
from src.infrastructure.repositories.sql_copilot_tour_repository import (
    CopilotTourRepository,
)


class DatabaseFake:
    def __init__(self, resultado):
        self.resultado = resultado
        self.chamadas = []

    def execute_fetch(self, *, query, parametros, one=False):
        self.chamadas.append({
            "query": query,
            "parametros": parametros,
            "one": one,
        })
        return self.resultado


class TransactionFake:
    def __init__(self, falhar=False):
        self.falhar = falhar
        self.confirmada = False
        self.revertida = False
        self.fechada = False

    def execute_commit(self, *, query, parametros):
        if self.falhar:
            raise RuntimeError("falha de escrita")
        return 1

    def commit(self):
        self.confirmada = True

    def rollback(self):
        self.revertida = True

    def close(self):
        self.fechada = True


class TransactionDatabaseFake:
    def __init__(self, falhar=False):
        self.transacao = TransactionFake(falhar=falhar)

    def begin_transaction(self):
        return self.transacao


class CopilotRepositoriesTest(unittest.TestCase):
    @staticmethod
    def _repo(classe, banco):
        repo = classe.__new__(classe)
        repo.db = banco
        repo._tem_estrutura = None
        return repo

    def test_feedback_consulta_schema_com_parametros_vazios(self):
        banco = DatabaseFake({"disponivel": 1})
        repo = self._repo(CopilotFeedbackRepository, banco)

        self.assertTrue(repo.estrutura_disponivel())
        self.assertEqual(banco.chamadas[0]["parametros"], ())
        self.assertTrue(banco.chamadas[0]["one"])

    def test_feedback_confirma_transacao_quando_escrita_funciona(self):
        banco = TransactionDatabaseFake()
        repo = self._repo(CopilotFeedbackRepository, banco)

        repo.salvar_feedback(
            "123", "copilot-2.0", 5, "Gostei",
            "Maria", "Operacao", "Operadora",
        )

        self.assertTrue(banco.transacao.confirmada)
        self.assertFalse(banco.transacao.revertida)
        self.assertTrue(banco.transacao.fechada)

    def test_feedback_propaga_falha_e_reverte_transacao(self):
        banco = TransactionDatabaseFake(falhar=True)
        repo = self._repo(CopilotFeedbackRepository, banco)

        with self.assertRaisesRegex(RuntimeError, "falha de escrita"):
            repo.salvar_feedback(
                "123", "copilot-2.0", 5, "Gostei",
                "Maria", "Operacao", "Operadora",
            )

        self.assertFalse(banco.transacao.confirmada)
        self.assertTrue(banco.transacao.revertida)
        self.assertTrue(banco.transacao.fechada)

    def test_tour_consulta_schema_com_parametros_vazios(self):
        banco = DatabaseFake({"disponivel": 1})
        repo = self._repo(CopilotTourRepository, banco)

        self.assertTrue(repo.estrutura_disponivel())
        self.assertEqual(banco.chamadas[0]["parametros"], ())
        self.assertTrue(banco.chamadas[0]["one"])


if __name__ == "__main__":
    unittest.main()
