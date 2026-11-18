# Modelo de dados de Feedback de Qualidade para BI

Este documento explica as tabelas usadas para analise dos feedbacks de qualidade gerados no Copilot. O objetivo e orientar o time de BI sobre a funcao de cada tabela, a granularidade dos dados, os relacionamentos recomendados e exemplos de uso.

## Visao geral

O fluxo de monitoria grava dados em tres tabelas principais:

| Tabela | Granularidade | Principal uso |
| --- | --- | --- |
| `dbo.TB_FEEDBACK_QUALIDADE` | 1 linha por feedback/monitoria | Indicadores gerais, cabecalho da avaliacao e dados do operador |
| `dbo.TB_FEEDBACK_QUALIDADE_ITENS` | 1 linha por item avaliado dentro de cada feedback | Ranking de ofensores, analise de NOK, NCG e procedimentos |
| `dbo.TB_FEEDBACK_QUALIDADE_RESPOSTAS` | 1 linha por feedback, com cada item em uma coluna | Matriz tabular, visao larga por monitoria e comparacoes lado a lado |

As tres tabelas se relacionam pelo campo `ID_FEEDBACK`.

Modelo recomendado:

```text
dbo.TB_FEEDBACK_QUALIDADE[ID_FEEDBACK]
    1 -> N
dbo.TB_FEEDBACK_QUALIDADE_ITENS[ID_FEEDBACK]

dbo.TB_FEEDBACK_QUALIDADE[ID_FEEDBACK]
    1 -> 1
dbo.TB_FEEDBACK_QUALIDADE_RESPOSTAS[ID_FEEDBACK]
```

## 1. `dbo.TB_FEEDBACK_QUALIDADE`

Tabela principal do feedback. Cada linha representa uma monitoria enviada por um monitor de qualidade para um operador.

### Quando usar

Use esta tabela para indicadores em nivel de feedback, operador, monitor, carteira ou periodo.

Exemplos:

- total de feedbacks enviados;
- media de pontuacao;
- feedbacks por operador;
- feedbacks por monitor;
- feedbacks por carteira/canal;
- taxa de leitura;
- taxa de ciencia;
- evolucao de pontuacao ao longo do tempo.

### Colunas principais

| Coluna | Funcao |
| --- | --- |
| `ID_FEEDBACK` | Identificador unico do feedback. Chave para relacionar com as outras tabelas. |
| `OPERADOR` | Nome do operador avaliado. |
| `CPF_OPERADOR` | CPF do operador avaliado. Melhor campo para relacionamento com bases de RH/operadores. |
| `DATA_HORA` | Data e hora da ligacao ou atendimento monitorado. |
| `ID_LIGACAO` | Codigo/EC da ligacao ou atendimento. |
| `DESCRICAO` | Resumo textual da monitoria. Mantido para leitura humana e compatibilidade, mas nao deve ser a base principal do BI. |
| `PONTOS_POSITIVOS` | Texto livre com pontos positivos informados pelo monitor. |
| `PONTOS_MELHORAR` | Texto livre com pontos de melhoria informados pelo monitor. |
| `PONTUACAO` | Nota final da monitoria. |
| `IS_POSITIVO` | Indicador booleano do resultado geral. Normalmente `1` para positivo e `0` para negativo. |
| `MONITOR_NOME` | Nome do monitor que criou o feedback. |
| `DATA_REGISTRO` | Data em que o feedback foi salvo no sistema. |
| `LIDO` | Indica se o operador abriu/leu o feedback. |
| `AUDIO_PATH` | Caminho do arquivo de audio anexado, quando houver. |
| `CIENTE` | Indica se o operador confirmou ciencia do feedback. |
| `CIENTE_EM` | Data/hora da confirmacao de ciencia. |
| `CIENTE_CPF` | CPF usado na confirmacao de ciencia. |
| `CARTEIRA_ID` | Codigo interno da carteira monitorada, por exemplo `delta` ou `gama`. |
| `CARTEIRA_LABEL` | Nome amigavel da carteira, por exemplo `Banco Delta`. |
| `CANAL_ID` | Codigo interno do canal/produto, por exemplo `voz`, `chat`, `gama`. |
| `CANAL_LABEL` | Nome amigavel do canal/produto. |
| `TEMPO_LIGACAO_TOTAL` | Tempo total da ligacao, quando aplicavel. |
| `CHECKLIST_ID` | Codigo do checklist usado na monitoria, por exemplo `delta-voz`. |
| `NOTA_BASE` | Pontos obtidos antes de penalidades de NCG. |
| `NOTA_MAXIMA` | Pontuacao maxima possivel no checklist. |
| `PENALIDADE_NCG` | Soma das penalidades por NCG marcada. |
| `ADERENCIA_PERCENTUAL` | Percentual de aderencia ao checklist, antes/independente da penalidade final. |
| `QTD_NCG` | Quantidade de NCGs marcadas. |
| `CHECKLIST_JSON` | Estrutura antiga/compatibilidade com o front-end. Evitar usar como fonte principal no BI. |

### Exemplo de uso

Media de pontuacao por carteira e canal:

```sql
SELECT
    CARTEIRA_LABEL,
    CANAL_LABEL,
    COUNT(*) AS TOTAL_FEEDBACKS,
    AVG(CAST(PONTUACAO AS FLOAT)) AS MEDIA_PONTUACAO
FROM dbo.TB_FEEDBACK_QUALIDADE WITH (NOLOCK)
GROUP BY
    CARTEIRA_LABEL,
    CANAL_LABEL
ORDER BY MEDIA_PONTUACAO DESC;
```

## 2. `dbo.TB_FEEDBACK_QUALIDADE_ITENS`

Tabela detalhada dos itens avaliados. Cada feedback gera varias linhas nesta tabela, uma para cada procedimento/item do checklist.

Exemplo: se um checklist tem 20 itens, uma monitoria gera:

- 1 linha em `TB_FEEDBACK_QUALIDADE`;
- 20 linhas em `TB_FEEDBACK_QUALIDADE_ITENS`;
- 1 linha em `TB_FEEDBACK_QUALIDADE_RESPOSTAS`.

### Quando usar

Esta e a principal tabela para analise de ofensores.

Use para responder perguntas como:

- quais itens mais aparecem como `NOK`;
- quais NCGs mais aparecem;
- qual operador mais falha em determinado procedimento;
- qual carteira/canal concentra mais ofensores;
- quais blocos do checklist mais geram perda de pontos;
- evolucao de um item especifico ao longo do tempo.

### Colunas principais

| Coluna | Funcao |
| --- | --- |
| `ID_ITEM` | Identificador unico da linha do item avaliado. |
| `ID_FEEDBACK` | Identificador do feedback de origem. Relaciona com `TB_FEEDBACK_QUALIDADE`. |
| `CHECKLIST_ID` | Checklist aplicado. |
| `CARTEIRA_ID` | Codigo interno da carteira. |
| `CARTEIRA_LABEL` | Nome da carteira. |
| `CANAL_ID` | Codigo interno do canal/produto. |
| `CANAL_LABEL` | Nome do canal/produto. |
| `BLOCO_ID` | Codigo interno do bloco do checklist. |
| `BLOCO_TITULO` | Nome do bloco, por exemplo `Abertura`, `Procedimento`, `Finalizacao`, `NCG`. |
| `ITEM_ID` | Codigo interno do item do checklist. |
| `ITEM_TITULO` | Nome do item avaliado, por exemplo `Sondagem` ou `Encerramento`. |
| `ITEM_DESCRICAO` | Descricao/regra do item avaliado. |
| `PESO` | Peso do item na nota. NCGs normalmente possuem peso negativo. |
| `TIPO_ITEM` | Tipo do item: `CHECKLIST` para itens normais ou `NCG` para nao conformidade grave. |
| `STATUS_RESPOSTA` | Resultado do item: `OK`, `NOK`, `NCG` ou `NAO_APLICADO`. |
| `CONFORME` | Para itens normais: `1` se foi feito, `0` se nao foi feito. Para NCG, fica `NULL`. |
| `NCG_MARCADA` | Para NCG: `1` se foi marcada, `0` se nao foi marcada. |
| `PONTOS_OBTIDOS` | Pontos obtidos ou penalizados naquele item. |
| `ORDEM_BLOCO` | Ordem do bloco no checklist. |
| `ORDEM_ITEM` | Ordem do item dentro do bloco. |
| `DATA_REGISTRO` | Data de insercao do item no banco. |

### Valores esperados em `STATUS_RESPOSTA`

| Valor | Significado |
| --- | --- |
| `OK` | O procedimento foi realizado corretamente. |
| `NOK` | O procedimento nao foi realizado ou ficou em desconformidade. |
| `NCG` | Uma nao conformidade grave foi marcada. |
| `NAO_APLICADO` | Uma NCG nao foi marcada. |

### Exemplo de uso

Ranking de ofensores:

```sql
SELECT
    CARTEIRA_LABEL,
    CANAL_LABEL,
    BLOCO_TITULO,
    ITEM_TITULO,
    COUNT(*) AS TOTAL_OCORRENCIAS
FROM dbo.TB_FEEDBACK_QUALIDADE_ITENS WITH (NOLOCK)
WHERE STATUS_RESPOSTA IN ('NOK', 'NCG')
GROUP BY
    CARTEIRA_LABEL,
    CANAL_LABEL,
    BLOCO_TITULO,
    ITEM_TITULO
ORDER BY TOTAL_OCORRENCIAS DESC;
```

Ofensores por operador:

```sql
SELECT
    F.OPERADOR,
    I.CARTEIRA_LABEL,
    I.CANAL_LABEL,
    I.ITEM_TITULO,
    COUNT(*) AS TOTAL_OCORRENCIAS
FROM dbo.TB_FEEDBACK_QUALIDADE_ITENS I WITH (NOLOCK)
INNER JOIN dbo.TB_FEEDBACK_QUALIDADE F WITH (NOLOCK)
    ON F.ID_FEEDBACK = I.ID_FEEDBACK
WHERE I.STATUS_RESPOSTA IN ('NOK', 'NCG')
GROUP BY
    F.OPERADOR,
    I.CARTEIRA_LABEL,
    I.CANAL_LABEL,
    I.ITEM_TITULO
ORDER BY TOTAL_OCORRENCIAS DESC;
```

## 3. `dbo.TB_FEEDBACK_QUALIDADE_RESPOSTAS`

Tabela em formato largo. Cada linha representa um feedback, e cada procedimento do checklist vira uma coluna.

Exemplo conceitual:

| ID_FEEDBACK | OPERADOR | ITEM_IDENTIFICACAO | ITEM_SONDAGEM | ITEM_ENCERRAMENTO |
| --- | --- | --- | --- | --- |
| 466 | Mariana Viana Souza | OK | NOK | NOK |

### Quando usar

Use esta tabela quando o BI precisar de uma matriz parecida com planilha, onde cada procedimento aparece como coluna.

Exemplos:

- comparar monitorias lado a lado;
- filtrar feedbacks que tiveram `NOK` em uma coluna especifica;
- montar uma tabela operacional com todos os procedimentos;
- exportar base aberta para analise manual.

Para ranking de ofensores, a tabela `TB_FEEDBACK_QUALIDADE_ITENS` costuma ser melhor, porque evita tratar dezenas de colunas dinamicas.

### Colunas fixas

| Coluna | Funcao |
| --- | --- |
| `ID_FEEDBACK` | Identificador do feedback. Relaciona com `TB_FEEDBACK_QUALIDADE`. |
| `OPERADOR` | Nome do operador avaliado. |
| `CPF_OPERADOR` | CPF do operador avaliado. |
| `DATA_HORA` | Data/hora da ligacao ou atendimento monitorado. |
| `ID_LIGACAO` | Codigo/EC da ligacao ou atendimento. |
| `MONITOR_NOME` | Nome do monitor que criou o feedback. |
| `CARTEIRA_ID` | Codigo interno da carteira. |
| `CARTEIRA_LABEL` | Nome da carteira. |
| `CANAL_ID` | Codigo interno do canal/produto. |
| `CANAL_LABEL` | Nome do canal/produto. |
| `CHECKLIST_ID` | Checklist aplicado. |
| `PONTUACAO` | Nota final da monitoria. |
| `IS_POSITIVO` | Indicador de feedback positivo ou negativo. |
| `TEMPO_LIGACAO_TOTAL` | Tempo total da ligacao, quando aplicavel. |
| `DATA_REGISTRO` | Data de gravacao da linha. |

### Colunas dinamicas dos itens

As colunas dos procedimentos sao criadas automaticamente a partir do `ITEM_ID` do checklist.

Exemplos:

| Coluna | Origem |
| --- | --- |
| `ITEM_IDENTIFICACAO` | Item `identificacao`. |
| `ITEM_APRESENTACAO` | Item `apresentacao`. |
| `ITEM_SONDAGEM` | Item `sondagem`. |
| `ITEM_SELO_NEGOCIO` | Item `selo-negocio`. |
| `ITEM_ENCERRAMENTO` | Item `encerramento`. |
| `ITEM_COMPORTAMENTO_INADEQUADO` | Item de NCG `comportamento-inadequado`. |

Valores possiveis nas colunas de item:

| Valor | Significado |
| --- | --- |
| `OK` | Procedimento realizado. |
| `NOK` | Procedimento nao realizado. |
| `NCG` | NCG marcada. |
| `NAO_APLICADO` | NCG nao marcada. |

### Exemplo de uso

Buscar feedbacks em que houve falha em sondagem:

```sql
SELECT
    ID_FEEDBACK,
    OPERADOR,
    DATA_HORA,
    CARTEIRA_LABEL,
    CANAL_LABEL,
    PONTUACAO,
    ITEM_SONDAGEM
FROM dbo.TB_FEEDBACK_QUALIDADE_RESPOSTAS WITH (NOLOCK)
WHERE ITEM_SONDAGEM = 'NOK';
```

## Recomendacao de modelagem no Power BI

### Tabela fato principal

Use `TB_FEEDBACK_QUALIDADE` como fato principal para metricas gerais de monitoria.

Medidas comuns:

```text
Total Feedbacks = COUNTROWS(TB_FEEDBACK_QUALIDADE)
Media Pontuacao = AVERAGE(TB_FEEDBACK_QUALIDADE[PONTUACAO])
Total NCG = SUM(TB_FEEDBACK_QUALIDADE[QTD_NCG])
Taxa Positiva = DIVIDE(COUNTROWS(FILTER(TB_FEEDBACK_QUALIDADE, TB_FEEDBACK_QUALIDADE[IS_POSITIVO] = 1)), COUNTROWS(TB_FEEDBACK_QUALIDADE))
```

### Tabela para ofensores

Use `TB_FEEDBACK_QUALIDADE_ITENS` para graficos de barras, rankings e matrizes de ofensores.

Filtros recomendados:

```text
STATUS_RESPOSTA IN ('NOK', 'NCG')
```

Campos recomendados para dimensoes:

- `CARTEIRA_LABEL`;
- `CANAL_LABEL`;
- `BLOCO_TITULO`;
- `ITEM_TITULO`;
- `TIPO_ITEM`;
- `MONITOR_NOME` via relacionamento com `TB_FEEDBACK_QUALIDADE`;
- `OPERADOR` via relacionamento com `TB_FEEDBACK_QUALIDADE`.

### Tabela para visao larga

Use `TB_FEEDBACK_QUALIDADE_RESPOSTAS` para tabelas operacionais e exportacoes, especialmente quando o usuario final quer ver cada criterio em uma coluna.

## Por que nao criar uma tabela por carteira?

Nao e recomendado criar uma tabela por carteira, porque:

- cada carteira nova exigiria nova tabela;
- cada canal novo exigiria nova logica;
- mudancas no checklist quebrariam o modelo;
- o BI ficaria com varias fontes quase iguais;
- comparacoes entre carteiras ficariam mais dificeis;
- aumentaria a chance de divergencia de regra entre tabelas.

O modelo atual e mais flexivel:

- `CARTEIRA_ID` e `CANAL_ID` separam as operacoes;
- `CHECKLIST_ID` identifica qual formulario foi usado;
- `TB_FEEDBACK_QUALIDADE_ITENS` permite ranking de ofensores sem depender de colunas fixas;
- `TB_FEEDBACK_QUALIDADE_RESPOSTAS` atende a necessidade de procedimentos em colunas.

## Observacao sobre dados antigos

Feedbacks gravados antes da criacao das tabelas novas podem existir somente na `TB_FEEDBACK_QUALIDADE`, com detalhes em `DESCRICAO` e/ou `CHECKLIST_JSON`.

Se for necessario analisar historico antigo no mesmo modelo, sera preciso executar um backfill para popular:

- `TB_FEEDBACK_QUALIDADE_ITENS`;
- `TB_FEEDBACK_QUALIDADE_RESPOSTAS`.

Para feedbacks novos, as tres tabelas passam a ser preenchidas automaticamente.
