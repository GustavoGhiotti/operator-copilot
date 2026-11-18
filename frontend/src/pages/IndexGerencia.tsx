import { useCallback, useContext, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import Header from "@/components/Header";
import AuroraStage from "@/components/AuroraStage";
import SearchBar from "@/components/SearchBar";
import type { ControleBusca } from "@/components/SearchBar";
import { SearchContext } from "@/context/SearchContext";

import AcademiaGestaoModal from "@/components/AcademiaGestaoModal";
import AcessosModal from "@/components/AcessosModal";
import AcordosOperador from "@/components/AcordoOperador";
import ArenaModal from "@/components/ArenaModal";
import AnalyticsModal from "@/components/AnalyticsModal";
import ChatModal from "@/components/ChatModal";
import CriarTabulacaoModal from "@/components/CriarTabulacao";
import FeedbackCreationModal from "@/components/FeedbackCreationModal";
import PremiacaoModal from "@/components/PremiacaoModal";
import QuizAnaliseModal from "@/components/QuizAnaliseModal";
import QuizQualidadeModal from "@/components/QuizQualidadeModal";
import RoteiroAdmModal from "@/components/RoteiroVegaAdm";
import AuroraInsightModal from "@/components/AuroraInsightModal";
import SimulacaoQualidadeModal from "@/components/SimulacaoQualidadeModal";
import SupervisorGoalsModal from "@/components/SupervisorGoalsModal";
import SupervisorPasswordResetModal from "@/components/SupervisorPasswordResetModal";
import TodoModal from "@/components/TodoModal";
import AuditoriaModal from "@/modules/auditoria/components/AuditoriaModal";

import FeedbackFinal from "@/tour/FeedbackFinal";
import TreinoBingo from "@/tour/TreinoBingo";
import { useTourDaHome } from "@/tour/useTourDaHome";

import {
  getAdminCommandAccess,
  getAvailableAdminCommandLabels,
} from "@/utils/adminCommandAccess";

const ALBUM_EXTERNAL_URL = "http://album.empresa.local/login";

/**
 * Home da gerência.
 *
 * Existe porque a Central de Gestão e os Resultados Operacionais são telas
 * cheias, sem painel de comandos: mandar o gerente direto para uma delas o
 * deixava sem @Senhas, @Arena, @Tour e sem a busca de cliente. A Central passa
 * a ser um destino (@Gestão), não o lugar onde ele mora.
 *
 * Não reaproveita o IndexAdmin de propósito: aquela é a tela do supervisor,
 * com ~20 modais de operação que a gerência não abre. Aqui entra só o que a
 * gerência usa, e é onde a visão dela cresce.
 */
const IndexGerencia = () => {
  const navigate = useNavigate();
  const { isSearching, handleSearch, error } = useContext(SearchContext);

  const commandAccess = getAdminCommandAccess(
    localStorage.getItem("centroCusto"),
    localStorage.getItem("funcao"),
  );
  const availableCommandLabels = getAvailableAdminCommandLabels(
    localStorage.getItem("centroCusto"),
    localStorage.getItem("funcao"),
  );

  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
  const [showAcessosModal, setShowAcessosModal] = useState(false);
  const [showArenaModal, setShowArenaModal] = useState(false);
  const [showToDoModal, setShowToDoModal] = useState(false);
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [showAuditoriaModal, setShowAuditoriaModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [showAcordosModal, setShowAcordosModal] = useState(false);
  const [showAuroraInsight, setShowAuroraInsight] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);

  // Comandos de qualidade. Nao estavam aqui porque a pagina nasceu para a
  // gerencia pura, mas a rota olha `gerencia.gestao` antes de `is_admin`
  // (Login.tsx): conceder @Gestao a um coordenador de qualidade o trazia para
  // ca e apagava os oito comandos dele, sem que a permissao tivesse mudado.
  // Quem decide continua sendo `commandAccess`; quem nao tem, nao ve.
  const [showQuizQualidadeModal, setShowQuizQualidadeModal] = useState(false);
  const [showQuizAnaliseModal, setShowQuizAnaliseModal] = useState(false);
  const [showSimulacaoQualidadeModal, setShowSimulacaoQualidadeModal] =
    useState(false);
  const [showAcademiaGestao, setShowAcademiaGestao] = useState(false);
  const [showCriarTabulacaoModal, setShowCriarTabulacaoModal] = useState(false);
  const [showPremiacaoModal, setShowPremiacaoModal] = useState(false);
  const [showRoteiroAdmModal, setShowRoteiroAdmModal] = useState(false);
  const [showFeedbackCreationModal, setShowFeedbackCreationModal] =
    useState(false);

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
  }, []);
  const {
    iniciarTour,
    treinoBingoAberto,
    fecharTreinoBingo,
    feedbackAberto,
    fecharFeedback,
  } = useTourDaHome({ controleBusca, fecharModais: fecharModaisDoTour });

  return (
    <>
      <div className="flex min-h-screen flex-col bg-gray-50 transition-colors duration-200 dark:bg-gray-900">
        <Header
          visualVariant="aurora"
          onAlbumClick={() => {
            window.open(ALBUM_EXTERNAL_URL, "_blank", "noopener,noreferrer");
          }}
        />

        <AuroraStage>
          <SearchBar
            onSearch={handleSearch}
            onGestaoCommand={
              commandAccess.management
                ? () => navigate("/gerente/central")
                : undefined
            }
            onResultadosCommand={
              commandAccess.results
                ? () => navigate("/gerente/resultados")
                : undefined
            }
            onPasswordResetCommand={
              commandAccess.password
                ? () => setShowPasswordResetModal(true)
                : undefined
            }
            onAcessosCommand={
              commandAccess.acessos
                ? () => setShowAcessosModal(true)
                : undefined
            }
            onArenaCommand={
              commandAccess.arena ? () => setShowArenaModal(true) : undefined
            }
            onToDoCommand={
              commandAccess.tasks ? () => setShowToDoModal(true) : undefined
            }
            onIdealCommand={
              commandAccess.supervision
                ? () => setShowGoalsModal(true)
                : undefined
            }
            onAuditoriaCommand={
              // @Auditoria e o unico comando das duas pontas: supervisao OU
              // qualidade concede, como no IndexAdmin.
              commandAccess.supervision || commandAccess.quality
                ? () => setShowAuditoriaModal(true)
                : undefined
            }
            onIACommand={
              commandAccess.supervision
                ? () => setShowChatModal(true)
                : undefined
            }
            onAcordosCommand={
              commandAccess.supervision
                ? () => setShowAcordosModal(true)
                : undefined
            }
            onAuroraInsightCommand={
              commandAccess.auroraInsight
                ? () => setShowAuroraInsight(true)
                : undefined
            }
            onQuizQualidadeCommand={
              commandAccess.quality
                ? () => setShowQuizQualidadeModal(true)
                : undefined
            }
            onQuizAnaliseCommand={
              commandAccess.quality
                ? () => setShowQuizAnaliseModal(true)
                : undefined
            }
            onSimulacaoQualidadeCommand={
              commandAccess.quality
                ? () => setShowSimulacaoQualidadeModal(true)
                : undefined
            }
            onAcademiaQualidadeCommand={
              commandAccess.quality
                ? () => setShowAcademiaGestao(true)
                : undefined
            }
            onCriarTabulacaoCommand={
              commandAccess.quality
                ? () => setShowCriarTabulacaoModal(true)
                : undefined
            }
            onPremiacaoCommand={
              commandAccess.quality
                ? () => setShowPremiacaoModal(true)
                : undefined
            }
            onRoteiroAdmCommand={
              commandAccess.quality
                ? () => setShowRoteiroAdmModal(true)
                : undefined
            }
            onFeedbackCreationCommand={
              commandAccess.monitoria
                ? () => setShowFeedbackCreationModal(true)
                : undefined
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
      </div>

      <SupervisorPasswordResetModal
        isOpen={showPasswordResetModal}
        onClose={() => setShowPasswordResetModal(false)}
      />
      <AcessosModal
        isOpen={showAcessosModal}
        onClose={() => setShowAcessosModal(false)}
      />
      <ArenaModal
        isOpen={showArenaModal}
        onClose={() => setShowArenaModal(false)}
      />
      <TodoModal
        isOpen={showToDoModal}
        onClose={() => setShowToDoModal(false)}
      />
      <SupervisorGoalsModal
        isOpen={showGoalsModal}
        onClose={() => setShowGoalsModal(false)}
      />
      <AuditoriaModal
        isOpen={showAuditoriaModal}
        onClose={() => setShowAuditoriaModal(false)}
      />
      <ChatModal
        isOpen={showChatModal}
        onClose={() => setShowChatModal(false)}
      />
      <AcordosOperador
        isOpen={showAcordosModal}
        onClose={() => setShowAcordosModal(false)}
      />
      <AuroraInsightModal
        isOpen={showAuroraInsight}
        onClose={() => setShowAuroraInsight(false)}
      />
      <AnalyticsModal
        isOpen={showAnalyticsModal}
        onClose={() => setShowAnalyticsModal(false)}
      />

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
        onClose={() => setShowSimulacaoQualidadeModal(false)}
      />
      <AcademiaGestaoModal
        isOpen={showAcademiaGestao}
        onClose={() => setShowAcademiaGestao(false)}
      />
      <CriarTabulacaoModal
        isOpen={showCriarTabulacaoModal}
        onClose={() => setShowCriarTabulacaoModal(false)}
      />
      <PremiacaoModal
        isOpen={showPremiacaoModal}
        onClose={() => setShowPremiacaoModal(false)}
      />
      <RoteiroAdmModal
        isOpen={showRoteiroAdmModal}
        onClose={() => setShowRoteiroAdmModal(false)}
      />
      <FeedbackCreationModal
        isOpen={showFeedbackCreationModal}
        onClose={() => setShowFeedbackCreationModal(false)}
      />

      <TreinoBingo aberto={treinoBingoAberto} aoFechar={fecharTreinoBingo} />
      <FeedbackFinal aberto={feedbackAberto} aoFechar={fecharFeedback} />
    </>
  );
};

export default IndexGerencia;
