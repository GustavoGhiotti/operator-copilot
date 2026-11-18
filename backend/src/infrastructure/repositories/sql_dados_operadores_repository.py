from src.infrastructure.database.sql_server_connection import SQLServerConnection
from src.shared.utils.env_load import DB_HOST_66

class DadosOperadoresRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66, database="DB_COPILOT_ACME")
    def buscar_dados_operadores(self, nome_like: str):
        """Retorna todos os dados crus do SQL."""
        query = """
                    SELECT 
                        FORMAT(DATA, 'yyyy-MM-dd') AS DIA,
                        DATEPART(WEEK, DATA) AS SEMANA, 
                        FORMAT(DATA, 'yyyy-MM') AS MES,
                        CARTEIRA,  
                        NM_USUARIO AS OPERADOR,
                        COUNT(a.ID_CLIENTE) AS QUANTIDADE, 
                        SUM(VL_ENTRADA) AS VALOR_ENTRADA,
                        SUM(VL_PARCELA) AS VALOR_PARCELA
                    FROM TB_PARCELAS a WITH(NOLOCK)
                    WHERE 1=1 
                        AND NM_USUARIO IS NOT NULL 
                        AND GRUPO IS NOT NULL
                        AND DATA >= DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1)
                        AND NM_USUARIO LIKE ?
                        AND nu_parcela = 1
                    GROUP BY 
                        FORMAT(DATA, 'yyyy-MM-dd'), 
                        DATEPART(WEEK, DATA), 
                        FORMAT(DATA, 'yyyy-MM'), 
                        CARTEIRA, 
                        NM_USUARIO
                    ORDER BY 
                        DIA, 
                        CARTEIRA, 
                        NM_USUARIO;
                """

        return self.db.execute_fetch(
            query=query,
            parametros=(nome_like,),
            one=False
        )
        
    def obter_carteira_atualizada(self, id_olos_cx: str, id_olos_cob: str):
        try:
            query = """  
                EXEC [dbo].[SP_VERIFICA_CARTEIRA_COPILOT] 
                    @ID_OLOS_CX = ?,
                    @ID_OLOS_COB = ?
            """

            return self.db.execute_fetch(
                query=query,
                parametros=(id_olos_cx, id_olos_cob),
                one=False
            )
        except Exception as e:
            print(f"Erro ao obter carteira atualizada: {e}")
            return None

class EstatisticasOperadorRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66, "DB_COPILOT_ACME")

    def buscar(self,usuario: str):
        query = """
            SELECT DATA_LOGIN,HORA_LOGIN
            FROM TB_LOG_ACESSO_COPILOT WITH(NOLOCK)
            WHERE UPPER(NOME_COLABORADOR) LIKE ?
            ORDER BY DATA_LOGIN ASC,HORA_LOGIN ASC
        """

        return self.db.execute_fetch(query=query,parametros=(f"%{usuario}%",),one=False)


class FeedbackResultadoRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66,"DB_COPILOT_ACME")

    def buscar_feedback_cache(self,operador: str,data):
        query = """
            SELECT FEEDBACK
            FROM TB_FEEDBACK_IA WITH(NOLOCK)
            WHERE OPERADOR = ? AND DATA = ?
        """

        resultado = self.db.execute_fetch(query=query,parametros=(operador,data),one=True)

        return resultado.get("FEEDBACK") if resultado else None

    def buscar_efetividade_carteira(self,centro_custo: str):
        if "mu" in centro_custo.lower() or "pi" in centro_custo.lower():
            query = """
                SELECT
                    COUNT(*) AS QTD_ACORDOS,
                    COUNT(DISTINCT B.NM_COLABORADOR) AS QTD_OPERADORES,
                    SUM(ISNULL(A.VL_RISCO, 0)) AS TOTAL_FECHADO,
                    SUM(ISNULL(A.VL_RISCO_PAGO, 0)) AS TOTAL_PAGO
                FROM dbo.INFORMACAO_PAGAMENTOS A WITH(NOLOCK)
                LEFT JOIN login.TB_USUARIOS B WITH(NOLOCK)
                    ON A.NM_USUARIO = B.NM_COLABORADOR
                WHERE A.NU_PARCELA = 1 AND B.CENTRO_CUSTO LIKE ?
            """
        else:
            query = """
                SELECT
                    COUNT(*) AS QTD_ACORDOS,
                    COUNT(DISTINCT B.NM_COLABORADOR) AS QTD_OPERADORES,
                    SUM(ISNULL(A.VL_ENTRADA, 0)) AS TOTAL_FECHADO,
                    SUM(ISNULL(A.VL_PAGO, 0)) AS TOTAL_PAGO
                FROM dbo.INFORMACAO_PAGAMENTOS A WITH(NOLOCK)
                LEFT JOIN login.TB_USUARIOS B WITH(NOLOCK)
                    ON A.NM_USUARIO = B.NM_COLABORADOR
                WHERE A.NU_PARCELA = 1 AND B.CENTRO_CUSTO LIKE ?
            """

        resultado = self.db.execute_fetch(query=query,parametros=(f"%{centro_custo}%",),one=True)

        return resultado

    def salvar_feedback(self,operador: str,centro_custo: str,data,feedback: str):
        query = """
            INSERT INTO TB_FEEDBACK_IA (OPERADOR,CENTRO_CUSTO,DATA,FEEDBACK)
            VALUES (?,?,?,?)
        """

        self.db.execute_commit(query=query,parametros=(operador,centro_custo,data,feedback))

class ResultadoCPCRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66, "DB_COPILOT_ACME")

    def buscar(self, cpf_operador: str):
        query = """
                SELECT 
                    ISNULL(SUM(TRY_CONVERT(int, CPC)), 0) AS total_cpc, 
                    ISNULL(SUM(TRY_CONVERT(int, CE)), 0) AS ce_do_dia, 
                    COUNT(*) AS acionamento
                FROM dbo.TB_TABULACOES_HOJE_66 T WITH(NOLOCK)
                INNER JOIN login.TB_USUARIOS U WITH(NOLOCK)
                    ON (
                        UPPER(LTRIM(RTRIM(T.NM_USUARIO))) =
                            UPPER(LTRIM(RTRIM(U.NM_COLABORADOR)))
                        OR UPPER(LTRIM(RTRIM(T.NM_USUARIO))) LIKE
                            '%' + UPPER(LTRIM(RTRIM(U.NM_COLABORADOR))) + '%'
                        OR UPPER(LTRIM(RTRIM(U.NM_COLABORADOR))) LIKE
                            '%' + UPPER(LTRIM(RTRIM(T.NM_USUARIO))) + '%'
                    )
                WHERE U.CPF_COLABORADOR = ?
                  AND T.[DATA] = CAST(GETDATE() AS DATE)
            """

        return self.db.execute_fetch(query=query, parametros=(cpf_operador,), one=False)
    

class ResultadoRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66, "DB_COPILOT_ACME")

    def buscar(self, cpf_operador: str,agrupamento: str):

        query = f"""
            SELECT 
            {agrupamento} AS agrupamento,
                A.DATA,
                A.HORA,
                A.HORARIO,
                A.TURNO,
                A.ID_CEDENTE,
                A.CARTEIRA,
                A.GRUPO,
                A.SUB_GRUPO,
                A.PRODUTO,
                A.SUB_PRODUTO,
                A.FAIXA_CONTRATANTE,
                A.ID_CLIENTE,
                A.ID_ACORDO,
                A.ID_CONTRATO,
                A.CPF_CNPJ_INT,
                A.ID_EQUIPE,
                A.ID_USUARIO,
                A.TP_STATUS,
                A.NU_PLANO,
                A.NU_PARCELA,
                A.DT_VENCIMENTO,
                A.VL_ENTRADA,
                A.VL_PARCELA,
                A.VL_ACORDO,
                A.VL_RISCO,
                A.VL_DESCONTO_PRINCIPAL,
                A.VL_RECEITA,
                A.VL_REPASSE,
                A.VL_DIVIDA,
                A.DT_CANCELAMENTO,
                A.ATRASO,
                A.NM_EQUIPE,
                A.TP_EQUIPE,
                A.NU_IP_CONEXAO,
                A.TP_CONEXAO,
                A.TP_TURNO_OPERADOR,
                A.NM_USUARIO,
                A.LINHA_DIGITAVEL,
                A.PIX,
                A.DT_ATUALIZACAO,
                A.DT_HR_ATUALIZACAO,
                A.MES,
                A.ANO,
                A.DATA_PAGO,
                A.PARCELA_PAGA,
                A.VL_PAGO,
                CASE WHEN PARCELA_PAGA IS NOT NULL THEN A.VL_RISCO END AS VL_RISCO_PAGO,
                A.VL_HO
        FROM dbo.INFORMACAO_PAGAMENTOS A WITH(NOLOCK)
        INNER JOIN login.TB_USUARIOS U WITH(NOLOCK)
            ON (
                UPPER(LTRIM(RTRIM(A.NM_USUARIO))) =
                    UPPER(LTRIM(RTRIM(U.NM_COLABORADOR)))
                OR UPPER(LTRIM(RTRIM(A.NM_USUARIO))) LIKE
                    '%' + UPPER(LTRIM(RTRIM(U.NM_COLABORADOR))) + '%'
                OR UPPER(LTRIM(RTRIM(U.NM_COLABORADOR))) LIKE
                    '%' + UPPER(LTRIM(RTRIM(A.NM_USUARIO))) + '%'
            )
        WHERE 
            A.NU_PARCELA = 1
            AND U.CPF_COLABORADOR = ?
            AND (
                (
                    A.DATA >= DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1)
                    AND A.DATA < DATEADD(MONTH, 1, DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1))
                )
                OR
                (
                    A.DATA_PAGO >= DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1)
                    AND A.DATA_PAGO < DATEADD(MONTH, 1, DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1)) 
                    AND A.DATA < DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1)
                )
            );
        """
        result = self.db.execute_fetch(
            query=query,
            parametros=(cpf_operador,),
            one=False,
        )
        return result
