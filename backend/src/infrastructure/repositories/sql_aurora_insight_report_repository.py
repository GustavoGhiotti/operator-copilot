from datetime import datetime, timedelta

from src.infrastructure.database.sql_server_connection import SQLServerConnection
from src.shared.utils.env_load import DB_HOST_66


class AuroraInsightReportExecutionRepository:
    REPORT_TYPE = "AURORA_INSIGHT_DIARIO"

    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66, "DB_COPILOT_ACME")

    def _garantir_schema(self, tx):
        tx.execute_commit(
            query="""
                IF OBJECT_ID('dbo.TB_AURORA_INSIGHT_EMAIL_EXECUCAO', 'U') IS NULL
                BEGIN
                    CREATE TABLE dbo.TB_AURORA_INSIGHT_EMAIL_EXECUCAO (
                        ID BIGINT IDENTITY(1,1) PRIMARY KEY,
                        TIPO_RELATORIO VARCHAR(80) NOT NULL,
                        DATA_RELATORIO DATE NOT NULL,
                        CHAVE_DESTINATARIOS CHAR(64) NOT NULL,
                        DESTINATARIOS NVARCHAR(1000) NOT NULL,
                        STATUS VARCHAR(20) NOT NULL,
                        MESSAGE_ID NVARCHAR(255) NULL,
                        ERRO NVARCHAR(2000) NULL,
                        TENTATIVAS INT NOT NULL DEFAULT 1,
                        CRIADO_EM DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
                        ATUALIZADO_EM DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
                        CONSTRAINT UQ_AURORA_INSIGHT_EMAIL_EXECUCAO
                            UNIQUE (TIPO_RELATORIO, DATA_RELATORIO, CHAVE_DESTINATARIOS)
                    )
                END
            """,
            parametros=()
        )

    def adquirir_execucao(
        self,
        *,
        data_relatorio,
        chave_destinatarios: str,
        destinatarios: str,
        forcar: bool = False,
        timeout_minutos: int = 30,
    ) -> bool:
        tx = self.db.begin_transaction()
        try:
            self._garantir_schema(tx)
            row = tx.execute_fetch(
                query="""
                    SELECT ID, STATUS, ATUALIZADO_EM
                    FROM dbo.TB_AURORA_INSIGHT_EMAIL_EXECUCAO
                        WITH(UPDLOCK, HOLDLOCK)
                    WHERE TIPO_RELATORIO = ?
                      AND DATA_RELATORIO = ?
                      AND CHAVE_DESTINATARIOS = ?
                """,
                parametros=(
                    self.REPORT_TYPE,
                    data_relatorio,
                    chave_destinatarios,
                ),
                one=True,
            )

            if row:
                status = str(row.get("STATUS") or "").upper()
                atualizado_em = row.get("ATUALIZADO_EM")
                em_processamento_recente = (
                    status == "PROCESSANDO"
                    and atualizado_em
                    and atualizado_em > datetime.now() - timedelta(minutes=timeout_minutos)
                )
                if not forcar and (status == "ENVIADO" or em_processamento_recente):
                    tx.commit()
                    return False

                tx.execute_commit(
                    query="""
                        UPDATE dbo.TB_AURORA_INSIGHT_EMAIL_EXECUCAO
                        SET STATUS = 'PROCESSANDO',
                            DESTINATARIOS = ?,
                            MESSAGE_ID = NULL,
                            ERRO = NULL,
                            TENTATIVAS = TENTATIVAS + 1,
                            ATUALIZADO_EM = SYSDATETIME()
                        WHERE ID = ?
                    """,
                    parametros=(destinatarios, row["ID"]),
                )
            else:
                tx.execute_commit(
                    query="""
                        INSERT INTO dbo.TB_AURORA_INSIGHT_EMAIL_EXECUCAO (
                            TIPO_RELATORIO,
                            DATA_RELATORIO,
                            CHAVE_DESTINATARIOS,
                            DESTINATARIOS,
                            STATUS
                        )
                        VALUES (?, ?, ?, ?, 'PROCESSANDO')
                    """,
                    parametros=(
                        self.REPORT_TYPE,
                        data_relatorio,
                        chave_destinatarios,
                        destinatarios,
                    ),
                )

            tx.commit()
            return True
        except Exception:
            tx.rollback()
            raise
        finally:
            tx.close()

    def marcar_enviado(self, *, data_relatorio, chave_destinatarios: str, message_id: str):
        tx = self.db.begin_transaction()
        try:
            tx.execute_commit(
                query="""
                    UPDATE dbo.TB_AURORA_INSIGHT_EMAIL_EXECUCAO
                    SET STATUS = 'ENVIADO',
                        MESSAGE_ID = ?,
                        ERRO = NULL,
                        ATUALIZADO_EM = SYSDATETIME()
                    WHERE TIPO_RELATORIO = ?
                      AND DATA_RELATORIO = ?
                      AND CHAVE_DESTINATARIOS = ?
                """,
                parametros=(
                    message_id,
                    self.REPORT_TYPE,
                    data_relatorio,
                    chave_destinatarios,
                ),
            )
            tx.commit()
        except Exception:
            tx.rollback()
            raise
        finally:
            tx.close()

    def marcar_falha(self, *, data_relatorio, chave_destinatarios: str, erro: str):
        tx = self.db.begin_transaction()
        try:
            tx.execute_commit(
                query="""
                    UPDATE dbo.TB_AURORA_INSIGHT_EMAIL_EXECUCAO
                    SET STATUS = 'FALHOU',
                        ERRO = ?,
                        ATUALIZADO_EM = SYSDATETIME()
                    WHERE TIPO_RELATORIO = ?
                      AND DATA_RELATORIO = ?
                      AND CHAVE_DESTINATARIOS = ?
                """,
                parametros=(
                    str(erro)[:2000],
                    self.REPORT_TYPE,
                    data_relatorio,
                    chave_destinatarios,
                ),
            )
            tx.commit()
        except Exception:
            tx.rollback()
            raise
        finally:
            tx.close()
