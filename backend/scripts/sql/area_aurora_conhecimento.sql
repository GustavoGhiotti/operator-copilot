/*
    Entrega o comando @Treinamentos (base de conhecimento da Aurora) para a
    Qualidade, que passa a ser dona do conteudo que a IA usa para responder.

    Faz duas coisas:

      1. Cria a area `aurora.conhecimento` em TB_PERMISSAO_AREA. Sem esta
         linha a area nao existe, e a propria tela @Acessos recusa conceder
         ("Area desconhecida." -- permissao_router.py).

      2. Concede a area ao centro de custo QUALIDADE em TB_PERMISSAO_VISAO
         (18 pessoas hoje). Nao e obrigatorio fazer por SQL -- a tela @Acessos
         faz o mesmo depois que o passo 1 rodar -- mas evita um segundo passo
         manual so para colocar a Qualidade de pe.

    Por que a Qualidade ja enxerga a tela: o centro de custo QUALIDADE esta em
    CENTROS_CUSTO_COM_VISAO_ADMINISTRATIVA (login_service.py:14-22), entao
    essas pessoas ja entram com is_admin e caem em /admin, onde o comando
    @Treinamentos e montado. Faltava so a permissao.

    O VALOR e gravado normalizado (maiusculas, sem acento, espacos colapsados)
    porque e assim que `normalizar_valor` compara na hora de autorizar --
    gravar "Qualidade" criaria uma concessao que existe e nunca concede.

    Idempotente: rodar duas vezes nao duplica nem sobrescreve. Se a concessao
    tiver sido revogada antes, ela e reativada em vez de duplicar a linha --
    mesmo comportamento do metodo `conceder` do repositorio.

    Banco: DB_COPILOT_ACME
*/

-- ------------------------------------------------------------------ --
-- 1. A area
-- ------------------------------------------------------------------ --
IF NOT EXISTS (
    SELECT 1 FROM dbo.TB_PERMISSAO_AREA WHERE AREA = 'aurora.conhecimento'
)
BEGIN
    INSERT INTO dbo.TB_PERMISSAO_AREA (AREA, DESCRICAO, ATIVO)
    VALUES (
        'aurora.conhecimento',
        'Base de conhecimento da Aurora (@Treinamentos)',
        1
    );
END;

-- ------------------------------------------------------------------ --
-- 2. A concessao para a Qualidade
-- ------------------------------------------------------------------ --
UPDATE dbo.TB_PERMISSAO_VISAO
SET ATIVO = 1,
    CRIADO_EM = SYSDATETIME(),
    CRIADO_POR = 'SETUP-TREINAMENTOS',
    REVOGADO_EM = NULL,
    REVOGADO_POR = NULL
WHERE TIPO = 'CENTRO_CUSTO'
  AND VALOR = 'QUALIDADE'
  AND AREA = 'aurora.conhecimento'
  AND ATIVO = 0;

IF NOT EXISTS (
    SELECT 1 FROM dbo.TB_PERMISSAO_VISAO
    WHERE TIPO = 'CENTRO_CUSTO'
      AND VALOR = 'QUALIDADE'
      AND AREA = 'aurora.conhecimento'
      AND ATIVO = 1
)
BEGIN
    INSERT INTO dbo.TB_PERMISSAO_VISAO (TIPO, VALOR, AREA, CRIADO_POR)
    VALUES ('CENTRO_CUSTO', 'QUALIDADE', 'aurora.conhecimento',
            'SETUP-TREINAMENTOS');
END;

-- ------------------------------------------------------------------ --
-- Conferencia
-- ------------------------------------------------------------------ --
SELECT 'area' AS ORIGEM, AREA, DESCRICAO, ATIVO, NULL AS TIPO, NULL AS VALOR
FROM dbo.TB_PERMISSAO_AREA
WHERE AREA = 'aurora.conhecimento'
UNION ALL
SELECT 'concessao', AREA, NULL, ATIVO, TIPO, VALOR
FROM dbo.TB_PERMISSAO_VISAO
WHERE AREA = 'aurora.conhecimento';
