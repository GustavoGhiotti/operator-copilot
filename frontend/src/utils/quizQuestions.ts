export interface QuizAnswer {
  text: string;
  points: 100 | 50 | 0;
  explanation: string;
}

export interface QuizQuestion {
  question: string;
  answers: QuizAnswer[];
}

export interface QuizThemeData {
  id: string;
  title: string;
  description: string;
  questions: QuizQuestion[][];
}

const quizData: QuizThemeData[] = [
  {
    id: "argumentacao",
    title: "Argumentação",
    description: "Técnicas para apresentar argumentos convincentes",
    questions: [
      [
        {
          question: "Qual é a melhor abordagem inicial ao contatar um devedor?",
          answers: [
            {
              text: "Apresentar-se e explicar o motivo da ligação de forma clara e respeitosa",
              points: 100,
              explanation:
                "A transparência e respeito desde o início constroem confiança e aumentam as chances de negociação.",
            },
            {
              text: "Começar direto falando sobre a dívida sem se apresentar",
              points: 0,
              explanation:
                "Isso pode assustar o cliente e criar resistência desde o início.",
            },
            {
              text: "Mencionar consequências legais logo de início",
              points: 0,
              explanation:
                "Começar com ameaças cria um ambiente hostil e dificulta a negociação.",
            },
            {
              text: "Perguntar sobre a situação financeira antes de se apresentar",
              points: 50,
              explanation:
                "Embora demonstre interesse, é mais profissional se apresentar primeiro.",
            },
          ],
        },
        {
          question:
            "Como você deve estruturar sua argumentação para convencer o devedor a quitar?",
          answers: [
            {
              text: "Benefícios da quitação → Consequências da inadimplência → Soluções personalizadas",
              points: 100,
              explanation:
                "Esta sequência mostra valor positivo primeiro, depois a urgência, e finaliza com soluções práticas.",
            },
            {
              text: "Ameaças → Pressão → Ultimato",
              points: 0,
              explanation:
                "Abordagem agressiva que pode levar à ruptura da negociação e problemas legais.",
            },
            {
              text: "Apenas explicar as consequências legais",
              points: 50,
              explanation:
                "Importante, mas limitado. Não oferece incentivos positivos nem soluções.",
            },
            {
              text: "Falar apenas dos benefícios sem mencionar consequências",
              points: 50,
              explanation:
                "Falta o senso de urgência necessário para motivar a ação.",
            },
          ],
        },
        {
          question:
            "Qual argumento é mais eficaz para justificar um desconto na negociação?",
          answers: [
            {
              text: "O desconto é uma oportunidade única para regularizar a situação rapidamente",
              points: 100,
              explanation:
                "Posiciona o desconto como benefício exclusivo e cria urgência legítima.",
            },
            {
              text: "Dar desconto porque a empresa precisa do dinheiro",
              points: 0,
              explanation:
                "Demonstra fraqueza e pode levar o cliente a pedir descontos maiores.",
            },
            {
              text: "O desconto evita que o nome fique sujo",
              points: 50,
              explanation:
                "É um benefício real, mas foca no negativo. Melhor destacar o aspecto positivo.",
            },
            {
              text: "Oferecer desconto sem justificativa",
              points: 50,
              explanation:
                "Pode funcionar, mas desperdiça a oportunidade de agregar valor à oferta.",
            },
          ],
        },
      ],
      // Dia 2
      [
        {
          question:
            "Como argumentar quando o cliente diz que não tem dinheiro?",
          answers: [
            {
              text: "Compreender a situação e oferecer opções de parcelamento adequadas",
              points: 100,
              explanation:
                "Demonstra empatia e foca em soluções, mantendo a negociação viva.",
            },
            {
              text: "Insistir que ele deve ter dinheiro guardado em algum lugar",
              points: 0,
              explanation:
                "Pode ofender o cliente e quebrar a confiança na negociação.",
            },
            {
              text: "Oferecer apenas um desconto maior",
              points: 50,
              explanation:
                "Pode ajudar, mas não resolve o problema de fluxo de vega do cliente.",
            },
            {
              text: "Sugerir que ele peça dinheiro emprestado",
              points: 50,
              explanation:
                "Pode ser uma opção, mas deve ser sugerida com cuidado para não soar invasiva.",
            },
          ],
        },
      ],
    ],
  },
  {
    id: "gatilhos",
    title: "Gatilhos Mentais",
    description: "Técnicas psicológicas para influenciar decisões",
    questions: [
      // Dia 1
      [
        {
          question:
            "Qual gatilho mental é mais eficaz para criar urgência na quitação?",
          answers: [
            {
              text: "Escassez temporal: 'Esta condição especial é válida apenas até o final do dia'",
              points: 100,
              explanation:
                "A escassez temporal é um gatilho poderoso que motiva decisões rápidas de forma ética.",
            },
            {
              text: "Ameaça: 'Se não pagar hoje, vai para o judiciário'",
              points: 0,
              explanation:
                "Ameaças podem ser consideradas coação e prejudicar a relação comercial.",
            },
            {
              text: "Culpa: 'Você está prejudicando nossa empresa'",
              points: 0,
              explanation:
                "Usar culpa pode gerar resistência e tornar o cliente defensivo.",
            },
            {
              text: "Comparação social: 'Outros clientes conseguiram pagar'",
              points: 50,
              explanation:
                "Pode funcionar, mas deve ser usado com cuidado para não humilhar o cliente.",
            },
          ],
        },
      ],
    ],
  },
  {
    id: "tom-voz",
    title: "Tom de Voz",
    description: "Como usar a voz para transmitir confiança",
    questions: [
      // Dia 1
      [
        {
          question:
            "Qual tom de voz é mais apropriado ao falar sobre consequências legais?",
          answers: [
            {
              text: "Sério, mas respeitoso e informativo",
              points: 100,
              explanation:
                "Transmite a importância da informação sem soar ameaçador.",
            },
            {
              text: "Agressivo e intimidador",
              points: 0,
              explanation: "Pode assustar o cliente e prejudicar a negociação.",
            },
            {
              text: "Muito casual e descontraído",
              points: 0,
              explanation: "Não transmite a seriedade necessária do assunto.",
            },
            {
              text: "Triste e preocupado",
              points: 50,
              explanation:
                "Demonstra preocupação genuína, mas pode não transmitir profissionalismo.",
            },
          ],
        },
      ],
    ],
  },
  {
    id: "sondagem",
    title: "Sondagem",
    description: "Técnicas para descobrir necessidades do cliente",
    questions: [
      // Dia 1
      [
        {
          question:
            "Qual pergunta é mais eficaz para entender a capacidade de pagamento?",
          answers: [
            {
              text: "'Considerando sua situação atual, qual valor você conseguiria quitar hoje?'",
              points: 100,
              explanation:
                "Pergunta direta que foca na capacidade real e no 'hoje', criando urgência.",
            },
            {
              text: "'Quanto você ganha por mês?'",
              points: 0,
              explanation:
                "Muito invasiva e pode gerar resistência ou informações falsas.",
            },
            {
              text: "'Você tem dinheiro para pagar?'",
              points: 50,
              explanation:
                "Muito direta, pode funcionar mas não explora alternativas.",
            },
            {
              text: "'Quando você pretende pagar?'",
              points: 50,
              explanation:
                "Boa para sondagem temporal, mas não explora capacidade de pagamento.",
            },
          ],
        },
      ],
    ],
  },
  {
    id: "relacionamento",
    title: "Relacionamento",
    description: "Como construir confiança duradoura",
    questions: [
      // Dia 1
      [
        {
          question: "Como construir rapport com um devedor resistente?",
          answers: [
            {
              text: "Demonstrar empatia e compreensão pela situação dele",
              points: 100,
              explanation:
                "A empatia genuína quebra barreiras e cria conexão humana.",
            },
            {
              text: "Contar problemas pessoais para criar identificação",
              points: 50,
              explanation:
                "Pode funcionar ocasionalmente, mas não é profissional.",
            },
            {
              text: "Ser muito insistente para mostrar determinação",
              points: 0,
              explanation:
                "Insistência excessiva gera irritação e fecha o diálogo.",
            },
            {
              text: "Falar apenas sobre a dívida",
              points: 0,
              explanation:
                "Não cria conexão pessoal necessária para o rapport.",
            },
          ],
        },
      ],
    ],
  },
  {
    id: "objecoes",
    title: "Tratamento de Objeções",
    description: "Como lidar com resistências do cliente",
    questions: [
      // Dia 1
      [
        {
          question:
            "Cliente diz: 'Não tenho dinheiro'. Qual a melhor resposta?",
          answers: [
            {
              text: "'Entendo sua situação. Vamos ver que alternativas podemos encontrar juntos'",
              points: 100,
              explanation:
                "Reconhece a objeção e propõe trabalhar em conjunto para uma solução.",
            },
            {
              text: "'Todo mundo tem um dinheiro guardado'",
              points: 0,
              explanation: "Invalida a fala do cliente e pode gerar conflito.",
            },
            {
              text: "'Então quando você vai ter?'",
              points: 50,
              explanation: "Pergunta válida, mas poderia ser mais empática.",
            },
            {
              text: "'Esse é problema seu, você que se vire'",
              points: 0,
              explanation: "Extremamente hostil e contraprodutivo.",
            },
          ],
        },
      ],
    ],
  },
];

export const getQuestionsForDay = (themeId: string): QuizQuestion[] => {
  const theme = quizData.find((t) => t.id === themeId);
  if (!theme) return [];

  const today = new Date();
  const dayOfYear = Math.floor(
    (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) /
      (1000 * 60 * 60 * 24)
  );
  const questionSetIndex = dayOfYear % theme.questions.length;

  return theme.questions[questionSetIndex] || [];
};

export const getAllThemes = () => {
  return quizData.map(({ questions, ...theme }) => theme);
};
