# Auditoria de atendimento

## Preparação

1. Revise e execute `backend/sql/auditoria/001_criar_estrutura_auditoria.sql` no banco `DB_COPILOT_ACME`.
2. Revise o conteúdo Delta e, após aprovação, execute `002_configuracao_delta_rascunho.sql`.
3. Copie as variáveis de `backend/.env.auditoria.example` para o `.env` já usado pelo backend.
4. Garanta que `AUDITORIA_STORAGE_PATH` aponte para um diretório privado e persistente em produção.

## Execução

Em desenvolvimento, `AUDITORIA_EMBEDDED_WORKER=true` inicia um worker daemon junto ao Flask.

Em produção, use um processo separado para o worker:

```powershell
$env:AUDITORIA_EMBEDDED_WORKER='false'
python main.py
```

Em outro processo:

```powershell
python -m src.workers.auditoria_worker
```

Execute ambos a partir do diretório `backend`.

## Endpoints

- `POST /auditorias` — multipart com `audio`, `data_ligacao` e metadados opcionais.
- `GET /auditorias/{id}/status` — andamento e erro público.
- `GET /auditorias/{id}` — resultado estruturado e transcrição.
- `GET /auditorias/{id}/audio` — streaming autenticado do áudio.
- `GET /auditorias` — histórico paginado conforme permissão.
- `POST /auditorias/{id}/reprocessar` — reprocessamento restrito.
- `GET /auditorias/configuracoes/{carteiraId}` — versão/configuração ativa.

## Segurança

- O CPF do JWT é a fonte de identidade.
- Operador e carteira são revalidados no banco.
- Arquivos recebem nome interno aleatório e ficam fora de diretórios públicos.
- Transcrições e dados pessoais não são registrados em logs.
- O limite padrão de upload é 25 MB.
- A política de retenção e descarte ainda deve ser definida com Segurança/Privacidade.

## Critérios Delta

A versão `DELTA-MVP-2026.1` usa o checklist Delta Voz e os registros Delta de
`aurora_base_conhecimento.json`. Ela está marcada como conteúdo interno a validar. A área de
treinamento deve confirmar pesos, vigência, frases obrigatórias/proibidas e regras críticas.

