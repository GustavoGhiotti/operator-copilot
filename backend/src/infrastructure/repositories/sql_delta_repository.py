from src.infrastructure.database.sql_server_connection import SQLServerConnection
from src.shared.utils.env_load import *

class PesquisaSatisfacao:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66,"DB_COPILOT_ACME")


    def registrar(self, operador, nm_cliente, cpf_cliente, rec_conta_slr, conh_port, vem_delta, motivacao_beneficio):
        query = """INSERT INTO delta.TB_PESQUISA_PORTABILIDADE(
                        NM_OPERADOR	
                        ,NM_CLIENTE	
                        ,CPF_CLIENTE	
                        ,RECEBE_CONTA_SALARIO	
                        ,CONHECE_PORTABILIDADE	
                        ,VEM_SER_DELTA	
                        ,MOTIVACAO_BENEFICIO
                    )VALUES(
                        ?	
                        ,?
                        ,?
                        ,?
                        ,?
                        ,?
                        ,?
                        )
                """
        parametros = (operador, nm_cliente, cpf_cliente, rec_conta_slr, conh_port, vem_delta, motivacao_beneficio)
        self.db.execute_commit(query=query,parametros=parametros)

    def gama(self, operador, nm_cliente, cpf_cliente, motivo):
        query = """INSERT INTO gama.TB_PESQUISA_PAGAMENTO(
                        NM_OPERADOR	
                        ,NM_CLIENTE	
                        ,CPF_CLIENTE	
                        ,MOTIVO
                    )VALUES(
                        ?	
                        ,?
                        ,?
                        ,?
                        )
                """
        parametros = (operador, nm_cliente, cpf_cliente, motivo)
        self.db.execute_commit(query=query,parametros=parametros)