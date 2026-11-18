from src.infrastructure.database.sql_server_connection import SQLServerConnection
from src.shared.utils.env_load import DB_HOST_66


class PermissaoRepository:
    """Acesso a TB_PERMISSAO_AREA e TB_PERMISSAO_VISAO.

    `estrutura_disponivel` e publico pelo mesmo motivo do CopilotTourRepository:
    o servico precisa distinguir "ninguem tem essa area" de "a migracao 019
    ainda nao rodou neste ambiente". A primeira e uma resposta; a segunda, se
    tratada como resposta, tira o acesso de todo mundo entre o deploy do codigo
    e a aplicacao da migracao -- que neste projeto sao dois passos manuais.

    As leituras usam `begin_transaction` de proposito. `execute_fetch` engole
    pyodbc.Error e devolve None, e aqui None significaria "nenhuma concessao":
    uma indisponibilidade momentanea do banco viraria 403 para a empresa
    inteira, com log nenhum.
    """

    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66, "DB_COPILOT_ACME")
        self._tem_estrutura = None

    def estrutura_disponivel(self) -> bool:
        if self._tem_estrutura is None:
            linha = self._consultar(
                query="""
                    SELECT CASE
                        WHEN OBJECT_ID('dbo.TB_PERMISSAO_VISAO', 'U') IS NULL
                            THEN 0 ELSE 1
                    END AS disponivel
                """,
                parametros=(),
                one=True,
            )
            self._tem_estrutura = bool(linha and linha.get("disponivel"))
        return self._tem_estrutura

    def listar_concessoes_ativas(self) -> list[dict]:
        return self._consultar(
            query="""
                SELECT TIPO, VALOR, AREA
                FROM dbo.TB_PERMISSAO_VISAO WITH (NOLOCK)
                WHERE ATIVO = 1
            """,
            parametros=(),
        ) or []

    def listar_areas(self) -> list[dict]:
        return self._consultar(
            query="""
                SELECT AREA, DESCRICAO, ATIVO
                FROM dbo.TB_PERMISSAO_AREA WITH (NOLOCK)
                ORDER BY AREA
            """,
            parametros=(),
        ) or []

    # ---------------------------------------------------------------- #
    # Visoes (perfis) e atribuicao por pessoa
    # ---------------------------------------------------------------- #

    def perfis_disponiveis(self) -> bool:
        """A migration 025 ja rodou?

        Mesma razao do `estrutura_disponivel`: sem as tabelas de perfil, o
        servico tem de cair no comportamento anterior em vez de tratar a
        ausencia como "ninguem tem visao atribuida".
        """
        linha = self._consultar(
            query="""
                SELECT CASE
                    WHEN OBJECT_ID('dbo.TB_PERMISSAO_USUARIO', 'U') IS NULL
                        THEN 0 ELSE 1
                END AS disponivel
            """,
            parametros=(),
            one=True,
        )
        return bool(linha and linha.get("disponivel"))

    def listar_perfis(self) -> list[dict]:
        """Uma linha por (perfil, area). O servico agrupa."""
        return self._consultar(
            query="""
                SELECT
                    P.CODIGO, P.NOME, P.DESCRICAO, P.ORDEM_EXIBICAO, P.ATIVO,
                    PA.AREA
                FROM dbo.TB_PERMISSAO_PERFIL P WITH (NOLOCK)
                LEFT JOIN dbo.TB_PERMISSAO_PERFIL_AREA PA WITH (NOLOCK)
                    ON PA.CODIGO_PERFIL = P.CODIGO
                WHERE P.ATIVO = 1
                ORDER BY P.ORDEM_EXIBICAO, P.CODIGO, PA.AREA
            """,
            parametros=(),
        ) or []

    def listar_atribuicoes_ativas(self) -> list[dict]:
        """Todas as visoes atribuidas e todos os ajustes, de uma vez.

        A tabela e pequena (uma linha por pessoa com excecao) e o servico a
        mantem no mesmo cache das concessoes: resolver a permissao de alguem
        nao pode custar duas idas ao banco por requisicao.
        """
        return self._consultar(
            query="""
                SELECT
                    U.CPF_COLABORADOR, U.CODIGO_PERFIL,
                    CAST(NULL AS VARCHAR(60)) AS AREA,
                    CAST(NULL AS BIT) AS CONCEDIDA
                FROM dbo.TB_PERMISSAO_USUARIO U WITH (NOLOCK)
                JOIN dbo.TB_PERMISSAO_PERFIL P WITH (NOLOCK)
                    ON P.CODIGO = U.CODIGO_PERFIL AND P.ATIVO = 1
                WHERE U.ATIVO = 1
                UNION ALL
                SELECT
                    A.CPF_COLABORADOR, NULL, A.AREA, A.CONCEDIDA
                FROM dbo.TB_PERMISSAO_USUARIO_AREA A WITH (NOLOCK)
            """,
            parametros=(),
        ) or []

    def listar_pessoas(
        self,
        *,
        busca=None,
        codigo_perfil=None,
        somente_com_visao=True,
        offset=0,
        limite=50,
    ) -> list[dict]:
        """Pessoas do cadastro com a visao atribuida, se houver.

        `ISNULL(USUARIO_ATIVO, 1) = 1` e a convencao do projeto (19 ocorrencias)
        -- NULL conta como ativo. O molde do SELECT vem de
        sql_arena_repository.py:547, o unico lugar que ja devolve as quatro
        colunas que a tela precisa; a diferenca e que aqui NAO se exclui
        supervisor, que e justamente quem mais recebe visao.

        `somente_com_visao` e o padrao porque a lista util e curta: quem tem
        visao atribuida mais quem o cargo ja alcanca. A busca ignora o filtro e
        chega em qualquer um dos 3.102.
        """
        return self._consultar(
            query="""
                SELECT
                    CAST(U.CPF_COLABORADOR AS VARCHAR(20)) AS CPF,
                    LTRIM(RTRIM(U.NM_COLABORADOR))         AS NOME,
                    LTRIM(RTRIM(ISNULL(U.CENTRO_CUSTO, ''))) AS CENTRO_CUSTO,
                    LTRIM(RTRIM(ISNULL(U.FUNCAO_COLABORADOR, ''))) AS FUNCAO,
                    PU.CODIGO_PERFIL,
                    COUNT(*) OVER () AS QT_TOTAL
                FROM login.TB_USUARIOS U WITH (NOLOCK)
                LEFT JOIN dbo.TB_PERMISSAO_USUARIO PU WITH (NOLOCK)
                    ON PU.CPF_COLABORADOR = CAST(U.CPF_COLABORADOR AS VARCHAR(20))
                   AND PU.ATIVO = 1
                WHERE ISNULL(U.USUARIO_ATIVO, 1) = 1
                  AND (? IS NULL OR PU.CODIGO_PERFIL = ?)
                  AND (
                        ? IS NULL
                        OR U.NM_COLABORADOR LIKE '%' + ? + '%'
                        OR CAST(U.CPF_COLABORADOR AS VARCHAR(20)) LIKE ? + '%'
                      )
                  AND (
                        ? = 0
                        OR PU.CODIGO_PERFIL IS NOT NULL
                        -- Sem visao atribuida, "tem visao" quer dizer que o
                        -- cargo ou o centro de custo ja alcanca alguma area.
                        OR EXISTS (
                            SELECT 1 FROM dbo.TB_PERMISSAO_VISAO V WITH (NOLOCK)
                            WHERE V.ATIVO = 1
                              AND (
                                (V.TIPO = 'CENTRO_CUSTO'
                                 AND V.VALOR = LTRIM(RTRIM(ISNULL(U.CENTRO_CUSTO, '')))
                                     COLLATE Latin1_General_CI_AI)
                                OR (V.TIPO = 'FUNCAO'
                                 AND LTRIM(RTRIM(ISNULL(U.FUNCAO_COLABORADOR, '')))
                                     COLLATE Latin1_General_CI_AI LIKE V.VALOR + '%')
                                OR (V.TIPO = 'CPF'
                                 AND V.VALOR = CAST(U.CPF_COLABORADOR AS VARCHAR(20))
                                     COLLATE Latin1_General_CI_AI)
                              )
                        )
                      )
                ORDER BY U.NM_COLABORADOR
                OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
                OPTION (RECOMPILE)
            """,
            parametros=(
                codigo_perfil, codigo_perfil,
                busca, busca, busca,
                1 if somente_com_visao else 0,
                int(offset), int(limite),
            ),
        ) or []

    def obter_pessoa(self, cpf) -> dict | None:
        return self._consultar(
            query="""
                SELECT
                    CAST(U.CPF_COLABORADOR AS VARCHAR(20)) AS CPF,
                    LTRIM(RTRIM(U.NM_COLABORADOR))         AS NOME,
                    LTRIM(RTRIM(ISNULL(U.CENTRO_CUSTO, ''))) AS CENTRO_CUSTO,
                    LTRIM(RTRIM(ISNULL(U.FUNCAO_COLABORADOR, ''))) AS FUNCAO,
                    PU.CODIGO_PERFIL
                FROM login.TB_USUARIOS U WITH (NOLOCK)
                LEFT JOIN dbo.TB_PERMISSAO_USUARIO PU WITH (NOLOCK)
                    ON PU.CPF_COLABORADOR = CAST(U.CPF_COLABORADOR AS VARCHAR(20))
                   AND PU.ATIVO = 1
                WHERE CAST(U.CPF_COLABORADOR AS VARCHAR(20)) = ?
            """,
            parametros=(str(cpf),),
            one=True,
        )

    def listar_ajustes(self, cpf) -> list[dict]:
        return self._consultar(
            query="""
                SELECT AREA, CONCEDIDA
                FROM dbo.TB_PERMISSAO_USUARIO_AREA WITH (NOLOCK)
                WHERE CPF_COLABORADOR = ?
                ORDER BY AREA
            """,
            parametros=(str(cpf),),
        ) or []

    def definir_perfil(self, *, cpf, codigo_perfil, definido_por) -> None:
        """Uma linha por pessoa: trocar a visao sobrescreve, nao acumula."""
        self._escrever(
            query="""
                MERGE dbo.TB_PERMISSAO_USUARIO WITH (HOLDLOCK) AS destino
                USING (SELECT ? AS CPF, ? AS PERFIL) AS origem
                    ON destino.CPF_COLABORADOR = origem.CPF
                WHEN MATCHED THEN UPDATE SET
                    CODIGO_PERFIL = origem.PERFIL,
                    ATIVO = 1,
                    DEFINIDO_EM = SYSDATETIME(),
                    DEFINIDO_POR = ?
                WHEN NOT MATCHED THEN INSERT
                    (CPF_COLABORADOR, CODIGO_PERFIL, DEFINIDO_POR)
                    VALUES (origem.CPF, origem.PERFIL, ?);
            """,
            parametros=(str(cpf), codigo_perfil, definido_por, definido_por),
        )

    def remover_perfil(self, cpf) -> int | None:
        """Devolve a pessoa ao padrao do cargo.

        Apaga tambem os ajustes: eles foram feitos em cima de uma visao que
        deixou de existir para essa pessoa, e mante-los faria o padrao do cargo
        vir alterado por decisoes que ninguem lembra de ter tomado.
        """
        return self._escrever(
            query="""
                DELETE FROM dbo.TB_PERMISSAO_USUARIO_AREA WHERE CPF_COLABORADOR = ?;
                DELETE FROM dbo.TB_PERMISSAO_USUARIO WHERE CPF_COLABORADOR = ?;
            """,
            parametros=(str(cpf), str(cpf)),
            return_rowcount=True,
        )

    def definir_ajuste(self, *, cpf, area, concedida, definido_por) -> None:
        self._escrever(
            query="""
                MERGE dbo.TB_PERMISSAO_USUARIO_AREA WITH (HOLDLOCK) AS destino
                USING (SELECT ? AS CPF, ? AS AREA) AS origem
                    ON destino.CPF_COLABORADOR = origem.CPF
                   AND destino.AREA = origem.AREA
                WHEN MATCHED THEN UPDATE SET
                    CONCEDIDA = ?, DEFINIDO_EM = SYSDATETIME(), DEFINIDO_POR = ?
                WHEN NOT MATCHED THEN INSERT
                    (CPF_COLABORADOR, AREA, CONCEDIDA, DEFINIDO_POR)
                    VALUES (origem.CPF, origem.AREA, ?, ?);
            """,
            parametros=(
                str(cpf), area,
                1 if concedida else 0, definido_por,
                1 if concedida else 0, definido_por,
            ),
        )

    def limpar_ajuste(self, *, cpf, area) -> int | None:
        """Volta a area a acompanhar o pacote da visao."""
        return self._escrever(
            query="""
                DELETE FROM dbo.TB_PERMISSAO_USUARIO_AREA
                WHERE CPF_COLABORADOR = ? AND AREA = ?
            """,
            parametros=(str(cpf), area),
            return_rowcount=True,
        )

    # ---------------------------------------------------------------- #

    def listar_concessoes(self, area=None) -> list[dict]:
        """Lista para a tela de acessos, inclusive as revogadas.

        A tela mostra o revogado porque "esta pessoa perdeu o acesso em tal
        data" e a pergunta que se faz quando alguem reclama que algo sumiu.
        """
        return self._consultar(
            query="""
                SELECT
                    ID_PERMISSAO, TIPO, VALOR, AREA, ATIVO,
                    CRIADO_EM, CRIADO_POR, REVOGADO_EM, REVOGADO_POR
                FROM dbo.TB_PERMISSAO_VISAO WITH (NOLOCK)
                WHERE (? IS NULL OR AREA = ?)
                ORDER BY AREA, ATIVO DESC, TIPO, VALOR
            """,
            parametros=(area, area),
        ) or []

    def conceder(self, *, tipo, valor, area, criado_por) -> dict | None:
        """Reativa a concessao revogada em vez de criar outra linha.

        O indice unico so cobre ATIVO = 1, entao inserir de novo funcionaria --
        e a tela ficaria com o mesmo par listado duas vezes, uma ativa e uma
        morta, sem nada que explique a diferenca.
        """
        return self._escrever(
            query="""
                UPDATE dbo.TB_PERMISSAO_VISAO
                SET ATIVO = 1,
                    CRIADO_EM = SYSDATETIME(),
                    CRIADO_POR = ?,
                    REVOGADO_EM = NULL,
                    REVOGADO_POR = NULL
                WHERE TIPO = ? AND VALOR = ? AND AREA = ? AND ATIVO = 0;

                IF NOT EXISTS (
                    SELECT 1 FROM dbo.TB_PERMISSAO_VISAO
                    WHERE TIPO = ? AND VALOR = ? AND AREA = ? AND ATIVO = 1
                )
                BEGIN
                    INSERT INTO dbo.TB_PERMISSAO_VISAO
                        (TIPO, VALOR, AREA, CRIADO_POR)
                    VALUES (?, ?, ?, ?);
                END;
            """,
            parametros=(
                criado_por,
                tipo, valor, area,
                tipo, valor, area,
                tipo, valor, area, criado_por,
            ),
        )

    def revogar(self, *, id_permissao, revogado_por) -> int | None:
        return self._escrever(
            query="""
                UPDATE dbo.TB_PERMISSAO_VISAO
                SET ATIVO = 0,
                    REVOGADO_EM = SYSDATETIME(),
                    REVOGADO_POR = ?
                WHERE ID_PERMISSAO = ? AND ATIVO = 1
            """,
            parametros=(revogado_por, id_permissao),
            return_rowcount=True,
        )

    def listar_valores_cadastrados(self, tipo) -> list[dict]:
        """Alimenta o autocomplete da tela de acessos.

        Permissao baseada em string erra por digitacao, e o erro e silencioso:
        a concessao fica gravada e nunca casa. Escolher de uma lista do proprio
        cadastro remove a classe inteira de erro.
        """
        coluna = {
            "FUNCAO": "FUNCAO_COLABORADOR",
            "CENTRO_CUSTO": "CENTRO_CUSTO",
        }.get(tipo)

        if coluna is None:
            return []

        return self._consultar(
            query=f"""
                SELECT DISTINCT LTRIM(RTRIM({coluna})) AS VALOR
                FROM [login].TB_USUARIOS WITH (NOLOCK)
                WHERE NULLIF(LTRIM(RTRIM({coluna})), '') IS NOT NULL
                  -- Sem este filtro o autocomplete oferecia cargos e centros
                  -- que so existem no cadastro de gente ja desligada.
                  AND ISNULL(USUARIO_ATIVO, 1) = 1
                ORDER BY VALOR
            """,
            parametros=(),
        ) or []

    def _consultar(self, *, query, parametros, one=False):
        transacao = self.db.begin_transaction()
        try:
            return transacao.execute_fetch(
                query=query,
                parametros=parametros,
                one=one,
            )
        finally:
            transacao.close()

    def _escrever(self, *, query, parametros, return_rowcount=False):
        transacao = self.db.begin_transaction()
        try:
            resultado = transacao.execute_commit(
                query=query,
                parametros=parametros,
                return_rowcount=return_rowcount,
            )
            transacao.commit()
            return resultado
        except Exception:
            transacao.rollback()
            raise
        finally:
            transacao.close()
