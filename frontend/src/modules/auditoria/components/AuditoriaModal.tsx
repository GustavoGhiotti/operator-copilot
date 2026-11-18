import { useEffect, useMemo, useState } from "react";
import { CalendarDays, FileAudio, Info, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DELTA_AUDIT_CONFIGURATION } from "../config/auditoriaDelta";
import { auditoriaService } from "../services/auditoriaService";
import type { AuditoriaLiveProgress, AuditoriaMetadata, AuditoriaResult, AuditoriaStatus } from "../types/auditoria.types";
import { AudioUploadArea } from "./AudioUploadArea";
import { AuditoriaProcessing } from "./AuditoriaProcessing";
import { AuditoriaResult as AuditoriaResultView } from "./AuditoriaResult";

interface AuditoriaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export default function AuditoriaModal({ isOpen, onClose }: AuditoriaModalProps) {
  const defaultOperator = localStorage.getItem("nomeCompleto")?.trim() || "";
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [status, setStatus] = useState<AuditoriaStatus>("PENDENTE");
  const [result, setResult] = useState<AuditoriaResult | null>(null);
  const [auditoriaId, setAuditoriaId] = useState<number | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [liveProgress, setLiveProgress] = useState<AuditoriaLiveProgress | null>(null);
  const [metadata, setMetadata] = useState<AuditoriaMetadata>({
    operador: defaultOperator,
    carteira: "Banco Delta",
    campanha: "",
    dataLigacao: today(),
    identificadorCliente: "",
    identificadorExterno: "",
    observacao: "",
  });
  const audioUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  useEffect(() => {
    if (!auditoriaId || ["CONCLUIDO", "ERRO"].includes(status)) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const [current, progress] = await Promise.all([
          auditoriaService.status(auditoriaId),
          auditoriaService.progress(auditoriaId).catch(() => null),
        ]);
        if (cancelled) return;
        if (progress) setLiveProgress(progress);
        setStatus(current.status === "PENDENTE" ? "PROCESSANDO_AUDIO" : current.status);
        if (current.status === "CONCLUIDO") {
          setResult(await auditoriaService.get(auditoriaId));
        } else if (current.status === "ERRO") {
          setProcessingError(current.erro || "Não foi possível concluir a análise.");
        }
      } catch {
        if (!cancelled) setProcessingError("Não foi possível consultar o andamento da análise.");
      }
    };
    void poll();
    const timer = window.setInterval(poll, 2500);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [auditoriaId, status]);

  const reset = () => {
    setFile(null);
    setFileError(null);
    setResult(null);
    setAuditoriaId(null);
    setProcessingError(null);
    setLiveProgress(null);
    setStatus("PENDENTE");
  };

  const startAnalysis = async () => {
    if (!file) {
      setFileError("Selecione uma gravação antes de iniciar a análise.");
      return;
    }
    setProcessingError(null);
    setStatus("ENVIANDO");
    try {
      const created = await auditoriaService.create(file, metadata);
      setAuditoriaId(created.auditoriaId);
      setStatus("PROCESSANDO_AUDIO");
    } catch (error) {
      const apiError = error as { response?: { data?: { erro?: string } } };
      setProcessingError(apiError.response?.data?.erro || "Não foi possível enviar a gravação.");
      setStatus("ERRO");
    }
  };

  const processing = !["PENDENTE", "CONCLUIDO", "ERRO"].includes(status);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="h-[94vh] w-[96vw] max-w-[1500px] gap-0 overflow-hidden border-slate-200 bg-slate-100 p-0 dark:border-slate-800 dark:bg-slate-900">
        <DialogHeader className="border-b bg-white px-6 py-5 pr-14 dark:border-slate-800 dark:bg-slate-950 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-violet-100 p-2.5 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"><Sparkles className="h-5 w-5" /></span>
            <div>
              <DialogTitle className="text-xl sm:text-2xl">Auditoria de Atendimento</DialogTitle>
              <DialogDescription className="mt-1">Análise de ligações e desenvolvimento assistido de operadores</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="h-full overflow-y-auto px-4 py-5 sm:px-8 sm:py-7">
          {processing && <AuditoriaProcessing status={status} liveProgress={liveProgress} />}
          {status === "ERRO" && (
            <div className="mx-auto flex min-h-[55vh] max-w-xl flex-col items-center justify-center text-center">
              <div className="w-full rounded-3xl border border-red-200 bg-white p-8 shadow-sm dark:border-red-900 dark:bg-slate-950">
                <Info className="mx-auto h-10 w-10 text-red-600" />
                <h2 className="mt-4 text-xl font-semibold">Não foi possível concluir a análise</h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{processingError}</p>
                <Button className="mt-6" variant="outline" onClick={reset}>Tentar com outra gravação</Button>
              </div>
            </div>
          )}
          {status === "CONCLUIDO" && result && <AuditoriaResultView result={result} audioUrl={audioUrl} onNewAudit={reset} />}
          {status === "PENDENTE" && (
            <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.1fr_.9fr]">
              <div className="space-y-5">
                <section className="rounded-3xl bg-gradient-to-br from-violet-700 via-indigo-700 to-slate-900 p-6 text-white shadow-lg sm:p-8">
                  <span className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider">Banco Delta · Upload manual</span>
                  <h2 className="mt-5 max-w-xl text-2xl font-semibold leading-tight sm:text-3xl">Transforme uma ligação em orientação prática para o próximo atendimento.</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-violet-100 sm:text-base">Envie uma ligação realizada para receber uma análise baseada nos materiais de treinamento disponíveis para a carteira.</p>
                </section>

                <section className="rounded-2xl border bg-white p-5 dark:border-slate-800 dark:bg-slate-950 sm:p-6">
                  <div className="mb-4 flex items-center gap-3"><FileAudio className="h-5 w-5 text-violet-600" /><div><h3 className="font-semibold text-slate-950 dark:text-white">Gravação da ligação</h3><p className="text-sm text-slate-500">O envio só começa quando você confirmar.</p></div></div>
                  <AudioUploadArea file={file} error={fileError} onChange={(nextFile, error) => { setFile(nextFile); setFileError(error); }} />
                </section>

                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
                  <div className="flex gap-3"><Info className="mt-0.5 h-4 w-4 shrink-0" /><p><strong>Processamento protegido:</strong> a gravação será enviada ao servidor, transcrita e analisada. Evite incluir identificadores desnecessários do cliente.</p></div>
                </div>
              </div>

              <div className="space-y-5">
                <section className="rounded-2xl border bg-white p-5 dark:border-slate-800 dark:bg-slate-950 sm:p-6">
                  <div className="mb-5 flex items-center gap-3"><CalendarDays className="h-5 w-5 text-violet-600" /><div><h3 className="font-semibold text-slate-950 dark:text-white">Dados do atendimento</h3><p className="text-sm text-slate-500">Confirme as informações antes de analisar.</p></div></div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2"><Label htmlFor="auditoria-operador">Operador</Label><Input id="auditoria-operador" className="mt-1.5" value={metadata.operador} readOnly aria-readonly="true" /></div>
                    <div><Label htmlFor="auditoria-carteira">Carteira</Label><Input id="auditoria-carteira" className="mt-1.5" value={metadata.carteira} readOnly aria-readonly="true" /></div>
                    <div><Label htmlFor="auditoria-data">Data da ligação</Label><Input id="auditoria-data" className="mt-1.5" type="date" value={metadata.dataLigacao} onChange={(event) => setMetadata((value) => ({ ...value, dataLigacao: event.target.value }))} /></div>
                    <div><Label htmlFor="auditoria-campanha">Campanha <span className="text-slate-400">(opcional)</span></Label><Input id="auditoria-campanha" className="mt-1.5" value={metadata.campanha} onChange={(event) => setMetadata((value) => ({ ...value, campanha: event.target.value }))} /></div>
                    <div><Label htmlFor="auditoria-chamada">ID externo da chamada <span className="text-slate-400">(opcional)</span></Label><Input id="auditoria-chamada" className="mt-1.5" value={metadata.identificadorExterno} onChange={(event) => setMetadata((value) => ({ ...value, identificadorExterno: event.target.value }))} /></div>
                    <div className="sm:col-span-2"><Label htmlFor="auditoria-cliente">Identificador permitido do cliente <span className="text-slate-400">(opcional)</span></Label><Input id="auditoria-cliente" className="mt-1.5" placeholder="Evite inserir dados pessoais desnecessários" value={metadata.identificadorCliente} onChange={(event) => setMetadata((value) => ({ ...value, identificadorCliente: event.target.value }))} /></div>
                    <div className="sm:col-span-2"><Label htmlFor="auditoria-observacao">Observação <span className="text-slate-400">(opcional)</span></Label><Textarea id="auditoria-observacao" className="mt-1.5 min-h-20" value={metadata.observacao} onChange={(event) => setMetadata((value) => ({ ...value, observacao: event.target.value }))} /></div>
                  </div>
                </section>

                <section className="rounded-2xl border bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
                  <div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /><div><p className="font-medium text-slate-900 dark:text-slate-100">Critérios de análise preparados</p><p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{DELTA_AUDIT_CONFIGURATION.disclaimer}</p><p className="mt-2 text-xs text-slate-400">Versão {DELTA_AUDIT_CONFIGURATION.versao}</p></div></div>
                </section>

                <Button size="lg" className="h-12 w-full bg-violet-700 text-base hover:bg-violet-800" onClick={startAnalysis}><Sparkles className="mr-2 h-5 w-5" /> Analisar ligação</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
