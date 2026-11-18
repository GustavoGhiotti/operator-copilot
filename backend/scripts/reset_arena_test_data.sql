SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @CONFIRMAR_RESET_TOTAL BIT = 1;

IF @CONFIRMAR_RESET_TOTAL <> 1
    THROW 51000, 'Reset cancelado: confirme explicitamente a operação.', 1;

IF DB_NAME() <> 'DB_COPILOT_ACME'
    THROW 51001, 'Reset cancelado: banco diferente de DB_COPILOT_ACME.', 1;

IF OBJECT_ID('dbo.TB_ARENA_TIPO_JOGO', 'U') IS NULL
    THROW 51002, 'Reset cancelado: estrutura principal da Arena não encontrada.', 1;

IF OBJECT_ID('dbo.TB_ARENA_TEMPORADA', 'U') IS NULL
    THROW 51003, 'Reset cancelado: tabela de temporadas não encontrada.', 1;

BEGIN TRY
    BEGIN TRANSACTION;

    CREATE TABLE #TABELAS_ARENA (
        OBJECT_ID INT NOT NULL PRIMARY KEY,
        SCHEMA_NAME SYSNAME NOT NULL,
        TABLE_NAME SYSNAME NOT NULL,
        PROCESSADA BIT NOT NULL DEFAULT (0)
    );

    CREATE TABLE #RESULTADO_RESET (
        ORDEM INT IDENTITY(1, 1) NOT NULL,
        TABELA NVARCHAR(300) NOT NULL,
        LINHAS_REMOVIDAS BIGINT NOT NULL
    );

    INSERT INTO #TABELAS_ARENA (
        OBJECT_ID,
        SCHEMA_NAME,
        TABLE_NAME
    )
    SELECT
        T.object_id,
        S.name,
        T.name
    FROM sys.tables T
    INNER JOIN sys.schemas S
        ON S.schema_id = T.schema_id
    WHERE T.name LIKE 'TB[_]ARENA[_]%'
      AND T.name NOT IN (
          'TB_ARENA_TIPO_JOGO',
          'TB_ARENA_TEMPORADA'
      );

    IF NOT EXISTS (SELECT 1 FROM #TABELAS_ARENA)
        THROW 51004, 'Reset cancelado: nenhuma tabela operacional da Arena foi encontrada.', 1;

    IF EXISTS (
        SELECT 1
        FROM sys.foreign_keys FK
        INNER JOIN #TABELAS_ARENA PAI
            ON PAI.OBJECT_ID = FK.referenced_object_id
        LEFT JOIN #TABELAS_ARENA FILHA
            ON FILHA.OBJECT_ID = FK.parent_object_id
        WHERE FILHA.OBJECT_ID IS NULL
          AND OBJECT_NAME(FK.parent_object_id) NOT IN (
              'TB_ARENA_TIPO_JOGO',
              'TB_ARENA_TEMPORADA'
          )
    )
        THROW 51005, 'Reset cancelado: existe dependência externa apontando para dados operacionais da Arena.', 1;

    DECLARE @OBJECT_ID INT;
    DECLARE @SCHEMA_NAME SYSNAME;
    DECLARE @TABLE_NAME SYSNAME;
    DECLARE @SQL NVARCHAR(MAX);
    DECLARE @LINHAS BIGINT;

    WHILE EXISTS (
        SELECT 1
        FROM #TABELAS_ARENA
        WHERE PROCESSADA = 0
    )
    BEGIN
        SET @OBJECT_ID = NULL;

        SELECT TOP (1)
            @OBJECT_ID = ATUAL.OBJECT_ID,
            @SCHEMA_NAME = ATUAL.SCHEMA_NAME,
            @TABLE_NAME = ATUAL.TABLE_NAME
        FROM #TABELAS_ARENA ATUAL
        WHERE ATUAL.PROCESSADA = 0
          AND NOT EXISTS (
              SELECT 1
              FROM sys.foreign_keys FK
              INNER JOIN #TABELAS_ARENA FILHA
                  ON FILHA.OBJECT_ID = FK.parent_object_id
                 AND FILHA.PROCESSADA = 0
              WHERE FK.referenced_object_id = ATUAL.OBJECT_ID
                AND FK.parent_object_id <> FK.referenced_object_id
          )
        ORDER BY ATUAL.TABLE_NAME;

        IF @OBJECT_ID IS NULL
            THROW 51006, 'Reset cancelado: dependência circular encontrada entre tabelas da Arena.', 1;

        SET @LINHAS = 0;
        SET @SQL =
            N'DELETE FROM '
            + QUOTENAME(@SCHEMA_NAME)
            + N'.'
            + QUOTENAME(@TABLE_NAME)
            + N'; SET @TOTAL = @@ROWCOUNT;';

        EXEC sys.sp_executesql
            @SQL,
            N'@TOTAL BIGINT OUTPUT',
            @TOTAL = @LINHAS OUTPUT;

        INSERT INTO #RESULTADO_RESET (TABELA, LINHAS_REMOVIDAS)
        VALUES (
            QUOTENAME(@SCHEMA_NAME) + N'.' + QUOTENAME(@TABLE_NAME),
            @LINHAS
        );

        UPDATE #TABELAS_ARENA
        SET PROCESSADA = 1
        WHERE OBJECT_ID = @OBJECT_ID;
    END;

    DECLARE IDENTIDADES CURSOR LOCAL FAST_FORWARD FOR
        SELECT DISTINCT
            SCHEMA_NAME,
            TABLE_NAME
        FROM #TABELAS_ARENA T
        WHERE EXISTS (
            SELECT 1
            FROM sys.identity_columns I
            WHERE I.object_id = T.OBJECT_ID
        );

    OPEN IDENTIDADES;
    FETCH NEXT FROM IDENTIDADES INTO @SCHEMA_NAME, @TABLE_NAME;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @SQL =
            N'DBCC CHECKIDENT ('''
            + REPLACE(
                QUOTENAME(@SCHEMA_NAME) + N'.' + QUOTENAME(@TABLE_NAME),
                '''',
                ''''''
            )
            + N''', RESEED, 0) WITH NO_INFOMSGS;';
        EXEC sys.sp_executesql @SQL;
        FETCH NEXT FROM IDENTIDADES INTO @SCHEMA_NAME, @TABLE_NAME;
    END;

    CLOSE IDENTIDADES;
    DEALLOCATE IDENTIDADES;

    IF EXISTS (
        SELECT 1
        FROM #TABELAS_ARENA
        WHERE PROCESSADA = 0
    )
        THROW 51007, 'Reset incompleto: existem tabelas operacionais não processadas.', 1;

    COMMIT TRANSACTION;

    SELECT
        TABELA,
        LINHAS_REMOVIDAS
    FROM #RESULTADO_RESET
    ORDER BY ORDEM;

    SELECT
        (SELECT COUNT(*) FROM dbo.TB_ARENA_TIPO_JOGO) AS TIPOS_JOGO_PRESERVADOS,
        (SELECT COUNT(*) FROM dbo.TB_ARENA_TEMPORADA) AS TEMPORADAS_PRESERVADAS,
        CAST(0 AS BIGINT) AS REGISTROS_OPERACIONAIS_ESPERADOS;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;
    THROW;
END CATCH;
