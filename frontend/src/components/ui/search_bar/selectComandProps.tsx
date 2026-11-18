import { useState } from "react";

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
  onIdealCommand?: () => void;
  onOperacaoCommand?: () => void;
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
  onChatFullTimeCommand?: () => void;
  onInsightCommand?: () => void;
  onAnalyticsCommand?: () => void;
  onRoteiroCommand?: () => void;
  onCampanhaCommand?: () => void;
  onCampanhaPontuacaoCommand?: () => void;
  onEnvioBoletoCommand?: () => void;
  onAcionamentoCommand?: () => void;
  onArenaCommand?: () => void;
  onTabulacoesCommand?: () => void;
  onPesquisaCommand?: () => void;
  onPesquisaNaoPagamentoCommand?: () => void;
  onScriptDeltaCommand?: () => void;
  onScriptGamaCommand?: () => void;
  onChecklistCommand?: () => void;
  placeholderText?: string;
  isSearching?: boolean;
}
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
  onIdealCommand,
  onOperacaoCommand,
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
  onChatFullTimeCommand,
  onInsightCommand,
  onAnalyticsCommand,
  onRoteiroCommand,
  onCampanhaCommand,
  onCampanhaPontuacaoCommand,
  onEnvioBoletoCommand,
  onAcionamentoCommand,
  onArenaCommand,
  onTabulacoesCommand,
  onPesquisaCommand,
  onPesquisaNaoPagamentoCommand,
  onScriptDeltaCommand,
  onScriptGamaCommand,
  onChecklistCommand,
  placeholderText = "digite @ para ver os comandos disponíveis...",
  isSearching = false,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const isAdmin = localStorage.getItem("userIsAdmin") === "true";

  const centroCusto = (localStorage.getItem("centroCusto") || "")
    .trim()
    .toUpperCase();

  const centroCustoContem = (palavras: string[]) =>
    palavras.some((p) => centroCusto.includes(p));

  const isVega = centroCustoContem(["VEGA"]);

  const podeUsarIA = centroCustoContem([
    "BANCOALFA",
    "DELTA",
    "BETA",
    "ZETA",
    "VEGA",
    "MU",
    "ETA",
    "TETA",
    "SIRIUS",
    "BANCO GAMA",
    "GAMA DIGITAL",
  ]);

  const selectCommand = (command: string) => {
    if (command === "@IA" && podeUsarIA && onIACommand) {
      onIACommand();
    } else if (command === "@Matriculas" && onMatriculasCommand) {
      onMatriculasCommand();
    } else if (command === "@Resultados" && onResultsCommand && !isVega) {
      onResultsCommand();
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
    } else if (command === "@Feedbacks" && onFeedbacksCommand) {
      onFeedbacksCommand();
    } else if (
      command === "@Monitoria" &&
      isAdmin &&
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
    } else if (command === "@Operação" && isAdmin && onOperacaoCommand) {
      onOperacaoCommand();
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
    } else if (command === "@Chat" && onChatFullTimeCommand) {
      onChatFullTimeCommand();
    } else if (command === "@Analytics" && onAnalyticsCommand) {
      onAnalyticsCommand();
    } else if (command === "@Insight" && onInsightCommand) {
      onInsightCommand();
    } else if (command === "@Roteiro" && onRoteiroCommand) {
      onRoteiroCommand();
    } else if (command === "@Acionamento" && onAcionamentoCommand) {
      onAcionamentoCommand();
    } else if (command === "@Arena" && onArenaCommand) {
      onArenaCommand();
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
    } else if (command === "@CriarTabulacao" && onCriarTabulacaoCommand) {
      onCriarTabulacaoCommand();
    } else if (command === "@EnvioBoleto" && onEnvioBoletoCommand) {
      onEnvioBoletoCommand();
    } else if (
      command === "@CampanhaPontuacao" &&
      isAdmin &&
      onCampanhaPontuacaoCommand
    ) {
      onCampanhaPontuacaoCommand();
    } else {
      setSearchTerm(command);
    }

    setSearchTerm("");
    setShowSuggestions(false);
  };

  return <></>;
};

export default SearchBar;
