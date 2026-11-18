import { Check, Headphones, Loader2, MessageSquareQuote, ShieldAlert, Sparkles } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { AUDITORIA_PROCESSING_STEPS } from "../config/auditoriaDelta";
import type { AuditoriaLiveProgress, AuditoriaStatus } from "../types/auditoria.types";
import { formatAudioTime } from "../utils/auditoriaValidators";

interface AuditoriaProcessingProps {
  status: AuditoriaStatus;
  liveProgress: AuditoriaLiveProgress | null;
}

export function AuditoriaProcessing({ status, liveProgress }: AuditoriaProcessingProps) {
  const currentIndex = Math.max(0, AUDITORIA_PROCESSING_STEPS.findIndex((step) => step.status === status));
  const progress = ((currentIndex + 1) / AUDITORIA_PROCESSING_STEPS.length) * 100;

  return (
    <div className="mx-auto grid min-h-[54vh] w-full max-w-6xl gap-5 lg:grid-cols-[1.15fr_.85fr]">
      <div className="rounded-3xl border bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-8">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"><Loader2 className="h-8 w-8 animate-spin" /></span>
          <h3 className="text-xl font-semibold text-slate-950 dark:text-white">Ouvindo a ligação</h3>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">A orientação aparece assim que houver contexto suficiente no trecho já ouvido.</p>
        </div>
        <Progress value={progress} className="mb-8 h-2" />
        <ol className="space-y-3">
          {AUDITORIA_PROCESSING_STEPS.map((step, index) => {
            const completed = index < currentIndex;
            const active = index === currentIndex;
            return <li key={step.status} className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${active ? "bg-violet-50 font-semibold text-violet-800 dark:bg-violet-950/30 dark:text-violet-200" : "text-slate-500 dark:text-slate-400"}`}>
              <span className={`flex h-7 w-7 items-center justify-center rounded-full border ${completed ? "border-emerald-500 bg-emerald-500 text-white" : active ? "border-violet-500 text-violet-600" : "border-slate-300 dark:border-slate-700"}`}>{completed ? <Check className="h-4 w-4" /> : index + 1}</span>
              {step.label}
            </li>;
          })}
        </ol>
      </div>

      <div className="space-y-5">
        <section className="rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-700 to-indigo-900 p-6 text-white shadow-lg dark:border-violet-900">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-100"><Sparkles className="h-4 w-4" /> O que fazer agora</span>
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs">Orientação provisória</span>
          </div>
          {liveProgress?.orientacao ? <div className="mt-5 space-y-4">
            <div><p className="text-xs text-violet-200">{liveProgress.orientacao.fase} · prioridade {liveProgress.orientacao.prioridade.toLowerCase()}</p><p className="mt-1 text-lg font-semibold leading-snug">{liveProgress.orientacao.orientacao}</p></div>
            <div className="rounded-2xl bg-white/10 p-4"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-violet-100"><MessageSquareQuote className="h-4 w-4" /> Você pode dizer</p><p className="mt-2 leading-relaxed">“{liveProgress.orientacao.falaSugerida}”</p></div>
            {liveProgress.orientacao.risco && <p className="flex gap-2 text-sm text-amber-200"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />{liveProgress.orientacao.risco}</p>}
            <p className="text-xs text-violet-200">Ouvido até {formatAudioTime(liveProgress.orientacao.ouvidoAteSegundos)} · confiança {Math.round(liveProgress.orientacao.confianca * 100)}%</p>
          </div> : <div className="flex min-h-52 flex-col items-center justify-center text-center text-violet-100"><Headphones className="h-9 w-9 animate-pulse" /><p className="mt-3 font-medium">Aguardando contexto suficiente</p><p className="mt-1 text-sm text-violet-200">A primeira sugestão será exibida durante a escuta.</p></div>}
        </section>

        <section className="rounded-2xl border bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between"><h4 className="font-semibold">Transcrição em andamento</h4><span className="text-xs text-slate-500">{formatAudioTime(liveProgress?.ouvidoAteSegundos || 0)}</span></div>
          <div className="mt-3 max-h-40 overflow-y-auto rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-600 dark:bg-slate-900 dark:text-slate-300">{liveProgress?.transcricaoParcial || "Os primeiros trechos aparecerão aqui conforme forem reconhecidos..."}</div>
        </section>
      </div>
    </div>
  );
}
