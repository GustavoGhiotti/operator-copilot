import type { AuditoriaResult } from "../types/auditoria.types";

export function createAuditoriaMock(operador: string): AuditoriaResult {
  return {
    notaGeral: 82,
    classificacao: "Bom atendimento",
    resumoAtendimento:
      "A ligação teve uma abertura clara e comunicação respeitosa. A principal oportunidade está em investigar a capacidade de pagamento antes de apresentar uma condição.",
    duracaoSegundos: 278,
    operador: operador || "Operador não informado",
    carteira: "Banco Delta",
    dataAnalise: new Date().toLocaleString("pt-BR"),
    confiancaAnalise: 0.91,
    proximaMelhorAcao:
      "Antes de apresentar uma nova proposta, investigue qual valor mensal o cliente consegue assumir com segurança.",
    pontosPositivos: [
      {
        titulo: "Apresentação objetiva",
        descricao:
          "O operador informou o próprio nome e contextualizou a instituição representada.",
      },
      {
        titulo: "Condução respeitosa",
        descricao:
          "O tom permaneceu cordial mesmo diante da resistência inicial do cliente.",
      },
    ],
    pontosMelhoria: [
      {
        titulo: "Aprofundar a sondagem",
        descricao:
          "A proposta foi apresentada antes de compreender a disponibilidade mensal do cliente.",
        exemploMelhorado:
          "Para eu buscar uma condição mais adequada, qual valor mensal ficaria confortável no seu orçamento?",
      },
    ],
    alertasCriticos: [],
    categorias: [
      {
        codigo: "ABERTURA",
        nome: "Abertura",
        nota: 92,
        status: "ATENDEU",
        justificativa: "A apresentação ocorreu de forma clara e direta.",
        orientacao: "Mantenha o mesmo padrão de objetividade.",
        evidencias: [
          {
            id: "ev-1",
            inicioSegundos: 2,
            fimSegundos: 9,
            texto: "Bom dia, meu nome é João e falo em nome do Banco Delta.",
          },
        ],
      },
      {
        codigo: "COMUNICACAO",
        nome: "Comunicação e clareza",
        nota: 87,
        status: "ATENDEU",
        justificativa: "A fala foi respeitosa e de fácil compreensão.",
        orientacao: "Continue usando frases curtas ao explicar condições.",
        evidencias: [],
      },
      {
        codigo: "INVESTIGACAO",
        nome: "Investigação",
        nota: 64,
        status: "PARCIAL",
        justificativa:
          "A condição financeira do cliente não foi aprofundada antes da oferta.",
        orientacao: "Faça ao menos uma pergunta aberta sobre orçamento.",
        evidencias: [
          {
            id: "ev-2",
            inicioSegundos: 76,
            fimSegundos: 91,
            texto: "Eu consigo disponibilizar uma parcela de quatrocentos reais.",
          },
        ],
      },
      {
        codigo: "NEGOCIACAO",
        nome: "Negociação",
        nota: 78,
        status: "PARCIAL",
        justificativa: "Houve proposta, mas faltou conectá-la à realidade relatada.",
        orientacao: "Relacione a oferta à capacidade indicada pelo cliente.",
        evidencias: [],
      },
      {
        codigo: "ENCERRAMENTO",
        nome: "Encerramento",
        nota: 88,
        status: "ATENDEU",
        justificativa: "Os próximos passos foram recapitulados com cordialidade.",
        orientacao: "Confirme também se restou alguma dúvida.",
        evidencias: [],
      },
      {
        codigo: "COMPLIANCE",
        nome: "Compliance",
        nota: 100,
        status: "ATENDEU",
        justificativa: "Nenhuma quebra crítica foi identificada nesta demonstração.",
        orientacao: "Mantenha a confirmação segura antes de expor informações.",
        evidencias: [],
      },
    ],
    transcricao: [
      {
        id: "seg-1",
        ordem: 1,
        inicioSegundos: 2,
        fimSegundos: 9,
        interlocutor: "Operador",
        texto: "Bom dia, meu nome é João e falo em nome do Banco Delta.",
        evidencia: true,
      },
      {
        id: "seg-2",
        ordem: 2,
        inicioSegundos: 10,
        fimSegundos: 14,
        interlocutor: "Cliente",
        texto: "Sobre o que seria?",
      },
      {
        id: "seg-3",
        ordem: 3,
        inicioSegundos: 76,
        fimSegundos: 91,
        interlocutor: "Operador",
        texto: "Eu consigo disponibilizar uma parcela de quatrocentos reais.",
        evidencia: true,
      },
      {
        id: "seg-4",
        ordem: 4,
        inicioSegundos: 92,
        fimSegundos: 103,
        interlocutor: "Cliente",
        texto: "Esse valor ainda fica pesado para mim neste mês.",
      },
    ],
  };
}

