from src.infrastructure.database.sql_server_connection import SQLServerConnection
from src.shared.utils.env_load import DB_HOST_66
import json
import re

def expressao_call_id(db,tabela: str = "dbo.TB_FEEDBACK_QUALIDADE") -> str:
    """Retorna a expressão de SELECT do CALL_ID.

    A coluna só é criada em _garantir_schema_monitoria (primeiro insert após o
    deploy), então as consultas precisam tolerar bases que ainda não a possuem.
    """
    linha = db.execute_fetch(
        query="SELECT COL_LENGTH(?, 'CALL_ID') AS TAMANHO",
        parametros=(tabela,),
        one=True
    )

    if linha and linha.get("TAMANHO"):
        return "CALL_ID AS CALL_ID"

    return "CAST(NULL AS NVARCHAR(80)) AS CALL_ID"

class IdealOperadoresRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66,"DB_COPILOT_ACME")

    def listar(self):
        query = """
            SELECT
                NM_COLABORADOR,
                IDEAL_OPERADOR
            FROM IDEAL_OPERADOR WITH (NOLOCK)
        """

        return self.db.execute_fetch(query=query,parametros=(),one=False)

class MetasRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66,"DB_COPILOT_ACME")

    def buscar_ultima_alteracao(self,nome_colaborador: str):
        query = """
            SELECT TOP 1 DATA_ALTERACAO
            FROM TB_META_OPERADOR_HIST
            WHERE NOME_COLABORADOR = ?
            ORDER BY DATA_ALTERACAO DESC
        """

        row = self.db.execute_fetch(query=query,parametros=(nome_colaborador,),one=True)
        return row["DATA_ALTERACAO"] if row else None

    def atualizar_meta(self,nome_colaborador: str,nova_meta):
        query = """
            UPDATE IDEAL_OPERADOR
               SET IDEAL_OPERADOR = ?
             WHERE NM_COLABORADOR = ?
        """

        return self.db.execute_commit(
            query=query,
            parametros=(nova_meta,nome_colaborador)
        )

    def registrar_historico(self,nome_colaborador: str,nova_meta,supervisor: str):
        query = """
            INSERT INTO TB_META_OPERADOR_HIST
                (NOME_COLABORADOR,NOVA_META,DATA_ALTERACAO,SUPERVISOR)
            VALUES
                (?, ?, GETDATE(), ?)
        """

        return self.db.execute_commit(
            query=query,
            parametros=(nome_colaborador,nova_meta,supervisor)
        )

class SupervisaoRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66,"DB_COPILOT_ACME")

    def listar_por_supervisor(self,supervisor: str):
        query = """
            DECLARE @DataInicio DATE = DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1);
            DECLARE @DataFim DATE = DATEADD(MONTH, 1, @DataInicio);

            ;WITH PAGAMENTOS_MES AS (
                SELECT
                    NM_USUARIO,
                    CARTEIRA,
                    COUNT(ID_ACORDO)        AS TOTAL_ACORDO,
                    SUM(VL_RISCO)           AS TOTAL_RISCO,
                    SUM(VL_ENTRADA)         AS VALOR_ENTRADA
                FROM dbo.INFORMACAO_PAGAMENTOS WITH(NOLOCK)
                WHERE DATA >= @DataInicio
                AND DATA <  @DataFim
                GROUP BY NM_USUARIO, CARTEIRA
            ),
            CPC_DIA AS (
                SELECT 
                    NM_USUARIO,
                    SUM(CPC) AS CPC_DO_DIA
                FROM dbo.TB_TABULACOES_HOJE_66 WITH(NOLOCK)
                WHERE [DATA] = CAST(GETDATE() AS DATE)
                GROUP BY NM_USUARIO
            )

            SELECT 
                B.NM_COLABORADOR,
                B.SUPERVISOR,
                ISNULL(P.CARTEIRA,'-')           AS CARTEIRA,
                ISNULL(P.TOTAL_ACORDO,0)         AS TOTAL_ACORDO,
                ISNULL(P.TOTAL_RISCO,0)          AS TOTAL_RISCO,
                ISNULL(P.VALOR_ENTRADA,0)        AS VALOR_ENTRADA,
                B.IS_LOGADO,
                B.DT_ULTIMO_ACESSO,
                D.CPC_DO_DIA,
                ISNULL(C.IDEAL_OPERADOR,0)       AS IDEAL_OPERADOR
            FROM login.TB_USUARIOS B WITH(NOLOCK)

            LEFT JOIN PAGAMENTOS_MES P
                ON P.NM_USUARIO = B.NM_COLABORADOR

            LEFT JOIN dbo.IDEAL_OPERADOR C WITH(NOLOCK)
                ON C.NM_COLABORADOR = B.NM_COLABORADOR

            LEFT JOIN CPC_DIA D
                ON D.NM_USUARIO = B.NM_COLABORADOR

            WHERE B.SUPERVISOR LIKE ?

            ORDER BY
                B.SUPERVISOR,
                B.NM_COLABORADOR;
        """

        return self.db.execute_fetch(
            query=query,
            parametros=(f"{supervisor}%",),
            one=False
        )
    
class ResumoOperadorRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66,"DB_COPILOT_ACME")

    def listar_por_supervisor(self,nome_supervisor: str):
        query = """
            DECLARE @DataInicio DATE = CAST(DATEADD(DAY,-6,GETDATE()) AS DATE);
            DECLARE @DataFim DATE = CAST(GETDATE() AS DATE);

            ;WITH PARCELAS_FILTRADAS AS (
                SELECT
                    DATA,
                    NM_USUARIO,
                    CHAVE,
                    VL_ENTRADA,
                    VL_RISCO
                FROM TB_PARCELAS WITH(NOLOCK)
                WHERE NU_PARCELA = 1
                AND DATA >= @DataInicio
                AND DATA <= @DataFim
            ),
            PAGAMENTOS_CHAVE AS (
                SELECT
                    CHAVE,
                    SUM(VL_PAGO) AS VL_PAGO
                FROM dbo.INFORMACAO_PAGAMENTOS WITH(NOLOCK)
                GROUP BY CHAVE
            )

            SELECT 
                P.DATA,
                U.NM_COLABORADOR,
                U.SUPERVISOR,
                COUNT(*) AS TOTAL_REGISTROS,
                SUM(ISNULL(B.VL_PAGO,0)) AS TOTAL_PAGO,
                SUM(P.VL_ENTRADA) AS VALOR_ENTRADA,
                SUM(
                    CASE 
                        WHEN B.CHAVE IS NOT NULL THEN P.VL_RISCO 
                        ELSE 0 
                    END
                ) AS TOTAL_RISCO_PAGO
            FROM PARCELAS_FILTRADAS P

            INNER JOIN login.TB_USUARIOS U WITH(NOLOCK)
                ON P.NM_USUARIO = U.NM_COLABORADOR
                AND U.SUPERVISOR LIKE ?

            LEFT JOIN PAGAMENTOS_CHAVE B
                ON P.CHAVE = B.CHAVE

            GROUP BY 
                P.DATA,
                U.NM_COLABORADOR,
                U.SUPERVISOR

            ORDER BY 
                P.DATA DESC;
        """

        return self.db.execute_fetch(
            query=query,
            parametros=(f"{nome_supervisor}%",),
            one=False
        )

class TabulacoesRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66,"DB_COPILOT_ACME")

    def listar_por_supervisor(self,nome_supervisor: str):
        query = """
            ;WITH USUARIOS_SUPERVISOR AS (
                SELECT 
                    NM_COLABORADOR,
                    SUPERVISOR
                FROM login.TB_USUARIOS WITH(NOLOCK)
                WHERE SUPERVISOR LIKE ?
            )

            SELECT 
                T.NM_ACAO,
                COUNT(*) AS QUANTIDADE,
                U.SUPERVISOR,
                U.NM_COLABORADOR
            FROM TB_TABULACOES_HOJE_66 T WITH(NOLOCK)

            INNER JOIN USUARIOS_SUPERVISOR U
                ON T.NM_USUARIO = U.NM_COLABORADOR

            GROUP BY 
                T.NM_ACAO,
                U.SUPERVISOR,
                U.NM_COLABORADOR

            ORDER BY QUANTIDADE DESC;
        """

        return self.db.execute_fetch(
            query=query,
            parametros=(f"{nome_supervisor}%",),
            one=False
        )

class AtividadeRecenteRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66,"DB_COPILOT_ACME")

    def listar(self,nome_supervisor: str,nome_operador: str):
        query = """
            SELECT TOP 10
                T.NM_ACAO,
                T.DT_ACAO,
                T.DT_INICIO_ATENDIMENTO,
                TLOGIN.SUPERVISOR,
                TLOGIN.NM_COLABORADOR
            FROM TB_TABULACOES_HOJE_66 T WITH(NOLOCK)
            JOIN dbo.login.TB_USUARIOS TLOGIN WITH(NOLOCK)
                ON T.NM_USUARIO = TLOGIN.NM_COLABORADOR
            WHERE
                TLOGIN.SUPERVISOR LIKE ?
                AND TLOGIN.NM_COLABORADOR LIKE ?
            ORDER BY T.DT_ACAO DESC
        """

        return self.db.execute_fetch(
            query=query,
            parametros=(
                f"%{nome_supervisor}%",
                f"%{nome_operador}%"
            ),
            one=False
        )

class OperadoresRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66,"DB_COPILOT_ACME")

    def listar(self):
        # query = """
        #     SELECT 
        #         C.NM_COLABORADOR,
        #         A.USUARIO,
        #         A.SENHA,
        #         A.CPF_COLABORADOR
        #     FROM TB_LOGIN_COPILOT A
        #     JOIN [DB_CYBER_SEC].[dbo].[TB_USUARIOS_ACTIVE_DIRECTORY] B
        #         ON A.CPF_COLABORADOR = B.NU_CPF_COLABORADOR
        #     JOIN [DB_CYBER_SEC].[dbo].[TB_COLABORADORES_ATIVOS] C
        #         ON A.CPF_COLABORADOR = C.NU_CPF_COLABORADOR
        # """
        query = """
            SELECT 
                C.NM_COLABORADOR,
                A.SENHA,
                A.CPF_COLABORADOR
            FROM login.TB_USUARIOS A WITH(NOLOCK)
            JOIN [DB_CYBER_SEC].[dbo].[TB_USUARIOS_ACTIVE_DIRECTORY] B
                ON A.CPF_COLABORADOR = B.NU_CPF_COLABORADOR
            JOIN [DB_CYBER_SEC].[dbo].[TB_COLABORADORES_ATIVOS] C
                ON A.CPF_COLABORADOR = C.NU_CPF_COLABORADOR
        """

        return self.db.execute_fetch(query=query,parametros=(),one=False)

    def buscar_por_nome(self,nome: str):
        query = """
            SELECT
                A.CPF_COLABORADOR AS cpf,
                B.NM_COLABORADOR AS nome,
                A.FUNCAO_COLABORADOR AS centro_custo,
                A.CENTRO_CUSTO AS carteira
            FROM [login].[TB_USUARIOS] A 
            JOIN [DB_CYBER_SEC].[dbo].[TB_USUARIOS_ACTIVE_DIRECTORY] B 
                ON A.CPF_COLABORADOR = B.NU_CPF_COLABORADOR
            JOIN [DB_CYBER_SEC].[dbo].[TB_COLABORADORES_ATIVOS] C 
                ON A.CPF_COLABORADOR = C.NU_CPF_COLABORADOR
            WHERE B.NM_COLABORADOR LIKE ?
        """

        return self.db.execute_fetch(
            query=query,
            parametros=(f"%{nome}%",),
            one=False
        )

class FeedbackRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66,"DB_COPILOT_ACME")

    @staticmethod
    def _to_int(value,default=0):
        try:
            return int(value)
        except (TypeError,ValueError):
            return default

    @staticmethod
    def _to_float(value,default=0):
        try:
            return float(value)
        except (TypeError,ValueError):
            return default

    @staticmethod
    def _normalizar_coluna_item(item_id):
        base = re.sub(r"[^0-9A-Za-z_]+","_",str(item_id or "").strip())
        base = re.sub(r"_+","_",base).strip("_").upper()
        if not base:
            base = "SEM_ID"
        if base[0].isdigit():
            base = f"I_{base}"
        return f"ITEM_{base}"[:120]

    def _garantir_schema_monitoria(self,tx):
        colunas_feedback = [
            ("CPF_OPERADOR","NVARCHAR(20) NULL"),
            ("CARTEIRA_ID","NVARCHAR(80) NULL"),
            ("CARTEIRA_LABEL","NVARCHAR(150) NULL"),
            ("CANAL_ID","NVARCHAR(80) NULL"),
            ("CANAL_LABEL","NVARCHAR(150) NULL"),
            ("CHECKLIST_ID","NVARCHAR(120) NULL"),
            ("ID_CHECKLIST_CONFIG","INT NULL"),
            ("ID_CHECKLIST_VERSAO","INT NULL"),
            ("CHECKLIST_VERSAO","INT NULL"),
            ("NOTA_BASE","INT NULL"),
            ("NOTA_MAXIMA","INT NULL"),
            ("PENALIDADE_NCG","INT NULL"),
            ("ADERENCIA_PERCENTUAL","DECIMAL(5,2) NULL"),
            ("QTD_NCG","INT NULL"),
            ("CHECKLIST_JSON","NVARCHAR(MAX) NULL"),
            ("TEMPO_LIGACAO_TOTAL","NVARCHAR(20) NULL"),
            ("CALL_ID","NVARCHAR(80) NULL"),
        ]

        for nome,tipo in colunas_feedback:
            tx.execute_commit(
                query=f"""
                    IF COL_LENGTH('dbo.TB_FEEDBACK_QUALIDADE', '{nome}') IS NULL
                    BEGIN
                        ALTER TABLE dbo.TB_FEEDBACK_QUALIDADE
                        ADD {nome} {tipo}
                    END
                """,
                parametros=()
            )

        tx.execute_commit(
            query="""
                IF OBJECT_ID('dbo.TB_FEEDBACK_QUALIDADE_ITENS', 'U') IS NULL
                BEGIN
                    CREATE TABLE dbo.TB_FEEDBACK_QUALIDADE_ITENS (
                        ID_ITEM INT IDENTITY(1,1) PRIMARY KEY,
                        ID_FEEDBACK INT NOT NULL,
                        CHECKLIST_ID NVARCHAR(120) NULL,
                        CARTEIRA_ID NVARCHAR(80) NULL,
                        CARTEIRA_LABEL NVARCHAR(150) NULL,
                        CANAL_ID NVARCHAR(80) NULL,
                        CANAL_LABEL NVARCHAR(150) NULL,
                        BLOCO_ID NVARCHAR(120) NULL,
                        BLOCO_TITULO NVARCHAR(255) NULL,
                        ITEM_ID NVARCHAR(120) NULL,
                        ITEM_TITULO NVARCHAR(255) NULL,
                        ITEM_DESCRICAO NVARCHAR(MAX) NULL,
                        PESO INT NULL,
                        TIPO_ITEM NVARCHAR(30) NULL,
                        STATUS_RESPOSTA NVARCHAR(30) NULL,
                        CONFORME BIT NULL,
                        NCG_MARCADA BIT NOT NULL DEFAULT 0,
                        PONTOS_OBTIDOS INT NULL,
                        ORDEM_BLOCO INT NULL,
                        ORDEM_ITEM INT NULL,
                        DATA_REGISTRO DATETIME NOT NULL DEFAULT GETDATE()
                    )
                END
            """,
                parametros=()
            )

        tx.execute_commit(
            query="""
                IF OBJECT_ID('dbo.TB_FEEDBACK_QUALIDADE_RESPOSTAS', 'U') IS NULL
                BEGIN
                    CREATE TABLE dbo.TB_FEEDBACK_QUALIDADE_RESPOSTAS (
                        ID_FEEDBACK INT NOT NULL PRIMARY KEY,
                        OPERADOR NVARCHAR(255) NULL,
                        CPF_OPERADOR NVARCHAR(20) NULL,
                        DATA_HORA DATETIME NULL,
                        ID_LIGACAO NVARCHAR(80) NULL,
                        CALL_ID NVARCHAR(80) NULL,
                        MONITOR_NOME NVARCHAR(255) NULL,
                        CARTEIRA_ID NVARCHAR(80) NULL,
                        CARTEIRA_LABEL NVARCHAR(150) NULL,
                        CANAL_ID NVARCHAR(80) NULL,
                        CANAL_LABEL NVARCHAR(150) NULL,
                        CHECKLIST_ID NVARCHAR(120) NULL,
                        PONTUACAO INT NULL,
                        IS_POSITIVO BIT NULL,
                        TEMPO_LIGACAO_TOTAL NVARCHAR(20) NULL,
                        DATA_REGISTRO DATETIME NOT NULL DEFAULT GETDATE()
                    )
                END
            """,
            parametros=()
        )

        colunas_respostas = [
            ("OPERADOR","NVARCHAR(255) NULL"),
            ("CPF_OPERADOR","NVARCHAR(20) NULL"),
            ("DATA_HORA","DATETIME NULL"),
            ("ID_LIGACAO","NVARCHAR(80) NULL"),
            ("CALL_ID","NVARCHAR(80) NULL"),
            ("MONITOR_NOME","NVARCHAR(255) NULL"),
            ("CARTEIRA_ID","NVARCHAR(80) NULL"),
            ("CARTEIRA_LABEL","NVARCHAR(150) NULL"),
            ("CANAL_ID","NVARCHAR(80) NULL"),
            ("CANAL_LABEL","NVARCHAR(150) NULL"),
            ("CHECKLIST_ID","NVARCHAR(120) NULL"),
            ("PONTUACAO","INT NULL"),
            ("IS_POSITIVO","BIT NULL"),
            ("TEMPO_LIGACAO_TOTAL","NVARCHAR(20) NULL"),
            ("DATA_REGISTRO","DATETIME NULL"),
        ]

        for nome,tipo in colunas_respostas:
            tx.execute_commit(
                query=f"""
                    IF COL_LENGTH('dbo.TB_FEEDBACK_QUALIDADE_RESPOSTAS', '{nome}') IS NULL
                    BEGIN
                        ALTER TABLE dbo.TB_FEEDBACK_QUALIDADE_RESPOSTAS
                        ADD {nome} {tipo}
                    END
                """,
                parametros=()
            )

        colunas_itens = [
            ("ID_FEEDBACK","INT NULL"),
            ("CHECKLIST_ID","NVARCHAR(120) NULL"),
            ("CARTEIRA_ID","NVARCHAR(80) NULL"),
            ("CARTEIRA_LABEL","NVARCHAR(150) NULL"),
            ("CANAL_ID","NVARCHAR(80) NULL"),
            ("CANAL_LABEL","NVARCHAR(150) NULL"),
            ("BLOCO_ID","NVARCHAR(120) NULL"),
            ("BLOCO_TITULO","NVARCHAR(255) NULL"),
            ("ITEM_ID","NVARCHAR(120) NULL"),
            ("ITEM_TITULO","NVARCHAR(255) NULL"),
            ("ITEM_DESCRICAO","NVARCHAR(MAX) NULL"),
            ("PESO","INT NULL"),
            ("TIPO_ITEM","NVARCHAR(30) NULL"),
            ("STATUS_RESPOSTA","NVARCHAR(30) NULL"),
            ("CONFORME","BIT NULL"),
            ("NCG_MARCADA","BIT NOT NULL DEFAULT 0"),
            ("PONTOS_OBTIDOS","INT NULL"),
            ("DATA_REGISTRO","DATETIME NULL"),
            ("ORDEM_BLOCO","INT NULL"),
            ("ORDEM_ITEM","INT NULL"),
        ]

        for nome,tipo in colunas_itens:
            tx.execute_commit(
                query=f"""
                    IF COL_LENGTH('dbo.TB_FEEDBACK_QUALIDADE_ITENS', '{nome}') IS NULL
                    BEGIN
                        ALTER TABLE dbo.TB_FEEDBACK_QUALIDADE_ITENS
                        ADD {nome} {tipo}
                    END
                """,
                parametros=()
            )

    def _garantir_colunas_respostas_itens(self,tx,checklist_itens):
        colunas = []
        usadas = set()

        for item in checklist_itens:
            coluna = self._normalizar_coluna_item(item.get("item_id"))
            if coluna in usadas:
                continue
            usadas.add(coluna)
            colunas.append(coluna)

        for coluna in colunas:
            tx.execute_commit(
                query=f"""
                    IF COL_LENGTH('dbo.TB_FEEDBACK_QUALIDADE_RESPOSTAS', '{coluna}') IS NULL
                    BEGIN
                        ALTER TABLE dbo.TB_FEEDBACK_QUALIDADE_RESPOSTAS
                        ADD [{coluna}] NVARCHAR(20) NULL
                    END
                """,
                parametros=()
            )

        return colunas

    @staticmethod
    def _resolver_tempo_ligacao(row: dict) -> str | None:
        tempo = row.get("TEMPO_LIGACAO_TOTAL")
        if tempo:
            return str(tempo).strip()

        descricao = str(row.get("DESCRICAO") or "")
        match = re.search(
            r"Tempo total da ligação:\s*([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?)",
            descricao,
            re.IGNORECASE,
        )
        if match:
            return match.group(1).strip()

        return None

    def inserir(
        self,*,operador,data_hora,id_ligacao,descricao,
        pontos_positivos,pontos_melhorar,pontuacao,
        is_positivo,monitor_nome,caminho_audio,
        cpf_operador=None,carteira_id=None,carteira_label=None,
        canal_id=None,canal_label=None,checklist_id=None,
        checklist_config_id=None,checklist_version_id=None,checklist_version=None,
        nota_base=None,nota_maxima=None,penalidade_ncg=None,
        aderencia_percentual=None,quantidade_ncg=None,checklist_json=None,
        checklist_itens_json=None,
        tempo_ligacao_total=None,call_id=None
    ):
        try:
            checklist_itens = json.loads(checklist_itens_json or "[]")
        except (TypeError,ValueError):
            checklist_itens = []
        if not isinstance(checklist_itens,list):
            checklist_itens = []

        tx = self.db.begin_transaction()
        try:
            self._garantir_schema_monitoria(tx)

            resultado = tx.execute_insert_returning(
                query="""
                    INSERT INTO TB_FEEDBACK_QUALIDADE (
                        OPERADOR, DATA_HORA, ID_LIGACAO, DESCRICAO,
                        PONTOS_POSITIVOS, PONTOS_MELHORAR,
                        PONTUACAO, IS_POSITIVO, MONITOR_NOME, AUDIO_PATH,
                        CPF_OPERADOR, CARTEIRA_ID, CARTEIRA_LABEL,
                        CANAL_ID, CANAL_LABEL, CHECKLIST_ID,
                        ID_CHECKLIST_CONFIG, ID_CHECKLIST_VERSAO, CHECKLIST_VERSAO,
                        NOTA_BASE, NOTA_MAXIMA, PENALIDADE_NCG,
                        ADERENCIA_PERCENTUAL, QTD_NCG,
                        CHECKLIST_JSON, TEMPO_LIGACAO_TOTAL, CALL_ID
                    )
                    OUTPUT INSERTED.ID_FEEDBACK AS ID_FEEDBACK
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                parametros=(
                    operador,
                    data_hora,
                    id_ligacao,
                    descricao,
                    pontos_positivos,
                    pontos_melhorar,
                    pontuacao,
                    1 if str(is_positivo).lower()=="true" else 0,
                    monitor_nome,
                    caminho_audio,
                    cpf_operador,
                    carteira_id,
                    carteira_label,
                    canal_id,
                    canal_label,
                    checklist_id,
                    self._to_int(checklist_config_id) or None,
                    self._to_int(checklist_version_id) or None,
                    self._to_int(checklist_version) or None,
                    self._to_int(nota_base),
                    self._to_int(nota_maxima),
                    self._to_int(penalidade_ncg),
                    self._to_float(aderencia_percentual),
                    self._to_int(quantidade_ncg),
                    checklist_json,
                    tempo_ligacao_total,
                    call_id,
                )
            )

            feedback_id = resultado.get("ID_FEEDBACK") if resultado else None

            if feedback_id and checklist_itens:
                parametros_itens = []
                for item in checklist_itens:
                    parametros_itens.append((
                        feedback_id,
                        item.get("checklist_id") or checklist_id,
                        item.get("carteira_id") or carteira_id,
                        item.get("carteira_label") or carteira_label,
                        item.get("canal_id") or canal_id,
                        item.get("canal_label") or canal_label,
                        item.get("bloco_id"),
                        item.get("bloco_titulo"),
                        item.get("item_id"),
                        item.get("item_titulo"),
                        item.get("item_descricao"),
                        self._to_int(item.get("peso")),
                        item.get("tipo_item"),
                        item.get("status_resposta"),
                        None if item.get("conforme") is None else (1 if item.get("conforme") else 0),
                        1 if item.get("ncg_marcada") else 0,
                        self._to_int(item.get("pontos_obtidos")),
                        self._to_int(item.get("ordem_bloco")),
                        self._to_int(item.get("ordem_item")),
                    ))

                tx.execute_commit(
                    query="""
                        INSERT INTO TB_FEEDBACK_QUALIDADE_ITENS (
                            ID_FEEDBACK, CHECKLIST_ID, CARTEIRA_ID, CARTEIRA_LABEL,
                            CANAL_ID, CANAL_LABEL, BLOCO_ID, BLOCO_TITULO,
                            ITEM_ID, ITEM_TITULO, ITEM_DESCRICAO, PESO,
                            TIPO_ITEM, STATUS_RESPOSTA, CONFORME, NCG_MARCADA,
                            PONTOS_OBTIDOS, ORDEM_BLOCO, ORDEM_ITEM
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    parametros=parametros_itens
                )

            if feedback_id:
                colunas_item = self._garantir_colunas_respostas_itens(
                    tx,
                    checklist_itens
                )
                status_por_coluna = {
                    self._normalizar_coluna_item(item.get("item_id")): item.get("status_resposta")
                    for item in checklist_itens
                }

                colunas_base = [
                    "ID_FEEDBACK",
                    "OPERADOR",
                    "CPF_OPERADOR",
                    "DATA_HORA",
                    "ID_LIGACAO",
                    "CALL_ID",
                    "MONITOR_NOME",
                    "CARTEIRA_ID",
                    "CARTEIRA_LABEL",
                    "CANAL_ID",
                    "CANAL_LABEL",
                    "CHECKLIST_ID",
                    "PONTUACAO",
                    "IS_POSITIVO",
                    "TEMPO_LIGACAO_TOTAL",
                ]
                valores_base = [
                    feedback_id,
                    operador,
                    cpf_operador,
                    data_hora,
                    id_ligacao,
                    call_id,
                    monitor_nome,
                    carteira_id,
                    carteira_label,
                    canal_id,
                    canal_label,
                    checklist_id,
                    pontuacao,
                    1 if str(is_positivo).lower()=="true" else 0,
                    tempo_ligacao_total,
                ]
                colunas_insert = colunas_base + colunas_item
                valores_insert = valores_base + [
                    status_por_coluna.get(coluna) for coluna in colunas_item
                ]

                tx.execute_commit(
                    query=f"""
                        INSERT INTO TB_FEEDBACK_QUALIDADE_RESPOSTAS (
                            {", ".join(f"[{coluna}]" for coluna in colunas_insert)}
                        )
                        VALUES ({", ".join("?" for _ in colunas_insert)})
                    """,
                    parametros=tuple(valores_insert)
                )

            tx.commit()
        except Exception:
            tx.rollback()
            raise
        finally:
            tx.close()

    def buscar_detalhe(self,feedback_id:int,monitor_nome:str):
        call_id = expressao_call_id(self.db)
        query = f"""
            IF COL_LENGTH('dbo.TB_FEEDBACK_QUALIDADE', 'TEMPO_LIGACAO_TOTAL') IS NOT NULL
            BEGIN
                SELECT
                    ID_FEEDBACK,
                    OPERADOR,
                    DATA_HORA,
                    ID_LIGACAO,
                    {call_id},
                    DESCRICAO,
                    PONTOS_POSITIVOS,
                    PONTOS_MELHORAR,
                    PONTUACAO,
                    IS_POSITIVO,
                    LIDO,
                    AUDIO_PATH,
                    CARTEIRA_ID,
                    CARTEIRA_LABEL,
                    CANAL_ID,
                    CANAL_LABEL,
                    CHECKLIST_JSON,
                    TEMPO_LIGACAO_TOTAL
                FROM TB_FEEDBACK_QUALIDADE
                WHERE ID_FEEDBACK = ? AND MONITOR_NOME = ?
            END
            ELSE
            BEGIN
                SELECT
                    ID_FEEDBACK,
                    OPERADOR,
                    DATA_HORA,
                    ID_LIGACAO,
                    {call_id},
                    DESCRICAO,
                    PONTOS_POSITIVOS,
                    PONTOS_MELHORAR,
                    PONTUACAO,
                    IS_POSITIVO,
                    LIDO,
                    AUDIO_PATH,
                    CARTEIRA_ID,
                    CARTEIRA_LABEL,
                    CANAL_ID,
                    CANAL_LABEL,
                    CHECKLIST_JSON,
                    CAST(NULL AS VARCHAR(20)) AS TEMPO_LIGACAO_TOTAL
                FROM TB_FEEDBACK_QUALIDADE
                WHERE ID_FEEDBACK = ? AND MONITOR_NOME = ?
            END
        """

        resultado = self.db.execute_fetch(
            query=query,
            parametros=(feedback_id,monitor_nome,feedback_id,monitor_nome),
            one=True
        )

        if not resultado:
            return None

        return {
            "id":resultado["ID_FEEDBACK"],
            "operador":resultado["OPERADOR"],
            "data_hora":resultado["DATA_HORA"],
            "id_ligacao":resultado["ID_LIGACAO"],
            "call_id":resultado.get("CALL_ID"),
            "descricao":resultado["DESCRICAO"],
            "pontos_positivos":resultado["PONTOS_POSITIVOS"],
            "pontos_melhorar":resultado["PONTOS_MELHORAR"],
            "pontuacao":resultado["PONTUACAO"],
            "is_positivo":resultado["IS_POSITIVO"],
            "lido":resultado["LIDO"],
            "audio_path":resultado["AUDIO_PATH"],
            "tempo_ligacao_total":self._resolver_tempo_ligacao(resultado),
            "carteira_id":resultado.get("CARTEIRA_ID"),
            "carteira_label":resultado.get("CARTEIRA_LABEL"),
            "canal_id":resultado.get("CANAL_ID"),
            "canal_label":resultado.get("CANAL_LABEL"),
            "checklist_json":resultado.get("CHECKLIST_JSON")
        }

    def deletar_feedback(self,feedback_id,monitor_nome):
        query = """
            IF OBJECT_ID('dbo.TB_FEEDBACK_QUALIDADE_ITENS', 'U') IS NOT NULL
            BEGIN
                DELETE FROM TB_FEEDBACK_QUALIDADE_ITENS
                WHERE ID_FEEDBACK = ?
            END

            IF OBJECT_ID('dbo.TB_FEEDBACK_QUALIDADE_RESPOSTAS', 'U') IS NOT NULL
            BEGIN
                DELETE FROM TB_FEEDBACK_QUALIDADE_RESPOSTAS
                WHERE ID_FEEDBACK = ?
            END

            DELETE FROM TB_FEEDBACK_QUALIDADE
            WHERE ID_FEEDBACK = ? AND MONITOR_NOME = ?
        """

        resultado = self.db.execute_commit(
            query=query,
            parametros=(feedback_id,feedback_id,feedback_id,monitor_nome)
        )

        return not isinstance(resultado,Exception)

class FeedbacksRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66,"DB_COPILOT_ACME")

    @staticmethod
    def _resolver_tempo_ligacao(row: dict) -> str | None:
        tempo = row.get("TEMPO_LIGACAO_TOTAL")
        if tempo:
            return str(tempo).strip()

        descricao = str(row.get("DESCRICAO") or "")
        match = re.search(
            r"Tempo total da ligação:\s*([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?)",
            descricao,
            re.IGNORECASE,
        )
        if match:
            return match.group(1).strip()

        return None

    def listar_por_operador(self,operador: str):
        call_id = expressao_call_id(self.db)
        query = f"""
            IF COL_LENGTH('dbo.TB_FEEDBACK_QUALIDADE', 'TEMPO_LIGACAO_TOTAL') IS NOT NULL
            BEGIN
                SELECT
                    ID_FEEDBACK       AS ID,
                    MONITOR_NOME      AS MONITOR_NOME,
                    DATA_HORA         AS DATA_HORA,
                    ID_LIGACAO        AS ID_LIGACAO,
                    {call_id},
                    DESCRICAO         AS DESCRICAO,
                    PONTOS_POSITIVOS  AS PONTOS_POSITIVOS,
                    PONTOS_MELHORAR   AS PONTOS_MELHORAR,
                    PONTUACAO         AS PONTUACAO,
                    IS_POSITIVO       AS IS_POSITIVO,
                    LIDO              AS LIDO,
                    AUDIO_PATH        AS AUDIO_PATH,
                    TEMPO_LIGACAO_TOTAL AS TEMPO_LIGACAO_TOTAL
                FROM TB_FEEDBACK_QUALIDADE WITH(NOLOCK)
                WHERE OPERADOR = ?
                ORDER BY DATA_HORA DESC
            END
            ELSE
            BEGIN
                SELECT
                    ID_FEEDBACK       AS ID,
                    MONITOR_NOME      AS MONITOR_NOME,
                    DATA_HORA         AS DATA_HORA,
                    ID_LIGACAO        AS ID_LIGACAO,
                    {call_id},
                    DESCRICAO         AS DESCRICAO,
                    PONTOS_POSITIVOS  AS PONTOS_POSITIVOS,
                    PONTOS_MELHORAR   AS PONTOS_MELHORAR,
                    PONTUACAO         AS PONTUACAO,
                    IS_POSITIVO       AS IS_POSITIVO,
                    LIDO              AS LIDO,
                    AUDIO_PATH        AS AUDIO_PATH,
                    CAST(NULL AS VARCHAR(20)) AS TEMPO_LIGACAO_TOTAL
                FROM TB_FEEDBACK_QUALIDADE WITH(NOLOCK)
                WHERE OPERADOR = ?
                ORDER BY DATA_HORA DESC
            END
        """

        rows = self.db.execute_fetch(query=query,parametros=(operador,operador),one=False)

        if not rows:
            return []

        return [
            {
                "id":row.get("ID"),
                "monitor_nome":row.get("MONITOR_NOME"),
                "data_hora":row.get("DATA_HORA"),
                "id_ligacao":row.get("ID_LIGACAO"),
                "call_id":row.get("CALL_ID"),
                "descricao":row.get("DESCRICAO"),
                "pontos_positivos":row.get("PONTOS_POSITIVOS"),
                "pontos_melhorar":row.get("PONTOS_MELHORAR"),
                "pontuacao":row.get("PONTUACAO"),
                "is_positivo":bool(row.get("IS_POSITIVO")),
                "lido":bool(row.get("LIDO")),
                "audio_path":row.get("AUDIO_PATH"),
                "tempo_ligacao_total":self._resolver_tempo_ligacao(row)
            }
            for row in rows
        ]

    def marcar_como_lido(self,feedback_id:int,operador:str):
        query = """
            UPDATE TB_FEEDBACK_QUALIDADE
            SET LIDO = 1
            WHERE ID_FEEDBACK = ? AND OPERADOR = ?
        """

        return self.db.execute_commit(
            query=query,
            parametros=(feedback_id,operador)
        )

    def registrar_ciencia(self,feedback_id:int,operador:str,cpf_operador:str):
        query = """
            UPDATE TB_FEEDBACK_QUALIDADE
            SET
                CIENTE = 1,
                CIENTE_EM = GETDATE(),
                CIENTE_CPF = ?
            WHERE ID_FEEDBACK = ? AND OPERADOR = ?
        """

        return self.db.execute_commit(
            query=query,
            parametros=(cpf_operador,feedback_id,operador)
        )

    def estatisticas_por_monitor(self,monitor_nome: str):
        query = """
            SELECT
                COUNT(*) AS TOTAL_ENVIADOS,
                SUM(CASE WHEN LIDO = 1 THEN 1 ELSE 0 END) AS TOTAL_LIDOS,
                SUM(CASE WHEN IS_POSITIVO = 1 THEN 1 ELSE 0 END) AS TOTAL_POSITIVOS,
                SUM(CASE WHEN IS_POSITIVO = 0 THEN 1 ELSE 0 END) AS TOTAL_NEGATIVOS
            FROM TB_FEEDBACK_QUALIDADE WITH(NOLOCK)
            WHERE MONITOR_NOME = ?
        """

        return self.db.execute_fetch(
            query=query,
            parametros=(monitor_nome,),
            one=True
        )

    def listar_analytics_monitores_teleatendimento(self):
        query = """
            ;WITH MONITORES AS (
                SELECT DISTINCT
                    UPPER(LTRIM(RTRIM(NM_COLABORADOR))) AS MONITOR_CHAVE,
                    LTRIM(RTRIM(NM_COLABORADOR)) AS MONITOR_NOME
                FROM login.TB_USUARIOS WITH(NOLOCK)
                WHERE LOWER(ISNULL(FUNCAO_COLABORADOR,'')) LIKE '%monitor de teleatendimento%'
                  AND ISNULL(NM_COLABORADOR,'') <> ''
            )
            SELECT
                M.MONITOR_NOME,
                F.ID_FEEDBACK,
                F.DATA_HORA,
                F.DATA_REGISTRO,
                F.PONTUACAO,
                F.IS_POSITIVO
            FROM MONITORES M
            LEFT JOIN dbo.TB_FEEDBACK_QUALIDADE F WITH(NOLOCK)
                ON UPPER(LTRIM(RTRIM(F.MONITOR_NOME))) = M.MONITOR_CHAVE
            ORDER BY
                M.MONITOR_NOME,
                F.DATA_REGISTRO DESC
        """

        return self.db.execute_fetch(
            query=query,
            parametros=(),
            one=False
        ) or []

    def listar_analytics_wallet(self,wallet_id:str,canal_id:str | None = None):
        query = """
            IF COL_LENGTH('dbo.TB_FEEDBACK_QUALIDADE', 'CARTEIRA_ID') IS NOT NULL
            BEGIN
                SELECT
                    ID_FEEDBACK,
                    OPERADOR,
                    CPF_OPERADOR,
                    DATA_HORA,
                    DATA_REGISTRO,
                    PONTUACAO,
                    CHECKLIST_JSON,
                    CARTEIRA_ID,
                    CARTEIRA_LABEL,
                    CANAL_ID,
                    CANAL_LABEL
                FROM TB_FEEDBACK_QUALIDADE WITH(NOLOCK)
                WHERE CARTEIRA_ID = ?
                  AND (? = '' OR CANAL_ID = ?)
                ORDER BY DATA_REGISTRO ASC
            END
        """

        return self.db.execute_fetch(
            query=query,
            parametros=(wallet_id,canal_id or "",canal_id or ""),
            one=False
        ) or []

    def listar_analytics_operador(self,wallet_id:str,cpf_operador:str,canal_id:str | None = None):
        query = """
            IF COL_LENGTH('dbo.TB_FEEDBACK_QUALIDADE', 'CARTEIRA_ID') IS NOT NULL
            BEGIN
                SELECT
                    ID_FEEDBACK,
                    OPERADOR,
                    CPF_OPERADOR,
                    DATA_HORA,
                    DATA_REGISTRO,
                    PONTUACAO,
                    CHECKLIST_JSON,
                    CARTEIRA_ID,
                    CARTEIRA_LABEL,
                    CANAL_ID,
                    CANAL_LABEL
                FROM TB_FEEDBACK_QUALIDADE WITH(NOLOCK)
                WHERE CARTEIRA_ID = ?
                  AND CPF_OPERADOR = ?
                  AND (? = '' OR CANAL_ID = ?)
                ORDER BY DATA_REGISTRO ASC
            END
        """

        return self.db.execute_fetch(
            query=query,
            parametros=(wallet_id,cpf_operador,canal_id or "",canal_id or ""),
            one=False
        ) or []

    def listar_operadores_analytics_wallet(self,wallet_id:str,canal_id:str | None = None):
        query = """
            IF COL_LENGTH('dbo.TB_FEEDBACK_QUALIDADE', 'CARTEIRA_ID') IS NOT NULL
            BEGIN
                SELECT
                    CPF_OPERADOR AS CPF_OPERADOR,
                    OPERADOR AS OPERADOR,
                    COUNT(*) AS TOTAL_FEEDBACKS,
                    AVG(CAST(PONTUACAO AS FLOAT)) AS MEDIA_PONTUACAO
                FROM TB_FEEDBACK_QUALIDADE WITH(NOLOCK)
                WHERE CARTEIRA_ID = ?
                  AND CPF_OPERADOR IS NOT NULL
                  AND LTRIM(RTRIM(CPF_OPERADOR)) <> ''
                  AND (? = '' OR CANAL_ID = ?)
                GROUP BY CPF_OPERADOR, OPERADOR
                ORDER BY OPERADOR
            END
        """

        return self.db.execute_fetch(
            query=query,
            parametros=(wallet_id,canal_id or "",canal_id or ""),
            one=False
        ) or []
    
    def listar_recentes_por_monitor(self,monitor_nome: str):
        call_id = expressao_call_id(self.db)
        query = f"""
            IF COL_LENGTH('dbo.TB_FEEDBACK_QUALIDADE', 'TEMPO_LIGACAO_TOTAL') IS NOT NULL
            BEGIN
                SELECT
                    ID_FEEDBACK  AS ID,
                    OPERADOR     AS OPERADOR,
                    DATA_HORA    AS DATA_HORA,
                    IS_POSITIVO  AS IS_POSITIVO,
                    LIDO         AS LIDO,
                    DESCRICAO    AS DESCRICAO,
                    ID_LIGACAO   AS ID_LIGACAO,
                    {call_id},
                    PONTUACAO    AS PONTUACAO,
                    TEMPO_LIGACAO_TOTAL AS TEMPO_LIGACAO_TOTAL
                FROM TB_FEEDBACK_QUALIDADE WITH(NOLOCK)
                WHERE MONITOR_NOME = ?
                ORDER BY DATA_HORA DESC
            END
            ELSE
            BEGIN
                SELECT
                    ID_FEEDBACK  AS ID,
                    OPERADOR     AS OPERADOR,
                    DATA_HORA    AS DATA_HORA,
                    IS_POSITIVO  AS IS_POSITIVO,
                    LIDO         AS LIDO,
                    DESCRICAO    AS DESCRICAO,
                    ID_LIGACAO   AS ID_LIGACAO,
                    {call_id},
                    PONTUACAO    AS PONTUACAO,
                    CAST(NULL AS VARCHAR(20)) AS TEMPO_LIGACAO_TOTAL
                FROM TB_FEEDBACK_QUALIDADE WITH(NOLOCK)
                WHERE MONITOR_NOME = ?
                ORDER BY DATA_HORA DESC
            END
        """

        rows = self.db.execute_fetch(
            query=query,
            parametros=(monitor_nome,monitor_nome),
            one=False
        )

        if not rows:
            return []

        return [
            {
                "id":row.get("ID"),
                "operador":row.get("OPERADOR"),
                "data_hora":row.get("DATA_HORA"),
                "is_positivo":bool(row.get("IS_POSITIVO")),
                "lido":bool(row.get("LIDO")),
                "descricao":row.get("DESCRICAO"),
                "id_ligacao":row.get("ID_LIGACAO"),
                "call_id":row.get("CALL_ID"),
                "tempo_ligacao_total":self._resolver_tempo_ligacao(row),
                "pontuacao":row.get("PONTUACAO")
            }
            for row in rows
        ]
