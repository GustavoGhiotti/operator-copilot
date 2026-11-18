import json
import unittest

from src.infrastructure.repositories.sql_crmweb_repository import CrmwebRepository


class TransactionFake:
    def __init__(self, existente=None, existentes=None, novo_id=99, lock_result=0):
        self.existente = existente
        self.existentes = list(existentes) if existentes is not None else None
        self.novo_id = novo_id
        self.lock_result = lock_result
        self.insercoes = 0
        self.parametros_insercoes = []
        self.confirmada = False
        self.revertida = False
        self.fechada = False
        self.consultas = []

    def execute_fetch(self, *, query, parametros, one=False):
        if "sp_getapplock" in query:
            return {"LOCK_RESULT": self.lock_result}
        self.consultas.append({"query": query, "parametros": parametros})
        if self.existentes is not None:
            return self.existentes.pop(0)
        return self.existente

    def execute_insert_returning(self, *, query, parametros):
        self.insercoes += 1
        self.parametros_insercoes.append(parametros)
        return {"ID_BUSCA": self.novo_id + self.insercoes - 1}

    def commit(self):
        self.confirmada = True

    def rollback(self):
        self.revertida = True

    def close(self):
        self.fechada = True


class DatabaseFake:
    def __init__(self, transacao, resultado_busca=None):
        self.transacao = transacao
        self.resultado_busca = resultado_busca

    def begin_transaction(self):
        return self.transacao

    def execute_fetch(self, *, query, parametros):
        return self.resultado_busca


class CrmwebRepositoryTest(unittest.TestCase):
    @staticmethod
    def _repo(transacao):
        repo = CrmwebRepository.__new__(CrmwebRepository)
        repo.db = DatabaseFake(transacao)
        return repo

    @staticmethod
    def _criar(repo):
        return repo.criar(
            "123456789012",
            "2026-08-13",
            "2026-08-13",
            310,
            "12345678901",
            0,
        )

    def test_reutiliza_pedido_recente_igual_sem_inserir_nova_linha(self):
        transacao = TransactionFake(existente={"ID_BUSCA": 42})

        resultado = self._criar(self._repo(transacao))

        self.assertEqual(resultado, 42)
        self.assertEqual(transacao.insercoes, 0)
        self.assertTrue(transacao.confirmada)
        self.assertFalse(transacao.revertida)
        self.assertTrue(transacao.fechada)

    def test_insere_quando_nao_existe_pedido_recente_igual(self):
        transacao = TransactionFake(novo_id=77)

        resultado = self._criar(self._repo(transacao))

        self.assertEqual(resultado, 77)
        self.assertEqual(transacao.insercoes, 1)
        self.assertTrue(transacao.confirmada)
        self.assertFalse(transacao.revertida)
        self.assertTrue(transacao.fechada)

    def test_reverte_quando_nao_consegue_adquirir_lock(self):
        transacao = TransactionFake(lock_result=-1)

        with self.assertRaisesRegex(RuntimeError, "reservar"):
            self._criar(self._repo(transacao))

        self.assertEqual(transacao.insercoes, 0)
        self.assertFalse(transacao.confirmada)
        self.assertTrue(transacao.revertida)
        self.assertTrue(transacao.fechada)

    def test_d9_insere_base_e_quatro_pedidos_de_segunda_classe(self):
        transacao = TransactionFake(novo_id=100)
        repo = self._repo(transacao)

        resultado = repo.criar_d9(
            "123456789012",
            "2026-08-13",
            310,
            "12345678901",
            0,
            {
                "base": "2026-08-13",
                "d2": "2026-08-15",
                "d4": "2026-08-17",
                "d6": "2026-08-19",
                "d9": "2026-08-22",
            },
        )

        self.assertEqual([item["id_busca"] for item in resultado], [100, 101, 102, 103, 104])
        self.assertEqual(transacao.insercoes, 5)
        self.assertEqual(
            [parametros[0] for parametros in transacao.parametros_insercoes],
            ["pendente1", "pendente2", "pendente2", "pendente2", "pendente2"],
        )
        self.assertTrue(transacao.confirmada)
        self.assertFalse(transacao.revertida)
        self.assertTrue(transacao.fechada)

    def test_d9_reutiliza_datas_ja_resolvidas_sem_criar_novos_pedidos(self):
        transacao = TransactionFake(
            existentes=[
                {"ID_BUSCA": 201},
                {"ID_BUSCA": 202},
                {"ID_BUSCA": 203},
                {"ID_BUSCA": 204},
                {"ID_BUSCA": 205},
            ]
        )
        repo = self._repo(transacao)

        resultado = repo.criar_d9(
            "123456789012",
            "2026-08-13",
            310,
            "outro-operador",
            0,
            {
                "base": "2026-08-13",
                "d2": "2026-08-15",
                "d4": "2026-08-17",
                "d6": "2026-08-19",
                "d9": "2026-08-22",
            },
        )

        self.assertEqual(
            [item["id_busca"] for item in resultado],
            [201, 202, 203, 204, 205],
        )
        self.assertEqual(transacao.insercoes, 0)
        self.assertEqual(len(transacao.consultas), 5)
        self.assertTrue(
            all("STATUS = 'resolvido'" in item["query"] for item in transacao.consultas)
        )
        self.assertTrue(
            all("DATEADD" not in item["query"] for item in transacao.consultas)
        )
        self.assertTrue(transacao.confirmada)

    def test_cache_retorna_id_da_mesma_linha_para_acompanhar_coobrigado(self):
        repo = self._repo(TransactionFake())
        repo.db = DatabaseFake(
            TransactionFake(),
            resultado_busca=[
                {
                    "ID_BUSCA": 501,
                    "STATUS": "resolvido",
                    "RESULTADO_BUSCA": json.dumps(
                        {"contrato_info": {"contrato": "123456789012"}}
                    ),
                }
            ],
        )

        resultado = repo.buscar_cache(
            "123456789012",
            "2026-08-14",
            "2026-08-14",
            310,
            1,
        )

        self.assertEqual(resultado["id_busca"], "501")
        self.assertEqual(resultado["status"], "resolvido")

if __name__ == "__main__":
    unittest.main()
