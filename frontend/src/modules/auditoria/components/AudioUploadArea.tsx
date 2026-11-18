import { useRef, useState } from "react";
import { FileAudio, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AUDITORIA_AUDIO_CONFIG } from "../config/auditoriaDelta";
import { formatFileSize, validateAudioFile } from "../utils/auditoriaValidators";

interface AudioUploadAreaProps {
  file: File | null;
  error: string | null;
  disabled?: boolean;
  onChange: (file: File | null, error: string | null) => void;
}

export function AudioUploadArea({
  file,
  error,
  disabled,
  onChange,
}: AudioUploadAreaProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const selectFile = (selected?: File) => {
    if (!selected) return;
    const validationError = validateAudioFile(selected);
    onChange(validationError ? null : selected, validationError);
  };

  if (file) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="rounded-xl bg-emerald-100 p-3 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
              <FileAudio className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                {file.name}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {formatFileSize(file.size)} · pronto para análise
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Trocar
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => onChange(null, null)}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Remover
            </Button>
          </div>
        </div>
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept={AUDITORIA_AUDIO_CONFIG.extensions.map((item) => `.${item}`).join(",")}
          onChange={(event) => selectFile(event.target.files?.[0])}
        />
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        className={cn(
          "group flex min-h-48 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2",
          dragging
            ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30"
            : "border-slate-300 bg-slate-50/80 hover:border-violet-400 hover:bg-violet-50/60 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-violet-600",
        )}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          selectFile(event.dataTransfer.files?.[0]);
        }}
      >
        <span className="mb-4 rounded-2xl bg-violet-100 p-4 text-violet-700 transition group-hover:scale-105 dark:bg-violet-900/40 dark:text-violet-300">
          <UploadCloud className="h-7 w-7" />
        </span>
        <span className="font-semibold text-slate-900 dark:text-slate-100">
          Arraste a gravação ou selecione um arquivo
        </span>
        <span className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          MP3, WAV, M4A, WEBM ou OGG · até 25 MB
        </span>
      </button>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept={AUDITORIA_AUDIO_CONFIG.extensions.map((item) => `.${item}`).join(",")}
        onChange={(event) => selectFile(event.target.files?.[0])}
      />
      {error && (
        <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
