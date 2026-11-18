/**
 * Conversor de roteiros em JSON (formato "marcas / nos / buttons") para a
 * estrutura usada pelas tabelas do builder de fluxo:
 *
 *   TB_FLUXO     -> tipo_ligacao / produto / tipo_cliente
 *   TB_MENSAGEM  -> titulo / mensagem / ordem_exibicao
 *   TB_OPCAO     -> texto_opcao / proxima_mensagem_id / ordem_opcao
 *
 * O JSON de origem usa chaves textuais ("hab1_abordagem") tanto no mapa de nos
 * quanto no campo `next` dos botoes. Aqui essas chaves viram um plano de
 * importacao; o ID real (uuid do banco) so e conhecido depois que a mensagem e
 * criada, por isso o plano trabalha com `key` e o chamador monta o de/para.
 */

export type RoteiroJsonButton = {
  label?: string;
  texto?: string;
  texto_opcao?: string;
  next?: string | null;
  proxima?: string | null;
  proxima_mensagem_id?: string | null;
  primary?: boolean;
};

export type RoteiroJsonNode = {
  id?: string;
  title?: string;
  titulo?: string;
  body?: string;
  mensagem?: string;
  texto?: string;
  tabulacao?: string[] | string;
  tabulacoes?: string[] | string;
  buttons?: RoteiroJsonButton[];
  opcoes?: RoteiroJsonButton[];
  options?: RoteiroJsonButton[];
};

export type ParsedOption = {
  texto_opcao: string;
  targetKey: string | null;
};

export type ParsedNode = {
  /** Chave do no no mapa original. */
  key: string;
  /** Campo `id` interno (quando diverge da chave, ambos viram alias). */
  id: string;
  aliases: string[];
  titulo: string;
  corpo: string;
  tabulacao: string[];
  opcoes: ParsedOption[];
};

export type ParsedMarca = {
  nome: string;
  nodes: ParsedNode[];
};

export type ParsedRoteiro = {
  marcas: ParsedMarca[];
  warnings: string[];
};

export type PlanNode = {
  key: string;
  titulo: string;
  /** Corpo ja convertido para HTML compativel com o editor. */
  mensagem: string;
  tabulacao: string[];
  opcoes: ParsedOption[];
  ordem: number;
  position: { x: number; y: number };
};

export type ImportPlan = {
  marca: string;
  nodes: PlanNode[];
  /** alias (chave ou id do JSON) -> key do no do plano. */
  aliasToKey: Record<string, string>;
  rootKey: string | null;
  totalOpcoes: number;
  totalLigacoes: number;
  referenciasAusentes: string[];
  warnings: string[];
};

export type BuildPlanOptions = {
  incluirTabulacao: boolean;
  /**
   * Um `next` que nao existe no JSON volta para a primeira mensagem.
   *
   * Esses destinos sao o fim da ligacao -- no roteiro habitacional, vinte
   * botoes "FINALIZAR" apontam para `hab1_fim`, que o arquivo nunca declara.
   * Criar um no vazio para cada um enchia a malha de cartoes sem conteudo e
   * deixava o atendente num beco. Voltando para a entrada, terminar a ligacao
   * ja deixa o roteiro pronto para a proxima.
   */
  voltarAusentesParaInicio: boolean;
};

const NODE_WIDTH_GAP = 400;
const NODE_HEIGHT_GAP = 330;
const CANVAS_ORIGIN = { x: 80, y: 80 };

const MOJIBAKE_PATTERN = /[\u00c2\u00c3][\u0080-\u00bf]/;
const DIACRITICS_PATTERN = /[\u0300-\u036f]/g;
const BOM_PATTERN = /^\ufeff/;

/** Todo caractere cabe em um byte, pre-requisito para reinterpretar os bytes. */
const isLatin1Only = (text: string) => {
  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) > 0xff) {
      return false;
    }
  }

  return true;
};

/**
 * Arquivos exportados em UTF-8 e regravados como Latin-1 chegam com
 * acentos quebrados (dois caracteres onde deveria haver um). Reinterpreta os
 * bytes quando o texto inteiro cabe em um byte por caractere e o resultado
 * decodificado como UTF-8 e valido.
 */
export const repairMojibake = (text: string) => {
  if (!MOJIBAKE_PATTERN.test(text) || !isLatin1Only(text)) {
    return text;
  }

  try {
    const bytes = Uint8Array.from(Array.from(text, (char) => char.charCodeAt(0)));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return text;
  }
};

const asList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  }

  const texto = String(value ?? "").trim();
  return texto ? [texto] : [];
};

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

export const normalizeKey = (value = "") =>
  value
    .normalize("NFD")
    .replace(DIACRITICS_PATTERN, "")
    .trim()
    .toLowerCase();

/** `hab1_nao_confirma` -> `Nao confirma` (descarta o prefixo do roteiro). */
export const humanizeKey = (key = "") => {
  const partes = key
    .split(/[_\-.\s]+/)
    .filter(Boolean)
    .filter((parte, index) => !(index === 0 && /^[a-z]+\d+$/i.test(parte)));

  const texto = (partes.length ? partes : [key]).join(" ").trim();

  if (!texto) {
    return "Mensagem importada";
  }

  return texto.charAt(0).toLocaleUpperCase("pt-BR") + texto.slice(1);
};

/** Converte o `body` do JSON (texto solto com `<br>` e `<b>`) em HTML de editor. */
export const toEditorHtml = (raw = "") => {
  const texto = String(raw ?? "")
    .replace(/\r\n/g, "\n")
    .trim();

  if (!texto) {
    return "";
  }

  if (/<(p|div|ul|ol|h[1-6]|blockquote)\b/i.test(texto)) {
    return texto;
  }

  return texto
    .split(/\n{2,}|(?:<br\s*\/?>\s*){2,}/i)
    .map((bloco) => bloco.replace(/\n/g, "<br>").trim())
    .filter(Boolean)
    .map((bloco) => `<p>${bloco}</p>`)
    .join("");
};

export const buildTabulacaoHtml = (tabulacao: string[]) =>
  tabulacao.length
    ? `<p><strong>Tabulação:</strong> ${tabulacao.join(" • ")}</p>`
    : "";

const isNodeLike = (value: unknown): value is RoteiroJsonNode => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const node = value as RoteiroJsonNode;

  return (
    node.title !== undefined ||
    node.titulo !== undefined ||
    node.body !== undefined ||
    node.mensagem !== undefined ||
    node.texto !== undefined ||
    node.buttons !== undefined ||
    node.opcoes !== undefined ||
    node.options !== undefined
  );
};

const isNodeMap = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.values(value as Record<string, unknown>).some(isNodeLike);
};

const parseNode = (key: string, raw: RoteiroJsonNode): ParsedNode => {
  const id = String(raw.id ?? "").trim() || key;
  const botoes = [
    ...(Array.isArray(raw.buttons) ? raw.buttons : []),
    ...(Array.isArray(raw.opcoes) ? raw.opcoes : []),
    ...(Array.isArray(raw.options) ? raw.options : []),
  ];

  return {
    key,
    id,
    aliases: unique([key, id]),
    titulo: String(raw.title ?? raw.titulo ?? "").trim() || humanizeKey(key),
    corpo: String(raw.body ?? raw.mensagem ?? raw.texto ?? ""),
    tabulacao: asList(raw.tabulacao ?? raw.tabulacoes),
    opcoes: botoes.map((botao) => {
      const alvo = botao.next ?? botao.proxima ?? botao.proxima_mensagem_id;
      const targetKey = String(alvo ?? "").trim();

      return {
        texto_opcao:
          String(botao.label ?? botao.texto ?? botao.texto_opcao ?? "").trim() ||
          "Continuar",
        targetKey: targetKey || null,
      };
    }),
  };
};

const collectNodes = (
  registro: Record<string, unknown>,
  warnings: string[],
  marca: string,
) => {
  const nodes: ParsedNode[] = [];

  Object.entries(registro).forEach(([key, valor]) => {
    if (!isNodeLike(valor)) {
      warnings.push(`"${marca} > ${key}" foi ignorado: nao parece uma mensagem.`);
      return;
    }

    nodes.push(parseNode(key, valor as RoteiroJsonNode));
  });

  return nodes;
};

/**
 * Aceita `{ marcas: { MARCA: { chave: no } } }`, `{ chave: no }` ou um array de
 * nos. Lanca `Error` com mensagem em pt-BR quando o conteudo e irreconhecivel.
 */
export const parseRoteiroJson = (conteudo: string): ParsedRoteiro => {
  const texto = repairMojibake(conteudo).replace(BOM_PATTERN, "").trim();

  if (!texto) {
    return { marcas: [], warnings: ["Arquivo vazio."] };
  }

  let data: unknown;
  try {
    data = JSON.parse(texto);
  } catch (error) {
    throw new Error(
      `JSON invalido: ${error instanceof Error ? error.message : "erro de leitura"}`,
    );
  }

  const warnings: string[] = [];

  if (Array.isArray(data)) {
    const registro: Record<string, unknown> = {};
    data.forEach((item, index) => {
      const node = item as RoteiroJsonNode;
      registro[String(node?.id ?? `mensagem_${index + 1}`)] = item;
    });

    return {
      marcas: [
        { nome: "IMPORTADO", nodes: collectNodes(registro, warnings, "IMPORTADO") },
      ],
      warnings,
    };
  }

  if (!data || typeof data !== "object") {
    throw new Error("O JSON precisa ser um objeto de marcas ou de mensagens.");
  }

  const raiz = data as Record<string, unknown>;
  const container = (raiz.marcas ?? raiz.marca ?? raiz.fluxos ?? raiz) as Record<
    string,
    unknown
  >;

  if (!container || typeof container !== "object") {
    throw new Error("Nao foi possivel localizar as mensagens no JSON.");
  }

  // Mapa de mensagens direto, sem o nivel de marcas.
  if (isNodeMap(container)) {
    const nome = String(raiz.nome ?? raiz.produto ?? "IMPORTADO");
    return {
      marcas: [{ nome, nodes: collectNodes(container, warnings, nome) }],
      warnings,
    };
  }

  const marcas: ParsedMarca[] = [];

  Object.entries(container).forEach(([nome, valor]) => {
    if (!isNodeMap(valor)) {
      warnings.push(`"${nome}" foi ignorado: nenhuma mensagem encontrada dentro dele.`);
      return;
    }

    marcas.push({
      nome,
      nodes: collectNodes(valor as Record<string, unknown>, warnings, nome),
    });
  });

  if (!marcas.length) {
    throw new Error(
      "Nenhuma mensagem reconhecida. Esperado { marcas: { MARCA: { chave: { title, body, buttons } } } }.",
    );
  }

  return { marcas, warnings };
};

/** Distribui os nos em colunas por profundidade (BFS a partir da entrada). */
const buildLayout = (
  nodes: PlanNode[],
  resolveTarget: (targetKey: string | null) => string | null,
) => {
  const camadas = new Map<string, number>();
  const raiz = nodes[0]?.key;

  if (raiz) {
    camadas.set(raiz, 0);
    const fila = [raiz];

    while (fila.length) {
      const atual = fila.shift() as string;
      const camadaAtual = camadas.get(atual) ?? 0;
      const node = nodes.find((item) => item.key === atual);

      node?.opcoes.forEach((opcao) => {
        const destino = resolveTarget(opcao.targetKey);
        if (!destino || camadas.has(destino)) {
          return;
        }

        camadas.set(destino, camadaAtual + 1);
        fila.push(destino);
      });
    }
  }

  const camadaOrfaos = Math.max(0, ...Array.from(camadas.values())) + 1;
  const ocupacao = new Map<number, number>();

  nodes.forEach((node) => {
    const camada = camadas.get(node.key) ?? camadaOrfaos;
    const linha = ocupacao.get(camada) ?? 0;
    ocupacao.set(camada, linha + 1);

    node.position = {
      x: CANVAS_ORIGIN.x + camada * NODE_WIDTH_GAP,
      y: CANVAS_ORIGIN.y + linha * NODE_HEIGHT_GAP,
    };
  });
};

/**
 * Monta o plano de importacao: mensagens na ordem de criacao, alias de/para e
 * diagnostico das referencias que nao existem no JSON.
 */
export const buildImportPlan = (
  marca: ParsedMarca,
  { incluirTabulacao, voltarAusentesParaInicio }: BuildPlanOptions,
): ImportPlan => {
  const warnings: string[] = [];
  const aliasToKey: Record<string, string> = {};
  const nodes: PlanNode[] = [];

  marca.nodes.forEach((node, index) => {
    node.aliases.forEach((alias) => {
      const chave = normalizeKey(alias);
      if (aliasToKey[chave] && aliasToKey[chave] !== node.key) {
        warnings.push(
          `A chave "${alias}" aparece em mais de uma mensagem; a primeira ocorrencia sera usada.`,
        );
        return;
      }
      aliasToKey[chave] = node.key;
    });

    const corpo = toEditorHtml(node.corpo);
    const tabulacaoHtml = incluirTabulacao ? buildTabulacaoHtml(node.tabulacao) : "";

    nodes.push({
      key: node.key,
      titulo: node.titulo,
      mensagem: `${corpo}${tabulacaoHtml}`,
      tabulacao: node.tabulacao,
      opcoes: node.opcoes,
      ordem: index + 1,
      position: { x: 0, y: 0 },
    });
  });

  const resolveTarget = (targetKey: string | null) =>
    targetKey ? aliasToKey[normalizeKey(targetKey)] ?? null : null;

  const referenciasAusentes = unique(
    marca.nodes
      .flatMap((node) => node.opcoes.map((opcao) => opcao.targetKey))
      .filter((target): target is string => Boolean(target) && !resolveTarget(target)),
  );

  const primeiro = nodes[0] ?? null;

  if (voltarAusentesParaInicio && primeiro && referenciasAusentes.length) {
    // Basta apontar o alias para a raiz: opcoes, layout e contagem de ligacoes
    // leem tudo por `resolveTarget`, entao se ajustam sozinhos.
    referenciasAusentes.forEach((referencia) => {
      aliasToKey[normalizeKey(referencia)] = primeiro.key;
    });

    warnings.push(
      `${referenciasAusentes.length} referencia(s) sem mensagem voltam para "${primeiro.titulo || primeiro.key}": ${referenciasAusentes.join(", ")}.`,
    );
  } else if (referenciasAusentes.length) {
    warnings.push(
      `${referenciasAusentes.length} referencia(s) sem mensagem correspondente ficarao como "final do caminho".`,
    );
  }

  buildLayout(nodes, resolveTarget);

  const totalOpcoes = nodes.reduce((total, node) => total + node.opcoes.length, 0);
  const totalLigacoes = nodes.reduce(
    (total, node) =>
      total + node.opcoes.filter((opcao) => resolveTarget(opcao.targetKey)).length,
    0,
  );

  return {
    marca: marca.nome,
    nodes,
    aliasToKey,
    rootKey: nodes[0]?.key ?? null,
    totalOpcoes,
    totalLigacoes,
    referenciasAusentes,
    warnings,
  };
};

/** Resolve um `next` do JSON para a chave do plano (case/acento-insensivel). */
export const resolvePlanTarget = (plan: ImportPlan, targetKey: string | null) =>
  targetKey ? plan.aliasToKey[normalizeKey(targetKey)] ?? null : null;

/**
 * Reaproveita o valor ja cadastrado na tabela quando ele bate com o nome vindo
 * do JSON, evitando criar "HABITACIONAL" ao lado de "Habitacional".
 */
export const suggestExistingValue = (
  options: { id: string; nome: string }[],
  valor: string,
) => {
  const alvo = normalizeKey(valor);

  if (!alvo) {
    return "";
  }

  const encontrado = options.find(
    (item) => normalizeKey(item.id) === alvo || normalizeKey(item.nome) === alvo,
  );

  return encontrado?.id ?? valor;
};
