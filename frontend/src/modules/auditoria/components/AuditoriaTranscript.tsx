import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatAudioTime } from "../utils/auditoriaValidators";
import type { AuditoriaTranscriptSegment } from "../types/auditoria.types";

interface AuditoriaTranscriptProps {
  segments: AuditoriaTranscriptSegment[];
  onSeek: (seconds: number) => void;
}

export function AuditoriaTranscript({ segments, onSeek }: AuditoriaTranscriptProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () =>
      segments.filter((segment) =>
        `${segment.interlocutor} ${segment.texto}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      ),
    [query, segments],
  );

  return (
    <section className="rounded-2xl border bg-white dark:border-slate-800 dark:bg-slate-950">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 p-5 text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-violet-500"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>
          <span className="block font-semibold text-slate-950 dark:text-white">Transcrição da ligação</span>
          <span className="mt-1 block text-sm text-slate-500 dark:text-slate-400">
            Pesquise e ouça novamente os trechos usados na análise.
          </span>
        </span>
        <ChevronDown className={`h-5 w-5 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t p-5 dark:border-slate-800">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-9"
              placeholder="Pesquisar na transcrição"
            />
          </div>
          <div className="max-h-80 space-y-3 overflow-y-auto pr-2">
            {filtered.map((segment) => (
              <button
                type="button"
                key={segment.id}
                onClick={() => onSeek(segment.inicioSegundos)}
                className={`w-full rounded-xl border p-4 text-left transition hover:border-violet-300 hover:bg-violet-50/50 focus:outline-none focus:ring-2 focus:ring-violet-500 dark:hover:border-violet-800 dark:hover:bg-violet-950/20 ${
                  segment.evidencia
                    ? "border-amber-300 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20"
                    : "dark:border-slate-800"
                }`}
              >
                <span className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                  {formatAudioTime(segment.inicioSegundos)} · {segment.interlocutor}
                  {segment.evidencia && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                      Evidência
                    </span>
                  )}
                </span>
                <span className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  {segment.texto}
                </span>
              </button>
            ))}
            {!filtered.length && (
              <p className="py-8 text-center text-sm text-slate-500">Nenhum trecho encontrado.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

