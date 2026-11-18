-- Primeiro drop adicional do armario da Aurora.
-- Depende de 019_arena_aurora_visual_expandido.sql.

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = 'CK_TB_ARENA_AURORA_ITEM_SLOT'
      AND parent_object_id = OBJECT_ID('dbo.TB_ARENA_AURORA_ITEM')
)
BEGIN
    ALTER TABLE dbo.TB_ARENA_AURORA_ITEM
        DROP CONSTRAINT CK_TB_ARENA_AURORA_ITEM_SLOT;
END;

ALTER TABLE dbo.TB_ARENA_AURORA_ITEM
    ADD CONSTRAINT CK_TB_ARENA_AURORA_ITEM_SLOT CHECK (
        SLOT IN (
            'CABECA', 'OCULOS', 'BRINCO', 'MAQUIAGEM', 'SUPERIOR',
            'INFERIOR', 'CALCADO', 'FUNDO', 'AURA', 'MOLDURA'
        )
    );

MERGE dbo.TB_ARENA_AURORA_ITEM AS destino
USING (VALUES
    -- codigo, nome, descricao, slot, raridade, coins, xp, chave, filtro,
    -- ordem, codigo conjunto, nome conjunto
    ('CAMISETA_ARENA_CASUAL', N'Camiseta Arena',
     N'Camiseta azul-marinho com ombros laranja e acabamento ciano.',
     'SUPERIOR', 'COMUM', 140, 100, 'camiseta-arena', NULL, 120,
     'ARENA_CASUAL', N'Arena Casual'),
    ('BLAZER_EXECUTIVO_NEON', N'Blazer Executivo Neon',
     N'Alfaiataria escura com lapelas e contorno luminoso.',
     'SUPERIOR', 'RARO', 420, 800, 'blazer-executivo-neon', NULL, 130,
     'EXECUTIVA_NEON', N'Executiva Neon'),
    ('MOLETOM_AURORA', N'Moletom Aurora',
     N'Variante violeta e ciano do Moletom Cosmos.',
     'SUPERIOR', 'EPICO', 500, 1600, 'moletom-cosmos',
     'hue-rotate(70deg) saturate(1.25)', 140,
     'AURORA', N'Linha Aurora'),
    ('CALCA_SOCIAL_FUTURISTA', N'Calca Social Futurista',
     N'Calca de alfaiataria com vinco e detalhe ciano discreto.',
     'INFERIOR', 'RARO', 340, 700, 'calca-social-futurista', NULL, 150,
     'EXECUTIVA_NEON', N'Executiva Neon'),
    ('JEANS_PULSE', N'Jeans Pulse',
     N'Jeans azul com costuras ciano e detalhe laranja.',
     'INFERIOR', 'COMUM', 190, 250, 'jeans-pulse', NULL, 160,
     'STREET_PULSE', N'Street Pulse'),
    ('SAIA_AURORA', N'Saia Aurora',
     N'Saia midi com camadas holograficas em violeta e ciano.',
     'INFERIOR', 'EPICO', 440, 1400, 'saia-aurora', NULL, 170,
     'AURORA', N'Linha Aurora'),
    ('TENIS_CASUAL_ARENA', N'Tenis Casual Arena',
     N'Tenis branco de uso diario com detalhes laranja e ciano.',
     'CALCADO', 'COMUM', 180, 150, 'tenis-casual-arena', NULL, 180,
     'ARENA_CASUAL', N'Arena Casual'),
    ('COTURNO_COSMOS', N'Coturno Cosmos',
     N'Coturno azul-marinho com costuras luminosas.',
     'CALCADO', 'EPICO', 480, 1300, 'coturno-cosmos', NULL, 190,
     'STREET_PULSE', N'Street Pulse'),
    ('CHAPEU_AURORA', N'Chapeu Aurora',
     N'Chapeu violeta de aba larga com faixa ciano.',
     'CABECA', 'EPICO', 390, 1100, 'chapeu-aurora', NULL, 200,
     'AURORA', N'Linha Aurora'),
    ('BONE_ACME', N'Bone Acme',
     N'Variante ciano do bone oficial da Arena.',
     'CABECA', 'RARO', 210, 450, 'bone-arena',
     'hue-rotate(165deg) saturate(1.15)', 210,
     'ARENA_CASUAL', N'Arena Casual'),
    ('BATOM_NEON', N'Batom Neon',
     N'Batom rosa com brilho holografico suave.',
     'MAQUIAGEM', 'COMUM', 90, 100, 'batom-neon', NULL, 220,
     'STREET_PULSE', N'Street Pulse'),
    ('DELINEADO_CIANO', N'Delineado Ciano',
     N'Delineado luminoso com acabamento futurista.',
     'MAQUIAGEM', 'RARO', 150, 350, 'delineado-ciano', NULL, 230,
     'EXECUTIVA_NEON', N'Executiva Neon')
) AS origem (
    CODIGO, NOME, DESCRICAO, SLOT, RARIDADE, PRECO_COINS, XP_NECESSARIO,
    CHAVE_VISUAL, FILTRO_COR, ORDEM, CODIGO_CONJUNTO, NOME_CONJUNTO
)
ON destino.CODIGO = origem.CODIGO
WHEN MATCHED THEN UPDATE SET
    NOME = origem.NOME,
    DESCRICAO = origem.DESCRICAO,
    SLOT = origem.SLOT,
    RARIDADE = origem.RARIDADE,
    PRECO_COINS = origem.PRECO_COINS,
    XP_NECESSARIO = origem.XP_NECESSARIO,
    CHAVE_VISUAL = origem.CHAVE_VISUAL,
    FILTRO_COR = origem.FILTRO_COR,
    ORDEM = origem.ORDEM,
    CODIGO_CONJUNTO = origem.CODIGO_CONJUNTO,
    NOME_CONJUNTO = origem.NOME_CONJUNTO,
    ATIVO = 1,
    DT_ATUALIZACAO = SYSDATETIME()
WHEN NOT MATCHED THEN INSERT (
    CODIGO, NOME, DESCRICAO, SLOT, RARIDADE, PRECO_COINS, XP_NECESSARIO,
    CHAVE_VISUAL, FILTRO_COR, ORDEM, CODIGO_CONJUNTO, NOME_CONJUNTO, ATIVO
) VALUES (
    origem.CODIGO, origem.NOME, origem.DESCRICAO, origem.SLOT,
    origem.RARIDADE, origem.PRECO_COINS, origem.XP_NECESSARIO,
    origem.CHAVE_VISUAL, origem.FILTRO_COR, origem.ORDEM,
    origem.CODIGO_CONJUNTO, origem.NOME_CONJUNTO, 1
);

COMMIT TRANSACTION;
