from src.infrastructure.database.sql_server_connection import SQLServerConnection
from src.shared.utils.env_load import DB_HOST_66

class AnotacoesRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66,"DB_COPILOT_ACME")

    def _base_select(self):
        return """
            SELECT
                a.ID_ANOTACAO AS ID,
                a.USUARIO AS USUARIO,
                a.TITULO AS TITULO,
                a.CONTEUDO AS CONTEUDO,
                a.CATEGORIA AS CATEGORIA,
                a.DESTINATARIO AS DESTINATARIO,
                a.DATA_CRIACAO AS DATA_CRIACAO,
                a.DATA_ATUALIZACAO AS DATA_ATUALIZACAO,
                a.CONFIRMADO AS CONFIRMADO,
                a.TIPO_BOLETO AS TIPO_BOLETO,
                CONVERT(VARCHAR(10), a.DATA_VENCIMENTO, 23) AS DATA_VENCIMENTO,
                a.COR_POSTIT AS COR_POSTIT,
                a.IMPORTANTE AS IMPORTANTE,
                a.FIXADO AS FIXADO
            FROM TB_ANOTACOES a
        """

    def listar_visao_supervisor(self,usuario:str):
        query = self._base_select() + """
            JOIN TB_GRUPOS g ON a.DESTINATARIO = g.NOME_GRUPO
            JOIN TB_GRUPOS_USUARIOS gu ON g.ID_GRUPO = gu.ID_GRUPO
            WHERE gu.USUARIO = ?
              AND a.CATEGORIA = 'envio_manual'
            ORDER BY a.DATA_CRIACAO DESC
        """

        return self._executar(query,(usuario,))

    def listar_por_usuario(self,usuario:str):
        query = self._base_select() + """
            WHERE a.USUARIO = ?
            ORDER BY a.DATA_CRIACAO DESC
        """

        return self._executar(query,(usuario,))

    def listar_por_destinatario(self,destinatario:str):
        query = self._base_select() + """
            JOIN TB_GRUPOS g ON a.DESTINATARIO = g.NOME_GRUPO
            JOIN TB_GRUPOS_USUARIOS gu ON g.ID_GRUPO = gu.ID_GRUPO
            WHERE gu.USUARIO = ?
              AND a.IS_MANUAL = 1
            ORDER BY a.DATA_CRIACAO DESC
        """

        return self._executar(query,(destinatario,))

    def _executar(self,query,parametros):
        rows = self.db.execute_fetch(
            query=query,
            parametros=parametros,
            one=False
        )

        if not rows:
            return []

        return [
            {
                "id":row.get("ID"),
                "usuario":row.get("USUARIO"),
                "titulo":row.get("TITULO"),
                "conteudo":row.get("CONTEUDO"),
                "categoria":row.get("CATEGORIA"),
                "destinatario":row.get("DESTINATARIO"),
                "data_criacao":row.get("DATA_CRIACAO"),
                "data_atualizacao":row.get("DATA_ATUALIZACAO"),
                "confirmado":bool(row.get("CONFIRMADO")),
                "tipo_boleto":row.get("TIPO_BOLETO"),
                "data_vencimento":row.get("DATA_VENCIMENTO"),
                "cor_postit":row.get("COR_POSTIT") or "automatico",
                "importante":bool(row.get("IMPORTANTE")),
                "fixado":bool(row.get("FIXADO"))
            }
            for row in rows
        ]

    def criar(
        self,
        usuario,
        titulo,
        conteudo,
        categoria,
        destinatario,
        is_manual,
        tipo_boleto,
        data_vencimento,
        cor_postit,
        importante,
        fixado
    ):
        query = """
            INSERT INTO TB_ANOTACOES
                (
                    USUARIO,TITULO,CONTEUDO,CATEGORIA,DESTINATARIO,
                    IS_MANUAL,TIPO_BOLETO,DATA_VENCIMENTO,
                    COR_POSTIT,IMPORTANTE,FIXADO
                )
            VALUES
                (?,?,?,?,?,?,?,?,?,?,?)
        """

        return self.db.execute_commit(
            query=query,
            parametros=(
                usuario,
                titulo,
                conteudo,
                categoria,
                destinatario,
                is_manual,
                tipo_boleto,
                data_vencimento,
                cor_postit,
                importante,
                fixado
            )
        )

    def atualizar(
        self,
        id_anotacao,
        titulo,
        conteudo,
        categoria,
        tipo_boleto,
        data_vencimento,
        cor_postit,
        importante,
        fixado
    ):
        query = """
            UPDATE TB_ANOTACOES
            SET
                TITULO = ?,
                CONTEUDO = ?,
                CATEGORIA = ?,
                TIPO_BOLETO = ?,
                DATA_VENCIMENTO = ?,
                COR_POSTIT = ?,
                IMPORTANTE = ?,
                FIXADO = ?,
                DATA_ATUALIZACAO = GETDATE()
            WHERE ID_ANOTACAO = ?
        """

        return self.db.execute_commit(
            query=query,
            parametros=(
                titulo,
                conteudo,
                categoria,
                tipo_boleto,
                data_vencimento,
                cor_postit,
                importante,
                fixado,
                id_anotacao
            )
        )

    def atualizar_preferencias(
        self,
        id_anotacao,
        cor_postit,
        importante,
        fixado
    ):
        query = """
            UPDATE TB_ANOTACOES
            SET
                COR_POSTIT = ?,
                IMPORTANTE = ?,
                FIXADO = ?,
                DATA_ATUALIZACAO = GETDATE()
            WHERE ID_ANOTACAO = ?
        """

        return self.db.execute_commit(
            query=query,
            parametros=(
                cor_postit,
                importante,
                fixado,
                id_anotacao
            )
        )

    def excluir(self,id_anotacao):
        query = "DELETE FROM TB_ANOTACOES WHERE ID_ANOTACAO = ?"

        return self.db.execute_commit(
            query=query,
            parametros=(id_anotacao,)
        )

    def excluir_confirmadas_manuais(self):
        query = """
            DELETE FROM TB_ANOTACOES
            WHERE CONFIRMADO = 1
              AND IS_MANUAL = 1
        """

        return self.db.execute_commit(
            query=query,
            parametros=()
        )

    def confirmar(self,id_anotacao):
        query = """
            UPDATE TB_ANOTACOES
            SET
                CONFIRMADO = 1,
                DATA_ATUALIZACAO = GETDATE()
            WHERE ID_ANOTACAO = ?
        """

        return self.db.execute_commit(
            query=query,
            parametros=(id_anotacao,)
        )
