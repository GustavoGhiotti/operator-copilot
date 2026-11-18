/*
    Minha Aurora: troca o dress-up por presets completos.

    - Mantem inventario, compras e extrato de coins.
    - Preserva apenas o visual corporal equipado mais recente por operador.
    - FUNDO, AURA e MOLDURA continuam independentes.
    - Itens sem render completo aprovado ficam inativos, sem apagar historico.

    Depende de 019_arena_aurora_visual_expandido.sql e
    020_arena_aurora_drop_inicial.sql.
*/

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID('dbo.TB_ARENA_AURORA_ITEM', 'U') IS NULL
    THROW 51221, 'Catalogo da Aurora nao encontrado.', 1;

IF OBJECT_ID('dbo.TB_ARENA_AURORA_EQUIPADO', 'U') IS NULL
    THROW 51222, 'Equipamentos da Aurora nao encontrados.', 1;

DECLARE @VISUAL_ATUAL TABLE (
    CPF_COLABORADOR VARCHAR(20) NOT NULL PRIMARY KEY,
    ID_ITEM INT NOT NULL,
    DT_EQUIPADO DATETIME2(0) NOT NULL
);

;WITH CANDIDATOS AS (
    SELECT
        EQ.CPF_COLABORADOR,
        EQ.ID_ITEM,
        EQ.DT_EQUIPADO,
        ROW_NUMBER() OVER (
            PARTITION BY EQ.CPF_COLABORADOR
            ORDER BY EQ.DT_EQUIPADO DESC, EQ.ID_ITEM DESC
        ) AS POSICAO
    FROM dbo.TB_ARENA_AURORA_EQUIPADO EQ
    INNER JOIN dbo.TB_ARENA_AURORA_ITEM ITEM
        ON ITEM.ID_ITEM = EQ.ID_ITEM
    WHERE ITEM.CODIGO IN (
        'OCULOS_PULSE', 'OCULOS_SOLAR_ORBITA', 'BONE_ARENA',
        'FONE_NEON', 'BRINCO_ORBITA', 'JAQUETA_LUNAR',
        'MOLETOM_COSMOS', 'CALCA_CARGO_CIANO',
        'CALCA_PULSE_ORANGE', 'SANDALIA_HOLO',
        'TENIS_CASUAL_ARENA', 'COTURNO_COSMOS'
    )
)
INSERT INTO @VISUAL_ATUAL (CPF_COLABORADOR, ID_ITEM, DT_EQUIPADO)
SELECT CPF_COLABORADOR, ID_ITEM, DT_EQUIPADO
FROM CANDIDATOS
WHERE POSICAO = 1;

DELETE FROM dbo.TB_ARENA_AURORA_EQUIPADO
WHERE SLOT IN (
    'VISUAL', 'CABECA', 'OCULOS', 'BRINCO', 'MAQUIAGEM',
    'SUPERIOR', 'INFERIOR', 'CALCADO'
);

IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_TB_ARENA_AURORA_ITEM_SLOT'
      AND parent_object_id = OBJECT_ID('dbo.TB_ARENA_AURORA_ITEM')
)
BEGIN
    ALTER TABLE dbo.TB_ARENA_AURORA_ITEM
        DROP CONSTRAINT CK_TB_ARENA_AURORA_ITEM_SLOT;
END;

IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_TB_ARENA_AURORA_EQ_SLOT'
      AND parent_object_id = OBJECT_ID('dbo.TB_ARENA_AURORA_EQUIPADO')
)
BEGIN
    ALTER TABLE dbo.TB_ARENA_AURORA_EQUIPADO
        DROP CONSTRAINT CK_TB_ARENA_AURORA_EQ_SLOT;
END;

ALTER TABLE dbo.TB_ARENA_AURORA_ITEM
    ADD CONSTRAINT CK_TB_ARENA_AURORA_ITEM_SLOT CHECK (
        SLOT IN (
            'VISUAL', 'CABECA', 'OCULOS', 'BRINCO', 'MAQUIAGEM',
            'SUPERIOR', 'INFERIOR', 'CALCADO',
            'FUNDO', 'AURA', 'MOLDURA'
        )
    );

ALTER TABLE dbo.TB_ARENA_AURORA_EQUIPADO
    ADD CONSTRAINT CK_TB_ARENA_AURORA_EQ_SLOT CHECK (
        SLOT IN (
            'VISUAL', 'CABECA', 'OCULOS', 'BRINCO', 'MAQUIAGEM',
            'SUPERIOR', 'INFERIOR', 'CALCADO',
            'FUNDO', 'AURA', 'MOLDURA'
        )
    );

-- Todo item corporal que nao possui um render completo revisado sai da loja.
-- A linha permanece para preservar inventario, compra e movimentacao de coins.
UPDATE dbo.TB_ARENA_AURORA_ITEM
SET
    ATIVO = 0,
    DT_ATUALIZACAO = SYSDATETIME()
WHERE SLOT IN (
    'VISUAL', 'CABECA', 'OCULOS', 'BRINCO', 'MAQUIAGEM',
    'SUPERIOR', 'INFERIOR', 'CALCADO'
)
AND CODIGO NOT IN (
    'OCULOS_PULSE', 'OCULOS_SOLAR_ORBITA', 'BONE_ARENA',
    'FONE_NEON', 'BRINCO_ORBITA', 'JAQUETA_LUNAR',
    'MOLETOM_COSMOS', 'CALCA_CARGO_CIANO',
    'CALCA_PULSE_ORANGE', 'SANDALIA_HOLO',
    'TENIS_CASUAL_ARENA', 'COTURNO_COSMOS'
);

MERGE dbo.TB_ARENA_AURORA_ITEM AS DESTINO
USING (VALUES
    ('OCULOS_PULSE', N'Visual Pulse',
     N'Look completo da Aurora com óculos Pulse.'),
    ('OCULOS_SOLAR_ORBITA', N'Visual Órbita',
     N'Look completo da Aurora com óculos solares Órbita.'),
    ('BONE_ARENA', N'Visual Boné Arena',
     N'Look completo da Aurora com boné oficial da Arena.'),
    ('FONE_NEON', N'Visual Fone Neon',
     N'Look completo da Aurora com headset Neon.'),
    ('BRINCO_ORBITA', N'Visual Brinco Órbita',
     N'Look completo da Aurora com brincos Órbita.'),
    ('JAQUETA_LUNAR', N'Visual Jaqueta Lunar',
     N'Look completo da Aurora com jaqueta Lunar.'),
    ('MOLETOM_COSMOS', N'Visual Moletom Cosmos',
     N'Look completo da Aurora com moletom Cosmos.'),
    ('CALCA_CARGO_CIANO', N'Visual Cargo Ciano',
     N'Look completo da Aurora com calça Cargo Ciano.'),
    ('CALCA_PULSE_ORANGE', N'Visual Pulse Laranja',
     N'Look completo da Aurora com calça Pulse Laranja.'),
    ('SANDALIA_HOLO', N'Visual Sandália Holo',
     N'Look completo da Aurora com sandália Holo.'),
    ('TENIS_CASUAL_ARENA', N'Visual Casual Arena',
     N'Look completo casual da Aurora com tênis branco.'),
    ('COTURNO_COSMOS', N'Visual Coturno Cosmos',
     N'Look completo da Aurora com coturno Cosmos.')
) AS ORIGEM (CODIGO, NOME, DESCRICAO)
ON DESTINO.CODIGO = ORIGEM.CODIGO
WHEN MATCHED THEN UPDATE SET
    NOME = ORIGEM.NOME,
    DESCRICAO = ORIGEM.DESCRICAO,
    SLOT = 'VISUAL',
    FILTRO_COR = NULL,
    ATIVO = 1,
    DT_ATUALIZACAO = SYSDATETIME();

INSERT INTO dbo.TB_ARENA_AURORA_EQUIPADO (
    CPF_COLABORADOR,
    SLOT,
    ID_ITEM,
    DT_EQUIPADO
)
SELECT
    ATUAL.CPF_COLABORADOR,
    'VISUAL',
    ATUAL.ID_ITEM,
    ATUAL.DT_EQUIPADO
FROM @VISUAL_ATUAL ATUAL
INNER JOIN dbo.TB_ARENA_AURORA_ITEM ITEM
    ON ITEM.ID_ITEM = ATUAL.ID_ITEM
WHERE ITEM.SLOT = 'VISUAL'
  AND ITEM.ATIVO = 1;

COMMIT TRANSACTION;

SELECT
    SUM(CASE WHEN SLOT = 'VISUAL' AND ATIVO = 1 THEN 1 ELSE 0 END)
        AS PRESETS_ATIVOS,
    SUM(CASE WHEN ATIVO = 0 THEN 1 ELSE 0 END)
        AS ITENS_PRESERVADOS_INATIVOS
FROM dbo.TB_ARENA_AURORA_ITEM;
