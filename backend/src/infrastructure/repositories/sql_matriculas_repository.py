from flask import jsonify

from src.infrastructure.database.sql_server_connection import SQLServerConnection
from src.shared.utils.env_load import DB_HOST_66

class MatriculasRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66,"DB_COPILOT_ACME")

    def listar_todas(self):
        self.limpar_lista()

        query = """
            SELECT * FROM dbo.TB_LOGINS_CRMWEB WITH(NOLOCK)
            ORDER BY NOME
        """

        list = self.db.execute_fetch(
            query=query,
            parametros=(),
            one=False
        )

        if not list:
            return []

        return [
            {
                "status":row.get("STATUS"),
                "nome":row.get("NOME"),
                "matricula":row.get("MATRICULA"),
                "senha":row.get("SENHA"),
                "status1":row.get("STATUS1")
            }
            for row in list
        ]
    
    def limpar_lista(self):
        query = """
                    DELETE dbo.TB_LOGINS_CRMWEB
                    WHERE STATUS1 NOT IN ('COM ACESSO', 'NOVO USUARIO')
                """
        return self.db.execute_commit(
            query=query,
            parametros=()
        )
    
    def gravar_matricula(self, nome, usuario):
        self.limpar_lista()

        query = """
            INSERT INTO dbo.TB_LOGINS_CRMWEB
                ([STATUS], NOME, MATRICULA, SENHA, STATUS1)
            SELECT
                'ATIVO', ?, ?, 'DEFAULT', 'NOVO USUARIO'
            WHERE NOT EXISTS (
                SELECT 1
                FROM dbo.TB_LOGINS_CRMWEB
                WHERE NOME = ?
                AND MATRICULA = ?
            );
        """

        return self.db.execute_commit(
            query=query,
            parametros=(nome, usuario, nome, usuario)
        )
    
    def gravar_lote(self, registros):
        self.limpar_lista()

        if not registros:
            return False

        queries = []
        parametros = []

        for item in registros:
            nome = item["nome"]
            matricula = item["matricula"]

            queries.append("""
                INSERT INTO dbo.TB_LOGINS_CRMWEB
                    ([STATUS], NOME, MATRICULA, SENHA, STATUS1)
                SELECT
                    'ATIVO', ?, ?, 'DEFAULT', 'NOVO USUARIO'
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM dbo.TB_LOGINS_CRMWEB
                    WHERE NOME = ?
                    AND MATRICULA = ?
                )
            """)

            parametros.extend([nome, matricula, nome, matricula])

        query_final = ";\n".join(queries) + ";"

        return self.db.execute_commit(
            query=query_final,
            parametros=tuple(parametros)
        )
        
    
    def atualizar_matricula(self, matricula, nome, usuario):
        query = """
            UPDATE dbo.TB_LOGINS_CRMWEB
                SET NOME = ?,
                    MATRICULA = ?
            WHERE MATRICULA = ?
        """

        return self.db.execute_commit(
            query=query,
            parametros=(nome, usuario, matricula)
        )
    
    def deletar_matricula(self,matricula):
        query = """
            DELETE FROM dbo.TB_LOGINS_CRMWEB
            WHERE MATRICULA = ?
        """

        resultado = self.db.execute_commit(query=query,parametros=(matricula,))

        return not isinstance(resultado,Exception)


    def deletar_multiplas(self, lista):
        placeholders = ",".join(["?"] * len(lista))
        query = f"DELETE FROM dbo.TB_LOGINS_CRMWEB WHERE MATRICULA IN ({placeholders})"

        try:
            # o ideal é o driver retornar um cursor/resultado com rowcount
            res = self.db.execute_commit(query=query, parametros=tuple(lista))

            # se seu execute_commit já retorna rowcount, ótimo:
            if isinstance(res, int):
                return res

            # se retorna cursor:
            if hasattr(res, "rowcount"):
                return int(res.rowcount)

            # fallback: se não dá pra saber, pelo menos sinaliza sucesso como "1"
            return 1

        except Exception:
            return 0