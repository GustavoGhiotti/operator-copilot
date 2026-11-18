import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import axiosInstance from "@/utils/axiosInstance";
import {
  renderRichText,
  sanitizeThemeDependentStyles,
} from "@/utils/richText";
import {
  buildImportPlan,
  parseRoteiroJson,
  resolvePlanTarget,
  suggestExistingValue,
  type ParsedRoteiro,
} from "@/utils/roteiroFluxoImport";
import { toast } from "sonner";
import {
  AlertTriangle,
  Clipboard,
  ClipboardPaste,
  Copy,
  FileJson,
  GitBranch,
  GripVertical,
  Link2,
  Loader2,
  Minus,
  MoreHorizontal,
  PanelRightOpen,
  Plus,
  Save,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Workflow,
} from "lucide-react";
import ReactQuill, { Quill } from "react-quill";
import "react-quill/dist/quill.snow.css";
import { v4 as uuidv4 } from "uuid";

type SelectOption = {
  id: string;
  nome: string;
};

type OpcaoFluxo = {
  id_opcao: string;
  texto_opcao: string;
  proxima_mensagem_id: string | null;
  ordem_opcao?: number;
};

type MensagemFluxo = {
  id_mensagem: string;
  id_fluxo: string;
  titulo: string;
  ordem_exibicao: number;
  mensagem: string;
  opcoes: OpcaoFluxo[];
};

type FluxoResumo = {
  id_fluxo: string;
  tipo_ligacao: string;
  produto: string;
  tipo_cliente: string;
  /** Alimenta uma aba do roteiro do operador: não pode ser excluído. */
  fixo?: boolean;
  rotulo_fixo?: string | null;
};

type NodePosition = {
  x: number;
  y: number;
};

type CopiedFlowMessage = {
  oldId: string;
  titulo: string;
  mensagem: string;
  ordem_exibicao: number;
  position?: NodePosition;
  opcoes: {
    texto_opcao: string;
    oldNextMessageId: string | null;
    ordem_opcao?: number;
  }[];
};

type CopiedFlowPayload = {
  version: 1;
  copiedAt: string;
  source: "message" | "flow";
  messages: CopiedFlowMessage[];
};

type BuilderProps = {
  isOpen: boolean;
  onClose: () => void;
  initialTipoLigacao?: string;
  initialProduto?: string;
  initialTipoCliente?: string;
};

type SelectFilterFieldProps = {
  label: string;
  placeholder?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  helperText?: string;
};

type EditableFilterFieldProps = {
  label: string;
  placeholder: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  helperText?: string;
};

type ConfirmationPrompt = {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
};

const AUTO_CREATE_VALUE = "__AUTO_CREATE__";
const ALL_FILTER_VALUE = "__ALL__";
const COPIED_FLOW_STORAGE_KEY = "roteiro-builder-copied-flow";

const ZOOM_MIN = 0.35;
const ZOOM_MAX = 2;

const editorFontSizes = [
  "12px",
  "14px",
  "16px",
  "18px",
  "24px",
  "32px",
  "48px",
];

// Poppins primeiro: e a fonte base do roteiro, entao e ela que o seletor
// mostra quando a mensagem nao tem escolha propria.
const editorFonts = [
  "poppins",
  "arial",
  "georgia",
  "times-new-roman",
  "verdana",
  "courier-new",
];

const SizeStyle = Quill.import("attributors/style/size");
SizeStyle.whitelist = editorFontSizes;
Quill.register(SizeStyle, true);

const FontStyle = Quill.import("attributors/style/font");
FontStyle.whitelist = editorFonts;
Quill.register(FontStyle, true);

/**
 * Alinhamento como estilo inline, com "left" na lista.
 *
 * No padrao do Quill esquerda nao existe: e a AUSENCIA de alinhamento, e a
 * whitelist e ['right','center','justify']. Isso torna impossivel distinguir
 * "o autor escolheu esquerda" de "ninguem mexeu" -- e sem essa distincao nao
 * da para ter centro como padrao sem atropelar quem quer esquerda.
 * Com "left" na whitelist, escolher esquerda grava `text-align: left`.
 */
const AlignStyle = Quill.import("attributors/style/align");
AlignStyle.whitelist = ["left", "center", "right", "justify"];
Quill.register(AlignStyle, true);

// O mapa de icones do Quill indexa o alinhamento por valor e nao tem entrada
// para "left" (la o item vazio faz esse papel). Sem isto o item do seletor
// sairia em branco.
// Defensivo de proposito: isto roda no carregamento do modulo, e um acesso a
// propriedade inexistente aqui derrubaria a aplicacao inteira, nao so o editor.
const quillIcons = Quill.import("ui/icons") as
  | Record<string, Record<string, string>>
  | undefined;

if (quillIcons?.align?.[""]) {
  quillIcons.align.left = quillIcons.align[""];
}

export const quillModules = {
  toolbar: [
    [{ font: editorFonts }, { size: editorFontSizes }],
    ["bold", "italic", "underline", "strike", "blockquote"],
    [{ color: [] }, { background: [] }],
    [
      { list: "ordered" },
      { list: "bullet" },
      { indent: "-1" },
      { indent: "+1" },
    ],
    [{ align: ["left", "center", "right", "justify"] }],
    ["link", "image"],
    ["clean"],
  ],
};

export const quillFormats = [
  "font",
  "size",
  "bold",
  "italic",
  "underline",
  "strike",
  "blockquote",
  "color",
  "background",
  "list",
  "bullet",
  "indent",
  "align",
  "link",
  "image",
];

const quillFontPickerStyles = `
  .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="poppins"]::before,
  .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="poppins"]::before { content: "Poppins"; font-family: "Poppins", sans-serif; }
  .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="arial"]::before,
  .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="arial"]::before { content: "Arial"; font-family: Arial, sans-serif; }
  .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="georgia"]::before,
  .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="georgia"]::before { content: "Georgia"; font-family: Georgia, serif; }
  .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="times-new-roman"]::before,
  .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="times-new-roman"]::before { content: "Times New Roman"; font-family: "Times New Roman", serif; }
  .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="verdana"]::before,
  .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="verdana"]::before { content: "Verdana"; font-family: Verdana, sans-serif; }
  .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="courier-new"]::before,
  .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="courier-new"]::before { content: "Courier New"; font-family: "Courier New", monospace; }
  /* O Quill traz 13px em .ql-container e o editor herda dali. Aqui a base é a
     MESMA de .roteiro-mensagem no index.css: 1.125rem com entrelinha 1.7.
     Antes o editor ficava em 14px enquanto o operador lia 18px, então quem
     escrevia julgava o texto por um tamanho e entregava outro -- e, como
     quase nenhuma mensagem grava tamanho próprio, era esse desencontro de
     base que aparecia como "o roteiro ignora o builder". Ao mudar uma,
     mude a outra. */
  .ql-container { font-family: "Poppins", sans-serif; font-size: 1.125rem; }
  .ql-editor {
    font-family: "Poppins", sans-serif;
    font-size: 1.125rem;
    line-height: 1.7;
  }
  .ql-editor.ql-blank::before { font-style: normal; opacity: 0.6; }

  /* O título é uma linha, não um corpo de texto: caixa baixa e sem a altura
     mínima de 10rem que o snow reserva para o editor grande. */
  .roteiro-editor-titulo .ql-editor {
    min-height: 2.75rem;
    padding-top: 0.5rem;
    padding-bottom: 0.5rem;
  }
  .roteiro-hide-scrollbar {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .roteiro-hide-scrollbar::-webkit-scrollbar {
    display: none;
  }
`;

const stripHtml = (text = "") =>
  text
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeSearchText = (text = "") =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const normalizeFlowIdentifier = (text = "") =>
  text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLocaleLowerCase("pt-BR");
      return lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1);
    })
    .join(" ");

const normalizeSelectOptions = (options: SelectOption[] = []) => {
  const seen = new Set<string>();

  return options
    .map((item) => {
      const id = (item.id || "").trim();
      const nome = (item.nome || item.id || "").trim();

      return { id, nome: nome || id };
    })
    .filter((item) => item.id && item.nome)
    .filter((item) => {
      const key = item.id.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
};

const ensureOptionExists = (
  options: SelectOption[],
  value: string,
  fallbackLabel?: string,
) => {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return options;
  }

  const alreadyExists = options.some(
    (item) => item.id.toLowerCase() === normalizedValue.toLowerCase(),
  );

  if (alreadyExists) {
    return options;
  }

  return normalizeSelectOptions([
    ...options,
    { id: normalizedValue, nome: fallbackLabel || normalizedValue },
  ]);
};

const getFluxoResumoLabel = (fluxo: FluxoResumo) =>
  [fluxo.produto, fluxo.tipo_cliente, fluxo.tipo_ligacao]
    .map((item) => item.trim())
    .filter(Boolean)
    .join("-")
    .toLocaleLowerCase("pt-BR");

const getMensagemDisplayName = (mensagem: MensagemFluxo) => {
  const titulo = stripHtml(mensagem.titulo);

  if (titulo) {
    return titulo;
  }

  return `Mensagem ${mensagem.ordem_exibicao || "sem ordem"}`;
};

const getApiErrorMessage = (error: unknown, fallback: string) => {
  const apiError = error as {
    response?: {
      data?: {
        erro?: string;
        detalhe?: string;
        message?: string;
      };
      status?: number;
    };
    message?: string;
  };
  const data = apiError.response?.data;
  const status = apiError.response?.status;
  const message = data?.erro || data?.detalhe || data?.message || apiError.message;

  if (message) {
    return status ? `${fallback} (${status}): ${message}` : `${fallback}: ${message}`;
  }

  return fallback;
};

const buildCopiedFlowPayload = (
  messages: MensagemFluxo[],
  positions: Record<string, NodePosition>,
  source: "message" | "flow",
): CopiedFlowPayload => ({
  version: 1,
  copiedAt: new Date().toISOString(),
  source,
  messages: normalizeMessages(messages).map((mensagem) => ({
    oldId: mensagem.id_mensagem,
    titulo: mensagem.titulo,
    mensagem: mensagem.mensagem,
    ordem_exibicao: mensagem.ordem_exibicao,
    position: positions[mensagem.id_mensagem],
    opcoes: mensagem.opcoes.map((opcao) => ({
      texto_opcao: opcao.texto_opcao,
      oldNextMessageId: opcao.proxima_mensagem_id,
      ordem_opcao: opcao.ordem_opcao,
    })),
  })),
});

// Reexportado porque o RoteiroVegaAdm já importa daqui; a implementação vive
// em utils/richText para as telas do operador usarem sem puxar o builder junto.
export { renderRichText };

export const normalizeEditorHtml = (text = "") => {
  if (!text) {
    return "";
  }

  if (/<[a-z][\s\S]*>/i.test(text)) {
    return text;
  }

  return text
    .split(/\r?\n/)
    .map((line) => `<p>${line || "<br>"}</p>`)
    .join("");
};

const quillSizeClassToFontSize: Record<string, string> = {
  "ql-size-small": "0.75em",
  "ql-size-large": "1.5em",
  "ql-size-huge": "2.5em",
};

/**
 * Alinhamento gravado como classe pelo Quill antigo.
 *
 * O CSS do Quill so define essas classes dentro de `.ql-editor`, entao no
 * roteiro elas nao pintavam nada. Convertidas para estilo inline, valem em
 * qualquer lugar -- e o conteudo do banco converge sozinho conforme as
 * mensagens vao sendo salvas.
 */
const quillAlignClassToTextAlign: Record<string, string> = {
  "ql-align-left": "left",
  "ql-align-center": "center",
  "ql-align-right": "right",
  "ql-align-justify": "justify",
};

export const normalizeEditorHtmlForStorage = (text = "") => {
  const normalizedText = normalizeEditorHtml(text);

  if (!normalizedText || typeof window === "undefined") {
    return normalizedText;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(normalizedText, "text/html");

  doc.body.querySelectorAll("[class]").forEach((element) => {
    const htmlElement = element as HTMLElement;

    Object.entries(quillSizeClassToFontSize).forEach(
      ([className, fontSize]) => {
        if (
          htmlElement.classList.contains(className) &&
          !htmlElement.style.fontSize
        ) {
          htmlElement.style.fontSize = fontSize;
          htmlElement.classList.remove(className);
        }
      },
    );

    Object.entries(quillAlignClassToTextAlign).forEach(
      ([className, textAlign]) => {
        if (
          htmlElement.classList.contains(className) &&
          !htmlElement.style.textAlign
        ) {
          htmlElement.style.textAlign = textAlign;
          htmlElement.classList.remove(className);
        }
      },
    );

    if (!htmlElement.className.trim()) {
      htmlElement.removeAttribute("class");
    }
  });

  return sanitizeThemeDependentStyles(doc.body.innerHTML);
};

/**
 * Titulo: centro por padrao, escolha explicita manda.
 *
 * O centro entra so quando o bloco nao tem alinhamento nenhum. Como esquerda
 * agora grava `text-align: left`, quem escolhe esquerda nao e sobrescrito na
 * proxima gravacao -- que era o problema de simplesmente centralizar tudo.
 */
export const normalizeTituloForStorage = (text = "") => {
  const html = normalizeEditorHtmlForStorage(text);

  if (!html || typeof window === "undefined") {
    return html;
  }

  const doc = new DOMParser().parseFromString(html, "text/html");

  Array.from(doc.body.children).forEach((element) => {
    const htmlElement = element as HTMLElement;

    if (!htmlElement.style.textAlign) {
      htmlElement.style.textAlign = "center";
    }
  });

  return doc.body.innerHTML;
};

const makeDraftOption = (): OpcaoFluxo => ({
  id_opcao: `draft-${uuidv4()}`,
  texto_opcao: "Nova opção",
  proxima_mensagem_id: null,
});

export const normalizeMessages = (mensagens: MensagemFluxo[] = []) =>
  [...mensagens]
    .sort((a, b) => (a.ordem_exibicao || 0) - (b.ordem_exibicao || 0))
    .map((mensagem, index) => ({
      ...mensagem,
      ordem_exibicao: index + 1,
      opcoes: [...(mensagem.opcoes || [])].sort(
        (a, b) => (a.ordem_opcao || 0) - (b.ordem_opcao || 0),
      ),
    }));

const buildPositions = (mensagens: MensagemFluxo[]) => {
  const positions: Record<string, NodePosition> = {};

  mensagens.forEach((mensagem, index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    positions[mensagem.id_mensagem] = {
      x: 80 + column * 360,
      y: 80 + row * 400,
    };
  });

  return positions;
};

const buildCanvasSize = (positions: Record<string, NodePosition>) => {
  const allPositions = Object.values(positions);

  if (!allPositions.length) {
    return { width: 1800, height: 1200 };
  }

  const maxX = Math.max(...allPositions.map((position) => position.x));
  const maxY = Math.max(...allPositions.map((position) => position.y));

  return {
    width: Math.max(1800, maxX + 520),
    height: Math.max(1200, maxY + 420),
  };
};

const EditableFilterField: React.FC<EditableFilterFieldProps> = ({
  label,
  placeholder,
  value,
  options,
  onChange,
  helperText,
}) => {
  const normalizedValue = normalizeSearchText(value);
  const sortedOptions = normalizeSelectOptions(options);
  const exactMatch = sortedOptions.find(
    (item) => normalizeSearchText(item.id) === normalizedValue,
  );

  const matchingOptions = normalizedValue
    ? sortedOptions.filter(
        (item) =>
          normalizeSearchText(item.nome).includes(normalizedValue) ||
          normalizeSearchText(item.id).includes(normalizedValue),
      )
    : sortedOptions;

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        {label}
      </label>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />

      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
        <span>
          {exactMatch
            ? `Selecionado: ${exactMatch.nome}`
            : value.trim()
              ? `Usando valor digitado: ${value.trim()}`
              : "Selecione um valor existente ou digite um novo identificador."}
        </span>
        {helperText ? <span>{helperText}</span> : null}
      </div>

      <div className="roteiro-hide-scrollbar flex max-h-28 flex-wrap gap-2 overflow-y-auto pr-1">
        {matchingOptions.length ? (
          matchingOptions.map((item) => {
            const isActive =
              value === item.id ||
              normalizeSearchText(value) === normalizeSearchText(item.nome);

            return (
              <button
                key={`${label}-${item.id}`}
                type="button"
                onClick={() => onChange(item.id)}
                className={`rounded-full border px-2.5 py-1 text-xs transition ${
                  isActive
                    ? "border-orange-300 bg-orange-100 text-orange-900 dark:border-orange-500/70 dark:bg-orange-500/15 dark:text-orange-200"
                    : "border-slate-200 bg-white text-slate-700 hover:border-orange-300 hover:text-orange-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-orange-500/60 dark:hover:text-orange-200"
                }`}
              >
                {item.nome}
              </button>
            );
          })
        ) : (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Nenhuma sugestão encontrada.
          </span>
        )}
      </div>
    </div>
  );
};

const SelectFilterField: React.FC<SelectFilterFieldProps> = ({
  label,
  value,
  options,
  onChange,
}) => {
  const sortedOptions = normalizeSelectOptions(options);

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        {label}
      </label>
      <Select
        value={value || ALL_FILTER_VALUE}
        onValueChange={(nextValue) =>
          onChange(nextValue === ALL_FILTER_VALUE ? "" : nextValue)
        }
      >
        <SelectTrigger className="border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_FILTER_VALUE}>Todos</SelectItem>
          {sortedOptions.map((item) => (
            <SelectItem key={`${label}-${item.id}`} value={item.id}>
              {item.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

const RoteiroFluxoBuilderModal: React.FC<BuilderProps> = ({
  isOpen,
  onClose,
  initialTipoLigacao = "",
  initialProduto = "",
  initialTipoCliente = "",
}) => {
  const [tiposLigacao, setTiposLigacao] = useState<SelectOption[]>([]);
  const [produtos, setProdutos] = useState<SelectOption[]>([]);
  const [tiposCliente, setTiposCliente] = useState<SelectOption[]>([]);
  const [fluxosDisponiveis, setFluxosDisponiveis] = useState<FluxoResumo[]>([]);
  const [fluxoBuscaId, setFluxoBuscaId] = useState("");
  const [mostrarFiltrosBusca, setMostrarFiltrosBusca] = useState(false);
  const [loadingFluxos, setLoadingFluxos] = useState(false);
  const [tipoLigacaoBusca, setTipoLigacaoBusca] = useState("");
  const [produtoBusca, setProdutoBusca] = useState("");
  const [tipoClienteBusca, setTipoClienteBusca] = useState("");
  const [tipoLigacaoSelecionado, setTipoLigacaoSelecionado] = useState("");
  const [produtoSelecionado, setProdutoSelecionado] = useState("");
  const [tipoClienteSelecionado, setTipoClienteSelecionado] = useState("");
  const [fluxoId, setFluxoId] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<MensagemFluxo[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [positions, setPositions] = useState<Record<string, NodePosition>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCreateFlowPrompt, setShowCreateFlowPrompt] = useState(false);
  const [showFlowMetaEditor, setShowFlowMetaEditor] = useState(false);
  const [confirmationPrompt, setConfirmationPrompt] =
    useState<ConfirmationPrompt | null>(null);
  const [novoTipoLigacao, setNovoTipoLigacao] = useState("");
  const [novoProduto, setNovoProduto] = useState("");
  const [novoTipoCliente, setNovoTipoCliente] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [leftPanelWidth, setLeftPanelWidth] = useState(300);
  const [isResizingLeftPanel, setIsResizingLeftPanel] = useState(false);
  const [rightPanelWidth, setRightPanelWidth] = useState(360);
  const [isResizingRightPanel, setIsResizingRightPanel] = useState(false);
  const [isInspectorManuallyOpen, setIsInspectorManuallyOpen] = useState(false);
  const [isDraggingJson, setIsDraggingJson] = useState(false);
  const [importFileName, setImportFileName] = useState("");
  const [importParsed, setImportParsed] = useState<ParsedRoteiro | null>(null);
  const [importMarcaNome, setImportMarcaNome] = useState("");
  const [importDestino, setImportDestino] = useState<"novo" | "atual">("novo");
  const [importTipoLigacao, setImportTipoLigacao] = useState("");
  const [importProduto, setImportProduto] = useState("");
  const [importTipoCliente, setImportTipoCliente] = useState("");
  const [importIncluirTabulacao, setImportIncluirTabulacao] = useState(true);
  const [importVoltarAoInicio, setImportVoltarAoInicio] = useState(true);
  const [importando, setImportando] = useState(false);
  const [importProgresso, setImportProgresso] = useState({ feitas: 0, total: 0 });
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const jsonInputRef = useRef<HTMLInputElement | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(
    null,
  );
  const isHydratingFlowRef = useRef(false);
  const lastSavedFlowSnapshotRef = useRef("");
  const [zoom, setZoom] = useState(1);

  /**
   * Zoom que está de fato pintado na tela, e a âncora pendente do cursor.
   *
   * Entre o evento da roda e a correção da rolagem existe um instante em que o
   * estado `zoom` e o DOM divergem. Ancorar pelo valor renderizado mantém a
   * conta correta quando vários eventos chegam antes do próximo quadro.
   */
  const zoomRenderizadoRef = useRef(1);
  const ancoraZoomRef = useRef<{
    alvoX: number;
    alvoY: number;
    conteudoX: number;
    conteudoY: number;
  } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [betaStart, setBetaStart] = useState({
    x: 0,
    y: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });

  /**
   * Ponto do mouse em coordenada da malha.
   *
   * Precisa somar a rolagem e dividir pelo zoom: `getBoundingClientRect` dá a
   * posição da janela de rolagem, não do conteúdo. Sem a rolagem o arraste já
   * errava quando a malha estava deslocada -- com o zoom, erraria sempre.
   */
  const paraCoordenadaDaMalha = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return { x: 0, y: 0 };
    }

    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left + canvas.scrollLeft) / zoom,
      y: (clientY - rect.top + canvas.scrollTop) / zoom,
    };
  };

  /**
   * Arrastar a malha começa em qualquer ponto que não seja um card.
   *
   * Antes a condição era `event.target === event.currentTarget`, ou seja, o
   * clique tinha de cair exatamente na div de fundo: em cima da SVG das
   * conexões, ou de qualquer elemento intermediário, não pegava. Com o zoom
   * isso ficou pior, porque a área vazia encolhe.
   */
  const handleCanvasBetaStart = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current) return;

    // Botão esquerdo apenas: o direito abre o menu do navegador.
    if (event.button !== 0) return;

    if ((event.target as HTMLElement).closest("[data-card-fluxo]")) return;

    event.preventDefault();
    setIsPanning(true);
    setSelectedId(null);

    setBetaStart({
      x: event.clientX,
      y: event.clientY,
      scrollLeft: canvasRef.current.scrollLeft,
      scrollTop: canvasRef.current.scrollTop,
    });
  };

  /**
   * O fluxo carregado alimenta uma aba do operador?
   *
   * Quem decide é o backend (`fixo` vem em /roteiro/fluxos) para a tela não
   * virar uma segunda cópia da lista de nomes. Aqui só serve para não oferecer
   * um botão que o servidor vai recusar.
   */
  const fluxoFixo = useMemo(
    () => fluxosDisponiveis.find((item) => item.id_fluxo === fluxoId) ?? null,
    [fluxosDisponiveis, fluxoId],
  );
  const rotuloFixo = fluxoFixo?.fixo ? fluxoFixo.rotulo_fixo || "fixo" : null;

  const selectedMessage = useMemo(
    () =>
      mensagens.find((mensagem) => mensagem.id_mensagem === selectedId) || null,
    [mensagens, selectedId],
  );
  const showInspectorPanel = Boolean(selectedMessage) || isInspectorManuallyOpen;

  /**
   * Os três nomes do fluxo estão preenchidos?
   *
   * O autosave reenvia os nomes a cada edição de mensagem, com o que estiver
   * no estado. Um campo apagado em "Dados do fluxo" — ou um fluxo que já veio
   * sem nome do banco — fazia o autosave gravar vazio e o fluxo perdia a
   * identidade: some dos combos, vira uma linha em branco na lista e nenhuma
   * aba acha mais ele. Quando falta nome, salvamos as mensagens e deixamos o
   * cabeçalho quieto.
   */
  const metaDoFluxoCompleta = (
    tipoLigacao: string,
    produto: string,
    tipoCliente: string,
  ) =>
    Boolean(
      normalizeFlowIdentifier(tipoLigacao) &&
        normalizeFlowIdentifier(produto) &&
        normalizeFlowIdentifier(tipoCliente),
    );

  const buildFlowSnapshot = (
    tipoLigacao: string,
    produto: string,
    tipoCliente: string,
    mensagensFluxo: MensagemFluxo[],
  ) =>
    JSON.stringify({
      tipo_ligacao: normalizeFlowIdentifier(tipoLigacao),
      produto: normalizeFlowIdentifier(produto),
      tipo_cliente: normalizeFlowIdentifier(tipoCliente),
      mensagens: mensagensFluxo.map((mensagem) => ({
        id_mensagem: mensagem.id_mensagem,
        id_fluxo: mensagem.id_fluxo,
        ordem_exibicao: mensagem.ordem_exibicao,
        titulo: normalizeTituloForStorage(mensagem.titulo),
        mensagem: normalizeEditorHtmlForStorage(mensagem.mensagem),
        opcoes: mensagem.opcoes.map((opcao) => ({
          id_opcao: opcao.id_opcao,
          texto_opcao: opcao.texto_opcao,
          proxima_mensagem_id: opcao.proxima_mensagem_id,
          ordem_opcao: opcao.ordem_opcao,
        })),
      })),
    });

  const tiposLigacaoBuscaVisiveis = useMemo(
    () =>
      ensureOptionExists(
        normalizeSelectOptions(tiposLigacao),
        tipoLigacaoBusca,
      ),
    [tiposLigacao, tipoLigacaoBusca],
  );

  const produtosBuscaVisiveis = useMemo(
    () => ensureOptionExists(normalizeSelectOptions(produtos), produtoBusca),
    [produtos, produtoBusca],
  );

  const tiposClienteBuscaVisiveis = useMemo(
    () =>
      ensureOptionExists(
        normalizeSelectOptions(tiposCliente),
        tipoClienteBusca,
      ),
    [tiposCliente, tipoClienteBusca],
  );

  const carregarFluxosDisponiveis = async (
    filtros?: Partial<{
      tipo_ligacao: string;
      produto: string;
      tipo_cliente: string;
    }>,
  ) => {
    const params = {
      tipo_ligacao: filtros?.tipo_ligacao?.trim() || undefined,
      produto: filtros?.produto?.trim() || undefined,
      tipo_cliente: filtros?.tipo_cliente?.trim() || undefined,
    };

    setLoadingFluxos(true);
    try {
      const response = await axiosInstance.get("/api/roteiro/fluxos", {
        params,
      });
      setFluxosDisponiveis(response.data || []);
    } catch (error) {
      console.error("Erro ao carregar fluxos disponiveis:", error);
      toast.error(getApiErrorMessage(error, "Erro ao carregar fluxos disponiveis"));
    } finally {
      setLoadingFluxos(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setTipoLigacaoSelecionado(initialTipoLigacao);
    setProdutoSelecionado(initialProduto);
    setTipoClienteSelecionado(initialTipoCliente);
    setTipoLigacaoBusca(initialTipoLigacao);
    setProdutoBusca(initialProduto);
    setTipoClienteBusca(initialTipoCliente);
    setNovoTipoLigacao(initialTipoLigacao);
    setNovoProduto(initialProduto);
    setNovoTipoCliente(initialTipoCliente);
  }, [isOpen, initialProduto, initialTipoLigacao, initialTipoCliente]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const carregarFiltros = async () => {
      setLoading(true);
      try {
        const [tiposLigacaoRes, produtosRes, tiposClienteRes, fluxosRes] =
          await Promise.all([
            axiosInstance.get("/api/roteiro/tipos-ligacao"),
            axiosInstance.get("/api/roteiro/produtos"),
            axiosInstance.get("/api/roteiro/tipos-cliente"),
            axiosInstance.get("/api/roteiro/fluxos"),
          ]);

        setTiposLigacao(normalizeSelectOptions(tiposLigacaoRes.data || []));
        setProdutos(normalizeSelectOptions(produtosRes.data || []));
        setTiposCliente(normalizeSelectOptions(tiposClienteRes.data || []));
        setFluxosDisponiveis(fluxosRes.data || []);
        setFluxoBuscaId("");
      } catch (error) {
        console.error("Erro ao carregar filtros do builder:", error);
        toast.error(getApiErrorMessage(error, "Erro ao carregar filtros do fluxo"));
      } finally {
        setLoading(false);
      }
    };

    carregarFiltros();
  }, [isOpen]);

  useEffect(() => {
    if (!isResizingLeftPanel) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      setLeftPanelWidth(Math.min(420, Math.max(260, event.clientX)));
    };

    const handleMouseUp = () => {
      setIsResizingLeftPanel(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingLeftPanel]);

  useEffect(() => {
    if (!isResizingRightPanel) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const nextWidth = window.innerWidth - event.clientX;
      setRightPanelWidth(Math.min(720, Math.max(320, nextWidth)));
    };

    const handleMouseUp = () => {
      setIsResizingRightPanel(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingRightPanel]);

  const carregarFluxo = async (
    filtros?: Partial<{
      tipo_ligacao: string;
      produto: string;
      tipo_cliente: string;
    }>,
  ) => {
    const tipoLigacao = filtros?.tipo_ligacao ?? tipoLigacaoBusca;
    const produto = filtros?.produto ?? produtoBusca;
    const tipoCliente = filtros?.tipo_cliente ?? tipoClienteBusca;

    if (!tipoLigacao || !produto || !tipoCliente) {
      toast.error("Selecione os filtros antes de carregar o fluxo.");
      return;
    }

    setLoading(true);
    try {
      const response = await axiosInstance.get(
        "/api/roteiro/mensagem-inicial",
        {
          params: {
            tipo_ligacao: tipoLigacao,
            produto,
            tipo_cliente: tipoCliente,
          },
        },
      );

      const fluxo = response.data?.fluxo;
      const mensagensNormalizadas = normalizeMessages(fluxo?.mensagens || []);

      isHydratingFlowRef.current = true;
      setFluxoId(fluxo?.id_fluxo ?? null);
      setFluxoBuscaId(fluxo?.id_fluxo ?? "");
      setTipoLigacaoSelecionado(fluxo?.tipo_ligacao ?? tipoLigacao);
      setProdutoSelecionado(fluxo?.produto ?? produto);
      setTipoClienteSelecionado(fluxo?.tipo_cliente ?? tipoCliente);
      setTipoLigacaoBusca(fluxo?.tipo_ligacao ?? tipoLigacao);
      setProdutoBusca(fluxo?.produto ?? produto);
      setTipoClienteBusca(fluxo?.tipo_cliente ?? tipoCliente);
      setMensagens(mensagensNormalizadas);
      setSelectedId(mensagensNormalizadas[0]?.id_mensagem ?? null);
      setPositions(buildPositions(mensagensNormalizadas));
      lastSavedFlowSnapshotRef.current = buildFlowSnapshot(
        fluxo?.tipo_ligacao ?? tipoLigacao,
        fluxo?.produto ?? produto,
        fluxo?.tipo_cliente ?? tipoCliente,
        mensagensNormalizadas,
      );
    } catch (error) {
      console.error("Erro ao carregar fluxo no builder:", error);
      setFluxoId(null);
      setMensagens([]);
      setSelectedId(null);
      setPositions({});
      lastSavedFlowSnapshotRef.current = "";
      toast.error(
        getApiErrorMessage(
          error,
          "Fluxo não encontrado para os filtros selecionados",
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  const carregarFluxoPorId = async (id: string) => {
    if (!id) {
      return;
    }

    setLoading(true);
    try {
      const response = await axiosInstance.get(`/api/roteiro/fluxo/${id}`);
      const fluxo = response.data?.fluxo;
      const mensagensNormalizadas = normalizeMessages(fluxo?.mensagens || []);

      isHydratingFlowRef.current = true;
      setFluxoId(fluxo?.id_fluxo ?? null);
      setFluxoBuscaId(fluxo?.id_fluxo ?? id);
      setTipoLigacaoSelecionado(fluxo?.tipo_ligacao ?? "");
      setProdutoSelecionado(fluxo?.produto ?? "");
      setTipoClienteSelecionado(fluxo?.tipo_cliente ?? "");
      setTipoLigacaoBusca(fluxo?.tipo_ligacao ?? "");
      setProdutoBusca(fluxo?.produto ?? "");
      setTipoClienteBusca(fluxo?.tipo_cliente ?? "");
      setMensagens(mensagensNormalizadas);
      setSelectedId(mensagensNormalizadas[0]?.id_mensagem ?? null);
      setPositions(buildPositions(mensagensNormalizadas));
      lastSavedFlowSnapshotRef.current = buildFlowSnapshot(
        fluxo?.tipo_ligacao ?? "",
        fluxo?.produto ?? "",
        fluxo?.tipo_cliente ?? "",
        mensagensNormalizadas,
      );
    } catch (error) {
      console.error("Erro ao carregar fluxo por id no builder:", error);
      toast.error(getApiErrorMessage(error, "Não foi possível carregar o fluxo"));
    } finally {
      setLoading(false);
    }
  };

  const aplicarFiltrosBusca = async () => {
    await carregarFluxosDisponiveis({
      tipo_ligacao: tipoLigacaoBusca,
      produto: produtoBusca,
      tipo_cliente: tipoClienteBusca,
    });
    setFluxoBuscaId("");
    setMostrarFiltrosBusca(false);
  };

  const limparFiltrosBusca = async () => {
    setTipoLigacaoBusca("");
    setProdutoBusca("");
    setTipoClienteBusca("");
    setFluxoBuscaId("");
    await carregarFluxosDisponiveis();
  };

  const criarFluxo = async () => {
    if (
      !novoTipoLigacao.trim() ||
      !novoProduto.trim() ||
      !novoTipoCliente.trim()
    ) {
      toast.error("Pessoa, produto e tipo de ligação são obrigatórios.");
      return;
    }

    setSaving(true);
    try {
      const novosFiltros = {
        tipo_ligacao: normalizeFlowIdentifier(novoTipoLigacao),
        tipo_cliente: normalizeFlowIdentifier(novoTipoCliente),
        produto: normalizeFlowIdentifier(novoProduto),
      };

      const response = await axiosInstance.post("/api/roteiro/fluxo", novosFiltros);
      const novoFluxoId = response.data?.id_fluxo || "";

      toast.success("Fluxo criado.");
      setFluxoBuscaId(novoFluxoId);
      setTipoLigacaoSelecionado(novosFiltros.tipo_ligacao);
      setTipoClienteSelecionado(novosFiltros.tipo_cliente);
      setProdutoSelecionado(novosFiltros.produto);
      setTipoLigacaoBusca(novosFiltros.tipo_ligacao);
      setTipoClienteBusca(novosFiltros.tipo_cliente);
      setProdutoBusca(novosFiltros.produto);
      setTiposLigacao((prev) =>
        ensureOptionExists(prev, novosFiltros.tipo_ligacao),
      );
      setTiposCliente((prev) =>
        ensureOptionExists(prev, novosFiltros.tipo_cliente),
      );
      setProdutos((prev) => ensureOptionExists(prev, novosFiltros.produto));
      setShowCreateFlowPrompt(false);
      await carregarFluxosDisponiveis();
      await carregarFluxo(novosFiltros);
    } catch (error) {
      console.error("Erro ao criar fluxo no builder:", error);
      toast.error(getApiErrorMessage(error, "Erro ao criar fluxo"));
    } finally {
      setSaving(false);
    }
  };

  const updateMensagem = (
    idMensagem: string,
    updater: (mensagem: MensagemFluxo) => MensagemFluxo,
  ) => {
    setMensagens((prev) =>
      normalizeMessages(
        prev.map((mensagem) =>
          mensagem.id_mensagem === idMensagem ? updater(mensagem) : mensagem,
        ),
      ),
    );
  };

  const persistCurrentFlow = async ({
    showSuccess = false,
    showError = true,
    reloadAfterSave = false,
  } = {}) => {
    if (!fluxoId || !mensagens.length) {
      return true;
    }

    const currentSnapshot = buildFlowSnapshot(
      tipoLigacaoSelecionado,
      produtoSelecionado,
      tipoClienteSelecionado,
      mensagens,
    );

    if (currentSnapshot === lastSavedFlowSnapshotRef.current) {
      return true;
    }

    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    const filtrosNormalizados = {
      tipo_ligacao: normalizeFlowIdentifier(tipoLigacaoSelecionado),
      produto: normalizeFlowIdentifier(produtoSelecionado),
      tipo_cliente: normalizeFlowIdentifier(tipoClienteSelecionado),
    };

    try {
      if (
        metaDoFluxoCompleta(
          tipoLigacaoSelecionado,
          produtoSelecionado,
          tipoClienteSelecionado,
        )
      ) {
        await axiosInstance.put(`/api/roteiro/fluxo/${fluxoId}`, {
          tipo_ligacao: filtrosNormalizados.tipo_ligacao,
          produto: filtrosNormalizados.produto,
          tipo_cliente: filtrosNormalizados.tipo_cliente,
        });
      }

      for (const mensagem of mensagens) {
        await axiosInstance.put("/api/roteiro/mensagem", {
          id_mensagem: mensagem.id_mensagem,
          id_fluxo: mensagem.id_fluxo,
          ordem_exibicao: mensagem.ordem_exibicao,
          titulo: normalizeTituloForStorage(mensagem.titulo),
          mensagem: normalizeEditorHtmlForStorage(mensagem.mensagem),
          opcoes: mensagem.opcoes.map((opcao) => ({
            id_opcao: opcao.id_opcao.startsWith("draft-") ? "" : opcao.id_opcao,
            texto_opcao: opcao.texto_opcao,
            proxima_mensagem_id:
              opcao.proxima_mensagem_id === AUTO_CREATE_VALUE
                ? ""
                : opcao.proxima_mensagem_id,
          })),
        });
      }

      lastSavedFlowSnapshotRef.current = currentSnapshot;

      if (reloadAfterSave) {
        await carregarFluxosDisponiveis();
        await carregarFluxoPorId(fluxoId);
      }

      if (showSuccess) {
        toast.success("Fluxo salvo.");
      }

      return true;
    } catch (error) {
      console.error("Erro ao salvar fluxo atual:", error);
      if (showError) {
        toast.error(
          getApiErrorMessage(
            error,
            "Não foi possível salvar as alterações antes de trocar de fluxo",
          ),
        );
      }
      return false;
    }
  };

  const selecionarFluxoBusca = async (id: string) => {
    if (!id || id === fluxoId) {
      setFluxoBuscaId(id);
      return;
    }

    const saved = await persistCurrentFlow();
    if (!saved) {
      setFluxoBuscaId(fluxoId ?? "");
      return;
    }

    setFluxoBuscaId(id);
    await carregarFluxoPorId(id);
  };

  const saveFlowMeta = async () => {
    if (!fluxoId) {
      toast.error("Carregue um fluxo antes de salvar os dados.");
      return;
    }

    const filtrosNormalizados = {
      tipo_ligacao: normalizeFlowIdentifier(tipoLigacaoSelecionado),
      produto: normalizeFlowIdentifier(produtoSelecionado),
      tipo_cliente: normalizeFlowIdentifier(tipoClienteSelecionado),
    };

    if (
      !metaDoFluxoCompleta(
        tipoLigacaoSelecionado,
        produtoSelecionado,
        tipoClienteSelecionado,
      )
    ) {
      toast.error(
        "Preencha tipo de ligação, produto e tipo de cliente: sem os três o fluxo some dos filtros do operador.",
      );
      return;
    }

    setSaving(true);
    try {
      await axiosInstance.put(`/api/roteiro/fluxo/${fluxoId}`, {
        tipo_ligacao: filtrosNormalizados.tipo_ligacao,
        produto: filtrosNormalizados.produto,
        tipo_cliente: filtrosNormalizados.tipo_cliente,
      });

      setTipoLigacaoSelecionado(filtrosNormalizados.tipo_ligacao);
      setProdutoSelecionado(filtrosNormalizados.produto);
      setTipoClienteSelecionado(filtrosNormalizados.tipo_cliente);
      setTipoLigacaoBusca(filtrosNormalizados.tipo_ligacao);
      setProdutoBusca(filtrosNormalizados.produto);
      setTipoClienteBusca(filtrosNormalizados.tipo_cliente);
      setTiposLigacao((prev) =>
        ensureOptionExists(prev, filtrosNormalizados.tipo_ligacao),
      );
      setProdutos((prev) =>
        ensureOptionExists(prev, filtrosNormalizados.produto),
      );
      setTiposCliente((prev) =>
        ensureOptionExists(prev, filtrosNormalizados.tipo_cliente),
      );
      lastSavedFlowSnapshotRef.current = buildFlowSnapshot(
        filtrosNormalizados.tipo_ligacao,
        filtrosNormalizados.produto,
        filtrosNormalizados.tipo_cliente,
        mensagens,
      );
      await carregarFluxosDisponiveis();
      setShowFlowMetaEditor(false);
      toast.success("Dados do fluxo salvos.");
    } catch (error) {
      console.error("Erro ao salvar dados do fluxo:", error);
      toast.error(getApiErrorMessage(error, "Erro ao salvar dados do fluxo"));
    } finally {
      setSaving(false);
    }
  };

  const saveAllMessages = async () => {
    if (!fluxoId || !mensagens.length) {
      toast.error("Carregue um fluxo antes de salvar.");
      return;
    }

    const filtrosNormalizados = {
      tipo_ligacao: normalizeFlowIdentifier(tipoLigacaoSelecionado),
      produto: normalizeFlowIdentifier(produtoSelecionado),
      tipo_cliente: normalizeFlowIdentifier(tipoClienteSelecionado),
    };

    setSaving(true);
    try {
      setTipoLigacaoSelecionado(filtrosNormalizados.tipo_ligacao);
      setProdutoSelecionado(filtrosNormalizados.produto);
      setTipoClienteSelecionado(filtrosNormalizados.tipo_cliente);
      setTipoLigacaoBusca(filtrosNormalizados.tipo_ligacao);
      setProdutoBusca(filtrosNormalizados.produto);
      setTipoClienteBusca(filtrosNormalizados.tipo_cliente);
      setTiposLigacao((prev) =>
        ensureOptionExists(prev, filtrosNormalizados.tipo_ligacao),
      );
      setProdutos((prev) =>
        ensureOptionExists(prev, filtrosNormalizados.produto),
      );
      setTiposCliente((prev) =>
        ensureOptionExists(prev, filtrosNormalizados.tipo_cliente),
      );

      if (
        metaDoFluxoCompleta(
          tipoLigacaoSelecionado,
          produtoSelecionado,
          tipoClienteSelecionado,
        )
      ) {
        await axiosInstance.put(`/api/roteiro/fluxo/${fluxoId}`, {
          tipo_ligacao: filtrosNormalizados.tipo_ligacao,
          produto: filtrosNormalizados.produto,
          tipo_cliente: filtrosNormalizados.tipo_cliente,
        });
      }

      for (const mensagem of mensagens) {
        await axiosInstance.put("/api/roteiro/mensagem", {
          id_mensagem: mensagem.id_mensagem,
          id_fluxo: mensagem.id_fluxo,
          ordem_exibicao: mensagem.ordem_exibicao,
          titulo: normalizeTituloForStorage(mensagem.titulo),
          mensagem: normalizeEditorHtmlForStorage(mensagem.mensagem),
          opcoes: mensagem.opcoes.map((opcao) => ({
            id_opcao: opcao.id_opcao.startsWith("draft-") ? "" : opcao.id_opcao,
            texto_opcao: opcao.texto_opcao,
            proxima_mensagem_id:
              opcao.proxima_mensagem_id === AUTO_CREATE_VALUE
                ? ""
                : opcao.proxima_mensagem_id,
          })),
        });
      }

      toast.success("Fluxo salvo.");
      lastSavedFlowSnapshotRef.current = buildFlowSnapshot(
        filtrosNormalizados.tipo_ligacao,
        filtrosNormalizados.produto,
        filtrosNormalizados.tipo_cliente,
        mensagens,
      );
      await carregarFluxosDisponiveis();
      await carregarFluxoPorId(fluxoId);
    } catch (error) {
      console.error("Erro ao salvar fluxo no builder:", error);
      toast.error(getApiErrorMessage(error, "Erro ao salvar alterações do fluxo"));
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!fluxoId || !mensagens.length) {
      return;
    }

    if (isHydratingFlowRef.current) {
      isHydratingFlowRef.current = false;
      return;
    }

    const currentSnapshot = buildFlowSnapshot(
      tipoLigacaoSelecionado,
      produtoSelecionado,
      tipoClienteSelecionado,
      mensagens,
    );

    if (currentSnapshot === lastSavedFlowSnapshotRef.current) {
      return;
    }

    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = window.setTimeout(async () => {
      const filtrosNormalizados = {
        tipo_ligacao: normalizeFlowIdentifier(tipoLigacaoSelecionado),
        produto: normalizeFlowIdentifier(produtoSelecionado),
        tipo_cliente: normalizeFlowIdentifier(tipoClienteSelecionado),
      };

      try {
        if (
          metaDoFluxoCompleta(
            tipoLigacaoSelecionado,
            produtoSelecionado,
            tipoClienteSelecionado,
          )
        ) {
          await axiosInstance.put(`/api/roteiro/fluxo/${fluxoId}`, {
            tipo_ligacao: filtrosNormalizados.tipo_ligacao,
            produto: filtrosNormalizados.produto,
            tipo_cliente: filtrosNormalizados.tipo_cliente,
          });
        }

        for (const mensagem of mensagens) {
          await axiosInstance.put("/api/roteiro/mensagem", {
            id_mensagem: mensagem.id_mensagem,
            id_fluxo: mensagem.id_fluxo,
            ordem_exibicao: mensagem.ordem_exibicao,
            titulo: normalizeTituloForStorage(mensagem.titulo),
            mensagem: normalizeEditorHtmlForStorage(mensagem.mensagem),
            opcoes: mensagem.opcoes.map((opcao) => ({
              id_opcao: opcao.id_opcao.startsWith("draft-")
                ? ""
                : opcao.id_opcao,
              texto_opcao: opcao.texto_opcao,
              proxima_mensagem_id:
                opcao.proxima_mensagem_id === AUTO_CREATE_VALUE
                  ? ""
                  : opcao.proxima_mensagem_id,
            })),
          });
        }
        lastSavedFlowSnapshotRef.current = currentSnapshot;
      } catch (error) {
        console.error("Erro ao salvar fluxo automaticamente:", error);
      }
    }, 1200);

    return () => {
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [
    fluxoId,
    mensagens,
    produtoSelecionado,
    tipoClienteSelecionado,
    tipoLigacaoSelecionado,
  ]);

  const criarMensagemNoFluxo = async (x: number, y: number) => {
    if (!fluxoId) {
      toast.error("Crie ou carregue um fluxo antes de adicionar mensagens.");
      return;
    }

    setSaving(true);
    try {
      const response = await axiosInstance.post(
        `/api/roteiro/fluxo/${fluxoId}/mensagem`,
        {
          titulo: "Nova mensagem",
          mensagem: "Nova mensagem criada no fluxo.",
        },
      );

      const novaMensagem = response.data;
      const mensagemCriada: MensagemFluxo = {
        id_fluxo: fluxoId,
        id_mensagem: novaMensagem.id_mensagem,
        ordem_exibicao: novaMensagem.ordem_exibicao,
        titulo: novaMensagem.titulo,
        mensagem: novaMensagem.mensagem,
        opcoes: [],
      };

      setMensagens((prev) => normalizeMessages([...prev, mensagemCriada]));
      setPositions((prev) => ({
        ...prev,
        [novaMensagem.id_mensagem]: {
          x: Math.max(24, x),
          y: Math.max(24, y),
        },
      }));
      setSelectedId(novaMensagem.id_mensagem);
      toast.success("Mensagem criada no fluxo.");
    } catch (error) {
      console.error("Erro ao criar mensagem no fluxo:", error);
      toast.error(getApiErrorMessage(error, "Erro ao criar mensagem no fluxo"));
    } finally {
      setSaving(false);
    }
  };

  const copyMessagesToTemplate = (
    messagesToCopy: MensagemFluxo[],
    source: "message" | "flow",
  ) => {
    if (!messagesToCopy.length) {
      toast.error("Nenhuma mensagem para copiar.");
      return;
    }

    const payload = buildCopiedFlowPayload(messagesToCopy, positions, source);
    localStorage.setItem(COPIED_FLOW_STORAGE_KEY, JSON.stringify(payload));
    toast.success(
      source === "flow"
        ? `${payload.messages.length} mensagens copiadas.`
        : "Mensagem copiada.",
    );
  };

  const copySelectedMessage = () => {
    if (!selectedMessage) {
      toast.error("Selecione uma mensagem para copiar.");
      return;
    }

    copyMessagesToTemplate([selectedMessage], "message");
  };

  const copyCurrentFlow = () => {
    copyMessagesToTemplate(mensagens, "flow");
  };

  const readCopiedFlowPayload = () => {
    const raw = localStorage.getItem(COPIED_FLOW_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as CopiedFlowPayload;
      if (parsed.version !== 1 || !Array.isArray(parsed.messages)) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  };

  const pasteCopiedMessages = async () => {
    if (!fluxoId) {
      toast.error("Carregue ou crie um fluxo antes de colar mensagens.");
      return;
    }

    const payload = readCopiedFlowPayload();
    if (!payload?.messages.length) {
      toast.error("Nenhuma mensagem copiada para colar.");
      return;
    }

    const saved = await persistCurrentFlow();
    if (!saved) {
      return;
    }

    setSaving(true);
    try {
      const idMap = new Map<string, string>();
      const createdMessages: MensagemFluxo[] = [];
      const pastedPositions: Record<string, NodePosition> = {};
      const existingCount = mensagens.length;

      for (const [index, copiedMessage] of payload.messages.entries()) {
        const response = await axiosInstance.post(
          `/api/roteiro/fluxo/${fluxoId}/mensagem`,
          {
            titulo: copiedMessage.titulo || "Mensagem copiada",
            mensagem: copiedMessage.mensagem || "Mensagem copiada.",
          },
        );
        const created = response.data;
        const newId = created.id_mensagem;

        idMap.set(copiedMessage.oldId, newId);
        createdMessages.push({
          id_fluxo: fluxoId,
          id_mensagem: newId,
          ordem_exibicao: existingCount + index + 1,
          titulo: copiedMessage.titulo || created.titulo,
          mensagem: copiedMessage.mensagem || created.mensagem,
          opcoes: [],
        });
        pastedPositions[newId] = copiedMessage.position
          ? {
              x: copiedMessage.position.x + 80,
              y: copiedMessage.position.y + 80,
            }
          : {
              x: 120 + (index % 3) * 360,
              y: 120 + Math.floor(index / 3) * 360,
            };
      }

      for (const copiedMessage of payload.messages) {
        const newMessageId = idMap.get(copiedMessage.oldId);
        if (!newMessageId) {
          continue;
        }

        const createdMessage = createdMessages.find(
          (mensagem) => mensagem.id_mensagem === newMessageId,
        );
        if (!createdMessage) {
          continue;
        }

        const opcoes = copiedMessage.opcoes.map((opcao) => ({
          id_opcao: "",
          texto_opcao: opcao.texto_opcao,
          proxima_mensagem_id: opcao.oldNextMessageId
            ? idMap.get(opcao.oldNextMessageId) || null
            : null,
        }));

        await axiosInstance.put("/api/roteiro/mensagem", {
          id_mensagem: newMessageId,
          id_fluxo: fluxoId,
          ordem_exibicao: createdMessage.ordem_exibicao,
          titulo: createdMessage.titulo,
          mensagem: createdMessage.mensagem,
          opcoes,
        });
      }

      await carregarFluxoPorId(fluxoId);
      setPositions((prev) => ({ ...prev, ...pastedPositions }));
      setSelectedId(createdMessages[0]?.id_mensagem ?? null);
      toast.success(`${createdMessages.length} mensagens coladas.`);
    } catch (error) {
      console.error("Erro ao colar mensagens:", error);
      toast.error(getApiErrorMessage(error, "Erro ao colar mensagens"));
    } finally {
      setSaving(false);
    }
  };

  const importMarca = useMemo(
    () =>
      importParsed?.marcas.find((marca) => marca.nome === importMarcaNome) ||
      importParsed?.marcas[0] ||
      null,
    [importParsed, importMarcaNome],
  );

  const importPlan = useMemo(
    () =>
      importMarca
        ? buildImportPlan(importMarca, {
            incluirTabulacao: importIncluirTabulacao,
            voltarAusentesParaInicio: importVoltarAoInicio,
          })
        : null,
    [importMarca, importIncluirTabulacao, importVoltarAoInicio],
  );

  const fecharImportacao = () => {
    setImportParsed(null);
    setImportMarcaNome("");
    setImportFileName("");
    setImportProgresso({ feitas: 0, total: 0 });
  };

  const prepararImportacao = async (file: File) => {
    try {
      const parsed = parseRoteiroJson(await file.text());

      if (!parsed.marcas.length || !parsed.marcas[0].nodes.length) {
        toast.error("Nenhuma mensagem encontrada no arquivo.");
        return;
      }

      const primeiraMarca = parsed.marcas[0];

      setImportParsed(parsed);
      setImportMarcaNome(primeiraMarca.nome);
      setImportFileName(file.name);
      setImportDestino("novo");
      setImportProgresso({ feitas: 0, total: 0 });
      // O nome da marca do JSON vira o produto, reaproveitando o valor ja
      // cadastrado em TB_FLUXO quando existir (HABITACIONAL -> Habitacional).
      setImportProduto(
        suggestExistingValue(produtos, primeiraMarca.nome) || produtoSelecionado,
      );
      setImportTipoLigacao(tipoLigacaoSelecionado || tipoLigacaoBusca);
      setImportTipoCliente(tipoClienteSelecionado || tipoClienteBusca);
    } catch (error) {
      console.error("Erro ao ler JSON do roteiro:", error);
      toast.error(
        error instanceof Error ? error.message : "Não foi possível ler o arquivo.",
      );
    }
  };

  const handleJsonFiles = async (files: FileList | null) => {
    const file = files?.[0];

    if (!file) {
      return;
    }

    if (!/\.json$/i.test(file.name) && file.type !== "application/json") {
      toast.error("Selecione um arquivo .json.");
      return;
    }

    await prepararImportacao(file);
  };

  const importarFluxoDoJson = async () => {
    if (!importPlan?.nodes.length) {
      toast.error("Nenhuma mensagem para importar.");
      return;
    }

    const criarNovoFluxo = importDestino === "novo";

    if (
      criarNovoFluxo &&
      (!importTipoLigacao.trim() || !importProduto.trim() || !importTipoCliente.trim())
    ) {
      toast.error("Preencha produto, tipo de cliente e tipo de ligação.");
      return;
    }

    if (!criarNovoFluxo && !fluxoId) {
      toast.error("Carregue um fluxo antes de importar dentro dele.");
      return;
    }

    setImportando(true);
    setImportProgresso({ feitas: 0, total: importPlan.nodes.length * 2 });

    try {
      const idMap = new Map<string, string>();
      let idFluxoDestino = fluxoId ?? "";
      let deslocamentoY = 0;

      if (criarNovoFluxo) {
        const filtrosNormalizados = {
          tipo_ligacao: normalizeFlowIdentifier(importTipoLigacao),
          produto: normalizeFlowIdentifier(importProduto),
          tipo_cliente: normalizeFlowIdentifier(importTipoCliente),
        };

        const response = await axiosInstance.post(
          "/api/roteiro/fluxo",
          filtrosNormalizados,
        );

        idFluxoDestino = response.data?.id_fluxo || "";

        if (!idFluxoDestino) {
          throw new Error("O servidor não retornou o id do fluxo criado.");
        }

        // O POST de fluxo ja cria uma mensagem inicial: ela vira a entrada do
        // roteiro importado em vez de virar uma mensagem orfa.
        const idMensagemInicial = response.data?.id_mensagem_inicial;
        if (idMensagemInicial && importPlan.rootKey) {
          idMap.set(importPlan.rootKey, idMensagemInicial);
        }

        setTiposLigacao((prev) =>
          ensureOptionExists(prev, filtrosNormalizados.tipo_ligacao),
        );
        setProdutos((prev) => ensureOptionExists(prev, filtrosNormalizados.produto));
        setTiposCliente((prev) =>
          ensureOptionExists(prev, filtrosNormalizados.tipo_cliente),
        );
      } else {
        const salvou = await persistCurrentFlow();
        if (!salvou) {
          return;
        }

        const posicoesAtuais = Object.values(positions);
        deslocamentoY = posicoesAtuais.length
          ? Math.max(...posicoesAtuais.map((posicao) => posicao.y)) + 420
          : 0;
      }

      let feitas = 0;
      const total = importPlan.nodes.length * 2;

      // 1a passada: cria as mensagens para conhecer o id real de cada chave.
      for (const node of importPlan.nodes) {
        if (!idMap.has(node.key)) {
          const response = await axiosInstance.post(
            `/api/roteiro/fluxo/${idFluxoDestino}/mensagem`,
            {
              titulo: normalizeTituloForStorage(node.titulo),
              mensagem: node.mensagem,
            },
          );

          const idCriado = response.data?.id_mensagem;

          if (!idCriado) {
            throw new Error(`Não foi possível criar a mensagem "${node.titulo}".`);
          }

          idMap.set(node.key, idCriado);
        }

        feitas += 1;
        setImportProgresso({ feitas, total });
      }

      // 2a passada: grava conteudo e saidas ja apontando para os ids reais.
      for (const [index, node] of importPlan.nodes.entries()) {
        const idMensagem = idMap.get(node.key);

        if (!idMensagem) {
          continue;
        }

        await axiosInstance.put("/api/roteiro/mensagem", {
          id_mensagem: idMensagem,
          id_fluxo: idFluxoDestino,
          ordem_exibicao: index + 1,
          titulo: normalizeTituloForStorage(node.titulo),
          mensagem: normalizeEditorHtmlForStorage(node.mensagem),
          opcoes: node.opcoes.map((opcao) => {
            const chaveDestino = resolvePlanTarget(importPlan, opcao.targetKey);

            return {
              id_opcao: "",
              texto_opcao: opcao.texto_opcao,
              proxima_mensagem_id: chaveDestino
                ? idMap.get(chaveDestino) ?? null
                : null,
            };
          }),
        });

        feitas += 1;
        setImportProgresso({ feitas, total });
      }

      const posicoesImportadas: Record<string, NodePosition> = {};
      importPlan.nodes.forEach((node) => {
        const idMensagem = idMap.get(node.key);
        if (idMensagem) {
          posicoesImportadas[idMensagem] = {
            x: node.position.x,
            y: node.position.y + deslocamentoY,
          };
        }
      });

      setFluxoBuscaId(idFluxoDestino);
      await carregarFluxosDisponiveis();
      await carregarFluxoPorId(idFluxoDestino);
      setPositions((prev) => ({ ...prev, ...posicoesImportadas }));
      setSelectedId(
        (importPlan.rootKey ? idMap.get(importPlan.rootKey) : null) ?? null,
      );

      toast.success(
        `${importPlan.nodes.length} mensagens e ${importPlan.totalOpcoes} saídas importadas.`,
      );
      fecharImportacao();
    } catch (error) {
      console.error("Erro ao importar fluxo do JSON:", error);
      toast.error(getApiErrorMessage(error, "Erro ao importar o fluxo do JSON"));
    } finally {
      setImportando(false);
    }
  };

  /** Arquivo solto em qualquer ponto do builder abre a importacao. */
  const handleModalDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingJson(false);

    if (event.dataTransfer.files?.length) {
      void handleJsonFiles(event.dataTransfer.files);
    }
  };

  const handleCanvasDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    // Arquivos sobem para o handler do modal, que abre a importacao.
    if (event.dataTransfer.files?.length) {
      return;
    }

    if (!canvasRef.current) {
      return;
    }

    const ponto = paraCoordenadaDaMalha(event.clientX, event.clientY);
    const dropX = ponto.x - 150;
    const dropY = ponto.y - 60;

    const template = event.dataTransfer.getData("application/roteiro-builder");

    if (template === "option") {
      if (!selectedMessage) {
        toast.info("Selecione uma mensagem para adicionar uma opção.");
        return;
      }

      updateMensagem(selectedMessage.id_mensagem, (mensagem) => ({
        ...mensagem,
        opcoes: [...mensagem.opcoes, makeDraftOption()],
      }));
      return;
    }

    if (template === "message") {
      criarMensagemNoFluxo(dropX, dropY);
    }
  };

  const handleMouseDown = (
    event: React.MouseEvent<HTMLDivElement>,
    mensagemId: string,
  ) => {
    if (!canvasRef.current) {
      return;
    }

    const current = positions[mensagemId];

    if (!current) {
      return;
    }

    const ponto = paraCoordenadaDaMalha(event.clientX, event.clientY);

    setSelectedId(mensagemId);
    setDraggingId(mensagemId);
    setDragOffset({
      x: ponto.x - current.x,
      y: ponto.y - current.y,
    });
  };

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (draggingId && canvasRef.current) {
        const ponto = paraCoordenadaDaMalha(event.clientX, event.clientY);
        const x = ponto.x - dragOffset.x;
        const y = ponto.y - dragOffset.y;

        setPositions((prev) => ({
          ...prev,
          [draggingId]: {
            x: Math.max(24, x),
            y: Math.max(24, y),
          },
        }));
        return;
      }

      if (isPanning && canvasRef.current) {
        const dx = event.clientX - betaStart.x;
        const dy = event.clientY - betaStart.y;

        canvasRef.current.scrollLeft = betaStart.scrollLeft - dx;
        canvasRef.current.scrollTop = betaStart.scrollTop - dy;
      }
    };

    const handleMouseUp = () => {
      setDraggingId(null);
      setIsPanning(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggingId, dragOffset, isPanning, betaStart]);

  const edges = useMemo(() => {
    return mensagens.flatMap((mensagem) =>
      mensagem.opcoes
        .filter((opcao) => opcao.proxima_mensagem_id)
        .map((opcao) => {
          const from = positions[mensagem.id_mensagem];
          const to =
            opcao.proxima_mensagem_id &&
            positions[opcao.proxima_mensagem_id as string];

          if (!from || !to) {
            return null;
          }

          return {
            key: `${mensagem.id_mensagem}-${opcao.id_opcao}`,
            x1: from.x + 300,
            y1: from.y + 110,
            x2: to.x,
            y2: to.y + 60,
            label: stripHtml(opcao.texto_opcao) || "Opção",
          };
        })
        .filter(Boolean),
    );
  }, [mensagens, positions]);

  /**
   * Roda do mouse aproxima e afasta a malha.
   *
   * Listener nativo com `passive: false`: o `onWheel` do React é registrado
   * como passivo e ali o `preventDefault` é ignorado -- a malha rolaria em vez
   * de dar zoom.
   *
   * Estável (`useCallback` sem dependências) porque lê tudo de refs. Isso
   * permite instalá-lo por ref de callback, logo abaixo.
   */
  const aoRolarNaMalha = useCallback((event: WheelEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    event.preventDefault();

    const rect = canvas.getBoundingClientRect();
    const alvoX = event.clientX - rect.left;
    const alvoY = event.clientY - rect.top;
    const renderizado = zoomRenderizadoRef.current;

    // Ponto do conteúdo sob o cursor, lido no zoom que está na tela: a rolagem
    // atual e esse zoom são o par coerente neste instante.
    ancoraZoomRef.current = {
      alvoX,
      alvoY,
      conteudoX: (alvoX + canvas.scrollLeft) / renderizado,
      conteudoY: (alvoY + canvas.scrollTop) / renderizado,
    };

    setZoom((atual) =>
      Math.min(
        ZOOM_MAX,
        Math.max(ZOOM_MIN, atual * (event.deltaY < 0 ? 1.12 : 1 / 1.12)),
      ),
    );
  }, []);

  /**
   * Guarda o nó da malha e instala a roda no exato instante em que ele aparece.
   *
   * Antes isso era um `useEffect` com dependência em `isOpen`: ele lia
   * `canvasRef.current` uma vez e, se o nó ainda não existisse naquele
   * momento -- ou se fosse trocado depois --, o listener nunca era instalado e
   * a roda voltava a rolar em vez de dar zoom, sem nenhum erro no console.
   * Com ref de callback o React chama isto na montagem e na desmontagem, então
   * o listener acompanha o nó de verdade.
   */
  const registrarCanvas = useCallback(
    (node: HTMLDivElement | null) => {
      if (canvasRef.current) {
        canvasRef.current.removeEventListener("wheel", aoRolarNaMalha);
      }

      canvasRef.current = node;

      if (node) {
        node.addEventListener("wheel", aoRolarNaMalha, { passive: false });
      }
    },
    [aoRolarNaMalha],
  );

  /**
   * Reposiciona a rolagem para o ponto sob o cursor ficar parado.
   *
   * Precisa ser `useLayoutEffect`: roda depois de a malha já ter o tamanho
   * novo e antes da pintura. Com `requestAnimationFrame` o quadro sem a
   * correção chegava a aparecer e, pior, a roda -- que dispara várias vezes
   * por quadro -- lia rolagem e zoom dessincronizados, o que fazia a malha
   * subir e descer sozinha.
   */
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ancora = ancoraZoomRef.current;
    if (ancora) {
      canvas.scrollLeft = ancora.conteudoX * zoom - ancora.alvoX;
      canvas.scrollTop = ancora.conteudoY * zoom - ancora.alvoY;
      ancoraZoomRef.current = null;
    }

    zoomRenderizadoRef.current = zoom;
  }, [zoom]);

  const canvasSize = useMemo(() => buildCanvasSize(positions), [positions]);

  const handleDeleteOption = async (idOpcao: string) => {
    if (!selectedMessage) {
      return;
    }

    const mensagemAtual = selectedMessage;
    const opcaoAtual = mensagemAtual.opcoes.find(
      (opcao) => opcao.id_opcao === idOpcao,
    );

    setConfirmationPrompt({
      title: "Excluir saída",
      description: `Tem certeza que deseja excluir a saída "${
        opcaoAtual?.texto_opcao || "sem nome"
      }"? Essa conexão será removida do fluxo.`,
      confirmLabel: "Excluir saída",
      onConfirm: async () => {
        if (idOpcao.startsWith("draft-")) {
          updateMensagem(mensagemAtual.id_mensagem, (mensagem) => ({
            ...mensagem,
            opcoes: mensagem.opcoes.filter(
              (opcao) => opcao.id_opcao !== idOpcao,
            ),
          }));
          return;
        }

        try {
          await axiosInstance.delete(`/api/roteiro/opcao/${idOpcao}`);
          toast.success("Opção removida.");
          await carregarFluxoPorId(fluxoId || mensagemAtual.id_fluxo);
        } catch (error) {
          console.error("Erro ao excluir opção:", error);
          toast.error(getApiErrorMessage(error, "Erro ao excluir opção"));
        }
      },
    });
  };

  const handleDeleteMessage = async () => {
    if (!selectedMessage) {
      return;
    }

    const mensagemAtual = selectedMessage;

    setConfirmationPrompt({
      title: "Excluir mensagem",
      description: `Tem certeza que deseja excluir "${
        getMensagemDisplayName(mensagemAtual)
      }"? As saídas e conexões dessa mensagem também serão removidas.`,
      confirmLabel: "Excluir mensagem",
      onConfirm: async () => {
        try {
          await axiosInstance.delete(
            `/api/roteiro/mensagem/${mensagemAtual.id_mensagem}`,
          );
          toast.success("Mensagem removida.");
          await carregarFluxoPorId(fluxoId || mensagemAtual.id_fluxo);
        } catch (error) {
          console.error("Erro ao excluir mensagem:", error);
          toast.error(getApiErrorMessage(error, "Erro ao excluir mensagem"));
        }
      },
    });
  };

  const handleDeleteFlow = async () => {
    if (!fluxoId) {
      return;
    }

    // O servidor recusa de qualquer forma; parar aqui evita abrir uma
    // confirmação de exclusão que nunca vai poder ser concluída.
    if (rotuloFixo) {
      toast.error(
        `"${rotuloFixo}" é um fluxo fixo do roteiro do operador e não pode ser excluído.`,
      );
      return;
    }

    const fluxoAtual = fluxoId;

    setConfirmationPrompt({
      title: "Excluir fluxo inteiro",
      description:
        "Tem certeza que deseja excluir este fluxo? Todas as mensagens, saídas e conexões serão removidas.",
      confirmLabel: "Excluir fluxo",
      onConfirm: async () => {
        try {
          await axiosInstance.delete(`/api/roteiro/fluxo/${fluxoAtual}`);
          toast.success("Fluxo removido.");
          setFluxoId(null);
          setFluxoBuscaId("");
          setMensagens([]);
          setSelectedId(null);
          setPositions({});
          lastSavedFlowSnapshotRef.current = "";
          await carregarFluxosDisponiveis();
        } catch (error) {
          console.error("Erro ao excluir fluxo:", error);
          toast.error(getApiErrorMessage(error, "Erro ao excluir fluxo"));
        }
      },
    });
  };

  const [mensagemfacil, setMensagemfacil] = useState("");

  return (
    <>
      <style>{quillFontPickerStyles}</style>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleModalDrop}
          className="roteiro-fonte roteiro-fluxo-builder-modal flex h-[95vh] max-w-[98vw] flex-col overflow-hidden border-slate-200 bg-slate-50 p-0 text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 [&>button:last-child]:right-4 [&>button:last-child]:top-4 [&>button:last-child]:rounded-full [&>button:last-child]:border [&>button:last-child]:border-slate-200 [&>button:last-child]:bg-white/>button:last-child]:hover:text-white"
        >
          <DialogHeader className="border-b border-slate-200 bg-gradient-to-r from-white via-slate-50 to-amber-50 px-6 py-4 text-slate-900 dark:border-slate-800 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:text-slate-100">
            <DialogTitle className="flex flex-wrap items-center justify-between gap-4 pr-14">
              <div className="space-y-1">
                <span className="flex items-center gap-2 text-xl font-semibold">
                  <Workflow className="h-5 w-5 text-primary" />
                  Builder de Fluxo
                </span>
                <p className="text-sm font-normal text-slate-500 dark:text-slate-400">
                  Organize mensagens, vínculos e opções do roteiro em uma malha
                  visual mais clara.
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <MoreHorizontal className="h-4 w-4" />
                    Menu
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="z-[80] w-56">
                  <DropdownMenuItem
                    disabled={!fluxoId}
                    onSelect={() => setShowFlowMetaEditor((prev) => !prev)}
                  >
                    <SlidersHorizontal className="mr-2 h-4 w-4" />
                    Dados do fluxo
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={saving}
                    onSelect={() => setShowCreateFlowPrompt(true)}
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Novo fluxo
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={importando}
                    onSelect={() => jsonInputRef.current?.click()}
                  >
                    <FileJson className="mr-2 h-4 w-4" />
                    Importar JSON
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={!mensagens.length}
                    onSelect={copyCurrentFlow}
                  >
                    <Clipboard className="mr-2 h-4 w-4" />
                    Copiar fluxo
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!fluxoId || saving}
                    onSelect={() => void pasteCopiedMessages()}
                  >
                    <ClipboardPaste className="mr-2 h-4 w-4" />
                    Colar no fluxo atual
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={saving || !mensagens.length}
                    onSelect={() => void saveAllMessages()}
                  >
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Salvar fluxo atual
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={!fluxoId || Boolean(rotuloFixo)}
                    onSelect={handleDeleteFlow}
                    className="text-red-600 focus:text-red-700 dark:text-red-400 dark:focus:text-red-300"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {rotuloFixo ? "Fluxo fixo (não excluível)" : "Excluir fluxo"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </DialogTitle>
          </DialogHeader>

          <section className="hidden">

            <div className="grid gap-2 lg:grid-cols-3">
              <label className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <span className="w-28 shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Tipo de ligação
                </span>
                <Input
                  value={tipoLigacaoSelecionado}
                  onChange={(event) =>
                    setTipoLigacaoSelecionado(event.target.value)
                  }
                  disabled={!fluxoId}
                  placeholder="Ex.: Ativa"
                  className="h-8 min-w-0 border-0 bg-transparent px-0 text-sm text-slate-900 shadow-none disabled:opacity-60 focus-visible:ring-0 dark:text-slate-100"
                />
              </label>

              <label className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <span className="w-20 shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Produto
                </span>
                <Input
                  value={produtoSelecionado}
                  onChange={(event) => setProdutoSelecionado(event.target.value)}
                  disabled={!fluxoId}
                  placeholder="Ex.: Empréstimo"
                  className="h-8 min-w-0 border-0 bg-transparent px-0 text-sm text-slate-900 shadow-none disabled:opacity-60 focus-visible:ring-0 dark:text-slate-100"
                />
              </label>

              <label className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <span className="w-28 shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Tipo de cliente
                </span>
                <Input
                  value={tipoClienteSelecionado}
                  onChange={(event) =>
                    setTipoClienteSelecionado(event.target.value)
                  }
                  disabled={!fluxoId}
                  placeholder="Ex.: Física"
                  className="h-8 min-w-0 border-0 bg-transparent px-0 text-sm text-slate-900 shadow-none disabled:opacity-60 focus-visible:ring-0 dark:text-slate-100"
                />
              </label>
            </div>
          </section>

          {showFlowMetaEditor && (
            <div className="absolute right-6 top-24 z-40 w-[min(760px,calc(100%-3rem))] rounded-xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
              <div className="grid gap-2 md:grid-cols-3">
                <label className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    Tipo de ligacao
                  </span>
                  <Input
                    value={tipoLigacaoSelecionado}
                    onChange={(event) =>
                      setTipoLigacaoSelecionado(event.target.value)
                    }
                    disabled={!fluxoId}
                    placeholder="Ex.: Ativa"
                    className="h-9 border-slate-200 bg-slate-50 text-sm dark:border-slate-700 dark:bg-slate-900"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    Produto
                  </span>
                  <Input
                    value={produtoSelecionado}
                    onChange={(event) =>
                      setProdutoSelecionado(event.target.value)
                    }
                    disabled={!fluxoId}
                    placeholder="Ex.: Emprestimo"
                    className="h-9 border-slate-200 bg-slate-50 text-sm dark:border-slate-700 dark:bg-slate-900"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    Tipo de cliente
                  </span>
                  <Input
                    value={tipoClienteSelecionado}
                    onChange={(event) =>
                      setTipoClienteSelecionado(event.target.value)
                    }
                    disabled={!fluxoId}
                    placeholder="Ex.: Fisica"
                    className="h-9 border-slate-200 bg-slate-50 text-sm dark:border-slate-700 dark:bg-slate-900"
                  />
                </label>
              </div>

              <div className="mt-3 flex justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowFlowMetaEditor(false)}
                >
                  Fechar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={saveFlowMeta}
                  disabled={saving || !fluxoId}
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Salvar dados
                </Button>
              </div>
            </div>
          )}

          <div
            className="grid min-h-0 flex-1"
            style={{
              gridTemplateColumns: `${leftPanelWidth}px 8px minmax(0,1fr) ${
                showInspectorPanel ? `8px ${rightPanelWidth}px` : "48px"
              }`,
            }}
          >
            <aside className="roteiro-hide-scrollbar min-h-0 overflow-y-auto border-r border-slate-200 bg-white px-4 py-5 text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
              <div className="space-y-3 pb-6">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                  Buscar fluxo
                </p>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                      Fluxo disponivel
                    </label>
                    <Button
                      type="button"
                      variant={mostrarFiltrosBusca ? "default" : "outline"}
                      size="sm"
                      onClick={() => setMostrarFiltrosBusca((prev) => !prev)}
                      className="h-8 gap-2 px-2.5"
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                      Filtros
                    </Button>
                  </div>

                  <Select
                    value={fluxoBuscaId}
                    onValueChange={selecionarFluxoBusca}
                  >
                    <SelectTrigger className="border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                      <SelectValue
                        placeholder={
                          loadingFluxos
                            ? "Carregando fluxos..."
                            : "Selecione um fluxo"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {fluxosDisponiveis.map((fluxo) => (
                        <SelectItem key={fluxo.id_fluxo} value={fluxo.id_fluxo}>
                          {/* `min-w-0` + `truncate`: o gatilho do Select recorta
                              o filho direto com `line-clamp-1`, e um flex sem
                              `min-w-0` ignora esse recorte -- o nome do fluxo
                              vazava para fora da caixa. */}
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate">
                              {getFluxoResumoLabel(fluxo)}
                            </span>
                            {fluxo.fixo && (
                              <span
                                className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-800 dark:bg-amber-500/20 dark:text-amber-200"
                                title="Alimenta uma aba do roteiro do operador. Pode receber mensagens, mas não pode ser excluído nem renomeado."
                              >
                                aba fixa
                              </span>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                </div>

                {mostrarFiltrosBusca && (
                  <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
                    <SelectFilterField
                  label="Tipo de ligação"
                  placeholder="Busque ou digite o tipo de ligação"
                  value={tipoLigacaoBusca}
                  options={tiposLigacaoBuscaVisiveis}
                  onChange={setTipoLigacaoBusca}
                  helperText={`${tiposLigacaoBuscaVisiveis.length} opções`}
                />

                <SelectFilterField
                  label="Produto"
                  placeholder="Busque ou digite o produto"
                  value={produtoBusca}
                  options={produtosBuscaVisiveis}
                  onChange={setProdutoBusca}
                  helperText={`${produtosBuscaVisiveis.length} opções`}
                />

                <SelectFilterField
                  label="Tipo de cliente"
                  placeholder="Busque ou digite o tipo de cliente"
                  value={tipoClienteBusca}
                  options={tiposClienteBuscaVisiveis}
                  onChange={setTipoClienteBusca}
                  helperText={`${tiposClienteBuscaVisiveis.length} opções`}
                />
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={limparFiltrosBusca}
                        disabled={loadingFluxos}
                      >
                        Limpar
                      </Button>
                      <Button
                        type="button"
                        onClick={aplicarFiltrosBusca}
                        disabled={loadingFluxos}
                      >
                        {loadingFluxos ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="mr-2 h-4 w-4" />
                        )}
                        Filtrar
                      </Button>
                    </div>
                  </div>
                )}

                {loading && (
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando fluxo...
                  </div>
                )}
              </div>

              <div className="mt-8 space-y-3">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                  Blocos
                </p>

                {[
                  {
                    type: "message",
                    title: "Mensagem",
                    text: "Arraste para a malha e crie um nova mensagem solta no fluxo.",
                  },
                  {
                    type: "option",
                    title: "Opção",
                    text: "Arraste para anexar uma nova opção a mensagem selecionada.",
                  },
                ].map((item) => (
                  <div
                    key={item.type}
                    draggable
                    onDragStart={(event) =>
                      event.dataTransfer.setData(
                        "application/roteiro-builder",
                        item.type,
                      )
                    }
                    className="cursor-grab rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm active:cursor-grabbing dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-slate-500" />
                      <span className="font-medium">{item.title}</span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {item.text}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-8 space-y-3">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                  Importar roteiro
                </p>

                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => jsonInputRef.current?.click()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      jsonInputRef.current?.click();
                    }
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDraggingJson(true);
                  }}
                  onDragLeave={() => setIsDraggingJson(false)}
                  className={`cursor-pointer rounded-xl border-2 border-dashed p-4 text-center transition ${
                    isDraggingJson
                      ? "border-orange-400 bg-orange-50 dark:border-orange-500/70 dark:bg-orange-500/10"
                      : "border-slate-300 bg-slate-50 hover:border-orange-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-orange-500/60"
                  }`}
                >
                  <div className="pointer-events-none">
                    <FileJson className="mx-auto h-6 w-6 text-orange-400" />
                    <p className="mt-2 text-sm font-medium">
                      Arraste o JSON do roteiro
                    </p>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                      Cada chave vira uma mensagem e cada botão vira uma saída
                      conectada.
                    </p>
                  </div>
                </div>

                <input
                  ref={jsonInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(event) => {
                    void handleJsonFiles(event.target.files);
                    event.target.value = "";
                  }}
                />
              </div>

              <div className="mt-8">
                <p className="mb-3 text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                  Lista de Mensagens
                </p>
                <div className="space-y-2 pb-6">

                </div>
                <div className="space-y-2 pb-6">
                  {mensagens.map((mensagem) => (
                    <button
                      key={mensagem.id_mensagem}
                      onClick={() => setSelectedId(mensagem.id_mensagem)}
                      className={`w-full rounded-xl border p-3 text-left text-sm transition ${
                        selectedId === mensagem.id_mensagem
                          ? "border-amber-400 bg-amber-50 shadow-sm dark:bg-amber-500/15"
                          : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
                      }`}
                    >
                      <div
                        className="font-medium line-clamp-2"
                        dangerouslySetInnerHTML={{
                          __html:
                            renderRichText(mensagem.titulo) ||
                            getMensagemDisplayName(mensagem),
                        }}
                      />
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {mensagem.opcoes.length} caminhos
                      </div>
                      <div className="mt-1 truncate text-[11px] text-slate-500">
                        {getMensagemDisplayName(mensagem)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </aside>

            <div
              role="separator"
              aria-orientation="vertical"
              onMouseDown={() => setIsResizingLeftPanel(true)}
              className="cursor-col-resize bg-slate-200 transition hover:bg-orange-300/80 dark:bg-slate-900/80 dark:hover:bg-orange-400/60"
            />

            {/* Container posicionado: o controle de zoom precisa ficar parado
               sobre a malha, e dentro do próprio canvas ele rolaria junto. */}
            <div className="relative flex min-h-0 flex-col overflow-hidden">
              <div
                ref={registrarCanvas}
                onMouseDown={handleCanvasBetaStart}
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleCanvasDrop}
              className={`roteiro-hide-scrollbar relative min-h-0 w-full flex-1 overflow-x-auto overflow-y-auto bg-slate-100 bg-[radial-gradient(circle_at_1px_1px,_rgba(148,163,184,0.35)_1px,_transparent_0)] bg-[size:24px_24px] dark:bg-slate-950 dark:bg-[radial-gradient(circle_at_1px_1px,_rgba(71,85,105,0.28)_1px,_transparent_0)] ${
                  isPanning ? "cursor-grabbing select-none" : "cursor-grab"
                }`}
            >
              {loading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                /* Dois níveis de propósito: o de fora carrega o tamanho já
                   multiplicado pelo zoom, para as barras de rolagem baterem
                   com o que se vê; o de dentro mantém o tamanho original e
                   apenas escala. `transform` não altera o espaço ocupado, por
                   isso um só elemento daria área de rolagem errada.
                   O `onMouseDown` fica no de dentro: é lá que
                   `event.target === event.currentTarget` ainda significa
                   "clicou na malha vazia", e não sobre um card. */
                <div
                  className="relative min-h-full min-w-full"
                  style={{
                    width: canvasSize.width * zoom,
                    height: canvasSize.height * zoom,
                  }}
                >
                <div
                  className="relative"
                  style={{
                    width: canvasSize.width,
                    height: canvasSize.height,
                    transform: `scale(${zoom})`,
                    transformOrigin: "0 0",
                  }}
                >
                  <svg className="pointer-events-none absolute inset-0 h-full w-full">
                    {edges.map((edge) => {
                      if (!edge) {
                        return null;
                      }

                      const midX = (edge.x1 + edge.x2) / 2;
                      const path = `M ${edge.x1} ${edge.y1} C ${midX} ${edge.y1}, ${midX} ${edge.y2}, ${edge.x2} ${edge.y2}`;

                      return (
                        <g key={edge.key}>
                          <path
                            d={path}
                            fill="none"
                            stroke="#6366f1"
                            strokeWidth="3"
                          />
                          <text
                            x={midX}
                            y={(edge.y1 + edge.y2) / 2 - 8}
                            textAnchor="middle"
                            className="fill-slate-600 text-[11px] dark:fill-slate-300"
                          >
                            {edge.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>

                  {mensagens.map((mensagem) => {
                    const position = positions[mensagem.id_mensagem] || {
                      x: 50,
                      y: 50,
                    };
                    const isSelected = selectedId === mensagem.id_mensagem;

                    return (
                      <Card
                        key={mensagem.id_mensagem}
                        data-card-fluxo
                        onClick={() => setSelectedId(mensagem.id_mensagem)}
                        className={`absolute w-[300px] cursor-pointer border-2 shadow-2xl dark:shadow-black/30 ${
                          isSelected
                            ? "border-orange-400 bg-white dark:bg-slate-900"
                            : "border-slate-300 bg-white/95 dark:border-slate-700 dark:bg-slate-900/95"
                        }`}
                        style={{ left: position.x, top: position.y }}
                      >
                        <div
                          onMouseDown={(event) =>
                            handleMouseDown(event, mensagem.id_mensagem)
                          }
                          className="flex cursor-move items-center justify-between rounded-t-xl border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800"
                        >
                          <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                            <GitBranch className="h-4 w-4 text-orange-400" />
                            <div
                              className="line-clamp-2 min-w-0"
                              dangerouslySetInnerHTML={{
                                __html:
                                  renderRichText(mensagem.titulo) ||
                                  getMensagemDisplayName(mensagem),
                              }}
                            />
                          </div>
                        </div>

                        <div className="space-y-3 p-4">
                          <div
                            className="line-clamp-3 text-sm text-slate-600 dark:text-slate-300"
                            dangerouslySetInnerHTML={{
                              __html:
                                renderRichText(mensagem.mensagem) ||
                                "Sem conteudo preenchido.",
                            }}
                          />

                          <div className="roteiro-hide-scrollbar max-h-44 space-y-2 overflow-y-auto pr-1">
                            {mensagem.opcoes.map((opcao) => (
                              <div
                                key={opcao.id_opcao}
                                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="truncate font-medium text-slate-900 dark:text-slate-100">
                                    {opcao.texto_opcao || "Opção sem texto"}
                                  </span>
                                  <span className="text-xs text-slate-500">
                                    <Link2 className="inline h-3.5 w-3.5" />
                                  </span>
                                </div>
                                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                  {opcao.proxima_mensagem_id ===
                                  AUTO_CREATE_VALUE
                                    ? "Cria próxima mensagem ao salvar"
                                    : opcao.proxima_mensagem_id
                                      ? "Ligado a outra mensagem"
                                      : "Final do caminho"}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
                </div>
              )}
              </div>

              {/* A roda do mouse é descoberta por acidente; o controle conta
                  que a malha tem zoom e dá um caminho sem mouse. */}
              <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1 rounded-full border border-slate-200 bg-white/90 p-1 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Afastar"
                  onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z / 1.2))}
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <button
                  type="button"
                  onClick={() => setZoom(1)}
                  title="Voltar a 100%"
                  className="min-w-[3rem] rounded-full px-1 text-center text-xs font-medium tabular-nums text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Aproximar"
                  onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z * 1.2))}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {showInspectorPanel ? (
              <div
                role="separator"
                aria-orientation="vertical"
                onMouseDown={() => setIsResizingRightPanel(true)}
                className="cursor-col-resize bg-slate-200 transition hover:bg-orange-300/80 dark:bg-slate-900/80 dark:hover:bg-orange-400/60"
              />
            ) : (
              <div className="flex min-h-0 items-start justify-center border-l border-slate-200 bg-white px-2 py-4 dark:border-slate-800 dark:bg-slate-950">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="Abrir inspector"
                  onClick={() => setIsInspectorManuallyOpen(true)}
                  className="h-9 w-9"
                >
                  <PanelRightOpen className="h-4 w-4" />
                </Button>
              </div>
            )}

            <aside
              className={`roteiro-hide-scrollbar min-h-0 overflow-auto border-l border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 ${
                showInspectorPanel ? "" : "hidden"
              }`}
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                    Inspector
                  </p>
                  <h3
                    className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100"
                    dangerouslySetInnerHTML={{
                      __html: selectedMessage
                        ? renderRichText(selectedMessage.titulo) ||
                          getMensagemDisplayName(selectedMessage)
                        : "Nenhuma Mensagem selecionado",
                    }}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title="Recolher inspector"
                  onClick={() => {
                    setSelectedId(null);
                    setIsInspectorManuallyOpen(false);
                  }}
                  className="h-8 w-8 shrink-0"
                >
                  <PanelRightOpen className="h-4 w-4 rotate-180" />
                </Button>
              </div>

              {selectedMessage ? (
                <div className="space-y-5 px-5 py-5">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Título</label>
                    <ReactQuill
                      key={`${selectedMessage.id_mensagem}-title`}
                      theme="snow"
                      value={normalizeEditorHtml(selectedMessage.titulo)}
                      onChange={(value) =>
                        updateMensagem(
                          selectedMessage.id_mensagem,
                          (mensagem) => ({
                            ...mensagem,
                            titulo: normalizeEditorHtml(value),
                          }),
                        )
                      }
                      modules={quillModules}
                      formats={quillFormats}
                      placeholder="Edite o título..."
                      className="roteiro-editor-titulo w-full bg-background text-foreground rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Mensagem</label>
                    <ReactQuill
                      key={selectedMessage.id_mensagem}
                      theme="snow"
                      value={normalizeEditorHtml(selectedMessage.mensagem)}
                      onChange={(value) =>
                        updateMensagem(
                          selectedMessage.id_mensagem,
                          (mensagem) => ({
                            ...mensagem,
                            mensagem: normalizeEditorHtml(value),
                          }),
                        )
                      }
                      modules={quillModules}
                      formats={quillFormats}
                      placeholder="Edite o conteúdo..."
                      className="w-full bg-background text-foreground rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-center">
                      <div className="flex w-full flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={copySelectedMessage}
                          className="min-w-[7rem] flex-1 justify-center whitespace-nowrap px-3"
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Copiar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateMensagem(
                              selectedMessage.id_mensagem,
                              (mensagem) => ({
                                ...mensagem,
                                opcoes: [...mensagem.opcoes, makeDraftOption()],
                              }),
                            )
                          }
                          className="min-w-[8rem] flex-1 justify-center whitespace-nowrap px-3"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Nova saída
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleDeleteMessage}
                          className="min-w-[7rem] flex-1 justify-center whitespace-nowrap px-3"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </Button>
                      </div>
                    </div>

                    {selectedMessage.opcoes.map((opcao, index) => (
                      <div
                        key={opcao.id_opcao}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60"
                      >
                        <div className="mb-3 flex items-center justify-between gap-2 text-sm font-medium">
                          <span>Caminho {index + 1}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteOption(opcao.id_opcao)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </Button>
                        </div>

                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                              Nome da saída
                            </label>
                            <Input
                              value={opcao.texto_opcao}
                              onChange={(event) =>
                                updateMensagem(
                                  selectedMessage.id_mensagem,
                                  (mensagem) => ({
                                    ...mensagem,
                                    opcoes: mensagem.opcoes.map((item) =>
                                      item.id_opcao === opcao.id_opcao
                                        ? {
                                            ...item,
                                            texto_opcao: event.target.value,
                                          }
                                        : item,
                                    ),
                                  }),
                                )
                              }
                              placeholder="Ex.: Cliente quer renegociar"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                              Próxima mensagem
                            </label>
                            <Select
                              value={opcao.proxima_mensagem_id ?? "none"}
                              onValueChange={(value) =>
                                updateMensagem(
                                  selectedMessage.id_mensagem,
                                  (mensagem) => ({
                                    ...mensagem,
                                    opcoes: mensagem.opcoes.map((item) =>
                                      item.id_opcao === opcao.id_opcao
                                        ? {
                                            ...item,
                                            proxima_mensagem_id:
                                              value === "none" ? null : value,
                                          }
                                        : item,
                                    ),
                                  }),
                                )
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Conectar com..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">
                                  Finalizar nessa mensagem
                                </SelectItem>
                                <SelectItem value={AUTO_CREATE_VALUE}>
                                  Criar nova mensagem ao salvar
                                </SelectItem>
                                {mensagens
                                  .filter(
                                    (mensagem) =>
                                      mensagem.id_mensagem !==
                                      selectedMessage.id_mensagem,
                                  )
                                  .map((mensagem) => (
                                    <SelectItem
                                      key={mensagem.id_mensagem}
                                      value={mensagem.id_mensagem}
                                    >
                                      {getMensagemDisplayName(mensagem)}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="px-5 py-8 text-sm text-slate-500 dark:text-slate-400">
                  Selecione uma mensagem na malha para editar mensagens, saídas
                  e conexões.
                </div>
              )}
            </aside>
          </div>

          {importPlan && (
            <div className="absolute inset-0 z-[55] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
              <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950">
                <div className="flex items-start gap-3 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300">
                    <FileJson className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      Importar fluxo do JSON
                    </h3>
                    <p className="mt-1 truncate text-sm text-slate-600 dark:text-slate-400">
                      {importFileName || "Arquivo sem nome"}
                    </p>
                  </div>
                </div>

                <div className="roteiro-hide-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
                  {importParsed && importParsed.marcas.length > 1 && (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        Marca do arquivo
                      </label>
                      <Select
                        value={importMarcaNome}
                        onValueChange={setImportMarcaNome}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {importParsed.marcas.map((marca) => (
                            <SelectItem key={marca.nome} value={marca.nome}>
                              {marca.nome} ({marca.nodes.length} mensagens)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="grid gap-2 sm:grid-cols-4">
                    {[
                      { label: "Mensagens", value: importPlan.nodes.length },
                      { label: "Saídas", value: importPlan.totalOpcoes },
                      { label: "Conectadas", value: importPlan.totalLigacoes },
                      {
                        label: "Refs. ausentes",
                        value: importPlan.referenciasAusentes.length,
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900"
                      >
                        <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                          {item.value}
                        </p>
                        <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                          {item.label}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Destino
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button
                        type="button"
                        variant={importDestino === "novo" ? "default" : "outline"}
                        onClick={() => setImportDestino("novo")}
                      >
                        Criar um fluxo novo
                      </Button>
                      <Button
                        type="button"
                        variant={importDestino === "atual" ? "default" : "outline"}
                        disabled={!fluxoId}
                        onClick={() => setImportDestino("atual")}
                      >
                        Adicionar ao fluxo atual
                      </Button>
                    </div>
                  </div>

                  {importDestino === "novo" ? (
                    <div className="grid gap-4 md:grid-cols-3">
                      <EditableFilterField
                        label="Produto"
                        placeholder="Ex.: Habitacional"
                        value={importProduto}
                        options={ensureOptionExists(
                          normalizeSelectOptions(produtos),
                          importProduto,
                        )}
                        onChange={setImportProduto}
                      />
                      <EditableFilterField
                        label="Tipo de cliente"
                        placeholder="Ex.: Física"
                        value={importTipoCliente}
                        options={ensureOptionExists(
                          normalizeSelectOptions(tiposCliente),
                          importTipoCliente,
                        )}
                        onChange={setImportTipoCliente}
                      />
                      <EditableFilterField
                        label="Tipo de ligação"
                        placeholder="Ex.: Ativa"
                        value={importTipoLigacao}
                        options={ensureOptionExists(
                          normalizeSelectOptions(tiposLigacao),
                          importTipoLigacao,
                        )}
                        onChange={setImportTipoLigacao}
                      />
                    </div>
                  ) : (
                    <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                      As mensagens serão anexadas ao fluxo{" "}
                      <strong>
                        {[produtoSelecionado, tipoClienteSelecionado, tipoLigacaoSelecionado]
                          .filter(Boolean)
                          .join(" - ") || fluxoId}
                      </strong>{" "}
                      e posicionadas abaixo das atuais. As mensagens já
                      existentes não são alteradas.
                    </p>
                  )}

                  <div className="space-y-2">
                    {[
                      {
                        id: "tabulacao",
                        titulo: "Incluir as tabulações no corpo da mensagem",
                        descricao:
                          "Não existe coluna de tabulação em TB_MENSAGEM: a lista entra como um parágrafo no fim do texto.",
                        checked: importIncluirTabulacao,
                        onChange: setImportIncluirTabulacao,
                      },
                      {
                        id: "ausentes",
                        titulo: "Destinos sem mensagem voltam para o início",
                        descricao: importPlan.referenciasAusentes.length
                          ? `${importPlan.referenciasAusentes.length} referência(s) sem mensagem no arquivo — como o "FINALIZAR" do fim da ligação — passam a apontar para "${importPlan.nodes[0]?.titulo || "a primeira mensagem"}". Sem isso, viram "final do caminho": ${importPlan.referenciasAusentes.join(", ")}.`
                          : "Todos os destinos citados no arquivo existem.",
                        checked: importVoltarAoInicio,
                        onChange: setImportVoltarAoInicio,
                      },
                    ].map((opcao) => (
                      <div
                        key={opcao.id}
                        className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {opcao.titulo}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {opcao.descricao}
                          </p>
                        </div>
                        <Switch
                          checked={opcao.checked}
                          onCheckedChange={opcao.onChange}
                          disabled={importando}
                        />
                      </div>
                    ))}
                  </div>

                  {[...(importParsed?.warnings || []), ...importPlan.warnings].length >
                    0 && (
                    <div className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/40 dark:bg-amber-500/10">
                      <p className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-200">
                        <AlertTriangle className="h-4 w-4" />
                        Avisos da leitura
                      </p>
                      <ul className="list-disc space-y-1 pl-5 text-xs text-amber-800 dark:text-amber-200">
                        {[
                          ...(importParsed?.warnings || []),
                          ...importPlan.warnings,
                        ].map((aviso) => (
                          <li key={aviso}>{aviso}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="rounded-xl border border-slate-200 dark:border-slate-800">
                    <p className="border-b border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:border-slate-800 dark:text-slate-400">
                      Prévia das mensagens
                    </p>
                    <div className="roteiro-hide-scrollbar max-h-52 divide-y divide-slate-200 overflow-y-auto dark:divide-slate-800">
                      {importPlan.nodes.map((node) => (
                        <div
                          key={node.key}
                          className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                              {node.titulo}
                            </p>
                            <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                              {node.key}
                            </p>
                          </div>
                          <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                            {node.opcoes.length} saídas
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {importando
                      ? `Importando ${importProgresso.feitas} de ${importProgresso.total} etapas...`
                      : "As saídas são reconectadas aos ids reais depois que as mensagens são criadas."}
                  </p>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={fecharImportacao}
                      disabled={importando}
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={() => void importarFluxoDoJson()}
                      disabled={importando}
                    >
                      {importando ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <FileJson className="mr-2 h-4 w-4" />
                      )}
                      Importar fluxo
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showCreateFlowPrompt && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-950">
                <div className="mb-5">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Criar novo fluxo
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Preencha os três identificadores do fluxo. Todos são
                    obrigatórios.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      Tipo de cliente
                    </label>
                    <Input
                      value={novoTipoCliente}
                      onChange={(event) =>
                        setNovoTipoCliente(event.target.value)
                      }
                      placeholder="Ex.: Física"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      Produto
                    </label>
                    <Input
                      value={novoProduto}
                      onChange={(event) => setNovoProduto(event.target.value)}
                      placeholder="Ex.: Empréstimo"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      Tipo de ligação
                    </label>
                    <Input
                      value={novoTipoLigacao}
                      onChange={(event) =>
                        setNovoTipoLigacao(event.target.value)
                      }
                      placeholder="Ex.: Ativa"
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateFlowPrompt(false)}
                    className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Cancelar
                  </Button>
                  <Button onClick={criarFluxo} disabled={saving}>
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Criar fluxo
                  </Button>
                </div>
              </div>
            </div>
          )}

          {confirmationPrompt && (
            <div className="absolute inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
              <div className="w-full max-w-md overflow-hidden rounded-2xl border border-red-200 bg-white shadow-2xl dark:border-red-900/60 dark:bg-slate-950">
                <div className="border-b border-red-100 bg-red-50 px-6 py-5 dark:border-red-900/50 dark:bg-red-950/30">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-100">
                        {confirmationPrompt.title}
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                        {confirmationPrompt.description}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-2 px-6 py-4 sm:flex-row sm:justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setConfirmationPrompt(null)}
                    disabled={saving}
                    className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={saving}
                    onClick={async () => {
                      const action = confirmationPrompt.onConfirm;
                      setConfirmationPrompt(null);
                      await action();
                    }}
                  >
                    {confirmationPrompt.confirmLabel}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RoteiroFluxoBuilderModal;
