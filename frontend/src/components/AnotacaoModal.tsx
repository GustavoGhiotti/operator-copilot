import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowDownUp,
  Bell,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Edit3,
  Eye,
  FileText,
  Lightbulb,
  MoreVertical,
  Palette,
  Plus,
  Pin,
  Reply,
  Save,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import { animate } from "animejs/animation";
import axiosInstance from "@/utils/axiosInstance";
import { funcaoEhAlgumDe } from "@/utils/funcaoColaborador";
import { toast } from "sonner";

interface Anotacao {
  id: number;
  usuario?: string;
  titulo: string;
  conteudo: string;
  categoria: string;
  destinatario?: string;
  data_criacao: string;
  data_atualizacao?: string;
  confirmado?: boolean;
  tipo_boleto?: string;
  data_vencimento?: string;
  valor_proposta?: number;
  cor_postit?: PostitColor;
  importante?: boolean;
  fixado?: boolean;
}

interface AnotacaoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Visao = "minhas" | "recebidas" | "supervisor";
type SortOrder = "recentes" | "antigas";
type HighlightFilter =
  | "todos"
  | "importantes"
  | "fixados"
  | "pendentes"
  | "confirmados";
type PostitColor =
  | "automatico"
  | "amarelo"
  | "verde"
  | "azul"
  | "rosa"
  | "lilas"
  | "laranja";

const categorias = [
  {
    value: "retorno_cliente",
    label: "Retorno para Cliente",
    icon: Reply,
    paper: "anotacao-postit--yellow",
  },
  {
    value: "anotacoes_diversas",
    label: "Anotações Diversas",
    icon: FileText,
    paper: "anotacao-postit--blue",
  },
  {
    value: "lembretes",
    label: "Lembretes",
    icon: Bell,
    paper: "anotacao-postit--green",
  },
  {
    value: "estrategias",
    label: "Estratégias",
    icon: Lightbulb,
    paper: "anotacao-postit--purple",
  },
  {
    value: "observacoes",
    label: "Observações",
    icon: Eye,
    paper: "anotacao-postit--peach",
  },
  {
    value: "envio_manual",
    label: "Envio Manual",
    icon: Send,
    paper: "anotacao-postit--pink",
  },
] as const;

const initialForm = {
  titulo: "",
  conteudo: "",
  categoria: "retorno_cliente",
  destinatario: "",
  tipo_boleto: "",
  data_vencimento: "",
  valor_proposta: "",
  cor_postit: "automatico" as PostitColor,
  importante: false,
  fixado: false,
};

const postitColors: Array<{
  value: PostitColor;
  label: string;
  swatch: string;
  paper?: string;
}> = [
  { value: "automatico", label: "Automático", swatch: "bg-gradient-to-br from-amber-200 via-sky-200 to-violet-200" },
  { value: "amarelo", label: "Amarelo", swatch: "bg-[#fff2a8]", paper: "anotacao-postit--yellow" },
  { value: "verde", label: "Verde", swatch: "bg-[#c9f4d6]", paper: "anotacao-postit--green" },
  { value: "azul", label: "Azul", swatch: "bg-[#cce9ff]", paper: "anotacao-postit--blue" },
  { value: "rosa", label: "Rosa", swatch: "bg-[#ffd4df]", paper: "anotacao-postit--pink" },
  { value: "lilas", label: "Lilás", swatch: "bg-[#e6d3f7]", paper: "anotacao-postit--purple" },
  { value: "laranja", label: "Laranja", swatch: "bg-[#ffd5bb]", paper: "anotacao-postit--peach" },
];

const AnotacaoModal: React.FC<AnotacaoModalProps> = ({ isOpen, onClose }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const wallRef = useRef<HTMLDivElement>(null);
  const [anotacoes, setAnotacoes] = useState<Anotacao[]>([]);
  const [visao, setVisao] = useState<Visao>("minhas");
  const [categAtiva, setCategAtiva] = useState("retorno_cliente");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroData, setFiltroData] = useState("");
  const [busca, setBusca] = useState("");
  const [ordenacao, setOrdenacao] = useState<SortOrder>("recentes");
  const [filtroDestaque, setFiltroDestaque] =
    useState<HighlightFilter>("todos");
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [formData, setFormData] = useState(initialForm);

  const usuario = localStorage.getItem("nomeCompleto") || "";
  const funcao = localStorage.getItem("funcao")?.trim() || "";
  const centroCusto = localStorage.getItem("centroCusto")?.trim() || "";
  // Comparação por prefixo, não por igualdade: FUNCAO_COLABORADOR tem
  // registros com sufixo de nível ("SUPERVISOR(A) DE OPERACOES I"), e o
  // igual deixava essas pessoas sem a permissão que o cargo dá.
  const podeExcluirConfirmadas = funcaoEhAlgumDe(funcao, [
    "SUPERVISOR(A) DE OPERACOES",
    "COORDENADOR(A) DE OPERACOES JR",
    "ASSISTENTE DE COORDENACAO",
  ]);
  const podeVerSupervisao = funcaoEhAlgumDe(funcao, [
    "SUPERVISOR(A) DE OPERACOES",
  ]);

  const carregarAnotacoes = useCallback(
    async (view: Visao) => {
      try {
        setLoading(true);
        const params =
          view === "minhas"
            ? { usuario, visao: "minhas" }
            : view === "recebidas"
              ? { destinatario: usuario, visao: "recebidas" }
              : { usuario, visao: "supervisor" };

        const response = await axiosInstance.get("/api/anotacoes", { params });
        setAnotacoes(response.data || []);
      } catch (error) {
        console.error("Erro ao carregar anotações:", error);
        toast.error("Erro ao carregar anotações");
      } finally {
        setLoading(false);
      }
    },
    [usuario],
  );

  useEffect(() => {
    if (isOpen) carregarAnotacoes(visao);
  }, [carregarAnotacoes, isOpen, visao]);

  useEffect(() => {
    if (!isOpen || !modalRef.current) return;
    const motionReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (motionReduced) return;

    const entrance = animate(modalRef.current, {
      opacity: [0, 1],
      translateY: [18, 0],
      scale: [0.985, 1],
      filter: ["blur(5px)", "blur(0px)"],
      duration: 480,
      ease: "out(4)",
    });

    return () => entrance.revert();
  }, [isOpen]);

  useEffect(() => {
    if (!wallRef.current || loading) return;
    const motionReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (motionReduced) return;

    const notes = wallRef.current.querySelectorAll(".anotacao-postit");
    if (!notes.length) return;
    const entrance = animate(notes, {
      opacity: [0, 1],
      translateY: [12, 0],
      scale: [0.97, 1],
      delay: (_element, index) => index * 55,
      duration: 380,
      ease: "out(4)",
    });

    return () => entrance.revert();
  }, [categAtiva, visao, loading, anotacoes.length]);

  const categoriaAtual = categorias.find(
    (categoria) => categoria.value === categAtiva,
  );

  const contagemPorCategoria = useMemo(
    () =>
      categorias.reduce<Record<string, number>>((acc, categoria) => {
        acc[categoria.value] = anotacoes.filter(
          (anotacao) => anotacao.categoria === categoria.value,
        ).length;
        return acc;
      }, {}),
    [anotacoes],
  );

  const recebidasPendentes = useMemo(
    () => anotacoes.filter((anotacao) => !anotacao.confirmado).length,
    [anotacoes],
  );

  const anotacoesFiltradas = useMemo(() => {
    const term = busca.trim().toLocaleLowerCase("pt-BR");
    return anotacoes
      .filter((anotacao) => {
        if (anotacao.categoria !== categAtiva) return false;
        if (filtroTipo && anotacao.tipo_boleto !== filtroTipo) return false;
        if (
          filtroData &&
          (!anotacao.data_vencimento ||
            anotacao.data_vencimento !== filtroData)
        ) {
          return false;
        }
        if (
          term &&
          !`${anotacao.titulo} ${anotacao.conteudo}`
            .toLocaleLowerCase("pt-BR")
            .includes(term)
        ) {
          return false;
        }
        if (filtroDestaque === "importantes" && !anotacao.importante) {
          return false;
        }
        if (filtroDestaque === "fixados" && !anotacao.fixado) return false;
        if (filtroDestaque === "pendentes" && anotacao.confirmado) return false;
        if (filtroDestaque === "confirmados" && !anotacao.confirmado) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (Boolean(a.fixado) !== Boolean(b.fixado)) {
          return a.fixado ? -1 : 1;
        }
        if (Boolean(a.importante) !== Boolean(b.importante)) {
          return a.importante ? -1 : 1;
        }
        const dateA = new Date(a.data_atualizacao || a.data_criacao).getTime();
        const dateB = new Date(b.data_atualizacao || b.data_criacao).getTime();
        return ordenacao === "recentes" ? dateB - dateA : dateA - dateB;
      });
  }, [
    anotacoes,
    busca,
    categAtiva,
    filtroData,
    filtroDestaque,
    filtroTipo,
    ordenacao,
  ]);

  const resetForm = () => {
    setFormData(initialForm);
    setShowForm(false);
    setEditingId(null);
  };

  const abrirNovaAnotacao = () => {
    setFormData({ ...initialForm, categoria: categAtiva });
    setEditingId(null);
    setShowForm(true);
  };

  const salvarAnotacao = async () => {
    if (!formData.titulo.trim() || !formData.conteudo.trim()) {
      toast.error("Preencha título e conteúdo");
      return;
    }

    try {
      setLoading(true);
      const payload = {
        ...formData,
        valor_proposta: formData.valor_proposta
          ? Number.parseFloat(formData.valor_proposta)
          : null,
        usuario,
      };

      if (editingId) {
        await axiosInstance.put(`/api/anotacoes/${editingId}`, payload);
        toast.success("Anotação atualizada!");
      } else {
        await axiosInstance.post("/api/anotacoes", payload);
        toast.success("Anotação criada!");
      }
      resetForm();
      await carregarAnotacoes(visao);
    } catch (error) {
      console.error("Erro ao salvar anotação:", error);
      toast.error("Erro ao salvar anotação");
    } finally {
      setLoading(false);
    }
  };

  const editarAnotacao = (anotacao: Anotacao) => {
    setFormData({
      titulo: anotacao.titulo,
      conteudo: anotacao.conteudo,
      categoria: anotacao.categoria,
      destinatario: anotacao.destinatario || "",
      tipo_boleto: anotacao.tipo_boleto || "",
      data_vencimento: anotacao.data_vencimento || "",
      valor_proposta: anotacao.valor_proposta?.toString() || "",
      cor_postit: anotacao.cor_postit || "automatico",
      importante: Boolean(anotacao.importante),
      fixado: Boolean(anotacao.fixado),
    });
    setEditingId(anotacao.id);
    setOpenMenuId(null);
    setShowForm(true);
  };

  const excluirAnotacao = async (id: number) => {
    if (!window.confirm("Deseja excluir esta anotação?")) return;
    try {
      await axiosInstance.delete(`/api/anotacoes/${id}`);
      toast.success("Anotação excluída!");
      setOpenMenuId(null);
      await carregarAnotacoes(visao);
    } catch (error) {
      console.error("Erro ao excluir anotação:", error);
      toast.error("Erro ao excluir anotação");
    }
  };

  const excluirAnotacoesConfirmadas = async () => {
    if (
      !window.confirm(
        "Deseja excluir todas as anotações confirmadas e manuais?",
      )
    ) {
      return;
    }
    try {
      await axiosInstance.delete("/api/anotacoes/excluir-confirmadas");
      toast.success("Anotações confirmadas e manuais excluídas!");
      await carregarAnotacoes(visao);
    } catch (error) {
      console.error("Erro ao excluir anotações confirmadas:", error);
      toast.error("Erro ao excluir anotações confirmadas");
    }
  };

  const confirmarRecebimento = async (id: number) => {
    try {
      await axiosInstance.put(`/api/anotacoes/${id}/confirmar`);
      toast.success("Anotação confirmada!");
      setOpenMenuId(null);
      await carregarAnotacoes(visao);
    } catch (error) {
      console.error("Erro ao confirmar anotação:", error);
      toast.error("Erro ao confirmar anotação");
    }
  };

  const atualizarPreferencias = async (
    anotacao: Anotacao,
    changes: Partial<
      Pick<Anotacao, "cor_postit" | "importante" | "fixado">
    >,
  ) => {
    const preferencias = {
      cor_postit: anotacao.cor_postit || "automatico",
      importante: Boolean(anotacao.importante),
      fixado: Boolean(anotacao.fixado),
      ...changes,
    };

    try {
      await axiosInstance.patch(
        `/api/anotacoes/${anotacao.id}/preferencias`,
        preferencias,
      );
      setAnotacoes((current) =>
        current.map((item) =>
          item.id === anotacao.id ? { ...item, ...preferencias } : item,
        ),
      );
      setOpenMenuId(null);
      toast.success("Preferências atualizadas!");
    } catch (error) {
      console.error("Erro ao atualizar preferências:", error);
      toast.error("Erro ao atualizar preferências");
    }
  };

  const resolvePostitPaper = (
    anotacao: Anotacao,
    categoryPaper?: string,
  ) => {
    const custom = postitColors.find(
      (color) =>
        color.value === (anotacao.cor_postit || "automatico"),
    );
    return custom?.paper || categoryPaper || "anotacao-postit--yellow";
  };

  const podeExcluir = (anotacao: Anotacao) =>
    (anotacao.categoria !== "envio_manual" &&
      anotacao.usuario === usuario) ||
    (anotacao.categoria === "envio_manual" &&
      ["SUPERVISOR(A) DE OPERACOES", "ASSISTENTE DE COORDENACAO"].includes(
        funcao,
      ));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#01050d]/80 p-2 backdrop-blur-md md:p-5">
      <div
        ref={modalRef}
        className="relative flex h-[94vh] w-full max-w-[1380px] flex-col overflow-hidden rounded-2xl border border-[#315272]/80 bg-[#07111f]/95 text-slate-100 shadow-[0_30px_120px_rgba(0,0,0,.7),0_0_50px_rgba(25,111,205,.08)]"
      >
        <header className="flex min-h-16 items-center justify-between border-b border-[#263c55] bg-gradient-to-r from-[#0a1a2e] to-[#07111f] px-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-orange-500/40 bg-orange-500/10 text-orange-500">
              <StickyNote className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold md:text-xl">
                Anotações Pessoais
              </h2>
              <p className="mt-0.5 hidden text-[10px] tracking-[0.2em] text-slate-500 sm:block">
                MURAL DIGITAL DE LEMBRETES
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 md:gap-5">
            <span className="hidden items-center gap-2 text-[10px] tracking-[0.16em] text-emerald-400 sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
              AURORA ONLINE
            </span>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white"
              aria-label="Fechar anotações"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="flex min-h-14 items-center gap-2 overflow-x-auto border-b border-[#263c55] px-3 md:px-6">
          {[
            { value: "minhas" as const, label: "Minhas Anotações", icon: StickyNote },
            { value: "recebidas" as const, label: "Recebidas", icon: Send },
            ...(podeVerSupervisao
              ? [{ value: "supervisor" as const, label: "Supervisão", icon: ShieldCheck }]
              : []),
          ].map((item) => {
            const Icon = item.icon;
            const active = visao === item.value;
            return (
              <button
                key={item.value}
                onClick={() => setVisao(item.value)}
                className={`relative flex h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-medium transition md:px-4 md:text-sm ${
                  active
                    ? "bg-orange-500 text-white shadow-[0_8px_24px_rgba(249,115,22,.16)]"
                    : "border border-[#2b435d] bg-[#0a1728] text-slate-300 hover:border-orange-500/40 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
                {item.value === "recebidas" && recebidasPendentes > 0 && (
                  <span className="rounded-full bg-orange-950/70 px-1.5 py-0.5 text-[10px] text-orange-300">
                    {recebidasPendentes}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <nav className="flex min-h-12 items-end gap-1 overflow-x-auto border-b border-[#263c55] bg-[#091625] px-2 md:px-5">
          {categorias.map((categoria) => {
            const Icon = categoria.icon;
            const active = categAtiva === categoria.value;
            return (
              <button
                key={categoria.value}
                onClick={() => setCategAtiva(categoria.value)}
                className={`flex h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-xs transition ${
                  active
                    ? "border-orange-500 bg-orange-500/5 text-orange-400"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {categoria.label}
                <span className="text-[10px] text-slate-600">
                  {contagemPorCategoria[categoria.value] || 0}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="flex min-h-0 flex-1">
          <main className="flex min-w-0 flex-1 flex-col p-3 md:p-5">
            <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h3 className="text-lg font-semibold md:text-2xl">
                  {categoriaAtual?.label}
                </h3>
                <p className="mt-1 text-xs text-cyan-200/60">
                  {anotacoesFiltradas.length}{" "}
                  {anotacoesFiltradas.length === 1
                    ? "lembrete no mural"
                    : "lembretes no mural"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {podeExcluirConfirmadas && (
                  <button
                    onClick={excluirAnotacoesConfirmadas}
                    className="flex h-10 items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 text-xs text-red-300 transition hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Limpar confirmadas</span>
                  </button>
                )}
                <button
                  onClick={abrirNovaAnotacao}
                  className="flex h-10 items-center gap-2 rounded-lg bg-orange-500 px-4 text-xs font-semibold text-white shadow-[0_8px_24px_rgba(249,115,22,.18)] transition hover:bg-orange-600"
                >
                  <Plus className="h-4 w-4" />
                  NOVA ANOTAÇÃO
                </button>
              </div>
            </div>

            <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_145px_145px_150px_155px]">
              <label className="flex h-10 items-center gap-2 rounded-lg border border-[#304961] bg-[#081625] px-3 focus-within:border-cyan-500/50">
                <Search className="h-4 w-4 text-slate-500" />
                <input
                  value={busca}
                  onChange={(event) => setBusca(event.target.value)}
                  placeholder="Buscar no mural..."
                  className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-slate-600"
                />
              </label>
              <label className="relative flex h-10 items-center rounded-lg border border-[#304961] bg-[#081625]">
                <select
                  value={filtroTipo}
                  onChange={(event) => setFiltroTipo(event.target.value)}
                  className="h-full w-full appearance-none bg-transparent px-3 pr-8 text-xs text-slate-200 outline-none"
                >
                  <option value="">Todos os tipos</option>
                  <option value="EP">EP</option>
                  <option value="Cartão">Cartão</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-slate-500" />
              </label>
              <label className="flex h-10 items-center gap-2 rounded-lg border border-[#304961] bg-[#081625] px-3">
                <Calendar className="h-4 w-4 text-slate-500" />
                <input
                  type="date"
                  value={filtroData}
                  onChange={(event) => setFiltroData(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-xs text-slate-300 outline-none [color-scheme:dark]"
                />
              </label>
              <label className="relative flex h-10 items-center rounded-lg border border-[#304961] bg-[#081625]">
                <Star className="pointer-events-none absolute left-3 h-4 w-4 text-slate-500" />
                <select
                  value={filtroDestaque}
                  onChange={(event) =>
                    setFiltroDestaque(event.target.value as HighlightFilter)
                  }
                  className="h-full w-full appearance-none bg-transparent pl-9 pr-8 text-xs text-slate-200 outline-none"
                >
                  <option value="todos">Todos</option>
                  <option value="importantes">Importantes</option>
                  <option value="fixados">Fixados</option>
                  <option value="pendentes">Pendentes</option>
                  <option value="confirmados">Confirmados</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-slate-500" />
              </label>
              <label className="relative flex h-10 items-center rounded-lg border border-[#304961] bg-[#081625]">
                <ArrowDownUp className="pointer-events-none absolute left-3 h-4 w-4 text-slate-500" />
                <select
                  value={ordenacao}
                  onChange={(event) =>
                    setOrdenacao(event.target.value as SortOrder)
                  }
                  className="h-full w-full appearance-none bg-transparent pl-9 pr-8 text-xs text-slate-200 outline-none"
                >
                  <option value="recentes">Mais recentes</option>
                  <option value="antigas">Mais antigas</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-slate-500" />
              </label>
            </div>

            <div
              ref={wallRef}
              className="anotacao-mural relative min-h-0 flex-1 overflow-y-auto rounded-xl border border-cyan-500/15 p-4 md:p-5"
              onClick={() => setOpenMenuId(null)}
            >
              {loading ? (
                <div className="grid h-full place-items-center">
                  <div className="flex flex-col items-center gap-3 text-sm text-slate-400">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
                    Organizando seu mural...
                  </div>
                </div>
              ) : anotacoesFiltradas.length === 0 ? (
                <div className="grid h-full min-h-64 place-items-center text-center">
                  <div>
                    <StickyNote className="mx-auto mb-3 h-12 w-12 text-slate-600" />
                    <p className="font-medium text-slate-300">
                      Nenhum lembrete nesta categoria
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Crie uma anotação para começar a preencher seu mural.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid auto-rows-fr grid-cols-1 gap-5 pb-16 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                  {anotacoesFiltradas.map((anotacao, index) => {
                    const category =
                      categorias.find(
                        (item) => item.value === anotacao.categoria,
                      ) || categoriaAtual;
                    const Icon = category?.icon || StickyNote;
                    const rotation = [-0.7, 0.45, -0.25, 0.65][index % 4];
                    return (
                      <article
                        key={anotacao.id}
                        className={`anotacao-postit ${resolvePostitPaper(
                          anotacao,
                          category?.paper,
                        )}`}
                        style={{ "--note-rotation": `${rotation}deg` } as React.CSSProperties}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="anotacao-postit__fold" />
                        {anotacao.fixado && (
                          <Pin className="anotacao-postit__pin h-5 w-5" />
                        )}
                        {index % 5 === 4 && (
                          <div className="anotacao-postit__tape" />
                        )}
                        <div className="mb-3 flex items-start justify-between gap-2">
                          <div className="grid h-8 w-8 place-items-center rounded-full bg-black/8">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="relative">
                            <button
                              onClick={() =>
                                setOpenMenuId(
                                  openMenuId === anotacao.id
                                    ? null
                                    : anotacao.id,
                                )
                              }
                              className="rounded-md p-1.5 text-current/70 transition hover:bg-black/10"
                              aria-label="Ações da anotação"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                            {openMenuId === anotacao.id && (
                              <div className="absolute right-0 top-8 z-20 w-52 overflow-hidden rounded-lg border border-slate-700 bg-[#07111f] py-1 text-xs text-slate-200 shadow-xl">
                                <button
                                  onClick={() => editarAnotacao(anotacao)}
                                  className="flex w-full items-center gap-2 px-3 py-2 hover:bg-white/5"
                                >
                                  <Edit3 className="h-3.5 w-3.5 text-blue-400" />
                                  Editar
                                </button>
                                <button
                                  onClick={() =>
                                    atualizarPreferencias(anotacao, {
                                      fixado: !anotacao.fixado,
                                    })
                                  }
                                  className="flex w-full items-center gap-2 px-3 py-2 hover:bg-white/5"
                                >
                                  <Pin className="h-3.5 w-3.5 text-cyan-400" />
                                  {anotacao.fixado
                                    ? "Desafixar do topo"
                                    : "Fixar no topo"}
                                </button>
                                <button
                                  onClick={() =>
                                    atualizarPreferencias(anotacao, {
                                      importante: !anotacao.importante,
                                    })
                                  }
                                  className="flex w-full items-center gap-2 px-3 py-2 hover:bg-white/5"
                                >
                                  <Star className="h-3.5 w-3.5 text-amber-400" />
                                  {anotacao.importante
                                    ? "Remover importância"
                                    : "Marcar importante"}
                                </button>
                                <div className="border-y border-white/5 px-3 py-2">
                                  <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-wide text-slate-500">
                                    <Palette className="h-3.5 w-3.5" />
                                    Cor do post-it
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {postitColors.map((color) => (
                                      <button
                                        key={color.value}
                                        onClick={() =>
                                          atualizarPreferencias(anotacao, {
                                            cor_postit: color.value,
                                          })
                                        }
                                        className={`h-5 w-5 rounded-full border ${color.swatch} ${
                                          (anotacao.cor_postit ||
                                            "automatico") === color.value
                                            ? "border-white ring-2 ring-cyan-400/50"
                                            : "border-black/20"
                                        }`}
                                        title={color.label}
                                        aria-label={`Usar cor ${color.label}`}
                                      />
                                    ))}
                                  </div>
                                </div>
                                {visao === "recebidas" &&
                                  !anotacao.confirmado && (
                                    <button
                                      onClick={() =>
                                        confirmarRecebimento(anotacao.id)
                                      }
                                      className="flex w-full items-center gap-2 px-3 py-2 hover:bg-white/5"
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                      Confirmar
                                    </button>
                                  )}
                                {podeExcluir(anotacao) && (
                                  <button
                                    onClick={() =>
                                      excluirAnotacao(anotacao.id)
                                    }
                                    className="flex w-full items-center gap-2 px-3 py-2 text-red-300 hover:bg-red-500/10"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Excluir
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mb-2 flex min-h-5 flex-wrap items-center gap-1.5">
                          {anotacao.importante && (
                            <span className="inline-flex items-center gap-1 rounded bg-orange-500/15 px-2 py-1 text-[9px] font-bold tracking-wide text-orange-800">
                              <Star className="h-3 w-3 fill-current" />
                              IMPORTANTE
                            </span>
                          )}
                          {anotacao.fixado && (
                            <span className="inline-flex items-center gap-1 rounded bg-cyan-700/10 px-2 py-1 text-[9px] font-bold tracking-wide text-cyan-900">
                              <Pin className="h-3 w-3" />
                              FIXADO
                            </span>
                          )}
                        </div>
                        <h4 className="line-clamp-2 pr-5 text-base font-bold">
                          {anotacao.titulo}
                        </h4>
                        <p className="mt-2 line-clamp-5 text-sm leading-relaxed opacity-80">
                          {anotacao.conteudo}
                        </p>

                        <div className="mt-auto space-y-1.5 pt-4 text-[10px] opacity-70">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3 w-3" />
                            {new Date(anotacao.data_criacao).toLocaleDateString(
                              "pt-BR",
                            )}
                          </div>
                          {anotacao.destinatario && (
                            <div className="flex items-start gap-1.5">
                              <Send className="mt-0.5 h-3 w-3 shrink-0" />
                              <span className="line-clamp-1">
                                Para: {anotacao.destinatario}
                              </span>
                            </div>
                          )}
                          {anotacao.usuario && (
                            <div className="line-clamp-1">
                              Enviado por: {anotacao.usuario}
                            </div>
                          )}
                        </div>

                        <div className="mt-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[9px] font-bold tracking-wide ${
                              anotacao.confirmado
                                ? "border-emerald-700/35 bg-emerald-600/10 text-emerald-800"
                                : "border-orange-700/35 bg-orange-500/10 text-orange-800"
                            }`}
                          >
                            {anotacao.confirmado ? (
                              <>
                                CONFIRMADO <Check className="h-3 w-3" />
                              </>
                            ) : (
                              "PENDENTE"
                            )}
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              {!loading && anotacoesFiltradas.length > 0 && (
                <div className="absolute bottom-3 left-4 flex max-w-[calc(100%-2rem)] items-center gap-2 rounded-lg border border-cyan-400/20 bg-[#06101d]/90 px-3 py-2 text-[10px] text-slate-400 backdrop-blur md:text-xs">
                  <Sparkles className="h-4 w-4 shrink-0 text-cyan-400" />
                  Aurora organizou seus lembretes por atualização mais recente.
                </div>
              )}
            </div>
          </main>

          {showForm && (
            <aside className="anotacao-drawer flex w-full max-w-[390px] shrink-0 flex-col border-l border-[#304961] bg-[#0a1728] max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:z-30 max-lg:shadow-[-24px_0_80px_rgba(0,0,0,.55)]">
              <div className="flex items-center justify-between border-b border-[#304961] p-5">
                <div>
                  <h3 className="font-semibold">
                    {editingId ? "Editar anotação" : "Nova anotação"}
                  </h3>
                  <p className="mt-1 text-[10px] tracking-[0.16em] text-slate-500">
                    REGISTRO PESSOAL
                  </p>
                </div>
                <button
                  onClick={resetForm}
                  className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-5">
                <Field label="Categoria">
                  <select
                    value={formData.categoria}
                    onChange={(event) =>
                      setFormData({
                        ...formData,
                        categoria: event.target.value,
                      })
                    }
                    className="anotacao-field"
                  >
                    {categorias.map((categoria) => (
                      <option key={categoria.value} value={categoria.value}>
                        {categoria.label}
                      </option>
                    ))}
                  </select>
                </Field>

                {formData.categoria === "envio_manual" && (
                  <>
                    <Field label="Grupo Destinatário">
                      <select
                        value={formData.destinatario}
                        onChange={(event) =>
                          setFormData({
                            ...formData,
                            destinatario: event.target.value,
                          })
                        }
                        className="anotacao-field"
                      >
                        <option value="">Selecione um grupo...</option>
                        {centroCusto === "BANCOALFA FIXA" && (
                          <option value="BancoAlfa - WhatsApp">
                            BancoAlfa - WhatsApp
                          </option>
                        )}
                        {[
                          "BANCO DELTA",
                          "BANCO DELTA DIGITAL",
                        ].includes(centroCusto) && (
                          <>
                            <option value="Delta - Whatsapp">
                              Banco Delta - WhatsApp
                            </option>
                            <option value="Delta - Proposta">
                              Banco Delta - Proposta
                            </option>
                          </>
                        )}
                        {centroCusto === "ANTARES" && (
                          <option value="ANTARES">ANTARES</option>
                        )}
                        {centroCusto === "PROJETO - ZETA" && (
                          <option value="PROJETO - ZETA">ZETA</option>
                        )}
                      </select>
                    </Field>

                    {centroCusto === "BANCOALFA FIXA" && (
                      <Field label="Tipo de Boleto">
                        <select
                          value={formData.tipo_boleto}
                          onChange={(event) =>
                            setFormData({
                              ...formData,
                              tipo_boleto: event.target.value,
                            })
                          }
                          className="anotacao-field"
                        >
                          <option value="">Selecione...</option>
                          <option value="EP">EP</option>
                          <option value="Cartão">Cartão</option>
                        </select>
                      </Field>
                    )}

                    {formData.destinatario === "Delta - Proposta" && (
                      <Field label="Valor da Proposta">
                        <input
                          type="number"
                          step="0.01"
                          value={formData.valor_proposta}
                          onChange={(event) =>
                            setFormData({
                              ...formData,
                              valor_proposta: event.target.value,
                            })
                          }
                          placeholder="Digite o valor"
                          className="anotacao-field"
                        />
                      </Field>
                    )}

                    <Field label="Data de Vencimento">
                      <input
                        type="date"
                        value={formData.data_vencimento}
                        onChange={(event) =>
                          setFormData({
                            ...formData,
                            data_vencimento: event.target.value,
                          })
                        }
                        className="anotacao-field [color-scheme:dark]"
                      />
                    </Field>
                  </>
                )}

                <Field label="Título">
                  <input
                    value={formData.titulo}
                    onChange={(event) =>
                      setFormData({
                        ...formData,
                        titulo: event.target.value,
                      })
                    }
                    placeholder="Digite o título"
                    className="anotacao-field"
                    maxLength={120}
                  />
                </Field>

                <Field label="Conteúdo">
                  <textarea
                    value={formData.conteudo}
                    onChange={(event) =>
                      setFormData({
                        ...formData,
                        conteudo: event.target.value,
                      })
                    }
                    placeholder="Digite sua anotação..."
                    rows={9}
                    maxLength={500}
                    className="anotacao-field resize-none"
                  />
                  <span className="mt-1 block text-right text-[10px] text-slate-500">
                    {formData.conteudo.length} / 500
                  </span>
                </Field>

                <div className="rounded-xl border border-[#304961] bg-[#071421] p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Palette className="h-4 w-4 text-orange-400" />
                    <div>
                      <p className="text-xs font-medium text-slate-200">
                        Aparência e prioridade
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        Personalize como o lembrete aparece no mural.
                      </p>
                    </div>
                  </div>

                  <span className="mb-2 block text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    Cor do post-it
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    {postitColors.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            cor_postit: color.value,
                          })
                        }
                        className={`flex flex-col items-center gap-1.5 rounded-lg border px-1 py-2 text-[9px] transition ${
                          formData.cor_postit === color.value
                            ? "border-cyan-400/60 bg-cyan-400/5 text-cyan-200"
                            : "border-[#2d435a] text-slate-500 hover:border-slate-500"
                        }`}
                      >
                        <span
                          className={`h-6 w-6 rounded-md border border-black/20 shadow-sm ${color.swatch}`}
                        />
                        {color.label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 grid gap-2">
                    <PreferenceToggle
                      active={formData.importante}
                      icon={<Star className="h-4 w-4" />}
                      title="Marcar como importante"
                      description="Destaca o lembrete visualmente."
                      onClick={() =>
                        setFormData({
                          ...formData,
                          importante: !formData.importante,
                        })
                      }
                    />
                    <PreferenceToggle
                      active={formData.fixado}
                      icon={<Pin className="h-4 w-4" />}
                      title="Fixar no topo do mural"
                      description="Mantém o post-it antes dos demais."
                      onClick={() =>
                        setFormData({
                          ...formData,
                          fixado: !formData.fixado,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="flex items-start gap-2 rounded-lg border border-cyan-400/15 bg-cyan-400/5 p-3 text-xs leading-relaxed text-slate-400">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                  Organize o registro com um título curto e objetivo.
                </div>
              </div>

              <div className="grid grid-cols-[auto_1fr] gap-2 border-t border-[#304961] p-4">
                <button
                  onClick={resetForm}
                  className="rounded-lg border border-[#405870] px-4 py-2.5 text-xs font-medium text-slate-300 hover:bg-white/5"
                >
                  CANCELAR
                </button>
                <button
                  onClick={salvarAnotacao}
                  disabled={loading}
                  className="flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {loading ? "SALVANDO..." : "SALVAR ANOTAÇÃO"}
                </button>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
};

const Field: React.FC<{
  label: string;
  children: React.ReactNode;
}> = ({ label, children }) => (
  <label className="block">
    <span className="mb-1.5 block text-xs font-medium text-slate-300">
      {label}
    </span>
    {children}
  </label>
);

const PreferenceToggle: React.FC<{
  active: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}> = ({ active, icon, title, description, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-3 rounded-lg border p-3 text-left transition ${
      active
        ? "border-orange-500/45 bg-orange-500/[0.08]"
        : "border-[#2d435a] bg-[#081625] hover:border-slate-500"
    }`}
  >
    <span
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
        active
          ? "bg-orange-500 text-white"
          : "bg-white/5 text-slate-500"
      }`}
    >
      {icon}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-xs font-medium text-slate-200">{title}</span>
      <span className="mt-0.5 block text-[10px] text-slate-500">
        {description}
      </span>
    </span>
    <span
      className={`relative h-5 w-9 rounded-full transition ${
        active ? "bg-orange-500" : "bg-slate-700"
      }`}
      aria-hidden="true"
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${
          active ? "left-[18px]" : "left-0.5"
        }`}
      />
    </span>
  </button>
);

export default AnotacaoModal;
