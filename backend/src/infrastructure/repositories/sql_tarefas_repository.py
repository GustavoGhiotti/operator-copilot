from src.infrastructure.database.sql_server_connection import SQLServerConnection
from src.shared.utils.env_load import DB_HOST_66

class TarefasRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66,"DB_COPILOT_ACME")

    def listar_por_usuario(self,usuario: str):
        query = """
            SELECT
                ID_TODO         AS ID,
                USUARIO         AS USUARIO,
                TITULO          AS TITULO,
                DESCRICAO       AS DESCRICAO,
                CATEGORIA       AS CATEGORIA,
                PRIORIDADE      AS PRIORIDADE,
                STATUS          AS STATUS,
                DATA_VENCIMENTO AS DATA_VENCIMENTO,
                DATA_CRIACAO    AS DATA_CRIACAO,
                DATA_ATUALIZACAO AS DATA_ATUALIZACAO
            FROM TB_TODOS WITH(NOLOCK)
            WHERE USUARIO = ?
            ORDER BY DATA_CRIACAO DESC
        """

        rows = self.db.execute_fetch(
            query=query,
            parametros=(usuario,),
            one=False
        )

        if not rows:
            return []

        return [
            {
                "id":row.get("ID"),
                "usuario":row.get("USUARIO"),
                "titulo":row.get("TITULO"),
                "descricao":row.get("DESCRICAO"),
                "categoria":row.get("CATEGORIA"),
                "prioridade":row.get("PRIORIDADE"),
                "status":row.get("STATUS"),
                "data_vencimento":row.get("DATA_VENCIMENTO"),
                "data_criacao":row.get("DATA_CRIACAO"),
                "data_atualizacao":row.get("DATA_ATUALIZACAO")
            }
            for row in rows
        ]

    def criar(
        self,
        *,
        usuario: str,
        titulo: str,
        descricao: str,
        categoria: str,
        prioridade: str,
        data_vencimento: str | None
    ):
        query = """
            INSERT INTO TB_TODOS
            (
                USUARIO,
                TITULO,
                DESCRICAO,
                CATEGORIA,
                PRIORIDADE,
                STATUS,
                DATA_VENCIMENTO
            )
            VALUES
            (?, ?, ?, ?, ?, 'pendente', ?)
        """

        parametros = (
            usuario,
            titulo,
            descricao,
            categoria,
            prioridade,
            data_vencimento
        )

        return self.db.execute_commit(
            query=query,
            parametros=parametros
        )

    def atualizar(
        self,
        *,
        id_todo: int,
        titulo: str,
        descricao: str,
        categoria: str,
        prioridade: str,
        status: str,
        data_vencimento: str | None
    ):
        query = """
            UPDATE TB_TODOS
            SET
                TITULO = ?,
                DESCRICAO = ?,
                CATEGORIA = ?,
                PRIORIDADE = ?,
                STATUS = ?,
                DATA_VENCIMENTO = ?,
                DATA_ATUALIZACAO = GETDATE()
            WHERE ID_TODO = ?
        """

        parametros = (
            titulo,
            descricao,
            categoria,
            prioridade,
            status,
            data_vencimento,
            id_todo
        )

        return self.db.execute_commit(
            query=query,
            parametros=parametros
        )

    def atualizar_status(self,*,id_todo: int,status: str):
        query = """
            UPDATE TB_TODOS
            SET STATUS = ?,DATA_ATUALIZACAO = GETDATE()
            WHERE ID_TODO = ?
        """

        parametros = (status,id_todo)

        return self.db.execute_commit(
            query=query,
            parametros=parametros
        )

    def excluir(self,*,id_todo: int):
        query = "DELETE FROM TB_TODOS WHERE ID_TODO = ?"

        parametros = (id_todo,)

        return self.db.execute_commit(
            query=query,
            parametros=parametros
        )
