from src.infrastructure.database.sql_server_connection import SQLServerConnection
from src.shared.utils.env_load import *
from datetime import date

class LoginRepository:
    def __init__(self, cpf_colaborador:str):
        self.execute = SQLServerConnection(DB_HOST_66, database="DB_COPILOT_ACME")
        self.cpf_colaborador = cpf_colaborador

    def login(self) -> dict:
        query = """  
                SELECT 
                    NM_COLABORADOR,
                    SENHA,
                    FUNCAO_COLABORADOR,
                    CPF_COLABORADOR,
                    PRIMEIRO_ACESSO, 
                    CENTRO_CUSTO, 
                    SUPERVISOR,
                    ID_OLOS_CX,
                    ID_OLOS_COB
                FROM [login].TB_USUARIOS WITH(NOLOCK)
                    WHERE CPF_COLABORADOR = ?
                """
        return self.execute.execute_fetch(query=query,parametros=(self.cpf_colaborador), one=True)
        
    
    def logout(self) -> int:
        query = """
                    UPDATE [login].TB_USUARIOS
                        SET IS_LOGADO = 0
                    WHERE CPF_COLABORADOR = ?
                """
        return self.execute.execute_commit(query=query,parametros=(self.cpf_colaborador))

    def changer_password(self, senha:str):
        query = """
                    UPDATE [login].TB_USUARIOS
                        SET SENHA = ?, 
	                    PRIMEIRO_ACESSO = 0
                    WHERE CPF_COLABORADOR = ?
                """
        
        return self.execute.execute_commit(query=query,parametros=(senha, self.cpf_colaborador)) 

    def reset_password(self) -> int:
        query = """
                    UPDATE U
                    SET 
                        SENHA = LOWER(CONCAT(
                            LEFT(U.NM_COLABORADOR, CHARINDEX(' ', U.NM_COLABORADOR + ' ') - 1),
                            '123'
                        )),
                        PRIMEIRO_ACESSO = 1
                    FROM [login].TB_USUARIOS U
                    WHERE U.CPF_COLABORADOR = ?
                """
        
        return self.execute.execute_commit(query=query,parametros=(self.cpf_colaborador))


    def status_login(self):
        query = """
                    UPDATE login.TB_USUARIOS
                        SET IS_LOGADO = 1, DT_ULTIMO_ACESSO = GETDATE()
                    WHERE CPF_COLABORADOR = ?
                """
        return self.execute.execute_commit(query=query,parametros=(self.cpf_colaborador))

    def validar_log_acesso(self, data_login:date):
        query = """
                    SELECT COUNT(*) FROM TB_LOG_ACESSO_COPILOT WITH(NOLOCK)
                    WHERE CPF_COLABORADOR = ? 
                    AND DATA_LOGIN = ?
                """
        return self.execute.execute_fetch(query=query,parametros=(self.cpf_colaborador, data_login), one=True)
    
    def inserir_log_acesso(self,nome:str ,data_login:date):
        query = """
                    INSERT INTO TB_LOG_ACESSO_COPILOT 
                        (CPF_COLABORADOR, NOME_COLABORADOR, DATA_LOGIN)
                    VALUES (?, ?, ?)
            """
        
        return self.execute.execute_commit(query=query,parametros=(self.cpf_colaborador, nome, data_login))

