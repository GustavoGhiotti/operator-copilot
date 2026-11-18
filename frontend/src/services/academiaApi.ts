import axiosInstance from "@/utils/axiosInstance";

export type AulaTipo =
  | "VIDEO"
  | "PDF"
  | "TEXTO"
  | "QUIZ"
  | "SIMULACAO"
  | "TREINAMENTO"
  | "LINK";

export interface AcademiaQuizAlternative {
  id: string;
  texto: string;
  correta: boolean;
}

export interface AcademiaQuizQuestion {
  id: string;
  enunciado: string;
  explicacao: string;
  alternativas: AcademiaQuizAlternative[];
}

export interface AcademiaQuizConfig {
  nota_minima: number;
  perguntas: AcademiaQuizQuestion[];
}

/**
 * Versão do quiz que chega ao aluno: o backend remove a marcação de
 * alternativa correta e a explicação antes de enviar.
 */
export interface AcademiaQuizAlunoAlternativa {
  id: string;
  texto: string;
}

export interface AcademiaQuizAlunoPergunta {
  id: string;
  enunciado: string;
  alternativas: AcademiaQuizAlunoAlternativa[];
}

export interface AcademiaQuizAluno {
  nota_minima: number;
  perguntas: AcademiaQuizAlunoPergunta[];
}

export interface AcademiaQuizResultado {
  melhor_nota: number;
  tentativas: number;
  aprovada: boolean;
  realizada_em?: string | null;
}

export interface AcademiaQuizCorrecaoItem {
  pergunta_id: string;
  enunciado: string;
  resposta_enviada?: string | null;
  resposta_correta?: string | null;
  acertou: boolean;
  explicacao: string;
}

export interface AcademiaQuizEnvioResposta {
  nota: number;
  acertos: number;
  total_perguntas: number;
  nota_minima: number;
  aprovada: boolean;
  tentativas: number;
  registrado: boolean;
  correcao: AcademiaQuizCorrecaoItem[];
  curso: CursoDetalhe;
}

export type SituacaoPrazo =
  | "EM_DIA"
  | "VENCE_EM_BREVE"
  | "VENCIDO"
  | "CONCLUIDO";

export interface CertificadoAcademia {
  codigo: string;
  nome?: string | null;
  centro_custo?: string | null;
  curso_titulo?: string | null;
  curso_id?: number | null;
  carga_horaria_min: number;
  total_aulas: number;
  nota_final?: number | null;
  emitido_em?: string | null;
}

export interface CursoResumo {
  id: number;
  titulo: string;
  descricao?: string | null;
  capa_url?: string | null;
  nivel: "INICIANTE" | "INTERMEDIARIO" | "AVANCADO";
  carga_horaria_min: number;
  total_modulos: number;
  total_aulas: number;
  matriculado: boolean;
  status_matricula?: "EM_ANDAMENTO" | "CONCLUIDO" | null;
  progresso: number;
  obrigatoria: boolean;
  data_limite?: string | null;
  situacao_prazo?: SituacaoPrazo | null;
}

export interface AulaAcademia {
  id: number;
  titulo: string;
  descricao?: string | null;
  tipo: AulaTipo;
  conteudo_url?: string | null;
  conteudo_texto?: string | null;
  quiz?: AcademiaQuizAluno | null;
  quiz_resultado?: AcademiaQuizResultado | null;
  comando?: string | null;
  duracao_min: number;
  ordem: number;
  obrigatoria: boolean;
  percentual: number;
  concluida: boolean;
  favorita: boolean;
  bloqueada: boolean;
  mensagem_bloqueio?: string | null;
}

export interface AnotacaoAcademia {
  conteudo: string;
  atualizado_em?: string | null;
}

export interface ModuloAcademia {
  id: number;
  titulo: string;
  descricao?: string | null;
  ordem: number;
  aulas: AulaAcademia[];
}

export interface CursoDetalhe
  extends Omit<CursoResumo, "total_modulos"> {
  modulos: ModuloAcademia[];
  aulas_concluidas: number;
  certificado?: CertificadoAcademia | null;
}

export interface CatalogoAcademia {
  usuario: {
    nome: string;
    centro_custo: string;
  };
  cursos: CursoResumo[];
}

export interface MaterialSalvo {
  id: number;
  titulo: string;
  descricao?: string | null;
  tipo: AulaTipo;
  conteudo_url?: string | null;
  duracao_min: number;
  curso_id: number;
  curso_titulo: string;
  modulo_titulo: string;
}

export interface CursoAdminResumo {
  id: number;
  titulo: string;
  descricao?: string | null;
  capa_url?: string | null;
  nivel: CursoResumo["nivel"];
  carga_horaria_min: number;
  status: "RASCUNHO" | "EM_REVISAO" | "PUBLICADO";
  todos_centros_custo: boolean;
  ordem: number;
  atualizado_em?: string | null;
  total_modulos: number;
  total_aulas: number;
  centros_custo: string[];
}

/**
 * A visão da Qualidade recebe o `conteudo_texto` bruto (com o gabarito),
 * e não a versão sanitizada que vai para o aluno.
 */
export type AulaAdmin = Omit<
  AulaAcademia,
  | "percentual"
  | "concluida"
  | "favorita"
  | "bloqueada"
  | "mensagem_bloqueio"
  | "quiz"
  | "quiz_resultado"
>;

export type TipoPublicoAtribuicao =
  | "TODOS"
  | "CENTRO_CUSTO"
  | "COLABORADOR";

export interface AtribuicaoAcademia {
  id: number;
  curso_id: number;
  tipo_publico: TipoPublicoAtribuicao;
  alvo: string;
  obrigatoria: boolean;
  prazo_dias?: number | null;
  data_limite?: string | null;
  sincronizado_em?: string | null;
  matriculas: number;
}

export interface AtribuicaoPayload {
  tipo_publico: TipoPublicoAtribuicao;
  alvo: string;
  obrigatoria: boolean;
  prazo_dias?: number | null;
  data_limite?: string | null;
}

export interface AtribuicaoResultado {
  atribuicoes: AtribuicaoAcademia[];
  novas_matriculas: number;
}

export interface ModuloAdmin
  extends Omit<ModuloAcademia, "aulas"> {
  aulas: AulaAdmin[];
}

export interface CursoAdmin
  extends Omit<CursoAdminResumo, "total_modulos" | "total_aulas"> {
  modulos: ModuloAdmin[];
}

export interface CursoAdminPayload {
  titulo: string;
  descricao: string;
  capa_url: string;
  nivel: CursoResumo["nivel"];
  carga_horaria_min: number;
  todos_centros_custo: boolean;
  centros_custo: string[];
  ordem: number;
}

export interface ModuloAdminPayload {
  titulo: string;
  descricao: string;
  ordem: number;
}

export interface AulaAdminPayload {
  titulo: string;
  descricao: string;
  tipo: AulaTipo;
  conteudo_url: string;
  conteudo_texto: string;
  quiz: AcademiaQuizConfig;
  duracao_min: number;
  ordem: number;
  obrigatoria: boolean;
}

export interface AcademiaAdminDashboard {
  prazos: Array<{
    curso_id: number;
    curso_titulo: string;
    atribuidas: number;
    concluidas: number;
    vencidas: number;
    vencendo: number;
    aderencia: number;
  }>;
  resumo: {
    cursos_publicados: number;
    rascunhos: number;
    em_revisao: number;
    alunos_ativos: number;
    total_matriculas: number;
    total_iniciaram: number;
    total_concluidos: number;
    total_metade: number;
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
    aula_id: number;
    aula_titulo: string;
    curso_id: number;
    curso_titulo: string;
    abandonos: number;
    taxa_abandono: number;
  }>;
  alunos: Array<{
    matricula_id: number;
    cpf: string;
    nome: string;
    centro_custo: string;
    curso_id: number;
    curso_titulo: string;
    status_matricula: "EM_ANDAMENTO" | "CONCLUIDO";
    aulas_iniciadas: number;
    aulas_concluidas: number;
    total_aulas: number;
    progresso: number;
    ultima_atividade?: string | null;
    situacao:
      | "ATIVO"
      | "EM_RISCO"
      | "INTERROMPIDO"
      | "CONCLUIDO"
      | "NAO_INICIADO";
  }>;
}

export const academiaApi = {
  async catalogo() {
    const response =
      await axiosInstance.get<CatalogoAcademia>("/api/academia/catalogo");
    return response.data;
  },

  async meusCursos() {
    const response =
      await axiosInstance.get<CatalogoAcademia>("/api/academia/meus-cursos");
    return response.data;
  },

  async curso(idCurso: number) {
    const response = await axiosInstance.get<CursoDetalhe>(
      `/api/academia/cursos/${idCurso}`,
    );
    return response.data;
  },

  async matricular(idCurso: number) {
    const response = await axiosInstance.post<CursoDetalhe>(
      `/api/academia/cursos/${idCurso}/matricula`,
    );
    return response.data;
  },

  async salvarProgresso(
    idAula: number,
    percentual: number,
    concluida = false,
  ) {
    const response = await axiosInstance.put<CursoDetalhe>(
      `/api/academia/aulas/${idAula}/progresso`,
      { percentual, concluida },
    );
    return response.data;
  },

  async responderQuiz(
    idAula: number,
    respostas: Record<string, string>,
  ) {
    const response = await axiosInstance.post<AcademiaQuizEnvioResposta>(
      `/api/academia/aulas/${idAula}/quiz`,
      { respostas },
    );
    return response.data;
  },

  async certificados() {
    const response = await axiosInstance.get<CertificadoAcademia[]>(
      "/api/academia/certificados",
    );
    return response.data;
  },

  async emitirCertificado(idCurso: number) {
    const response = await axiosInstance.post<CertificadoAcademia>(
      `/api/academia/cursos/${idCurso}/certificado`,
    );
    return response.data;
  },

  async favoritar(idAula: number, favorita: boolean) {
    const response = await axiosInstance.patch<{ favorita: boolean }>(
      `/api/academia/aulas/${idAula}/favorito`,
      { favorita },
    );
    return response.data;
  },

  async obterAnotacao(idAula: number) {
    const response = await axiosInstance.get<AnotacaoAcademia>(
      `/api/academia/aulas/${idAula}/anotacao`,
    );
    return response.data;
  },

  async salvarAnotacao(idAula: number, conteudo: string) {
    const response = await axiosInstance.put<AnotacaoAcademia>(
      `/api/academia/aulas/${idAula}/anotacao`,
      { conteudo },
    );
    return response.data;
  },

  async materiaisSalvos() {
    const response = await axiosInstance.get<MaterialSalvo[]>(
      "/api/academia/materiais-salvos",
    );
    return response.data;
  },

  admin: {
    async dashboard() {
      const response = await axiosInstance.get<AcademiaAdminDashboard>(
        "/api/academia/admin/dashboard",
      );
      return response.data;
    },

    async centrosCusto() {
      const response = await axiosInstance.get<string[]>(
        "/api/academia/admin/centros-custo",
      );
      return response.data;
    },

    async listarCursos() {
      const response = await axiosInstance.get<CursoAdminResumo[]>(
        "/api/academia/admin/cursos",
      );
      return response.data;
    },

    async curso(idCurso: number) {
      const response = await axiosInstance.get<CursoAdmin>(
        `/api/academia/admin/cursos/${idCurso}`,
      );
      return response.data;
    },

    async criarCurso(payload: CursoAdminPayload) {
      const response = await axiosInstance.post<CursoAdmin>(
        "/api/academia/admin/cursos",
        payload,
      );
      return response.data;
    },

    async atualizarCurso(
      idCurso: number,
      payload: CursoAdminPayload,
    ) {
      const response = await axiosInstance.put<CursoAdmin>(
        `/api/academia/admin/cursos/${idCurso}`,
        payload,
      );
      return response.data;
    },

    async arquivarCurso(idCurso: number) {
      const response = await axiosInstance.delete<{ mensagem: string }>(
        `/api/academia/admin/cursos/${idCurso}`,
      );
      return response.data;
    },

    async publicarCurso(idCurso: number) {
      const response = await axiosInstance.post<CursoAdmin>(
        `/api/academia/admin/cursos/${idCurso}/publicar`,
      );
      return response.data;
    },

    async enviarParaRevisao(idCurso: number) {
      const response = await axiosInstance.post<CursoAdmin>(
        `/api/academia/admin/cursos/${idCurso}/enviar-revisao`,
      );
      return response.data;
    },

    async voltarParaRascunho(idCurso: number) {
      const response = await axiosInstance.post<CursoAdmin>(
        `/api/academia/admin/cursos/${idCurso}/voltar-rascunho`,
      );
      return response.data;
    },

    async listarAtribuicoes(idCurso: number) {
      const response = await axiosInstance.get<AtribuicaoAcademia[]>(
        `/api/academia/admin/cursos/${idCurso}/atribuicoes`,
      );
      return response.data;
    },

    async salvarAtribuicao(
      idCurso: number,
      payload: AtribuicaoPayload,
    ) {
      const response = await axiosInstance.post<AtribuicaoResultado>(
        `/api/academia/admin/cursos/${idCurso}/atribuicoes`,
        payload,
      );
      return response.data;
    },

    async removerAtribuicao(idCurso: number, idAtribuicao: number) {
      const response = await axiosInstance.delete<AtribuicaoResultado>(
        `/api/academia/admin/cursos/${idCurso}/atribuicoes/${idAtribuicao}`,
      );
      return response.data;
    },

    async sincronizarAtribuicoes(idCurso: number) {
      const response = await axiosInstance.post<AtribuicaoResultado>(
        `/api/academia/admin/cursos/${idCurso}/atribuicoes/sincronizar`,
      );
      return response.data;
    },

    async validarCertificado(codigo: string) {
      const response = await axiosInstance.get<CertificadoAcademia>(
        `/api/academia/admin/certificados/${encodeURIComponent(codigo)}`,
      );
      return response.data;
    },

    async criarModulo(
      idCurso: number,
      payload: ModuloAdminPayload,
    ) {
      const response = await axiosInstance.post<CursoAdmin>(
        `/api/academia/admin/cursos/${idCurso}/modulos`,
        payload,
      );
      return response.data;
    },

    async atualizarModulo(
      idCurso: number,
      idModulo: number,
      payload: ModuloAdminPayload,
    ) {
      const response = await axiosInstance.put<CursoAdmin>(
        `/api/academia/admin/cursos/${idCurso}/modulos/${idModulo}`,
        payload,
      );
      return response.data;
    },

    async desativarModulo(idCurso: number, idModulo: number) {
      const response = await axiosInstance.delete<CursoAdmin>(
        `/api/academia/admin/cursos/${idCurso}/modulos/${idModulo}`,
      );
      return response.data;
    },

    async criarAula(
      idCurso: number,
      idModulo: number,
      payload: AulaAdminPayload,
    ) {
      const response = await axiosInstance.post<CursoAdmin>(
        `/api/academia/admin/cursos/${idCurso}/modulos/${idModulo}/aulas`,
        payload,
      );
      return response.data;
    },

    async atualizarAula(
      idCurso: number,
      idModulo: number,
      idAula: number,
      payload: AulaAdminPayload,
    ) {
      const response = await axiosInstance.put<CursoAdmin>(
        `/api/academia/admin/cursos/${idCurso}/modulos/${idModulo}/aulas/${idAula}`,
        payload,
      );
      return response.data;
    },

    async desativarAula(
      idCurso: number,
      idModulo: number,
      idAula: number,
    ) {
      const response = await axiosInstance.delete<CursoAdmin>(
        `/api/academia/admin/cursos/${idCurso}/modulos/${idModulo}/aulas/${idAula}`,
      );
      return response.data;
    },
  },
};
