/*
    Catalogo de 50 presets completos da Aurora.

    - Cada visual e uma imagem unica de corpo inteiro (look-01 a look-50).
    - XP apenas desbloqueia; Aurora Coins pagam a compra.
    - Inventario e equipamento permanecem vinculados ao CPF.
    - Itens corporais antigos ficam inativos, mas compras e extrato nao sao apagados.

    Depende de 021_arena_aurora_presets_completos.sql.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> 'DB_COPILOT_ACME'
    THROW 51231, 'Migration cancelada: banco diferente de DB_COPILOT_ACME.', 1;

IF OBJECT_ID('dbo.TB_ARENA_AURORA_ITEM', 'U') IS NULL
    THROW 51232, 'Catalogo da Aurora nao encontrado.', 1;

IF OBJECT_ID('dbo.TB_ARENA_AURORA_INVENTARIO', 'U') IS NULL
    THROW 51233, 'Inventario da Aurora nao encontrado.', 1;

IF OBJECT_ID('dbo.TB_ARENA_AURORA_EQUIPADO', 'U') IS NULL
    THROW 51234, 'Equipamentos da Aurora nao encontrados.', 1;

IF COL_LENGTH('dbo.TB_ARENA_AURORA_ITEM', 'FILTRO_COR') IS NULL
    THROW 51235, 'Migration 019 nao aplicada.', 1;

DECLARE @PRESETS TABLE (
    CODIGO VARCHAR(60) NOT NULL PRIMARY KEY,
    NOME NVARCHAR(100) NOT NULL,
    DESCRICAO NVARCHAR(300) NOT NULL,
    RARIDADE VARCHAR(20) NOT NULL,
    PRECO_COINS INT NOT NULL,
    XP_NECESSARIO INT NOT NULL,
    CHAVE_VISUAL VARCHAR(80) NOT NULL,
    ORDEM INT NOT NULL
);

INSERT INTO @PRESETS (
    CODIGO, NOME, DESCRICAO, RARIDADE, PRECO_COINS,
    XP_NECESSARIO, CHAVE_VISUAL, ORDEM
)
VALUES
    ('AURORA_LOOK_01', N'Essencial', N'Casual claro com jeans escuro e tênis ciano.', 'COMUM', 80, 0, 'look-01', 10),
    ('AURORA_LOOK_02', N'Polo Acme', N'Polo marinho com alfaiataria casual.', 'COMUM', 100, 100, 'look-02', 20),
    ('AURORA_LOOK_03', N'Moletom Pulse', N'Moletom e jogger em azul-marinho.', 'COMUM', 120, 200, 'look-03', 30),
    ('AURORA_LOOK_04', N'Sobreposição Clara', N'Camisa azul-clara sobre camiseta branca.', 'COMUM', 140, 300, 'look-04', 40),
    ('AURORA_LOOK_05', N'Bomber Arena', N'Bomber Arena com cargo coordenada.', 'COMUM', 160, 400, 'look-05', 50),
    ('AURORA_LOOK_06', N'Denim Pulse', N'Jaqueta e jeans em denim azul.', 'COMUM', 180, 500, 'look-06', 60),
    ('AURORA_LOOK_07', N'Hoodie Lunar', N'Moletom claro com cargo marinho.', 'COMUM', 200, 650, 'look-07', 70),
    ('AURORA_LOOK_08', N'Tricô Órbita', N'Tricô marinho com calça de alfaiataria.', 'COMUM', 220, 800, 'look-08', 80),
    ('AURORA_LOOK_09', N'Utilitário Ciano', N'Jaqueta utilitária e cargo cinza.', 'COMUM', 240, 950, 'look-09', 90),
    ('AURORA_LOOK_10', N'Cardigan Neon', N'Cardigan longo com acabamento laranja.', 'COMUM', 260, 1100, 'look-10', 100),
    ('AURORA_LOOK_11', N'Cargo Apex', N'Utilitário urbano com cargo e tênis premium.', 'RARO', 300, 1300, 'look-11', 110),
    ('AURORA_LOOK_12', N'Executiva', N'Alfaiataria marinho para uma presença executiva.', 'RARO', 320, 1500, 'look-12', 120),
    ('AURORA_LOOK_13', N'Track Pulse', N'Conjunto esportivo branco e marinho.', 'RARO', 340, 1700, 'look-13', 130),
    ('AURORA_LOOK_14', N'Tricô Neve', N'Tricô claro com calça de alfaiataria.', 'RARO', 360, 1900, 'look-14', 140),
    ('AURORA_LOOK_15', N'Denim Ciano', N'Denim completo com acabamento ciano.', 'RARO', 380, 2100, 'look-15', 150),
    ('AURORA_LOOK_16', N'Oficina Arena', N'Workwear Arena com bolsos utilitários.', 'RARO', 400, 2300, 'look-16', 160),
    ('AURORA_LOOK_17', N'Trench Lunar', N'Trench bege com base executiva.', 'RARO', 420, 2500, 'look-17', 170),
    ('AURORA_LOOK_18', N'Hoodie Cargo', N'Hoodie marinho com cargo coordenada.', 'RARO', 440, 2700, 'look-18', 180),
    ('AURORA_LOOK_19', N'Macacão Urban', N'Macacão utilitário com recortes laranja.', 'RARO', 460, 2900, 'look-19', 190),
    ('AURORA_LOOK_20', N'Bomber Solar', N'Bomber solar em cetim laranja.', 'RARO', 480, 3100, 'look-20', 200),
    ('AURORA_LOOK_21', N'Lunar Branco', N'Jaqueta arquitetônica branca e marinho.', 'EPICO', 520, 3400, 'look-21', 210),
    ('AURORA_LOOK_22', N'Executiva Ciano', N'Terno executivo com contornos ciano.', 'EPICO', 550, 3700, 'look-22', 220),
    ('AURORA_LOOK_23', N'Bomber Violeta', N'Bomber violeta com brilho iridescente.', 'EPICO', 580, 4000, 'look-23', 230),
    ('AURORA_LOOK_24', N'Trench Polar', N'Trench polar preto e branco.', 'EPICO', 610, 4300, 'look-24', 240),
    ('AURORA_LOOK_25', N'Assimétrico Órbita', N'Alfaiataria assimétrica em preto, branco e ciano.', 'EPICO', 640, 4600, 'look-25', 250),
    ('AURORA_LOOK_26', N'Street Ciano', N'Streetwear em camadas ciano e marinho.', 'EPICO', 670, 4900, 'look-26', 260),
    ('AURORA_LOOK_27', N'Alfaiataria Pérola', N'Alfaiataria pérola com base escura.', 'EPICO', 700, 5200, 'look-27', 270),
    ('AURORA_LOOK_28', N'Holo Prism', N'Jaqueta holográfica com jogger marinho.', 'EPICO', 730, 5500, 'look-28', 280),
    ('AURORA_LOOK_29', N'Utilitário Neve', N'Utilitário neve em branco e cinza.', 'EPICO', 760, 5800, 'look-29', 290),
    ('AURORA_LOOK_30', N'Trench Solar', N'Trench marinho com linhas solares.', 'EPICO', 790, 6100, 'look-30', 300),
    ('AURORA_LOOK_31', N'Regente Dourado', N'Casaco de regência com detalhes dourados.', 'LENDARIO', 850, 6500, 'look-31', 310),
    ('AURORA_LOOK_32', N'Aurora Branca', N'Terno pérola com acabamento ciano.', 'LENDARIO', 900, 6900, 'look-32', 320),
    ('AURORA_LOOK_33', N'Violeta Imperial', N'Casaco violeta imperial em cetim.', 'LENDARIO', 950, 7300, 'look-33', 330),
    ('AURORA_LOOK_34', N'Racer Solar', N'Racing premium em laranja, branco e marinho.', 'LENDARIO', 1000, 7700, 'look-34', 340),
    ('AURORA_LOOK_35', N'Eclipse Ciano', N'Terno eclipse com linhas luminosas ciano.', 'LENDARIO', 1050, 8100, 'look-35', 350),
    ('AURORA_LOOK_36', N'Monarca Azul', N'Casaco real azul com detalhes dourados.', 'LENDARIO', 1100, 8500, 'look-36', 360),
    ('AURORA_LOOK_37', N'Pérola Executiva', N'Blazer perolado com colete executivo.', 'LENDARIO', 1150, 8900, 'look-37', 370),
    ('AURORA_LOOK_38', N'Órbita Assimétrica', N'Alfaiataria assimétrica preta, branca e dourada.', 'LENDARIO', 1200, 9300, 'look-38', 380),
    ('AURORA_LOOK_39', N'Eclipse Solar', N'Macacão eclipse com linhas solares.', 'LENDARIO', 1250, 9700, 'look-39', 390),
    ('AURORA_LOOK_40', N'Campeã Acme', N'Casaco de campeã com bordados dourados.', 'LENDARIO', 1300, 10100, 'look-40', 400),
    ('AURORA_LOOK_41', N'Cristal Ciano', N'Terno cristal branco com recortes ciano.', 'LENDARIO', 1400, 10600, 'look-41', 410),
    ('AURORA_LOOK_42', N'Soberana Noturna', N'Casaco soberano em veludo noturno.', 'LENDARIO', 1500, 11100, 'look-42', 420),
    ('AURORA_LOOK_43', N'Prisma Violeta', N'Conjunto prisma violeta iridescente.', 'LENDARIO', 1600, 11600, 'look-43', 430),
    ('AURORA_LOOK_44', N'Prestígio Arena', N'Racing de prestígio em branco e laranja.', 'LENDARIO', 1700, 12100, 'look-44', 440),
    ('AURORA_LOOK_45', N'Constelação', N'Terno noturno com textura de constelação.', 'LENDARIO', 1800, 12600, 'look-45', 450),
    ('AURORA_LOOK_46', N'Aurora Real', N'Casaco aurora ciano com acabamento dourado.', 'LENDARIO', 1900, 13100, 'look-46', 460),
    ('AURORA_LOOK_47', N'Prata Executiva', N'Blazer prata luminoso com base marinho.', 'LENDARIO', 2000, 13600, 'look-47', 470),
    ('AURORA_LOOK_48', N'Violeta Dourado', N'Runway violeta e dourado assimétrico.', 'LENDARIO', 2100, 14100, 'look-48', 480),
    ('AURORA_LOOK_49', N'Eclipse Supremo', N'Macacão executivo preto com linhas ciano e âmbar.', 'LENDARIO', 2200, 14600, 'look-49', 490),
    ('AURORA_LOOK_50', N'Lenda da Arena', N'Visual máximo da Arena em marinho, branco, ciano e laranja.', 'LENDARIO', 2300, 15100, 'look-50', 500);

BEGIN TRANSACTION;

-- Os itens legados continuam referenciaveis pelo inventario e pelo extrato,
-- mas deixam de aparecer na loja. Nada comprado pelo operador e apagado.
UPDATE ITEM
SET
    ITEM.ATIVO = 0,
    ITEM.DT_ATUALIZACAO = SYSDATETIME()
FROM dbo.TB_ARENA_AURORA_ITEM ITEM
WHERE ITEM.SLOT IN (
    'VISUAL', 'CABECA', 'OCULOS', 'BRINCO', 'MAQUIAGEM',
    'SUPERIOR', 'INFERIOR', 'CALCADO'
)
AND NOT EXISTS (
    SELECT 1
    FROM @PRESETS PRESET
    WHERE PRESET.CODIGO = ITEM.CODIGO
);

MERGE dbo.TB_ARENA_AURORA_ITEM AS DESTINO
USING @PRESETS AS ORIGEM
    ON DESTINO.CODIGO = ORIGEM.CODIGO
WHEN MATCHED THEN UPDATE SET
    NOME = ORIGEM.NOME,
    DESCRICAO = ORIGEM.DESCRICAO,
    SLOT = 'VISUAL',
    RARIDADE = ORIGEM.RARIDADE,
    PRECO_COINS = ORIGEM.PRECO_COINS,
    XP_NECESSARIO = ORIGEM.XP_NECESSARIO,
    CHAVE_VISUAL = ORIGEM.CHAVE_VISUAL,
    FILTRO_COR = NULL,
    ORDEM = ORIGEM.ORDEM,
    CODIGO_CONJUNTO = NULL,
    NOME_CONJUNTO = NULL,
    ATIVO = 1,
    DT_ATUALIZACAO = SYSDATETIME()
WHEN NOT MATCHED THEN INSERT (
    CODIGO, NOME, DESCRICAO, SLOT, RARIDADE,
    PRECO_COINS, XP_NECESSARIO, CHAVE_VISUAL, FILTRO_COR,
    ORDEM, CODIGO_CONJUNTO, NOME_CONJUNTO, ATIVO
) VALUES (
    ORIGEM.CODIGO, ORIGEM.NOME, ORIGEM.DESCRICAO, 'VISUAL',
    ORIGEM.RARIDADE, ORIGEM.PRECO_COINS, ORIGEM.XP_NECESSARIO,
    ORIGEM.CHAVE_VISUAL, NULL, ORIGEM.ORDEM, NULL, NULL, 1
);

-- Equipamentos legados nao podem ocupar silenciosamente o slot do novo
-- catalogo. O inventario e preservado; somente o estado atual obsoleto sai.
DELETE EQUIPADO
FROM dbo.TB_ARENA_AURORA_EQUIPADO EQUIPADO
INNER JOIN dbo.TB_ARENA_AURORA_ITEM ITEM
    ON ITEM.ID_ITEM = EQUIPADO.ID_ITEM
WHERE ITEM.SLOT IN (
    'VISUAL', 'CABECA', 'OCULOS', 'BRINCO', 'MAQUIAGEM',
    'SUPERIOR', 'INFERIOR', 'CALCADO'
)
AND NOT EXISTS (
    SELECT 1
    FROM @PRESETS PRESET
    WHERE PRESET.CODIGO = ITEM.CODIGO
);

COMMIT TRANSACTION;

SELECT
    COUNT(*) AS PRESETS_ATIVOS,
    MIN(XP_NECESSARIO) AS MENOR_XP,
    MAX(XP_NECESSARIO) AS MAIOR_XP,
    MIN(PRECO_COINS) AS MENOR_PRECO,
    MAX(PRECO_COINS) AS MAIOR_PRECO
FROM dbo.TB_ARENA_AURORA_ITEM
WHERE SLOT = 'VISUAL'
  AND ATIVO = 1
  AND CODIGO LIKE 'AURORA_LOOK[_]%';

