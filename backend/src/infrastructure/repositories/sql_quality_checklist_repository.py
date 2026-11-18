import json

from src.infrastructure.database.sql_server_connection import SQLServerConnection
from src.shared.utils.env_load import DB_HOST_66


class QualityChecklistRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66, "DB_COPILOT_ACME")

    def ensure_schema(self):
        query = """
        IF OBJECT_ID('dbo.TB_QUALIDADE_CHECKLIST_CONFIG', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.TB_QUALIDADE_CHECKLIST_CONFIG (
                ID_CHECKLIST_CONFIG INT IDENTITY(1,1) PRIMARY KEY,
                CHECKLIST_KEY VARCHAR(120) NOT NULL UNIQUE,
                WALLET_ID VARCHAR(80) NOT NULL,
                WALLET_LABEL NVARCHAR(160) NOT NULL,
                WALLET_DESCRIPTION NVARCHAR(500) NULL,
                WALLET_LOGO_URL NVARCHAR(500) NULL,
                CHANNEL_ID VARCHAR(80) NOT NULL,
                CHANNEL_LABEL NVARCHAR(160) NOT NULL,
                CHANNEL_DESCRIPTION NVARCHAR(500) NULL,
                STATUS VARCHAR(20) NOT NULL DEFAULT 'RASCUNHO',
                VERSAO_ATUAL INT NOT NULL DEFAULT 0,
                CRIADO_POR NVARCHAR(180) NULL,
                CRIADO_EM DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
                ATUALIZADO_POR NVARCHAR(180) NULL,
                ATUALIZADO_EM DATETIME2 NOT NULL DEFAULT SYSDATETIME()
            );
        END;

        IF COL_LENGTH('dbo.TB_QUALIDADE_CHECKLIST_CONFIG', 'WALLET_LOGO_URL') IS NULL
        BEGIN
            ALTER TABLE dbo.TB_QUALIDADE_CHECKLIST_CONFIG ADD WALLET_LOGO_URL NVARCHAR(500) NULL;
        END;

        IF OBJECT_ID('dbo.TB_QUALIDADE_CHECKLIST_VERSAO', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.TB_QUALIDADE_CHECKLIST_VERSAO (
                ID_VERSAO INT IDENTITY(1,1) PRIMARY KEY,
                ID_CHECKLIST_CONFIG INT NOT NULL,
                NUMERO_VERSAO INT NOT NULL,
                STATUS VARCHAR(20) NOT NULL DEFAULT 'RASCUNHO',
                DEFINITION_JSON NVARCHAR(MAX) NOT NULL,
                CRIADO_POR NVARCHAR(180) NULL,
                CRIADO_EM DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
                PUBLICADO_POR NVARCHAR(180) NULL,
                PUBLICADO_EM DATETIME2 NULL,
                CONSTRAINT FK_QUALIDADE_CHECKLIST_VERSAO_CONFIG FOREIGN KEY (ID_CHECKLIST_CONFIG)
                    REFERENCES dbo.TB_QUALIDADE_CHECKLIST_CONFIG(ID_CHECKLIST_CONFIG),
                CONSTRAINT UQ_QUALIDADE_CHECKLIST_VERSAO UNIQUE (ID_CHECKLIST_CONFIG, NUMERO_VERSAO)
            );
        END;
        """
        self.db.execute_commit(query=query, parametros=())

    @staticmethod
    def _decode(row):
        if not row:
            return None
        definition = json.loads(row.get("DEFINITION_JSON") or "{}")
        definition["configId"] = row.get("ID_CHECKLIST_CONFIG")
        definition["versionId"] = row.get("ID_VERSAO")
        definition["version"] = row.get("NUMERO_VERSAO")
        definition["status"] = (
            "INATIVO" if row.get("CONFIG_STATUS") == "INATIVO" else row.get("STATUS")
        )
        if "WALLET_LOGO_URL" in row:
            definition["walletLogoSrc"] = row.get("WALLET_LOGO_URL") or ""
        if row.get("WALLET_LABEL"):
            definition["walletLabel"] = row.get("WALLET_LABEL")
        if "WALLET_DESCRIPTION" in row:
            definition["walletDescription"] = row.get("WALLET_DESCRIPTION") or ""
        return definition

    def list_latest(self):
        self.ensure_schema()
        rows = self.db.execute_fetch(query="""
            WITH ultimas AS (
                SELECT V.*, ROW_NUMBER() OVER (
                    PARTITION BY V.ID_CHECKLIST_CONFIG ORDER BY V.NUMERO_VERSAO DESC
                ) AS RN
                FROM dbo.TB_QUALIDADE_CHECKLIST_VERSAO V WITH (NOLOCK)
            )
            SELECT C.ID_CHECKLIST_CONFIG, C.STATUS AS CONFIG_STATUS,
                   C.WALLET_LABEL, C.WALLET_DESCRIPTION, C.WALLET_LOGO_URL,
                   V.ID_VERSAO, V.NUMERO_VERSAO, V.STATUS, V.DEFINITION_JSON
            FROM dbo.TB_QUALIDADE_CHECKLIST_CONFIG C WITH (NOLOCK)
            JOIN ultimas V ON V.ID_CHECKLIST_CONFIG = C.ID_CHECKLIST_CONFIG AND V.RN = 1
            ORDER BY C.WALLET_LABEL, C.CHANNEL_LABEL
        """, parametros=(), one=False) or []
        return [self._decode(row) for row in rows]

    def list_published(self):
        self.ensure_schema()
        rows = self.db.execute_fetch(query="""
            SELECT C.ID_CHECKLIST_CONFIG, C.WALLET_LABEL, C.WALLET_DESCRIPTION,
                   C.WALLET_LOGO_URL, V.ID_VERSAO, V.NUMERO_VERSAO,
                   V.STATUS, V.DEFINITION_JSON
            FROM dbo.TB_QUALIDADE_CHECKLIST_CONFIG C WITH (NOLOCK)
            JOIN dbo.TB_QUALIDADE_CHECKLIST_VERSAO V WITH (NOLOCK)
              ON V.ID_CHECKLIST_CONFIG = C.ID_CHECKLIST_CONFIG
             AND V.NUMERO_VERSAO = C.VERSAO_ATUAL
            WHERE C.STATUS = 'PUBLICADO' AND V.STATUS = 'PUBLICADO'
            ORDER BY C.WALLET_LABEL, C.CHANNEL_LABEL
        """, parametros=(), one=False) or []
        return [self._decode(row) for row in rows]

    def get_version(self, version_id):
        self.ensure_schema()
        row = self.db.execute_fetch(query="""
            SELECT C.ID_CHECKLIST_CONFIG, C.WALLET_LABEL, C.WALLET_DESCRIPTION,
                   C.WALLET_LOGO_URL, V.ID_VERSAO, V.NUMERO_VERSAO,
                   V.STATUS, V.DEFINITION_JSON
            FROM dbo.TB_QUALIDADE_CHECKLIST_VERSAO V WITH (NOLOCK)
            JOIN dbo.TB_QUALIDADE_CHECKLIST_CONFIG C WITH (NOLOCK)
              ON C.ID_CHECKLIST_CONFIG = V.ID_CHECKLIST_CONFIG
            WHERE V.ID_VERSAO = ?
        """, parametros=(version_id,), one=True)
        return self._decode(row)

    def save_draft(self, definition, actor):
        self.ensure_schema()
        checklist_key = definition["id"]
        tx = self.db.begin_transaction()
        try:
            config = tx.execute_fetch(query="""
                SELECT ID_CHECKLIST_CONFIG
                FROM dbo.TB_QUALIDADE_CHECKLIST_CONFIG WITH (UPDLOCK, HOLDLOCK)
                WHERE CHECKLIST_KEY = ?
            """, parametros=(checklist_key,), one=True)
            if config:
                config_id = config["ID_CHECKLIST_CONFIG"]
                tx.execute_commit(query="""
                    UPDATE dbo.TB_QUALIDADE_CHECKLIST_CONFIG
                    SET WALLET_ID=?, WALLET_LABEL=?, WALLET_DESCRIPTION=?,
                        WALLET_LOGO_URL=?, CHANNEL_ID=?, CHANNEL_LABEL=?, CHANNEL_DESCRIPTION=?,
                        ATUALIZADO_POR=?, ATUALIZADO_EM=SYSDATETIME()
                    WHERE ID_CHECKLIST_CONFIG=?
                """, parametros=(
                    definition["walletId"], definition["walletLabel"], definition.get("walletDescription"),
                    definition.get("walletLogoSrc"),
                    definition["channelId"], definition["channelLabel"], definition.get("channelDescription"),
                    actor, config_id,
                ))
            else:
                created = tx.execute_insert_returning(query="""
                    INSERT INTO dbo.TB_QUALIDADE_CHECKLIST_CONFIG (
                        CHECKLIST_KEY, WALLET_ID, WALLET_LABEL, WALLET_DESCRIPTION, WALLET_LOGO_URL,
                        CHANNEL_ID, CHANNEL_LABEL, CHANNEL_DESCRIPTION, CRIADO_POR, ATUALIZADO_POR
                    ) OUTPUT INSERTED.ID_CHECKLIST_CONFIG AS ID_CHECKLIST_CONFIG
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, parametros=(
                    checklist_key, definition["walletId"], definition["walletLabel"],
                    definition.get("walletDescription"), definition.get("walletLogoSrc"), definition["channelId"],
                    definition["channelLabel"], definition.get("channelDescription"), actor, actor,
                ))
                config_id = created["ID_CHECKLIST_CONFIG"]

            tx.execute_commit(query="""
                UPDATE dbo.TB_QUALIDADE_CHECKLIST_CONFIG
                SET WALLET_LABEL=?, WALLET_DESCRIPTION=?, WALLET_LOGO_URL=?,
                    ATUALIZADO_POR=?, ATUALIZADO_EM=SYSDATETIME()
                WHERE WALLET_ID=?
            """, parametros=(
                definition["walletLabel"], definition.get("walletDescription"),
                definition.get("walletLogoSrc"), actor, definition["walletId"],
            ))

            latest = tx.execute_fetch(query="""
                SELECT TOP 1 ID_VERSAO, NUMERO_VERSAO, STATUS
                FROM dbo.TB_QUALIDADE_CHECKLIST_VERSAO WITH (UPDLOCK, HOLDLOCK)
                WHERE ID_CHECKLIST_CONFIG=? ORDER BY NUMERO_VERSAO DESC
            """, parametros=(config_id,), one=True)
            encoded = json.dumps(definition, ensure_ascii=False)
            if latest and latest["STATUS"] == "RASCUNHO":
                version_id = latest["ID_VERSAO"]
                tx.execute_commit(query="""
                    UPDATE dbo.TB_QUALIDADE_CHECKLIST_VERSAO
                    SET DEFINITION_JSON=?, CRIADO_POR=?, CRIADO_EM=SYSDATETIME()
                    WHERE ID_VERSAO=?
                """, parametros=(encoded, actor, version_id))
            else:
                version_number = (latest["NUMERO_VERSAO"] if latest else 0) + 1
                created = tx.execute_insert_returning(query="""
                    INSERT INTO dbo.TB_QUALIDADE_CHECKLIST_VERSAO (
                        ID_CHECKLIST_CONFIG, NUMERO_VERSAO, STATUS, DEFINITION_JSON, CRIADO_POR
                    ) OUTPUT INSERTED.ID_VERSAO AS ID_VERSAO
                    VALUES (?, ?, 'RASCUNHO', ?, ?)
                """, parametros=(config_id, version_number, encoded, actor))
                version_id = created["ID_VERSAO"]
            tx.commit()
            return self.get_version(version_id)
        except Exception:
            tx.rollback()
            raise
        finally:
            tx.close()

    def publish(self, version_id, actor):
        self.ensure_schema()
        tx = self.db.begin_transaction()
        try:
            version = tx.execute_fetch(query="""
                SELECT ID_CHECKLIST_CONFIG, NUMERO_VERSAO
                FROM dbo.TB_QUALIDADE_CHECKLIST_VERSAO WITH (UPDLOCK, HOLDLOCK)
                WHERE ID_VERSAO=?
            """, parametros=(version_id,), one=True)
            if not version:
                tx.rollback()
                return False
            tx.execute_commit(query="""
                UPDATE dbo.TB_QUALIDADE_CHECKLIST_VERSAO SET STATUS='ARQUIVADO'
                WHERE ID_CHECKLIST_CONFIG=? AND STATUS='PUBLICADO';
                UPDATE dbo.TB_QUALIDADE_CHECKLIST_VERSAO
                SET STATUS='PUBLICADO', PUBLICADO_POR=?, PUBLICADO_EM=SYSDATETIME()
                WHERE ID_VERSAO=?;
                UPDATE dbo.TB_QUALIDADE_CHECKLIST_CONFIG
                SET STATUS='PUBLICADO', VERSAO_ATUAL=?, ATUALIZADO_POR=?, ATUALIZADO_EM=SYSDATETIME()
                WHERE ID_CHECKLIST_CONFIG=?;
            """, parametros=(version["ID_CHECKLIST_CONFIG"], actor, version_id,
                              version["NUMERO_VERSAO"], actor, version["ID_CHECKLIST_CONFIG"]))
            tx.commit()
            return True
        except Exception:
            tx.rollback()
            raise
        finally:
            tx.close()

    def deactivate(self, config_id, actor):
        self.ensure_schema()
        return self.db.execute_commit(query="""
            UPDATE dbo.TB_QUALIDADE_CHECKLIST_CONFIG
            SET STATUS='INATIVO', ATUALIZADO_POR=?, ATUALIZADO_EM=SYSDATETIME()
            WHERE ID_CHECKLIST_CONFIG=?
        """, parametros=(actor, config_id), return_rowcount=True)

    def delete_wallet(self, wallet_id):
        self.ensure_schema()
        tx = self.db.begin_transaction()
        try:
            configs = tx.execute_fetch(query="""
                SELECT ID_CHECKLIST_CONFIG, CHECKLIST_KEY, WALLET_LABEL
                FROM dbo.TB_QUALIDADE_CHECKLIST_CONFIG WITH (UPDLOCK, HOLDLOCK)
                WHERE WALLET_ID=?
            """, parametros=(wallet_id,), one=False) or []
            if not configs:
                tx.rollback()
                return {"status": "not_found"}

            config_ids = [row["ID_CHECKLIST_CONFIG"] for row in configs]
            checklist_keys = [row["CHECKLIST_KEY"] for row in configs]
            feedback_schema = tx.execute_fetch(query="""
                SELECT
                    CASE WHEN OBJECT_ID('dbo.TB_FEEDBACK_QUALIDADE', 'U') IS NOT NULL
                         THEN 1 ELSE 0 END AS TABELA_EXISTE,
                    COL_LENGTH('dbo.TB_FEEDBACK_QUALIDADE', 'ID_CHECKLIST_CONFIG') AS COLUNA_CONFIG,
                    COL_LENGTH('dbo.TB_FEEDBACK_QUALIDADE', 'CHECKLIST_ID') AS COLUNA_CHECKLIST
            """, parametros=(), one=True) or {}

            feedback = None
            where_parts = []
            feedback_params = []
            if feedback_schema.get("TABELA_EXISTE"):
                if feedback_schema.get("COLUNA_CONFIG") is not None:
                    id_placeholders = ",".join("?" for _ in config_ids)
                    where_parts.append(f"ID_CHECKLIST_CONFIG IN ({id_placeholders})")
                    feedback_params.extend(config_ids)
                if feedback_schema.get("COLUNA_CHECKLIST") is not None:
                    key_placeholders = ",".join("?" for _ in checklist_keys)
                    where_parts.append(f"CHECKLIST_ID IN ({key_placeholders})")
                    feedback_params.extend(checklist_keys)

            if where_parts:
                feedback = tx.execute_fetch(query=f"""
                    SELECT TOP 1 ID_FEEDBACK
                    FROM dbo.TB_FEEDBACK_QUALIDADE WITH (NOLOCK)
                    WHERE {" OR ".join(where_parts)}
                """, parametros=tuple(feedback_params), one=True)
            if feedback:
                tx.rollback()
                return {
                    "status": "in_use",
                    "wallet_label": configs[0]["WALLET_LABEL"],
                }

            tx.execute_commit(query="""
                DELETE V
                FROM dbo.TB_QUALIDADE_CHECKLIST_VERSAO V
                JOIN dbo.TB_QUALIDADE_CHECKLIST_CONFIG C
                  ON C.ID_CHECKLIST_CONFIG = V.ID_CHECKLIST_CONFIG
                WHERE C.WALLET_ID=?;

                DELETE FROM dbo.TB_QUALIDADE_CHECKLIST_CONFIG
                WHERE WALLET_ID=?;
            """, parametros=(wallet_id, wallet_id))
            tx.commit()
            return {
                "status": "deleted",
                "wallet_label": configs[0]["WALLET_LABEL"],
            }
        except Exception:
            tx.rollback()
            raise
        finally:
            tx.close()
