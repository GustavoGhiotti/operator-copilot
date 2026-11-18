export type AdminCommandArea =
  | "password"
  | "tasks"
  | "management"
  | "results"
  | "arena"
  | "supervision"
  | "quality"
  | "monitoria"
  | "auroraInsight"
  | "baseConhecimento"
  | "acessos"
  | "toolAnalytics";

const RESTRICTED_COST_CENTERS = new Set([
  "MARKETING",
  "GERENCIA OPERACIONAL",
  "PLANEJAMENTO",
  "DESENVOLVIMENTO",
  "TI",
  "QUALIDADE",
]);

export const normalizeCostCenter = (value: string | null | undefined) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

export const isSupervisorRole = (value: string | null | undefined) =>
  normalizeCostCenter(value).includes("SUPERVISOR");

export const isMonitorRole = (value: string | null | undefined) =>
  normalizeCostCenter(value).includes("MONITOR");

/**
 * Areas concedidas ao usuario, gravadas no login a partir de
 * TB_PERMISSAO_VISAO.
 *
 * Antes deste arquivo decidir por comparacao de string, incluir uma funcao nova
 * na visao da gerencia exigia editar aqui, no login_service, no arena_service e
 * no tarefas_kanban_service. Agora e uma linha no banco -- e esta copia so
 * decide o que aparece na tela: quem barra de verdade e o servidor, que
 * reconsulta a permissao a cada requisicao.
 *
 * Le tolerando lixo porque o valor vem do localStorage, que o usuario edita.
 * Uma chave corrompida vira "nenhuma area", nunca uma excecao no meio da home.
 */
export const getUserAreas = (): Set<string> => {
  try {
    const bruto = localStorage.getItem("userAreas");
    if (!bruto) return new Set();
    const lista: unknown = JSON.parse(bruto);
    if (!Array.isArray(lista)) return new Set();
    return new Set(lista.filter((item): item is string => typeof item === "string"));
  } catch {
    return new Set();
  }
};

export const hasArea = (area: string) => getUserAreas().has(area);

/**
 * Areas tiradas explicitamente na tela de acessos.
 *
 * Sem esta lista, `userAreas` nao distingue "nunca teve" de "foi tirada", e as
 * regras legadas abaixo -- todas no formato `centro de custo OU area` --
 * reacendem o comando que o gestor acabou de remover. Com ela, a tela passa a
 * ser a palavra final: a negacao vence a regra legada.
 *
 * Le tolerando lixo pelo mesmo motivo de `getUserAreas`: vem do localStorage.
 */
export const getUserDeniedAreas = (): Set<string> => {
  try {
    const bruto = localStorage.getItem("userAreasNegadas");
    if (!bruto) return new Set();
    const lista: unknown = JSON.parse(bruto);
    if (!Array.isArray(lista)) return new Set();
    return new Set(lista.filter((item): item is string => typeof item === "string"));
  } catch {
    return new Set();
  }
};

/**
 * Centros que acompanham qualquer partida da Arena pelo observatório.
 *
 * Espelha a area `arena.observatorio`. Esta cópia só decide o que aparece na
 * tela — quem barra de verdade é o servidor, porque a visão expõe a cartela e o
 * desempenho de qualquer operador.
 *
 * O parametro continua na assinatura por compatibilidade com os chamadores; a
 * decisao agora vem da area concedida, nao do centro de custo.
 */
export const isArenaObserver = (_costCenter?: string | null | undefined) =>
  hasArea("arena.observatorio");

export type AcessoCalculado = {
  costCenter: string | null | undefined;
  role?: string | null;
  areas: Set<string> | string[];
  negadas?: Set<string> | string[];
};

/**
 * Igual a `getAdminCommandAccess`, mas com as areas passadas em vez de lidas do
 * localStorage. E o que permite a tela de acessos calcular o estado de OUTRA
 * pessoa -- sem isto ela desenharia a caixinha so a partir das areas e mentiria
 * sempre que uma regra legada por centro de custo estivesse concedendo.
 */
export const getAdminCommandAccessFor = ({
  costCenter,
  role,
  areas: areasEntrada,
  negadas: negadasEntrada = [],
}: AcessoCalculado) => {
  const normalizedCostCenter = normalizeCostCenter(costCenter);
  const isQuality = normalizedCostCenter === "QUALIDADE";
  const isPlanning = normalizedCostCenter === "PLANEJAMENTO";
  const isRestrictedDepartment = RESTRICTED_COST_CENTERS.has(
    normalizedCostCenter,
  );
  const areas =
    areasEntrada instanceof Set ? areasEntrada : new Set(areasEntrada);
  const negadas =
    negadasEntrada instanceof Set ? negadasEntrada : new Set(negadasEntrada);

  /**
   * A tela de acessos e a palavra final.
   *
   * Cada flag continua sendo `regra legada OU area` -- e o que evita tirar
   * acesso de gente que nunca foi tocada, ja que as regras por centro de custo
   * e funcao seguem valendo para quem nao tem cadastro nenhum. O que muda e
   * que uma negacao explicita passa na frente de tudo: se o gestor desmarcou o
   * item, nenhuma regra legada reacende.
   *
   * `areas` ja vem com o ajuste aplicado pelo servidor, entao conceder na tela
   * sempre funcionou. O que nao funcionava era remover.
   *
   * A negacao precisa ser de TODAS as areas que acendem a flag, nao de uma
   * qualquer: `quality` responde a `qualidade.monitoria` e `qualidade.avaliacao`
   * juntas, e negar so uma delas nao pode derrubar o comando que a outra ainda
   * concede. E por isso que a tela nega o conjunto inteiro ao desligar.
   */
  const liberado = (concedido: boolean, ...requeridas: string[]) => {
    if (requeridas.length && requeridas.every((area) => negadas.has(area))) {
      return false;
    }
    return concedido;
  };

  return {
    password: liberado(areas.has("senhas.reset"), "senhas.reset"),
    // @Tarefas so vira editavel quando 'tarefas.usar' existir em
    // TB_PERMISSAO_AREA (ver backend/scripts/permissao_areas_absolutas.sql).
    // Ate la nada muda: sem a area cadastrada, nao ha como nega-la.
    tasks: liberado(true, "tarefas.usar"),
    management: liberado(areas.has("gerencia.gestao"), "gerencia.gestao"),
    results: liberado(areas.has("gerencia.resultados"), "gerencia.resultados"),
    // `isSupervisorRole` continua no OU porque a area 'arena.supervisor' e
    // concedida por prefixo de funcao: enquanto a migration 019 nao rodar no
    // ambiente, o supervisor nao pode perder a Arena -- a menos que a tela
    // diga o contrario.
    arena: liberado(
      areas.has("arena.observatorio")
        || areas.has("arena.supervisor")
        || isSupervisorRole(role),
      "arena.observatorio",
      "arena.supervisor",
    ),
    // `!isRestrictedDepartment` e uma regra negativa: libera todo mundo menos
    // seis centros de custo. Ela continua valendo para quem sempre teve, e a
    // area some por cima -- e assim que a gerencia, que estava entre os seis
    // barrados, passa a alcancar @Ideal, @Auditoria, @IA e @Acordos.
    supervision: liberado(
      !isRestrictedDepartment || areas.has("supervisao.operacao"),
      "supervisao.operacao",
    ),
    // Mesmo padrao "area OU regra legada" de `supervision` e `auroraInsight`:
    // e o que impede alguem de perder acesso entre o deploy e a migration.
    // `qualidade.avaliacao` fica fora do pacote da visao Qualidade de
    // proposito, mas continua alcancavel pelo centro de custo e pelo ajuste
    // individual -- por isso as duas areas somam aqui.
    quality: liberado(
      isQuality
        || areas.has("qualidade.monitoria")
        || areas.has("qualidade.avaliacao"),
      "qualidade.monitoria",
      "qualidade.avaliacao",
    ),
    // @Monitoria saiu do bloco de qualidade no master: o monitor de
    // teleatendimento alcanca a monitoria pela funcao, sem levar junto quiz,
    // simulacao e premiacao. A area entra no OU para a visao Qualidade
    // tambem conceder.
    monitoria: liberado(
      isQuality || isMonitorRole(role) || areas.has("qualidade.monitoria"),
      "qualidade.monitoria",
    ),
    // A regra por centro de custo continua no OU pelo mesmo motivo de
    // `supervision`: nao tirar de quem ja tem enquanto a migration 024 nao
    // rodar no ambiente.
    auroraInsight: liberado(
      isQuality || isPlanning || areas.has("aurora.insight"),
      "aurora.insight",
    ),
    // Quem alimenta a base da Aurora e quem conhece a carteira: supervisao e
    // monitoria. As duas areas legadas ficam no OU pelo mesmo motivo de
    // `supervision` -- a tela precisa funcionar no dia do deploy, e nao so
    // depois que alguem rodar a migration da area nova. Requerida, porem, so a
    // area propria: negar @Treinamentos nao pode derrubar os comandos de
    // supervisao e monitoria junto.
    // Espelha a guarda do backend em ia_conhecimento_router.py.
    baseConhecimento: liberado(
      areas.has("aurora.conhecimento")
        || areas.has("qualidade.monitoria")
        || areas.has("supervisao.operacao"),
      "aurora.conhecimento",
    ),
    acessos: liberado(areas.has("acessos.gerenciar"), "acessos.gerenciar"),
    // Tela interna de acompanhamento do @ConsultarContrato: nao tem area em
    // TB_PERMISSAO_AREA, sai pelo centro de custo e so por ele.
    toolAnalytics: liberado(normalizedCostCenter.includes("DESENVOLVIMENTO")),
  } satisfies Record<AdminCommandArea, boolean>;
};

export const getAdminCommandAccess = (
  costCenter: string | null | undefined,
  role?: string | null,
) =>
  getAdminCommandAccessFor({
    costCenter,
    role,
    areas: getUserAreas(),
    negadas: getUserDeniedAreas(),
  });

export type ComandoAdmin = {
  /** Rotulo digitado na busca. */
  comando: string;
  /** Complemento quando o mesmo comando abre capacidades diferentes. */
  detalhe?: string;
  /** Flags que liberam o comando (OU entre elas). */
  flags: AdminCommandArea[];
  /**
   * Areas de TB_PERMISSAO_AREA que acendem essas flags. A primeira e a
   * principal: e ela que a tela de acessos concede ao ligar o comando. As
   * demais tambem liberam, por isso saem juntas quando alguem desliga.
   */
  areas: string[];
};

/**
 * Mapa canonico comando -> permissao.
 *
 * Espelha o wiring de IndexAdmin.tsx, que e quem de fato passa (ou nao) o
 * handler do comando para o SearchBar. Antes desta lista existirem tres copias
 * divergentes -- esta, a rotulagem do AcessosModal e o if/else que montava os
 * "comandos disponiveis" -- e as tres discordavam sobre o que
 * `supervisao.operacao` e as duas areas de qualidade liberavam.
 *
 * @Operação e @MetaCopa sairam do Copilot: ninguem usava, e o @MetaCopa abria a
 * mesma tela de metas do @Ideal.
 */
export const COMANDOS_ADMIN: ComandoAdmin[] = [
  // A area so aparece na tela depois que existir em TB_PERMISSAO_AREA; ate la
  // o @Tarefas segue liberado para todos, como sempre foi.
  { comando: "@Tarefas", flags: ["tasks"], areas: ["tarefas.usar"] },
  { comando: "@Senhas", flags: ["password"], areas: ["senhas.reset"] },
  { comando: "@Gestão", flags: ["management"], areas: ["gerencia.gestao"] },
  {
    comando: "@Resultados",
    flags: ["results"],
    areas: ["gerencia.resultados"],
  },
  {
    comando: "@Arena",
    detalhe: "criar campanha",
    flags: ["arena"],
    areas: ["arena.supervisor"],
  },
  {
    comando: "@Arena",
    detalhe: "observatório",
    flags: ["arena"],
    areas: ["arena.observatorio"],
  },
  { comando: "@Ideal", flags: ["supervision"], areas: ["supervisao.operacao"] },
  { comando: "@IA", flags: ["supervision"], areas: ["supervisao.operacao"] },
  {
    comando: "@Matriculas",
    flags: ["supervision"],
    areas: ["supervisao.operacao"],
  },
  {
    comando: "@Acordos",
    flags: ["supervision"],
    areas: ["supervisao.operacao"],
  },
  {
    comando: "@Roteiro",
    flags: ["supervision"],
    areas: ["supervisao.operacao"],
  },
  {
    comando: "@Anotação",
    flags: ["supervision"],
    areas: ["supervisao.operacao"],
  },
  { comando: "@Chat", flags: ["supervision"], areas: ["supervisao.operacao"] },
  {
    comando: "@EnvioBoleto",
    flags: ["supervision"],
    areas: ["supervisao.operacao"],
  },
  {
    comando: "@PesquisaPortabilidade",
    flags: ["supervision"],
    areas: ["supervisao.operacao"],
  },
  {
    comando: "@QuizQualidade",
    flags: ["quality"],
    areas: ["qualidade.avaliacao", "qualidade.monitoria"],
  },
  {
    comando: "@QuizAnalise",
    flags: ["quality"],
    areas: ["qualidade.avaliacao", "qualidade.monitoria"],
  },
  {
    comando: "@SimulacaoQualidade",
    flags: ["quality"],
    areas: ["qualidade.avaliacao", "qualidade.monitoria"],
  },
  {
    comando: "@Premiação",
    flags: ["quality"],
    areas: ["qualidade.avaliacao", "qualidade.monitoria"],
  },
  {
    comando: "@AcademiaQualidade",
    flags: ["quality"],
    areas: ["qualidade.monitoria", "qualidade.avaliacao"],
  },
  {
    comando: "@CriarTabulacao",
    flags: ["quality"],
    areas: ["qualidade.monitoria", "qualidade.avaliacao"],
  },
  {
    comando: "@RoteiroAdm",
    flags: ["quality"],
    areas: ["qualidade.monitoria", "qualidade.avaliacao"],
  },
  // Depois do bloco de qualidade de proposito: e a posicao que mantem os tres
  // comandos em destaque na home iguais aos de antes deste mapa existir.
  {
    comando: "@Auditoria",
    flags: ["supervision", "quality"],
    areas: ["supervisao.operacao", "qualidade.monitoria", "qualidade.avaliacao"],
  },
  {
    comando: "@Monitoria",
    flags: ["monitoria"],
    areas: ["qualidade.monitoria"],
  },
  {
    comando: "@AuroraInsight",
    flags: ["auroraInsight"],
    areas: ["aurora.insight"],
  },
  // So `aurora.conhecimento` entra como area do comando: e a unica que a tela
  // de acessos pode negar sem levar junto supervisao e monitoria, que liberam
  // @Treinamentos de carona mas sustentam meia duzia de outros comandos.
  {
    comando: "@Treinamentos",
    flags: ["baseConhecimento"],
    areas: ["aurora.conhecimento"],
  },
  { comando: "@Acessos", flags: ["acessos"], areas: ["acessos.gerenciar"] },
  // Sem area em TB_PERMISSAO_AREA: sai pelo centro de custo DESENVOLVIMENTO e
  // so por ele. Entra no mapa porque `getAvailableAdminCommandLabels` agora
  // deriva daqui -- de fora, sumiria da lista de comandos disponiveis.
  {
    comando: "@ConsultarContrato",
    flags: ["toolAnalytics"],
    areas: [],
  },
];

/** Areas citadas pelo mapa, na ordem em que os comandos aparecem. */
export const AREAS_COM_COMANDO = [
  ...new Set(COMANDOS_ADMIN.flatMap((item) => item.areas)),
];

export const getAvailableAdminCommandLabels = (
  costCenter: string | null | undefined,
  role?: string | null,
) => {
  const access = getAdminCommandAccess(costCenter, role);
  const commands = ["@Tarefas"];

  return [
    ...new Set(
      COMANDOS_ADMIN.filter((item) =>
        item.flags.some((flag) => access[flag]),
      ).map((item) => item.comando),
    ),
  ];
};
