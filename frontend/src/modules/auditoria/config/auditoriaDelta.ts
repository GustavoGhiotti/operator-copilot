export const AUDITORIA_AUDIO_CONFIG = {
  extensions: ["mp3", "wav", "m4a", "webm", "ogg"],
  mimeTypes: [
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
    "audio/mp4",
    "audio/x-m4a",
    "audio/webm",
    "audio/ogg",
  ],
  maxSizeBytes: 25 * 1024 * 1024,
  maxDurationSeconds: 120 * 60,
} as const;

export const AUDITORIA_PROCESSING_STEPS = [
  { status: "ENVIANDO", label: "Enviando ligação" },
  { status: "PROCESSANDO_AUDIO", label: "Preparando áudio" },
  { status: "TRANSCREVENDO", label: "Transcrevendo atendimento" },
  { status: "ANALISANDO", label: "Analisando o atendimento" },
  { status: "CONCLUIDO", label: "Gerando feedback" },
] as const;

export const DELTA_AUDIT_CONFIGURATION = {
  id: "delta-voz-inicial",
  carteira: "Banco Delta",
  versao: "MVP-2026.1",
  statusValidacao: "CONTEUDO_INTERNO_A_VALIDAR",
  sources: [
    "qualityChecklists.ts: deltaVoiceChecklist",
    "aurora_base_conhecimento.json: registros da carteira Banco Delta",
    "ConsignadoPrivadoDelta.tsx: roteiro operacional existente",
  ],
  disclaimer:
    "Configuração inicial baseada em materiais internos existentes. Pesos, regras críticas e vigência ainda devem ser validados pela área de treinamento.",
} as const;
