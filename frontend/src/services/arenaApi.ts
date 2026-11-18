import axiosInstance from "@/utils/axiosInstance";

export interface ArenaGameType {
  id: number;
  codigo: string;
  nome: string;
  descricao?: string | null;
  icone?: string | null;
  cor?: string | null;
}

export interface ArenaCampaignSummary {
  id: number;
  titulo: string;
  descricao?: string | null;
  centro_custo?: string | null;
  status: string;
  tipo_jogo: string;
  tipo_jogo_nome: string;
  participantes: number;
  confirmados: number;
  data_agendada?: string | null;
  criada_em?: string | null;
  id_sessao?: number | null;
  status_sessao?: string | null;
  limite_entrada_em?: string | null;
}

export interface ArenaParticipant {
  id: number;
  cpf: string;
  nome: string;
  centro_custo: string;
  origem_selecao: "LOTE_CENTRO_CUSTO" | "INDIVIDUAL";
  status: string;
  id_convite?: number | null;
  status_convite?: string | null;
}

export interface ArenaSupervisorDashboard {
  supervisor: { cpf: string; nome: string; centro_custo?: string | null };
  resumo: {
    campanhas_ativas: number;
    salas_agendadas: number;
    participantes: number;
    xp_distribuido: number;
  };
  campanhas: ArenaCampaignSummary[];
}

export interface ArenaOperatorCampaign extends ArenaCampaignSummary {
  id_convite?: number | null;
  status_convite?: string | null;
  status_participante?: string | null;
  convite_expira_em?: string | null;
  limite_entrada_em?: string | null;
  pontuacao?: number | null;
  classificacao?: number | null;
  xp_concedido?: number | null;
}

export interface ArenaHub {
  usuario: { cpf: string; nome: string; centro_custo?: string | null };
  temporada?: { id: number; nome: string; data_inicio: string; data_fim: string } | null;
  perfil: {
    xp_total: number;
    xp_temporada: number;
    nivel: number;
    titulo: string;
    xp_inicio_nivel: number;
    xp_proximo_nivel: number;
  };
  campanhas: ArenaOperatorCampaign[];
}

export type ArenaAuroraSlot =
  | "VISUAL"
  // Slots antigos permanecem tipados durante a migração dos equipamentos.
  | "CABECA"
  | "OCULOS"
  | "BRINCO"
  | "MAQUIAGEM"
  | "SUPERIOR"
  | "INFERIOR"
  | "CALCADO"
  // Estes três não são peças de roupa: são cenário, brilho e contorno. Por
  // isso existem sem depender de arte nova da personagem.
  | "FUNDO"
  | "AURA"
  | "MOLDURA";

export interface ArenaAuroraItem {
  id: number;
  codigo: string;
  nome: string;
  descricao?: string | null;
  slot: ArenaAuroraSlot;
  raridade: "COMUM" | "RARO" | "EPICO" | "LENDARIO";
  /** Legado: presets completos publicados sempre retornam nulo. */
  filtro_cor?: string | null;
  codigo_conjunto?: string | null;
  nome_conjunto?: string | null;
  preco_coins: number;
  xp_necessario: number;
  chave_visual: string;
  adquirido: boolean;
  adquirido_em?: string | null;
  equipado: boolean;
  desbloqueado: boolean;
  pode_comprar: boolean;
}

export interface ArenaAuroraColecao {
  total: number;
  adquiridos: number;
  proximo_desbloqueio: {
    codigo: string;
    nome: string;
    raridade: string;
    xp_necessario: number;
    xp_faltando: number;
  } | null;
}

export interface ArenaAuroraConjunto {
  codigo: string;
  nome: string;
  total: number;
  adquiridos: number;
  equipados: number;
  /** Tem todas as peças. */
  completo: boolean;
  /** Está com todas vestidas — é isto que vale o bônus. */
  ativo: boolean;
}

export interface ArenaAuroraCustomization {
  xp_total: number;
  saldo_coins: number;
  equipado: Partial<Record<ArenaAuroraSlot, string>>;
  filtros: Partial<Record<ArenaAuroraSlot, string>>;
  colecao: ArenaAuroraColecao;
  conjuntos: ArenaAuroraConjunto[];
  itens: ArenaAuroraItem[];
}

export interface ArenaOperator {
  cpf: string;
  nome: string;
  centro_custo: string;
  funcao?: string | null;
}

export interface ArenaSavedTeam {
  id: number;
  nome_supervisor: string;
  cpf_supervisor: string;
  carteira_nome: string;
  integrantes: ArenaOperator[];
}

export interface ArenaProductionResult {
  carteira: string;
  quantidade_operadores: number;
  acordos_dia: number;
  acordos_mes: number;
  valor_fechado_dia: number;
  valor_fechado_mes: number;
  valor_pago_dia: number;
  valor_pago_mes: number;
  pagamentos_dia: number;
  pagamentos_mes: number;
  cpc_dia: number;
  ce_dia: number;
  acionamentos_dia: number;
}

export interface ArenaProductionTracking {
  id_campanha: number;
  id_sessao: number;
  status: string;
  snapshots: Array<{
    id: number;
    tipo: "INICIAL" | "PERIODICO" | "FINAL";
    numero: number;
    coletado_em: string;
    resultado: ArenaProductionResult;
    variacao_inicial: Record<string, { percentual?: number | null }>;
    variacao_anterior: Record<string, { percentual?: number | null }>;
  }>;
}

export interface ArenaSessionParticipant {
  id: number;
  cpf: string;
  nome: string;
  centro_custo: string;
  status: string;
  status_conexao?: string | null;
  entrou_em?: string | null;
  /** O visual que a pessoa montou no "Minha Aurora". */
  visual?: {
    equipado: Partial<Record<ArenaAuroraSlot, string>>;
    filtros: Partial<Record<ArenaAuroraSlot, string>>;
  };
}

export interface ArenaSession {
  id: number;
  id_campanha: number;
  titulo: string;
  tipo_jogo: string;
  status: string;
  status_campanha: string;
  aberta_em: string;
  limite_entrada_em: string;
  servidor_agora: string;
  entrada_aberta: boolean;
  papel: "SUPERVISOR" | "OPERADOR";
  participantes: ArenaSessionParticipant[];
}

export type ArenaBingoWinningPattern =
  | "LINHA"
  | "DUAS_LINHAS"
  | "QUATRO_CANTOS"
  | "CARTELA_CHEIA";

export interface ArenaBingoConfig {
  id?: number | null;
  id_campanha: number;
  padrao_vitoria: ArenaBingoWinningPattern;
  casa_livre: boolean;
  xp_participacao: number;
  xp_vitoria: number;
  status: string;
}

export interface ArenaBingoCell {
  id: number;
  coluna: "B" | "I" | "N" | "G" | "O";
  linha: number;
  numero?: number | null;
  livre: boolean;
  marcada: boolean;
  marcada_em?: string | null;
}

export interface ArenaBingoDraw {
  id: number;
  numero: number;
  letra: "B" | "I" | "N" | "G" | "O";
  ordem: number;
  sorteado_em: string;
}

export interface ArenaLiveBingoState {
  id_sessao: number;
  id_campanha: number;
  titulo: string;
  status_sessao: string;
  versao: number;
  papel: "SUPERVISOR" | "OPERADOR";
  id_participante?: number | null;
  id_cartela?: number | null;
  padrao_vitoria: ArenaBingoWinningPattern;
  casa_livre: boolean;
  pausada: boolean;
  aguardando_decisao: boolean;
  pausada_em?: string | null;
  encerramento_tipo?: "BINGO" | "MANUAL" | null;
  iniciada_em?: string | null;
  finalizada_em?: string | null;
  pontuacao: number;
  classificacao?: number | null;
  xp_concedido: number;
  total_sorteios: number;
  participantes_online: number;
  servidor_agora: string;
  sorteios: ArenaBingoDraw[];
  vitorias: Array<{
    id_participante: number;
    nome: string;
    padrao: ArenaBingoWinningPattern;
    /** `null` enquanto o desempate não saiu. */
    posicao: number | null;
    pedra_desempate?: number | null;
  }>;
  /** Janela em que outros bingos ainda são aceitos. */
  disputa_aberta?: boolean;
  disputa_encerra_em?: string | null;
  /** Empate aguardando o supervisor sortear as pedras. */
  aguardando_desempate?: boolean;
  cartela: ArenaBingoCell[];
  progresso: Array<{
    id_participante: number;
    nome: string;
    centro_custo: string;
    marcadas: number;
    classificacao?: number | null;
    xp: number;
    pontos: number;
    faltam_para_vencer: number;
    quase_bingo: boolean;
    numeros_necessarios: number[];
  }>;
}

export interface ArenaQuizAlternative {
  id?: number;
  texto: string;
  correta: boolean;
  ordem?: number;
}

export interface ArenaQuizQuestion {
  id?: number;
  enunciado: string;
  explicacao?: string | null;
  tempo_segundos?: number | null;
  alternativas: ArenaQuizAlternative[];
}

export interface ArenaQuizConfig {
  id?: number | null;
  id_campanha: number;
  tempo_pergunta_segundos: number;
  pontos_acerto: number;
  bonus_velocidade_max: number;
  embaralhar_perguntas: boolean;
  embaralhar_alternativas: boolean;
  status: string;
  perguntas: ArenaQuizQuestion[];
}

export interface ArenaQuizAISuggestions {
  id_campanha: number;
  tema: string;
  dificuldade: "BASICO" | "INTERMEDIARIO" | "AVANCADO";
  aviso: string;
  perguntas: ArenaQuizQuestion[];
}

export interface ArenaLiveQuizAlternative {
  id: number;
  texto: string;
  correta?: boolean | null;
  ordem: number;
}

export interface ArenaLiveQuizRound {
  id: number;
  ordem: number;
  status: "ABERTA" | "ENCERRADA";
  iniciada_em?: string | null;
  encerra_em?: string | null;
  encerrada_em?: string | null;
  enunciado: string;
  explicacao?: string | null;
  respostas_recebidas: number;
  total_participantes: number;
  alternativas: ArenaLiveQuizAlternative[];
  resposta?: {
    id_alternativa: number;
    correta?: boolean | null;
    pontos?: number | null;
    respondida_em?: string | null;
  } | null;
}

export interface ArenaLiveQuizState {
  id_sessao: number;
  id_campanha: number;
  id_participante?: number | null;
  titulo: string;
  status_sessao: string;
  papel: "SUPERVISOR" | "OPERADOR";
  fase: "AGUARDANDO" | "PERGUNTA" | "RESULTADO" | "FINALIZADO";
  servidor_agora: string;
  total_rodadas: number;
  pontuacao: number;
  classificacao?: number | null;
  xp_concedido: number;
  rodada?: ArenaLiveQuizRound | null;
  placar: Array<{
    id_participante: number;
    nome: string;
    centro_custo: string;
    pontos: number;
    acertos: number;
    classificacao?: number | null;
    xp: number;
  }>;
}

export interface ArenaSessaoAoVivo {
  id: number;
  id_campanha: number;
  status: string;
  titulo: string;
  centro_custo?: string | null;
  cpf_supervisor: string;
  nome_supervisor: string;
  tipo_jogo: string;
  tipo_jogo_nome: string;
  na_sala: number;
  convidados: number;
  total_sorteios: number;
  aberta_em?: string | null;
  limite_entrada_em?: string | null;
  iniciada_em?: string | null;
}

export interface ArenaObservatorio {
  /** Só o Desenvolvimento assume partidas; a Gerência apenas acompanha. */
  pode_assumir: boolean;
  sessoes: ArenaSessaoAoVivo[];
}

export interface ArenaCartelaObservada {
  id_cartela: number;
  id_participante: number;
  nome: string;
  centro_custo?: string | null;
  status_participante: string;
  casas: Array<{
    coluna: string;
    linha: number;
    numero: number | null;
    livre: boolean;
    marcada: boolean;
  }>;
}

export const arenaApi = {
  async getHub() {
    return (await axiosInstance.get<ArenaHub>("/api/arena/hub")).data;
  },

  async getAuroraCustomization() {
    return (
      await axiosInstance.get<ArenaAuroraCustomization>("/api/arena/aurora")
    ).data;
  },

  async buyAuroraVisual(codigoItem: string) {
    return (
      await axiosInstance.post<ArenaAuroraCustomization>(
        "/api/arena/aurora/compras",
        { codigo_item: codigoItem },
      )
    ).data;
  },

  async equipAuroraVisual(
    slot: ArenaAuroraSlot,
    codigoItem: string | null,
  ) {
    return (
      await axiosInstance.put<ArenaAuroraCustomization>(
        "/api/arena/aurora/equipamento",
        { slot, codigo_item: codigoItem },
      )
    ).data;
  },

  async respondInvite(id: number, resposta: "ACEITO" | "RECUSADO") {
    return (
      await axiosInstance.patch(`/api/arena/convites/${id}/resposta`, {
        resposta,
      })
    ).data;
  },

  /** Tira a campanha das listas dos dois lados, sem apagar histórico nem XP. */
  async archiveCampaign(campaignId: number) {
    return (
      await axiosInstance.post<{
        id_campanha: number;
        arquivada: boolean;
        status_anterior: string;
      }>(`/api/arena/supervisor/campanhas/${campaignId}/arquivar`)
    ).data;
  },

  async unarchiveCampaign(campaignId: number) {
    return (
      await axiosInstance.post<{
        id_campanha: number;
        arquivada: boolean;
        status: string;
      }>(`/api/arena/supervisor/campanhas/${campaignId}/desarquivar`)
    ).data;
  },

  async listCampaigns(incluirArquivadas = false) {
    return (
      await axiosInstance.get<ArenaCampaignSummary[]>(
        "/api/arena/supervisor/campanhas",
        { params: incluirArquivadas ? { arquivadas: 1 } : undefined },
      )
    ).data;
  },

  /** Tudo que está acontecendo agora, em qualquer equipe. */
  async getObservatorio() {
    return (
      await axiosInstance.get<ArenaObservatorio>("/api/arena/observatorio")
    ).data;
  },

  async getObservatorioCartelas(sessionId: number) {
    return (
      await axiosInstance.get<{
        id_sessao: number;
        cartelas: ArenaCartelaObservada[];
      }>(`/api/arena/observatorio/sessoes/${sessionId}/cartelas`)
    ).data;
  },

  /** Passa a campanha para quem pediu — o supervisor original perde o comando. */
  async assumirControle(sessionId: number) {
    return (
      await axiosInstance.post<{
        id_sessao: number;
        id_campanha: number;
        supervisor_anterior: string;
        assumido: boolean;
      }>(`/api/arena/observatorio/sessoes/${sessionId}/assumir`)
    ).data;
  },

  async getSupervisorDashboard(incluirArquivadas = false) {
    return (
      await axiosInstance.get<ArenaSupervisorDashboard>(
        "/api/arena/supervisor/dashboard",
        { params: incluirArquivadas ? { arquivadas: 1 } : undefined },
      )
    ).data;
  },

  async getGameTypes() {
    return (
      await axiosInstance.get<ArenaGameType[]>("/api/arena/tipos-jogo")
    ).data;
  },

  async getCostCenters() {
    return (
      await axiosInstance.get<string[]>(
        "/api/arena/supervisor/centros-custo",
      )
    ).data;
  },

  async getOperators(centroCusto: string, busca = "", limite = 100) {
    return (
      await axiosInstance.get<ArenaOperator[]>(
        "/api/arena/supervisor/operadores",
        { params: { centro_custo: centroCusto, busca, limite } },
      )
    ).data;
  },

  async getSavedTeams() {
    return (
      await axiosInstance.get<ArenaSavedTeam[]>(
        "/api/arena/supervisor/equipes",
      )
    ).data;
  },

  async getProductionTracking(campaignId: number) {
    return (
      await axiosInstance.get<ArenaProductionTracking>(
        `/api/arena/supervisor/campanhas/${campaignId}/acompanhamento`,
      )
    ).data;
  },

  async createCampaign(payload: {
    titulo: string;
    descricao?: string;
    tipo_jogo: string;
    data_agendada?: string | null;
    configuracao?: Record<string, unknown>;
  }) {
    return (
      await axiosInstance.post<{
        id: number;
        status: string;
        janela_entrada_segundos: number;
      }>("/api/arena/supervisor/campanhas", payload)
    ).data;
  },

  async saveAudience(
    id: number,
    payload: {
      centros_custo: string[];
      cpfs: string[];
      cpfs_excluidos?: string[];
    },
  ) {
    return (
      await axiosInstance.put<{
        id_campanha: number;
        participantes: number;
        centros_custo: string[];
        id_equipe: number;
      }>(`/api/arena/supervisor/campanhas/${id}/publico`, payload)
    ).data;
  },

  async getQuiz(campaignId: number) {
    return (
      await axiosInstance.get<ArenaQuizConfig>(
        `/api/arena/supervisor/campanhas/${campaignId}/quiz`,
      )
    ).data;
  },

  async saveQuiz(campaignId: number, payload: Omit<ArenaQuizConfig, "id" | "id_campanha" | "status">) {
    return (
      await axiosInstance.put<ArenaQuizConfig>(
        `/api/arena/supervisor/campanhas/${campaignId}/quiz`,
        payload,
      )
    ).data;
  },

  async getBingo(campaignId: number) {
    return (
      await axiosInstance.get<ArenaBingoConfig>(
        `/api/arena/supervisor/campanhas/${campaignId}/bingo`,
      )
    ).data;
  },

  async saveBingo(
    campaignId: number,
    payload: Omit<ArenaBingoConfig, "id" | "id_campanha" | "status">,
  ) {
    return (
      await axiosInstance.put<ArenaBingoConfig>(
        `/api/arena/supervisor/campanhas/${campaignId}/bingo`,
        payload,
      )
    ).data;
  },

  async generateQuizSuggestions(
    campaignId: number,
    payload: {
      tema: string;
      contexto?: string;
      dificuldade: "BASICO" | "INTERMEDIARIO" | "AVANCADO";
      quantidade: number;
    },
  ) {
    return (
      await axiosInstance.post<ArenaQuizAISuggestions>(
        `/api/arena/supervisor/campanhas/${campaignId}/quiz/sugestoes-ia`,
        payload,
        { timeout: 55000 },
      )
    ).data;
  },

  async publishCampaign(id: number) {
    return (
      await axiosInstance.post<{
        id_campanha: number;
        status: string;
        convites_enviados: number;
      }>(`/api/arena/supervisor/campanhas/${id}/publicar`)
    ).data;
  },

  async openRoom(campaignId: number) {
    return (
      await axiosInstance.post<ArenaSession>(
        `/api/arena/supervisor/campanhas/${campaignId}/abrir-sala`,
      )
    ).data;
  },

  async getSession(sessionId: number) {
    return (
      await axiosInstance.get<ArenaSession>(
        `/api/arena/sessoes/${sessionId}`,
      )
    ).data;
  },

  async enterRoom(sessionId: number) {
    return (
      await axiosInstance.post<ArenaSession>(
        `/api/arena/sessoes/${sessionId}/entrar`,
      )
    ).data;
  },

  async startSession(sessionId: number) {
    return (
      await axiosInstance.post<ArenaSession>(
        `/api/arena/supervisor/sessoes/${sessionId}/iniciar`,
      )
    ).data;
  },

  /** Inclui gente numa sala que ainda está em espera. */
  async addParticipants(
    sessionId: number,
    payload: { centros_custo?: string[]; cpfs?: string[] },
  ) {
    return (
      await axiosInstance.post<ArenaSession>(
        `/api/arena/supervisor/sessoes/${sessionId}/participantes`,
        payload,
      )
    ).data;
  },

  /** Desiste da partida: a campanha volta a ficar publicada. */
  async closeRoom(sessionId: number) {
    return (
      await axiosInstance.post<{
        id_sessao: number;
        id_campanha: number;
        fechada: boolean;
      }>(`/api/arena/supervisor/sessoes/${sessionId}/fechar`)
    ).data;
  },

  async getLiveQuiz(sessionId: number) {
    return (
      await axiosInstance.get<ArenaLiveQuizState>(
        `/api/arena/sessoes/${sessionId}/quiz`,
      )
    ).data;
  },

  async answerLiveQuiz(
    sessionId: number,
    payload: { id_rodada: number; id_alternativa: number },
  ) {
    return (
      await axiosInstance.post<ArenaLiveQuizState>(
        `/api/arena/sessoes/${sessionId}/quiz/respostas`,
        payload,
      )
    ).data;
  },

  async getLiveBingo(sessionId: number) {
    return (
      await axiosInstance.get<ArenaLiveBingoState>(
        `/api/arena/sessoes/${sessionId}/bingo`,
      )
    ).data;
  },

  /** Tira uma pedra para cada empatado; a maior vence. */
  async drawBingoTiebreak(sessionId: number) {
    return (
      await axiosInstance.post<{
        id_sessao: number;
        desempate: Array<{
          id_participante: number;
          nome: string;
          pedra: number;
          posicao: number;
        }>;
      }>(`/api/arena/supervisor/sessoes/${sessionId}/bingo/desempate`)
    ).data;
  },

  async drawBingoNumber(sessionId: number) {
    return (
      await axiosInstance.post<ArenaLiveBingoState>(
        `/api/arena/supervisor/sessoes/${sessionId}/bingo/sortear`,
      )
    ).data;
  },

  async controlBingo(
    sessionId: number,
    acao: "PAUSAR" | "RETOMAR" | "CONTINUAR" | "ENCERRAR",
    padraoVitoria?: ArenaBingoWinningPattern,
  ) {
    return (
      await axiosInstance.post<ArenaLiveBingoState>(
        `/api/arena/supervisor/sessoes/${sessionId}/bingo/controle`,
        { acao, padrao_vitoria: padraoVitoria },
      )
    ).data;
  },

  async getSupervisors(busca: string) {
    return (
      await axiosInstance.get<ArenaOperator[]>(
        "/api/arena/supervisor/supervisores",
        { params: { busca, limite: 20 } },
      )
    ).data;
  },

  async transferBingo(sessionId: number, cpfDestino: string) {
    return (
      await axiosInstance.post<{
        transferida: boolean;
        id_sessao: number;
        supervisor: ArenaOperator;
      }>(`/api/arena/supervisor/sessoes/${sessionId}/bingo/transferir`, {
        cpf_destino: cpfDestino,
      })
    ).data;
  },

  async claimBingo(sessionId: number) {
    return (
      await axiosInstance.post<ArenaLiveBingoState>(
        `/api/arena/sessoes/${sessionId}/bingo/solicitar`,
      )
    ).data;
  },
};
