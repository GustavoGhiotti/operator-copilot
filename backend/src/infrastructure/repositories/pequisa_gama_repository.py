from src.infrastructure.database.sql_server_connection import SQLServerConnection
from src.shared.utils.env_load import DB_HOST_66

class PesquisaSatisfacaoRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66,"DB_COPILOT_ACME")

    def registrar_gama(self,operador,nm_cliente,cpf_cliente,motivo):
        query = """
            INSERT INTO gama.TB_PESQUISA_PAGAMENTO(
                NM_OPERADOR,NM_CLIENTE,CPF_CLIENTE,MOTIVO
            )VALUES(?,?,?,?)
        """

        parametros = (operador,nm_cliente,cpf_cliente,motivo)

        resultado = self.db.execute_commit(query=query,parametros=parametros)

        return not isinstance(resultado,Exception)