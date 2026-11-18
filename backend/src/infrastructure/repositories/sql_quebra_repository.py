from src.infrastructure.database.sql_server_connection import SQLServerConnection
from src.shared.utils.env_load import DB_HOST_66

class AtualizarQuebraRepository:
    def __init__(self):
        self.db = SQLServerConnection(ip_servidor=DB_HOST_66,banco="DB_COPILOT_ACME")

    def atualizar_quebra(self,id_cliente: int,quebra) -> bool:
        query = """
            UPDATE DB_COPILOT_ACME.dbo.TB_PRODUCAO_COPILOT
               SET QUEBRA = ?
             WHERE ID_CLIENTE = ?
        """

        resultado = self.db.execute_commit(query=query,parametros=(quebra,id_cliente))
        return not isinstance(resultado,Exception)

    def registrar_log(self,id_cliente: int,carteira: str,quebra,data,id_acordo: int,id_contrato: int,comando: str) -> bool:
        query = """
            INSERT INTO DB_COPILOT_ACME.dbo.TB_ACAO_PRODUCAO_COPILOT
                (ID_CLIENTE,CARTEIRA,QUEBRA,UPDATE_DATE,ID_ACORDO,ID_CONTRATO,COMANDO)
            VALUES (?,?,?,?,?,?,?)
        """

        parametros = (id_cliente,carteira,quebra,data,id_acordo,id_contrato,comando)

        resultado = self.db.execute_commit(query=query,parametros=parametros)
        return not isinstance(resultado,Exception)



class AtualizarQuebraCombateRepository:
    def __init__(self):
        self.db = SQLServerConnection(ip_servidor=DB_HOST_66,banco="DB_COPILOT_ACME")

    def atualizar_quebra(self,id_cliente:int,quebra:str) -> bool:
        query = """
            UPDATE DB_COPILOT_ACME.dbo.Base_Lista_Combate
            SET QUEBRA = ?
            WHERE ID_CLIENTE = ?
        """

        resultado = self.db.execute_commit(query=query,parametros=(quebra,id_cliente))
        return not isinstance(resultado,Exception)

    def registrar_log(self,id_cliente:int,carteira:str,quebra:str,comando:str,data) -> bool:
        query = """
            INSERT INTO DB_COPILOT_ACME.dbo.TB_ACAO_PRODUCAO_COPILOT
                (ID_CLIENTE,CARTEIRA,QUEBRA,UPDATE_DATE,COMANDO)
            VALUES
                (?,?,?,?,?)
        """

        parametros = (id_cliente,carteira,quebra,data,comando)
        resultado = self.db.execute_commit(query=query,parametros=parametros)
        return not isinstance(resultado,Exception)
