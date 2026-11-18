# Relatório diário do Aurora Insight

O worker `src/workers/aurora_insight_daily_report.py` gera o fechamento do dia
anterior e envia um e-mail HTML. O destinatário inicial de teste é
`colaborador04@empresa.example`.

Domingo não é considerado dia operacional. A execução automática de domingo é
ignorada e, na segunda-feira, o fechamento enviado é o de sábado, comparado com
sexta-feira. O parâmetro manual `--date` continua aceitando qualquer data.

O e-mail contém métricas, temas, centros de custo, ranking de uso e feedbacks.
O texto bruto das perguntas não é incluído, pois pode conter dados de clientes.

## O que o e-mail mostra

Cada carteira aparece com os números do dia e com o acumulado do mês corrente
(do dia 1 até a data do fechamento), nas colunas `Perguntas/mês` e `Colab./mês`.

Não há quebra por supervisor, coordenador ou gerente. Ela chegou a existir e foi
removida: a única fonte com cobertura, `login.TB_USUARIOS.SUPERVISOR`, é texto
livre sem manutenção — guarda nome de quem já saiu, nome truncado em 30
caracteres e nome que não corresponde a colaborador nenhum. Numa amostra de um
dia, 3 dos 11 supervisores exibidos não existiam no cadastro, 1 estava inativo e
1 era gerente, não supervisor.

O substituto certo é `EXPORTDATAV3.dbo.AgentSupervisor`, do OLOS: liga agente e
supervisor por ID, é atualizada continuamente e os IDs apontam de fato para
cargos de supervisão. Falta resolver o nome por trás do `SupervisorId`, o que
depende de uma destas duas coisas:

- a tabela `ConfigUsers` do OLOS ser populada (hoje tem 0 linhas no servidor de
  cobrança e é inacessível no de vega) — ela traria `UserName` e ainda os
  campos `flag_Supervisor` e `flag_Manager`, que abririam o nível de gerência; ou
- `ID_OLOS_COB` ser preenchido em `login.TB_USUARIOS` para os 45 supervisores que
  estão sem, o que levaria a cobertura de 36% para perto de 100%.

O código dessa quebra está no histórico do git, se for preciso retomar.

## De onde vem a carteira

A carteira de cada pergunta é resolvida na hora em que o operador pergunta, pela
`SP_VERIFICA_CARTEIRA_COPILOT`, e gravada em `TB_CHAT_MENSAGENS_IA.CENTRO_CUSTO`.
Perguntas sem carteira são descartadas de todos os agrupamentos por carteira, no
e-mail e no painel.

A SP lê o estado ao vivo do discador: quando o operador não está ativo no OLOS
naquele instante ela volta vazia. Por isso `DadosOperadoresService.obter_carteira_do_operador`
herda a última carteira que o próprio operador teve nos últimos
`IADesempenhoRepository.DIAS_ULTIMA_CARTEIRA` dias. O `CENTRO_CUSTO` do cadastro
**não** serve de alternativa: ele discorda da carteira OLOS na maior parte dos
registros, e não só na grafia — há operador com `MU` no cadastro atendendo
`TETA ACO` no discador.

Sobra o caso do operador sem nenhum id OLOS no cadastro, em que a SP não tem o
que consultar. Esse é um furo de cadastro e só se resolve preenchendo
`ID_OLOS_CX` ou `ID_OLOS_COB` em `login.TB_USUARIOS`.

Perguntas anteriores a 13/05/2026 não têm carteira: os ids OLOS passaram a ser
enviados nessa data. Esse histórico não é recuperável.

O rodapé traz o glossário dos temas. A lista vive em
`src/shared/ia/temas_perguntas.py` e é a mesma que o classificador usa em
`IADesempenhoService._classificar_pergunta` — alterar um tema ali muda o prompt,
a validação e o glossário de uma vez só.

## Configuração

Copie as variáveis de `.env.email.example` para o `.env` do backend e configure
o remetente. O domínio `empresa.example` usa Google Workspace.

Há duas opções suportadas:

1. Relay SMTP do Google Workspace autorizado pelo IP do servidor. Nesse caso,
   use `SMTP_HOST=smtp-relay.gmail.com`, configure `EMAIL_FROM` e deixe
   `SMTP_USERNAME`/`SMTP_PASSWORD` vazios.
2. Conta Google Workspace com autenticação SMTP. Use
   `SMTP_HOST=smtp.gmail.com` e configure `SMTP_USERNAME`, `SMTP_PASSWORD` com
   uma senha de app e `EMAIL_FROM`.

Nunca versione credenciais reais.

## Validação sem envio

No diretório `backend`:

```powershell
python src\workers\aurora_insight_daily_report.py --dry-run --output .tmp\aurora-insight-preview.html
```

Para enviar um teste real referente a uma data específica:

```powershell
python src\workers\aurora_insight_daily_report.py --date 2026-07-26
```

O worker registra a execução na tabela
`TB_AURORA_INSIGHT_EMAIL_EXECUCAO`. Uma segunda execução para a mesma data e
lista de destinatários é ignorada. Use `--force` somente para um reenvio
intencional.

## Agendamento no Windows

Execute o PowerShell como a conta que manterá acesso ao backend e ao banco:

```powershell
.\scripts\register_aurora_insight_daily_task.ps1
```

A tarefa é registrada para 08:00 e usa o Python encontrado no `PATH`. Para
apontar para um ambiente virtual:

```powershell
.\scripts\register_aurora_insight_daily_task.ps1 -PythonExecutable "C:\caminho\python.exe"
```

Em Linux, configure o mesmo comando em um `cron` ou `systemd timer` às 08:00 no
fuso horário de São Paulo.
