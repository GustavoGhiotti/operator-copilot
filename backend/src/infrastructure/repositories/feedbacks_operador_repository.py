from src.infrastructure.database.sql_server_connection import SQLServerConnection
from src.shared.utils.env_load import DB_HOST_66
from src.infrastructure.repositories.sql_admin_repository import expressao_call_id

class FeedbacksOperadorRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66, "DB_COPILOT_ACME")

    def buscar(self,operador: str):
        call_id = expressao_call_id(self.db)
        query = f"""
            IF COL_LENGTH('dbo.TB_FEEDBACK_QUALIDADE', 'CIENTE') IS NOT NULL
               AND COL_LENGTH('dbo.TB_FEEDBACK_QUALIDADE', 'TEMPO_LIGACAO_TOTAL') IS NOT NULL
            BEGIN
                SELECT
                    ID_FEEDBACK AS id,
                    MONITOR_NOME,
                    DATA_HORA,
                    ID_LIGACAO,
                    {call_id},
                    DESCRICAO,
                    PONTOS_POSITIVOS,
                    PONTOS_MELHORAR,
                    PONTUACAO,
                    IS_POSITIVO,
                    LIDO,
                    TEMPO_LIGACAO_TOTAL,
                    CIENTE,
                    CIENTE_EM
                FROM TB_FEEDBACK_QUALIDADE
                WHERE OPERADOR LIKE ?
                ORDER BY DATA_HORA DESC
            END
            ELSE IF COL_LENGTH('dbo.TB_FEEDBACK_QUALIDADE', 'CIENTE') IS NOT NULL
            BEGIN
                SELECT
                    ID_FEEDBACK AS id,
                    MONITOR_NOME,
                    DATA_HORA,
                    ID_LIGACAO,
                    {call_id},
                    DESCRICAO,
                    PONTOS_POSITIVOS,
                    PONTOS_MELHORAR,
                    PONTUACAO,
                    IS_POSITIVO,
                    LIDO,
                    CAST(NULL AS VARCHAR(20)) AS TEMPO_LIGACAO_TOTAL,
                    CIENTE,
                    CIENTE_EM
                FROM TB_FEEDBACK_QUALIDADE
                WHERE OPERADOR LIKE ?
                ORDER BY DATA_HORA DESC
            END
            ELSE IF COL_LENGTH('dbo.TB_FEEDBACK_QUALIDADE', 'TEMPO_LIGACAO_TOTAL') IS NOT NULL
            BEGIN
                SELECT
                    ID_FEEDBACK AS id,
                    MONITOR_NOME,
                    DATA_HORA,
                    ID_LIGACAO,
                    {call_id},
                    DESCRICAO,
                    PONTOS_POSITIVOS,
                    PONTOS_MELHORAR,
                    PONTUACAO,
                    IS_POSITIVO,
                    LIDO,
                    TEMPO_LIGACAO_TOTAL,
                    CAST(0 AS BIT) AS CIENTE,
                    CAST(NULL AS DATETIME) AS CIENTE_EM
                FROM TB_FEEDBACK_QUALIDADE
                WHERE OPERADOR LIKE ?
                ORDER BY DATA_HORA DESC
            END
            ELSE
            BEGIN
                SELECT
                    ID_FEEDBACK AS id,
                    MONITOR_NOME,
                    DATA_HORA,
                    ID_LIGACAO,
                    {call_id},
                    DESCRICAO,
                    PONTOS_POSITIVOS,
                    PONTOS_MELHORAR,
                    PONTUACAO,
                    IS_POSITIVO,
                    LIDO,
                    CAST(NULL AS VARCHAR(20)) AS TEMPO_LIGACAO_TOTAL,
                    CAST(0 AS BIT) AS CIENTE,
                    CAST(NULL AS DATETIME) AS CIENTE_EM
                FROM TB_FEEDBACK_QUALIDADE
                WHERE OPERADOR LIKE ?
                ORDER BY DATA_HORA DESC
            END
        """

        parametro = f"%{operador}%"
        return self.db.execute_fetch(
            query=query,
            parametros=(parametro,parametro,parametro,parametro),
            one=False
        )
