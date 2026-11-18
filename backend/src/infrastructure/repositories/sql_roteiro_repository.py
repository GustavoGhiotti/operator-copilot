from src.infrastructure.database.sql_server_connection import SQLServerConnection
from src.shared.utils.env_load import DB_HOST_66


class RoteiroRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66, "DB_COPILOT_ACME")
        self._tem_tabela_aba = None

    # ------------------------------------------------------------------ #
    # Vinculo aba -> fluxo
    #
    # Antes, cada aba do roteiro achava o proprio fluxo comparando o nome
    # cadastrado com uma string fixa no codigo. Bastava um acento diferente,
    # um espaco sobrando ou o nome em branco para a aba abrir vazia -- foi o
    # que aconteceu com Canais de Atendimento, cujo conteudo existia num fluxo
    # sem nome. Agora o vinculo e explicito e editavel pela tela.
    # ------------------------------------------------------------------ #

    def estrutura_aba_disponivel(self) -> bool:
        """A tabela de vinculo ja existe no ambiente?

        Enquanto o script nao roda, tudo continua funcionando pelo nome. Sem
        esta checagem, o ambiente que ainda nao migrou quebraria a cada
        chamada.
        """
        if self._tem_tabela_aba is None:
            linha = self.db.execute_fetch(
                query="""
                    SELECT CASE WHEN OBJECT_ID('Fluxograma_Vega.TB_ROTEIRO_ABA')
                                IS NULL THEN 0 ELSE 1 END AS disponivel
                """,
                parametros=(),
                one=True,
            )
            self._tem_tabela_aba = bool(linha and linha.get("disponivel"))
        return self._tem_tabela_aba

    def listar_abas(self):
        if not self.estrutura_aba_disponivel():
            return []

        query = """
            SELECT ABA, CONVERT(VARCHAR(36), ID_FLUXO) AS ID_FLUXO,
                   ATUALIZADO_EM, ATUALIZADO_POR
            FROM [Fluxograma_Vega].[TB_ROTEIRO_ABA] WITH (NOLOCK)
        """
        return self.db.execute_fetch(query=query, parametros=(), one=False) or []

    def definir_aba(self, aba, id_fluxo, atualizado_por):
        """Uma linha por aba: revincular sobrescreve, nao acumula."""
        query = """
            MERGE [Fluxograma_Vega].[TB_ROTEIRO_ABA] WITH (HOLDLOCK) AS destino
            USING (SELECT ? AS ABA) AS origem
                ON destino.ABA = origem.ABA
            WHEN MATCHED THEN UPDATE SET
                ID_FLUXO = ?,
                ATUALIZADO_EM = SYSDATETIME(),
                ATUALIZADO_POR = ?
            WHEN NOT MATCHED THEN INSERT
                (ABA, ID_FLUXO, ATUALIZADO_EM, ATUALIZADO_POR)
                VALUES (origem.ABA, ?, SYSDATETIME(), ?);
        """
        return self.db.execute_commit(
            query=query,
            parametros=(aba, id_fluxo, atualizado_por, id_fluxo, atualizado_por),
        )

    def listar_tipos_ligacao(self):
        query = """
            SELECT DISTINCT
                LTRIM(RTRIM(TIPO_LIGACAO)) AS tipo_ligacao
            FROM [Fluxograma_Vega].[TB_FLUXO]
            WHERE NULLIF(LTRIM(RTRIM(TIPO_LIGACAO)), '') IS NOT NULL
            ORDER BY LTRIM(RTRIM(TIPO_LIGACAO))
        """
        return self.db.execute_fetch(query=query, parametros=(), one=False)

    def listar_produtos(self):
        query = """
            SELECT DISTINCT
                LTRIM(RTRIM(PRODUTO)) AS produto
            FROM [Fluxograma_Vega].[TB_FLUXO]
            WHERE NULLIF(LTRIM(RTRIM(PRODUTO)), '') IS NOT NULL
            ORDER BY LTRIM(RTRIM(PRODUTO))
        """
        return self.db.execute_fetch(query=query, parametros=(), one=False)

    def listar_tipos_cliente(self):
        query = """
            SELECT DISTINCT
                LTRIM(RTRIM(TIPO_CLIENTE)) AS tipo_cliente
            FROM [Fluxograma_Vega].[TB_FLUXO]
            WHERE NULLIF(LTRIM(RTRIM(TIPO_CLIENTE)), '') IS NOT NULL
            ORDER BY LTRIM(RTRIM(TIPO_CLIENTE))
        """
        return self.db.execute_fetch(query=query, parametros=(), one=False)

    def listar_fluxos(self, tipo_ligacao=None, produto=None, tipo_cliente=None):
        filtros = []
        parametros = []

        if tipo_ligacao:
            filtros.append("F.TIPO_LIGACAO = ?")
            parametros.append(tipo_ligacao)

        if produto:
            filtros.append("F.PRODUTO = ?")
            parametros.append(produto)

        if tipo_cliente:
            filtros.append("F.TIPO_CLIENTE = ?")
            parametros.append(tipo_cliente)

        where_filtros = ""
        if filtros:
            where_filtros = " AND " + " AND ".join(filtros)

        query = f"""
            SELECT
                F.ID_FLUXO,
                LTRIM(RTRIM(F.TIPO_LIGACAO)) AS TIPO_LIGACAO,
                LTRIM(RTRIM(F.TIPO_CLIENTE)) AS TIPO_CLIENTE,
                LTRIM(RTRIM(F.PRODUTO)) AS PRODUTO
            FROM [Fluxograma_Vega].[TB_FLUXO] F
            WHERE NULLIF(LTRIM(RTRIM(F.ID_FLUXO)), '') IS NOT NULL
              {where_filtros}
            ORDER BY
                LTRIM(RTRIM(F.PRODUTO)),
                LTRIM(RTRIM(F.TIPO_CLIENTE)),
                LTRIM(RTRIM(F.TIPO_LIGACAO))
        """
        return self.db.execute_fetch(
            query=query,
            parametros=tuple(parametros),
            one=False,
        )

    def buscar_fluxo(self, tipo_ligacao, produto, tipo_cliente):
        query = """
            SELECT
                F.ID_FLUXO,
                M.ID_MENSAGEM,
                M.TITULO,
                M.TIPO_MENSAGEM,
                M.ORDEM_EXIBICAO,
                M.MENSAGEM,
                O.ID_OPCAO,
                O.TEXTO_OPCAO,
                O.PROXIMA_MENSAGEM_ID,
                O.ACAO_ESPECIAL,
                O.ORDEM_OPCAO
            FROM [Fluxograma_Vega].[TB_FLUXO] f
            JOIN [Fluxograma_Vega].[TB_MENSAGEM] m
                ON F.ID_FLUXO = M.ID_FLUXO
            LEFT JOIN [Fluxograma_Vega].[TB_OPCAO] o
                ON M.ID_MENSAGEM = O.ID_MENSAGEM
            WHERE F.TIPO_LIGACAO = ?
              AND F.TIPO_CLIENTE = ?
              AND F.PRODUTO = ?
            ORDER BY M.ORDEM_EXIBICAO, O.ORDEM_OPCAO
        """
        return self.db.execute_fetch(
            query=query,
            parametros=(tipo_ligacao, tipo_cliente, produto),
            one=False,
        )

    def buscar_fluxo_por_id(self, id_fluxo):
        query = """
            SELECT
                F.ID_FLUXO,
                F.TIPO_LIGACAO,
                F.TIPO_CLIENTE,
                F.PRODUTO,
                M.ID_MENSAGEM,
                M.TITULO,
                M.TIPO_MENSAGEM,
                M.ORDEM_EXIBICAO,
                M.MENSAGEM,
                O.ID_OPCAO,
                O.TEXTO_OPCAO,
                O.PROXIMA_MENSAGEM_ID,
                O.ACAO_ESPECIAL,
                O.ORDEM_OPCAO
            FROM [Fluxograma_Vega].[TB_FLUXO] f
            JOIN [Fluxograma_Vega].[TB_MENSAGEM] m
                ON F.ID_FLUXO = M.ID_FLUXO
            LEFT JOIN [Fluxograma_Vega].[TB_OPCAO] o
                ON M.ID_MENSAGEM = O.ID_MENSAGEM
            WHERE F.ID_FLUXO = ?
            ORDER BY M.ORDEM_EXIBICAO, O.ORDEM_OPCAO
        """
        return self.db.execute_fetch(
            query=query,
            parametros=(id_fluxo,),
            one=False,
        )

    def buscar_mensagem(self, id_mensagem):
        query = """
            SELECT
                ID_MENSAGEM,
                ID_FLUXO,
                TITULO,
                TIPO_MENSAGEM,
                ORDEM_EXIBICAO,
                MENSAGEM
            FROM [Fluxograma_Vega].[TB_MENSAGEM]
            WHERE ID_MENSAGEM = ?
        """
        return self.db.execute_fetch(query=query, parametros=(id_mensagem,), one=True)

    def listar_opcoes_mensagem(self, id_mensagem):
        query = """
            SELECT
                ID_OPCAO,
                TEXTO_OPCAO,
                PROXIMA_MENSAGEM_ID,
                ORDEM_OPCAO
            FROM [Fluxograma_Vega].[TB_OPCAO]
            WHERE ID_MENSAGEM = ?
            ORDER BY ORDEM_OPCAO ASC
        """
        return self.db.execute_fetch(query=query, parametros=(id_mensagem,), one=False)

    def atualizar_mensagem(self, titulo, mensagem, id_mensagem):
        query = """
            UPDATE [Fluxograma_Vega].[TB_MENSAGEM]
            SET TITULO = ?, MENSAGEM = ?
            WHERE ID_MENSAGEM = ?
        """
        return self.db.execute_commit(
            query=query,
            parametros=(titulo, mensagem, id_mensagem),
        )

    def atualizar_opcao(self, texto_opcao, proxima_mensagem_id, ordem_opcao, id_opcao):
        query = """
            UPDATE [Fluxograma_Vega].[TB_OPCAO]
            SET TEXTO_OPCAO = ?, PROXIMA_MENSAGEM_ID = ?, ORDEM_OPCAO = ?
            WHERE ID_OPCAO = ?
        """
        return self.db.execute_commit(
            query=query,
            parametros=(texto_opcao, proxima_mensagem_id, ordem_opcao, id_opcao),
        )

    def criar_opcao(
        self,
        id_opcao,
        texto_opcao,
        proxima_mensagem_id,
        id_mensagem,
        ordem_opcao,
    ):
        query = """
            INSERT INTO [Fluxograma_Vega].[TB_OPCAO]
                (ID_OPCAO, TEXTO_OPCAO, PROXIMA_MENSAGEM_ID, ID_MENSAGEM, ORDEM_OPCAO)
            VALUES (?, ?, ?, ?, ?)
        """
        return self.db.execute_commit(
            query=query,
            parametros=(
                id_opcao,
                texto_opcao,
                proxima_mensagem_id,
                id_mensagem,
                ordem_opcao,
            ),
        )

    def criar_mensagem(self, id_mensagem, id_fluxo, ordem_exibicao, titulo, mensagem):
        query = """
            INSERT INTO [Fluxograma_Vega].[TB_MENSAGEM]
                (ID_MENSAGEM, ID_FLUXO, ORDEM_EXIBICAO, TITULO, MENSAGEM)
            VALUES (?, ?, ?, ?, ?)
        """
        return self.db.execute_commit(
            query=query,
            parametros=(id_mensagem, id_fluxo, ordem_exibicao, titulo, mensagem),
        )

    def buscar_ultima_ordem_fluxo(self, id_fluxo):
        query = """
            SELECT MAX(ORDEM_EXIBICAO) AS ULTIMA_ORDEM
            FROM [Fluxograma_Vega].[TB_MENSAGEM]
            WHERE ID_FLUXO = ?
        """
        return self.db.execute_fetch(query=query, parametros=(id_fluxo,), one=True)

    def deletar_opcao(self, id_opcao):
        query = """
            DELETE FROM [Fluxograma_Vega].[TB_OPCAO]
            WHERE ID_OPCAO = ?
        """
        return self.db.execute_commit(
            query=query,
            parametros=(id_opcao,),
            return_rowcount=True,
        )

    def atualizar_fluxo(self, tipo_ligacao, tipo_cliente, produto, id_fluxo):
        query = """
            UPDATE [Fluxograma_Vega].[TB_FLUXO]
            SET TIPO_LIGACAO = ?, TIPO_CLIENTE = ?, PRODUTO = ?
            WHERE ID_FLUXO = ?
        """
        return self.db.execute_commit(
            query=query,
            parametros=(tipo_ligacao, tipo_cliente, produto, id_fluxo),
            return_rowcount=True,
        )

    def fluxo_existe(self, id_fluxo):
        query = """
            SELECT 1 AS existe
            FROM [Fluxograma_Vega].[TB_FLUXO]
            WHERE ID_FLUXO = ?
        """
        return self.db.execute_fetch(query=query, parametros=(id_fluxo,), one=True)

    def soltar_referencias_para_mensagem(self, id_mensagem):
        """Zera os `proxima_mensagem_id` que apontam para esta mensagem.

        TB_OPCAO referencia TB_MENSAGEM por dois caminhos: a mensagem dona da
        opcao e o destino dela. O SQL Server nao aceita ON DELETE nos dois --
        seriam "multiple cascade paths" --, entao o destino nao tem FK e a
        limpeza acontece aqui. Sem isto, apagar uma mensagem do meio do fluxo
        deixaria botoes apontando para o vazio.
        """
        query = """
            UPDATE [Fluxograma_Vega].[TB_OPCAO]
            SET PROXIMA_MENSAGEM_ID = NULL
            WHERE PROXIMA_MENSAGEM_ID = ?
        """
        return self.db.execute_commit(
            query=query,
            parametros=(id_mensagem,),
            return_rowcount=True,
        )

    def deletar_mensagem(self, id_mensagem):
        """As opcoes da mensagem saem junto pela FK com ON DELETE CASCADE."""
        query = """
            DELETE FROM [Fluxograma_Vega].[TB_MENSAGEM]
            WHERE ID_MENSAGEM = ?
        """
        return self.db.execute_commit(
            query=query,
            parametros=(id_mensagem,),
            return_rowcount=True,
        )

    def deletar_fluxo(self, id_fluxo):
        query = """
            DELETE FROM [Fluxograma_Vega].[TB_FLUXO]
            WHERE ID_FLUXO = ?
        """
        return self.db.execute_commit(
            query=query,
            parametros=(id_fluxo,),
            return_rowcount=True,
        )

    def criar_fluxo(self, id_fluxo, tipo_ligacao, tipo_cliente, produto):
        query = """
            INSERT INTO [Fluxograma_Vega].[TB_FLUXO]
                (ID_FLUXO, TIPO_LIGACAO, TIPO_CLIENTE, PRODUTO)
            VALUES (?, ?, ?, ?)
        """
        return self.db.execute_commit(
            query=query,
            parametros=(id_fluxo, tipo_ligacao, tipo_cliente, produto),
        )


roteirorepository = RoteiroRepository
