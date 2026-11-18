from src.infrastructure.database.sql_server_connection import SQLServerConnection
from src.shared.utils.env_load import DB_HOST_66


# Ordenacoes aceitas pelo ranking. Lista fechada porque a coluna entra no
# ORDER BY: parametro nao serve para nome de coluna, e concatenar o que veio da
# query string seria injecao.
ORDENACOES = {
    "RECUPERADO": "A.VL_RECUPERADO",
    "FECHADO": "A.VL_FECHADO",
    "ACORDOS": "A.QT_ACORDOS",
    "CPC": "A.QT_CPC",
    "ATINGIMENTO": "CASE WHEN A.VL_META > 0 THEN A.VL_RECUPERADO / A.VL_META END",
    "NOME": "A.NM_OPERADOR",
}

_ORDEM_ASCENDENTE = {"NOME"}


class GestaoResultadoRepository:
    """Leitura do snapshot de gestao.

    Todas as consultas leem TB_GESTAO_OPERADOR_DIA -- nenhuma toca
    INFORMACAO_PAGAMENTOS, TB_PARCELAS ou TB_TABULACOES_HOJE_66. E o que tira a
    tela do caminho dos 18 GB de tabulacoes, onde um unico SELECT por data
    media 130 segundos.

    A excecao e `listar_presenca`, que consulta login.TB_USUARIOS ao vivo: quem
    esta online agora e atributo instantaneo, nao medida de um dia.

    `_conexao` existe para o servico rodar as seis consultas numa unica conexao.
    SQLServerConnection nao tem pool e abre um handshake por chamada -- o painel
    antigo gasta quatro so para montar uma tela.
    """

    def __init__(self, transacao=None):
        self.db = SQLServerConnection(DB_HOST_66, "DB_COPILOT_ACME")
        self._transacao = transacao

    # ------------------------------------------------------------------ #

    def estrutura_disponivel(self) -> bool:
        linha = self._consultar(
            query="""
                SELECT CASE WHEN OBJECT_ID('dbo.TB_GESTAO_OPERADOR_DIA', 'U') IS NULL
                            THEN 0 ELSE 1 END AS disponivel
            """,
            parametros=(),
            one=True,
        )
        return bool(linha and linha.get("disponivel"))

    def obter_frescor(self) -> dict | None:
        """Quando o dado foi calculado de verdade.

        Substitui o datetime.now() de gerente_service.py, que carimba a tela com
        o segundo atual e faz um numero de 40 minutos atras parecer de agora.
        """
        return self._consultar(
            query="""
                SELECT TOP 1 DT_FIM, TIPO_CARGA, DT_JANELA_INICIO, DT_JANELA_FIM
                FROM dbo.TB_GESTAO_SNAPSHOT_EXECUCAO WITH (NOLOCK)
                WHERE STATUS = 'CONCLUIDA'
                ORDER BY DT_FIM DESC
            """,
            parametros=(),
            one=True,
        )

    def obter_resumo(self, *, data_inicio, data_fim, id_carteira=None) -> dict:
        return self._consultar(
            query="""
                SELECT
                    SUM(F.QT_ACORDOS) AS QT_ACORDOS,
                    SUM(F.VL_FECHADO) AS VL_FECHADO,
                    SUM(F.VL_RECUPERADO) AS VL_RECUPERADO,
                    SUM(F.VL_META_DIA) AS VL_META,
                    SUM(ISNULL(F.QT_CPC, 0)) AS QT_CPC,
                    COUNT(DISTINCT CASE WHEN F.IS_OPERADOR = 1
                          THEN F.CHAVE_OPERADOR END) AS QT_OPERADORES,
                    COUNT(DISTINCT CASE WHEN F.DIA_TRABALHADO = 1
                          THEN F.CHAVE_OPERADOR END) AS QT_OPERADORES_ATIVOS,
                    -- Producao que nao casou com o cadastro. Fica visivel de
                    -- proposito: hoje ela entra no total das carteiras e some
                    -- da lista de operadores, sem ninguem notar a diferenca.
                    SUM(CASE WHEN F.CPF_COLABORADOR IS NULL
                             THEN F.VL_RECUPERADO ELSE 0 END) AS VL_NAO_ATRIBUIDO,
                    MAX(CAST(F.TEM_VEGA AS INT)) AS TEM_VEGA
                FROM dbo.TB_GESTAO_OPERADOR_DIA F WITH (NOLOCK)
                WHERE F.DATA >= ? AND F.DATA <= ?
                  AND (? IS NULL OR F.ID_CARTEIRA = ?)
                OPTION (RECOMPILE)
            """,
            parametros=(data_inicio, data_fim, id_carteira, id_carteira),
            one=True,
        ) or {}

    def listar_ranking_operadores(
        self,
        *,
        data_inicio,
        data_fim,
        id_carteira=None,
        supervisor=None,
        busca=None,
        ordenar_por="RECUPERADO",
        offset=0,
        limite=50,
    ) -> list[dict]:
        coluna = ORDENACOES.get(str(ordenar_por or "").upper(), ORDENACOES["RECUPERADO"])
        direcao = "ASC" if str(ordenar_por or "").upper() in _ORDEM_ASCENDENTE else "DESC"

        # COUNT(*) OVER () devolve o total junto com a pagina e evita a segunda
        # ida ao banco so para paginar.
        query = f"""
            ;WITH AGG AS (
                SELECT
                    F.CHAVE_OPERADOR,
                    MAX(F.CPF_COLABORADOR) AS CPF_COLABORADOR,
                    MAX(F.NM_OPERADOR) AS NM_OPERADOR,
                    MAX(F.NM_SUPERVISOR) AS NM_SUPERVISOR,
                    SUM(F.QT_ACORDOS) AS QT_ACORDOS,
                    SUM(F.VL_FECHADO) AS VL_FECHADO,
                    SUM(F.VL_RECUPERADO) AS VL_RECUPERADO,
                    SUM(F.VL_META_DIA) AS VL_META,
                    SUM(ISNULL(F.QT_CPC, 0)) AS QT_CPC,
                    SUM(CASE WHEN F.DIA_TRABALHADO = 1 THEN 1 ELSE 0 END) AS QT_DIAS,
                    MAX(F.VL_NOTA_QUALIDADE) AS VL_NOTA_QUALIDADE
                FROM dbo.TB_GESTAO_OPERADOR_DIA F WITH (NOLOCK)
                WHERE F.DATA >= ? AND F.DATA <= ?
                  AND F.IS_OPERADOR = 1
                  AND (? IS NULL OR F.ID_CARTEIRA = ?)
                  AND (? IS NULL OR F.NM_SUPERVISOR = ?)
                  AND (? IS NULL OR F.NM_OPERADOR LIKE '%' + ? + '%')
                GROUP BY F.CHAVE_OPERADOR
            )
            SELECT
                A.*,
                -- A carteira exibida e a de maior resultado no periodo, nao a
                -- do cadastro de hoje: o ranking fala do que a pessoa fez.
                CP.NM_CARTEIRA,
                CASE WHEN A.VL_META > 0 THEN A.VL_RECUPERADO / A.VL_META END AS ATINGIMENTO,
                COUNT(*) OVER () AS QT_TOTAL,
                ROW_NUMBER() OVER (ORDER BY A.VL_RECUPERADO DESC) AS POSICAO
            FROM AGG A
            OUTER APPLY (
                SELECT TOP 1 C.NM_CARTEIRA
                FROM dbo.TB_GESTAO_OPERADOR_DIA F2 WITH (NOLOCK)
                JOIN dbo.TB_GESTAO_CARTEIRA C WITH (NOLOCK) ON C.ID_CARTEIRA = F2.ID_CARTEIRA
                WHERE F2.CHAVE_OPERADOR = A.CHAVE_OPERADOR
                  AND F2.DATA >= ? AND F2.DATA <= ?
                ORDER BY F2.VL_FECHADO DESC, F2.ID_CARTEIRA
            ) CP
            ORDER BY {coluna} {direcao}, A.NM_OPERADOR ASC
            OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
            OPTION (RECOMPILE)
        """

        return self._consultar(
            query=query,
            parametros=(
                data_inicio, data_fim,
                id_carteira, id_carteira,
                supervisor, supervisor,
                busca, busca,
                data_inicio, data_fim,
                int(offset), int(limite),
            ),
        ) or []

    def listar_carteiras(self, *, data_inicio, data_fim) -> list[dict]:
        """Substitui listar_resumo_carteiras_mes e listar_top_carteiras_historico.

        As duas juntas faziam tres varreduras de seis meses; aqui e um GROUP BY
        sobre o snapshot, e o "top N" vira OFFSET/FETCH na tela.
        """
        return self._consultar(
            query="""
                SELECT
                    F.ID_CARTEIRA,
                    C.NM_CARTEIRA,
                    C.SLUG_CARTEIRA,
                    SUM(F.QT_ACORDOS) AS QT_ACORDOS,
                    SUM(F.VL_FECHADO) AS VL_FECHADO,
                    SUM(F.VL_RECUPERADO) AS VL_RECUPERADO,
                    SUM(F.VL_META_DIA) AS VL_META,
                    SUM(ISNULL(F.QT_CPC, 0)) AS QT_CPC,
                    COUNT(DISTINCT CASE WHEN F.IS_OPERADOR = 1
                          THEN F.CHAVE_OPERADOR END) AS QT_OPERADORES
                FROM dbo.TB_GESTAO_OPERADOR_DIA F WITH (NOLOCK)
                LEFT JOIN dbo.TB_GESTAO_CARTEIRA C WITH (NOLOCK)
                    ON C.ID_CARTEIRA = F.ID_CARTEIRA
                WHERE F.DATA >= ? AND F.DATA <= ?
                GROUP BY F.ID_CARTEIRA, C.NM_CARTEIRA, C.SLUG_CARTEIRA
                ORDER BY SUM(F.VL_RECUPERADO) DESC, SUM(F.VL_FECHADO) DESC
                OPTION (RECOMPILE)
            """,
            parametros=(data_inicio, data_fim),
        ) or []

    def listar_serie_mensal(self, *, data_inicio, data_fim, id_carteira=None) -> list[dict]:
        """Serie historica.

        TEM_VEGA marca ate onde o recuperado existe: TB_PARCELAS guarda 16
        meses de fechamento, mas o vega so existe enquanto
        INFORMACAO_PAGAMENTOS segurar (~3 meses). Sem essa marca a linha de
        recuperado cai a zero no passado e parece colapso da operacao.
        """
        return self._consultar(
            query="""
                SELECT
                    CONVERT(char(7), F.DATA, 120) AS MES_CHAVE,
                    SUM(F.QT_ACORDOS) AS QT_ACORDOS,
                    SUM(F.VL_FECHADO) AS VL_FECHADO,
                    SUM(F.VL_RECUPERADO) AS VL_RECUPERADO,
                    MAX(CAST(F.TEM_VEGA AS INT)) AS TEM_VEGA
                FROM dbo.TB_GESTAO_OPERADOR_DIA F WITH (NOLOCK)
                WHERE F.DATA >= ? AND F.DATA <= ?
                  AND (? IS NULL OR F.ID_CARTEIRA = ?)
                GROUP BY CONVERT(char(7), F.DATA, 120)
                ORDER BY MES_CHAVE
                OPTION (RECOMPILE)
            """,
            parametros=(data_inicio, data_fim, id_carteira, id_carteira),
        ) or []

    def obter_ficha_operador(self, *, chave_operador, data_inicio, data_fim) -> dict:
        agregado = self._consultar(
            query="""
                SELECT
                    MAX(F.NM_OPERADOR) AS NM_OPERADOR,
                    MAX(F.NM_SUPERVISOR) AS NM_SUPERVISOR,
                    MAX(F.NM_FUNCAO) AS NM_FUNCAO,
                    MAX(F.CPF_COLABORADOR) AS CPF_COLABORADOR,
                    SUM(F.QT_ACORDOS) AS QT_ACORDOS,
                    SUM(F.VL_FECHADO) AS VL_FECHADO,
                    SUM(F.VL_RECUPERADO) AS VL_RECUPERADO,
                    SUM(F.VL_META_DIA) AS VL_META,
                    SUM(ISNULL(F.QT_CPC, 0)) AS QT_CPC,
                    SUM(CASE WHEN F.DIA_TRABALHADO = 1 THEN 1 ELSE 0 END) AS QT_DIAS,
                    SUM(F.QT_MONITORIAS) AS QT_MONITORIAS,
                    AVG(F.VL_NOTA_QUALIDADE) AS VL_NOTA_QUALIDADE
                FROM dbo.TB_GESTAO_OPERADOR_DIA F WITH (NOLOCK)
                WHERE F.CHAVE_OPERADOR = ? AND F.DATA >= ? AND F.DATA <= ?
            """,
            parametros=(chave_operador, data_inicio, data_fim),
            one=True,
        ) or {}

        serie = self._consultar(
            query="""
                SELECT
                    F.DATA,
                    SUM(F.QT_ACORDOS) AS QT_ACORDOS,
                    SUM(F.VL_FECHADO) AS VL_FECHADO,
                    SUM(F.VL_RECUPERADO) AS VL_RECUPERADO,
                    SUM(F.VL_META_DIA) AS VL_META,
                    SUM(ISNULL(F.QT_CPC, 0)) AS QT_CPC,
                    MAX(CAST(F.DIA_TRABALHADO AS INT)) AS DIA_TRABALHADO
                FROM dbo.TB_GESTAO_OPERADOR_DIA F WITH (NOLOCK)
                WHERE F.CHAVE_OPERADOR = ? AND F.DATA >= ? AND F.DATA <= ?
                GROUP BY F.DATA
                ORDER BY F.DATA
            """,
            parametros=(chave_operador, data_inicio, data_fim),
        ) or []

        carteiras = self._consultar(
            query="""
                SELECT
                    C.NM_CARTEIRA,
                    SUM(F.VL_FECHADO) AS VL_FECHADO,
                    SUM(F.VL_RECUPERADO) AS VL_RECUPERADO
                FROM dbo.TB_GESTAO_OPERADOR_DIA F WITH (NOLOCK)
                LEFT JOIN dbo.TB_GESTAO_CARTEIRA C WITH (NOLOCK)
                    ON C.ID_CARTEIRA = F.ID_CARTEIRA
                WHERE F.CHAVE_OPERADOR = ? AND F.DATA >= ? AND F.DATA <= ?
                GROUP BY C.NM_CARTEIRA
                ORDER BY SUM(F.VL_FECHADO) DESC
            """,
            parametros=(chave_operador, data_inicio, data_fim),
        ) or []

        return {"agregado": agregado, "serie": serie, "carteiras": carteiras}

    def listar_presenca(self) -> list[dict]:
        """Unica consulta ao vivo da tela.

        A regra de "online" mora no servico e nao aqui: IS_LOGADO vira 1 no
        login e so volta a 0 no logout explicito, entao quem fecha o navegador
        fica online para sempre. Devolver os dois campos crus deixa o servico
        aplicar a janela de inatividade sem migracao.
        """
        return self._consultar(
            query="""
                SELECT
                    U.CPF_COLABORADOR,
                    ISNULL(U.IS_LOGADO, 0) AS IS_LOGADO,
                    U.DT_ULTIMO_ACESSO
                FROM login.TB_USUARIOS U WITH (NOLOCK)
                WHERE U.IS_LOGADO = 1
            """,
            parametros=(),
        ) or []

    def listar_filtros(self) -> dict:
        carteiras = self._consultar(
            query="""
                SELECT ID_CARTEIRA, NM_CARTEIRA, SLUG_CARTEIRA
                FROM dbo.TB_GESTAO_CARTEIRA WITH (NOLOCK)
                WHERE ATIVO = 1
                ORDER BY ORDEM_EXIBICAO, NM_CARTEIRA
            """,
            parametros=(),
        ) or []

        supervisores = self._consultar(
            query="""
                SELECT DISTINCT F.NM_SUPERVISOR
                FROM dbo.TB_GESTAO_OPERADOR_DIA F WITH (NOLOCK)
                WHERE F.DATA >= DATEADD(MONTH, -3, CAST(GETDATE() AS DATE))
                  AND NULLIF(LTRIM(RTRIM(F.NM_SUPERVISOR)), '') IS NOT NULL
                ORDER BY F.NM_SUPERVISOR
            """,
            parametros=(),
        ) or []

        return {"carteiras": carteiras, "supervisores": supervisores}

    def contar_cobertura_meta(self, *, data_inicio, data_fim) -> dict:
        """Quantos operadores tem meta cadastrada.

        Medido antes de escrever a tela: 116 de 1.260 colaboradores. A tela
        mostra esse numero em vez de exibir 0% de atingimento para o resto, o
        que culparia o operador por uma lacuna de cadastro.
        """
        return self._consultar(
            query="""
                SELECT
                    COUNT(DISTINCT F.CHAVE_OPERADOR) AS QT_OPERADORES,
                    COUNT(DISTINCT CASE WHEN F.VL_META_DIA > 0
                          THEN F.CHAVE_OPERADOR END) AS QT_COM_META
                FROM dbo.TB_GESTAO_OPERADOR_DIA F WITH (NOLOCK)
                WHERE F.DATA >= ? AND F.DATA <= ? AND F.IS_OPERADOR = 1
            """,
            parametros=(data_inicio, data_fim),
            one=True,
        ) or {}

    # ------------------------------------------------------------------ #

    def _consultar(self, *, query, parametros, one=False):
        if self._transacao is not None:
            return self._transacao.execute_fetch(
                query=query, parametros=parametros, one=one
            )

        transacao = self.db.begin_transaction()
        try:
            return transacao.execute_fetch(query=query, parametros=parametros, one=one)
        finally:
            transacao.close()
