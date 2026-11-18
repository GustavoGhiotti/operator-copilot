import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { animate } from "animejs/animation";
import { stagger } from "animejs/utils";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Flag,
  Gamepad2,
  History,
  Home,
  Loader2,
  Palette,
  RefreshCw,
  Search,
  ShieldCheck,
  Trophy,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ArenaSupervisorPanel from "@/components/ArenaSupervisorPanel";
import ArenaWaitingRoom from "@/components/ArenaWaitingRoom";
import ArenaObservatorio from "@/components/ArenaObservatorio";
import ArenaAuroraWardrobe from "@/components/ArenaAuroraWardrobe";
import { isArenaObserver } from "@/utils/adminCommandAccess";
import {
  arenaApi,
  ArenaGameType,
  ArenaHub,
  ArenaOperatorCampaign,
  ArenaSession,
} from "@/services/arenaApi";
import quizGameCover from "@/assets/arena/quiz-game-cover.webp";
import bingoGameCover from "@/assets/arena/bingo-game-cover.webp";

interface ArenaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ArenaSection = "inicio" | "campanhas" | "jogos" | "aurora";

/**
 * Chave do guarda-roupa "Minha Aurora".
 *
 * `false` mantém o item visível na navegação, marcado como "Em breve", mas sem
 * abrir o guarda-roupa — a funcionalidade existe e ainda vai ser melhorada.
 * Para liberar, basta trocar para `true`: nada mais precisa mudar.
 */
const AURORA_WARDROBE_HABILITADO = false;

const navItems = [
  { id: "inicio" as const, label: "Início", icon: Home },
  { id: "campanhas" as const, label: "Minhas campanhas", icon: Flag },
  { id: "jogos" as const, label: "Jogos disponíveis", icon: Gamepad2 },
  {
    id: "aurora" as const,
    label: "Minha Aurora",
    icon: Palette,
    emBreve: !AURORA_WARDROBE_HABILITADO,
  },
];

const statusLabels: Record<string, string> = {
  RASCUNHO: "Rascunho",
  PUBLICADA: "Convites enviados",
  SALA_ABERTA: "Sala aberta",
  AGUARDANDO: "Sala aberta",
  EM_ANDAMENTO: "Em andamento",
  FINALIZADA: "Finalizada",
  CANCELADA: "Cancelada",
  CONVIDADO: "Convite recebido",
  ACEITO: "Participação confirmada",
  NA_SALA: "Na sala",
  JOGANDO: "Jogando",
  AUSENTE: "Ausente",
};

const gameCovers: Record<string, string> = {
  QUIZ_AO_VIVO: quizGameCover,
  BINGO: bingoGameCover,
};

const getGameCover = (gameType?: string | null) =>
  gameCovers[String(gameType || "").trim().toUpperCase()] || quizGameCover;

const formatDate = (value?: string | null) => {
  if (!value) return "Sem agendamento";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data indisponível";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
};

const daysUntil = (value?: string | null) => {
  if (!value) return null;
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((target.getTime() - today.getTime()) / 86400000));
};

const initials = (name?: string | null) => {
  const safeName = String(name || "Operador").trim();
  return safeName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
};

const firstName = (name?: string | null) => {
  const value = String(name || "Operador").trim().split(/\s+/)[0] || "Operador";
  return `${value.charAt(0).toUpperCase()}${value.slice(1).toLowerCase()}`;
};

const normalizeStatus = (value?: string | null) =>
  String(value || "").trim().toUpperCase();

const campaignStatus = (campaign: ArenaOperatorCampaign) =>
  normalizeStatus(
    campaign.status_sessao || campaign.status_participante || campaign.status,
  );

const hasPendingInvite = (campaign: ArenaOperatorCampaign) =>
  Boolean(
    campaign.id_convite
      && (
        normalizeStatus(campaign.status_convite) === "PENDENTE"
        || normalizeStatus(campaign.status_participante) === "CONVIDADO"
      ),
  );

const canEnter = (campaign: ArenaOperatorCampaign) =>
  Boolean(
    campaign.id_sessao &&
      campaign.status_sessao === "AGUARDANDO" &&
      ["ACEITO", "NA_SALA"].includes(campaign.status_participante || ""),
  );

const canResume = (campaign: ArenaOperatorCampaign) =>
  Boolean(
    campaign.id_sessao &&
      campaign.status_sessao === "EM_ANDAMENTO" &&
      campaign.status_participante === "JOGANDO",
  );

const canViewResult = (campaign: ArenaOperatorCampaign) =>
  Boolean(
    campaign.id_sessao &&
      campaign.status_sessao === "FINALIZADA" &&
      campaign.status_participante === "FINALIZADO",
  );

const isFinished = (campaign: ArenaOperatorCampaign) =>
  campaign.status === "FINALIZADA" || campaign.status_sessao === "FINALIZADA";

export default function ArenaModal({ isOpen, onClose }: ArenaModalProps) {
  const { toast } = useToast();
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState<ArenaSection>("inicio");
  const [searchTerm, setSearchTerm] = useState("");
  const [hub, setHub] = useState<ArenaHub | null>(null);
  const [gameTypes, setGameTypes] = useState<ArenaGameType[]>([]);
  const [loadingHub, setLoadingHub] = useState(false);
  const [respondingInvite, setRespondingInvite] = useState<number | null>(null);
  const [openingSession, setOpeningSession] = useState<number | null>(null);
  const [activeSession, setActiveSession] = useState<ArenaSession | null>(null);

  // Centro observador entra no observatório, não no hub nem no painel de
  // supervisor. A checagem aqui só escolhe a tela — quem barra é o servidor.
  const isObservador = useMemo(
    () => isArenaObserver(localStorage.getItem("centroCusto")),
    [],
  );

  const isSupervisor = useMemo(
    () =>
      (localStorage.getItem("funcao") || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .includes("SUPERVISOR"),
    [],
  );

  const loadHub = useCallback(async (silent = false) => {
    if (isSupervisor) return;
    if (!silent) setLoadingHub(true);
    try {
      const [hubData, typesData] = await Promise.all([
        arenaApi.getHub(),
        arenaApi.getGameTypes(),
      ]);
      setHub(hubData);
      setGameTypes(typesData);
    } catch (error) {
      if (!silent) {
        const candidate = error as { response?: { data?: { erro?: string } } };
        toast({
          title: "Não foi possível carregar a Arena",
          description: candidate.response?.data?.erro || "Tente novamente em instantes.",
          variant: "destructive",
        });
      }
    } finally {
      if (!silent) setLoadingHub(false);
    }
  }, [isSupervisor, toast]);

  useEffect(() => {
    // Observador não tem hub de operador: pedir seria requisição perdida.
    if (isOpen && !isSupervisor && !isObservador) void loadHub();
  }, [isOpen, isObservador, isSupervisor, loadHub]);

  useEffect(() => {
    // O supervisor pode incluir gente com a sala já aberta, e a janela de
    // entrada é de 5 minutos. Sem esta atualização silenciosa, o convidado de
    // última hora só descobriria apertando o botão de atualizar — ou seja,
    // nunca. Pausa enquanto ele está dentro de uma partida.
    if (!isOpen || isSupervisor || isObservador || activeSession) return;
    const intervalo = window.setInterval(() => void loadHub(true), 15000);
    return () => window.clearInterval(intervalo);
  }, [activeSession, isOpen, isObservador, isSupervisor, loadHub]);

  useEffect(() => {
    if (!isOpen || !workspaceRef.current) return;
    const targets = workspaceRef.current.querySelectorAll("[data-arena-enter]");
    const animation = animate(targets, {
      opacity: [0, 1],
      translateY: [10, 0],
      delay: stagger(35),
      duration: 360,
      ease: "out(3)",
    });
    return () => animation.cancel();
  }, [activeSection, isOpen, loadingHub]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const campaigns = useMemo(() => hub?.campanhas || [], [hub?.campanhas]);
  const filteredCampaigns = useMemo(() => {
    const search = searchTerm.trim().toLocaleLowerCase("pt-BR");
    if (!search) return campaigns;
    return campaigns.filter((campaign) =>
      `${campaign.titulo} ${campaign.descricao || ""} ${campaign.tipo_jogo_nome}`
        .toLocaleLowerCase("pt-BR")
        .includes(search),
    );
  }, [campaigns, searchTerm]);
  const filteredGames = useMemo(() => {
    const search = searchTerm.trim().toLocaleLowerCase("pt-BR");
    if (!search) return gameTypes;
    return gameTypes.filter((game) =>
      `${game.nome} ${game.descricao || ""}`
        .toLocaleLowerCase("pt-BR")
        .includes(search),
    );
  }, [gameTypes, searchTerm]);

  const pendingInvites = campaigns.filter(hasPendingInvite);
  const actionableCampaigns = campaigns.filter(
    (campaign) => canEnter(campaign) || canResume(campaign) || canViewResult(campaign),
  );
  const primaryCampaign =
    actionableCampaigns.find((campaign) => campaign.status_sessao === "EM_ANDAMENTO") ||
    actionableCampaigns.find((campaign) => campaign.status_sessao === "AGUARDANDO") ||
    campaigns[0];
  const completedCampaigns = campaigns.filter(
    (campaign) => campaign.status === "FINALIZADA",
  );
  const victories = completedCampaigns.filter(
    (campaign) => Number(campaign.classificacao) === 1,
  ).length;

  const profile = hub?.perfil;
  const levelRange = Math.max(
    1,
    Number(profile?.xp_proximo_nivel || 500) - Number(profile?.xp_inicio_nivel || 0),
  );
  const levelProgress = Math.max(
    0,
    Math.min(
      100,
      ((Number(profile?.xp_total || 0) - Number(profile?.xp_inicio_nivel || 0)) /
        levelRange) *
        100,
    ),
  );

  const respondInvite = async (id: number, resposta: "ACEITO" | "RECUSADO") => {
    setRespondingInvite(id);
    try {
      await arenaApi.respondInvite(id, resposta);
      toast({
        title: resposta === "ACEITO" ? "Convite aceito" : "Convite recusado",
        description:
          resposta === "ACEITO"
            ? "Sua participação foi confirmada. Aguarde o supervisor abrir a sala."
            : "O supervisor será informado da sua decisão.",
      });
      await loadHub(true);
    } catch (error) {
      const candidate = error as { response?: { data?: { erro?: string } } };
      toast({
        title: "Não foi possível responder ao convite",
        description: candidate.response?.data?.erro || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setRespondingInvite(null);
    }
  };

  const openCampaignSession = async (campaign: ArenaOperatorCampaign) => {
    if (!campaign.id_sessao) return;
    setOpeningSession(campaign.id_sessao);
    try {
      const session = canResume(campaign) || canViewResult(campaign)
        ? await arenaApi.getSession(campaign.id_sessao)
        : await arenaApi.enterRoom(campaign.id_sessao);
      setActiveSession(session);
    } catch (error) {
      const candidate = error as { response?: { data?: { erro?: string } } };
      toast({
        title: "Não foi possível abrir a partida",
        description: candidate.response?.data?.erro || "Atualize a Arena e tente novamente.",
        variant: "destructive",
      });
      await loadHub(true);
    } finally {
      setOpeningSession(null);
    }
  };

  if (!isOpen) return null;
  if (isObservador) return <ArenaObservatorio onClose={onClose} />;
  if (isSupervisor) return <ArenaSupervisorPanel onClose={onClose} />;

  const userName = hub?.usuario?.nome || localStorage.getItem("nomeCompleto") || "Operador";
  const userInitials = initials(userName);

  return (
    <div
      data-tour="arena-hub"
      className="fixed inset-0 z-[70] bg-[#020711]/98 p-0 text-slate-100 backdrop-blur-md md:p-3"
    >
      <div ref={workspaceRef} className="arena-workspace relative flex h-full min-h-0 overflow-hidden border border-[#233b54]/80 bg-[#030b16] shadow-[0_25px_80px_rgba(0,0,0,.55)] md:rounded-2xl">
        <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(34,211,238,.7)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,.7)_1px,transparent_1px)] [background-size:36px_36px]" />

        <aside className="relative z-10 hidden w-[300px] shrink-0 flex-col border-r border-[#1d3248] bg-[#020a14]/95 lg:flex">
          <div className="border-b border-[#1d3248] p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg border border-orange-500/70 bg-orange-500/10 text-orange-400">
                <Gamepad2 className="h-4 w-4" />
              </div>
              <div>
                <h1 className="font-semibold tracking-[0.08em] text-white"><span className="text-orange-500">ARENA</span> AURORA</h1>
                <p className="mt-0.5 font-mono text-[8px] tracking-[0.18em] text-slate-500">HUB DE CAMPANHAS</p>
              </div>
            </div>
          </div>

          <div className="px-5 py-5">
            <div className="flex items-center gap-3">
              <div className="relative grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[conic-gradient(#22d3ee_var(--arena-level),#17283a_0)] p-[2px] shadow-[0_0_20px_rgba(34,211,238,.16)]" style={{ "--arena-level": `${levelProgress}%` } as React.CSSProperties}>
                <div className="grid h-full w-full place-items-center rounded-full border-4 border-[#020a14] bg-[#071421] font-semibold text-cyan-100">{userInitials}</div>
                <span className="absolute -bottom-1 rounded-full border border-orange-400/50 bg-[#101a26] px-1.5 py-0.5 font-mono text-[8px] text-orange-300">NV {profile?.nivel || 1}</span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{firstName(userName)}</p>
                <p className="mt-1 text-[10px] text-cyan-300">Nível {profile?.nivel || 1} · {profile?.titulo || "Iniciante"}</p>
              </div>
            </div>
            <div className="mt-4 flex items-end justify-between text-xs">
              <strong className="text-orange-400">{profile?.xp_total || 0} XP</strong>
              <span className="text-slate-500">{profile?.xp_proximo_nivel || 500} XP</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-cyan-400 transition-all" style={{ width: `${levelProgress}%` }} />
            </div>
          </div>

          <nav data-tour="arena-nav" className="space-y-1 px-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.id;
              const emBreve = Boolean(item.emBreve);
              return (
                <button
                  key={item.id}
                  type="button"
                  title={emBreve ? "Em desenvolvimento — disponível em breve" : undefined}
                  onClick={() => { setActiveSection(item.id); setSearchTerm(""); }}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left text-xs transition ${active ? "border-cyan-400/25 bg-[#0a2037] text-white shadow-[inset_3px_0_0_#f97316]" : `border-transparent hover:border-[#29445f] hover:bg-[#071421] hover:text-white ${emBreve ? "text-slate-600" : "text-slate-400"}`}`}
                >
                  <Icon className={`h-4 w-4 ${active ? "text-cyan-300" : ""}`} />
                  <span className="flex-1">{item.label}</span>
                  {emBreve && (
                    <span className="rounded-full border border-[#29445f] px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.12em] text-slate-500">
                      Em breve
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="mt-5 min-h-0 flex-1 border-t border-[#1d3248] px-3 py-4">
            <div className="mb-3 flex items-center justify-between px-1 font-mono text-[9px] tracking-[0.16em] text-slate-500">
              <span className="inline-flex items-center gap-2"><History className="h-3.5 w-3.5" /> CAMPANHAS RECENTES</span>
              <button type="button" onClick={() => setActiveSection("campanhas")} className="text-[8px] text-cyan-400 hover:text-cyan-200">VER TODAS</button>
            </div>
            <div className="arena-scrollbar max-h-full space-y-2 overflow-y-auto pr-0.5">
              {campaigns.slice(0, 3).map((campaign) => {
                const status = campaignStatus(campaign);
                const active = canResume(campaign) || canEnter(campaign);
                const result = canViewResult(campaign) || isFinished(campaign);
                return (
                  <button
                    key={campaign.id}
                    type="button"
                    onClick={() => {
                      if (canResume(campaign) || canEnter(campaign) || canViewResult(campaign)) {
                        void openCampaignSession(campaign);
                      } else {
                        setActiveSection("campanhas");
                      }
                    }}
                    className={`group w-full overflow-hidden rounded-xl border bg-[#06111e] p-2.5 text-left transition ${active ? "border-orange-400/50 shadow-[inset_3px_0_0_#f97316,0_0_18px_rgba(249,115,22,.08)]" : "border-[#20364c] hover:border-cyan-400/35"}`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-[#31506d] bg-[#071421]">
                        <img src={getGameCover(campaign.tipo_jogo)} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-semibold text-white">{campaign.titulo}</span>
                        <span className="mt-0.5 block truncate text-[8px] font-medium uppercase tracking-[0.08em] text-cyan-400">{campaign.tipo_jogo_nome}</span>
                        <span className={`mt-1.5 inline-flex rounded border px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-[0.08em] ${active ? "border-orange-400/45 bg-orange-400/10 text-orange-300" : result ? "border-violet-400/40 bg-violet-400/10 text-violet-300" : "border-cyan-400/35 bg-cyan-400/5 text-cyan-300"}`}>
                          {active ? "RETOMAR PARTIDA" : statusLabels[status] || status}
                        </span>
                      </span>
                    </span>
                    {result && (
                      <span className="mt-2.5 grid grid-cols-3 border-t border-[#1d3248] pt-2 text-center text-[8px]">
                        <span className="border-r border-[#1d3248] text-orange-300"><Trophy className="mr-1 inline h-3 w-3" />{campaign.classificacao ? `${campaign.classificacao}º` : "—"}</span>
                        <span className="border-r border-[#1d3248] text-cyan-300">{Number(campaign.pontuacao || 0)} pts</span>
                        <span className="text-emerald-300">+{Number(campaign.xp_concedido || 0)} XP</span>
                      </span>
                    )}
                  </button>
                );
              })}
              {!loadingHub && campaigns.length === 0 && <p className="px-2 text-[10px] leading-relaxed text-slate-600">Você ainda não participou de campanhas.</p>}
            </div>
          </div>

          {hub?.temporada && (
            <div className="m-3 rounded-xl border border-cyan-400/35 bg-[#061522] p-3.5 shadow-[inset_0_0_22px_rgba(34,211,238,.035)]">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg border border-cyan-400/35 bg-cyan-400/5 text-cyan-300"><ShieldCheck className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1"><p className="truncate font-mono text-[9px] tracking-[0.13em] text-white">{hub.temporada.nome}</p><p className="mt-0.5 text-[8px] text-slate-500">PROGRESSO DA TEMPORADA</p></div>
                <span className="rounded-lg border border-cyan-400/35 px-2 py-1 font-mono text-[8px] text-cyan-300">NV. {profile?.nivel || 1}</span>
              </div>
              <div className="mt-4 flex items-center justify-between text-[9px]"><strong className="text-cyan-300">{Number(profile?.xp_total || 0).toLocaleString("pt-BR")} XP</strong><span className="text-slate-500">{Number(profile?.xp_proximo_nivel || 500).toLocaleString("pt-BR")} XP</span></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full border border-[#304a62] bg-[#101c2a]"><div className="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-300 to-cyan-400" style={{ width: `${levelProgress}%` }} /></div>
              <p className="mt-3 flex items-center gap-1.5 text-[8px] text-slate-500"><CalendarClock className="h-3 w-3 shrink-0 text-cyan-400" /><span className="truncate">Termina em {new Intl.DateTimeFormat("pt-BR").format(new Date(hub.temporada.data_fim))}</span>{daysUntil(hub.temporada.data_fim) !== null && <span className="shrink-0 text-cyan-400">· {daysUntil(hub.temporada.data_fim)} dias</span>}</p>
            </div>
          )}
        </aside>

        <div className="relative z-10 flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 shrink-0 items-center gap-3 border-b border-[#1d3248] bg-[#020a14]/90 px-4 md:px-6">
            <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg border border-[#2a4159] text-slate-400 lg:hidden" aria-label="Voltar"><ArrowLeft className="h-4 w-4" /></button>
            <div className="flex items-center gap-2 lg:hidden"><Gamepad2 className="h-4 w-4 text-orange-500" /><strong className="text-xs">ARENA AURORA</strong></div>
            <label className="mx-auto hidden h-10 w-full max-w-xl items-center gap-3 rounded-xl border border-[#2b435d] bg-[#071421] px-4 focus-within:border-cyan-500/45 sm:flex">
              <Search className="h-4 w-4 text-cyan-400" /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder={activeSection === "aurora" && AURORA_WARDROBE_HABILITADO ? "Buscar roupas e acessórios..." : "Buscar campanhas e jogos..."} className="min-w-0 flex-1 bg-transparent text-xs text-slate-100 outline-none placeholder:text-slate-600" />
            </label>
            <button type="button" disabled={loadingHub} onClick={() => void loadHub()} className="grid h-9 w-9 place-items-center rounded-lg border border-[#2a4159] text-cyan-300 disabled:opacity-50" aria-label="Atualizar Arena"><RefreshCw className={`h-4 w-4 ${loadingHub ? "animate-spin" : ""}`} /></button>
            <div className="grid h-9 w-9 place-items-center rounded-full border border-cyan-400/70 bg-[#071421] text-xs text-cyan-100">{userInitials}</div>
            <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-lg border border-[#2a4159] text-slate-300 hover:border-orange-500/60 hover:text-orange-300" aria-label="Fechar Arena"><X className="h-5 w-5" /></button>
          </header>

          <main className="arena-scrollbar min-h-0 flex-1 overflow-y-auto p-4 md:p-5">
            <div
              className={`mx-auto space-y-4 ${
                activeSection === "aurora"
                  ? "max-w-[1560px]"
                  : "max-w-[1360px]"
              }`}
            >
              {loadingHub && !hub ? (
                <div className="grid min-h-[60vh] place-items-center text-center text-cyan-200"><div><Loader2 className="mx-auto h-8 w-8 animate-spin" /><p className="mt-4 font-mono text-[10px] tracking-[0.2em]">CARREGANDO DADOS DA ARENA</p></div></div>
              ) : (
                <>
                  {activeSection !== "aurora" && pendingInvites.length > 0 && (
                    <section data-arena-enter className="rounded-2xl border border-orange-400/35 bg-gradient-to-r from-orange-500/10 to-cyan-400/5 p-4">
                      <SectionTitle icon={Zap} title="CONVITES PENDENTES" suffix={`${pendingInvites.length}`} />
                      <div className="mt-3 grid gap-2 lg:grid-cols-2">
                        {pendingInvites.map((campaign) => (
                          <article key={campaign.id} className="flex flex-col gap-3 rounded-xl border border-[#2b435d] bg-[#071421] p-4 sm:flex-row sm:items-center">
                            <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-white">{campaign.titulo}</p><p className="mt-1 text-[10px] text-cyan-300">{campaign.tipo_jogo_nome}</p></div>
                            <div className="flex gap-2">
                              <button type="button" disabled={respondingInvite === campaign.id_convite} onClick={() => void respondInvite(campaign.id_convite as number, "RECUSADO")} className="h-9 rounded-lg border border-slate-600 px-3 text-[10px] font-semibold text-slate-300">RECUSAR</button>
                              <button type="button" disabled={respondingInvite === campaign.id_convite} onClick={() => void respondInvite(campaign.id_convite as number, "ACEITO")} className="h-9 rounded-lg bg-orange-500 px-4 text-[10px] font-bold text-white disabled:opacity-50">ACEITAR</button>
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  )}

                  {activeSection === "inicio" && (
                    <HomeSection hub={hub} primaryCampaign={primaryCampaign} campaigns={campaigns} completed={completedCampaigns.length} victories={victories} openingSession={openingSession} respondingInvite={respondingInvite} onOpen={openCampaignSession} onRespondInvite={respondInvite} />
                  )}
                  {activeSection === "campanhas" && (
                    <CampaignsSection campaigns={filteredCampaigns} openingSession={openingSession} respondingInvite={respondingInvite} onOpen={openCampaignSession} onRespondInvite={respondInvite} />
                  )}
                  {activeSection === "jogos" && (
                    <GamesSection games={filteredGames} />
                  )}
                  {/* Segunda trava, alem do item desabilitado: garante que o
                      guarda-roupa nao abra por nenhum outro caminho enquanto
                      estiver em desenvolvimento. */}
                  {activeSection === "aurora" &&
                    (AURORA_WARDROBE_HABILITADO ? (
                      <ArenaAuroraWardrobe
                        searchTerm={searchTerm}
                        xpFallback={Number(profile?.xp_total || 0)}
                      />
                    ) : (
                      <AuroraEmBreve />
                    ))}
                </>
              )}
            </div>
          </main>
        </div>
      </div>

      {activeSession && (
        <ArenaWaitingRoom initialSession={activeSession} onExit={() => { setActiveSession(null); void loadHub(true); }} />
      )}
    </div>
  );
}

function HomeSection({ hub, primaryCampaign, campaigns, completed, victories, openingSession, respondingInvite, onOpen, onRespondInvite }: {
  hub: ArenaHub | null;
  primaryCampaign?: ArenaOperatorCampaign;
  campaigns: ArenaOperatorCampaign[];
  completed: number;
  victories: number;
  openingSession: number | null;
  respondingInvite: number | null;
  onOpen: (campaign: ArenaOperatorCampaign) => Promise<void>;
  onRespondInvite: (id: number, resposta: "ACEITO" | "RECUSADO") => Promise<void>;
}) {
  return (
    <>
      <section data-arena-enter className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Zap} label="XP TOTAL" value={String(hub?.perfil.xp_total || 0)} suffix="XP" accent="orange" />
        <Metric icon={Flag} label="CAMPANHAS" value={String(campaigns.length)} suffix="CAMPANHAS" accent="cyan" />
        <Metric icon={CheckCircle2} label="FINALIZADAS" value={String(completed)} suffix={completed === 1 ? "FINALIZADA" : "FINALIZADAS"} accent="emerald" />
        <Metric icon={Trophy} label="1º LUGAR" value={String(victories)} suffix={victories === 1 ? "VITÓRIA" : "VITÓRIAS"} accent="violet" />
      </section>

      {primaryCampaign ? (
        <section data-arena-enter className="group relative min-h-[320px] overflow-hidden rounded-2xl border border-cyan-400/55 bg-[#040d19] shadow-[0_0_34px_rgba(34,211,238,.08)]">
          <img src={getGameCover(primaryCampaign.tipo_jogo)} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.015]" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(2,7,17,.98)_0%,rgba(3,13,27,.92)_30%,rgba(3,13,27,.45)_62%,rgba(3,13,27,.16)_100%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(0deg,rgba(2,7,17,.78),transparent_48%)]" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(34,211,238,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,.8)_1px,transparent_1px)] [background-size:32px_32px]" />
          <div className="relative flex min-h-[320px] max-w-2xl flex-col justify-center p-7 md:p-10">
            <p className="font-mono text-[9px] tracking-[0.2em] text-cyan-300">PRÓXIMA AÇÃO NA ARENA</p>
            <span className={`mt-5 inline-flex w-fit items-center gap-2 rounded border px-2.5 py-1 font-mono text-[9px] ${isFinished(primaryCampaign) ? "border-violet-400/45 bg-violet-400/10 text-violet-200" : "border-cyan-400/45 bg-cyan-400/10 text-cyan-200"}`}>
              {!isFinished(primaryCampaign) && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-400 shadow-[0_0_8px_#fb923c]" />}
              {statusLabels[campaignStatus(primaryCampaign)] || campaignStatus(primaryCampaign)}
            </span>
            <h2 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-5xl">{primaryCampaign.titulo}</h2>
            <p className="mt-2 text-lg font-semibold text-cyan-300">{primaryCampaign.tipo_jogo_nome}</p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-slate-300">
              <span className="inline-flex items-center gap-2"><Users className="h-3.5 w-3.5 text-cyan-300" />{primaryCampaign.participantes || 0} participantes</span>
              <span className="inline-flex items-center gap-2"><CalendarClock className="h-3.5 w-3.5 text-orange-300" />{formatDate(primaryCampaign.data_agendada)}</span>
            </div>
            {hasPendingInvite(primaryCampaign) && (
              <div className="mt-7 flex flex-wrap gap-3">
                <button type="button" disabled={respondingInvite === primaryCampaign.id_convite} onClick={() => void onRespondInvite(primaryCampaign.id_convite as number, "RECUSADO")} className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-500/70 bg-[#06111e]/80 px-5 text-xs font-semibold text-slate-200 transition hover:border-red-400/60 hover:text-red-200 disabled:opacity-50">RECUSAR</button>
                <button type="button" disabled={respondingInvite === primaryCampaign.id_convite} onClick={() => void onRespondInvite(primaryCampaign.id_convite as number, "ACEITO")} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-orange-500 px-7 text-xs font-bold text-white shadow-[0_0_26px_rgba(249,115,22,.28)] transition hover:-translate-y-0.5 hover:bg-orange-400 disabled:opacity-50">{respondingInvite === primaryCampaign.id_convite && <Loader2 className="h-4 w-4 animate-spin" />} ACEITAR CONVITE</button>
              </div>
            )}
            {(canEnter(primaryCampaign) || canResume(primaryCampaign) || canViewResult(primaryCampaign)) && (
              <button type="button" disabled={openingSession === primaryCampaign.id_sessao} onClick={() => void onOpen(primaryCampaign)} className="mt-7 inline-flex h-12 w-fit items-center gap-3 rounded-xl bg-orange-500 px-6 text-xs font-bold text-white shadow-[0_0_26px_rgba(249,115,22,.28)] transition hover:-translate-y-0.5 hover:bg-orange-400 disabled:opacity-50">
                {openingSession === primaryCampaign.id_sessao ? <Loader2 className="h-4 w-4 animate-spin" /> : isFinished(primaryCampaign) ? <Trophy className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                {canViewResult(primaryCampaign) ? "VER RESULTADO" : canResume(primaryCampaign) ? "RETOMAR PARTIDA" : "ENTRAR NA SALA"}
              </button>
            )}
          </div>
        </section>
      ) : (
        <EmptyState title="Nenhuma campanha recebida" description="Quando um supervisor convidar você, a campanha aparecerá aqui." />
      )}

      <section data-arena-enter>
        <SectionTitle icon={History} title="ATIVIDADE RECENTE" suffix="ÚLTIMAS 3" />
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.slice(0, 3).map((campaign) => <CampaignCard key={campaign.id} campaign={campaign} openingSession={openingSession} respondingInvite={respondingInvite} onOpen={onOpen} onRespondInvite={onRespondInvite} />)}
          {campaigns.length === 0 && <EmptyState title="Sem atividade" description="Sua participação na Arena começará com o primeiro convite." />}
        </div>
      </section>
    </>
  );
}

function CampaignsSection({ campaigns, openingSession, respondingInvite, onOpen, onRespondInvite }: { campaigns: ArenaOperatorCampaign[]; openingSession: number | null; respondingInvite: number | null; onOpen: (campaign: ArenaOperatorCampaign) => Promise<void>; onRespondInvite: (id: number, resposta: "ACEITO" | "RECUSADO") => Promise<void> }) {
  return (
    <section data-arena-enter>
      <SectionTitle icon={Flag} title="MINHAS CAMPANHAS" suffix={`${campaigns.length} ENCONTRADAS`} />
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {campaigns.map((campaign) => <CampaignCard key={campaign.id} campaign={campaign} openingSession={openingSession} respondingInvite={respondingInvite} onOpen={onOpen} onRespondInvite={onRespondInvite} />)}
        {campaigns.length === 0 && <EmptyState title="Nenhuma campanha encontrada" description="Não existem dados reais para os filtros informados." />}
      </div>
    </section>
  );
}

/** Sinaliza que o guarda-roupa existe e está a caminho, sem prometer data. */
function AuroraEmBreve() {
  return (
    <section data-arena-enter className="flex flex-1 items-center justify-center py-16">
      <div className="max-w-sm rounded-xl border border-[#1d3248] bg-[#071421] px-8 py-10 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[#29445f] bg-[#0a2037]">
          <Palette className="h-5 w-5 text-slate-500" />
        </div>
        <h3 className="text-sm font-semibold text-white">Minha Aurora</h3>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          O guarda-roupa está em desenvolvimento. Em breve você vai poder trocar
          o visual da Aurora com o que conquistar na Arena.
        </p>
        <span className="mt-5 inline-block rounded-full border border-[#29445f] px-3 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">
          Em breve
        </span>
      </div>
    </section>
  );
}

function GamesSection({ games }: { games: ArenaGameType[] }) {
  return (
    <section data-arena-enter>
      <SectionTitle icon={Gamepad2} title="JOGOS DISPONÍVEIS" suffix={`${games.length} CADASTRADOS`} />
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {games.map((game) => {
          const available = ["QUIZ_AO_VIVO", "BINGO"].includes(game.codigo);
          return (
            <article key={game.id} className={`group relative overflow-hidden rounded-2xl border bg-[#06111e] ${available ? "border-cyan-400/35" : "border-[#263e58]"}`}>
              <div className="relative h-36 overflow-hidden">
                <img src={getGameCover(game.codigo)} alt="" loading="lazy" className={`h-full w-full object-cover transition duration-500 group-hover:scale-105 ${available ? "" : "saturate-75"}`} />
                <div className="absolute inset-0 bg-gradient-to-t from-[#06111e] via-[#06111e]/20 to-transparent" />
                <span className={`absolute right-3 top-3 rounded border px-2 py-1 font-mono text-[8px] ${available ? "border-emerald-400/45 bg-emerald-950/80 text-emerald-300" : "border-slate-500/40 bg-slate-950/80 text-slate-400"}`}>{available ? "DISPONÍVEL" : "EM PREPARAÇÃO"}</span>
              </div>
              <div className="relative p-5"><span className="grid h-11 w-11 place-items-center rounded-xl border border-cyan-400/40 bg-cyan-400/10 text-cyan-300"><Gamepad2 className="h-5 w-5" /></span><h3 className="mt-4 text-base font-semibold text-white">{game.nome}</h3><p className="mt-2 min-h-10 text-xs leading-relaxed text-slate-400">{game.descricao || "Modalidade cadastrada na Arena Aurora."}</p></div>
            </article>
          );
        })}
        {games.length === 0 && <EmptyState title="Nenhum jogo cadastrado" description="As modalidades aparecerão após serem ativadas pela equipe responsável." />}
      </div>
    </section>
  );
}

function CampaignCard({ campaign, openingSession, respondingInvite, onOpen, onRespondInvite }: { campaign: ArenaOperatorCampaign; openingSession: number | null; respondingInvite: number | null; onOpen: (campaign: ArenaOperatorCampaign) => Promise<void>; onRespondInvite: (id: number, resposta: "ACEITO" | "RECUSADO") => Promise<void> }) {
  const finished = isFinished(campaign);
  const actionable = canEnter(campaign) || canResume(campaign) || canViewResult(campaign);
  return (
    <article className={`group overflow-hidden rounded-2xl border bg-[#06111e] transition hover:-translate-y-0.5 ${finished ? "border-violet-400/35 hover:border-violet-300/55" : "border-cyan-400/30 hover:border-cyan-300/55"}`}>
      <div className="relative h-32 overflow-hidden border-b border-[#263e58]">
        <img src={getGameCover(campaign.tipo_jogo)} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#06111e] via-transparent to-transparent" />
        <span className={`absolute left-3 top-3 rounded border px-2 py-1 font-mono text-[8px] ${finished ? "border-violet-400/50 bg-violet-950/80 text-violet-200" : "border-cyan-400/50 bg-[#03111e]/85 text-cyan-200"}`}>{statusLabels[campaignStatus(campaign)] || campaignStatus(campaign)}</span>
      </div>
      <div className="p-5">
        <div className="flex items-start gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${finished ? "border-violet-400/40 bg-violet-400/10 text-violet-300" : "border-cyan-400/40 bg-cyan-400/10 text-cyan-300"}`}>{finished ? <Trophy className="h-4 w-4" /> : <Flag className="h-4 w-4" />}</span><div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{campaign.titulo}</p><p className="mt-1 text-[10px] text-cyan-300">{campaign.tipo_jogo_nome}</p></div></div>
        <p className="mt-4 line-clamp-2 min-h-9 text-xs leading-relaxed text-slate-400">{campaign.descricao || "Campanha da Arena Aurora."}</p>
        <div className="mt-4 flex min-h-6 items-center justify-between border-t border-[#1d3248] pt-3"><span className="text-[9px] text-slate-500">{formatDate(campaign.data_agendada)}</span>{finished && <span className="text-[10px] font-semibold text-emerald-300">{campaign.pontuacao || 0} pts · +{campaign.xp_concedido || 0} XP</span>}</div>
        {hasPendingInvite(campaign) && (
          <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
            <button type="button" disabled={respondingInvite === campaign.id_convite} onClick={() => void onRespondInvite(campaign.id_convite as number, "RECUSADO")} className="h-10 rounded-xl border border-slate-600 px-3 text-[10px] font-semibold text-slate-300 hover:border-red-400/50 hover:text-red-200 disabled:opacity-50">RECUSAR</button>
            <button type="button" disabled={respondingInvite === campaign.id_convite} onClick={() => void onRespondInvite(campaign.id_convite as number, "ACEITO")} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 text-[10px] font-bold text-white hover:bg-orange-400 disabled:opacity-50">{respondingInvite === campaign.id_convite && <Loader2 className="h-3.5 w-3.5 animate-spin" />} ACEITAR</button>
          </div>
        )}
        {actionable && <button type="button" disabled={openingSession === campaign.id_sessao} onClick={() => void onOpen(campaign)} className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 text-[10px] font-bold text-white shadow-[0_0_18px_rgba(249,115,22,.16)] hover:bg-orange-400 disabled:opacity-50">{openingSession === campaign.id_sessao ? <Loader2 className="h-4 w-4 animate-spin" /> : finished ? <Trophy className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}{canViewResult(campaign) ? "VER RESULTADO" : canResume(campaign) ? "RETOMAR PARTIDA" : "ENTRAR NA SALA"}</button>}
      </div>
    </article>
  );
}

const metricStyles = {
  orange: { border: "border-orange-400/35", text: "text-orange-300", bg: "from-orange-400/10", glow: "shadow-[inset_0_0_22px_rgba(251,146,60,.04)]" },
  cyan: { border: "border-cyan-400/35", text: "text-cyan-300", bg: "from-cyan-400/10", glow: "shadow-[inset_0_0_22px_rgba(34,211,238,.04)]" },
  emerald: { border: "border-emerald-400/35", text: "text-emerald-300", bg: "from-emerald-400/10", glow: "shadow-[inset_0_0_22px_rgba(52,211,153,.04)]" },
  violet: { border: "border-violet-400/35", text: "text-violet-300", bg: "from-violet-400/10", glow: "shadow-[inset_0_0_22px_rgba(167,139,250,.04)]" },
};

function Metric({ icon: Icon, label, value, suffix, accent }: { icon: typeof Zap; label: string; value: string; suffix: string; accent: keyof typeof metricStyles }) {
  const styles = metricStyles[accent];
  return <div className={`group relative overflow-hidden rounded-2xl border ${styles.border} bg-gradient-to-br ${styles.bg} to-[#06111e] p-5 ${styles.glow}`}><Icon className={`pointer-events-none absolute -bottom-3 -right-2 h-20 w-20 opacity-[0.07] ${styles.text}`} /><div className="relative flex items-center gap-2 text-slate-500"><Icon className={`h-4 w-4 ${styles.text}`} /><span className="font-mono text-[9px] tracking-[0.14em]">{label}</span></div><div className="relative mt-4 flex items-end gap-2"><strong className={`text-3xl ${styles.text}`}>{value}</strong><span className={`pb-1 text-[10px] font-semibold ${styles.text}`}>{suffix}</span></div><span className={`absolute inset-x-5 bottom-0 h-px bg-gradient-to-r from-transparent via-current to-transparent opacity-70 ${styles.text}`} /></div>;
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="col-span-full rounded-2xl border border-dashed border-[#35516c] bg-[#06111e]/70 p-8 text-center"><ShieldCheck className="mx-auto h-7 w-7 text-slate-600" /><p className="mt-3 text-sm font-semibold text-slate-300">{title}</p><p className="mt-2 text-xs text-slate-500">{description}</p></div>;
}

function SectionTitle({ icon: Icon, title, suffix }: { icon: typeof Zap; title: string; suffix?: string }) {
  return <div className="flex items-center gap-2 border-b border-[#1d3248] pb-2"><span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" /><Icon className="h-3.5 w-3.5 text-cyan-300" /><h2 className="font-mono text-[10px] tracking-[0.16em] text-slate-300">{title}</h2>{suffix && <span className="ml-auto font-mono text-[9px] tracking-[0.12em] text-cyan-400">{suffix}</span>}</div>;
}
