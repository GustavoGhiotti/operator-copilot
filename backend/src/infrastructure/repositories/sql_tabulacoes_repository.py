from src.infrastructure.database.sql_server_connection import SQLServerConnection
from src.shared.utils.env_load import DB_HOST_66

class TabulacaoRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66, "DB_COPILOT_ACME")

    def listar(self):

        query = """
            SELECT 
                ID,
                TABULACAO,
                DESCRICAO,
                CARTEIRA,
                OCULTAR
            FROM dbo.TB_LISTA_TABULACOES WITH(NOLOCK)
        """

        return self.db.execute_fetch(
            query=query,
            parametros=(),
            one=False
        )
    
    def listar_operador(self, carteira):

        query = """
            SELECT 
                ID,
                TABULACAO,
                DESCRICAO,
                CARTEIRA,
                OCULTAR
            FROM dbo.TB_LISTA_TABULACOES WITH(NOLOCK)
            WHERE UPPER(?) LIKE '%' + UPPER(CARTEIRA) + '%';
        """

        return self.db.execute_fetch(
            query=query,
            parametros=(carteira),
            one=False
        )

    def criar(self, tabulacao, descricao, carteira, ocultar):
        
        query = """
            INSERT INTO dbo.TB_LISTA_TABULACOES
                (TABULACAO, DESCRICAO, CARTEIRA, OCULTAR)
            SELECT
                ?,
                ?,
                ?,
                ?
            WHERE NOT EXISTS (
                SELECT 1
                FROM dbo.TB_LISTA_TABULACOES WITH (UPDLOCK, HOLDLOCK)
                WHERE TABULACAO = ?
                AND DESCRICAO = ?
                AND CARTEIRA = ?
            );
            """

        result = self.db.execute_commit(query=query,parametros=(tabulacao, descricao, carteira, ocultar, tabulacao, descricao, carteira))
        print(f"Tabulação gravada!")
        return result

    def atualizar(self, tabulacao, descricao, carteira, id_tabulacao, ocultar):
        
        query = """
            UPDATE dbo.TB_LISTA_TABULACOES
            SET
                TABULACAO = ?,
                DESCRICAO = ?,
                CARTEIRA = ?,
                OCULTAR = ?
            WHERE ID = ?
            AND NOT EXISTS (
                SELECT 1
                FROM dbo.TB_LISTA_TABULACOES WITH (UPDLOCK, HOLDLOCK)
                WHERE TABULACAO = ?
                    AND DESCRICAO = ?
                    AND CARTEIRA = ?
                    AND OCULTAR = ?
                    --AND ID <> ?
            );
            """

        update = self.db.execute_commit(query=query,parametros=(tabulacao, descricao, carteira, ocultar, id_tabulacao, tabulacao, descricao, carteira, ocultar))
        return update

    def deletar(self, id_tabulacao):
        query = """
            DELETE dbo.TB_LISTA_TABULACOES
            WHERE ID = ?
            """

        delete = self.db.execute_commit(query=query,parametros=(id_tabulacao))
        return delete
