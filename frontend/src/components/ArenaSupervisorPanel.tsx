import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Check,
  ChevronRight,
  Gamepad2,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Users,
  X,
  Zap,
  TrendingUp,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useToast } from "@/hooks/use-toast";
import {
  arenaApi,
  ArenaGameType,
  ArenaOperator,
  ArenaSavedTeam,
  ArenaProductionTracking,
  ArenaSupervisorDashboard,
  ArenaSession,
} from "@/services/arenaApi";
import ArenaWaitingRoom from "@/components/ArenaWaitingRoom";
import ArenaQuizBuilder from "@/components/ArenaQuizBuilder";
import ArenaBingoBuilder from "@/components/ArenaBingoBuilder";

interface ArenaSupervisorPanelProps {
  onClose: () => void;
}

type WizardStep = 1 | 2 | 3 | 4;

type AudiencePreviewOperator = ArenaOperator & {
  origins: string[];
};

const getErrorMessage = (error: unknown) => {
  const candidate = error as { response?: { data?: { erro?: string } } };
  return candidate.response?.data?.erro || "Não foi possível concluir a operação.";
};

export default function ArenaSupervisorPanel({
  onClose,
}: ArenaSupervisorPanelProps) {
  const { toast } = useToast();
  const [dashboard, setDashboard] = useState<ArenaSupervisorDashboard | null>(null);
  const [gameTypes, setGameTypes] = useState<ArenaGameType[]>([]);
  const [costCenters, setCostCenters] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState<WizardStep>(1);
  const [saving, setSaving] = useState(false);
  const [campaignId, setCampaignId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [gameType, setGameType] = useState("QUIZ_AO_VIVO");
  const [scheduledAt, setScheduledAt] = useState("");
  const [selectedCenters, setSelectedCenters] = useState<string[]>([]);
  const [selectedCpfs, setSelectedCpfs] = useState<string[]>([]);
  const [operatorCenter, setOperatorCenter] = useState("");
  const [operatorSearch, setOperatorSearch] = useState("");
  const [operators, setOperators] = useState<ArenaOperator[]>([]);
  const [selectedOperators, setSelectedOperators] = useState<ArenaOperator[]>([]);
  const [centerOperators, setCenterOperators] = useState<Record<string, ArenaOperator[]>>({});
  const [loadingCenters, setLoadingCenters] = useState<string[]>([]);
  const [excludedCpfs, setExcludedCpfs] = useState<string[]>([]);
  const [loadingOperators, setLoadingOperators] = useState(false);
  const [savedTeams, setSavedTeams] = useState<ArenaSavedTeam[]>([]);
  const [productionTracking, setProductionTracking] = useState<ArenaProductionTracking | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [audienceCount, setAudienceCount] = useState(0);
  const [activeSession, setActiveSession] = useState<ArenaSession | null>(null);
  const [openingRoom, setOpeningRoom] = useState<number | null>(null);
  const [verArquivadas, setVerArquivadas] = useState(false);
  const [arquivando, setArquivando] = useState<number | null>(null);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [dashboardData, typeData, centerData, teamData] = await Promise.all([
        arenaApi.getSupervisorDashboard(verArquivadas),
        arenaApi.getGameTypes(),
        arenaApi.getCostCenters(),
        arenaApi.getSavedTeams(),
      ]);
      setDashboard(dashboardData);
      setGameTypes(typeData);
      setCostCenters(centerData);
      setSavedTeams(teamData);
      if (typeData.length && !typeData.some((item) => item.codigo === gameType)) {
        setGameType(typeData[0].codigo);
      }
    } catch (error) {
      toast({
        title: "Arena indisponível",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
    // Recarrega ao alternar entre ativas e arquivadas: a lista vem filtrada
    // do servidor, não escondida no cliente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verArquivadas]);

  const alternarArquivo = async (
    idCampanha: number,
    arquivada: boolean,
  ) => {
    setArquivando(idCampanha);
    try {
      if (arquivada) {
        await arenaApi.unarchiveCampaign(idCampanha);
      } else {
        await arenaApi.archiveCampaign(idCampanha);
      }
      await loadDashboard();
    } catch (error) {
      const candidato = error as { response?: { data?: { erro?: string } } };
      toast({
        title: arquivada
          ? "Não consegui desarquivar"
          : "Não consegui arquivar",
        description: candidato.response?.data?.erro || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setArquivando(null);
    }
  };

  useEffect(() => {
    const normalizedSearch = operatorSearch.trim();
    if (
      !wizardOpen
      || step !== 3
      || (!operatorCenter && normalizedSearch.length < 2)
    ) {
      setOperators([]);
      setLoadingOperators(false);
      return;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoadingOperators(true);
      try {
        const result = await arenaApi.getOperators(operatorCenter, normalizedSearch);
        if (active) setOperators(result);
      } catch (error) {
        if (active) {
          toast({
            title: "Operadores não carregados",
            description: getErrorMessage(error),
            variant: "destructive",
          });
        }
      } finally {
        if (active) setLoadingOperators(false);
      }
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [operatorCenter, operatorSearch, step, toast, wizardOpen]);

  const centerMemberCpfs = useMemo(() => new Set(
    selectedCenters.flatMap((center) => centerOperators[center] || [])
      .map((operator) => String(operator.cpf)),
  ), [centerOperators, selectedCenters]);

  const excludedCpfSet = useMemo(
    () => new Set(excludedCpfs),
    [excludedCpfs],
  );

  const audiencePreview = useMemo(() => {
    const preview = new Map<string, AudiencePreviewOperator>();
    selectedCenters.forEach((center) => {
      (centerOperators[center] || []).forEach((operator) => {
        const cpf = String(operator.cpf);
        const current = preview.get(cpf);
        preview.set(cpf, {
          ...operator,
          cpf,
          origins: current
            ? Array.from(new Set([...current.origins, center]))
            : [center],
        });
      });
    });
    selectedOperators.forEach((operator) => {
      const cpf = String(operator.cpf);
      const current = preview.get(cpf);
      preview.set(cpf, {
        ...operator,
        cpf,
        origins: current
          ? Array.from(new Set([...current.origins, "INDIVIDUAL"]))
          : ["INDIVIDUAL"],
      });
    });
    return Array.from(preview.values()).sort((left, right) =>
      left.nome.localeCompare(right.nome, "pt-BR"),
    );
  }, [centerOperators, selectedCenters, selectedOperators]);

  const includedAudienceCount = useMemo(
    () => audiencePreview.filter((operator) => !excludedCpfSet.has(operator.cpf)).length,
    [audiencePreview, excludedCpfSet],
  );

  const loadingSelectedCenters = selectedCenters.some((center) =>
    loadingCenters.includes(center),
  );

  const resetWizard = () => {
    setStep(1);
    setCampaignId(null);
    setTitle("");
    setDescription("");
    setGameType(gameTypes[0]?.codigo || "QUIZ_AO_VIVO");
    setScheduledAt("");
    setSelectedCenters([]);
    setSelectedCpfs([]);
    setOperatorCenter("");
    setOperatorSearch("");
    setOperators([]);
    setSelectedOperators([]);
    setCenterOperators({});
    setLoadingCenters([]);
    setExcludedCpfs([]);
    setAudienceCount(0);
  };

  const openWizard = () => {
    resetWizard();
    setWizardOpen(true);
  };

  const createDraft = async () => {
    if (title.trim().length < 3) {
      toast({ title: "Informe um título para a campanha." });
      return;
    }
    setSaving(true);
    try {
      const campaign = await arenaApi.createCampaign({
        titulo: title.trim(),
        descricao: description.trim(),
        tipo_jogo: gameType,
        data_agendada: scheduledAt || null,
        configuracao: { janela_entrada_segundos: 300 },
      });
      setCampaignId(campaign.id);
      setStep(2);
      toast({
        title: "Rascunho criado",
        description: gameType === "BINGO"
          ? "Agora configure as regras do Bingo."
          : "Agora monte as perguntas do Quiz.",
      });
    } catch (error) {
      toast({
        title: "Não foi possível criar a campanha",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const saveAudience = async () => {
    if (!campaignId) return;
    if (loadingSelectedCenters) {
      toast({ title: "Aguarde o carregamento dos operadores." });
      return;
    }
    if (!includedAudienceCount) {
      toast({ title: "Selecione ao menos um público." });
      return;
    }
    setSaving(true);
    try {
      const result = await arenaApi.saveAudience(campaignId, {
        centros_custo: selectedCenters,
        cpfs: selectedCpfs,
        cpfs_excluidos: excludedCpfs,
      });
      setAudienceCount(result.participantes);
      setSavedTeams(await arenaApi.getSavedTeams());
      setStep(4);
    } catch (error) {
      toast({
        title: "Não foi possível salvar o público",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const publishCampaign = async () => {
    if (!campaignId) return;
    setSaving(true);
    try {
      const result = await arenaApi.publishCampaign(campaignId);
      toast({
        title: "Convites enviados",
        description: `${result.convites_enviados} participante(s) receberam a campanha.`,
      });
      setWizardOpen(false);
      resetWizard();
      await loadDashboard();
    } catch (error) {
      toast({
        title: "Não foi possível publicar",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const openRoom = async (campaignId: number, sessionId?: number | null) => {
    setOpeningRoom(campaignId);
    try {
      const state = sessionId
        ? await arenaApi.getSession(sessionId)
        : await arenaApi.openRoom(campaignId);
      setActiveSession(state);
      await loadDashboard();
    } catch (error) {
      toast({
        title: "Não foi possível abrir a sala",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setOpeningRoom(null);
    }
  };

  const resumeDraft = (campaign: ArenaSupervisorDashboard["campanhas"][number]) => {
    setCampaignId(campaign.id);
    setTitle(campaign.titulo);
    setDescription(campaign.descricao || "");
    setGameType(campaign.tipo_jogo);
    setScheduledAt(
      campaign.data_agendada
        ? campaign.data_agendada.slice(0, 16)
        : "",
    );
    setSelectedCenters([]);
    setSelectedCpfs([]);
    setSelectedOperators([]);
    setCenterOperators({});
    setLoadingCenters([]);
    setExcludedCpfs([]);
    setAudienceCount(campaign.participantes || 0);
    setStep(2);
    setWizardOpen(true);
  };

  const loadCenterOperators = async (center: string) => {
    if (centerOperators[center] || loadingCenters.includes(center)) return;
    setLoadingCenters((current) => [...current, center]);
    try {
      const result = await arenaApi.getOperators(center, "", 500);
      setCenterOperators((current) => ({
        ...current,
        [center]: result.map((operator) => ({
          ...operator,
          cpf: String(operator.cpf),
        })),
      }));
    } catch (error) {
      setSelectedCenters((current) => current.filter((item) => item !== center));
      toast({
        title: "Operadores não carregados",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setLoadingCenters((current) => current.filter((item) => item !== center));
    }
  };

  const toggleCenter = (center: string) => {
    if (selectedCenters.includes(center)) {
      const remainingCenters = selectedCenters.filter((item) => item !== center);
      const removedMemberCpfs = new Set(
        (centerOperators[center] || []).map((operator) => String(operator.cpf)),
      );
      const remainingMemberCpfs = new Set(
        remainingCenters.flatMap((item) => centerOperators[item] || [])
          .map((operator) => String(operator.cpf)),
      );
      setSelectedCenters(remainingCenters);
      setExcludedCpfs((current) => current.filter((cpf) =>
        !removedMemberCpfs.has(cpf) || remainingMemberCpfs.has(cpf),
      ));
      return;
    }
    setSelectedCenters((current) => [...current, center]);
    void loadCenterOperators(center);
  };

  const toggleOperator = (operator: ArenaOperator) => {
    const cpf = String(operator.cpf);
    const selected = selectedCpfs.includes(cpf);
    setSelectedCpfs((current) =>
      selected
        ? current.filter((item) => item !== cpf)
        : [...current, cpf],
    );
    setSelectedOperators((current) =>
      selected
        ? current.filter((item) => item.cpf !== cpf)
        : [...current, { ...operator, cpf }],
    );
    if (!selected) {
      setExcludedCpfs((current) => current.filter((item) => item !== cpf));
    }
  };

  const removeAudienceOperator = (operator: ArenaOperator) => {
    const cpf = String(operator.cpf);
    setSelectedCpfs((current) => current.filter((item) => item !== cpf));
    setSelectedOperators((current) => current.filter((item) => item.cpf !== cpf));
    if (centerMemberCpfs.has(cpf)) {
      setExcludedCpfs((current) => current.includes(cpf) ? current : [...current, cpf]);
    }
  };

  const restoreAudienceOperator = (operator: ArenaOperator) => {
    const cpf = String(operator.cpf);
    setExcludedCpfs((current) => current.filter((item) => item !== cpf));
  };

  const loadSavedTeam = (team: ArenaSavedTeam) => {
    const members = Array.from(
      new Map(team.integrantes.map((member) => [String(member.cpf), {
        ...member,
        cpf: String(member.cpf),
      }])).values(),
    );
    setSelectedCenters([]);
    setSelectedCpfs(members.map((member) => member.cpf));
    setSelectedOperators(members);
    setCenterOperators({});
    setLoadingCenters([]);
    setExcludedCpfs([]);
    toast({
      title: "Equipe carregada",
      description: `${members.length} integrante(s) de ${team.carteira_nome}.`,
    });
  };

  const summaryCards = useMemo(
    () => [
      ["Campanhas ativas", dashboard?.resumo.campanhas_ativas || 0],
      ["Salas agendadas", dashboard?.resumo.salas_agendadas || 0],
      ["Participantes", dashboard?.resumo.participantes || 0],
      ["XP distribuído", dashboard?.resumo.xp_distribuido || 0],
    ],
    [dashboard],
  );
  const runningCampaign = useMemo(
    () => dashboard?.campanhas.find(
      (campaign) =>
        campaign.status === "SALA_ABERTA"
        || campaign.status === "EM_ANDAMENTO"
        || campaign.status_sessao === "AGUARDANDO"
        || campaign.status_sessao === "EM_ANDAMENTO",
    ),
    [dashboard],
  );
  const trackingChart = useMemo(
    () => productionTracking?.snapshots.map((snapshot) => ({
      hora: new Date(snapshot.coletado_em).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      acordos: snapshot.resultado.acordos_dia,
      pagamentos: snapshot.resultado.pagamentos_dia,
      cpc: snapshot.resultado.cpc_dia,
    })) || [],
    [productionTracking],
  );

  useEffect(() => {
    if (!runningCampaign) {
      setProductionTracking(null);
      setTrackingError(null);
      return;
    }
    let active = true;
    const loadTracking = async () => {
      if (active) setTrackingLoading(true);
      try {
        const result = await arenaApi.getProductionTracking(runningCampaign.id);
        if (active) {
          setProductionTracking(result);
          setTrackingError(null);
        }
      } catch (error) {
        if (active) setTrackingError(getErrorMessage(error));
      } finally {
        if (active) setTrackingLoading(false);
      }
    };
    void loadTracking();
    const timer = window.setInterval(() => void loadTracking(), 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [runningCampaign?.id]);

  return (
    <div
      data-tour="arena-supervisor"
      className="fixed inset-0 z-[80] overflow-hidden bg-[#020711]/98 p-0 text-slate-100 backdrop-blur-md md:p-3"
    >
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden border border-[#233b54]/80 bg-[#030b16] shadow-[0_25px_80px_rgba(0,0,0,.55)] md:rounded-2xl">
        <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(34,211,238,.7)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,.7)_1px,transparent_1px)] [background-size:36px_36px]" />
        <header className="relative z-10 flex h-16 shrink-0 items-center gap-3 border-b border-[#1d3248] bg-[#020a14]/95 px-4 md:px-6">
          <div className="grid h-9 w-9 place-items-center rounded-lg border border-orange-500/60 bg-orange-500/10 text-orange-400">
            <Gamepad2 className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-[0.08em] text-white">
              <span className="text-orange-500">ARENA</span> AURORA
            </h1>
            <p className="font-mono text-[8px] tracking-[0.16em] text-cyan-400">
              CENTRAL DO SUPERVISOR
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadDashboard()}
            className="ml-auto grid h-9 w-9 place-items-center rounded-lg border border-[#2a4159] text-slate-400 hover:border-cyan-400/50 hover:text-cyan-300"
            aria-label="Atualizar"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-lg border border-[#2a4159] text-slate-400 hover:border-orange-500/50 hover:text-orange-300"
            aria-label="Fechar Arena"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <main className="relative z-10 min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mx-auto max-w-[1400px] space-y-5">
            <section className="flex flex-col gap-4 rounded-2xl border border-cyan-400/25 bg-gradient-to-r from-[#0b2744] to-[#06111e] p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-mono text-[9px] tracking-[0.18em] text-cyan-300">
                  GESTÃO DE EXPERIÊNCIAS
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  Campanhas da sua equipe
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-slate-400">
                  Monte o jogo, escolha os operadores e envie os convites em um fluxo guiado.
                </p>
              </div>
              <button
                type="button"
                data-tour="arena-nova-campanha"
                onClick={openWizard}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 text-xs font-bold text-white shadow-[0_0_24px_rgba(249,115,22,.2)] hover:bg-orange-400"
              >
                <Plus className="h-4 w-4" /> NOVA CAMPANHA
              </button>
            </section>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {summaryCards.map(([label, value]) => (
                <div key={label} className="rounded-xl border border-[#263e58] bg-[#071421] p-4">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{label}</p>
                  <strong className="mt-2 block text-2xl text-cyan-200">{value}</strong>
                </div>
              ))}
            </section>

            {runningCampaign && (
              <section className="flex flex-col gap-4 rounded-2xl border border-orange-400/40 bg-gradient-to-r from-orange-500/15 via-[#0b2744] to-[#06111e] p-5 shadow-[0_0_32px_rgba(249,115,22,.08)] md:flex-row md:items-center">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-orange-400/50 bg-orange-400/10 text-orange-300">
                  <Play className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[9px] tracking-[0.18em] text-orange-300">
                    PARTIDA EM ANDAMENTO
                  </p>
                  <h3 className="mt-1 truncate text-lg font-semibold text-white">
                    {runningCampaign.titulo}
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">
                    A partida continua ativa. Você pode retomar o controle sem reiniciar a sala.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={openingRoom === runningCampaign.id}
                  onClick={() => void openRoom(
                    runningCampaign.id,
                    runningCampaign.id_sessao,
                  )}
                  className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 text-xs font-bold text-white shadow-[0_0_24px_rgba(249,115,22,.2)] hover:bg-orange-400 disabled:opacity-50"
                >
                  {openingRoom === runningCampaign.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  RETOMAR PARTIDA
                </button>
              </section>
            )}

            {runningCampaign && (
              <section className="rounded-2xl border border-cyan-400/25 bg-[#06111e]/95 p-4 md:p-5">
                <div className="flex flex-wrap items-start gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-400/35 bg-cyan-400/10 text-cyan-300">
                    <TrendingUp className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-mono text-[9px] tracking-[0.18em] text-cyan-300">PRODUÇÃO EM TEMPO REAL</p>
                    <h3 className="mt-1 text-base font-semibold text-white">Evolução hora a hora da equipe</h3>
                  </div>
                  <span className="ml-auto rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-[10px] text-emerald-300">
                    {productionTracking?.snapshots.length || 0} coleta(s)
                  </span>
                </div>

                {productionTracking && productionTracking.snapshots.length > 0 && (() => {
                  const latest = productionTracking.snapshots[productionTracking.snapshots.length - 1];
                  const variation = latest.variacao_inicial;
                  const cards = [
                    ["Acordos hoje", latest.resultado.acordos_dia, variation.acordos_dia?.percentual],
                    ["Valor fechado", latest.resultado.valor_fechado_dia.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), variation.valor_fechado_dia?.percentual],
                    ["Pagamentos", latest.resultado.pagamentos_dia, variation.pagamentos_dia?.percentual],
                    ["CPC", latest.resultado.cpc_dia, variation.cpc_dia?.percentual],
                  ];
                  return (
                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {cards.map(([label, value, percentage]) => (
                        <div key={String(label)} className="rounded-xl border border-[#263e58] bg-[#071421] p-4">
                          <p className="text-[9px] uppercase tracking-[.12em] text-slate-500">{label}</p>
                          <strong className="mt-2 block text-lg text-white">{value}</strong>
                          <span className={`mt-1 block text-[10px] ${typeof percentage === "number" && percentage > 0 ? "text-emerald-300" : "text-slate-500"}`}>
                            {typeof percentage === "number" ? `${percentage > 0 ? "+" : ""}${percentage}% desde o início` : "Base inicial sem variação"}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                <div className="mt-5 h-72 rounded-xl border border-[#20364c] bg-[#030b16] p-3">
                  {trackingLoading && !trackingChart.length ? (
                    <div className="grid h-full place-items-center text-cyan-300"><Loader2 className="h-6 w-6 animate-spin" /></div>
                  ) : trackingError ? (
                    <div className="grid h-full place-items-center px-6 text-center text-xs text-red-300">{trackingError}</div>
                  ) : !trackingChart.length ? (
                    <div className="grid h-full place-items-center px-6 text-center text-xs text-slate-500">Aguardando a primeira coleta de produção da campanha.</div>
                  ) : <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trackingChart} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                      <CartesianGrid stroke="#1e3448" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="hora" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: "#071421", border: "1px solid #29455f", borderRadius: 12, fontSize: 11 }} />
                      <Line type="monotone" dataKey="acordos" name="Acordos" stroke="#f97316" strokeWidth={2.5} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="pagamentos" name="Pagamentos" stroke="#34d399" strokeWidth={2.5} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="cpc" name="CPC" stroke="#22d3ee" strokeWidth={2.5} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>}
                </div>
                <p className="mt-3 text-[10px] text-slate-500">Uma nova fotografia é registrada ao mudar a hora. O painel consulta atualizações a cada minuto.</p>
              </section>
            )}

            <section className="rounded-2xl border border-[#263e58] bg-[#06111e]/95 p-4 md:p-5">
              <div className="flex items-center gap-2 border-b border-[#1d3248] pb-3">
                <ShieldCheck className="h-4 w-4 text-cyan-300" />
                <h3 className="text-sm font-semibold text-white">
                  {verArquivadas ? "Campanhas arquivadas" : "Campanhas recentes"}
                </h3>
                <span className="ml-auto text-[10px] text-slate-500">
                  {dashboard?.campanhas.length || 0} REGISTROS
                </span>
                <button
                  type="button"
                  onClick={() => setVerArquivadas((atual) => !atual)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[9px] font-bold transition ${
                    verArquivadas
                      ? "border-cyan-400/45 bg-cyan-400/10 text-cyan-200"
                      : "border-[#2a4159] text-slate-400 hover:border-cyan-400/40 hover:text-cyan-300"
                  }`}
                >
                  <Archive className="h-3.5 w-3.5" />
                  {verArquivadas ? "VER ATIVAS" : "VER ARQUIVADAS"}
                </button>
              </div>
              {loading ? (
                <div className="grid min-h-52 place-items-center text-cyan-300">
                  <Loader2 className="h-7 w-7 animate-spin" />
                </div>
              ) : !dashboard?.campanhas.length ? (
                <div className="grid min-h-52 place-items-center text-center">
                  <div>
                    <Gamepad2 className="mx-auto h-8 w-8 text-slate-600" />
                    <p className="mt-3 text-sm text-slate-400">Nenhuma campanha criada.</p>
                  </div>
                </div>
              ) : (
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  {dashboard.campanhas.map((campaign) => (
                    <article key={campaign.id} className="rounded-xl border border-[#20364c] bg-[#071421] p-4">
                      <div className="flex items-start gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-cyan-400/35 bg-cyan-400/5 text-cyan-300">
                          <Zap className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-white">{campaign.titulo}</p>
                          <p className="mt-1 text-[10px] text-slate-500">{campaign.tipo_jogo_nome}</p>
                        </div>
                        <span className="rounded border border-orange-400/30 bg-orange-400/5 px-2 py-1 text-[9px] text-orange-300">
                          {campaign.status}
                        </span>
                      </div>
                      <div className="mt-4 flex gap-5 border-t border-[#20364c] pt-3 text-[10px] text-slate-400">
                        <span>{campaign.participantes} participantes</span>
                        <span>{campaign.confirmados} confirmados</span>
                        {["PUBLICADA", "SALA_ABERTA", "EM_ANDAMENTO", "FINALIZADA"].includes(campaign.status) && (
                          <button
                            type="button"
                            disabled={openingRoom === campaign.id}
                            onClick={() =>
                              void openRoom(campaign.id, campaign.id_sessao)
                            }
                            className="ml-auto inline-flex items-center gap-1.5 font-semibold text-orange-300 hover:text-orange-200 disabled:opacity-50"
                          >
                            {openingRoom === campaign.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Play className="h-3 w-3" />
                            )}
                            {campaign.status_sessao === "FINALIZADA"
                              ? "VER RESULTADO"
                              : campaign.status === "EM_ANDAMENTO"
                                || campaign.status_sessao === "EM_ANDAMENTO"
                                ? "RETOMAR PARTIDA"
                                : campaign.id_sessao
                                  ? "ACOMPANHAR SALA"
                                  : "ABRIR SALA"}
                          </button>
                        )}
                        {campaign.status === "RASCUNHO" && (
                          <button
                            type="button"
                            onClick={() => resumeDraft(campaign)}
                            className="ml-auto inline-flex items-center gap-1.5 font-semibold text-cyan-300 hover:text-cyan-200"
                          >
                            <ChevronRight className="h-3 w-3" />
                            CONTINUAR CONFIGURAÇÃO
                          </button>
                        )}
                      </div>
                      {/*
                        Arquivar tira das listas dos dois lados. Não aparece
                        com jogo rolando: sumir no meio da partida tiraria a
                        tela de quem está jogando.
                      */}
                      {!["SALA_ABERTA", "EM_ANDAMENTO"].includes(
                        campaign.status,
                      ) && (
                        <button
                          type="button"
                          disabled={arquivando === campaign.id}
                          onClick={() =>
                            void alternarArquivo(
                              campaign.id,
                              campaign.status === "ARQUIVADA",
                            )
                          }
                          className="mt-2 inline-flex items-center gap-1.5 text-[9px] font-semibold text-slate-500 transition hover:text-slate-300 disabled:opacity-50"
                        >
                          {arquivando === campaign.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : campaign.status === "ARQUIVADA" ? (
                            <ArchiveRestore className="h-3 w-3" />
                          ) : (
                            <Archive className="h-3 w-3" />
                          )}
                          {campaign.status === "ARQUIVADA"
                            ? "DESARQUIVAR"
                            : "ARQUIVAR"}
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </main>

        {wizardOpen && (
          <div className="absolute inset-0 z-30 flex justify-end bg-black/70 backdrop-blur-sm">
            <div
              data-tour="arena-wizard"
              className="flex h-full w-full max-w-2xl flex-col border-l border-cyan-400/25 bg-[#040d19] shadow-2xl"
            >
              <div className="flex h-16 shrink-0 items-center gap-3 border-b border-[#20364c] px-5">
                {step > 2 && (
                  <button type="button" onClick={() => setStep((step - 1) as WizardStep)} className="text-slate-400 hover:text-cyan-300">
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                )}
                <div>
                  <p className="font-mono text-[9px] tracking-[0.16em] text-orange-400">ETAPA {step} DE 4</p>
                  <h3 className="mt-1 text-sm font-semibold text-white">
                    {step === 1
                      ? "Defina a campanha"
                      : step === 2
                        ? gameType === "BINGO" ? "Configure o Bingo" : "Monte o Quiz"
                        : step === 3
                          ? "Escolha o público"
                          : "Revise e publique"}
                  </h3>
                </div>
                <button type="button" onClick={() => setWizardOpen(false)} className="ml-auto text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex gap-2 px-5 pt-4">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className={`h-1 flex-1 rounded-full ${item <= step ? "bg-gradient-to-r from-orange-500 to-cyan-400" : "bg-slate-800"}`} />
                ))}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                {step === 1 && (
                  <div className="space-y-5">
                    <Field label="TIPO DE JOGO">
                      <div className="grid gap-2 sm:grid-cols-2">
                        {gameTypes.map((game) => (
                          <button key={game.codigo} type="button" disabled={!['QUIZ_AO_VIVO', 'BINGO'].includes(game.codigo)} onClick={() => setGameType(game.codigo)} className={`rounded-xl border p-3 text-left disabled:cursor-not-allowed disabled:opacity-45 ${gameType === game.codigo ? "border-cyan-400 bg-cyan-400/10" : "border-[#263e58] bg-[#071421]"}`}>
                            <p className="flex items-center gap-2 text-xs font-semibold text-white">
                              {game.nome}
                              {!['QUIZ_AO_VIVO', 'BINGO'].includes(game.codigo) && (
                                <span className="rounded border border-slate-600 px-1.5 py-0.5 text-[8px] text-slate-500">EM BREVE</span>
                              )}
                            </p>
                            <p className="mt-1 text-[10px] text-slate-500">{game.descricao}</p>
                          </button>
                        ))}
                      </div>
                    </Field>
                    <Field label="TÍTULO">
                      <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} placeholder="Ex.: Desafio de negociação — Equipe Vega" className="arena-input" />
                    </Field>
                    <Field label="DESCRIÇÃO">
                      <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} placeholder="Explique o objetivo da campanha..." className="arena-input resize-none" />
                    </Field>
                    <Field label="AGENDAMENTO (OPCIONAL)">
                      <input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} className="arena-input [color-scheme:dark]" />
                    </Field>
                  </div>
                )}

                {step === 2 && campaignId && (
                  gameType === "BINGO" ? (
                    <ArenaBingoBuilder
                      campaignId={campaignId}
                      onSaved={() => setStep(3)}
                    />
                  ) : (
                    <ArenaQuizBuilder
                      campaignId={campaignId}
                      onSaved={() => setStep(3)}
                    />
                  )
                )}

                {step === 3 && (
                  <div className="space-y-6">
                    {!!savedTeams.length && (
                      <section>
                        <h4 className="text-xs font-semibold text-white">Carregar equipe salva</h4>
                        <p className="mt-1 text-[10px] text-slate-500">Recupere a última composição salva e ajuste os participantes se necessário.</p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {savedTeams.map((team) => (
                            <button key={team.id} type="button" onClick={() => loadSavedTeam(team)} className="flex items-center gap-3 rounded-lg border border-violet-400/30 bg-violet-400/5 p-3 text-left hover:border-violet-400/60">
                              <Users className="h-5 w-5 text-violet-300" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-xs font-semibold text-white">{team.carteira_nome}</span>
                                <span className="mt-1 block text-[9px] text-slate-500">{team.integrantes.length} integrante(s)</span>
                              </span>
                            </button>
                          ))}
                        </div>
                      </section>
                    )}
                    <section>
                      <h4 className="text-xs font-semibold text-white">Adicionar Centro de Custo completo</h4>
                      <p className="mt-1 text-[10px] text-slate-500">Todos os operadores ativos do Centro de Custo serão incluídos.</p>
                      <div className="mt-3 grid max-h-52 gap-2 overflow-y-auto sm:grid-cols-2">
                        {costCenters.map((center) => {
                          const selected = selectedCenters.includes(center);
                          const centerLoading = loadingCenters.includes(center);
                          const members = centerOperators[center];
                          return (
                            <button key={center} type="button" onClick={() => toggleCenter(center)} className={`flex items-center gap-3 rounded-lg border p-3 text-left text-xs ${selected ? "border-orange-400/60 bg-orange-400/10 text-white" : "border-[#263e58] bg-[#071421] text-slate-300"}`}>
                              <span className={`grid h-5 w-5 shrink-0 place-items-center rounded border ${selected ? "border-orange-400 bg-orange-400 text-white" : "border-slate-600"}`}>
                                {centerLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : selected && <Check className="h-3 w-3" />}
                              </span>
                              <span className="min-w-0 flex-1 truncate">{center}</span>
                              {selected && members && (
                                <span className="shrink-0 rounded-full bg-orange-400/15 px-2 py-1 font-mono text-[9px] text-orange-200">
                                  {members.length}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </section>
                    {!!audiencePreview.length && (
                      <section className="rounded-xl border border-cyan-400/25 bg-cyan-400/5 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h4 className="text-xs font-semibold text-white">Composição do público</h4>
                            <p className="mt-1 text-[10px] text-slate-400">
                              Revise o lote e retire quem não participará desta campanha.
                            </p>
                          </div>
                          <div className="text-right">
                            <strong className="block text-lg text-cyan-200">{includedAudienceCount}</strong>
                            <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-slate-500">incluídos</span>
                          </div>
                        </div>
                        {loadingSelectedCenters && (
                          <div className="mt-3 flex items-center gap-2 rounded-lg border border-cyan-400/15 bg-[#03101c] px-3 py-2 text-[10px] text-cyan-200">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando operadores do Centro de Custo...
                          </div>
                        )}
                        <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                          {audiencePreview.map((operator) => {
                            const excluded = excludedCpfSet.has(operator.cpf);
                            const individual = operator.origins.includes("INDIVIDUAL");
                            return (
                              <div key={operator.cpf} className={`flex items-center gap-3 rounded-lg border p-3 ${excluded ? "border-red-400/25 bg-red-400/5 opacity-70" : "border-[#263e58] bg-[#071421]"}`}>
                                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10px] font-semibold ${excluded ? "bg-red-400/10 text-red-200" : "bg-cyan-400/10 text-cyan-200"}`}>
                                  {operator.nome.split(" ").slice(0, 2).map((part) => part[0]).join("")}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className={`block truncate text-xs ${excluded ? "line-through text-slate-500" : "text-white"}`}>{operator.nome}</span>
                                  <span className="mt-1 block truncate text-[9px] text-slate-500">{operator.cpf} • {operator.centro_custo}</span>
                                </span>
                                <span className={`hidden shrink-0 rounded-full px-2 py-1 font-mono text-[8px] sm:inline ${individual ? "bg-violet-400/10 text-violet-200" : "bg-orange-400/10 text-orange-200"}`}>
                                  {individual ? "INDIVIDUAL" : "LOTE"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => excluded ? restoreAudienceOperator(operator) : removeAudienceOperator(operator)}
                                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${excluded ? "border-emerald-400/30 text-emerald-300 hover:bg-emerald-400/10" : "border-red-400/20 text-slate-500 hover:border-red-400/40 hover:text-red-300"}`}
                                  title={excluded ? `Reincluir ${operator.nome}` : `Retirar ${operator.nome}`}
                                >
                                  {excluded ? <Plus className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                        {!!excludedCpfs.length && (
                          <p className="mt-3 text-[9px] text-red-200/80">
                            {excludedCpfs.length} operador(es) retirado(s) deste convite.
                          </p>
                        )}
                      </section>
                    )}
                    <section className="border-t border-[#20364c] pt-5">
                      <h4 className="text-xs font-semibold text-white">Adicionar operadores individualmente</h4>
                      <p className="mt-1 text-[10px] text-slate-500">Digite ao menos dois caracteres para buscar em todos os Centros de Custo ou use o filtro.</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <select value={operatorCenter} onChange={(event) => setOperatorCenter(event.target.value)} className="arena-input">
                          <option value="">Todos os Centros de Custo</option>
                          {costCenters.map((center) => <option key={center} value={center}>{center}</option>)}
                        </select>
                        <label className="arena-input flex items-center gap-2">
                          <Search className="h-4 w-4 text-cyan-400" />
                          <input value={operatorSearch} onChange={(event) => setOperatorSearch(event.target.value)} placeholder="Buscar nome ou CPF" className="min-w-0 flex-1 bg-transparent outline-none" />
                        </label>
                      </div>
                      <div className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded-xl border border-[#20364c] bg-[#030b16]/80 p-2">
                        {loadingOperators ? (
                          <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin text-cyan-300" />
                        ) : !operatorCenter && operatorSearch.trim().length < 2 ? (
                          <div className="grid min-h-24 place-items-center px-4 text-center text-[10px] text-slate-500">
                            Comece a digitar o nome ou CPF do operador.
                          </div>
                        ) : !operators.length ? (
                          <div className="grid min-h-24 place-items-center px-4 text-center text-[10px] text-slate-500">
                            Nenhum operador ativo encontrado com esses filtros.
                          </div>
                        ) : operators.map((operator) => {
                          const cpf = String(operator.cpf);
                          const individuallySelected = selectedCpfs.includes(cpf);
                          const includedByCenter = centerMemberCpfs.has(cpf)
                            && !excludedCpfSet.has(cpf);
                          const unavailable = includedByCenter && !individuallySelected;
                          const selected = individuallySelected || includedByCenter;
                          return (
                            <button
                              key={cpf}
                              type="button"
                              disabled={unavailable}
                              onClick={() => toggleOperator({ ...operator, cpf })}
                              className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left ${selected ? "border-cyan-400/60 bg-cyan-400/10" : "border-[#263e58] bg-[#071421] hover:border-cyan-400/35"} disabled:cursor-default disabled:opacity-75`}
                            >
                              <span className={`grid h-5 w-5 place-items-center rounded border ${selected ? "border-cyan-400 bg-cyan-400 text-[#03101c]" : "border-slate-600"}`}>
                                {selected && <Check className="h-3 w-3" />}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-xs text-white">{operator.nome}</span>
                                <span className="mt-1 block truncate text-[9px] text-slate-500">{cpf} • {operator.centro_custo}</span>
                              </span>
                              {includedByCenter && (
                                <span className="shrink-0 rounded-full bg-orange-400/10 px-2 py-1 font-mono text-[8px] text-orange-200">
                                  JÁ NO LOTE
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  </div>
                )}

                {step === 4 && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-cyan-400/25 bg-cyan-400/5 p-5 text-center">
                      <ShieldCheck className="mx-auto h-9 w-9 text-cyan-300" />
                      <h4 className="mt-3 text-lg font-semibold text-white">Tudo pronto para publicar</h4>
                      <p className="mt-2 text-sm text-slate-400">{audienceCount} participante(s) receberão o convite.</p>
                    </div>
                    <div className="rounded-xl border border-[#263e58] bg-[#071421] p-4 text-xs text-slate-300">
                      <p><strong className="text-white">Campanha:</strong> {title}</p>
                      <p className="mt-2"><strong className="text-white">Jogo:</strong> {gameTypes.find((item) => item.codigo === gameType)?.nome}</p>
                      <p className="mt-2"><strong className="text-white">Entrada na sala:</strong> janela fixa de 5 minutos após a abertura pelo supervisor.</p>
                    </div>
                  </div>
                )}
              </div>

              {step !== 2 && (
              <div className="flex shrink-0 items-center justify-between border-t border-[#20364c] p-5">
                <span className="text-[10px] text-slate-500">
                  {step === 3 && `${includedAudienceCount} participante(s) • ${excludedCpfs.length} retirado(s)`}
                </span>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void (step === 1 ? createDraft() : step === 3 ? saveAudience() : publishCampaign())}
                  className="ml-auto inline-flex h-11 items-center gap-2 rounded-xl bg-orange-500 px-5 text-xs font-bold text-white hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : step === 4 ? <Send className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  {step === 1 ? "CRIAR RASCUNHO" : step === 3 ? "SALVAR PÚBLICO" : "PUBLICAR E CONVIDAR"}
                </button>
              </div>
              )}
            </div>
          </div>
        )}
        {activeSession && (
          <ArenaWaitingRoom
            initialSession={activeSession}
            onExit={() => {
              setActiveSession(null);
              void loadDashboard();
            }}
          />
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block font-mono text-[9px] tracking-[0.14em] text-cyan-300">{label}</span>
      {children}
    </label>
  );
}
