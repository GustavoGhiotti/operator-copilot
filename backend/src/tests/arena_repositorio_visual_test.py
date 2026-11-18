"""O armario continua de pe quando a migration 019 ainda nao rodou.

Sem esta protecao qualquer SELECT que cite FILTRO_COR derruba a aba inteira: o
operador ve o catalogo de emergencia e nenhuma pista do motivo. Foi exatamente
o que aconteceu quando a 019 falhou na compilacao.
"""
import unittest
from unittest.mock import MagicMock, patch

from src.infrastructure.repositories.sql_arena_repository import ArenaRepository


def repositorio_com(coluna_existe):
    """Monta o repositorio com um banco falso que responde ao COL_LENGTH."""
    db = MagicMock()

    def responder(query, parametros=(), one=False):
        if "COL_LENGTH" in query:
            return {"disponivel": 1 if coluna_existe else 0}
        # Precisa ser verdadeiro: obter_estado_sessao desiste se a sessao
        # vier vazia, e a consulta de participantes nunca seria montada.
        return {"id": 1} if one else []

    db.execute_fetch.side_effect = responder
    with patch(
        "src.infrastructure.repositories.sql_arena_repository."
        "SQLServerConnection",
        return_value=db,
    ):
        repo = ArenaRepository()
    return repo, db


def consultas(db):
    return [chamada.kwargs.get("query", "") for chamada in db.execute_fetch.call_args_list]


class VisualExpandidoDisponivelTest(unittest.TestCase):
    def test_reconhece_a_migration_aplicada(self):
        repo, _ = repositorio_com(True)

        self.assertTrue(repo._visual_expandido_disponivel())

    def test_reconhece_a_migration_pendente(self):
        repo, _ = repositorio_com(False)

        self.assertFalse(repo._visual_expandido_disponivel())

    def test_pergunta_ao_banco_uma_vez_so(self):
        """A checagem entra em toda leitura de armario e de sala de espera."""
        repo, db = repositorio_com(True)

        repo._visual_expandido_disponivel()
        repo._visual_expandido_disponivel()
        repo._visual_expandido_disponivel()

        checagens = [q for q in consultas(db) if "COL_LENGTH" in q]
        self.assertEqual(len(checagens), 1)


class CatalogoDegradadoTest(unittest.TestCase):
    def test_com_a_migration_aplicada_le_as_colunas_novas(self):
        repo, db = repositorio_com(True)

        repo.obter_personalizacao_aurora("123")

        catalogo = [q for q in consultas(db) if "FROM dbo.TB_ARENA_AURORA_ITEM ITEM" in q]
        self.assertTrue(catalogo)
        self.assertIn("ITEM.FILTRO_COR AS filtro_cor", catalogo[0])
        self.assertIn("ITEM.CODIGO_CONJUNTO AS codigo_conjunto", catalogo[0])

    def test_sem_a_migration_troca_as_colunas_por_nulo(self):
        repo, db = repositorio_com(False)

        resultado = repo.obter_personalizacao_aurora("123")

        catalogo = [q for q in consultas(db) if "FROM dbo.TB_ARENA_AURORA_ITEM ITEM" in q]
        self.assertTrue(catalogo)
        self.assertNotIn("ITEM.FILTRO_COR", catalogo[0])
        self.assertNotIn("ITEM.CODIGO_CONJUNTO", catalogo[0])
        # Os apelidos continuam la: quem consome nao precisa saber da migration.
        self.assertIn("AS filtro_cor", catalogo[0])
        self.assertIn("AS nome_conjunto", catalogo[0])
        self.assertEqual(resultado["itens"], [])


class VisualDaSalaDeEsperaTest(unittest.TestCase):
    """O visual vestido aparece nos cartoes da sala; nao pode derrubar a sala."""

    def test_sem_a_migration_o_filtro_vira_nulo(self):
        repo, db = repositorio_com(False)
        repo.obter_estado_sessao(1)

        participantes = [q for q in consultas(db) if "visual_json" in q]
        self.assertTrue(participantes)
        self.assertNotIn("ITEM.FILTRO_COR", participantes[0])
        self.assertIn("CAST(NULL AS NVARCHAR(120)) AS filtro", participantes[0])


if __name__ == "__main__":
    unittest.main()
