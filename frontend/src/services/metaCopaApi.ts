import axiosInstance from "@/utils/axiosInstance";

export interface CopaMetaTipo {
  id: string;
  codigo: string;
  nome: string;
  descricao: string;
  unidade: string;
  regra_comparacao: string;
  frequencia_padrao: string;
  valor_alvo_padrao: number;
  qtd_pacotes_padrao: number;
  qtd_figurinhas_por_pacote_padrao: number;
  ordem_exibicao: number;
  ativa: boolean;
}

export interface CopaMetaConfig {
  id_meta_tipo: string;
  codigo: string;
  nome: string;
  descricao: string;
  unidade: string;
  regra_comparacao: string;
  ativa: boolean;
  valor_alvo: number;
  frequencia: string;
  qtd_pacotes: number;
  qtd_figurinhas_por_pacote: number;
  ordem_exibicao: number;
  cpf_supervisor_alteracao?: string | null;
  dt_atualizacao?: string | null;
}

export interface CopaOperadorResumo {
  cpf: string;
  nome: string;
  supervisor: string;
  centro_custo: string;
  funcao: string;
}

export interface CopaCampanhaResumo {
  id: string;
  nome: string;
  supervisor: {
    cpf: string;
  };
  operador: {
    cpf: string;
    nome: string;
    carteira: string;
  };
  qtd_pacotes: number;
  qtd_figurinhas_por_pacote: number;
  dt_cadastro?: string | null;
}

export interface CopaSupervisorConfigResponse {
  supervisor: {
    cpf: string;
    nome: string;
  };
  tipos_meta: CopaMetaTipo[];
  config_global: CopaMetaConfig[];
  operadores: CopaOperadorResumo[];
  campanhas_recentes: CopaCampanhaResumo[];
}

export interface CopaOperadorConfigResponse {
  operador: CopaOperadorResumo;
  contexto_meta: {
    tipo: string;
    titulo: string;
    descricao: string;
  };
  tipos_meta: CopaMetaTipo[];
  overrides: CopaMetaConfig[];
  efetivas: CopaMetaConfig[];
}

export interface CopaMetaSavePayload {
  metas: Array<{
    id_meta_tipo: string;
    ativa: boolean;
    valor_alvo: number;
    frequencia: string;
    qtd_pacotes: number;
    qtd_figurinhas_por_pacote: number;
    ordem_exibicao: number;
  }>;
}

export interface CopaCampanhaSavePayload {
  nome_campanha: string;
  cpf_operador: string;
  qtd_pacotes: number;
  qtd_figurinhas_por_pacote: number;
}

export async function fetchCopaSupervisorConfig() {
  const response = await axiosInstance.get<CopaSupervisorConfigResponse>(
    "/api/supervisor/copa-metas/configuracao",
  );
  return response.data;
}

export async function fetchCopaOperatorConfig(cpfOperador: string) {
  const response = await axiosInstance.get<CopaOperadorConfigResponse>(
    `/api/supervisor/copa-metas/operador/${cpfOperador}`,
  );
  return response.data;
}

export async function saveCopaGlobalConfig(payload: CopaMetaSavePayload) {
  const response = await axiosInstance.put<{
    mensagem: string;
    dados: CopaSupervisorConfigResponse;
  }>("/api/supervisor/copa-metas/configuracao-global", payload);
  return response.data;
}

export async function saveCopaOperatorConfig(
  cpfOperador: string,
  payload: CopaMetaSavePayload,
) {
  const response = await axiosInstance.put<{
    mensagem: string;
    dados: CopaOperadorConfigResponse;
  }>(`/api/supervisor/copa-metas/operador/${cpfOperador}`, payload);
  return response.data;
}

export async function createCopaCampaign(payload: CopaCampanhaSavePayload) {
  const response = await axiosInstance.post<{
    mensagem: string;
    dados: {
      campanha: CopaCampanhaResumo;
      configuracao: CopaSupervisorConfigResponse;
    };
  }>("/api/supervisor/copa-metas/campanhas", payload);
  return response.data;
}
