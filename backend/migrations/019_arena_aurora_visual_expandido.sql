SET XACT_ABORT ON;
BEGIN TRANSACTION;

-- Amplia o guarda-roupa da Aurora sem depender de arte nova.
--
-- Cada "roupa" hoje e um render de corpo inteiro dela vestindo a peca,
-- recortado por faixa. Peca nova = imagem nova = pipeline de arte. Entao o
-- catalogo cresce por dois caminhos que nao tocam no corpo da personagem:
--
--   1) FILTRO_COR: a mesma camada com um filtro CSS (palette swap). Uma
--      jaqueta vira quatro coloracoes reusando o mesmo PNG.
--   2) Slots FUNDO / AURA / MOLDURA: cenario atras dela, brilho em volta e
--      moldura. Sao puro CSS, nascem sem arte.

------------------------------------------------------------------ colunas --

IF COL_LENGTH('dbo.TB_ARENA_AURORA_ITEM', 'FILTRO_COR') IS NULL
BEGIN
    ALTER TABLE dbo.TB_ARENA_AURORA_ITEM
        ADD FILTRO_COR NVARCHAR(120) NULL;
END;

-- Conjunto por codigo, e nao por ID numerico: o nome do conjunto vive junto do
-- item e dispensa uma tabela so para tres agrupamentos.
IF COL_LENGTH('dbo.TB_ARENA_AURORA_ITEM', 'CODIGO_CONJUNTO') IS NULL
BEGIN
    ALTER TABLE dbo.TB_ARENA_AURORA_ITEM
        ADD CODIGO_CONJUNTO NVARCHAR(40) NULL,
            NOME_CONJUNTO NVARCHAR(60) NULL;
END;

------------------------------------------------------------------- slots ---

IF EXISTS (
    SELECT 1 FROM sys.check_constraints
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
            'CABECA', 'OCULOS', 'BRINCO', 'MAQUIAGEM', 'SUPERIOR', 'INFERIOR', 'CALCADO',
            'FUNDO', 'AURA', 'MOLDURA'
        )
    );

-- Daqui para baixo tudo que cita as colunas recem-criadas roda por EXEC.
--
-- O SQL Server compila o lote inteiro antes de executar a primeira linha, e
-- nesse momento FILTRO_COR / CODIGO_CONJUNTO / NOME_CONJUNTO ainda nao existem
-- para o compilador. Sem o EXEC o lote morre com "Nome de coluna invalido" e
-- nada roda -- nem o BEGIN TRANSACTION. O EXEC compila so na hora de executar,
-- quando as colunas ja estao la, e mantem tudo numa transacao unica.

EXEC (N'
    --------------------------------------------------------------- conjuntos ---
    -- Marca as pecas que ja existem como parte de um conjunto. Completar todos os
    -- itens de um conjunto e o que da o bonus visual no armario.

    UPDATE dbo.TB_ARENA_AURORA_ITEM
    SET CODIGO_CONJUNTO = ''PULSE'', NOME_CONJUNTO = ''Linha Pulse''
    WHERE CODIGO IN (''OCULOS_PULSE'', ''CALCA_PULSE_ORANGE'', ''TENIS_PULSE'');

    UPDATE dbo.TB_ARENA_AURORA_ITEM
    SET CODIGO_CONJUNTO = ''ORBITA'', NOME_CONJUNTO = N''Linha Órbita''
    WHERE CODIGO IN (''OCULOS_SOLAR_ORBITA'', ''BRINCO_ORBITA'', ''SANDALIA_HOLO'');

    UPDATE dbo.TB_ARENA_AURORA_ITEM
    SET CODIGO_CONJUNTO = ''COSMOS'', NOME_CONJUNTO = ''Linha Cosmos''
    WHERE CODIGO IN (''MOLETOM_COSMOS'', ''CALCA_CARGO_CIANO'', ''FONE_NEON'');

    -------------------------------------------------------- variantes de cor ---
    -- CHAVE_VISUAL aponta para a MESMA camada da peca base; quem muda o resultado
    -- e o FILTRO_COR. Por isso nenhuma destas linhas precisa de arquivo novo.

    MERGE dbo.TB_ARENA_AURORA_ITEM AS destino
    USING (VALUES
        -- codigo, nome, descricao, slot, raridade, preco, xp, chave, filtro, ordem
        (''JAQUETA_LUNAR_CIANO'', ''Jaqueta Lunar Ciano'',
         ''A mesma Lunar, banhada em ciano.'', ''SUPERIOR'', ''EPICO'', 420, 800,
         ''jaqueta-lunar'', ''hue-rotate(150deg) saturate(1.25)'', 61),
        (''JAQUETA_LUNAR_RUBI'', ''Jaqueta Lunar Rubi'',
         N''Recortes holográficos em vermelho profundo.'', ''SUPERIOR'', ''EPICO'',
         420, 1200, ''jaqueta-lunar'', ''hue-rotate(310deg) saturate(1.3)'', 62),
        (''MOLETOM_COSMOS_ESMERALDA'', ''Moletom Cosmos Esmeralda'',
         ''Cosmos em verde profundo.'', ''SUPERIOR'', ''EPICO'', 470, 1400,
         ''moletom-cosmos'', ''hue-rotate(255deg) saturate(1.2)'', 71),
        (''MOLETOM_COSMOS_SOLAR'', ''Moletom Cosmos Solar'',
         ''Cosmos com pulso alaranjado.'', ''SUPERIOR'', ''LENDARIO'', 520, 2000,
         ''moletom-cosmos'', ''hue-rotate(185deg) saturate(1.45)'', 72),
        (''CALCA_CARGO_VIOLETA'', ''Cargo Violeta'',
         ''Cargo com bolsos em violeta.'', ''INFERIOR'', ''EPICO'', 300, 900,
         ''calca-cargo-ciano'', ''hue-rotate(75deg) saturate(1.2)'', 81),
        (''CALCA_CARGO_GRAFITE'', ''Cargo Grafite'',
         N''Versão discreta, quase monocromática.'', ''INFERIOR'', ''RARO'', 240, 600,
         ''calca-cargo-ciano'', ''saturate(0.25) brightness(0.95)'', 82),
        (''CALCA_PULSE_AZUL'', ''Pulse Azul'',
         N''Faixa lateral em azul elétrico.'', ''INFERIOR'', ''EPICO'', 400, 1300,
         ''calca-pulse-orange'', ''hue-rotate(190deg) saturate(1.3)'', 91),
        (''CALCA_PULSE_VERDE'', ''Pulse Verde'',
         ''Faixa lateral em verde neon.'', ''INFERIOR'', ''LENDARIO'', 440, 1800,
         ''calca-pulse-orange'', ''hue-rotate(95deg) saturate(1.4)'', 92),
        (''OCULOS_PULSE_VIOLETA'', N''Óculos Pulse Violeta'',
         N''Armação com brilho violeta.'', ''OCULOS'', ''RARO'', 140, 400,
         ''oculos-pulse'', ''hue-rotate(70deg) saturate(1.3)'', 11),
        (''OCULOS_ORBITA_ESMERALDA'', N''Óculos Órbita Esmeralda'',
         ''Lentes solares esverdeadas.'', ''OCULOS'', ''EPICO'', 340, 1200,
         ''oculos-solar-orbita'', ''hue-rotate(110deg) saturate(1.2)'', 21),
        (''BONE_ARENA_ROXO'', N''Boné Arena Roxo'',
         N''O boné oficial em roxo.'', ''CABECA'', ''RARO'', 190, 500,
         ''bone-arena'', ''hue-rotate(240deg) saturate(1.2)'', 31),
        (''FONE_NEON_ROSA'', ''Fone Neon Rosa'',
         ''Headset em magenta.'', ''CABECA'', ''LENDARIO'', 520, 2200,
         ''fone-neon'', ''hue-rotate(285deg) saturate(1.35)'', 41),
        (''BRINCO_ORBITA_SOLAR'', N''Brinco Órbita Solar'',
         N''Órbitas em âmbar.'', ''BRINCO'', ''EPICO'', 160, 700,
         ''brinco-orbita'', ''hue-rotate(200deg) saturate(1.3)'', 51),
        (''SANDALIA_HOLO_AURORA'', N''Sandália Holo Aurora'',
         N''Tiras em degradê aurora.'', ''CALCADO'', ''EPICO'', 210, 1100,
         ''sandalia-holo'', ''hue-rotate(140deg) saturate(1.35)'', 111)
    ) AS origem (
        CODIGO, NOME, DESCRICAO, SLOT, RARIDADE, PRECO_COINS, XP_NECESSARIO,
        CHAVE_VISUAL, FILTRO_COR, ORDEM
    )
        ON destino.CODIGO = origem.CODIGO
    WHEN NOT MATCHED THEN INSERT (
        CODIGO, NOME, DESCRICAO, SLOT, RARIDADE, PRECO_COINS, XP_NECESSARIO,
        CHAVE_VISUAL, FILTRO_COR, ORDEM, ATIVO
    ) VALUES (
        origem.CODIGO, origem.NOME, origem.DESCRICAO, origem.SLOT,
        origem.RARIDADE, origem.PRECO_COINS, origem.XP_NECESSARIO,
        origem.CHAVE_VISUAL, origem.FILTRO_COR, origem.ORDEM, 1
    );
');

-------------------------------------------------- fundos, auras, molduras --
-- CHAVE_VISUAL aqui nao aponta para PNG: o front resolve cada chave num
-- gradiente/brilho proprio.

MERGE dbo.TB_ARENA_AURORA_ITEM AS destino
USING (VALUES
    ('FUNDO_ESTUDIO', N'Estúdio Neon',
     'Fundo escuro com halo ciano.', 'FUNDO', 'COMUM', 80, 0,
     'fundo-estudio', 201),
    ('FUNDO_ARQUIBANCADA', 'Arquibancada',
     N'A plateia da Arena atrás de você.', 'FUNDO', 'RARO', 200, 600,
     'fundo-arquibancada', 202),
    ('FUNDO_NEBULOSA', 'Nebulosa',
     'Poeira estelar em violeta e ciano.', 'FUNDO', 'EPICO', 360, 1500,
     'fundo-nebulosa', 203),
    ('FUNDO_PODIO', N'Pódio Dourado',
     'Reservado a quem chegou ao topo.', 'FUNDO', 'LENDARIO', 600, 2500,
     'fundo-podio', 204),
    ('AURA_PULSO', 'Aura Pulso',
     'Um pulso ciano ao seu redor.', 'AURA', 'COMUM', 120, 200,
     'aura-pulso', 211),
    ('AURA_CHAMA', 'Aura Chama',
     'Brilho laranja constante.', 'AURA', 'RARO', 240, 800,
     'aura-chama', 212),
    ('AURA_AURORA', 'Aura Aurora',
     'Faixas de cor que giram devagar.', 'AURA', 'EPICO', 420, 1700,
     'aura-aurora', 213),
    ('AURA_LENDARIA', N'Aura Lendária',
     N'Só quem chegou ao fim da temporada.', 'AURA', 'LENDARIO', 700, 3000,
     'aura-lendaria', 214),
    ('MOLDURA_BRONZE', 'Moldura Bronze',
     'Contorno discreto em bronze.', 'MOLDURA', 'COMUM', 90, 100,
     'moldura-bronze', 221),
    ('MOLDURA_PRATA', 'Moldura Prata',
     'Contorno em prata polida.', 'MOLDURA', 'RARO', 220, 900,
     'moldura-prata', 222),
    ('MOLDURA_OURO', 'Moldura Ouro',
     'Contorno dourado com brilho.', 'MOLDURA', 'LENDARIO', 650, 2800,
     'moldura-ouro', 223)
) AS origem (
    CODIGO, NOME, DESCRICAO, SLOT, RARIDADE, PRECO_COINS, XP_NECESSARIO,
    CHAVE_VISUAL, ORDEM
)
    ON destino.CODIGO = origem.CODIGO
WHEN NOT MATCHED THEN INSERT (
    CODIGO, NOME, DESCRICAO, SLOT, RARIDADE, PRECO_COINS, XP_NECESSARIO,
    CHAVE_VISUAL, ORDEM, ATIVO
) VALUES (
    origem.CODIGO, origem.NOME, origem.DESCRICAO, origem.SLOT,
    origem.RARIDADE, origem.PRECO_COINS, origem.XP_NECESSARIO,
    origem.CHAVE_VISUAL, origem.ORDEM, 1
);

COMMIT TRANSACTION;
