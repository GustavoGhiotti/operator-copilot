import React, { useCallback, useRef, useState, useContext } from "react";
import Header from "../components/Header";
import { useNavigate } from "react-router-dom";
import SearchBar from "../components/SearchBar";
import CustomerModal from "../components/CustomerModal";
import ChatModal from "../components/ChatModal";
import MatriculasModal from "@/components/MatriculasModal";
import AcordosOperador from "@/components/AcordoOperador";
import FeedbackCreationModal from "@/components/FeedbackCreationModal";
import CriarTabulacaoModal from "@/components/CriarTabulacao";
import { SearchContext } from "@/context/SearchContext";
import SupervisorPasswordResetModal from "@/components/SupervisorPasswordResetModal";
import AcessosModal from "@/components/AcessosModal";
import BaseConhecimentoIAModal from "@/components/BaseConhecimentoIAModal";
import SupervisorGoalsModal from "@/components/SupervisorGoalsModal";
import SupervisorOperatorMonitoringModal from "@/components/SupervisorOperatorMonitorModal";
import QuizQualidadeModal from "@/components/QuizQualidadeModal";
import QuizAnaliseModal from "@/components/QuizAnaliseModal";
import SimulacaoQualidadeModal from "@/components/SimulacaoQualidadeModal";
import PremiacaoModal from "@/components/PremiacaoModal";
import AnotacaoModal from "@/components/AnotacaoModal";
import ChatFullTime from "@/components/ChatFullTime";
import InsightModal from "@/components/InsightModal";
import { PontuacaoModal } from "@/components/CampanhaPontuacao";
import GiftsTable from "@/components/GiftsTable";
import EnvioBoletoModal from "@/components/EnvioBoletoModal";
import PesquisaPortabilidadeModal from "@/components/PesquisaPortabilidade";
import AuroraInsightModal from "@/components/AuroraInsightModal";
import AuditoriaModal from "@/modules/auditoria/components/AuditoriaModal";
import {
  getAdminCommandAccess,
  getAvailableAdminCommandLabels,
} from "@/utils/adminCommandAccess";
import AuroraStage from "@/components/AuroraStage";
import type { ControleBusca } from "@/components/SearchBar";
import { useTourDaHome } from "@/tour/useTourDaHome";
import TreinoBingo from "@/tour/TreinoBingo";
import FeedbackFinal from "@/tour/FeedbackFinal";
import AcademiaGestaoModal from "@/components/AcademiaGestaoModal";
import TodoModal from "@/components/TodoModal";
import ArenaModal from "@/components/ArenaModal";
import AnalyticsModal from "@/components/AnalyticsModal";

import * as Popover from "@radix-ui/react-popover";
import { Info } from "lucide-react";

import RoteiroAdmModal from "@/components/RoteiroVegaAdm";

const ALBUM_EXTERNAL_URL = "http://album.empresa.local/login";

const IndexAdmin = () => {
  const navigate = useNavigate();
  const legacyHomeEnabled =
    import.meta.env.VITE_ENABLE_LEGACY_HOME === "true";
  const commandAccess = getAdminCommandAccess(
    localStorage.getItem("centroCusto"),
    localStorage.getItem("funcao"),
  );
  const availableCommandLabels = getAvailableAdminCommandLabels(
    localStorage.getItem("centroCusto"),
    localStorage.getItem("funcao"),
  );
  const {
    isSearching,
    handleSearch,
    error,
  } = useContext(SearchContext);

  const [showModal, setShowModal] = useState(false);
  const [showAcordosModal, setShowAcordosModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [showAuditoriaModal, setShowAuditoriaModal] = useState(false);
  const [showMatriculasModal, setShowMatriculasModal] = useState(false);
  const [
    showSupervisorPasswordResetModal,
    setShowSupervisorPasswordResetModal,
  ] = useState(false);
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [showQuizQualidadeModal, setShowQuizQualidadeModal] = useState(false);
  const [showQuizAnaliseModal, setShowQuizAnaliseModal] = useState(false);
  const [showSimulacaoQualidadeModal, setshowSimulacaoQualidadeModal] =
    useState(false);
  const [showFeedbackCreationModal, setShowFeedbackCreationModal] =
    useState(false);
  const [showCriarTabulacaoModal, setShowCriarTabulacaoModal] =
    useState(false);
  const [showPremiacaoModal, setShowPremiacaoModal] = useState(false);
  const [showRoteiroModal, setShowRoteiroModal] = useState(false);
  const [showAnotacaoModal, setShowAnotacaoModal] = useState(false);
  const [showChatFullTimeoModal, setShowChatFullTimeModal] = useState(false);
  const [showGiftsTable, setShowGiftsTable] = useState(false);
  const [showEnvioBoletoModal, setShowEnvioBoletoModal] = useState(false);
  const [showPesquisaModal, setShowPesquisaModal] = useState(false);
  const [showAuroraInsight, setShowAuroraInsight] = useState(false);
  const [showAcademiaGestao, setShowAcademiaGestao] = useState(false);
  const [showToDoModal, setShowToDoModal] = useState(false);
  const [showArenaModal, setShowArenaModal] = useState(false);
  const [showAcessosModal, setShowAcessosModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [showBaseConhecimentoModal, setShowBaseConhecimentoModal] =
    useState(false);

  // Supervisores caem nesta tela (is_admin inclui "supervisor(a) de
  // operacoes"), entao o tour precisa existir aqui — nao so em /home.
  const controleBusca = useRef<ControleBusca | null>(null);
  const aoMontarControleBusca = useCallback(
    (controle: ControleBusca | null) => {
      controleBusca.current = controle;
    },
    [],
  );
  const fecharModaisDoTour = useCallback(() => {
    setShowToDoModal(false);
    setShowArenaModal(false);
    setShowAcademiaGestao(false);
  }, []);
  const {
    iniciarTour,
    treinoBingoAberto,
    fecharTreinoBingo,
    feedbackAberto,
    fecharFeedback,
  } = useTourDaHome({ controleBusca, fecharModais: fecharModaisDoTour });

  const handleIACommand = () => {
    setShowChatModal(true);
  };

  const handleMatriculasCommand = () => {
    setShowMatriculasModal(true);
  };

  const handleAcordosCommand = () => {
    setShowAcordosModal(true);
  };

  const handlePasswordResetCommand = () => {
    setShowSupervisorPasswordResetModal(true);
  };

  const handleBaseConhecimentoCommand = () => {
    setShowBaseConhecimentoModal(true);
  };

  const handleAcessosCommand = () => {
    setShowAcessosModal(true);
  };

  const handleIdealCommand = () => {
    setShowGoalsModal(true);
  };


  const handleQuizQualidadeCommand = () => {
    setShowQuizQualidadeModal(true);
  };

  const handleQuizAnaliseCommand = () => {
    setShowQuizAnaliseModal(true);
  };

  const handleSimulacaoCommand = () => {
    setshowSimulacaoQualidadeModal(true);
  };

  const handleAuditoriaCommand = () => {
    setShowAuditoriaModal(true);
  };

  const handleFeedbackCreationCommand = () => {
    setShowFeedbackCreationModal(true);
  };

   const handleCriarTabulacaoCommand = () => {
    setShowCriarTabulacaoModal(true);
  };

  const handlePremiacaoCommand = () => {
    setShowPremiacaoModal(true);
  };

  const handleRoteiroCommand = () => {
    setShowRoteiroModal(true);
  };

  const handleAnotacaoCommand = () => {
    setShowAnotacaoModal(true);
  };

  const handleChatFullTimeCommand = () => {
    setShowChatFullTimeModal(true);
  };



  const handleEnvioBoletoCommand = () => {
    setShowEnvioBoletoModal(true);
  };

  const handlePesquisaCommand = () => {
    setShowPesquisaModal(true);
  };

  const handleAuroraInsightCommand = () => {
    setShowAuroraInsight(true);
  };

  const handleAcademiaQualidadeCommand = () => {
    setShowAcademiaGestao(true);
  };

  const handleToDoCommand = () => {
    setShowToDoModal(true);
  };

  const handleGestaoCommand = () => {
    // A Central de Gestao saiu de /gerente: aquela rota agora e a home da
    // gerencia, com o painel de comandos.
    navigate("/gerente/central");
  };

  const handleResultadosCommand = () => {
    navigate("/gerente/resultados");
  };

  const handleArenaCommand = () => {
    setShowArenaModal(true);
  };

  const handleAnalyticsCommand = () => {
    setShowAnalyticsModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
  };

  const closeChatModal = () => {
    setShowChatModal(false);
  };

  const closeMatriculasModal = () => {
    setShowMatriculasModal(false);
  };

  const closeAcordosModal = () => {
    setShowAcordosModal(false);
  };

  const closeGoalsModal = () => {
    setShowGoalsModal(false);
  };

  const closeSimulacaoModal = () => {
    setshowSimulacaoQualidadeModal(false);
  };

  const closeRoteiroModal = () => {
    setShowRoteiroModal(false);
  };

  const closeAnotacaoModal = () => {
    setShowAnotacaoModal(false);
  };

  const closeChatFullTimeModal = () => {
    setShowChatFullTimeModal(false);
  };



  const closeGiftsTable = () => {
    setShowGiftsTable(false);
  };

  const closeEnvioBoletoModal = () => {
    setShowEnvioBoletoModal(false);
  };

  const closePesquisaModal = () => {
    setShowPesquisaModal(false);
  };

  const closeAuroraInsightModal = () => {
    setShowAuroraInsight(false);
  };

  return (
    <>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col transition-colors duration-200">
        <Header
          visualVariant="aurora"
          onChristmasClick={() => setShowGiftsTable(true)}
          onAlbumClick={() => {
            window.open(ALBUM_EXTERNAL_URL, "_blank", "noopener,noreferrer");
          }}
        />

        <AuroraStage>
          <SearchBar
            onSearch={handleSearch}
            onIACommand={commandAccess.supervision ? handleIACommand : undefined}
            onMatriculasCommand={
              commandAccess.supervision ? handleMatriculasCommand : undefined
            }
            onAcordosCommand={
              commandAccess.supervision ? handleAcordosCommand : undefined
            }
            onPasswordResetCommand={
              commandAccess.password ? handlePasswordResetCommand : undefined
            }
            onAcessosCommand={
              commandAccess.acessos ? handleAcessosCommand : undefined
            }
            onBaseConhecimentoCommand={
              commandAccess.baseConhecimento
                ? handleBaseConhecimentoCommand
                : undefined
            }
            onIdealCommand={
              commandAccess.supervision ? handleIdealCommand : undefined
            }
            onQuizQualidadeCommand={
              commandAccess.quality ? handleQuizQualidadeCommand : undefined
            }
            onAcademiaQualidadeCommand={
              commandAccess.quality
                ? handleAcademiaQualidadeCommand
                : undefined
            }
            onQuizAnaliseCommand={
              commandAccess.quality ? handleQuizAnaliseCommand : undefined
            }
            onSimulacaoQualidadeCommand={
              commandAccess.quality ? handleSimulacaoCommand : undefined
            }
            onAuditoriaCommand={
              commandAccess.supervision || commandAccess.quality
                ? handleAuditoriaCommand
                : undefined
            }
            onFeedbackCreationCommand={
              commandAccess.monitoria
                ? handleFeedbackCreationCommand
                : undefined
            }
            onCriarTabulacaoCommand={
              commandAccess.quality ? handleCriarTabulacaoCommand : undefined
            }
            onPremiacaoCommand={
              commandAccess.quality ? handlePremiacaoCommand : undefined
            }
            onRoteiroCommand={
              commandAccess.supervision ? handleRoteiroCommand : undefined
            }
            onRoteiroAdmCommand={
              commandAccess.quality ? handleRoteiroCommand : undefined
            }
            onAnotacaoCommand={
              commandAccess.supervision ? handleAnotacaoCommand : undefined
            }
            onChatFullTimeCommand={
              commandAccess.supervision ? handleChatFullTimeCommand : undefined
            }
            onEnvioBoletoCommand={
              commandAccess.supervision ? handleEnvioBoletoCommand : undefined
            }
            onPesquisaCommand={
              commandAccess.supervision ? handlePesquisaCommand : undefined
            }
            onAuroraInsightCommand={
              commandAccess.auroraInsight
                ? handleAuroraInsightCommand
                : undefined
            }
            onToDoCommand={
              commandAccess.tasks ? handleToDoCommand : undefined
            }
            onGestaoCommand={
              commandAccess.management ? handleGestaoCommand : undefined
            }
            onResultadosCommand={
              commandAccess.results ? handleResultadosCommand : undefined
            }
            onArenaCommand={
              commandAccess.arena ? handleArenaCommand : undefined
            }
            onConsultarContratoCommand={
              commandAccess.toolAnalytics ? handleAnalyticsCommand : undefined
            }
            onTourCommand={iniciarTour}
            aoMontarControle={aoMontarControleBusca}
            placeholderText="Digite @ para acessar os comandos..."
            visualVariant="holographic"
            featuredCommands={availableCommandLabels.slice(0, 3)}
            isSearching={isSearching}
          />
          {error && (
            <div className="mx-auto mt-4 w-full max-w-2xl rounded-xl border border-red-300/25 bg-red-950/55 p-3 text-center text-sm text-red-100 backdrop-blur-xl">
              {error}
            </div>
          )}
        </AuroraStage>

        {legacyHomeEnabled && (
        <main className="flex-1 flex flex-col">
          <div className="container mx-auto px-4 py-8 flex flex-col items-center">
            <div className="w-full max-w-4xl mb-8 text-center">
              <h1
                id="Welcome"
                className="text-2xl md:text-3xl font-semibold text-gray-800 dark:text-gray-100 mb-2"
              >
                Copilot <span className="text-primary">Grupo Acme</span>
              </h1>

              <div
                id="beta-tag"
                className="inline-block px-3 py-1 text-xs font-semibold text-orange-800 bg-orange-100 dark:text-orange-200 dark:bg-orange-900 rounded-full animate-pulse"
              >
                Beta - Em desenvolvimento
              </div>

              <Popover.Root>
                <Popover.Trigger asChild>
                  <button
                    className="text-orange-600 hover:text-orange-800 dark:text-orange-300 ml-2"
                    aria-label="Mais informações"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content
                    className="rounded-lg p-3 text-sm max-w-xs bg-white border border-gray-200 shadow-lg dark:bg-gray-800 dark:text-white dark:border-gray-600 z-50"
                    sideOffset={5}
                  >
                    Este sistema está em fase de desenvolvimento. Algumas
                    funcionalidades podem ser ajustadas ou alteradas nos
                    próximos dias.
                    <Popover.Arrow className="fill-white dark:fill-gray-800" />
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>

              <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                Acompanhe a performance da equipe, monitore metas em tempo real,
                gerencie pendências e visualize resultados por operador ou
                carteira. Use os comandos com <code>@</code> para acessar
                funcionalidades avançadas de supervisão.
              </p>
            </div>

            <div
              id="Comandos"
              className="w-full max-w-4xl bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 transition-colors duration-200"
            >
              <div className="flex flex-col items-center">
                <h2 className="text-xl font-medium text-gray-800 dark:text-gray-100 mb-6">
                  Central de Comandos
                </h2>

                <SearchBar
                  onSearch={handleSearch}
                  onIACommand={
                    commandAccess.supervision ? handleIACommand : undefined
                  }
                  onMatriculasCommand={
                    commandAccess.supervision
                      ? handleMatriculasCommand
                      : undefined
                  }
                  onAcordosCommand={
                    commandAccess.supervision ? handleAcordosCommand : undefined
                  }
                  onPasswordResetCommand={
                    commandAccess.password
                      ? handlePasswordResetCommand
                      : undefined
                  }
                  onAcessosCommand={
                    commandAccess.acessos ? handleAcessosCommand : undefined
                  }
                  onBaseConhecimentoCommand={
                    commandAccess.baseConhecimento
                      ? handleBaseConhecimentoCommand
                      : undefined
                  }
                  onIdealCommand={
                    commandAccess.supervision ? handleIdealCommand : undefined
                  }
                  onQuizQualidadeCommand={
                    commandAccess.quality
                      ? handleQuizQualidadeCommand
                      : undefined
                  }
                  onAcademiaQualidadeCommand={
                    commandAccess.quality
                      ? handleAcademiaQualidadeCommand
                      : undefined
                  }
                  onQuizAnaliseCommand={
                    commandAccess.quality ? handleQuizAnaliseCommand : undefined
                  }
                  onSimulacaoQualidadeCommand={
                    commandAccess.quality ? handleSimulacaoCommand : undefined
                  }
                  onAuditoriaCommand={
                    commandAccess.supervision || commandAccess.quality
                      ? handleAuditoriaCommand
                      : undefined
                  }
                  onFeedbackCreationCommand={
                    commandAccess.monitoria
                      ? handleFeedbackCreationCommand
                      : undefined
                  }
                  onCriarTabulacaoCommand={
                    commandAccess.quality
                      ? handleCriarTabulacaoCommand
                      : undefined
                  }
                  onPremiacaoCommand={
                    commandAccess.quality ? handlePremiacaoCommand : undefined
                  }
                  onRoteiroCommand={
                    commandAccess.supervision ? handleRoteiroCommand : undefined
                  }
                  onRoteiroAdmCommand={
                    commandAccess.quality ? handleRoteiroCommand : undefined
                  }
                  onAnotacaoCommand={
                    commandAccess.supervision ? handleAnotacaoCommand : undefined
                  }
                  onChatFullTimeCommand={
                    commandAccess.supervision
                      ? handleChatFullTimeCommand
                      : undefined
                  }
                  onEnvioBoletoCommand={
                    commandAccess.supervision
                      ? handleEnvioBoletoCommand
                      : undefined
                  }
                  onPesquisaCommand={
                    commandAccess.supervision ? handlePesquisaCommand : undefined
                  }
                  onAuroraInsightCommand={
                    commandAccess.auroraInsight
                      ? handleAuroraInsightCommand
                      : undefined
                  }
                  onToDoCommand={
                    commandAccess.tasks ? handleToDoCommand : undefined
                  }
                  onGestaoCommand={
                    commandAccess.management ? handleGestaoCommand : undefined
                  }
                  onArenaCommand={
                    commandAccess.arena ? handleArenaCommand : undefined
                  }
                  onConsultarContratoCommand={
                    commandAccess.toolAnalytics
                      ? handleAnalyticsCommand
                      : undefined
                  }
                  isSearching={isSearching}
                />

                {error && (
                  <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg border border-red-100 dark:border-red-900/30 w-full max-w-2xl animate-fade-in">
                    {error}
                  </div>
                )}

                <div className="mt-8 w-full">
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                    <div className="text-center text-gray-600 dark:text-gray-300">
                      <p className="mb-2">
                        Use comandos com @ para acessar funções do sistema.
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Comandos disponíveis:{" "}
                        {availableCommandLabels.join(", ")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
        )}

        <footer className="hidden bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-6 transition-colors duration-200">
          <div className="container mx-auto px-4">
            <div className="text-center text-gray-500 dark:text-gray-400 text-sm">
              <p>
                &copy; {new Date().getFullYear()} Sistema do Grupo Acme. Todos
                os direitos reservados.
              </p>
            </div>
          </div>
        </footer>
      </div>

      <CustomerModal
        isOpen={showModal}
        onClose={closeModal}
      />
      <ChatModal isOpen={showChatModal} onClose={closeChatModal} />
      <AuditoriaModal
        isOpen={showAuditoriaModal}
        onClose={() => setShowAuditoriaModal(false)}
      />
      <MatriculasModal
        isOpen={showMatriculasModal}
        onClose={closeMatriculasModal}
      />
      <AcordosOperador isOpen={showAcordosModal} onClose={closeAcordosModal} />
      <AcessosModal
        isOpen={showAcessosModal}
        onClose={() => setShowAcessosModal(false)}
      />
      <BaseConhecimentoIAModal
        isOpen={showBaseConhecimentoModal}
        onClose={() => setShowBaseConhecimentoModal(false)}
      />
      <SupervisorPasswordResetModal
        isOpen={showSupervisorPasswordResetModal}
        onClose={() => setShowSupervisorPasswordResetModal(false)}
      />
      <SupervisorGoalsModal isOpen={showGoalsModal} onClose={closeGoalsModal} />
      <QuizQualidadeModal
        isOpen={showQuizQualidadeModal}
        onClose={() => setShowQuizQualidadeModal(false)}
      />
      <QuizAnaliseModal
        isOpen={showQuizAnaliseModal}
        onClose={() => setShowQuizAnaliseModal(false)}
      />
      <SimulacaoQualidadeModal
        isOpen={showSimulacaoQualidadeModal}
        onClose={() => setshowSimulacaoQualidadeModal(false)}
      />
      <FeedbackCreationModal
        isOpen={showFeedbackCreationModal}
        onClose={() => setShowFeedbackCreationModal(false)}
      />
      <CriarTabulacaoModal
        isOpen={showCriarTabulacaoModal}
        onClose={() => setShowCriarTabulacaoModal(false)}
      />

      <PremiacaoModal
        isOpen={showPremiacaoModal}
        onClose={() => setShowPremiacaoModal(false)}
      />
      <RoteiroAdmModal isOpen={showRoteiroModal} onClose={closeRoteiroModal} />
      <GiftsTable isOpen={showGiftsTable} onClose={closeGiftsTable} />
      <AnotacaoModal isOpen={showAnotacaoModal} onClose={closeAnotacaoModal} />
      <ChatFullTime
        isOpen={showChatFullTimeoModal}
        onClose={closeChatFullTimeModal}
      />
      <EnvioBoletoModal
        isOpen={showEnvioBoletoModal}
        onClose={closeEnvioBoletoModal}
      />
      <PesquisaPortabilidadeModal
        isOpen={showPesquisaModal}
        onClose={closePesquisaModal}
      />
      <AuroraInsightModal
        isOpen={showAuroraInsight}
        onClose={closeAuroraInsightModal}
      />
      <AcademiaGestaoModal
        isOpen={showAcademiaGestao}
        onClose={() => setShowAcademiaGestao(false)}
      />
      <TodoModal
        isOpen={showToDoModal}
        onClose={() => setShowToDoModal(false)}
      />
      <ArenaModal
        isOpen={showArenaModal}
        onClose={() => setShowArenaModal(false)}
      />
      <AnalyticsModal
        isOpen={showAnalyticsModal}
        onClose={() => setShowAnalyticsModal(false)}
      />

      <TreinoBingo aberto={treinoBingoAberto} aoFechar={fecharTreinoBingo} />
      <FeedbackFinal aberto={feedbackAberto} aoFechar={fecharFeedback} />
    </>
  );
};

export default IndexAdmin;

