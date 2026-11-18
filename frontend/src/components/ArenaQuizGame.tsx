import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Crown,
  Gamepad2,
  Loader2,
  LogOut,
  Medal,
  Radio,
  Trophy,
  XCircle,
  Zap,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { arenaApi, ArenaLiveQuizState } from "@/services/arenaApi";

interface ArenaQuizGameProps {
  sessionId: number;
  connected: boolean;
  refreshKey: number;
  onExit: () => void;
}

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export default function ArenaQuizGame({
  sessionId,
  connected,
  refreshKey,
  onExit,
}: ArenaQuizGameProps) {
  const { toast } = useToast();
  const [state, setState] = useState<ArenaLiveQuizState | null>(null);
  const [loading, setLoading] = useState(true);
  const [answering, setAnswering] = useState(false);
  const [now, setNow] = useState(Date.now());
  const expiredRoundRef = useRef<number | null>(null);

  const loadState = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const next = await arenaApi.getLiveQuiz(sessionId);
      setState(next);
    } catch (error) {
      if (!silent) {
        const candidate = error as { response?: { data?: { erro?: string } } };
        toast({
          title: "Não foi possível carregar a partida",
          description: candidate.response?.data?.erro || "Tente novamente.",
          variant: "destructive",
        });
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [sessionId, toast]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  useEffect(() => {
    if (refreshKey === 0) return;
    void loadState(true);
  }, [loadState, refreshKey]);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 200);
    const recovery = window.setInterval(() => void loadState(true), 3000);
    return () => {
      window.clearInterval(clock);
      window.clearInterval(recovery);
    };
  }, [loadState]);

  const offset = useMemo(
    () => state ? new Date(state.servidor_agora).getTime() - Date.now() : 0,
    [state],
  );
  const remainingMs = state?.rodada?.encerra_em
    ? Math.max(0, new Date(state.rodada.encerra_em).getTime() - (now + offset))
    : 0;
  const remainingSeconds = Math.ceil(remainingMs / 1000);

  useEffect(() => {
    if (
      !state?.rodada ||
      state.fase !== "PERGUNTA" ||
      remainingMs > 0 ||
      expiredRoundRef.current === state.rodada.id
    ) return;
    expiredRoundRef.current = state.rodada.id;
    window.setTimeout(() => void loadState(true), 350);
  }, [loadState, remainingMs, state]);

  const answer = async (alternativeId: number) => {
    if (!state?.rodada || state.rodada.resposta || answering || remainingMs <= 0) return;
    setAnswering(true);
    try {
      setState(await arenaApi.answerLiveQuiz(sessionId, {
        id_rodada: state.rodada.id,
        id_alternativa: alternativeId,
      }));
    } catch (error) {
      const candidate = error as { response?: { data?: { erro?: string } } };
      toast({
        title: "A resposta não foi registrada",
        description: candidate.response?.data?.erro || "Tente novamente.",
        variant: "destructive",
      });
      void loadState(true);
    } finally {
      setAnswering(false);
    }
  };

  if (loading || !state) {
    return (
      <div className="fixed inset-0 z-[96] grid place-items-center bg-[#020711] text-cyan-200">
        <div className="text-center">
          <Loader2 className="mx-auto h-9 w-9 animate-spin" />
          <p className="mt-4 font-mono text-xs tracking-[0.2em]">SINCRONIZANDO PARTIDA</p>
        </div>
      </div>
    );
  }

  const round = state.rodada;
  const answered = Boolean(round?.resposta);
  const isSupervisor = state.papel === "SUPERVISOR";
  const progress = round?.total_participantes
    ? Math.round((round.respostas_recebidas / round.total_participantes) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-[96] overflow-y-auto bg-[#020711] p-3 text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(14,165,233,.16),transparent_42%),radial-gradient(circle_at_95%_100%,rgba(249,115,22,.10),transparent_35%)]" />
      <div className="relative mx-auto flex min-h-full max-w-6xl flex-col">
        <header className="flex flex-wrap items-center gap-3 border-b border-[#20364c] py-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl border border-orange-400/50 bg-orange-400/10 text-orange-300">
            <Gamepad2 className="h-5 w-5" />
          </div>
          <div>
            <p className="font-mono text-[9px] tracking-[0.18em] text-cyan-300">ARENA AURORA · QUIZ AO VIVO</p>
            <h1 className="mt-1 text-base font-semibold text-white">{state.titulo}</h1>
          </div>
          <div className={`ml-auto inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[9px] ${connected ? "border-emerald-400/30 text-emerald-300" : "border-amber-400/30 text-amber-300"}`}>
            <Radio className={`h-3.5 w-3.5 ${connected ? "animate-pulse" : ""}`} />
            {connected ? "SINCRONIZADO" : "RECUPERANDO CONEXÃO"}
          </div>
          <button type="button" onClick={onExit} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#2b435d] px-4 text-xs text-slate-300 hover:border-orange-400/50 hover:text-orange-300">
            <LogOut className="h-4 w-4" /> SAIR
          </button>
        </header>

        {state.fase === "FINALIZADO" ? (
          <main className="grid flex-1 gap-5 py-6 lg:grid-cols-[1fr_360px]">
            <section className="rounded-3xl border border-cyan-400/25 bg-[#06111e]/90 p-6">
              <div className="text-center">
                <Trophy className="mx-auto h-12 w-12 text-orange-300" />
                <p className="mt-4 font-mono text-[10px] tracking-[0.22em] text-cyan-300">PARTIDA FINALIZADA</p>
                <h2 className="mt-2 text-3xl font-bold text-white">Placar final</h2>
              </div>
              <div className="mt-7 space-y-2">
                {state.placar.map((player, index) => (
                  <article key={player.id_participante} className={`grid grid-cols-[46px_1fr_auto] items-center gap-3 rounded-2xl border p-4 ${index === 0 ? "border-orange-400/45 bg-orange-400/10" : "border-[#263e58] bg-[#071421]"}`}>
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#0c1d2e] font-bold text-cyan-200">
                      {index === 0 ? <Crown className="h-5 w-5 text-orange-300" /> : `${index + 1}º`}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{player.nome}</p>
                      <p className="mt-1 text-[10px] text-slate-400">{player.acertos} acertos · {player.centro_custo}</p>
                    </div>
                    <div className="text-right">
                      <strong className="text-lg text-cyan-200">{player.pontos}</strong>
                      <p className="text-[9px] text-emerald-300">+{player.xp} XP</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
            <aside className="rounded-3xl border border-orange-400/25 bg-gradient-to-b from-[#111b29] to-[#07101c] p-7 text-center">
              <Medal className="mx-auto h-10 w-10 text-orange-300" />
              <p className="mt-5 font-mono text-[9px] tracking-[0.2em] text-slate-400">SEU RESULTADO</p>
              {isSupervisor ? (
                <p className="mt-4 text-sm text-slate-300">A classificação da equipe foi consolidada e o XP já foi distribuído.</p>
              ) : (
                <>
                  <strong className="mt-3 block text-6xl text-white">{state.classificacao || "—"}<span className="text-2xl text-orange-300">º</span></strong>
                  <p className="mt-5 text-2xl font-semibold text-cyan-200">{state.pontuacao} pontos</p>
                  <div className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-5">
                    <Zap className="mx-auto h-5 w-5 text-emerald-300" />
                    <strong className="mt-2 block text-2xl text-emerald-200">+{state.xp_concedido} XP</strong>
                  </div>
                </>
              )}
            </aside>
          </main>
        ) : (
          <main className="grid flex-1 gap-5 py-6 lg:grid-cols-[1fr_300px]">
            <section className="rounded-3xl border border-[#294762] bg-[#06111e]/95 p-5 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 font-mono text-[10px] text-cyan-200">
                  PERGUNTA {round?.ordem || 0} / {state.total_rodadas}
                </span>
                {answered && state.fase === "PERGUNTA" && (
                  <span className="ml-auto inline-flex items-center gap-2 text-[10px] text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" /> RESPOSTA REGISTRADA
                  </span>
                )}
              </div>
              <h2 className="mt-7 max-w-4xl text-xl font-semibold leading-relaxed text-white sm:text-2xl">{round?.enunciado}</h2>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {round?.alternativas.map((alternative, index) => {
                  const selected = round.resposta?.id_alternativa === alternative.id;
                  const reveal = state.fase === "RESULTADO";
                  const correct = reveal && alternative.correta === true;
                  const wrongSelected = reveal && selected && !correct;
                  return (
                    <button
                      key={alternative.id}
                      type="button"
                      disabled={isSupervisor || answered || answering || state.fase !== "PERGUNTA" || remainingMs <= 0}
                      onClick={() => void answer(alternative.id)}
                      className={`group flex min-h-24 items-center gap-4 rounded-2xl border p-4 text-left transition ${correct ? "border-emerald-400 bg-emerald-400/12" : wrongSelected ? "border-rose-400 bg-rose-400/10" : selected ? "border-cyan-300 bg-cyan-400/12" : "border-[#2a435c] bg-[#091827] hover:border-cyan-400/60 hover:bg-[#0b2033]"} disabled:cursor-default`}
                    >
                      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border font-bold ${correct ? "border-emerald-300 text-emerald-200" : wrongSelected ? "border-rose-300 text-rose-200" : "border-[#3a5875] text-cyan-200"}`}>
                        {correct ? <CheckCircle2 className="h-5 w-5" /> : wrongSelected ? <XCircle className="h-5 w-5" /> : LETTERS[index]}
                      </span>
                      <span className="text-sm leading-relaxed text-slate-100">{alternative.texto}</span>
                    </button>
                  );
                })}
              </div>
              {state.fase === "RESULTADO" && (
                <div className="mt-6 rounded-2xl border border-cyan-400/25 bg-cyan-400/5 p-5">
                  <p className="font-mono text-[9px] tracking-[0.17em] text-cyan-300">RESPOSTA DA RODADA</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-200">{round?.explicacao || "A alternativa correta está destacada acima."}</p>
                  {!isSupervisor && round?.resposta && (
                    <p className={`mt-3 text-xs font-semibold ${round.resposta.correta ? "text-emerald-300" : "text-rose-300"}`}>
                      {round.resposta.correta ? `Você acertou e ganhou ${round.resposta.pontos || 0} pontos.` : "Essa não foi a resposta correta."}
                    </p>
                  )}
                </div>
              )}
            </section>

            <aside className="space-y-4">
              <div className={`rounded-3xl border p-6 text-center ${remainingSeconds <= 5 && state.fase === "PERGUNTA" ? "border-rose-400/45 bg-rose-400/8" : "border-cyan-400/25 bg-[#071421]"}`}>
                <Clock3 className="mx-auto h-6 w-6 text-cyan-300" />
                <p className="mt-3 font-mono text-[9px] tracking-[0.18em] text-slate-400">{state.fase === "RESULTADO" ? "PRÓXIMA PERGUNTA" : "TEMPO RESTANTE"}</p>
                <strong className="mt-2 block text-5xl text-white">{state.fase === "RESULTADO" ? "..." : remainingSeconds}</strong>
              </div>
              <div className="rounded-2xl border border-[#263e58] bg-[#071421] p-5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">RESPOSTAS</span>
                  <strong className="text-cyan-200">{round?.respostas_recebidas || 0}/{round?.total_participantes || 0}</strong>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#13283c]">
                  <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all" style={{ width: `${progress}%` }} />
                </div>
                {isSupervisor && <p className="mt-3 text-[10px] leading-relaxed text-slate-500">O painel mostra somente o volume. As respostas individuais ficam protegidas durante a rodada.</p>}
              </div>
              <div className="rounded-2xl border border-orange-400/20 bg-orange-400/5 p-5">
                <div className="flex items-center gap-2 text-orange-300">
                  <Zap className="h-4 w-4" />
                  <span className="font-mono text-[9px] tracking-[0.16em]">PONTUAÇÃO</span>
                </div>
                <strong className="mt-3 block text-3xl text-white">{isSupervisor ? "AO VIVO" : state.pontuacao}</strong>
                <p className="mt-2 text-[10px] text-slate-500">Acertos rápidos recebem bônus calculado pelo servidor.</p>
              </div>
            </aside>
          </main>
        )}
      </div>
    </div>
  );
}
