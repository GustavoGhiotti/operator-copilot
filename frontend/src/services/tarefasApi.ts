import axiosInstance from "@/utils/axiosInstance";

export type TarefaStatus =
  | "caixa_entrada"
  | "para_hoje"
  | "em_andamento"
  | "aguardando"
  | "concluido";

export type TarefaPrioridade = "baixa" | "media" | "alta" | "urgente";
export type RecorrenciaTipo =
  | "nenhuma"
  | "diaria"
  | "semanal"
  | "mensal";
export type VisaoTarefas =
  | "pessoal"
  | "atribuidas"
  | "equipe"
  | "todas"
  | "quadro";

export interface ChecklistItem {
  id?: number;
  texto: string;
  concluido: boolean;
  ordem?: number;
}

export interface TarefaKanban {
  id: number;
  titulo: string;
  descricao: string;
  categoria: string;
  prioridade: TarefaPrioridade;
  status: TarefaStatus;
  data_vencimento?: string | null;
  hora_vencimento?: string | null;
  data_criacao: string;
  data_atualizacao?: string | null;
  cpf_criador: string;
  cpf_responsavel: string;
  criador_nome: string;
  responsavel_nome: string;
  origem: "PESSOAL" | "EQUIPE";
  ordem: number;
  equipe_id?: string | null;
  equipe_nome?: string | null;
  quadro_id?: string | null;
  lista_id?: string | null;
  lista_nome?: string | null;
  lista_cor: string;
  comentarios_total: number;
  anexos_total: number;
  sugerir_finalizacao: boolean;
  checklist_total: number;
  checklist_concluido: number;
  checklist: ChecklistItem[];
  recorrencia_tipo?: RecorrenciaTipo | null;
  recorrencia_intervalo?: number | null;
  recorrencia_ate?: string | null;
  lembrete_minutos?: number | null;
  id_tarefa_origem?: number | null;
  id_proxima_ocorrencia?: number | null;
}

export interface EquipeTarefas {
  id: string;
  nome: string;
  centro_custo?: string | null;
  membros: number;
  pendentes: number;
  status_convite?: string | null;
}

export interface QuadroOrganizador {
  id: string;
  nome: string;
  tipo: "PESSOAL" | "EQUIPE";
  cor: string;
  favorito: boolean;
  equipe_id?: string | null;
  pode_editar: boolean;
}

export interface ListaOrganizador {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
  status_base?: TarefaStatus | null;
}

export interface ConviteEquipe {
  equipe_id: string;
  equipe_nome: string;
  supervisor_nome: string;
  convidado_em: string;
}

export interface UsuarioTarefas {
  cpf: string;
  nome: string;
  funcao: string;
  centro_custo: string;
  supervisor: boolean;
}

export interface QuadroTarefas {
  usuario: UsuarioTarefas;
  tarefas: TarefaKanban[];
  equipes: EquipeTarefas[];
  quadros: QuadroOrganizador[];
  quadro_ativo?: QuadroOrganizador | null;
  listas: ListaOrganizador[];
  convites: ConviteEquipe[];
}

export interface OperadorEquipe {
  cpf: string;
  nome: string;
  funcao: string;
  centro_custo: string;
}

export interface MembroEquipe extends OperadorEquipe {
  status: "ACEITO" | "PENDENTE" | "RECUSADO";
}

/**
 * Papel no quadro — independente do cargo na empresa. DONO administra os
 * membros, EDITOR cria e atribui tarefas, LEITOR apenas acompanha.
 */
export type PapelQuadro = "DONO" | "EDITOR" | "LEITOR";

export interface MembroQuadro extends OperadorEquipe {
  papel: PapelQuadro;
  desde?: string | null;
}

export interface DespachoLembretes {
  tarefas_avaliadas: number;
  lembretes: number;
  atrasos: number;
  executado_em: string;
}

export interface TarefaPayload {
  titulo: string;
  descricao: string;
  categoria: string;
  prioridade: TarefaPrioridade;
  status?: TarefaStatus;
  data_vencimento?: string;
  hora_vencimento?: string;
  cpf_responsavel?: string;
  equipe_id?: string;
  quadro_id?: string;
  lista_id?: string;
  checklist: ChecklistItem[];
  recorrencia_tipo?: RecorrenciaTipo;
  recorrencia_intervalo?: number;
  recorrencia_ate?: string;
  lembrete_minutos?: number | null;
}

export interface NotificacaoTarefa {
  id: number;
  id_todo?: number | null;
  tipo: "ATRIBUICAO" | "COMENTARIO" | "LEMBRETE" | "ATRASO" | "RECORRENCIA";
  titulo: string;
  mensagem: string;
  lida: boolean;
  criada_em: string;
}

export interface ComentarioTarefa {
  id: number;
  cpf_autor: string;
  autor_nome: string;
  conteudo: string;
  criado_em: string;
}

export interface HistoricoTarefa {
  id: number;
  cpf_autor: string;
  autor_nome: string;
  acao: string;
  descricao: string;
  valor_anterior?: string | null;
  valor_novo?: string | null;
  criado_em: string;
}

export interface AnexoTarefa {
  id: number;
  cpf_autor: string;
  autor_nome: string;
  nome: string;
  url: string;
  criado_em: string;
}

export interface DetalhesTarefa {
  comentarios: ComentarioTarefa[];
  historico: HistoricoTarefa[];
  anexos: AnexoTarefa[];
}

export interface CentralGestaoArea {
  centro_custo: string;
  equipes: number;
  colaboradores: number;
  total_tarefas: number;
  concluidas: number;
  em_andamento: number;
  atrasadas: number;
  taxa_conclusao: number;
}

export interface CentralGestaoAtencao {
  id: number;
  titulo: string;
  prioridade: TarefaPrioridade;
  status: TarefaStatus;
  data_vencimento?: string | null;
  responsavel: string;
  equipe: string;
  centro_custo: string;
  dias_atraso: number;
}

export interface CentralGestaoPayload {
  atualizado_em: string;
  gestor: { nome: string; centro_custo: string };
  filtros?: {
    periodo_dias: number;
    centro_custo?: string | null;
    centros_disponiveis: string[];
  };
  resumo: {
    total_tarefas: number;
    concluidas: number;
    em_andamento: number;
    atrasadas: number;
    equipes: number;
    areas: number;
    taxa_conclusao: number;
  };
  areas: CentralGestaoArea[];
  atencoes: CentralGestaoAtencao[];
  evolucao: Array<{ mes: string; criadas: number; concluidas: number }>;
  academia: {
    resumo: {
      cursos_publicados: number;
      alunos_ativos: number;
      total_matriculas: number;
      total_iniciaram: number;
      total_concluidos: number;
      alunos_em_risco: number;
      alunos_interrompidos: number;
      conclusao_media: number;
    };
    desempenho: Array<{
      curso_id: number;
      titulo: string;
      matriculas: number;
      concluidos: number;
      taxa_conclusao: number;
      progresso_medio: number;
    }>;
    abandonos: Array<{
      aula_titulo: string;
      curso_titulo: string;
      abandonos: number;
      taxa_abandono: number;
    }>;
    centros: Array<{
      centro_custo: string;
      matriculas: number;
      concluidos: number;
      em_risco: number;
      interrompidos: number;
      progresso_medio: number;
    }>;
  };
  arena: {
    resumo: {
      campanhas: number;
      campanhas_ativas: number;
      finalizadas: number;
      participantes: number;
      convites: number;
      confirmacoes: number;
      xp_distribuido: number;
    };
    centros: Array<{
      centro_custo: string;
      campanhas: number;
      participantes: number;
      convites: number;
      confirmacoes: number;
      participacoes_finalizadas: number;
      xp: number;
    }>;
    campanhas: Array<{
      id: number;
      titulo: string;
      status: string;
      centro_custo?: string | null;
      tipo_jogo: string;
      data_agendada?: string | null;
      participantes: number;
      confirmacoes: number;
    }>;
  };
  equipes: {
    resumo: {
      equipes: number;
      membros: number;
      convites_pendentes: number;
      tarefas: number;
      atrasadas: number;
    };
    lista: Array<{
      id: string;
      nome: string;
      centro_custo: string;
      supervisor: string;
      membros: number;
      convites_pendentes: number;
      tarefas: number;
      concluidas: number;
      atrasadas: number;
    }>;
  };
  qualidade: {
    resumo: {
      monitorias: number;
      operadores: number;
      monitores: number;
      nota_media: number;
      negativas: number;
      ultimos_30_dias: number;
      monitorias_anteriores?: number;
      nota_media_anterior?: number;
    };
    carteiras: Array<{
      carteira: string;
      monitorias: number;
      operadores: number;
      nota_media: number;
      negativas: number;
      ultima_monitoria?: string | null;
    }>;
    evolucao: Array<{
      mes: string;
      monitorias: number;
      nota_media: number;
    }>;
  };
  uso_copilot: {
    resumo: {
      acessos: number;
      usuarios: number;
      acessos_30_dias: number;
      usuarios_30_dias: number;
      acessos_anteriores?: number;
      usuarios_anteriores?: number;
      ultimo_acesso?: string | null;
    };
    centros: Array<{
      centro_custo: string;
      acessos: number;
      usuarios: number;
      ultimo_acesso?: string | null;
    }>;
    comandos: Array<{
      comando: string;
      usos: number;
      usuarios: number;
    }>;
  };
}

const api = {
  registrarUso(comando: string) {
    return axiosInstance.post("/api/todos/v2/usage-events", { comando });
  },

  async carregarCentralGestao(filtros?: {
    periodo?: number;
    centroCusto?: string;
  }) {
    const response = await axiosInstance.get<CentralGestaoPayload>(
      "/api/todos/v2/management-overview",
      {
        params: {
          periodo: filtros?.periodo,
          centro_custo: filtros?.centroCusto || undefined,
        },
      }
    );
    const data = response.data;

    return {
      ...data,
      filtros: {
        periodo_dias: data.filtros?.periodo_dias ?? filtros?.periodo ?? 30,
        centro_custo: data.filtros?.centro_custo ?? filtros?.centroCusto ?? null,
        centros_disponiveis: data.filtros?.centros_disponiveis ?? [],
      },
      equipes: {
        resumo: {
          equipes: 0,
          membros: 0,
          convites_pendentes: 0,
          tarefas: 0,
          atrasadas: 0,
          ...data.equipes?.resumo,
        },
        lista: data.equipes?.lista ?? [],
      },
      qualidade: {
        resumo: {
          monitorias: 0,
          operadores: 0,
          monitores: 0,
          nota_media: 0,
          negativas: 0,
          ultimos_30_dias: 0,
          monitorias_anteriores: 0,
          nota_media_anterior: 0,
          ...data.qualidade?.resumo,
        },
        carteiras: data.qualidade?.carteiras ?? [],
        evolucao: data.qualidade?.evolucao ?? [],
      },
      uso_copilot: {
        resumo: {
          acessos: 0,
          usuarios: 0,
          acessos_30_dias: 0,
          usuarios_30_dias: 0,
          ultimo_acesso: null,
          acessos_anteriores: 0,
          usuarios_anteriores: 0,
          ...data.uso_copilot?.resumo,
        },
        centros: data.uso_copilot?.centros ?? [],
        comandos: data.uso_copilot?.comandos ?? [],
      },
    };
  },

  async carregarQuadro(
    visao: VisaoTarefas,
    equipeId?: string,
    quadroId?: string
  ) {
    const response = await axiosInstance.get<QuadroTarefas>(
      "/api/todos/v2/board",
      { params: { visao, equipe_id: equipeId, quadro_id: quadroId } }
    );
    return response.data;
  },

  criarTarefa(payload: TarefaPayload) {
    return axiosInstance.post("/api/todos/v2/tasks", payload);
  },

  atualizarTarefa(id: number, payload: TarefaPayload) {
    return axiosInstance.put(`/api/todos/v2/tasks/${id}`, payload);
  },

  moverTarefa(
    id: number,
    status: TarefaStatus,
    ordem = 0,
    listaId?: string
  ) {
    return axiosInstance.patch(`/api/todos/v2/tasks/${id}/move`, {
      status,
      ordem,
      lista_id: listaId,
    });
  },

  reagendarTarefa(
    id: number,
    dataVencimento: string,
    horaVencimento?: string | null
  ) {
    return axiosInstance.patch(`/api/todos/v2/tasks/${id}/schedule`, {
      data_vencimento: dataVencimento,
      hora_vencimento: horaVencimento || null,
    });
  },

  atualizarChecklist(id: number, checklist: ChecklistItem[]) {
    return axiosInstance.patch(`/api/todos/v2/tasks/${id}/checklist`, {
      checklist,
    });
  },

  async carregarDetalhes(id: number) {
    const response = await axiosInstance.get<DetalhesTarefa>(
      `/api/todos/v2/tasks/${id}/details`
    );
    return response.data;
  },

  adicionarComentario(id: number, conteudo: string) {
    return axiosInstance.post(`/api/todos/v2/tasks/${id}/comments`, {
      conteudo,
    });
  },

  adicionarAnexo(id: number, nome: string, url: string) {
    return axiosInstance.post(`/api/todos/v2/tasks/${id}/attachments`, {
      nome,
      url,
    });
  },

  atualizarAutomacao(id: number, ativa: boolean) {
    return axiosInstance.patch(`/api/todos/v2/tasks/${id}/automation`, {
      ativa,
    });
  },

  async listarNotificacoes() {
    const response = await axiosInstance.get<NotificacaoTarefa[]>(
      "/api/todos/v2/notifications"
    );
    return response.data;
  },

  async despacharLembretes() {
    const response = await axiosInstance.post<DespachoLembretes>(
      "/api/todos/v2/notifications/dispatch"
    );
    return response.data;
  },

  async listarMembrosQuadro(quadroId: string) {
    const response = await axiosInstance.get<MembroQuadro[]>(
      `/api/todos/v2/boards/${quadroId}/members`
    );
    return response.data;
  },

  definirMembroQuadro(
    quadroId: string,
    cpf: string,
    papel: PapelQuadro = "EDITOR"
  ) {
    return axiosInstance.post(
      `/api/todos/v2/boards/${quadroId}/members`,
      { cpf, papel }
    );
  },

  removerMembroQuadro(quadroId: string, cpf: string) {
    return axiosInstance.delete(
      `/api/todos/v2/boards/${quadroId}/members/${cpf}`
    );
  },

  marcarNotificacoesLidas(id?: number) {
    return axiosInstance.patch("/api/todos/v2/notifications/read", {
      id,
    });
  },

  arquivarTarefa(id: number) {
    return axiosInstance.delete(`/api/todos/v2/tasks/${id}`);
  },

  criarEquipe(nome: string, centroCusto: string) {
    return axiosInstance.post("/api/todos/v2/teams", {
      nome,
      centro_custo: centroCusto,
    });
  },

  criarQuadro(nome: string, cor: string) {
    return axiosInstance.post("/api/todos/v2/boards", { nome, cor });
  },

  criarLista(quadroId: string, nome: string, cor: string) {
    return axiosInstance.post(
      `/api/todos/v2/boards/${quadroId}/lists`,
      { nome, cor }
    );
  },

  async pesquisarOperadores(nome?: string, centroCusto?: string) {
    const response = await axiosInstance.get<OperadorEquipe[]>(
      "/api/todos/v2/operators",
      { params: { nome, centro_custo: centroCusto } }
    );
    return response.data;
  },

  enviarConvites(equipeId: string, cpfs: string[]) {
    return axiosInstance.post(
      `/api/todos/v2/teams/${equipeId}/invites`,
      { cpfs }
    );
  },

  responderConvite(equipeId: string, aceitar: boolean) {
    return axiosInstance.patch(`/api/todos/v2/invites/${equipeId}`, {
      aceitar,
    });
  },

  async listarMembros(equipeId: string) {
    const response = await axiosInstance.get<MembroEquipe[]>(
      `/api/todos/v2/teams/${equipeId}/members`
    );
    return response.data;
  },

  removerMembro(equipeId: string, cpf: string) {
    return axiosInstance.delete(
      `/api/todos/v2/teams/${equipeId}/members/${cpf}`
    );
  },
};

export default api;
