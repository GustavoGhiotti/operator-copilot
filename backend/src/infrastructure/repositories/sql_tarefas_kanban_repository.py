from src.infrastructure.database.sql_server_connection import SQLServerConnection
from src.shared.utils.env_load import DB_HOST_66


class TarefasKanbanRepository:
    def __init__(self):
        self.db = SQLServerConnection(
            DB_HOST_66,
            "DB_COPILOT_ACME"
        )

    def obter_usuario(self, cpf):
        return self.db.execute_fetch(
            query="""
                SELECT
                    CONVERT(VARCHAR(20), CPF_COLABORADOR) AS CPF,
                    LTRIM(RTRIM(NM_COLABORADOR)) AS NOME,
                    LTRIM(RTRIM(FUNCAO_COLABORADOR)) AS FUNCAO,
                    LTRIM(RTRIM(CENTRO_CUSTO)) AS CENTRO_CUSTO
                FROM login.TB_USUARIOS WITH(NOLOCK)
                WHERE CONVERT(VARCHAR(20), CPF_COLABORADOR) = ?
                  AND ISNULL(USUARIO_ATIVO, 1) = 1
            """,
            parametros=(str(cpf),),
            one=True
        )

    def listar_tarefas(self, cpf, visao, equipe_id=None):
        condicao = """
            tarefa.CPF_RESPONSAVEL = ?
            AND (
                ISNULL(tarefa.ORIGEM, 'PESSOAL') = 'PESSOAL'
                OR tarefa.CPF_CRIADOR = tarefa.CPF_RESPONSAVEL
            )
        """
        parametros = [str(cpf)]

        if visao == "atribuidas":
            condicao = """
                tarefa.CPF_RESPONSAVEL = ?
                AND (
                    ISNULL(tarefa.ORIGEM, 'PESSOAL') = 'EQUIPE'
                    OR tarefa.CPF_CRIADOR <> tarefa.CPF_RESPONSAVEL
                )
            """
        elif visao == "equipe":
            condicao = "tarefa.ID_EQUIPE = CAST(? AS uniqueidentifier)"
            parametros = [str(equipe_id)]
        elif visao == "equipe_membro":
            condicao = """
                tarefa.ID_EQUIPE = CAST(? AS uniqueidentifier)
                AND tarefa.CPF_RESPONSAVEL = ?
            """
            parametros = [str(equipe_id), str(cpf)]
        elif visao == "quadro":
            condicao = "tarefa.ID_QUADRO = CAST(? AS uniqueidentifier)"
            parametros = [str(equipe_id)]
        elif visao == "quadro_membro":
            condicao = """
                tarefa.ID_QUADRO = CAST(? AS uniqueidentifier)
                AND tarefa.CPF_RESPONSAVEL = ?
            """
            parametros = [str(equipe_id), str(cpf)]
        elif visao == "todas":
            condicao = """
                equipe.SUPERVISOR_CPF = ?
            """
            parametros = [str(cpf)]

        query = f"""
            SELECT
                tarefa.ID_TODO AS ID,
                tarefa.TITULO,
                tarefa.DESCRICAO,
                tarefa.CATEGORIA,
                tarefa.PRIORIDADE,
                tarefa.STATUS,
                tarefa.DATA_VENCIMENTO,
                tarefa.HORA_VENCIMENTO,
                tarefa.DATA_CRIACAO,
                tarefa.DATA_ATUALIZACAO,
                tarefa.CPF_CRIADOR,
                tarefa.CPF_RESPONSAVEL,
                tarefa.ORIGEM,
                tarefa.ORDEM_KANBAN,
                tarefa.SUGERIR_FINALIZACAO,
                tarefa.RECORRENCIA_TIPO,
                tarefa.RECORRENCIA_INTERVALO,
                tarefa.RECORRENCIA_ATE,
                tarefa.LEMBRETE_MINUTOS,
                tarefa.ID_TAREFA_ORIGEM,
                tarefa.ID_PROXIMA_OCORRENCIA,
                CONVERT(VARCHAR(36), tarefa.ID_QUADRO) AS ID_QUADRO,
                CONVERT(VARCHAR(36), tarefa.ID_LISTA) AS ID_LISTA,
                CONVERT(VARCHAR(36), tarefa.ID_EQUIPE) AS ID_EQUIPE,
                LTRIM(RTRIM(responsavel.NM_COLABORADOR))
                    AS RESPONSAVEL_NOME,
                LTRIM(RTRIM(criador.NM_COLABORADOR))
                    AS CRIADOR_NOME,
                equipe.NOME AS EQUIPE_NOME,
                lista.NOME AS LISTA_NOME,
                lista.COR AS LISTA_COR,
                (
                    SELECT COUNT(1)
                    FROM dbo.TB_TAREFAS_COMENTARIOS comentario WITH(NOLOCK)
                    WHERE comentario.ID_TODO = tarefa.ID_TODO
                      AND comentario.EXCLUIDO = 0
                ) AS COMENTARIOS_TOTAL,
                (
                    SELECT COUNT(1)
                    FROM dbo.TB_TAREFAS_ANEXOS anexo WITH(NOLOCK)
                    WHERE anexo.ID_TODO = tarefa.ID_TODO
                      AND anexo.EXCLUIDO = 0
                ) AS ANEXOS_TOTAL,
                COUNT(checklist.ID_ITEM) AS CHECKLIST_TOTAL,
                SUM(
                    CASE
                        WHEN checklist.CONCLUIDO = 1 THEN 1
                        ELSE 0
                    END
                ) AS CHECKLIST_CONCLUIDO
            FROM dbo.TB_TODOS tarefa WITH(NOLOCK)
            LEFT JOIN login.TB_USUARIOS responsavel WITH(NOLOCK)
                ON CONVERT(VARCHAR(20), responsavel.CPF_COLABORADOR)
                 = tarefa.CPF_RESPONSAVEL
            LEFT JOIN login.TB_USUARIOS criador WITH(NOLOCK)
                ON CONVERT(VARCHAR(20), criador.CPF_COLABORADOR)
                 = tarefa.CPF_CRIADOR
            LEFT JOIN dbo.TB_TAREFAS_EQUIPES equipe WITH(NOLOCK)
                ON equipe.ID_EQUIPE = tarefa.ID_EQUIPE
            LEFT JOIN dbo.TB_TAREFAS_CHECKLIST checklist WITH(NOLOCK)
                ON checklist.ID_TODO = tarefa.ID_TODO
            LEFT JOIN dbo.TB_TAREFAS_LISTAS lista WITH(NOLOCK)
                ON lista.ID_LISTA = tarefa.ID_LISTA
            WHERE ISNULL(tarefa.ARQUIVADA, 0) = 0
              AND {condicao}
            GROUP BY
                tarefa.ID_TODO,
                tarefa.TITULO,
                tarefa.DESCRICAO,
                tarefa.CATEGORIA,
                tarefa.PRIORIDADE,
                tarefa.STATUS,
                tarefa.DATA_VENCIMENTO,
                tarefa.HORA_VENCIMENTO,
                tarefa.DATA_CRIACAO,
                tarefa.DATA_ATUALIZACAO,
                tarefa.CPF_CRIADOR,
                tarefa.CPF_RESPONSAVEL,
                tarefa.ORIGEM,
                tarefa.ORDEM_KANBAN,
                tarefa.SUGERIR_FINALIZACAO,
                tarefa.RECORRENCIA_TIPO,
                tarefa.RECORRENCIA_INTERVALO,
                tarefa.RECORRENCIA_ATE,
                tarefa.LEMBRETE_MINUTOS,
                tarefa.ID_TAREFA_ORIGEM,
                tarefa.ID_PROXIMA_OCORRENCIA,
                tarefa.ID_QUADRO,
                tarefa.ID_LISTA,
                tarefa.ID_EQUIPE,
                responsavel.NM_COLABORADOR,
                criador.NM_COLABORADOR,
                equipe.NOME,
                lista.NOME,
                lista.COR
            ORDER BY
                ISNULL(tarefa.ORDEM_KANBAN, tarefa.ID_TODO),
                tarefa.DATA_CRIACAO DESC
        """
        return self.db.execute_fetch(
            query=query,
            parametros=tuple(parametros),
            one=False
        ) or []

    def obter_resumo_gerencial(self):
        return self.db.execute_fetch(
            query="""
                SELECT
                    COUNT(1) AS TOTAL_TAREFAS,
                    SUM(CASE WHEN tarefa.STATUS = 'concluido' THEN 1 ELSE 0 END)
                        AS CONCLUIDAS,
                    SUM(CASE WHEN tarefa.STATUS = 'em_andamento' THEN 1 ELSE 0 END)
                        AS EM_ANDAMENTO,
                    SUM(CASE
                        WHEN tarefa.STATUS <> 'concluido'
                         AND tarefa.DATA_VENCIMENTO < CAST(GETDATE() AS DATE)
                        THEN 1 ELSE 0 END) AS ATRASADAS,
                    COUNT(DISTINCT tarefa.ID_EQUIPE) AS EQUIPES_COM_TAREFAS,
                    COUNT(DISTINCT COALESCE(
                        NULLIF(LTRIM(RTRIM(equipe.CENTRO_CUSTO_REFERENCIA)), ''),
                        NULLIF(LTRIM(RTRIM(usuario.CENTRO_CUSTO)), ''),
                        'SEM CENTRO DE CUSTO'
                    )) AS AREAS
                FROM dbo.TB_TODOS tarefa WITH(NOLOCK)
                LEFT JOIN dbo.TB_TAREFAS_EQUIPES equipe WITH(NOLOCK)
                    ON equipe.ID_EQUIPE = tarefa.ID_EQUIPE
                LEFT JOIN login.TB_USUARIOS usuario WITH(NOLOCK)
                    ON CONVERT(VARCHAR(20), usuario.CPF_COLABORADOR)
                     = tarefa.CPF_RESPONSAVEL
                WHERE ISNULL(tarefa.ARQUIVADA, 0) = 0
            """,
            parametros=(),
            one=True
        ) or {}

    def listar_centros_custo_gerenciais(self):
        return self.db.execute_fetch(
            query="""
                SELECT DISTINCT LTRIM(RTRIM(CENTRO_CUSTO)) AS centro_custo
                FROM login.TB_USUARIOS WITH (NOLOCK)
                WHERE NULLIF(LTRIM(RTRIM(CENTRO_CUSTO)), '') IS NOT NULL
                ORDER BY centro_custo
            """,
            parametros=(),
            one=False,
        ) or []

    def listar_resumo_gerencial_areas(self):
        return self.db.execute_fetch(
            query="""
                SELECT
                    COALESCE(
                        NULLIF(LTRIM(RTRIM(equipe.CENTRO_CUSTO_REFERENCIA)), ''),
                        NULLIF(LTRIM(RTRIM(usuario.CENTRO_CUSTO)), ''),
                        'SEM CENTRO DE CUSTO'
                    ) AS CENTRO_CUSTO,
                    COUNT(DISTINCT tarefa.ID_EQUIPE) AS EQUIPES,
                    COUNT(DISTINCT tarefa.CPF_RESPONSAVEL) AS COLABORADORES,
                    COUNT(1) AS TOTAL_TAREFAS,
                    SUM(CASE WHEN tarefa.STATUS = 'concluido' THEN 1 ELSE 0 END)
                        AS CONCLUIDAS,
                    SUM(CASE WHEN tarefa.STATUS = 'em_andamento' THEN 1 ELSE 0 END)
                        AS EM_ANDAMENTO,
                    SUM(CASE
                        WHEN tarefa.STATUS <> 'concluido'
                         AND tarefa.DATA_VENCIMENTO < CAST(GETDATE() AS DATE)
                        THEN 1 ELSE 0 END) AS ATRASADAS
                FROM dbo.TB_TODOS tarefa WITH(NOLOCK)
                LEFT JOIN dbo.TB_TAREFAS_EQUIPES equipe WITH(NOLOCK)
                    ON equipe.ID_EQUIPE = tarefa.ID_EQUIPE
                LEFT JOIN login.TB_USUARIOS usuario WITH(NOLOCK)
                    ON CONVERT(VARCHAR(20), usuario.CPF_COLABORADOR)
                     = tarefa.CPF_RESPONSAVEL
                WHERE ISNULL(tarefa.ARQUIVADA, 0) = 0
                GROUP BY COALESCE(
                    NULLIF(LTRIM(RTRIM(equipe.CENTRO_CUSTO_REFERENCIA)), ''),
                    NULLIF(LTRIM(RTRIM(usuario.CENTRO_CUSTO)), ''),
                    'SEM CENTRO DE CUSTO'
                )
                ORDER BY ATRASADAS DESC, TOTAL_TAREFAS DESC
            """,
            parametros=(),
            one=False
        ) or []

    def listar_atencoes_gerenciais(self):
        return self.db.execute_fetch(
            query="""
                SELECT TOP 8
                    tarefa.ID_TODO AS ID,
                    tarefa.TITULO,
                    tarefa.PRIORIDADE,
                    tarefa.STATUS,
                    tarefa.DATA_VENCIMENTO,
                    LTRIM(RTRIM(usuario.NM_COLABORADOR)) AS RESPONSAVEL,
                    equipe.NOME AS EQUIPE,
                    COALESCE(
                        NULLIF(LTRIM(RTRIM(equipe.CENTRO_CUSTO_REFERENCIA)), ''),
                        NULLIF(LTRIM(RTRIM(usuario.CENTRO_CUSTO)), ''),
                        'SEM CENTRO DE CUSTO'
                    ) AS CENTRO_CUSTO,
                    CASE
                        WHEN tarefa.DATA_VENCIMENTO < CAST(GETDATE() AS DATE)
                        THEN DATEDIFF(DAY, tarefa.DATA_VENCIMENTO, GETDATE())
                        ELSE 0
                    END AS DIAS_ATRASO
                FROM dbo.TB_TODOS tarefa WITH(NOLOCK)
                LEFT JOIN dbo.TB_TAREFAS_EQUIPES equipe WITH(NOLOCK)
                    ON equipe.ID_EQUIPE = tarefa.ID_EQUIPE
                LEFT JOIN login.TB_USUARIOS usuario WITH(NOLOCK)
                    ON CONVERT(VARCHAR(20), usuario.CPF_COLABORADOR)
                     = tarefa.CPF_RESPONSAVEL
                WHERE ISNULL(tarefa.ARQUIVADA, 0) = 0
                  AND tarefa.STATUS <> 'concluido'
                  AND (
                    tarefa.DATA_VENCIMENTO < CAST(GETDATE() AS DATE)
                    OR tarefa.PRIORIDADE IN ('alta', 'urgente')
                  )
                ORDER BY
                    CASE WHEN tarefa.DATA_VENCIMENTO < CAST(GETDATE() AS DATE)
                         THEN 0 ELSE 1 END,
                    DIAS_ATRASO DESC,
                    CASE tarefa.PRIORIDADE
                        WHEN 'urgente' THEN 0 WHEN 'alta' THEN 1 ELSE 2 END
            """,
            parametros=(),
            one=False
        ) or []

    def listar_evolucao_gerencial(self, centro_custo=None):
        return self.db.execute_fetch(
            query="""
                WITH meses AS (
                    SELECT 0 AS N
                    UNION ALL SELECT 1 UNION ALL SELECT 2
                    UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5
                ), base AS (
                    SELECT DATEFROMPARTS(
                        YEAR(DATEADD(MONTH, -N, GETDATE())),
                        MONTH(DATEADD(MONTH, -N, GETDATE())), 1
                    ) AS MES
                    FROM meses
                )
                SELECT
                    CONVERT(CHAR(7), base.MES, 120) AS MES_CHAVE,
                    COUNT(tarefa.ID_TODO) AS CRIADAS,
                    SUM(CASE WHEN tarefa.STATUS = 'concluido' THEN 1 ELSE 0 END)
                        AS CONCLUIDAS
                FROM base
                LEFT JOIN (
                    SELECT T.ID_TODO, T.DATA_CRIACAO, T.STATUS
                    FROM dbo.TB_TODOS T WITH(NOLOCK)
                    LEFT JOIN dbo.TB_TAREFAS_EQUIPES E WITH(NOLOCK)
                        ON E.ID_EQUIPE = T.ID_EQUIPE
                    LEFT JOIN login.TB_USUARIOS U WITH(NOLOCK)
                        ON CONVERT(VARCHAR(20), U.CPF_COLABORADOR)
                         = T.CPF_RESPONSAVEL
                    WHERE ISNULL(T.ARQUIVADA, 0) = 0
                      AND (
                        ? IS NULL OR COALESCE(
                            NULLIF(LTRIM(RTRIM(E.CENTRO_CUSTO_REFERENCIA)), ''),
                            NULLIF(LTRIM(RTRIM(U.CENTRO_CUSTO)), ''),
                            'SEM CENTRO DE CUSTO'
                        ) = ?
                      )
                ) tarefa
                    ON tarefa.DATA_CRIACAO >= base.MES
                   AND tarefa.DATA_CRIACAO < DATEADD(MONTH, 1, base.MES)
                GROUP BY base.MES
                ORDER BY base.MES
            """,
            parametros=(centro_custo, centro_custo),
            one=False
        ) or []

    def listar_equipes_gerenciais(self):
        return self.db.execute_fetch(
            query="""
                SELECT
                    CONVERT(VARCHAR(36), E.ID_EQUIPE) AS id,
                    E.NOME AS nome,
                    COALESCE(NULLIF(LTRIM(RTRIM(E.CENTRO_CUSTO_REFERENCIA)), ''),
                             'NAO INFORMADO') AS centro_custo,
                    LTRIM(RTRIM(U.NM_COLABORADOR)) AS supervisor,
                    COUNT(DISTINCT CASE WHEN M.STATUS_CONVITE = 'ACEITO'
                        THEN M.CPF_COLABORADOR END) AS membros,
                    COUNT(DISTINCT CASE WHEN M.STATUS_CONVITE = 'PENDENTE'
                        THEN M.CPF_COLABORADOR END) AS convites_pendentes,
                    COUNT(DISTINCT CASE
                        WHEN ISNULL(T.ARQUIVADA, 0) = 0 THEN T.ID_TODO END)
                        AS tarefas,
                    COUNT(DISTINCT CASE
                        WHEN ISNULL(T.ARQUIVADA, 0) = 0
                         AND T.STATUS = 'concluido' THEN T.ID_TODO END)
                        AS concluidas,
                    COUNT(DISTINCT CASE
                        WHEN ISNULL(T.ARQUIVADA, 0) = 0
                         AND T.STATUS <> 'concluido'
                         AND T.DATA_VENCIMENTO < CAST(GETDATE() AS DATE)
                        THEN T.ID_TODO END) AS atrasadas
                FROM dbo.TB_TAREFAS_EQUIPES E WITH (NOLOCK)
                LEFT JOIN dbo.TB_TAREFAS_EQUIPE_MEMBROS M WITH (NOLOCK)
                    ON M.ID_EQUIPE = E.ID_EQUIPE
                LEFT JOIN dbo.TB_TODOS T WITH (NOLOCK)
                    ON T.ID_EQUIPE = E.ID_EQUIPE
                LEFT JOIN login.TB_USUARIOS U WITH (NOLOCK)
                    ON CONVERT(VARCHAR(20), U.CPF_COLABORADOR) = E.SUPERVISOR_CPF
                WHERE E.ATIVA = 1
                GROUP BY E.ID_EQUIPE, E.NOME, E.CENTRO_CUSTO_REFERENCIA,
                         U.NM_COLABORADOR, E.CREATED_AT
                ORDER BY atrasadas DESC, membros DESC, E.CREATED_AT DESC
            """,
            parametros=(),
            one=False,
        ) or []

    def obter_qualidade_gerencial(self, periodo_dias=30, centro_custo=None):
        resumo = self.db.execute_fetch(
            query="""
                SELECT
                    SUM(CASE WHEN F.DATA_REGISTRO >= DATEADD(DAY, -?, GETDATE())
                             THEN 1 ELSE 0 END) AS monitorias,
                    COUNT(DISTINCT CASE
                        WHEN F.DATA_REGISTRO >= DATEADD(DAY, -?, GETDATE())
                        THEN NULLIF(LTRIM(RTRIM(F.CPF_OPERADOR)), '') END)
                        AS operadores,
                    COUNT(DISTINCT CASE
                        WHEN F.DATA_REGISTRO >= DATEADD(DAY, -?, GETDATE())
                        THEN NULLIF(LTRIM(RTRIM(F.MONITOR_NOME)), '') END)
                        AS monitores,
                    CAST(ISNULL(AVG(CASE
                        WHEN F.DATA_REGISTRO >= DATEADD(DAY, -?, GETDATE())
                        THEN CAST(F.PONTUACAO AS FLOAT) END), 0)
                         AS DECIMAL(8,2)) AS nota_media,
                    SUM(CASE WHEN F.DATA_REGISTRO >= DATEADD(DAY, -?, GETDATE())
                              AND F.IS_POSITIVO = 0 THEN 1 ELSE 0 END)
                        AS negativas,
                    SUM(CASE WHEN F.DATA_REGISTRO >= DATEADD(DAY, -?, GETDATE())
                             THEN 1 ELSE 0 END) AS ultimos_30_dias,
                    SUM(CASE WHEN F.DATA_REGISTRO >= DATEADD(DAY, -(? * 2), GETDATE())
                              AND F.DATA_REGISTRO < DATEADD(DAY, -?, GETDATE())
                             THEN 1 ELSE 0 END) AS monitorias_anteriores,
                    CAST(ISNULL(AVG(CASE
                        WHEN F.DATA_REGISTRO >= DATEADD(DAY, -(? * 2), GETDATE())
                         AND F.DATA_REGISTRO < DATEADD(DAY, -?, GETDATE())
                        THEN CAST(F.PONTUACAO AS FLOAT) END), 0)
                         AS DECIMAL(8,2)) AS nota_media_anterior
                FROM dbo.TB_FEEDBACK_QUALIDADE F WITH (NOLOCK)
                LEFT JOIN login.TB_USUARIOS U WITH (NOLOCK)
                    ON CONVERT(VARCHAR(20), U.CPF_COLABORADOR)
                     = CONVERT(VARCHAR(20), F.CPF_OPERADOR)
                WHERE (? IS NULL OR LTRIM(RTRIM(U.CENTRO_CUSTO)) = ?)
            """,
            parametros=(
                periodo_dias, periodo_dias, periodo_dias, periodo_dias,
                periodo_dias, periodo_dias, periodo_dias, periodo_dias,
                periodo_dias, periodo_dias, centro_custo, centro_custo,
            ),
            one=True,
        ) or {}

        carteiras = self.db.execute_fetch(
            query="""
                SELECT
                    COALESCE(NULLIF(LTRIM(RTRIM(CARTEIRA_LABEL)), ''),
                             'NAO INFORMADO') AS carteira,
                    COUNT(1) AS monitorias,
                    COUNT(DISTINCT NULLIF(LTRIM(RTRIM(CPF_OPERADOR)), ''))
                        AS operadores,
                    CAST(ISNULL(AVG(CAST(PONTUACAO AS FLOAT)), 0)
                         AS DECIMAL(8,2)) AS nota_media,
                    SUM(CASE WHEN IS_POSITIVO = 0 THEN 1 ELSE 0 END)
                        AS negativas,
                    MAX(DATA_REGISTRO) AS ultima_monitoria
                FROM dbo.TB_FEEDBACK_QUALIDADE F WITH (NOLOCK)
                LEFT JOIN login.TB_USUARIOS U WITH (NOLOCK)
                    ON CONVERT(VARCHAR(20), U.CPF_COLABORADOR)
                     = CONVERT(VARCHAR(20), F.CPF_OPERADOR)
                WHERE F.DATA_REGISTRO >= DATEADD(DAY, -?, GETDATE())
                  AND (? IS NULL OR LTRIM(RTRIM(U.CENTRO_CUSTO)) = ?)
                GROUP BY COALESCE(NULLIF(LTRIM(RTRIM(CARTEIRA_LABEL)), ''),
                                  'NAO INFORMADO')
                ORDER BY nota_media, monitorias DESC
            """,
            parametros=(periodo_dias, centro_custo, centro_custo),
            one=False,
        ) or []

        evolucao = self.db.execute_fetch(
            query="""
                WITH MESES AS (
                    SELECT 0 AS N UNION ALL SELECT 1 UNION ALL SELECT 2
                    UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5
                ), BASE AS (
                    SELECT DATEFROMPARTS(YEAR(DATEADD(MONTH, -N, GETDATE())),
                        MONTH(DATEADD(MONTH, -N, GETDATE())), 1) AS MES
                    FROM MESES
                )
                SELECT CONVERT(CHAR(7), B.MES, 120) AS mes,
                       COUNT(F.ID_FEEDBACK) AS monitorias,
                       CAST(ISNULL(AVG(CAST(F.PONTUACAO AS FLOAT)), 0)
                            AS DECIMAL(8,2)) AS nota_media
                FROM BASE B
                LEFT JOIN dbo.TB_FEEDBACK_QUALIDADE F WITH (NOLOCK)
                    ON F.DATA_REGISTRO >= B.MES
                   AND F.DATA_REGISTRO < DATEADD(MONTH, 1, B.MES)
                LEFT JOIN login.TB_USUARIOS U WITH (NOLOCK)
                    ON CONVERT(VARCHAR(20), U.CPF_COLABORADOR)
                     = CONVERT(VARCHAR(20), F.CPF_OPERADOR)
                WHERE (? IS NULL OR LTRIM(RTRIM(U.CENTRO_CUSTO)) = ?)
                GROUP BY B.MES
                ORDER BY B.MES
            """,
            parametros=(centro_custo, centro_custo),
            one=False,
        ) or []
        return {"resumo": resumo, "carteiras": carteiras, "evolucao": evolucao}

    def obter_uso_copilot_gerencial(self, periodo_dias=30, centro_custo=None):
        resumo = self.db.execute_fetch(
            query="""
                SELECT
                    COUNT(1) AS acessos,
                    COUNT(DISTINCT CPF_COLABORADOR) AS usuarios,
                    SUM(CASE WHEN A.HORA_LOGIN >= DATEADD(DAY, -?, GETDATE())
                             THEN 1 ELSE 0 END) AS acessos_30_dias,
                    COUNT(DISTINCT CASE
                        WHEN A.HORA_LOGIN >= DATEADD(DAY, -?, GETDATE())
                        THEN A.CPF_COLABORADOR END) AS usuarios_30_dias,
                    SUM(CASE WHEN A.HORA_LOGIN >= DATEADD(DAY, -(? * 2), GETDATE())
                              AND A.HORA_LOGIN < DATEADD(DAY, -?, GETDATE())
                             THEN 1 ELSE 0 END) AS acessos_anteriores,
                    COUNT(DISTINCT CASE
                        WHEN A.HORA_LOGIN >= DATEADD(DAY, -(? * 2), GETDATE())
                         AND A.HORA_LOGIN < DATEADD(DAY, -?, GETDATE())
                        THEN A.CPF_COLABORADOR END) AS usuarios_anteriores,
                    MAX(A.HORA_LOGIN) AS ultimo_acesso
                FROM dbo.TB_LOG_ACESSO_COPILOT A WITH (NOLOCK)
                LEFT JOIN login.TB_USUARIOS U WITH (NOLOCK)
                    ON U.CPF_COLABORADOR = A.CPF_COLABORADOR
                WHERE (? IS NULL OR LTRIM(RTRIM(U.CENTRO_CUSTO)) = ?)
            """,
            parametros=(
                periodo_dias, periodo_dias, periodo_dias, periodo_dias,
                periodo_dias, periodo_dias, centro_custo, centro_custo,
            ),
            one=True,
        ) or {}

        centros = self.db.execute_fetch(
            query="""
                SELECT
                    COALESCE(NULLIF(LTRIM(RTRIM(U.CENTRO_CUSTO)), ''),
                             'NAO INFORMADO') AS centro_custo,
                    COUNT(A.CPF_COLABORADOR) AS acessos,
                    COUNT(DISTINCT A.CPF_COLABORADOR) AS usuarios,
                    MAX(A.HORA_LOGIN) AS ultimo_acesso
                FROM dbo.TB_LOG_ACESSO_COPILOT A WITH (NOLOCK)
                LEFT JOIN login.TB_USUARIOS U WITH (NOLOCK)
                    ON U.CPF_COLABORADOR = A.CPF_COLABORADOR
                WHERE A.HORA_LOGIN >= DATEADD(DAY, -?, GETDATE())
                  AND (? IS NULL OR LTRIM(RTRIM(U.CENTRO_CUSTO)) = ?)
                GROUP BY COALESCE(NULLIF(LTRIM(RTRIM(U.CENTRO_CUSTO)), ''),
                                  'NAO INFORMADO')
                ORDER BY acessos DESC
            """,
            parametros=(periodo_dias, centro_custo, centro_custo),
            one=False,
        ) or []

        comandos = self.db.execute_fetch(
            query="""
                IF OBJECT_ID('dbo.TB_COPILOT_EVENTO_USO', 'U') IS NOT NULL
                BEGIN
                    SELECT TOP 12 COMANDO AS comando,
                           COUNT(1) AS usos,
                           COUNT(DISTINCT CPF_COLABORADOR) AS usuarios
                    FROM dbo.TB_COPILOT_EVENTO_USO WITH (NOLOCK)
                    WHERE DATA_EVENTO >= DATEADD(DAY, -?, GETDATE())
                      AND (? IS NULL OR LTRIM(RTRIM(CENTRO_CUSTO_SNAPSHOT)) = ?)
                    GROUP BY COMANDO
                    ORDER BY usos DESC, COMANDO
                END
            """,
            parametros=(periodo_dias, centro_custo, centro_custo),
            one=False,
        ) or []
        return {"resumo": resumo, "centros": centros, "comandos": comandos}

    def registrar_evento_uso(self, cpf, comando, centro_custo):
        return self.db.execute_commit(
            query="""
                IF OBJECT_ID('dbo.TB_COPILOT_EVENTO_USO', 'U') IS NOT NULL
                BEGIN
                    INSERT INTO dbo.TB_COPILOT_EVENTO_USO (
                        CPF_COLABORADOR, COMANDO, CENTRO_CUSTO_SNAPSHOT
                    ) VALUES (?, ?, ?)
                END
            """,
            parametros=(str(cpf), comando, centro_custo),
        )

    def obter_tarefa(self, id_todo):
        return self.db.execute_fetch(
            query="""
                SELECT
                    ID_TODO,
                    TITULO,
                    DESCRICAO,
                    CATEGORIA,
                    PRIORIDADE,
                    CPF_CRIADOR,
                    CPF_RESPONSAVEL,
                    CONVERT(VARCHAR(36), ID_QUADRO) AS ID_QUADRO,
                    CONVERT(VARCHAR(36), ID_LISTA) AS ID_LISTA,
                    CONVERT(VARCHAR(36), ID_EQUIPE) AS ID_EQUIPE,
                    ORIGEM,
                    STATUS,
                    DATA_VENCIMENTO,
                    HORA_VENCIMENTO,
                    SUGERIR_FINALIZACAO,
                    RECORRENCIA_TIPO,
                    RECORRENCIA_INTERVALO,
                    RECORRENCIA_ATE,
                    LEMBRETE_MINUTOS,
                    ID_TAREFA_ORIGEM,
                    ID_PROXIMA_OCORRENCIA
                FROM dbo.TB_TODOS WITH(NOLOCK)
                WHERE ID_TODO = ?
                  AND ISNULL(ARQUIVADA, 0) = 0
            """,
            parametros=(id_todo,),
            one=True
        )

    def listar_checklist(self, id_todo):
        return self.db.execute_fetch(
            query="""
                SELECT
                    ID_ITEM AS ID,
                    TEXTO,
                    CONCLUIDO,
                    ORDEM
                FROM dbo.TB_TAREFAS_CHECKLIST WITH(NOLOCK)
                WHERE ID_TODO = ?
                ORDER BY ORDEM, ID_ITEM
            """,
            parametros=(id_todo,),
            one=False
        ) or []

    def listar_checklists_em_lote(self, ids_todo):
        """Checklist de várias tarefas de uma vez, agrupado por tarefa.

        Carregar o quadro item a item custava uma conexão por tarefa —
        um quadro de 200 cartões abria 200 conexões a cada atualização.
        """
        ids = [int(item) for item in ids_todo or []]
        if not ids:
            return {}

        agrupado = {}
        # O SQL Server aceita no máximo 2100 parâmetros por comando.
        lote = 500
        for inicio in range(0, len(ids), lote):
            bloco = ids[inicio:inicio + lote]
            marcadores = ", ".join("?" for _ in bloco)
            rows = self.db.execute_fetch(
                query=f"""
                    SELECT
                        ID_TODO,
                        ID_ITEM AS ID,
                        TEXTO,
                        CONCLUIDO,
                        ORDEM
                    FROM dbo.TB_TAREFAS_CHECKLIST WITH(NOLOCK)
                    WHERE ID_TODO IN ({marcadores})
                    ORDER BY ID_TODO, ORDEM, ID_ITEM
                """,
                parametros=tuple(bloco),
                one=False
            ) or []
            for row in rows:
                agrupado.setdefault(row["ID_TODO"], []).append(row)
        return agrupado

    def criar_tarefa(
        self,
        *,
        usuario_nome,
        cpf_criador,
        cpf_responsavel,
        titulo,
        descricao,
        categoria,
        prioridade,
        status,
        data_vencimento,
        hora_vencimento,
        origem,
        equipe_id,
        quadro_id=None,
        lista_id=None,
        recorrencia_tipo=None,
        recorrencia_intervalo=None,
        recorrencia_ate=None,
        lembrete_minutos=None,
        id_tarefa_origem=None,
    ):
        return self.db.execute_fetch(
            query="""
                INSERT INTO dbo.TB_TODOS (
                    USUARIO,
                    TITULO,
                    DESCRICAO,
                    CATEGORIA,
                    PRIORIDADE,
                    STATUS,
                    DATA_VENCIMENTO,
                    HORA_VENCIMENTO,
                    CPF_CRIADOR,
                    CPF_RESPONSAVEL,
                    ORIGEM,
                    ID_EQUIPE,
                    ID_QUADRO,
                    ID_LISTA,
                    ORDEM_KANBAN,
                    ARQUIVADA,
                    RECORRENCIA_TIPO,
                    RECORRENCIA_INTERVALO,
                    RECORRENCIA_ATE,
                    LEMBRETE_MINUTOS,
                    ID_TAREFA_ORIGEM
                )
                OUTPUT INSERTED.ID_TODO AS ID
                VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?,
                    CAST(? AS uniqueidentifier),
                    CAST(? AS uniqueidentifier),
                    CAST(? AS uniqueidentifier),
                    0,
                    0,
                    ?, ?, ?, ?, ?
                )
            """,
            parametros=(
                usuario_nome,
                titulo,
                descricao,
                categoria,
                prioridade,
                status,
                data_vencimento,
                hora_vencimento,
                str(cpf_criador),
                str(cpf_responsavel),
                origem,
                equipe_id,
                quadro_id,
                lista_id,
                recorrencia_tipo,
                recorrencia_intervalo,
                recorrencia_ate,
                lembrete_minutos,
                id_tarefa_origem,
            ),
            one=True
        )

    def atualizar_tarefa(
        self,
        *,
        id_todo,
        titulo,
        descricao,
        categoria,
        prioridade,
        data_vencimento,
        hora_vencimento,
        recorrencia_tipo,
        recorrencia_intervalo,
        recorrencia_ate,
        lembrete_minutos,
    ):
        return self.db.execute_commit(
            query="""
                UPDATE dbo.TB_TODOS
                SET
                    TITULO = ?,
                    DESCRICAO = ?,
                    CATEGORIA = ?,
                    PRIORIDADE = ?,
                    DATA_VENCIMENTO = ?,
                    HORA_VENCIMENTO = ?,
                    RECORRENCIA_TIPO = ?,
                    RECORRENCIA_INTERVALO = ?,
                    RECORRENCIA_ATE = ?,
                    LEMBRETE_MINUTOS = ?,
                    DATA_ATUALIZACAO = GETDATE()
                WHERE ID_TODO = ?
                  AND ISNULL(ARQUIVADA, 0) = 0
            """,
            parametros=(
                titulo,
                descricao,
                categoria,
                prioridade,
                data_vencimento,
                hora_vencimento,
                recorrencia_tipo,
                recorrencia_intervalo,
                recorrencia_ate,
                lembrete_minutos,
                id_todo,
            )
        )

    def mover_tarefa(self, id_todo, status, ordem, lista_id=None):
        return self.db.execute_commit(
            query="""
                UPDATE dbo.TB_TODOS
                SET
                    STATUS = ?,
                    ORDEM_KANBAN = ?,
                    ID_LISTA = COALESCE(
                        CAST(? AS uniqueidentifier),
                        ID_LISTA
                    ),
                    DATA_ATUALIZACAO = GETDATE()
                WHERE ID_TODO = ?
                  AND ISNULL(ARQUIVADA, 0) = 0
            """,
            parametros=(status, ordem, lista_id, id_todo)
        )

    def reagendar_tarefa(
        self,
        id_todo,
        data_vencimento,
        hora_vencimento=None,
    ):
        return self.db.execute_commit(
            query="""
                UPDATE dbo.TB_TODOS
                SET
                    DATA_VENCIMENTO = ?,
                    HORA_VENCIMENTO = ?,
                    DATA_ATUALIZACAO = GETDATE()
                WHERE ID_TODO = ?
                  AND ISNULL(ARQUIVADA, 0) = 0
            """,
            parametros=(
                data_vencimento,
                hora_vencimento,
                id_todo,
            )
        )

    def vincular_proxima_ocorrencia(self, id_todo, proxima_id):
        return self.db.execute_commit(
            query="""
                UPDATE dbo.TB_TODOS
                SET ID_PROXIMA_OCORRENCIA = ?,
                    DATA_ATUALIZACAO = GETDATE()
                WHERE ID_TODO = ?
                  AND ID_PROXIMA_OCORRENCIA IS NULL
            """,
            parametros=(proxima_id, id_todo)
        )

    def criar_notificacao(
        self,
        cpf_destinatario,
        tipo,
        titulo,
        mensagem,
        id_todo=None,
        chave=None,
    ):
        if not chave:
            return self.db.execute_commit(
                query="""
                    INSERT INTO dbo.TB_TAREFAS_NOTIFICACOES (
                        CPF_DESTINATARIO,
                        ID_TODO,
                        TIPO,
                        TITULO,
                        MENSAGEM
                    )
                    VALUES (?, ?, ?, ?, ?)
                """,
                parametros=(
                    str(cpf_destinatario),
                    id_todo,
                    tipo,
                    titulo,
                    mensagem,
                )
            )
        return self.db.execute_commit(
            query="""
                INSERT INTO dbo.TB_TAREFAS_NOTIFICACOES (
                    CPF_DESTINATARIO,
                    ID_TODO,
                    TIPO,
                    TITULO,
                    MENSAGEM,
                    CHAVE_DEDUPLICACAO
                )
                SELECT ?, ?, ?, ?, ?, ?
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM dbo.TB_TAREFAS_NOTIFICACOES WITH(NOLOCK)
                    WHERE CHAVE_DEDUPLICACAO = ?
                )
            """,
            parametros=(
                str(cpf_destinatario),
                id_todo,
                tipo,
                titulo,
                mensagem,
                chave,
                chave,
            )
        )

    def listar_notificacoes(self, cpf):
        return self.db.execute_fetch(
            query="""
                SELECT TOP 60
                    ID_NOTIFICACAO AS ID,
                    ID_TODO,
                    TIPO,
                    TITULO,
                    MENSAGEM,
                    LIDA,
                    CREATED_AT
                FROM dbo.TB_TAREFAS_NOTIFICACOES WITH(NOLOCK)
                WHERE CPF_DESTINATARIO = ?
                ORDER BY LIDA, CREATED_AT DESC
            """,
            parametros=(str(cpf),),
            one=False
        ) or []

    def marcar_notificacao_lida(self, cpf, notificacao_id=None):
        if notificacao_id:
            return self.db.execute_commit(
                query="""
                    UPDATE dbo.TB_TAREFAS_NOTIFICACOES
                    SET LIDA = 1,
                        LIDA_EM = COALESCE(LIDA_EM, SYSDATETIME())
                    WHERE ID_NOTIFICACAO = ?
                      AND CPF_DESTINATARIO = ?
                """,
                parametros=(notificacao_id, str(cpf))
            )
        return self.db.execute_commit(
            query="""
                UPDATE dbo.TB_TAREFAS_NOTIFICACOES
                SET LIDA = 1,
                    LIDA_EM = COALESCE(LIDA_EM, SYSDATETIME())
                WHERE CPF_DESTINATARIO = ?
                  AND LIDA = 0
            """,
            parametros=(str(cpf),)
        )

    def listar_tarefas_para_lembrete(self, cpf):
        return self.db.execute_fetch(
            query="""
                SELECT
                    ID_TODO,
                    TITULO,
                    DATA_VENCIMENTO,
                    HORA_VENCIMENTO,
                    LEMBRETE_MINUTOS
                FROM dbo.TB_TODOS WITH(NOLOCK)
                WHERE CPF_RESPONSAVEL = ?
                  AND ISNULL(ARQUIVADA, 0) = 0
                  AND STATUS <> 'concluido'
                  AND DATA_VENCIMENTO IS NOT NULL
                  AND ISNULL(LEMBRETE_MINUTOS, 0) > 0
            """,
            parametros=(str(cpf),),
            one=False
        ) or []

    def listar_tarefas_para_lembrete_global(self, dias_atraso=30):
        """Tarefas de TODOS com lembrete pendente.

        A geração antiga só rodava quando o próprio usuário abria a tela —
        quem não abrisse nunca era avisado. A janela limita o retrabalho a
        vencimentos recentes e aos próximos dois dias.
        """
        return self.db.execute_fetch(
            query="""
                SELECT
                    LTRIM(RTRIM(CPF_RESPONSAVEL)) AS CPF_RESPONSAVEL,
                    ID_TODO,
                    TITULO,
                    DATA_VENCIMENTO,
                    HORA_VENCIMENTO,
                    LEMBRETE_MINUTOS
                FROM dbo.TB_TODOS WITH(NOLOCK)
                WHERE ISNULL(ARQUIVADA, 0) = 0
                  AND STATUS <> 'concluido'
                  AND DATA_VENCIMENTO IS NOT NULL
                  AND ISNULL(LEMBRETE_MINUTOS, 0) > 0
                  AND NULLIF(LTRIM(RTRIM(CPF_RESPONSAVEL)), '') IS NOT NULL
                  AND DATA_VENCIMENTO
                      >= DATEADD(DAY, ?, CAST(GETDATE() AS DATE))
                  AND DATA_VENCIMENTO
                      <= DATEADD(DAY, 2, CAST(GETDATE() AS DATE))
            """,
            parametros=(-abs(int(dias_atraso)),),
            one=False
        ) or []

    def arquivar_tarefa(self, id_todo):
        return self.db.execute_commit(
            query="""
                UPDATE dbo.TB_TODOS
                SET
                    ARQUIVADA = 1,
                    DATA_ATUALIZACAO = GETDATE()
                WHERE ID_TODO = ?
            """,
            parametros=(id_todo,)
        )

    def substituir_checklist(self, id_todo, itens):
        self.db.execute_commit(
            query="DELETE FROM dbo.TB_TAREFAS_CHECKLIST WHERE ID_TODO = ?",
            parametros=(id_todo,)
        )
        for ordem, item in enumerate(itens or []):
            texto = str(item.get("texto") or "").strip()
            if not texto:
                continue
            self.db.execute_commit(
                query="""
                    INSERT INTO dbo.TB_TAREFAS_CHECKLIST
                        (ID_TODO, TEXTO, CONCLUIDO, ORDEM)
                    VALUES (?, ?, ?, ?)
                """,
                parametros=(
                    id_todo,
                    texto,
                    bool(item.get("concluido")),
                    ordem,
                )
            )

    def criar_equipe(self, nome, supervisor_cpf, centro_custo):
        return self.db.execute_fetch(
            query="""
                INSERT INTO dbo.TB_TAREFAS_EQUIPES (
                    ID_EQUIPE,
                    NOME,
                    SUPERVISOR_CPF,
                    CENTRO_CUSTO_REFERENCIA,
                    ATIVA,
                    CREATED_AT
                )
                OUTPUT CONVERT(VARCHAR(36), INSERTED.ID_EQUIPE) AS ID
                VALUES (NEWID(), ?, ?, ?, 1, GETDATE())
            """,
            parametros=(nome, str(supervisor_cpf), centro_custo),
            one=True
        )

    def listar_equipes_supervisor(self, cpf):
        return self.db.execute_fetch(
            query="""
                SELECT
                    CONVERT(VARCHAR(36), equipe.ID_EQUIPE) AS ID,
                    equipe.NOME,
                    equipe.SUPERVISOR_CPF,
                    equipe.CENTRO_CUSTO_REFERENCIA,
                    SUM(
                        CASE
                            WHEN membro.STATUS_CONVITE = 'ACEITO' THEN 1
                            ELSE 0
                        END
                    ) AS MEMBROS,
                    SUM(
                        CASE
                            WHEN membro.STATUS_CONVITE = 'PENDENTE' THEN 1
                            ELSE 0
                        END
                    ) AS PENDENTES
                FROM dbo.TB_TAREFAS_EQUIPES equipe WITH(NOLOCK)
                LEFT JOIN dbo.TB_TAREFAS_EQUIPE_MEMBROS membro WITH(NOLOCK)
                    ON membro.ID_EQUIPE = equipe.ID_EQUIPE
                WHERE equipe.SUPERVISOR_CPF = ?
                  AND equipe.ATIVA = 1
                GROUP BY
                    equipe.ID_EQUIPE,
                    equipe.NOME,
                    equipe.SUPERVISOR_CPF,
                    equipe.CENTRO_CUSTO_REFERENCIA,
                    equipe.CREATED_AT
                ORDER BY equipe.CREATED_AT DESC
            """,
            parametros=(str(cpf),),
            one=False
        ) or []

    def listar_equipes_membro(self, cpf):
        return self.db.execute_fetch(
            query="""
                SELECT
                    CONVERT(VARCHAR(36), equipe.ID_EQUIPE) AS ID,
                    equipe.NOME,
                    equipe.SUPERVISOR_CPF,
                    equipe.CENTRO_CUSTO_REFERENCIA,
                    membro.STATUS_CONVITE
                FROM dbo.TB_TAREFAS_EQUIPE_MEMBROS membro WITH(NOLOCK)
                JOIN dbo.TB_TAREFAS_EQUIPES equipe WITH(NOLOCK)
                    ON equipe.ID_EQUIPE = membro.ID_EQUIPE
                WHERE membro.CPF_COLABORADOR = ?
                  AND membro.STATUS_CONVITE = 'ACEITO'
                  AND equipe.ATIVA = 1
                ORDER BY equipe.NOME
            """,
            parametros=(str(cpf),),
            one=False
        ) or []

    def obter_equipe_supervisor(self, equipe_id, cpf):
        return self.db.execute_fetch(
            query="""
                SELECT
                    CONVERT(VARCHAR(36), ID_EQUIPE) AS ID,
                    NOME,
                    CENTRO_CUSTO_REFERENCIA
                FROM dbo.TB_TAREFAS_EQUIPES WITH(NOLOCK)
                WHERE ID_EQUIPE = CAST(? AS uniqueidentifier)
                  AND SUPERVISOR_CPF = ?
                  AND ATIVA = 1
            """,
            parametros=(str(equipe_id), str(cpf)),
            one=True
        )

    def usuario_eh_membro_aceito(self, equipe_id, cpf):
        return bool(self.db.execute_fetch(
            query="""
                SELECT 1
                FROM dbo.TB_TAREFAS_EQUIPE_MEMBROS WITH(NOLOCK)
                WHERE ID_EQUIPE = CAST(? AS uniqueidentifier)
                  AND CPF_COLABORADOR = ?
                  AND STATUS_CONVITE = 'ACEITO'
            """,
            parametros=(str(equipe_id), str(cpf)),
            one=True
        ))

    def listar_convites(self, cpf):
        return self.db.execute_fetch(
            query="""
                SELECT
                    CONVERT(VARCHAR(36), equipe.ID_EQUIPE) AS ID_EQUIPE,
                    equipe.NOME AS EQUIPE_NOME,
                    LTRIM(RTRIM(supervisor.NM_COLABORADOR))
                        AS SUPERVISOR_NOME,
                    membro.CONVIDADO_EM
                FROM dbo.TB_TAREFAS_EQUIPE_MEMBROS membro WITH(NOLOCK)
                JOIN dbo.TB_TAREFAS_EQUIPES equipe WITH(NOLOCK)
                    ON equipe.ID_EQUIPE = membro.ID_EQUIPE
                LEFT JOIN login.TB_USUARIOS supervisor WITH(NOLOCK)
                    ON CONVERT(VARCHAR(20), supervisor.CPF_COLABORADOR)
                     = equipe.SUPERVISOR_CPF
                WHERE membro.CPF_COLABORADOR = ?
                  AND membro.STATUS_CONVITE = 'PENDENTE'
                  AND equipe.ATIVA = 1
                ORDER BY membro.CONVIDADO_EM DESC
            """,
            parametros=(str(cpf),),
            one=False
        ) or []

    def pesquisar_operadores(self, nome=None, centro_custo=None):
        filtros = ["ISNULL(USUARIO_ATIVO, 1) = 1"]
        parametros = []
        if nome:
            filtros.append("NM_COLABORADOR LIKE ?")
            parametros.append(f"%{nome}%")
        if centro_custo:
            filtros.append("LTRIM(RTRIM(CENTRO_CUSTO)) = ?")
            parametros.append(str(centro_custo).strip())

        filtros.extend([
            "UPPER(ISNULL(FUNCAO_COLABORADOR, '')) NOT LIKE '%SUPERVIS%'",
            "UPPER(ISNULL(FUNCAO_COLABORADOR, '')) NOT LIKE '%COORDEN%'",
            "UPPER(ISNULL(FUNCAO_COLABORADOR, '')) NOT LIKE '%GERENTE%'",
        ])
        return self.db.execute_fetch(
            query=f"""
                SELECT TOP 80
                    CONVERT(VARCHAR(20), CPF_COLABORADOR) AS CPF,
                    LTRIM(RTRIM(NM_COLABORADOR)) AS NOME,
                    LTRIM(RTRIM(FUNCAO_COLABORADOR)) AS FUNCAO,
                    LTRIM(RTRIM(CENTRO_CUSTO)) AS CENTRO_CUSTO
                FROM login.TB_USUARIOS WITH(NOLOCK)
                WHERE {' AND '.join(filtros)}
                ORDER BY NM_COLABORADOR
            """,
            parametros=tuple(parametros),
            one=False
        ) or []

    def enviar_convites(self, equipe_id, cpfs):
        for cpf in cpfs:
            self.db.execute_commit(
                query="""
                    MERGE dbo.TB_TAREFAS_EQUIPE_MEMBROS AS destino
                    USING (
                        SELECT
                            CAST(? AS uniqueidentifier) AS ID_EQUIPE,
                            ? AS CPF_COLABORADOR
                    ) AS origem
                    ON destino.ID_EQUIPE = origem.ID_EQUIPE
                    AND destino.CPF_COLABORADOR = origem.CPF_COLABORADOR
                    WHEN MATCHED THEN
                        UPDATE SET
                            STATUS_CONVITE = 'PENDENTE',
                            CONVIDADO_EM = GETDATE(),
                            RESPONDIDO_EM = NULL,
                            REMOVIDO_EM = NULL
                    WHEN NOT MATCHED THEN
                        INSERT (
                            ID_EQUIPE,
                            CPF_COLABORADOR,
                            STATUS_CONVITE,
                            CONVIDADO_EM
                        )
                        VALUES (
                            origem.ID_EQUIPE,
                            origem.CPF_COLABORADOR,
                            'PENDENTE',
                            GETDATE()
                        );
                """,
                parametros=(str(equipe_id), str(cpf))
            )

    def responder_convite(self, equipe_id, cpf, status):
        return self.db.execute_commit(
            query="""
                UPDATE dbo.TB_TAREFAS_EQUIPE_MEMBROS
                SET
                    STATUS_CONVITE = ?,
                    RESPONDIDO_EM = GETDATE(),
                    REMOVIDO_EM = NULL
                WHERE ID_EQUIPE = CAST(? AS uniqueidentifier)
                  AND CPF_COLABORADOR = ?
                  AND STATUS_CONVITE = 'PENDENTE'
            """,
            parametros=(status, str(equipe_id), str(cpf))
        )

    def listar_membros(self, equipe_id):
        return self.db.execute_fetch(
            query="""
                SELECT
                    membro.CPF_COLABORADOR AS CPF,
                    LTRIM(RTRIM(usuario.NM_COLABORADOR)) AS NOME,
                    LTRIM(RTRIM(usuario.FUNCAO_COLABORADOR)) AS FUNCAO,
                    LTRIM(RTRIM(usuario.CENTRO_CUSTO)) AS CENTRO_CUSTO,
                    membro.STATUS_CONVITE,
                    membro.CONVIDADO_EM,
                    membro.RESPONDIDO_EM
                FROM dbo.TB_TAREFAS_EQUIPE_MEMBROS membro WITH(NOLOCK)
                LEFT JOIN login.TB_USUARIOS usuario WITH(NOLOCK)
                    ON CONVERT(VARCHAR(20), usuario.CPF_COLABORADOR)
                     = membro.CPF_COLABORADOR
                WHERE membro.ID_EQUIPE = CAST(? AS uniqueidentifier)
                  AND membro.STATUS_CONVITE <> 'REMOVIDO'
                ORDER BY
                    CASE membro.STATUS_CONVITE
                        WHEN 'ACEITO' THEN 1
                        WHEN 'PENDENTE' THEN 2
                        ELSE 3
                    END,
                    usuario.NM_COLABORADOR
            """,
            parametros=(str(equipe_id),),
            one=False
        ) or []

    def remover_membro(self, equipe_id, cpf):
        return self.db.execute_commit(
            query="""
                UPDATE dbo.TB_TAREFAS_EQUIPE_MEMBROS
                SET
                    STATUS_CONVITE = 'REMOVIDO',
                    REMOVIDO_EM = GETDATE()
                WHERE ID_EQUIPE = CAST(? AS uniqueidentifier)
                  AND CPF_COLABORADOR = ?
            """,
            parametros=(str(equipe_id), str(cpf))
        )

    def listar_comentarios(self, id_todo):
        return self.db.execute_fetch(
            query="""
                SELECT
                    comentario.ID_COMENTARIO AS ID,
                    comentario.CPF_AUTOR,
                    comentario.CONTEUDO,
                    comentario.CREATED_AT,
                    LTRIM(RTRIM(usuario.NM_COLABORADOR)) AS AUTOR_NOME
                FROM dbo.TB_TAREFAS_COMENTARIOS comentario WITH(NOLOCK)
                LEFT JOIN login.TB_USUARIOS usuario WITH(NOLOCK)
                    ON CONVERT(VARCHAR(20), usuario.CPF_COLABORADOR)
                     = comentario.CPF_AUTOR
                WHERE comentario.ID_TODO = ?
                  AND comentario.EXCLUIDO = 0
                ORDER BY comentario.CREATED_AT DESC
            """,
            parametros=(id_todo,),
            one=False
        ) or []

    def adicionar_comentario(self, id_todo, cpf, conteudo):
        return self.db.execute_fetch(
            query="""
                INSERT INTO dbo.TB_TAREFAS_COMENTARIOS (
                    ID_TODO,
                    CPF_AUTOR,
                    CONTEUDO
                )
                OUTPUT INSERTED.ID_COMENTARIO AS ID
                VALUES (?, ?, ?)
            """,
            parametros=(id_todo, str(cpf), conteudo),
            one=True
        )

    def listar_historico(self, id_todo):
        return self.db.execute_fetch(
            query="""
                SELECT TOP 80
                    historico.ID_HISTORICO AS ID,
                    historico.CPF_AUTOR,
                    historico.ACAO,
                    historico.DESCRICAO,
                    historico.VALOR_ANTERIOR,
                    historico.VALOR_NOVO,
                    historico.CREATED_AT,
                    LTRIM(RTRIM(usuario.NM_COLABORADOR)) AS AUTOR_NOME
                FROM dbo.TB_TAREFAS_HISTORICO historico WITH(NOLOCK)
                LEFT JOIN login.TB_USUARIOS usuario WITH(NOLOCK)
                    ON CONVERT(VARCHAR(20), usuario.CPF_COLABORADOR)
                     = historico.CPF_AUTOR
                WHERE historico.ID_TODO = ?
                ORDER BY historico.CREATED_AT DESC
            """,
            parametros=(id_todo,),
            one=False
        ) or []

    def registrar_historico(
        self,
        id_todo,
        cpf,
        acao,
        descricao,
        valor_anterior=None,
        valor_novo=None,
    ):
        return self.db.execute_commit(
            query="""
                INSERT INTO dbo.TB_TAREFAS_HISTORICO (
                    ID_TODO,
                    CPF_AUTOR,
                    ACAO,
                    DESCRICAO,
                    VALOR_ANTERIOR,
                    VALOR_NOVO
                )
                VALUES (?, ?, ?, ?, ?, ?)
            """,
            parametros=(
                id_todo,
                str(cpf),
                acao,
                descricao,
                valor_anterior,
                valor_novo,
            )
        )

    def listar_anexos(self, id_todo):
        return self.db.execute_fetch(
            query="""
                SELECT
                    anexo.ID_ANEXO AS ID,
                    anexo.CPF_AUTOR,
                    anexo.NOME_ARQUIVO,
                    anexo.URL_ARQUIVO,
                    anexo.CREATED_AT,
                    LTRIM(RTRIM(usuario.NM_COLABORADOR)) AS AUTOR_NOME
                FROM dbo.TB_TAREFAS_ANEXOS anexo WITH(NOLOCK)
                LEFT JOIN login.TB_USUARIOS usuario WITH(NOLOCK)
                    ON CONVERT(VARCHAR(20), usuario.CPF_COLABORADOR)
                     = anexo.CPF_AUTOR
                WHERE anexo.ID_TODO = ?
                  AND anexo.EXCLUIDO = 0
                ORDER BY anexo.CREATED_AT DESC
            """,
            parametros=(id_todo,),
            one=False
        ) or []

    def adicionar_anexo(self, id_todo, cpf, nome, url):
        return self.db.execute_fetch(
            query="""
                INSERT INTO dbo.TB_TAREFAS_ANEXOS (
                    ID_TODO,
                    CPF_AUTOR,
                    NOME_ARQUIVO,
                    URL_ARQUIVO
                )
                OUTPUT INSERTED.ID_ANEXO AS ID
                VALUES (?, ?, ?, ?)
            """,
            parametros=(id_todo, str(cpf), nome, url),
            one=True
        )

    def atualizar_automacao(self, id_todo, ativa):
        return self.db.execute_commit(
            query="""
                UPDATE dbo.TB_TODOS
                SET
                    SUGERIR_FINALIZACAO = ?,
                    DATA_ATUALIZACAO = GETDATE()
                WHERE ID_TODO = ?
                  AND ISNULL(ARQUIVADA, 0) = 0
            """,
            parametros=(bool(ativa), id_todo)
        )

    def supervisor_possui_tarefa(self, id_todo, cpf):
        return bool(self.db.execute_fetch(
            query="""
                SELECT 1
                FROM dbo.TB_TODOS tarefa WITH(NOLOCK)
                JOIN dbo.TB_TAREFAS_EQUIPES equipe WITH(NOLOCK)
                    ON equipe.ID_EQUIPE = tarefa.ID_EQUIPE
                WHERE tarefa.ID_TODO = ?
                  AND equipe.SUPERVISOR_CPF = ?
                  AND equipe.ATIVA = 1
            """,
            parametros=(id_todo, str(cpf)),
            one=True
        ))

    def listar_quadros(self, cpf):
        return self.db.execute_fetch(
            query="""
                SELECT
                    CONVERT(VARCHAR(36), quadro.ID_QUADRO) AS ID,
                    quadro.NOME,
                    quadro.TIPO,
                    quadro.COR,
                    quadro.FAVORITO,
                    CONVERT(VARCHAR(36), quadro.ID_EQUIPE) AS ID_EQUIPE,
                    quadro.CPF_CRIADOR,
                    CASE
                        WHEN quadro.CPF_CRIADOR = ? THEN 1
                        WHEN equipe.SUPERVISOR_CPF = ? THEN 1
                        ELSE 0
                    END AS PODE_EDITAR
                FROM dbo.TB_TAREFAS_QUADROS quadro WITH(NOLOCK)
                LEFT JOIN dbo.TB_TAREFAS_EQUIPES equipe WITH(NOLOCK)
                    ON equipe.ID_EQUIPE = quadro.ID_EQUIPE
                LEFT JOIN dbo.TB_TAREFAS_EQUIPE_MEMBROS membro WITH(NOLOCK)
                    ON membro.ID_EQUIPE = quadro.ID_EQUIPE
                   AND membro.CPF_COLABORADOR = ?
                   AND membro.STATUS_CONVITE = 'ACEITO'
                WHERE quadro.ATIVO = 1
                  AND (
                      quadro.CPF_CRIADOR = ?
                      OR equipe.SUPERVISOR_CPF = ?
                      OR membro.CPF_COLABORADOR IS NOT NULL
                  )
                ORDER BY quadro.FAVORITO DESC, quadro.CREATED_AT
            """,
            parametros=(
                str(cpf),
                str(cpf),
                str(cpf),
                str(cpf),
                str(cpf),
            ),
            one=False
        ) or []

    # ------------------------------------------------------------------
    # Papel no quadro (independente do cargo na empresa)
    # ------------------------------------------------------------------

    def estrutura_papeis_disponivel(self):
        resultado = self.db.execute_fetch(
            query="""
                SELECT CAST(
                    CASE WHEN OBJECT_ID(
                        'dbo.TB_TAREFAS_QUADRO_MEMBRO',
                        'U'
                    ) IS NULL THEN 0 ELSE 1 END
                    AS BIT
                ) AS DISPONIVEL
            """,
            parametros=(),
            one=True
        )
        return bool(resultado and resultado.get("DISPONIVEL"))

    def obter_papel_no_quadro(self, quadro_id, cpf):
        resultado = self.db.execute_fetch(
            query="""
                SELECT PAPEL
                FROM dbo.TB_TAREFAS_QUADRO_MEMBRO WITH(NOLOCK)
                WHERE ID_QUADRO = CAST(? AS uniqueidentifier)
                  AND CPF = LTRIM(RTRIM(?))
            """,
            parametros=(str(quadro_id), str(cpf)),
            one=True
        )
        return (resultado or {}).get("PAPEL")

    def listar_membros_quadro(self, quadro_id):
        return self.db.execute_fetch(
            query="""
                SELECT
                    membro.CPF,
                    membro.PAPEL,
                    membro.DT_CRIACAO,
                    LTRIM(RTRIM(usuario.NM_COLABORADOR)) AS NOME,
                    LTRIM(RTRIM(usuario.FUNCAO_COLABORADOR)) AS FUNCAO,
                    LTRIM(RTRIM(usuario.CENTRO_CUSTO)) AS CENTRO_CUSTO
                FROM dbo.TB_TAREFAS_QUADRO_MEMBRO membro WITH(NOLOCK)
                LEFT JOIN login.TB_USUARIOS usuario WITH(NOLOCK)
                    ON CONVERT(VARCHAR(20), usuario.CPF_COLABORADOR)
                     = membro.CPF
                WHERE membro.ID_QUADRO = CAST(? AS uniqueidentifier)
                ORDER BY
                    CASE membro.PAPEL
                        WHEN 'DONO' THEN 0
                        WHEN 'EDITOR' THEN 1
                        ELSE 2
                    END,
                    usuario.NM_COLABORADOR
            """,
            parametros=(str(quadro_id),),
            one=False
        ) or []

    def definir_papel_no_quadro(self, quadro_id, cpf, papel, adicionado_por):
        return self.db.execute_commit(
            query="""
                MERGE dbo.TB_TAREFAS_QUADRO_MEMBRO AS destino
                USING (
                    SELECT
                        CAST(? AS uniqueidentifier) AS ID_QUADRO,
                        LTRIM(RTRIM(CAST(? AS VARCHAR(20)))) AS CPF
                ) AS origem
                ON destino.ID_QUADRO = origem.ID_QUADRO
                   AND destino.CPF = origem.CPF
                WHEN MATCHED THEN
                    UPDATE SET PAPEL = ?
                WHEN NOT MATCHED THEN
                    INSERT (ID_QUADRO, CPF, PAPEL, ADICIONADO_POR)
                    VALUES (
                        CAST(? AS uniqueidentifier),
                        LTRIM(RTRIM(CAST(? AS VARCHAR(20)))),
                        ?,
                        ?
                    );
            """,
            parametros=(
                str(quadro_id),
                str(cpf),
                papel,
                str(quadro_id),
                str(cpf),
                papel,
                str(adicionado_por),
            ),
            return_rowcount=True
        )

    def remover_membro_quadro(self, quadro_id, cpf):
        return self.db.execute_commit(
            query="""
                DELETE FROM dbo.TB_TAREFAS_QUADRO_MEMBRO
                WHERE ID_QUADRO = CAST(? AS uniqueidentifier)
                  AND CPF = LTRIM(RTRIM(?))
            """,
            parametros=(str(quadro_id), str(cpf)),
            return_rowcount=True
        )

    def compartilham_quadro(self, cpf_a, cpf_b):
        """Os dois participam de algum quadro em comum, com o primeiro
        podendo editar? Base para atribuição entre pares."""
        resultado = self.db.execute_fetch(
            query="""
                SELECT TOP 1 1 AS OK
                FROM dbo.TB_TAREFAS_QUADRO_MEMBRO origem WITH(NOLOCK)
                INNER JOIN dbo.TB_TAREFAS_QUADRO_MEMBRO destino WITH(NOLOCK)
                    ON destino.ID_QUADRO = origem.ID_QUADRO
                WHERE origem.CPF = LTRIM(RTRIM(?))
                  AND destino.CPF = LTRIM(RTRIM(?))
                  AND origem.PAPEL IN ('DONO', 'EDITOR')
            """,
            parametros=(str(cpf_a), str(cpf_b)),
            one=True
        )
        return bool(resultado)

    def obter_quadro(self, quadro_id):
        return self.db.execute_fetch(
            query="""
                SELECT
                    CONVERT(VARCHAR(36), quadro.ID_QUADRO) AS ID,
                    quadro.NOME,
                    quadro.TIPO,
                    quadro.COR,
                    quadro.FAVORITO,
                    quadro.CPF_CRIADOR,
                    CONVERT(VARCHAR(36), quadro.ID_EQUIPE) AS ID_EQUIPE,
                    equipe.SUPERVISOR_CPF
                FROM dbo.TB_TAREFAS_QUADROS quadro WITH(NOLOCK)
                LEFT JOIN dbo.TB_TAREFAS_EQUIPES equipe WITH(NOLOCK)
                    ON equipe.ID_EQUIPE = quadro.ID_EQUIPE
                WHERE quadro.ID_QUADRO = CAST(? AS uniqueidentifier)
                  AND quadro.ATIVO = 1
            """,
            parametros=(str(quadro_id),),
            one=True
        )

    def criar_quadro(
        self,
        nome,
        tipo,
        cpf_criador,
        cor,
        equipe_id=None,
    ):
        return self.db.execute_fetch(
            query="""
                INSERT INTO dbo.TB_TAREFAS_QUADROS (
                    NOME,
                    TIPO,
                    CPF_CRIADOR,
                    ID_EQUIPE,
                    COR,
                    FAVORITO
                )
                OUTPUT CONVERT(VARCHAR(36), INSERTED.ID_QUADRO) AS ID
                VALUES (
                    ?, ?, ?,
                    CAST(? AS uniqueidentifier),
                    ?,
                    1
                )
            """,
            parametros=(
                nome,
                tipo,
                str(cpf_criador),
                equipe_id,
                cor,
            ),
            one=True
        )

    def obter_quadro_equipe(self, equipe_id):
        return self.db.execute_fetch(
            query="""
                SELECT
                    CONVERT(VARCHAR(36), ID_QUADRO) AS ID
                FROM dbo.TB_TAREFAS_QUADROS WITH(NOLOCK)
                WHERE ID_EQUIPE = CAST(? AS uniqueidentifier)
                  AND ATIVO = 1
            """,
            parametros=(str(equipe_id),),
            one=True
        )

    def listar_listas(self, quadro_id):
        return self.db.execute_fetch(
            query="""
                SELECT
                    CONVERT(VARCHAR(36), ID_LISTA) AS ID,
                    NOME,
                    COR,
                    ORDEM,
                    STATUS_BASE
                FROM dbo.TB_TAREFAS_LISTAS WITH(NOLOCK)
                WHERE ID_QUADRO = CAST(? AS uniqueidentifier)
                  AND ATIVA = 1
                ORDER BY ORDEM, CREATED_AT
            """,
            parametros=(str(quadro_id),),
            one=False
        ) or []

    def obter_lista(self, lista_id):
        return self.db.execute_fetch(
            query="""
                SELECT
                    CONVERT(VARCHAR(36), ID_LISTA) AS ID,
                    CONVERT(VARCHAR(36), ID_QUADRO) AS ID_QUADRO,
                    NOME,
                    COR,
                    ORDEM,
                    STATUS_BASE
                FROM dbo.TB_TAREFAS_LISTAS WITH(NOLOCK)
                WHERE ID_LISTA = CAST(? AS uniqueidentifier)
                  AND ATIVA = 1
            """,
            parametros=(str(lista_id),),
            one=True
        )

    def criar_lista(
        self,
        quadro_id,
        nome,
        cor,
        ordem,
        status_base=None,
    ):
        return self.db.execute_fetch(
            query="""
                INSERT INTO dbo.TB_TAREFAS_LISTAS (
                    ID_QUADRO,
                    NOME,
                    COR,
                    ORDEM,
                    STATUS_BASE
                )
                OUTPUT CONVERT(VARCHAR(36), INSERTED.ID_LISTA) AS ID
                VALUES (
                    CAST(? AS uniqueidentifier),
                    ?, ?, ?, ?
                )
            """,
            parametros=(
                str(quadro_id),
                nome,
                cor,
                ordem,
                status_base,
            ),
            one=True
        )

    def vincular_tarefas_quadro(self, quadro_id, cpf=None, equipe_id=None):
        if equipe_id:
            return self.db.execute_commit(
                query="""
                    UPDATE dbo.TB_TODOS
                    SET ID_QUADRO = CAST(? AS uniqueidentifier)
                    WHERE ID_EQUIPE = CAST(? AS uniqueidentifier)
                      AND ID_QUADRO IS NULL
                """,
                parametros=(str(quadro_id), str(equipe_id))
            )
        return self.db.execute_commit(
            query="""
                UPDATE dbo.TB_TODOS
                SET ID_QUADRO = CAST(? AS uniqueidentifier)
                WHERE CPF_RESPONSAVEL = ?
                  AND (
                      ISNULL(ORIGEM, 'PESSOAL') = 'PESSOAL'
                      OR CPF_CRIADOR = CPF_RESPONSAVEL
                  )
                  AND ID_QUADRO IS NULL
            """,
            parametros=(str(quadro_id), str(cpf))
        )

    def vincular_listas_padrao(self, quadro_id):
        return self.db.execute_commit(
            query="""
                UPDATE tarefa
                SET tarefa.ID_LISTA = lista.ID_LISTA
                FROM dbo.TB_TODOS tarefa
                JOIN dbo.TB_TAREFAS_LISTAS lista
                    ON lista.ID_QUADRO = tarefa.ID_QUADRO
                   AND lista.STATUS_BASE = CASE
                       WHEN tarefa.STATUS = 'pendente'
                           THEN 'caixa_entrada'
                       ELSE tarefa.STATUS
                   END
                WHERE tarefa.ID_QUADRO = CAST(? AS uniqueidentifier)
                  AND tarefa.ID_LISTA IS NULL
                  AND lista.ATIVA = 1
            """,
            parametros=(str(quadro_id),)
        )
