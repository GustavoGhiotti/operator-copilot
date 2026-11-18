import json
import uuid
from datetime import datetime

from src.infrastructure.database.sql_server_connection import SQLServerConnection
from src.schemas.auditoria_schema import OrientacaoTempoReal, ResultadoAuditoriaIA, ResultadoTranscricao
from src.shared.auditoria_config import AUDITORIA_ANALYSIS_MODEL, AUDITORIA_COACHING_MODEL, AUDITORIA_TRANSCRIPTION_MODEL
from src.shared.utils.env_load import DB_HOST_66


class AuditoriaRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66, "DB_COPILOT_ACME")

    def criar(self, *, usuario: dict, dados: dict, audio: dict) -> int:
        tx = self.db.begin_transaction()
        try:
            row = tx.execute_insert_returning(query="""
                INSERT dbo.TB_AUDITORIA_ATENDIMENTO (
                    STATUS, CPF_OPERADOR, NOME_OPERADOR, CPF_RESPONSAVEL_ENVIO,
                    NOME_RESPONSAVEL_ENVIO, CARTEIRA_ID, CARTEIRA_NOME, CENTRO_CUSTO,
                    CAMPANHA, DATA_LIGACAO, IDENTIFICADOR_CLIENTE, IDENTIFICADOR_EXTERNO, OBSERVACAO
                )
                OUTPUT INSERTED.ID_AUDITORIA AS id
                VALUES ('PENDENTE', ?, ?, ?, ?, 'delta', 'Banco Delta', ?, ?, ?, ?, ?, ?)
            """, parametros=(
                dados["cpf_operador"], dados["nome_operador"], usuario["CPF_COLABORADOR"],
                usuario["NM_COLABORADOR"], usuario.get("CENTRO_CUSTO"), dados.get("campanha"),
                dados["data_ligacao"], dados.get("identificador_cliente"),
                dados.get("identificador_externo"), dados.get("observacao"),
            ))
            audit_id = int(row["id"])
            tx.execute_commit(query="""
                INSERT dbo.TB_AUDITORIA_ARQUIVO_AUDIO
                    (ID_AUDITORIA, NOME_ORIGINAL, NOME_INTERNO, STORAGE_KEY, EXTENSAO,
                     MIME_TYPE, TAMANHO_BYTES, SHA256)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, parametros=(audit_id, audio["nome_original"], audio["nome_interno"], audio["caminho"],
                              audio["extensao"], audio["mime_type"], audio["tamanho_bytes"], audio["sha256"]))
            tx.commit()
            return audit_id
        except Exception:
            tx.rollback()
            raise
        finally:
            tx.close()

    def obter_status(self, audit_id: int) -> dict | None:
        return self.db.execute_fetch(query="""
            SELECT ID_AUDITORIA AS id, STATUS AS status, ERRO_CODIGO AS erro_codigo,
                   ERRO_PUBLICO AS erro, ATUALIZADO_EM AS atualizado_em
            FROM dbo.TB_AUDITORIA_ATENDIMENTO WHERE ID_AUDITORIA = ?
        """, parametros=(audit_id,), one=True)

    def obter_contexto(self, audit_id: int) -> dict | None:
        return self.db.execute_fetch(query="""
            SELECT A.*, F.STORAGE_KEY, F.NOME_ORIGINAL, F.MIME_TYPE
            FROM dbo.TB_AUDITORIA_ATENDIMENTO A
            JOIN dbo.TB_AUDITORIA_ARQUIVO_AUDIO F ON F.ID_AUDITORIA = A.ID_AUDITORIA
            WHERE A.ID_AUDITORIA = ?
        """, parametros=(audit_id,), one=True)

    def reivindicar(self) -> dict | None:
        tx = self.db.begin_transaction()
        worker_id = uuid.uuid4().hex
        try:
            row = tx.execute_insert_returning(query="""
                ;WITH proxima AS (
                    SELECT TOP (1) * FROM dbo.TB_AUDITORIA_ATENDIMENTO WITH (UPDLOCK, READPAST, ROWLOCK)
                    WHERE STATUS = 'PENDENTE' AND TENTATIVAS < 3 ORDER BY CRIADO_EM
                )
                UPDATE proxima SET STATUS = 'PROCESSANDO_AUDIO', TENTATIVAS = TENTATIVAS + 1,
                    ATUALIZADO_EM = SYSUTCDATETIME()
                OUTPUT INSERTED.ID_AUDITORIA AS id, INSERTED.TENTATIVAS AS tentativa;
            """, parametros=())
            if not row:
                tx.rollback()
                return None
            tx.execute_commit(query="""
                INSERT dbo.TB_AUDITORIA_PROCESSAMENTO
                    (ID_AUDITORIA, ETAPA, STATUS, TENTATIVA, WORKER_ID)
                VALUES (?, 'PROCESSANDO_AUDIO', 'INICIADO', ?, ?)
            """, parametros=(row["id"], row["tentativa"], worker_id))
            tx.commit()
            return {"id": int(row["id"]), "tentativa": int(row["tentativa"]), "worker_id": worker_id}
        except Exception:
            tx.rollback()
            raise
        finally:
            tx.close()

    def atualizar_etapa(self, audit_id: int, status: str, tentativa: int, worker_id: str):
        tx = self.db.begin_transaction()
        try:
            tx.execute_commit(query="""
                UPDATE dbo.TB_AUDITORIA_ATENDIMENTO SET STATUS=?, ATUALIZADO_EM=SYSUTCDATETIME()
                WHERE ID_AUDITORIA=?
            """, parametros=(status, audit_id))
            tx.execute_commit(query="""
                UPDATE dbo.TB_AUDITORIA_PROCESSAMENTO SET STATUS='CONCLUIDO', FINALIZADO_EM=SYSUTCDATETIME()
                WHERE ID_PROCESSAMENTO=(SELECT MAX(ID_PROCESSAMENTO) FROM dbo.TB_AUDITORIA_PROCESSAMENTO WHERE ID_AUDITORIA=?)
            """, parametros=(audit_id,))
            tx.execute_commit(query="""
                INSERT dbo.TB_AUDITORIA_PROCESSAMENTO(ID_AUDITORIA, ETAPA, STATUS, TENTATIVA, WORKER_ID)
                VALUES (?, ?, 'INICIADO', ?, ?)
            """, parametros=(audit_id, status, tentativa, worker_id))
            tx.commit()
        except Exception:
            tx.rollback()
            raise
        finally:
            tx.close()

    def salvar_transcricao(self, audit_id: int, result: ResultadoTranscricao, raw: dict):
        tx = self.db.begin_transaction()
        try:
            row = tx.execute_insert_returning(query="""
                INSERT dbo.TB_AUDITORIA_TRANSCRICAO
                    (ID_AUDITORIA, MODELO, IDIOMA, TEXTO, JSON_TECNICO)
                OUTPUT INSERTED.ID_TRANSCRICAO AS id
                VALUES (?, ?, ?, ?, ?)
            """, parametros=(audit_id, AUDITORIA_TRANSCRIPTION_MODEL, result.idioma, result.texto,
                              json.dumps(raw, ensure_ascii=False, default=str)))
            transcript_id = int(row["id"])
            if result.segmentos:
                tx.execute_commit(query="""
                    INSERT dbo.TB_AUDITORIA_TRANSCRICAO_SEGMENTO
                        (ID_TRANSCRICAO, ORDEM, INICIO_SEGUNDOS, FIM_SEGUNDOS, INTERLOCUTOR, TEXTO)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, parametros=[(transcript_id, s.ordem, s.inicio_segundos, s.fim_segundos,
                                   s.interlocutor, s.texto) for s in result.segmentos])
            tx.execute_commit(query="""
                UPDATE dbo.TB_AUDITORIA_ATENDIMENTO SET DURACAO_SEGUNDOS=?, ATUALIZADO_EM=SYSUTCDATETIME()
                WHERE ID_AUDITORIA=?
            """, parametros=(result.duracao_segundos, audit_id))
            tx.commit()
        except Exception:
            tx.rollback()
            raise
        finally:
            tx.close()

    def salvar_progresso_transcricao(self, audit_id: int, texto: str, ouvido_ate: float):
        self.db.execute_commit(query="""
            UPDATE dbo.TB_AUDITORIA_TEMPO_REAL SET TRANSCRICAO_PARCIAL=?, OUVIDO_ATE_SEGUNDOS=?,
                ATUALIZADO_EM=SYSUTCDATETIME() WHERE ID_AUDITORIA=?;
            IF @@ROWCOUNT = 0
                INSERT dbo.TB_AUDITORIA_TEMPO_REAL
                    (ID_AUDITORIA, TRANSCRICAO_PARCIAL, OUVIDO_ATE_SEGUNDOS)
                VALUES (?, ?, ?);
        """, parametros=(texto, ouvido_ate, audit_id, audit_id, texto, ouvido_ate))

    def salvar_orientacao_parcial(
        self, audit_id: int, orientacao: OrientacaoTempoReal, ouvido_ate: float, raw: dict
    ):
        payload = orientacao.model_dump()
        self.db.execute_commit(query="""
            INSERT dbo.TB_AUDITORIA_ORIENTACAO_PARCIAL
                (ID_AUDITORIA, OUVIDO_ATE_SEGUNDOS, MODELO, FASE, PRIORIDADE, CONTEXTO,
                 ORIENTACAO, FALA_SUGERIDA, RISCO, CONFIANCA, JSON_COMPLETO, JSON_TECNICO)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, parametros=(
            audit_id, ouvido_ate, AUDITORIA_COACHING_MODEL, orientacao.fase,
            orientacao.prioridade, orientacao.contexto, orientacao.orientacao,
            orientacao.fala_sugerida, orientacao.risco, orientacao.confianca,
            json.dumps(payload, ensure_ascii=False), json.dumps(raw, ensure_ascii=False, default=str),
        ))

    def obter_progresso(self, audit_id: int) -> dict:
        progress = self.db.execute_fetch(query="""
            SELECT TRANSCRICAO_PARCIAL AS transcricao_parcial,
                   OUVIDO_ATE_SEGUNDOS AS ouvido_ate_segundos,
                   ATUALIZADO_EM AS atualizado_em
            FROM dbo.TB_AUDITORIA_TEMPO_REAL WHERE ID_AUDITORIA=?
        """, parametros=(audit_id,), one=True) or {}
        latest = self.db.execute_fetch(query="""
            SELECT TOP (1) ID_ORIENTACAO AS id, OUVIDO_ATE_SEGUNDOS AS ouvido_ate_segundos,
                FASE AS fase, PRIORIDADE AS prioridade, CONTEXTO AS contexto,
                ORIENTACAO AS orientacao, FALA_SUGERIDA AS fala_sugerida,
                RISCO AS risco, CONFIANCA AS confianca, CRIADO_EM AS criado_em
            FROM dbo.TB_AUDITORIA_ORIENTACAO_PARCIAL
            WHERE ID_AUDITORIA=? ORDER BY ID_ORIENTACAO DESC
        """, parametros=(audit_id,), one=True)
        progress["orientacao"] = latest
        return progress

    def concluir(self, audit_id: int, result: ResultadoAuditoriaIA, raw: dict, treinamento_versao: str):
        tx = self.db.begin_transaction()
        try:
            payload = result.model_dump()
            row = tx.execute_insert_returning(query="""
                INSERT dbo.TB_AUDITORIA_ANALISE
                    (ID_AUDITORIA, SCHEMA_VERSION, TREINAMENTO_VERSAO, MODELO, NOTA_GERAL,
                     CLASSIFICACAO, RESUMO, PROXIMA_MELHOR_ACAO, CONFIANCA, LIMITACOES_JSON,
                     JSON_COMPLETO, JSON_TECNICO)
                OUTPUT INSERTED.ID_ANALISE AS id
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, parametros=(audit_id, result.schema_version, treinamento_versao, AUDITORIA_ANALYSIS_MODEL,
                              result.resumo.nota_geral, result.resumo.classificacao,
                              result.resumo.resumo_atendimento, result.proxima_melhor_acao,
                              result.confianca_analise, json.dumps(result.limitacoes, ensure_ascii=False),
                              json.dumps(payload, ensure_ascii=False),
                              json.dumps(raw, ensure_ascii=False, default=str)))
            analysis_id = int(row["id"])
            for category in result.categorias:
                cat = tx.execute_insert_returning(query="""
                    INSERT dbo.TB_AUDITORIA_ANALISE_CATEGORIA
                        (ID_ANALISE, CODIGO, NOME, NOTA, STATUS, JUSTIFICATIVA, ORIENTACAO)
                    OUTPUT INSERTED.ID_CATEGORIA AS id VALUES (?, ?, ?, ?, ?, ?, ?)
                """, parametros=(analysis_id, category.codigo, category.nome, category.nota,
                                  category.status, category.justificativa, category.orientacao))
                for evidence in category.evidencias:
                    tx.execute_commit(query="""
                        INSERT dbo.TB_AUDITORIA_EVIDENCIA
                            (ID_CATEGORIA, INICIO_SEGUNDOS, FIM_SEGUNDOS, TEXTO)
                        VALUES (?, ?, ?, ?)
                    """, parametros=(cat["id"], evidence.inicio_segundos, evidence.fim_segundos, evidence.texto))
            for kind, points in (("POSITIVO", result.pontos_positivos), ("MELHORIA", result.pontos_melhoria)):
                for point in points:
                    tx.execute_commit(query="""
                        INSERT dbo.TB_AUDITORIA_PONTO(ID_ANALISE, TIPO, TITULO, DESCRICAO, EXEMPLO_MELHORADO)
                        VALUES (?, ?, ?, ?, ?)
                    """, parametros=(analysis_id, kind, point.titulo, point.descricao, point.exemplo_melhorado))
            for alert in result.alertas_criticos:
                alert_row = tx.execute_insert_returning(query="""
                    INSERT dbo.TB_AUDITORIA_ALERTA(ID_ANALISE, CODIGO, TITULO, DESCRICAO)
                    OUTPUT INSERTED.ID_ALERTA AS id VALUES (?, ?, ?, ?)
                """, parametros=(analysis_id, alert.codigo, alert.titulo, alert.descricao))
                for evidence in alert.evidencias:
                    tx.execute_commit(query="""
                        INSERT dbo.TB_AUDITORIA_EVIDENCIA
                            (ID_ALERTA, INICIO_SEGUNDOS, FIM_SEGUNDOS, TEXTO)
                        VALUES (?, ?, ?, ?)
                    """, parametros=(alert_row["id"], evidence.inicio_segundos, evidence.fim_segundos, evidence.texto))
            tx.execute_commit(query="""
                UPDATE dbo.TB_AUDITORIA_ATENDIMENTO SET STATUS='CONCLUIDO', NOTA_GERAL=?,
                    CLASSIFICACAO=?, POSSUI_ALERTA_CRITICO=?, ERRO_CODIGO=NULL, ERRO_PUBLICO=NULL,
                    CONCLUIDO_EM=SYSUTCDATETIME(), ATUALIZADO_EM=SYSUTCDATETIME()
                WHERE ID_AUDITORIA=?
            """, parametros=(result.resumo.nota_geral, result.resumo.classificacao,
                              bool(result.alertas_criticos), audit_id))
            tx.execute_commit(query="""
                UPDATE dbo.TB_AUDITORIA_PROCESSAMENTO SET STATUS='CONCLUIDO', FINALIZADO_EM=SYSUTCDATETIME()
                WHERE ID_PROCESSAMENTO=(SELECT MAX(ID_PROCESSAMENTO) FROM dbo.TB_AUDITORIA_PROCESSAMENTO WHERE ID_AUDITORIA=?)
            """, parametros=(audit_id,))
            tx.commit()
        except Exception:
            tx.rollback()
            raise
        finally:
            tx.close()

    def falhar(self, audit_id: int, code: str, message: str, requeue: bool):
        status = "PENDENTE" if requeue else "ERRO"
        self.db.execute_commit(query="""
            UPDATE dbo.TB_AUDITORIA_ATENDIMENTO SET STATUS=?, ERRO_CODIGO=?, ERRO_PUBLICO=?,
                ATUALIZADO_EM=SYSUTCDATETIME() WHERE ID_AUDITORIA=?
        """, parametros=(status, code, message, audit_id))

    def obter_resultado(self, audit_id: int) -> dict | None:
        row = self.db.execute_fetch(query="""
            SELECT A.ID_AUDITORIA AS id, A.STATUS AS status, A.CPF_OPERADOR AS cpf_operador,
                A.NOME_OPERADOR AS operador, A.CARTEIRA_NOME AS carteira, A.DURACAO_SEGUNDOS AS duracao_segundos,
                A.CRIADO_EM AS data_analise, A.ERRO_PUBLICO AS erro, N.JSON_COMPLETO AS resultado_json
            FROM dbo.TB_AUDITORIA_ATENDIMENTO A
            LEFT JOIN dbo.TB_AUDITORIA_ANALISE N ON N.ID_AUDITORIA=A.ID_AUDITORIA
            WHERE A.ID_AUDITORIA=?
        """, parametros=(audit_id,), one=True)
        if not row:
            return None
        segments = self.db.execute_fetch(query="""
            SELECT S.ID_SEGMENTO AS id, S.ORDEM AS ordem, S.INICIO_SEGUNDOS AS inicio_segundos,
                S.FIM_SEGUNDOS AS fim_segundos, S.INTERLOCUTOR AS interlocutor, S.TEXTO AS texto
            FROM dbo.TB_AUDITORIA_TRANSCRICAO_SEGMENTO S
            JOIN dbo.TB_AUDITORIA_TRANSCRICAO T ON T.ID_TRANSCRICAO=S.ID_TRANSCRICAO
            WHERE T.ID_AUDITORIA=? ORDER BY S.ORDEM
        """, parametros=(audit_id,)) or []
        row["resultado"] = json.loads(row.pop("resultado_json")) if row.get("resultado_json") else None
        row["transcricao"] = segments
        return row

    def listar(self, cpf: str, pode_ver_carteira: bool, page: int, page_size: int) -> dict:
        where = "1=1" if pode_ver_carteira else "CPF_OPERADOR = ?"
        params = () if pode_ver_carteira else (cpf,)
        count = self.db.execute_fetch(query=f"SELECT COUNT_BIG(*) AS total FROM dbo.TB_AUDITORIA_ATENDIMENTO WHERE {where}", parametros=params, one=True) or {"total": 0}
        rows = self.db.execute_fetch(query=f"""
            SELECT ID_AUDITORIA AS id, CRIADO_EM AS data, NOME_OPERADOR AS operador,
                CARTEIRA_NOME AS carteira, DURACAO_SEGUNDOS AS duracao_segundos,
                NOTA_GERAL AS nota_geral, STATUS AS status, POSSUI_ALERTA_CRITICO AS possui_alerta_critico
            FROM dbo.TB_AUDITORIA_ATENDIMENTO WHERE {where}
            ORDER BY CRIADO_EM DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
        """, parametros=params + ((page - 1) * page_size, page_size)) or []
        return {"items": rows, "page": page, "pageSize": page_size, "totalItems": int(count["total"])}

    def reprocessar(self, audit_id: int):
        self.db.execute_commit(query="""
            DELETE FROM dbo.TB_AUDITORIA_ORIENTACAO_PARCIAL WHERE ID_AUDITORIA=?;
            DELETE FROM dbo.TB_AUDITORIA_TEMPO_REAL WHERE ID_AUDITORIA=?;
            DELETE FROM dbo.TB_AUDITORIA_EVIDENCIA WHERE ID_CATEGORIA IN
                (SELECT C.ID_CATEGORIA FROM dbo.TB_AUDITORIA_ANALISE_CATEGORIA C JOIN dbo.TB_AUDITORIA_ANALISE A ON A.ID_ANALISE=C.ID_ANALISE WHERE A.ID_AUDITORIA=?);
            DELETE FROM dbo.TB_AUDITORIA_EVIDENCIA WHERE ID_ALERTA IN
                (SELECT L.ID_ALERTA FROM dbo.TB_AUDITORIA_ALERTA L JOIN dbo.TB_AUDITORIA_ANALISE A ON A.ID_ANALISE=L.ID_ANALISE WHERE A.ID_AUDITORIA=?);
            DELETE FROM dbo.TB_AUDITORIA_PONTO WHERE ID_ANALISE IN (SELECT ID_ANALISE FROM dbo.TB_AUDITORIA_ANALISE WHERE ID_AUDITORIA=?);
            DELETE FROM dbo.TB_AUDITORIA_ANALISE_CATEGORIA WHERE ID_ANALISE IN (SELECT ID_ANALISE FROM dbo.TB_AUDITORIA_ANALISE WHERE ID_AUDITORIA=?);
            DELETE FROM dbo.TB_AUDITORIA_ALERTA WHERE ID_ANALISE IN (SELECT ID_ANALISE FROM dbo.TB_AUDITORIA_ANALISE WHERE ID_AUDITORIA=?);
            DELETE FROM dbo.TB_AUDITORIA_ANALISE WHERE ID_AUDITORIA=?;
            DELETE S FROM dbo.TB_AUDITORIA_TRANSCRICAO_SEGMENTO S JOIN dbo.TB_AUDITORIA_TRANSCRICAO T ON T.ID_TRANSCRICAO=S.ID_TRANSCRICAO WHERE T.ID_AUDITORIA=?;
            DELETE FROM dbo.TB_AUDITORIA_TRANSCRICAO WHERE ID_AUDITORIA=?;
            UPDATE dbo.TB_AUDITORIA_ATENDIMENTO SET STATUS='PENDENTE', TENTATIVAS=0,
                ERRO_CODIGO=NULL, ERRO_PUBLICO=NULL, NOTA_GERAL=NULL, CLASSIFICACAO=NULL,
                POSSUI_ALERTA_CRITICO=0, CONCLUIDO_EM=NULL, ATUALIZADO_EM=SYSUTCDATETIME()
            WHERE ID_AUDITORIA=?;
        """, parametros=(audit_id, audit_id, audit_id, audit_id, audit_id, audit_id, audit_id, audit_id, audit_id, audit_id, audit_id))
