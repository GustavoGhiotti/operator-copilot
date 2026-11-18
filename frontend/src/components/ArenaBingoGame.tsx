import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Crown,
  Dices,
  Download,
  Grid3X3,
  History,
  Loader2,
  LogOut,
  Pause,
  Play,
  Radio,
  Search,
  Sparkles,
  Square,
  Trophy,
  UserRoundCog,
  Users,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  arenaApi,
  ArenaBingoCell,
  ArenaBingoWinningPattern,
  ArenaLiveBingoState,
  ArenaOperator,
} from "@/services/arenaApi";

interface ArenaBingoGameProps {
  sessionId: number;
  connected: boolean;
  refreshKey: number;
  /** Último número vindo direto do socket, antes da busca de estado. */
  ultimoSorteio?: { numero: number; letra: string; ordem: number } | null;
  onExit: () => void;
}

const columns = ["B", "I", "N", "G", "O"] as const;
const patternLabels: Record<ArenaBingoWinningPattern, string> = {
  LINHA: "UMA LINHA",
  DUAS_LINHAS: "DUAS LINHAS",
  QUATRO_CANTOS: "QUATRO CANTOS",
  CARTELA_CHEIA: "CARTELA CHEIA",
};

const getError = (error: unknown) => {
  const candidate = error as { response?: { data?: { erro?: string } } };
  return candidate.response?.data?.erro || "Não foi possível concluir a ação.";
};

const formatDuration = (start?: string | null, end?: string | null) => {
  if (!start || !end) return "tempo não disponível";
  const seconds = Math.max(0, Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / 1000,
  ));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}min ${seconds % 60}s`;
};

const isPatternCell = (pattern: ArenaBingoWinningPattern, index: number) => {
  if (pattern === "QUATRO_CANTOS") return [0, 4, 20, 24].includes(index);
  if (pattern === "LINHA") return index >= 10 && index < 15;
  if (pattern === "DUAS_LINHAS") {
    return (index >= 5 && index < 10) || (index >= 15 && index < 20);
  }
  return pattern === "CARTELA_CHEIA";
};

const playDrawSound = () => {
  const AudioContextClass = window.AudioContext
    || (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(520, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(760, context.currentTime + 0.16);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.24);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.25);
  oscillator.addEventListener("ended", () => void context.close());
};

export default function ArenaBingoGame({
  sessionId,
  connected,
  refreshKey,
  ultimoSorteio,
  onExit,
}: ArenaBingoGameProps) {
  const { toast } = useToast();
  const [state, setState] = useState<ArenaLiveBingoState | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [sorteandoDesempate, setSorteandoDesempate] = useState(false);
  const [pedrasReveladas, setPedrasReveladas] = useState<
    Array<{ id_participante: number; nome: string; pedra: number }>
  >([]);
  const [controlling, setControlling] = useState(false);
  const [drawReveal, setDrawReveal] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(
    () => localStorage.getItem("arenaBingoSound") === "on",
  );
  const [transferOpen, setTransferOpen] = useState(false);
  const [supervisorSearch, setSupervisorSearch] = useState("");
  const [supervisors, setSupervisors] = useState<ArenaOperator[]>([]);
  const [searchingSupervisors, setSearchingSupervisors] = useState(false);
  const [transferring, setTransferring] = useState<string | null>(null);
  const [continuationPattern, setContinuationPattern] = useState<ArenaBingoWinningPattern>("LINHA");
  const lastDrawIdRef = useRef<number | null>(null);
  const drawRevealTimerRef = useRef<number | null>(null);
  const soundEnabledRef = useRef(soundEnabled);

  const loadState = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setState(await arenaApi.getLiveBingo(sessionId));
    } catch (error) {
      if (!silent) {
        toast({
          title: "Não foi possível carregar o Bingo",
          description: getError(error),
          variant: "destructive",
        });
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [sessionId, toast]);

  useEffect(() => { void loadState(); }, [loadState]);
  useEffect(() => { if (refreshKey) void loadState(true); }, [loadState, refreshKey]);
  useEffect(() => {
    const timer = window.setInterval(() => void loadState(true), 3000);
    return () => window.clearInterval(timer);
  }, [loadState]);

  // Prefere o que veio pelo socket enquanto a busca de estado não alcança:
  // é o que faz o número aparecer junto para todos.
  const doEstado = state?.sorteios[0];
  const latest =
    ultimoSorteio && (!doEstado || ultimoSorteio.ordem > doEstado.ordem)
      ? { ...ultimoSorteio, id: -1, sorteado_em: "" }
      : doEstado;
  const latestDrawId = latest?.id ?? null;

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    if (latestDrawId === null) return;
    if (lastDrawIdRef.current === null) {
      lastDrawIdRef.current = latestDrawId;
      return;
    }
    if (lastDrawIdRef.current === latestDrawId) return;
    lastDrawIdRef.current = latestDrawId;

    if (drawRevealTimerRef.current !== null) {
      window.clearTimeout(drawRevealTimerRef.current);
    }

    setDrawReveal(true);
    if (soundEnabledRef.current) playDrawSound();
    drawRevealTimerRef.current = window.setTimeout(() => {
      setDrawReveal(false);
      drawRevealTimerRef.current = null;
    }, 900);
  }, [latestDrawId]);

  useEffect(() => () => {
    if (drawRevealTimerRef.current !== null) {
      window.clearTimeout(drawRevealTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (state?.aguardando_decisao) {
      setContinuationPattern(state.padrao_vitoria);
    }
  }, [state?.aguardando_decisao, state?.padrao_vitoria]);

  useEffect(() => {
    if (!transferOpen || supervisorSearch.trim().length < 2) {
      setSupervisors([]);
      return;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      setSearchingSupervisors(true);
      try {
        const result = await arenaApi.getSupervisors(supervisorSearch.trim());
        if (active) setSupervisors(result);
      } catch (error) {
        if (active) toast({ title: "Busca indisponível", description: getError(error), variant: "destructive" });
      } finally {
        if (active) setSearchingSupervisors(false);
      }
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [supervisorSearch, toast, transferOpen]);

  const card = useMemo(() => {
    if (!state) return [] as ArenaBingoCell[][];
    return Array.from({ length: 5 }, (_, row) =>
      columns.map((column) => state.cartela.find(
        (cell) => cell.coluna === column && cell.linha === row + 1,
      )).filter(Boolean) as ArenaBingoCell[],
    );
  }, [state]);

  const draw = async () => {
    setDrawing(true);
    try {
      setState(await arenaApi.drawBingoNumber(sessionId));
    } catch (error) {
      toast({ title: "Não foi possível sortear", description: getError(error), variant: "destructive" });
    } finally {
      setDrawing(false);
    }
  };

  const sortearDesempate = async () => {
    setSorteandoDesempate(true);
    try {
      const { desempate } = await arenaApi.drawBingoTiebreak(sessionId);
      // Uma pedra de cada vez: o suspense é a única coisa boa que um
      // desempate por sorte tem, e mostrar tudo junto joga isso fora.
      for (let indice = 0; indice < desempate.length; indice += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 900));
        setPedrasReveladas(desempate.slice(0, indice + 1));
      }
      await new Promise((resolve) => window.setTimeout(resolve, 1200));
      await loadState(true);
    } catch (error) {
      toast({
        title: "Não foi possível sortear",
        description: getError(error),
        variant: "destructive",
      });
    } finally {
      setSorteandoDesempate(false);
    }
  };

  const claim = async () => {
    setClaiming(true);
    try {
      setState(await arenaApi.claimBingo(sessionId));
      toast({
        title: "BINGO confirmado!",
        description: "Vitória registrada. O supervisor decidirá a próxima etapa.",
      });
    } catch (error) {
      toast({ title: "Bingo ainda não confirmado", description: getError(error), variant: "destructive" });
      void loadState(true);
    } finally {
      setClaiming(false);
    }
  };

  const control = async (
    action: "PAUSAR" | "RETOMAR" | "CONTINUAR" | "ENCERRAR",
    pattern?: ArenaBingoWinningPattern,
  ) => {
    if (action === "ENCERRAR" && !window.confirm(
      "Encerrar a partida agora? A classificação será consolidada e esta ação não poderá ser desfeita.",
    )) return;
    setControlling(true);
    try {
      setState(await arenaApi.controlBingo(sessionId, action, pattern));
      toast({
        title: action === "PAUSAR"
          ? "Partida pausada"
          : action === "RETOMAR"
            ? "Partida retomada"
            : action === "CONTINUAR"
              ? `Partida continua com ${patternLabels[pattern!]}`
              : "Partida encerrada",
      });
    } catch (error) {
      toast({ title: "Controle não aplicado", description: getError(error), variant: "destructive" });
    } finally {
      setControlling(false);
    }
  };

  const transfer = async (supervisor: ArenaOperator) => {
    if (!window.confirm(`Transferir o controle para ${supervisor.nome}? Você sairá da mesa de sorteio.`)) return;
    setTransferring(supervisor.cpf);
    try {
      await arenaApi.transferBingo(sessionId, supervisor.cpf);
      toast({ title: "Controle transferido", description: `${supervisor.nome} agora é responsável pela partida.` });
      onExit();
    } catch (error) {
      toast({ title: "Transferência não realizada", description: getError(error), variant: "destructive" });
    } finally {
      setTransferring(null);
    }
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem("arenaBingoSound", next ? "on" : "off");
    if (next) playDrawSound();
  };

  const exportResult = () => {
    if (!state) return;
    const rows = [
      ["Classificação", "Operador", "Centro de Custo", "Casas marcadas", "Pontos", "XP"],
      ...state.progresso.map((player) => [
        player.classificacao || "",
        player.nome,
        player.centro_custo,
        player.marcadas,
        player.pontos,
        player.xp,
      ]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `arena-bingo-${sessionId}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (loading || !state) {
    return <div className="fixed inset-0 z-[96] grid place-items-center bg-[#020711] text-violet-200"><div className="text-center"><Loader2 className="mx-auto h-9 w-9 animate-spin" /><p className="mt-4 font-mono text-xs tracking-[0.2em]">GERANDO SUA CARTELA</p></div></div>;
  }

  const finished = state.status_sessao === "FINALIZADA";
  const isSupervisor = state.papel === "SUPERVISOR";
  const closePlayers = state.progresso.filter(
    (player) => player.faltam_para_vencer > 0 && player.faltam_para_vencer <= 2,
  );
  const drawnNumbers = new Set(state.sorteios.map((drawItem) => drawItem.numero));
  const victories = state.vitorias || [];
  const disputaAberta = Boolean(state.disputa_aberta);
  const aguardandoDesempate = Boolean(state.aguardando_desempate);
  const empatados = victories.filter((item) => item.posicao === null);
  const currentVictoryRegistered = victories.some(
    (victory) => victory.id_participante === state.id_participante,
  );
  const latestVictory = victories[victories.length - 1];

  return (
    <div className="fixed inset-0 z-[96] overflow-y-auto bg-[#020711] p-3 text-slate-100">
      <div className="pointer-events-none fixed inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(34,211,238,.65)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,.65)_1px,transparent_1px)] [background-size:42px_42px]" />
      {drawReveal && latest && (
        <div className="pointer-events-none fixed inset-0 z-[110] grid place-items-center bg-[#020711]/75 backdrop-blur-sm">
          <div className="animate-[zoom-in_.35s_ease-out] text-center">
            <p className="font-mono text-xs tracking-[.3em] text-orange-300">NÚMERO SORTEADO</p>
            <div className="mt-5 grid h-48 w-48 place-items-center rounded-full border-4 border-orange-300 bg-gradient-to-br from-orange-400 to-orange-600 text-7xl font-black text-white shadow-[0_0_80px_rgba(249,115,22,.65)]">
              <span><small className="text-3xl">{latest.letra}</small>{latest.numero}</span>
            </div>
          </div>
        </div>
      )}
      <div className="relative mx-auto flex min-h-full max-w-[1500px] flex-col">
        <header className="flex flex-wrap items-center gap-3 rounded-xl border border-[#284963] bg-[#04101d]/95 px-4 py-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-violet-400/50 bg-violet-400/10 text-violet-200"><Grid3X3 className="h-5 w-5" /></span>
          <div><p className="font-mono text-[9px] tracking-[0.18em] text-cyan-300">ARENA AURORA</p><h1 className="mt-1 text-base font-semibold text-white">{state.titulo} · Bingo da Carteira</h1></div>
          <span className={`ml-auto inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[9px] ${state.pausada ? "border-amber-400/40 text-amber-300" : "border-cyan-400/30 text-cyan-200"}`}><Radio className={`h-3.5 w-3.5 ${connected && !state.pausada ? "animate-pulse" : ""}`} />{state.pausada ? "PARTIDA PAUSADA" : connected ? "TEMPO REAL ATIVO" : "RECUPERANDO CONEXÃO"}</span>
          <button type="button" onClick={toggleSound} className="grid h-10 w-10 place-items-center rounded-xl border border-[#2b435d] text-slate-300 hover:border-orange-400/50 hover:text-orange-300" aria-label={soundEnabled ? "Desativar som" : "Ativar som"}>{soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</button>
          <button type="button" onClick={onExit} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#2b435d] px-4 text-xs text-slate-300 hover:border-orange-400/50 hover:text-orange-300"><LogOut className="h-4 w-4" /> SAIR</button>
        </header>

        {state.pausada && !finished && <div className="mt-3 flex items-center gap-3 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-100"><Pause className="h-4 w-4 text-amber-300" /><span>{state.aguardando_decisao ? `${latestVictory?.nome || "Um participante"} completou ${patternLabels[latestVictory?.padrao || state.padrao_vitoria]}. Aguardando a decisão do supervisor.` : "O sorteio está temporariamente pausado pelo supervisor."}</span></div>}

        {finished ? (
          <main className="grid flex-1 gap-5 py-6 lg:grid-cols-[1fr_360px]">
            <section className="rounded-3xl border border-violet-400/30 bg-[#06111e]/95 p-6">
              <div className="text-center"><Trophy className="mx-auto h-12 w-12 text-orange-300" /><p className="mt-4 font-mono text-[10px] tracking-[.2em] text-violet-300">BINGO FINALIZADO</p><h2 className="mt-2 text-3xl font-bold text-white">Classificação final</h2><p className="mt-2 text-xs text-slate-400">{state.total_sorteios} números sorteados · {formatDuration(state.iniciada_em, state.finalizada_em)} · {state.encerramento_tipo === "MANUAL" ? "encerramento manual" : "Bingo confirmado"}</p></div>
              <div className="mt-7 space-y-2">{state.progresso.map((player, index) => <article key={player.id_participante} className={`grid grid-cols-[44px_1fr_auto] items-center gap-3 rounded-2xl border p-4 ${index === 0 ? "border-orange-400/50 bg-orange-400/10" : "border-[#263e58] bg-[#071421]"}`}><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#0c1d2e] font-bold text-cyan-200">{index === 0 ? <Crown className="h-5 w-5 text-orange-300" /> : `${player.classificacao}º`}</span><div><p className="text-sm font-semibold text-white">{player.nome}</p><p className="mt-1 text-[10px] text-slate-500">{player.marcadas} casas · {player.centro_custo}</p></div><strong className="text-emerald-300">+{player.xp} XP</strong></article>)}</div>
            </section>
            <aside className="rounded-3xl border border-orange-400/25 bg-[#071421] p-7 text-center"><Sparkles className="mx-auto h-9 w-9 text-orange-300" /><p className="mt-5 font-mono text-[9px] text-slate-400">{isSupervisor ? "RESULTADO CONSOLIDADO" : "SEU RESULTADO"}</p>{isSupervisor ? <button type="button" onClick={exportResult} className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 text-xs font-bold text-white hover:bg-orange-400"><Download className="h-4 w-4" /> EXPORTAR PARA EXCEL</button> : <><strong className="mt-4 block text-6xl text-white">{state.classificacao || "—"}<span className="text-2xl text-orange-300">º</span></strong><p className="mt-5 text-xl text-cyan-200">{state.pontuacao} pontos</p><div className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-5"><Zap className="mx-auto h-5 w-5 text-emerald-300" /><strong className="mt-2 block text-2xl text-emerald-200">+{state.xp_concedido} XP</strong></div></>}</aside>
          </main>
        ) : (
          <main className="grid flex-1 gap-5 py-5 lg:grid-cols-[minmax(0,1fr)_390px]">
            <section className="rounded-2xl border border-cyan-400/35 bg-[#06111e]/95 p-4 sm:p-6">
              {isSupervisor ? (
                <div className="flex min-h-[520px] flex-col items-center justify-center text-center">
                  <Dices className="h-14 w-14 text-violet-300" />
                  <p className="mt-5 font-mono text-[10px] tracking-[.2em] text-cyan-300">MESA DE SORTEIO</p>
                  {latest ? <><div className="mt-6 grid h-40 w-40 place-items-center rounded-full border-4 border-orange-300 bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-[0_0_55px_rgba(249,115,22,.38)]"><span className="text-6xl font-black"><small className="text-2xl">{latest.letra}</small>{latest.numero}</span></div><p className="mt-4 text-sm text-slate-400">Último número sorteado</p></> : <p className="mt-6 text-lg text-slate-400">Aguardando o primeiro sorteio</p>}
                  <button type="button" disabled={drawing || state.pausada || state.total_sorteios >= 75} onClick={() => void draw()} className="mt-8 inline-flex h-14 items-center gap-3 rounded-2xl bg-orange-500 px-10 text-sm font-bold text-white shadow-[0_0_30px_rgba(249,115,22,.3)] hover:bg-orange-400 disabled:opacity-40">{drawing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Dices className="h-5 w-5" />} SORTEAR PRÓXIMO NÚMERO</button>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    <button type="button" disabled={controlling} onClick={() => void control(state.pausada ? "RETOMAR" : "PAUSAR")} className="inline-flex h-10 items-center gap-2 rounded-xl border border-amber-400/35 px-4 text-xs text-amber-200 hover:bg-amber-400/10 disabled:opacity-50">{state.pausada ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}{state.pausada ? "RETOMAR" : "PAUSAR"}</button>
                    <button type="button" onClick={() => setTransferOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-cyan-400/35 px-4 text-xs text-cyan-200 hover:bg-cyan-400/10"><UserRoundCog className="h-4 w-4" /> TRANSFERIR</button>
                    <button type="button" disabled={controlling} onClick={() => void control("ENCERRAR")} className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-400/35 px-4 text-xs text-red-200 hover:bg-red-400/10 disabled:opacity-50"><Square className="h-4 w-4" /> ENCERRAR</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-5 gap-2 text-center text-2xl font-black sm:text-3xl">{columns.map((column) => <span key={column} className="rounded-xl border border-orange-400/45 bg-gradient-to-b from-orange-500/25 to-[#0a1a2b] py-3 text-orange-200 shadow-[inset_0_0_18px_rgba(249,115,22,.08)]">{column}</span>)}</div>
                  <div className="mt-2 grid grid-cols-5 gap-2">{card.flatMap((row) => row.map((cell) => { const newest = latest?.numero === cell.numero; return <div key={cell.id} className={`relative grid aspect-[1.12] place-items-center overflow-hidden rounded-xl border text-xl font-black transition-all duration-500 sm:text-3xl ${newest ? "scale-[1.04] border-yellow-200 bg-gradient-to-br from-yellow-300 to-orange-500 text-white shadow-[0_0_28px_rgba(251,146,60,.75)]" : cell.marcada ? "border-orange-300 bg-gradient-to-br from-orange-400/85 to-orange-600/85 text-white shadow-[0_0_18px_rgba(249,115,22,.42)]" : "border-[#31506d] bg-[#071421] text-slate-100"}`}>{cell.marcada && <span className="absolute inset-1 rounded-lg border border-white/20" />}{cell.livre ? <span className="relative text-xs font-black sm:text-sm">LIVRE</span> : <span className="relative">{cell.numero}</span>}</div>; }))}</div>
                  <button type="button" disabled={claiming || (state.pausada && !disputaAberta) || state.total_sorteios === 0 || currentVictoryRegistered} onClick={() => void claim()} className="mt-5 inline-flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 text-2xl font-black text-white shadow-[0_0_30px_rgba(249,115,22,.35)] hover:from-orange-400 hover:to-orange-500 disabled:opacity-40">{claiming ? <Loader2 className="h-6 w-6 animate-spin" /> : <Sparkles className="h-6 w-6" />} {currentVictoryRegistered ? "VITÓRIA REGISTRADA" : "BINGO!"}</button>
                </>
              )}
            </section>

            <aside className="space-y-4">
              {victories.length > 0 && <section className="rounded-2xl border border-orange-400/35 bg-orange-400/10 p-5"><div className="flex items-center gap-2 text-orange-300"><Crown className="h-4 w-4" /><p className="font-mono text-[9px] tracking-[.16em]">VENCEDORES CONFIRMADOS</p></div><div className="mt-3 space-y-2">{victories.map((victory) => <div key={`${victory.id_participante}-${victory.padrao}`} className="flex items-center gap-3 rounded-xl border border-orange-300/25 bg-[#071421]/80 p-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-orange-400/15 text-xs font-black text-orange-200">{victory.posicao ? `${victory.posicao}º` : "—"}</span><div className="min-w-0 flex-1"><strong className="block truncate text-xs text-white">{victory.nome}</strong><small className="mt-1 block text-[9px] text-orange-200/75">{patternLabels[victory.padrao]}{victory.pedra_desempate ? ` · pedra ${victory.pedra_desempate}` : ""}</small></div></div>)}</div></section>}
              {isSupervisor && <section className={`rounded-2xl border p-5 ${closePlayers.some((player) => player.quase_bingo) ? "border-orange-300/60 bg-orange-400/10 shadow-[0_0_26px_rgba(249,115,22,.12)]" : "border-[#263e58] bg-[#071421]"}`}><div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-orange-300" /><p className="font-mono text-[9px] tracking-[.16em] text-orange-300">RADAR DE VITÓRIA</p></div>{closePlayers.length ? <div className="mt-3 space-y-2">{closePlayers.map((player) => <div key={player.id_participante} className={`rounded-xl border p-3 ${player.quase_bingo ? "border-orange-300/50 bg-orange-400/10" : "border-[#29455f] bg-[#081726]"}`}><div className="flex items-center justify-between gap-3"><span className="truncate text-xs font-semibold text-white">{player.nome}</span><strong className={player.quase_bingo ? "text-orange-300" : "text-cyan-300"}>{player.faltam_para_vencer === 1 ? "FALTA 1" : `FALTAM ${player.faltam_para_vencer}`}</strong></div>{player.numeros_necessarios.length > 0 && <p className="mt-2 text-[10px] text-slate-400">Aguardando: {player.numeros_necessarios.join(", ")}</p>}</div>)}</div> : <p className="mt-3 text-xs text-slate-500">Ninguém está a dois números da vitória.</p>}</section>}
              <section className="rounded-2xl border border-[#263e58] bg-[#071421] p-5"><div className="flex items-center gap-2 text-cyan-300"><History className="h-4 w-4" /><p className="font-mono text-[9px] tracking-[.16em]">PAINEL DE SORTEIOS</p><span className="ml-auto text-[10px] text-slate-500">{state.total_sorteios}/75</span></div><div className="mt-4 grid grid-cols-10 gap-1">{Array.from({ length: 75 }, (_, index) => index + 1).map((number) => <span key={number} className={`grid aspect-square place-items-center rounded-md border text-[9px] font-bold ${latest?.numero === number ? "border-yellow-200 bg-yellow-300 text-orange-950 shadow-[0_0_12px_rgba(253,224,71,.65)]" : drawnNumbers.has(number) ? "border-orange-300/60 bg-orange-500/70 text-white" : "border-[#263e58] bg-[#06111e] text-slate-600"}`}>{number}</span>)}</div></section>
              <section className="rounded-2xl border border-violet-400/25 bg-violet-400/5 p-5"><p className="font-mono text-[9px] tracking-[.16em] text-violet-300">PADRÃO DE VITÓRIA</p><strong className="mt-3 block text-lg text-white">{patternLabels[state.padrao_vitoria]}</strong><div className="mt-4 grid grid-cols-5 gap-1">{Array.from({ length: 25 }, (_, index) => <span key={index} className={`aspect-square rounded-full ${isPatternCell(state.padrao_vitoria, index) ? "bg-orange-400" : "bg-[#263e58]"}`} />)}</div></section>
              <section className="rounded-2xl border border-[#263e58] bg-[#071421] p-5"><div className="flex items-center gap-2 text-violet-300"><Users className="h-4 w-4" /><span className="font-mono text-[9px] tracking-[.14em]">PARTICIPANTES</span></div><strong className="mt-3 block text-xl text-white">{state.participantes_online} participantes</strong>{isSupervisor && <div className="mt-4 max-h-40 space-y-2 overflow-y-auto">{state.progresso.map((player) => <div key={player.id_participante} className="flex items-center justify-between rounded-lg border border-[#263e58] px-3 py-2 text-[10px]"><span className="truncate text-slate-300">{player.nome}</span><span className="ml-2 text-orange-300">{player.marcadas}/{state.casa_livre ? 24 : 25}</span></div>)}</div>}</section>
            </aside>
          </main>
        )}
      </div>

      {isSupervisor && state.aguardando_decisao && !aguardandoDesempate && latestVictory && !finished && (
        <div className="fixed inset-0 z-[118] grid place-items-center bg-[#020711]/85 p-4 backdrop-blur-md">
          <section className="w-full max-w-xl overflow-hidden rounded-3xl border border-orange-400/45 bg-[#06111e] shadow-[0_0_70px_rgba(249,115,22,.2)]">
            <div className="border-b border-orange-400/20 bg-gradient-to-r from-orange-500/20 via-violet-500/10 to-cyan-500/10 px-6 py-6 text-center">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-orange-300/50 bg-orange-400/15 text-orange-200"><Trophy className="h-8 w-8" /></span>
              <p className="mt-4 font-mono text-[9px] tracking-[.2em] text-orange-300">VITÓRIA CONFIRMADA</p>
              <h2 className="mt-2 text-2xl font-black text-white">{latestVictory.nome}</h2>
              <p className="mt-2 text-sm text-slate-300">Completou <strong className="text-orange-200">{patternLabels[latestVictory.padrao]}</strong> e conquistou a {latestVictory.posicao ?? "—"}ª posição.</p>
            </div>
            <div className="p-6">
              <label className="font-mono text-[9px] tracking-[.16em] text-cyan-300" htmlFor="bingo-next-pattern">PRÓXIMO PADRÃO DE VITÓRIA</label>
              <select id="bingo-next-pattern" value={continuationPattern} onChange={(event) => setContinuationPattern(event.target.value as ArenaBingoWinningPattern)} className="mt-3 h-12 w-full rounded-xl border border-[#31506d] bg-[#030b16] px-4 text-sm font-semibold text-white outline-none focus:border-cyan-400">
                {Object.entries(patternLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <p className="mt-3 text-xs leading-relaxed text-slate-400">Os números já sorteados e os vencedores anteriores serão preservados. O XP será consolidado somente no encerramento.</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button type="button" disabled={controlling} onClick={() => void control("ENCERRAR")} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-red-400/40 text-xs font-bold text-red-200 hover:bg-red-400/10 disabled:opacity-50"><Square className="h-4 w-4" /> ENCERRAR PARTIDA</button>
                <button type="button" disabled={controlling} onClick={() => void control("CONTINUAR", continuationPattern)} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-xs font-bold text-white shadow-[0_0_25px_rgba(249,115,22,.28)] hover:from-orange-400 hover:to-orange-500 disabled:opacity-50">{controlling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} CONTINUAR PARTIDA</button>
              </div>
            </div>
          </section>
        </div>
      )}

      {aguardandoDesempate && !finished && (
        <div className="fixed inset-0 z-[119] grid place-items-center bg-[#020711]/90 p-4 backdrop-blur-md">
          <section className="w-full max-w-2xl overflow-hidden rounded-3xl border border-violet-400/45 bg-[#06111e] shadow-[0_0_70px_rgba(139,92,246,.22)]">
            <div className="border-b border-violet-400/20 bg-gradient-to-r from-violet-500/20 to-orange-500/10 px-6 py-6 text-center">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-violet-300/50 bg-violet-400/15 text-violet-200">
                <Dices className="h-8 w-8" />
              </span>
              <p className="mt-4 font-mono text-[9px] tracking-[.2em] text-violet-300">
                EMPATE NO BINGO
              </p>
              <h2 className="mt-2 text-2xl font-black text-white">
                {empatados.length} jogadores cantaram juntos
              </h2>
              <p className="mt-2 text-sm text-slate-300">
                Ninguém saiu na frente: quem canta dentro da janela entra no
                empate. Vence a <strong className="text-violet-200">pedra maior</strong>.
              </p>
            </div>
            <div className="p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                {empatados.map((jogador) => {
                  const revelado = pedrasReveladas.find(
                    (item) => item.id_participante === jogador.id_participante,
                  );
                  const maior = pedrasReveladas.length === empatados.length
                    && revelado
                    && revelado.pedra === Math.max(
                      ...pedrasReveladas.map((item) => item.pedra),
                    );
                  return (
                    <article
                      key={jogador.id_participante}
                      className={`rounded-2xl border p-5 text-center transition ${
                        maior
                          ? "border-orange-300/70 bg-orange-400/15 shadow-[0_0_28px_rgba(249,115,22,.25)]"
                          : "border-[#31506d] bg-[#071421]"
                      }`}
                    >
                      <p className="truncate text-sm font-semibold text-white">
                        {jogador.nome}
                      </p>
                      <div className="mt-3 grid h-20 place-items-center">
                        {revelado ? (
                          <span className="text-5xl font-black text-orange-200">
                            {revelado.pedra}
                          </span>
                        ) : (
                          <span className="text-3xl text-slate-600">?</span>
                        )}
                      </div>
                      {maior && (
                        <p className="font-mono text-[9px] tracking-[.16em] text-orange-300">
                          PEDRA MAIOR
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>

              {isSupervisor ? (
                <button
                  type="button"
                  disabled={sorteandoDesempate || pedrasReveladas.length > 0}
                  onClick={() => void sortearDesempate()}
                  className="mt-6 inline-flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-violet-500 to-orange-500 text-sm font-bold text-white shadow-[0_0_30px_rgba(139,92,246,.3)] disabled:opacity-40"
                >
                  {sorteandoDesempate ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Dices className="h-5 w-5" />
                  )}
                  SORTEAR AS PEDRAS
                </button>
              ) : (
                <p className="mt-6 text-center text-xs text-slate-400">
                  O supervisor vai sortear uma pedra para cada um.
                </p>
              )}
            </div>
          </section>
        </div>
      )}

      {transferOpen && (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-black/75 p-4 backdrop-blur-sm">
          <section className="w-full max-w-lg rounded-2xl border border-cyan-400/35 bg-[#06111e] p-5 shadow-2xl">
            <div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-400/30 text-cyan-300"><UserRoundCog className="h-5 w-5" /></span><div><h2 className="font-semibold text-white">Transferir controle da partida</h2><p className="mt-1 text-xs text-slate-400">O novo supervisor continuará do número atual.</p></div><button type="button" onClick={() => setTransferOpen(false)} className="ml-auto text-slate-500 hover:text-white"><X className="h-5 w-5" /></button></div>
            <div className="mt-5 flex items-center gap-2 rounded-xl border border-[#29455f] bg-[#030b16] px-3"><Search className="h-4 w-4 text-cyan-300" /><input autoFocus value={supervisorSearch} onChange={(event) => setSupervisorSearch(event.target.value)} placeholder="Digite o nome ou CPF do supervisor" className="h-11 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-600" />{searchingSupervisors && <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />}</div>
            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">{supervisors.map((supervisor) => <button key={supervisor.cpf} type="button" disabled={transferring !== null} onClick={() => void transfer(supervisor)} className="flex w-full items-center gap-3 rounded-xl border border-[#263e58] bg-[#071421] p-3 text-left hover:border-orange-400/50 disabled:opacity-50"><span className="grid h-9 w-9 place-items-center rounded-full bg-cyan-400/10 text-xs text-cyan-200">{supervisor.nome.slice(0, 2)}</span><span className="min-w-0 flex-1"><strong className="block truncate text-xs text-white">{supervisor.nome}</strong><small className="mt-1 block text-[10px] text-slate-500">{supervisor.centro_custo} · {supervisor.cpf}</small></span>{transferring === supervisor.cpf ? <Loader2 className="h-4 w-4 animate-spin text-orange-300" /> : <Play className="h-4 w-4 text-orange-300" />}</button>)}</div>
          </section>
        </div>
      )}
    </div>
  );
}
