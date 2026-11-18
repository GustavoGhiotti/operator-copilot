import { AUDITORIA_AUDIO_CONFIG } from "../config/auditoriaDelta";

export function validateAudioFile(file: File): string | null {
  if (!file || file.size === 0) return "O arquivo está vazio.";

  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  if (!AUDITORIA_AUDIO_CONFIG.extensions.includes(extension as never)) {
    return `Formato não permitido. Use ${AUDITORIA_AUDIO_CONFIG.extensions.map((item) => `.${item}`).join(", ")}.`;
  }

  if (
    file.type &&
    !AUDITORIA_AUDIO_CONFIG.mimeTypes.includes(file.type as never)
  ) {
    return "O tipo do arquivo não corresponde a um áudio permitido.";
  }

  if (file.size > AUDITORIA_AUDIO_CONFIG.maxSizeBytes) {
    return "O arquivo deve ter no máximo 25 MB.";
  }

  if (!/^[\p{L}\p{N}_.()\- ]+$/u.test(file.name)) {
    return "O nome do arquivo contém caracteres não permitidos.";
  }

  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatAudioTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(safeSeconds % 60).padStart(2, "0")}`;
}
