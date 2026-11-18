import axiosInstance from "@/utils/axiosInstance";
import type {
  AuditoriaCategory,
  AuditoriaHighlight,
  AuditoriaMetadata,
  AuditoriaLiveProgress,
  AuditoriaResult,
  AuditoriaStatus,
  AuditoriaTranscriptSegment,
} from "../types/auditoria.types";

interface ApiEvidence {
  inicio_segundos: number;
  fim_segundos: number;
  texto: string;
}

interface ApiCategory {
  codigo: string;
  nome: string;
  nota: number;
  status: AuditoriaCategory["status"];
  justificativa: string;
  orientacao: string;
  evidencias: ApiEvidence[];
}

interface ApiPoint {
  titulo: string;
  descricao: string;
  exemplo_melhorado?: string | null;
}

interface ApiResult {
  id: number;
  status: AuditoriaStatus;
  operador: string;
  carteira: string;
  duracao_segundos: number;
  data_analise: string;
  resultado: {
    resumo: { nota_geral: number; classificacao: string; resumo_atendimento: string };
    categorias: ApiCategory[];
    pontos_positivos: ApiPoint[];
    pontos_melhoria: ApiPoint[];
    alertas_criticos: Array<ApiPoint & { codigo: string; evidencias: ApiEvidence[] }>;
    proxima_melhor_acao: string;
    confianca_analise: number;
  };
  transcricao: Array<{
    id: number;
    ordem: number;
    inicio_segundos: number;
    fim_segundos: number;
    interlocutor: string;
    texto: string;
  }>;
}

const evidenceId = (prefix: string, index: number) => `${prefix}-${index}`;

function mapPoint(point: ApiPoint): AuditoriaHighlight {
  return {
    titulo: point.titulo,
    descricao: point.descricao,
    exemploMelhorado: point.exemplo_melhorado || undefined,
  };
}

function mapResult(api: ApiResult): AuditoriaResult {
  const evidenceTimes = new Set(
    api.resultado.categorias.flatMap((category) =>
      category.evidencias.map((evidence) => Math.round(evidence.inicio_segundos)),
    ),
  );
  return {
    notaGeral: api.resultado.resumo.nota_geral,
    classificacao: api.resultado.resumo.classificacao,
    resumoAtendimento: api.resultado.resumo.resumo_atendimento,
    duracaoSegundos: Number(api.duracao_segundos || 0),
    operador: api.operador,
    carteira: api.carteira,
    dataAnalise: new Date(api.data_analise).toLocaleString("pt-BR"),
    categorias: api.resultado.categorias.map((category) => ({
      ...category,
      evidencias: category.evidencias.map((evidence, index) => ({
        id: evidenceId(category.codigo, index),
        inicioSegundos: Number(evidence.inicio_segundos),
        fimSegundos: Number(evidence.fim_segundos),
        texto: evidence.texto,
      })),
    })),
    pontosPositivos: api.resultado.pontos_positivos.map(mapPoint),
    pontosMelhoria: api.resultado.pontos_melhoria.map(mapPoint),
    alertasCriticos: api.resultado.alertas_criticos.map(mapPoint),
    proximaMelhorAcao: api.resultado.proxima_melhor_acao,
    confiancaAnalise: api.resultado.confianca_analise,
    transcricao: api.transcricao.map((segment): AuditoriaTranscriptSegment => ({
      id: String(segment.id),
      ordem: segment.ordem,
      inicioSegundos: Number(segment.inicio_segundos),
      fimSegundos: Number(segment.fim_segundos),
      interlocutor: segment.interlocutor || "Interlocutor não identificado",
      texto: segment.texto,
      evidencia: evidenceTimes.has(Math.round(Number(segment.inicio_segundos))),
    })),
  };
}

export const auditoriaService = {
  async create(file: File, metadata: AuditoriaMetadata) {
    const form = new FormData();
    form.append("audio", file);
    form.append("data_ligacao", metadata.dataLigacao);
    form.append("campanha", metadata.campanha);
    form.append("identificador_cliente", metadata.identificadorCliente);
    form.append("identificador_externo", metadata.identificadorExterno);
    form.append("observacao", metadata.observacao);
    const { data } = await axiosInstance.post<{ auditoriaId: number; status: AuditoriaStatus }>(
      "/api/auditorias",
      form,
    );
    return data;
  },

  async status(id: number) {
    const { data } = await axiosInstance.get<{ status: AuditoriaStatus; erro?: string }>(
      `/api/auditorias/${id}/status`,
    );
    return data;
  },

  async progress(id: number): Promise<AuditoriaLiveProgress> {
    const { data } = await axiosInstance.get<{
      transcricao_parcial?: string;
      ouvido_ate_segundos?: number;
      orientacao?: {
        id: number;
        ouvido_ate_segundos: number;
        fase: string;
        prioridade: "BAIXA" | "MEDIA" | "ALTA";
        contexto: string;
        orientacao: string;
        fala_sugerida: string;
        risco?: string | null;
        confianca: number;
      } | null;
    }>(`/api/auditorias/${id}/progresso`);
    return {
      transcricaoParcial: data.transcricao_parcial || "",
      ouvidoAteSegundos: Number(data.ouvido_ate_segundos || 0),
      orientacao: data.orientacao ? {
        id: data.orientacao.id,
        ouvidoAteSegundos: Number(data.orientacao.ouvido_ate_segundos || 0),
        fase: data.orientacao.fase,
        prioridade: data.orientacao.prioridade,
        contexto: data.orientacao.contexto,
        orientacao: data.orientacao.orientacao,
        falaSugerida: data.orientacao.fala_sugerida,
        risco: data.orientacao.risco || undefined,
        confianca: Number(data.orientacao.confianca || 0),
      } : null,
    };
  },

  async get(id: number) {
    const { data } = await axiosInstance.get<ApiResult>(`/api/auditorias/${id}`);
    return mapResult(data);
  },
};
