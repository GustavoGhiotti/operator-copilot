from src.infrastructure.database.sql_server_connection import SQLServerConnection
from src.shared.utils.env_load import *
import re

class CarteiraRepository:
    def obter_carteira(id_cedente:int):
        executor = SQLServerConnection(DB_HOST_66, "DB_CHATBOT")

        query = """
                    SELECT 
                        NM_CEDENTE_FORMATADO 
                    FROM msg.TB_CARTEIRA WITH(NOLOCK)
                    WHERE ID_CEDENTE = ?
                """
        
        return executor.execute_fetch(query=query, parametros=(id_cedente), one=True)

    def obter_carteira_por_nome(nome_carteira: str):
        executor = SQLServerConnection(DB_HOST_66, "DB_CHATBOT")

        query = """
                    SELECT TOP 1
                        ID_CEDENTE,
                        NM_CEDENTE_FORMATADO
                    FROM msg.TB_CARTEIRA WITH(NOLOCK)
                    WHERE UPPER(NM_CEDENTE_FORMATADO) = UPPER(?)
                       OR UPPER(?) LIKE '%' + UPPER(NM_CEDENTE_FORMATADO) + '%'
                       OR UPPER(NM_CEDENTE_FORMATADO) LIKE '%' + UPPER(?) + '%'
                    ORDER BY
                        CASE
                            WHEN UPPER(NM_CEDENTE_FORMATADO) = UPPER(?) THEN 0
                            ELSE 1
                        END
                """

        parametros = (nome_carteira, nome_carteira, nome_carteira, nome_carteira)

        carteira = executor.execute_fetch(query=query, parametros=parametros, one=True)
        if carteira:
            return carteira

        # Alguns centros de custo usam um nome reduzido. Exemplo:
        # "ARC OMEGA" deve localizar "TETA ARC4 OMEGA".
        termos = [
            termo
            for termo in re.findall(r"[A-Z0-9]+", nome_carteira.upper())
            if len(termo) >= 3
        ]
        if not termos:
            return None

        condicoes = " AND ".join(
            "(UPPER(NM_CEDENTE) LIKE '%' + ? + '%' "
            "OR UPPER(NM_CEDENTE_FORMATADO) LIKE '%' + ? + '%')"
            for _ in termos
        )
        parametros_termos = tuple(
            parametro
            for termo in termos
            for parametro in (termo, termo)
        )

        query_termos = f"""
            SELECT TOP 1
                ID_CEDENTE,
                NM_CEDENTE_FORMATADO
            FROM msg.TB_CARTEIRA WITH(NOLOCK)
            WHERE {condicoes}
            ORDER BY ID_CEDENTE
        """

        return executor.execute_fetch(
            query=query_termos,
            parametros=parametros_termos,
            one=True,
        )


class DadosAcordoRepository:
    def __init__(self):
        self.executor = SQLServerConnection(DB_HOST_65,"easycollector")

    def obter_dados(self, id_cliente:int, id_acordo:int=None):
        filtro_acordo = "AND B.ID_ACORDO = ?" if id_acordo else ""
        query = """
                    SELECT TOP 1
                        SUBSTRING(A.NM_NOME, 1, CHARINDEX(' ', A.NM_NOME + ' ') - 1) AS NM_CLIENTE
                        ,B.ID_ACORDO
                        ,C.VL_PARCELA
                        ,C.DT_PARCELA
                        ,C.NU_PARCELA
                        ,A.ID_CEDENTE
						,A.NM_CONTRATO_CEDENTE
                    FROM dm.TB_DIVIDAS AS A WITH(NOLOCK)
                    LEFT JOIN TB_ACORDO AS B WITH(NOLOCK) ON A.ID_CLIENTE = B.ID_CLIENTE
                    RIGHT JOIN TB_ACORDO_PARCELA AS C WITH(NOLOCK) ON B.ID_ACORDO = C.ID_ACORDO
                    WHERE 1=1
                    AND A.ID_CLIENTE = ?
                    AND B.TP_STATUS IN (0,1)
                    {filtro_acordo}
                    ORDER BY C.NU_PARCELA
                """.format(filtro_acordo=filtro_acordo)
        parametros = (id_cliente, id_acordo) if id_acordo else (id_cliente,)
        result:dict = self.executor.execute_fetch(query=query, parametros=parametros, one=True)

        return result

    def obter_cliente(self, id_cliente: int):
        query = """
                    SELECT TOP 1
                        NU_CPF_CNPJ AS CPF_CNPJ,
                        SUBSTRING(NM_NOME, 1, CHARINDEX(' ', NM_NOME + ' ') - 1) AS NM_CLIENTE,
                        ID_CEDENTE
                    FROM dm.TB_DIVIDAS WITH(NOLOCK)
                    WHERE ID_CLIENTE = ?
                """

        return self.executor.execute_fetch(
            query=query,
            parametros=(id_cliente,),
            one=True,
        )

    def obter_cliente_sem_divida(self, id_cliente: int):
        query = """
                    SELECT TOP 1
                        ID_CLIENTE,
                        SUBSTRING(LTRIM(RTRIM(NM_NOME)), 1,
                            CHARINDEX(' ', LTRIM(RTRIM(NM_NOME)) + ' ') - 1
                        ) AS NM_CLIENTE,
                        ID_CEDENTE,
                        NU_CPF_CNPJ AS CPF_CNPJ
                    FROM dbo.TB_CLIENTE WITH(NOLOCK)
                    WHERE ID_CLIENTE = ?
                """

        return self.executor.execute_fetch(
            query=query,
            parametros=(id_cliente,),
            one=True,
        )

    def listar_acordos_ativos(self, id_cliente:int):
        query = """
                    WITH acordos AS (
                        SELECT
                            B.ID_ACORDO,
                            C.NU_PARCELA,
                            FORMAT(C.DT_PARCELA, 'dd/MM/yyyy', 'pt-br') AS DT_PAGAMENTO,
                            C.VL_PARCELA,
                            ROW_NUMBER() OVER (
                                PARTITION BY B.ID_ACORDO
                                ORDER BY C.NU_PARCELA
                            ) AS RN
                        FROM dm.TB_DIVIDAS AS A WITH(NOLOCK)
                        LEFT JOIN TB_ACORDO AS B WITH(NOLOCK) ON A.ID_CLIENTE = B.ID_CLIENTE
                        RIGHT JOIN TB_ACORDO_PARCELA AS C WITH(NOLOCK) ON B.ID_ACORDO = C.ID_ACORDO
                        WHERE 1=1
                        AND A.ID_CLIENTE = ?
                        AND B.TP_STATUS IN (0,1)
                    )
                    SELECT
                        ID_ACORDO,
                        NU_PARCELA,
                        DT_PAGAMENTO,
                        VL_PARCELA
                    FROM acordos
                    WHERE RN = 1
                    ORDER BY ID_ACORDO DESC
                """

        return self.executor.execute_fetch(query=query, parametros=(id_cliente,), one=False)
        

class DadosDesligouRepository:
    def __init__(self):
        self.executor = SQLServerConnection(DB_HOST_71,"DB_REPORT")

    
    def obter_dados(self, id_cliente:int):
        query = """
                    SELECT
                        ID_CEDENTE
                        ,SUBSTRING(NM_NOME, 1, CHARINDEX(' ', NM_NOME + ' ') - 1) AS NM_CLIENTE 
                        ,NM_CONTRATO_CEDENTE
                    FROM DM.TB_CARTEIRA WITH(NOLOCK)
                    WHERE 1=1
                    AND ID_CLIENTE = ?
                """
        
        result:dict = self.executor.execute_fetch(query=query, parametros=(id_cliente,),one=True)
        if not result:
            return None

        carteira = CarteiraRepository.obter_carteira(result["ID_CEDENTE"])
        result.update(carteira)
        
        
        return result

class DadosRecusaPagamentoRepository:
    def __init__(self):
        self.executor = SQLServerConnection(DB_HOST_71,"DB_REPORT")

    
    def obter_dados(self, id_cliente:int):
        query = """
                    SELECT
                        ID_CEDENTE
                        ,SUBSTRING(NM_NOME, 1, CHARINDEX(' ', NM_NOME + ' ') - 1) AS NM_CLIENTE 
                        ,NM_CONTRATO_CEDENTE
                    FROM DM.TB_CARTEIRA WITH(NOLOCK)
                    WHERE 1=1
                    AND ID_CLIENTE = ?
                """
        
        result:dict = self.executor.execute_fetch(query=query, parametros=(id_cliente,),one=True)
        if not result:
            return None

        carteira = CarteiraRepository.obter_carteira(result["ID_CEDENTE"])
        result.update(carteira)
        
        return result


class EnvioBoletoRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66,"DB_COPILOT_ACME")

    def registrar_log(self,operador,nome_cliente,whatsapp,valor,data_vencimento,carteira,link_boleto,status,twilio_sid,mensagem_erro,codigo_pix):
        query = """
            INSERT INTO TB_LOG_ENVIO_BOLETO
            (OPERADOR,NOME_CLIENTE,WHATSAPP,VALOR,DATA_VENCIMENTO,CARTEIRA,LINK_BOLETO,STATUS,TWILIO_SID,MENSAGEM_ERRO,CODIGO_PIX)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
        """

        parametros = (operador,nome_cliente,whatsapp,valor,data_vencimento,carteira,link_boleto,status,twilio_sid,mensagem_erro,codigo_pix)

        return self.db.execute_commit(query=query,parametros=parametros)
    

class LogEnvioWhatsappRepository:
    def __init__(self):
        self.executor = SQLServerConnection(DB_HOST_66, "DB_COPILOT_ACME")


    # ============================
    # Contagem individual (limite)
    # ============================
    def contar_envios_do_dia(self, operador: str, tipo_envio: str) -> int:
        query = """
            SELECT COUNT(*) AS QTD
            FROM WhatsAppEnvioLog
            WHERE OPERADOR = ?
            AND TIPO_ENVIO = ?
            AND CAST(DATA_ENVIO AS DATE) = CAST(GETDATE() AS DATE)
        """

        result = self.executor.execute_fetch(
            query=query,
            parametros=(operador, tipo_envio),
            one=True
        )

        return result["QTD"] if result else 0

    # ============================
    # Contagem agrupada p/ insights
    # ============================
    def contar_por_tipo(self, operador: str):
        query = """
            SELECT 
                TIPO_ENVIO,
                COUNT(*) AS QTD
            FROM WhatsAppEnvioLog
            WHERE OPERADOR = ?
            AND CAST(DATA_ENVIO AS DATE) = CAST(GETDATE() AS DATE)
            GROUP BY TIPO_ENVIO
        """

        # IMPORTANTE: buscar todas as linhas
        rows = self.executor.execute_fetch(
            query=query,
            parametros=(operador,)
        )

        resultado = {"preventivo": 0, "recusa": 0, "desligou": 0}

        if not rows:
            return resultado

        for r in rows:
            tipo = r["TIPO_ENVIO"].lower()
            if tipo in resultado:
                resultado[tipo] = r["QTD"]

        return resultado

    # ============================
    # Inserção do log
    # ============================
    def registrar_log_envio(
        self,
        operador: str,
        id_cliente: int,
        numero_destino: str,
        tipo_envio: str,
        id_cedente: int,
        nm_cliente: str,
        nm_cedente: str,
        status_envio: str,
        response_raw: str
    ):
        query = """
            INSERT INTO WhatsAppEnvioLog (
                OPERADOR,
                ID_CLIENTE,
                NUMERO_DESTINO,
                TIPO_ENVIO,
                ID_CEDENTE,
                NM_CLIENTE,
                NM_CEDENTE,
                STATUS_ENVIO,
                RESPONSE_RAW
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """

        params = (
            operador,
            id_cliente,
            numero_destino,
            tipo_envio,
            id_cedente,
            nm_cliente,
            nm_cedente,
            status_envio,
            response_raw
        )

        self.executor.execute_commit(query=query, parametros=params)


    def contar_envios_total_diario(self) -> bool:
            query = """
                        SELECT COUNT(*) AS QTD
                        FROM WhatsAppEnvioLog
                        WHERE CAST(DATA_ENVIO AS DATE) = CAST(GETDATE() AS DATE)
                    """

            result = self.executor.execute_fetch(
                query=query,
                parametros=(),
                one=True
            )

            return False if result["QTD"] > 2000 else True
