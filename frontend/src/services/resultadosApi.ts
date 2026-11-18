import axiosInstance from "@/utils/axiosInstance";

export interface FiltrosResultados {
  data_inicio?: string;
  data_fim?: string;
  id_carteira?: number | string | null;
  supervisor?: string | null;
  busca?: string | null;
  ordenar_por?: string;
  pagina?: number;
  tamanho?: number;
  meses?: number;
}

export interface Frescor {
  em: string | null;
  tipo: string | null;
}

export interface ResumoResultados {
  periodo: { inicio: string; fim: string; dias: number };
  valor_recuperado: number;
  valor_fechado: number;
  acordos: number;
  cpc: number;
  conversao: number;
  meta: number;
  atingimento: number;
  operadores: number;
  operadores_ativos: number;
  valor_nao_atribuido: number;
  tem_vega: boolean;
  cobertura_meta: { operadores: number; com_meta: number };
  comparativo: {
    valor_recuperado: number | null;
    valor_fechado: number | null;
    acordos: number | null;
  };
  atualizado_em: Frescor | null;
}

export interface OperadorResultado {
  chave: string;
  cpf: string | null;
  nome: string;
  supervisor: string;
  carteira: string;
  posicao: number;
  valor_fechado: number;
  valor_recuperado: number;
  acordos: number;
  cpc: number;
  dias_trabalhados: number;
  /** null = sem meta cadastrada. Diferente de 0, que seria "nao bateu". */
  meta: number | null;
  atingimento: number | null;
  nota_qualidade: number | null;
  status: "online" | "ausente" | "offline";
}

export interface PaginaOperadores {
  pagina: number;
  tamanho: number;
  total: number;
  ordenar_por: string;
  operadores: OperadorResultado[];
  atualizado_em: Frescor | null;
}

export interface CarteiraResultado {
  id_carteira: number;
  carteira: string;
  slug: string;
  valor_fechado: number;
  valor_recuperado: number;
  acordos: number;
  cpc: number;
  meta: number;
  operadores: number;
  conversao: number;
  atingimento: number;
}

export interface PontoEvolucao {
  mes_chave: string;
  mes: string;
  valor_fechado: number;
  valor_recuperado: number;
  acordos: number;
  /** false = o vega daquele mes nao existe mais na origem, nao e zero. */
  tem_vega: boolean;
}

export interface FichaOperador {
  operador: {
    chave: string;
    nome: string;
    supervisor: string;
    funcao: string;
    status: string;
    valor_fechado: number;
    valor_recuperado: number;
    acordos: number;
    cpc: number;
    dias_trabalhados: number;
    meta: number;
    atingimento: number | null;
    monitorias: number;
    nota_qualidade: number | null;
  };
  serie: Array<{
    data: string;
    valor_fechado: number;
    valor_recuperado: number;
    acordos: number;
    cpc: number;
    meta: number;
    trabalhou: boolean;
  }>;
  carteiras: Array<{
    carteira: string;
    valor_fechado: number;
    valor_recuperado: number;
  }>;
  atualizado_em: Frescor | null;
}

export interface FiltrosDisponiveis {
  carteiras: Array<{ id_carteira: number; nome: string; slug: string }>;
  supervisores: string[];
  ordenacoes: string[];
}

const params = (filtros: FiltrosResultados) => {
  const saida: Record<string, string> = {};
  Object.entries(filtros).forEach(([chave, valor]) => {
    if (valor === undefined || valor === null || valor === "") return;
    saida[chave] = String(valor);
  });
  return saida;
};

export const resultadosApi = {
  async resumo(filtros: FiltrosResultados): Promise<ResumoResultados> {
    const { data } = await axiosInstance.get<ResumoResultados>(
      "/api/gerente/resultados/resumo",
      { params: params(filtros) },
    );
    return data;
  },

  async operadores(filtros: FiltrosResultados): Promise<PaginaOperadores> {
    const { data } = await axiosInstance.get<PaginaOperadores>(
      "/api/gerente/resultados/operadores",
      { params: params(filtros) },
    );
    return data;
  },

  async carteiras(
    filtros: FiltrosResultados,
  ): Promise<{ carteiras: CarteiraResultado[] }> {
    const { data } = await axiosInstance.get<{ carteiras: CarteiraResultado[] }>(
      "/api/gerente/resultados/carteiras",
      { params: params(filtros) },
    );
    return data;
  },

  async evolucao(
    filtros: FiltrosResultados,
  ): Promise<{ serie: PontoEvolucao[]; vega_comeca_em: string | null }> {
    const { data } = await axiosInstance.get<{
      serie: PontoEvolucao[];
      vega_comeca_em: string | null;
    }>("/api/gerente/resultados/evolucao", { params: params(filtros) });
    return data;
  },

  async ficha(
    chave: string,
    filtros: FiltrosResultados,
  ): Promise<FichaOperador> {
    const { data } = await axiosInstance.get<FichaOperador>(
      `/api/gerente/resultados/operador/${encodeURIComponent(chave)}`,
      { params: params(filtros) },
    );
    return data;
  },

  async filtros(): Promise<FiltrosDisponiveis> {
    const { data } = await axiosInstance.get<FiltrosDisponiveis>(
      "/api/gerente/resultados/filtros",
    );
    return data;
  },
};

export default resultadosApi;
