from src.infrastructure.database.sql_server_connection import SQLServerConnection
from src.shared.utils.env_load import DB_HOST_66

class ListaAcordosRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66, "DB_COPILOT_ACME")

    def buscar(self,usuario:str):
        query = """
            SELECT 
                NM_USUARIO,
                NM_LOGIN_DISCADOR,
                CPF_CNPJ_INT,
                ID_CLIENTE,
                ID_ACORDO,
                ID_CONTRATO,
                CARTEIRA,
                GRUPO,
                FORMAT(DATA_ACORDO,'dd/MM/yyyy','pt-br') AS DATA_ACORDO,
                FORMAT(DATA_PAGO,'dd/MM/yyyy','pt-br') AS DATA_PAGO,
                NU_PLANO,
                VL_ENTRADA,
                VL_PARCELA,
                VL_ACORDO,
                VL_RISCO,
                FORMAT(DT_VENCIMENTO,'dd/MM/yyyy','pt-br') AS DT_VENCIMENTO,
                STATUS_ACORDO,
                PREVENTIVO,
                DESCRICAO,
                DATA_ATUALIZACAO,
                QUEBRA
            FROM DB_COPILOT_ACME.dbo.TB_PRODUCAO_COPILOT WITH(NOLOCK)
            WHERE NM_USUARIO LIKE ?
            ORDER BY DATA_ACORDO DESC
        """

        return self.db.execute_fetch(query=query,parametros=(f"%{usuario}%",),one=False)
