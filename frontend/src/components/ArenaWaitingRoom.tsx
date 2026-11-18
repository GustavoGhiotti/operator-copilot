import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Clock3,
  DoorClosed,
  Gamepad2,
  Loader2,
  LogOut,
  Play,
  Search,
  UserPlus,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { io, Socket } from "socket.io-client";
import { useToast } from "@/hooks/use-toast";
import { arenaApi, ArenaOperator, ArenaSession } from "@/services/arenaApi";
import ArenaQuizGame from "@/components/ArenaQuizGame";
import ArenaBingoGame from "@/components/ArenaBingoGame";
import AuroraDressUpAvatar from "@/components/AuroraDressUpAvatar";

interface ArenaWaitingRoomProps {
  initialSession: ArenaSession;
  onExit: () => void;
}

const socketUrl =
  import.meta.env.VITE_SOCKET_URL?.trim() || window.location.origin;

const formatTime = (seconds: number) => {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  return `${String(minutes).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
};

export default function ArenaWaitingRoom({
  initialSession,
  onExit,
}: ArenaWaitingRoomProps) {
  const { toast } = useToast();
  const [session, setSession] = useState(initialSession);
  const [connected, setConnected] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [starting, setStarting] = useState(false);
  const [gameRefreshKey, setGameRefreshKey] = useState(0);
  // O número vem no próprio evento do socket. Pintar por aqui tira a busca
  // HTTP do caminho crítico — era ela, e não o socket, que fazia o número
  // aparecer em momentos diferentes para cada operador.
  const [ultimoSorteio, setUltimoSorteio] = useState<{
    numero: number;
    letra: string;
    ordem: number;
  } | null>(null);
  const [closing, setClosing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  // Ref para o socket nao ser recriado quando o pai redesenha: `onExit` chega
  // por prop e raramente e memoizado.
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;
  const autoStartRef = useRef(false);
  const syncInFlightRef = useRef(false);
  const token = localStorage.getItem("userToken") || "";

  const serverOffset = useMemo(
    () => new Date(session.servidor_agora).getTime() - Date.now(),
    [session.servidor_agora],
  );
  const remainingSeconds = Math.max(
    0,
    Math.ceil(
      (new Date(session.limite_entrada_em).getTime() - (now + serverOffset)) /
        1000,
    ),
  );
  const inRoom = session.participantes.filter((item) =>
    ["NA_SALA", "JOGANDO"].includes(item.status),
  );
  const confirmed = session.participantes.filter((item) =>
    ["ACEITO", "NA_SALA", "JOGANDO"].includes(item.status),
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const synchronizeSession = useCallback(async () => {
    if (syncInFlightRef.current) return;
    syncInFlightRef.current = true;
    try {
      setSession(await arenaApi.getSession(initialSession.id));
    } catch {
      // O próximo ciclo ou evento do Socket fará uma nova tentativa.
    } finally {
      syncInFlightRef.current = false;
    }
  }, [initialSession.id]);

  useEffect(() => {
    const socket = io(socketUrl, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      upgrade: true,
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    const subscribe = () => {
      socket.emit(
        "arena_inscrever_sessao",
        { token, id_sessao: session.id },
        (ack: { status: string; erro?: string; estado?: ArenaSession }) => {
          if (ack.status !== "ok") {
            toast({
              title: "Conexão da Arena recusada",
              description: ack.erro || "Não foi possível entrar na sala.",
              variant: "destructive",
            });
            return;
          }
          setConnected(true);
          if (ack.estado) setSession(ack.estado);
        },
      );
    };

    socket.on("connect", subscribe);
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setConnected(false));
    socket.on("arena_estado", (state: ArenaSession) => {
      if (state.id === session.id) setSession(state);
    });
    socket.on("arena_sessao_iniciada", (state: ArenaSession) => {
      if (state.id !== session.id) return;
      setSession(state);
      toast({
        title: "A partida começou",
        description: "A sala foi fechada para novas entradas.",
      });
    });
    socket.on("arena_sessao_cancelada", (event: { id_sessao: number }) => {
      if (event.id_sessao !== session.id) return;
      toast({
        title: "A sala foi fechada",
        description: "O supervisor cancelou esta partida.",
      });
      onExitRef.current();
    });
    socket.on("arena_quiz_atualizado", (event: { id_sessao: number }) => {
      if (event.id_sessao === session.id) {
        setGameRefreshKey((current) => current + 1);
      }
    });
    socket.on(
      "arena_bingo_atualizado",
      (event: {
        id_sessao: number;
        acao?: string;
        numero?: number;
        letra?: string;
        ordem?: number;
      }) => {
        if (event.id_sessao !== session.id) return;
        if (
          event.acao === "NUMERO_SORTEADO"
          && typeof event.numero === "number"
          && event.letra
          && typeof event.ordem === "number"
        ) {
          setUltimoSorteio({
            numero: event.numero,
            letra: event.letra,
            ordem: event.ordem,
          });
        }
        setGameRefreshKey((current) => current + 1);
      },
    );

    const heartbeat = window.setInterval(() => {
      if (socket.connected) {
        socket.emit("arena_heartbeat", { token, id_sessao: session.id });
      }
    }, 30000);
    const reconciliation = window.setInterval(
      () => void synchronizeSession(),
      2500,
    );
    const onFocus = () => void synchronizeSession();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void synchronizeSession();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    const fallback = window.setInterval(async () => {
      if (socket.connected) return;
      try {
        setSession(await arenaApi.getSession(session.id));
      } catch {
        // O WebSocket continua sendo a via principal; a consulta é recuperação.
      }
    }, 15000);

    return () => {
      window.clearInterval(heartbeat);
      window.clearInterval(reconciliation);
      window.clearInterval(fallback);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      socket.emit("arena_sair_sessao", { token, id_sessao: session.id });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [session.id, synchronizeSession, toast, token]);

  const startSession = useCallback(async () => {
    setStarting(true);
    try {
      setSession(await arenaApi.startSession(session.id));
    } catch (error) {
      autoStartRef.current = false;
      const candidate = error as { response?: { data?: { erro?: string } } };
      toast({
        title: "A partida ainda não pode começar",
        description: candidate.response?.data?.erro || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setStarting(false);
    }
  }, [session.id, toast]);

  const closeRoom = useCallback(async () => {
    if (
      !window.confirm(
        "Fechar a sala? Todo mundo sai e a partida não acontece agora. " +
          "A campanha continua publicada — você pode abrir de novo depois.",
      )
    ) {
      return;
    }
    setClosing(true);
    try {
      await arenaApi.closeRoom(session.id);
      onExitRef.current();
    } catch (error) {
      const candidate = error as { response?: { data?: { erro?: string } } };
      toast({
        title: "Não consegui fechar a sala",
        description: candidate.response?.data?.erro || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setClosing(false);
    }
  }, [session.id, toast]);

  useEffect(() => {
    // Rede de segurança: se o prazo vencer e ninguém tiver iniciado à mão, a
    // partida começa sozinha, como antes.
    if (
      session.papel !== "SUPERVISOR" ||
      session.status !== "AGUARDANDO" ||
      remainingSeconds > 0 ||
      inRoom.length === 0 ||
      autoStartRef.current
    ) {
      return;
    }
    autoStartRef.current = true;
    void startSession();
  }, [
    inRoom.length,
    remainingSeconds,
    session.papel,
    session.status,
    startSession,
  ]);

  useEffect(() => {
    if (session.status === "AGUARDANDO" && remainingSeconds === 0) {
      void synchronizeSession();
    }
  }, [remainingSeconds, session.status, synchronizeSession]);

  if (["EM_ANDAMENTO", "FINALIZADA"].includes(session.status)) {
    if (session.tipo_jogo === "BINGO") {
      return (
        <ArenaBingoGame
          sessionId={session.id}
          connected={connected}
          refreshKey={gameRefreshKey}
          ultimoSorteio={ultimoSorteio}
          onExit={onExit}
        />
      );
    }
    return (
      <ArenaQuizGame
        sessionId={session.id}
        connected={connected}
        refreshKey={gameRefreshKey}
        onExit={onExit}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[95] overflow-y-auto bg-[#020711]/98 p-3 text-slate-100 backdrop-blur-xl">
      <div className="mx-auto flex min-h-full max-w-6xl flex-col">
        <header className="flex items-center gap-3 border-b border-[#20364c] py-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl border border-orange-400/50 bg-orange-400/10 text-orange-300">
            <Gamepad2 className="h-5 w-5" />
          </div>
          <div>
            <p className="font-mono text-[9px] tracking-[0.16em] text-cyan-300">SALA DE ESPERA</p>
            <h1 className="mt-1 text-base font-semibold text-white">{session.titulo}</h1>
          </div>
          <div className={`ml-auto flex items-center gap-2 text-[10px] ${connected ? "text-emerald-300" : "text-amber-300"}`}>
            {connected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            {connected ? "TEMPO REAL ATIVO" : "RECONECTANDO"}
          </div>
          <button type="button" onClick={onExit} className="ml-3 inline-flex h-10 items-center gap-2 rounded-xl border border-[#2b435d] px-4 text-xs text-slate-300 hover:border-orange-400/50 hover:text-orange-300">
            <LogOut className="h-4 w-4" /> SAIR
          </button>
        </header>

        <main className="grid flex-1 gap-5 py-6 lg:grid-cols-[330px_1fr]">
          <aside className="space-y-4">
            <div className="rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-[#0b2744] to-[#06111e] p-6 text-center">
              <Clock3 className="mx-auto h-7 w-7 text-cyan-300" />
              <p className="mt-4 font-mono text-[9px] tracking-[0.17em] text-slate-400">
                {session.status === "EM_ANDAMENTO" ? "PARTIDA INICIADA" : "ENTRADAS ENCERRAM EM"}
              </p>
              <strong className="mt-3 block text-6xl text-orange-400 [text-shadow:0_0_25px_rgba(249,115,22,.28)]">
                {session.status === "EM_ANDAMENTO" ? "GO" : formatTime(remainingSeconds)}
              </strong>
              <p className="mt-4 text-xs text-slate-500">
                O horário é controlado pelo servidor.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-[#263e58] bg-[#071421] p-4 text-center">
                <strong className="text-2xl text-cyan-200">{inRoom.length}</strong>
                <p className="mt-1 text-[9px] text-slate-500">NA SALA</p>
              </div>
              <div className="rounded-xl border border-[#263e58] bg-[#071421] p-4 text-center">
                <strong className="text-2xl text-orange-300">{confirmed.length}</strong>
                <p className="mt-1 text-[9px] text-slate-500">CONFIRMADOS</p>
              </div>
            </div>
            {session.papel === "SUPERVISOR" && session.status === "AGUARDANDO" && (
              <div className="space-y-2">
                {/*
                  O prazo deixou de travar o início: basta ter alguém na sala.
                  O cronômetro continua valendo como limite para entradas.
                */}
                <button
                  type="button"
                  disabled={inRoom.length === 0 || starting}
                  onClick={() => void startSession()}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 text-xs font-bold text-white hover:bg-orange-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                >
                  {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  {inRoom.length === 0
                    ? "AGUARDANDO ALGUÉM ENTRAR"
                    : `INICIAR AGORA (${inRoom.length} NA SALA)`}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAddOpen(true)}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-cyan-400/35 bg-cyan-400/5 text-[10px] font-bold text-cyan-200 hover:bg-cyan-400/10"
                  >
                    <UserPlus className="h-4 w-4" /> ADICIONAR
                  </button>
                  <button
                    type="button"
                    disabled={closing}
                    onClick={() => void closeRoom()}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#2b435d] text-[10px] font-bold text-slate-300 hover:border-red-400/50 hover:text-red-300 disabled:opacity-50"
                  >
                    {closing ? <Loader2 className="h-4 w-4 animate-spin" /> : <DoorClosed className="h-4 w-4" />}
                    FECHAR SALA
                  </button>
                </div>
              </div>
            )}
          </aside>

          <section className="rounded-2xl border border-[#263e58] bg-[#06111e] p-5">
            <div className="flex items-center gap-2 border-b border-[#20364c] pb-3">
              <Users className="h-4 w-4 text-cyan-300" />
              <h2 className="text-sm font-semibold text-white">Participantes</h2>
              <span className="ml-auto text-[10px] text-slate-500">{session.participantes.length} CONVIDADOS</span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {session.participantes.map((participant) => {
                const present = ["NA_SALA", "JOGANDO"].includes(participant.status);
                return (
                  <article key={participant.id} className={`flex items-center gap-3 rounded-xl border p-3 ${present ? "border-emerald-400/35 bg-emerald-400/5" : "border-[#263e58] bg-[#071421]"}`}>
                    {/*
                      A Aurora montada aparece aqui: vestir só tem graça se
                      alguém vê. Quem ainda não personalizou cai nas iniciais.
                    */}
                    {participant.visual?.equipado
                      && Object.keys(participant.visual.equipado).length > 0 ? (
                      <AuroraDressUpAvatar
                        equipped={participant.visual.equipado}
                        filtros={participant.visual.filtros}
                        semPalco
                        className={`h-14 w-10 shrink-0 ${present ? "" : "opacity-60 grayscale"}`}
                      />
                    ) : (
                      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border text-xs ${present ? "border-emerald-400/60 text-emerald-200" : "border-slate-600 text-slate-400"}`}>
                        {participant.nome.split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-white">{participant.nome}</p>
                      <p className="mt-1 truncate text-[9px] text-slate-500">{participant.centro_custo}</p>
                    </div>
                    <span className={`h-2 w-2 rounded-full ${participant.status_conexao === "CONECTADO" ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : present ? "bg-amber-400" : "bg-slate-700"}`} />
                  </article>
                );
              })}
            </div>
          </section>
        </main>
      </div>

      {addOpen && (
        <AdicionarParticipantes
          sessionId={session.id}
          jaNaCampanha={
            new Set(session.participantes.map((item) => item.cpf))
          }
          onFechar={() => setAddOpen(false)}
          onIncluidos={(estado) => {
            setSession(estado);
            setAddOpen(false);
          }}
        />
      )}
    </div>
  );
}

/**
 * Inclui operadores com a sala já aberta.
 *
 * Reaproveita `getCostCenters` e `getOperators`, os mesmos da etapa de público
 * do wizard — quem já está na campanha aparece marcado e desabilitado, para o
 * supervisor não perder tempo tentando adicionar duas vezes.
 */
function AdicionarParticipantes({
  sessionId,
  jaNaCampanha,
  onFechar,
  onIncluidos,
}: {
  sessionId: number;
  jaNaCampanha: Set<string>;
  onFechar: () => void;
  onIncluidos: (estado: ArenaSession) => void;
}) {
  const { toast } = useToast();
  const [centros, setCentros] = useState<string[]>([]);
  const [centro, setCentro] = useState("");
  const [busca, setBusca] = useState("");
  const [operadores, setOperadores] = useState<ArenaOperator[]>([]);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    void arenaApi
      .getCostCenters()
      .then((lista) => {
        setCentros(lista);
        setCentro((atual) => atual || lista[0] || "");
      })
      .catch(() => setCentros([]));
  }, []);

  const procurar = useCallback(async () => {
    if (!centro) return;
    setCarregando(true);
    try {
      setOperadores(await arenaApi.getOperators(centro, busca));
    } catch {
      setOperadores([]);
    } finally {
      setCarregando(false);
    }
  }, [busca, centro]);

  useEffect(() => {
    void procurar();
  }, [procurar]);

  const incluir = async () => {
    if (!selecionados.length) return;
    setSalvando(true);
    try {
      const estado = await arenaApi.addParticipants(sessionId, {
        cpfs: selecionados,
      });
      toast({
        title: "Convite enviado",
        description:
          selecionados.length === 1
            ? "A pessoa recebe o convite na Arena dela."
            : `${selecionados.length} pessoas receberam o convite.`,
      });
      onIncluidos(estado);
    } catch (error) {
      const candidato = error as { response?: { data?: { erro?: string } } };
      toast({
        title: "Não consegui incluir",
        description: candidato.response?.data?.erro || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[96] flex justify-end bg-black/70 backdrop-blur-sm">
      <aside className="flex h-full w-full max-w-md flex-col border-l border-cyan-400/25 bg-[#040d19]">
        <header className="flex items-center gap-3 border-b border-[#20364c] px-5 py-4">
          <div>
            <p className="font-mono text-[9px] tracking-[0.16em] text-orange-400">
              SALA ABERTA
            </p>
            <h3 className="mt-1 text-sm font-semibold text-white">
              Adicionar participantes
            </h3>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="ml-auto text-slate-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-3 border-b border-[#20364c] p-5">
          <select
            value={centro}
            onChange={(evento) => setCentro(evento.target.value)}
            className="h-10 w-full rounded-lg border border-[#2b435d] bg-[#06111e] px-3 text-xs text-white outline-none focus:border-cyan-500/50"
          >
            {centros.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
              placeholder="Buscar pelo nome..."
              className="h-10 w-full rounded-lg border border-[#2b435d] bg-[#06111e] pl-9 pr-3 text-xs text-white outline-none placeholder:text-slate-600 focus:border-cyan-500/50"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {carregando && (
            <div className="grid h-24 place-items-center">
              <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
            </div>
          )}
          {!carregando && operadores.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-slate-500">
              Ninguém encontrado neste centro de custo.
            </p>
          )}
          {!carregando &&
            operadores.map((operador) => {
              const cpf = String(operador.cpf);
              const jaEsta = jaNaCampanha.has(cpf);
              const marcado = selecionados.includes(cpf);
              return (
                <button
                  key={cpf}
                  type="button"
                  disabled={jaEsta}
                  onClick={() =>
                    setSelecionados((atual) =>
                      atual.includes(cpf)
                        ? atual.filter((item) => item !== cpf)
                        : [...atual, cpf],
                    )
                  }
                  className={`mb-2 flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                    jaEsta
                      ? "border-[#1d3248] bg-[#050f1c] opacity-50"
                      : marcado
                        ? "border-cyan-400/50 bg-cyan-400/10"
                        : "border-[#263e58] bg-[#071421] hover:border-cyan-400/30"
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs text-white">
                      {operador.nome}
                    </span>
                    <span className="mt-0.5 block truncate text-[9px] text-slate-500">
                      {jaEsta ? "já está na campanha" : operador.centro_custo}
                    </span>
                  </span>
                  {marcado && !jaEsta && (
                    <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_8px_#67e8f9]" />
                  )}
                </button>
              );
            })}
        </div>

        <footer className="flex items-center gap-3 border-t border-[#20364c] p-5">
          <span className="text-[10px] text-slate-500">
            {selecionados.length} selecionado(s)
          </span>
          <button
            type="button"
            disabled={!selecionados.length || salvando}
            onClick={() => void incluir()}
            className="ml-auto inline-flex h-10 items-center gap-2 rounded-xl bg-orange-500 px-5 text-[10px] font-bold text-white hover:bg-orange-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {salvando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            CONVIDAR
          </button>
        </footer>
      </aside>
    </div>
  );
}
