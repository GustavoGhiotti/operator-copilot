from src.infrastructure.database.sql_server_connection import SQLServerConnection
from src.shared.utils.env_load import DB_HOST_66


class AcademiaRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66, "DB_COPILOT_ACME")
        self._estruturas = {}

    def _estrutura_disponivel(self, chave, condicao):
        """Checa se uma estrutura opcional ja foi migrada.

        O resultado e memoizado porque o repositorio vive uma requisicao e
        cada consulta abre uma conexao nova — sem isso um unico
        `obter_curso` faria tres round-trips so para checar schema.
        """
        if chave in self._estruturas:
            return self._estruturas[chave]

        resultado = self.db.execute_fetch(
            query=f"""
                SELECT CAST(
                    CASE WHEN {condicao} THEN 1 ELSE 0 END AS BIT
                ) AS disponivel
            """,
            parametros=(),
            one=True
        )
        disponivel = bool(resultado and resultado.get("disponivel"))
        self._estruturas[chave] = disponivel
        return disponivel

    def obter_usuario(self, cpf):
        query = """
            SELECT
                CPF_COLABORADOR AS cpf,
                LTRIM(RTRIM(NM_COLABORADOR)) AS nome,
                LTRIM(RTRIM(CENTRO_CUSTO)) AS centro_custo
            FROM login.TB_USUARIOS WITH (NOLOCK)
            WHERE CPF_COLABORADOR = ?
              AND ISNULL(USUARIO_ATIVO, 1) = 1
        """
        return self.db.execute_fetch(
            query=query,
            parametros=(cpf,),
            one=True
        )

    def listar_catalogo(self, cpf, centro_custo):
        query = """
            SELECT
                C.ID_CURSO AS id,
                C.TITULO AS titulo,
                C.DESCRICAO AS descricao,
                C.CAPA_URL AS capa_url,
                C.NIVEL AS nivel,
                C.CARGA_HORARIA_MIN AS carga_horaria_min,
                COUNT(DISTINCT M.ID_MODULO) AS total_modulos,
                COUNT(DISTINCT A.ID_AULA) AS total_aulas,
                MAX(CASE WHEN MT.ID_MATRICULA IS NULL THEN 0 ELSE 1 END) AS matriculado,
                MAX(MT.STATUS) AS status_matricula,
                CAST(
                    CASE
                        WHEN COUNT(DISTINCT A.ID_AULA) = 0 THEN 0
                        ELSE
                            100.0 * COUNT(DISTINCT CASE WHEN P.CONCLUIDA = 1 THEN A.ID_AULA END)
                            / COUNT(DISTINCT A.ID_AULA)
                    END
                    AS DECIMAL(5,2)
                ) AS progresso
            FROM dbo.TB_ACADEMIA_CURSO C WITH (NOLOCK)
            LEFT JOIN dbo.TB_ACADEMIA_MODULO M WITH (NOLOCK)
                ON M.ID_CURSO = C.ID_CURSO
               AND M.ATIVO = 1
            LEFT JOIN dbo.TB_ACADEMIA_AULA A WITH (NOLOCK)
                ON A.ID_MODULO = M.ID_MODULO
               AND A.ATIVA = 1
            LEFT JOIN dbo.TB_ACADEMIA_MATRICULA MT WITH (NOLOCK)
                ON MT.ID_CURSO = C.ID_CURSO
               AND MT.CPF_COLABORADOR = ?
               AND MT.STATUS <> 'CANCELADO'
            LEFT JOIN dbo.TB_ACADEMIA_PROGRESSO_AULA P WITH (NOLOCK)
                ON P.ID_MATRICULA = MT.ID_MATRICULA
               AND P.ID_AULA = A.ID_AULA
            WHERE C.STATUS = 'PUBLICADO'
              AND (
                    C.TODOS_CENTROS_CUSTO = 1
                    OR EXISTS (
                        SELECT 1
                        FROM dbo.TB_ACADEMIA_CURSO_CENTRO_CUSTO CC WITH (NOLOCK)
                        WHERE CC.ID_CURSO = C.ID_CURSO
                          AND UPPER(LTRIM(RTRIM(CC.CENTRO_CUSTO))) = UPPER(?)
                    )
              )
            GROUP BY
                C.ID_CURSO,
                C.TITULO,
                C.DESCRICAO,
                C.CAPA_URL,
                C.NIVEL,
                C.CARGA_HORARIA_MIN,
                C.ORDEM
            ORDER BY
                CASE WHEN MAX(MT.ID_MATRICULA) IS NULL THEN 1 ELSE 0 END,
                C.ORDEM,
                C.ID_CURSO
        """
        return self.db.execute_fetch(
            query=query,
            parametros=(cpf, centro_custo),
            one=False
        ) or []

    def curso_disponivel(self, id_curso, centro_custo):
        query = """
            SELECT TOP 1 C.ID_CURSO AS id
            FROM dbo.TB_ACADEMIA_CURSO C WITH (NOLOCK)
            WHERE C.ID_CURSO = ?
              AND C.STATUS = 'PUBLICADO'
              AND (
                    C.TODOS_CENTROS_CUSTO = 1
                    OR EXISTS (
                        SELECT 1
                        FROM dbo.TB_ACADEMIA_CURSO_CENTRO_CUSTO CC WITH (NOLOCK)
                        WHERE CC.ID_CURSO = C.ID_CURSO
                          AND UPPER(LTRIM(RTRIM(CC.CENTRO_CUSTO))) = UPPER(?)
                    )
              )
        """
        return self.db.execute_fetch(
            query=query,
            parametros=(id_curso, centro_custo),
            one=True
        )

    def matricular(self, id_curso, cpf):
        query = """
            IF EXISTS (
                SELECT 1
                FROM dbo.TB_ACADEMIA_MATRICULA
                WHERE ID_CURSO = ?
                  AND CPF_COLABORADOR = ?
            )
            BEGIN
                UPDATE dbo.TB_ACADEMIA_MATRICULA
                SET STATUS = 'EM_ANDAMENTO',
                    DT_CONCLUSAO = NULL
                WHERE ID_CURSO = ?
                  AND CPF_COLABORADOR = ?;
            END
            ELSE
            BEGIN
                INSERT INTO dbo.TB_ACADEMIA_MATRICULA
                    (ID_CURSO, CPF_COLABORADOR)
                VALUES (?, ?);
            END
        """
        return self.db.execute_commit(
            query=query,
            parametros=(id_curso, cpf, id_curso, cpf, id_curso, cpf)
        )

    def obter_curso(self, id_curso, cpf, centro_custo):
        query = """
            SELECT
                C.ID_CURSO AS curso_id,
                C.TITULO AS curso_titulo,
                C.DESCRICAO AS curso_descricao,
                C.CAPA_URL AS capa_url,
                C.NIVEL AS nivel,
                C.CARGA_HORARIA_MIN AS carga_horaria_min,
                MT.ID_MATRICULA AS matricula_id,
                MT.STATUS AS status_matricula,
                M.ID_MODULO AS modulo_id,
                M.TITULO AS modulo_titulo,
                M.DESCRICAO AS modulo_descricao,
                M.ORDEM AS modulo_ordem,
                A.ID_AULA AS aula_id,
                A.TITULO AS aula_titulo,
                A.DESCRICAO AS aula_descricao,
                A.TIPO AS aula_tipo,
                A.CONTEUDO_URL AS conteudo_url,
                A.CONTEUDO_TEXTO AS conteudo_texto,
                A.COMANDO AS comando,
                A.DURACAO_MIN AS duracao_min,
                A.ORDEM AS aula_ordem,
                A.OBRIGATORIA AS obrigatoria,
                ISNULL(P.PERCENTUAL, 0) AS percentual,
                ISNULL(P.CONCLUIDA, 0) AS concluida,
                ISNULL(P.FAVORITA, 0) AS favorita
            FROM dbo.TB_ACADEMIA_CURSO C WITH (NOLOCK)
            LEFT JOIN dbo.TB_ACADEMIA_MATRICULA MT WITH (NOLOCK)
                ON MT.ID_CURSO = C.ID_CURSO
               AND MT.CPF_COLABORADOR = ?
               AND MT.STATUS <> 'CANCELADO'
            LEFT JOIN dbo.TB_ACADEMIA_MODULO M WITH (NOLOCK)
                ON M.ID_CURSO = C.ID_CURSO
               AND M.ATIVO = 1
            LEFT JOIN dbo.TB_ACADEMIA_AULA A WITH (NOLOCK)
                ON A.ID_MODULO = M.ID_MODULO
               AND A.ATIVA = 1
            LEFT JOIN dbo.TB_ACADEMIA_PROGRESSO_AULA P WITH (NOLOCK)
                ON P.ID_MATRICULA = MT.ID_MATRICULA
               AND P.ID_AULA = A.ID_AULA
            WHERE C.ID_CURSO = ?
              AND C.STATUS = 'PUBLICADO'
              AND (
                    C.TODOS_CENTROS_CUSTO = 1
                    OR EXISTS (
                        SELECT 1
                        FROM dbo.TB_ACADEMIA_CURSO_CENTRO_CUSTO CC WITH (NOLOCK)
                        WHERE CC.ID_CURSO = C.ID_CURSO
                          AND UPPER(LTRIM(RTRIM(CC.CENTRO_CUSTO))) = UPPER(?)
                    )
              )
            ORDER BY M.ORDEM, M.ID_MODULO, A.ORDEM, A.ID_AULA
        """
        return self.db.execute_fetch(
            query=query,
            parametros=(cpf, id_curso, centro_custo),
            one=False
        ) or []

    def aula_da_matricula(self, id_aula, cpf, centro_custo):
        query = """
            SELECT
                MT.ID_MATRICULA AS matricula_id,
                MT.ID_CURSO AS curso_id,
                A.ID_AULA AS aula_id
            FROM dbo.TB_ACADEMIA_MATRICULA MT WITH (NOLOCK)
            INNER JOIN dbo.TB_ACADEMIA_CURSO C WITH (NOLOCK)
                ON C.ID_CURSO = MT.ID_CURSO
               AND C.STATUS = 'PUBLICADO'
            INNER JOIN dbo.TB_ACADEMIA_MODULO M WITH (NOLOCK)
                ON M.ID_CURSO = MT.ID_CURSO
               AND M.ATIVO = 1
            INNER JOIN dbo.TB_ACADEMIA_AULA A WITH (NOLOCK)
                ON A.ID_MODULO = M.ID_MODULO
               AND A.ATIVA = 1
            WHERE MT.CPF_COLABORADOR = ?
              AND MT.STATUS IN ('EM_ANDAMENTO', 'CONCLUIDO')
              AND A.ID_AULA = ?
              AND (
                    C.TODOS_CENTROS_CUSTO = 1
                    OR EXISTS (
                        SELECT 1
                        FROM dbo.TB_ACADEMIA_CURSO_CENTRO_CUSTO CC WITH (NOLOCK)
                        WHERE CC.ID_CURSO = C.ID_CURSO
                          AND UPPER(LTRIM(RTRIM(CC.CENTRO_CUSTO))) = UPPER(?)
                    )
              )
        """
        return self.db.execute_fetch(
            query=query,
            parametros=(cpf, id_aula, centro_custo),
            one=True
        )

    def aula_liberada(self, id_matricula, id_aula):
        query = """
            SELECT
                CAST(
                    CASE WHEN NOT EXISTS (
                        SELECT 1
                        FROM dbo.TB_ACADEMIA_AULA ANTERIOR WITH (NOLOCK)
                        INNER JOIN dbo.TB_ACADEMIA_MODULO MODULO_ANTERIOR WITH (NOLOCK)
                            ON MODULO_ANTERIOR.ID_MODULO = ANTERIOR.ID_MODULO
                           AND MODULO_ANTERIOR.ATIVO = 1
                        LEFT JOIN dbo.TB_ACADEMIA_PROGRESSO_AULA PROGRESSO WITH (NOLOCK)
                            ON PROGRESSO.ID_MATRICULA = ?
                           AND PROGRESSO.ID_AULA = ANTERIOR.ID_AULA
                        WHERE MODULO_ANTERIOR.ID_CURSO = MODULO_ATUAL.ID_CURSO
                          AND ANTERIOR.ATIVA = 1
                          AND ANTERIOR.TIPO NOT IN ('SIMULACAO', 'TREINAMENTO')
                          AND (
                                ISNULL(MODULO_ANTERIOR.ORDEM, 0) < ISNULL(MODULO_ATUAL.ORDEM, 0)
                                OR (
                                    ISNULL(MODULO_ANTERIOR.ORDEM, 0) = ISNULL(MODULO_ATUAL.ORDEM, 0)
                                    AND MODULO_ANTERIOR.ID_MODULO < MODULO_ATUAL.ID_MODULO
                                )
                                OR (
                                    MODULO_ANTERIOR.ID_MODULO = MODULO_ATUAL.ID_MODULO
                                    AND (
                                        ISNULL(ANTERIOR.ORDEM, 0) < ISNULL(AULA_ATUAL.ORDEM, 0)
                                        OR (
                                            ISNULL(ANTERIOR.ORDEM, 0) = ISNULL(AULA_ATUAL.ORDEM, 0)
                                            AND ANTERIOR.ID_AULA < AULA_ATUAL.ID_AULA
                                        )
                                    )
                                )
                          )
                          AND ISNULL(PROGRESSO.CONCLUIDA, 0) = 0
                    ) THEN 1 ELSE 0 END
                    AS BIT
                ) AS liberada
            FROM dbo.TB_ACADEMIA_AULA AULA_ATUAL WITH (NOLOCK)
            INNER JOIN dbo.TB_ACADEMIA_MODULO MODULO_ATUAL WITH (NOLOCK)
                ON MODULO_ATUAL.ID_MODULO = AULA_ATUAL.ID_MODULO
               AND MODULO_ATUAL.ATIVO = 1
            WHERE AULA_ATUAL.ID_AULA = ?
              AND AULA_ATUAL.ATIVA = 1
        """
        resultado = self.db.execute_fetch(
            query=query,
            parametros=(id_matricula, id_aula),
            one=True
        )
        return bool(resultado and resultado.get("liberada"))

    def salvar_progresso(self, id_matricula, id_aula, percentual, concluida):
        query = """
            MERGE dbo.TB_ACADEMIA_PROGRESSO_AULA AS DESTINO
            USING (
                SELECT
                    CAST(? AS BIGINT) AS ID_MATRICULA,
                    CAST(? AS INT) AS ID_AULA
            ) AS ORIGEM
            ON DESTINO.ID_MATRICULA = ORIGEM.ID_MATRICULA
               AND DESTINO.ID_AULA = ORIGEM.ID_AULA
            WHEN MATCHED THEN
                UPDATE SET
                    PERCENTUAL = CASE
                        WHEN DESTINO.PERCENTUAL > ? THEN DESTINO.PERCENTUAL
                        ELSE ?
                    END,
                    CONCLUIDA = CASE
                        WHEN DESTINO.CONCLUIDA = 1 THEN 1
                        ELSE ?
                    END,
                    DT_INICIO = ISNULL(DESTINO.DT_INICIO, SYSDATETIME()),
                    DT_ULTIMO_ACESSO = SYSDATETIME(),
                    DT_CONCLUSAO = CASE
                        WHEN DESTINO.CONCLUIDA = 1 OR ? = 1
                            THEN ISNULL(DESTINO.DT_CONCLUSAO, SYSDATETIME())
                        ELSE NULL
                    END
            WHEN NOT MATCHED THEN
                INSERT (
                    ID_MATRICULA,
                    ID_AULA,
                    PERCENTUAL,
                    CONCLUIDA,
                    DT_INICIO,
                    DT_ULTIMO_ACESSO,
                    DT_CONCLUSAO
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    SYSDATETIME(),
                    SYSDATETIME(),
                    CASE WHEN ? = 1 THEN SYSDATETIME() ELSE NULL END
                );

            UPDATE MT
            SET
                STATUS = CASE
                    WHEN NOT EXISTS (
                        SELECT 1
                        FROM dbo.TB_ACADEMIA_MODULO M
                        INNER JOIN dbo.TB_ACADEMIA_AULA A
                            ON A.ID_MODULO = M.ID_MODULO
                           AND A.ATIVA = 1
                           AND A.OBRIGATORIA = 1
                        LEFT JOIN dbo.TB_ACADEMIA_PROGRESSO_AULA P
                            ON P.ID_MATRICULA = MT.ID_MATRICULA
                           AND P.ID_AULA = A.ID_AULA
                        WHERE M.ID_CURSO = MT.ID_CURSO
                          AND M.ATIVO = 1
                          AND ISNULL(P.CONCLUIDA, 0) = 0
                    ) THEN 'CONCLUIDO'
                    ELSE 'EM_ANDAMENTO'
                END,
                DT_CONCLUSAO = CASE
                    WHEN NOT EXISTS (
                        SELECT 1
                        FROM dbo.TB_ACADEMIA_MODULO M
                        INNER JOIN dbo.TB_ACADEMIA_AULA A
                            ON A.ID_MODULO = M.ID_MODULO
                           AND A.ATIVA = 1
                           AND A.OBRIGATORIA = 1
                        LEFT JOIN dbo.TB_ACADEMIA_PROGRESSO_AULA P
                            ON P.ID_MATRICULA = MT.ID_MATRICULA
                           AND P.ID_AULA = A.ID_AULA
                        WHERE M.ID_CURSO = MT.ID_CURSO
                          AND M.ATIVO = 1
                          AND ISNULL(P.CONCLUIDA, 0) = 0
                    ) THEN ISNULL(MT.DT_CONCLUSAO, SYSDATETIME())
                    ELSE NULL
                END
            FROM dbo.TB_ACADEMIA_MATRICULA MT
            WHERE MT.ID_MATRICULA = ?;
        """
        concluida_int = 1 if concluida else 0
        return self.db.execute_commit(
            query=query,
            parametros=(
                id_matricula,
                id_aula,
                percentual,
                percentual,
                concluida_int,
                concluida_int,
                id_matricula,
                id_aula,
                percentual,
                concluida_int,
                concluida_int,
                id_matricula
            )
        )

    def atualizar_favorito(self, id_matricula, id_aula, favorita):
        query = """
            MERGE dbo.TB_ACADEMIA_PROGRESSO_AULA AS DESTINO
            USING (
                SELECT
                    CAST(? AS BIGINT) AS ID_MATRICULA,
                    CAST(? AS INT) AS ID_AULA
            ) AS ORIGEM
            ON DESTINO.ID_MATRICULA = ORIGEM.ID_MATRICULA
               AND DESTINO.ID_AULA = ORIGEM.ID_AULA
            WHEN MATCHED THEN
                UPDATE SET
                    FAVORITA = ?,
                    DT_ULTIMO_ACESSO = SYSDATETIME()
            WHEN NOT MATCHED THEN
                INSERT (
                    ID_MATRICULA,
                    ID_AULA,
                    FAVORITA,
                    DT_ULTIMO_ACESSO
                )
                VALUES (?, ?, ?, SYSDATETIME());
        """
        favorita_int = 1 if favorita else 0
        return self.db.execute_commit(
            query=query,
            parametros=(
                id_matricula,
                id_aula,
                favorita_int,
                id_matricula,
                id_aula,
                favorita_int
            )
        )

    def estrutura_anotacoes_disponivel(self):
        return self._estrutura_disponivel(
            "anotacoes",
            "OBJECT_ID('dbo.TB_ACADEMIA_ANOTACAO_AULA', 'U') IS NOT NULL"
        )

    def obter_anotacao(self, id_matricula, id_aula):
        query = """
            SELECT
                CONTEUDO AS conteudo,
                DT_ATUALIZACAO AS atualizado_em
            FROM dbo.TB_ACADEMIA_ANOTACAO_AULA WITH (NOLOCK)
            WHERE ID_MATRICULA = ?
              AND ID_AULA = ?
        """
        return self.db.execute_fetch(
            query=query,
            parametros=(id_matricula, id_aula),
            one=True
        )

    def salvar_anotacao(self, id_matricula, id_aula, conteudo):
        query = """
            MERGE dbo.TB_ACADEMIA_ANOTACAO_AULA AS DESTINO
            USING (
                SELECT
                    CAST(? AS BIGINT) AS ID_MATRICULA,
                    CAST(? AS INT) AS ID_AULA
            ) AS ORIGEM
            ON DESTINO.ID_MATRICULA = ORIGEM.ID_MATRICULA
               AND DESTINO.ID_AULA = ORIGEM.ID_AULA
            WHEN MATCHED THEN
                UPDATE SET
                    CONTEUDO = ?,
                    DT_ATUALIZACAO = SYSDATETIME()
            WHEN NOT MATCHED THEN
                INSERT (
                    ID_MATRICULA,
                    ID_AULA,
                    CONTEUDO,
                    DT_CRIACAO,
                    DT_ATUALIZACAO
                )
                VALUES (?, ?, ?, SYSDATETIME(), SYSDATETIME())
            OUTPUT
                inserted.CONTEUDO AS conteudo,
                inserted.DT_ATUALIZACAO AS atualizado_em;
        """
        return self.db.execute_insert_returning(
            query=query,
            parametros=(
                id_matricula,
                id_aula,
                conteudo,
                id_matricula,
                id_aula,
                conteudo
            )
        )

    def listar_materiais_salvos(self, cpf, centro_custo):
        query = """
            SELECT
                A.ID_AULA AS id,
                A.TITULO AS titulo,
                A.DESCRICAO AS descricao,
                A.TIPO AS tipo,
                A.CONTEUDO_URL AS conteudo_url,
                A.DURACAO_MIN AS duracao_min,
                C.ID_CURSO AS curso_id,
                C.TITULO AS curso_titulo,
                M.TITULO AS modulo_titulo
            FROM dbo.TB_ACADEMIA_PROGRESSO_AULA P WITH (NOLOCK)
            INNER JOIN dbo.TB_ACADEMIA_MATRICULA MT WITH (NOLOCK)
                ON MT.ID_MATRICULA = P.ID_MATRICULA
            INNER JOIN dbo.TB_ACADEMIA_AULA A WITH (NOLOCK)
                ON A.ID_AULA = P.ID_AULA
               AND A.ATIVA = 1
            INNER JOIN dbo.TB_ACADEMIA_MODULO M WITH (NOLOCK)
                ON M.ID_MODULO = A.ID_MODULO
               AND M.ATIVO = 1
            INNER JOIN dbo.TB_ACADEMIA_CURSO C WITH (NOLOCK)
                ON C.ID_CURSO = M.ID_CURSO
               AND C.STATUS = 'PUBLICADO'
            WHERE MT.CPF_COLABORADOR = ?
              AND P.FAVORITA = 1
              AND (
                    C.TODOS_CENTROS_CUSTO = 1
                    OR EXISTS (
                        SELECT 1
                        FROM dbo.TB_ACADEMIA_CURSO_CENTRO_CUSTO CC WITH (NOLOCK)
                        WHERE CC.ID_CURSO = C.ID_CURSO
                          AND UPPER(LTRIM(RTRIM(CC.CENTRO_CUSTO))) = UPPER(?)
                    )
              )
            ORDER BY P.DT_ULTIMO_ACESSO DESC
        """
        return self.db.execute_fetch(
            query=query,
            parametros=(cpf, centro_custo),
            one=False
        ) or []

    def listar_cursos_admin(self):
        query = """
            SELECT
                C.ID_CURSO AS id,
                C.TITULO AS titulo,
                C.DESCRICAO AS descricao,
                C.CAPA_URL AS capa_url,
                C.NIVEL AS nivel,
                C.CARGA_HORARIA_MIN AS carga_horaria_min,
                C.STATUS AS status,
                C.TODOS_CENTROS_CUSTO AS todos_centros_custo,
                C.ORDEM AS ordem,
                C.DT_ATUALIZACAO AS atualizado_em,
                CC.CENTRO_CUSTO AS centro_custo,
                (
                    SELECT COUNT(*)
                    FROM dbo.TB_ACADEMIA_MODULO M WITH (NOLOCK)
                    WHERE M.ID_CURSO = C.ID_CURSO
                      AND M.ATIVO = 1
                ) AS total_modulos,
                (
                    SELECT COUNT(*)
                    FROM dbo.TB_ACADEMIA_MODULO M WITH (NOLOCK)
                    INNER JOIN dbo.TB_ACADEMIA_AULA A WITH (NOLOCK)
                        ON A.ID_MODULO = M.ID_MODULO
                       AND A.ATIVA = 1
                    WHERE M.ID_CURSO = C.ID_CURSO
                      AND M.ATIVO = 1
                ) AS total_aulas
            FROM dbo.TB_ACADEMIA_CURSO C WITH (NOLOCK)
            LEFT JOIN dbo.TB_ACADEMIA_CURSO_CENTRO_CUSTO CC WITH (NOLOCK)
                ON CC.ID_CURSO = C.ID_CURSO
            WHERE C.STATUS <> 'ARQUIVADO'
            ORDER BY C.DT_ATUALIZACAO DESC, C.ID_CURSO, CC.CENTRO_CUSTO
        """
        return self.db.execute_fetch(
            query=query,
            parametros=(),
            one=False
        ) or []

    def listar_centros_custo_admin(self):
        query = """
            SELECT DISTINCT LTRIM(RTRIM(CENTRO_CUSTO)) AS centro_custo
            FROM login.TB_USUARIOS WITH (NOLOCK)
            WHERE ISNULL(USUARIO_ATIVO, 1) = 1
              AND NULLIF(LTRIM(RTRIM(CENTRO_CUSTO)), '') IS NOT NULL
            ORDER BY centro_custo
        """
        return self.db.execute_fetch(
            query=query,
            parametros=(),
            one=False
        ) or []

    def salvar_curso_admin(self, id_curso, dados, centros_custo, cpf):
        transacao = self.db.begin_transaction()
        try:
            if id_curso:
                query = """
                    UPDATE dbo.TB_ACADEMIA_CURSO
                    SET TITULO = ?,
                        DESCRICAO = ?,
                        CAPA_URL = ?,
                        NIVEL = ?,
                        CARGA_HORARIA_MIN = ?,
                        TODOS_CENTROS_CUSTO = ?,
                        ORDEM = ?,
                        DT_ATUALIZACAO = SYSDATETIME()
                    WHERE ID_CURSO = ?
                      AND STATUS <> 'ARQUIVADO'
                """
                afetadas = transacao.execute_commit(
                    query=query,
                    parametros=(
                        dados["titulo"],
                        dados["descricao"],
                        dados["capa_url"],
                        dados["nivel"],
                        dados["carga_horaria_min"],
                        dados["todos_centros_custo"],
                        dados["ordem"],
                        id_curso
                    ),
                    return_rowcount=True
                )
                if not afetadas:
                    raise ValueError("Curso não encontrado.")
            else:
                query = """
                    INSERT INTO dbo.TB_ACADEMIA_CURSO (
                        TITULO,
                        DESCRICAO,
                        CAPA_URL,
                        NIVEL,
                        CARGA_HORARIA_MIN,
                        TODOS_CENTROS_CUSTO,
                        ORDEM,
                        CRIADO_POR
                    )
                    OUTPUT INSERTED.ID_CURSO AS id
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """
                criado = transacao.execute_insert_returning(
                    query=query,
                    parametros=(
                        dados["titulo"],
                        dados["descricao"],
                        dados["capa_url"],
                        dados["nivel"],
                        dados["carga_horaria_min"],
                        dados["todos_centros_custo"],
                        dados["ordem"],
                        cpf
                    )
                )
                id_curso = criado["id"]

            transacao.execute_commit(
                query="""
                    DELETE FROM dbo.TB_ACADEMIA_CURSO_CENTRO_CUSTO
                    WHERE ID_CURSO = ?
                """,
                parametros=(id_curso,)
            )

            for centro_custo in centros_custo:
                transacao.execute_commit(
                    query="""
                        INSERT INTO dbo.TB_ACADEMIA_CURSO_CENTRO_CUSTO
                            (ID_CURSO, CENTRO_CUSTO)
                        VALUES (?, ?)
                    """,
                    parametros=(id_curso, centro_custo)
                )

            transacao.commit()
            return id_curso
        except Exception:
            transacao.rollback()
            raise
        finally:
            transacao.close()

    def obter_estrutura_admin(self, id_curso):
        query = """
            SELECT
                C.ID_CURSO AS curso_id,
                C.TITULO AS curso_titulo,
                C.DESCRICAO AS curso_descricao,
                C.CAPA_URL AS capa_url,
                C.NIVEL AS nivel,
                C.CARGA_HORARIA_MIN AS carga_horaria_min,
                C.STATUS AS status,
                C.TODOS_CENTROS_CUSTO AS todos_centros_custo,
                C.ORDEM AS curso_ordem,
                M.ID_MODULO AS modulo_id,
                M.TITULO AS modulo_titulo,
                M.DESCRICAO AS modulo_descricao,
                M.ORDEM AS modulo_ordem,
                A.ID_AULA AS aula_id,
                A.TITULO AS aula_titulo,
                A.DESCRICAO AS aula_descricao,
                A.TIPO AS aula_tipo,
                A.CONTEUDO_URL AS conteudo_url,
                A.CONTEUDO_TEXTO AS conteudo_texto,
                A.COMANDO AS comando,
                A.DURACAO_MIN AS duracao_min,
                A.ORDEM AS aula_ordem,
                A.OBRIGATORIA AS obrigatoria
            FROM dbo.TB_ACADEMIA_CURSO C WITH (NOLOCK)
            LEFT JOIN dbo.TB_ACADEMIA_MODULO M WITH (NOLOCK)
                ON M.ID_CURSO = C.ID_CURSO
               AND M.ATIVO = 1
            LEFT JOIN dbo.TB_ACADEMIA_AULA A WITH (NOLOCK)
                ON A.ID_MODULO = M.ID_MODULO
               AND A.ATIVA = 1
            WHERE C.ID_CURSO = ?
              AND C.STATUS <> 'ARQUIVADO'
            ORDER BY M.ORDEM, M.ID_MODULO, A.ORDEM, A.ID_AULA
        """
        rows = self.db.execute_fetch(
            query=query,
            parametros=(id_curso,),
            one=False
        ) or []
        if not rows:
            return []

        centros = self.db.execute_fetch(
            query="""
                SELECT CENTRO_CUSTO AS centro_custo
                FROM dbo.TB_ACADEMIA_CURSO_CENTRO_CUSTO WITH (NOLOCK)
                WHERE ID_CURSO = ?
                ORDER BY CENTRO_CUSTO
            """,
            parametros=(id_curso,),
            one=False
        ) or []
        for row in rows:
            row["centros_custo"] = [
                item["centro_custo"]
                for item in centros
            ]
        return rows

    def salvar_modulo_admin(self, id_curso, id_modulo, dados):
        if id_modulo:
            query = """
                UPDATE dbo.TB_ACADEMIA_MODULO
                SET TITULO = ?,
                    DESCRICAO = ?,
                    ORDEM = ?
                WHERE ID_MODULO = ?
                  AND ID_CURSO = ?
                  AND ATIVO = 1
            """
            return self.db.execute_commit(
                query=query,
                parametros=(
                    dados["titulo"],
                    dados["descricao"],
                    dados["ordem"],
                    id_modulo,
                    id_curso
                ),
                return_rowcount=True
            )

        query = """
            INSERT INTO dbo.TB_ACADEMIA_MODULO
                (ID_CURSO, TITULO, DESCRICAO, ORDEM)
            OUTPUT INSERTED.ID_MODULO AS id
            VALUES (?, ?, ?, ?)
        """
        return self.db.execute_insert_returning(
            query=query,
            parametros=(
                id_curso,
                dados["titulo"],
                dados["descricao"],
                dados["ordem"]
            )
        )

    def desativar_modulo_admin(self, id_curso, id_modulo):
        query = """
            UPDATE dbo.TB_ACADEMIA_MODULO
            SET ATIVO = 0
            WHERE ID_MODULO = ?
              AND ID_CURSO = ?
              AND ATIVO = 1
        """
        return self.db.execute_commit(
            query=query,
            parametros=(id_modulo, id_curso),
            return_rowcount=True
        )

    def salvar_aula_admin(self, id_modulo, id_aula, dados):
        if id_aula:
            query = """
                UPDATE A
                SET TITULO = ?,
                    DESCRICAO = ?,
                    TIPO = ?,
                    CONTEUDO_URL = ?,
                    CONTEUDO_TEXTO = ?,
                    COMANDO = ?,
                    DURACAO_MIN = ?,
                    ORDEM = ?,
                    OBRIGATORIA = ?
                FROM dbo.TB_ACADEMIA_AULA A
                INNER JOIN dbo.TB_ACADEMIA_MODULO M
                    ON M.ID_MODULO = A.ID_MODULO
                   AND M.ATIVO = 1
                WHERE A.ID_AULA = ?
                  AND A.ID_MODULO = ?
                  AND A.ATIVA = 1
            """
            return self.db.execute_commit(
                query=query,
                parametros=(
                    dados["titulo"],
                    dados["descricao"],
                    dados["tipo"],
                    dados["conteudo_url"],
                    dados["conteudo_texto"],
                    dados["comando"],
                    dados["duracao_min"],
                    dados["ordem"],
                    dados["obrigatoria"],
                    id_aula,
                    id_modulo
                ),
                return_rowcount=True
            )

        query = """
            INSERT INTO dbo.TB_ACADEMIA_AULA (
                ID_MODULO,
                TITULO,
                DESCRICAO,
                TIPO,
                CONTEUDO_URL,
                CONTEUDO_TEXTO,
                COMANDO,
                DURACAO_MIN,
                ORDEM,
                OBRIGATORIA
            )
            OUTPUT INSERTED.ID_AULA AS id
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        return self.db.execute_insert_returning(
            query=query,
            parametros=(
                id_modulo,
                dados["titulo"],
                dados["descricao"],
                dados["tipo"],
                dados["conteudo_url"],
                dados["conteudo_texto"],
                dados["comando"],
                dados["duracao_min"],
                dados["ordem"],
                dados["obrigatoria"]
            )
        )

    def desativar_aula_admin(self, id_modulo, id_aula):
        query = """
            UPDATE dbo.TB_ACADEMIA_AULA
            SET ATIVA = 0
            WHERE ID_AULA = ?
              AND ID_MODULO = ?
              AND ATIVA = 1
        """
        return self.db.execute_commit(
            query=query,
            parametros=(id_aula, id_modulo),
            return_rowcount=True
        )

    def validar_publicacao_admin(self, id_curso):
        query = """
            SELECT
                C.ID_CURSO AS id,
                C.TODOS_CENTROS_CUSTO AS todos_centros_custo,
                (
                    SELECT COUNT(*)
                    FROM dbo.TB_ACADEMIA_CURSO_CENTRO_CUSTO CC WITH (NOLOCK)
                    WHERE CC.ID_CURSO = C.ID_CURSO
                ) AS total_centros_custo,
                (
                    SELECT COUNT(*)
                    FROM dbo.TB_ACADEMIA_MODULO M WITH (NOLOCK)
                    WHERE M.ID_CURSO = C.ID_CURSO
                      AND M.ATIVO = 1
                ) AS total_modulos,
                (
                    SELECT COUNT(*)
                    FROM dbo.TB_ACADEMIA_MODULO M WITH (NOLOCK)
                    INNER JOIN dbo.TB_ACADEMIA_AULA A WITH (NOLOCK)
                        ON A.ID_MODULO = M.ID_MODULO
                       AND A.ATIVA = 1
                    WHERE M.ID_CURSO = C.ID_CURSO
                      AND M.ATIVO = 1
                ) AS total_aulas
            FROM dbo.TB_ACADEMIA_CURSO C WITH (NOLOCK)
            WHERE C.ID_CURSO = ?
              AND C.STATUS <> 'ARQUIVADO'
        """
        return self.db.execute_fetch(
            query=query,
            parametros=(id_curso,),
            one=True
        )

    def alterar_status_curso_admin(self, id_curso, status):
        query = """
            UPDATE dbo.TB_ACADEMIA_CURSO
            SET STATUS = ?,
                DT_ATUALIZACAO = SYSDATETIME()
            WHERE ID_CURSO = ?
              AND STATUS <> 'ARQUIVADO'
        """
        return self.db.execute_commit(
            query=query,
            parametros=(status, id_curso),
            return_rowcount=True
        )

    def arquivar_curso_admin(self, id_curso):
        query = """
            UPDATE dbo.TB_ACADEMIA_CURSO
            SET STATUS = 'ARQUIVADO',
                DT_ATUALIZACAO = SYSDATETIME()
            WHERE ID_CURSO = ?
              AND STATUS <> 'ARQUIVADO'
        """
        return self.db.execute_commit(
            query=query,
            parametros=(id_curso,),
            return_rowcount=True
        )

    def obter_dashboard_admin(self):
        resumo = self.db.execute_fetch(
            query="""
                SELECT
                    SUM(CASE WHEN STATUS = 'PUBLICADO' THEN 1 ELSE 0 END)
                        AS cursos_publicados,
                    SUM(CASE WHEN STATUS = 'RASCUNHO' THEN 1 ELSE 0 END)
                        AS rascunhos,
                    SUM(CASE WHEN STATUS = 'EM_REVISAO' THEN 1 ELSE 0 END)
                        AS em_revisao,
                    (
                        SELECT COUNT(DISTINCT CPF_COLABORADOR)
                        FROM dbo.TB_ACADEMIA_MATRICULA WITH (NOLOCK)
                        WHERE STATUS = 'EM_ANDAMENTO'
                    ) AS alunos_ativos,
                    (
                        SELECT COUNT(*)
                        FROM dbo.TB_ACADEMIA_MATRICULA WITH (NOLOCK)
                        WHERE STATUS <> 'CANCELADO'
                    ) AS total_matriculas,
                    (
                        SELECT COUNT(DISTINCT MT.ID_MATRICULA)
                        FROM dbo.TB_ACADEMIA_MATRICULA MT WITH (NOLOCK)
                        INNER JOIN dbo.TB_ACADEMIA_PROGRESSO_AULA P WITH (NOLOCK)
                            ON P.ID_MATRICULA = MT.ID_MATRICULA
                           AND P.PERCENTUAL > 0
                        WHERE MT.STATUS <> 'CANCELADO'
                    ) AS total_iniciaram,
                    (
                        SELECT COUNT(*)
                        FROM dbo.TB_ACADEMIA_MATRICULA WITH (NOLOCK)
                        WHERE STATUS = 'CONCLUIDO'
                    ) AS total_concluidos,
                    (
                        SELECT COUNT(*)
                        FROM dbo.TB_ACADEMIA_MATRICULA MT WITH (NOLOCK)
                        WHERE MT.STATUS <> 'CANCELADO'
                          AND (
                                SELECT COUNT(*)
                                FROM dbo.TB_ACADEMIA_MODULO M WITH (NOLOCK)
                                INNER JOIN dbo.TB_ACADEMIA_AULA A WITH (NOLOCK)
                                    ON A.ID_MODULO = M.ID_MODULO
                                   AND A.ATIVA = 1
                                   AND A.TIPO NOT IN ('SIMULACAO', 'TREINAMENTO')
                                WHERE M.ID_CURSO = MT.ID_CURSO
                                  AND M.ATIVO = 1
                              ) > 0
                          AND 2 * (
                                SELECT COUNT(DISTINCT P.ID_AULA)
                                FROM dbo.TB_ACADEMIA_PROGRESSO_AULA P WITH (NOLOCK)
                                INNER JOIN dbo.TB_ACADEMIA_AULA A WITH (NOLOCK)
                                    ON A.ID_AULA = P.ID_AULA
                                   AND A.ATIVA = 1
                                   AND A.TIPO NOT IN ('SIMULACAO', 'TREINAMENTO')
                                WHERE P.ID_MATRICULA = MT.ID_MATRICULA
                                  AND P.CONCLUIDA = 1
                              ) >= (
                                SELECT COUNT(*)
                                FROM dbo.TB_ACADEMIA_MODULO M WITH (NOLOCK)
                                INNER JOIN dbo.TB_ACADEMIA_AULA A WITH (NOLOCK)
                                    ON A.ID_MODULO = M.ID_MODULO
                                   AND A.ATIVA = 1
                                   AND A.TIPO NOT IN ('SIMULACAO', 'TREINAMENTO')
                                WHERE M.ID_CURSO = MT.ID_CURSO
                                  AND M.ATIVO = 1
                              )
                    ) AS total_metade,
                    (
                        SELECT COUNT(*)
                        FROM (
                            SELECT MT.ID_MATRICULA
                            FROM dbo.TB_ACADEMIA_MATRICULA MT WITH (NOLOCK)
                            INNER JOIN dbo.TB_ACADEMIA_PROGRESSO_AULA P WITH (NOLOCK)
                                ON P.ID_MATRICULA = MT.ID_MATRICULA
                            WHERE MT.STATUS = 'EM_ANDAMENTO'
                            GROUP BY MT.ID_MATRICULA
                            HAVING MAX(P.DT_ULTIMO_ACESSO) < DATEADD(DAY, -3, SYSDATETIME())
                               AND MAX(P.DT_ULTIMO_ACESSO) >= DATEADD(DAY, -7, SYSDATETIME())
                        ) EM_RISCO
                    ) AS alunos_em_risco,
                    (
                        SELECT COUNT(*)
                        FROM (
                            SELECT MT.ID_MATRICULA
                            FROM dbo.TB_ACADEMIA_MATRICULA MT WITH (NOLOCK)
                            INNER JOIN dbo.TB_ACADEMIA_PROGRESSO_AULA P WITH (NOLOCK)
                                ON P.ID_MATRICULA = MT.ID_MATRICULA
                            WHERE MT.STATUS = 'EM_ANDAMENTO'
                            GROUP BY MT.ID_MATRICULA
                            HAVING MAX(P.DT_ULTIMO_ACESSO) < DATEADD(DAY, -7, SYSDATETIME())
                        ) INTERROMPIDOS
                    ) AS alunos_interrompidos,
                    CAST(
                        CASE
                            WHEN (
                                SELECT COUNT(*)
                                FROM dbo.TB_ACADEMIA_MATRICULA WITH (NOLOCK)
                                WHERE STATUS <> 'CANCELADO'
                            ) = 0 THEN 0
                            ELSE
                                100.0 * (
                                    SELECT COUNT(*)
                                    FROM dbo.TB_ACADEMIA_MATRICULA WITH (NOLOCK)
                                    WHERE STATUS = 'CONCLUIDO'
                                ) / (
                                    SELECT COUNT(*)
                                    FROM dbo.TB_ACADEMIA_MATRICULA WITH (NOLOCK)
                                    WHERE STATUS <> 'CANCELADO'
                                )
                        END
                        AS DECIMAL(5,2)
                    ) AS conclusao_media
                FROM dbo.TB_ACADEMIA_CURSO WITH (NOLOCK)
                WHERE STATUS <> 'ARQUIVADO'
            """,
            parametros=(),
            one=True
        ) or {}

        desempenho = self.db.execute_fetch(
            query="""
                WITH TOTAL_AULAS AS (
                    SELECT
                        M.ID_CURSO,
                        COUNT(A.ID_AULA) AS total_aulas
                    FROM dbo.TB_ACADEMIA_MODULO M WITH (NOLOCK)
                    INNER JOIN dbo.TB_ACADEMIA_AULA A WITH (NOLOCK)
                        ON A.ID_MODULO = M.ID_MODULO
                       AND A.ATIVA = 1
                    WHERE M.ATIVO = 1
                    GROUP BY M.ID_CURSO
                ),
                PROGRESSO_MATRICULA AS (
                    SELECT
                        MT.ID_MATRICULA,
                        MT.ID_CURSO,
                        MT.STATUS,
                        COUNT(CASE WHEN P.CONCLUIDA = 1 THEN 1 END)
                            AS aulas_concluidas
                    FROM dbo.TB_ACADEMIA_MATRICULA MT WITH (NOLOCK)
                    LEFT JOIN dbo.TB_ACADEMIA_PROGRESSO_AULA P WITH (NOLOCK)
                        ON P.ID_MATRICULA = MT.ID_MATRICULA
                    WHERE MT.STATUS <> 'CANCELADO'
                    GROUP BY MT.ID_MATRICULA, MT.ID_CURSO, MT.STATUS
                )
                SELECT
                    C.ID_CURSO AS curso_id,
                    C.TITULO AS titulo,
                    COUNT(PM.ID_MATRICULA) AS matriculas,
                    COUNT(CASE WHEN PM.STATUS = 'CONCLUIDO' THEN 1 END)
                        AS concluidos,
                    CAST(
                        CASE
                            WHEN COUNT(PM.ID_MATRICULA) = 0 THEN 0
                            ELSE
                                100.0 * COUNT(
                                    CASE WHEN PM.STATUS = 'CONCLUIDO' THEN 1 END
                                ) / COUNT(PM.ID_MATRICULA)
                        END
                        AS DECIMAL(5,2)
                    ) AS taxa_conclusao,
                    CAST(
                        CASE
                            WHEN COUNT(PM.ID_MATRICULA) = 0
                                 OR MAX(ISNULL(TA.total_aulas, 0)) = 0
                                THEN 0
                            ELSE
                                100.0 * SUM(PM.aulas_concluidas)
                                / (
                                    COUNT(PM.ID_MATRICULA)
                                    * MAX(TA.total_aulas)
                                )
                        END
                        AS DECIMAL(5,2)
                    ) AS progresso_medio
                FROM dbo.TB_ACADEMIA_CURSO C WITH (NOLOCK)
                LEFT JOIN TOTAL_AULAS TA
                    ON TA.ID_CURSO = C.ID_CURSO
                LEFT JOIN PROGRESSO_MATRICULA PM
                    ON PM.ID_CURSO = C.ID_CURSO
                WHERE C.STATUS = 'PUBLICADO'
                GROUP BY C.ID_CURSO, C.TITULO
                ORDER BY taxa_conclusao DESC, matriculas DESC, C.TITULO
            """,
            parametros=(),
            one=False
        ) or []

        abandonos = self.db.execute_fetch(
            query="""
                SELECT TOP 5
                    A.ID_AULA AS aula_id,
                    A.TITULO AS aula_titulo,
                    C.ID_CURSO AS curso_id,
                    C.TITULO AS curso_titulo,
                    COUNT(*) AS abandonos,
                    CAST(
                        CASE
                            WHEN (
                                SELECT COUNT(*)
                                FROM dbo.TB_ACADEMIA_MATRICULA MT2 WITH (NOLOCK)
                                WHERE MT2.ID_CURSO = C.ID_CURSO
                                  AND MT2.STATUS <> 'CANCELADO'
                            ) = 0 THEN 0
                            ELSE
                                100.0 * COUNT(*) / (
                                    SELECT COUNT(*)
                                    FROM dbo.TB_ACADEMIA_MATRICULA MT2 WITH (NOLOCK)
                                    WHERE MT2.ID_CURSO = C.ID_CURSO
                                      AND MT2.STATUS <> 'CANCELADO'
                                )
                        END
                        AS DECIMAL(5,2)
                    ) AS taxa_abandono
                FROM dbo.TB_ACADEMIA_PROGRESSO_AULA P WITH (NOLOCK)
                INNER JOIN dbo.TB_ACADEMIA_MATRICULA MT WITH (NOLOCK)
                    ON MT.ID_MATRICULA = P.ID_MATRICULA
                INNER JOIN dbo.TB_ACADEMIA_AULA A WITH (NOLOCK)
                    ON A.ID_AULA = P.ID_AULA
                   AND A.ATIVA = 1
                INNER JOIN dbo.TB_ACADEMIA_MODULO M WITH (NOLOCK)
                    ON M.ID_MODULO = A.ID_MODULO
                   AND M.ATIVO = 1
                INNER JOIN dbo.TB_ACADEMIA_CURSO C WITH (NOLOCK)
                    ON C.ID_CURSO = M.ID_CURSO
                   AND C.STATUS = 'PUBLICADO'
                WHERE P.PERCENTUAL > 0
                  AND P.CONCLUIDA = 0
                  AND MT.STATUS <> 'CANCELADO'
                GROUP BY
                    A.ID_AULA,
                    A.TITULO,
                    C.ID_CURSO,
                    C.TITULO
                ORDER BY abandonos DESC, taxa_abandono DESC
            """,
            parametros=(),
            one=False
        ) or []

        alunos = self.db.execute_fetch(
            query="""
                WITH TOTAL_AULAS AS (
                    SELECT
                        M.ID_CURSO,
                        COUNT(A.ID_AULA) AS total_aulas
                    FROM dbo.TB_ACADEMIA_MODULO M WITH (NOLOCK)
                    INNER JOIN dbo.TB_ACADEMIA_AULA A WITH (NOLOCK)
                        ON A.ID_MODULO = M.ID_MODULO
                       AND A.ATIVA = 1
                       AND A.TIPO NOT IN ('SIMULACAO', 'TREINAMENTO')
                    WHERE M.ATIVO = 1
                    GROUP BY M.ID_CURSO
                ),
                PROGRESSO AS (
                    SELECT
                        P.ID_MATRICULA,
                        COUNT(DISTINCT CASE WHEN P.PERCENTUAL > 0 THEN P.ID_AULA END)
                            AS aulas_iniciadas,
                        COUNT(DISTINCT CASE WHEN P.CONCLUIDA = 1 THEN P.ID_AULA END)
                            AS aulas_concluidas,
                        MAX(P.DT_ULTIMO_ACESSO) AS ultima_atividade
                    FROM dbo.TB_ACADEMIA_PROGRESSO_AULA P WITH (NOLOCK)
                    GROUP BY P.ID_MATRICULA
                )
                SELECT
                    MT.ID_MATRICULA AS matricula_id,
                    LTRIM(RTRIM(MT.CPF_COLABORADOR)) AS cpf,
                    LTRIM(RTRIM(U.NM_COLABORADOR)) AS nome,
                    LTRIM(RTRIM(U.CENTRO_CUSTO)) AS centro_custo,
                    C.ID_CURSO AS curso_id,
                    C.TITULO AS curso_titulo,
                    MT.STATUS AS status_matricula,
                    ISNULL(P.aulas_iniciadas, 0) AS aulas_iniciadas,
                    ISNULL(P.aulas_concluidas, 0) AS aulas_concluidas,
                    ISNULL(TA.total_aulas, 0) AS total_aulas,
                    CAST(
                        CASE
                            WHEN ISNULL(TA.total_aulas, 0) = 0 THEN 0
                            ELSE 100.0 * ISNULL(P.aulas_concluidas, 0)
                                / TA.total_aulas
                        END
                        AS DECIMAL(5,2)
                    ) AS progresso,
                    P.ultima_atividade,
                    CASE
                        WHEN MT.STATUS = 'CONCLUIDO' THEN 'CONCLUIDO'
                        WHEN P.ultima_atividade < DATEADD(DAY, -7, SYSDATETIME())
                            THEN 'INTERROMPIDO'
                        WHEN P.ultima_atividade < DATEADD(DAY, -3, SYSDATETIME())
                            THEN 'EM_RISCO'
                        WHEN P.ultima_atividade IS NULL THEN 'NAO_INICIADO'
                        ELSE 'ATIVO'
                    END AS situacao
                FROM dbo.TB_ACADEMIA_MATRICULA MT WITH (NOLOCK)
                INNER JOIN dbo.TB_ACADEMIA_CURSO C WITH (NOLOCK)
                    ON C.ID_CURSO = MT.ID_CURSO
                   AND C.STATUS <> 'ARQUIVADO'
                INNER JOIN login.TB_USUARIOS U WITH (NOLOCK)
                    ON U.CPF_COLABORADOR = MT.CPF_COLABORADOR
                LEFT JOIN TOTAL_AULAS TA
                    ON TA.ID_CURSO = MT.ID_CURSO
                LEFT JOIN PROGRESSO P
                    ON P.ID_MATRICULA = MT.ID_MATRICULA
                WHERE MT.STATUS <> 'CANCELADO'
                ORDER BY
                    CASE
                        WHEN MT.STATUS = 'CONCLUIDO' THEN 3
                        WHEN P.ultima_atividade IS NULL THEN 2
                        WHEN P.ultima_atividade < DATEADD(DAY, -3, SYSDATETIME()) THEN 0
                        ELSE 1
                    END,
                    P.ultima_atividade,
                    U.NM_COLABORADOR
            """,
            parametros=(),
            one=False
        ) or []

        return {
            "resumo": resumo,
            "desempenho": desempenho,
            "abandonos": abandonos,
            "alunos": alunos,
        }

    # ------------------------------------------------------------------
    # Quiz corrigido no servidor
    # ------------------------------------------------------------------

    def estrutura_quiz_disponivel(self):
        return self._estrutura_disponivel(
            "quiz",
            "OBJECT_ID('dbo.TB_ACADEMIA_QUIZ_TENTATIVA', 'U') IS NOT NULL"
        )

    def obter_aula_avaliativa(self, id_aula):
        query = """
            SELECT
                A.ID_AULA AS id,
                A.TIPO AS tipo,
                A.CONTEUDO_TEXTO AS conteudo_texto
            FROM dbo.TB_ACADEMIA_AULA A WITH (NOLOCK)
            WHERE A.ID_AULA = ?
              AND A.ATIVA = 1
        """
        return self.db.execute_fetch(
            query=query,
            parametros=(id_aula,),
            one=True
        )

    def registrar_tentativa_quiz(self, id_matricula, id_aula, dados):
        query = """
            INSERT INTO dbo.TB_ACADEMIA_QUIZ_TENTATIVA (
                ID_MATRICULA,
                ID_AULA,
                NOTA,
                ACERTOS,
                TOTAL_PERGUNTAS,
                NOTA_MINIMA,
                APROVADA,
                RESPOSTAS
            )
            OUTPUT
                INSERTED.ID_TENTATIVA AS id,
                INSERTED.DT_TENTATIVA AS realizada_em
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """
        return self.db.execute_insert_returning(
            query=query,
            parametros=(
                id_matricula,
                id_aula,
                dados["nota"],
                dados["acertos"],
                dados["total_perguntas"],
                dados["nota_minima"],
                1 if dados["aprovada"] else 0,
                dados["respostas"]
            )
        )

    def listar_melhores_tentativas(self, id_matricula):
        query = """
            SELECT
                T.ID_AULA AS aula_id,
                MAX(T.NOTA) AS melhor_nota,
                COUNT(*) AS tentativas,
                MAX(CASE WHEN T.APROVADA = 1 THEN 1 ELSE 0 END) AS aprovada,
                MAX(T.DT_TENTATIVA) AS ultima_tentativa
            FROM dbo.TB_ACADEMIA_QUIZ_TENTATIVA T WITH (NOLOCK)
            WHERE T.ID_MATRICULA = ?
            GROUP BY T.ID_AULA
        """
        return self.db.execute_fetch(
            query=query,
            parametros=(id_matricula,),
            one=False
        ) or []

    def contar_tentativas_quiz(self, id_matricula, id_aula):
        query = """
            SELECT COUNT(*) AS total
            FROM dbo.TB_ACADEMIA_QUIZ_TENTATIVA WITH (NOLOCK)
            WHERE ID_MATRICULA = ?
              AND ID_AULA = ?
        """
        resultado = self.db.execute_fetch(
            query=query,
            parametros=(id_matricula, id_aula),
            one=True
        )
        return (resultado or {}).get("total") or 0

    def obter_nota_media_matricula(self, id_matricula):
        query = """
            SELECT CAST(AVG(MELHOR.NOTA) AS DECIMAL(5, 2)) AS nota_final
            FROM (
                SELECT T.ID_AULA, MAX(T.NOTA) AS NOTA
                FROM dbo.TB_ACADEMIA_QUIZ_TENTATIVA T WITH (NOLOCK)
                WHERE T.ID_MATRICULA = ?
                  AND T.APROVADA = 1
                GROUP BY T.ID_AULA
            ) MELHOR
        """
        resultado = self.db.execute_fetch(
            query=query,
            parametros=(id_matricula,),
            one=True
        )
        return (resultado or {}).get("nota_final")

    # ------------------------------------------------------------------
    # Atribuicao de cursos e prazos
    # ------------------------------------------------------------------

    def estrutura_atribuicao_disponivel(self):
        return self._estrutura_disponivel(
            "atribuicao",
            "OBJECT_ID('dbo.TB_ACADEMIA_ATRIBUICAO', 'U') IS NOT NULL"
            " AND COL_LENGTH('dbo.TB_ACADEMIA_MATRICULA', 'DT_LIMITE')"
            " IS NOT NULL"
        )

    def listar_atribuicoes(self, id_curso):
        query = """
            SELECT
                AT.ID_ATRIBUICAO AS id,
                AT.ID_CURSO AS curso_id,
                AT.TIPO_PUBLICO AS tipo_publico,
                AT.ALVO AS alvo,
                AT.OBRIGATORIA AS obrigatoria,
                AT.PRAZO_DIAS AS prazo_dias,
                AT.DT_LIMITE AS data_limite,
                AT.DT_SINCRONIZACAO AS sincronizado_em,
                (
                    SELECT COUNT(*)
                    FROM dbo.TB_ACADEMIA_MATRICULA MT WITH (NOLOCK)
                    WHERE MT.ID_ATRIBUICAO = AT.ID_ATRIBUICAO
                      AND MT.STATUS <> 'CANCELADO'
                ) AS matriculas
            FROM dbo.TB_ACADEMIA_ATRIBUICAO AT WITH (NOLOCK)
            WHERE AT.ID_CURSO = ?
              AND AT.ATIVA = 1
            ORDER BY AT.TIPO_PUBLICO, AT.ALVO
        """
        return self.db.execute_fetch(
            query=query,
            parametros=(id_curso,),
            one=False
        ) or []

    def salvar_atribuicao(self, id_curso, dados, cpf):
        """Cria a atribuicao ou reaproveita a linha equivalente ja ativa."""
        query = """
            UPDATE dbo.TB_ACADEMIA_ATRIBUICAO
            SET OBRIGATORIA = ?,
                PRAZO_DIAS = ?,
                DT_LIMITE = ?
            OUTPUT INSERTED.ID_ATRIBUICAO AS id
            WHERE ID_CURSO = ?
              AND TIPO_PUBLICO = ?
              AND ALVO = ?
              AND ATIVA = 1
        """
        atualizado = self.db.execute_insert_returning(
            query=query,
            parametros=(
                1 if dados["obrigatoria"] else 0,
                dados["prazo_dias"],
                dados["data_limite"],
                id_curso,
                dados["tipo_publico"],
                dados["alvo"]
            )
        )
        if atualizado:
            return atualizado["id"]

        query = """
            INSERT INTO dbo.TB_ACADEMIA_ATRIBUICAO (
                ID_CURSO,
                TIPO_PUBLICO,
                ALVO,
                OBRIGATORIA,
                PRAZO_DIAS,
                DT_LIMITE,
                CRIADO_POR
            )
            OUTPUT INSERTED.ID_ATRIBUICAO AS id
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """
        criado = self.db.execute_insert_returning(
            query=query,
            parametros=(
                id_curso,
                dados["tipo_publico"],
                dados["alvo"],
                1 if dados["obrigatoria"] else 0,
                dados["prazo_dias"],
                dados["data_limite"],
                cpf
            )
        )
        return (criado or {}).get("id")

    def desativar_atribuicao(self, id_curso, id_atribuicao):
        query = """
            UPDATE dbo.TB_ACADEMIA_ATRIBUICAO
            SET ATIVA = 0
            WHERE ID_ATRIBUICAO = ?
              AND ID_CURSO = ?
              AND ATIVA = 1
        """
        return self.db.execute_commit(
            query=query,
            parametros=(id_atribuicao, id_curso),
            return_rowcount=True
        )

    def sincronizar_atribuicoes(self, id_curso):
        """Matricula quem falta e propaga o prazo para quem ja estava.

        Roda em transacao porque as tres etapas precisam valer juntas:
        sem isso um erro no meio deixaria gente matriculada sem prazo.
        """
        alvo_publico = """
            AT.TIPO_PUBLICO = 'TODOS'
            OR (
                AT.TIPO_PUBLICO = 'CENTRO_CUSTO'
                AND UPPER(LTRIM(RTRIM(ISNULL(U.CENTRO_CUSTO, '')))) = AT.ALVO
            )
            OR (
                AT.TIPO_PUBLICO = 'COLABORADOR'
                AND LTRIM(RTRIM(U.CPF_COLABORADOR)) = AT.ALVO
            )
        """
        prazo = """
            CASE
                WHEN AT.DT_LIMITE IS NOT NULL THEN AT.DT_LIMITE
                WHEN AT.PRAZO_DIAS IS NOT NULL
                    THEN CAST(DATEADD(DAY, AT.PRAZO_DIAS, SYSDATETIME()) AS DATE)
                ELSE NULL
            END
        """

        transacao = self.db.begin_transaction()
        try:
            novas = transacao.execute_commit(
                query=f"""
                    INSERT INTO dbo.TB_ACADEMIA_MATRICULA (
                        ID_CURSO,
                        CPF_COLABORADOR,
                        ID_ATRIBUICAO,
                        DT_LIMITE,
                        ORIGEM
                    )
                    SELECT
                        AT.ID_CURSO,
                        LTRIM(RTRIM(U.CPF_COLABORADOR)),
                        MIN(AT.ID_ATRIBUICAO),
                        MIN({prazo}),
                        'ATRIBUIDA'
                    FROM dbo.TB_ACADEMIA_ATRIBUICAO AT
                    INNER JOIN dbo.TB_ACADEMIA_CURSO C
                        ON C.ID_CURSO = AT.ID_CURSO
                       AND C.STATUS = 'PUBLICADO'
                    INNER JOIN login.TB_USUARIOS U
                        ON ISNULL(U.USUARIO_ATIVO, 1) = 1
                       AND NULLIF(LTRIM(RTRIM(U.CPF_COLABORADOR)), '')
                           IS NOT NULL
                    WHERE AT.ID_CURSO = ?
                      AND AT.ATIVA = 1
                      AND ({alvo_publico})
                      AND NOT EXISTS (
                            SELECT 1
                            FROM dbo.TB_ACADEMIA_MATRICULA MT
                            WHERE MT.ID_CURSO = AT.ID_CURSO
                              AND LTRIM(RTRIM(MT.CPF_COLABORADOR))
                                  = LTRIM(RTRIM(U.CPF_COLABORADOR))
                      )
                    GROUP BY AT.ID_CURSO, LTRIM(RTRIM(U.CPF_COLABORADOR))
                """,
                parametros=(id_curso,),
                return_rowcount=True
            )

            transacao.execute_commit(
                query=f"""
                    UPDATE MT
                    SET ID_ATRIBUICAO = ORIGEM_ATRIBUICAO.ID_ATRIBUICAO,
                        DT_LIMITE = ORIGEM_ATRIBUICAO.PRAZO,
                        ORIGEM = 'ATRIBUIDA'
                    FROM dbo.TB_ACADEMIA_MATRICULA MT
                    CROSS APPLY (
                        SELECT TOP 1
                            AT.ID_ATRIBUICAO,
                            {prazo} AS PRAZO
                        FROM dbo.TB_ACADEMIA_ATRIBUICAO AT
                        INNER JOIN login.TB_USUARIOS U
                            ON LTRIM(RTRIM(U.CPF_COLABORADOR))
                               = LTRIM(RTRIM(MT.CPF_COLABORADOR))
                           AND ISNULL(U.USUARIO_ATIVO, 1) = 1
                        WHERE AT.ID_CURSO = MT.ID_CURSO
                          AND AT.ATIVA = 1
                          AND ({alvo_publico})
                        ORDER BY
                            CASE WHEN {prazo} IS NULL THEN 1 ELSE 0 END,
                            {prazo},
                            AT.ID_ATRIBUICAO
                    ) ORIGEM_ATRIBUICAO
                    WHERE MT.ID_CURSO = ?
                      AND MT.STATUS <> 'CANCELADO'
                      AND MT.ID_ATRIBUICAO IS NULL
                """,
                parametros=(id_curso,)
            )

            transacao.execute_commit(
                query="""
                    UPDATE dbo.TB_ACADEMIA_ATRIBUICAO
                    SET DT_SINCRONIZACAO = SYSDATETIME()
                    WHERE ID_CURSO = ?
                      AND ATIVA = 1
                """,
                parametros=(id_curso,)
            )

            transacao.commit()
            return novas or 0
        except Exception:
            transacao.rollback()
            raise
        finally:
            transacao.close()

    def listar_prazos_do_usuario(self, cpf):
        query = """
            SELECT
                MT.ID_CURSO AS curso_id,
                MT.DT_LIMITE AS data_limite,
                MT.ORIGEM AS origem,
                ISNULL(AT.OBRIGATORIA, 0) AS obrigatoria
            FROM dbo.TB_ACADEMIA_MATRICULA MT WITH (NOLOCK)
            LEFT JOIN dbo.TB_ACADEMIA_ATRIBUICAO AT WITH (NOLOCK)
                ON AT.ID_ATRIBUICAO = MT.ID_ATRIBUICAO
            WHERE LTRIM(RTRIM(MT.CPF_COLABORADOR)) = LTRIM(RTRIM(?))
              AND MT.STATUS <> 'CANCELADO'
        """
        return self.db.execute_fetch(
            query=query,
            parametros=(cpf,),
            one=False
        ) or []

    def obter_prazos_admin(self):
        query = """
            SELECT
                C.ID_CURSO AS curso_id,
                C.TITULO AS curso_titulo,
                COUNT(*) AS atribuidas,
                SUM(CASE WHEN MT.STATUS = 'CONCLUIDO' THEN 1 ELSE 0 END)
                    AS concluidas,
                SUM(
                    CASE
                        WHEN MT.STATUS <> 'CONCLUIDO'
                         AND MT.DT_LIMITE < CAST(SYSDATETIME() AS DATE)
                        THEN 1 ELSE 0
                    END
                ) AS vencidas,
                SUM(
                    CASE
                        WHEN MT.STATUS <> 'CONCLUIDO'
                         AND MT.DT_LIMITE >= CAST(SYSDATETIME() AS DATE)
                         AND MT.DT_LIMITE
                             <= CAST(DATEADD(DAY, 3, SYSDATETIME()) AS DATE)
                        THEN 1 ELSE 0
                    END
                ) AS vencendo,
                CAST(
                    CASE
                        WHEN COUNT(*) = 0 THEN 0
                        ELSE 100.0 * SUM(
                            CASE WHEN MT.STATUS = 'CONCLUIDO' THEN 1 ELSE 0 END
                        ) / COUNT(*)
                    END
                    AS DECIMAL(5, 2)
                ) AS aderencia
            FROM dbo.TB_ACADEMIA_MATRICULA MT WITH (NOLOCK)
            INNER JOIN dbo.TB_ACADEMIA_CURSO C WITH (NOLOCK)
                ON C.ID_CURSO = MT.ID_CURSO
               AND C.STATUS <> 'ARQUIVADO'
            WHERE MT.STATUS <> 'CANCELADO'
              AND MT.DT_LIMITE IS NOT NULL
            GROUP BY C.ID_CURSO, C.TITULO
            ORDER BY vencidas DESC, aderencia, C.TITULO
        """
        return self.db.execute_fetch(
            query=query,
            parametros=(),
            one=False
        ) or []

    # ------------------------------------------------------------------
    # Certificados
    # ------------------------------------------------------------------

    def estrutura_certificado_disponivel(self):
        return self._estrutura_disponivel(
            "certificado",
            "OBJECT_ID('dbo.TB_ACADEMIA_CERTIFICADO', 'U') IS NOT NULL"
        )

    def obter_matricula_concluida(self, cpf, id_curso):
        query = """
            SELECT TOP 1
                MT.ID_MATRICULA AS matricula_id,
                MT.ID_CURSO AS curso_id,
                MT.DT_CONCLUSAO AS concluido_em
            FROM dbo.TB_ACADEMIA_MATRICULA MT WITH (NOLOCK)
            WHERE LTRIM(RTRIM(MT.CPF_COLABORADOR)) = LTRIM(RTRIM(?))
              AND MT.ID_CURSO = ?
              AND MT.STATUS = 'CONCLUIDO'
        """
        return self.db.execute_fetch(
            query=query,
            parametros=(cpf, id_curso),
            one=True
        )

    def obter_dados_certificado(self, id_matricula):
        query = """
            SELECT
                LTRIM(RTRIM(MT.CPF_COLABORADOR)) AS cpf,
                LTRIM(RTRIM(U.NM_COLABORADOR)) AS nome,
                LTRIM(RTRIM(U.CENTRO_CUSTO)) AS centro_custo,
                C.TITULO AS curso_titulo,
                ISNULL(C.CARGA_HORARIA_MIN, 0) AS carga_horaria_min,
                (
                    SELECT COUNT(*)
                    FROM dbo.TB_ACADEMIA_MODULO M WITH (NOLOCK)
                    INNER JOIN dbo.TB_ACADEMIA_AULA A WITH (NOLOCK)
                        ON A.ID_MODULO = M.ID_MODULO
                       AND A.ATIVA = 1
                    WHERE M.ID_CURSO = C.ID_CURSO
                      AND M.ATIVO = 1
                ) AS total_aulas
            FROM dbo.TB_ACADEMIA_MATRICULA MT WITH (NOLOCK)
            INNER JOIN dbo.TB_ACADEMIA_CURSO C WITH (NOLOCK)
                ON C.ID_CURSO = MT.ID_CURSO
            INNER JOIN login.TB_USUARIOS U WITH (NOLOCK)
                ON LTRIM(RTRIM(U.CPF_COLABORADOR))
                   = LTRIM(RTRIM(MT.CPF_COLABORADOR))
            WHERE MT.ID_MATRICULA = ?
        """
        return self.db.execute_fetch(
            query=query,
            parametros=(id_matricula,),
            one=True
        )

    def obter_certificado_por_matricula(self, id_matricula):
        query = """
            SELECT
                CODIGO AS codigo,
                NOME_SNAPSHOT AS nome,
                CENTRO_CUSTO_SNAPSHOT AS centro_custo,
                CURSO_TITULO_SNAPSHOT AS curso_titulo,
                CARGA_HORARIA_MIN AS carga_horaria_min,
                TOTAL_AULAS AS total_aulas,
                NOTA_FINAL AS nota_final,
                DT_EMISSAO AS emitido_em
            FROM dbo.TB_ACADEMIA_CERTIFICADO WITH (NOLOCK)
            WHERE ID_MATRICULA = ?
        """
        return self.db.execute_fetch(
            query=query,
            parametros=(id_matricula,),
            one=True
        )

    def emitir_certificado(self, id_matricula, codigo, dados):
        """Emite o certificado apenas se a matricula ainda nao tiver um."""
        query = """
            INSERT INTO dbo.TB_ACADEMIA_CERTIFICADO (
                ID_MATRICULA,
                CODIGO,
                CPF_COLABORADOR,
                NOME_SNAPSHOT,
                CENTRO_CUSTO_SNAPSHOT,
                CURSO_TITULO_SNAPSHOT,
                CARGA_HORARIA_MIN,
                TOTAL_AULAS,
                NOTA_FINAL
            )
            OUTPUT INSERTED.CODIGO AS codigo
            SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
            WHERE NOT EXISTS (
                SELECT 1
                FROM dbo.TB_ACADEMIA_CERTIFICADO
                WHERE ID_MATRICULA = ?
            )
        """
        return self.db.execute_insert_returning(
            query=query,
            parametros=(
                id_matricula,
                codigo,
                dados["cpf"],
                dados["nome"],
                dados["centro_custo"],
                dados["curso_titulo"],
                dados["carga_horaria_min"],
                dados["total_aulas"],
                dados["nota_final"],
                id_matricula
            )
        )

    def listar_certificados(self, cpf):
        query = """
            SELECT
                CT.CODIGO AS codigo,
                CT.CURSO_TITULO_SNAPSHOT AS curso_titulo,
                CT.CARGA_HORARIA_MIN AS carga_horaria_min,
                CT.TOTAL_AULAS AS total_aulas,
                CT.NOTA_FINAL AS nota_final,
                CT.DT_EMISSAO AS emitido_em,
                MT.ID_CURSO AS curso_id
            FROM dbo.TB_ACADEMIA_CERTIFICADO CT WITH (NOLOCK)
            INNER JOIN dbo.TB_ACADEMIA_MATRICULA MT WITH (NOLOCK)
                ON MT.ID_MATRICULA = CT.ID_MATRICULA
            WHERE LTRIM(RTRIM(CT.CPF_COLABORADOR)) = LTRIM(RTRIM(?))
            ORDER BY CT.DT_EMISSAO DESC
        """
        return self.db.execute_fetch(
            query=query,
            parametros=(cpf,),
            one=False
        ) or []

    def obter_certificado_por_codigo(self, codigo):
        query = """
            SELECT
                CT.CODIGO AS codigo,
                CT.NOME_SNAPSHOT AS nome,
                CT.CENTRO_CUSTO_SNAPSHOT AS centro_custo,
                CT.CURSO_TITULO_SNAPSHOT AS curso_titulo,
                CT.CARGA_HORARIA_MIN AS carga_horaria_min,
                CT.TOTAL_AULAS AS total_aulas,
                CT.NOTA_FINAL AS nota_final,
                CT.DT_EMISSAO AS emitido_em
            FROM dbo.TB_ACADEMIA_CERTIFICADO CT WITH (NOLOCK)
            WHERE CT.CODIGO = ?
        """
        return self.db.execute_fetch(
            query=query,
            parametros=(codigo,),
            one=True
        )
