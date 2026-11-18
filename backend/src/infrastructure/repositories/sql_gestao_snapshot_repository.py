from src.infrastructure.database.sql_server_connection import SQLServerConnection
from src.shared.utils.env_load import DB_HOST_66


# A carga inteira num MERGE set-based: origem e a propria consulta agregada,
# nenhuma linha trafega ate o Python. O resto do projeto usa MERGE de uma linha
# (sql_copilot_tour_repository.py), forma que aqui multiplicaria round-trips por
# dezenas de milhares.
#
# Notas que nao sao estilo:
#
# - WITH (HOLDLOCK) no alvo elimina a race de insert-insert conhecida do MERGE.
# - WHEN NOT MATCHED BY SOURCE precisa repetir o predicado da janela. Sem ele o
#   comando apaga TODO o historico fora da janela. E a linha mais perigosa do
#   arquivo.
# - EXCEPT no WHEN MATCHED evita reescrever linha identica. Com execucao a cada
#   15 min, e a diferenca entre atualizar dezenas e reescrever milhares.
# - O roster e deduplicado por nome: o cadastro tem 3.102 CPFs para 3.094 nomes,
#   e sem o ROW_NUMBER o join da producao por nome multiplicaria a producao
#   dessas 8 pessoas.
_MERGE_SNAPSHOT = """
-- SET NOCOUNT ON e obrigatorio, nao cosmetico: sem ele cada comando do lote
-- devolve um "resultado" de contagem de linhas, o pyodbc para no primeiro deles
-- e o fetchone() do SELECT final estoura com "Previous SQL was not a query" --
-- depois de o MERGE ja ter rodado inteiro.
SET NOCOUNT ON;

DECLARE @DataIni DATE = ?;
DECLARE @DataFim DATE = ?;
DECLARE @IdExecucao BIGINT = ?;

-- Alcance real do vega. INFORMACAO_PAGAMENTOS e janela rolante: fora dela nao
-- da para saber se nao entrou dinheiro ou se o dado ja foi descartado.
DECLARE @VegaDe DATE, @VegaAte DATE;
SELECT @VegaDe = MIN(DATA_PAGO), @VegaAte = MAX(DATA_PAGO)
FROM dbo.INFORMACAO_PAGAMENTOS WITH (NOLOCK) WHERE DATA_PAGO IS NOT NULL;

DECLARE @Acoes TABLE (ACAO NVARCHAR(10));

;WITH ALIAS_PROD AS (
    SELECT TEXTO_CHAVE, ID_CARTEIRA
    FROM dbo.TB_GESTAO_CARTEIRA_ALIAS WITH (NOLOCK) WHERE TIPO_ORIGEM = 'PRODUCAO'
),
ALIAS_CAD AS (
    SELECT TEXTO_CHAVE, ID_CARTEIRA
    FROM dbo.TB_GESTAO_CARTEIRA_ALIAS WITH (NOLOCK) WHERE TIPO_ORIGEM = 'CADASTRO'
),
ROSTER_BRUTO AS (
    SELECT
        U.CPF_COLABORADOR,
        LTRIM(RTRIM(U.NM_COLABORADOR)) AS NM_COLABORADOR,
        UPPER(LTRIM(RTRIM(U.NM_COLABORADOR))) AS NM_CHAVE,
        ISNULL(LTRIM(RTRIM(U.SUPERVISOR)), '') AS NM_SUPERVISOR,
        ISNULL(LTRIM(RTRIM(U.FUNCAO_COLABORADOR)), '') AS NM_FUNCAO,
        ISNULL(AC.ID_CARTEIRA, 0) AS ID_CARTEIRA_CADASTRO,
        CASE WHEN LOWER(ISNULL(U.FUNCAO_COLABORADOR, '')) LIKE '%gerente%'
               OR LOWER(ISNULL(U.FUNCAO_COLABORADOR, '')) LIKE '%supervisor%'
               OR LOWER(ISNULL(U.FUNCAO_COLABORADOR, '')) LIKE '%coordenador%'
               OR LOWER(ISNULL(U.FUNCAO_COLABORADOR, '')) LIKE '%monitor%'
               OR LOWER(ISNULL(U.FUNCAO_COLABORADOR, '')) LIKE '%assistente%'
               OR LOWER(ISNULL(U.FUNCAO_COLABORADOR, '')) LIKE '%instrutor%'
               OR LOWER(ISNULL(U.FUNCAO_COLABORADOR, '')) LIKE '%auxiliar administrativo%'
             THEN 0 ELSE 1 END AS IS_OPERADOR,
        ROW_NUMBER() OVER (
            PARTITION BY UPPER(LTRIM(RTRIM(U.NM_COLABORADOR)))
            ORDER BY U.DT_ULTIMO_ACESSO DESC, U.CPF_COLABORADOR
        ) AS RN
    FROM login.TB_USUARIOS U WITH (NOLOCK)
    -- O COLLATE explicito e obrigatorio: a origem e CI_AS (acento-sensivel) e
    -- TEXTO_CHAVE e CI_AI de proposito, para 'DELTA' casar com 'MERCANTÍL'.
    -- Sem ele o SQL Server recusa a comparacao em vez de escolher um lado.
    LEFT JOIN ALIAS_CAD AC
        ON AC.TEXTO_CHAVE = UPPER(LTRIM(RTRIM(ISNULL(U.CENTRO_CUSTO, ''))))
                            COLLATE Latin1_General_CI_AI
),
ROSTER AS (SELECT * FROM ROSTER_BRUTO WHERE RN = 1),

-- Fechamento vem de TB_PARCELAS: 16 meses. INFORMACAO_PAGAMENTOS guarda ~2 e
-- serve so ao vega.
FECHAMENTO AS (
    SELECT
        P.DATA AS DIA,
        UPPER(LTRIM(RTRIM(P.NM_USUARIO))) AS NM_CHAVE,
        ISNULL(AP.ID_CARTEIRA, 0) AS ID_CARTEIRA,
        COUNT(*) AS QT_ACORDOS,
        SUM(CASE WHEN P.DT_CANCELAMENTO IS NOT NULL THEN 1 ELSE 0 END) AS QT_CANCELADOS,
        SUM(ISNULL(P.VL_ENTRADA, 0)) AS VL_ENTRADA,
        SUM(ISNULL(P.VL_RISCO, 0)) AS VL_RISCO,
        -- A regua de valor e por CEDENTE, nao por nome de carteira. Espelha
        -- sql_arena_repository.py:764: nos cedentes 3, 60, 71 e 77 (Mu,
        -- Pi, Zeta e TETA Acme) o resultado e medido pelo risco, e nos
        -- demais pela entrada.
        --
        -- Aplicar por cedente e nao pela dimensao de carteira importa por dois
        -- motivos: uma carteira nova do mesmo cedente herda a regra sozinha
        -- (UPSILONS_UHC e cedente 3), e o agrupamento por cliente que a
        -- dimensao faz nao consegue separar TETA Acme dos outros TETA.
        SUM(CASE WHEN P.ID_CEDENTE IN (3, 60, 71, 77)
                 THEN ISNULL(P.VL_RISCO, 0) ELSE ISNULL(P.VL_ENTRADA, 0) END)
            AS VL_FECHADO
    FROM dbo.TB_PARCELAS P WITH (NOLOCK)
    LEFT JOIN ALIAS_PROD AP
        ON AP.TEXTO_CHAVE = UPPER(LTRIM(RTRIM(ISNULL(P.CARTEIRA, ''))))
                            COLLATE Latin1_General_CI_AI
    WHERE P.NU_PARCELA = 1
      AND P.DATA >= @DataIni AND P.DATA < @DataFim
      AND NULLIF(LTRIM(RTRIM(P.NM_USUARIO)), '') IS NOT NULL
    GROUP BY P.DATA, UPPER(LTRIM(RTRIM(P.NM_USUARIO))), ISNULL(AP.ID_CARTEIRA, 0)
),
VEGA AS (
    SELECT
        A.DATA_PAGO AS DIA,
        UPPER(LTRIM(RTRIM(A.NM_USUARIO))) AS NM_CHAVE,
        ISNULL(AP.ID_CARTEIRA, 0) AS ID_CARTEIRA,
        COUNT(*) AS QT_PAGAMENTOS,
        -- Mesma regra do fechamento, do mesmo jeito que a Arena calcula
        -- (sql_arena_repository.py:772): nos cedentes por risco, o que entrou e
        -- o VL_RISCO das parcelas efetivamente pagas.
        SUM(CASE WHEN A.ID_CEDENTE IN (3, 60, 71, 77)
                 THEN CASE WHEN A.PARCELA_PAGA IS NOT NULL
                           THEN ISNULL(A.VL_RISCO, 0) ELSE 0 END
                 ELSE ISNULL(A.VL_PAGO, 0) END) AS VL_RECUPERADO
    FROM dbo.INFORMACAO_PAGAMENTOS A WITH (NOLOCK)
    LEFT JOIN ALIAS_PROD AP
        ON AP.TEXTO_CHAVE = UPPER(LTRIM(RTRIM(ISNULL(A.CARTEIRA, ''))))
                            COLLATE Latin1_General_CI_AI
    WHERE A.NU_PARCELA = 1
      AND A.DATA_PAGO >= @DataIni AND A.DATA_PAGO < @DataFim
      AND NULLIF(LTRIM(RTRIM(A.NM_USUARIO)), '') IS NOT NULL
    GROUP BY A.DATA_PAGO, UPPER(LTRIM(RTRIM(A.NM_USUARIO))), ISNULL(AP.ID_CARTEIRA, 0)
),
CONTATO AS (
    SELECT
        T.[DATA] AS DIA,
        UPPER(LTRIM(RTRIM(T.NM_USUARIO))) AS NM_CHAVE,
        SUM(ISNULL(T.CPC, 0)) AS QT_CPC,
        SUM(ISNULL(T.CE, 0)) AS QT_CE,
        COUNT(*) AS QT_ACIONAMENTOS
    FROM dbo.TB_TABULACOES_HOJE_66 T WITH (NOLOCK)
    WHERE T.[DATA] >= @DataIni AND T.[DATA] < @DataFim
      AND NULLIF(LTRIM(RTRIM(T.NM_USUARIO)), '') IS NOT NULL
    GROUP BY T.[DATA], UPPER(LTRIM(RTRIM(T.NM_USUARIO)))
),
ACESSO AS (
    SELECT
        L.CPF_COLABORADOR,
        L.DATA_LOGIN AS DIA,
        MIN(L.HORA_LOGIN) AS DT_PRIMEIRO_ACESSO,
        MAX(L.HORA_LOGIN) AS DT_ULTIMO_ACESSO
    FROM dbo.TB_LOG_ACESSO_COPILOT L WITH (NOLOCK)
    WHERE L.DATA_LOGIN >= @DataIni AND L.DATA_LOGIN < @DataFim
      AND L.CPF_COLABORADOR IS NOT NULL
    GROUP BY L.CPF_COLABORADOR, L.DATA_LOGIN
),
QUALIDADE AS (
    SELECT
        Q.CPF_OPERADOR,
        CAST(Q.DATA_HORA AS DATE) AS DIA,
        COUNT(*) AS QT_MONITORIAS,
        AVG(CAST(Q.PONTUACAO AS DECIMAL(6,2))) AS VL_NOTA
    FROM dbo.TB_FEEDBACK_QUALIDADE Q WITH (NOLOCK)
    WHERE Q.DATA_HORA >= @DataIni AND Q.DATA_HORA < DATEADD(DAY, 1, @DataFim)
      AND NULLIF(LTRIM(RTRIM(Q.CPF_OPERADOR)), '') IS NOT NULL
    GROUP BY Q.CPF_OPERADOR, CAST(Q.DATA_HORA AS DATE)
),
-- Meta atual, por nome. A coluna e varchar(max) e esta nula em 1.167 das 1.287
-- linhas; TRY_CONVERT devolve NULL para o lixo em notacao cientifica que sobrou
-- de alguma carga antiga.
META_ATUAL AS (
    SELECT
        UPPER(LTRIM(RTRIM(NM_COLABORADOR))) AS NM_CHAVE,
        MAX(TRY_CONVERT(DECIMAL(18,2), REPLACE(IDEAL_OPERADOR, ',', '.'))) AS VL_META
    FROM dbo.IDEAL_OPERADOR WITH (NOLOCK)
    GROUP BY UPPER(LTRIM(RTRIM(NM_COLABORADOR)))
),
DIA_OPERADOR AS (
    SELECT DIA, NM_CHAVE FROM FECHAMENTO
    UNION SELECT DIA, NM_CHAVE FROM VEGA
    UNION SELECT DIA, NM_CHAVE FROM CONTATO
    UNION SELECT A.DIA, R.NM_CHAVE FROM ACESSO A JOIN ROSTER R
        ON R.CPF_COLABORADOR = A.CPF_COLABORADOR
),
-- Carteira "primaria" do dia: a de maior fechamento; sem fechamento, a do
-- cadastro. As medidas que nao tem carteira (CPC, presenca, meta, qualidade)
-- pousam so nesta linha, senao um operador que produziu em duas carteiras
-- contaria o CPC dele duas vezes.
CARTEIRA_PRIMARIA AS (
    SELECT
        D.DIA, D.NM_CHAVE,
        COALESCE(F.ID_CARTEIRA, R.ID_CARTEIRA_CADASTRO, 0) AS ID_CARTEIRA
    FROM DIA_OPERADOR D
    LEFT JOIN ROSTER R ON R.NM_CHAVE = D.NM_CHAVE
    OUTER APPLY (
        SELECT TOP 1 F2.ID_CARTEIRA
        FROM FECHAMENTO F2
        WHERE F2.DIA = D.DIA AND F2.NM_CHAVE = D.NM_CHAVE
        ORDER BY F2.VL_ENTRADA DESC, F2.ID_CARTEIRA
    ) F
),
MESES AS (
    SELECT DISTINCT DATEFROMPARTS(YEAR(DIA), MONTH(DIA), 1) AS PRIMEIRO_DIA
    FROM DIA_OPERADOR
),
-- Dias uteis = dias do mes que nao sao domingo. 1900-01-07 foi um domingo;
-- usar o resto da divisao evita depender de @@DATEFIRST e do idioma da sessao.
DIAS_UTEIS AS (
    SELECT
        M.PRIMEIRO_DIA,
        SUM(CASE WHEN DATEDIFF(DAY, '19000107', DATEADD(DAY, N.N, M.PRIMEIRO_DIA)) % 7 = 0
                 THEN 0 ELSE 1 END) AS QT_DIAS_UTEIS
    FROM MESES M
    CROSS JOIN (SELECT TOP 31 ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1 AS N
                FROM sys.all_objects) N
    WHERE DATEADD(DAY, N.N, M.PRIMEIRO_DIA) < DATEADD(MONTH, 1, M.PRIMEIRO_DIA)
    GROUP BY M.PRIMEIRO_DIA
),
CHAVES AS (
    SELECT DIA, NM_CHAVE, ID_CARTEIRA FROM FECHAMENTO
    UNION SELECT DIA, NM_CHAVE, ID_CARTEIRA FROM VEGA
    UNION SELECT DIA, NM_CHAVE, ID_CARTEIRA FROM CARTEIRA_PRIMARIA
),
ORIGEM AS (
    SELECT
        K.DIA AS DATA,
        COALESCE(R.CPF_COLABORADOR, K.NM_CHAVE) AS CHAVE_OPERADOR,
        K.ID_CARTEIRA,
        R.CPF_COLABORADOR,
        COALESCE(R.NM_COLABORADOR, K.NM_CHAVE) AS NM_OPERADOR,
        ISNULL(R.NM_SUPERVISOR, '') AS NM_SUPERVISOR,
        ISNULL(R.NM_FUNCAO, '') AS NM_FUNCAO,
        -- Producao orfa (parceiro externo, nome com sufixo de carteira) conta
        -- como operador: ela existe no total da empresa e sumir seria pior.
        ISNULL(R.IS_OPERADOR, 1) AS IS_OPERADOR,
        CASE WHEN F.NM_CHAVE IS NOT NULL THEN 'PRODUCAO' ELSE 'CADASTRO' END AS ORIGEM_CARTEIRA,

        ISNULL(F.QT_ACORDOS, 0) AS QT_ACORDOS,
        ISNULL(F.QT_CANCELADOS, 0) AS QT_ACORDOS_CANCELADOS,
        ISNULL(F.VL_ENTRADA, 0) AS VL_ENTRADA,
        ISNULL(F.VL_RISCO, 0) AS VL_RISCO,
        -- Ja veio com a regua do cedente aplicada linha a linha na origem.
        ISNULL(F.VL_FECHADO, 0) AS VL_FECHADO,

        ISNULL(X.QT_PAGAMENTOS, 0) AS QT_PAGAMENTOS,
        ISNULL(X.VL_RECUPERADO, 0) AS VL_RECUPERADO,
        CASE WHEN @VegaDe IS NOT NULL AND K.DIA >= @VegaDe AND K.DIA <= @VegaAte
             THEN 1 ELSE 0 END AS TEM_VEGA,

        CASE WHEN K.ID_CARTEIRA = P.ID_CARTEIRA THEN CT.QT_CPC END AS QT_CPC,
        CASE WHEN K.ID_CARTEIRA = P.ID_CARTEIRA THEN CT.QT_CE END AS QT_CE,
        CASE WHEN K.ID_CARTEIRA = P.ID_CARTEIRA THEN CT.QT_ACIONAMENTOS END AS QT_ACIONAMENTOS,

        CASE WHEN K.ID_CARTEIRA = P.ID_CARTEIRA
             THEN NULLIF(COALESCE(MH.VL_META, MA.VL_META), 0) END AS VL_META_MES,
        CASE WHEN K.ID_CARTEIRA = P.ID_CARTEIRA THEN DU.QT_DIAS_UTEIS END AS QT_DIAS_UTEIS_MES,
        CASE WHEN K.ID_CARTEIRA = P.ID_CARTEIRA AND DU.QT_DIAS_UTEIS > 0
             THEN NULLIF(COALESCE(MH.VL_META, MA.VL_META), 0) / DU.QT_DIAS_UTEIS END AS VL_META_DIA,

        CASE WHEN K.ID_CARTEIRA = P.ID_CARTEIRA AND AC.CPF_COLABORADOR IS NOT NULL
             THEN 1 ELSE 0 END AS DIA_TRABALHADO,
        CASE WHEN K.ID_CARTEIRA = P.ID_CARTEIRA THEN AC.DT_PRIMEIRO_ACESSO END AS DT_PRIMEIRO_ACESSO,
        CASE WHEN K.ID_CARTEIRA = P.ID_CARTEIRA THEN AC.DT_ULTIMO_ACESSO END AS DT_ULTIMO_ACESSO,

        CASE WHEN K.ID_CARTEIRA = P.ID_CARTEIRA THEN ISNULL(Q.QT_MONITORIAS, 0) ELSE 0 END
            AS QT_MONITORIAS,
        CASE WHEN K.ID_CARTEIRA = P.ID_CARTEIRA THEN Q.VL_NOTA END AS VL_NOTA_QUALIDADE
    FROM CHAVES K
    LEFT JOIN ROSTER R ON R.NM_CHAVE = K.NM_CHAVE
    LEFT JOIN CARTEIRA_PRIMARIA P ON P.DIA = K.DIA AND P.NM_CHAVE = K.NM_CHAVE
    LEFT JOIN FECHAMENTO F
        ON F.DIA = K.DIA AND F.NM_CHAVE = K.NM_CHAVE AND F.ID_CARTEIRA = K.ID_CARTEIRA
    LEFT JOIN VEGA X
        ON X.DIA = K.DIA AND X.NM_CHAVE = K.NM_CHAVE AND X.ID_CARTEIRA = K.ID_CARTEIRA
    LEFT JOIN CONTATO CT ON CT.DIA = K.DIA AND CT.NM_CHAVE = K.NM_CHAVE
    LEFT JOIN ACESSO AC ON AC.DIA = K.DIA AND AC.CPF_COLABORADOR = R.CPF_COLABORADOR
    LEFT JOIN QUALIDADE Q ON Q.DIA = K.DIA AND Q.CPF_OPERADOR = R.CPF_COLABORADOR
    LEFT JOIN META_ATUAL MA ON MA.NM_CHAVE = K.NM_CHAVE
    LEFT JOIN DIAS_UTEIS DU ON DU.PRIMEIRO_DIA = DATEFROMPARTS(YEAR(K.DIA), MONTH(K.DIA), 1)
    -- Meta vigente naquele dia. Sem isto, o atingimento de um mes passado seria
    -- calculado contra a meta de hoje.
    OUTER APPLY (
        SELECT TOP 1 TRY_CONVERT(DECIMAL(18,2), H.NOVA_META) AS VL_META
        FROM dbo.TB_META_OPERADOR_HIST H WITH (NOLOCK)
        WHERE UPPER(LTRIM(RTRIM(H.NOME_COLABORADOR))) = K.NM_CHAVE
          AND H.DATA_ALTERACAO < DATEADD(DAY, 1, K.DIA)
        ORDER BY H.DATA_ALTERACAO DESC
    ) MH
)
MERGE dbo.TB_GESTAO_OPERADOR_DIA WITH (HOLDLOCK) AS DESTINO
USING ORIGEM
    ON  DESTINO.DATA = ORIGEM.DATA
    AND DESTINO.CHAVE_OPERADOR = ORIGEM.CHAVE_OPERADOR
    AND DESTINO.ID_CARTEIRA = ORIGEM.ID_CARTEIRA
    AND DESTINO.DATA >= @DataIni AND DESTINO.DATA < @DataFim
WHEN MATCHED AND EXISTS (
        SELECT DESTINO.QT_ACORDOS, DESTINO.VL_FECHADO, DESTINO.VL_RECUPERADO,
               DESTINO.QT_CPC, DESTINO.VL_META_DIA, DESTINO.DIA_TRABALHADO,
               DESTINO.QT_MONITORIAS, DESTINO.ID_CARTEIRA, DESTINO.NM_SUPERVISOR
        EXCEPT
        SELECT ORIGEM.QT_ACORDOS, ORIGEM.VL_FECHADO, ORIGEM.VL_RECUPERADO,
               ORIGEM.QT_CPC, ORIGEM.VL_META_DIA, ORIGEM.DIA_TRABALHADO,
               ORIGEM.QT_MONITORIAS, ORIGEM.ID_CARTEIRA, ORIGEM.NM_SUPERVISOR
     )
    THEN UPDATE SET
        CPF_COLABORADOR = ORIGEM.CPF_COLABORADOR,
        NM_OPERADOR = ORIGEM.NM_OPERADOR,
        NM_SUPERVISOR = ORIGEM.NM_SUPERVISOR,
        NM_FUNCAO = ORIGEM.NM_FUNCAO,
        IS_OPERADOR = ORIGEM.IS_OPERADOR,
        ORIGEM_CARTEIRA = ORIGEM.ORIGEM_CARTEIRA,
        QT_ACORDOS = ORIGEM.QT_ACORDOS,
        QT_ACORDOS_CANCELADOS = ORIGEM.QT_ACORDOS_CANCELADOS,
        VL_ENTRADA = ORIGEM.VL_ENTRADA,
        VL_RISCO = ORIGEM.VL_RISCO,
        VL_FECHADO = ORIGEM.VL_FECHADO,
        QT_PAGAMENTOS = ORIGEM.QT_PAGAMENTOS,
        VL_RECUPERADO = ORIGEM.VL_RECUPERADO,
        TEM_VEGA = ORIGEM.TEM_VEGA,
        QT_CPC = ORIGEM.QT_CPC,
        QT_CE = ORIGEM.QT_CE,
        QT_ACIONAMENTOS = ORIGEM.QT_ACIONAMENTOS,
        VL_META_MES = ORIGEM.VL_META_MES,
        QT_DIAS_UTEIS_MES = ORIGEM.QT_DIAS_UTEIS_MES,
        VL_META_DIA = ORIGEM.VL_META_DIA,
        DIA_TRABALHADO = ORIGEM.DIA_TRABALHADO,
        DT_PRIMEIRO_ACESSO = ORIGEM.DT_PRIMEIRO_ACESSO,
        DT_ULTIMO_ACESSO = ORIGEM.DT_ULTIMO_ACESSO,
        QT_MONITORIAS = ORIGEM.QT_MONITORIAS,
        VL_NOTA_QUALIDADE = ORIGEM.VL_NOTA_QUALIDADE,
        ID_EXECUCAO = @IdExecucao,
        DT_ATUALIZACAO = SYSDATETIME()
WHEN NOT MATCHED BY TARGET THEN INSERT (
        DATA, CHAVE_OPERADOR, ID_CARTEIRA, CPF_COLABORADOR, NM_OPERADOR,
        NM_SUPERVISOR, NM_FUNCAO, IS_OPERADOR, ORIGEM_CARTEIRA,
        QT_ACORDOS, QT_ACORDOS_CANCELADOS, VL_ENTRADA, VL_RISCO, VL_FECHADO,
        QT_PAGAMENTOS, VL_RECUPERADO, TEM_VEGA,
        QT_CPC, QT_CE, QT_ACIONAMENTOS,
        VL_META_MES, QT_DIAS_UTEIS_MES, VL_META_DIA,
        DIA_TRABALHADO, DT_PRIMEIRO_ACESSO, DT_ULTIMO_ACESSO,
        QT_MONITORIAS, VL_NOTA_QUALIDADE, ID_EXECUCAO
    ) VALUES (
        ORIGEM.DATA, ORIGEM.CHAVE_OPERADOR, ORIGEM.ID_CARTEIRA,
        ORIGEM.CPF_COLABORADOR, ORIGEM.NM_OPERADOR, ORIGEM.NM_SUPERVISOR,
        ORIGEM.NM_FUNCAO, ORIGEM.IS_OPERADOR, ORIGEM.ORIGEM_CARTEIRA,
        ORIGEM.QT_ACORDOS, ORIGEM.QT_ACORDOS_CANCELADOS, ORIGEM.VL_ENTRADA,
        ORIGEM.VL_RISCO, ORIGEM.VL_FECHADO,
        ORIGEM.QT_PAGAMENTOS, ORIGEM.VL_RECUPERADO, ORIGEM.TEM_VEGA,
        ORIGEM.QT_CPC, ORIGEM.QT_CE, ORIGEM.QT_ACIONAMENTOS,
        ORIGEM.VL_META_MES, ORIGEM.QT_DIAS_UTEIS_MES, ORIGEM.VL_META_DIA,
        ORIGEM.DIA_TRABALHADO, ORIGEM.DT_PRIMEIRO_ACESSO, ORIGEM.DT_ULTIMO_ACESSO,
        ORIGEM.QT_MONITORIAS, ORIGEM.VL_NOTA_QUALIDADE, @IdExecucao
    )
-- O predicado da janela repetido aqui e o que impede o comando de apagar todo
-- o historico fora dela.
WHEN NOT MATCHED BY SOURCE
     AND DESTINO.DATA >= @DataIni AND DESTINO.DATA < @DataFim
    THEN DELETE
OUTPUT $action INTO @Acoes(ACAO);

SELECT
    SUM(CASE WHEN ACAO = 'INSERT' THEN 1 ELSE 0 END) AS QT_INSERIDAS,
    SUM(CASE WHEN ACAO = 'UPDATE' THEN 1 ELSE 0 END) AS QT_ATUALIZADAS,
    SUM(CASE WHEN ACAO = 'DELETE' THEN 1 ELSE 0 END) AS QT_REMOVIDAS
FROM @Acoes;
"""


# Toda string de carteira nova entra apontando para "Nao classificada", em vez
# de ser adivinhada por substring. Ninguem perde dado e a fila de trabalho e uma
# consulta de uma linha.
_DESCOBRIR_ALIAS = """
DECLARE @DataIni DATE = ?;
DECLARE @DataFim DATE = ?;

INSERT INTO dbo.TB_GESTAO_CARTEIRA_ALIAS (ID_CARTEIRA, TIPO_ORIGEM, TEXTO_ORIGEM, REVISADO)
SELECT 0, 'PRODUCAO', X.TEXTO, 0
FROM (
    SELECT DISTINCT LTRIM(RTRIM(P.CARTEIRA)) AS TEXTO
    FROM dbo.TB_PARCELAS P WITH (NOLOCK)
    WHERE P.NU_PARCELA = 1 AND P.DATA >= @DataIni AND P.DATA < @DataFim
      AND NULLIF(LTRIM(RTRIM(P.CARTEIRA)), '') IS NOT NULL
) X
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.TB_GESTAO_CARTEIRA_ALIAS A
    WHERE A.TIPO_ORIGEM = 'PRODUCAO'
      AND A.TEXTO_CHAVE = UPPER(X.TEXTO) COLLATE Latin1_General_CI_AI
);

INSERT INTO dbo.TB_GESTAO_CARTEIRA_ALIAS (ID_CARTEIRA, TIPO_ORIGEM, TEXTO_ORIGEM, REVISADO)
SELECT 0, 'CADASTRO', X.TEXTO, 0
FROM (
    SELECT DISTINCT LTRIM(RTRIM(U.CENTRO_CUSTO)) AS TEXTO
    FROM login.TB_USUARIOS U WITH (NOLOCK)
    WHERE NULLIF(LTRIM(RTRIM(U.CENTRO_CUSTO)), '') IS NOT NULL
) X
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.TB_GESTAO_CARTEIRA_ALIAS A
    WHERE A.TIPO_ORIGEM = 'CADASTRO'
      AND A.TEXTO_CHAVE = UPPER(X.TEXTO) COLLATE Latin1_General_CI_AI
);
"""


class GestaoSnapshotRepository:
    """Escrita do snapshot de gestao.

    Usa `begin_transaction` em tudo, e nunca `execute_fetch`/`execute_commit`:
    esses dois engolem pyodbc.Error, imprimem e devolvem None
    (sql_server_connection.py:125 e :157). Num worker isso tornaria uma falha de
    carga indistinguivel de "nada mudou", e o snapshot envelheceria em silencio.
    """

    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66, "DB_COPILOT_ACME")

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

    def abrir_execucao(self, *, tipo_carga, data_inicio, data_fim) -> int:
        """Abre a execucao e devolve o id.

        O indice unico filtrado em STATUS = 'EXECUTANDO' faz o banco recusar a
        segunda execucao concorrente -- e a trava, sem tabela de lock.
        """
        linha = self._escrever_retornando(
            query="""
                INSERT INTO dbo.TB_GESTAO_SNAPSHOT_EXECUCAO
                    (TIPO_CARGA, DT_JANELA_INICIO, DT_JANELA_FIM, STATUS)
                OUTPUT INSERTED.ID_EXECUCAO
                VALUES (?, ?, ?, 'EXECUTANDO')
            """,
            parametros=(tipo_carga, data_inicio, data_fim),
        )
        return int(linha["ID_EXECUCAO"])

    def concluir_execucao(self, *, id_execucao, contagens, duracao_ms) -> None:
        self._escrever(
            query="""
                UPDATE dbo.TB_GESTAO_SNAPSHOT_EXECUCAO
                SET STATUS = 'CONCLUIDA', DT_FIM = SYSDATETIME(),
                    QT_INSERIDAS = ?, QT_ATUALIZADAS = ?, QT_REMOVIDAS = ?,
                    DURACAO_MS = ?
                WHERE ID_EXECUCAO = ?
            """,
            parametros=(
                contagens.get("inseridas", 0),
                contagens.get("atualizadas", 0),
                contagens.get("removidas", 0),
                duracao_ms,
                id_execucao,
            ),
        )

    def falhar_execucao(self, *, id_execucao, erro) -> None:
        self._escrever(
            query="""
                UPDATE dbo.TB_GESTAO_SNAPSHOT_EXECUCAO
                SET STATUS = 'FALHA', DT_FIM = SYSDATETIME(), ERRO = ?
                WHERE ID_EXECUCAO = ?
            """,
            parametros=(str(erro)[:2000], id_execucao),
        )

    def liberar_execucoes_travadas(self, *, minutos=90) -> int | None:
        """Solta execucoes que morreram sem fechar o registro.

        Sem isto, um worker derrubado no meio deixa STATUS='EXECUTANDO' para
        sempre e o indice unico bloqueia todas as execucoes seguintes.
        """
        return self._escrever(
            query="""
                UPDATE dbo.TB_GESTAO_SNAPSHOT_EXECUCAO
                SET STATUS = 'FALHA', DT_FIM = SYSDATETIME(),
                    ERRO = 'Execucao abandonada: liberada automaticamente.'
                WHERE STATUS = 'EXECUTANDO'
                  AND DT_INICIO < DATEADD(MINUTE, -?, SYSDATETIME())
            """,
            parametros=(minutos,),
            return_rowcount=True,
        )

    def carregar_janela(self, *, data_inicio, data_fim, id_execucao) -> dict:
        transacao = self.db.begin_transaction()
        try:
            transacao.execute_commit(
                query=_DESCOBRIR_ALIAS,
                parametros=(data_inicio, data_fim),
            )
            linha = transacao.execute_fetch(
                query=_MERGE_SNAPSHOT,
                parametros=(data_inicio, data_fim, id_execucao),
                one=True,
            ) or {}
            transacao.commit()
            return {
                "inseridas": int(linha.get("QT_INSERIDAS") or 0),
                "atualizadas": int(linha.get("QT_ATUALIZADAS") or 0),
                "removidas": int(linha.get("QT_REMOVIDAS") or 0),
            }
        except Exception:
            transacao.rollback()
            raise
        finally:
            transacao.close()

    def listar_alias_pendentes(self) -> list[dict]:
        return self._consultar(
            query="""
                SELECT TIPO_ORIGEM, TEXTO_ORIGEM
                FROM dbo.TB_GESTAO_CARTEIRA_ALIAS WITH (NOLOCK)
                WHERE ID_CARTEIRA = 0 AND REVISADO = 0
                ORDER BY TIPO_ORIGEM, TEXTO_ORIGEM
            """,
            parametros=(),
        ) or []

    def indice_de_tabulacoes_existe(self) -> bool:
        """O indice da migration 020 esta aplicado?

        Sem ele, o CTE de contato varre os 18 GB de TB_TABULACOES_HOJE_66 a cada
        execucao -- medido em ~20 minutos, contra os 15 do intervalo do
        intradiario. O worker nao se recusa a rodar, mas avisa: sem o indice a
        carga nao cabe na janela.
        """
        linha = self._consultar(
            query="""
                SELECT CASE WHEN EXISTS (
                    SELECT 1 FROM sys.indexes
                    WHERE name = 'IX_TABULACOES_HOJE_66_DATA'
                      AND object_id = OBJECT_ID('dbo.TB_TABULACOES_HOJE_66')
                ) THEN 1 ELSE 0 END AS existe
            """,
            parametros=(),
            one=True,
        )
        return bool(linha and linha.get("existe"))

    def obter_alcance_fontes(self) -> dict:
        """Ate onde cada fonte alcanca -- o backfill nao deve pedir mais do que existe."""
        return self._consultar(
            query="""
                SELECT
                    (SELECT MIN(DATA) FROM dbo.TB_PARCELAS WITH (NOLOCK)) AS FECHAMENTO_DE,
                    (SELECT MAX(DATA) FROM dbo.TB_PARCELAS WITH (NOLOCK)) AS FECHAMENTO_ATE,
                    (SELECT MIN(DATA_PAGO) FROM dbo.INFORMACAO_PAGAMENTOS WITH (NOLOCK)) AS VEGA_DE,
                    (SELECT MAX(DATA_PAGO) FROM dbo.INFORMACAO_PAGAMENTOS WITH (NOLOCK)) AS VEGA_ATE,
                    (SELECT MIN([DATA]) FROM dbo.TB_TABULACOES_HOJE_66 WITH (NOLOCK)) AS CONTATO_DE,
                    (SELECT MAX([DATA]) FROM dbo.TB_TABULACOES_HOJE_66 WITH (NOLOCK)) AS CONTATO_ATE
            """,
            parametros=(),
            one=True,
        ) or {}

    def _consultar(self, *, query, parametros, one=False):
        transacao = self.db.begin_transaction()
        try:
            return transacao.execute_fetch(query=query, parametros=parametros, one=one)
        finally:
            transacao.close()

    def _escrever(self, *, query, parametros, return_rowcount=False):
        transacao = self.db.begin_transaction()
        try:
            resultado = transacao.execute_commit(
                query=query, parametros=parametros, return_rowcount=return_rowcount
            )
            transacao.commit()
            return resultado
        except Exception:
            transacao.rollback()
            raise
        finally:
            transacao.close()

    def _escrever_retornando(self, *, query, parametros):
        transacao = self.db.begin_transaction()
        try:
            linha = transacao.execute_insert_returning(query=query, parametros=parametros)
            transacao.commit()
            return linha
        except Exception:
            transacao.rollback()
            raise
        finally:
            transacao.close()
