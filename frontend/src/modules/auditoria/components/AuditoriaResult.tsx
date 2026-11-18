import { useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Lightbulb,
  Play,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { AuditoriaResult as AuditoriaResultType } from "../types/auditoria.types";
import { formatAudioTime } from "../utils/auditoriaValidators";
import { AuditoriaTranscript } from "./AuditoriaTranscript";

interface AuditoriaResultProps {
  result: AuditoriaResultType;
  audioUrl: string | null;
  onNewAudit: () => void;
}

export function AuditoriaResult({ result, audioUrl, onNewAudit }: AuditoriaResultProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [openCategory, setOpenCategory] = useState<string | null>("INVESTIGACAO");

  const seekAudio = (seconds: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = seconds;
    void audioRef.current.play();
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-8">
      <section className="overflow-hidden rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-950 via-indigo-950 to-slate-950 text-white shadow-xl dark:border-violet-900">
        <div className="grid gap-7 p-6 sm:p-8 lg:grid-cols-[210px_1fr] lg:p-10">
          <div className="flex flex-col items-center justify-center rounded-3xl bg-white/10 p-5 text-center backdrop-blur">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-200">Nota geral</span>
            <span className="mt-2 text-7xl font-bold tracking-tight">{result.notaGeral}</span>
            <span className="mt-2 rounded-full bg-emerald-400/20 px-3 py-1 text-sm font-medium text-emerald-200">
              {result.classificacao}
            </span>
          </div>
          <div className="flex flex-col justify-center">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge className="border-0 bg-violet-400/20 text-violet-100 hover:bg-violet-400/20">
                <Sparkles className="mr-1 h-3.5 w-3.5" /> Feedback em foco
              </Badge>
              <span className="text-xs text-slate-300">Análise da gravação enviada</span>
            </div>
            <h2 className="text-2xl font-semibold sm:text-3xl">Seu atendimento foi analisado</h2>
            <p className="mt-3 max-w-3xl leading-relaxed text-slate-200">{result.resumoAtendimento}</p>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-300">
              <span>{result.operador}</span>
              <span>{result.carteira}</span>
              <span>{formatAudioTime(result.duracaoSegundos)}</span>
              <span>{result.dataAnalise}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-6 dark:border-violet-900 dark:bg-violet-950/25">
          <div className="flex items-start gap-4">
            <span className="rounded-xl bg-violet-600 p-3 text-white"><ArrowRight className="h-5 w-5" /></span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">Próxima melhor ação</p>
              <p className="mt-2 text-lg font-semibold leading-relaxed text-slate-950 dark:text-white">{result.proximaMelhorAcao}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
          <p className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Ouvir ligação</p>
          {audioUrl ? (
            <audio ref={audioRef} className="w-full" src={audioUrl} controls preload="metadata" />
          ) : (
            <p className="text-sm text-slate-500">Áudio indisponível.</p>
          )}
        </div>
      </section>

      {result.alertasCriticos.length > 0 && (
        <section className="rounded-2xl border border-red-300 bg-red-50 p-5 dark:border-red-900 dark:bg-red-950/20">
          <h3 className="flex items-center gap-2 font-semibold text-red-900 dark:text-red-200">
            <AlertTriangle className="h-5 w-5" /> Alertas críticos
          </h3>
          {result.alertasCriticos.map((alert) => <p key={alert.titulo} className="mt-2 text-sm">{alert.descricao}</p>)}
        </section>
      )}

      <section className="grid gap-5 md:grid-cols-2">
        <div className="rounded-2xl border bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
          <h3 className="flex items-center gap-2 font-semibold text-slate-950 dark:text-white"><CheckCircle2 className="h-5 w-5 text-emerald-600" /> Pontos positivos</h3>
          <div className="mt-4 space-y-4">
            {result.pontosPositivos.map((point) => (
              <div key={point.titulo}><p className="font-medium text-slate-900 dark:text-slate-100">{point.titulo}</p><p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{point.descricao}</p></div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
          <h3 className="flex items-center gap-2 font-semibold text-slate-950 dark:text-white"><Lightbulb className="h-5 w-5 text-amber-500" /> Ponto de evolução</h3>
          <div className="mt-4 space-y-4">
            {result.pontosMelhoria.map((point) => (
              <div key={point.titulo}>
                <p className="font-medium text-slate-900 dark:text-slate-100">{point.titulo}</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{point.descricao}</p>
                {point.exemploMelhorado && <blockquote className="mt-3 rounded-xl border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm italic text-slate-700 dark:bg-amber-950/20 dark:text-slate-300">“{point.exemploMelhorado}”</blockquote>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
        <div className="mb-4">
          <h3 className="font-semibold text-slate-950 dark:text-white">Avaliação por categoria</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Abra uma categoria para entender a evidência e como evoluir.</p>
        </div>
        <div className="space-y-2">
          {result.categorias.map((category) => {
            const open = openCategory === category.codigo;
            return (
              <div key={category.codigo} className="rounded-xl border dark:border-slate-800">
                <button type="button" onClick={() => setOpenCategory(open ? null : category.codigo)} className="flex w-full items-center gap-4 p-4 text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-violet-500">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center justify-between gap-3"><span className="font-medium text-slate-900 dark:text-slate-100">{category.nome}</span><span className="font-bold text-slate-900 dark:text-white">{category.nota}</span></div>
                    <Progress value={category.nota} className="h-1.5" />
                  </div>
                  <ChevronDown className={`h-5 w-5 shrink-0 transition ${open ? "rotate-180" : ""}`} />
                </button>
                {open && (
                  <div className="border-t px-4 pb-4 pt-4 dark:border-slate-800">
                    <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{category.justificativa}</p>
                    <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-900"><strong>Como evoluir:</strong> {category.orientacao}</div>
                    {category.evidencias.map((evidence) => (
                      <button key={evidence.id} type="button" onClick={() => seekAudio(evidence.inicioSegundos)} className="mt-3 flex w-full items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-left text-sm hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-amber-900 dark:bg-amber-950/20">
                        <Play className="mt-0.5 h-4 w-4 shrink-0" /><span><strong>{formatAudioTime(evidence.inicioSegundos)}</strong> · “{evidence.texto}”</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <AuditoriaTranscript segments={result.transcricao} onSeek={seekAudio} />

      <div className="flex justify-end">
        <Button variant="outline" onClick={onNewAudit}><RotateCcw className="mr-2 h-4 w-4" /> Analisar outra ligação</Button>
      </div>
    </div>
  );
}
