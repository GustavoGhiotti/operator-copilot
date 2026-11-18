import axiosInstance from "@/utils/axiosInstance";

export type TipoConcessao = "FUNCAO" | "CENTRO_CUSTO" | "CPF";

export interface AreaPermissao {
  AREA: string;
  DESCRICAO: string;
  ATIVO: boolean;
}

export interface Concessao {
  ID_PERMISSAO: number;
  TIPO: TipoConcessao;
  VALOR: string;
  AREA: string;
  ATIVO: boolean;
  CRIADO_EM: string | null;
  CRIADO_POR: string | null;
  REVOGADO_EM: string | null;
  REVOGADO_POR: string | null;
}

export interface Perfil {
  codigo: string;
  nome: string;
  descricao: string;
  ordem: number;
  areas: string[];
}

export interface Pessoa {
  cpf: string;
  nome: string;
  centro_custo: string;
  funcao: string;
  /** null = nenhuma visão atribuída; vale o padrão do cargo. */
  perfil: string | null;
  origem: "PERFIL" | "PADRAO";
  areas: string[];
  /** Só vem no detalhe. area -> concedida (true acrescenta, false remove). */
  ajustes?: Record<string, boolean>;
}

export interface PaginaPessoas {
  pagina: number;
  tamanho: number;
  total: number;
  somente_com_visao: boolean;
  pessoas: Pessoa[];
}

export const permissaoApi = {
  async listarPerfis(): Promise<Perfil[]> {
    const { data } = await axiosInstance.get<{ perfis: Perfil[] }>(
      "/api/permissoes/perfis",
    );
    return data.perfis ?? [];
  },

  async listarPessoas(filtros: {
    busca?: string;
    perfil?: string;
    somente_com_visao?: boolean;
    pagina?: number;
    tamanho?: number;
  }): Promise<PaginaPessoas> {
    const params: Record<string, string> = {};
    Object.entries(filtros).forEach(([chave, valor]) => {
      if (valor === undefined || valor === null || valor === "") return;
      params[chave] = String(valor);
    });
    const { data } = await axiosInstance.get<PaginaPessoas>(
      "/api/permissoes/pessoas",
      { params },
    );
    return data;
  },

  /** Detalhe da pessoa. Só esta rota traz `ajustes` (o de/para explícito). */
  async obterPessoa(cpf: string): Promise<Pessoa> {
    const { data } = await axiosInstance.get<Pessoa>(
      `/api/permissoes/pessoas/${encodeURIComponent(cpf)}`,
    );
    return data;
  },

  async definirVisao(cpf: string, perfil: string): Promise<Pessoa> {
    const { data } = await axiosInstance.put<Pessoa>(
      `/api/permissoes/pessoas/${encodeURIComponent(cpf)}`,
      { perfil },
    );
    return data;
  },

  /** Devolve a pessoa ao padrão do cargo. */
  async removerVisao(cpf: string): Promise<Pessoa> {
    const { data } = await axiosInstance.delete<Pessoa>(
      `/api/permissoes/pessoas/${encodeURIComponent(cpf)}`,
    );
    return data;
  },

  /** `concedida: null` apaga o ajuste e a área volta a seguir o pacote. */
  async definirAjuste(
    cpf: string,
    area: string,
    concedida: boolean | null,
  ): Promise<Pessoa> {
    const { data } = await axiosInstance.put<Pessoa>(
      `/api/permissoes/pessoas/${encodeURIComponent(cpf)}/ajustes`,
      { area, concedida },
    );
    return data;
  },

  /** `negadas` são as áreas tiradas explicitamente na tela de acessos. */
  async minhasAreas(): Promise<{ areas: string[]; negadas: string[] }> {
    const { data } = await axiosInstance.get<{
      areas: string[];
      negadas?: string[];
    }>("/api/permissoes/minhas");
    return { areas: data.areas ?? [], negadas: data.negadas ?? [] };
  },

  async listarAreas(): Promise<AreaPermissao[]> {
    const { data } = await axiosInstance.get<{ areas: AreaPermissao[] }>(
      "/api/permissoes/areas",
    );
    return data.areas ?? [];
  },

  async listarConcessoes(area?: string): Promise<Concessao[]> {
    const { data } = await axiosInstance.get<{ concessoes: Concessao[] }>(
      "/api/permissoes/concessoes",
      { params: area ? { area } : undefined },
    );
    return data.concessoes ?? [];
  },

  /** Valores que existem no cadastro, para a tela oferecer em vez de digitar. */
  async listarValores(tipo: TipoConcessao): Promise<string[]> {
    const { data } = await axiosInstance.get<{ valores: string[] }>(
      "/api/permissoes/valores",
      { params: { tipo } },
    );
    return data.valores ?? [];
  },

  async conceder(entrada: {
    tipo: TipoConcessao;
    valor: string;
    area: string;
  }): Promise<void> {
    await axiosInstance.post("/api/permissoes/concessoes", entrada);
  },

  async revogar(idPermissao: number): Promise<void> {
    await axiosInstance.delete(`/api/permissoes/concessoes/${idPermissao}`);
  },
};

/**
 * Recarrega as areas da sessao atual a partir do servidor.
 *
 * O login grava `userAreas` no localStorage e o valor congela ate a pessoa
 * sair. Sem esta chamada, conceder um acesso hoje so teria efeito no proximo
 * login -- e quem ja estava logado quando a versao subiu ficaria sem a chave.
 *
 * Falha em silencio de proposito: se o servidor nao responder, a sessao segue
 * com o que ja tinha. Nao ha decisao de seguranca aqui; quem barra e o backend.
 */
export const sincronizarAreas = async (): Promise<void> => {
  if (!localStorage.getItem("userToken")) return;

  try {
    const { areas, negadas } = await permissaoApi.minhasAreas();
    localStorage.setItem("userAreas", JSON.stringify(areas));
    localStorage.setItem("userAreasNegadas", JSON.stringify(negadas));
  } catch {
    /* mantem o que ja estava gravado */
  }
};

export default permissaoApi;
