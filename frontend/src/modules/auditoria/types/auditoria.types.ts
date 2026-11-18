export type AuditoriaStatus =
  | "PENDENTE"
  | "ENVIANDO"
  | "PROCESSANDO_AUDIO"
  | "TRANSCREVENDO"
  | "ANALISANDO"
  | "CONCLUIDO"
  | "ERRO";

export interface AuditoriaEvidence {
  id: string;
  inicioSegundos: number;
  fimSegundos: number;
  texto: string;
}

export interface AuditoriaCategory {
  codigo: string;
  nome: string;
  nota: number;
  status: "ATENDEU" | "PARCIAL" | "NAO_ATENDEU" | "NAO_APLICAVEL";
  justificativa: string;
  orientacao: string;
  evidencias: AuditoriaEvidence[];
}

export interface AuditoriaHighlight {
  titulo: string;
  descricao: string;
  exemploMelhorado?: string;
}

export interface AuditoriaTranscriptSegment {
  id: string;
  ordem: number;
  inicioSegundos: number;
  fimSegundos: number;
  interlocutor: string;
  texto: string;
  evidencia?: boolean;
}

export interface AuditoriaResult {
  notaGeral: number;
  classificacao: string;
  resumoAtendimento: string;
  duracaoSegundos: number;
  operador: string;
  carteira: string;
  dataAnalise: string;
  categorias: AuditoriaCategory[];
  pontosPositivos: AuditoriaHighlight[];
  pontosMelhoria: AuditoriaHighlight[];
  alertasCriticos: AuditoriaHighlight[];
  proximaMelhorAcao: string;
  confiancaAnalise: number;
  transcricao: AuditoriaTranscriptSegment[];
}

export interface AuditoriaMetadata {
  operador: string;
  carteira: string;
  campanha: string;
  dataLigacao: string;
  identificadorCliente: string;
  identificadorExterno: string;
  observacao: string;
}

export interface AuditoriaLiveGuidance {
  id: number;
  ouvidoAteSegundos: number;
  fase: string;
  prioridade: "BAIXA" | "MEDIA" | "ALTA";
  contexto: string;
  orientacao: string;
  falaSugerida: string;
  risco?: string;
  confianca: number;
}

export interface AuditoriaLiveProgress {
  transcricaoParcial: string;
  ouvidoAteSegundos: number;
  orientacao: AuditoriaLiveGuidance | null;
}
