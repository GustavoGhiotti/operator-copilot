from src.infrastructure.database.sql_server_connection import SQLServerConnection
from src.shared.utils.env_load import DB_HOST_66

class AtualizarPreventivoRepository:
    def __init__(self):
        self.db = SQLServerConnection(ip_servidor=DB_HOST_66,banco="DB_COPILOT_ACME")

    def atualizar_preventivo(self,id_cliente: int,preventivo) -> bool:
        query = """
            UPDATE DB_COPILOT_ACME.dbo.TB_PRODUCAO_COPILOT
               SET PREVENTIVO = ?
             WHERE ID_CLIENTE = ?
        """

        resultado = self.db.execute_commit(query=query,parametros=(preventivo,id_cliente))
        return not isinstance(resultado,Exception)

    def registrar_log(self,id_cliente: int,preventivo,data,id_acordo: int,id_contrato: int,carteira: str,comando: str) -> bool:
        query = """
            INSERT INTO DB_COPILOT_ACME.dbo.TB_ACAO_PRODUCAO_COPILOT
                (ID_CLIENTE,PREVENTIVO,UPDATE_DATE,ID_ACORDO,ID_CONTRATO,CARTEIRA,COMANDO)
            VALUES (?,?,?,?,?,?,?)
        """

        parametros = (id_cliente,preventivo,data,id_acordo,id_contrato,carteira,comando)

        resultado = self.db.execute_commit(query=query,parametros=parametros)
        return not isinstance(resultado,Exception)


class AtualizarPreventivoCombateRepository:
    def __init__(self):
        self.db = SQLServerConnection(ip_servidor=DB_HOST_66,banco="DB_COPILOT_ACME")

    def atualizar_preventivo(self, id_cliente: int, preventivo) -> bool:
        query = """
            UPDATE DB_COPILOT_ACME.dbo.Base_Lista_Combate
            SET PREVENTIVO = ?
            WHERE ID_CLIENTE = ?
        """

        resultado = self.db.execute_commit(query=query,parametros=(preventivo, id_cliente))

        return not isinstance(resultado, Exception)

    def registrar_log(self,id_cliente: int,carteira: str,preventivo,comando: str,data) -> bool:
        query = """
            INSERT INTO DB_COPILOT_ACME.dbo.TB_ACAO_PRODUCAO_COPILOT
                (ID_CLIENTE, CARTEIRA, PREVENTIVO, UPDATE_DATE, COMANDO)
            VALUES
                (?, ?, ?, ?, ?)
            """

        parametros = (id_cliente,carteira,preventivo,data,comando)

        resultado = self.db.execute_commit(query=query,parametros=parametros)

        return not isinstance(resultado, Exception)