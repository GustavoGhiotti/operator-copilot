from contextlib import contextmanager
import json
from datetime import datetime
from src.shared.utils.env_load import *
from src.infrastructure.database.sql_server_connection import SQLServerConnection
from src.shared.utils.monitoria_permissoes import funcao_eh_operador_monitoria


class MonitoriaInfraError(Exception):
    def __init__(
        self,
        mensagem: str = "Falha ao consultar dados da monitoria.",
        codigo: str = "MONITORIA_INFRA_ERRO"
    ):
        super().__init__(mensagem)
        self.mensagem = mensagem
        self.codigo = codigo


class SqlMonitoriaWhatsappRepository:
    def __init__(self):
        self._executor_padrao = SQLServerConnection(
            server=DB_HOST_66,
            database="DB_CHATBOT"
        )
        self.executor = self._executor_padrao
        self._transacao_ativa = None

    @contextmanager
    def transacao(self):
        if self._transacao_ativa is not None:
            yield self
            return

        transacao = self._executor_padrao.begin_transaction()
        executor_anterior = self.executor
        self.executor = transacao
        self._transacao_ativa = transacao

        try:
            yield self
            transacao.commit()
        except Exception:
            transacao.rollback()
            raise
        finally:
            self.executor = executor_anterior
            self._transacao_ativa = None
            transacao.close()

    def _execute_fetch_monitoria(
        self,
        *,
        query: str,
        parametros,
        one: bool = False,
        mensagem_erro: str = "Falha ao consultar dados da monitoria."
    ):
        try:
            return self.executor.execute_fetch(
                query=query,
                parametros=parametros,
                one=one
            )
        except Exception as exc:
            raise MonitoriaInfraError(mensagem_erro) from exc

    def obter_usuario_ativo_por_cpf(self, cpf: str):
        query = """
            SELECT
                CPF_COLABORADOR,
                NM_COLABORADOR,
                FUNCAO_COLABORADOR,
                CENTRO_CUSTO
            FROM DB_COPILOT_ACME.login.TB_USUARIOS WITH (NOLOCK)
            WHERE CPF_COLABORADOR = ?
              AND USUARIO_ATIVO = 1
        """
        return self.executor.execute_fetch(
            query=query,
            parametros=(cpf,),
            one=True
        )

    def listar_operadores_monitoria_por_carteira(self, carteira: str):
        query = """
            SELECT DISTINCT
                U.CPF_COLABORADOR,
                U.NM_COLABORADOR,
                U.FUNCAO_COLABORADOR,
                U.CENTRO_CUSTO
            FROM DB_COPILOT_ACME.login.TB_USUARIOS U WITH (NOLOCK)
            INNER JOIN whatsapp.TB_MAP_CARTEIRA_CENTRO_CUSTO M WITH (NOLOCK)
                ON M.CENTRO_CUSTO = U.CENTRO_CUSTO
            WHERE M.NOME_CARTEIRA = ?
              AND M.USA_WHATSAPP = 1
              AND U.USUARIO_ATIVO = 1
            ORDER BY U.NM_COLABORADOR
        """
        resultados = self._execute_fetch_monitoria(
            query=query,
            parametros=(carteira,),
            mensagem_erro="Falha ao carregar operadores elegiveis para transferencia."
        ) or []

        operadores = []

        for usuario in resultados:
            if not funcao_eh_operador_monitoria(usuario.get("FUNCAO_COLABORADOR")):
                continue

            operadores.append({
                "CPF_COLABORADOR": usuario["CPF_COLABORADOR"],
                "NM_COLABORADOR": usuario["NM_COLABORADOR"],
                "FUNCAO_COLABORADOR": usuario["FUNCAO_COLABORADOR"],
                "CENTRO_CUSTO": usuario["CENTRO_CUSTO"],
            })

        return operadores

    # =========================================================
    # MENSAGENS
    # =========================================================

    def mensagem_existe(self, id_mensagem_provedor: str) -> bool:
        query = """
            SELECT 1
            FROM whatsapp.TB_MENSAGENS WITH (NOLOCK)
            WHERE ID_MENSAGEM_PROVEDOR = ?
        """
        result = self.executor.execute_fetch(
            query=query,
            parametros=(id_mensagem_provedor,),
            one=True
        )
        return result is not None

    def inserir_mensagem_recebida(self, dados: dict) -> None:
        query = """
            INSERT INTO whatsapp.TB_MENSAGENS (
                ID_CONVERSA,
                ID_MENSAGEM_PROVEDOR,
                ID_CONTA_WHATSAPP,
                NUMERO_ORIGEM,
                NUMERO_DESTINO,
                CONTEUDO_MENSAGEM,
                DIRECAO,
                CANAL,
                STATUS_MENSAGEM,
                CPF_OPERADOR_ENVIO,
                NOME_OPERADOR_ENVIO,
                DATA_HORA_WHATSAPP,
                DATA_COLETA_SISTEMA,
                ERROR_CODE,
                ERROR_MESSAGE
            )
            VALUES (?, ?, ?, ?, ?, ?,
                    'RECEBIDA', 'whatsapp', ?,
                    NULL, NULL, ?, ?, NULL, NULL)
        """
        self.executor.execute_commit(
            query=query,
            parametros=(
                dados["id_conversa"],
                dados["id_mensagem_provedor"],
                dados["id_conta_whatsapp"],
                dados["numero_origem"],
                dados["numero_destino"],
                dados.get("conteudo", ""),
                dados.get("status_mensagem"),
                dados["data_hora_whatsapp"],
                dados["data_coleta_sistema"]
            )
        )

    def obter_status_mensagem(self, id_mensagem_provedor: str) -> str | None:
        query = """
            SELECT STATUS_MENSAGEM
            FROM whatsapp.TB_MENSAGENS WITH(NOLOCK)
            WHERE ID_MENSAGEM_PROVEDOR = ?
        """
        result = self.executor.execute_fetch(
            query=query,
            parametros=(id_mensagem_provedor,),
            one=True
        )
        if not result:
            return None
        return result.get("STATUS_MENSAGEM")

    def atualizar_status_mensagem(
        self,
        id_mensagem_provedor: str,
        novo_status: str,
        data_evento: datetime,
        error_code: int | None = None,
        error_message: str | None = None
    ) -> None:
        query = """
            UPDATE whatsapp.TB_MENSAGENS
            SET
                STATUS_MENSAGEM = ?,
                ERROR_CODE = ?,
                ERROR_MESSAGE = ?
            WHERE ID_MENSAGEM_PROVEDOR = ?
        """
        self.executor.execute_commit(
            query=query,
            parametros=(
                novo_status,
                error_code,
                error_message,
                id_mensagem_provedor
            )
        )

    def inserir_mensagem_enviada(self, dados: dict) -> None:
        query = """
            INSERT INTO whatsapp.TB_MENSAGENS (
                ID_CONVERSA,
                ID_MENSAGEM_PROVEDOR,
                ID_CONTA_WHATSAPP,
                NUMERO_ORIGEM,
                NUMERO_DESTINO,
                CONTEUDO_MENSAGEM,
                DIRECAO,
                CANAL,
                STATUS_MENSAGEM,
                CPF_OPERADOR_ENVIO,
                NOME_OPERADOR_ENVIO,
                DATA_HORA_WHATSAPP,
                DATA_COLETA_SISTEMA,
                ERROR_CODE,
                ERROR_MESSAGE
            )
            VALUES (
                ?, ?, ?, ?, ?, ?,
                'ENVIADA', 'whatsapp', 'sent',
                ?, ?, ?, ?, NULL, NULL
            )
        """
        self.executor.execute_commit(
            query=query,
            parametros=(
                dados["id_conversa"],
                dados["id_mensagem_provedor"],
                dados["id_conta_whatsapp"],
                dados["numero_origem"],
                dados["numero_destino"],
                dados["conteudo"],
                dados["cpf_operador"],
                dados["nome_operador"],
                dados["data_evento"],
                dados["data_evento"]
            )
        )

    def obter_conversa_por_mensagem(self, id_mensagem_provedor: str):
        query = """
            SELECT TOP 1 C.*
            FROM whatsapp.TB_MENSAGENS M
            INNER JOIN whatsapp.TB_CONVERSAS C
                ON C.ID_CONVERSA = M.ID_CONVERSA
            WHERE M.ID_MENSAGEM_PROVEDOR = ?
            ORDER BY M.ID_MENSAGEM DESC
        """
        return self.executor.execute_fetch(
            query=query,
            parametros=(id_mensagem_provedor,),
            one=True
        )

    # =========================================================
    # CONVERSAS
    # =========================================================

    def obter_carteira_por_numero_empresa(self, numero_empresa: str) -> str | None:
        query = """
            SELECT CARTEIRA
            FROM whatsapp.TB_NUMEROS_WHATSAPP WITH(NOLOCK)
            WHERE NUMERO_TELEFONE = ?
              AND ATIVO = 1
        """
        result = self.executor.execute_fetch(
            query=query,
            parametros=(numero_empresa,),
            one=True
        )
        return result["CARTEIRA"] if result else None

    def obter_numero_whatsapp_por_numero_empresa(self, numero_empresa: str):
        query = """
            SELECT TOP 1
                NUMERO_TELEFONE,
                PHONE_NUMBER_ID_META,
                CARTEIRA
            FROM whatsapp.TB_NUMEROS_WHATSAPP WITH(NOLOCK)
            WHERE NUMERO_TELEFONE = ?
              AND ATIVO = 1
        """
        return self.executor.execute_fetch(
            query=query,
            parametros=(numero_empresa,),
            one=True
        )

    def obter_conversa_por_cliente(self, numero_cliente: str):
        query = """
            SELECT TOP 1 *
            FROM whatsapp.TB_CONVERSAS WITH(NOLOCK)
            WHERE NUMERO_CLIENTE = ?
            ORDER BY ATUALIZADO DESC
        """
        return self.executor.execute_fetch(
            query=query,
            parametros=(numero_cliente,),
            one=True
        )

    def criar_conversa(
        self,
        numero_empresa: str,
        phone_number_id_meta: str,
        numero_cliente: str,
        data_evento
    ) -> int:
        query = """
            INSERT INTO whatsapp.TB_CONVERSAS (
                NUMERO_EMPRESA,
                NUMERO_CLIENTE,
                PHONE_NUMBER_ID_META,
                ORIGEM_FIXACAO_NUMERO,
                STATUS_CONVERSA,
                DATA_ULTIMA_MENSAGEM,
                DIRECAO_ULTIMA_MENSAGEM,
                CRIADO,
                ATUALIZADO
            )
            OUTPUT INSERTED.ID_CONVERSA
            VALUES (
                ?, ?, ?, 'CLIENTE', 'ABERTA', ?, 'RECEBIDA',
                SYSUTCDATETIME(), SYSUTCDATETIME()
            )
        """
        result = self.executor.execute_insert_returning(
            query=query,
            parametros=(
                numero_empresa,
                numero_cliente,
                phone_number_id_meta,
                data_evento
            )
        )
        if not result or "ID_CONVERSA" not in result:
            raise Exception("Falha ao criar conversa: ID_CONVERSA não retornado.")
        return result["ID_CONVERSA"]

    def obter_conversa_por_id(self, id_conversa: int):
        query = """
            SELECT *
            FROM whatsapp.TB_CONVERSAS WITH (NOLOCK)
            WHERE ID_CONVERSA = ?
        """
        return self.executor.execute_fetch(
            query=query,
            parametros=(id_conversa,),
            one=True
        )

    def obter_conversa_aberta(self, numero_empresa: str, numero_cliente: str):
        query = """
            SELECT TOP 1 *
            FROM whatsapp.TB_CONVERSAS WITH (NOLOCK)
            WHERE NUMERO_EMPRESA = ?
              AND NUMERO_CLIENTE = ?
              AND STATUS_CONVERSA = 'ABERTA'
            ORDER BY CRIADO DESC
        """
        return self.executor.execute_fetch(
            query=query,
            parametros=(numero_empresa, numero_cliente),
            one=True
        )

    def assumir_conversa(
        self,
        id_conversa: int,
        cpf_operador: str,
        nome_operador: str,
        data_evento
    ) -> bool:
        query = """
            UPDATE whatsapp.TB_CONVERSAS
            SET
                STATUS_CONVERSA = 'EM_ATENDIMENTO',
                CPF_OPERADOR_ATUAL = ?,
                NOME_OPERADOR_ATUAL = ?,
                DATA_ULTIMA_MENSAGEM = ?,
                ATUALIZADO = SYSUTCDATETIME()
            WHERE ID_CONVERSA = ?
            AND STATUS_CONVERSA = 'ABERTA'
        """

        rows = self.executor.execute_commit(
            query=query,
            parametros=(cpf_operador, nome_operador, data_evento, id_conversa),
            return_rowcount=True
        )

        return rows > 0

    def reconciliar_conversa_para_em_atendimento(self, id_conversa: int) -> bool:
        query = """
            UPDATE whatsapp.TB_CONVERSAS
            SET
                STATUS_CONVERSA = 'EM_ATENDIMENTO',
                ATUALIZADO = SYSUTCDATETIME()
            WHERE ID_CONVERSA = ?
              AND STATUS_CONVERSA = 'ABERTA'
              AND CPF_OPERADOR_ATUAL IS NOT NULL
              AND NOME_OPERADOR_ATUAL IS NOT NULL
        """
        rows = self.executor.execute_commit(
            query=query,
            parametros=(id_conversa,),
            return_rowcount=True
        )
        return rows > 0

    def atualizar_conversa_apos_envio(self, id_conversa: int, data_evento) -> None:
        query = """
            UPDATE whatsapp.TB_CONVERSAS
            SET
                DATA_ULTIMA_MENSAGEM = ?,
                DIRECAO_ULTIMA_MENSAGEM = 'ENVIADA',
                ATUALIZADO = SYSUTCDATETIME()
            WHERE ID_CONVERSA = ?
        """
        self.executor.execute_commit(
            query=query,
            parametros=(data_evento, id_conversa)
        )

    def encerrar_conversa(
        self,
        id_conversa: int,
        status_esperado: str | None = None
    ) -> bool:
        query = """
            UPDATE whatsapp.TB_CONVERSAS
            SET
                STATUS_CONVERSA = 'ENCERRADA',
                CPF_OPERADOR_ATUAL = NULL,
                NOME_OPERADOR_ATUAL = NULL,
                ATUALIZADO = SYSUTCDATETIME()
            WHERE ID_CONVERSA = ?
        """
        parametros = [id_conversa]

        if status_esperado:
            query += " AND STATUS_CONVERSA = ?"
            parametros.append(status_esperado)

        rows = self.executor.execute_commit(
            query=query,
            parametros=tuple(parametros),
            return_rowcount=True
        )
        return rows > 0

    def operador_pode_atender_conversa(self, id_conversa: int, carteira_operador: str) -> bool:
        query = """
            SELECT 1
            FROM whatsapp.TB_CONVERSAS C
            JOIN whatsapp.TB_NUMEROS_WHATSAPP N
                ON N.NUMERO_TELEFONE = C.NUMERO_EMPRESA
            WHERE C.ID_CONVERSA = ?
              AND N.CARTEIRA = ?
        """
        result = self.executor.execute_fetch(
            query=query,
            parametros=(id_conversa, carteira_operador),
            one=True
        )
        return result is not None

    def escolher_numero_outbound(self, carteira: str, numero_cliente: str):
        query = """
            ;WITH Numeros AS (
                SELECT
                    NUMERO_TELEFONE,
                    PHONE_NUMBER_ID_META,
                    ROW_NUMBER() OVER (ORDER BY ID ASC) AS RN,
                    COUNT(*) OVER () AS TOTAL
                FROM whatsapp.TB_NUMEROS_WHATSAPP WITH (NOLOCK)
                WHERE CARTEIRA = ?
                  AND ATIVO = 1
                  AND PERMITE_ENVIO = 1
            )
            SELECT TOP 1
                NUMERO_TELEFONE,
                PHONE_NUMBER_ID_META
            FROM Numeros
            WHERE RN = (ABS(CHECKSUM(?)) % TOTAL) + 1;
        """
        result = self.executor.execute_fetch(
            query=query,
            parametros=(carteira, numero_cliente),
            one=True
        )
        if not result:
            raise PermissionError("Nenhum número ativo disponível para esta carteira.")
        return result

    def reatribuir_atendimento(
        self,
        id_conversa: int,
        cpf_operador: str,
        nome_operador: str,
        data_evento
    ) -> bool:
        query = """
            UPDATE whatsapp.TB_CONVERSAS
            SET
                CPF_OPERADOR_ATUAL = ?,
                NOME_OPERADOR_ATUAL = ?,
                DATA_ULTIMA_MENSAGEM = ?,
                ATUALIZADO = SYSUTCDATETIME()
            WHERE ID_CONVERSA = ?
              AND STATUS_CONVERSA = 'EM_ATENDIMENTO'
        """
        rows = self.executor.execute_commit(
            query=query,
            parametros=(cpf_operador, nome_operador, data_evento, id_conversa),
            return_rowcount=True
        )
        return rows > 0
    
    def reabrir_conversa(self, id_conversa: int) -> bool:
        query = """
            UPDATE whatsapp.TB_CONVERSAS
            SET
                STATUS_CONVERSA = 'ABERTA',
                CPF_OPERADOR_ATUAL = NULL,
                NOME_OPERADOR_ATUAL = NULL,
                ATUALIZADO = SYSUTCDATETIME()
            WHERE ID_CONVERSA = ?
              AND STATUS_CONVERSA = 'ENCERRADA'
        """
        rows = self.executor.execute_commit(
            query=query,
            parametros=(id_conversa,),
            return_rowcount=True
        )
        return rows > 0

    # =========================================================
    # ATENDIMENTOS
    # =========================================================

    def obter_atendimento_ativo_por_conversa(self, id_conversa: int):
        query = """
            SELECT TOP 1 *
            FROM whatsapp.TB_ATENDIMENTOS WITH(NOLOCK)
            WHERE ID_CONVERSA = ?
              AND STATUS_ATENDIMENTO = 'EM_ATENDIMENTO'
            ORDER BY ID_ATENDIMENTO DESC
        """
        return self.executor.execute_fetch(
            query=query,
            parametros=(id_conversa,),
            one=True
        )

    def criar_atendimento(self, id_conversa: int, nome_operador_inicio: str, data_inicio) -> int:
        query = """
            INSERT INTO whatsapp.TB_ATENDIMENTOS (
                ID_CONVERSA,
                STATUS_ATENDIMENTO,
                NOME_OPERADOR_INICIO,
                DATA_INICIO,
                CRIADO,
                ATUALIZADO
            )
            OUTPUT INSERTED.ID_ATENDIMENTO
            VALUES (?, 'EM_ATENDIMENTO', ?, ?, SYSUTCDATETIME(), SYSUTCDATETIME())
        """
        result = self.executor.execute_insert_returning(
            query=query,
            parametros=(id_conversa, nome_operador_inicio, data_inicio)
        )
        if not result or "ID_ATENDIMENTO" not in result:
            raise Exception("Falha ao criar atendimento: ID_ATENDIMENTO não retornado.")
        return result["ID_ATENDIMENTO"]

    def finalizar_atendimento(
        self,
        id_atendimento: int,
        nome_operador_fim: str,
        data_fim,
        motivo: str | None = None,
        observacao: str | None = None
    ) -> bool:
        query = """
            UPDATE whatsapp.TB_ATENDIMENTOS
            SET
                STATUS_ATENDIMENTO = 'FINALIZADO',
                NOME_OPERADOR_FIM = ?,
                DATA_FIM = ?,
                MOTIVO_FINALIZACAO = ?,
                OBSERVACAO_FINALIZACAO = ?,
                ATUALIZADO = SYSUTCDATETIME()
            WHERE ID_ATENDIMENTO = ?
              AND STATUS_ATENDIMENTO = 'EM_ATENDIMENTO'
        """
        rows = self.executor.execute_commit(
            query=query,
            parametros=(nome_operador_fim, data_fim, motivo, observacao, id_atendimento),
            return_rowcount=True
        )
        return rows > 0

    # =========================================================
    # MONITORIA / VISÕES
    # =========================================================

    def obter_centro_custo_por_cpf(self, cpf: str) -> str | None:
        query = """
            SELECT CENTRO_CUSTO
            FROM DB_COPILOT_ACME.login.TB_USUARIOS WITH (NOLOCK)
            WHERE CPF_COLABORADOR = ?
              AND USUARIO_ATIVO = 1
        """
        result = self.executor.execute_fetch(
            query=query,
            parametros=(cpf,),
            one=True
        )
        return result["CENTRO_CUSTO"] if result else None
    
    def obter_mapeamento_carteira_por_centro_custo(
        self,
        centro_custo: str,
        somente_whatsapp: bool = True
    ):
        query = """
            SELECT TOP 1
                NOME_CARTEIRA,
                USA_WHATSAPP
            FROM whatsapp.TB_MAP_CARTEIRA_CENTRO_CUSTO WITH (NOLOCK)
            WHERE CENTRO_CUSTO = ?
        """
        parametros = [centro_custo]

        if somente_whatsapp:
            query += " AND USA_WHATSAPP = 1"

        result = self.executor.execute_fetch(
            query=query,
            parametros=tuple(parametros),
            one=True
        )

        return result

    def obter_carteira_por_centro_custo(
        self,
        centro_custo: str,
        somente_whatsapp: bool = True
    ) -> str | None:
        result = self.obter_mapeamento_carteira_por_centro_custo(
            centro_custo=centro_custo,
            somente_whatsapp=somente_whatsapp
        )
        return result["NOME_CARTEIRA"] if result else None

    def listar_conversas_detalhadas_por_carteira(
        self,
        carteira: str,
        cpf_operador: str | None = None,
        somente_abertas_ou_minhas: bool = False
    ):
        query = """
            SELECT
                C.ID_CONVERSA,
                C.STATUS_CONVERSA,
                C.NUMERO_CLIENTE,
                C.NUMERO_EMPRESA,
                C.NOME_OPERADOR_ATUAL,
                C.DATA_ULTIMA_MENSAGEM,
                C.DIRECAO_ULTIMA_MENSAGEM,
                ULT.CONTEUDO_MENSAGEM AS ULTIMA_MENSAGEM,
                ULT.DIRECAO AS ULTIMA_MENSAGEM_DIRECAO,

                CASE
                    WHEN
                        C.STATUS_CONVERSA = 'EM_ATENDIMENTO'
                        AND C.DIRECAO_ULTIMA_MENSAGEM = 'RECEBIDA'
                        AND DATEDIFF(MINUTE, C.DATA_ULTIMA_MENSAGEM, SYSUTCDATETIME()) >= 60
                    THEN 'CRITICO'

                    WHEN
                        C.STATUS_CONVERSA = 'EM_ATENDIMENTO'
                        AND C.DIRECAO_ULTIMA_MENSAGEM = 'RECEBIDA'
                        AND DATEDIFF(MINUTE, C.DATA_ULTIMA_MENSAGEM, SYSUTCDATETIME()) >= 10
                    THEN 'ATENCAO'

                    ELSE 'OK'
                END AS SLA_STATUS

            FROM whatsapp.TB_CONVERSAS C

            INNER JOIN whatsapp.TB_NUMEROS_WHATSAPP N
                ON N.NUMERO_TELEFONE = C.NUMERO_EMPRESA

            OUTER APPLY (
                SELECT TOP 1
                    M2.CONTEUDO_MENSAGEM,
                    M2.DIRECAO
                FROM whatsapp.TB_MENSAGENS M2
                WHERE M2.ID_CONVERSA = C.ID_CONVERSA
                ORDER BY M2.DATA_COLETA_SISTEMA DESC
            ) ULT

            WHERE
                N.CARTEIRA = ?
        """
        parametros: list[str] = [carteira]

        if somente_abertas_ou_minhas:
            query += """
                AND (
                    C.STATUS_CONVERSA = 'ABERTA'
                    OR C.CPF_OPERADOR_ATUAL = ?
                )
            """
            parametros.append(cpf_operador or "")

        query += """

            ORDER BY
                CASE
                    WHEN
                        C.STATUS_CONVERSA = 'EM_ATENDIMENTO'
                        AND C.DIRECAO_ULTIMA_MENSAGEM = 'RECEBIDA'
                        AND DATEDIFF(MINUTE, C.DATA_ULTIMA_MENSAGEM, SYSUTCDATETIME()) >= 60
                    THEN 1

                    WHEN
                        C.STATUS_CONVERSA = 'EM_ATENDIMENTO'
                        AND C.DIRECAO_ULTIMA_MENSAGEM = 'RECEBIDA'
                        AND DATEDIFF(MINUTE, C.DATA_ULTIMA_MENSAGEM, SYSUTCDATETIME()) >= 10
                    THEN 2

                    WHEN C.STATUS_CONVERSA = 'EM_ATENDIMENTO' THEN 3
                    WHEN C.STATUS_CONVERSA = 'ABERTA' THEN 4
                    ELSE 5
                END,
                C.DATA_ULTIMA_MENSAGEM DESC
        """
        resultados = self._execute_fetch_monitoria(
            query=query,
            parametros=tuple(parametros),
            mensagem_erro="Falha ao carregar a fila de conversas da monitoria."
        )
        return resultados or []

    def listar_conversas_por_carteira(self, carteira: str, tipo_visao: str, cpf_usuario: str | None = None):
        filtros = []
        parametros = [carteira]

        if tipo_visao == "BACKLOG":
            filtros.append("C.STATUS_CONVERSA = 'ABERTA'")
        elif tipo_visao == "EM_ATENDIMENTO":
            filtros.append("C.STATUS_CONVERSA = 'EM_ATENDIMENTO'")
        elif tipo_visao == "MINHAS":
            filtros.append("C.STATUS_CONVERSA = 'EM_ATENDIMENTO'")
            filtros.append("C.CPF_OPERADOR_ATUAL = ?")
            parametros.append(cpf_usuario)

        where_extra = ""
        if filtros:
            where_extra = " AND " + " AND ".join(filtros)

        query = f"""
            SELECT
                C.ID_CONVERSA,
                C.NUMERO_CLIENTE,
                C.NUMERO_EMPRESA,
                C.STATUS_CONVERSA,
                C.DATA_ULTIMA_MENSAGEM,
                C.DIRECAO_ULTIMA_MENSAGEM,
                C.NOME_OPERADOR_ATUAL
            FROM whatsapp.TB_CONVERSAS C WITH (NOLOCK)
            INNER JOIN whatsapp.TB_NUMEROS_WHATSAPP N
                ON N.NUMERO_TELEFONE = C.NUMERO_EMPRESA
            WHERE N.CARTEIRA = ?
            {where_extra}
            ORDER BY
                C.DATA_ULTIMA_MENSAGEM DESC
        """
        return self.executor.execute_fetch(
            query=query,
            parametros=tuple(parametros)
        ) or []

    def listar_mensagens_por_conversa(self, id_conversa: int):
        query = """
            SELECT
                ID_MENSAGEM,
                CONTEUDO_MENSAGEM,
                DIRECAO,
                DATA_COLETA_SISTEMA,
                CPF_OPERADOR_ENVIO,
                NOME_OPERADOR_ENVIO
            FROM whatsapp.TB_MENSAGENS
            WHERE ID_CONVERSA = ?
            ORDER BY DATA_COLETA_SISTEMA ASC
        """
        resultados = self._execute_fetch_monitoria(
            query=query,
            parametros=(id_conversa,),
            mensagem_erro="Falha ao carregar as mensagens da conversa."
        )
        return resultados or []

    def obter_metricas_carteira(self, carteira: str):
        query = """
            SELECT
                SUM(CASE WHEN C.STATUS_CONVERSA = 'ABERTA' THEN 1 ELSE 0 END) AS TOTAL_ABERTAS,
                SUM(CASE WHEN C.STATUS_CONVERSA = 'EM_ATENDIMENTO' THEN 1 ELSE 0 END) AS TOTAL_EM_ATENDIMENTO,
                SUM(
                    CASE
                        WHEN C.STATUS_CONVERSA = 'EM_ATENDIMENTO'
                         AND C.DIRECAO_ULTIMA_MENSAGEM = 'RECEBIDA'
                         AND DATEDIFF(MINUTE, C.DATA_ULTIMA_MENSAGEM, SYSUTCDATETIME()) > 5
                        THEN 1 ELSE 0
                    END
                ) AS TOTAL_FORA_SLA,
                COUNT(DISTINCT
                    CASE
                        WHEN C.STATUS_CONVERSA = 'EM_ATENDIMENTO'
                        THEN C.CPF_OPERADOR_ATUAL
                    END
                ) AS TOTAL_OPERADORES_ATIVOS
            FROM whatsapp.TB_CONVERSAS C
            INNER JOIN whatsapp.TB_NUMEROS_WHATSAPP N
                ON N.NUMERO_TELEFONE = C.NUMERO_EMPRESA
            WHERE N.CARTEIRA = ?
        """
        result = self.executor.execute_fetch(
            query=query,
            parametros=(carteira,),
            one=True
        )
        return result or {
            "TOTAL_ABERTAS": 0,
            "TOTAL_EM_ATENDIMENTO": 0,
            "TOTAL_FORA_SLA": 0,
            "TOTAL_OPERADORES_ATIVOS": 0
        }

    # =========================================================
    # EVENTOS (OUTBOX)
    # =========================================================

    def inserir_evento(
        self,
        tipo_evento: str,
        id_conversa: int,
        id_atendimento: int | None = None,
        id_mensagem_provedor: str | None = None,
        numero_empresa: str | None = None,
        numero_cliente: str | None = None,
        cpf_operador: str | None = None,
        nome_operador: str | None = None,
        payload: dict | None = None
    ) -> None:
        payload_json = json.dumps(payload, ensure_ascii=False) if payload else None

        query = """
            INSERT INTO whatsapp.TB_EVENTOS (
                TIPO_EVENTO,
                ID_CONVERSA,
                ID_ATENDIMENTO,
                ID_MENSAGEM_PROVEDOR,
                NUMERO_EMPRESA,
                NUMERO_CLIENTE,
                CPF_OPERADOR,
                NOME_OPERADOR,
                PAYLOAD_JSON,
                DATA_EVENTO_UTC
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, SYSUTCDATETIME())
        """
        self.executor.execute_commit(
            query=query,
            parametros=(
                tipo_evento,
                id_conversa,
                id_atendimento,
                id_mensagem_provedor,
                numero_empresa,
                numero_cliente,
                cpf_operador,
                nome_operador,
                payload_json
            )
        )

    def buscar_eventos_apos_id(self, ultimo_id: int):
        query = """
            SELECT TOP 100
                ID_EVENTO,
                TIPO_EVENTO,
                ID_CONVERSA,
                CONVERT(VARCHAR(33), DATA_EVENTO_UTC, 126) AS DATA_EVENTO_UTC,
                PAYLOAD_JSON
            FROM whatsapp.TB_EVENTOS
            WHERE ID_EVENTO > ?
            ORDER BY ID_EVENTO ASC
        """
        return self.executor.execute_fetch(
            query=query,
            parametros=(ultimo_id,)
        ) or []

    def buscar_eventos_apos_id_por_carteira(self, ultimo_id: int, carteira: str):
        query = """
            SELECT TOP 100
                E.ID_EVENTO,
                E.TIPO_EVENTO,
                E.ID_CONVERSA,
                CONVERT(VARCHAR(33), E.DATA_EVENTO_UTC, 126) AS DATA_EVENTO_UTC,
                E.PAYLOAD_JSON
            FROM whatsapp.TB_EVENTOS E
            INNER JOIN whatsapp.TB_CONVERSAS C
                ON C.ID_CONVERSA = E.ID_CONVERSA
            INNER JOIN whatsapp.TB_NUMEROS_WHATSAPP N
                ON N.NUMERO_TELEFONE = C.NUMERO_EMPRESA
            WHERE E.ID_EVENTO > ?
              AND N.CARTEIRA = ?
            ORDER BY E.ID_EVENTO ASC
        """
        return self.executor.execute_fetch(
            query=query,
            parametros=(ultimo_id, carteira)
        ) or []
    
