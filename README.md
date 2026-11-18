# Operator Copilot

> **Versão de portfólio.** Código real de produção, anonimizado: nomes de empresa, clientes, pessoas, hosts, e-mails e credenciais foram trocados por valores fictícios (`Acme`, `Banco Alfa`, `10.0.0.x`, `empresa.example`). Toda configuração sensível vem do `.env` (modelo em `.env.example`). O código não aponta para nenhum sistema real.

Plataforma web para operadores e gestores de uma central de atendimento/cobrança. Reúne roteiros de atendimento, simulação e registro de acordos, consulta de clientes, chat e monitoria de WhatsApp, auditoria de ligações com IA (transcrição + análise), assistente virtual com RAG sobre uma base de conhecimento, dashboards de resultado, gamificação (arena, quiz, álbum) e trilhas de treinamento.

**Stack:** Python, Flask, Flask-SocketIO, JWT, pyodbc/SQL Server, OpenAI API, Twilio, React + Vite + TypeScript, TanStack Query, Tailwind, shadcn/ui, Recharts

## Destaques

- Backend em camadas (`routes` → `application/services` → `infrastructure/repositories`), com testes em `src/tests`.
- Assistente com busca híbrida (vetorial + lexical) sobre a base de conhecimento (`shared/ia`).
- Worker de auditoria de atendimento: transcrição, análise e coaching gerados por IA.
- Controle de permissões por perfil/área e eventos em tempo real via WebSocket.

## Estrutura

```text
operator-copilot/
├── backend/
│   ├── migrations/
│   ├── scripts/
│   │   └── sql/
│   ├── src/
│   │   ├── application/
│   │   ├── domain/
│   │   ├── extensions/
│   │   ├── infrastructure/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── schemas/
│   │   ├── shared/
│   │   ├── tests/
│   │   └── workers/
│   ├── static/
│   │   └── chat_images/
│   └── uploads/
│       └── quality_wallet_logos/
├── docs/
└── frontend/
    ├── scripts/
    └── src/
        ├── components/
        ├── config/
        ├── context/
        ├── hooks/
        ├── lib/
        ├── modules/
        ├── pages/
        ├── services/
        ├── tour/
        ├── types/
        └── utils/
```

## Como executar

```bash
cd backend && pip install -r requirements.txt && python main.py
cd frontend && npm install && npm run dev
```
