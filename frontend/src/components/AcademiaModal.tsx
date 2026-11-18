import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bell,
  BookMarked,
  BookOpen,
  Brain,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileText,
  Flame,
  GraduationCap,
  Home,
  Library,
  Loader2,
  Lock,
  Play,
  Search,
  Star,
  Target,
  Trophy,
  Video,
  X,
} from "lucide-react";
import { animate } from "animejs/animation";
import {
  academiaApi,
  AcademiaQuizAluno,
  AcademiaQuizCorrecaoItem,
  AulaAcademia,
  AulaTipo,
  CatalogoAcademia,
  CertificadoAcademia,
  CursoDetalhe,
  CursoResumo,
  MaterialSalvo,
  SituacaoPrazo,
} from "@/services/academiaApi";

interface AcademiaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AcademySection =
  | "inicio"
  | "cursos"
  | "trilhas"
  | "conquistas"
  | "materiais"
  | "curso";

const navigation = [
  { id: "inicio" as const, label: "Início", icon: Home },
  { id: "cursos" as const, label: "Meus cursos", icon: BookOpen },
  { id: "trilhas" as const, label: "Catálogo", icon: Library },
  { id: "conquistas" as const, label: "Conquistas", icon: Trophy },
  { id: "materiais" as const, label: "Materiais salvos", icon: BookMarked },
];

const lessonIcons: Record<
  AulaTipo,
  React.ComponentType<{ className?: string }>
> = {
  VIDEO: Video,
  PDF: FileText,
  TEXTO: BookOpen,
  QUIZ: Brain,
  SIMULACAO: Target,
  TREINAMENTO: GraduationCap,
  LINK: ExternalLink,
};

const formatDuration = (minutes: number) => {
  if (!minutes) return "Duração livre";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}min` : `${hours}h`;
};

/**
 * O quiz chega pronto do backend, já sem o gabarito. Não há mais parse de
 * `conteudo_texto`: aula avaliativa não trafega o JSON bruto.
 */
const parseLessonQuiz = (lesson: AulaAcademia): AcademiaQuizAluno | null =>
  lesson.quiz?.perguntas?.length ? lesson.quiz : null;

const prazoBadge: Record<
  SituacaoPrazo,
  { label: string; className: string }
> = {
  VENCIDO: {
    label: "Prazo vencido",
    className: "border-rose-400/30 bg-rose-400/10 text-rose-200",
  },
  VENCE_EM_BREVE: {
    label: "Vence em breve",
    className: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  },
  EM_DIA: {
    label: "No prazo",
    className: "border-cyan-400/25 bg-cyan-400/10 text-cyan-200",
  },
  CONCLUIDO: {
    label: "Concluído",
    className: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
  },
};

const formatDate = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? null
    : parsed.toLocaleDateString("pt-BR");
};

const PrazoBadge: React.FC<{
  situacao?: SituacaoPrazo | null;
  dataLimite?: string | null;
  obrigatoria?: boolean;
}> = ({ situacao, dataLimite, obrigatoria }) => {
  if (!situacao || situacao === "CONCLUIDO") return null;
  const badge = prazoBadge[situacao];
  const data = formatDate(dataLimite);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-semibold ${badge.className}`}
    >
      {obrigatoria && <Lock className="h-3 w-3" />}
      {badge.label}
      {data && ` · ${data}`}
    </span>
  );
};

const AcademiaModal: React.FC<AcademiaModalProps> = ({
  isOpen,
  onClose,
}) => {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] =
    useState<AcademySection>("inicio");
  const [searchTerm, setSearchTerm] = useState("");
  const [catalog, setCatalog] = useState<CatalogoAcademia | null>(null);
  const [selectedCourse, setSelectedCourse] =
    useState<CursoDetalhe | null>(null);
  const [activeLesson, setActiveLesson] =
    useState<AulaAcademia | null>(null);
  const [savedMaterials, setSavedMaterials] = useState<MaterialSalvo[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoProgressRef = useRef<Record<number, number>>({});
  const videoProgressSavingRef = useRef<Record<number, boolean>>({});

  const fullName =
    localStorage.getItem("nomeCompleto") ||
    localStorage.getItem("userName") ||
    "Operador";
  const firstName = useMemo(() => {
    const first = fullName.trim().split(/\s+/)[0] || "Operador";
    return (
      first.charAt(0).toLocaleUpperCase("pt-BR") +
      first.slice(1).toLocaleLowerCase("pt-BR")
    );
  }, [fullName]);
  const initials = fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCatalog(await academiaApi.catalogo());
    } catch {
      setError(
        "A área de cursos ainda não está disponível. Os desafios continuam funcionando normalmente.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    void loadCatalog();
  }, [isOpen, loadCatalog]);

  useEffect(() => {
    if (!isOpen || !workspaceRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const entrance = animate(workspaceRef.current, {
      opacity: [0, 1],
      translateY: [14, 0],
      scale: [0.99, 1],
      filter: ["blur(5px)", "blur(0px)"],
      duration: 520,
      ease: "out(4)",
    });
    return () => entrance.revert();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setActiveSection("inicio");
      setSearchTerm("");
      setSelectedCourse(null);
      setActiveLesson(null);
      setError(null);
    }
  }, [isOpen]);

  const courses = catalog?.cursos ?? [];
  const normalizedSearch = searchTerm
    .trim()
    .toLocaleLowerCase("pt-BR");
  const filteredCourses = courses.filter((course) =>
    `${course.titulo} ${course.descricao ?? ""} ${course.nivel}`
      .toLocaleLowerCase("pt-BR")
      .includes(normalizedSearch),
  );

  const selectSection = async (section: AcademySection) => {
    setActiveSection(section);
    setSelectedCourse(null);
    setActiveLesson(null);
    if (section === "materiais") {
      setLoading(true);
      setError(null);
      try {
        setSavedMaterials(await academiaApi.materiaisSalvos());
      } catch {
        setError("Não foi possível carregar seus materiais salvos.");
      } finally {
        setLoading(false);
      }
    }
  };

  const openCourse = async (idCourse: number) => {
    setActionLoading(`course-${idCourse}`);
    setError(null);
    try {
      const course = await academiaApi.curso(idCourse);
      setSelectedCourse(course);
      const lessons = course.modulos.flatMap((module) => module.aulas);
      setActiveLesson(
        lessons.find((lesson) => !lesson.concluida) ?? lessons[0] ?? null,
      );
      setActiveSection("curso");
    } catch {
      setError("Não foi possível abrir este curso.");
    } finally {
      setActionLoading(null);
    }
  };

  const enroll = async () => {
    if (!selectedCourse) return;
    setActionLoading("enroll");
    setError(null);
    try {
      const updated = await academiaApi.matricular(selectedCourse.id);
      setSelectedCourse(updated);
      await loadCatalog();
      setActiveSection("curso");
    } catch {
      setError("Não foi possível realizar sua matrícula.");
    } finally {
      setActionLoading(null);
    }
  };

  /**
   * Aulas avaliativas já chegam aqui com o curso devolvido pela correção do
   * servidor — não há um segundo POST de progresso (o backend recusa).
   */
  const completeLesson = async (
    lesson: AulaAcademia,
    updatedCourse?: CursoDetalhe,
  ) => {
    setActionLoading(`lesson-${lesson.id}`);
    setError(null);
    try {
      const updated =
        updatedCourse ??
        (await academiaApi.salvarProgresso(lesson.id, 100, true));
      setSelectedCourse(updated);
      setActiveLesson(
        updated.modulos
          .flatMap((module) => module.aulas)
          .find((item) => item.id === lesson.id) ?? null,
      );
      await loadCatalog();
      setActiveSection("curso");
    } catch {
      setError("Não foi possível registrar a conclusão desta aula.");
    } finally {
      setActionLoading(null);
    }
  };

  const saveVideoProgress = useCallback(
    async (lesson: AulaAcademia, watchedPercent: number, completed = false) => {
      if (lesson.bloqueada || lesson.concluida) return;
      const percent = completed
        ? 100
        : Math.min(95, Math.max(1, Math.floor(watchedPercent)));
      const lastSaved = Math.max(
        Number(lesson.percentual || 0),
        videoProgressRef.current[lesson.id] || 0,
      );
      if (!completed && percent < lastSaved + 5) return;
      if (!completed && videoProgressSavingRef.current[lesson.id]) return;

      videoProgressRef.current[lesson.id] = percent;
      videoProgressSavingRef.current[lesson.id] = true;
      try {
        const updated = await academiaApi.salvarProgresso(
          lesson.id,
          percent,
          completed,
        );
        setSelectedCourse(updated);
        setActiveLesson(
          updated.modulos
            .flatMap((module) => module.aulas)
            .find((item) => item.id === lesson.id) ?? null,
        );
        if (completed) await loadCatalog();
        setActiveSection("curso");
      } catch {
        videoProgressRef.current[lesson.id] = lastSaved;
        if (completed) {
          setError("Não foi possível registrar a conclusão do vídeo.");
        }
      } finally {
        videoProgressSavingRef.current[lesson.id] = false;
      }
    },
    [loadCatalog],
  );

  const toggleFavorite = async (lesson: AulaAcademia) => {
    setActionLoading(`favorite-${lesson.id}`);
    try {
      await academiaApi.favoritar(lesson.id, !lesson.favorita);
      setSelectedCourse((current) =>
        current
          ? {
              ...current,
              modulos: current.modulos.map((module) => ({
                ...module,
                aulas: module.aulas.map((item) =>
                  item.id === lesson.id
                    ? { ...item, favorita: !item.favorita }
                    : item,
                ),
              })),
            }
          : current,
      );
      setActiveLesson((current) =>
        current?.id === lesson.id
          ? { ...current, favorita: !current.favorita }
          : current,
      );
    } catch {
      setError("Não foi possível atualizar este material.");
    } finally {
      setActionLoading(null);
    }
  };

  const startLesson = async (lesson: AulaAcademia) => {
    if (!selectedCourse?.matriculado) {
      setError("Matricule-se no curso antes de iniciar uma aula.");
      return;
    }

    if (!lesson.concluida && lesson.percentual === 0) {
      try {
        const updated = await academiaApi.salvarProgresso(
          lesson.id,
          10,
          false,
        );
        setSelectedCourse(updated);
      } catch {
        setError("Não foi possível registrar o início desta aula.");
        return;
      }
    }

    if (lesson.tipo === "LINK" && lesson.conteudo_url) {
      window.open(lesson.conteudo_url, "_blank", "noopener,noreferrer");
      setActiveLesson(lesson);
    } else {
      setActiveLesson(lesson);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      data-tour="academia-modal"
      className="fixed inset-0 z-50 bg-[#020711]/95 text-slate-100 backdrop-blur-md"
    >
      <div
        ref={workspaceRef}
        className="academia-workspace flex h-full min-h-0 flex-col overflow-hidden border border-[#233b54]/80 bg-[#030b16]/95"
      >
        <header className="flex min-h-[76px] items-center gap-4 border-b border-[#1d3248] bg-[#040d19]/95 px-4 md:px-6">
          <div className="flex shrink-0 items-center gap-4">
            <img
              src="/images/AcmeLogoBranco.png"
              alt="Grupo Acme"
              className="hidden h-9 w-auto object-contain sm:block"
            />
            <div className="hidden h-10 w-px bg-[#233b54] sm:block" />
            <div>
              <h1 className="text-sm font-semibold tracking-[0.08em] md:text-lg">
                ACADEMIA <span className="text-orange-500">AURORA</span>
              </h1>
              <p className="mt-1 hidden text-[9px] tracking-[0.16em] text-slate-400 md:block">
                DESENVOLVIMENTO E APRENDIZAGEM
              </p>
            </div>
          </div>

          <label className="mx-auto flex h-11 w-full max-w-xl items-center gap-3 rounded-xl border border-[#2b435d] bg-[#071421] px-4 focus-within:border-cyan-500/45">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar cursos, aulas e desafios..."
              className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-slate-500 md:text-sm"
            />
          </label>

          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden h-10 items-center gap-2 rounded-xl border border-orange-500/25 bg-orange-500/5 px-3 text-xs text-orange-300 lg:flex">
              <Flame className="h-4 w-4" />
              Jornada ativa
            </div>
            <button
              className="hidden rounded-xl border border-[#2b435d] p-2.5 text-slate-400 sm:block"
              aria-label="Notificações da Academia"
            >
              <Bell className="h-4 w-4" />
            </button>
            <div className="grid h-10 w-10 place-items-center rounded-full border border-orange-500/70 bg-[#0b1726] text-xs font-semibold text-orange-300">
              {initials || "OP"}
            </div>
            <button
              onClick={onClose}
              className="rounded-xl p-2.5 text-slate-400 transition hover:bg-white/5 hover:text-white"
              aria-label="Fechar Academia"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <aside
            data-tour="academia-nav"
            className="hidden w-56 shrink-0 flex-col border-r border-[#1d3248] bg-[#050f1c] p-3 lg:flex"
          >
            <Navigation
              activeSection={activeSection}
              onSelect={selectSection}
            />
            <div className="mt-auto rounded-xl border border-[#2b435d] bg-[#071421] p-3">
              <div className="flex items-center gap-2 text-[10px] tracking-[0.14em] text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
                AURORA ONLINE
              </div>
              <p className="mt-2 line-clamp-2 text-[10px] text-slate-400">
                Conteúdos para{" "}
                {catalog?.usuario.centro_custo ||
                  localStorage.getItem("centroCusto")?.trim() ||
                  "sua operação"}
                .
              </p>
            </div>
          </aside>

          <main className="min-w-0 flex-1 overflow-y-auto">
            <nav className="sticky top-0 z-20 flex gap-1 overflow-x-auto border-b border-[#1d3248] bg-[#040d19]/95 p-2 backdrop-blur lg:hidden">
              <Navigation
                activeSection={activeSection}
                onSelect={selectSection}
                mobile
              />
            </nav>

            <div className="mx-auto w-full max-w-[1540px] p-4 md:p-6 xl:p-8">
              {error && (
                <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4 text-sm text-amber-100">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                  <span className="flex-1">{error}</span>
                  <button
                    onClick={() => setError(null)}
                    aria-label="Fechar aviso"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {activeSection === "inicio" && (
                <AcademyHome
                  firstName={firstName}
                  courses={filteredCourses}
                  loading={loading}
                  onOpenCourse={openCourse}
                  onExplore={() => void selectSection("trilhas")}
                  onOpenCourses={() => void selectSection("cursos")}
                  onOpenAchievements={() =>
                    void selectSection("conquistas")
                  }
                />
              )}
              {activeSection === "cursos" && (
                <CourseGrid
                  title="Meus cursos"
                  description="Continue exatamente de onde parou."
                  courses={filteredCourses.filter(
                    (course) => course.matriculado,
                  )}
                  loading={loading}
                  emptyText="Você ainda não está matriculado em nenhum curso publicado."
                  onOpen={openCourse}
                  actionLoading={actionLoading}
                />
              )}
              {activeSection === "trilhas" && (
                <CourseGrid
                  title="Catálogo de cursos"
                  description={`Conteúdos publicados para ${
                    catalog?.usuario.centro_custo || "seu Centro de Custo"
                  }.`}
                  courses={filteredCourses}
                  loading={loading}
                  emptyText="Nenhum curso foi publicado para seu Centro de Custo."
                  onOpen={openCourse}
                  actionLoading={actionLoading}
                />
              )}
              {activeSection === "conquistas" && (
                <Achievements courses={filteredCourses} loading={loading} />
              )}
              {activeSection === "materiais" && (
                <SavedMaterials
                  materials={savedMaterials}
                  loading={loading}
                  onOpenCourse={openCourse}
                />
              )}
              {activeSection === "curso" && selectedCourse && (
                <ModernCourseView
                  course={selectedCourse}
                  activeLesson={activeLesson}
                  actionLoading={actionLoading}
                  onBack={() => void selectSection("trilhas")}
                  onEnroll={enroll}
                  onSelectLesson={setActiveLesson}
                  onStartLesson={startLesson}
                  onCompleteLesson={completeLesson}
                  onToggleFavorite={toggleFavorite}
                  onVideoProgress={saveVideoProgress}
                />
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

const Navigation: React.FC<{
  activeSection: AcademySection;
  onSelect: (section: AcademySection) => void | Promise<void>;
  mobile?: boolean;
}> = ({ activeSection, onSelect, mobile = false }) => (
  <>
    {navigation.map((item) => {
      const Icon = item.icon;
      const active = activeSection === item.id;
      return (
        <button
          key={item.id}
          onClick={() => void onSelect(item.id)}
          className={
            mobile
              ? `flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs ${
                  active ? "bg-orange-500 text-white" : "text-slate-400"
                }`
              : `mb-1 flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm transition ${
                  active
                    ? "border-orange-500/20 bg-orange-500/10 text-orange-400"
                    : "border-transparent text-slate-400 hover:bg-white/[0.035] hover:text-slate-200"
                }`
          }
        >
          <Icon className="h-4 w-4" />
          {item.label}
        </button>
      );
    })}
  </>
);

const AcademyHome: React.FC<{
  firstName: string;
  courses: CursoResumo[];
  loading: boolean;
  onOpenCourse: (id: number) => void;
  onExplore: () => void;
  onOpenCourses: () => void;
  onOpenAchievements: () => void;
}> = ({
  firstName,
  courses,
  loading,
  onOpenCourse,
  onExplore,
  onOpenCourses,
  onOpenAchievements,
}) => {
  const [featuredDetail, setFeaturedDetail] =
    useState<CursoDetalhe | null>(null);
  const enrolled = courses.filter(
    (course) =>
      course.matriculado && course.status_matricula !== "CONCLUIDO",
  );
  const completed = courses.filter(
    (course) => course.status_matricula === "CONCLUIDO",
  );
  const featuredCourse = enrolled[0] ?? courses[0] ?? null;
  const featuredCourseId = featuredCourse?.id;
  const shelfCourses = [
    ...enrolled,
    ...courses.filter(
      (course) =>
        !enrolled.some(
          (enrolledCourse) => enrolledCourse.id === course.id,
        ),
    ),
  ].slice(0, 3);

  useEffect(() => {
    let active = true;
    setFeaturedDetail(null);
    if (!featuredCourseId) return () => undefined;
    void academiaApi
      .curso(featuredCourseId)
      .then((detail) => {
        if (active) setFeaturedDetail(detail);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [featuredCourseId]);

  const featuredLessons =
    featuredDetail?.modulos.flatMap((module) =>
      module.aulas.map((lesson) => ({ lesson, module })),
    ) ?? [];
  const nextLesson =
    featuredLessons.find(
      ({ lesson }) => !lesson.concluida && !lesson.bloqueada,
    ) ?? featuredLessons.find(({ lesson }) => !lesson.concluida);
  const estimatedJourneyMinutes = courses.reduce(
    (total, course) =>
      total +
      Math.round(
        course.carga_horaria_min *
          (Math.min(100, Math.max(0, course.progresso)) / 100),
      ),
    0,
  );
  const averageProgress = enrolled.length
    ? Math.round(
        enrolled.reduce((sum, course) => sum + course.progresso, 0) /
          enrolled.length,
      )
    : completed.length
      ? 100
      : 0;
  const remainingMinutes = featuredCourse
    ? Math.max(
        0,
        Math.round(
          featuredCourse.carga_horaria_min *
            (1 - featuredCourse.progresso / 100),
        ),
      )
    : 0;
  const categories = getAcademyCategories(courses);
  const recentItems = [
    ...completed.slice(0, 1).map((course) => ({
      id: `completed-${course.id}`,
      icon: CheckCircle2,
      color: "text-emerald-300",
      title: `Você concluiu ${course.titulo}`,
      caption: "Curso concluído",
      onClick: () => onOpenCourse(course.id),
    })),
    ...enrolled.slice(0, 2).map((course) => ({
      id: `ongoing-${course.id}`,
      icon: Play,
      color: "text-cyan-300",
      title: `Em andamento: ${course.titulo}`,
      caption: `${Math.round(course.progresso)}% da jornada concluída`,
      onClick: () => onOpenCourse(course.id),
    })),
  ].slice(0, 2);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold text-white md:text-3xl">
          Olá, {firstName}.
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Vamos continuar sua jornada de aprendizagem?
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(310px,.75fr)]">
        <FeaturedAcademyCourse
          course={featuredCourse}
          moduleTitle={
            featuredCourse?.matriculado
              ? nextLesson?.module.titulo
              : undefined
          }
          lessonTitle={
            featuredCourse?.matriculado
              ? nextLesson?.lesson.titulo
              : undefined
          }
          remainingMinutes={remainingMinutes}
          loading={loading}
          onOpen={onOpenCourse}
          onExplore={onExplore}
        />
        <AcademyJourneyCard
          progress={averageProgress}
          journeyMinutes={estimatedJourneyMinutes}
          enrolled={enrolled.length}
          completed={completed.length}
          available={courses.length}
          onOpenAchievements={onOpenAchievements}
        />
      </div>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white">
              {enrolled.length ? "Continue aprendendo" : "Cursos para você"}
            </h3>
            <p className="mt-1 text-[10px] text-slate-500">
              {enrolled.length
                ? "Retome sua jornada exatamente de onde parou."
                : "Conteúdos disponíveis para seu Centro de Custo."}
            </p>
          </div>
          <button
            onClick={enrolled.length ? onOpenCourses : onExplore}
            className="flex shrink-0 items-center gap-1 text-[10px] font-semibold text-cyan-300 hover:text-cyan-200"
          >
            Ver todos
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
        {loading ? (
          <LoadingState />
        ) : courses.length === 0 ? (
          <EmptyState
            text="Os primeiros cursos ainda não foram publicados."
            icon={<BookOpen className="h-8 w-8" />}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {shelfCourses.map((course) => (
              <AcademyHomeCourseCard
                key={course.id}
                course={course}
                onOpen={onOpenCourse}
              />
            ))}
            {shelfCourses.length < 3 && (
              <AcademyExploreCard onExplore={onExplore} />
            )}
          </div>
        )}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
        <section className="rounded-2xl border border-[#263e58] bg-[#071421] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-white">
                Explore a Academia
              </h3>
              <p className="mt-1 text-[10px] text-slate-500">
                Encontre conteúdos pelo assunto que você precisa.
              </p>
            </div>
            <button
              onClick={onExplore}
              className="text-[10px] font-semibold text-cyan-300 hover:text-cyan-200"
            >
              ABRIR CATÁLOGO
            </button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {categories.map((category) => {
              const Icon = category.icon;
              return (
                <button
                  key={category.label}
                  onClick={onExplore}
                  className={`group rounded-xl border p-4 text-left transition hover:-translate-y-0.5 ${category.className}`}
                >
                  <div className="flex items-center justify-between">
                    <Icon className="h-6 w-6" />
                    <ChevronRight className="h-4 w-4 opacity-50 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                  </div>
                  <strong className="mt-5 block text-xs text-white">
                    {category.label}
                  </strong>
                  <span className="mt-1 block text-[9px] text-slate-400">
                    {category.count
                      ? `${category.count} curso${category.count > 1 ? "s" : ""}`
                      : "Explorar conteúdos"}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-[#263e58] bg-[#071421] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-white">Sua atividade</h3>
              <p className="mt-1 text-[10px] text-slate-500">
                Movimentos recentes na sua jornada.
              </p>
            </div>
            <Flame className="h-5 w-5 text-orange-300" />
          </div>
          <div className="mt-4 space-y-2">
            {recentItems.length ? (
              recentItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={item.onClick}
                    className="flex w-full items-center gap-3 rounded-xl border border-[#263e58] bg-[#040e1a] p-3 text-left hover:border-cyan-400/25"
                  >
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.035] ${item.color}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="line-clamp-1 block text-[10px] text-slate-200">
                        {item.title}
                      </strong>
                      <span className="mt-1 block text-[9px] text-slate-500">
                        {item.caption}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-600" />
                  </button>
                );
              })
            ) : (
              <div className="grid min-h-28 place-items-center rounded-xl border border-dashed border-[#29445f] px-5 text-center">
                <div>
                  <Star className="mx-auto h-5 w-5 text-violet-300" />
                  <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
                    Comece um curso para construir seu histórico de aprendizagem.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

const FeaturedAcademyCourse: React.FC<{
  course: CursoResumo | null;
  moduleTitle?: string;
  lessonTitle?: string;
  remainingMinutes: number;
  loading: boolean;
  onOpen: (id: number) => void;
  onExplore: () => void;
}> = ({
  course,
  moduleTitle,
  lessonTitle,
  remainingMinutes,
  loading,
  onOpen,
  onExplore,
}) => (
  <section
    className="relative min-h-[310px] overflow-hidden rounded-2xl border border-[#2a4868] bg-[#071421] bg-cover bg-center"
    style={
      course?.capa_url
        ? { backgroundImage: `url("${course.capa_url}")` }
        : undefined
    }
  >
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_35%,rgba(34,211,238,.17),transparent_30%),radial-gradient(circle_at_88%_75%,rgba(249,115,22,.14),transparent_28%),linear-gradient(90deg,#06111f_0%,rgba(6,17,31,.96)_42%,rgba(6,17,31,.35)_100%)]" />
    <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(56,189,248,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(56,189,248,.08)_1px,transparent_1px)] [background-size:34px_34px]" />
    <div className="relative flex min-h-[310px] max-w-2xl flex-col justify-center p-5 md:p-8">
      {loading && !course ? (
        <Loader2 className="h-7 w-7 animate-spin text-orange-400" />
      ) : course ? (
        <>
          <span className="w-fit rounded-full border border-cyan-400/30 bg-[#04111d]/75 px-3 py-1.5 text-[9px] font-semibold tracking-[.1em] text-cyan-300 backdrop-blur">
            {course.matriculado
              ? "CONTINUE DE ONDE PAROU"
              : "DESTAQUE PARA VOCÊ"}
          </span>
          <h3 className="mt-4 text-2xl font-semibold text-white md:text-4xl">
            {course.titulo}
          </h3>
          <p className="mt-2 text-xs text-slate-300 md:text-sm">
            {moduleTitle || course.descricao || "Jornada da Academia Aurora"}
          </p>
          {lessonTitle && (
            <p className="mt-4 text-xs font-medium text-white">
              Próxima aula: {lessonTitle}
            </p>
          )}
          {course.matriculado && (
            <div className="mt-4 max-w-md">
              <div className="flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-orange-500"
                    style={{ width: `${Math.min(100, course.progresso)}%` }}
                  />
                </div>
                <strong className="text-[10px] text-white">
                  {Math.round(course.progresso)}%
                </strong>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[9px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Clock3 className="h-3.5 w-3.5" />
                  {remainingMinutes
                    ? `${formatDuration(remainingMinutes)} restantes`
                    : "Última etapa"}
                </span>
                <span className="flex items-center gap-1.5">
                  <Library className="h-3.5 w-3.5" />
                  {course.total_modulos} módulo(s)
                </span>
              </div>
            </div>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              data-tour="academia-abrir-curso"
              onClick={() => onOpen(course.id)}
              className="flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-xs font-semibold text-white shadow-[0_10px_30px_rgba(249,115,22,.2)] hover:bg-orange-600"
            >
              <Play className="h-4 w-4 fill-current" />
              {course.matriculado ? "CONTINUAR AULA" : "CONHECER CURSO"}
            </button>
            <button
              onClick={() => onOpen(course.id)}
              className="rounded-xl px-4 py-3 text-xs font-semibold text-slate-200 hover:bg-white/5"
            >
              VER CURSO
            </button>
          </div>
        </>
      ) : (
        <>
          <span className="text-[9px] tracking-[.16em] text-cyan-300">
            SUA JORNADA COMEÇA AQUI
          </span>
          <h3 className="mt-3 text-3xl font-semibold text-white">
            Descubra a Academia Aurora
          </h3>
          <p className="mt-2 max-w-lg text-sm text-slate-400">
            Novos cursos aparecerão aqui assim que forem publicados para seu Centro de Custo.
          </p>
          <button
            onClick={onExplore}
            className="mt-5 flex w-fit items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-xs font-semibold text-white"
          >
            <Library className="h-4 w-4" />
            EXPLORAR CATÁLOGO
          </button>
        </>
      )}
    </div>
  </section>
);

const AcademyJourneyCard: React.FC<{
  progress: number;
  journeyMinutes: number;
  enrolled: number;
  completed: number;
  available: number;
  onOpenAchievements: () => void;
}> = ({
  progress,
  journeyMinutes,
  enrolled,
  completed,
  available,
  onOpenAchievements,
}) => (
  <aside className="rounded-2xl border border-[#263e58] bg-[#071421] p-5">
    <div className="flex items-center justify-between gap-3">
      <div>
        <h3 className="font-semibold text-white">Minha jornada</h3>
        <p className="mt-1 text-[10px] text-slate-500">
          Seu panorama na Academia.
        </p>
      </div>
      <GraduationCap className="h-5 w-5 text-cyan-300" />
    </div>
    <div className="mt-5 flex items-center gap-5">
      <div
        className="grid h-28 w-28 shrink-0 place-items-center rounded-full p-[7px]"
        style={{
          background: `conic-gradient(#35d8ff ${progress * 3.6}deg, #13263a 0deg)`,
        }}
      >
        <div className="grid h-full w-full place-items-center rounded-full bg-[#071421] text-center">
          <div>
            <strong className="text-2xl text-white">{progress}%</strong>
            <span className="mt-1 block text-[8px] text-slate-500">
              progresso médio
            </span>
          </div>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <JourneyStat
          icon={<Clock3 className="h-4 w-4" />}
          value={journeyMinutes ? formatDuration(journeyMinutes) : "0 min"}
          label="carga percorrida"
        />
        <JourneyStat
          icon={<BookOpen className="h-4 w-4" />}
          value={String(enrolled)}
          label="em andamento"
        />
        <JourneyStat
          icon={<CheckCircle2 className="h-4 w-4" />}
          value={String(completed)}
          label="concluídos"
        />
      </div>
    </div>
    <div className="mt-5 rounded-xl border border-[#263e58] bg-[#040e1a] p-3">
      <div className="flex items-center justify-between text-[9px] text-slate-400">
        <span>Catálogo disponível</span>
        <strong className="text-cyan-300">{available} curso(s)</strong>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#14283c]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-400"
          style={{
            width: `${available ? Math.min(100, ((enrolled + completed) / available) * 100) : 0}%`,
          }}
        />
      </div>
    </div>
    <button
      onClick={onOpenAchievements}
      className="mt-4 flex w-full items-center gap-3 rounded-xl border border-violet-400/25 bg-violet-400/[0.07] p-3 text-left text-violet-200 hover:bg-violet-400/10"
    >
      <Trophy className="h-5 w-5" />
      <span className="flex-1 text-[10px] font-semibold">
        VER MINHAS CONQUISTAS
      </span>
      <ChevronRight className="h-4 w-4" />
    </button>
  </aside>
);

const JourneyStat: React.FC<{
  icon: React.ReactNode;
  value: string;
  label: string;
}> = ({ icon, value, label }) => (
  <div className="flex items-center gap-2.5">
    <span className="text-cyan-300">{icon}</span>
    <div className="min-w-0">
      <strong className="block text-xs text-white">{value}</strong>
      <span className="block text-[8px] text-slate-500">{label}</span>
    </div>
  </div>
);

const AcademyHomeCourseCard: React.FC<{
  course: CursoResumo;
  onOpen: (id: number) => void;
}> = ({ course, onOpen }) => (
  <article className="group overflow-hidden rounded-2xl border border-[#263e58] bg-[#071421] transition hover:-translate-y-0.5 hover:border-cyan-400/30">
    <button
      data-tour="academia-abrir-curso"
      onClick={() => onOpen(course.id)}
      className="block w-full text-left"
    >
      <div
        className="relative aspect-[16/7] bg-gradient-to-br from-[#12385e] via-[#0a2038] to-[#07111f] bg-cover bg-center"
        style={
          course.capa_url
            ? { backgroundImage: `url("${course.capa_url}")` }
            : undefined
        }
      >
        <div className="absolute inset-0 bg-gradient-to-t from-[#071421] via-transparent to-black/10" />
        <span className="absolute left-3 top-3 rounded-lg border border-white/10 bg-black/40 px-2.5 py-1 text-[8px] font-semibold tracking-[.08em] text-cyan-100 backdrop-blur">
          {course.status_matricula === "CONCLUIDO"
            ? "CONCLUÍDO"
            : course.matriculado
              ? course.nivel
              : "DISPONÍVEL"}
        </span>
        <span className="absolute right-3 top-3 rounded-lg border border-white/10 bg-black/45 px-2.5 py-1 text-[9px] font-semibold text-white backdrop-blur">
          {Math.round(course.progresso)}%
        </span>
      </div>
      <div className="p-4">
        <h4 className="line-clamp-1 font-semibold text-white">
          {course.titulo}
        </h4>
        <p className="mt-1 line-clamp-1 text-[10px] text-slate-400">
          {course.descricao || "Curso da Academia Aurora"}
        </p>
        <div className="mt-3 flex items-center gap-4 text-[9px] text-slate-500">
          <span className="flex items-center gap-1">
            <Library className="h-3.5 w-3.5" />
            {course.total_modulos} módulo(s)
          </span>
          <span className="flex items-center gap-1">
            <Clock3 className="h-3.5 w-3.5" />
            {formatDuration(course.carga_horaria_min)}
          </span>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#13263a]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-orange-500"
            style={{ width: `${Math.min(100, course.progresso)}%` }}
          />
        </div>
        <div className="mt-4 flex items-center justify-between text-[10px] font-semibold text-cyan-300">
          <span>
            {course.status_matricula === "CONCLUIDO"
              ? "REVER CURSO"
              : course.matriculado
                ? "CONTINUAR"
                : "COMEÇAR"}
          </span>
          <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </div>
      </div>
    </button>
  </article>
);

const AcademyExploreCard: React.FC<{ onExplore: () => void }> = ({
  onExplore,
}) => (
  <button
    onClick={onExplore}
    className="group grid min-h-64 place-items-center rounded-2xl border border-dashed border-[#31506c] bg-[radial-gradient(circle_at_center,rgba(34,211,238,.08),transparent_65%)] p-6 text-center hover:border-cyan-400/40"
  >
    <div>
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-cyan-400/25 bg-cyan-400/[0.07] text-cyan-300">
        <Library className="h-6 w-6" />
      </span>
      <strong className="mt-4 block text-sm text-white">
        Descubra novos conteúdos
      </strong>
      <span className="mt-2 block text-[10px] leading-relaxed text-slate-400">
        Explore todos os cursos disponíveis para sua área.
      </span>
      <span className="mt-4 inline-flex items-center gap-1 text-[10px] font-semibold text-cyan-300">
        ABRIR CATÁLOGO
        <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
      </span>
    </div>
  </button>
);

const getAcademyCategories = (courses: CursoResumo[]) => {
  const definitions = [
    {
      label: "Cobrança",
      terms: ["cobran", "negocia", "acordo"],
      icon: GraduationCap,
      className:
        "border-cyan-400/25 bg-cyan-400/[0.06] text-cyan-300 hover:border-cyan-400/45",
    },
    {
      label: "Atendimento",
      terms: ["atendimento", "cliente", "comunica"],
      icon: Bell,
      className:
        "border-orange-400/25 bg-orange-400/[0.06] text-orange-300 hover:border-orange-400/45",
    },
    {
      label: "Processos",
      terms: ["processo", "política", "procedimento"],
      icon: Target,
      className:
        "border-blue-400/25 bg-blue-400/[0.06] text-blue-300 hover:border-blue-400/45",
    },
    {
      label: "Segurança",
      terms: ["segurança", "informação", "dados", "lgpd"],
      icon: Lock,
      className:
        "border-violet-400/25 bg-violet-400/[0.06] text-violet-300 hover:border-violet-400/45",
    },
  ];
  return definitions.map((definition) => ({
    ...definition,
    count: courses.filter((course) => {
      const content = `${course.titulo} ${course.descricao || ""}`
        .toLocaleLowerCase("pt-BR");
      return definition.terms.some((term) => content.includes(term));
    }).length,
  }));
};

const CourseGrid: React.FC<{
  title: string;
  description: string;
  courses: CursoResumo[];
  loading: boolean;
  emptyText: string;
  onOpen: (id: number) => void;
  actionLoading?: string | null;
  compact?: boolean;
}> = ({
  title,
  description,
  courses,
  loading,
  emptyText,
  onOpen,
  actionLoading,
  compact = false,
}) => (
  <section>
    <div className="mb-4">
      <h2 className={compact ? "text-lg font-semibold" : "text-2xl font-semibold"}>
        {title}
      </h2>
      <p className="mt-1 text-xs text-slate-400">{description}</p>
    </div>
    {loading ? (
      <LoadingState />
    ) : courses.length === 0 ? (
      <EmptyState text={emptyText} icon={<BookOpen className="h-8 w-8" />} />
    ) : (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {courses.map((course) => (
          <CourseCard
            key={course.id}
            course={course}
            onOpen={onOpen}
            loading={actionLoading === `course-${course.id}`}
          />
        ))}
      </div>
    )}
  </section>
);

const CourseCard: React.FC<{
  course: CursoResumo;
  onOpen: (id: number) => void;
  loading?: boolean;
}> = ({ course, onOpen, loading }) => (
  <article className="group overflow-hidden rounded-2xl border border-[#263e58] bg-[#071421] transition hover:-translate-y-0.5 hover:border-orange-500/35">
    <div
      className="relative h-32 bg-gradient-to-br from-[#12385e] via-[#0a2038] to-[#07111f] bg-cover bg-center"
      style={
        course.capa_url
          ? { backgroundImage: `url("${course.capa_url}")` }
          : undefined
      }
    >
      <div className="absolute inset-0 bg-gradient-to-t from-[#071421] to-transparent" />
      <div className="absolute left-4 top-4 rounded-lg border border-white/10 bg-black/30 px-2.5 py-1 text-[9px] tracking-[0.12em] text-cyan-200 backdrop-blur">
        {course.nivel}
      </div>
      {course.matriculado && (
        <div className="absolute right-4 top-4 rounded-lg bg-orange-500 px-2.5 py-1 text-[9px] font-semibold">
          {Math.round(course.progresso)}%
        </div>
      )}
    </div>
    <div className="p-4">
      <h3 className="line-clamp-1 font-semibold">{course.titulo}</h3>
      <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-relaxed text-slate-400">
        {course.descricao || "Curso da Academia Aurora."}
      </p>
      {course.situacao_prazo && course.situacao_prazo !== "CONCLUIDO" && (
        <div className="mt-3">
          <PrazoBadge
            situacao={course.situacao_prazo}
            dataLimite={course.data_limite}
            obrigatoria={course.obrigatoria}
          />
        </div>
      )}
      <div className="mt-4 flex items-center gap-4 text-[10px] text-slate-400">
        <span className="flex items-center gap-1">
          <Library className="h-3 w-3" />
          {course.total_modulos} módulos
        </span>
        <span className="flex items-center gap-1">
          <Clock3 className="h-3 w-3" />
          {formatDuration(course.carga_horaria_min)}
        </span>
      </div>
      {course.matriculado && (
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#13263a]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-orange-500 to-cyan-400"
            style={{ width: `${Math.min(100, course.progresso)}%` }}
          />
        </div>
      )}
      <button
        onClick={() => onOpen(course.id)}
        disabled={loading}
        className="mt-4 flex w-full items-center justify-between rounded-xl border border-[#324d69] px-4 py-3 text-xs font-semibold text-slate-200 hover:border-orange-500/45 hover:text-orange-300 disabled:opacity-60"
      >
        {course.matriculado ? "CONTINUAR" : "CONHECER CURSO"}
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </button>
    </div>
  </article>
);

const getYouTubeVideoId = (url?: string | null) => {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtube.com")) {
      return (
        parsed.searchParams.get("v") ||
        parsed.pathname.split("/").filter(Boolean).pop() ||
        null
      );
    }
    if (parsed.hostname === "youtu.be") {
      return parsed.pathname.split("/").filter(Boolean)[0] || null;
    }
  } catch {
    return null;
  }
  return null;
};

const toVideoEmbedUrl = (url?: string | null) => {
  if (!url) return null;
  const youtubeId = getYouTubeVideoId(url);
  if (youtubeId) return `https://www.youtube.com/embed/${youtubeId}`;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("vimeo.com")) {
      const videoId = parsed.pathname.split("/").filter(Boolean).pop();
      return videoId ? `https://player.vimeo.com/video/${videoId}` : url;
    }
  } catch {
    return url;
  }
  return url;
};

const ModernCourseView: React.FC<{
  course: CursoDetalhe;
  activeLesson: AulaAcademia | null;
  actionLoading: string | null;
  onBack: () => void;
  onEnroll: () => void;
  onSelectLesson: (lesson: AulaAcademia | null) => void;
  onStartLesson: (lesson: AulaAcademia) => void;
  onCompleteLesson: (
    lesson: AulaAcademia,
    updatedCourse?: CursoDetalhe,
  ) => void;
  onToggleFavorite: (lesson: AulaAcademia) => void;
  onVideoProgress: (
    lesson: AulaAcademia,
    watchedPercent: number,
    completed?: boolean,
  ) => void;
}> = ({
  course,
  activeLesson,
  actionLoading,
  onBack,
  onEnroll,
  onSelectLesson,
  onStartLesson,
  onCompleteLesson,
  onToggleFavorite,
  onVideoProgress,
}) => {
  const lessons = course.modulos.flatMap((module) => module.aulas);
  const lesson =
    activeLesson ??
    lessons.find((item) => !item.concluida) ??
    lessons[0] ??
    null;
  const currentIndex = lesson
    ? lessons.findIndex((item) => item.id === lesson.id)
    : -1;
  const nextLesson =
    currentIndex >= 0 ? lessons[currentIndex + 1] ?? null : lessons[0] ?? null;

  return (
    <section>
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex min-w-0 items-center gap-2 self-start text-xs text-slate-400 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          <span>Meus cursos</span>
          <span className="text-slate-600">/</span>
          <span className="max-w-52 truncate text-slate-200">{course.titulo}</span>
          {lesson && (
            <>
              <span className="hidden text-slate-600 md:inline">/</span>
              <strong className="hidden max-w-52 truncate text-white md:block">
                {lesson.titulo}
              </strong>
            </>
          )}
        </button>
        <div className="flex min-w-0 items-center gap-3 xl:w-[410px]">
          <span className="shrink-0 text-xs font-semibold text-cyan-300">
            {course.aulas_concluidas} de {course.total_aulas} aulas
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#183048]">
            <div
              className="h-full rounded-full bg-cyan-400 transition-all"
              style={{ width: `${Math.min(100, course.progresso)}%` }}
            />
          </div>
        </div>
      </div>

      {course.modulos.length === 0 ? (
        <EmptyState
          text="Este curso ainda não possui módulos publicados."
          icon={<Library className="h-8 w-8" />}
        />
      ) : (
        <div className="grid items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_410px]">
          <ModernLessonWorkspace
            course={course}
            lesson={lesson}
            nextLesson={nextLesson}
            actionLoading={actionLoading}
            onEnroll={onEnroll}
            onStart={onStartLesson}
            onComplete={onCompleteLesson}
            onToggleFavorite={onToggleFavorite}
            onSelectLesson={onSelectLesson}
            onVideoProgress={onVideoProgress}
          />
          <ModernCurriculum
            course={course}
            activeLessonId={lesson?.id}
            onSelect={onSelectLesson}
          />
        </div>
      )}
    </section>
  );
};

const ModernCurriculum: React.FC<{
  course: CursoDetalhe;
  activeLessonId?: number;
  onSelect: (lesson: AulaAcademia) => void;
}> = ({ course, activeLessonId, onSelect }) => (
  <aside
    data-tour="academia-curriculo"
    className="overflow-hidden rounded-2xl border border-[#29445f] bg-[#06111e] 2xl:sticky 2xl:top-4"
  >
    <div className="flex items-center justify-between border-b border-[#20374e] px-5 py-5">
      <div>
        <h3 className="font-semibold text-white">Conteúdo do curso</h3>
        <p className="mt-1 text-[10px] text-slate-500">
          {course.total_aulas} aulas · {formatDuration(course.carga_horaria_min)}
        </p>
      </div>
      <Library className="h-5 w-5 text-cyan-300" />
    </div>
    <div className="max-h-[710px] overflow-y-auto">
      {course.modulos.map((module, moduleIndex) => {
        const completeCount = module.aulas.filter(
          (item) => item.concluida,
        ).length;
        const progress = module.aulas.length
          ? Math.round((completeCount * 100) / module.aulas.length)
          : 0;
        const containsActive = module.aulas.some(
          (item) => item.id === activeLessonId,
        );
        return (
          <details
            key={module.id}
            open={containsActive || moduleIndex === 0}
            className="group border-b border-[#20374e] last:border-b-0"
          >
            <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-5">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-500/10 text-sm font-bold text-orange-400">
                {String(moduleIndex + 1).padStart(2, "0")}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="truncate text-sm font-semibold text-white">
                    {module.titulo}
                  </h4>
                  <span className="text-xs font-semibold text-cyan-300">
                    {progress}%
                  </span>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#193047]">
                  <div
                    className="h-full rounded-full bg-cyan-400"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-500 transition group-open:rotate-180" />
            </summary>
            <div className="space-y-1 px-3 pb-4">
              {module.aulas.map((item) => {
                const Icon = lessonIcons[item.tipo];
                const active = item.id === activeLessonId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelect(item)}
                    disabled={item.bloqueada}
                    title={item.mensagem_bloqueio || undefined}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3.5 text-left transition ${
                      active
                        ? "border-orange-500/45 bg-gradient-to-r from-orange-500/[0.12] to-transparent shadow-[inset_3px_0_0_#f97316]"
                        : item.bloqueada
                          ? "cursor-not-allowed border-transparent opacity-45"
                        : "border-transparent hover:border-[#2a455f] hover:bg-white/[0.025]"
                    }`}
                  >
                    <div
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                        item.concluida
                          ? "bg-emerald-400/10 text-emerald-300"
                          : active
                            ? "bg-orange-500 text-white"
                            : "bg-[#10243a] text-cyan-300"
                      }`}
                    >
                      {item.concluida ? (
                        <Check className="h-4 w-4" />
                      ) : item.bloqueada ? (
                        <Lock className="h-4 w-4" />
                      ) : (
                        <Icon className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-medium text-slate-100">
                        {item.titulo}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-500">
                        {item.tipo === "QUIZ" ? "Quiz" : item.tipo} ·{" "}
                        {formatDuration(item.duracao_min)}
                      </p>
                    </div>
                    {item.concluida ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                    ) : item.bloqueada ? (
                      <Lock className="h-4 w-4 shrink-0 text-slate-500" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </details>
        );
      })}
    </div>
  </aside>
);

const ModernLessonWorkspace: React.FC<{
  course: CursoDetalhe;
  lesson: AulaAcademia | null;
  nextLesson: AulaAcademia | null;
  actionLoading: string | null;
  onEnroll: () => void;
  onStart: (lesson: AulaAcademia) => void;
  onComplete: (lesson: AulaAcademia, updatedCourse?: CursoDetalhe) => void;
  onToggleFavorite: (lesson: AulaAcademia) => void;
  onSelectLesson: (lesson: AulaAcademia) => void;
  onVideoProgress: (
    lesson: AulaAcademia,
    watchedPercent: number,
    completed?: boolean,
  ) => void;
}> = ({
  course,
  lesson,
  nextLesson,
  actionLoading,
  onEnroll,
  onStart,
  onComplete,
  onToggleFavorite,
  onSelectLesson,
  onVideoProgress,
}) => {
  const [activeTab, setActiveTab] = useState<
    "overview" | "materials" | "notes"
  >("overview");
  const [note, setNote] = useState("");
  const [noteReady, setNoteReady] = useState(false);
  const [noteStatus, setNoteStatus] = useState<
    "idle" | "loading" | "saving" | "saved" | "error"
  >("idle");
  const lastSavedNoteRef = useRef("");
  const noteLessonId = lesson?.id;
  const noteAvailable = Boolean(
    noteLessonId && course.matriculado && !lesson?.bloqueada,
  );

  useEffect(() => setActiveTab("overview"), [lesson?.id]);

  useEffect(() => {
    let active = true;
    setNote("");
    setNoteReady(false);
    lastSavedNoteRef.current = "";
    if (!noteLessonId || !noteAvailable) {
      setNoteStatus("idle");
      return () => {
        active = false;
      };
    }

    setNoteStatus("loading");
    void academiaApi
      .obterAnotacao(noteLessonId)
      .then((result) => {
        if (!active) return;
        const content = result.conteudo || "";
        setNote(content);
        lastSavedNoteRef.current = content;
        setNoteReady(true);
        setNoteStatus("idle");
      })
      .catch(() => {
        if (!active) return;
        setNoteReady(false);
        setNoteStatus("error");
      });
    return () => {
      active = false;
    };
  }, [noteAvailable, noteLessonId]);

  useEffect(() => {
    if (!noteLessonId || !noteReady || note === lastSavedNoteRef.current) return;
    setNoteStatus("saving");
    const timer = window.setTimeout(() => {
      void academiaApi
        .salvarAnotacao(noteLessonId, note)
        .then((result) => {
          const savedContent = result.conteudo || "";
          lastSavedNoteRef.current = savedContent;
          setNoteStatus("saved");
        })
        .catch(() => setNoteStatus("error"));
    }, 700);
    return () => window.clearTimeout(timer);
  }, [note, noteLessonId, noteReady]);

  if (!lesson) {
    return (
      <EmptyState
        text="Selecione uma aula para iniciar."
        icon={<BookOpen className="h-8 w-8" />}
      />
    );
  }

  const Icon = lessonIcons[lesson.tipo];
  return (
    <div data-tour="academia-player" className="min-w-0">
      <ModernLessonContent
        lesson={lesson}
        enrolled={course.matriculado}
        actionLoading={actionLoading}
        onEnroll={onEnroll}
        onStart={onStart}
        onComplete={onComplete}
        onVideoProgress={onVideoProgress}
      />

      <div className="mt-5 flex flex-col gap-4 border-b border-[#263f58] pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.15em] text-cyan-300">
            <Icon className="h-3.5 w-3.5" />
            {lesson.tipo} · {formatDuration(lesson.duracao_min)}
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white md:text-3xl">
            {lesson.titulo}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">
            {lesson.descricao ||
              "Conteúdo de aprendizagem da Academia Aurora."}
          </p>
        </div>
        {course.matriculado && (
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:w-[300px] lg:flex-col">
            {lesson.tipo !== "QUIZ" && !lesson.concluida && (
              <button
                type="button"
                onClick={() => onComplete(lesson)}
                disabled={actionLoading === `lesson-${lesson.id}`}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-xs font-semibold text-white shadow-[0_10px_30px_rgba(249,115,22,.18)] hover:bg-orange-600 disabled:opacity-60"
              >
                {actionLoading === `lesson-${lesson.id}` ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                CONCLUIR AULA
              </button>
            )}
            {lesson.concluida && (
              <div className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.06] px-5 py-3 text-xs font-semibold text-emerald-300">
                <CheckCircle2 className="h-4 w-4" /> Aula concluída
              </div>
            )}
            <button
              type="button"
              onClick={() => onToggleFavorite(lesson)}
              disabled={actionLoading === `favorite-${lesson.id}`}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-5 py-3 text-xs font-semibold ${
                lesson.favorita
                  ? "border-amber-400/30 bg-amber-400/[0.06] text-amber-300"
                  : "border-[#36536d] text-slate-300 hover:border-cyan-400/35 hover:text-cyan-200"
              }`}
            >
              <Star
                className={`h-4 w-4 ${lesson.favorita ? "fill-current" : ""}`}
              />
              {lesson.favorita ? "MATERIAL SALVO" : "SALVAR MATERIAL"}
            </button>
          </div>
        )}
      </div>

      <div className="mt-5 flex gap-6 overflow-x-auto border-b border-[#263f58]">
        {[
          ["overview", "Visão geral"],
          ["materials", "Materiais"],
          ["notes", "Anotações"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id as typeof activeTab)}
            className={`shrink-0 border-b-2 px-1 pb-3 text-sm transition ${
              activeTab === id
                ? "border-orange-500 text-orange-400"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="py-6">
        {activeTab === "overview" && <ModernLessonOverview />}
        {activeTab === "materials" && (
          <div className="rounded-2xl border border-[#29445f] bg-[#071421] p-5">
            <h3 className="font-semibold text-white">Materiais desta aula</h3>
            <p className="mt-2 text-sm text-slate-400">
              Salve a aula para encontrá-la rapidamente na sua biblioteca.
            </p>
            {lesson.conteudo_url && (
              <a
                href={lesson.conteudo_url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 flex items-center justify-between rounded-xl border border-[#31506c] bg-[#05101d] p-4 text-sm text-cyan-300 hover:border-cyan-400/40"
              >
                <span className="flex items-center gap-3">
                  <FileText className="h-5 w-5" /> Abrir material da aula
                </span>
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
        )}
        {activeTab === "notes" && (
          <div className="rounded-2xl border border-[#29445f] bg-[#071421] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-white">Suas anotações</h3>
                <p className="mt-2 text-sm text-slate-400">
                  Registre os pontos mais importantes enquanto acompanha a aula.
                </p>
              </div>
              <span className={`flex items-center gap-2 text-[10px] font-medium ${noteStatus === "error" ? "text-rose-300" : noteStatus === "saved" ? "text-emerald-300" : "text-slate-500"}`}>
                {(noteStatus === "loading" || noteStatus === "saving") && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {noteStatus === "loading" && "Carregando..."}
                {noteStatus === "saving" && "Salvando..."}
                {noteStatus === "saved" && <><Check className="h-3.5 w-3.5" /> Salvo na Academia</>}
                {noteStatus === "error" && <><AlertCircle className="h-3.5 w-3.5" /> Não foi possível salvar</>}
              </span>
            </div>
            <textarea
              aria-label="Anotações da aula"
              placeholder="Escreva suas anotações..."
              value={note}
              onChange={(event) => setNote(event.target.value)}
              disabled={!noteReady}
              maxLength={10000}
              className="mt-4 min-h-32 w-full resize-y rounded-xl border border-[#2d4b66] bg-[#040e1a] p-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/45"
            />
            <div className="mt-2 flex justify-end text-[10px] text-slate-600">
              {note.length.toLocaleString("pt-BR")} / 10.000
            </div>
          </div>
        )}
      </div>

      {nextLesson && (
        <div className="flex flex-col gap-4 rounded-2xl border border-[#29445f] bg-gradient-to-r from-[#081827] to-[#07121f] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[9px] font-semibold tracking-[0.16em] text-cyan-300">
              A SEGUIR
            </p>
            <p className="mt-1 font-semibold text-white">{nextLesson.titulo}</p>
            <p className="mt-1 text-[10px] text-slate-500">
              {nextLesson.tipo} · {formatDuration(nextLesson.duracao_min)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onSelectLesson(nextLesson)}
            disabled={nextLesson.bloqueada}
            className="flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3 text-xs font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-[#1a2c3f] disabled:text-slate-500"
          >
            {nextLesson.bloqueada ? (
              <><Lock className="h-4 w-4" /> CONCLUA A AULA ATUAL</>
            ) : (
              <>CONTINUAR <ArrowRight className="h-4 w-4" /></>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

const ModernLessonContent: React.FC<{
  lesson: AulaAcademia;
  enrolled: boolean;
  actionLoading: string | null;
  onEnroll: () => void;
  onStart: (lesson: AulaAcademia) => void;
  onComplete: (lesson: AulaAcademia, updatedCourse?: CursoDetalhe) => void;
  onVideoProgress: (
    lesson: AulaAcademia,
    watchedPercent: number,
    completed?: boolean,
  ) => void;
}> = ({
  lesson,
  enrolled,
  actionLoading,
  onEnroll,
  onStart,
  onComplete,
  onVideoProgress,
}) => {
  if (!enrolled || lesson.bloqueada) {
    return (
      <div className="grid aspect-video min-h-80 place-items-center overflow-hidden rounded-2xl border border-[#2d4a66] bg-[radial-gradient(circle_at_50%_20%,rgba(34,211,238,.12),transparent_42%),linear-gradient(135deg,#0b2341,#040c17)] p-8 text-center">
        <div>
          <Lock className="mx-auto h-10 w-10 text-orange-300" />
          <h3 className="mt-4 text-xl font-semibold text-white">
            {enrolled
              ? "Esta aula ainda está bloqueada"
              : "Matricule-se para acessar esta aula"}
          </h3>
          <p className="mt-2 text-sm text-slate-400">
            {enrolled
              ? lesson.mensagem_bloqueio ||
                "Conclua a etapa anterior para continuar."
              : "Seu progresso ficará salvo automaticamente na Academia."}
          </p>
          {!enrolled && (
            <button
              type="button"
              onClick={onEnroll}
              disabled={actionLoading === "enroll"}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-3 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
            >
              {actionLoading === "enroll" && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              MATRICULAR-SE
            </button>
          )}
        </div>
      </div>
    );
  }

  if (lesson.tipo === "QUIZ") {
    return (
      <div className="min-h-[430px] rounded-2xl border border-[#2d4a66] bg-[radial-gradient(circle_at_50%_0%,rgba(139,92,246,.11),transparent_42%),#050f1c] p-5 md:p-8">
        <QuizLessonActivity
          key={lesson.id}
          lesson={lesson}
          actionLoading={actionLoading}
          onComplete={onComplete}
        />
      </div>
    );
  }

  if (lesson.tipo === "TEXTO") {
    return (
      <article className="min-h-[430px] overflow-y-auto rounded-2xl border border-[#2d4a66] bg-[#071421] p-6 md:p-10">
        <p className="text-[10px] font-semibold tracking-[.15em] text-cyan-300">
          LEITURA GUIADA
        </p>
        <h3 className="mt-3 text-2xl font-semibold text-white">
          {lesson.titulo}
        </h3>
        <div className="mt-6 whitespace-pre-wrap text-sm leading-7 text-slate-300">
          {lesson.conteudo_texto ||
            "O conteúdo desta aula será disponibilizado em breve."}
        </div>
      </article>
    );
  }

  if (lesson.tipo === "PDF" && lesson.conteudo_url) {
    return (
      <div className="overflow-hidden rounded-2xl border border-[#2d4a66] bg-[#071421]">
        <div className="flex items-center justify-between border-b border-[#29445f] px-4 py-3 text-xs text-slate-400">
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-cyan-300" /> Visualizador de
            material
          </span>
          <a
            href={lesson.conteudo_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-cyan-300 hover:text-cyan-200"
          >
            Abrir em nova guia <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
        <iframe
          src={lesson.conteudo_url}
          title={lesson.titulo}
          className="h-[560px] w-full bg-white"
        />
      </div>
    );
  }

  if (lesson.tipo === "VIDEO" && lesson.conteudo_url) {
    const source = lesson.conteudo_url;
    const directVideo = /\.(mp4|webm|ogg)(\?.*)?$/i.test(source);
    const youtubeId = getYouTubeVideoId(source);
    return (
      <div className="aspect-video overflow-hidden rounded-2xl border border-[#2d4a66] bg-black shadow-[0_18px_60px_rgba(0,0,0,.28)]">
        {youtubeId ? (
          <YouTubeTrackedPlayer
            videoId={youtubeId}
            lesson={lesson}
            onProgress={onVideoProgress}
          />
        ) : directVideo ? (
          <video
            src={source}
            controls
            className="h-full w-full"
            onPlay={() => onStart(lesson)}
            onTimeUpdate={(event) => {
              const video = event.currentTarget;
              if (!Number.isFinite(video.duration) || video.duration <= 0) return;
              onVideoProgress(
                lesson,
                (video.currentTime * 100) / video.duration,
              );
            }}
            onEnded={() => onVideoProgress(lesson, 100, true)}
          />
        ) : (
          <iframe
            src={toVideoEmbedUrl(source) ?? source}
            title={lesson.titulo}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        )}
      </div>
    );
  }

  return (
    <div className="relative grid aspect-video min-h-80 place-items-center overflow-hidden rounded-2xl border border-[#2d4a66] bg-[radial-gradient(circle_at_72%_28%,rgba(34,211,238,.18),transparent_26%),radial-gradient(circle_at_35%_75%,rgba(249,115,22,.12),transparent_30%),linear-gradient(135deg,#0b2440,#040b15)] p-8 text-center">
      <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(56,189,248,.16)_1px,transparent_1px),linear-gradient(90deg,rgba(56,189,248,.16)_1px,transparent_1px)] [background-size:44px_44px]" />
      <div className="relative">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-orange-300/40 bg-orange-500 text-white shadow-[0_0_45px_rgba(249,115,22,.28)]">
          <Play className="ml-1 h-8 w-8 fill-current" />
        </div>
        <h3 className="mt-6 text-2xl font-semibold text-white">
          {lesson.titulo}
        </h3>
        <p className="mt-2 text-sm text-slate-400">
          Conteúdo da Academia Aurora
        </p>
        <button
          type="button"
          onClick={() => onStart(lesson)}
          className="mt-5 inline-flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/[0.07] px-5 py-3 text-xs font-semibold text-cyan-200 hover:bg-cyan-400/10"
        >
          {lesson.conteudo_url ? (
            <ExternalLink className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          ACESSAR CONTEÚDO
        </button>
      </div>
    </div>
  );
};

interface YouTubePlayerInstance {
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
}

interface YouTubeApi {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      playerVars: Record<string, number>;
      events: {
        onStateChange: (event: {
          data: number;
          target: YouTubePlayerInstance;
        }) => void;
      };
    },
  ) => YouTubePlayerInstance;
}

type YouTubeWindow = Window &
  typeof globalThis & {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  };

let youtubeApiPromise: Promise<YouTubeApi> | null = null;

const loadYouTubeApi = () => {
  const youtubeWindow = window as YouTubeWindow;
  if (youtubeWindow.YT?.Player) return Promise.resolve(youtubeWindow.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise<YouTubeApi>((resolve) => {
    const previousReady = youtubeWindow.onYouTubeIframeAPIReady;
    youtubeWindow.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      if (youtubeWindow.YT) resolve(youtubeWindow.YT);
    };
    if (!document.getElementById("academia-youtube-api")) {
      const script = document.createElement("script");
      script.id = "academia-youtube-api";
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.head.appendChild(script);
    }
  });
  return youtubeApiPromise;
};

const YouTubeTrackedPlayer: React.FC<{
  videoId: string;
  lesson: AulaAcademia;
  onProgress: (
    lesson: AulaAcademia,
    watchedPercent: number,
    completed?: boolean,
  ) => void;
}> = ({ videoId, lesson, onProgress }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const lessonRef = useRef(lesson);
  lessonRef.current = lesson;

  useEffect(() => {
    let disposed = false;
    let intervalId: number | null = null;
    let player: YouTubePlayerInstance | null = null;

    const stopTracking = () => {
      if (intervalId !== null) window.clearInterval(intervalId);
      intervalId = null;
    };
    const track = (target: YouTubePlayerInstance) => {
      const duration = target.getDuration();
      if (!Number.isFinite(duration) || duration <= 0) return;
      onProgress(
        lessonRef.current,
        (target.getCurrentTime() * 100) / duration,
      );
    };

    void loadYouTubeApi().then((youtube) => {
      if (disposed || !containerRef.current) return;
      player = new youtube.Player(containerRef.current, {
        videoId,
        playerVars: {
          controls: 1,
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onStateChange: (event) => {
            if (event.data === 1) {
              stopTracking();
              track(event.target);
              intervalId = window.setInterval(
                () => track(event.target),
                5000,
              );
            } else {
              stopTracking();
              if (event.data === 0) {
                onProgress(lessonRef.current, 100, true);
              }
            }
          },
        },
      });
    });

    return () => {
      disposed = true;
      stopTracking();
      player?.destroy();
    };
  }, [lesson.id, onProgress, videoId]);

  return <div ref={containerRef} className="h-full w-full" />;
};

const ModernLessonOverview = () => {
  const objectives = [
    "Compreender os conceitos centrais apresentados nesta aula.",
    "Reconhecer como o conteúdo se aplica à rotina da operação.",
    "Revisar os pontos principais antes de seguir para a próxima etapa.",
  ];
  return (
    <div>
      <h3 className="text-lg font-semibold text-white">
        Nesta aula você vai aprender
      </h3>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {objectives.map((objective, index) => (
          <div
            key={objective}
            className="flex gap-3 rounded-2xl border border-[#29445f] bg-[#071421] p-4"
          >
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyan-400/[0.08] text-xs font-bold text-cyan-300">
              {String(index + 1).padStart(2, "0")}
            </div>
            <p className="text-xs leading-relaxed text-slate-300">
              {objective}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

const CourseView: React.FC<{
  course: CursoDetalhe;
  activeLesson: AulaAcademia | null;
  actionLoading: string | null;
  onBack: () => void;
  onEnroll: () => void;
  onSelectLesson: (lesson: AulaAcademia | null) => void;
  onStartLesson: (lesson: AulaAcademia) => void;
  onCompleteLesson: (
    lesson: AulaAcademia,
    updatedCourse?: CursoDetalhe,
  ) => void;
  onToggleFavorite: (lesson: AulaAcademia) => void;
}> = ({
  course,
  activeLesson,
  actionLoading,
  onBack,
  onEnroll,
  onSelectLesson,
  onStartLesson,
  onCompleteLesson,
  onToggleFavorite,
}) => (
  <section>
    <button
      onClick={onBack}
      className="mb-5 flex items-center gap-2 text-xs text-slate-400 hover:text-white"
    >
      <ArrowLeft className="h-4 w-4" />
      Voltar ao catálogo
    </button>

    <div className="overflow-hidden rounded-2xl border border-[#2a4868] bg-gradient-to-br from-[#0b2341] to-[#07111f] p-5 md:p-7">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          <span className="text-[10px] tracking-[0.16em] text-cyan-300">
            {course.nivel} · {formatDuration(course.carga_horaria_min)}
          </span>
          <h2 className="mt-3 text-2xl font-semibold md:text-4xl">
            {course.titulo}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">
            {course.descricao || "Curso da Academia Aurora."}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/15 p-4">
          <div className="flex items-end justify-between">
            <span className="text-xs text-slate-400">Progresso</span>
            <strong className="text-2xl text-orange-400">
              {Math.round(course.progresso)}%
            </strong>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#142a40]">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-cyan-400"
              style={{ width: `${course.progresso}%` }}
            />
          </div>
          <p className="mt-2 text-[10px] text-slate-400">
            {course.aulas_concluidas} de {course.total_aulas} aulas concluídas
          </p>
          {!course.matriculado && (
            <button
              onClick={onEnroll}
              disabled={actionLoading === "enroll"}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-xs font-semibold hover:bg-orange-600 disabled:opacity-60"
            >
              {actionLoading === "enroll" && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              MATRICULAR-SE
            </button>
          )}
        </div>
      </div>
    </div>

    <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-3">
        {course.modulos.length === 0 ? (
          <EmptyState
            text="Este curso ainda não possui módulos publicados."
            icon={<Library className="h-8 w-8" />}
          />
        ) : (
          course.modulos.map((module, moduleIndex) => (
            <ModuleCard
              key={module.id}
              title={module.titulo}
              description={module.descricao}
              index={moduleIndex}
              lessons={module.aulas}
              enrolled={course.matriculado}
              activeLessonId={activeLesson?.id}
              onSelect={onSelectLesson}
            />
          ))
        )}
      </div>

      <LessonPanel
        lesson={activeLesson}
        enrolled={course.matriculado}
        actionLoading={actionLoading}
        onStart={onStartLesson}
        onComplete={onCompleteLesson}
        onToggleFavorite={onToggleFavorite}
      />
    </div>
  </section>
);

const ModuleCard: React.FC<{
  title: string;
  description?: string | null;
  index: number;
  lessons: AulaAcademia[];
  enrolled: boolean;
  activeLessonId?: number;
  onSelect: (lesson: AulaAcademia) => void;
}> = ({
  title,
  description,
  index,
  lessons,
  enrolled,
  activeLessonId,
  onSelect,
}) => (
  <details
    className="group overflow-hidden rounded-2xl border border-[#263e58] bg-[#071421]"
    open={index === 0}
  >
    <summary className="flex cursor-pointer list-none items-center gap-4 p-4">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-500/10 text-sm font-semibold text-orange-400">
        {String(index + 1).padStart(2, "0")}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 line-clamp-1 text-xs text-slate-400">
          {description || `${lessons.length} aulas`}
        </p>
      </div>
      <ChevronDown className="h-4 w-4 text-slate-400 transition group-open:rotate-180" />
    </summary>
    <div className="border-t border-[#20364d] p-2">
      {lessons.map((lesson) => {
        const Icon = lessonIcons[lesson.tipo];
        const active = activeLessonId === lesson.id;
        return (
          <button
            key={lesson.id}
            onClick={() => onSelect(lesson)}
            className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
              active
                ? "border-orange-500/30 bg-orange-500/[0.07]"
                : "border-transparent hover:bg-white/[0.03]"
            }`}
          >
            <div
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                lesson.concluida
                  ? "bg-emerald-400/10 text-emerald-300"
                  : "bg-[#102237] text-cyan-300"
              }`}
            >
              {lesson.concluida ? (
                <Check className="h-4 w-4" />
              ) : enrolled ? (
                <Icon className="h-4 w-4" />
              ) : (
                <Lock className="h-3.5 w-3.5 text-slate-400" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-sm font-medium">
                {lesson.titulo}
              </p>
              <p className="mt-1 text-[10px] text-slate-400">
                {lesson.tipo} · {formatDuration(lesson.duracao_min)}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </button>
        );
      })}
    </div>
  </details>
);

const LessonPanel: React.FC<{
  lesson: AulaAcademia | null;
  enrolled: boolean;
  actionLoading: string | null;
  onStart: (lesson: AulaAcademia) => void;
  onComplete: (lesson: AulaAcademia, updatedCourse?: CursoDetalhe) => void;
  onToggleFavorite: (lesson: AulaAcademia) => void;
}> = ({
  lesson,
  enrolled,
  actionLoading,
  onStart,
  onComplete,
  onToggleFavorite,
}) => {
  if (!lesson) {
    return (
      <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed border-[#2a435d] bg-[#071421]/50 p-8 text-center">
        <div>
          <BookOpen className="mx-auto h-9 w-9 text-slate-400" />
          <p className="mt-3 text-sm text-slate-400">
            Selecione uma aula para ver os detalhes.
          </p>
        </div>
      </div>
    );
  }

  const Icon = lessonIcons[lesson.tipo];
  return (
    <aside className="self-start rounded-2xl border border-[#263e58] bg-[#071421] p-5 xl:sticky xl:top-4">
      <div className="flex items-start justify-between gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300">
          <Icon className="h-5 w-5" />
        </div>
        {enrolled && (
          <button
            onClick={() => onToggleFavorite(lesson)}
            disabled={actionLoading === `favorite-${lesson.id}`}
            className={`rounded-xl border p-2.5 ${
              lesson.favorita
                ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
                : "border-[#2b435d] text-slate-400"
            }`}
            aria-label={
              lesson.favorita
                ? "Remover dos materiais salvos"
                : "Salvar material"
            }
          >
            <Star
              className={`h-4 w-4 ${lesson.favorita ? "fill-current" : ""}`}
            />
          </button>
        )}
      </div>
      <p className="mt-5 text-[10px] tracking-[0.13em] text-cyan-300">
        {lesson.tipo} · {formatDuration(lesson.duracao_min)}
      </p>
      <h3 className="mt-2 text-xl font-semibold">{lesson.titulo}</h3>
      <p className="mt-3 text-sm leading-relaxed text-slate-400">
        {lesson.descricao || "Conteúdo de aprendizagem da Academia Aurora."}
      </p>
      {lesson.tipo === "TEXTO" && lesson.conteudo_texto && (
        <div className="mt-4 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-xl border border-[#233c55] bg-[#040e1a] p-4 text-xs leading-relaxed text-slate-300">
          {lesson.conteudo_texto}
        </div>
      )}
      {!enrolled ? (
        <div className="mt-5 flex items-center gap-2 rounded-xl border border-amber-400/15 bg-amber-400/5 p-3 text-xs text-amber-200">
          <Lock className="h-4 w-4" />
          Faça sua matrícula para acessar.
        </div>
      ) : lesson.tipo === "QUIZ" ? (
        <QuizLessonActivity
          key={lesson.id}
          lesson={lesson}
          actionLoading={actionLoading}
          onComplete={onComplete}
        />
      ) : (
        <div className="mt-5 space-y-2">
          <button
            onClick={() => onStart(lesson)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-xs font-semibold hover:bg-orange-600"
          >
            {lesson.conteudo_url ? (
              <ExternalLink className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {lesson.percentual > 0 ? "CONTINUAR AULA" : "INICIAR AULA"}
          </button>
          {!lesson.concluida && (
            <button
              onClick={() => onComplete(lesson)}
              disabled={actionLoading === `lesson-${lesson.id}`}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/25 px-4 py-3 text-xs font-semibold text-emerald-300 hover:bg-emerald-400/5 disabled:opacity-60"
            >
              {actionLoading === `lesson-${lesson.id}` ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              MARCAR COMO CONCLUÍDA
            </button>
          )}
          {lesson.concluida && (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-xs text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              Aula concluída
            </div>
          )}
        </div>
      )}
    </aside>
  );
};

const QuizLessonActivity: React.FC<{
  lesson: AulaAcademia;
  actionLoading: string | null;
  onComplete: (lesson: AulaAcademia, updatedCourse?: CursoDetalhe) => void;
}> = ({ lesson, actionLoading, onComplete }) => {
  const quiz = parseLessonQuiz(lesson);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    score: number;
    passed: boolean;
    minimo: number;
    acertos: number;
    total: number;
    correcao: AcademiaQuizCorrecaoItem[];
  } | null>(null);

  if (!quiz) {
    return <div className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-xs text-amber-200">Este Quiz foi criado no formato antigo e precisa ser configurado novamente pela Qualidade.</div>;
  }

  const question = quiz.perguntas[questionIndex];
  const selected = answers[question.id];

  /* A correção é do servidor: o navegador não conhece o gabarito. */
  const finish = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const resposta = await academiaApi.responderQuiz(lesson.id, answers);
      setResult({
        score: resposta.nota,
        passed: resposta.aprovada,
        minimo: resposta.nota_minima,
        acertos: resposta.acertos,
        total: resposta.total_perguntas,
        correcao: resposta.correcao,
      });
      if (resposta.aprovada) onComplete(lesson, resposta.curso);
    } catch {
      setSubmitError(
        "Não foi possível enviar suas respostas. Tente novamente.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const restart = () => {
    setAnswers({});
    setQuestionIndex(0);
    setResult(null);
    setSubmitError(null);
  };

  if (result) {
    return (
      <div className={`mt-5 rounded-2xl border p-5 ${result.passed ? "border-emerald-400/30 bg-emerald-400/[0.06]" : "border-orange-400/30 bg-orange-400/[0.06]"}`}>
        <div className="text-center">
          {result.passed ? <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-300" /> : <Target className="mx-auto h-9 w-9 text-orange-300" />}
          <strong className="mt-3 block text-3xl text-white">{result.score}%</strong>
          <p className="mt-1 text-[10px] tracking-[0.13em] text-slate-400">{result.acertos} DE {result.total} CORRETAS</p>
          <p className="mt-2 text-xs text-slate-300">{result.passed ? "Avaliação concluída com sucesso." : `Você precisa atingir ${result.minimo}% para concluir esta aula.`}</p>
        </div>
        <div className="mt-5 space-y-2">
          {result.correcao.map((item, index) => (
            <div key={item.pergunta_id} className={`rounded-xl border p-3 ${item.acertou ? "border-emerald-400/20 bg-emerald-400/5" : "border-rose-400/20 bg-rose-400/5"}`}>
              <div className="flex items-start gap-2">
                {item.acertou ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" /> : <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-300" />}
                <p className="text-xs font-medium leading-relaxed text-white">{index + 1}. {item.enunciado}</p>
              </div>
              {item.explicacao && <p className="mt-2 pl-5 text-[11px] leading-relaxed text-slate-400">{item.explicacao}</p>}
            </div>
          ))}
        </div>
        {!result.passed && <button type="button" onClick={restart} className="mt-4 w-full rounded-xl bg-orange-500 px-5 py-3 text-xs font-semibold text-white hover:bg-orange-600">TENTAR NOVAMENTE</button>}
        {result.passed && actionLoading === `lesson-${lesson.id}` && <Loader2 className="mx-auto mt-4 h-5 w-5 animate-spin text-emerald-300" />}
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-2xl border border-violet-400/25 bg-violet-400/[0.035] p-4">
      <div className="flex items-center justify-between gap-3"><span className="font-mono text-[9px] tracking-[.13em] text-violet-300">QUIZ DO MÓDULO</span><span className="text-[10px] text-slate-400">{questionIndex + 1}/{quiz.perguntas.length}</span></div>
      {lesson.quiz_resultado && (
        <p className="mt-2 text-[10px] text-slate-400">
          Melhor nota: <strong className="text-white">{lesson.quiz_resultado.melhor_nota}%</strong> · {lesson.quiz_resultado.tentativas} tentativa(s) · mínimo {quiz.nota_minima}%
        </p>
      )}
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-[#193047]"><div className="h-full bg-gradient-to-r from-orange-500 to-violet-400" style={{ width: `${((questionIndex + 1) / quiz.perguntas.length) * 100}%` }} /></div>
      <h4 className="mt-5 text-sm font-semibold leading-relaxed text-white">{question.enunciado}</h4>
      <div className="mt-4 space-y-2">
        {question.alternativas.map((alternative, index) => (
          <button key={alternative.id} type="button" onClick={() => setAnswers((current) => ({ ...current, [question.id]: alternative.id }))} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left text-xs transition ${selected === alternative.id ? "border-orange-400/50 bg-orange-400/10 text-white" : "border-[#2b435d] bg-[#040e1a] text-slate-300 hover:border-[#41617e]"}`}><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/5 font-semibold">{String.fromCharCode(65 + index)}</span>{alternative.texto}</button>
        ))}
      </div>
      {submitError && <p className="mt-3 rounded-xl border border-rose-400/25 bg-rose-400/5 p-3 text-[11px] text-rose-200">{submitError}</p>}
      <button type="button" disabled={!selected || submitting} onClick={() => questionIndex === quiz.perguntas.length - 1 ? void finish() : setQuestionIndex((current) => current + 1)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-35">{submitting ? <><Loader2 className="h-4 w-4 animate-spin" />CORRIGINDO…</> : <>{questionIndex === quiz.perguntas.length - 1 ? "FINALIZAR QUIZ" : "PRÓXIMA PERGUNTA"}<ArrowRight className="h-4 w-4" /></>}</button>
    </div>
  );
};

const Achievements: React.FC<{
  courses: CursoResumo[];
  loading: boolean;
}> = ({ courses, loading }) => {
  const [certificates, setCertificates] = useState<CertificadoAcademia[]>([]);
  const [loadingCertificates, setLoadingCertificates] = useState(true);

  useEffect(() => {
    let active = true;
    academiaApi
      .certificados()
      .then((data) => {
        if (active) setCertificates(data);
      })
      .catch(() => {
        if (active) setCertificates([]);
      })
      .finally(() => {
        if (active) setLoadingCertificates(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const completed = courses.filter(
    (course) => course.status_matricula === "CONCLUIDO",
  );
  const certifiedCourseIds = new Set(
    certificates.map((certificate) => certificate.curso_id),
  );
  // Concluídos antes de o certificado existir continuam aparecendo.
  const withoutCertificate = completed.filter(
    (course) => !certifiedCourseIds.has(course.id),
  );
  const busy = loading || loadingCertificates;

  return (
    <section>
      <h2 className="text-2xl font-semibold">Conquistas</h2>
      <p className="mt-1 text-sm text-slate-400">
        Seus certificados e cursos concluídos.
      </p>
      <div className="mt-6">
        {busy ? (
          <LoadingState />
        ) : completed.length === 0 && certificates.length === 0 ? (
          <EmptyState
            text="Conclua seu primeiro curso para liberar uma conquista."
            icon={<Trophy className="h-8 w-8" />}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {certificates.map((certificate) => (
              <CertificateCard
                key={certificate.codigo}
                certificate={certificate}
              />
            ))}
            {withoutCertificate.map((course) => (
              <article
                key={course.id}
                className="rounded-2xl border border-amber-400/20 bg-gradient-to-br from-amber-400/[0.08] to-[#071421] p-5"
              >
                <Trophy className="h-8 w-8 text-amber-300" />
                <p className="mt-5 text-[10px] tracking-[0.14em] text-amber-300">
                  CURSO CONCLUÍDO
                </p>
                <h3 className="mt-2 font-semibold">{course.titulo}</h3>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] as string,
  );

const printCertificate = (certificate: CertificadoAcademia) => {
  const janela = window.open("", "_blank", "width=1000,height=720");
  if (!janela) return;
  const emitido = certificate.emitido_em
    ? new Date(certificate.emitido_em).toLocaleDateString("pt-BR")
    : "";
  const horas = Math.round((certificate.carga_horaria_min / 60) * 10) / 10;
  janela.document.write(`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Certificado ${escapeHtml(certificate.codigo)}</title>
<style>
  body{margin:0;font-family:Georgia,'Times New Roman',serif;color:#12212f}
  .folha{width:26cm;max-width:100%;margin:0 auto;padding:3cm 3cm;box-sizing:border-box;text-align:center}
  .borda{border:3px double #c98a24;padding:2.4cm 2cm}
  .selo{font-family:Arial,Helvetica,sans-serif;letter-spacing:.32em;font-size:11px;color:#c98a24;text-transform:uppercase}
  h1{font-size:38px;margin:18px 0 6px;letter-spacing:.04em}
  .nome{font-size:30px;margin:26px 0 6px;font-weight:bold}
  .curso{font-size:23px;margin:18px 0;font-style:italic}
  .meta{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#4a5b6c;margin-top:34px;line-height:1.9}
  .codigo{font-family:'Courier New',monospace;font-size:13px;letter-spacing:.16em;margin-top:8px}
  @media print{@page{size:landscape;margin:0}}
</style></head>
<body onload="window.print()">
  <div class="folha"><div class="borda">
    <p class="selo">Academia Aurora &middot; Grupo Acme</p>
    <h1>Certificado de Conclus&atilde;o</h1>
    <p>Certificamos que</p>
    <p class="nome">${escapeHtml(certificate.nome || "")}</p>
    <p>concluiu com aproveitamento o curso</p>
    <p class="curso">${escapeHtml(certificate.curso_titulo || "")}</p>
    <p class="meta">
      ${horas > 0 ? `Carga hor&aacute;ria: ${horas}h &middot; ` : ""}${certificate.total_aulas} aula(s)
      ${certificate.nota_final !== null && certificate.nota_final !== undefined ? ` &middot; Aproveitamento: ${certificate.nota_final}%` : ""}
      ${certificate.centro_custo ? `<br>Centro de custo: ${escapeHtml(certificate.centro_custo)}` : ""}
      ${emitido ? `<br>Emitido em ${emitido}` : ""}
      <span class="codigo">C&Oacute;DIGO DE VALIDA&Ccedil;&Atilde;O: ${escapeHtml(certificate.codigo)}</span>
    </p>
  </div></div>
</body></html>`);
  janela.document.close();
};

const CertificateCard: React.FC<{ certificate: CertificadoAcademia }> = ({
  certificate,
}) => (
  <article className="flex flex-col rounded-2xl border border-amber-400/25 bg-gradient-to-br from-amber-400/[0.09] to-[#071421] p-5">
    <div className="flex items-start justify-between gap-3">
      <Trophy className="h-8 w-8 text-amber-300" />
      {certificate.nota_final !== null &&
        certificate.nota_final !== undefined && (
          <span className="rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold text-emerald-200">
            {certificate.nota_final}%
          </span>
        )}
    </div>
    <p className="mt-5 text-[10px] tracking-[0.14em] text-amber-300">
      CERTIFICADO EMITIDO
    </p>
    <h3 className="mt-2 font-semibold">{certificate.curso_titulo}</h3>
    <p className="mt-2 text-[11px] text-slate-400">
      {certificate.carga_horaria_min > 0 &&
        `${formatDuration(certificate.carga_horaria_min)} · `}
      {certificate.total_aulas} aula(s)
    </p>
    <p className="mt-3 font-mono text-[10px] tracking-[0.12em] text-slate-500">
      {certificate.codigo}
    </p>
    <button
      type="button"
      onClick={() => printCertificate(certificate)}
      className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-amber-400/30 px-4 py-2.5 text-[11px] font-semibold text-amber-200 hover:bg-amber-400/10"
    >
      <FileText className="h-3.5 w-3.5" />
      EMITIR CERTIFICADO
    </button>
  </article>
);

const SavedMaterials: React.FC<{
  materials: MaterialSalvo[];
  loading: boolean;
  onOpenCourse: (id: number) => void;
}> = ({ materials, loading, onOpenCourse }) => (
  <section>
    <h2 className="text-2xl font-semibold">Materiais salvos</h2>
    <p className="mt-1 text-sm text-slate-400">
      Aulas e referências que você marcou para consultar depois.
    </p>
    <div className="mt-6">
      {loading ? (
        <LoadingState />
      ) : materials.length === 0 ? (
        <EmptyState
          text="Você ainda não salvou nenhum material."
          icon={<BookMarked className="h-8 w-8" />}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {materials.map((material) => {
            const Icon = lessonIcons[material.tipo];
            return (
              <button
                key={material.id}
                onClick={() => onOpenCourse(material.curso_id)}
                className="flex items-center gap-4 rounded-2xl border border-[#263e58] bg-[#071421] p-4 text-left hover:border-orange-500/35"
              >
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="line-clamp-1 text-sm font-medium">
                    {material.titulo}
                  </h3>
                  <p className="mt-1 line-clamp-1 text-[10px] text-slate-400">
                    {material.curso_titulo} · {material.modulo_titulo}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  </section>
);

const EmptyState: React.FC<{
  text: string;
  icon: React.ReactNode;
}> = ({ text, icon }) => (
  <div className="grid min-h-48 place-items-center rounded-2xl border border-dashed border-[#2a435d] bg-[#071421]/45 p-8 text-center">
    <div>
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white/[0.035] text-slate-400">
        {icon}
      </div>
      <p className="mt-4 text-sm text-slate-400">{text}</p>
    </div>
  </div>
);

const LoadingState = () => (
  <div className="grid min-h-48 place-items-center rounded-2xl border border-[#263e58] bg-[#071421]/45">
    <div className="text-center">
      <Loader2 className="mx-auto h-7 w-7 animate-spin text-orange-400" />
      <p className="mt-3 text-xs text-slate-400">
        Carregando sua jornada...
      </p>
    </div>
  </div>
);

export default AcademiaModal;
