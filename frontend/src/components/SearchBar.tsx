import React, { useState, useRef, useEffect, useCallback } from "react";
import { useAuroraInteraction } from "@/context/AuroraInteractionContext";
import tarefasApi from "@/services/tarefasApi";
import {
  carregarCarteirasIA,
  carteiraTemIA,
} from "@/services/iaCarteirasApi";
import {
  Search,
  X,
  Bot,
  BarChart,
  Calendar,
  FileSpreadsheet,
  Activity,
  AlertTriangle,
  ClipboardList,
  Handshake,
  Info,
  Settings,
  Lock,
  Target,
  BarChart3,
  GamepadIcon,
  Gamepad2,
  MessageSquare,
  Gift,
  StickyNote,
  ListTodo,
  CheckCheckIcon,
  Contact,
  FileSymlink,
  List,
  Headset,
  AudioLines,
  ArrowUp,
  GraduationCap,
  Compass,
  BookOpen,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

/**
 * Controle para abrir o painel de comandos de fora do componente.
 *
 * Existe para o tour guiado: o `searchTerm` é estado interno, então sem esta
 * porta a única alternativa seria forjar eventos nativos no input — o que
 * funciona no React por acidente e quebra em qualquer refactor.
 */
export interface ControleBusca {
  /**
   * Escreve o @ e abre o painel, como se o operador tivesse digitado.
   *
   * Também tranca o fechamento por clique fora enquanto o tour conduz: o
   * overlay do tour cobre a tela inteira, então sem a trava qualquer clique
   * perdido fecharia o painel e derrubaria o passo que pede o clique.
   */
  abrirPainel: () => void;
  /** Fecha e destranca. */
  fecharPainel: () => void;
}

interface SearchBarProps {
  onSearch: (term: string) => void;
  onIACommand?: () => void;
  onMatriculasCommand?: () => void;
  onResultsCommand?: () => void;
  onPendentesCommand?: () => void;
  onPlanilhasCommand?: () => void;
  onAcordosCommand?: () => void;
  onDeltaCommand?: () => void;
  onPasswordResetCommand?: () => void;
  onAcessosCommand?: () => void;
  onBaseConhecimentoCommand?: () => void;
  onIdealCommand?: () => void;
  onQuizQualidadeCommand?: () => void;
  onQuizAnaliseCommand?: () => void;
  onSimulacaoQualidadeCommand?: () => void;
  onFeedbacksCommand?: () => void;
  onFeedbackCreationCommand?: () => void;
  onCriarTabulacaoCommand?: () => void;
  onPortalCommand?: () => void;
  onPremiacaoCommand?: () => void;
  onInfoClienteCommand?: () => void;
  onAnotacaoCommand?: () => void;
  onAgendamentoCommand?: () => void;
  onToDoCommand?: () => void;
  onGestaoCommand?: () => void;
  onResultadosCommand?: () => void;
  onChatFullTimeCommand?: () => void;
  onAcademiaCommand?: () => void;
  onAcademiaQualidadeCommand?: () => void;
  onAnalyticsCommand?: () => void;
  onRoteiroCommand?: () => void;
  onRoteiroAdmCommand?: () => void;
  onConsultarContratoCommand?: () => void;
  onGerarLinkPDFCommand?: () => void;
  onCampanhaCommand?: () => void;
  onEnvioBoletoCommand?: () => void;
  onAcionamentoCommand?: () => void;
  onArenaCommand?: () => void;
  onTabulacoesCommand?: () => void;
  onPesquisaCommand?: () => void;
  onPesquisaNaoPagamentoCommand?: () => void;
  onScriptDeltaCommand?: () => void;
  onScriptGamaCommand?: () => void;
  onChecklistCommand?: () => void;
  onAuroraInsightCommand?: () => void;
  onAuditoriaCommand?: () => void;
  /** Reabre o tour guiado de boas-vindas. */
  onTourCommand?: () => void;
  placeholderText?: string;
  isSearching?: boolean;
  visualVariant?: "default" | "holographic";
  featuredCommands?: string[];
  /** Recebe o controle na montagem e `null` na desmontagem. */
  aoMontarControle?: (controle: ControleBusca | null) => void;
}

/**
 * Carteiras com o @IA liberado por decisao antiga, congelada em codigo.
 *
 * Fica aqui como piso: a lista dinamica (carteiras com treinamento
 * cadastrado) soma a esta, nunca subtrai.
 */
const CARTEIRAS_IA_FIXAS = [
  "BANCOALFA",
  "DELTA",
  "BETA",
  "ZETA",
  "MU",
  "ETA",
  "TETA",
  "SIRIUS",
  "BANCO GAMA",
  "GAMA DIGITAL",
];

const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  onIACommand,
  onMatriculasCommand,
  onResultsCommand,
  onPendentesCommand,
  onPlanilhasCommand,
  onAcordosCommand,
  onDeltaCommand,
  onPasswordResetCommand,
  onAcessosCommand,
  onBaseConhecimentoCommand,
  onIdealCommand,
  onQuizQualidadeCommand,
  onQuizAnaliseCommand,
  onSimulacaoQualidadeCommand,
  onFeedbacksCommand,
  onFeedbackCreationCommand,
  onCriarTabulacaoCommand,
  onPortalCommand,
  onPremiacaoCommand,
  onAnotacaoCommand,
  onAgendamentoCommand,
  onToDoCommand,
  onGestaoCommand,
  onResultadosCommand,
  onChatFullTimeCommand,
  onAcademiaCommand,
  onAcademiaQualidadeCommand,
  onAnalyticsCommand,
  onRoteiroCommand,
  onRoteiroAdmCommand,
  onConsultarContratoCommand,
  onGerarLinkPDFCommand,
  onCampanhaCommand,
  onEnvioBoletoCommand,
  onAcionamentoCommand,
  onArenaCommand,
  onTabulacoesCommand,
  onPesquisaCommand,
  onPesquisaNaoPagamentoCommand,
  onScriptDeltaCommand,
  onScriptGamaCommand,
  onChecklistCommand,
  onAuroraInsightCommand,
  onAuditoriaCommand,
  onTourCommand,
  placeholderText = "digite @ para ver os comandos disponíveis...",
  isSearching = false,
  visualVariant = "default",
  featuredCommands = [],
  aoMontarControle,
}) => {
  const auroraInteraction = useAuroraInteraction();
  const [searchTerm, setSearchTerm] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ref, nao state: e lida dentro de um listener nativo registrado uma vez.
  const painelTravado = useRef(false);

  const abrirPainel = useCallback(() => {
    painelTravado.current = true;
    setSearchTerm("@");
    setShowSuggestions(true);
    inputRef.current?.focus();
  }, []);

  const fecharPainel = useCallback(() => {
    painelTravado.current = false;
    setSearchTerm("");
    setShowSuggestions(false);
  }, []);

  useEffect(() => {
    if (!aoMontarControle) return;
    aoMontarControle({ abrirPainel, fecharPainel });
    return () => aoMontarControle(null);
  }, [aoMontarControle, abrirPainel, fecharPainel]);
  const popoverTriggerRef = useRef<HTMLDivElement>(null);
  const [iaEmManutencao, setIaEmManutencao] = useState(true);
  const [showIaModal, setShowIaModal] = useState(false);
  const [carteirasIaComTreinamento, setCarteirasIaComTreinamento] = useState<
    string[]
  >([]);

  // Carteiras que ganharam o @IA por terem treinamento cadastrado. A resposta
  // e memorizada no modulo, entao os varios SearchBar de uma pagina dividem uma
  // requisicao so. Falha em silencio: sem a lista, vale so a fixa.
  useEffect(() => {
    let ativo = true;
    void carregarCarteirasIA().then((carteiras) => {
      if (ativo) setCarteirasIaComTreinamento(carteiras);
    });
    return () => {
      ativo = false;
    };
  }, []);

  const isAdmin = localStorage.getItem("userIsAdmin") === "true";
  const isGerente = localStorage.getItem("userIsGerente") === "true";
  const NotIsAdmin = localStorage.getItem("userIsAdmin") === "false";

  const nomeCompleto = (localStorage.getItem("nomeCompleto") || "")
    .trim()
    .toUpperCase();

  // 🔹 Centraliza o centro de custo
  const centroCusto = (localStorage.getItem("centroCusto") || "")
    .trim()
    .toUpperCase();

  const funcao = (localStorage.getItem("funcao") || "").trim().toUpperCase();
  const podeAcessarMonitoria = isAdmin || funcao.includes("MONITOR");

  const supervisor = (localStorage.getItem("Supervisor") || "")
    .trim()
    .toUpperCase();

  // 🔹 Função utilitária (equivalente ao `if "x" in y` do Python)
  const centroCustoContem = (palavras: string[]) =>
    palavras.some((p) => centroCusto.includes(p));

  const funcaoADM = (palavras: string[]) =>
    palavras.some((p) => funcao.includes(p));

  const identifySuper = (palavras: string[]) =>
    palavras.some((p) => supervisor.includes(p));

  // =========================
  // REGRAS DE NEGÓCIO
  // =========================

  const isFuncaoADM = funcaoADM(["ADMINISTRATIVO"]);
  const isFuncaoNgc = funcaoADM(["NEGOCIADOR", "BACK OFFICE"]);
  const isBackoffice = funcaoADM(["BACK OFFICE"]);

  const isVega = centroCustoContem(["VEGA"]);
  const isDesenvolvimento = centroCustoContem(["DESENVOLVIMENTO"]);
  const podeConsultarContrato = isVega || isDesenvolvimento;
  const isVegaDigital = centroCustoContem(["VEGA DIGITAL"]);
  // const superName = identifySuper(["ANA PAULA SOUZA", "JULIA MARTINS COSTA"]);
  // O @RoteiroAdm era o unico comando de qualidade com um segundo portao por
  // centro de custo (`isQUALY`). Quem tinha a area mas estava em outro centro
  // -- coordenador de qualidade lotado na VEGA, por exemplo -- nao via o
  // comando nem conseguia executa-lo digitando inteiro. Agora quem decide e a
  // permissao, como nos outros sete comandos de qualidade.

  const carteiraChat = centroCustoContem([
    "BANCOALFA",
    "DIGITAL",
    "MU",
    "ETA",
    "GAMA",
    "ARC4",
    "DELTA",
    "ANTARES",
    "ZETA",
    "BETA",
    "VEGA",
    "TETA",
  ]);

  // A lista fixa continua valendo sozinha: ninguem perde o @IA por causa da
  // lista dinamica, inclusive as carteiras que hoje tem o comando e nenhum
  // treinamento cadastrado.
  const podeUsarIA =
    centroCustoContem(CARTEIRAS_IA_FIXAS)
    || carteiraTemIA(centroCusto, carteirasIaComTreinamento);

  const acionamento = centroCustoContem(["TETA"]);
  const PesquisaPgmt = centroCustoContem(["GAMA", "DELTA"]);

  const Pesquisa = centroCustoContem(["DELTA"]);
  const ScriptGAMA = centroCustoContem(["GAMA"]);
  const Checklist = centroCustoContem(["UPSILON"]);

  const EnvioBoletoBlock = centroCustoContem(["VEGA"]);

  const Campanha = ["PROJETO - ZETA"].includes(
    (localStorage.getItem("centroCusto") || "").trim().toUpperCase(),
  );

  const registrarUso = (command: string) => {
    if (!command.startsWith("@")) return;
    void tarefasApi.registrarUso(command).catch(() => undefined);
  };

  const handleSearch = () => {
    registrarUso(searchTerm.trim());
    if (searchTerm.trim() === "@IA" && onIACommand) {
      onIACommand();
      setSearchTerm("");
      return;
    }

    if (
      searchTerm.trim() === "@Matriculas" &&
      podeUsarIA &&
      onMatriculasCommand
    ) {
      onMatriculasCommand();
      setSearchTerm("");
      return;
    }

    if (searchTerm.trim() === "@Resultados" && !isVega && onResultsCommand) {
      onResultsCommand();
      setSearchTerm("");
      return;
    }

    // if (searchTerm.trim() === "@Auditoria" && onAuditoriaCommand) {
    //   onAuditoriaCommand();
    //   setSearchTerm("");
    //   return;
    // }

    if (searchTerm.trim() === "@Pendentes" && !isVega && onPendentesCommand) {
      onPendentesCommand();
      setSearchTerm("");
      return;
    }

    if (searchTerm.trim() === "@Planilhas" && !isVega && onPlanilhasCommand) {
      onPlanilhasCommand();
      setSearchTerm("");
      return;
    }

    if (searchTerm.trim() === "@Acordos" && !isVega && onAcordosCommand) {
      onAcordosCommand();
      setSearchTerm("");
      return;
    }

    if (searchTerm.trim() === "@Portal" && onPortalCommand) {
      onPortalCommand();
      setSearchTerm("");
      return;
    }

    if (searchTerm.trim() === "@Academia" && onAcademiaCommand) {
      onAcademiaCommand();
      setSearchTerm("");
      return;
    }

    if (
      searchTerm.trim() === "@AcademiaQualidade" &&
      onAcademiaQualidadeCommand
    ) {
      onAcademiaQualidadeCommand();
      setSearchTerm("");
      return;
    }

    if (searchTerm.trim() === "@Feedbacks" && onFeedbacksCommand) {
      onFeedbacksCommand();
      setSearchTerm("");
      return;
    }

    if (
      searchTerm.trim() === "@Monitoria" &&
      podeAcessarMonitoria &&
      onFeedbackCreationCommand
    ) {
      onFeedbackCreationCommand();
      setSearchTerm("");
      return;
    }

    if (
      searchTerm.trim() === "@CriarTabulacao" &&
      isAdmin &&
      onCriarTabulacaoCommand
    ) {
      onCriarTabulacaoCommand();
      setSearchTerm("");
      return;
    }

    if (searchTerm.trim() === "@QuizQualidade" && onQuizQualidadeCommand) {
      onQuizQualidadeCommand();
      setSearchTerm("");
      return;
    }

    if (
      searchTerm.trim() === "@QuizAnalise" &&
      isAdmin &&
      onQuizAnaliseCommand
    ) {
      onQuizAnaliseCommand();
      setSearchTerm("");
      return;
    }

    if (searchTerm.trim() === "@Senhas" && isAdmin && onPasswordResetCommand) {
      onPasswordResetCommand();
      setSearchTerm("");
      return;
    }

    // @Acessos nao testa `isAdmin`: quem decide e a area 'acessos.gerenciar',
    // e o handler so chega ate aqui se a pagina tiver passado a prop.
    if (searchTerm.trim() === "@Acessos" && onAcessosCommand) {
      onAcessosCommand();
      setSearchTerm("");
      return;
    }

    // Mesma regra do @Acessos: quem decide sao as areas checadas na pagina,
    // que so passa a prop para quem pode.
    if (
      searchTerm.trim() === "@Treinamentos" &&
      onBaseConhecimentoCommand
    ) {
      onBaseConhecimentoCommand();
      setSearchTerm("");
      return;
    }

    if (searchTerm.trim() === "@Ideal" && isAdmin && onIdealCommand) {
      onIdealCommand();
      setSearchTerm("");
      return;
    }

    if (
      (searchTerm.trim() === "@SimulacaoQualidade" ||
        searchTerm.trim() === "@SimulaçãoQualidade") &&
      isAdmin &&
      onSimulacaoQualidadeCommand
    ) {
      onSimulacaoQualidadeCommand();
      setSearchTerm("");
      return;
    }

    if (searchTerm.trim() === "@Premiação" && isAdmin && onPremiacaoCommand) {
      onPremiacaoCommand();
      setSearchTerm("");
      return;
    }

    if (searchTerm.trim() === "@Anotação" && onAnotacaoCommand) {
      onAnotacaoCommand();
      setSearchTerm("");
      return;
    }

    if (searchTerm.trim() === "@Agendamento" && onAgendamentoCommand) {
      onAgendamentoCommand();
      setSearchTerm("");
      return;
    }

    if (searchTerm.trim() === "@Tarefas" && onToDoCommand) {
      onToDoCommand();
      setSearchTerm("");

      return;
    }

    if (
      ["@Gestão", "@Gestao"].includes(searchTerm.trim()) &&
      onGestaoCommand
    ) {
      onGestaoCommand();
      setSearchTerm("");
      return;
    }

    if (
      ["@Resultados", "@Resultado"].includes(searchTerm.trim()) &&
      onResultadosCommand
    ) {
      onResultadosCommand();
      setSearchTerm("");
      return;
    }

    if (searchTerm.trim() === "@Chat" && onChatFullTimeCommand) {
      onChatFullTimeCommand();
      setSearchTerm("");
      return;
    }

    if (searchTerm.trim() === "@Analytics" && onAnalyticsCommand) {
      onAnalyticsCommand();
      setSearchTerm("");
      return;
    }

    if (searchTerm.trim() === "@Roteiro" && onRoteiroCommand && isVega) {
      onRoteiroCommand();
      setSearchTerm("");
      return;
    }
    if (searchTerm.trim() === "@RoteiroAdm" && onRoteiroAdmCommand) {
      onRoteiroAdmCommand();
      setSearchTerm("");
      return;
    }

    if (
      searchTerm.trim() === "@ConsultarContrato" &&
      podeConsultarContrato &&
      onConsultarContratoCommand
    ) {
      onConsultarContratoCommand();
      setSearchTerm("");
      return;
    }

    if (
      searchTerm.trim() === "@GerarLinkPDF" &&
      (isFuncaoNgc || isVegaDigital) &&
      onGerarLinkPDFCommand
    ) {
      onGerarLinkPDFCommand();
      setSearchTerm("");
      return;
    }

    if (searchTerm.trim() === "@Arena" && onArenaCommand) {
      onArenaCommand();
      setSearchTerm("");
      return;
    }

    if (searchTerm.trim() === "@Tour" && onTourCommand) {
      onTourCommand();
      setSearchTerm("");
      return;
    }

    if (searchTerm.trim() === "@Tabulacoes" && onTabulacoesCommand) {
      onTabulacoesCommand();
      setSearchTerm("");
      return;
    }

    if (searchTerm.trim() === "@Campanha" && Campanha && onCampanhaCommand) {
      onCampanhaCommand();
      setSearchTerm("");
      return;
    }
    if (
      searchTerm.trim() === "@Acionamento" &&
      acionamento &&
      onAcionamentoCommand
    ) {
      onAcionamentoCommand();
      setSearchTerm("");
      return;
    }

    if (
      searchTerm.trim() === "@EnvioBoleto" &&
      EnvioBoletoBlock &&
      onEnvioBoletoCommand
    ) {
      onEnvioBoletoCommand();
      setSearchTerm("");
      return;
    }

    if (
      searchTerm.trim() === "@PesquisaPortabilidade" &&
      Pesquisa &&
      onPesquisaCommand
    ) {
      onPesquisaCommand();
      setSearchTerm("");
      return;
    }

    if (
      searchTerm.trim() === "@PesquisaNaoPagamento" &&
      PesquisaPgmt &&
      onPesquisaNaoPagamentoCommand
    ) {
      onPesquisaNaoPagamentoCommand();
      setSearchTerm("");
      return;
    }

    if (
      searchTerm.trim() === "@Script" &&
      Pesquisa &&
      onScriptDeltaCommand
    ) {
      onScriptDeltaCommand();
      setSearchTerm("");
      return;
    }

    if (searchTerm.trim() === "@ScriptGAMA" && ScriptGAMA && onScriptGamaCommand) {
      onScriptGamaCommand();
      setSearchTerm("");
      return;
    }

    if (searchTerm.trim() === "@Checklist" && Checklist && onChecklistCommand) {
      onChecklistCommand();
      setSearchTerm("");
      return;
    }

    if (searchTerm.trim() === "@AuroraInsight" && onAuroraInsightCommand) {
      onAuroraInsightCommand();
      setSearchTerm("");
      return;
    }

    if (searchTerm.trim()) {
      onSearch(searchTerm);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch();
      setShowSuggestions(false);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);

    if (value.includes("@") && value.endsWith("@")) {
      setShowSuggestions(true);
    } else if (!value.includes("@")) {
      setShowSuggestions(false);
    }

    if (value.trim() === "@IA" && podeUsarIA && onIACommand) {
      onIACommand();
      setSearchTerm("");
      setShowSuggestions(false);
    } else if (value.trim() === "@Matriculas" && onMatriculasCommand) {
      onMatriculasCommand();
      setSearchTerm("");
      setShowSuggestions(false);
    } else if (value.trim() === "@Resultados" && !isVega && onResultsCommand) {
      onResultsCommand();
      setSearchTerm("");
      setShowSuggestions(false);
    // } else if (value.trim() === "@Auditoria" && onAuditoriaCommand) {
    //   onAuditoriaCommand();
    //   setSearchTerm("");
    //   setShowSuggestions(false);
    } else if (
      value.trim() === "@Pendentes" &&
      !isVega &&
      onPendentesCommand
    ) {
      onPendentesCommand();
      setSearchTerm("");
      setShowSuggestions(false);
    } else if (
      value.trim() === "@Planilhas" &&
      !isVega &&
      onPlanilhasCommand
    ) {
      onPlanilhasCommand();
      setSearchTerm("");
      setShowSuggestions(false);
    } else if (value.trim() === "@Acordos" && !isVega && onAcordosCommand) {
      onAcordosCommand();
      setSearchTerm("");
      setShowSuggestions(false);
    } else if (value.trim() === "@Portal" && onPortalCommand) {
      onPortalCommand();
      setSearchTerm("");
      setShowSuggestions(false);
    } else if (value.trim() === "@Academia" && onAcademiaCommand) {
      onAcademiaCommand();
      setSearchTerm("");
      setShowSuggestions(false);
    } else if (
      value.trim() === "@AcademiaQualidade" &&
      onAcademiaQualidadeCommand
    ) {
      onAcademiaQualidadeCommand();
      setSearchTerm("");
      setShowSuggestions(false);
    } else if (value.trim() === "@Feedbacks" && onFeedbacksCommand) {
      onFeedbacksCommand();
      setSearchTerm("");
      setShowSuggestions(false);
    } else if (
      value.trim() === "@Monitoria" &&
      podeAcessarMonitoria &&
      onFeedbackCreationCommand
    ) {
      onFeedbackCreationCommand();
      setSearchTerm("");
      setShowSuggestions(false);
    } else if (
      value.trim() === "@CriarTabulacao" &&
      isAdmin &&
      onCriarTabulacaoCommand
    ) {
      onCriarTabulacaoCommand();
      setSearchTerm("");
      setShowSuggestions(false);
    } else if (
      value.trim() === "@QuizQualidade" &&
      isAdmin &&
      onQuizQualidadeCommand
    ) {
      onQuizQualidadeCommand();
      setSearchTerm("");
      setShowSuggestions(false);
    } else if (
      value.trim() === "@QuizAnalise" &&
      isAdmin &&
      onQuizAnaliseCommand
    ) {
      onQuizAnaliseCommand();
      setSearchTerm("");
      setShowSuggestions(false);
    } else if (
      value.trim() === "@Senhas" &&
      isAdmin &&
      onPasswordResetCommand
    ) {
      onPasswordResetCommand();
      setSearchTerm("");
      setShowSuggestions(false);
    } else if (value.trim() === "@Acessos" && onAcessosCommand) {
      onAcessosCommand();
      setSearchTerm("");
      setShowSuggestions(false);
    } else if (
      value.trim() === "@Treinamentos" &&
      onBaseConhecimentoCommand
    ) {
      onBaseConhecimentoCommand();
      setSearchTerm("");
      setShowSuggestions(false);
    } else if (value.trim() === "@Ideal" && isAdmin && onIdealCommand) {
      onIdealCommand();
      setSearchTerm("");
      setShowSuggestions(false);
    } else if (
      value.trim() === "@SimulacaoQualidade" &&
      isAdmin &&
      onSimulacaoQualidadeCommand
    ) {
      onSimulacaoQualidadeCommand();
      setSearchTerm("");
      setShowSuggestions(false);
    } else if (value.trim() === "@Anotação" && onAnotacaoCommand) {
      onAnotacaoCommand();
      setSearchTerm("");
      setShowSuggestions(false);
    } else if (value.trim() === "@Agendamento" && onAgendamentoCommand) {
      onAgendamentoCommand();
      setSearchTerm("");
      setShowSuggestions(false);
    } else if (value.trim() === "@Tarefas" && onToDoCommand) {
      onToDoCommand();
      setSearchTerm("");
      setShowSuggestions(false);
    } else if (
      ["@Gestão", "@Gestao"].includes(value.trim()) &&
      onGestaoCommand
    ) {
      onGestaoCommand();
      setSearchTerm("");
      setShowSuggestions(false);
    } else if (
      ["@Resultados", "@Resultado"].includes(value.trim()) &&
      onResultadosCommand
    ) {
      onResultadosCommand();
      setSearchTerm("");
      setShowSuggestions(false);
    } else if (value.trim() === "@Chat" && onChatFullTimeCommand) {
      onChatFullTimeCommand();
      setSearchTerm("");
      setShowSuggestions(false);
    } else if (value.trim() === "@Analytics" && onAnalyticsCommand) {
      onAnalyticsCommand();
      setSearchTerm("");
      setShowSuggestions(false);
    } else if (value.trim() === "@Roteiro" && onRoteiroCommand && isVega) {
      onRoteiroCommand();
      setSearchTerm("");
      setShowSuggestions(false);
    } else if (value.trim() === "@RoteiroAdm" && onRoteiroAdmCommand) {
      onRoteiroAdmCommand();
      setSearchTerm("");
      setShowSuggestions(false);
    } else if (
      value.trim() === "@ConsultarContrato" &&
      podeConsultarContrato &&
      onConsultarContratoCommand
    ) {
      onConsultarContratoCommand();
      setSearchTerm("");
      setShowSuggestions(false);
    } else if (
      value.trim() === "@GerarLinkPDF" &&
      (isFuncaoNgc || isVegaDigital) &&
      onGerarLinkPDFCommand
    ) {
      onGerarLinkPDFCommand();
      setSearchTerm("");
      setShowSuggestions(false);
    } else if (value.trim() === "@Acionamento" && onAcionamentoCommand) {
      onAcionamentoCommand();
      setSearchTerm("");
      setShowSuggestions(false);
    } else if (value.trim() === "@Campanha" && onCampanhaCommand) {
      onCampanhaCommand();
      setSearchTerm("");
      setShowSuggestions(false);
    } else if (
      value.trim() === "@EnvioBoleto" &&
      EnvioBoletoBlock &&
      onEnvioBoletoCommand
    ) {
      onEnvioBoletoCommand();
      setSearchTerm("");
      setShowSuggestions(false);
    } else if (value.trim() === "@Arena" && onArenaCommand) {
      onArenaCommand();
      setSearchTerm("");
      setShowSuggestions(false);
    } else if (value.trim() === "@Tour" && onTourCommand) {
      onTourCommand();
      setSearchTerm("");
      setShowSuggestions(false);
    } else if (value.trim() === "@Tabulacoes" && onTabulacoesCommand) {
      onTabulacoesCommand();
      setSearchTerm("");
      setShowSuggestions(false);
    } else if (
      value.trim() === "@PesquisaPortabilidade" &&
      Pesquisa &&
      onPesquisaCommand
    ) {
      onPesquisaCommand();
      setSearchTerm("");
      setShowSuggestions(false);
    } else if (
      value.trim() === "@PesquisaNaoPagamento" &&
      PesquisaPgmt &&
      onPesquisaNaoPagamentoCommand
    ) {
      onPesquisaNaoPagamentoCommand();
      setSearchTerm("");
      setShowSuggestions(false);
    } else if (
      value.trim() === "@Script" &&
      Pesquisa &&
      onScriptDeltaCommand
    ) {
      onScriptDeltaCommand();
      setSearchTerm("");
      setShowSuggestions(false);
    } else if (
      value.trim() === "@ScriptGAMA" &&
      ScriptGAMA &&
      onScriptGamaCommand
    ) {
      onScriptGamaCommand();
      setSearchTerm("");
      setShowSuggestions(false);
    } else if (
      value.trim() === "@Checklist" &&
      Checklist &&
      onChecklistCommand
    ) {
      onChecklistCommand();
      setSearchTerm("");
      setShowSuggestions(false);
    } else if (value.trim() === "@AuroraInsight" && onAuroraInsightCommand) {
      onAuroraInsightCommand();
      setSearchTerm("");
      setShowSuggestions(false);
    }
  };

  const executeCommand = (command: string) => {
    registrarUso(command);
    if (command === "@IA" && podeUsarIA && onIACommand) {
      onIACommand();
    } else if (command === "@Matriculas" && onMatriculasCommand) {
      onMatriculasCommand();
    } else if (command === "@Resultados" && onResultsCommand && !isVega) {
      onResultsCommand();
    // } else if (command === "@Auditoria" && onAuditoriaCommand) {
    //   onAuditoriaCommand();
    } else if (command === "@Ideal" && isAdmin && onIdealCommand) {
      onIdealCommand();
    } else if (command === "@Pendentes" && onPendentesCommand) {
      onPendentesCommand();
    } else if (command === "@Planilhas" && onPlanilhasCommand) {
      onPlanilhasCommand();
    } else if (command === "@Acordos" && onAcordosCommand) {
      onAcordosCommand();
    } else if (command === "@Portal" && onPortalCommand) {
      onPortalCommand();
    } else if (command === "@Academia" && onAcademiaCommand) {
      onAcademiaCommand();
    } else if (
      command === "@AcademiaQualidade" &&
      onAcademiaQualidadeCommand
    ) {
      onAcademiaQualidadeCommand();
    } else if (command === "@Feedbacks" && onFeedbacksCommand) {
      onFeedbacksCommand();
    } else if (
      command === "@Monitoria" &&
      podeAcessarMonitoria &&
      onFeedbackCreationCommand
    ) {
      onFeedbackCreationCommand();
    } else if (
      command === "@CriarTabulacao" &&
      isAdmin &&
      onCriarTabulacaoCommand
    ) {
      onCriarTabulacaoCommand();
    } else if (
      command === "@QuizQualidade" &&
      isAdmin &&
      onQuizQualidadeCommand
    ) {
      onQuizQualidadeCommand();
    } else if (command === "@QuizAnalise" && isAdmin) {
      onQuizAnaliseCommand?.();
    } else if (command === "@Senhas" && isAdmin && onPasswordResetCommand) {
      onPasswordResetCommand();
    } else if (command === "@Acessos" && onAcessosCommand) {
      onAcessosCommand();
    } else if (
      command === "@Treinamentos" &&
      onBaseConhecimentoCommand
    ) {
      onBaseConhecimentoCommand();
    } else if (
      command === "@SimulacaoQualidade" &&
      isAdmin &&
      onSimulacaoQualidadeCommand
    ) {
      onSimulacaoQualidadeCommand();
    } else if (command === "@Premiação" && isAdmin && onPremiacaoCommand) {
      onPremiacaoCommand();
    } else if (command === "@Anotação" && onAnotacaoCommand) {
      onAnotacaoCommand();
    } else if (command === "@Agendamento" && onAgendamentoCommand) {
      onAgendamentoCommand();
    } else if (command === "@Tarefas" && onToDoCommand) {
      onToDoCommand();
    } else if (
      ["@Gestão", "@Gestao"].includes(command) &&
      onGestaoCommand
    ) {
      onGestaoCommand();
    } else if (
      ["@Resultados", "@Resultado"].includes(command) &&
      onResultadosCommand
    ) {
      onResultadosCommand();
    } else if (command === "@Chat" && onChatFullTimeCommand) {
      onChatFullTimeCommand();
    } else if (command === "@Analytics" && onAnalyticsCommand) {
      onAnalyticsCommand();
    } else if (command === "@Roteiro" && onRoteiroCommand && isVega) {
      onRoteiroCommand();
    } else if (command === "@RoteiroAdm" && onRoteiroAdmCommand) {
      onRoteiroAdmCommand();
    } else if (command === "@ConsultarContrato" && onConsultarContratoCommand) {
      onConsultarContratoCommand();
    } else if (command === "@GerarLinkPDF" && onGerarLinkPDFCommand) {
      onGerarLinkPDFCommand();
    } else if (command === "@Acionamento" && onAcionamentoCommand) {
      onAcionamentoCommand();
    } else if (command === "@Arena" && onArenaCommand) {
      onArenaCommand();
    } else if (command === "@Tour" && onTourCommand) {
      onTourCommand();
    } else if (command === "@Tabulacoes" && onTabulacoesCommand) {
      onTabulacoesCommand();
    } else if (command === "@Campanha" && onCampanhaCommand) {
      onCampanhaCommand();
    } else if (command === "@PesquisaPortabilidade" && onPesquisaCommand) {
      onPesquisaCommand();
    } else if (
      command === "@PesquisaNaoPagamento" &&
      onPesquisaNaoPagamentoCommand
    ) {
      onPesquisaNaoPagamentoCommand();
    } else if (command === "@Script" && onScriptDeltaCommand) {
      onScriptDeltaCommand();
    } else if (command === "@ScriptGAMA" && onScriptGamaCommand) {
      onScriptGamaCommand();
    } else if (command === "@Checklist" && onChecklistCommand) {
      onChecklistCommand();
    } else if (command === "@AuroraInsight" && onAuroraInsightCommand) {
      onAuroraInsightCommand();
    } else if (command === "@EnvioBoleto" && onEnvioBoletoCommand) {
      onEnvioBoletoCommand();
    } else {
      setSearchTerm(command);
    }

    setSearchTerm("");
    setShowSuggestions(false);
  };

  const selectCommand = (command: string) => {
    painelTravado.current = false;
    setSearchTerm("");
    setShowSuggestions(false);

    if (visualVariant === "holographic" && auroraInteraction) {
      auroraInteraction.announceCommand(command, () =>
        executeCommand(command),
      );
      return;
    }

    executeCommand(command);
  };

  const clearSearch = () => {
    setSearchTerm("");
    setShowSuggestions(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (painelTravado.current) return;
      if (
        popoverTriggerRef.current &&
        !popoverTriggerRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const [infoCommand, setInfoCommand] = useState<string | null>(null);
  const showInfo = (command: string) => {
    setInfoCommand(command);
  };

  const storedUserName = localStorage.getItem("nomeCompleto");

  return (
    <>
      {infoCommand && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/50 p-4">
          <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-6 animate-fade-in">
            <button
              onClick={() => {
                setInfoCommand(null);
                setSearchTerm("");
              }}
              className="absolute top-3 right-3 text-gray-400 hover:text-red-500 transition-colors text-xl"
              aria-label="Fechar"
            >
              ✕
            </button>

            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4 border-b border-gray-200 dark:border-zinc-700 pb-2">
              Olá, <span className="text-primary">{storedUserName}</span> 👋
            </h2>

            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              {infoCommand === "@Planilhas" &&
                "📄 Aqui você encontra os clientes prontos para contato! Use essas informações para negociar de forma mais prática e intuitiva."}

              {infoCommand === "@Acordos" &&
                "🤝 Veja todos os acordos que você fechou! Filtre por data, valor e tenha controle total do seu desempenho."}

              {infoCommand === "@Portal" &&
                "🌐 Envie mensagens personalizadas via WhatsApp com o link do portal de negociação! Perfeito para clientes que fecharam acordo ou ainda estão negociando."}

              {infoCommand === "@IA" &&
                "🤖 Em breve: conheça a Aurora, sua assistente virtual! Ela vai te ajudar com dúvidas e estratégias de negociação. Legal, né? Também estamos ansiosos por isso."}

              {infoCommand === "@Matriculas" && "📝 Ajuste de matrículas."}

              {infoCommand === "@Resultados" &&
                !isVega &&
                "📊 Acompanhe seus resultados do dia, semana e mês. Veja quanto já entrou em caixa e a projeção do que ainda vem por aí!"}

              {/* {infoCommand === "@Auditoria" &&
                "🎧 Envie uma ligação para receber uma análise estruturada, com pontos positivos, oportunidades e uma próxima ação prática."} */}

              {infoCommand === "@Pendentes" &&
                "⏰ Clientes com vencimento hoje! Filtrados por valor, prioridade e muito mais. Hora de focar nos alvos certos!"}

              {infoCommand === "@Anotação" &&
                "📝 Sistema pessoal de anotações! Organize suas informações em categorias como retorno para cliente, lembretes, estratégias e observações diversas. Crie cards tipo post-it para não esquecer de nada importante!"}

              {infoCommand === "@Agendamento" &&
                "📅 Sistema pessoal de anotações! Organize suas informações em categorias como retorno para cliente, lembretes, estratégias e observações diversas. Crie cards tipo post-it para não esquecer de nada importante!"}

              {infoCommand === "@Tarefas" &&
                "✅ Organize suas tarefas diárias de forma mais prática."}

              {infoCommand === "@Chat" &&
                "✅ Facilite sua comunicação entre a equipe."}

              {infoCommand === "@Academia" &&
                "🎓 Central de aprendizagem do Copilot! Reúne quizzes, simulações e treinamentos com a Aurora em uma única jornada."}

              {infoCommand === "@AcademiaQualidade" &&
                "🎓 Gestão da Academia Aurora. Crie cursos, módulos, aulas, públicos e publique conteúdos para os operadores."}

              {infoCommand === "@Feedbacks" &&
                "💬 Acompanhe todos os feedbacks enviados pelos monitores de qualidade! Veja pontos positivos, melhorias e sua taxa de qualidade."}

              {infoCommand === "@Monitoria" &&
                "✍️ Ferramenta para monitores criarem e enviarem feedbacks para os operadores."}

              {infoCommand === "@QuizQualidade" &&
                "⚙️ Ferramenta de gestão dos quizzes! Crie e gerencie temas, perguntas e respostas para os operadores."}

              {infoCommand === "@QuizAnalise" &&
                "📊 Análise detalhada do desempenho dos operadores no quiz diário."}

              {infoCommand === "@Senhas" &&
                "🔐 Redefinir senhas dos usuários do sistema."}

              {infoCommand === "@Acessos" &&
                "🛡️ Conceder ou revogar áreas do sistema por função, centro de custo ou CPF."}

              {infoCommand === "@Treinamentos" &&
                "📚 Cadastre e teste os treinamentos que a Aurora (@IA) usa para responder aos operadores da sua carteira. Sem deploy."}

              {infoCommand === "@Resultados" &&
                "📈 Resultado da operação por carteira e por operador, com meta e atingimento."}

              {infoCommand === "@Analytics" &&
                "📊 Acompanhe volume, resolução e uso das ferramentas do Copilot por operador e supervisor."}

              {infoCommand === "@SimulacaoQualidade" &&
                "🎮 Ferramenta de gestão das simulações! Crie cenários, interações e respostas para treinar os operadores."}

              {infoCommand === "@Premiação" &&
                "🎁 Gerencie prêmios do sistema de pontuação! Crie, edite e configure os prêmios disponíveis para os operadores resgatarem com seus pontos."}

              {infoCommand === "@Roteiro" &&
                "Agora o seu Roteiro está no Copilot"}

              {infoCommand === "@RoteiroAdm" &&
                "Agora o seu Roteiro está no Copilot"}

              {infoCommand === "@ConsultarContrato" &&
                (isDesenvolvimento
                  ? "Acompanhe os resultados de uso do @ConsultarContrato por operador e supervisor."
                  : "Consulte o contrato do cliente com os valores atualizados")}

              {infoCommand === "@GerarLinkPDF" && "Gere o link do boleto PDF"}

              {infoCommand === "@Campanha" &&
                "Visualize suas informações do Zeta Coins"}

              {infoCommand === "@EnvioBoleto" &&
                "Realize o envio de boleto para os clientes através do WhatsApp"}

              {infoCommand === "@Acionamento" &&
                "Visualize os clientes para entrar em contato"}

              {infoCommand === "@PesquisaPortabilidade" &&
                "Responda a Pesquisa feita para o Delta"}

              {infoCommand === "@PesquisaNaoPagamento" &&
                "Responda a Pesquisa feita para o GAMA"}

              {infoCommand === "@Arena" &&
                "🎮 Entre no HUB de campanhas, jogos, desafios e conquistas da sua equipe."}

              {infoCommand === "@Tour" &&
                "🧭 Refaça a apresentação guiada do Copilot com a Aurora. Ela mostra a barra de comandos e leva você por dentro de cada ferramenta."}

              {(infoCommand === "@AuroraInsight" ||
                infoCommand === "@AuroraInsight") &&
                "Receba insights personalizados para melhorar o desempenho dos operadores com a ajuda da Aurora IA!"}
            </p>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setInfoCommand(null);
                  setSearchTerm("");
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-blue-700 rounded-md transition"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

      {showIaModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-2xl max-w-md w-full border border-zinc-200 dark:border-zinc-800">
            <div className="flex flex-col items-center text-center space-y-4">
              <AlertTriangle className="h-10 w-10 text-yellow-500" />
              <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100">
                Olá! Sou a Aurora
              </h2>
              <p className="text-sm text-muted-foreground">
                Ainda tô em fase de criação, ajustando os parafusos e aprendendo
                umas coisinhas...
                <br />
                Logo logo estarei pronta pra te ajudar com tudo! 💬✨
              </p>
              <button
                onClick={() => setShowIaModal(false)}
                className="mt-4 inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-all"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        id="SearchInput"
        className={`w-full relative animate-fade-in ${
          visualVariant === "holographic"
            ? "mx-auto max-w-4xl"
            : "max-w-2xl"
        }`}
      >
        <div className="relative" ref={popoverTriggerRef}>
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search
              className={`h-[18px] w-[18px] ${
                visualVariant === "holographic"
                  ? "text-cyan-100/70"
                  : "text-gray-400"
              }`}
            />
          </div>
          <input
            ref={inputRef}
            data-tour="barra-comandos"
            type="text"
            className={
              visualVariant === "holographic"
                ? "block w-full rounded-full border border-cyan-100/35 bg-[#06152f]/75 py-3.5 pl-11 pr-20 text-sm text-white shadow-[0_0_24px_rgba(31,142,255,0.18),inset_0_0_20px_rgba(24,108,220,0.1)] outline-none backdrop-blur-xl transition-all placeholder:text-slate-300/75 focus:border-cyan-200/70 focus:ring-2 focus:ring-cyan-300/20 md:text-base"
                : "block w-full py-3 pl-10 pr-10 bg-background text-foreground border border-border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary/60 focus:outline-none transition-all shadow-sm md:placeholder:text-muted-foreground placeholder-transparent"
            }
            placeholder={placeholderText}
            value={searchTerm}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
          />
          {searchTerm && (
            <button
              onClick={clearSearch}
              className={`absolute inset-y-0 flex items-center pr-2 ${
                visualVariant === "holographic" ? "right-14" : "right-12"
              }`}
            >
              <X className="h-[18px] w-[18px] text-gray-400 transition-colors hover:text-gray-600" />
            </button>
          )}
          <button
            onClick={handleSearch}
            disabled={!searchTerm.trim() || isSearching}
            aria-label="Executar comando"
            className={`absolute flex items-center justify-center transition-all ${
              visualVariant === "holographic"
                ? `bottom-1.5 right-1.5 top-1.5 aspect-square rounded-full border ${
                    !searchTerm.trim() || isSearching
                      ? "cursor-not-allowed border-slate-400/20 bg-slate-500/20 text-slate-400"
                      : "border-orange-200/80 bg-orange-400/15 text-orange-100 shadow-[0_0_18px_rgba(255,167,68,0.55)] hover:bg-orange-400/30"
                  }`
                : `right-0 top-0 bottom-0 px-4 m-[2px] rounded-r-lg ${
                    !searchTerm.trim() || isSearching
                      ? "bg-muted text-muted-foreground cursor-not-allowed"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  }`
            }`}
          >
            {isSearching ? (
              <div className="h-5 w-5 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
            ) : visualVariant === "holographic" ? (
              <ArrowUp className="h-5 w-5" />
            ) : (
              "Buscar"
            )}
          </button>

          {/* Command Palette with Categories */}
          {showSuggestions && (
            <div
              data-tour="painel-comandos"
              className={`absolute flex w-full max-w-4xl flex-col left-1/2 transform -translate-x-1/2 z-40 bg-background dark:bg-zinc-900 rounded-xl shadow-2xl border border-border overflow-hidden ${
                visualVariant === "holographic"
                  ? "copilot-command-panel bottom-[calc(100%+0.9rem)] max-h-[min(68vh,640px)] border-blue-300/[0.08]"
                  : "mt-2 max-h-[80vh]"
              }`}
            >
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
                <div className="flex shrink-0 flex-col items-start md:flex-row md:items-center gap-2 mb-4 px-2">
                  <Search
                    className={`h-4 w-4 ${
                      visualVariant === "holographic"
                        ? "text-cyan-200"
                        : "text-muted-foreground"
                    }`}
                  />
                  <div>
                    {visualVariant === "holographic" && (
                      <span className="copilot-quick-menu__eyebrow block pb-0.5">
                        SYSTEM / COMMAND DIRECTORY
                      </span>
                    )}
                    <span className="text-sm font-medium text-foreground">
                      Comandos Disponíveis
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground md:ml-auto">
                    Digite @ para buscar
                  </span>
                </div>

                <div className="aurora-command-scroll min-h-0 flex-1 overflow-y-auto pr-2 z-40">
                  {/* Comandos Pessoais */}
                  {NotIsAdmin &&
                    (onIACommand ||
                      onResultsCommand ||
                      onAnotacaoCommand) && (
                      <div className="mb-6">
                        <h3 className="text-xs font-semibold text-muted-foreground mb-3 px-2 uppercase tracking-wider flex items-center gap-2">
                          <BarChart className="h-3 w-3" />
                          📊 Comandos Pessoais
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {onIACommand && podeUsarIA && (
                            <div
                              className="group p-3 rounded-lg border border-border cursor-pointer transition-all duration-200 hover:bg-blue-50 dark:hover:bg-blue-950/20 hover:border-blue-200 hover:shadow-md"
                              onClick={() => selectCommand("@IA")}
                            >
                              <div className="flex items-start gap-2">
                                <Bot className="h-4 w-4 text-blue-500 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-sm text-foreground truncate">
                                    @IA
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    Aurora IA
                                  </div>
                                </div>
                                <button
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    showInfo("@IA");
                                  }}
                                >
                                  <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                </button>
                              </div>
                            </div>
                          )}
                          {onResultsCommand && !isVega && (
                            <div
                              className="group p-3 rounded-lg border border-border cursor-pointer transition-all duration-200 hover:bg-green-50 dark:hover:bg-green-950/20 hover:border-green-200 hover:shadow-md"
                              onClick={() => selectCommand("@Resultados")}
                            >
                              <div className="flex items-start gap-2">
                                <BarChart className="h-4 w-4 text-green-500 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-sm text-foreground truncate">
                                    @Resultados
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    Seu desempenho
                                  </div>
                                </div>
                                <button
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    showInfo("@Resultados");
                                  }}
                                >
                                  <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                </button>
                              </div>
                            </div>
                          )}
                          {/* {onAuditoriaCommand && (
                            <div
                              className="group cursor-pointer rounded-lg border border-border p-3 transition-all duration-200 hover:border-violet-200 hover:bg-violet-50 hover:shadow-md dark:hover:bg-violet-950/20"
                              onClick={() => selectCommand("@Auditoria")}
                            >
                              <div className="flex items-start gap-2">
                                <AudioLines className="h-4 w-4 flex-shrink-0 text-violet-600" />
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-sm font-medium text-foreground">
                                    @Auditoria
                                  </div>
                                  <div className="mt-0.5 text-xs text-muted-foreground">
                                    Analisar uma ligação
                                  </div>
                                </div>
                                <button
                                  className="opacity-0 transition-opacity group-hover:opacity-100"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    showInfo("@Auditoria");
                                  }}
                                >
                                  <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                </button>
                              </div>
                            </div>
                          )} */}
                          {onAnotacaoCommand && (
                            <div
                              className="group p-3 rounded-lg border border-border cursor-pointer transition-all duration-200 hover:bg-orange-50 dark:hover:bg-orange-950/20 hover:border-orange-200 hover:shadow-md"
                              onClick={() => selectCommand("@Anotação")}
                            >
                              <div className="flex items-start gap-2">
                                <StickyNote className="h-4 w-4 text-orange-500 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-sm text-foreground truncate">
                                    @Anotação
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    Anotações pessoais
                                  </div>
                                </div>
                                <button
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    showInfo("@Anotação");
                                  }}
                                >
                                  <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                </button>
                              </div>
                            </div>
                          )}
                          {onAgendamentoCommand && (
                            <div
                              className="group p-3 rounded-lg border border-border cursor-pointer transition-all duration-200 hover:bg-orange-50 dark:hover:bg-orange-950/20 hover:border-orange-200 hover:shadow-md"
                              onClick={() => selectCommand("@Agendamento")}
                            >
                              <div className="flex items-start gap-2">
                                <Calendar className="h-4 w-4 text-orange-500 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-sm text-foreground truncate">
                                    @Agendamento
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    Agendamento para retorno
                                  </div>
                                </div>
                                <button
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    showInfo("@Anotação");
                                  }}
                                >
                                  <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                </button>
                              </div>
                            </div>
                          )}
                          {onToDoCommand && (
                            <div
                              data-tour="cmd-tarefas"
                              className="group p-3 rounded-lg border border-border cursor-pointer transition-all duration-200 hover:bg-orange-50 dark:hover:bg-orange-950/20 hover:border-orange-200 hover:shadow-md"
                              onClick={() => selectCommand("@Tarefas")}
                            >
                              <div className="flex items-start gap-2">
                                <ListTodo className="h-4 w-4 text-orange-500 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-sm text-foreground truncate">
                                    @Tarefas
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    Organização de tarefas diárias
                                  </div>
                                </div>
                                <button
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    showInfo("@Anotação");
                                  }}
                                >
                                  <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                </button>
                              </div>
                            </div>
                          )}
                          {onChatFullTimeCommand && carteiraChat && (
                            <div
                              className="group p-3 rounded-lg border border-border cursor-pointer transition-all duration-200 hover:bg-orange-50 dark:hover:bg-orange-950/20 hover:border-orange-200 hover:shadow-md"
                              onClick={() => selectCommand("@Chat")}
                            >
                              <div className="flex items-start gap-2">
                                <MessageSquare className="h-4 w-4 text-red-500 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-sm text-foreground truncate">
                                    @Chat
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    Comunicação em tempo real
                                  </div>
                                </div>
                                <button
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    showInfo("@Chat");
                                  }}
                                >
                                  <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                </button>
                              </div>
                            </div>
                          )}

                          {onCampanhaCommand && Campanha && (
                            <div
                              className="group p-3 rounded-lg border border-border cursor-pointer transition-all duration-200 hover:bg-orange-50 dark:hover:bg-orange-950/20 hover:border-orange-200 hover:shadow-md"
                              onClick={() => selectCommand("@Campanha")}
                            >
                              <div className="flex items-start gap-2">
                                <MessageSquare className="h-4 w-4 text-red-500 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-sm text-foreground truncate">
                                    @Campanha
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    Zeta Coins
                                  </div>
                                </div>
                                <button
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    showInfo("@Campanha");
                                  }}
                                >
                                  <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                </button>
                              </div>
                            </div>
                          )}

                          {onConsultarContratoCommand &&
                            podeConsultarContrato && (
                            <div
                              className="group p-3 rounded-lg border border-border cursor-pointer transition-all duration-200 hover:bg-orange-50 dark:hover:bg-orange-950/20 hover:border-orange-200 hover:shadow-md"
                              onClick={() =>
                                selectCommand("@ConsultarContrato")
                              }
                            >
                              <div className="flex items-start gap-2">
                                <Contact className="h-4 w-4 text-blue-500 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-sm text-foreground truncate">
                                    @ConsultarContrato
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    {isDesenvolvimento
                                      ? "Resultados de uso da ferramenta"
                                      : "Consulte o contrato do cliente habitacional"}
                                  </div>
                                </div>
                                <button
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    showInfo("@ConsultarContrato");
                                  }}
                                >
                                  <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                </button>
                              </div>
                            </div>
                          )}
                          {onGerarLinkPDFCommand &&
                            ((isVega && isFuncaoNgc) || isVegaDigital) && (
                              <div
                                className="group p-3 rounded-lg border border-border cursor-pointer transition-all duration-200 hover:bg-orange-50 dark:hover:bg-orange-950/20 hover:border-orange-200 hover:shadow-md"
                                onClick={() => selectCommand("@GerarLinkPDF")}
                              >
                                <div className="flex items-start gap-2">
                                  <FileSymlink className="h-4 w-4 text-red-500 flex-shrink-0" />
                                  <div className="min-w-0 flex-1">
                                    <div className="font-medium text-sm text-foreground truncate">
                                      @GerarLinkPDF
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-0.5">
                                      Gere o link do boleto PDF para clientes
                                    </div>
                                  </div>
                                  <button
                                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      showInfo("@GerarLinkPDF");
                                    }}
                                  >
                                    <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                  </button>
                                </div>
                              </div>
                            )}
                          {onRoteiroCommand && isVega && (
                            <div
                              className="group p-3 rounded-lg border border-border cursor-pointer transition-all duration-200 hover:bg-orange-50 dark:hover:bg-orange-950/20 hover:border-orange-200 hover:shadow-md"
                              onClick={() => selectCommand("@Roteiro")}
                            >
                              <div className="flex items-start gap-2">
                                <Contact className="h-4 w-4 text-blue-500 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-sm text-foreground truncate">
                                    @Roteiro
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    Visualize o roteiro de atendimento
                                  </div>
                                </div>
                                <button
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    showInfo("@Roteiro");
                                  }}
                                >
                                  <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                </button>
                              </div>
                            </div>
                          )}

                          {onAcionamentoCommand && acionamento && (
                            <div
                              className="group p-3 rounded-lg border border-border cursor-pointer transition-all duration-200 hover:bg-orange-50 dark:hover:bg-orange-950/20 hover:border-orange-200 hover:shadow-md"
                              onClick={() => selectCommand("@Acionamento")}
                            >
                              <div className="flex items-start gap-2">
                                <MessageSquare className="h-4 w-4 text-red-500 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-sm text-foreground truncate">
                                    @Acionamento
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    Acione seus clientes
                                  </div>
                                </div>
                                <button
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    showInfo("@Acionamento");
                                  }}
                                >
                                  <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                </button>
                              </div>
                            </div>
                          )}
                          {onArenaCommand && (
                            <div
                              data-tour="cmd-arena"
                              className="group p-3 rounded-lg border border-border cursor-pointer transition-all duration-200 hover:bg-orange-50 dark:hover:bg-orange-950/20 hover:border-orange-200 hover:shadow-md"
                              onClick={() => selectCommand("@Arena")}
                            >
                              <div className="flex items-start gap-2">
                                <Gamepad2 className="h-4 w-4 text-cyan-500 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-sm text-foreground truncate">
                                    @Arena
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    Campanhas e jogos
                                  </div>
                                </div>
                                <button
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    showInfo("@Arena");
                                  }}
                                >
                                  <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                </button>
                              </div>
                            </div>
                          )}
                          {onTabulacoesCommand && (
                            <div
                              className="group p-3 rounded-lg border border-border cursor-pointer transition-all duration-200 hover:bg-orange-50 dark:hover:bg-orange-950/20 hover:border-orange-200 hover:shadow-md"
                              onClick={() => selectCommand("@Tabulacoes")}
                            >
                              <div className="flex items-start gap-2">
                                <Headset className="h-4 w-4 text-teal-500 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-sm text-foreground truncate">
                                    @Tabulações
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    Entenda como e quando usar suas tabulações
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                          {onEnvioBoletoCommand && !EnvioBoletoBlock && (
                            <div
                              className="group p-3 rounded-lg border border-border cursor-pointer transition-all duration-200 hover:bg-orange-50 dark:hover:bg-orange-950/20 hover:border-orange-200 hover:shadow-md"
                              onClick={() => selectCommand("@EnvioBoleto")}
                            >
                              <div className="flex items-start gap-2">
                                <MessageSquare className="h-4 w-4 text-red-500 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-sm text-foreground truncate">
                                    @EnvioBoleto
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    Envie boleto para os clientes
                                  </div>
                                </div>
                                <button
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    showInfo("@EnvioBoleto");
                                  }}
                                >
                                  <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                </button>
                              </div>
                            </div>
                          )}
                          {onPesquisaNaoPagamentoCommand && PesquisaPgmt && (
                            <div
                              className="group p-3 rounded-lg border border-border cursor-pointer transition-all duration-200 hover:bg-orange-50 dark:hover:bg-orange-950/20 hover:border-orange-200 hover:shadow-md"
                              onClick={() =>
                                selectCommand("@PesquisaNaoPagamento")
                              }
                            >
                              <div className="flex items-start gap-2">
                                <MessageSquare className="h-4 w-4 text-red-500 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-sm text-foreground truncate">
                                    @PesquisaNãoPagamento
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    Responda a Pesquisa
                                  </div>
                                </div>
                                <button
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    showInfo("@PesquisaNaoPagamento");
                                  }}
                                >
                                  <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                </button>
                              </div>
                            </div>
                          )}
                          {onScriptDeltaCommand && Pesquisa && (
                            <div
                              className="group p-3 rounded-lg border border-border cursor-pointer transition-all duration-200 hover:bg-orange-50 dark:hover:bg-orange-950/20 hover:border-orange-200 hover:shadow-md"
                              onClick={() => selectCommand("@Script")}
                            >
                              <div className="flex items-start gap-2">
                                <MessageSquare className="h-4 w-4 text-red-500 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-sm text-foreground truncate">
                                    @Script
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    Script Delta
                                  </div>
                                </div>
                                <button
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    showInfo("@Script");
                                  }}
                                >
                                  <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                </button>
                              </div>
                            </div>
                          )}
                          {onScriptGamaCommand && ScriptGAMA && (
                            <div
                              className="group p-3 rounded-lg border border-border cursor-pointer transition-all duration-200 hover:bg-orange-50 dark:hover:bg-orange-950/20 hover:border-orange-200 hover:shadow-md"
                              onClick={() => selectCommand("@ScriptGAMA")}
                            >
                              <div className="flex items-start gap-2">
                                <MessageSquare className="h-4 w-4 text-red-500 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-sm text-foreground truncate">
                                    @Script
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    Script GAMA
                                  </div>
                                </div>
                                <button
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    showInfo("@ScriptGAMA");
                                  }}
                                >
                                  <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                </button>
                              </div>
                            </div>
                          )}
                          {onChecklistCommand && Checklist && (
                            <div
                              className="group p-3 rounded-lg border border-border cursor-pointer transition-all duration-200 hover:bg-orange-50 dark:hover:bg-orange-950/20 hover:border-orange-200 hover:shadow-md"
                              onClick={() => selectCommand("@Checklist")}
                            >
                              <div className="flex items-start gap-2">
                                <MessageSquare className="h-4 w-4 text-red-500 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-sm text-foreground truncate">
                                    @Checklist
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    Checklist de qualidade no atendimento
                                  </div>
                                </div>
                                <button
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    showInfo("@Checklist");
                                  }}
                                >
                                  <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                  {/* Comandos de Trabalho */}
                  {NotIsAdmin &&
                    !isVega &&
                    (onPendentesCommand ||
                      onPlanilhasCommand ||
                      onAcordosCommand ||
                      onFeedbacksCommand) && (
                      <div className="mb-6">
                        <h3 className="text-xs font-semibold text-muted-foreground mb-3 px-2 uppercase tracking-wider flex items-center gap-2">
                          <FileSpreadsheet className="h-3 w-3" />
                          💼 Comandos de Trabalho
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {onPendentesCommand && (
                            <div
                              className="group p-3 rounded-lg border border-border cursor-pointer transition-all duration-200 hover:bg-orange-50 dark:hover:bg-orange-950/20 hover:border-orange-200 hover:shadow-md"
                              onClick={() => selectCommand("@Pendentes")}
                            >
                              <div className="flex items-start gap-2">
                                <ClipboardList className="h-4 w-4 text-orange-500 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-sm text-foreground truncate">
                                    @Pendentes
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    Pagamentos hoje
                                  </div>
                                </div>
                                <button
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    showInfo("@Pendentes");
                                  }}
                                >
                                  <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                </button>
                              </div>
                            </div>
                          )}
                          {onPlanilhasCommand && (
                            <div
                              className="group p-3 rounded-lg border border-border cursor-pointer transition-all duration-200 hover:bg-green-50 dark:hover:bg-green-950/20 hover:border-green-200 hover:shadow-md"
                              onClick={() => selectCommand("@Planilhas")}
                            >
                              <div className="flex items-start gap-2">
                                <FileSpreadsheet className="h-4 w-4 text-green-600 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-sm text-foreground truncate">
                                    @Planilhas
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    Buscar clientes
                                  </div>
                                </div>
                                <button
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    showInfo("@Planilhas");
                                  }}
                                >
                                  <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                </button>
                              </div>
                            </div>
                          )}
                          {onAcordosCommand && (
                            <div
                              className="group p-3 rounded-lg border border-border cursor-pointer transition-all duration-200 hover:bg-red-50 dark:hover:bg-red-950/20 hover:border-red-200 hover:shadow-md"
                              onClick={() => selectCommand("@Acordos")}
                            >
                              <div className="flex items-start gap-2">
                                <Handshake className="h-4 w-4 text-red-600 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-sm text-foreground truncate">
                                    @Acordos
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    Seus acordos
                                  </div>
                                </div>
                                <button
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    showInfo("@Acordos");
                                  }}
                                >
                                  <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                  {/* Comandos de Treinamento */}
                  {NotIsAdmin &&
                    (onAcademiaCommand || onFeedbacksCommand) && (
                    <div className="mb-6">
                      <h3 className="text-xs font-semibold text-muted-foreground mb-3 px-2 uppercase tracking-wider flex items-center gap-2">
                        <GamepadIcon className="h-3 w-3" />
                        🎓 Comandos de Treinamento
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {onAcademiaCommand && (
                          <div
                            data-tour="cmd-academia"
                            className="group p-3 rounded-lg border border-orange-500/30 bg-orange-500/5 cursor-pointer transition-all duration-200 hover:bg-orange-500/10 hover:border-orange-400 hover:shadow-md"
                            onClick={() => selectCommand("@Academia")}
                          >
                            <div className="flex items-start gap-2">
                              <GraduationCap className="h-4 w-4 text-orange-500 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-sm text-foreground truncate">
                                  @Academia
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  Jornada de aprendizagem
                                </div>
                              </div>
                              <button
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  showInfo("@Academia");
                                }}
                              >
                                <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                              </button>
                            </div>
                          </div>
                        )}
                        {onFeedbacksCommand && (
                          <div
                            className="group p-3 rounded-lg border border-border cursor-pointer transition-all duration-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 hover:border-indigo-200 hover:shadow-md"
                            onClick={() => selectCommand("@Feedbacks")}
                          >
                            <div className="flex items-start gap-2">
                              <MessageSquare className="h-4 w-4 text-indigo-600 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-sm text-foreground truncate">
                                  @Feedbacks
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  Seus feedbacks
                                </div>
                              </div>
                              <button
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  showInfo("@Feedbacks");
                                }}
                              >
                                <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {(isGerente ||
                    onGestaoCommand ||
                    onResultadosCommand ||
                    onAnalyticsCommand ||
                    (onConsultarContratoCommand && isDesenvolvimento)) && (
                    <div className="mb-6">
                      <h3 className="text-xs font-semibold text-muted-foreground mb-3 px-2 uppercase tracking-wider flex items-center gap-2">
                        <Settings className="h-3 w-3" />
                        ⚙️ Comandos Gerenciais
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {onGestaoCommand && (
                          <div
                            className="group cursor-pointer rounded-lg border border-cyan-400/25 bg-cyan-400/5 p-3 transition-all duration-200 hover:border-cyan-300/50 hover:bg-cyan-400/10 hover:shadow-md"
                            onClick={() => selectCommand("@Gestão")}
                          >
                            <div className="flex items-start gap-2">
                              <BarChart3 className="h-4 w-4 flex-shrink-0 text-cyan-400" />
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium text-foreground">
                                  @Gestão
                                </div>
                                <div className="mt-0.5 text-xs text-muted-foreground">
                                  Central executiva da operação
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        {onResultadosCommand && (
                          <div
                            className="group cursor-pointer rounded-lg border border-emerald-400/25 bg-emerald-400/5 p-3 transition-all duration-200 hover:border-emerald-300/50 hover:bg-emerald-400/10 hover:shadow-md"
                            onClick={() => selectCommand("@Resultados")}
                          >
                            <div className="flex items-start gap-2">
                              <TrendingUp className="h-4 w-4 flex-shrink-0 text-emerald-400" />
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium text-foreground">
                                  @Resultados
                                </div>
                                <div className="mt-0.5 text-xs text-muted-foreground">
                                  Resultado por carteira e operador
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        {onAnalyticsCommand && (
                          <div
                            className="group p-3 rounded-lg border border-border cursor-pointer transition-all duration-200 hover:bg-blue-50 dark:hover:bg-blue-950/20 hover:border-blue-200 hover:shadow-md"
                            onClick={() => selectCommand("@Analytics")}
                          >
                            <div className="flex items-start gap-2">
                              <Bot className="h-4 w-4 text-blue-500 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-sm text-foreground truncate">
                                  @Analytics
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  Resultados de uso das ferramentas
                                </div>
                              </div>
                              <button
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  showInfo("@Analytics");
                                }}
                              >
                                <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                              </button>
                            </div>
                          </div>
                        )}
                        {onConsultarContratoCommand &&
                          isDesenvolvimento &&
                          (isAdmin || isGerente) && (
                            <div
                              className="group cursor-pointer rounded-lg border border-cyan-400/25 bg-cyan-400/5 p-3 transition-all duration-200 hover:border-cyan-300/50 hover:bg-cyan-400/10 hover:shadow-md"
                              onClick={() => selectCommand("@ConsultarContrato")}
                            >
                              <div className="flex items-start gap-2">
                                <Contact className="h-4 w-4 flex-shrink-0 text-cyan-400" />
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-sm font-medium text-foreground">
                                    @UsoConsultarContrato
                                  </div>
                                  <div className="mt-0.5 text-xs text-muted-foreground">
                                    Resultados de uso da ferramenta
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                      </div>
                    </div>
                  )}

                  {/* Comandos Administrativos */}
                  {isAdmin && (
                    <div className="mb-6">
                      <h3 className="text-xs font-semibold text-muted-foreground mb-3 px-2 uppercase tracking-wider flex items-center gap-2">
                        <Settings className="h-3 w-3" />
                        ⚙️ Comandos Administrativos
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {onIACommand && podeUsarIA && (
                          <div
                            className="group p-3 rounded-lg border border-border cursor-pointer transition-all duration-200 hover:bg-blue-50 dark:hover:bg-blue-950/20 hover:border-blue-200 hover:shadow-md"
                            onClick={() => selectCommand("@IA")}
                          >
                            <div className="flex items-start gap-2">
                              <Bot className="h-4 w-4 text-blue-500 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-sm text-foreground truncate">
                                  @IA
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  Aurora IA
                                </div>
                              </div>
                              <button
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  showInfo("@IA");
                                }}
                              >
                                <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                              </button>
                            </div>
                          </div>
                        )}
                        {isFuncaoADM && onMatriculasCommand && (
                          <div
                            className="group p-3 rounded-lg border border-border cursor-pointer transition-all duration-200 hover:bg-blue-50 dark:hover:bg-blue-950/20 hover:border-blue-200 hover:shadow-md"
                            onClick={() => selectCommand("@Matriculas")}
                          >
                            <div className="flex items-start gap-2">
                              <ClipboardList className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-sm text-foreground truncate">
                                  @Matrículas CRMWEB
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  Lista de matrículas para o portal CRMWEB
                                </div>
                              </div>
                              <button
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  showInfo("@Matriculas");
                                }}
                              >
                                <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                              </button>
                            </div>
                          </div>
                        )}
                        {onPasswordResetCommand && (
                          <div
                            className="group p-3 rounded-lg border border-border cursor-pointer transition-all duration-200 hover:bg-red-50 dark:hover:bg-red-950/20 hover:border-red-200 hover:shadow-md"
                            onClick={() => selectCommand("@Senhas")}
                          >
                            <div className="flex items-start gap-2">
                              <Lock className="h-4 w-4 text-red-500 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-sm text-foreground truncate">
                                  @Senhas
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  Redefinir senhas
                                </div>
                              </div>
                              <button
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  showInfo("@Senhas");
                                }}
                              >
                                <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                              </button>
                            </div>
                          </div>
                        )}
                        {onAcessosCommand && (
                          <div
                            className="group cursor-pointer rounded-lg border border-border p-3 transition-all duration-200 hover:border-amber-200 hover:bg-amber-50 hover:shadow-md dark:hover:bg-amber-950/20"
                            onClick={() => selectCommand("@Acessos")}
                          >
                            <div className="flex items-start gap-2">
                              <ShieldCheck className="h-4 w-4 flex-shrink-0 text-amber-500" />
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium text-foreground">
                                  @Acessos
                                </div>
                                <div className="mt-0.5 text-xs text-muted-foreground">
                                  Permissões por área
                                </div>
                              </div>
                              <button
                                className="opacity-0 transition-opacity group-hover:opacity-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  showInfo("@Acessos");
                                }}
                              >
                                <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                              </button>
                            </div>
                          </div>
                        )}
                        {onBaseConhecimentoCommand && (
                          <div
                            className="group cursor-pointer rounded-lg border border-border p-3 transition-all duration-200 hover:border-emerald-200 hover:bg-emerald-50 hover:shadow-md dark:hover:bg-emerald-950/20"
                            onClick={() => selectCommand("@Treinamentos")}
                          >
                            <div className="flex items-start gap-2">
                              <BookOpen className="h-4 w-4 flex-shrink-0 text-emerald-500" />
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium text-foreground">
                                  @Treinamentos
                                </div>
                                <div className="mt-0.5 text-xs text-muted-foreground">
                                  Base de conhecimento da Aurora
                                </div>
                              </div>
                              <button
                                className="opacity-0 transition-opacity group-hover:opacity-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  showInfo("@Treinamentos");
                                }}
                              >
                                <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                              </button>
                            </div>
                          </div>
                        )}
                        {onArenaCommand && (
                          <div
                            data-tour="cmd-arena"
                            className="group cursor-pointer rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3 transition-all duration-200 hover:border-cyan-400 hover:bg-cyan-500/10 hover:shadow-md"
                            onClick={() => selectCommand("@Arena")}
                          >
                            <div className="flex items-start gap-2">
                              <Gamepad2 className="h-4 w-4 flex-shrink-0 text-cyan-400" />
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium text-foreground">
                                  @Arena
                                </div>
                                <div className="mt-0.5 text-xs text-muted-foreground">
                                  Criar e acompanhar campanhas
                                </div>
                              </div>
                              <button
                                className="opacity-0 transition-opacity group-hover:opacity-100"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  showInfo("@Arena");
                                }}
                              >
                                <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                              </button>
                            </div>
                          </div>
                        )}
                        {onIdealCommand && (
                          <div
                            className="group p-3 rounded-lg border border-border cursor-pointer transition-all duration-200 hover:bg-blue-50 dark:hover:bg-blue-950/20 hover:border-blue-200 hover:shadow-md"
                            onClick={() => selectCommand("@Ideal")}
                          >
                            <div className="flex items-start gap-2">
                              <Target className="h-4 w-4 text-blue-600 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-sm text-foreground truncate">
                                  @Ideal
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  Ideal operador
                                </div>
                              </div>
                              <button
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  showInfo("@Ideal");
                                }}
                              >
                                <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                              </button>
                            </div>
                          </div>
                        )}
                        {/*
                          O @Tarefas vivia só em "Comandos Pessoais", que é
                          fechada por NotIsAdmin — então supervisor e admin
                          simplesmente não enxergavam o comando. Aqui ele
                          reaparece para quem gerencia equipe.
                        */}
                        {onToDoCommand && (
                          <div
                            data-tour="cmd-tarefas"
                            className="group p-3 rounded-lg border border-border cursor-pointer transition-all duration-200 hover:bg-orange-50 dark:hover:bg-orange-950/20 hover:border-orange-200 hover:shadow-md"
                            onClick={() => selectCommand("@Tarefas")}
                          >
                            <div className="flex items-start gap-2">
                              <ListTodo className="h-4 w-4 text-orange-500 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-sm text-foreground truncate">
                                  @Tarefas
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  Equipes e delegação de demandas
                                </div>
                              </div>
                              <button
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  showInfo("@Tarefas");
                                }}
                              >
                                <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                              </button>
                            </div>
                          </div>
                        )}


                        {onAnotacaoCommand && (
                          <div
                            className="group p-3 rounded-lg border border-border cursor-pointer transition-all duration-200 hover:bg-orange-50 dark:hover:bg-orange-950/20 hover:border-orange-200 hover:shadow-md"
                            onClick={() => selectCommand("@Anotação")}
                          >
                            <div className="flex items-start gap-2">
                              <StickyNote className="h-4 w-4 text-orange-500 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-sm text-foreground truncate">
                                  @Anotação
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  Anotações pessoais
                                </div>
                              </div>
                              <button
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  showInfo("@Anotação");
                                }}
                              >
                                <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                              </button>
                            </div>
                          </div>
                        )}
                        {onChatFullTimeCommand && (
                          <div
                            className="group p-3 rounded-lg border border-border cursor-pointer transition-all duration-200 hover:bg-orange-50 dark:hover:bg-orange-950/20 hover:border-orange-200 hover:shadow-md"
                            onClick={() => selectCommand("@Chat")}
                          >
                            <div className="flex items-start gap-2">
                              <StickyNote className="h-4 w-4 text-orange-500 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-sm text-foreground truncate">
                                  @Chat
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  Comunicação em tempo real
                                </div>
                              </div>
                              <button
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  showInfo("@Chat");
                                }}
                              >
                                <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                              </button>
                            </div>
                          </div>
                        )}
                        {/* {onEnvioBoletoCommand && EnvioBoletoBlock && (
                          <div
                            className="group p-3 rounded-lg border border-border cursor-pointer transition-all duration-200 hover:bg-orange-50 dark:hover:bg-orange-950/20 hover:border-orange-200 hover:shadow-md"
                            onClick={() => selectCommand("@EnvioBoleto")}
                          >
                            <div className="flex items-start gap-2">
                              <MessageSquare className="h-4 w-4 text-red-500 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-sm text-foreground truncate">
                                  @EnvioBoleto
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  Envie boleto para os clientes
                                </div>
                              </div>
                              <button
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  showInfo("@EnvioBoleto");
                                }}
                              >
                                <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                              </button>
                            </div>
                          </div>
                        )} */}
                        {onPesquisaCommand && Pesquisa && (
                          <div
                            className="group p-3 rounded-lg border border-border cursor-pointer transition-all duration-200 hover:bg-orange-50 dark:hover:bg-orange-950/20 hover:border-orange-200 hover:shadow-md"
                            onClick={() =>
                              selectCommand("@PesquisaPortabilidade")
                            }
                          >
                            <div className="flex items-start gap-2">
                              <MessageSquare className="h-4 w-4 text-red-500 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-sm text-foreground truncate">
                                  @PesquisaPortabilidade
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  Responda a Pesquisa
                                </div>
                              </div>
                              <button
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  showInfo("@PesquisaPortabilidade");
                                }}
                              >
                                <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                              </button>
                            </div>
                          </div>
                        )}
                        {onPesquisaNaoPagamentoCommand && PesquisaPgmt && (
                          <div
                            className="group p-3 rounded-lg border border-border cursor-pointer transition-all duration-200 hover:bg-orange-50 dark:hover:bg-orange-950/20 hover:border-orange-200 hover:shadow-md"
                            onClick={() =>
                              selectCommand("@PesquisaNaoPagamento")
                            }
                          >
                            <div className="flex items-start gap-2">
                              <MessageSquare className="h-4 w-4 text-red-500 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-sm text-foreground truncate">
                                  @PesquisaNãoPagamento
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  Responda a Pesquisa
                                </div>
                              </div>
                              <button
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  showInfo("@PesquisaNaoPagamento");
                                }}
                              >
                                <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Comandos da Qualidade */}
                  {(isAdmin || podeAcessarMonitoria) &&
                    (onQuizQualidadeCommand ||
                      onSimulacaoQualidadeCommand ||
                      onAcademiaQualidadeCommand ||
                      onFeedbackCreationCommand) && (
                      <div>
                        <h3 className="text-xs font-semibold text-muted-foreground mb-3 px-2 uppercase tracking-wider flex items-center gap-2">
                          <Target className="h-3 w-3" />
                          🎯 Comandos da Qualidade
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {onAcademiaQualidadeCommand && (
                            <div
                              data-tour="cmd-academia-qualidade"
                              className="group p-3 rounded-lg border border-orange-500/30 bg-orange-500/5 cursor-pointer transition-all duration-200 hover:bg-orange-500/10 hover:border-orange-400 hover:shadow-md"
                              onClick={() =>
                                selectCommand("@AcademiaQualidade")
                              }
                            >
                              <div className="flex items-start gap-2">
                                <GraduationCap className="h-4 w-4 text-orange-500 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-sm text-foreground truncate">
                                    @AcademiaQualidade
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    Gerenciar cursos e aulas
                                  </div>
                                </div>
                                <button
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    showInfo("@AcademiaQualidade");
                                  }}
                                >
                                  <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                </button>
                              </div>
                            </div>
                          )}
                          {onQuizQualidadeCommand && (
                            <div
                              className="group p-3 rounded-lg border border-border cursor-pointer transition-all duration-200 hover:bg-purple-50 dark:hover:bg-purple-950/20 hover:border-purple-200 hover:shadow-md"
                              onClick={() => selectCommand("@QuizQualidade")}
                            >
                              <div className="flex items-start gap-2">
                                <Settings className="h-4 w-4 text-purple-500 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-sm text-foreground truncate">
                                    @QuizQualidade
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    Gerenciar quizzes
                                  </div>
                                </div>
                                <button
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    showInfo("@QuizQualidade");
                                  }}
                                >
                                  <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                </button>
                              </div>
                            </div>
                          )}
                          {onSimulacaoQualidadeCommand && (
                            <div
                              className="group p-3 rounded-lg border border-border cursor-pointer transition-all duration-200 hover:bg-purple-50 dark:hover:bg-purple-950/20 hover:border-purple-200 hover:shadow-md"
                              onClick={() =>
                                selectCommand("@SimulacaoQualidade")
                              }
                            >
                              <div className="flex items-start gap-2">
                                <Gamepad2 className="h-4 w-4 text-purple-600 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-sm text-foreground truncate">
                                    @SimulacaoQualidade
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    Gerenciar simulações
                                  </div>
                                </div>
                                <button
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    showInfo("@SimulacaoQualidade");
                                  }}
                                >
                                  <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                </button>
                              </div>
                            </div>
                          )}
                          {onFeedbackCreationCommand && (
                            <div
                              className="group p-3 rounded-lg border border-border cursor-pointer transition-all duration-200 hover:bg-orange-50 dark:hover:bg-orange-950/20 hover:border-orange-200 hover:shadow-md"
                              onClick={() => selectCommand("@Monitoria")}
                            >
                              <div className="flex items-start gap-2">
                                <MessageSquare className="h-4 w-4 text-orange-600 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-sm text-foreground truncate">
                                    @Monitoria
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    Monitorar qualidade
                                  </div>
                                </div>
                                <button
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    showInfo("@Monitoria");
                                  }}
                                >
                                  <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                </button>
                              </div>
                            </div>
                          )}                          
                          {onCriarTabulacaoCommand && (
                            <div
                              className="group p-3 rounded-lg border border-border cursor-pointer transition-all duration-200 hover:bg-orange-50 dark:hover:bg-orange-950/20 hover:border-orange-200 hover:shadow-md"
                              onClick={() => selectCommand("@CriarTabulacao")}
                            >
                              <div className="flex items-start gap-2">
                                <List className="h-4 w-4 text-green-500 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-sm text-foreground truncate">
                                    @CriarTabulacao
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    Crie e edite tabulações para diferentes carteiras
                                  </div>
                                </div>
                                <button
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    showInfo("@CriarTabulacao");
                                  }}
                                >
                                  <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                </button>
                              </div>
                            </div>
                          )}
                          {onQuizAnaliseCommand && (
                            <div
                              className="group p-3 rounded-lg border border-border cursor-pointer transition-all duration-200 hover:bg-blue-50 dark:hover:bg-blue-950/20 hover:border-blue-200 hover:shadow-md"
                              onClick={() => selectCommand("@QuizAnalise")}
                            >
                              <div className="flex items-start gap-2">
                                <BarChart3 className="h-4 w-4 text-blue-600 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-sm text-foreground truncate">
                                    @QuizAnalise
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    Análise quiz
                                  </div>
                                </div>
                                <button
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    showInfo("@QuizAnalise");
                                  }}
                                >
                                  <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                </button>
                              </div>
                            </div>
                          )}
                          {onPremiacaoCommand && (
                            <div
                              className="group p-3 rounded-lg border border-border cursor-pointer transition-all duration-200 hover:bg-purple-50 dark:hover:bg-purple-950/20 hover:border-purple-200 hover:shadow-md"
                              onClick={() => selectCommand("@Premiação")}
                            >
                              <div className="flex items-start gap-2">
                                <Gift className="h-4 w-4 text-purple-600 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-sm text-foreground truncate">
                                    @Premiação
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    Gerenciar prêmios
                                  </div>
                                </div>
                                <button
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    showInfo("@Premiação");
                                  }}
                                >
                                  <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                </button>
                              </div>
                            </div>
                          )}

                          {onRoteiroAdmCommand && (
                            <div
                              className="group p-3 rounded-lg border border-border cursor-pointer transition-all duration-200 hover:bg-orange-50 dark:hover:bg-orange-950/20 hover:border-orange-200 hover:shadow-md"
                              onClick={() => selectCommand("@RoteiroAdm")}
                            >
                              <div className="flex items-start gap-2">
                                <Contact className="h-4 w-4 text-blue-500 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-sm text-foreground truncate">
                                    @RoteiroAdm
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    Visualize o roteiro de atendimento
                                  </div>
                                </div>
                                <button
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    showInfo("@RoteiroAdm");
                                  }}
                                >
                                  <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                </button>
                              </div>
                            </div>
                          )}

                        </div>
                      </div>
                    )}

                  {isAdmin && onAuroraInsightCommand && (
                    <div className="mt-6">
                      <h3 className="text-xs font-semibold text-muted-foreground mb-3 px-2 uppercase tracking-wider flex items-center gap-2">
                        <Bot className="h-3 w-3" />
                        ✨ Inteligência
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        <div
                          className="group p-3 rounded-lg border border-border cursor-pointer transition-all duration-200 hover:bg-orange-50 dark:hover:bg-orange-950/20 hover:border-orange-200 hover:shadow-md"
                          onClick={() => selectCommand("@AuroraInsight")}
                        >
                          <div className="flex items-start gap-2">
                            <Contact className="h-4 w-4 text-blue-500 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-sm text-foreground truncate">
                                @AuroraInsight
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                Insights de perguntas da IA
                              </div>
                            </div>
                            <button
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                showInfo("@AuroraInsight");
                              }}
                            >
                              <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/*
                    Ajuda — única seção sem gate de perfil.

                    As demais são fechadas por NotIsAdmin ou isAdmin, que são
                    comparações estritas com string: quem não tiver a chave
                    userIsAdmin no localStorage cai fora das duas. Como o tour
                    precisa alcançar todo mundo, ele mora aqui.
                  */}
                  {onTourCommand && (
                    <div className="mb-6">
                      <h3 className="text-xs font-semibold text-muted-foreground mb-3 px-2 uppercase tracking-wider flex items-center gap-2">
                        <Compass className="h-3 w-3" />
                        🧭 Ajuda
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        <div
                          className="group p-3 rounded-lg border border-border cursor-pointer transition-all duration-200 hover:bg-cyan-50 dark:hover:bg-cyan-950/20 hover:border-cyan-200 hover:shadow-md"
                          onClick={() => selectCommand("@Tour")}
                        >
                          <div className="flex items-start gap-2">
                            <Compass className="h-4 w-4 text-cyan-500 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-sm text-foreground truncate">
                                @Tour
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                Rever a apresentação guiada
                              </div>
                            </div>
                            <button
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                showInfo("@Tour");
                              }}
                            >
                              <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {visualVariant === "holographic" && featuredCommands.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            {featuredCommands.map((command) => (
              <button
                key={command}
                type="button"
                data-aurora-shortcut
                data-tour-comando={command}
                onClick={() => selectCommand(command)}
                className="rounded-full border border-cyan-100/25 bg-[#071a38]/70 px-5 py-2 text-sm font-medium text-slate-100 shadow-[inset_0_0_16px_rgba(38,123,218,0.08)] backdrop-blur-lg transition-all hover:-translate-y-0.5 hover:border-cyan-200/60 hover:bg-cyan-400/10 hover:text-white"
              >
                {command}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default SearchBar;
