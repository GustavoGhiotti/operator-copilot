import json
from src.infrastructure.database.sql_server_connection import SQLServerConnection
from src.shared.utils.env_load import DB_HOST_66

class IADesempenhoRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66, "DB_COPILOT_ACME")

    def _garantir_schema_chat(self,tx):
        tx.execute_commit(
            query="""
                IF OBJECT_ID('dbo.TB_CHAT_MENSAGENS_IA', 'U') IS NULL
                BEGIN
                    CREATE TABLE dbo.TB_CHAT_MENSAGENS_IA (
                        ID INT IDENTITY(1,1) PRIMARY KEY,
                        OPERADOR NVARCHAR(255) NOT NULL,
                        MENSAGEM NVARCHAR(MAX) NOT NULL,
                        IS_USER BIT NOT NULL,
                        CENTRO_CUSTO NVARCHAR(255) NULL,
                        CONVERSA_ID NVARCHAR(100) NULL,
                        DATA_MENSAGEM DATETIME NOT NULL DEFAULT GETDATE()
                    )
                END
            """,
            parametros=()
        )

        tx.execute_commit(
            query="""
                IF OBJECT_ID('dbo.TB_CHAT_MENSAGENS_IA', 'U') IS NOT NULL
                   AND COL_LENGTH('dbo.TB_CHAT_MENSAGENS_IA', 'CENTRO_CUSTO') IS NULL
                BEGIN
                    ALTER TABLE dbo.TB_CHAT_MENSAGENS_IA
                    ADD CENTRO_CUSTO NVARCHAR(255) NULL
                END
            """,
            parametros=()
        )

        tx.execute_commit(
            query="""
                IF OBJECT_ID('dbo.TB_CHAT_MENSAGENS_IA', 'U') IS NOT NULL
                   AND COL_LENGTH('dbo.TB_CHAT_MENSAGENS_IA', 'CONVERSA_ID') IS NULL
                BEGIN
                    ALTER TABLE dbo.TB_CHAT_MENSAGENS_IA
                    ADD CONVERSA_ID NVARCHAR(100) NULL
                END
            """,
            parametros=()
        )

        tx.execute_commit(
            query="""
                IF OBJECT_ID('dbo.TB_CHAT_MENSAGENS_IA', 'U') IS NOT NULL
                   AND COL_LENGTH('dbo.TB_CHAT_MENSAGENS_IA', 'DATA_MENSAGEM') IS NULL
                BEGIN
                    ALTER TABLE dbo.TB_CHAT_MENSAGENS_IA
                    ADD DATA_MENSAGEM DATETIME NULL
                END
            """,
            parametros=()
        )

        tx.execute_commit(
            query="""
                IF OBJECT_ID('dbo.TB_CHAT_MENSAGENS_IA', 'U') IS NOT NULL
                   AND COL_LENGTH('dbo.TB_CHAT_MENSAGENS_IA', 'DATA_MENSAGEM') IS NOT NULL
                BEGIN
                    UPDATE dbo.TB_CHAT_MENSAGENS_IA
                    SET DATA_MENSAGEM = GETDATE()
                    WHERE DATA_MENSAGEM IS NULL
                END
            """,
            parametros=()
        )

        tx.execute_commit(
            query="""
                IF OBJECT_ID('dbo.TB_CHAT_MENSAGENS_IA', 'U') IS NOT NULL
                   AND COL_LENGTH('dbo.TB_CHAT_MENSAGENS_IA', 'RESPOSTA_UTIL') IS NULL
                BEGIN
                    ALTER TABLE dbo.TB_CHAT_MENSAGENS_IA
                    ADD RESPOSTA_UTIL BIT NULL
                END
            """,
            parametros=()
        )

        tx.execute_commit(
            query="""
                IF OBJECT_ID('dbo.TB_CHAT_MENSAGENS_IA', 'U') IS NOT NULL
                   AND COL_LENGTH('dbo.TB_CHAT_MENSAGENS_IA', 'FEEDBACK_OPERADOR') IS NULL
                BEGIN
                    ALTER TABLE dbo.TB_CHAT_MENSAGENS_IA
                    ADD FEEDBACK_OPERADOR NVARCHAR(255) NULL
                END
            """,
            parametros=()
        )

        tx.execute_commit(
            query="""
                IF OBJECT_ID('dbo.TB_CHAT_MENSAGENS_IA', 'U') IS NOT NULL
                   AND COL_LENGTH('dbo.TB_CHAT_MENSAGENS_IA', 'DATA_FEEDBACK') IS NULL
                BEGIN
                    ALTER TABLE dbo.TB_CHAT_MENSAGENS_IA
                    ADD DATA_FEEDBACK DATETIME NULL
                END
            """,
            parametros=()
        )

        tx.execute_commit(
            query="""
                IF OBJECT_ID('dbo.TB_CHAT_MENSAGENS_IA', 'U') IS NOT NULL
                   AND COL_LENGTH('dbo.TB_CHAT_MENSAGENS_IA', 'DATA_MENSAGEM') IS NOT NULL
                BEGIN
                    ALTER TABLE dbo.TB_CHAT_MENSAGENS_IA
                    ALTER COLUMN DATA_MENSAGEM DATETIME NOT NULL
                END
            """,
            parametros=()
        )

        tx.execute_commit(
            query="""
                IF OBJECT_ID('dbo.TB_CHAT_MENSAGENS_IA', 'U') IS NOT NULL
                   AND COL_LENGTH('dbo.TB_CHAT_MENSAGENS_IA', 'DATA_MENSAGEM') IS NOT NULL
                   AND NOT EXISTS (
                        SELECT 1
                        FROM sys.default_constraints dc
                        INNER JOIN sys.columns c
                            ON c.object_id = dc.parent_object_id
                           AND c.column_id = dc.parent_column_id
                        WHERE dc.parent_object_id = OBJECT_ID('dbo.TB_CHAT_MENSAGENS_IA')
                          AND c.name = 'DATA_MENSAGEM'
                   )
                BEGIN
                    EXEC('ALTER TABLE dbo.TB_CHAT_MENSAGENS_IA ADD CONSTRAINT DF_TB_CHAT_MENSAGENS_IA_DATA_MENSAGEM DEFAULT GETDATE() FOR DATA_MENSAGEM')
                END
            """,
            parametros=()
        )

        tx.execute_commit(
            query="""
                IF OBJECT_ID('dbo.TB_CHAT_MENSAGENS_IA_ANALISE', 'U') IS NULL
                BEGIN
                    CREATE TABLE dbo.TB_CHAT_MENSAGENS_IA_ANALISE (
                        ID INT IDENTITY(1,1) PRIMARY KEY,
                        OPERADOR NVARCHAR(255) NOT NULL,
                        CARTEIRA NVARCHAR(255) NULL,
                        CONVERSA_ID NVARCHAR(100) NULL,
                        PERGUNTA NVARCHAR(MAX) NOT NULL,
                        TOPICO NVARCHAR(120) NOT NULL,
                        JUSTIFICATIVA NVARCHAR(500) NULL,
                        DATA_PERGUNTA DATETIME NOT NULL DEFAULT GETDATE()
                    )
                END
            """,
            parametros=()
        )

        tx.execute_commit(
            query="""
                IF OBJECT_ID('dbo.TB_CHAT_MENSAGENS_IA_ANALISE', 'U') IS NOT NULL
                   AND COL_LENGTH('dbo.TB_CHAT_MENSAGENS_IA_ANALISE', 'CONVERSA_ID') IS NULL
                BEGIN
                    ALTER TABLE dbo.TB_CHAT_MENSAGENS_IA_ANALISE
                    ADD CONVERSA_ID NVARCHAR(100) NULL
                END
            """,
            parametros=()
        )

    def buscar_historico_cliente(self,cpf: str):
        query = """
            SELECT DATA,NU_CPF_CNPJ,NM_ACAO,NM_USUARIO,VL_ACORDO
            FROM DB_REPORT.DM.TB_ACIONAMENTOS_V2 WITH(NOLOCK)
            WHERE DATA >= CAST(GETDATE()-30 AS DATE)
              AND NU_CPF_CNPJ = ?
            ORDER BY DT_ACAO ASC
        """
        result = self.db.execute_fetch(
            query=query,
            parametros=(cpf)
        )

        return [{
            "data":str(r['DATA']),
            "acao":r['NM_ACAO'],
            "usuario":r['NU_CPF_CNPJ'],
            "vl_acordo":float(r['VL_ACORDO'] or 0)
        } for r in result]

    def buscar_kpis(self,alvo: str):
        query = """
            SELECT
                SUM(A.VL_PAGO) AS TOTAL_PAGO,
                SUM(CASE WHEN A.PARCELA_PAGA IS NOT NULL THEN A.VL_RISCO END) TOTAL_RISCO_PAGO,
                SUM(A.VL_ENTRADA) AS TOTAL_ACORDO,
                COUNT(*) AS QTD_REGISTROS
            FROM INFORMACAO_PAGAMENTOS A WITH(NOLOCK)
            WHERE A.NU_PARCELA = 1
              AND A.NM_USUARIO LIKE ?
              AND (
                    (A.DATA >= DATEFROMPARTS(YEAR(GETDATE()),MONTH(GETDATE()),1)
                     AND A.DATA < DATEADD(MONTH,1,DATEFROMPARTS(YEAR(GETDATE()),MONTH(GETDATE()),1)))
                 OR (A.DATA_PAGO >= DATEFROMPARTS(YEAR(GETDATE()),MONTH(GETDATE()),1)
                     AND A.DATA_PAGO < DATEADD(MONTH,1,DATEFROMPARTS(YEAR(GETDATE()),MONTH(GETDATE()),1))
                     AND A.DATA < DATEFROMPARTS(YEAR(GETDATE()),MONTH(GETDATE()),1))
              )
        """

        result = self.db.execute_fetch(
            query=query,
            parametros=(f"%{alvo}%",),
            one=True
        )

        return {
            "total_pago":float(result["TOTAL_PAGO"] or 0),
            "total_risco_pago":float(result["TOTAL_RISCO_PAGO"] or 0),
            "total_acordo":float(result["TOTAL_ACORDO"] or 0),
            "qtd_registros":int(result["QTD_REGISTROS"] or 0)
        }

    def salvar_mensagem_bd(
        self,
        operador:str,
        mensagem:str,
        is_user,
        conversa_id:str | None = None,
        centro_custo:str | None = None
    ):
        query = """
                    INSERT INTO TB_CHAT_MENSAGENS_IA
                        (OPERADOR, MENSAGEM, IS_USER, CENTRO_CUSTO, CONVERSA_ID)
                    OUTPUT INSERTED.ID
                    VALUES
                        (?, ?, ?, ?, ?)
        """
        tx = self.db.begin_transaction()
        try:
            self._garantir_schema_chat(tx)
            result = tx.execute_insert_returning(
                query=query,
                parametros=(operador, mensagem, 1 if is_user else 0, centro_custo, conversa_id)
            )
            tx.commit()
            return result["ID"] if result else None
        finally:
            tx.close()

    def registrar_feedback_resposta(
        self,
        mensagem_id: int,
        operador: str,
        resposta_util: bool
    ):
        query = """
            UPDATE TB_CHAT_MENSAGENS_IA
            SET RESPOSTA_UTIL = ?,
                FEEDBACK_OPERADOR = ?,
                DATA_FEEDBACK = GETDATE()
            WHERE ID = ?
              AND IS_USER = 0
              AND OPERADOR = ?
        """
        tx = self.db.begin_transaction()
        try:
            self._garantir_schema_chat(tx)
            rowcount = tx.execute_commit(
                query=query,
                parametros=(1 if resposta_util else 0, operador, mensagem_id, operador),
                return_rowcount=True
            )
            tx.commit()
            return rowcount or 0
        finally:
            tx.close()

    def garantir_tabela_analise_perguntas(self):
        tx = self.db.begin_transaction()
        try:
            self._garantir_schema_chat(tx)
            tx.commit()
        finally:
            tx.close()

    def salvar_analise_pergunta(
        self,
        operador: str,
        carteira: str | None,
        conversa_id: str | None,
        pergunta: str,
        topico: str,
        justificativa: str | None = None
    ):
        tx = self.db.begin_transaction()
        query = """
            INSERT INTO TB_CHAT_MENSAGENS_IA_ANALISE
                (OPERADOR, CARTEIRA, CONVERSA_ID, PERGUNTA, TOPICO, JUSTIFICATIVA)
            VALUES
                (?, ?, ?, ?, ?, ?)
        """
        try:
            self._garantir_schema_chat(tx)
            tx.execute_commit(
                query=query,
                parametros=(operador, carteira, conversa_id, pergunta, topico, justificativa)
            )
            tx.commit()
        finally:
            tx.close()

    def listar_analises_perguntas(self):
        query = """
            SELECT
                OPERADOR,
                CARTEIRA,
                CONVERSA_ID,
                PERGUNTA,
                TOPICO,
                JUSTIFICATIVA,
                DATA_PERGUNTA
            FROM TB_CHAT_MENSAGENS_IA_ANALISE WITH(NOLOCK)
            ORDER BY DATA_PERGUNTA ASC
        """
        tx = self.db.begin_transaction()
        try:
            self._garantir_schema_chat(tx)
            return tx.execute_fetch(
                query=query,
                parametros=(),
                one=False
            ) or []
        finally:
            tx.close()

    def listar_analises_perguntas_periodo(self, data_inicio, data_fim):
        query = """
            SELECT
                OPERADOR,
                CARTEIRA,
                CONVERSA_ID,
                PERGUNTA,
                TOPICO,
                JUSTIFICATIVA,
                DATA_PERGUNTA
            FROM TB_CHAT_MENSAGENS_IA_ANALISE WITH(NOLOCK)
            WHERE DATA_PERGUNTA >= ?
              AND DATA_PERGUNTA < ?
            ORDER BY DATA_PERGUNTA ASC
        """
        tx = self.db.begin_transaction()
        try:
            self._garantir_schema_chat(tx)
            return tx.execute_fetch(
                query=query,
                parametros=(data_inicio, data_fim),
                one=False
            ) or []
        finally:
            tx.close()

    def listar_mensagens_ia(self):
        query = """
            SELECT
                ID,
                OPERADOR,
                MENSAGEM,
                IS_USER,
                CENTRO_CUSTO,
                CONVERSA_ID,
                DATA_MENSAGEM,
                RESPOSTA_UTIL,
                FEEDBACK_OPERADOR,
                DATA_FEEDBACK
            FROM TB_CHAT_MENSAGENS_IA WITH(NOLOCK)
            ORDER BY DATA_MENSAGEM ASC
        """
        tx = self.db.begin_transaction()
        try:
            self._garantir_schema_chat(tx)
            return tx.execute_fetch(
                query=query,
                parametros=(),
                one=False
            ) or []
        finally:
            tx.close()

    def listar_mensagens_ia_periodo(self, data_inicio, data_fim):
        query = """
            SELECT
                ID,
                OPERADOR,
                MENSAGEM,
                IS_USER,
                CENTRO_CUSTO,
                CONVERSA_ID,
                DATA_MENSAGEM,
                RESPOSTA_UTIL,
                FEEDBACK_OPERADOR,
                DATA_FEEDBACK
            FROM TB_CHAT_MENSAGENS_IA WITH(NOLOCK)
            WHERE DATA_MENSAGEM >= ?
              AND DATA_MENSAGEM < ?
            ORDER BY DATA_MENSAGEM ASC
        """
        tx = self.db.begin_transaction()
        try:
            self._garantir_schema_chat(tx)
            return tx.execute_fetch(
                query=query,
                parametros=(data_inicio, data_fim),
                one=False
            ) or []
        finally:
            tx.close()

    # Janela da heranca de carteira. Operador muda de carteira, entao herdar um
    # valor muito antigo erra mais do que acerta; alem disso a pergunta volta a
    # ficar sem carteira, que e o comportamento de hoje.
    DIAS_ULTIMA_CARTEIRA = 30

    def ultima_carteira_conhecida(self, operador: str):
        """Ultima carteira OLOS que o operador teve, dentro da janela."""
        nome = str(operador or "").strip()
        if not nome:
            return None

        query = """
            SELECT TOP 1 LTRIM(RTRIM(CENTRO_CUSTO)) AS CENTRO_CUSTO
            FROM TB_CHAT_MENSAGENS_IA WITH(NOLOCK)
            WHERE UPPER(LTRIM(RTRIM(OPERADOR))) = UPPER(LTRIM(RTRIM(?)))
              AND NULLIF(LTRIM(RTRIM(ISNULL(CENTRO_CUSTO, ''))), '') IS NOT NULL
              AND DATA_MENSAGEM >= DATEADD(DAY, -?, GETDATE())
            ORDER BY DATA_MENSAGEM DESC
        """
        linha = self.db.execute_fetch(
            query=query,
            parametros=(nome, self.DIAS_ULTIMA_CARTEIRA),
            one=True
        )
        return (linha or {}).get("CENTRO_CUSTO") or None

    def buscar_mensagens_conversa(self,conversa_id: str):
        query = """
            SELECT
                ID,
                OPERADOR,
                MENSAGEM,
                IS_USER,
                CENTRO_CUSTO,
                CONVERSA_ID,
                DATA_MENSAGEM,
                RESPOSTA_UTIL,
                FEEDBACK_OPERADOR,
                DATA_FEEDBACK
            FROM TB_CHAT_MENSAGENS_IA WITH(NOLOCK)
            WHERE CONVERSA_ID = ?
            ORDER BY
                DATA_MENSAGEM ASC,
                CASE WHEN IS_USER = 1 THEN 0 ELSE 1 END ASC
        """
        tx = self.db.begin_transaction()
        try:
            self._garantir_schema_chat(tx)
            return tx.execute_fetch(
                query=query,
                parametros=(conversa_id,),
                one=False
            ) or []
        finally:
            tx.close()


class IATreinamentoRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66, "DB_COPILOT_ACME")

    def salvar_mensagem(self,id_simulacao: int,tipo: str,mensagem: str):
        if not isinstance(id_simulacao, int):
            raise ValueError(f"ID inválido ao salvar mensagem: {id_simulacao} ({type(id_simulacao)})")

        query = """ 
            INSERT INTO TB_SIMULACAO_MENSAGEM (ID_SIMULACAO, ROLE, CONTEUDO)
            VALUES (?, ?, ?);
        """
        result = self.db.execute_commit(
            query=query,
            parametros=(id_simulacao,tipo,mensagem)
        )

        return result

    def finalizar_simulacao(self,feedback: dict,id_simulacao: int):
        query = """ 
            UPDATE TB_SIMULACAO_TREINAMENTO
            SET 
                DATA_FIM = GETDATE(),
                STATUS = 'FINALIZADA',
                FEEDBACK_FINAL = ?
            WHERE ID_SIMULACAO = ?;
        """
        result = self.db.execute_commit(
            query=query,
            parametros=(json.dumps(feedback),id_simulacao)
        )

        return result
    
    
class IAInsightsRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66,"DB_COPILOT_ACME")

    def buscar(self,centro_custo: str):
        query = """
        WITH OperadoresCarteira AS (
            SELECT NM_COLABORADOR
            FROM login.TB_USUARIOS WITH(NOLOCK)
            WHERE CENTRO_CUSTO = ?
        ),
        TABULACOES AS (
            SELECT CAST(T.DT_ACAO AS DATE) AS DIA,T.NM_USUARIO,COUNT(T.CPC) AS QTD_CPC
            FROM TB_TABULACOES_HOJE_66 T WITH(NOLOCK)
            INNER JOIN OperadoresCarteira O ON T.NM_USUARIO = O.NM_COLABORADOR
            WHERE T.DT_ACAO >= DATEADD(DAY,-6,CAST(GETDATE() AS DATE))
              AND T.CPC = 1
            GROUP BY CAST(T.DT_ACAO AS DATE),T.NM_USUARIO
        ),
        ACORDOS AS (
            SELECT CAST(A.DATA AS DATE) AS DIA,A.NM_USUARIO,
                   SUM(A.VL_PAGO) AS TOTAL_PAGO,
                   SUM(CASE WHEN A.PARCELA_PAGA IS NOT NULL THEN A.VL_RISCO END) AS TOTAL_RISCO_PAGO,
                   SUM(A.VL_ENTRADA) AS TOTAL_ACORDO,
                   COUNT(*) AS QTD_ACORDOS
            FROM INFORMACAO_PAGAMENTOS A WITH(NOLOCK)
            INNER JOIN OperadoresCarteira O ON A.NM_USUARIO = O.NM_COLABORADOR
            WHERE A.NU_PARCELA = 1
              AND A.DATA >= DATEADD(DAY,-6,CAST(GETDATE() AS DATE))
              AND A.DATA <= CAST(GETDATE() AS DATE)
            GROUP BY CAST(A.DATA AS DATE),A.NM_USUARIO
        )
        SELECT T.NM_USUARIO,T.DIA,T.QTD_CPC,
            ISNULL(A.QTD_ACORDOS,0)			AS QTD_ACORDOS,
            ISNULL(A.TOTAL_PAGO,0)			AS TOTAL_PAGO,
            ISNULL(A.TOTAL_RISCO_PAGO,0)	AS TOTAL_RISCO_PAGO,
            ISNULL(A.TOTAL_ACORDO,0)		AS TOTAL_ACORDO
        FROM TABULACOES T
        LEFT JOIN ACORDOS A ON T.NM_USUARIO = A.NM_USUARIO AND T.DIA = A.DIA
        ORDER BY T.NM_USUARIO,T.DIA
        """

        return self.db.execute_fetch(query=query,parametros=(centro_custo,),one=False)
