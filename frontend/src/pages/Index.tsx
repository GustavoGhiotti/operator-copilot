import React, {
  useEffect,
  useState,
  useContext,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { isAxiosError } from "axios";
import Header from "../components/Header";
import SearchBar from "../components/SearchBar";
import CustomerModal from "../components/CustomerModal";
import ChatModal from "../components/ChatModal";
import ResultsModal from "@/components/ResultsModal";
import StatusModal from "../components/StatusModal";
import PendentesModal from "../components/PendentesModal";
import PlanilhasModal from "@/components/PlanilhasModal";
import AcordosOperador from "@/components/AcordoOperador";
import PortalModal from "@/components/PortalModal";
import { OperatorDataProvider } from "@/context/OperatorDataContext";
import AnotacaoModal from "@/components/AnotacaoModal";
import { SearchContext } from "@/context/SearchContext";
import UserInsights from "@/components/UserInsights";
import DeltaModal from "@/components/DeltaModal";
import LoadingShowcase from "@/components/LoadingTest";
import { Loading } from "@/components/ui/loading";
import QuizModal from "@/components/QuizModal";
import SimulacaoModal from "@/components/SimulacaoModal";
import QuizNotificationPopup from "@/components/QuizNotificationPopUp";
import FeedbacksModal from "@/components/FeedbacksModal";
import FeedbackCreationModal from "@/components/FeedbackCreationModal";
import AgendamentoModal from "@/components/AgendamentoModal";
import TodoModal from "@/components/TodoModal";
import ChatFullTime from "@/components/ChatFullTime";
import TreinamentoModal from "@/components/TreinamentoModal";
import AcademiaModal from "@/components/AcademiaModal";
import RoteiroAdmModal from "@/components/RoteiroVegaAdm";
import RoteiroModal from "@/components/RoteiroVega";
import ConsultarContratoModal from "@/components/ConsultaCRMWEB";
import AnalyticsModal from "@/components/AnalyticsModal";
import GerarLinkPDFModal from "@/components/GerarLinkPDFModal";
import EnvioBoletoModal from "@/components/EnvioBoletoModal";
import { CampanhaModal } from "@/components/CampanhaModal";
import PesquisaPortabilidadeModal from "@/components/PesquisaPortabilidade";
import PesquisaNaoPagamentoModal from "@/components/PesquisaNaoPagamento";
import ScriptAtendimentoModal from "@/components/ScriptDeltaModal";
import ScriptAtendimentoGamaModal from "@/components/ScriptGamaModal";
import ChecklistModal from "@/components/ChecklistModal";

interface AlertaAgendamento {
  nome: string;
  cpf: string;
  ec: string;
  horario_retorno: string;
}

import AcionamentoModal from "@/components/AcionamentoTETAModal";
import ArenaModal from "@/components/ArenaModal";
import TabulacoesModal from "@/components/TabulacoesModal";
import EstatisticaModal from "@/components/EstatisticaModal";
import AuditoriaModal from "@/modules/auditoria/components/AuditoriaModal";
import AuroraStage from "@/components/AuroraStage";
import type { ControleBusca } from "@/components/SearchBar";
import { useTourDaHome } from "@/tour/useTourDaHome";
import TreinoBingo from "@/tour/TreinoBingo";
import FeedbackFinal from "@/tour/FeedbackFinal";

import * as Popover from "@radix-ui/react-popover";
import {
  Clock,
  ClipboardList,
  Info,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import axiosInstance from "@/utils/axiosInstance";
import {
  getAdminCommandAccess,
  isMonitorRole,
} from "@/utils/adminCommandAccess";

const ALBUM_EXTERNAL_URL = "http://album.empresa.local/login";

const Index = () => {
  const legacyHomeEnabled =
    import.meta.env.VITE_ENABLE_LEGACY_HOME === "true";
  const {
    isSearching,
    customer,
    setCustomer,
    setIsSearching,
    handleSearch,
    error,
    setError,
  } = useContext(SearchContext);

  const controleBusca = useRef<ControleBusca | null>(null);

  const aoMontarControleBusca = useCallback(
    (controle: ControleBusca | null) => {
      controleBusca.current = controle;
    },
    [],
  );


  const [showModal, setShowModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [showAuditoriaModal, setShowAuditoriaModal] = useState(false);
  const [showPlanilhasModal, setShowPlanilhasModal] = useState(false);
  const [showAcordosModal, setShowAcordosModal] = useState(false);
  const [showPendentesModal, setShowPendentesModal] = useState(false);
  const [showDeltaModal, setShowDeltaModal] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [showSimulacaoModal, setShowSimulacaoModal] = useState(false);
  const [showFeedbacksModal, setShowFeedbacksModal] = useState(false);
  const [showFeedbackCreationModal, setShowFeedbackCreationModal] =
    useState(false);
  const [showPortalModal, setShowPortalModal] = useState(false);
  const [showClientInfoModal, setShowClientInfoModal] = useState(false);
  const [showAnotacaoModal, setShowAnotacaoModal] = useState(false);
  const [showAgendamentooModal, setShowAgendamentoModal] = useState(false);
  const [showToDoModal, setShowToDoModal] = useState(false);
  const [showChatFullTimeModal, setShowChatFullTimeModal] = useState(false);
  const [showTreinamentoModal, setShowTreinamentoModal] = useState(false);
  const [showAcademiaModal, setShowAcademiaModal] = useState(false);
  const [showRoteiroModal, setShowRoteiroModal] = useState(false);
  const [showRoteiroAdmModal, setShowRoteiroAdmModal] = useState(false);
  const [showConsultarContratoModal, setShowConsultarContratoModal] =
    useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [showGerarLinkPDFModal, setShowGerarLinkPDFModal] = useState(false);
  const [showCampanhaModal, setShowCampanhaModal] = useState(false);
  const [showEnvioBoletoModal, setShowEnvioBoletoModal] = useState(false);
  const [showChristmasModal, setShowChristmasModal] = useState(false);
  const [showAcionamentoModal, setShowAcionamentoModal] = useState(false);
  const [showArenaModal, setShowArenaModal] = useState(false);
  const [showTabulacoesModal, setShowTabulacoesModal] = useState(false);
  const [showEstatisticaModal, setShowEstatisticaModal] = useState(false);
  const [showPesquisaModal, setShowPesquisaModal] = useState(false);
  const [showPesquisaNaoPagamentoModal, setShowPesquisaNaoPagamentoModal] =
    useState(false);
  const [showScriptDeltaModal, setShowScriptDeltaModal] =
    useState(false);
  const [showScriptGamaModal, setShowScriptGamaModal] = useState(false);
  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [performancePanelOpen, setPerformancePanelOpen] = useState(true);
  const podeAcessarMonitoria = isMonitorRole(localStorage.getItem("funcao"));
  const podeAcessarAnalytics = getAdminCommandAccess(
    localStorage.getItem("centroCusto"),
    localStorage.getItem("funcao"),
  ).toolAnalytics;

  // Esta home nao passa pelo sistema de permissao: os comandos chegam ao
  // SearchBar sem condicao. O @RoteiroAdm precisa da checagem porque quem o
  // barrava aqui era o `isQUALY` do SearchBar, que saiu -- sem isto o comando
  // apareceria para qualquer operador.
  const commandAccess = getAdminCommandAccess(
    localStorage.getItem("centroCusto"),
    localStorage.getItem("funcao"),
  );

  const [alertaAgendamento, setAlertaAgendamento] =
    useState<AlertaAgendamento | null>(null);

  const [loading, setLoading] = useState(true);
  const [showQuizNotification, setShowQuizNotification] = useState(false);
  const [userInsightsData, setUserInsightsData] = useState({
    portfolio: "",
    goal: 0,
    agreedTotal: 0,
    agreementCount: 0,
    paidAmount: 0,
  });

  const [username, setUsername] = useState(
    localStorage.getItem("nomeCompleto"),
  );
  const usuario = localStorage.getItem("nomeCompleto");
  useEffect(() => {
    if (!usuario) return;

    const verificarAgendamentos = async () => {
      try {
        const response = await axiosInstance.get("/api/agendamentos", {
          params: { usuario },
        });

        const agendamentos = response.data || [];
        const agora = new Date();

        agendamentos.forEach((a: AlertaAgendamento) => {
          const retorno = new Date(a.horario_retorno);

          // Se está no horário ± 1 min
          if (retorno <= agora && retorno.getTime() + 60000 > agora.getTime()) {
            setAlertaAgendamento(a);
          }
        });
      } catch (err) {
        console.error("Erro ao verificar agendamentos:", err);
      }
    };

    // Verifica a cada 30s
    const interval = setInterval(verificarAgendamentos, 30000);
    verificarAgendamentos(); // também roda logo de início

    return () => clearInterval(interval);
  }, [usuario]);

  useEffect(() => {
    const storedUsername = localStorage.getItem("nomeCompleto");
    if (storedUsername) {
      const nomeFormatado = storedUsername
        .split(" ")
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
        .join(" ");
      setUsername(nomeFormatado);
    } else {
      console.error("Nome do usuário não encontrado no localStorage.");
      setError?.("Nome do usuário não encontrado no localStorage.");
    }
  }, [setError]);

  useEffect(() => {
    if (!username) {
      console.error("Nome do usuário não encontrado no localStorage.");
      setError?.("Nome do usuário não encontrado no localStorage.");
      setLoading(false);
      return;
    }

    const token = localStorage.getItem("userToken");
    const headers = {
      Authorization: `Bearer ${token}`,
    };

    axiosInstance
      .post("/api/operadores/dados", {
        nome_usuario: username,
      })
      .then((response) => {
        if (
          !response.data ||
          !response.data.dados ||
          !Array.isArray(response.data.dados)
        ) {
          console.error("Dados inválidos recebidos:", response.data);
          setError?.("Erro nos dados recebidos.");
          setLoading(false);
          return;
        }

        const totalAgreements = response.data.dados.reduce(
          (acc, item) => acc + (item.quantidade || 0),
          0,
        );
        const totalValue = response.data.dados.reduce(
          (acc, item) => acc + (item.valor || 0),
          0,
        );
        const carteira = response.data.dados[0]?.carteira || "N/A";

        setUserInsightsData({
          portfolio: carteira,
          goal: 0,
          agreedTotal: totalValue,
          agreementCount: totalAgreements,
          paidAmount: 0,
        });

        setLoading(false);
      })
      .catch((error) => {
        console.error("Erro ao buscar dados:", error);
        setError?.(".");
        setLoading(false);
      });
  }, [username, setError]);

  useEffect(() => {
    const checkQuizAvailability = async () => {
      const storedUsername = localStorage
        .getItem("nomeCompleto")
        ?.trim()
        .toUpperCase();
      const centroCusto = localStorage.getItem("centroCusto")?.toUpperCase();

      if (!storedUsername || !centroCusto) return;

      try {
        // 1. Buscar todos os temas disponíveis
        const temasResponse = await axiosInstance.get("/api/quiz/temas", {
          params: { centro_custo: centroCusto },
        });
        const temas = temasResponse.data;

        if (!Array.isArray(temas) || temas.length === 0) return;

        // 2. Buscar os temas já concluídos hoje
        const concluidosResponse = await axiosInstance.get(
          "/api/quiz/concluidos",
          {
            params: { usuario: storedUsername },
          },
        );
        const temasConcluidosHoje =
          concluidosResponse.data?.concluidos?.map(String) ?? [];

        // 3. Verificar se há alguma pergunta disponível hoje e ainda não respondida
        for (const tema of temas) {
          if (temasConcluidosHoje.includes(String(tema.id))) continue; // já respondeu

          try {
            const perguntasRes = await axiosInstance.get(
              "/api/quiz/perguntas",
              {
                params: {
                  tema: tema.codigo,
                  usuario: storedUsername,
                  centro_custo: centroCusto,
                },
              },
            );

            if (
              Array.isArray(perguntasRes.data) &&
              perguntasRes.data.length > 0
            ) {
              setShowQuizNotification(true);
              break;
            }
          } catch (err: unknown) {
            if (
              isAxiosError(err) &&
              (err.response?.status === 403 || err.response?.status === 404)
            ) {
              continue;
            } else {
              console.error("Erro inesperado ao verificar perguntas:", err);
            }
          }
        }
      } catch (err) {
        console.error("Erro ao verificar disponibilidade do quiz:", err);
      }
    };

    const timer = setTimeout(() => {
      checkQuizAvailability();
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (customer) {
      setShowModal(true);
    }
  }, [customer]);

  const handleIACommand = () => {
    setShowChatModal(true);
  };

  const handleResultsCommand = () => {
    setShowResultsModal(true);
  };

  const handleAuditoriaCommand = () => {
    setShowAuditoriaModal(true);
  };

  const handlePendentesCommand = () => {
    setShowPendentesModal(true);
  };

  const handlePlanilhasCommand = () => {
    setShowPlanilhasModal(true);
  };

  const handleFeedbacksCommand = () => {
    setShowFeedbacksModal(true);
  };

  const handleFeedbackCreationCommand = () => {
    setShowFeedbackCreationModal(true);
  };

  const handleAcordosCommand = () => {
    setShowAcordosModal(true);
  };

  const handleDeltaCommand = () => {
    setShowDeltaModal(true);
  };

  const handleQuizCommand = () => {
    setShowQuizModal(true);
  };

  const handleSimulacaoCommand = () => {
    setShowSimulacaoModal(true);
  };

  const handlePortalCommand = () => {
    setShowPortalModal(true);
  };

  const handleInfoClienteCommand = () => {
    setShowClientInfoModal(true);
  };

  const handleAnotacaoCommand = () => {
    setShowAnotacaoModal(true);
  };

  const handleAgendamentoCommand = () => {
    setShowAgendamentoModal(true);
  };

  const handleToDoCommand = () => {
    setShowToDoModal(true);
  };

  // Lista única: os dois caminhos de saída do tour não podem divergir quando
  // um comando novo entrar no roteiro.
  const fecharModaisDoTour = useCallback(() => {
    setShowToDoModal(false);
    setShowArenaModal(false);
    setShowAcademiaModal(false);
  }, []);

  const {
    iniciarTour,
    treinoBingoAberto,
    fecharTreinoBingo,
    feedbackAberto,
    fecharFeedback,
  } = useTourDaHome({ controleBusca, fecharModais: fecharModaisDoTour });

  const handleChatFullTimeCommand = () => {
    setShowChatFullTimeModal(true);
  };

  const handleTreinamentoCommand = () => {
    setShowTreinamentoModal(true);
  };

  const handleAcademiaCommand = () => {
    setShowAcademiaModal(true);
  };

  const handleRoteiroCommand = () => {
    setShowRoteiroModal(true);
  };
  const handleRoteiroAdmCommand = () => {
    setShowRoteiroAdmModal(true);
  };
  const handleConsultarContratoCommand = () => {
    setShowConsultarContratoModal(true);
  };
  const handleAnalyticsCommand = () => {
    setShowAnalyticsModal(true);
  };
  const handleGerarLinkPDFCommand = () => {
    setShowGerarLinkPDFModal(true);
  };

  const handleCampanhaCommand = () => {
    setShowCampanhaModal(true);
  };

  const handleEnvioBoletoCommand = () => {
    setShowEnvioBoletoModal(true);
  };

  const handleAcionamentoCommand = () => {
    setShowAcionamentoModal(true);
  };

  const handleArenaCommand = () => {
    setShowArenaModal(true);
  };

  const handleTabulacoesCommand = () => {
    setShowTabulacoesModal(true);
  };

  const handleEstatisticaCommand = () => {
    setShowEstatisticaModal(true);
  };

  const handlePesquisaCommand = () => {
    setShowPesquisaModal(true);
  };

  const handlePesquisaNaoPagamentoCommand = () => {
    setShowPesquisaNaoPagamentoModal(true);
  };

  const handleScriptDeltaCommand = () => {
    setShowScriptDeltaModal(true);
  };

  const handleScriptGamaCommand = () => {
    setShowScriptGamaModal(true);
  };

  const handleChecklistCommand = () => {
    setShowChecklistModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
  };

  const closeChatModal = () => {
    setShowChatModal(false);
  };

  const closeResultsModal = () => {
    setShowResultsModal(false);
  };

  const closePendentesModal = () => {
    setShowPendentesModal(false);
  };

  const closePlanilhasModal = () => {
    setShowPlanilhasModal(false);
  };

  const closeFeedbacksModal = () => {
    setShowFeedbacksModal(false);
  };

  const closeAcordosModal = () => {
    setShowAcordosModal(false);
  };

  const closeDeltaModal = () => {
    setShowDeltaModal(false);
  };

  const closeQuizModal = () => {
    setShowQuizModal(false);
  };

  const closeSimulacaoModal = () => {
    setShowSimulacaoModal(false);
  };

  const closePortalModal = () => {
    setShowPortalModal(false);
  };

  const closeClientInfoModal = () => {
    setShowClientInfoModal(false);
  };

  const closeAnotacaoModal = () => {
    setShowAnotacaoModal(false);
  };

  const closeAgendamentoModal = () => {
    setShowAgendamentoModal(false);
  };

  const closeToDoModal = () => {
    setShowToDoModal(false);
  };

  const closeChatFullTimeModal = () => {
    setShowChatFullTimeModal(false);
  };

  const closeTreinamentoModal = () => {
    setShowTreinamentoModal(false);
  };

  const closeRoteiroModal = () => {
    setShowRoteiroModal(false);
  };
  const closeRoteiroAdmModal = () => {
    setShowRoteiroAdmModal(false);
  };

  const closeConsultarContratoModal = () => {
    setShowConsultarContratoModal(false);
  };

  const closeGerarLinkPDFModal = () => {
    setShowGerarLinkPDFModal(false);
  };

  const closeCampanhaModal = () => {
    setShowCampanhaModal(false);
  };

  const closeEnvioBoletoModal = () => {
    setShowEnvioBoletoModal(false);
  };

  const closeAcionamentoModal = () => {
    setShowAcionamentoModal(false);
  };

  const closeChristmasModal = () => {
    setShowChristmasModal(false);
  };

  const closeArenaModal = () => {
    setShowArenaModal(false);
  };

  const closeTabulacoesModal = () => {
    setShowTabulacoesModal(false);
  };

  const closeEstatisticaModal = () => {
    setShowEstatisticaModal(false);
  };
  const handleOpenAlbumExternal = () => {
    window.open(ALBUM_EXTERNAL_URL, "_blank", "noopener,noreferrer");
  };

  const closePesquisaModal = () => {
    setShowPesquisaModal(false);
  };

  const closePesquisaNaoPagamentoModal = () => {
    setShowPesquisaNaoPagamentoModal(false);
  };

  const closeScriptDeltaModal = () => {
    setShowScriptDeltaModal(false);
  };

  const closeScriptGamaModal = () => {
    setShowScriptGamaModal(false);
  };

  const closeChecklistModal = () => {
    setShowChecklistModal(false);
  };
  return (
    <OperatorDataProvider>
      <div className="relative min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col transition-colors duration-200">
          <Header
          visualVariant="aurora"
          // onChristmasClick={() => setShowChristmasModal(true)}
          onEstatisticasClick={() => setShowEstatisticaModal(true)}
          onAlbumClick={handleOpenAlbumExternal}
        />

          <aside
            className="pointer-events-none absolute bottom-0 left-0 top-20 z-20 hidden w-[300px] flex-col overflow-visible px-5 py-4 lg:flex"
          >
            <button
              type="button"
              onClick={() => setPerformancePanelOpen((open) => !open)}
              className={`pointer-events-auto absolute right-2 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-full text-blue-300/80 transition-[transform,color,background-color] ease-out hover:bg-blue-500/10 hover:text-orange-300 ${
                performancePanelOpen
                  ? "translate-x-0 duration-300 delay-0"
                  : "-translate-x-[264px] duration-300 delay-500"
              }`}
              aria-label={
                performancePanelOpen
                  ? "Minimizar painel de desempenho"
                  : "Abrir painel de desempenho"
              }
              title={
                performancePanelOpen
                  ? "Minimizar painel"
                  : "Abrir painel"
              }
            >
              {performancePanelOpen ? (
                <PanelLeftClose className="h-5 w-5" />
              ) : (
                <PanelLeftOpen className="h-5 w-5" />
              )}
            </button>

            <div
              className="flex min-h-0 flex-1 flex-col"
            >
              <div
                className={`relative mb-2 flex items-start justify-between gap-3 pr-9 pb-3 transition-opacity duration-300 ${
                  performancePanelOpen ? "opacity-100" : "opacity-0"
                }`}
              >
                <div>
                  <span className="mb-2 inline-flex text-[9px] font-bold uppercase tracking-[0.2em] text-orange-400">
                    Painel do operador
                  </span>
                  <h2 className="text-sm font-semibold leading-snug text-blue-50">
                    <span className="block font-black text-blue-300">
                      {username || "Operador"}
                    </span>
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEstatisticaModal(true)}
                  className="pointer-events-auto p-2 text-blue-300/75 transition hover:text-orange-300"
                  aria-label="Abrir estatísticas detalhadas"
                >
                  <ClipboardList className="h-4 w-4" />
                </button>
              </div>

              <div className="pointer-events-none relative flex-1 overflow-visible">
                <UserInsights
                  {...userInsightsData}
                  isVisible={performancePanelOpen}
                />
              </div>
            </div>

            <div
              className={`fixed bottom-4 left-5 text-[9px] uppercase tracking-[0.16em] text-blue-300/40 transition-[transform,opacity] duration-500 ease-in ${
                performancePanelOpen
                  ? "translate-y-0 opacity-100 delay-0"
                  : "translate-y-[120px] opacity-0 delay-100"
              }`}
            >
              Dados atualizados automaticamente
            </div>
          </aside>

          <span
            className={`pointer-events-none absolute left-10 top-[6.35rem] z-20 hidden whitespace-nowrap transition-[transform,opacity] duration-300 lg:block ${
              performancePanelOpen
                ? "-translate-x-3 opacity-0 delay-0"
                : "translate-x-0 opacity-100 delay-700"
            }`}
            aria-hidden={performancePanelOpen}
          >
            <span
              className="performance-drawer-glitch aurora-stage__greeting-support text-base font-semibold tracking-wide text-blue-100/85"
              data-text={"Visualizar seu\ndesempenho"}
            >
              Visualizar seu
              <br />
              desempenho
            </span>
          </span>

          <div className="min-w-0 flex-1">
            <AuroraStage>
            <div className="mx-auto w-full max-w-[980px]">
            <SearchBar
            onSearch={handleSearch}
            onIACommand={handleIACommand}
            onResultsCommand={handleResultsCommand}
            onAuditoriaCommand={handleAuditoriaCommand}
            onPendentesCommand={handlePendentesCommand}
            onPlanilhasCommand={handlePlanilhasCommand}
            onAcordosCommand={handleAcordosCommand}
            onDeltaCommand={handleDeltaCommand}
            onFeedbacksCommand={handleFeedbacksCommand}
            onFeedbackCreationCommand={
              podeAcessarMonitoria ? handleFeedbackCreationCommand : undefined
            }
            onPortalCommand={handlePortalCommand}
            onInfoClienteCommand={handleInfoClienteCommand}
            onAnotacaoCommand={handleAnotacaoCommand}
            onAgendamentoCommand={handleAgendamentoCommand}
            onToDoCommand={handleToDoCommand}
            onChatFullTimeCommand={handleChatFullTimeCommand}
            onAcademiaCommand={handleAcademiaCommand}
            onRoteiroCommand={handleRoteiroCommand}
            onRoteiroAdmCommand={
              commandAccess.quality ? handleRoteiroAdmCommand : undefined
            }
            onConsultarContratoCommand={handleConsultarContratoCommand}
            onGerarLinkPDFCommand={handleGerarLinkPDFCommand}
            onCampanhaCommand={handleCampanhaCommand}
            onEnvioBoletoCommand={handleEnvioBoletoCommand}
            onAcionamentoCommand={handleAcionamentoCommand}
            onArenaCommand={handleArenaCommand}
            onTabulacoesCommand={handleTabulacoesCommand}
            onPesquisaCommand={handlePesquisaCommand}
            onPesquisaNaoPagamentoCommand={handlePesquisaNaoPagamentoCommand}
            onScriptDeltaCommand={handleScriptDeltaCommand}
            onScriptGamaCommand={handleScriptGamaCommand}
            onChecklistCommand={handleChecklistCommand}
            onTourCommand={iniciarTour}
            placeholderText="Digite @ para acessar os comandos..."
            visualVariant="holographic"
            aoMontarControle={aoMontarControleBusca}
            featuredCommands={[
              "@Resultados",
              "@Anotação",
              "@Tarefas",
              "@Academia",
            ]}
            isSearching={isSearching}
          />
          {error && (
            <div className="mx-auto mt-4 w-full max-w-2xl rounded-xl border border-red-300/25 bg-red-950/55 p-3 text-center text-sm text-red-100 backdrop-blur-xl">
              {error}
            </div>
          )}
            </div>
            </AuroraStage>
          </div>

        {legacyHomeEnabled && (
        <main className="flex-1 flex flex-col">
          <div className="container mx-auto px-4 py-12 flex flex-col items-center">
            {/* HERO */}
            <div className="w-full max-w-4xl mb-12 text-center space-y-4">
              {/* TÍTULO */}
              <h1
                id="Welcome"
                className="
        text-4xl md:text-5xl font-extrabold tracking-tight
        bg-gradient-to-r from-orange-500 via-orange-400 to-orange-300
        dark:from-orange-300 dark:via-orange-100 dark:to-white
        bg-clip-text text-transparent
        drop-shadow-[0_4px_14px_rgba(255,150,80,0.35)]
        animate-fade-in
      "
              >
                Copilot <span className="font-black">Grupo Acme</span>
              </h1>

              {/* TAG BETA */}
              <div className="flex justify-center items-center gap-2 animate-fade-in-slow">
                <span
                  id="beta-tag"
                  className="
          inline-block px-4 py-1 text-xs font-semibold uppercase tracking-wide
          text-orange-700 dark:text-orange-200
          bg-orange-100/60 dark:bg-orange-900/40
          rounded-full
          border border-orange-300/40 dark:border-orange-600/50
          shadow-[0_0_8px_rgba(255,140,60,0.35)]
        "
                >
                  Beta • Em desenvolvimento
                </span>

                <Popover.Root>
                  <Popover.Trigger asChild>
                    <button
                      className="
              text-orange-600 hover:text-orange-700 
              dark:text-orange-300 dark:hover:text-orange-200
              transition-transform hover:scale-110
            "
                      aria-label="Mais informações"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </Popover.Trigger>

                  <Popover.Portal>
                    <Popover.Content
                      className="
              rounded-xl p-4 text-sm max-w-xs leading-relaxed
              bg-white/90 backdrop-blur-xl 
              border border-gray-300 shadow-xl
              dark:bg-gray-800/90 dark:border-gray-700 dark:shadow-black/40
              animate-fade-in z-50
            "
                      sideOffset={5}
                    >
                      Este sistema está em desenvolvimento. Algumas funções
                      podem sofrer ajustes.
                      <Popover.Arrow className="fill-white dark:fill-gray-800" />
                    </Popover.Content>
                  </Popover.Portal>
                </Popover.Root>
              </div>

              {/* DESCRIÇÃO */}
              <p
                className="
        text-gray-700 dark:text-gray-300 
        max-w-2xl mx-auto 
        text-[15px] leading-relaxed 
        animate-fade-in-slow
        text-justify
        hyphens-auto
        break-words
      "
              >
                Transforme negociação em resultados! Aqui você encontra
                ferramentas poderosas para localizar clientes, acompanhar
                desempenho, visualizar acordos e muito mais. Digite{" "}
                <span className="font-semibold text-orange-600 dark:text-orange-300">
                  @
                </span>
                para descobrir todos os comandos disponíveis.
              </p>
            </div>

            <div className="grid w-full max-w-7xl items-start gap-6 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
            {/* RESULTADO DO OPERADOR */}
            {username ? (
              <aside id="Resultado" className="w-full lg:sticky lg:top-6">
                <div
                  className="
          relative overflow-hidden bg-gradient-to-br from-white/90 via-blue-50/75 to-orange-50/60
          dark:from-slate-950/90 dark:via-blue-950/60 dark:to-slate-950/90
          backdrop-blur-xl rounded-3xl
          border border-blue-200/70 dark:border-blue-800/60
          p-5 shadow-[0_22px_60px_-35px_rgba(30,64,175,.8)]
          transition-all hover:shadow-[0_26px_70px_-38px_rgba(249,115,22,.75)] animate-fade-in
        "
                >
                  <div className="pointer-events-none absolute -left-16 -top-16 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl" />
                  <div className="pointer-events-none absolute -right-16 top-24 h-36 w-36 rounded-full bg-orange-500/10 blur-3xl" />
                  <div className="relative mb-5 flex items-start justify-between gap-3 border-b border-blue-200/60 pb-4 dark:border-blue-800/50">
                    <div>
                      <span className="mb-2 inline-flex rounded-full border border-orange-300/60 bg-orange-100/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-orange-700 dark:bg-orange-950/50 dark:text-orange-300">
                        Painel do operador
                      </span>
                      <h2 className="text-lg font-semibold leading-snug text-slate-800 dark:text-slate-100">
                        <span className="block font-black text-blue-700 dark:text-blue-300">{username}</span>
                      </h2>
                    </div>
                    <button
                      onClick={() => setShowEstatisticaModal(true)}
                      className="rounded-xl border border-blue-200 bg-white/70 p-2.5 text-blue-700 transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
                      aria-label="Abrir estatísticas detalhadas"
                    >
                      <ClipboardList className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="relative">
                    <UserInsights {...userInsightsData} />
                  </div>
                </div>
              </aside>
            ) : (
              <aside className="rounded-3xl border border-orange-300/40 bg-orange-50/60 p-5 text-sm text-orange-800 dark:border-orange-800/50 dark:bg-orange-950/20 dark:text-orange-200">
                Não foi possível identificar o operador desta sessão.
              </aside>
            )}

            {/* COMANDOS */}
            <div
              id="Comandos"
              className="
                w-full min-w-0
                bg-white/60 dark:bg-gray-900/40 
                backdrop-blur-xl rounded-2xl shadow-lg 
                border border-white/20 dark:border-gray-700
                p-10 animate-fade-in z-10
              "
            >
              <div className="flex flex-col items-center">
                <h2
                  className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-6
                                md:text-2xl"
                >
                  Central de Comandos
                </h2>

                <SearchBar
                  onSearch={handleSearch}
                  onIACommand={handleIACommand}
                  onResultsCommand={handleResultsCommand}
                  onAuditoriaCommand={handleAuditoriaCommand}
                  onPendentesCommand={handlePendentesCommand}
                  onPlanilhasCommand={handlePlanilhasCommand}
                  onAcordosCommand={handleAcordosCommand}
                  onDeltaCommand={handleDeltaCommand}
                  onFeedbacksCommand={handleFeedbacksCommand}
                  onFeedbackCreationCommand={
                    podeAcessarMonitoria
                      ? handleFeedbackCreationCommand
                      : undefined
                  }
                  onPortalCommand={handlePortalCommand}
                  onInfoClienteCommand={handleInfoClienteCommand}
                  onAnotacaoCommand={handleAnotacaoCommand}
                  onAgendamentoCommand={handleAgendamentoCommand}
                  onToDoCommand={handleToDoCommand}
                  onChatFullTimeCommand={handleChatFullTimeCommand}
                  onAcademiaCommand={handleAcademiaCommand}
                  onRoteiroCommand={handleRoteiroCommand}
                  onRoteiroAdmCommand={
                    commandAccess.quality ? handleRoteiroAdmCommand : undefined
                  }
                  onConsultarContratoCommand={handleConsultarContratoCommand}
                  onGerarLinkPDFCommand={handleGerarLinkPDFCommand}
                  onCampanhaCommand={handleCampanhaCommand}
                  onEnvioBoletoCommand={handleEnvioBoletoCommand}
                  onAcionamentoCommand={handleAcionamentoCommand}
                  onArenaCommand={handleArenaCommand}
                  onTabulacoesCommand={handleTabulacoesCommand}
                  onPesquisaCommand={handlePesquisaCommand}
                  onPesquisaNaoPagamentoCommand={
                    handlePesquisaNaoPagamentoCommand
                  }
                  onScriptDeltaCommand={handleScriptDeltaCommand}
                  onScriptGamaCommand={handleScriptGamaCommand}
                  onChecklistCommand={handleChecklistCommand}
                  isSearching={isSearching}
                />

                {error && (
                  <div
                    className="
                      mt-4 p-4 bg-red-200/40 dark:bg-red-900/30 
                      text-red-800 dark:text-red-300 
                      rounded-lg border border-red-400/40 dark:border-red-900
                      w-full max-w-2xl animate-fade-in
                    "
                  >
                    {error}
                  </div>
                )}

                <div className="mt-8 w-full">
                  <div className="border-t border-gray-300 dark:border-gray-700 pt-6">
                    <div className="text-center text-gray-600 dark:text-gray-300">
                      <p className="mb-2">
                        Use comandos com @ para acessar funções do sistema.
                      </p>

                      <p className="text-sm opacity-75">
                        Comandos disponíveis: @IA, @Resultados, @Anotação,
                        @Agendamento, @Tarefas, @Pendentes,
                        @planilhas, @Acordos, @Academia, @Arena, @Feedbacks
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </div>
          </div>
        </main>
        )}

        <footer
          className="
    hidden
    relative 
    bg-white/70 dark:bg-gray-900/40 
    backdrop-blur-xl
    border-t border-gray-200 dark:border-gray-700 
    shadow-[0_-4px_12px_rgba(0,0,0,0.06)]
    dark:shadow-[0_-4px_18px_rgba(0,0,0,0.45)]
    py-6 
    transition-colors duration-300
    z-9
  "
        >
          {/* Linha luminosa superior */}
          <div
            className="
      absolute top-0 left-0 w-full h-[2px]
      bg-gradient-to-r 
      from-primary/60 via-orange-400/70 to-yellow-300/60 
      dark:from-orange-300/40 dark:via-yellow-200/40 dark:to-white/30
      animate-pulse
      opacity-70
    "
          />

          <div className="container mx-auto px-4 -z-10">
            <div className="text-center text-gray-600 dark:text-gray-300 text-sm tracking-wide">
              <p className="opacity-90 hover:opacity-100 transition-opacity">
                &copy; {new Date().getFullYear()}{" "}
                <span className="font-semibold">Sistema do Grupo Acme</span>.
                Todos os direitos reservados.
              </p>

              {/* Linha inferior com brilho suave */}
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Versão 2.0 •
              </p>
            </div>
          </div>
        </footer>
      </div>
          {alertaAgendamento && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-2xl max-w-lg w-full text-center animate-pulse border-4 border-red-600">
            <Clock className="h-12 w-12 text-red-600 mx-auto mb-4 animate-bounce" />
            <h2 className="text-2xl font-bold text-red-600 mb-2">
              ⚠️ Retorno Pendente!
            </h2>
            <p className="text-lg text-gray-800 dark:text-gray-200">
              Você precisa retornar agora para:
            </p>
            <p className="mt-3 font-semibold text-xl text-gray-900 dark:text-white">
              {alertaAgendamento.nome} ({alertaAgendamento.cpf})
            </p>
            <p className="text-gray-500 dark:text-gray-400">
              EC: {alertaAgendamento.ec}
            </p>
            <p className="mt-2 text-orange-600 font-medium">
              Horário agendado:{" "}
              {new Date(alertaAgendamento.horario_retorno).toLocaleString(
                "pt-BR",
              )}
            </p>

            <button
              onClick={() => setAlertaAgendamento(null)}
              className="mt-6 px-6 py-3 bg-red-600 text-white rounded-lg shadow-lg hover:bg-red-700 transition"
            >
              Fechar Alerta
            </button>
          </div>
        </div>
      )}

      {/* Modais fora da main page */}
      <CustomerModal
        customer={customer}
        isOpen={showModal}
        onClose={closeModal}
      />
      <ChatModal isOpen={showChatModal} onClose={closeChatModal} />
      <ResultsModal isOpen={showResultsModal} onClose={closeResultsModal} />
      <AuditoriaModal
        isOpen={showAuditoriaModal}
        onClose={() => setShowAuditoriaModal(false)}
      />
      <PendentesModal
        isOpen={showPendentesModal}
        onClose={closePendentesModal}
      />
      <PlanilhasModal
        isOpen={showPlanilhasModal}
        onClose={closePlanilhasModal}
      />
      <AcordosOperador isOpen={showAcordosModal} onClose={closeAcordosModal} />
      <DeltaModal
        isOpen={showDeltaModal}
        onClose={closeDeltaModal}
      />
      <AcademiaModal
        isOpen={showAcademiaModal}
        onClose={() => setShowAcademiaModal(false)}
      />
      <QuizModal isOpen={showQuizModal} onClose={closeQuizModal} />
      <SimulacaoModal
        isOpen={showSimulacaoModal}
        onClose={closeSimulacaoModal}
      />
      <QuizNotificationPopup
        isOpen={showQuizNotification}
        onClose={() => setShowQuizNotification(false)}
        onOpenQuiz={() => {
          setShowQuizNotification(false); // Fecha a notificação
          handleQuizCommand(); // Abre o modal completo do Quiz
        }}
      />
      <FeedbacksModal
        isOpen={showFeedbacksModal}
        onClose={closeFeedbacksModal}
      />
      <FeedbackCreationModal
        isOpen={showFeedbackCreationModal}
        onClose={() => setShowFeedbackCreationModal(false)}
      />
      <PortalModal isOpen={showPortalModal} onClose={closePortalModal} />
      <AnotacaoModal isOpen={showAnotacaoModal} onClose={closeAnotacaoModal} />
      <AgendamentoModal
        isOpen={showAgendamentooModal}
        onClose={closeAgendamentoModal}
      />
      <TodoModal isOpen={showToDoModal} onClose={closeToDoModal} />
      <ChatFullTime
        isOpen={showChatFullTimeModal}
        onClose={closeChatFullTimeModal}
      />
      <TreinamentoModal
        isOpen={showTreinamentoModal}
        onClose={closeTreinamentoModal}
      />
      <RoteiroModal isOpen={showRoteiroModal} onClose={closeRoteiroModal} />
      <RoteiroAdmModal
        isOpen={showRoteiroAdmModal}
        onClose={closeRoteiroAdmModal}
      />
      <ConsultarContratoModal
        isOpen={showConsultarContratoModal}
        onClose={closeConsultarContratoModal}
      />
      <AnalyticsModal
        isOpen={showAnalyticsModal}
        onClose={() => setShowAnalyticsModal(false)}
      />
      <GerarLinkPDFModal
        isOpen={showGerarLinkPDFModal}
        onClose={closeGerarLinkPDFModal}
      />
      <CampanhaModal isOpen={showCampanhaModal} onClose={closeCampanhaModal} />
      <EnvioBoletoModal
        isOpen={showEnvioBoletoModal}
        onClose={closeEnvioBoletoModal}
      />
      {/* <ChristmasTreeModal
        isOpen={showChristmasModal}
        onClose={closeChristmasModal}
      /> */}
      <AcionamentoModal
        isOpen={showAcionamentoModal}
        onClose={closeAcionamentoModal}
      />
      <ArenaModal
        isOpen={showArenaModal}
        onClose={closeArenaModal}
      />

      {/* Partida de mentira do tour: não fala com a API nem pontua. */}
      <TreinoBingo aberto={treinoBingoAberto} aoFechar={fecharTreinoBingo} />

      <FeedbackFinal aberto={feedbackAberto} aoFechar={fecharFeedback} />

      <TabulacoesModal
        isOpen={showTabulacoesModal}
        onClose={closeTabulacoesModal}
      />

      <EstatisticaModal
        isOpen={showEstatisticaModal}
        onClose={closeEstatisticaModal}
      />
      <PesquisaPortabilidadeModal
        isOpen={showPesquisaModal}
        onClose={closePesquisaModal}
      />
      <PesquisaNaoPagamentoModal
        isOpen={showPesquisaNaoPagamentoModal}
        onClose={closePesquisaNaoPagamentoModal}
      />
      <ScriptAtendimentoModal
        isOpen={showScriptDeltaModal}
        onClose={closeScriptDeltaModal}
      />
      <ScriptAtendimentoGamaModal
        isOpen={showScriptGamaModal}
        onClose={closeScriptGamaModal}
      />
      <ChecklistModal
        isOpen={showChecklistModal}
        onClose={closeChecklistModal}
      />
    </OperatorDataProvider>
  );
};

export default Index;


