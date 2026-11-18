from src.infrastructure.database.config.executor import DatabaseExecutor 
from src.infrastructure.services.env_load import conexao_66, key_api, TOKEN_ACME

config = conexao_66("DB_API")

class DadosUsuario:
    def __init__(self, servidor:str): 
        self.key_api = key_api()
        self.TOKEN_PORTALACORDO = TOKEN_ACME()

        self.executor = DatabaseExecutor(**config)
        
        usuario, senha = self.obterUsuarioCollectSys()
        self.usuario = usuario
        self.senha = senha

        self.servidor = servidor
        self.url = self.gerar_url_servidor()


    #Pegar os dados do login do collectsys 
    def obterUsuarioCollectSys(self) -> tuple[str, str]:
        query = f"""
                OPEN SYMMETRIC KEY CERT_CRIPTOGRAFIA 
                DECRYPTION BY CERTIFICATE CERT_API_MASTER WITH PASSWORD = '{self.key_api}'

                SELECT 
                    USUARIO = CAST (DECRYPTBYKEY(USUARIO) AS varchar(MAX))
                    ,SENHA = CAST (DECRYPTBYKEY(SENHA) AS varchar(MAX))
                FROM TB_TOKEN_USUARIO WITH(NOLOCK)
                WHERE CAST (DECRYPTBYKEY(TOKEN_KEY) AS varchar(MAX)) = ?
            """
        
        parametros = [self.TOKEN_PORTALACORDO]
        dados = self.executor.execute_query(query=query, parametros=parametros, fetch=True)
        
        return dados["USUARIO"], dados["SENHA"]
    
    def gerar_url_servidor(self) -> str:
        match self.servidor:
            case "Vega":
                servidor = "Vega"
            case _:
                servidor = "Cobrança"

        urls = {
           "Cobrança":"http://10.0.0.64/easycollectorws/easycollectorWs.asmx?op=",
           "Vega":"http://10.0.0.18/easycollectorws/easycollectorWs.asmx?op="
        }

        return urls.get(servidor)
    

    



