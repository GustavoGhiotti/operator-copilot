export type ChecklistAnswer = "yes" | "no" | "na";

export interface ChecklistItemConfig {
  id: string;
  title: string;
  description: string;
  weight: number;
  severe?: boolean;
}

export interface ChecklistBlockConfig {
  id: string;
  title: string;
  description?: string;
  items: ChecklistItemConfig[];
}

export interface ChecklistDefinition {
  id: string;
  label: string;
  walletId: string;
  channelId: string;
  channelLabel: string;
  description: string;
  blocks: ChecklistBlockConfig[];
  configId?: number;
  versionId?: number;
  version?: number;
  walletLogoSrc?: string;
}

export interface QualityWalletConfig {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  logoSrc?: string;
  logoAlt?: string;
  accentClassName: string;
  cardClassName: string;
  enabled: boolean;
  channels: Array<{
    id: string;
    label: string;
    description: string;
    checklistId: string;
  }>;
  matchOperator: (operator: {
    carteira?: string;
    centro_custo?: string;
  }) => boolean;
}

const deltaVoiceChecklist: ChecklistDefinition = {
  id: "delta-voz",
  label: "Delta Voz",
  walletId: "delta",
  channelId: "voz",
  channelLabel: "Voz",
  description:
    "Checklist de monitoria para ligações de voz da operação Delta.",
  blocks: [
    {
      id: "abertura",
      title: "Abertura",
      items: [
        {
          id: "identificacao",
          title: "Identificação",
          description:
            "Confirmou o nome completo do cliente no início do contato.",
          weight: 4,
        },
        {
          id: "apresentacao",
          title: "Apresentação",
          description: "O operador informou o próprio nome de forma clara.",
          weight: 5,
        },
        {
          id: "origem-da-fala",
          title: "Informou de onde fala",
          description:
            "Identificou a empresa e informou que falava em nome do banco Delta.",
          weight: 5,
        },
      ],
    },
    {
      id: "procedimento",
      title: "Procedimento",
      items: [
        {
          id: "apresentacao-divida",
          title: "Apresentação da dívida",
          description:
            "Explicou que o contato era referente ao Consignado Privado e informou a(s) parcela(s) em atraso.",
          weight: 6,
        },
        {
          id: "sondagem",
          title: "Sondagem",
          description:
            "Investigou a condição atual do cliente, como situação financeira e vínculo empregatício.",
          weight: 7,
        },
        {
          id: "negociacao",
          title: "Negociação",
          description:
            "Seguiu a negociação de forma escalonada, cobrindo pagamento total, parcial e renegociação.",
          weight: 8,
        },
        {
          id: "argumentacao",
          title: "Argumentação",
          description:
            "Usou benefícios, senso de urgência, consequências e gatilhos adequados para sustentar a negociação.",
          weight: 10,
        },
        {
          id: "ratificacao",
          title: "Ratificação",
          description:
            "Confirmou vencimento, condições do acordo e o canal de recebimento do boleto com o cliente.",
          weight: 10,
        },
        {
          id: "selo-negocio",
          title: "Selo do negócio",
          description:
            "Buscou a certeza do pagamento e enviou o boleto durante a ligação quando aplicável.",
          weight: 10,
        },
        {
          id: "consequencia-nao-pagamento",
          title: "Consequência do não pagamento",
          description:
            "Explicou as ações caso o pagamento não seja efetuado, como: recorrência de cobrança e incidência de juros e multas.",
          weight: 8,
        },
      ],
    },
    {
      id: "identificacao-positiva",
      title: "Identificação positiva",
      items: [
        {
          id: "identificacao-positiva-item",
          title: "Identificação positiva",
          description:
            "Solicitou a confirmação segura dos dígitos do CPF conforme o procedimento da operação.",
          weight: 10,
        },
        {
          id: "seguranca",
          title: "Segurança",
          description: "Informou ao cliente que a ligação era gravada.",
          weight: 5,
        },
      ],
    },
    {
      id: "finalizacao",
      title: "Finalização",
      items: [
        {
          id: "atualizacao-cadastral",
          title: "Atualização cadastral",
          description:
            "Atualizou ou confirmou e-mail e telefone do cliente ao final do atendimento.",
          weight: 6,
        },
        {
          id: "encerramento",
          title: "Encerramento",
          description:
            "Informou canais de atendimento, verificou dúvidas pendentes e encerrou de forma cordial.",
          weight: 6,
        },
      ],
    },
    {
      id: "ncg",
      title: "NCG",
      description:
        "Não conformidades graves que penalizam diretamente a nota final.",
      items: [
        {
          id: "comportamento-inadequado",
          title: "Comportamento inadequado",
          description:
            "Tom de voz inadequado, risos, bocejos, mastigação ou conversas paralelas durante o atendimento.",
          weight: -100,
          severe: true,
        },
        {
          id: "script-incorreto",
          title: "Não utiliza o script corretamente",
          description: "Desvio relevante do script obrigatório da operação.",
          weight: -100,
          severe: true,
        },
        {
          id: "quebra-sigilo",
          title: "Quebra de sigilo",
          description:
            "Passou informações contratuais sem realizar corretamente a identificação positiva.",
          weight: -100,
          severe: true,
        },
        {
          id: "rispidez",
          title: "Rispidez",
          description:
            "Conduta grosseira, agressiva, hostil ou com palavras inadequadas ao longo da ligação.",
          weight: -100,
          severe: true,
        },
        {
          id: "desvio-tabulacao",
          title: "Desvio de tabulação",
          description:
            "Não registrou corretamente o código de ação e o resultado correspondente ao atendimento.",
          weight: -100,
          severe: true,
        },
        {
          id: "ratificacao-boleto",
          title: "Ratificação/Envio de boleto",
          description:
            "Não ratificou o acordo ou não enviou/confirmou o recebimento do boleto em linha com o cliente.",
          weight: -100,
          severe: true,
        },
      ],
    },
  ],
};

const deltaChatChecklist: ChecklistDefinition = {
  id: "delta-chat",
  label: "Delta Chat",
  walletId: "delta",
  channelId: "chat",
  channelLabel: "Chat",
  description:
    "Checklist de monitoria para atendimentos digitais da operação Delta.",
  blocks: [
    {
      id: "apresentacao-chat",
      title: "Apresentação",
      items: [
        {
          id: "apresentacao-chat",
          title: "Apresentação",
          description:
            "Em casos que o BOT não faz a apresentação de forma automática, o operador encaminha a apresentação? (Frase padrão)",
          weight: 6,
        },
        {
          id: "apresentacao-divida-chat",
          title: "Apresentação da dívida",
          description:
            "O operador informou o motivo do contato (produto), a(s) parcela(s) e o(s) valor(es) em atraso? (Frase padrão)",
          weight: 8,
        },
      ],
    },
    {
      id: "procedimento-chat",
      title: "Procedimento",
      items: [
        {
          id: "sondagem-chat",
          title: "Sondagem",
          description:
            "O operador verificou qual é a condição atual do cliente? (Situação financeira, se o cliente está empregado...).",
          weight: 6,
        },
        {
          id: "negociacao-chat",
          title: "Negociação",
          description:
            "O operador seguiu a negociação de forma escalada, ofertando todas as possibilidades de pagamento? (Pagamento à vista, parcelamentos, regularizar a parcela mais antiga...)",
          weight: 10,
        },
        {
          id: "argumentacao-chat",
          title: "Argumentação",
          description:
            "O operador informou ao cliente que, ao pagar, o CPF ficará sem restrições? O operador explicou que o pagamento pode parar a cobrança de juros e futuras ligações de cobrança? O operador conseguiu criar um senso de urgência para que o cliente realize o pagamento rapidamente? O operador deixou claro o prazo ou consequências de não pagar? O operador utilizou gatilhos de persuasão, como escassez, autoridade ou benefícios imediatos, para incentivar a negociação?",
          weight: 10,
        },
        {
          id: "ratificacao-chat",
          title: "Ratificação",
          description:
            "O operador confirmou a data de vencimento do pagamento com o cliente? O operador confirmou as condições do acordo, valor à vista, retirada de juros ou reparcelamento do contrato?",
          weight: 10,
        },
        {
          id: "selo-chat",
          title: "Selo do negócio",
          description:
            "O operador buscou a certeza do pagamento com o cliente?",
          weight: 10,
        },
        {
          id: "ortografia-chat",
          title: "Ortografia",
          description:
            "O operador utilizou a ortografia correta durante os envios de mensagens via chat?",
          weight: 10,
        },
        {
          id: "tempo-resposta-chat",
          title: "Tempo de Resposta",
          description:
            "O operador retornou o contato e respondeu ao cliente dentro de um tempo adequado para o canal?",
          weight: 10,
        },
        {
          id: "tempo-conversacao-chat",
          title: "Tempo de Conversação",
          description:
            "O tempo de conversação foi coerente com a necessidade da negociação?",
          weight: 8,
        },
      ],
    },
    {
      id: "finalizacao-chat",
      title: "Finalização",
      items: [
        {
          id: "duvidas-chat",
          title: "Encerramento",
          description:
            "O operador questionou se o cliente tinha alguma dúvida e se poderia ajudar em algo mais?",
          weight: 6,
        },
        {
          id: "encerramento-chat",
          title: "Encerramento",
          description:
            "O operador finalizou o contato de forma cordial? (Frase padrão)",
          weight: 6,
        },
      ],
    },
    {
      id: "ncg-chat",
      title: "NCG",
      description:
        "Não conformidades graves aplicáveis ao atendimento Delta via chat.",
      items: [
        {
          id: "comportamento-inadequado-chat",
          title: "Comportamento inadequado",
          description:
            "O operador apresentou algum desvio comportamental durante o atendimento, como mensagens com conotação inadequada?",
          weight: -100,
          severe: true,
        },
        {
          id: "script-incorreto-chat",
          title: "Não utiliza o script corretamente",
          description:
            "O operador não utilizou o script corretamente durante o atendimento.",
          weight: -100,
          severe: true,
        },
        {
          id: "rispidez-chat",
          title: "Rispidez",
          description:
            "O operador foi grosseiro com o cliente, utilizando palavras de baixo calão, agressão verbal e/ou hostilidade durante o atendimento?",
          weight: -100,
          severe: true,
        },
        {
          id: "envio-boleto-chat",
          title: "Envio do Boleto",
          description:
            "O operador não fez o envio do boleto de imediato ao cliente na plataforma? O operador não informou período de análise e não atualizou dados para envio?",
          weight: -100,
          severe: true,
        },
        {
          id: "transferencia-indevida-chat",
          title: "Transferência indevida",
          description: "O operador transferiu a conversa de forma indevida?",
          weight: -100,
          severe: true,
        },
        {
          id: "desvio-tabulacao-chat",
          title: "Desvio de tabulação",
          description:
            "O operador não tabulou corretamente, deixando de utilizar o código de ação e resultado correspondente ao chat/atendimento?",
          weight: -100,
          severe: true,
        },
      ],
    },
  ],
};

const gamaChecklist: ChecklistDefinition = {
  id: "gama",
  label: "GAMA",
  walletId: "gama",
  channelId: "gama",
  channelLabel: "GAMA",
  description: "Checklist de monitoria para o produto GAMA.",
  blocks: [
    {
      id: "abertura-gama",
      title: "Abertura",
      items: [
        {
          id: "gama-ligacao-gravada",
          title: "Informou que a ligacao e gravada",
          description: "O operador informou ao cliente que a ligacao e gravada.",
          weight: 4,
        },
        {
          id: "gama-fala-em-nome-gama",
          title: "Informou que fala em nome da GAMA",
          description: "O operador informou que fala em nome da GAMA.",
          weight: 2,
        },
        {
          id: "gama-apresentacao-nome",
          title: "Apresentou-se com o proprio nome",
          description: "O operador se apresentou com seu nome no inicio do contato.",
          weight: 2,
        },
        {
          id: "gama-fala-da-acme",
          title: "Informou que era da Acme",
          description: "O operador informou que era da Acme.",
          weight: 2,
        },
        {
          id: "gama-linha-imediato",
          title: "Entrou em linha de imediato",
          description: "O operador entrou em linha de imediato no atendimento.",
          weight: 2,
        },
      ],
    },
    {
      id: "identificacao-positiva-gama",
      title: "Identificacao positiva",
      items: [
        {
          id: "gama-ano-nascimento",
          title: "Solicitou o ano de nascimento",
          description: "A identificacao positiva incluiu a solicitacao do ano de nascimento.",
          weight: 7,
        },
        {
          id: "gama-digitos-cpf",
          title: "Priorizou os tres primeiros digitos do CPF",
          description: "O operador priorizou solicitar os tres primeiros digitos do CPF do cliente.",
          weight: 7,
        },
      ],
    },
    {
      id: "apresentacao-divida-gama",
      title: "Apresentacao da divida",
      items: [
        {
          id: "gama-contratos-divida",
          title: "Apresentou todos os contratos",
          description: "O operador apresentou a divida completa, contemplando todos os contratos aplicaveis.",
          weight: 2,
        },
        {
          id: "gama-valor-atualizado",
          title: "Informou o valor atualizado da divida",
          description: "O operador informou o valor atualizado da divida.",
          weight: 2,
        },
        {
          id: "gama-dias-atraso",
          title: "Informou os dias em atraso",
          description: "O operador informou os dias em atraso da divida.",
          weight: 2,
        },
      ],
    },
    {
      id: "sondagem-gama",
      title: "Sondagem",
      items: [
        {
          id: "gama-ofertou-propostas",
          title: "Ofertou propostas sem transferir a decisao ao cliente",
          description: "O operador conduziu a sondagem ofertando propostas, sem apenas perguntar se poderia passar.",
          weight: 4,
        },
        {
          id: "gama-evitou-nao-conseguiria",
          title: "Evitou abordagem negativa",
          description: "O operador evitou expressoes como 'Nao conseguiria?'.",
          weight: 2,
        },
        {
          id: "gama-sondou-condicao",
          title: "Sondou a condicao atual do cliente",
          description: "O operador sondou a condicao atual do cliente.",
          weight: 3,
        },
      ],
    },
    {
      id: "negociacao-gama",
      title: "Negociacao",
      items: [
        {
          id: "gama-negociacao-gradativa",
          title: "Negociou de forma gradativa",
          description: "O operador conduziu a negociacao de forma gradativa.",
          weight: 5,
        },
        {
          id: "gama-oferta-propostas",
          title: "Fez oferta de propostas",
          description: "O operador apresentou ofertas de propostas ao cliente.",
          weight: 5,
        },
        {
          id: "gama-simulou-parcelamento",
          title: "Simulou parcelamento",
          description: "O operador simulou o parcelamento quando aplicavel.",
          weight: 5,
        },
        {
          id: "gama-pagamento-para-o-dia",
          title: "Ofertou pagamento para o dia",
          description: "O operador ofertou o pagamento para o dia.",
          weight: 5,
        },
      ],
    },
    {
      id: "argumentacao-gama",
      title: "Argumentacao",
      items: [
        {
          id: "gama-contornou-objecao",
          title: "Utilizou vantagens para contornar objecoes",
          description: "O operador utilizou vantagens para contornar a objecao do cliente.",
          weight: 4,
        },
        {
          id: "gama-gatilho-urgencia",
          title: "Insistiu no atendimento com gatilho de urgencia",
          description: "O operador insistiu no atendimento e utilizou o gatilho de urgencia.",
          weight: 2,
        },
      ],
    },
    {
      id: "consequencia-pagamento-gama",
      title: "Consequencia do pagamento",
      items: [
        {
          id: "gama-acoes-cobranca",
          title: "Informou as acoes de cobranca",
          description: "O operador informou as acoes de cobranca.",
          weight: 5,
        },
      ],
    },
    {
      id: "ratificacao-gama",
      title: "Ratificacao",
      items: [
        {
          id: "gama-dia-mes-acordo",
          title: "Informou dia e mes do acordo",
          description: "O operador informou o dia e o mes em que o acordo ficaria.",
          weight: 2,
        },
        {
          id: "gama-valor-acordo",
          title: "Informou o valor do acordo",
          description: "Na ratificacao, o operador informou o valor em que o acordo ficaria.",
          weight: 6,
        },
      ],
    },
    {
      id: "selo-negocio-gama",
      title: "Selo do negocio",
      items: [
        {
          id: "gama-selou-compromisso",
          title: "Selou o compromisso com o cliente",
          description: "O operador selou o compromisso com o cliente, evitando acordo fragil.",
          weight: 6,
        },
        {
          id: "gama-certeza-pagamento",
          title: "Buscou a certeza de pagamento",
          description: "O operador buscou a certeza de pagamento.",
          weight: 5,
        },
      ],
    },
    {
      id: "finalizacao-gama",
      title: "Finalizacao",
      items: [
        {
          id: "gama-atualizacao-cadastral",
          title: "Atualizou o cadastro",
          description: "O operador atualizou o cadastro.",
          weight: 3,
        },
        {
          id: "gama-encerramento-cordial",
          title: "Encerrou cordialmente",
          description: "O operador encerrou o contato cordialmente.",
          weight: 2,
        },
      ],
    },
    {
      id: "outros-gama",
      title: "Outros",
      items: [
        {
          id: "gama-mute-correto",
          title: "Utilizou o mute corretamente",
          description: "O operador utilizou o mute corretamente, sem interferir na ligacao.",
          weight: 2,
        },
        {
          id: "gama-fio-condutor",
          title: "Utilizou o fio condutor a favor do atendimento",
          description: "O operador utilizou o fio condutor a favor do atendimento.",
          weight: 2,
        },
      ],
    },
    {
      id: "ncg-gama",
      title: "NCG",
      description: "Nao conformidades graves aplicaveis ao produto GAMA.",
      items: [
        {
          id: "gama-ncg-desvio-tabulacao",
          title: "Desvio de tabulacao",
          description: "O atendimento teve desvio de tabulacao.",
          weight: -100,
          severe: true,
        },
        {
          id: "gama-ncg-falta-etica-postura",
          title: "Falta de etica/Falta de postura",
          description: "O atendimento teve falta de etica ou falta de postura.",
          weight: -100,
          severe: true,
        },
        {
          id: "gama-ncg-quebra-sigilo",
          title: "Quebra de sigilo",
          description: "O atendimento teve quebra de sigilo.",
          weight: -100,
          severe: true,
        },
        {
          id: "gama-ncg-garantia-inexistente",
          title: "Garantia inexistente",
          description: "O operador transmitiu garantia inexistente.",
          weight: -100,
          severe: true,
        },
        {
          id: "gama-ncg-informacoes-incc",
          title: "Transmite informacoes INCC",
          description: "O operador transmitiu informacoes INCC.",
          weight: -100,
          severe: true,
        },
      ],
    },
  ],
};

const reconquistaGamaChecklist: ChecklistDefinition = {
  id: "reconquista-gama",
  label: "Reconquista GAMA",
  walletId: "gama",
  channelId: "reconquista-gama",
  channelLabel: "Reconquista GAMA",
  description: "Checklist de monitoria para o produto Reconquista GAMA.",
  blocks: [
    {
      id: "abertura-reconquista-gama",
      title: "Abertura",
      items: [
        {
          id: "reconquista-gama-nome",
          title: "Apresentou-se corretamente informando o nome",
          description: "O operador se apresentou corretamente informando o nome.",
          weight: 2,
        },
        {
          id: "reconquista-gama-nome-banco",
          title: "Apresentou-se em nome do Banco GAMA",
          description: "O operador se apresentou com nome e em nome do Banco GAMA.",
          weight: 2,
        },
        {
          id: "reconquista-gama-ligacao-gravada",
          title: "Informou que a ligacao esta sendo gravada",
          description: "O operador informou que a ligacao esta sendo gravada.",
          weight: 5,
        },
      ],
    },
    {
      id: "confirmacao-dados-reconquista-gama",
      title: "Confirmacao de dados",
      items: [
        {
          id: "reconquista-gama-cpf-nome",
          title: "Solicitou CPF parcial e nome completo",
          description: "O operador solicitou os 3 primeiros ou 2 ultimos digitos do CPF e o nome completo.",
          weight: 10,
        },
      ],
    },
    {
      id: "contextualizacao-reconquista-gama",
      title: "Contextualizacao",
      items: [
        {
          id: "reconquista-gama-transferencia-beneficio",
          title: "Contextualizou a transferencia do beneficio",
          description: "O operador informou sobre a transferencia do beneficio para outro banco e explicou o motivo da ligacao.",
          weight: 4,
        },
      ],
    },
    {
      id: "sondagem-reconquista-gama",
      title: "Sondagem",
      items: [
        {
          id: "reconquista-gama-objetivo-ligacao",
          title: "Explicou o objetivo da ligacao",
          description: "O operador explicou que o objetivo era ajudar a trazer o beneficio de volta ao GAMA.",
          weight: 5,
        },
        {
          id: "reconquista-gama-banco-atual",
          title: "Perguntou em qual banco o cliente recebe",
          description: "O operador perguntou em qual banco o cliente recebe atualmente.",
          weight: 4,
        },
        {
          id: "reconquista-gama-motivo-mudanca",
          title: "Perguntou o motivo da mudanca",
          description: "O operador perguntou o motivo da mudanca.",
          weight: 4,
        },
        {
          id: "reconquista-gama-sondagem-condicoes",
          title: "Sondou condicoes especiais do outro banco",
          description: "Caso o cliente nao respondesse, o operador aplicou sondagem sobre condicoes especiais do outro banco.",
          weight: 4,
        },
      ],
    },
    {
      id: "beneficios-reconquista-gama",
      title: "Apresentacao dos beneficios",
      items: [
        {
          id: "reconquista-gama-tradicao-beneficios",
          title: "Reforcou tradicao, seguranca ou beneficios do GAMA",
          description: "O operador reforcou tradicao e seguranca do GAMA, antecipacao do beneficio ou saque 24h na rede Banco24Horas.",
          weight: 5,
        },
        {
          id: "reconquista-gama-linhas-credito",
          title: "Explicou linhas de credito disponiveis",
          description: "O operador explicou linhas de credito disponiveis, como consignado, debito em conta e cartao.",
          weight: 5,
        },
      ],
    },
    {
      id: "argumentacao-reconquista-gama",
      title: "Argumentacao",
      items: [
        {
          id: "reconquista-gama-contornar-objecoes",
          title: "Utilizou vantagens para contornar objecoes",
          description: "O operador utilizou vantagens para contornar objecoes.",
          weight: 4,
        },
        {
          id: "reconquista-gama-beneficios-claros",
          title: "Reforcou beneficios de forma clara e objetiva",
          description: "O operador reforcou beneficios de forma clara e objetiva.",
          weight: 4,
        },
      ],
    },
    {
      id: "conversao-reconquista-gama",
      title: "Conversao",
      items: [
        {
          id: "reconquista-gama-interesse-retorno",
          title: "Verificou interesse em trazer o beneficio de volta",
          description: "O operador verificou o interesse do cliente em trazer o beneficio de volta.",
          weight: 5,
        },
        {
          id: "reconquista-gama-ted-automatica",
          title: "Ofertou TED automatica diante de recusa",
          description: "Caso houvesse recusa referente as objecoes, o operador ofertou TED automatica.",
          weight: 5,
        },
      ],
    },
    {
      id: "aceite-ratificacao-reconquista-gama",
      title: "Aceite/Ratificacao",
      items: [
        {
          id: "reconquista-gama-portabilidade",
          title: "Informou sobre portabilidade para conta GAMA",
          description: "O operador informou sobre a portabilidade para conta GAMA.",
          weight: 5,
        },
        {
          id: "reconquista-gama-data-hora-aceite",
          title: "Confirmou data e hora do aceite",
          description: "O operador confirmou data e hora do aceite com o cliente.",
          weight: 8,
        },
        {
          id: "reconquista-gama-concordancia-clara",
          title: "Registrou concordancia clara e objetiva",
          description: "O operador registrou concordancia clara e objetiva do cliente, como SIM, ACEITO ou CONCORDO.",
          weight: 8,
        },
      ],
    },
    {
      id: "ratificacao-reconquista-gama",
      title: "Ratificacao",
      items: [
        {
          id: "reconquista-gama-proximo-passo",
          title: "Garantiu clareza sobre o proximo passo",
          description: "O operador garantiu clareza sobre o proximo passo de portabilidade.",
          weight: 5,
        },
      ],
    },
    {
      id: "encerramento-reconquista-gama",
      title: "Encerramento",
      items: [
        {
          id: "reconquista-gama-encerramento-cordial",
          title: "Encerramento cordial e profissional",
          description: "O operador fez encerramento cordial e profissional.",
          weight: 2,
        },
        {
          id: "reconquista-gama-agradecimento",
          title: "Agradeceu e reforcou disponibilidade do Banco GAMA",
          description: "O operador agradeceu pela confianca e reforcou a disponibilidade do Banco GAMA.",
          weight: 4,
        },
      ],
    },
    {
      id: "ncg-reconquista-gama",
      title: "NCG'S",
      description: "Nao conformidades graves aplicaveis ao produto Reconquista GAMA.",
      items: [
        {
          id: "reconquista-gama-ncg-etica-postura",
          title: "Falta de etica/Falta de postura",
          description: "O atendimento teve falta de etica ou falta de postura.",
          weight: -100,
          severe: true,
        },
        {
          id: "reconquista-gama-ncg-mute",
          title: "Nao utilizou o Mute",
          description: "O operador nao utilizou o Mute.",
          weight: -100,
          severe: true,
        },
        {
          id: "reconquista-gama-ncg-desvio-tabulacao",
          title: "Desvio de Tabulacao",
          description: "O atendimento teve desvio de tabulacao.",
          weight: -100,
          severe: true,
        },
        {
          id: "reconquista-gama-ncg-quebra-sigilo",
          title: "Quebra de Sigilo",
          description: "O atendimento teve quebra de sigilo.",
          weight: -100,
          severe: true,
        },
        {
          id: "reconquista-gama-ncg-garantia-inexistente",
          title: "Garantia inexistente",
          description: "O operador transmitiu garantia inexistente.",
          weight: -100,
          severe: true,
        },
        {
          id: "reconquista-gama-ncg-criticar-proponente",
          title: "Criticar o Banco Proponente",
          description: "O operador criticou o banco proponente.",
          weight: -100,
          severe: true,
        },
        {
          id: "reconquista-gama-ncg-alteracao-sem-aceite",
          title: "Alteracoes/inclusoes sem aceite do cliente",
          description: "O operador efetuou alteracoes ou inclusoes sem solicitacao ou aceitacao do cliente.",
          weight: -100,
          severe: true,
        },
      ],
    },
  ],
};

export const checklistDefinitions: ChecklistDefinition[] = [
  deltaVoiceChecklist,
  deltaChatChecklist,
  gamaChecklist,
  reconquistaGamaChecklist,
];

export const qualityWallets: QualityWalletConfig[] = [
  {
    id: "delta",
    label: "Banco Delta",
    shortLabel: "DELTA",
    description: "Monitoria de voz e chat da carteira Delta.",
    logoSrc: "/images/wallets/LogoDelta.png",
    logoAlt: "Logo do Banco Delta",
    accentClassName: "from-emerald-500 via-teal-500 to-cyan-500",
    cardClassName:
      "border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 dark:border-emerald-500/20 dark:from-emerald-500/10 dark:via-slate-900 dark:to-cyan-500/10",
    enabled: true,
    channels: [
      {
        id: "voz",
        label: "Voz",
        description:
          "Checklist de ligação com foco em condução, argumentação e ratificação.",
        checklistId: deltaVoiceChecklist.id,
      },
      {
        id: "chat",
        label: "Chat",
        description:
          "Checklist de atendimento digital com validação textual e confirmação registrada.",
        checklistId: deltaChatChecklist.id,
      },
    ],
    matchOperator: (operator) => {
      const base =
        `${operator.carteira || ""} ${operator.centro_custo || ""}`.toLowerCase();
      return base.includes("delta");
    },
  },
  {
    id: "gama",
    label: "Banco GAMA",
    shortLabel: "GAMA",
    description: "Monitoria de voz dos produtos GAMA e Reconquista GAMA.",
    logoSrc: "/images/wallets/LogoGAMA.png",
    logoAlt: "Logo do Banco GAMA",
    accentClassName: "from-orange-500 via-amber-500 to-sky-500",
    cardClassName:
      "border-orange-200 bg-gradient-to-br from-orange-50 via-white to-sky-50 dark:border-orange-500/20 dark:from-orange-500/10 dark:via-slate-900 dark:to-sky-500/10",
    enabled: true,
    channels: [
      {
        id: "gama",
        label: "GAMA",
        description:
          "Checklist do produto GAMA com foco em abertura, identificacao, negociacao e ratificacao.",
        checklistId: gamaChecklist.id,
      },
      {
        id: "reconquista-gama",
        label: "Reconquista GAMA",
        description:
          "Checklist do produto Reconquista GAMA com foco em retorno do beneficio e aceite.",
        checklistId: reconquistaGamaChecklist.id,
      },
    ],
    matchOperator: (operator) => {
      const base =
        `${operator.carteira || ""} ${operator.centro_custo || ""}`.toLowerCase();
      return base.includes("gama") || base.includes("reconquista");
    },
  },
];

export const getChecklistDefinition = (checklistId: string) =>
  checklistDefinitions.find((item) => item.id === checklistId) || null;

export const getWalletDefinition = (walletId: string) =>
  qualityWallets.find((item) => item.id === walletId) || null;
