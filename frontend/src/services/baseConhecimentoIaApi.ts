import axiosInstance from "@/utils/axiosInstance";

export interface ConhecimentoIA {
  id: number;
  carteira: string;
  produto: string;
  categoria: string;
  descricao: string;
  texto: string;
  sinonimos: string[];
  ativo: boolean;
  origem: string;
  /** false = salvo, mas sem vetor: só será encontrado por palavra-chave. */
  indexado: boolean;
  atualizado_por: string | null;
  atualizado_em: string | null;
  /** Só volta na gravação, quando a indexação semântica falhou. */
  aviso?: string;
}

export interface PaginaConhecimento {
  pagina: number;
  tamanho: number;
  total: number;
  itens: ConhecimentoIA[];
}

export interface ItemDiagnostico {
  id: number | null;
  carteira: string;
  produto: string;
  categoria: string;
  descricao: string;
  score: number;
  score_vetorial: number;
  score_lexical: number;
  cosseno: number;
  /** true = entraria no prompt da Aurora para essa pergunta. */
  usado: boolean;
}

export interface Diagnostico {
  modo: "hibrido" | "lexical" | "sem_parametros";
  limiar: number;
  peso_vetorial?: number;
  itens: ItemDiagnostico[];
}

export interface EntradaConhecimento {
  carteira: string;
  produto: string;
  categoria?: string;
  descricao?: string;
  texto: string;
  sinonimos?: string[];
}

export interface RespostaSimulada {
  /** O texto que o operador leria, em markdown. */
  resposta: string;
  /** false = a Aurora respondeu sem nenhum treinamento, no genérico. */
  usou_treinamento: boolean;
  itens: {
    id: number | null;
    produto: string;
    descricao: string;
    score: number;
  }[];
}

export interface ResultadoReindexacao {
  indexados: number;
  pendentes: number;
  total: number;
}

const BASE = "/api/ia/conhecimento";

export const baseConhecimentoIaApi = {
  async listar(filtros: {
    carteira?: string;
    busca?: string;
    incluir_inativos?: boolean;
    pagina?: number;
    tamanho?: number;
  }): Promise<PaginaConhecimento> {
    const params: Record<string, string> = {};
    Object.entries(filtros).forEach(([chave, valor]) => {
      if (valor === undefined || valor === null || valor === "") return;
      params[chave] = String(valor);
    });
    const { data } = await axiosInstance.get<PaginaConhecimento>(BASE, { params });
    return data;
  },

  async listarCarteiras(): Promise<string[]> {
    const { data } = await axiosInstance.get<{ carteiras: string[] }>(
      `${BASE}/carteiras`,
    );
    return data.carteiras ?? [];
  },

  async criar(entrada: EntradaConhecimento): Promise<ConhecimentoIA> {
    const { data } = await axiosInstance.post<ConhecimentoIA>(BASE, entrada);
    return data;
  },

  async atualizar(
    id: number,
    entrada: EntradaConhecimento,
  ): Promise<ConhecimentoIA> {
    const { data } = await axiosInstance.put<ConhecimentoIA>(`${BASE}/${id}`, entrada);
    return data;
  },

  /** Desativa — o texto continua no banco e pode voltar. */
  async desativar(id: number): Promise<ConhecimentoIA> {
    const { data } = await axiosInstance.delete<ConhecimentoIA>(`${BASE}/${id}`);
    return data;
  },

  async reativar(id: number): Promise<ConhecimentoIA> {
    const { data } = await axiosInstance.post<ConhecimentoIA>(`${BASE}/${id}/reativar`);
    return data;
  },

  async reindexar(id: number): Promise<ResultadoReindexacao> {
    const { data } = await axiosInstance.post<ResultadoReindexacao>(
      `${BASE}/${id}/reindexar`,
    );
    return data;
  },

  async reindexarTudo(): Promise<ResultadoReindexacao> {
    const { data } = await axiosInstance.post<ResultadoReindexacao>(
      `${BASE}/reindexar`,
    );
    return data;
  },

  /** O que a Aurora encontraria para essa pergunta, com os scores. */
  async testar(carteira: string, pergunta: string): Promise<Diagnostico> {
    const { data } = await axiosInstance.post<Diagnostico>(`${BASE}/testar`, {
      carteira,
      pergunta,
    });
    return data;
  },

  /** A resposta final da Aurora. Não entra no histórico de ninguém. */
  async testarResposta(
    carteira: string,
    pergunta: string,
  ): Promise<RespostaSimulada> {
    const { data } = await axiosInstance.post<RespostaSimulada>(
      `${BASE}/testar-resposta`,
      { carteira, pergunta },
    );
    return data;
  },
};

export default baseConhecimentoIaApi;
