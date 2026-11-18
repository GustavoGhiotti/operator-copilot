import React, { useCallback, useEffect, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import {
  AlertCircle,
  Activity,
  Archive,
  BarChart3,
  BookOpen,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  CirclePlus,
  Clock3,
  Download,
  FileText,
  Filter,
  Gamepad2,
  GraduationCap,
  GripVertical,
  Eye,
  LayoutDashboard,
  Layers3,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Rocket,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Type,
  Trash2,
  TrendingUp,
  Users,
  Video,
  Zap,
  X,
} from "lucide-react";
import {
  academiaApi,
  AcademiaAdminDashboard,
  AcademiaQuizConfig,
  AcademiaQuizQuestion,
  AtribuicaoAcademia,
  AulaAdmin,
  AulaAdminPayload,
  AulaTipo,
  CursoAdmin,
  CursoAdminPayload,
  CursoAdminResumo,
  ModuloAdmin,
  ModuloAdminPayload,
  TipoPublicoAtribuicao,
} from "@/services/academiaApi";
import { normalizeCostCenter } from "@/utils/adminCommandAccess";

interface AcademiaGestaoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type EditorStep = 1 | 2 | 3 | 4;
type WorkspaceView = "hub" | "editor";
type HubSection = "overview" | "analytics";
type CourseFilter = "TODOS" | "PUBLICADO" | "EM_REVISAO" | "RASCUNHO";
type StudioPanel = "course" | "module" | "lesson" | "publico";

const emptyCourse: CursoAdminPayload = {
  titulo: "",
  descricao: "",
  capa_url: "",
  nivel: "INICIANTE",
  carga_horaria_min: 0,
  todos_centros_custo: false,
  centros_custo: [],
  ordem: 0,
};

const emptyModule: ModuloAdminPayload = {
  titulo: "",
  descricao: "",
  ordem: 0,
};

const createQuizId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const createQuizQuestion = (): AcademiaQuizQuestion => ({
  id: createQuizId(),
  enunciado: "",
  explicacao: "",
  alternativas: [
    { id: createQuizId(), texto: "", correta: true },
    { id: createQuizId(), texto: "", correta: false },
  ],
});

const createEmptyQuiz = (): AcademiaQuizConfig => ({
  nota_minima: 70,
  perguntas: [createQuizQuestion()],
});

const parseQuiz = (content?: string | null): AcademiaQuizConfig => {
  if (!content) return createEmptyQuiz();
  try {
    const parsed = JSON.parse(content) as AcademiaQuizConfig;
    if (Array.isArray(parsed.perguntas) && parsed.perguntas.length > 0) {
      return parsed;
    }
  } catch {
    // Conteúdos antigos não possuíam configuração própria de Quiz.
  }
  return createEmptyQuiz();
};

const emptyLesson: AulaAdminPayload = {
  titulo: "",
  descricao: "",
  tipo: "VIDEO",
  conteudo_url: "",
  conteudo_texto: "",
  quiz: createEmptyQuiz(),
  duracao_min: 0,
  ordem: 0,
  obrigatoria: true,
};

const lessonToDraft = (lesson: AulaAdmin): AulaAdminPayload => ({
  titulo: lesson.titulo,
  descricao: lesson.descricao || "",
  tipo: lesson.tipo,
  conteudo_url: lesson.conteudo_url || "",
  conteudo_texto: lesson.conteudo_texto || "",
  quiz: parseQuiz(lesson.conteudo_texto),
  duracao_min: lesson.duracao_min,
  ordem: lesson.ordem,
  obrigatoria: lesson.obrigatoria,
});

const lessonTypeLabels: Record<AulaTipo, string> = {
  VIDEO: "Vídeo",
  PDF: "PDF",
  TEXTO: "Texto",
  QUIZ: "Quiz da aula",
  SIMULACAO: "Simulação legada",
  TREINAMENTO: "Treinamento legado",
  LINK: "Link externo",
};

const getErrorMessage = (error: unknown) => {
  if (isAxiosError<{ erro?: string }>(error)) {
    return (
      error.response?.data?.erro ||
      "Não foi possível concluir esta operação."
    );
  }
  return "Não foi possível concluir esta operação.";
};

const AcademiaGestaoModal: React.FC<AcademiaGestaoModalProps> = ({
  isOpen,
  onClose,
}) => {
  const isQuality =
    normalizeCostCenter(localStorage.getItem("centroCusto")) ===
    "QUALIDADE";
  const [courses, setCourses] = useState<CursoAdminResumo[]>([]);
  const [dashboard, setDashboard] =
    useState<AcademiaAdminDashboard | null>(null);
  const [costCenters, setCostCenters] = useState<string[]>([]);
  const [selectedCourse, setSelectedCourse] =
    useState<CursoAdmin | null>(null);
  const [courseDraft, setCourseDraft] =
    useState<CursoAdminPayload>(emptyCourse);
  const [moduleDraft, setModuleDraft] =
    useState<ModuloAdminPayload>(emptyModule);
  const [lessonDraft, setLessonDraft] =
    useState<AulaAdminPayload>(emptyLesson);
  const [editingModuleId, setEditingModuleId] = useState<number | null>(
    null,
  );
  const [editingLessonId, setEditingLessonId] = useState<number | null>(
    null,
  );
  const [selectedModuleId, setSelectedModuleId] = useState<number | null>(
    null,
  );
  const [step, setStep] = useState<EditorStep>(1);
  const [studioPanel, setStudioPanel] =
    useState<StudioPanel>("course");
  const [view, setView] = useState<WorkspaceView>("hub");
  const [hubSection, setHubSection] =
    useState<HubSection>("overview");
  const [courseFilter, setCourseFilter] =
    useState<CourseFilter>("TODOS");
  const [searchTerm, setSearchTerm] = useState("");
  const [costCenterSearch, setCostCenterSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadInitialData = useCallback(async () => {
    if (!isQuality) return;
    setLoading(true);
    setError(null);
    try {
      const [courseList, centerList, dashboardData] = await Promise.all([
        academiaApi.admin.listarCursos(),
        academiaApi.admin.centrosCusto(),
        academiaApi.admin.dashboard(),
      ]);
      setCourses(courseList);
      setCostCenters(centerList);
      setDashboard(dashboardData);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [isQuality]);

  useEffect(() => {
    if (isOpen) void loadInitialData();
  }, [isOpen, loadInitialData]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedCourse(null);
      setCourseDraft(emptyCourse);
      setModuleDraft(emptyModule);
      setLessonDraft(emptyLesson);
      setEditingModuleId(null);
      setEditingLessonId(null);
      setSelectedModuleId(null);
      setStep(1);
      setStudioPanel("course");
      setView("hub");
      setHubSection("overview");
      setCourseFilter("TODOS");
      setError(null);
      setSuccess(null);
    }
  }, [isOpen]);

  const filteredCourses = useMemo(() => {
    const term = searchTerm.trim().toLocaleLowerCase("pt-BR");
    return courses.filter(
      (course) =>
        (courseFilter === "TODOS" || course.status === courseFilter) &&
        `${course.titulo} ${course.status}`
          .toLocaleLowerCase("pt-BR")
          .includes(term),
    );
  }, [courseFilter, courses, searchTerm]);

  const filteredCostCenters = useMemo(() => {
    const term = costCenterSearch.trim().toLocaleLowerCase("pt-BR");
    return costCenters.filter((center) =>
      center.toLocaleLowerCase("pt-BR").includes(term),
    );
  }, [costCenters, costCenterSearch]);

  const activeModule =
    selectedCourse?.modulos.find(
      (module) => module.id === selectedModuleId,
    ) ?? null;

  const resetMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const startNewCourse = () => {
    resetMessages();
    setSelectedCourse(null);
    setCourseDraft(emptyCourse);
    setModuleDraft(emptyModule);
    setLessonDraft(emptyLesson);
    setSelectedModuleId(null);
    setEditingModuleId(null);
    setEditingLessonId(null);
    setStep(1);
    setStudioPanel("course");
    setView("editor");
  };

  const openCourse = async (
    idCourse: number,
    targetStep: EditorStep = 1,
    lessonType?: AulaTipo,
  ) => {
    resetMessages();
    setLoading(true);
    try {
      const course = await academiaApi.admin.curso(idCourse);
      const firstModule = course.modulos[0];
      const firstLesson = firstModule?.aulas[0];
      setSelectedCourse(course);
      setCourseDraft({
        titulo: course.titulo,
        descricao: course.descricao || "",
        capa_url: course.capa_url || "",
        nivel: course.nivel,
        carga_horaria_min: course.carga_horaria_min,
        todos_centros_custo: course.todos_centros_custo,
        centros_custo: course.centros_custo,
        ordem: course.ordem,
      });
      setSelectedModuleId(firstModule?.id ?? null);
      setModuleDraft(emptyModule);
      setLessonDraft(
        lessonType
          ? { ...emptyLesson, tipo: lessonType }
          : firstLesson
            ? lessonToDraft(firstLesson)
            : emptyLesson,
      );
      setEditingModuleId(null);
      setEditingLessonId(
        lessonType ? null : firstLesson?.id ?? null,
      );
      setStep(targetStep);
      setStudioPanel(
        lessonType || firstLesson
          ? "lesson"
          : firstModule
            ? "module"
            : "course",
      );
      setView("editor");
      setCourseFilter("TODOS");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  const refreshCourseList = async () => {
    const [courseList, dashboardData] = await Promise.all([
      academiaApi.admin.listarCursos(),
      academiaApi.admin.dashboard(),
    ]);
    setCourses(courseList);
    setDashboard(dashboardData);
  };

  const backToHub = () => {
    resetMessages();
    setView("hub");
    setHubSection("overview");
    setSelectedCourse(null);
    setSearchTerm("");
    setCourseFilter("TODOS");
  };

  const quickLesson = (type: AulaTipo) => {
    const target =
      courses.find((course) => course.total_modulos > 0) || courses[0];
    if (!target) {
      startNewCourse();
      setError("Crie o curso antes de adicionar a primeira aula.");
      return;
    }
    if (target.total_modulos === 0) {
      void openCourse(target.id, 2);
      return;
    }
    void openCourse(target.id, 3, type);
  };

  const saveCourse = async () => {
    resetMessages();
    setSaving(true);
    try {
      const saved = selectedCourse
        ? await academiaApi.admin.atualizarCurso(
            selectedCourse.id,
            courseDraft,
          )
        : await academiaApi.admin.criarCurso(courseDraft);
      setSelectedCourse(saved);
      setSelectedModuleId(saved.modulos[0]?.id ?? null);
      await refreshCourseList();
      setSuccess("Dados do curso salvos.");
      setStep(2);
      setStudioPanel("module");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const saveModule = async () => {
    if (!selectedCourse) return;
    resetMessages();
    setSaving(true);
    try {
      const updated = editingModuleId
        ? await academiaApi.admin.atualizarModulo(
            selectedCourse.id,
            editingModuleId,
            moduleDraft,
          )
        : await academiaApi.admin.criarModulo(
            selectedCourse.id,
            moduleDraft,
          );
      const savedModule = editingModuleId
        ? updated.modulos.find(
            (module) => module.id === editingModuleId,
          )
        : updated.modulos[updated.modulos.length - 1];
      setSelectedCourse(updated);
      setSelectedModuleId(savedModule?.id ?? null);
      setModuleDraft(
        savedModule
          ? {
              titulo: savedModule.titulo,
              descricao: savedModule.descricao || "",
              ordem: savedModule.ordem,
            }
          : emptyModule,
      );
      setEditingModuleId(savedModule?.id ?? null);
      setStudioPanel("module");
      await refreshCourseList();
      setSuccess("Módulo salvo.");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const editModule = (module: ModuloAdmin) => {
    setSelectedModuleId(module.id);
    setEditingModuleId(module.id);
    setStudioPanel("module");
    setModuleDraft({
      titulo: module.titulo,
      descricao: module.descricao || "",
      ordem: module.ordem,
    });
  };

  const beginNewModule = () => {
    setEditingModuleId(null);
    setModuleDraft({
      ...emptyModule,
      ordem: selectedCourse?.modulos.length ?? 0,
    });
    setStudioPanel("module");
  };

  const beginNewLesson = (moduleId?: number, type: AulaTipo = "VIDEO") => {
    const targetModuleId =
      moduleId || selectedModuleId || selectedCourse?.modulos[0]?.id;
    if (!targetModuleId) {
      setError("Crie um módulo antes de adicionar uma aula.");
      beginNewModule();
      return;
    }
    const targetModule = selectedCourse?.modulos.find(
      (module) => module.id === targetModuleId,
    );
    setSelectedModuleId(targetModuleId);
    setEditingLessonId(null);
    setLessonDraft({
      ...emptyLesson,
      tipo: type,
      quiz: createEmptyQuiz(),
      ordem: targetModule?.aulas.length ?? 0,
    });
    setStudioPanel("lesson");
    resetMessages();
  };

  const editCourseSettings = () => {
    setStudioPanel("course");
    resetMessages();
  };

  const deactivateModule = async (module: ModuloAdmin) => {
    if (!selectedCourse) return;
    const confirmed = window.confirm(
      `Desativar o módulo "${module.titulo}" e ocultar suas aulas? O histórico dos operadores será preservado.`,
    );
    if (!confirmed) return;
    resetMessages();
    setSaving(true);
    try {
      const updated = await academiaApi.admin.desativarModulo(
        selectedCourse.id,
        module.id,
      );
      setSelectedCourse(updated);
      setSelectedModuleId(updated.modulos[0]?.id ?? null);
      setStudioPanel(
        updated.modulos.length > 0 ? "module" : "course",
      );
      await refreshCourseList();
      setSuccess("Módulo desativado.");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const saveLesson = async () => {
    if (!selectedCourse || !selectedModuleId) return;
    resetMessages();
    setSaving(true);
    try {
      const updated = editingLessonId
        ? await academiaApi.admin.atualizarAula(
            selectedCourse.id,
            selectedModuleId,
            editingLessonId,
            lessonDraft,
          )
        : await academiaApi.admin.criarAula(
            selectedCourse.id,
            selectedModuleId,
            lessonDraft,
          );
      const updatedModule = updated.modulos.find(
        (module) => module.id === selectedModuleId,
      );
      const savedLesson = editingLessonId
        ? updatedModule?.aulas.find(
            (lesson) => lesson.id === editingLessonId,
          )
        : updatedModule?.aulas[updatedModule.aulas.length - 1];
      setSelectedCourse(updated);
      setLessonDraft(
        savedLesson ? lessonToDraft(savedLesson) : emptyLesson,
      );
      setEditingLessonId(savedLesson?.id ?? null);
      setStudioPanel("lesson");
      await refreshCourseList();
      setSuccess("Aula salva.");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const editLesson = (lesson: AulaAdmin) => {
    setEditingLessonId(lesson.id);
    setLessonDraft(lessonToDraft(lesson));
    setStudioPanel("lesson");
  };

  const deactivateLesson = async (lesson: AulaAdmin) => {
    if (!selectedCourse || !selectedModuleId) return;
    const confirmed = window.confirm(
      `Desativar a aula "${lesson.titulo}"? O progresso já registrado será preservado.`,
    );
    if (!confirmed) return;
    resetMessages();
    setSaving(true);
    try {
      const updated = await academiaApi.admin.desativarAula(
        selectedCourse.id,
        selectedModuleId,
        lesson.id,
      );
      setSelectedCourse(updated);
      setEditingLessonId(null);
      setLessonDraft(emptyLesson);
      setStudioPanel("module");
      await refreshCourseList();
      setSuccess("Aula desativada.");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const changePublication = async () => {
    if (!selectedCourse) return;
    resetMessages();
    setSaving(true);
    try {
      const updated =
        selectedCourse.status === "PUBLICADO"
          ? await academiaApi.admin.voltarParaRascunho(selectedCourse.id)
          : selectedCourse.status === "EM_REVISAO"
            ? await academiaApi.admin.publicarCurso(selectedCourse.id)
            : await academiaApi.admin.enviarParaRevisao(
                selectedCourse.id,
              );
      setSelectedCourse(updated);
      await refreshCourseList();
      setSuccess(
        updated.status === "PUBLICADO"
          ? "Curso publicado para o público selecionado."
          : updated.status === "EM_REVISAO"
            ? "Curso enviado para revisão."
            : "Curso retirado do catálogo e devolvido para rascunho.",
      );
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const archiveCourse = async () => {
    if (!selectedCourse) return;
    const confirmed = window.confirm(
      `Arquivar o curso "${selectedCourse.titulo}"? Ele sairá do catálogo, mas matrículas e progresso serão preservados.`,
    );
    if (!confirmed) return;
    resetMessages();
    setSaving(true);
    try {
      await academiaApi.admin.arquivarCurso(selectedCourse.id);
      await refreshCourseList();
      startNewCourse();
      setSuccess("Curso arquivado.");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  if (!isQuality) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-[#020711]/95 p-4 text-white backdrop-blur-md">
        <div className="w-full max-w-md rounded-2xl border border-red-400/20 bg-[#071421] p-7 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-red-300" />
          <h2 className="mt-4 text-xl font-semibold">Acesso restrito</h2>
          <p className="mt-2 text-sm text-slate-400">
            A criação de conteúdos da Academia é exclusiva da Qualidade.
          </p>
          <button
            onClick={onClose}
            className="mt-6 rounded-xl bg-orange-500 px-5 py-3 text-xs font-semibold"
          >
            FECHAR
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      data-tour="academia-gestao"
      className="fixed inset-0 z-50 bg-[#020711]/95 p-2 text-slate-100 backdrop-blur-md md:p-4"
    >
      <div className="mx-auto flex h-full max-w-[1580px] flex-col overflow-hidden rounded-2xl border border-[#29445f] bg-[#030b16]">
        <header className="flex min-h-[72px] items-center gap-4 border-b border-[#20374e] px-4 md:px-6">
          {view === "editor" && (
            <button
              onClick={backToHub}
              className="flex items-center gap-2 rounded-xl px-2 py-2 text-xs text-slate-400 hover:bg-white/5 hover:text-white"
            >
              <ChevronRight className="h-4 w-4 rotate-180" />
              <span className="hidden lg:inline">Creator Hub</span>
            </button>
          )}
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-orange-500/10 text-orange-400">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-semibold md:text-lg">
              {view === "hub"
                ? hubSection === "analytics"
                  ? "ACADEMIA AURORA · ANALYTICS"
                  : "AURORA CREATOR HUB"
                : selectedCourse?.titulo || "Novo curso"}
            </h1>
            <p className="text-[10px] tracking-[0.12em] text-slate-400">
              {view === "hub"
                ? hubSection === "analytics"
                  ? "GESTÃO DE APRENDIZAGEM · QUALIDADE"
                  : "ACESSO EXCLUSIVO DA QUALIDADE"
                : selectedCourse
                  ? `${statusLabel[selectedCourse.status]} · Salvo agora`
                  : "EDITOR DE CURSO · NOVO RASCUNHO"}
            </p>
          </div>
          {view === "hub" && hubSection === "overview" && (
            <button
              data-tour="academia-gestao-criar"
              onClick={startNewCourse}
              className="hidden items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-xs font-semibold hover:bg-orange-600 sm:flex"
            >
              <Plus className="h-4 w-4" />
              CRIAR CONTEÚDO
            </button>
          )}
          {view === "editor" && selectedCourse && (
            <>
              <button
                onClick={() =>
                  document
                    .getElementById("studio-operator-preview")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
                className="hidden items-center gap-2 rounded-xl border border-[#29445f] px-4 py-3 text-xs font-semibold text-slate-300 hover:border-cyan-400/35 lg:flex"
              >
                <Eye className="h-4 w-4" />
                PRÉ-VISUALIZAR
              </button>
              <button
                onClick={() => void changePublication()}
                disabled={saving}
                className="hidden items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-xs font-semibold hover:bg-orange-600 disabled:opacity-50 sm:flex"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Rocket className="h-4 w-4" />
                )}
                {selectedCourse.status === "PUBLICADO"
                  ? "VOLTAR A RASCUNHO"
                  : selectedCourse.status === "EM_REVISAO"
                    ? "PUBLICAR"
                    : "ENVIAR PARA REVISÃO"}
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="rounded-xl p-2.5 text-slate-400 hover:bg-white/5 hover:text-white"
            aria-label="Fechar gestão da Academia"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1">
          {view === "hub" && (
            <HubSidebar
              published={dashboard?.resumo.cursos_publicados ?? 0}
              drafts={dashboard?.resumo.rascunhos ?? 0}
              review={dashboard?.resumo.em_revisao ?? 0}
              onCreate={startNewCourse}
              activeSection={hubSection}
              onSectionChange={setHubSection}
            />
          )}

          <main className="min-w-0 flex-1 overflow-y-auto">
            <div
              className={`mx-auto ${
                view === "hub"
                  ? hubSection === "analytics"
                    ? "max-w-[1480px] p-4 md:p-5"
                    : "max-w-[1320px] p-4 md:p-6"
                  : "max-w-[1580px] p-3 md:p-4"
              }`}
            >
              {(error || success) && (
                <div
                  className={`mb-5 flex items-start gap-3 rounded-xl border p-4 text-sm ${
                    error
                      ? "border-red-400/20 bg-red-400/[0.06] text-red-100"
                      : "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-100"
                  }`}
                >
                  {error ? (
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <Check className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  <span className="flex-1">{error || success}</span>
                  <button onClick={resetMessages}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {view === "hub" && hubSection === "overview" && (
                <CreatorHub
                  courses={filteredCourses}
                  allCourses={courses}
                  dashboard={dashboard}
                  loading={loading}
                  searchTerm={searchTerm}
                  filter={courseFilter}
                  onSearch={setSearchTerm}
                  onFilter={setCourseFilter}
                  onCreate={startNewCourse}
                  onOpen={openCourse}
                  onQuickLesson={quickLesson}
                />
              )}

              {view === "hub" && hubSection === "analytics" && (
                <LearningAnalyticsDashboard
                  dashboard={dashboard}
                  courses={courses}
                  costCenters={costCenters}
                  loading={loading}
                  onOpenCourse={openCourse}
                />
              )}

              {view === "editor" && (
                <CourseStudio
                  course={selectedCourse}
                  courseDraft={courseDraft}
                  setCourseDraft={setCourseDraft}
                  moduleDraft={moduleDraft}
                  setModuleDraft={setModuleDraft}
                  lessonDraft={lessonDraft}
                  setLessonDraft={setLessonDraft}
                  studioPanel={studioPanel}
                  selectedModuleId={selectedModuleId}
                  editingModuleId={editingModuleId}
                  editingLessonId={editingLessonId}
                  costCenters={filteredCostCenters}
                  costCenterSearch={costCenterSearch}
                  saving={saving}
                  onCostCenterSearch={setCostCenterSearch}
                  onEditCourse={editCourseSettings}
                  onEditAudience={() => setStudioPanel("publico")}
                  onNewModule={beginNewModule}
                  onEditModule={editModule}
                  onNewLesson={beginNewLesson}
                  onEditLesson={(moduleId, lesson) => {
                    setSelectedModuleId(moduleId);
                    editLesson(lesson);
                  }}
                  onSaveCourse={saveCourse}
                  onSaveModule={saveModule}
                  onSaveLesson={saveLesson}
                  onDeactivateModule={deactivateModule}
                  onDeactivateLesson={deactivateLesson}
                  onArchive={archiveCourse}
                />
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

const studioTypeIcons: Record<
  AulaTipo,
  React.ComponentType<{ className?: string }>
> = {
  VIDEO: Video,
  PDF: FileText,
  TEXTO: Type,
  QUIZ: CirclePlus,
  SIMULACAO: Gamepad2,
  TREINAMENTO: Bot,
  LINK: Link2,
};

const CourseStudio: React.FC<{
  course: CursoAdmin | null;
  courseDraft: CursoAdminPayload;
  setCourseDraft: React.Dispatch<
    React.SetStateAction<CursoAdminPayload>
  >;
  moduleDraft: ModuloAdminPayload;
  setModuleDraft: React.Dispatch<
    React.SetStateAction<ModuloAdminPayload>
  >;
  lessonDraft: AulaAdminPayload;
  setLessonDraft: React.Dispatch<
    React.SetStateAction<AulaAdminPayload>
  >;
  studioPanel: StudioPanel;
  selectedModuleId: number | null;
  editingModuleId: number | null;
  editingLessonId: number | null;
  costCenters: string[];
  costCenterSearch: string;
  saving: boolean;
  onCostCenterSearch: (value: string) => void;
  onEditCourse: () => void;
  onEditAudience: () => void;
  onNewModule: () => void;
  onEditModule: (module: ModuloAdmin) => void;
  onNewLesson: (moduleId?: number, type?: AulaTipo) => void;
  onEditLesson: (moduleId: number, lesson: AulaAdmin) => void;
  onSaveCourse: () => void;
  onSaveModule: () => void;
  onSaveLesson: () => void;
  onDeactivateModule: (module: ModuloAdmin) => void;
  onDeactivateLesson: (lesson: AulaAdmin) => void;
  onArchive: () => void;
}> = ({
  course,
  courseDraft,
  setCourseDraft,
  moduleDraft,
  setModuleDraft,
  lessonDraft,
  setLessonDraft,
  studioPanel,
  selectedModuleId,
  editingModuleId,
  editingLessonId,
  costCenters,
  costCenterSearch,
  saving,
  onCostCenterSearch,
  onEditCourse,
  onEditAudience,
  onNewModule,
  onEditModule,
  onNewLesson,
  onEditLesson,
  onSaveCourse,
  onSaveModule,
  onSaveLesson,
  onDeactivateModule,
  onDeactivateLesson,
  onArchive,
}) => {
  const totalLessons =
    course?.modulos.reduce(
      (total, module) => total + module.aulas.length,
      0,
    ) ?? 0;
  const configuration = Math.min(
    100,
    (courseDraft.titulo ? 15 : 0) +
      (courseDraft.descricao ? 10 : 0) +
      (courseDraft.todos_centros_custo ||
      courseDraft.centros_custo.length > 0
        ? 15
        : 0) +
      ((course?.modulos.length ?? 0) > 0 ? 25 : 0) +
      (totalLessons > 0 ? 35 : 0),
  );
  const selectedModule =
    course?.modulos.find((module) => module.id === selectedModuleId) ??
    null;
  const selectedLesson =
    selectedModule?.aulas.find(
      (lesson) => lesson.id === editingLessonId,
    ) ?? null;

  return (
    <div className="grid min-h-[calc(100vh-120px)] gap-3 xl:grid-cols-[310px_minmax(460px,1fr)_320px]">
      <CurriculumPanel
        course={course}
        configuration={configuration}
        selectedModuleId={selectedModuleId}
        editingLessonId={editingLessonId}
        studioPanel={studioPanel}
        onEditCourse={onEditCourse}
        onEditAudience={onEditAudience}
        onNewModule={onNewModule}
        onEditModule={onEditModule}
        onNewLesson={onNewLesson}
        onEditLesson={onEditLesson}
      />

      <section className="min-w-0 rounded-2xl border border-[#29445f] bg-[#071421]">
        {studioPanel === "course" && (
          <StudioCourseForm
            draft={courseDraft}
            setDraft={setCourseDraft}
            courseExists={Boolean(course)}
            costCenters={costCenters}
            costCenterSearch={costCenterSearch}
            onCostCenterSearch={onCostCenterSearch}
            saving={saving}
            onSave={onSaveCourse}
            onArchive={course ? onArchive : undefined}
          />
        )}
        {studioPanel === "module" && course && (
          <StudioModuleForm
            draft={moduleDraft}
            setDraft={setModuleDraft}
            editing={Boolean(editingModuleId)}
            saving={saving}
            onSave={onSaveModule}
            onDeactivate={
              editingModuleId && selectedModule
                ? () => void onDeactivateModule(selectedModule)
                : undefined
            }
          />
        )}
        {studioPanel === "lesson" && course && (
          <StudioLessonForm
            draft={lessonDraft}
            setDraft={setLessonDraft}
            editing={Boolean(editingLessonId)}
            saving={saving}
            onSave={onSaveLesson}
            onDeactivate={
              editingLessonId && selectedLesson
                ? () => void onDeactivateLesson(selectedLesson)
                : undefined
            }
          />
        )}
        {studioPanel === "publico" && course && (
          <AudiencePanel
            courseId={course.id}
            courseStatus={course.status}
            costCenters={costCenters}
          />
        )}
      </section>

      <OperatorPreviewPanel
        course={course}
        courseDraft={courseDraft}
        lessonDraft={lessonDraft}
        studioPanel={studioPanel}
        configuration={configuration}
      />
    </div>
  );
};

const publicoLabels: Record<TipoPublicoAtribuicao, string> = {
  TODOS: "Todos os colaboradores",
  CENTRO_CUSTO: "Centro de custo",
  COLABORADOR: "Colaborador (CPF)",
};

/**
 * Define quem é obrigado a fazer o curso e até quando. A sincronização
 * matricula automaticamente quem ainda não está no curso — só funciona com
 * o curso publicado, então avisamos quando ele ainda é rascunho.
 */
const AudiencePanel: React.FC<{
  courseId: number;
  courseStatus: CursoAdminResumo["status"];
  costCenters: string[];
}> = ({ courseId, courseStatus, costCenters }) => {
  const [assignments, setAssignments] = useState<AtribuicaoAcademia[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [tipo, setTipo] = useState<TipoPublicoAtribuicao>("CENTRO_CUSTO");
  const [alvo, setAlvo] = useState("");
  const [obrigatoria, setObrigatoria] = useState(true);
  const [modoPrazo, setModoPrazo] = useState<"dias" | "data" | "sem">("dias");
  const [prazoDias, setPrazoDias] = useState(15);
  const [dataLimite, setDataLimite] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAssignments(await academiaApi.admin.listarAtribuicoes(courseId));
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const resultado = await academiaApi.admin.salvarAtribuicao(courseId, {
        tipo_publico: tipo,
        alvo: tipo === "TODOS" ? "" : alvo,
        obrigatoria,
        prazo_dias: modoPrazo === "dias" ? prazoDias : null,
        data_limite: modoPrazo === "data" ? dataLimite || null : null,
      });
      setAssignments(resultado.atribuicoes);
      setFeedback(
        resultado.novas_matriculas > 0
          ? `${resultado.novas_matriculas} colaborador(es) matriculado(s).`
          : "Público atualizado. Nenhuma matrícula nova.",
      );
      setAlvo("");
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const resultado = await academiaApi.admin.removerAtribuicao(
        courseId,
        id,
      );
      setAssignments(resultado.atribuicoes);
      setFeedback(
        "Público removido. As matrículas já criadas foram mantidas.",
      );
    } catch (removeError) {
      setError(getErrorMessage(removeError));
    } finally {
      setSaving(false);
    }
  };

  const sync = async () => {
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const resultado =
        await academiaApi.admin.sincronizarAtribuicoes(courseId);
      setAssignments(resultado.atribuicoes);
      setFeedback(
        resultado.novas_matriculas > 0
          ? `${resultado.novas_matriculas} colaborador(es) matriculado(s).`
          : "Todos os colaboradores do público já estão matriculados.",
      );
    } catch (syncError) {
      setError(getErrorMessage(syncError));
    } finally {
      setSaving(false);
    }
  };

  const describePrazo = (assignment: AtribuicaoAcademia) => {
    if (assignment.data_limite) {
      return `até ${new Date(
        `${assignment.data_limite}T00:00:00`,
      ).toLocaleDateString("pt-BR")}`;
    }
    if (assignment.prazo_dias) return `${assignment.prazo_dias} dias`;
    return "sem prazo";
  };

  return (
    <div>
      <StudioHeading
        eyebrow="ATRIBUIÇÃO"
        title="Público e prazos"
        description="Defina quem precisa fazer o curso e o prazo de conclusão."
        icon={<Users className="h-5 w-5" />}
      />

      <div className="p-5 md:p-6">
      {courseStatus !== "PUBLICADO" && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-[11px] text-amber-200">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          As matrículas automáticas só acontecem quando o curso é publicado.
          O público definido aqui será aplicado na publicação.
        </div>
      )}

      <div className="mt-5 rounded-2xl border border-[#263f58] bg-[#040e1a] p-4">
        <p className="text-[10px] font-semibold tracking-[0.14em] text-violet-300">
          NOVO PÚBLICO
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[10px] text-slate-400">Tipo</span>
            <select
              value={tipo}
              onChange={(event) => {
                setTipo(event.target.value as TipoPublicoAtribuicao);
                setAlvo("");
              }}
              className="mt-1 w-full rounded-xl border border-[#2b435d] bg-[#071421] px-3 py-2.5 text-xs text-white outline-none focus:border-violet-400/50"
            >
              {(
                Object.keys(publicoLabels) as TipoPublicoAtribuicao[]
              ).map((key) => (
                <option key={key} value={key}>
                  {publicoLabels[key]}
                </option>
              ))}
            </select>
          </label>

          {tipo === "CENTRO_CUSTO" && (
            <label className="block">
              <span className="text-[10px] text-slate-400">
                Centro de custo
              </span>
              <select
                value={alvo}
                onChange={(event) => setAlvo(event.target.value)}
                className="mt-1 w-full rounded-xl border border-[#2b435d] bg-[#071421] px-3 py-2.5 text-xs text-white outline-none focus:border-violet-400/50"
              >
                <option value="">Selecione…</option>
                {costCenters.map((center) => (
                  <option key={center} value={center}>
                    {center}
                  </option>
                ))}
              </select>
            </label>
          )}

          {tipo === "COLABORADOR" && (
            <label className="block">
              <span className="text-[10px] text-slate-400">CPF</span>
              <input
                value={alvo}
                onChange={(event) => setAlvo(event.target.value)}
                placeholder="Somente números"
                className="mt-1 w-full rounded-xl border border-[#2b435d] bg-[#071421] px-3 py-2.5 text-xs text-white outline-none focus:border-violet-400/50"
              />
            </label>
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[10px] text-slate-400">Prazo</span>
            <select
              value={modoPrazo}
              onChange={(event) =>
                setModoPrazo(event.target.value as "dias" | "data" | "sem")
              }
              className="mt-1 w-full rounded-xl border border-[#2b435d] bg-[#071421] px-3 py-2.5 text-xs text-white outline-none focus:border-violet-400/50"
            >
              <option value="dias">Dias após a matrícula</option>
              <option value="data">Data fixa</option>
              <option value="sem">Sem prazo</option>
            </select>
          </label>

          {modoPrazo === "dias" && (
            <label className="block">
              <span className="text-[10px] text-slate-400">Dias</span>
              <input
                type="number"
                min={1}
                value={prazoDias}
                onChange={(event) =>
                  setPrazoDias(Number(event.target.value) || 1)
                }
                className="mt-1 w-full rounded-xl border border-[#2b435d] bg-[#071421] px-3 py-2.5 text-xs text-white outline-none focus:border-violet-400/50"
              />
            </label>
          )}

          {modoPrazo === "data" && (
            <label className="block">
              <span className="text-[10px] text-slate-400">Data limite</span>
              <input
                type="date"
                value={dataLimite}
                onChange={(event) => setDataLimite(event.target.value)}
                className="mt-1 w-full rounded-xl border border-[#2b435d] bg-[#071421] px-3 py-2.5 text-xs text-white outline-none focus:border-violet-400/50"
              />
            </label>
          )}
        </div>

        <label className="mt-4 flex cursor-pointer items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={obrigatoria}
            onChange={(event) => setObrigatoria(event.target.checked)}
            className="h-3.5 w-3.5 accent-violet-500"
          />
          Curso obrigatório para este público
        </label>

        <button
          type="button"
          onClick={() => void submit()}
          disabled={
            saving || (tipo !== "TODOS" && !alvo.trim()) ||
            (modoPrazo === "data" && !dataLimite)
          }
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-3 text-xs font-semibold text-white hover:bg-violet-600 disabled:opacity-40"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          ATRIBUIR CURSO
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-rose-400/25 bg-rose-400/5 p-3 text-[11px] text-rose-200">
          {error}
        </p>
      )}
      {feedback && (
        <p className="mt-4 rounded-xl border border-emerald-400/25 bg-emerald-400/5 p-3 text-[11px] text-emerald-200">
          {feedback}
        </p>
      )}

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-400">
          PÚBLICOS ATIVOS
        </p>
        {assignments.length > 0 && (
          <button
            type="button"
            onClick={() => void sync()}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg border border-[#2b435d] px-3 py-1.5 text-[10px] font-semibold text-slate-300 hover:border-violet-400/40 hover:text-violet-200 disabled:opacity-40"
          >
            <Zap className="h-3 w-3" />
            SINCRONIZAR
          </button>
        )}
      </div>

      <div className="mt-3 space-y-2">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
          </div>
        ) : assignments.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#29445f] p-5 text-center text-[11px] text-slate-400">
            Nenhum público atribuído. O curso aparece apenas para quem
            escolher fazê-lo.
          </p>
        ) : (
          assignments.map((assignment) => (
            <div
              key={assignment.id}
              className="flex items-center gap-3 rounded-xl border border-[#263f58] bg-[#040e1a] p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-white">
                  {assignment.tipo_publico === "TODOS"
                    ? publicoLabels.TODOS
                    : assignment.alvo}
                </p>
                <p className="mt-1 text-[10px] text-slate-400">
                  {assignment.obrigatoria ? "Obrigatório" : "Sugerido"} ·{" "}
                  {describePrazo(assignment)} · {assignment.matriculas}{" "}
                  matrícula(s)
                </p>
              </div>
              <button
                type="button"
                onClick={() => void remove(assignment.id)}
                disabled={saving}
                className="rounded-lg border border-[#2b435d] p-2 text-slate-400 hover:border-rose-400/40 hover:text-rose-300 disabled:opacity-40"
                title="Remover público"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
      </div>
    </div>
  );
};

const CurriculumPanel: React.FC<{
  course: CursoAdmin | null;
  configuration: number;
  selectedModuleId: number | null;
  editingLessonId: number | null;
  studioPanel: StudioPanel;
  onEditCourse: () => void;
  onEditAudience: () => void;
  onNewModule: () => void;
  onEditModule: (module: ModuloAdmin) => void;
  onNewLesson: (moduleId?: number, type?: AulaTipo) => void;
  onEditLesson: (moduleId: number, lesson: AulaAdmin) => void;
}> = ({
  course,
  configuration,
  selectedModuleId,
  editingLessonId,
  studioPanel,
  onEditCourse,
  onEditAudience,
  onNewModule,
  onEditModule,
  onNewLesson,
  onEditLesson,
}) => (
  <aside className="self-start rounded-2xl border border-[#29445f] bg-[#071421] p-3 xl:sticky xl:top-3">
    <button
      onClick={onEditCourse}
      className={`w-full rounded-xl border p-3 text-left transition ${
        studioPanel === "course"
          ? "border-orange-500/35 bg-orange-500/[0.07]"
          : "border-[#263f58] bg-[#040e1a] hover:border-[#365571]"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-orange-500/10 text-orange-300">
          <Layers3 className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Estrutura do curso</p>
          <p className="mt-1 text-[9px] text-slate-400">
            Clique para editar informações
          </p>
        </div>
        <Pencil className="h-3.5 w-3.5 text-slate-400" />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <span className="text-[10px] text-slate-400">
          {configuration}% configurado
        </span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#14283c]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-orange-500 to-cyan-400"
            style={{ width: `${configuration}%` }}
          />
        </div>
      </div>
    </button>

    {course && (
      <button
        onClick={onEditAudience}
        className={`mt-2 w-full rounded-xl border p-3 text-left transition ${
          studioPanel === "publico"
            ? "border-violet-400/35 bg-violet-400/[0.07]"
            : "border-[#263f58] bg-[#040e1a] hover:border-[#365571]"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-violet-400/10 text-violet-300">
            <Users className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Público e prazos</p>
            <p className="mt-1 text-[9px] text-slate-400">
              Quem é obrigado e até quando
            </p>
          </div>
          <Pencil className="h-3.5 w-3.5 text-slate-400" />
        </div>
      </button>
    )}

    <div className="mt-3 max-h-[62vh] space-y-2 overflow-y-auto pr-1">
      {!course ? (
        <div className="rounded-xl border border-dashed border-[#29445f] p-5 text-center">
          <BookOpen className="mx-auto h-7 w-7 text-slate-400" />
          <p className="mt-3 text-xs text-slate-400">
            Salve as informações básicas para começar a montar o curso.
          </p>
        </div>
      ) : course.modulos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#29445f] p-5 text-center">
          <Layers3 className="mx-auto h-7 w-7 text-slate-400" />
          <p className="mt-3 text-xs text-slate-400">
            Adicione o primeiro módulo da jornada.
          </p>
        </div>
      ) : (
        course.modulos.map((module, moduleIndex) => (
          <details
            key={module.id}
            open
            className={`group rounded-xl border ${
              selectedModuleId === module.id
                ? "border-cyan-400/25 bg-cyan-400/[0.025]"
                : "border-[#263f58] bg-[#040e1a]"
            }`}
          >
            <summary className="flex cursor-pointer list-none items-center gap-2 p-3">
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 transition group-open:rotate-180" />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-xs font-medium">
                  Módulo {moduleIndex + 1} · {module.titulo}
                </p>
                <p className="mt-1 text-[9px] text-slate-400">
                  {module.aulas.length} aulas
                </p>
              </div>
              <button
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onEditModule(module);
                }}
                className="rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
                aria-label="Editar módulo"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </summary>
            <div className="space-y-1 border-t border-[#20374e] p-2">
              {module.aulas.map((lesson) => {
                const Icon = studioTypeIcons[lesson.tipo];
                const active = editingLessonId === lesson.id;
                return (
                  <button
                    key={lesson.id}
                    onClick={() => onEditLesson(module.id, lesson)}
                    className={`flex w-full items-center gap-2 rounded-lg border p-2.5 text-left ${
                      active
                        ? "border-cyan-400/35 bg-cyan-400/[0.07]"
                        : "border-transparent hover:bg-white/[0.03]"
                    }`}
                  >
                    <GripVertical className="h-3.5 w-3.5 text-slate-400" />
                    <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#102237] text-cyan-300">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-[11px] font-medium">
                        {lesson.titulo}
                      </p>
                      <p className="mt-0.5 text-[8px] text-slate-400">
                        {lessonTypeLabels[lesson.tipo]} ·{" "}
                        {lesson.duracao_min || 0} min
                      </p>
                    </div>
                  </button>
                );
              })}
              <button
                onClick={() => onNewLesson(module.id)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[#29445f] px-3 py-2 text-[9px] text-cyan-300 hover:bg-cyan-400/[0.04]"
              >
                <Plus className="h-3 w-3" />
                NOVA AULA
              </button>
            </div>
          </details>
        ))
      )}
    </div>

    {course && (
      <div className="mt-3 grid gap-2">
        <button
          onClick={() => onNewLesson()}
          disabled={course.modulos.length === 0}
          className="flex items-center justify-center gap-2 rounded-xl border border-cyan-400/30 px-3 py-2.5 text-[10px] font-semibold text-cyan-300 hover:bg-cyan-400/[0.04] disabled:opacity-35"
        >
          <Plus className="h-3.5 w-3.5" />
          NOVA AULA
        </button>
        <button
          onClick={onNewModule}
          className="flex items-center justify-center gap-2 rounded-xl border border-orange-500/30 px-3 py-2.5 text-[10px] font-semibold text-orange-300 hover:bg-orange-500/[0.04]"
        >
          <Plus className="h-3.5 w-3.5" />
          NOVO MÓDULO
        </button>
      </div>
    )}
  </aside>
);

const StudioCourseForm: React.FC<{
  draft: CursoAdminPayload;
  setDraft: React.Dispatch<React.SetStateAction<CursoAdminPayload>>;
  courseExists: boolean;
  costCenters: string[];
  costCenterSearch: string;
  onCostCenterSearch: (value: string) => void;
  saving: boolean;
  onSave: () => void;
  onArchive?: () => void;
}> = ({
  draft,
  setDraft,
  courseExists,
  costCenters,
  costCenterSearch,
  onCostCenterSearch,
  saving,
  onSave,
  onArchive,
}) => {
  const toggleCenter = (center: string) => {
    setDraft((current) => ({
      ...current,
      centros_custo: current.centros_custo.includes(center)
        ? current.centros_custo.filter((item) => item !== center)
        : [...current.centros_custo, center],
    }));
  };
  return (
    <div className="flex min-h-[720px] flex-col">
      <StudioHeading
        eyebrow="CONFIGURAÇÕES DO CURSO"
        title={courseExists ? "Informações gerais" : "Vamos criar seu curso"}
        description="Defina a identidade e o público. Depois você poderá montar módulos e aulas visualmente."
        icon={<BookOpen className="h-5 w-5" />}
      />
      <div className="flex-1 space-y-5 p-5 md:p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Título do curso" required>
            <input
              value={draft.titulo}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  titulo: event.target.value,
                }))
              }
              className="academy-admin-input"
              placeholder="Ex.: Fundamentos da cobrança"
            />
          </Field>
          <Field label="URL da capa">
            <input
              value={draft.capa_url}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  capa_url: event.target.value,
                }))
              }
              className="academy-admin-input"
              placeholder="https://..."
            />
          </Field>
        </div>
        <Field label="Descrição">
          <textarea
            value={draft.descricao}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                descricao: event.target.value,
              }))
            }
            className="academy-admin-input min-h-28 resize-y"
            placeholder="Explique em poucas palavras o que o operador aprenderá."
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Nível">
            <select
              value={draft.nivel}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  nivel: event.target.value as CursoAdminPayload["nivel"],
                }))
              }
              className="academy-admin-input"
            >
              <option value="INICIANTE">Iniciante</option>
              <option value="INTERMEDIARIO">Intermediário</option>
              <option value="AVANCADO">Avançado</option>
            </select>
          </Field>
          <Field label="Carga horária (min)">
            <input
              type="number"
              min={0}
              value={draft.carga_horaria_min}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  carga_horaria_min: Number(event.target.value),
                }))
              }
              className="academy-admin-input"
            />
          </Field>
          <Field label="Ordem no catálogo">
            <input
              type="number"
              min={0}
              value={draft.ordem}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  ordem: Number(event.target.value),
                }))
              }
              className="academy-admin-input"
            />
          </Field>
        </div>
        <div className="rounded-2xl border border-[#29445f] bg-[#040e1a] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Público do curso</p>
              <p className="mt-1 text-[10px] text-slate-400">
                Somente os centros selecionados encontrarão este conteúdo.
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={draft.todos_centros_custo}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    todos_centros_custo: event.target.checked,
                    centros_custo: event.target.checked
                      ? []
                      : current.centros_custo,
                  }))
                }
                className="accent-orange-500"
              />
              Todos os Centros de Custo
            </label>
          </div>
          {!draft.todos_centros_custo && (
            <>
              <label className="mt-4 flex items-center gap-2 rounded-xl border border-[#29445f] px-3 py-2.5">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={costCenterSearch}
                  onChange={(event) =>
                    onCostCenterSearch(event.target.value)
                  }
                  placeholder="Buscar Centro de Custo..."
                  className="min-w-0 flex-1 bg-transparent text-xs outline-none"
                />
              </label>
              <div className="mt-3 grid max-h-44 gap-2 overflow-y-auto sm:grid-cols-2">
                {costCenters.map((center) => (
                  <label
                    key={center}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-[10px] ${
                      draft.centros_custo.includes(center)
                        ? "border-orange-500/35 bg-orange-500/[0.08] text-orange-200"
                        : "border-[#233b53] text-slate-400"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={draft.centros_custo.includes(center)}
                      onChange={() => toggleCenter(center)}
                      className="accent-orange-500"
                    />
                    <span className="line-clamp-1">{center}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      <StudioActions
        primaryLabel={courseExists ? "SALVAR ALTERAÇÕES" : "CRIAR CURSO"}
        saving={saving}
        onSave={onSave}
        onDanger={onArchive}
        dangerLabel="ARQUIVAR CURSO"
      />
    </div>
  );
};

const StudioModuleForm: React.FC<{
  draft: ModuloAdminPayload;
  setDraft: React.Dispatch<React.SetStateAction<ModuloAdminPayload>>;
  editing: boolean;
  saving: boolean;
  onSave: () => void;
  onDeactivate?: () => void;
}> = ({
  draft,
  setDraft,
  editing,
  saving,
  onSave,
  onDeactivate,
}) => (
  <div className="flex min-h-[720px] flex-col">
    <StudioHeading
      eyebrow="ESTRUTURA DA JORNADA"
      title={editing ? "Editar módulo" : "Novo módulo"}
      description="Agrupe aulas relacionadas para tornar a sequência de aprendizagem mais clara."
      icon={<Layers3 className="h-5 w-5" />}
    />
    <div className="flex-1 p-5 md:p-6">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.035] p-5">
          <Layers3 className="h-8 w-8 text-cyan-300" />
          <p className="mt-3 text-sm font-medium">
            Um módulo representa uma etapa do curso
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Use nomes curtos e objetivos, como “Introdução”, “Negociação” ou
            “Encerramento”.
          </p>
        </div>
        <Field label="Título do módulo" required>
          <input
            value={draft.titulo}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                titulo: event.target.value,
              }))
            }
            className="academy-admin-input"
            placeholder="Ex.: Técnicas de negociação"
          />
        </Field>
        <Field label="Descrição">
          <textarea
            value={draft.descricao}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                descricao: event.target.value,
              }))
            }
            className="academy-admin-input min-h-28 resize-y"
            placeholder="Qual é o objetivo deste módulo?"
          />
        </Field>
        <Field label="Ordem na jornada">
          <input
            type="number"
            min={0}
            value={draft.ordem}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                ordem: Number(event.target.value),
              }))
            }
            className="academy-admin-input max-w-48"
          />
        </Field>
      </div>
    </div>
    <StudioActions
      primaryLabel={editing ? "SALVAR MÓDULO" : "CRIAR MÓDULO"}
      saving={saving}
      onSave={onSave}
      onDanger={onDeactivate}
      dangerLabel="DESATIVAR MÓDULO"
    />
  </div>
);

const StudioLessonForm: React.FC<{
  draft: AulaAdminPayload;
  setDraft: React.Dispatch<React.SetStateAction<AulaAdminPayload>>;
  editing: boolean;
  saving: boolean;
  onSave: () => void;
  onDeactivate?: () => void;
}> = ({
  draft,
  setDraft,
  editing,
  saving,
  onSave,
  onDeactivate,
}) => {
  const types: AulaTipo[] = [
    "VIDEO",
    "PDF",
    "TEXTO",
    "QUIZ",
    "LINK",
  ];
  return (
    <div className="flex min-h-[720px] flex-col">
      <StudioHeading
        eyebrow={editing ? "EDITANDO AULA" : "NOVA AULA"}
        title={draft.titulo || "Conteúdo da aula"}
        description={`${lessonTypeLabels[draft.tipo]} · configure o material e como ele aparecerá ao operador.`}
        icon={React.createElement(studioTypeIcons[draft.tipo], {
          className: "h-5 w-5",
        })}
      />
      <div className="flex-1 space-y-5 p-5 md:p-6">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {types.map((type) => {
            const Icon = studioTypeIcons[type];
            return (
              <button
                key={type}
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    tipo: type,
                    conteudo_url: "",
                    conteudo_texto: "",
                    quiz: createEmptyQuiz(),
                  }))
                }
                className={`rounded-xl border p-3 text-center transition ${
                  draft.tipo === type
                    ? "border-cyan-400/50 bg-cyan-400/[0.08] text-cyan-200"
                    : "border-[#29445f] bg-[#040e1a] text-slate-400 hover:text-slate-300"
                }`}
              >
                <Icon className="mx-auto h-5 w-5" />
                <span className="mt-2 block text-[9px]">
                  {lessonTypeLabels[type].replace(" do Copilot", "")}
                </span>
              </button>
            );
          })}
        </div>

        {["VIDEO", "PDF", "LINK"].includes(draft.tipo) && (
          <div className="rounded-2xl border border-dashed border-cyan-400/25 bg-[#040e1a] p-6 text-center md:p-9">
            {draft.tipo === "VIDEO" ? (
              <Video className="mx-auto h-10 w-10 text-cyan-300" />
            ) : draft.tipo === "PDF" ? (
              <FileText className="mx-auto h-10 w-10 text-red-300" />
            ) : (
              <Link2 className="mx-auto h-10 w-10 text-violet-300" />
            )}
            <h3 className="mt-4 font-semibold">
              {draft.tipo === "VIDEO"
                ? "Adicione o vídeo da aula"
                : draft.tipo === "PDF"
                  ? "Adicione o material em PDF"
                  : "Adicione o conteúdo externo"}
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Cole abaixo o endereço seguro do conteúdo.
            </p>
            <input
              value={draft.conteudo_url}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  conteudo_url: event.target.value,
                }))
              }
              className="academy-admin-input mx-auto mt-5 max-w-xl text-left"
              placeholder="https://..."
            />
          </div>
        )}

        {draft.tipo === "TEXTO" && (
          <div className="rounded-2xl border border-[#29445f] bg-[#040e1a] p-4">
            <Field label="Conteúdo da aula" required>
              <textarea
                value={draft.conteudo_texto}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    conteudo_texto: event.target.value,
                  }))
                }
                className="academy-admin-input min-h-52 resize-y"
                placeholder="Escreva o conteúdo que será apresentado ao operador..."
              />
            </Field>
          </div>
        )}

        {draft.tipo === "QUIZ" && (
          <QuizLessonBuilder draft={draft} setDraft={setDraft} />
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Título da aula" required>
            <input
              value={draft.titulo}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  titulo: event.target.value,
                }))
              }
              className="academy-admin-input"
              placeholder="Ex.: Técnicas de abordagem"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Duração (min)">
              <input
                type="number"
                min={0}
                value={draft.duracao_min}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    duracao_min: Number(event.target.value),
                  }))
                }
                className="academy-admin-input"
              />
            </Field>
            <Field label="Ordem">
              <input
                type="number"
                min={0}
                value={draft.ordem}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    ordem: Number(event.target.value),
                  }))
                }
                className="academy-admin-input"
              />
            </Field>
          </div>
        </div>
        <Field label="Descrição da aula">
          <textarea
            value={draft.descricao}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                descricao: event.target.value,
              }))
            }
            className="academy-admin-input min-h-24 resize-y"
            placeholder="Explique o objetivo desta aula e o que o operador aprenderá."
          />
        </Field>
        <label className="flex items-center justify-between gap-4 rounded-xl border border-[#29445f] bg-[#040e1a] p-4">
          <div>
            <p className="text-xs font-medium">
              Obrigatória para conclusão
            </p>
            <p className="mt-1 text-[9px] text-slate-400">
              O operador precisa concluir esta aula para finalizar o curso.
            </p>
          </div>
          <input
            type="checkbox"
            checked={draft.obrigatoria}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                obrigatoria: event.target.checked,
              }))
            }
            className="h-5 w-5 accent-cyan-400"
          />
        </label>
      </div>
      <StudioActions
        primaryLabel={editing ? "SALVAR ALTERAÇÕES" : "ADICIONAR AULA"}
        saving={saving}
        onSave={onSave}
        onDanger={onDeactivate}
        dangerLabel="DESATIVAR AULA"
      />
    </div>
  );
};

const QuizLessonBuilder: React.FC<{
  draft: AulaAdminPayload;
  setDraft: React.Dispatch<React.SetStateAction<AulaAdminPayload>>;
}> = ({ draft, setDraft }) => {
  const updateQuiz = (updater: (quiz: AcademiaQuizConfig) => AcademiaQuizConfig) =>
    setDraft((current) => ({ ...current, quiz: updater(current.quiz) }));

  return (
    <section className="rounded-2xl border border-violet-400/25 bg-violet-400/[0.035] p-4 md:p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-400/10 text-violet-300"><CirclePlus className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1"><h3 className="text-sm font-semibold text-white">Quiz deste módulo</h3><p className="mt-1 text-xs leading-relaxed text-slate-400">Crie perguntas que validam o conteúdo estudado. O operador responderá dentro da própria Academia.</p></div>
        <label className="w-32 text-[9px] tracking-[.1em] text-slate-400">NOTA MÍNIMA<div className="mt-2 flex items-center rounded-xl border border-[#334d68] bg-[#040e1a] px-3"><input type="number" min={0} max={100} value={draft.quiz.nota_minima} onChange={(event) => updateQuiz((quiz) => ({ ...quiz, nota_minima: Math.min(100, Math.max(0, Number(event.target.value))) }))} className="h-10 min-w-0 flex-1 bg-transparent text-sm text-white outline-none" /><span className="text-xs text-slate-400">%</span></div></label>
      </div>

      <div className="mt-5 space-y-4">
        {draft.quiz.perguntas.map((question, questionIndex) => (
          <article key={question.id} className="rounded-2xl border border-[#304a65] bg-[#040e1a] p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-cyan-400/10 text-xs font-black text-cyan-300">{questionIndex + 1}</span>
              <strong className="flex-1 text-xs text-white">Pergunta {questionIndex + 1}</strong>
              {draft.quiz.perguntas.length > 1 && <button type="button" onClick={() => updateQuiz((quiz) => ({ ...quiz, perguntas: quiz.perguntas.filter((item) => item.id !== question.id) }))} className="rounded-lg p-2 text-red-300 hover:bg-red-400/10" aria-label={`Remover pergunta ${questionIndex + 1}`}><Trash2 className="h-4 w-4" /></button>}
            </div>
            <textarea value={question.enunciado} onChange={(event) => updateQuiz((quiz) => ({ ...quiz, perguntas: quiz.perguntas.map((item) => item.id === question.id ? { ...item, enunciado: event.target.value } : item) }))} className="academy-admin-input mt-3 min-h-20 resize-y" placeholder="Digite a pergunta sobre o conteúdo do módulo..." />

            <div className="mt-4 space-y-2">
              <p className="text-[9px] tracking-[.12em] text-slate-400">ALTERNATIVAS · MARQUE A CORRETA</p>
              {question.alternativas.map((alternative, alternativeIndex) => (
                <div key={alternative.id} className={`flex items-center gap-2 rounded-xl border px-3 ${alternative.correta ? "border-emerald-400/35 bg-emerald-400/[0.05]" : "border-[#2b435d] bg-[#071421]"}`}>
                  <input type="radio" name={`correct-${question.id}`} checked={alternative.correta} onChange={() => updateQuiz((quiz) => ({ ...quiz, perguntas: quiz.perguntas.map((item) => item.id === question.id ? { ...item, alternativas: item.alternativas.map((option) => ({ ...option, correta: option.id === alternative.id })) } : item) }))} className="h-4 w-4 accent-emerald-400" aria-label={`Marcar alternativa ${alternativeIndex + 1} como correta`} />
                  <input value={alternative.texto} onChange={(event) => updateQuiz((quiz) => ({ ...quiz, perguntas: quiz.perguntas.map((item) => item.id === question.id ? { ...item, alternativas: item.alternativas.map((option) => option.id === alternative.id ? { ...option, texto: event.target.value } : option) } : item) }))} className="h-11 min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-slate-600" placeholder={`Alternativa ${alternativeIndex + 1}`} />
                  {question.alternativas.length > 2 && <button type="button" onClick={() => updateQuiz((quiz) => ({ ...quiz, perguntas: quiz.perguntas.map((item) => item.id === question.id ? { ...item, alternativas: item.alternativas.filter((option) => option.id !== alternative.id).map((option, index) => ({ ...option, correta: alternative.correta ? index === 0 : option.correta })) } : item) }))} className="text-slate-500 hover:text-red-300" aria-label={`Remover alternativa ${alternativeIndex + 1}`}><X className="h-3.5 w-3.5" /></button>}
                </div>
              ))}
              {question.alternativas.length < 6 && <button type="button" onClick={() => updateQuiz((quiz) => ({ ...quiz, perguntas: quiz.perguntas.map((item) => item.id === question.id ? { ...item, alternativas: [...item.alternativas, { id: createQuizId(), texto: "", correta: false }] } : item) }))} className="flex items-center gap-2 px-2 py-2 text-[9px] font-semibold text-cyan-300 hover:text-cyan-200"><Plus className="h-3 w-3" /> ADICIONAR ALTERNATIVA</button>}
            </div>
            <input value={question.explicacao} onChange={(event) => updateQuiz((quiz) => ({ ...quiz, perguntas: quiz.perguntas.map((item) => item.id === question.id ? { ...item, explicacao: event.target.value } : item) }))} className="academy-admin-input mt-3" placeholder="Explicação exibida depois da resposta (opcional)" />
          </article>
        ))}
      </div>
      {draft.quiz.perguntas.length < 50 && <button type="button" onClick={() => updateQuiz((quiz) => ({ ...quiz, perguntas: [...quiz.perguntas, createQuizQuestion()] }))} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-violet-400/35 py-3 text-[10px] font-semibold text-violet-200 hover:bg-violet-400/[0.05]"><Plus className="h-4 w-4" /> ADICIONAR PERGUNTA</button>}
    </section>
  );
};

const StudioHeading: React.FC<{
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}> = ({ eyebrow, title, description, icon }) => (
  <div className="flex items-start gap-4 border-b border-[#20374e] p-5 md:p-6">
    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300">
      {icon}
    </div>
    <div className="min-w-0">
      <p className="text-[9px] tracking-[0.14em] text-cyan-300">{eyebrow}</p>
      <h2 className="mt-1 line-clamp-1 text-xl font-semibold">{title}</h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">
        {description}
      </p>
    </div>
  </div>
);

const StudioActions: React.FC<{
  primaryLabel: string;
  saving: boolean;
  onSave: () => void;
  onDanger?: () => void;
  dangerLabel?: string;
}> = ({
  primaryLabel,
  saving,
  onSave,
  onDanger,
  dangerLabel,
}) => (
  <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-[#20374e] bg-[#071421]/95 p-4 backdrop-blur">
    <div>
      {onDanger && (
        <button
          onClick={onDanger}
          disabled={saving}
          className="flex items-center gap-2 px-3 py-2 text-[9px] text-red-300 hover:text-red-200 disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {dangerLabel}
        </button>
      )}
    </div>
    <button
      onClick={onSave}
      disabled={saving}
      className="flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-xs font-semibold hover:bg-orange-600 disabled:opacity-50"
    >
      {saving ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Save className="h-4 w-4" />
      )}
      {primaryLabel}
    </button>
  </div>
);

const OperatorPreviewPanel: React.FC<{
  course: CursoAdmin | null;
  courseDraft: CursoAdminPayload;
  lessonDraft: AulaAdminPayload;
  studioPanel: StudioPanel;
  configuration: number;
}> = ({
  course,
  courseDraft,
  lessonDraft,
  studioPanel,
  configuration,
}) => {
  const checklist =
    studioPanel === "lesson"
      ? [
          { label: "Título definido", ready: Boolean(lessonDraft.titulo) },
          {
            label: "Conteúdo adicionado",
            ready:
              (lessonDraft.tipo === "QUIZ" &&
                lessonDraft.quiz.perguntas.some(
                  (question) => question.enunciado.trim(),
                )) ||
              Boolean(
                lessonDraft.conteudo_url ||
                  lessonDraft.conteudo_texto,
              ),
          },
          {
            label: "Descrição da aula",
            ready: Boolean(lessonDraft.descricao),
          },
        ]
      : [
          { label: "Título definido", ready: Boolean(courseDraft.titulo) },
          {
            label: "Público selecionado",
            ready:
              courseDraft.todos_centros_custo ||
              courseDraft.centros_custo.length > 0,
          },
          {
            label: "Estrutura iniciada",
            ready: (course?.modulos.length ?? 0) > 0,
          },
        ];
  return (
    <aside
      id="studio-operator-preview"
      className="space-y-3 self-start xl:sticky xl:top-3"
    >
      <div className="rounded-2xl border border-[#29445f] bg-[#071421] p-4">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-cyan-300" />
          <h3 className="text-sm font-semibold">Visão do operador</h3>
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-[#29445f] bg-[#040e1a]">
          <div
            className="relative h-28 bg-gradient-to-br from-[#12385e] via-[#0a2038] to-[#07111f] bg-cover bg-center p-4"
            style={
              courseDraft.capa_url
                ? {
                    backgroundImage: `linear-gradient(to top, rgba(4,14,26,.92), rgba(4,14,26,.15)), url("${courseDraft.capa_url}")`,
                  }
                : undefined
            }
          >
            <div className="absolute inset-x-4 bottom-4">
              <h4 className="line-clamp-2 font-semibold">
                {courseDraft.titulo || "Título do curso"}
              </h4>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-cyan-400"
                  style={{ width: `${configuration}%` }}
                />
              </div>
            </div>
          </div>
          <div className="p-4">
            <p className="text-[9px] text-slate-400">
              {studioPanel === "lesson"
                ? lessonTypeLabels[lessonDraft.tipo]
                : courseDraft.nivel}
            </p>
            <h5 className="mt-2 line-clamp-2 text-lg font-semibold">
              {studioPanel === "lesson"
                ? lessonDraft.titulo || "Título da aula"
                : "Sua jornada de aprendizagem"}
            </h5>
            <p className="mt-2 line-clamp-3 text-[10px] leading-relaxed text-slate-400">
              {studioPanel === "lesson"
                ? lessonDraft.descricao ||
                  "A descrição da aula aparecerá aqui."
                : courseDraft.descricao ||
                  "A descrição do curso aparecerá aqui."}
            </p>
            <button className="mt-4 w-full rounded-xl bg-orange-500 px-4 py-3 text-[10px] font-semibold">
              {studioPanel === "lesson" ? "INICIAR AULA" : "CONHECER CURSO"}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[#29445f] bg-[#071421] p-4">
        <h3 className="text-sm font-semibold">
          Checklist {studioPanel === "lesson" ? "da aula" : "do curso"}
        </h3>
        <div className="mt-4 space-y-3">
          {checklist.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-3 border-b border-[#20374e] pb-3 last:border-0 last:pb-0"
            >
              <div
                className={`grid h-6 w-6 place-items-center rounded-full ${
                  item.ready
                    ? "bg-emerald-400/10 text-emerald-300"
                    : "bg-amber-400/10 text-amber-300"
                }`}
              >
                {item.ready ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Clock3 className="h-3.5 w-3.5" />
                )}
              </div>
              <span className="text-[10px] text-slate-400">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.035] p-4">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs font-medium text-cyan-200">
            Dica da Aurora
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
            {studioPanel === "lesson"
              ? "Uma descrição curta ajuda o operador a entender o objetivo desta aula."
              : "Defina primeiro o público e a proposta; depois divida o conteúdo em módulos curtos."}
          </p>
        </div>
      </div>
    </aside>
  );
};

const statusLabel: Record<CursoAdminResumo["status"], string> = {
  RASCUNHO: "Rascunho",
  EM_REVISAO: "Em revisão",
  PUBLICADO: "Publicado",
};

const statusClass: Record<CursoAdminResumo["status"], string> = {
  RASCUNHO: "border-slate-400/20 bg-slate-400/10 text-slate-300",
  EM_REVISAO: "border-amber-400/20 bg-amber-400/10 text-amber-300",
  PUBLICADO: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
};

const HubSidebar: React.FC<{
  published: number;
  drafts: number;
  review: number;
  onCreate: () => void;
  activeSection: HubSection;
  onSectionChange: (section: HubSection) => void;
}> = ({
  published,
  drafts,
  review,
  onCreate,
  activeSection,
  onSectionChange,
}) => {
  const navigate = (id: string) => {
    onSectionChange("overview");
    window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  };
  const items = [
    {
      id: "creator-overview",
      label: "Visão geral",
      icon: LayoutDashboard,
      section: "overview" as const,
    },
    {
      id: "creator-content",
      label: "Conteúdos",
      icon: BookOpen,
      count: published + drafts + review,
      section: "overview" as const,
    },
    {
      id: "creator-analytics",
      label: "Analytics",
      icon: BarChart3,
      section: "analytics" as const,
    },
  ];
  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-[#20374e] bg-[#050f1c] p-3 md:flex">
      <nav className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            item.section === "analytics"
              ? activeSection === "analytics"
              : activeSection === "overview" &&
                item.id === "creator-overview";
          return (
            <button
              key={item.id}
              onClick={() =>
                item.section === "analytics"
                  ? onSectionChange("analytics")
                  : navigate(item.id)
              }
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm transition ${
                active
                  ? "border-orange-500/20 bg-orange-500/10 text-orange-300"
                  : "border-transparent text-slate-400 hover:bg-white/[0.035] hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {item.count !== undefined && (
                <span className="rounded-md bg-white/5 px-2 py-0.5 text-[9px]">
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
      <div className="mt-4 border-t border-[#20374e] pt-4">
        <p className="px-3 text-[9px] tracking-[0.12em] text-slate-400">
          FLUXO DE PRODUÇÃO
        </p>
        <div className="mt-3 space-y-2 px-3 text-[10px]">
          <StatusCount
            color="bg-emerald-400"
            label="Publicados"
            value={published}
          />
          <StatusCount
            color="bg-amber-400"
            label="Em revisão"
            value={review}
          />
          <StatusCount
            color="bg-slate-400"
            label="Rascunhos"
            value={drafts}
          />
        </div>
      </div>
      <button
        onClick={onCreate}
        className="mt-auto flex items-center justify-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/[0.07] px-4 py-3 text-xs font-semibold text-orange-300 hover:bg-orange-500/10"
      >
        <Plus className="h-4 w-4" />
        NOVO CURSO
      </button>
    </aside>
  );
};

const StatusCount: React.FC<{
  color: string;
  label: string;
  value: number;
}> = ({ color, label, value }) => (
  <div className="flex items-center gap-2 text-slate-400">
    <span className={`h-2 w-2 rounded-full ${color}`} />
    <span className="flex-1">{label}</span>
    <strong className="text-slate-300">{value}</strong>
  </div>
);

const EditorSidebar: React.FC<{
  courses: CursoAdminResumo[];
  selectedCourseId?: number;
  searchTerm: string;
  loading: boolean;
  onSearch: (value: string) => void;
  onBack: () => void;
  onCreate: () => void;
  onOpen: (id: number) => void | Promise<void>;
}> = ({
  courses,
  selectedCourseId,
  searchTerm,
  loading,
  onSearch,
  onBack,
  onCreate,
  onOpen,
}) => (
  <aside className="hidden w-72 shrink-0 flex-col border-r border-[#20374e] bg-[#050f1c] p-4 md:flex">
    <button
      onClick={onBack}
      className="mb-3 flex items-center gap-2 text-xs text-slate-400 hover:text-white"
    >
      <ChevronRight className="h-4 w-4 rotate-180" />
      Voltar ao Creator Hub
    </button>
    <button
      onClick={onCreate}
      className="flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-xs font-semibold hover:bg-orange-600"
    >
      <Plus className="h-4 w-4" />
      NOVO CURSO
    </button>
    <label className="mt-4 flex items-center gap-2 rounded-xl border border-[#29445f] bg-[#071421] px-3 py-2.5">
      <Search className="h-4 w-4 text-slate-400" />
      <input
        value={searchTerm}
        onChange={(event) => onSearch(event.target.value)}
        placeholder="Buscar curso..."
        className="min-w-0 flex-1 bg-transparent text-xs outline-none"
      />
    </label>
    <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto">
      {loading && courses.length === 0 ? (
        <Loader2 className="mx-auto mt-8 h-6 w-6 animate-spin text-orange-400" />
      ) : courses.length === 0 ? (
        <p className="p-4 text-center text-xs text-slate-400">
          Nenhum curso encontrado.
        </p>
      ) : (
        courses.map((course) => (
          <button
            key={course.id}
            onClick={() => void onOpen(course.id)}
            className={`w-full rounded-xl border p-3 text-left ${
              selectedCourseId === course.id
                ? "border-orange-500/35 bg-orange-500/[0.08]"
                : "border-[#243b53] bg-[#071421] hover:border-[#365571]"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="line-clamp-2 text-sm font-medium">
                {course.titulo}
              </h3>
              <span
                className={`rounded-md border px-2 py-1 text-[8px] ${statusClass[course.status]}`}
              >
                {statusLabel[course.status]}
              </span>
            </div>
            <p className="mt-2 text-[10px] text-slate-400">
              {course.total_modulos} módulos · {course.total_aulas} aulas
            </p>
          </button>
        ))
      )}
    </div>
  </aside>
);

const CreatorHub: React.FC<{
  courses: CursoAdminResumo[];
  allCourses: CursoAdminResumo[];
  dashboard: AcademiaAdminDashboard | null;
  loading: boolean;
  searchTerm: string;
  filter: CourseFilter;
  onSearch: (value: string) => void;
  onFilter: (filter: CourseFilter) => void;
  onCreate: () => void;
  onOpen: (id: number) => void | Promise<void>;
  onQuickLesson: (type: AulaTipo) => void;
}> = ({
  courses,
  allCourses,
  dashboard,
  loading,
  searchTerm,
  filter,
  onSearch,
  onFilter,
  onCreate,
  onOpen,
  onQuickLesson,
}) => {
  const metrics = [
    {
      label: "Cursos publicados",
      value: dashboard?.resumo.cursos_publicados ?? 0,
      icon: BookOpen,
      color: "text-cyan-300",
      background: "bg-cyan-400/10",
    },
    {
      label: "Rascunhos",
      value: dashboard?.resumo.rascunhos ?? 0,
      icon: FileText,
      color: "text-slate-300",
      background: "bg-slate-400/10",
    },
    {
      label: "Em revisão",
      value: dashboard?.resumo.em_revisao ?? 0,
      icon: Clock3,
      color: "text-amber-300",
      background: "bg-amber-400/10",
    },
    {
      label: "Alunos ativos",
      value: dashboard?.resumo.alunos_ativos ?? 0,
      icon: Users,
      color: "text-violet-300",
      background: "bg-violet-400/10",
    },
    {
      label: "Conclusão média",
      value: `${Math.round(
        dashboard?.resumo.conclusao_media ?? 0,
      )}%`,
      icon: TrendingUp,
      color: "text-emerald-300",
      background: "bg-emerald-400/10",
    },
  ];

  const recentCourses = allCourses.slice(0, 3);
  const bestPerformance = dashboard?.desempenho.slice(0, 5) ?? [];
  const abandonment = dashboard?.abandonos.slice(0, 5) ?? [];

  return (
    <div id="creator-overview">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="text-[10px] tracking-[0.16em] text-orange-400">
            CREATOR HUB
          </span>
          <h2 className="mt-2 text-2xl font-semibold md:text-3xl">
            Olá, Qualidade.
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Gerencie experiências de aprendizagem em um só lugar.
          </p>
        </div>
        <button
          onClick={onCreate}
          className="flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-xs font-semibold hover:bg-orange-600 sm:hidden"
        >
          <Plus className="h-4 w-4" />
          CRIAR CONTEÚDO
        </button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article
              key={metric.label}
              className="rounded-2xl border border-[#29445f] bg-[#071421] p-4"
            >
              <div className="flex items-center justify-between">
                <div
                  className={`grid h-10 w-10 place-items-center rounded-xl ${metric.background} ${metric.color}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <Sparkles className="h-3.5 w-3.5 text-slate-400" />
              </div>
              <strong className="mt-4 block text-2xl">{metric.value}</strong>
              <span className="text-[10px] text-slate-400">
                {metric.label}
              </span>
            </article>
          );
        })}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,.75fr)]">
        <section className="rounded-2xl border border-[#29445f] bg-[#071421] p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Continuar trabalhando</h3>
              <p className="mt-1 text-[10px] text-slate-400">
                Conteúdos atualizados recentemente.
              </p>
            </div>
            <span className="text-[10px] text-slate-400">
              {allCourses.length} conteúdos
            </span>
          </div>
          <div className="mt-4 space-y-2">
            {loading && allCourses.length === 0 ? (
              <HubLoading />
            ) : recentCourses.length === 0 ? (
              <HubEmpty
                text="Crie o primeiro curso da Academia."
                action="CRIAR CURSO"
                onAction={onCreate}
              />
            ) : (
              recentCourses.map((course) => (
                <RecentCourse
                  key={course.id}
                  course={course}
                  onOpen={onOpen}
                />
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-[#29445f] bg-[#071421] p-4">
          <h3 className="font-semibold">Ações rápidas</h3>
          <p className="mt-1 text-[10px] text-slate-400">
            Comece pelo tipo de conteúdo.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <QuickAction
              icon={<CirclePlus className="h-5 w-5" />}
              title="Novo curso"
              description="Crie uma jornada completa"
              onClick={onCreate}
            />
            <QuickAction
              icon={<Zap className="h-5 w-5" />}
              title="Aula rápida"
              description="Adicione um texto objetivo"
              onClick={() => onQuickLesson("TEXTO")}
            />
            <QuickAction
              icon={<FileText className="h-5 w-5" />}
              title="Enviar PDF"
              description="Vincule um material"
              onClick={() => onQuickLesson("PDF")}
            />
            <QuickAction
              icon={<Video className="h-5 w-5" />}
              title="Adicionar vídeo"
              description="YouTube ou biblioteca"
              onClick={() => onQuickLesson("VIDEO")}
            />
          </div>
        </section>
      </div>

      <div
        id="creator-content"
        className="mt-5 scroll-mt-4 rounded-2xl border border-[#29445f] bg-[#071421] p-4"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="font-semibold">Todos os conteúdos</h3>
            <p className="mt-1 text-[10px] text-slate-400">
              Edite, revise e publique sem percorrer todo o fluxo.
            </p>
          </div>
          <label className="flex min-w-64 items-center gap-2 rounded-xl border border-[#29445f] bg-[#040e1a] px-3 py-2.5">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Buscar conteúdo..."
              className="min-w-0 flex-1 bg-transparent text-xs outline-none"
            />
          </label>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto border-b border-[#20374e] pb-3">
          {(
            [
              ["TODOS", "Todos"],
              ["PUBLICADO", "Publicados"],
              ["EM_REVISAO", "Em revisão"],
              ["RASCUNHO", "Rascunhos"],
            ] as Array<[CourseFilter, string]>
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => onFilter(value)}
              className={`shrink-0 rounded-lg px-3 py-2 text-xs ${
                filter === value
                  ? "bg-orange-500/10 text-orange-300"
                  : "text-slate-400 hover:text-slate-300"
              }`}
            >
              {label}
            </button>
          ))}
          <div className="ml-auto hidden items-center gap-2 text-[10px] text-slate-400 sm:flex">
            <Filter className="h-3.5 w-3.5" />
            {courses.length} resultados
          </div>
        </div>
        <ContentTable
          courses={courses}
          loading={loading}
          onOpen={onOpen}
        />
      </div>

      <section
        id="creator-performance"
        className="mt-5 scroll-mt-4 rounded-2xl border border-[#29445f] bg-[#071421] p-4"
      >
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold">Desempenho dos conteúdos</h3>
            <p className="mt-1 text-[10px] text-slate-400">
              Dados reais de matrícula, conclusão e abandono.
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <PerformanceList
            title="Cursos com maior conclusão"
            items={bestPerformance}
            onOpen={onOpen}
          />
          <AbandonmentList items={abandonment} onOpen={onOpen} />
        </div>
      </section>
    </div>
  );
};

type AnalyticsSituation =
  | "TODOS"
  | AcademiaAdminDashboard["alunos"][number]["situacao"];

const LearningAnalyticsDashboard: React.FC<{
  dashboard: AcademiaAdminDashboard | null;
  courses: CursoAdminResumo[];
  costCenters: string[];
  loading: boolean;
  onOpenCourse: (id: number) => void | Promise<void>;
}> = ({
  dashboard,
  courses,
  costCenters,
  loading,
  onOpenCourse,
}) => {
  const [selectedCenter, setSelectedCenter] = useState("TODOS");
  const [selectedCourse, setSelectedCourse] = useState("TODOS");
  const [selectedSituation, setSelectedSituation] =
    useState<AnalyticsSituation>("TODOS");
  const [studentSearch, setStudentSearch] = useState("");
  const [analysisVisible, setAnalysisVisible] = useState(false);

  const scopedStudents = useMemo(
    () =>
      (dashboard?.alunos ?? []).filter(
        (student) =>
          (selectedCenter === "TODOS" ||
            student.centro_custo === selectedCenter) &&
          (selectedCourse === "TODOS" ||
            String(student.curso_id) === selectedCourse),
      ),
    [dashboard?.alunos, selectedCenter, selectedCourse],
  );

  const filteredStudents = useMemo(() => {
    const term = studentSearch.trim().toLocaleLowerCase("pt-BR");
    return scopedStudents.filter((student) => {
      const matchesSituation =
        selectedSituation === "TODOS" ||
        student.situacao === selectedSituation;
      const matchesTerm =
        !term ||
        `${student.nome} ${student.centro_custo} ${student.curso_titulo}`
          .toLocaleLowerCase("pt-BR")
          .includes(term);
      return (
        matchesSituation &&
        matchesTerm
      );
    });
  }, [
    scopedStudents,
    selectedSituation,
    studentSearch,
  ]);

  const coursePerformance = useMemo(() => {
    if (selectedCenter === "TODOS") {
      return (dashboard?.desempenho ?? []).filter(
        (item) =>
          selectedCourse === "TODOS" ||
          String(item.curso_id) === selectedCourse,
      );
    }
    const grouped = new Map<
      number,
      AcademiaAdminDashboard["desempenho"][number] & {
        progresso_total: number;
      }
    >();
    scopedStudents.forEach((student) => {
      const current = grouped.get(student.curso_id) ?? {
        curso_id: student.curso_id,
        titulo: student.curso_titulo,
        matriculas: 0,
        concluidos: 0,
        taxa_conclusao: 0,
        progresso_medio: 0,
        progresso_total: 0,
      };
      current.matriculas += 1;
      current.concluidos += student.situacao === "CONCLUIDO" ? 1 : 0;
      current.progresso_total += student.progresso;
      grouped.set(student.curso_id, current);
    });
    return Array.from(grouped.values()).map((item) => ({
      curso_id: item.curso_id,
      titulo: item.titulo,
      matriculas: item.matriculas,
      concluidos: item.concluidos,
      taxa_conclusao: item.matriculas
        ? (item.concluidos / item.matriculas) * 100
        : 0,
      progresso_medio: item.matriculas
        ? item.progresso_total / item.matriculas
        : 0,
    }));
  }, [
    dashboard?.desempenho,
    scopedStudents,
    selectedCenter,
    selectedCourse,
  ]);

  const hasScopeFilter =
    selectedCenter !== "TODOS" || selectedCourse !== "TODOS";
  const totalEnrollments = hasScopeFilter
    ? scopedStudents.length
    : dashboard?.resumo.total_matriculas ?? 0;
  const totalStarted = hasScopeFilter
    ? scopedStudents.filter((student) => student.aulas_iniciadas > 0).length
    : dashboard?.resumo.total_iniciaram ?? 0;
  const totalHalfway = hasScopeFilter
    ? scopedStudents.filter((student) => student.progresso >= 50).length
    : dashboard?.resumo.total_metade ?? 0;
  const totalCompleted = hasScopeFilter
    ? scopedStudents.filter((student) => student.situacao === "CONCLUIDO")
        .length
    : dashboard?.resumo.total_concluidos ?? 0;
  const activeStudents = hasScopeFilter
    ? scopedStudents.filter((student) => student.situacao === "ATIVO").length
    : dashboard?.resumo.alunos_ativos ?? 0;
  const atRiskStudents = hasScopeFilter
    ? scopedStudents.filter((student) => student.situacao === "EM_RISCO")
        .length
    : dashboard?.resumo.alunos_em_risco ?? 0;
  const interruptedStudents = hasScopeFilter
    ? scopedStudents.filter((student) => student.situacao === "INTERROMPIDO")
        .length
    : dashboard?.resumo.alunos_interrompidos ?? 0;
  const completionRate = totalEnrollments
    ? Math.round((totalCompleted / totalEnrollments) * 100)
    : 0;
  const interruptionRate = totalEnrollments
    ? Math.round(
        (interruptedStudents / totalEnrollments) * 100,
      )
    : 0;

  const exportReport = () => {
    const header = [
      "Aluno",
      "Centro de custo",
      "Curso",
      "Progresso",
      "Aulas concluídas",
      "Última atividade",
      "Situação",
    ];
    const rows = filteredStudents.map((student) => [
      student.nome,
      student.centro_custo,
      student.curso_titulo,
      `${Math.round(student.progresso)}%`,
      `${student.aulas_concluidas}/${student.total_aulas}`,
      student.ultima_atividade || "",
      analyticsSituationLabel[student.situacao],
    ]);
    const csv = [header, ...rows]
      .map((row) =>
        row
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(";"),
      )
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `academia-aurora-analytics-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (loading && !dashboard) return <HubLoading />;

  return (
    <div id="creator-analytics" className="space-y-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <span>Academia</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-cyan-300">Analytics</span>
          </div>
          <h2 className="mt-2 text-2xl font-semibold text-white md:text-3xl">
            Analytics de Aprendizagem
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Acompanhe engajamento, evolução e pontos de atenção.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportReport}
            className="flex items-center gap-2 rounded-xl border border-[#31506c] bg-[#071421] px-4 py-3 text-xs font-semibold text-slate-200 hover:border-cyan-400/40"
          >
            <Download className="h-4 w-4" />
            EXPORTAR RELATÓRIO
          </button>
          <button
            onClick={() => setAnalysisVisible((current) => !current)}
            className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-xs font-semibold text-white shadow-[0_0_24px_rgba(249,115,22,.16)] hover:bg-orange-600"
          >
            <Sparkles className="h-4 w-4" />
            GERAR ANÁLISE
          </button>
        </div>
      </div>

      <section className="grid gap-2 rounded-2xl border border-[#29445f] bg-[#06111e] p-3 sm:grid-cols-2 xl:grid-cols-4">
        <AnalyticsSelect value="30" ariaLabel="Período">
          <option value="30">Últimos 30 dias</option>
        </AnalyticsSelect>
        <AnalyticsSelect
          value={selectedCenter}
          onChange={setSelectedCenter}
          ariaLabel="Centro de custo"
        >
          <option value="TODOS">Todos os centros</option>
          {costCenters.map((center) => (
            <option key={center} value={center}>
              {center}
            </option>
          ))}
        </AnalyticsSelect>
        <AnalyticsSelect
          value={selectedCourse}
          onChange={setSelectedCourse}
          ariaLabel="Curso"
        >
          <option value="TODOS">Todos os cursos</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.titulo}
            </option>
          ))}
        </AnalyticsSelect>
        <AnalyticsSelect
          value={selectedSituation}
          onChange={(value) =>
            setSelectedSituation(value as AnalyticsSituation)
          }
          ariaLabel="Situação"
        >
          <option value="TODOS">Todas as situações</option>
          <option value="ATIVO">Ativos</option>
          <option value="EM_RISCO">Em risco</option>
          <option value="INTERROMPIDO">Interrompidos</option>
          <option value="CONCLUIDO">Concluídos</option>
          <option value="NAO_INICIADO">Não iniciados</option>
        </AnalyticsSelect>
      </section>

      {analysisVisible && (
        <section className="flex items-start gap-3 rounded-2xl border border-orange-400/35 bg-orange-400/[0.055] p-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-400/10 text-orange-300">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-orange-200">
              Leitura gerencial da Aurora
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-300">
              A conclusão média está em {completionRate}%. Há {atRiskStudents} aluno(s) sem atividade entre 3 e 7 dias e {interruptedStudents} com mais de 7 dias de inatividade. Priorize os conteúdos listados em pontos de atenção.
            </p>
          </div>
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <AnalyticsMetric
          label="Matriculados"
          value={totalEnrollments}
          icon={<Users className="h-5 w-5" />}
          color="cyan"
        />
        <AnalyticsMetric
          label="Alunos ativos"
          value={activeStudents}
          icon={<Activity className="h-5 w-5" />}
          color="blue"
        />
        <AnalyticsMetric
          label="Tempo assistido"
          value="Em coleta"
          caption="Requer telemetria do player"
          icon={<Clock3 className="h-5 w-5" />}
          color="orange"
        />
        <AnalyticsMetric
          label="Conclusão"
          value={`${completionRate}%`}
          icon={<Target className="h-5 w-5" />}
          color="emerald"
        />
        <AnalyticsMetric
          label="Interrupção"
          value={`${interruptionRate}%`}
          caption="Sem atividade há mais de 7 dias"
          icon={<AlertCircle className="h-5 w-5" />}
          color="red"
        />
        <AnalyticsMetric
          label="Em risco"
          value={atRiskStudents}
          caption="Sem atividade entre 3 e 7 dias"
          icon={<ShieldCheck className="h-5 w-5" />}
          color="violet"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.08fr_.92fr]">
        <AnalyticsPanel title="Jornada de aprendizagem">
          <div className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-4">
            {[
              ["Matriculados", totalEnrollments, "from-cyan-500 to-cyan-400"],
              ["Iniciaram", totalStarted, "from-sky-500 to-blue-500"],
              ["50% ou mais", totalHalfway, "from-blue-500 to-violet-500"],
              ["Concluíram", totalCompleted, "from-emerald-500 to-orange-500"],
            ].map(([label, value, color], index) => (
              <div key={String(label)} className="relative">
                <div
                  className={`rounded-xl bg-gradient-to-r ${color} p-[1px]`}
                >
                  <div className="rounded-[11px] bg-[#071725] px-3 py-4 text-center">
                    <strong className="text-2xl text-white">{value}</strong>
                    <p className="mt-1 text-[9px] text-slate-300">{label}</p>
                  </div>
                </div>
                {index < 3 && (
                  <ChevronRight className="absolute -right-2.5 top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 text-slate-500 sm:block" />
                )}
              </div>
            ))}
          </div>
        </AnalyticsPanel>

        <AnalyticsPanel title="Conclusão por curso">
          <div className="space-y-3">
            {coursePerformance.length === 0 ? (
              <AnalyticsEmpty text="Ainda não há matrículas para comparar." />
            ) : (
              coursePerformance.slice(0, 5).map((course) => (
                <button
                  key={course.curso_id}
                  onClick={() => void onOpenCourse(course.curso_id)}
                  className="block w-full text-left"
                >
                  <div className="flex items-center justify-between gap-3 text-[10px]">
                    <span className="line-clamp-1 text-slate-300">
                      {course.titulo}
                    </span>
                    <strong className="text-emerald-300">
                      {Math.round(course.taxa_conclusao)}%
                    </strong>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#14283c]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400"
                      style={{
                        width: `${Math.min(100, course.taxa_conclusao)}%`,
                      }}
                    />
                  </div>
                </button>
              ))
            )}
          </div>
        </AnalyticsPanel>
      </div>

      {(dashboard?.prazos ?? []).length > 0 && (
        <AnalyticsPanel title="Aderência aos prazos">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left">
              <thead className="text-[9px] uppercase tracking-[.08em] text-slate-500">
                <tr>
                  <th className="pb-3 font-medium">Curso</th>
                  <th className="pb-3 font-medium">Atribuídas</th>
                  <th className="pb-3 font-medium">Concluídas</th>
                  <th className="pb-3 font-medium">Vencendo</th>
                  <th className="pb-3 font-medium">Vencidas</th>
                  <th className="pb-3 font-medium">Aderência</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#20374e]">
                {(dashboard?.prazos ?? []).map((item) => (
                  <tr key={item.curso_id}>
                    <td className="py-2.5 pr-4">
                      <button
                        onClick={() => void onOpenCourse(item.curso_id)}
                        className="line-clamp-1 text-xs text-slate-200 hover:text-orange-300"
                      >
                        {item.curso_titulo}
                      </button>
                    </td>
                    <td className="py-2.5 text-xs text-slate-400">
                      {item.atribuidas}
                    </td>
                    <td className="py-2.5 text-xs text-slate-400">
                      {item.concluidas}
                    </td>
                    <td className="py-2.5 text-xs font-semibold text-amber-300">
                      {item.vencendo}
                    </td>
                    <td className="py-2.5 text-xs font-semibold text-rose-300">
                      {item.vencidas}
                    </td>
                    <td className="py-2.5 text-xs font-semibold text-emerald-300">
                      {Math.round(item.aderencia)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AnalyticsPanel>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
        <AnalyticsPanel title="Engajamento por conteúdo">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left">
              <thead className="text-[9px] uppercase tracking-[.08em] text-slate-500">
                <tr>
                  <th className="pb-3 font-medium">Conteúdo</th>
                  <th className="pb-3 font-medium">Matrículas</th>
                  <th className="pb-3 font-medium">Progresso médio</th>
                  <th className="pb-3 font-medium">Conclusão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#20374e]">
                {coursePerformance.slice(0, 6).map((course) => (
                  <tr key={course.curso_id}>
                    <td className="py-2.5 pr-4">
                      <button
                        onClick={() => void onOpenCourse(course.curso_id)}
                        className="line-clamp-1 text-xs text-slate-200 hover:text-orange-300"
                      >
                        {course.titulo}
                      </button>
                    </td>
                    <td className="py-2.5 text-xs text-slate-400">
                      {course.matriculas}
                    </td>
                    <td className="py-2.5 pr-5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#14283c]">
                          <div
                            className="h-full rounded-full bg-cyan-400"
                            style={{
                              width: `${Math.min(100, course.progresso_medio)}%`,
                            }}
                          />
                        </div>
                        <span className="w-8 text-right text-[9px] text-cyan-300">
                          {Math.round(course.progresso_medio)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 text-xs font-semibold text-emerald-300">
                      {Math.round(course.taxa_conclusao)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AnalyticsPanel>

        <section className="rounded-2xl border border-orange-400/35 bg-[#071421] p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-orange-300">
              Pontos de atenção
            </h3>
            <span className="rounded-full border border-orange-400/30 bg-orange-400/[0.06] px-2.5 py-1 text-[8px] font-semibold text-orange-300">
              INSIGHT AURORA
            </span>
          </div>
          <div className="mt-4 space-y-2">
            {(dashboard?.abandonos ?? []).length === 0 ? (
              <AnalyticsEmpty text="Nenhuma interrupção identificada." />
            ) : (
              dashboard?.abandonos.slice(0, 4).map((item, index) => (
                <button
                  key={item.aula_id}
                  onClick={() => void onOpenCourse(item.curso_id)}
                  className="flex w-full items-center gap-3 rounded-xl border border-[#29445f] bg-[#040e1a] p-3 text-left hover:border-orange-400/30"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-orange-500 text-[10px] font-bold text-white">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="line-clamp-1 block text-[10px] text-slate-200">
                      {item.aula_titulo}
                    </strong>
                    <span className="mt-1 line-clamp-1 block text-[9px] text-slate-500">
                      {item.curso_titulo}
                    </span>
                  </span>
                  <span className="text-[10px] font-semibold text-orange-300">
                    {Math.round(item.taxa_abandono)}%
                  </span>
                </button>
              ))
            )}
          </div>
          <p className="mt-3 text-[9px] leading-relaxed text-slate-500">
            Interrupção considera progresso iniciado e ainda não concluído. A classificação temporal usa 3 dias para risco e 7 dias para interrupção.
          </p>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-[#29445f] bg-[#071421]">
        <div className="flex flex-col gap-3 border-b border-[#20374e] p-4 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-white">
              Acompanhamento dos alunos
            </h3>
            <p className="mt-1 text-[9px] text-slate-500">
              {filteredStudents.length} matrícula(s) nos filtros atuais
            </p>
          </div>
          <div className="flex gap-1 overflow-x-auto">
            {([
              ["TODOS", "Todos"],
              ["EM_RISCO", "Em risco"],
              ["INTERROMPIDO", "Interrompidos"],
            ] as Array<[AnalyticsSituation, string]>).map(
              ([value, label]) => (
                <button
                  key={value}
                  onClick={() => setSelectedSituation(value)}
                  className={`shrink-0 rounded-lg px-3 py-2 text-[10px] ${
                    selectedSituation === value
                      ? "bg-cyan-400/10 text-cyan-300"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ),
            )}
          </div>
          <label className="flex w-full items-center gap-2 rounded-xl border border-[#29445f] bg-[#040e1a] px-3 py-2.5 lg:w-72">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              value={studentSearch}
              onChange={(event) => setStudentSearch(event.target.value)}
              placeholder="Buscar aluno..."
              className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-slate-600"
            />
          </label>
        </div>
        <AnalyticsStudentTable students={filteredStudents} />
      </section>
    </div>
  );
};

const AnalyticsSelect: React.FC<{
  value: string;
  onChange?: (value: string) => void;
  ariaLabel: string;
  children: React.ReactNode;
}> = ({ value, onChange, ariaLabel, children }) => (
  <label className="relative flex items-center rounded-xl border border-[#29445f] bg-[#040e1a]">
    <select
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
      aria-label={ariaLabel}
      className="h-11 w-full appearance-none bg-transparent px-3 pr-9 text-xs text-slate-200 outline-none"
    >
      {children}
    </select>
    <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-slate-500" />
  </label>
);

const analyticsMetricColor = {
  cyan: "border-cyan-400/25 bg-cyan-400/[0.035] text-cyan-300",
  blue: "border-blue-400/25 bg-blue-400/[0.035] text-blue-300",
  orange: "border-orange-400/25 bg-orange-400/[0.035] text-orange-300",
  emerald: "border-emerald-400/25 bg-emerald-400/[0.035] text-emerald-300",
  red: "border-red-400/25 bg-red-400/[0.035] text-red-300",
  violet: "border-violet-400/25 bg-violet-400/[0.035] text-violet-300",
};

const AnalyticsMetric: React.FC<{
  label: string;
  value: React.ReactNode;
  caption?: string;
  icon: React.ReactNode;
  color: keyof typeof analyticsMetricColor;
}> = ({ label, value, caption, icon, color }) => (
  <article
    className={`min-h-28 rounded-2xl border p-4 ${analyticsMetricColor[color]}`}
  >
    <div className="flex items-center justify-between gap-3">
      <span className="text-[9px] uppercase tracking-[.12em] text-slate-400">
        {label}
      </span>
      {icon}
    </div>
    <strong className="mt-3 block text-2xl text-white">{value}</strong>
    <span className="mt-1 block text-[8px] leading-relaxed text-slate-500">
      {caption || "Dados consolidados da Academia"}
    </span>
  </article>
);

const AnalyticsPanel: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => (
  <section className="rounded-2xl border border-[#29445f] bg-[#071421] p-4">
    <h3 className="mb-4 text-sm font-semibold text-white">{title}</h3>
    {children}
  </section>
);

const AnalyticsEmpty: React.FC<{ text: string }> = ({ text }) => (
  <div className="grid min-h-24 place-items-center rounded-xl border border-dashed border-[#29445f] px-4 text-center text-[10px] text-slate-500">
    {text}
  </div>
);

const analyticsSituationLabel: Record<
  AcademiaAdminDashboard["alunos"][number]["situacao"],
  string
> = {
  ATIVO: "Ativo",
  EM_RISCO: "Em risco",
  INTERROMPIDO: "Interrompido",
  CONCLUIDO: "Concluído",
  NAO_INICIADO: "Não iniciado",
};

const analyticsSituationClass: Record<
  AcademiaAdminDashboard["alunos"][number]["situacao"],
  string
> = {
  ATIVO: "border-cyan-400/25 bg-cyan-400/10 text-cyan-300",
  EM_RISCO: "border-orange-400/25 bg-orange-400/10 text-orange-300",
  INTERROMPIDO: "border-red-400/25 bg-red-400/10 text-red-300",
  CONCLUIDO: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  NAO_INICIADO: "border-slate-400/25 bg-slate-400/10 text-slate-300",
};

const formatAnalyticsDate = (value?: string | null) => {
  if (!value) return "Ainda não iniciou";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data indisponível";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const AnalyticsStudentTable: React.FC<{
  students: AcademiaAdminDashboard["alunos"];
}> = ({ students }) => {
  if (students.length === 0) {
    return (
      <div className="grid min-h-40 place-items-center text-xs text-slate-500">
        Nenhum aluno encontrado para estes filtros.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-left">
        <thead className="bg-[#050f1c] text-[9px] uppercase tracking-[.08em] text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Aluno</th>
            <th className="px-4 py-3 font-medium">Centro de custo</th>
            <th className="px-4 py-3 font-medium">Curso</th>
            <th className="px-4 py-3 font-medium">Progresso</th>
            <th className="px-4 py-3 font-medium">Aulas</th>
            <th className="px-4 py-3 font-medium">Última atividade</th>
            <th className="px-4 py-3 font-medium">Situação</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#20374e]">
          {students.map((student) => (
            <tr key={student.matricula_id} className="hover:bg-white/[0.015]">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-cyan-400/25 bg-cyan-400/[0.06] text-[9px] font-semibold text-cyan-200">
                    {student.nome
                      .split(" ")
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join("")}
                  </span>
                  <span className="line-clamp-1 text-xs text-slate-200">
                    {student.nome}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-[10px] text-slate-400">
                {student.centro_custo}
              </td>
              <td className="px-4 py-3 text-[10px] text-slate-300">
                {student.curso_titulo}
              </td>
              <td className="px-4 py-3">
                <div className="flex min-w-28 items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#14283c]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400"
                      style={{ width: `${Math.min(100, student.progresso)}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-[9px] text-cyan-300">
                    {Math.round(student.progresso)}%
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-[10px] text-slate-400">
                {student.aulas_concluidas}/{student.total_aulas}
              </td>
              <td className="px-4 py-3 text-[10px] text-slate-400">
                {formatAnalyticsDate(student.ultima_atividade)}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] ${analyticsSituationClass[student.situacao]}`}
                >
                  {analyticsSituationLabel[student.situacao]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const RecentCourse: React.FC<{
  course: CursoAdminResumo;
  onOpen: (id: number) => void | Promise<void>;
}> = ({ course, onOpen }) => {
  const construction =
    course.total_modulos === 0
      ? 15
      : course.total_aulas === 0
        ? 45
        : course.status === "PUBLICADO"
          ? 100
          : course.status === "EM_REVISAO"
            ? 90
            : 75;
  return (
    <button
      onClick={() => void onOpen(course.id)}
      className="grid w-full gap-3 rounded-xl border border-[#263f58] bg-[#040e1a] p-3 text-left transition hover:border-orange-500/30 sm:grid-cols-[minmax(0,1fr)_150px]"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="grid h-14 w-20 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#12385e] to-[#07111f] bg-cover bg-center text-cyan-300"
          style={
            course.capa_url
              ? { backgroundImage: `url("${course.capa_url}")` }
              : undefined
          }
        >
          {!course.capa_url && <BookOpen className="h-5 w-5" />}
        </div>
        <div className="min-w-0">
          <h4 className="line-clamp-1 text-sm font-medium">
            {course.titulo}
          </h4>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-md border px-2 py-1 text-[8px] ${statusClass[course.status]}`}
            >
              {statusLabel[course.status]}
            </span>
            <span className="text-[9px] text-slate-400">
              {course.total_modulos} módulos · {course.total_aulas} aulas
            </span>
          </div>
        </div>
      </div>
      <div className="self-center">
        <div className="flex justify-between text-[9px] text-slate-400">
          <span>Construção</span>
          <strong className="text-cyan-300">{construction}%</strong>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#14283c]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-orange-500 to-cyan-400"
            style={{ width: `${construction}%` }}
          />
        </div>
        <p className="mt-2 text-right text-[9px] text-orange-300">
          Continuar edição →
        </p>
      </div>
    </button>
  );
};

const QuickAction: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}> = ({ icon, title, description, onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-3 rounded-xl border border-[#29445f] bg-[#040e1a] p-3 text-left hover:border-cyan-400/30"
  >
    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300">
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-xs font-medium">{title}</p>
      <p className="mt-1 line-clamp-1 text-[9px] text-slate-400">
        {description}
      </p>
    </div>
    <ChevronRight className="h-4 w-4 text-slate-400" />
  </button>
);

const ContentTable: React.FC<{
  courses: CursoAdminResumo[];
  loading: boolean;
  onOpen: (id: number) => void | Promise<void>;
}> = ({ courses, loading, onOpen }) => {
  if (loading && courses.length === 0) return <HubLoading />;
  if (courses.length === 0) {
    return (
      <div className="py-10 text-center text-xs text-slate-400">
        Nenhum conteúdo encontrado para este filtro.
      </div>
    );
  }
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full min-w-[780px] text-left">
        <thead className="text-[9px] uppercase tracking-[0.08em] text-slate-400">
          <tr>
            <th className="px-3 py-3 font-medium">Curso</th>
            <th className="px-3 py-3 font-medium">Público</th>
            <th className="px-3 py-3 font-medium">Estrutura</th>
            <th className="px-3 py-3 font-medium">Status</th>
            <th className="px-3 py-3 font-medium">Ação</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#20374e]">
          {courses.map((course) => (
            <tr key={course.id} className="hover:bg-white/[0.015]">
              <td className="px-3 py-3">
                <button
                  onClick={() => void onOpen(course.id)}
                  className="font-medium hover:text-orange-300"
                >
                  {course.titulo}
                </button>
                <p className="mt-1 text-[9px] text-slate-400">
                  {course.nivel}
                </p>
              </td>
              <td className="px-3 py-3 text-xs text-slate-400">
                {course.todos_centros_custo
                  ? "Todos"
                  : course.centros_custo.slice(0, 2).join(", ") || "Não definido"}
                {course.centros_custo.length > 2 &&
                  ` +${course.centros_custo.length - 2}`}
              </td>
              <td className="px-3 py-3 text-xs text-slate-400">
                {course.total_modulos} módulos · {course.total_aulas} aulas
              </td>
              <td className="px-3 py-3">
                <span
                  className={`rounded-md border px-2 py-1 text-[9px] ${statusClass[course.status]}`}
                >
                  {statusLabel[course.status]}
                </span>
              </td>
              <td className="px-3 py-3">
                <button
                  onClick={() => void onOpen(course.id)}
                  className="rounded-lg border border-[#29445f] px-3 py-2 text-[9px] text-orange-300 hover:bg-orange-500/5"
                >
                  EDITAR
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const PerformanceList: React.FC<{
  title: string;
  items: AcademiaAdminDashboard["desempenho"];
  onOpen: (id: number) => void | Promise<void>;
}> = ({ title, items, onOpen }) => (
  <div className="rounded-xl border border-[#263f58] bg-[#040e1a] p-4">
    <h4 className="text-xs font-medium">{title}</h4>
    <div className="mt-4 space-y-3">
      {items.length === 0 ? (
        <p className="py-6 text-center text-[10px] text-slate-400">
          Ainda não há matrículas suficientes para análise.
        </p>
      ) : (
        items.map((item, index) => (
          <button
            key={item.curso_id}
            onClick={() => void onOpen(item.curso_id)}
            className="flex w-full items-center gap-3 text-left"
          >
            <span className="grid h-6 w-6 place-items-center rounded-lg bg-cyan-400/10 text-[9px] text-cyan-300">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex justify-between gap-3 text-[10px]">
                <span className="line-clamp-1">{item.titulo}</span>
                <strong className="text-emerald-300">
                  {Math.round(item.taxa_conclusao)}%
                </strong>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[#14283c]">
                <div
                  className="h-full bg-emerald-400"
                  style={{ width: `${item.taxa_conclusao}%` }}
                />
              </div>
            </div>
          </button>
        ))
      )}
    </div>
  </div>
);

const AbandonmentList: React.FC<{
  items: AcademiaAdminDashboard["abandonos"];
  onOpen: (id: number) => void | Promise<void>;
}> = ({ items, onOpen }) => (
  <div className="rounded-xl border border-[#263f58] bg-[#040e1a] p-4">
    <h4 className="text-xs font-medium">Aulas com maior abandono</h4>
    <div className="mt-4 space-y-3">
      {items.length === 0 ? (
        <p className="py-6 text-center text-[10px] text-slate-400">
          Nenhuma aula com abandono identificado.
        </p>
      ) : (
        items.map((item, index) => (
          <button
            key={item.aula_id}
            onClick={() => void onOpen(item.curso_id)}
            className="flex w-full items-center gap-3 text-left"
          >
            <span className="grid h-6 w-6 place-items-center rounded-lg bg-orange-400/10 text-[9px] text-orange-300">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-[10px]">{item.aula_titulo}</p>
              <p className="mt-1 line-clamp-1 text-[9px] text-slate-400">
                {item.curso_titulo}
              </p>
            </div>
            <strong className="text-[10px] text-orange-300">
              {Math.round(item.taxa_abandono)}%
            </strong>
          </button>
        ))
      )}
    </div>
  </div>
);

const HubLoading = () => (
  <div className="grid min-h-40 place-items-center">
    <Loader2 className="h-6 w-6 animate-spin text-orange-400" />
  </div>
);

const HubEmpty: React.FC<{
  text: string;
  action: string;
  onAction: () => void;
}> = ({ text, action, onAction }) => (
  <div className="grid min-h-40 place-items-center rounded-xl border border-dashed border-[#29445f] text-center">
    <div>
      <BookOpen className="mx-auto h-7 w-7 text-slate-400" />
      <p className="mt-3 text-xs text-slate-400">{text}</p>
      <button
        onClick={onAction}
        className="mt-3 text-[10px] font-semibold text-orange-300"
      >
        {action}
      </button>
    </div>
  </div>
);

const CourseForm: React.FC<{
  draft: CursoAdminPayload;
  setDraft: React.Dispatch<React.SetStateAction<CursoAdminPayload>>;
  costCenters: string[];
  costCenterSearch: string;
  setCostCenterSearch: (value: string) => void;
  saving: boolean;
  onSave: () => void;
}> = ({
  draft,
  setDraft,
  costCenters,
  costCenterSearch,
  setCostCenterSearch,
  saving,
  onSave,
}) => {
  const toggleCenter = (center: string) => {
    setDraft((current) => ({
      ...current,
      centros_custo: current.centros_custo.includes(center)
        ? current.centros_custo.filter((item) => item !== center)
        : [...current.centros_custo, center],
    }));
  };

  return (
    <section>
      <SectionHeading
        title="1. Informações do curso"
        description="Defina a identidade, o público e a ordem no catálogo."
      />
      <div className="mt-6 grid gap-5 rounded-2xl border border-[#263f58] bg-[#071421] p-5 md:grid-cols-2">
        <Field label="Título do curso" required>
          <input
            value={draft.titulo}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                titulo: event.target.value,
              }))
            }
            className="academy-admin-input"
            placeholder="Ex.: Fundamentos da cobrança"
          />
        </Field>
        <Field label="URL da capa">
          <input
            value={draft.capa_url}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                capa_url: event.target.value,
              }))
            }
            className="academy-admin-input"
            placeholder="https://..."
          />
        </Field>
        <div className="md:col-span-2">
          <Field label="Descrição">
            <textarea
              value={draft.descricao}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  descricao: event.target.value,
                }))
              }
              className="academy-admin-input min-h-24 resize-y"
              placeholder="Explique o objetivo do curso."
            />
          </Field>
        </div>
        <Field label="Nível">
          <select
            value={draft.nivel}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                nivel: event.target.value as CursoAdminPayload["nivel"],
              }))
            }
            className="academy-admin-input"
          >
            <option value="INICIANTE">Iniciante</option>
            <option value="INTERMEDIARIO">Intermediário</option>
            <option value="AVANCADO">Avançado</option>
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Carga horária (min)">
            <input
              type="number"
              min={0}
              value={draft.carga_horaria_min}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  carga_horaria_min: Number(event.target.value),
                }))
              }
              className="academy-admin-input"
            />
          </Field>
          <Field label="Ordem">
            <input
              type="number"
              min={0}
              value={draft.ordem}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  ordem: Number(event.target.value),
                }))
              }
              className="academy-admin-input"
            />
          </Field>
        </div>
        <div className="md:col-span-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Público do curso</p>
              <p className="mt-1 text-xs text-slate-400">
                O catálogo respeitará esta seleção.
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={draft.todos_centros_custo}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    todos_centros_custo: event.target.checked,
                    centros_custo: event.target.checked
                      ? []
                      : current.centros_custo,
                  }))
                }
                className="accent-orange-500"
              />
              Todos os Centros de Custo
            </label>
          </div>
          {!draft.todos_centros_custo && (
            <div className="mt-4 rounded-xl border border-[#29445f] bg-[#040e1a] p-3">
              <label className="flex items-center gap-2 rounded-lg border border-[#29445f] px-3 py-2">
                <Search className="h-3.5 w-3.5 text-slate-400" />
                <input
                  value={costCenterSearch}
                  onChange={(event) =>
                    setCostCenterSearch(event.target.value)
                  }
                  placeholder="Buscar Centro de Custo..."
                  className="min-w-0 flex-1 bg-transparent text-xs outline-none"
                />
              </label>
              <div className="mt-3 grid max-h-44 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                {costCenters.map((center) => (
                  <label
                    key={center}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-xs ${
                      draft.centros_custo.includes(center)
                        ? "border-orange-500/35 bg-orange-500/[0.08] text-orange-200"
                        : "border-[#233b53] text-slate-400"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={draft.centros_custo.includes(center)}
                      onChange={() => toggleCenter(center)}
                      className="accent-orange-500"
                    />
                    <span className="line-clamp-1">{center}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="mt-5 flex justify-end">
        <PrimaryButton onClick={onSave} loading={saving}>
          <Save className="h-4 w-4" />
          SALVAR E CONTINUAR
        </PrimaryButton>
      </div>
    </section>
  );
};

const ModuleEditor: React.FC<{
  course: CursoAdmin;
  draft: ModuloAdminPayload;
  setDraft: React.Dispatch<React.SetStateAction<ModuloAdminPayload>>;
  editingId: number | null;
  saving: boolean;
  onSave: () => void;
  onEdit: (module: ModuloAdmin) => void;
  onCancel: () => void;
  onDeactivate: (module: ModuloAdmin) => void;
  onContinue: () => void;
}> = ({
  course,
  draft,
  setDraft,
  editingId,
  saving,
  onSave,
  onEdit,
  onCancel,
  onDeactivate,
  onContinue,
}) => (
  <section>
    <SectionHeading
      title="2. Estrutura de módulos"
      description="Organize o curso em blocos claros e progressivos."
    />
    <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-3">
        {course.modulos.length === 0 ? (
          <EmptyEditorState text="Nenhum módulo criado." />
        ) : (
          course.modulos.map((module, index) => (
            <article
              key={module.id}
              className="flex items-center gap-4 rounded-2xl border border-[#263f58] bg-[#071421] p-4"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-500/10 text-sm font-semibold text-orange-400">
                {String(index + 1).padStart(2, "0")}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-medium">{module.titulo}</h3>
                <p className="mt-1 text-xs text-slate-400">
                  {module.aulas.length} aulas · ordem {module.ordem}
                </p>
              </div>
              <IconButton
                label="Editar módulo"
                onClick={() => onEdit(module)}
              >
                <Pencil className="h-4 w-4" />
              </IconButton>
              <IconButton
                label="Desativar módulo"
                onClick={() => void onDeactivate(module)}
                destructive
              >
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </article>
          ))
        )}
      </div>
      <EditorCard title={editingId ? "Editar módulo" : "Novo módulo"}>
        <Field label="Título" required>
          <input
            value={draft.titulo}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                titulo: event.target.value,
              }))
            }
            className="academy-admin-input"
          />
        </Field>
        <Field label="Descrição">
          <textarea
            value={draft.descricao}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                descricao: event.target.value,
              }))
            }
            className="academy-admin-input min-h-20 resize-y"
          />
        </Field>
        <Field label="Ordem">
          <input
            type="number"
            min={0}
            value={draft.ordem}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                ordem: Number(event.target.value),
              }))
            }
            className="academy-admin-input"
          />
        </Field>
        <div className="flex gap-2">
          {editingId && (
            <SecondaryButton onClick={onCancel}>CANCELAR</SecondaryButton>
          )}
          <PrimaryButton onClick={onSave} loading={saving} grow>
            {editingId ? "ATUALIZAR" : "ADICIONAR MÓDULO"}
          </PrimaryButton>
        </div>
      </EditorCard>
    </div>
    <div className="mt-5 flex justify-end">
      <PrimaryButton
        onClick={onContinue}
        disabled={course.modulos.length === 0}
      >
        CONTINUAR PARA AULAS
        <ChevronRight className="h-4 w-4" />
      </PrimaryButton>
    </div>
  </section>
);

const LessonEditor: React.FC<{
  course: CursoAdmin;
  selectedModuleId: number | null;
  setSelectedModuleId: (id: number) => void;
  activeModule: ModuloAdmin | null;
  draft: AulaAdminPayload;
  setDraft: React.Dispatch<React.SetStateAction<AulaAdminPayload>>;
  editingId: number | null;
  saving: boolean;
  onSave: () => void;
  onEdit: (lesson: AulaAdmin) => void;
  onCancel: () => void;
  onDeactivate: (lesson: AulaAdmin) => void;
  onContinue: () => void;
}> = ({
  course,
  selectedModuleId,
  setSelectedModuleId,
  activeModule,
  draft,
  setDraft,
  editingId,
  saving,
  onSave,
  onEdit,
  onCancel,
  onDeactivate,
  onContinue,
}) => (
  <section>
    <SectionHeading
      title="3. Aulas e materiais"
      description="Combine vídeos, PDFs, textos e experiências do Copilot."
    />
    <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
      {course.modulos.map((module) => (
        <button
          key={module.id}
          onClick={() => {
            setSelectedModuleId(module.id);
            onCancel();
          }}
          className={`shrink-0 rounded-xl border px-4 py-2.5 text-xs ${
            selectedModuleId === module.id
              ? "border-orange-500/35 bg-orange-500/10 text-orange-300"
              : "border-[#29445f] text-slate-400"
          }`}
        >
          {module.titulo}
        </button>
      ))}
    </div>
    <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="space-y-3">
        {!activeModule || activeModule.aulas.length === 0 ? (
          <EmptyEditorState text="Nenhuma aula neste módulo." />
        ) : (
          activeModule.aulas.map((lesson, index) => (
            <article
              key={lesson.id}
              className="flex items-center gap-3 rounded-2xl border border-[#263f58] bg-[#071421] p-4"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300">
                {lesson.tipo === "PDF" ? (
                  <FileText className="h-4 w-4" />
                ) : (
                  <span className="text-xs">{index + 1}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="line-clamp-1 text-sm font-medium">
                  {lesson.titulo}
                </h3>
                <p className="mt-1 text-[10px] text-slate-400">
                  {lessonTypeLabels[lesson.tipo]} · {lesson.duracao_min} min
                  {lesson.obrigatoria ? " · obrigatória" : ""}
                </p>
              </div>
              <IconButton
                label="Editar aula"
                onClick={() => onEdit(lesson)}
              >
                <Pencil className="h-4 w-4" />
              </IconButton>
              <IconButton
                label="Desativar aula"
                onClick={() => void onDeactivate(lesson)}
                destructive
              >
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </article>
          ))
        )}
      </div>
      <EditorCard title={editingId ? "Editar aula" : "Nova aula"}>
        <Field label="Título" required>
          <input
            value={draft.titulo}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                titulo: event.target.value,
              }))
            }
            className="academy-admin-input"
          />
        </Field>
        <Field label="Tipo de conteúdo">
          <select
            value={draft.tipo}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                tipo: event.target.value as AulaTipo,
                conteudo_url: "",
                conteudo_texto: "",
              }))
            }
            className="academy-admin-input"
          >
            {Object.entries(lessonTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Descrição">
          <textarea
            value={draft.descricao}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                descricao: event.target.value,
              }))
            }
            className="academy-admin-input min-h-20 resize-y"
          />
        </Field>
        {["VIDEO", "PDF", "LINK"].includes(draft.tipo) && (
          <Field label="URL do conteúdo" required>
            <input
              value={draft.conteudo_url}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  conteudo_url: event.target.value,
                }))
              }
              className="academy-admin-input"
              placeholder="https://..."
            />
          </Field>
        )}
        {draft.tipo === "TEXTO" && (
          <Field label="Conteúdo da aula" required>
            <textarea
              value={draft.conteudo_texto}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  conteudo_texto: event.target.value,
                }))
              }
              className="academy-admin-input min-h-36 resize-y"
            />
          </Field>
        )}
        {["QUIZ", "SIMULACAO", "TREINAMENTO"].includes(draft.tipo) && (
          <div className="rounded-xl border border-violet-400/15 bg-violet-400/[0.05] p-3 text-xs text-violet-200">
            Esta aula abrirá automaticamente o módulo{" "}
            {lessonTypeLabels[draft.tipo]} já existente no Copilot.
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Duração (min)">
            <input
              type="number"
              min={0}
              value={draft.duracao_min}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  duracao_min: Number(event.target.value),
                }))
              }
              className="academy-admin-input"
            />
          </Field>
          <Field label="Ordem">
            <input
              type="number"
              min={0}
              value={draft.ordem}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  ordem: Number(event.target.value),
                }))
              }
              className="academy-admin-input"
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={draft.obrigatoria}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                obrigatoria: event.target.checked,
              }))
            }
            className="accent-orange-500"
          />
          Aula obrigatória para concluir o curso
        </label>
        <div className="flex gap-2">
          {editingId && (
            <SecondaryButton onClick={onCancel}>CANCELAR</SecondaryButton>
          )}
          <PrimaryButton
            onClick={onSave}
            loading={saving}
            disabled={!selectedModuleId}
            grow
          >
            {editingId ? "ATUALIZAR" : "ADICIONAR AULA"}
          </PrimaryButton>
        </div>
      </EditorCard>
    </div>
    <div className="mt-5 flex justify-end">
      <PrimaryButton
        onClick={onContinue}
        disabled={!course.modulos.some((module) => module.aulas.length > 0)}
      >
        REVISAR E PUBLICAR
        <ChevronRight className="h-4 w-4" />
      </PrimaryButton>
    </div>
  </section>
);

const PublicationStep: React.FC<{
  course: CursoAdmin;
  saving: boolean;
  onChangePublication: () => void;
  onArchive: () => void;
}> = ({ course, saving, onChangePublication, onArchive }) => {
  const totalLessons = course.modulos.reduce(
    (total, module) => total + module.aulas.length,
    0,
  );
  const checks = [
    { label: "Informações do curso", ready: Boolean(course.titulo) },
    { label: "Público definido", ready: course.todos_centros_custo || course.centros_custo.length > 0 },
    { label: "Ao menos um módulo", ready: course.modulos.length > 0 },
    { label: "Ao menos uma aula", ready: totalLessons > 0 },
  ];
  const ready = checks.every((item) => item.ready);

  return (
    <section>
      <SectionHeading
        title="4. Revisão e publicação"
        description="Confira a estrutura antes de disponibilizar o curso."
      />
      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-2xl border border-[#263f58] bg-[#071421] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span
                className={`rounded-lg px-3 py-1.5 text-[10px] ${
                  course.status === "PUBLICADO"
                    ? "bg-emerald-400/10 text-emerald-300"
                    : "bg-amber-400/10 text-amber-300"
                }`}
              >
                {course.status}
              </span>
              <h2 className="mt-4 text-2xl font-semibold">
                {course.titulo}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
                {course.descricao || "Sem descrição."}
              </p>
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <SummaryCard
              icon={<Layers3 className="h-4 w-4" />}
              value={course.modulos.length}
              label="módulos"
            />
            <SummaryCard
              icon={<BookOpen className="h-4 w-4" />}
              value={totalLessons}
              label="aulas"
            />
            <SummaryCard
              icon={<Clock3 className="h-4 w-4" />}
              value={course.carga_horaria_min}
              label="minutos"
            />
          </div>
          <div className="mt-5 border-t border-[#263f58] pt-5">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Users className="h-4 w-4 text-cyan-300" />
              Público
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(course.todos_centros_custo
                ? ["TODOS OS CENTROS DE CUSTO"]
                : course.centros_custo
              ).map((center) => (
                <span
                  key={center}
                  className="rounded-lg border border-[#29445f] px-3 py-1.5 text-[10px] text-slate-300"
                >
                  {center}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-[#263f58] bg-[#071421] p-5">
            <h3 className="font-semibold">Checklist de publicação</h3>
            <div className="mt-4 space-y-3">
              {checks.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 text-xs"
                >
                  <div
                    className={`grid h-6 w-6 place-items-center rounded-full ${
                      item.ready
                        ? "bg-emerald-400/10 text-emerald-300"
                        : "bg-red-400/10 text-red-300"
                    }`}
                  >
                    {item.ready ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <X className="h-3.5 w-3.5" />
                    )}
                  </div>
                  {item.label}
                </div>
              ))}
            </div>
          </div>
          <PrimaryButton
            onClick={onChangePublication}
            loading={saving}
            disabled={!ready && course.status !== "PUBLICADO"}
            grow
          >
            <Rocket className="h-4 w-4" />
            {course.status === "PUBLICADO"
              ? "VOLTAR PARA RASCUNHO"
              : course.status === "EM_REVISAO"
                ? "APROVAR E PUBLICAR"
                : "ENVIAR PARA REVISÃO"}
          </PrimaryButton>
          <button
            onClick={onArchive}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-400/20 px-4 py-3 text-xs font-semibold text-red-300 hover:bg-red-400/5 disabled:opacity-50"
          >
            <Archive className="h-4 w-4" />
            ARQUIVAR CURSO
          </button>
        </div>
      </div>
    </section>
  );
};

const SectionHeading: React.FC<{
  title: string;
  description: string;
}> = ({ title, description }) => (
  <div>
    <h2 className="text-xl font-semibold md:text-2xl">{title}</h2>
    <p className="mt-1 text-sm text-slate-400">{description}</p>
  </div>
);

const Field: React.FC<{
  label: string;
  required?: boolean;
  children: React.ReactNode;
}> = ({ label, required, children }) => (
  <label className="block">
    <span className="mb-2 block text-xs font-medium text-slate-300">
      {label}
      {required && <span className="ml-1 text-orange-400">*</span>}
    </span>
    {children}
  </label>
);

const EditorCard: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => (
  <div className="self-start rounded-2xl border border-[#29445f] bg-[#071421] p-5">
    <h3 className="mb-4 flex items-center gap-2 font-semibold">
      <CirclePlus className="h-4 w-4 text-orange-400" />
      {title}
    </h3>
    <div className="space-y-4">{children}</div>
  </div>
);

const PrimaryButton: React.FC<{
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  grow?: boolean;
  children: React.ReactNode;
}> = ({ onClick, loading, disabled, grow, children }) => (
  <button
    onClick={onClick}
    disabled={loading || disabled}
    className={`flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-xs font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-45 ${
      grow ? "w-full flex-1" : ""
    }`}
  >
    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
    {children}
  </button>
);

const SecondaryButton: React.FC<{
  onClick: () => void;
  children: React.ReactNode;
}> = ({ onClick, children }) => (
  <button
    onClick={onClick}
    className="rounded-xl border border-[#29445f] px-4 py-3 text-xs font-semibold text-slate-300 hover:bg-white/[0.03]"
  >
    {children}
  </button>
);

const IconButton: React.FC<{
  label: string;
  onClick: () => void;
  destructive?: boolean;
  children: React.ReactNode;
}> = ({ label, onClick, destructive, children }) => (
  <button
    onClick={onClick}
    className={`rounded-lg border p-2 ${
      destructive
        ? "border-red-400/15 text-red-300 hover:bg-red-400/5"
        : "border-[#29445f] text-slate-400 hover:text-white"
    }`}
    aria-label={label}
    title={label}
  >
    {children}
  </button>
);

const EmptyEditorState: React.FC<{ text: string }> = ({ text }) => (
  <div className="grid min-h-36 place-items-center rounded-2xl border border-dashed border-[#29445f] bg-[#071421]/50 p-6 text-center text-sm text-slate-400">
    {text}
  </div>
);

const SummaryCard: React.FC<{
  icon: React.ReactNode;
  value: number;
  label: string;
}> = ({ icon, value, label }) => (
  <div className="rounded-xl border border-[#29445f] bg-[#040e1a] p-3">
    <div className="flex items-center gap-2 text-cyan-300">{icon}</div>
    <strong className="mt-2 block text-xl">{value}</strong>
    <span className="text-[10px] text-slate-400">{label}</span>
  </div>
);

export default AcademiaGestaoModal;
