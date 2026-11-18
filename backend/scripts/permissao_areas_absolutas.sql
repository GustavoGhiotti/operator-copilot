/*
    Areas que faltavam para a tela de acessos ser absoluta.

    A tela edita comando por comando, mas so consegue conceder ou negar aquilo
    que existe em TB_PERMISSAO_AREA -- `definir_ajuste` valida contra esta
    tabela e devolve 400 para area desconhecida. Comando cujo acesso nasce de
    uma regra fixa no codigo, sem area correspondente, e o unico que continua
    fora do alcance do gestor.

    Hoje ha um caso assim: o @Tarefas, liberado para todos por `tasks: true` em
    adminCommandAccess.ts. Esta area existe para que ele possa ser negado a
    alguem; enquanto ela nao existir, o comando segue liberado para todos e
    simplesmente nao aparece na tela (o grid so desenha area cadastrada).

    Rodar uma vez, no banco DB_COPILOT_ACME. E idempotente.
*/

IF NOT EXISTS (
    SELECT 1 FROM dbo.TB_PERMISSAO_AREA WHERE AREA = 'tarefas.usar'
)
BEGIN
    INSERT INTO dbo.TB_PERMISSAO_AREA (AREA, DESCRICAO, ATIVO)
    VALUES (
        'tarefas.usar',
        'Organizador de tarefas (@Tarefas). Liberado a todos por padrao; esta area existe para permitir negar a alguem.',
        1
    );
END;

/*
    Conferencia: lista o catalogo com a contagem de pessoas que tem ajuste
    explicito em cada area.
*/
SELECT
    A.AREA,
    A.DESCRICAO,
    A.ATIVO,
    SUM(CASE WHEN V.CONCEDIDA = 1 THEN 1 ELSE 0 END) AS CONCEDIDA_NA_TELA,
    SUM(CASE WHEN V.CONCEDIDA = 0 THEN 1 ELSE 0 END) AS NEGADA_NA_TELA
FROM dbo.TB_PERMISSAO_AREA A
LEFT JOIN dbo.TB_PERMISSAO_USUARIO_AREA V
    ON V.AREA = A.AREA
GROUP BY A.AREA, A.DESCRICAO, A.ATIVO
ORDER BY A.AREA;
