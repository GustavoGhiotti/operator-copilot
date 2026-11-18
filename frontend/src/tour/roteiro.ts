/**
 * Roteiro do tour de boas-vindas — conteúdo, não motor.
 *
 * Cada passo é um dado. Quem executa é `useTourCopilot`, e a separação é de
 * propósito: mexer no texto que a operação lê não deve exigir entender o ciclo
 * de vida do Shepherd, e mexer no motor não deve arriscar o texto.
 *
 * A voz aqui é a da Aurora: primeira pessoa, frase curta, sem corporativês.
 * O texto vai para o card como HTML, então `<b>` marca nome de botão ou de
 * comando — é conteúdo estático nosso, nunca entrada de usuário.
 */
import type { PopperPlacement } from "shepherd.js";

/** Efeitos colaterais que um passo pode disparar. Quem implementa é a tela. */
export type AcaoTour =
  | "abrirPainelComandos"
  | "voltarAoPainel"
  | "fecharTudo"
  | "abrirTreinoBingo"
  | "fecharTreinoBingo";

export interface PassoTour {
  id: string;
  titulo: string;
  texto: string;
  /**
   * Seletor do alvo. Sem alvo, o passo aparece centralizado na tela.
   *
   * Aceita seletor composto (separado por vírgula): vale o primeiro que
   * existir na ordem do documento. É assim que um mesmo passo atende perfis
   * diferentes — o card do painel só existe para não-admin, o atalho em
   * destaque existe para todo mundo.
   */
  alvo?: string;
  posicao?: PopperPlacement;
  /**
   * Espera o alvo montar antes de exibir. Necessário sempre que o passo
   * anterior abriu um modal — o elemento ainda não existe no clique.
   */
  aguardarAlvo?: boolean;
  /**
   * Espera este seletor aparecer, sem ancorar nele.
   *
   * Para quando o passo precisa que uma tela esteja montada mas destacá-la não
   * diria nada — caso do @Arena, que abre em tela cheia.
   */
  aguardarEntrada?: string;
  /**
   * Espera este seletor sumir antes de exibir.
   *
   * Serve para o passo que vem depois de um formulário: seja salvando ou
   * cancelando, o tour só continua quando a tela de cima sair da frente.
   */
  aguardarSaida?: string;
  /** Só avança quando o operador clicar no alvo. Sem botão "Avançar". */
  avancarAoClicar?: boolean;
  /**
   * Deixa o alvo utilizável durante o passo, sem que isso avance o tour.
   *
   * Por padrão o Shepherd aplica `pointer-events: none` no alvo e em todos os
   * filhos. Sem isto, um passo que convida a arrastar um cartão convidaria
   * para algo que o operador não consegue fazer.
   */
  permitirInteracao?: boolean;
  /** Roda ao entrar no passo, antes de esperar o alvo. */
  aoEntrar?: AcaoTour;
  /**
   * Passos do mesmo grupo caem juntos.
   *
   * Os comandos são filtrados por permissão dentro do SearchBar (isVega,
   * isAdmin, centro de custo...) e o @Arena ainda renderiza telas diferentes
   * por função. Repetir essas regras aqui seria uma cópia que apodrece na
   * primeira mudança — então o tour pergunta ao DOM: se o portão do grupo não
   * estiver na tela, o bloco inteiro sai do ar.
   *
   * Grupos são hierárquicos por ponto: derrubar "arena" derruba junto
   * "arena.operador" e "arena.supervisor".
   */
  grupo?: string;
  /** Este passo é o portão: sem o alvo dele, o grupo todo é pulado. */
  portaoDoGrupo?: boolean;
  /**
   * Seletor que o portão consulta, quando é diferente de onde o card ancora.
   *
   * Num portão negativo os dois nunca podem ser o mesmo: o passo só aparece
   * quando aquele elemento NÃO existe, então ancorar nele seria ancorar no
   * vazio. Sem isto, `alvo` vale para os dois papéis.
   */
  alvoDoPortao?: string;
  /**
   * Inverte o portão: o grupo cai quando o alvo EXISTE.
   *
   * É como um mesmo roteiro fala com plateias diferentes. O botão "Criar
   * equipe" só aparece para supervisor, então ele serve de portão positivo
   * para o bloco de gestão e negativo para o bloco que fala "o que o seu
   * supervisor te manda" — texto que não faz sentido para quem é o supervisor.
   */
  portaoNegativo?: boolean;
  /**
   * Passo de convite: ganha um "Agora não" ao lado do avançar.
   *
   * A pessoa acabou de logar para trabalhar, não para assistir tour. Perguntar
   * antes é o que separa um tour que ela faz de um que ela fecha no X.
   */
  convite?: boolean;
}

const ALVO_TAREFAS = '[data-tour="cmd-tarefas"], [data-tour-comando="@Tarefas"]';
const ALVO_ARENA = '[data-tour="cmd-arena"], [data-tour-comando="@Arena"]';
const ARENA_MONTADA = '[data-tour="arena-hub"], [data-tour="arena-supervisor"]';
const ALVO_ACADEMIA =
  '[data-tour="cmd-academia"], [data-tour-comando="@Academia"]';

export const ROTEIRO: PassoTour[] = [
  {
    id: "boas-vindas",
    titulo: "Oi! Eu sou a Aurora",
    texto:
      "Fico aqui com você o dia inteiro. Me dá dois minutos que eu te mostro o " +
      "que mudou por aqui — se preferir ver depois, é só fechar.",
    alvo: '[data-tour="aurora"]',
    posicao: "right",
    convite: true,
  },
  {
    id: "barra",
    titulo: "Tudo começa por aqui",
    texto:
      "Esta é a barra de comandos. Você não precisa decorar menu nenhum: " +
      "escreve o que quer e eu abro.",
    alvo: '[data-tour="barra-comandos"]',
    posicao: "top",
  },
  {
    id: "painel",
    titulo: "Digite @ e o Copilot se abre",
    texto:
      "Acabei de digitar o <b>@</b> por você. Toda vez que fizer isso, esta " +
      "lista aparece com tudo que você tem acesso.",
    alvo: '[data-tour="painel-comandos"]',
    posicao: "top",
    aoEntrar: "abrirPainelComandos",
    aguardarAlvo: true,
  },

  /* ------------------------------------------------------------ @Tarefas -- */

  {
    id: "clique-tarefas",
    titulo: "Vamos entrar no @Tarefas",
    texto: "Clique em <b>@Tarefas</b> que eu te mostro por dentro.",
    alvo: ALVO_TAREFAS,
    posicao: "top",
    avancarAoClicar: true,
    grupo: "tarefas",
    portaoDoGrupo: true,
  },
  {
    id: "tarefas-visao",
    titulo: "Seu dia em uma tela só",
    texto:
      "Esta é a primeira coisa que aparece: quantas tarefas você tem para " +
      "hoje, quantas estão atrasadas e o que já saiu da sua frente.",
    alvo: '[data-tour="tarefas-conteudo"]',
    posicao: "left",
    aguardarAlvo: true,
    grupo: "tarefas",
  },
  {
    id: "tarefas-menu",
    titulo: "Três jeitos de olhar o seu dia",
    texto:
      "<b>Minhas tarefas</b> junta o que te atribuíram, venha de onde vier. " +
      "<b>Calendário</b> espalha tudo por data. E <b>Atrasadas</b> te avisa " +
      "antes que o prazo estoure.",
    alvo: '[data-tour="tarefas-menu"]',
    posicao: "right",
    grupo: "tarefas",
  },
  {
    id: "clique-quadros",
    titulo: "Agora o quadro de verdade",
    texto:
      "Clique em <b>Meus quadros</b>. É lá que as tarefas viram cartões que " +
      "você move com o mouse.",
    alvo: '[data-tour="tarefas-quadros"]',
    posicao: "right",
    avancarAoClicar: true,
    grupo: "tarefas",
  },
  {
    id: "tarefas-colunas",
    titulo: "Cada coluna é um estágio",
    texto:
      "Da <b>Caixa de entrada</b> até <b>Concluído</b>, passando por " +
      "<b>Para hoje</b>, <b>Em andamento</b> e <b>Aguardando</b>. Arrastar um " +
      "cartão de uma coluna para outra já muda o status — não existe botão de " +
      "salvar aqui.",
    alvo: '[data-tour="tarefas-colunas"]',
    posicao: "top",
    aguardarAlvo: true,
    grupo: "tarefas",
  },
  {
    id: "clique-nova",
    titulo: "Vamos criar uma de verdade",
    texto:
      "Clique em <b>Nova tarefa</b>. Pode ser qualquer coisa sua mesmo — um " +
      "retorno para lembrar, um combinado com o supervisor.",
    alvo: '[data-tour="tarefas-nova"]',
    posicao: "bottom",
    avancarAoClicar: true,
    grupo: "tarefas",
  },
  {
    id: "tarefas-form",
    titulo: "O que dá para preencher",
    texto:
      "Título é o único campo obrigatório. O resto ajuda depois: <b>prazo</b> " +
      "para ela aparecer em Atrasadas na hora certa, <b>prioridade</b> para " +
      "ordenar o dia e <b>checklist</b> para quebrar a tarefa em partes. " +
      "Preencha e salve — ou feche, se preferir só olhar.",
    alvo: '[data-tour="tarefas-form"]',
    posicao: "left",
    aguardarAlvo: true,
    grupo: "tarefas",
  },
  {
    id: "tarefas-arrastar",
    titulo: "Agora é só arrastar",
    texto:
      "Experimente agora: pegue um cartão e solte em outra coluna. Terminou " +
      "algo? Joga em <b>Concluído</b> e pronto. É assim que o seu quadro " +
      "conta a sua história do dia.",
    alvo: '[data-tour="tarefas-colunas"]',
    posicao: "top",
    aguardarSaida: '[data-tour="tarefas-form"]',
    aguardarAlvo: true,
    permitirInteracao: true,
    grupo: "tarefas",
  },
  {
    id: "tarefas-detalhe",
    titulo: "Cada cartão abre por dentro",
    texto:
      "Clique em um deles: o painel lateral traz checklist, comentários, " +
      "anexos e o histórico de quem mexeu no quê. É onde a conversa sobre a " +
      "tarefa fica junto da tarefa, em vez de se perder no chat.",
    alvo: '[data-tour="tarefas-colunas"]',
    posicao: "top",
    permitirInteracao: true,
    grupo: "tarefas",
  },
  {
    id: "tarefas-supervisor",
    titulo: "E o que vem do seu supervisor",
    texto:
      "Quando ele te passar uma demanda, ela cai neste mesmo quadro — já com " +
      "prazo e checklist prontos. Você não precisa anotar nada em outro lugar.",
    alvo: '[data-tour="tarefas-colunas"]',
    posicao: "top",
    grupo: "tarefas.operador",
    portaoDoGrupo: true,
    portaoNegativo: true,
    alvoDoPortao: '[data-tour="tarefas-criar-equipe"]',
  },

  /* --- @Tarefas: o que só o supervisor faz -------------------------- */

  {
    id: "clique-criar-equipe",
    titulo: "Você monta a sua equipe aqui",
    texto:
      "Antes de delegar qualquer coisa, você precisa de uma equipe. Clique em " +
      "<b>Criar equipe</b>.",
    alvo: '[data-tour="tarefas-criar-equipe"]',
    posicao: "right",
    avancarAoClicar: true,
    grupo: "tarefas.supervisor",
    portaoDoGrupo: true,
  },
  {
    id: "tarefas-equipe-montagem",
    titulo: "Nome, centro de custo e gente",
    texto:
      "Dê um nome à equipe e escolha o <b>centro de custo</b> para eu trazer " +
      "os operadores dele. Pode também buscar pelo <b>nome</b> e ir marcando " +
      "um a um. Salvou, a equipe passa a existir para todo mundo que você " +
      "incluiu.",
    alvo: '[data-tour="tarefas-gestao-equipe"]',
    posicao: "left",
    aguardarAlvo: true,
    permitirInteracao: true,
    grupo: "tarefas.supervisor",
  },
  {
    id: "tarefas-delegar",
    titulo: "Delegar é escolher o responsável",
    texto:
      "Com a equipe montada, o campo <b>Responsável</b> aparece em toda tarefa " +
      "nova. Escolheu um operador, a demanda cai no quadro dele já com prazo, " +
      "prioridade e checklist — e ele recebe a notificação.",
    alvo: '[data-tour="tarefas-responsavel"], [data-tour="tarefas-nova"]',
    posicao: "left",
    aguardarSaida: '[data-tour="tarefas-gestao-equipe"]',
    grupo: "tarefas.supervisor",
  },
  {
    id: "tarefas-anotacao-supervisor",
    titulo: "E o seu próprio quadro continua seu",
    texto:
      "Nada disso mistura com as suas anotações. <b>Meus quadros</b> guarda o " +
      "seu planejamento pessoal; a equipe enxerga só o que você delegou a ela.",
    alvo: '[data-tour="tarefas-menu"]',
    posicao: "right",
    grupo: "tarefas.supervisor",
  },

  /* -------------------------------------------------------------- @Arena -- */

  {
    id: "volta-ao-painel",
    titulo: "Falta te mostrar a Arena",
    texto:
      "Fechei o @Tarefas e trouxe a lista de comandos de volta. Tem mais uma " +
      "coisa que eu quero te mostrar.",
    alvo: '[data-tour="painel-comandos"]',
    posicao: "top",
    aoEntrar: "voltarAoPainel",
    aguardarAlvo: true,
  },
  {
    id: "clique-arena",
    titulo: "Entre na @Arena",
    texto: "Clique em <b>@Arena</b>. É o lugar mais divertido do Copilot.",
    alvo: ALVO_ARENA,
    posicao: "top",
    avancarAoClicar: true,
    grupo: "arena",
    portaoDoGrupo: true,
  },
  {
    id: "arena-abertura",
    titulo: "Aqui a operação joga",
    texto:
      "A Arena é onde a sua equipe faz campanhas e jogos — <b>Bingo</b> e " +
      "<b>Quiz</b>, os dois ao vivo. Acabou a cartela impressa e a apuração " +
      "no caderno: quem cria a sala e conduz a partida é o supervisor, e o " +
      "resultado sai sozinho.",
    aguardarEntrada: ARENA_MONTADA,
    grupo: "arena",
  },

  /* --- ramo do operador ---------------------------------------------- */

  {
    id: "arena-op-nav",
    titulo: "Suas campanhas ficam aqui",
    texto:
      "<b>Início</b> mostra o que está rolando agora. <b>Minhas campanhas</b> " +
      "guarda o histórico com a sua colocação e o XP que você ganhou. E " +
      "<b>Jogos disponíveis</b> explica cada modalidade.",
    alvo: '[data-tour="arena-nav"]',
    posicao: "right",
    aguardarAlvo: true,
    grupo: "arena.operador",
    portaoDoGrupo: true,
  },
  {
    id: "arena-op-convite",
    titulo: "Você joga a convite",
    texto:
      "Quando o supervisor abrir uma campanha e te convidar, ela aparece " +
      "aqui para você aceitar. Aceitou, é só esperar ele abrir a sala — aí o " +
      "jogo começa para todo mundo ao mesmo tempo.",
    alvo: '[data-tour="arena-nav"]',
    posicao: "right",
    grupo: "arena.operador",
  },
  {
    id: "arena-treino",
    titulo: "Vamos treinar sem valer nada",
    texto:
      "Montei uma cartela de mentira só para você pegar o jeito. Clique em " +
      "<b>Começar o sorteio</b>, ache o número que sair e marque. Quando " +
      "fechar a linha, cante o bingo. Nada disso é gravado nem pontua.",
    alvo: '[data-tour="treino-bingo"]',
    posicao: "right",
    aoEntrar: "abrirTreinoBingo",
    aguardarAlvo: true,
    permitirInteracao: true,
    grupo: "arena.operador",
  },
  {
    id: "arena-treino-fim",
    titulo: "Na campanha real é igualzinho",
    texto:
      "A diferença é que os números vêm do supervisor, todo mundo joga junto " +
      "e a vitória vale posição no ranking e XP. O Quiz segue a mesma ideia: " +
      "pergunta na tela, todo mundo responde ao mesmo tempo.",
    aoEntrar: "fecharTreinoBingo",
    aguardarSaida: '[data-tour="treino-bingo"]',
    grupo: "arena.operador",
  },

  /* --- ramo do supervisor -------------------------------------------- */

  {
    id: "arena-sup-nova",
    titulo: "Você é quem cria as campanhas",
    texto:
      "Este é o seu painel. Clique em <b>Nova campanha</b> para eu te mostrar " +
      "o fluxo de montar um jogo.",
    alvo: '[data-tour="arena-nova-campanha"]',
    posicao: "left",
    aguardarAlvo: true,
    avancarAoClicar: true,
    grupo: "arena.supervisor",
    portaoDoGrupo: true,
  },
  {
    id: "arena-sup-wizard",
    titulo: "Quatro etapas e a sala está de pé",
    texto:
      "<b>1)</b> escolhe o jogo e dá nome à campanha. <b>2)</b> configura o " +
      "Bingo ou monta o Quiz. <b>3)</b> escolhe o público. <b>4)</b> revisa e " +
      "publica — os convites saem na hora.",
    alvo: '[data-tour="arena-wizard"]',
    posicao: "left",
    aguardarAlvo: true,
    grupo: "arena.supervisor",
  },
  {
    id: "arena-sup-publico",
    titulo: "Dois jeitos de escolher quem joga",
    texto:
      "Na etapa do público você pode marcar um <b>centro de custo</b> inteiro " +
      "— e todo mundo dele entra de uma vez — ou buscar <b>operador por " +
      "nome</b> e selecionar só quem você quer. Dá para combinar os dois na " +
      "mesma campanha.",
    alvo: '[data-tour="arena-wizard"]',
    posicao: "left",
    grupo: "arena.supervisor",
  },
  {
    id: "arena-sup-partida",
    titulo: "Na hora do jogo, o comando é seu",
    texto:
      "Publicada a campanha, você abre a sala quando quiser. No Bingo é você " +
      "que sorteia cada número, com todos os operadores vendo ao vivo — e a " +
      "apuração do vencedor é automática.",
    alvo: '[data-tour="arena-wizard"]',
    posicao: "left",
    grupo: "arena.supervisor",
  },

  /* ----------------------------------------------------------- @Academia -- */

  {
    id: "volta-ao-painel-academia",
    titulo: "Última parada",
    texto:
      "Fechei a Arena. Falta te mostrar onde a Qualidade coloca o treinamento " +
      "da operação.",
    alvo: '[data-tour="painel-comandos"]',
    posicao: "top",
    aoEntrar: "voltarAoPainel",
    aguardarAlvo: true,
  },
  {
    id: "clique-academia",
    titulo: "Abra a @Academia",
    texto: "Clique em <b>@Academia</b>.",
    alvo: ALVO_ACADEMIA,
    posicao: "top",
    avancarAoClicar: true,
    grupo: "academia",
    portaoDoGrupo: true,
  },
  {
    id: "academia-nav",
    titulo: "Sua escola dentro do Copilot",
    texto:
      "É aqui que o time de Qualidade publica o treinamento da operação. " +
      "<b>Meus cursos</b> guarda o que você começou, <b>Catálogo</b> mostra " +
      "tudo que está disponível para você e <b>Materiais salvos</b> é o que " +
      "você marcou para reler depois.",
    alvo: '[data-tour="academia-nav"]',
    posicao: "right",
    aguardarAlvo: true,
    grupo: "academia",
  },
  {
    id: "clique-curso",
    titulo: "Vamos abrir um curso",
    texto:
      "Clique em um curso para eu te mostrar como ele funciona por dentro.",
    alvo: '[data-tour="academia-abrir-curso"]',
    posicao: "bottom",
    avancarAoClicar: true,
    grupo: "academia.curso",
    portaoDoGrupo: true,
  },
  {
    id: "academia-player",
    titulo: "Primeiro a matrícula",
    texto:
      "Para assistir, você precisa se <b>matricular</b> — é isso que faz o seu " +
      "progresso ficar salvo. Da próxima vez que entrar, o curso continua de " +
      "onde você parou, mesmo que troque de máquina.",
    alvo: '[data-tour="academia-player"]',
    posicao: "left",
    aguardarAlvo: true,
    grupo: "academia.curso",
  },
  {
    id: "academia-curriculo",
    titulo: "Módulos e aulas",
    texto:
      "Este é o conteúdo do curso, quebrado em módulos. Uma aula pode ser " +
      "<b>vídeo</b>, <b>PDF</b>, <b>texto</b>, <b>link</b> ou <b>quiz</b> — e " +
      "algumas só liberam depois que você conclui a anterior.",
    alvo: '[data-tour="academia-curriculo"]',
    posicao: "left",
    grupo: "academia.curso",
  },
  {
    id: "academia-quiz",
    titulo: "O quiz vale nota",
    texto:
      "Nas aulas de quiz a correção é feita no servidor, então a nota é real. " +
      "Errou? Dá para refazer, e você vê onde errou pergunta por pergunta.",
    alvo: '[data-tour="academia-player"]',
    posicao: "left",
    grupo: "academia.curso",
  },

  /* ---------------------------------------------------------- encerramento */

  {
    id: "encerramento",
    titulo: "Por enquanto é isso",
    texto:
      "O resto eu vou te mostrando conforme você usar. Agora é com você: " +
      "digite <b>@</b> e comece. E se quiser rever isto qualquer dia, é só " +
      "chamar o <b>@Tour</b>.",
    aoEntrar: "fecharTudo",
  },
];
