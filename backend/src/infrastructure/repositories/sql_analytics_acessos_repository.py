from src.infrastructure.database.sql_server_connection import SQLServerConnection
from src.shared.utils.env_load import DB_HOST_66

class AnalyticsAcessosRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66,"DB_COPILOT_ACME")

    def buscar(self,centro_custo: str):
        query = """
        WITH ACESSOS AS (
            SELECT 
                L.NM_COLABORADOR AS nome,
                L.SUPERVISOR AS supervisor,
                COUNT(A.CPF_COLABORADOR) AS total_acessos,
                CONVERT(VARCHAR(10),MAX(A.HORA_LOGIN),103) AS ultimo_acesso
            FROM login.TB_USUARIOS L WITH(NOLOCK)
            LEFT JOIN TB_LOG_ACESSO_COPILOT A WITH(NOLOCK)
                ON L.CPF_COLABORADOR = A.CPF_COLABORADOR
            WHERE UPPER(L.CENTRO_CUSTO) = ?
            GROUP BY L.NM_COLABORADOR,L.SUPERVISOR
        ),
        TOTAL_SUPERVISORES AS (
            SELECT supervisor,COUNT(DISTINCT nome) AS total_operadores_supervisor
            FROM ACESSOS
            GROUP BY supervisor
        )
        SELECT 
            A.nome,
            A.supervisor,
            A.total_acessos,
            A.ultimo_acesso,
            TS.total_operadores_supervisor
        FROM ACESSOS A
        LEFT JOIN TOTAL_SUPERVISORES TS
            ON A.supervisor = TS.supervisor
        ORDER BY A.supervisor,A.total_acessos DESC
        """

        return self.db.execute_fetch(query=query,parametros=(centro_custo,),one=False)

    def obter_usuario(self, cpf: str):
        return self.db.execute_fetch(
            query="""
                SELECT
                    CONVERT(VARCHAR(20), CPF_COLABORADOR) AS cpf,
                    LTRIM(RTRIM(NM_COLABORADOR)) AS nome,
                    LTRIM(RTRIM(CENTRO_CUSTO)) AS centro_custo
                FROM login.TB_USUARIOS WITH(NOLOCK)
                WHERE CONVERT(VARCHAR(20), CPF_COLABORADOR) = ?
                  AND ISNULL(USUARIO_ATIVO, 1) = 1
            """,
            parametros=(str(cpf),),
            one=True,
        )

    def buscar_uso_consultar_contrato(self, periodo_dias: int):
        hoje = int(periodo_dias) == 1
        parametros = () if hoje or not periodo_dias else (periodo_dias,)
        if hoje:
            filtro_periodo = "CONVERT(DATE, C.DT_CRIACAO) = CONVERT(DATE, GETDATE())"
        elif periodo_dias:
            filtro_periodo = "C.DT_CRIACAO >= DATEADD(DAY, -?, GETDATE())"
        else:
            filtro_periodo = "1 = 1"
        filtro = (
            f"{filtro_periodo} "
            "AND LOWER(LTRIM(RTRIM(C.STATUS))) IN ('resolvido', 'falha')"
        )

        resumo = self.db.execute_fetch(
            query=f"""
                SELECT
                    COUNT_BIG(*) AS total_consultas,
                    COUNT(DISTINCT NULLIF(CONVERT(VARCHAR(20), C.USUARIO), ''))
                        AS operadores_ativos,
                    COUNT(DISTINCT NULLIF(LTRIM(RTRIM(U.SUPERVISOR)), ''))
                        AS supervisores_ativos,
                    SUM(CASE WHEN LOWER(C.STATUS) = 'resolvido' THEN 1 ELSE 0 END)
                        AS resolvidas,
                    SUM(CASE WHEN LOWER(C.STATUS) = 'falha' THEN 1 ELSE 0 END)
                        AS falhas,
                    MIN(C.DT_CRIACAO) AS primeira_consulta,
                    MAX(C.DT_CRIACAO) AS ultima_consulta
                FROM dbo.TB_CONSULTA_CRMWEB AS C WITH(NOLOCK)
                LEFT JOIN login.TB_USUARIOS AS U WITH(NOLOCK)
                    ON CONVERT(VARCHAR(20), U.CPF_COLABORADOR) =
                       CONVERT(VARCHAR(20), C.USUARIO)
                WHERE {filtro}
            """,
            parametros=parametros,
            one=True,
        ) or {}

        operadores = self.db.execute_fetch(
            query=f"""
                SELECT
                    CONVERT(VARCHAR(20), C.USUARIO) AS cpf,
                    COALESCE(
                        NULLIF(LTRIM(RTRIM(U.NM_COLABORADOR)), ''),
                        'Usuario nao identificado'
                    ) AS nome,
                    COALESCE(
                        NULLIF(LTRIM(RTRIM(U.SUPERVISOR)), ''),
                        'Sem supervisor'
                    ) AS supervisor,
                    COUNT_BIG(*) AS total_consultas,
                    SUM(CASE WHEN LOWER(C.STATUS) = 'resolvido' THEN 1 ELSE 0 END)
                        AS resolvidas,
                    SUM(CASE WHEN LOWER(C.STATUS) = 'falha' THEN 1 ELSE 0 END)
                        AS falhas,
                    MAX(C.DT_CRIACAO) AS ultima_consulta
                FROM dbo.TB_CONSULTA_CRMWEB AS C WITH(NOLOCK)
                LEFT JOIN login.TB_USUARIOS AS U WITH(NOLOCK)
                    ON CONVERT(VARCHAR(20), U.CPF_COLABORADOR) =
                       CONVERT(VARCHAR(20), C.USUARIO)
                WHERE {filtro}
                GROUP BY
                    CONVERT(VARCHAR(20), C.USUARIO),
                    COALESCE(
                        NULLIF(LTRIM(RTRIM(U.NM_COLABORADOR)), ''),
                        'Usuario nao identificado'
                    ),
                    COALESCE(
                        NULLIF(LTRIM(RTRIM(U.SUPERVISOR)), ''),
                        'Sem supervisor'
                    )
                ORDER BY total_consultas DESC, nome
            """,
            parametros=parametros,
        ) or []

        supervisores = self.db.execute_fetch(
            query=f"""
                SELECT
                    COALESCE(
                        NULLIF(LTRIM(RTRIM(U.SUPERVISOR)), ''),
                        'Sem supervisor'
                    ) AS nome,
                    COUNT_BIG(*) AS total_consultas,
                    COUNT(DISTINCT CONVERT(VARCHAR(20), C.USUARIO))
                        AS operadores,
                    SUM(CASE WHEN LOWER(C.STATUS) = 'resolvido' THEN 1 ELSE 0 END)
                        AS resolvidas,
                    MAX(C.DT_CRIACAO) AS ultima_consulta
                FROM dbo.TB_CONSULTA_CRMWEB AS C WITH(NOLOCK)
                LEFT JOIN login.TB_USUARIOS AS U WITH(NOLOCK)
                    ON CONVERT(VARCHAR(20), U.CPF_COLABORADOR) =
                       CONVERT(VARCHAR(20), C.USUARIO)
                WHERE {filtro}
                GROUP BY COALESCE(
                    NULLIF(LTRIM(RTRIM(U.SUPERVISOR)), ''),
                    'Sem supervisor'
                )
                ORDER BY total_consultas DESC, nome
            """,
            parametros=parametros,
        ) or []

        status = self.db.execute_fetch(
            query=f"""
                SELECT
                    COALESCE(NULLIF(LTRIM(RTRIM(C.STATUS)), ''), 'sem status')
                        AS status,
                    COUNT_BIG(*) AS total
                FROM dbo.TB_CONSULTA_CRMWEB AS C WITH(NOLOCK)
                WHERE {filtro}
                GROUP BY COALESCE(NULLIF(LTRIM(RTRIM(C.STATUS)), ''), 'sem status')
                ORDER BY total DESC
            """,
            parametros=parametros,
        ) or []

        evolucao = self.db.execute_fetch(
            query=f"""
                SELECT
                    CONVERT(DATE, C.DT_CRIACAO) AS data,
                    COUNT_BIG(*) AS total_consultas,
                    COUNT(DISTINCT CONVERT(VARCHAR(20), C.USUARIO))
                        AS operadores
                FROM dbo.TB_CONSULTA_CRMWEB AS C WITH(NOLOCK)
                WHERE {filtro}
                GROUP BY CONVERT(DATE, C.DT_CRIACAO)
                ORDER BY data
            """,
            parametros=parametros,
        ) or []

        recentes = self.db.execute_fetch(
            query=f"""
                SELECT TOP (100)
                    C.STATUS AS status,
                    C.CONTRATO AS contrato,
                    C.DATA_PAGTO AS data_pagamento,
                    C.DT_CRIACAO AS criada_em,
                    CONVERT(VARCHAR(20), C.USUARIO) AS cpf,
                    COALESCE(
                        NULLIF(LTRIM(RTRIM(U.NM_COLABORADOR)), ''),
                        'Usuario nao identificado'
                    ) AS operador,
                    COALESCE(
                        NULLIF(LTRIM(RTRIM(U.SUPERVISOR)), ''),
                        'Sem supervisor'
                    ) AS supervisor,
                    CASE WHEN C.RESULTADO_BUSCA IS NULL THEN 0 ELSE 1 END
                        AS possui_resultado
                FROM dbo.TB_CONSULTA_CRMWEB AS C WITH(NOLOCK)
                LEFT JOIN login.TB_USUARIOS AS U WITH(NOLOCK)
                    ON CONVERT(VARCHAR(20), U.CPF_COLABORADOR) =
                       CONVERT(VARCHAR(20), C.USUARIO)
                WHERE {filtro}
                ORDER BY C.DT_CRIACAO DESC
            """,
            parametros=parametros,
        ) or []

        return {
            "resumo": resumo,
            "operadores": operadores,
            "supervisores": supervisores,
            "status": status,
            "evolucao": evolucao,
            "recentes": recentes,
        }
