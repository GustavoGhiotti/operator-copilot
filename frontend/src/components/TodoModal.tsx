import React, {
  DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Archive,
  Bell,
  BellRing,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  Columns3,
  FileText,
  Filter,
  FolderKanban,
  History,
  LayoutDashboard,
  Link2,
  List,
  ListChecks,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Plus,
  Repeat2,
  Search,
  Send,
  Settings2,
  Star,
  Trash2,
  UserPlus,
  Users,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  addDays,
  addMonths,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";

import tarefasApi, {
  AnexoTarefa,
  ChecklistItem,
  ComentarioTarefa,
  DetalhesTarefa,
  EquipeTarefas,
  HistoricoTarefa,
  MembroEquipe,
  NotificacaoTarefa,
  OperadorEquipe,
  RecorrenciaTipo,
  ListaOrganizador,
  QuadroTarefas,
  TarefaKanban,
  TarefaPayload,
  TarefaPrioridade,
  TarefaStatus,
  VisaoTarefas,
} from "@/services/tarefasApi";

interface TodoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ModoVisualizacao =
  | "visao_geral"
  | "quadro"
  | "lista"
  | "calendario";
type SecaoLateral =
  | "visao_geral"
  | "quadros"
  | "minhas"
  | "calendario"
  | "atrasadas";

interface FormTarefa {
  titulo: string;
  descricao: string;
  categoria: string;
  prioridade: TarefaPrioridade;
  data_vencimento: string;
  hora_vencimento: string;
  cpf_responsavel: string;
  checklist: ChecklistItem[];
  recorrencia_tipo: RecorrenciaTipo;
  recorrencia_intervalo: number;
  recorrencia_ate: string;
  lembrete_minutos: number | null;
}

const etapas: Array<{
  status: TarefaStatus;
  titulo: string;
  cor: string;
}> = [
  { status: "caixa_entrada", titulo: "CAIXA DE ENTRADA", cor: "#94a3b8" },
  { status: "para_hoje", titulo: "PARA HOJE", cor: "#f59e0b" },
  { status: "em_andamento", titulo: "EM ANDAMENTO", cor: "#38bdf8" },
  { status: "aguardando", titulo: "AGUARDANDO", cor: "#a78bfa" },
  { status: "concluido", titulo: "CONCLUÍDO", cor: "#34d399" },
];

const nomesStatus: Record<TarefaStatus, string> = {
  caixa_entrada: "Caixa de entrada",
  para_hoje: "Para hoje",
  em_andamento: "Em andamento",
  aguardando: "Aguardando",
  concluido: "Concluído",
};

const prioridades: Array<{ value: TarefaPrioridade; label: string }> = [
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" },
];

const categorias = [
  "Operação",
  "Cliente",
  "Retorno",
  "Treinamento",
  "Financeiro",
  "Tecnologia",
  "Pessoal",
];

const formInicial = (): FormTarefa => ({
  titulo: "",
  descricao: "",
  categoria: "Operação",
  prioridade: "media",
  data_vencimento: "",
  hora_vencimento: "",
  cpf_responsavel: "",
  checklist: [],
  recorrencia_tipo: "nenhuma",
  recorrencia_intervalo: 1,
  recorrencia_ate: "",
  lembrete_minutos: null,
});

const detalhesIniciais: DetalhesTarefa = {
  comentarios: [],
  historico: [],
  anexos: [],
};

const erroMensagem = (erro: unknown, fallback: string) => {
  const resposta = erro as { response?: { data?: { erro?: string } } };
  return resposta.response?.data?.erro || fallback;
};

const iniciais = (nome: string) =>
  nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join("")
    .toUpperCase();

const isoData = (data?: string | null) => data?.slice(0, 10) || "";

const formatarData = (data?: string | null) => {
  if (!data) return "Sem prazo";
  return new Intl.DateTimeFormat("pt-BR").format(
    new Date(`${isoData(data)}T12:00:00`)
  );
};

const formatarMomento = (data?: string | null) => {
  if (!data) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(data));
};

const TodoModal: React.FC<TodoModalProps> = ({ isOpen, onClose }) => {
  const [quadro, setQuadro] = useState<QuadroTarefas | null>(null);
  const [visao, setVisao] = useState<VisaoTarefas>("pessoal");
  const [equipeAtiva, setEquipeAtiva] = useState("");
  const [secao, setSecao] = useState<SecaoLateral>("quadros");
  const [modo, setModo] = useState<ModoVisualizacao>("quadro");
  const [busca, setBusca] = useState("");
  const [filtroPrioridade, setFiltroPrioridade] = useState("todas");
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [arrastando, setArrastando] = useState<number | null>(null);

  const [tarefaSelecionada, setTarefaSelecionada] =
    useState<TarefaKanban | null>(null);
  const [detalhes, setDetalhes] = useState<DetalhesTarefa>(detalhesIniciais);
  const [loadingDetalhes, setLoadingDetalhes] = useState(false);
  const [comentario, setComentario] = useState("");
  const [mostrarAnexo, setMostrarAnexo] = useState(false);
  const [anexoNome, setAnexoNome] = useState("");
  const [anexoUrl, setAnexoUrl] = useState("");

  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<TarefaKanban | null>(null);
  const [statusNovaTarefa, setStatusNovaTarefa] =
    useState<TarefaStatus>("caixa_entrada");
  const [listaNovaTarefa, setListaNovaTarefa] = useState("");
  const [form, setForm] = useState<FormTarefa>(formInicial);
  const [novoChecklist, setNovoChecklist] = useState("");
  const [notificacoes, setNotificacoes] = useState<NotificacaoTarefa[]>([]);
  const [notificacoesAbertas, setNotificacoesAbertas] = useState(false);

  const [gestaoAberta, setGestaoAberta] = useState(false);
  const [gerenciandoEquipe, setGerenciandoEquipe] = useState("");
  const [nomeEquipe, setNomeEquipe] = useState("");
  const [centroCusto, setCentroCusto] = useState("");
  const [buscaOperador, setBuscaOperador] = useState("");
  const [operadores, setOperadores] = useState<OperadorEquipe[]>([]);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [membros, setMembros] = useState<MembroEquipe[]>([]);
  const [criacaoRapida, setCriacaoRapida] = useState<
    "quadro" | "lista" | null
  >(null);
  const [nomeCriacao, setNomeCriacao] = useState("");
  const [corCriacao, setCorCriacao] = useState("#38bdf8");

  const carregarNotificacoes = useCallback(async () => {
    try {
      setNotificacoes(await tarefasApi.listarNotificacoes());
    } catch (erro) {
      console.error("Não foi possível carregar notificações de tarefas.", erro);
    }
  }, []);

  const carregar = useCallback(
    async (
      proximaVisao: VisaoTarefas,
      proximaEquipe = "",
      proximoQuadro = ""
    ) => {
      try {
        setLoading(true);
        const dados = await tarefasApi.carregarQuadro(
          proximaVisao,
          proximaVisao === "equipe" ? proximaEquipe : undefined,
          proximaVisao === "quadro" ? proximoQuadro : undefined
        );
        setQuadro(dados);
      } catch (erro) {
        toast.error(
          erroMensagem(erro, "Não foi possível carregar suas tarefas.")
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!isOpen) return;
    setVisao("pessoal");
    setEquipeAtiva("");
    setSecao("visao_geral");
    setModo("visao_geral");
    setTarefaSelecionada(null);
    void carregar("pessoal");
    void carregarNotificacoes();
    const intervalo = window.setInterval(
      () => void carregarNotificacoes(),
      60000
    );
    return () => window.clearInterval(intervalo);
  }, [carregar, carregarNotificacoes, isOpen]);

  useEffect(() => {
    if (quadro?.usuario.centro_custo && !centroCusto) {
      setCentroCusto(quadro.usuario.centro_custo);
    }
  }, [centroCusto, quadro?.usuario.centro_custo]);

  useEffect(() => {
    if (
      !isOpen ||
      !(
        visao === "equipe" ||
        (visao === "quadro" &&
          quadro?.quadro_ativo?.tipo === "EQUIPE")
      ) ||
      !(quadro?.quadro_ativo?.equipe_id || equipeAtiva) ||
      !quadro?.usuario.supervisor
    ) {
      return;
    }
    tarefasApi
      .listarMembros(
        quadro?.quadro_ativo?.equipe_id || equipeAtiva
      )
      .then(setMembros)
      .catch((erro) =>
        toast.error(
          erroMensagem(erro, "Não foi possível carregar os integrantes.")
        )
      );
  }, [
    equipeAtiva,
    isOpen,
    quadro?.quadro_ativo?.equipe_id,
    quadro?.quadro_ativo?.tipo,
    quadro?.usuario.supervisor,
    visao,
  ]);

  const hoje = format(new Date(), "yyyy-MM-dd");
  const equipeSelecionada = quadro?.equipes.find(
    (equipe) =>
      equipe.id ===
      (quadro?.quadro_ativo?.equipe_id || equipeAtiva)
  );

  const tarefasFiltradas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return (quadro?.tarefas || []).filter((tarefa) => {
      const correspondeBusca =
        !termo ||
        tarefa.titulo.toLocaleLowerCase("pt-BR").includes(termo) ||
        tarefa.descricao.toLocaleLowerCase("pt-BR").includes(termo) ||
        tarefa.categoria.toLocaleLowerCase("pt-BR").includes(termo) ||
        tarefa.responsavel_nome.toLocaleLowerCase("pt-BR").includes(termo);
      const correspondePrioridade =
        filtroPrioridade === "todas" ||
        tarefa.prioridade === filtroPrioridade;
      const correspondeSecao =
        secao !== "atrasadas" ||
        Boolean(
          tarefa.data_vencimento &&
            isoData(tarefa.data_vencimento) < hoje &&
            tarefa.status !== "concluido"
        );
      return (
        correspondeBusca && correspondePrioridade && correspondeSecao
      );
    });
  }, [busca, filtroPrioridade, hoje, quadro?.tarefas, secao]);

  const atrasadas = useMemo(
    () =>
      (quadro?.tarefas || []).filter(
        (tarefa) =>
          tarefa.data_vencimento &&
          isoData(tarefa.data_vencimento) < hoje &&
          tarefa.status !== "concluido"
      ).length,
    [hoje, quadro?.tarefas]
  );

  const tituloQuadro =
    modo === "visao_geral"
      ? "Visão geral"
      : secao === "atrasadas"
      ? "Tarefas atrasadas"
      : visao === "atribuidas"
        ? "Atribuídas a mim"
        : quadro?.quadro_ativo?.nome ||
          equipeSelecionada?.nome ||
          "Meu planejamento";
  const quadroAtivoId = quadro?.quadro_ativo?.id || "";
  const recarregarAtual = () =>
    carregar(visao, equipeAtiva, quadroAtivoId);

  const carregarDetalhes = async (tarefa: TarefaKanban) => {
    try {
      setLoadingDetalhes(true);
      setDetalhes(await tarefasApi.carregarDetalhes(tarefa.id));
    } catch (erro) {
      toast.error(
        erroMensagem(erro, "Não foi possível carregar os detalhes.")
      );
    } finally {
      setLoadingDetalhes(false);
    }
  };

  const abrirTarefa = (tarefa: TarefaKanban) => {
    setTarefaSelecionada(tarefa);
    setDetalhes(detalhesIniciais);
    void carregarDetalhes(tarefa);
  };

  const navegar = async (
    proximaVisao: VisaoTarefas,
    equipeId = "",
    proximaSecao: SecaoLateral = "quadros",
    quadroId = ""
  ) => {
    setVisao(proximaVisao);
    setEquipeAtiva(equipeId);
    setSecao(proximaSecao);
    setModo("quadro");
    if (proximaVisao === "pessoal" || proximaVisao === "atribuidas") {
      setMembros([]);
    }
    setTarefaSelecionada(null);
    await carregar(proximaVisao, equipeId, quadroId);
  };

  const mover = async (
    id: number,
    status: TarefaStatus,
    lista?: ListaOrganizador
  ) => {
    if (!quadro) return;
    const anterior = quadro;
    setQuadro({
      ...quadro,
      tarefas: quadro.tarefas.map((tarefa) =>
        tarefa.id === id
          ? {
              ...tarefa,
              status,
              lista_id: lista?.id || tarefa.lista_id,
              lista_nome: lista?.nome || tarefa.lista_nome,
              lista_cor: lista?.cor || tarefa.lista_cor,
            }
          : tarefa
      ),
    });
    if (tarefaSelecionada?.id === id) {
      setTarefaSelecionada({
        ...tarefaSelecionada,
        status,
        lista_id: lista?.id || tarefaSelecionada.lista_id,
        lista_nome: lista?.nome || tarefaSelecionada.lista_nome,
        lista_cor: lista?.cor || tarefaSelecionada.lista_cor,
      });
    }
    try {
      await tarefasApi.moverTarefa(id, status, 0, lista?.id);
      const tarefaMovida = quadro.tarefas.find((item) => item.id === id);
      if (
        status === "concluido" &&
        tarefaMovida?.recorrencia_tipo &&
        tarefaMovida.recorrencia_tipo !== "nenhuma"
      ) {
        await recarregarAtual();
        await carregarNotificacoes();
      }
      if (tarefaSelecionada?.id === id) {
        await carregarDetalhes({ ...tarefaSelecionada, status });
      }
    } catch (erro) {
      setQuadro(anterior);
      toast.error(erroMensagem(erro, "Não foi possível mover a tarefa."));
    }
  };

  const reagendar = async (
    tarefa: TarefaKanban,
    dataVencimento: string,
    horaVencimento?: string | null
  ) => {
    if (!quadro) return;
    const anterior = quadro;
    const horaNormalizada = horaVencimento || null;
    const atualizada = {
      ...tarefa,
      data_vencimento: dataVencimento,
      hora_vencimento: horaNormalizada,
    };
    setQuadro({
      ...quadro,
      tarefas: quadro.tarefas.map((item) =>
        item.id === tarefa.id ? atualizada : item
      ),
    });
    if (tarefaSelecionada?.id === tarefa.id) {
      setTarefaSelecionada(atualizada);
    }
    try {
      await tarefasApi.reagendarTarefa(
        tarefa.id,
        dataVencimento,
        horaNormalizada
      );
      toast.success("Tarefa reagendada.");
      if (tarefaSelecionada?.id === tarefa.id) {
        await carregarDetalhes(atualizada);
      }
    } catch (erro) {
      setQuadro(anterior);
      if (tarefaSelecionada?.id === tarefa.id) {
        setTarefaSelecionada(tarefa);
      }
      toast.error(
        erroMensagem(erro, "Não foi possível reagendar a tarefa.")
      );
    }
  };

  const soltar = (
    evento: DragEvent<HTMLDivElement>,
    lista: ListaOrganizador
  ) => {
    evento.preventDefault();
    const id = Number(
      evento.dataTransfer.getData("text/tarefa") || arrastando
    );
    setArrastando(null);
    if (id) {
      void mover(
        id,
        lista.status_base || "caixa_entrada",
        lista
      );
    }
  };

  const abrirNovaTarefa = (
    lista?: ListaOrganizador,
    dataVencimento = "",
    horaVencimento = ""
  ) => {
    setEditando(null);
    setStatusNovaTarefa(lista?.status_base || "caixa_entrada");
    setListaNovaTarefa(lista?.id || quadro?.listas[0]?.id || "");
    setForm({
      ...formInicial(),
      data_vencimento: dataVencimento,
      hora_vencimento: horaVencimento,
      cpf_responsavel:
        (visao === "equipe" ||
          quadro?.quadro_ativo?.tipo === "EQUIPE") &&
        quadro?.usuario.supervisor
          ? ""
          : quadro?.usuario.cpf || "",
    });
    setNovoChecklist("");
    setFormAberto(true);
  };

  const abrirEdicao = () => {
    if (!tarefaSelecionada) return;
    setEditando(tarefaSelecionada);
    setStatusNovaTarefa(tarefaSelecionada.status);
    setListaNovaTarefa(tarefaSelecionada.lista_id || "");
    setForm({
      titulo: tarefaSelecionada.titulo,
      descricao: tarefaSelecionada.descricao,
      categoria: tarefaSelecionada.categoria,
      prioridade: tarefaSelecionada.prioridade,
      data_vencimento: isoData(tarefaSelecionada.data_vencimento),
      hora_vencimento:
        tarefaSelecionada.hora_vencimento?.slice(0, 5) || "",
      cpf_responsavel: tarefaSelecionada.cpf_responsavel,
      checklist: tarefaSelecionada.checklist.map((item) => ({ ...item })),
      recorrencia_tipo:
        tarefaSelecionada.recorrencia_tipo || "nenhuma",
      recorrencia_intervalo:
        tarefaSelecionada.recorrencia_intervalo || 1,
      recorrencia_ate: isoData(tarefaSelecionada.recorrencia_ate),
      lembrete_minutos:
        tarefaSelecionada.lembrete_minutos || null,
    });
    setFormAberto(true);
  };

  const salvarTarefa = async () => {
    if (!form.titulo.trim()) {
      toast.error("Informe o título da tarefa.");
      return;
    }
    if (
      form.recorrencia_tipo !== "nenhuma" &&
      !form.data_vencimento
    ) {
      toast.error("Informe a data inicial da tarefa recorrente.");
      return;
    }
    if (form.lembrete_minutos && !form.data_vencimento) {
      toast.error("Informe uma data para utilizar o lembrete.");
      return;
    }
    if (
      !editando &&
      (visao === "equipe" ||
        quadro?.quadro_ativo?.tipo === "EQUIPE") &&
      quadro?.usuario.supervisor &&
      !form.cpf_responsavel
    ) {
      toast.error("Selecione o responsável pela demanda.");
      return;
    }
    const payload: TarefaPayload = {
      ...form,
      status: statusNovaTarefa,
      quadro_id: quadroAtivoId || undefined,
      lista_id: listaNovaTarefa || undefined,
      equipe_id:
        (visao === "equipe" ||
          quadro?.quadro_ativo?.tipo === "EQUIPE") &&
        form.cpf_responsavel !== quadro?.usuario.cpf
          ? quadro?.quadro_ativo?.equipe_id || equipeAtiva
          : undefined,
      checklist: form.checklist,
    };
    try {
      setSalvando(true);
      if (editando) {
        await tarefasApi.atualizarTarefa(editando.id, payload);
        toast.success("Tarefa atualizada.");
      } else {
        await tarefasApi.criarTarefa(payload);
        toast.success("Tarefa criada.");
      }
      setFormAberto(false);
      setTarefaSelecionada(null);
      await recarregarAtual();
    } catch (erro) {
      toast.error(erroMensagem(erro, "Não foi possível salvar a tarefa."));
    } finally {
      setSalvando(false);
    }
  };

  const alternarChecklist = async (indice: number) => {
    if (!tarefaSelecionada) return;
    const checklist = tarefaSelecionada.checklist.map((item, posicao) =>
      posicao === indice
        ? { ...item, concluido: !item.concluido }
        : item
    );
    const atualizado = {
      ...tarefaSelecionada,
      checklist,
      checklist_concluido: checklist.filter((item) => item.concluido).length,
    };
    setTarefaSelecionada(atualizado);
    try {
      await tarefasApi.atualizarChecklist(atualizado.id, checklist);
      setQuadro((atual) =>
        atual
          ? {
              ...atual,
              tarefas: atual.tarefas.map((tarefa) =>
                tarefa.id === atualizado.id ? atualizado : tarefa
              ),
            }
          : atual
      );
    } catch (erro) {
      toast.error(
        erroMensagem(erro, "Não foi possível atualizar o checklist.")
      );
      await recarregarAtual();
    }
  };

  const enviarComentario = async () => {
    if (!tarefaSelecionada || !comentario.trim()) return;
    try {
      setSalvando(true);
      await tarefasApi.adicionarComentario(
        tarefaSelecionada.id,
        comentario.trim()
      );
      setComentario("");
      await carregarDetalhes(tarefaSelecionada);
      await recarregarAtual();
    } catch (erro) {
      toast.error(
        erroMensagem(erro, "Não foi possível enviar o comentário.")
      );
    } finally {
      setSalvando(false);
    }
  };

  const adicionarAnexo = async () => {
    if (!tarefaSelecionada) return;
    try {
      setSalvando(true);
      await tarefasApi.adicionarAnexo(
        tarefaSelecionada.id,
        anexoNome,
        anexoUrl
      );
      setAnexoNome("");
      setAnexoUrl("");
      setMostrarAnexo(false);
      await carregarDetalhes(tarefaSelecionada);
      await recarregarAtual();
      toast.success("Anexo adicionado.");
    } catch (erro) {
      toast.error(erroMensagem(erro, "Não foi possível adicionar o anexo."));
    } finally {
      setSalvando(false);
    }
  };

  const alterarAutomacao = async () => {
    if (!tarefaSelecionada) return;
    const ativa = !tarefaSelecionada.sugerir_finalizacao;
    setTarefaSelecionada({
      ...tarefaSelecionada,
      sugerir_finalizacao: ativa,
    });
    try {
      await tarefasApi.atualizarAutomacao(tarefaSelecionada.id, ativa);
      await carregarDetalhes(tarefaSelecionada);
    } catch (erro) {
      setTarefaSelecionada({
        ...tarefaSelecionada,
        sugerir_finalizacao: !ativa,
      });
      toast.error(erroMensagem(erro, "Não foi possível alterar a automação."));
    }
  };

  const arquivarTarefa = async () => {
    if (
      !tarefaSelecionada ||
      !window.confirm(`Arquivar "${tarefaSelecionada.titulo}"?`)
    ) {
      return;
    }
    try {
      await tarefasApi.arquivarTarefa(tarefaSelecionada.id);
      setTarefaSelecionada(null);
      await recarregarAtual();
      toast.success("Tarefa arquivada.");
    } catch (erro) {
      toast.error(erroMensagem(erro, "Não foi possível arquivar a tarefa."));
    }
  };

  const abrirGestao = async (equipe?: EquipeTarefas) => {
    setGestaoAberta(true);
    setSelecionados([]);
    setOperadores([]);
    if (equipe) {
      setGerenciandoEquipe(equipe.id);
      setNomeEquipe(equipe.nome);
      setCentroCusto(
        equipe.centro_custo || quadro?.usuario.centro_custo || ""
      );
      try {
        setMembros(await tarefasApi.listarMembros(equipe.id));
      } catch (erro) {
        toast.error(erroMensagem(erro, "Não foi possível carregar a equipe."));
      }
    } else {
      setGerenciandoEquipe("");
      setNomeEquipe("");
      setMembros([]);
    }
  };

  const pesquisarOperadores = async () => {
    try {
      setOperadores(
        await tarefasApi.pesquisarOperadores(
          buscaOperador.trim() || undefined,
          buscaOperador.trim() ? undefined : centroCusto.trim()
        )
      );
    } catch (erro) {
      toast.error(
        erroMensagem(erro, "Não foi possível localizar operadores.")
      );
    }
  };

  const salvarEquipe = async () => {
    try {
      setSalvando(true);
      let idEquipe = gerenciandoEquipe;
      if (!idEquipe) {
        if (!nomeEquipe.trim()) {
          toast.error("Informe o nome da equipe.");
          return;
        }
        const response = await tarefasApi.criarEquipe(
          nomeEquipe,
          centroCusto
        );
        idEquipe = response.data.id;
        setGerenciandoEquipe(idEquipe);
      }
      if (selecionados.length) {
        await tarefasApi.enviarConvites(idEquipe, selecionados);
      }
      setMembros(await tarefasApi.listarMembros(idEquipe));
      setSelecionados([]);
      await recarregarAtual();
      toast.success("Equipe atualizada.");
    } catch (erro) {
      toast.error(erroMensagem(erro, "Não foi possível salvar a equipe."));
    } finally {
      setSalvando(false);
    }
  };

  const removerMembroEquipe = async (membro: MembroEquipe) => {
    if (
      !gerenciandoEquipe ||
      !window.confirm(`Remover ${membro.nome} desta equipe?`)
    ) {
      return;
    }
    try {
      await tarefasApi.removerMembro(gerenciandoEquipe, membro.cpf);
      setMembros(await tarefasApi.listarMembros(gerenciandoEquipe));
      await recarregarAtual();
      toast.success("Membro removido.");
    } catch (erro) {
      toast.error(
        erroMensagem(erro, "Não foi possível remover o membro.")
      );
    }
  };

  const responderConvite = async (equipeId: string, aceitar: boolean) => {
    try {
      await tarefasApi.responderConvite(equipeId, aceitar);
      await recarregarAtual();
      toast.success(aceitar ? "Convite aceito." : "Convite recusado.");
    } catch (erro) {
      toast.error(
        erroMensagem(erro, "Não foi possível responder ao convite.")
      );
    }
  };

  const concluirCriacaoRapida = async () => {
    if (!nomeCriacao.trim()) {
      toast.error(
        criacaoRapida === "quadro"
          ? "Informe o nome do quadro."
          : "Informe o nome da lista."
      );
      return;
    }
    try {
      setSalvando(true);
      if (criacaoRapida === "quadro") {
        const response = await tarefasApi.criarQuadro(
          nomeCriacao.trim(),
          corCriacao
        );
        setCriacaoRapida(null);
        await navegar("quadro", "", "quadros", response.data.id);
        toast.success("Quadro criado.");
      } else if (criacaoRapida === "lista" && quadroAtivoId) {
        await tarefasApi.criarLista(
          quadroAtivoId,
          nomeCriacao.trim(),
          corCriacao
        );
        setCriacaoRapida(null);
        await recarregarAtual();
        toast.success("Lista criada.");
      }
    } catch (erro) {
      toast.error(
        erroMensagem(erro, "Não foi possível concluir a criação.")
      );
    } finally {
      setSalvando(false);
    }
  };

  const abrirNotificacao = async (notificacao: NotificacaoTarefa) => {
    if (!notificacao.lida) {
      setNotificacoes((atuais) =>
        atuais.map((item) =>
          item.id === notificacao.id ? { ...item, lida: true } : item
        )
      );
      try {
        await tarefasApi.marcarNotificacoesLidas(notificacao.id);
      } catch (erro) {
        console.error("Não foi possível marcar a notificação.", erro);
      }
    }
    if (notificacao.id_todo) {
      const tarefa = quadro?.tarefas.find(
        (item) => item.id === notificacao.id_todo
      );
      if (tarefa) {
        setNotificacoesAbertas(false);
        abrirTarefa(tarefa);
      } else {
        toast.info(
          "A tarefa está em outro quadro. Abra o quadro correspondente para visualizá-la."
        );
      }
    }
  };

  const marcarTodasNotificacoes = async () => {
    setNotificacoes((atuais) =>
      atuais.map((item) => ({ ...item, lida: true }))
    );
    try {
      await tarefasApi.marcarNotificacoesLidas();
    } catch (erro) {
      toast.error(
        erroMensagem(erro, "Não foi possível atualizar as notificações.")
      );
      await carregarNotificacoes();
    }
  };

  if (!isOpen) return null;

  const podeEditar =
    Boolean(tarefaSelecionada) &&
    tarefaSelecionada?.cpf_criador === quadro?.usuario.cpf;
  const membrosAceitos = membros.filter(
    (membro) => membro.status === "ACEITO"
  );
  const notificacoesNaoLidas = notificacoes.filter(
    (notificacao) => !notificacao.lida
  ).length;

  return (
    <div className="tarefas-shell fixed inset-0 z-[70] overflow-hidden bg-[#020711] text-slate-100">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_38%_20%,rgba(14,116,144,.09),transparent_32%),radial-gradient(circle_at_82%_88%,rgba(249,115,22,.07),transparent_30%)]" />
      <div className="relative flex h-full min-h-0 w-full overflow-hidden">
        <aside
          className="flex h-full min-h-0 w-[190px] shrink-0 flex-col border-r border-slate-800/90 bg-[#030916]/95"
          style={{ flexBasis: 190 }}
        >
          <div className="flex h-[76px] items-center border-b border-slate-800/80 px-5">
            <img
              src="/images/AcmeLogoBranco.png"
              alt="Grupo Acme"
              className="h-8 w-auto object-contain"
            />
          </div>

          <nav className="space-y-1 p-3" data-tour="tarefas-menu">
            <SidebarButton
              icon={LayoutDashboard}
              label="Visão geral"
              active={modo === "visao_geral"}
              onClick={() => {
                setSecao("visao_geral");
                setModo("visao_geral");
              }}
            />
            <SidebarButton
              icon={FolderKanban}
              label="Meus quadros"
              dataTour="tarefas-quadros"
              active={secao === "quadros"}
              onClick={() => void navegar("pessoal", "", "quadros")}
            />
            <SidebarButton
              icon={CheckCircle2}
              label="Minhas tarefas"
              active={secao === "minhas"}
              onClick={() => void navegar("atribuidas", "", "minhas")}
            />
            <SidebarButton
              icon={CalendarDays}
              label="Calendário"
              active={secao === "calendario"}
              onClick={() => {
                setSecao("calendario");
                setModo("calendario");
              }}
            />
            <SidebarButton
              icon={Clock3}
              label="Atrasadas"
              active={secao === "atrasadas"}
              badge={atrasadas || undefined}
              onClick={() => setSecao("atrasadas")}
            />
          </nav>

          <div className="mx-3 border-t border-slate-800" />
          <div className="min-h-0 flex-1 overflow-y-auto p-3 tarefas-scroll">
            <p className="px-2 pb-2 pt-1 text-[9px] font-bold uppercase tracking-[.18em] text-slate-600">
              Quadros favoritos
            </p>
            {quadro?.quadros
              .filter((item) => item.favorito)
              .map((item) => (
              <BoardLink
                key={item.id}
                initials={iniciais(item.nome)}
                color=""
                customColor={item.cor}
                label={item.nome}
                active={quadro.quadro_ativo?.id === item.id}
                favorite
                onClick={() =>
                  void navegar("quadro", "", "quadros", item.id)
                }
              />
            ))}
            <button
              onClick={() => {
                setNomeCriacao("");
                setCorCriacao("#8b5cf6");
                setCriacaoRapida("quadro");
              }}
              className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-orange-500 text-[11px] font-bold text-white transition hover:bg-orange-400"
            >
              <Plus className="h-4 w-4" />
              Criar quadro
            </button>
            {quadro?.usuario.supervisor && (
              <button
                data-tour="tarefas-criar-equipe"
                onClick={() => void abrirGestao()}
                className="mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-slate-700 text-[11px] font-semibold text-slate-300 transition hover:bg-slate-800"
              >
                <Users className="h-4 w-4" />
                Criar equipe
              </button>
            )}
          </div>

        </aside>

        <main className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <header className="flex min-h-[76px] items-center gap-4 border-b border-slate-800/80 bg-[#040b17]/90 px-5">
            <div className="min-w-0">
              <p className="text-[10px] text-slate-500">
                Meus quadros <span className="px-1.5">/</span> {tituloQuadro}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <h2 className="truncate text-xl font-semibold">{tituloQuadro}</h2>
                <Star className="h-4 w-4 text-orange-400" />
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <div className="hidden items-center rounded-lg border border-slate-800 bg-[#07101d] p-1 md:flex">
                <ViewButton
                  icon={Columns3}
                  label="Quadro"
                  active={modo === "quadro"}
                  onClick={() => {
                    setSecao("quadros");
                    setModo("quadro");
                  }}
                />
                <ViewButton
                  icon={List}
                  label="Lista"
                  active={modo === "lista"}
                  onClick={() => {
                    setSecao("quadros");
                    setModo("lista");
                  }}
                />
                <ViewButton
                  icon={CalendarDays}
                  label="Calendário"
                  active={modo === "calendario"}
                  onClick={() => {
                    setSecao("calendario");
                    setModo("calendario");
                  }}
                />
              </div>
              {equipeSelecionada && quadro?.usuario.supervisor && (
                <button
                  onClick={() => void abrirGestao(equipeSelecionada)}
                  className="tarefas-botao-secundario"
                >
                  <Settings2 className="h-4 w-4" />
                  Gerenciar
                </button>
              )}
              <button
                onClick={() => setNotificacoesAbertas(true)}
                className="relative grid h-9 w-9 place-items-center rounded-lg border border-slate-800 text-slate-400 hover:border-cyan-500/40 hover:text-cyan-300"
                title="Notificações"
              >
                <Bell className="h-4 w-4" />
                {notificacoesNaoLidas > 0 && (
                  <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-orange-500 px-1 text-[7px] font-bold text-white">
                    {Math.min(notificacoesNaoLidas, 99)}
                  </span>
                )}
              </button>
              <button
                onClick={onClose}
                className="grid h-9 w-9 place-items-center rounded-lg border border-slate-800 text-slate-500 hover:border-red-500/40 hover:text-red-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div className="flex min-h-0 flex-1">
            <section className="flex min-w-0 flex-1 flex-col">
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-800/70 px-4 py-3">
                <div className="flex -space-x-2">
                  {(membrosAceitos.length
                    ? membrosAceitos.slice(0, 5)
                    : [{ nome: quadro?.usuario.nome || "Operador", cpf: "1" }]
                  ).map((membro) => (
                    <Avatar key={membro.cpf} nome={membro.nome} small />
                  ))}
                </div>
                <div className="relative ml-auto min-w-[220px] flex-1 md:max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
                  <input
                    value={busca}
                    onChange={(evento) => setBusca(evento.target.value)}
                    placeholder="Buscar tarefas..."
                    className="tarefas-input h-9 pl-9"
                  />
                </div>
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                  <select
                    value={filtroPrioridade}
                    onChange={(evento) =>
                      setFiltroPrioridade(evento.target.value)
                    }
                    className="tarefas-input h-9 appearance-none pl-9 pr-8"
                  >
                    <option value="todas">Filtros</option>
                    {prioridades.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  data-tour="tarefas-nova"
                  onClick={() => abrirNovaTarefa()}
                  className="tarefas-botao-primario h-9"
                >
                  <Plus className="h-4 w-4" />
                  Nova tarefa
                </button>
              </div>

              {quadro?.convites.map((convite) => (
                <div
                  key={convite.equipe_id}
                  className="mx-4 mt-3 flex items-center gap-3 rounded-xl border border-cyan-500/25 bg-cyan-500/5 px-4 py-3"
                >
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-500/10">
                    <UserPlus className="h-4 w-4 text-cyan-300" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <strong className="block text-[10px] text-slate-200">
                      Convite para {convite.equipe_nome}
                    </strong>
                    <span className="text-[9px] text-slate-500">
                      Enviado por {convite.supervisor_nome}
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      void responderConvite(convite.equipe_id, false)
                    }
                    className="rounded-md border border-slate-700 px-3 py-1.5 text-[9px] text-slate-400"
                  >
                    Recusar
                  </button>
                  <button
                    onClick={() =>
                      void responderConvite(convite.equipe_id, true)
                    }
                    className="rounded-md bg-cyan-500 px-3 py-1.5 text-[9px] font-bold text-[#02101a]"
                  >
                    Aceitar convite
                  </button>
                </div>
              ))}

              <div data-tour="tarefas-conteudo" className="min-h-0 flex-1">
                {loading && !quadro ? (
                  <div className="grid h-full place-items-center">
                    <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                  </div>
                ) : modo === "visao_geral" ? (
                  <VisaoGeralTarefas
                    tarefas={tarefasFiltradas}
                    membros={membrosAceitos}
                    supervisor={Boolean(quadro?.usuario.supervisor)}
                    equipeAtiva={
                      visao === "equipe" ||
                      quadro?.quadro_ativo?.tipo === "EQUIPE"
                    }
                    usuarioNome={quadro?.usuario.nome || "Usuário"}
                    hoje={hoje}
                    onAbrir={abrirTarefa}
                    onNova={() => abrirNovaTarefa()}
                    onCalendario={() => {
                      setSecao("calendario");
                      setModo("calendario");
                    }}
                  />
                ) : modo === "quadro" ? (
                  <Kanban
                    tarefas={tarefasFiltradas}
                    listas={quadro?.listas || []}
                    tarefaSelecionada={tarefaSelecionada}
                    arrastando={arrastando}
                    onArrastar={setArrastando}
                    onSoltar={soltar}
                    onAbrir={abrirTarefa}
                    onAdicionar={abrirNovaTarefa}
                    onAdicionarLista={() => {
                      setNomeCriacao("");
                      setCorCriacao("#38bdf8");
                      setCriacaoRapida("lista");
                    }}
                    podeEditarListas={Boolean(
                      quadro?.quadro_ativo?.pode_editar
                    )}
                  />
                ) : modo === "lista" ? (
                  <ListaTarefas
                    tarefas={tarefasFiltradas}
                    onAbrir={abrirTarefa}
                  />
                ) : (
                  <CalendarioTarefas
                    tarefas={tarefasFiltradas}
                    onAbrir={abrirTarefa}
                    onCriar={(data, hora) =>
                      abrirNovaTarefa(undefined, data, hora)
                    }
                    onReagendar={(tarefa, data, hora) =>
                      void reagendar(tarefa, data, hora)
                    }
                    podeReagendar={(tarefa) =>
                      tarefa.cpf_criador === quadro?.usuario.cpf ||
                      tarefa.cpf_responsavel === quadro?.usuario.cpf
                    }
                  />
                )}
              </div>

            </section>

            {tarefaSelecionada && (
              <DetalhesDrawer
                tarefa={tarefaSelecionada}
                detalhes={detalhes}
                loading={loadingDetalhes}
                comentario={comentario}
                onComentario={setComentario}
                onEnviarComentario={() => void enviarComentario()}
                onFechar={() => setTarefaSelecionada(null)}
                onEditar={podeEditar ? abrirEdicao : undefined}
                onArquivar={podeEditar ? () => void arquivarTarefa() : undefined}
                listas={quadro?.listas || []}
                onMover={(lista) =>
                  void mover(
                    tarefaSelecionada.id,
                    lista.status_base || "caixa_entrada",
                    lista
                  )
                }
                onChecklist={(indice) => void alternarChecklist(indice)}
                onAutomacao={() => void alterarAutomacao()}
                mostrarAnexo={mostrarAnexo}
                onMostrarAnexo={setMostrarAnexo}
                anexoNome={anexoNome}
                anexoUrl={anexoUrl}
                onAnexoNome={setAnexoNome}
                onAnexoUrl={setAnexoUrl}
                onAdicionarAnexo={() => void adicionarAnexo()}
                salvando={salvando}
              />
            )}
          </div>
        </main>
      </div>

      {formAberto && (
        <FormTarefaModal
          form={form}
          setForm={setForm}
          listas={quadro?.listas || []}
          listaId={listaNovaTarefa}
          setListaId={(id) => {
            setListaNovaTarefa(id);
            const lista = quadro?.listas.find((item) => item.id === id);
            if (lista?.status_base) {
              setStatusNovaTarefa(lista.status_base);
            }
          }}
          editando={editando}
          novoChecklist={novoChecklist}
          setNovoChecklist={setNovoChecklist}
          salvando={salvando}
          membros={membrosAceitos}
          mostrarResponsavel={
            (visao === "equipe" ||
              quadro?.quadro_ativo?.tipo === "EQUIPE") &&
            Boolean(quadro?.usuario.supervisor)
          }
          usuarioCpf={quadro?.usuario.cpf || ""}
          onFechar={() => setFormAberto(false)}
          onSalvar={() => void salvarTarefa()}
        />
      )}

      {notificacoesAbertas && (
        <NotificacoesDrawer
          notificacoes={notificacoes}
          onAbrir={(notificacao) => void abrirNotificacao(notificacao)}
          onMarcarTodas={() => void marcarTodasNotificacoes()}
          onFechar={() => setNotificacoesAbertas(false)}
        />
      )}

      {gestaoAberta && quadro?.usuario.supervisor && (
        <GestaoEquipeDrawer
          nomeEquipe={nomeEquipe}
          centroCusto={centroCusto}
          busca={buscaOperador}
          operadores={operadores}
          selecionados={selecionados}
          membros={membros}
          editando={Boolean(gerenciandoEquipe)}
          salvando={salvando}
          onNomeEquipe={setNomeEquipe}
          onCentroCusto={setCentroCusto}
          onBusca={setBuscaOperador}
          onPesquisar={() => void pesquisarOperadores()}
          onSelecionar={(cpf) =>
            setSelecionados((atual) =>
              atual.includes(cpf)
                ? atual.filter((item) => item !== cpf)
                : [...atual, cpf]
            )
          }
          onRemover={(membro) => void removerMembroEquipe(membro)}
          onSalvar={() => void salvarEquipe()}
          onFechar={() => setGestaoAberta(false)}
        />
      )}

      {criacaoRapida && (
        <CriacaoRapidaModal
          tipo={criacaoRapida}
          nome={nomeCriacao}
          cor={corCriacao}
          salvando={salvando}
          onNome={setNomeCriacao}
          onCor={setCorCriacao}
          onFechar={() => setCriacaoRapida(null)}
          onSalvar={() => void concluirCriacaoRapida()}
        />
      )}
    </div>
  );
};

function SidebarButton({
  icon: Icon,
  label,
  active,
  badge,
  onClick,
  dataTour,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  badge?: number;
  onClick: () => void;
  /** Ancora do tour guiado. */
  dataTour?: string;
}) {
  return (
    <button
      data-tour={dataTour}
      onClick={onClick}
      className={`flex h-9 w-full items-center gap-3 rounded-lg px-3 text-[11px] transition ${
        active
          ? "bg-slate-800/90 font-semibold text-white"
          : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
      }`}
    >
      <Icon className={`h-4 w-4 ${active ? "text-sky-300" : ""}`} />
      <span className="flex-1 text-left">{label}</span>
      {badge ? (
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function BoardLink({
  initials: sigla,
  color,
  customColor,
  label,
  active,
  favorite,
  onClick,
}: {
  initials: string;
  color: string;
  customColor?: string;
  label: string;
  active: boolean;
  favorite?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex h-9 w-full items-center gap-2 rounded-lg px-2 text-[10px] transition ${
        active
          ? "bg-slate-800/90 text-white"
          : "text-slate-400 hover:bg-slate-900"
      }`}
    >
      <span
        className={`grid h-6 w-6 place-items-center rounded-md ${color} text-[8px] font-bold text-white`}
        style={customColor ? { backgroundColor: customColor } : undefined}
      >
        {sigla}
      </span>
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      {favorite && (
        <Star className="h-3 w-3 fill-orange-400 text-orange-400" />
      )}
    </button>
  );
}

function ViewButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex h-8 items-center gap-2 rounded-md px-3 text-[10px] font-semibold transition ${
        active
          ? "border border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
          : "text-slate-500 hover:text-slate-200"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function Avatar({
  nome,
  small = false,
}: {
  nome: string;
  small?: boolean;
}) {
  return (
    <span
      title={nome}
      className={`grid shrink-0 place-items-center rounded-full border-2 border-[#07101d] bg-gradient-to-br from-orange-500/80 to-sky-500/80 font-bold text-white ${
        small ? "h-7 w-7 text-[8px]" : "h-8 w-8 text-[9px]"
      }`}
    >
      {iniciais(nome)}
    </span>
  );
}

function Kanban({
  tarefas,
  listas,
  tarefaSelecionada,
  arrastando,
  onArrastar,
  onSoltar,
  onAbrir,
  onAdicionar,
  onAdicionarLista,
  podeEditarListas,
}: {
  tarefas: TarefaKanban[];
  listas: ListaOrganizador[];
  tarefaSelecionada: TarefaKanban | null;
  arrastando: number | null;
  onArrastar: (id: number | null) => void;
  onSoltar: (
    evento: DragEvent<HTMLDivElement>,
    lista: ListaOrganizador
  ) => void;
  onAbrir: (tarefa: TarefaKanban) => void;
  onAdicionar: (lista: ListaOrganizador) => void;
  onAdicionarLista: () => void;
  podeEditarListas: boolean;
}) {
  return (
    <div className="h-full overflow-x-auto overflow-y-hidden p-4 tarefas-scroll">
      <div data-tour="tarefas-colunas" className="flex h-full min-w-max gap-3">
        {listas.map((lista) => {
          const itens = tarefas.filter(
            (tarefa) =>
              tarefa.lista_id === lista.id ||
              (!tarefa.lista_id &&
                tarefa.status === lista.status_base)
          );
          return (
            <div
              key={lista.id}
              onDragOver={(evento) => evento.preventDefault()}
              onDrop={(evento) => onSoltar(evento, lista)}
              className="flex h-full w-[250px] flex-col rounded-xl border border-slate-800 bg-[#07101c]/95"
            >
              <div className="flex items-center gap-2 px-3 py-3">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: lista.cor }}
                />
                <strong className="text-[10px] tracking-wide text-slate-300">
                  {lista.nome.toUpperCase()}
                </strong>
                <span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-400">
                  {itens.length}
                </span>
                <MoreHorizontal className="ml-auto h-4 w-4 text-slate-600" />
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2 tarefas-scroll">
                {itens.map((tarefa) => (
                  <TarefaCard
                    key={tarefa.id}
                    tarefa={tarefa}
                    selecionada={tarefaSelecionada?.id === tarefa.id}
                    arrastando={arrastando === tarefa.id}
                    onArrastar={onArrastar}
                    onAbrir={onAbrir}
                    corLista={lista.cor}
                  />
                ))}
              </div>
              <button
                onClick={() => onAdicionar(lista)}
                className="m-2 flex h-9 items-center gap-2 rounded-lg px-2 text-[10px] text-slate-500 transition hover:bg-slate-800/70 hover:text-slate-200"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar cartão
              </button>
            </div>
          );
        })}
        {podeEditarListas && (
          <button
            onClick={onAdicionarLista}
            className="flex h-10 w-[170px] items-center gap-2 rounded-xl border border-dashed border-slate-700 px-3 text-[10px] text-slate-300 transition hover:border-cyan-500/50 hover:text-cyan-300"
          >
            <Plus className="h-4 w-4" />
            Adicionar lista
          </button>
        )}
      </div>
    </div>
  );
}

function TarefaCard({
  tarefa,
  selecionada,
  arrastando,
  onArrastar,
  onAbrir,
  corLista,
}: {
  tarefa: TarefaKanban;
  selecionada: boolean;
  arrastando: boolean;
  onArrastar: (id: number | null) => void;
  onAbrir: (tarefa: TarefaKanban) => void;
  corLista: string;
}) {
  const progresso = tarefa.checklist_total
    ? Math.round(
        (tarefa.checklist_concluido / tarefa.checklist_total) * 100
      )
    : 0;
  return (
    <article
      draggable
      onDragStart={(evento) => {
        evento.dataTransfer.setData("text/tarefa", String(tarefa.id));
        onArrastar(tarefa.id);
      }}
      onDragEnd={() => onArrastar(null)}
      onClick={() => onAbrir(tarefa)}
      className={`cursor-pointer rounded-lg border bg-[#0b1626] p-3 shadow-md transition hover:-translate-y-0.5 hover:border-slate-600 ${
        selecionada
          ? "border-cyan-400 shadow-[0_0_0_1px_rgba(34,211,238,.35)]"
          : "border-slate-700/80"
      } ${arrastando ? "opacity-40" : ""}`}
      style={{
        borderLeftWidth: 4,
        borderLeftColor: corLista,
        boxShadow: selecionada
          ? `0 0 0 1px ${corLista}, 0 8px 24px rgba(0,0,0,.24)`
          : undefined,
      }}
    >
      <div className="mb-2 flex flex-wrap gap-1">
        <span className={`prioridade prioridade-${tarefa.prioridade}`}>
          {tarefa.prioridade}
        </span>
        <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[8px] font-semibold text-violet-300">
          {tarefa.categoria}
        </span>
      </div>
      <h4 className="line-clamp-2 text-[12px] font-semibold leading-[17px] text-slate-100">
        {tarefa.titulo}
      </h4>
      {tarefa.origem === "EQUIPE" && (
        <p className="mt-1.5 text-[8px] font-semibold text-cyan-400">
          Atribuída pela supervisão
        </p>
      )}
      {tarefa.checklist_total > 0 && (
        <div className="mt-3">
          <div className="h-1 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-cyan-400"
              style={{ width: `${progresso}%` }}
            />
          </div>
        </div>
      )}
      <div className="mt-3 flex items-center gap-2 text-[9px] text-slate-500">
        <CalendarDays className="h-3 w-3" />
        <span>{formatarData(tarefa.data_vencimento)}</span>
        {tarefa.recorrencia_tipo &&
          tarefa.recorrencia_tipo !== "nenhuma" && (
            <span
              className="flex items-center gap-1 text-cyan-400"
              title="Tarefa recorrente"
            >
              <Repeat2 className="h-3 w-3" />
            </span>
          )}
        {Boolean(tarefa.lembrete_minutos) && (
          <BellRing
            className="h-3 w-3 text-violet-400"
            aria-label="Lembrete configurado"
          />
        )}
        {tarefa.checklist_total > 0 && (
          <span className="flex items-center gap-1">
            <ListChecks className="h-3 w-3" />
            {tarefa.checklist_concluido}/{tarefa.checklist_total}
          </span>
        )}
        {tarefa.comentarios_total > 0 && (
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {tarefa.comentarios_total}
          </span>
        )}
        {tarefa.anexos_total > 0 && (
          <span className="flex items-center gap-1">
            <Paperclip className="h-3 w-3" />
            {tarefa.anexos_total}
          </span>
        )}
        <span className="ml-auto">
          <Avatar nome={tarefa.responsavel_nome || "Operador"} small />
        </span>
      </div>
    </article>
  );
}

function ListaTarefas({
  tarefas,
  onAbrir,
}: {
  tarefas: TarefaKanban[];
  onAbrir: (tarefa: TarefaKanban) => void;
}) {
  return (
    <div className="h-full overflow-y-auto p-4 tarefas-scroll">
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-[#07101c]">
        <div className="grid grid-cols-[1fr_150px_130px_110px] gap-3 border-b border-slate-800 px-4 py-3 text-[9px] font-bold uppercase tracking-wider text-slate-600">
          <span>Tarefa</span>
          <span>Responsável</span>
          <span>Etapa</span>
          <span>Vencimento</span>
        </div>
        {tarefas.map((tarefa) => (
          <button
            key={tarefa.id}
            onClick={() => onAbrir(tarefa)}
            className="grid w-full grid-cols-[1fr_150px_130px_110px] gap-3 border-b border-slate-800/70 px-4 py-3 text-left text-[11px] hover:bg-slate-800/40"
          >
            <span className="font-semibold text-slate-200">{tarefa.titulo}</span>
            <span className="truncate text-slate-400">
              {tarefa.responsavel_nome}
            </span>
            <span
              className="font-semibold"
              style={{ color: tarefa.lista_cor || "#7dd3fc" }}
            >
              {tarefa.lista_nome || nomesStatus[tarefa.status]}
            </span>
            <span className="text-slate-400">
              {formatarData(tarefa.data_vencimento)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function VisaoGeralTarefas({
  tarefas,
  membros,
  supervisor,
  equipeAtiva,
  usuarioNome,
  hoje,
  onAbrir,
  onNova,
  onCalendario,
}: {
  tarefas: TarefaKanban[];
  membros: MembroEquipe[];
  supervisor: boolean;
  equipeAtiva: boolean;
  usuarioNome: string;
  hoje: string;
  onAbrir: (tarefa: TarefaKanban) => void;
  onNova: () => void;
  onCalendario: () => void;
}) {
  const abertas = tarefas.filter((tarefa) => tarefa.status !== "concluido");
  const concluidas = tarefas.filter(
    (tarefa) => tarefa.status === "concluido"
  );
  const paraHoje = abertas.filter(
    (tarefa) => isoData(tarefa.data_vencimento) === hoje
  );
  const atrasadasPainel = abertas.filter(
    (tarefa) =>
      Boolean(tarefa.data_vencimento) &&
      isoData(tarefa.data_vencimento) < hoje
  );
  const aguardando = abertas.filter(
    (tarefa) => tarefa.status === "aguardando"
  );
  const progresso = tarefas.length
    ? Math.round((concluidas.length / tarefas.length) * 100)
    : 0;
  const ordemPrioridade: Record<TarefaPrioridade, number> = {
    urgente: 0,
    alta: 1,
    media: 2,
    baixa: 3,
  };
  const prioridadesPainel = [...abertas]
    .sort((a, b) => {
      const prioridade =
        ordemPrioridade[a.prioridade] - ordemPrioridade[b.prioridade];
      if (prioridade !== 0) return prioridade;
      return (
        (isoData(a.data_vencimento) || "9999-12-31").localeCompare(
          isoData(b.data_vencimento) || "9999-12-31"
        )
      );
    })
    .slice(0, 6);
  const inicioHoje = new Date(`${hoje}T12:00:00`);
  const diasSemana = Array.from({ length: 7 }, (_, indice) =>
    addDays(inicioHoje, indice)
  );

  const pessoas = new Map<
    string,
    {
      cpf: string;
      nome: string;
      abertas: number;
      atrasadas: number;
      hoje: number;
      concluidas: number;
    }
  >();
  (equipeAtiva ? membros : []).forEach((membro) => {
    pessoas.set(membro.cpf, {
      cpf: membro.cpf,
      nome: membro.nome,
      abertas: 0,
      atrasadas: 0,
      hoje: 0,
      concluidas: 0,
    });
  });
  (equipeAtiva ? tarefas : []).forEach((tarefa) => {
    const cpf = tarefa.cpf_responsavel;
    if (!cpf) return;
    const pessoa = pessoas.get(cpf) || {
      cpf,
      nome: tarefa.responsavel_nome || "Responsável",
      abertas: 0,
      atrasadas: 0,
      hoje: 0,
      concluidas: 0,
    };
    if (tarefa.status === "concluido") {
      pessoa.concluidas += 1;
    } else {
      pessoa.abertas += 1;
      if (isoData(tarefa.data_vencimento) === hoje) pessoa.hoje += 1;
      if (
        tarefa.data_vencimento &&
        isoData(tarefa.data_vencimento) < hoje
      ) {
        pessoa.atrasadas += 1;
      }
    }
    pessoas.set(cpf, pessoa);
  });
  const capacidade = [...pessoas.values()].sort(
    (a, b) => b.abertas - a.abertas || a.nome.localeCompare(b.nome)
  );

  return (
    <div className="h-full overflow-y-auto p-4 md:p-5 tarefas-scroll">
      <section className="relative overflow-hidden rounded-2xl border border-cyan-500/15 bg-[linear-gradient(115deg,rgba(8,27,45,.96),rgba(6,15,28,.96))] p-5">
        <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-4">
          <div className="min-w-0 flex-1">
            <span className="text-[9px] font-bold uppercase tracking-[.22em] text-cyan-400">
              Central de organização
            </span>
            <h3 className="mt-1 text-xl font-semibold text-white">
              Olá, {usuarioNome.split(/\s+/)[0]}.
            </h3>
            <p className="mt-1 text-[11px] text-slate-400">
              Você tem {paraHoje.length} tarefa(s) para hoje e{" "}
              {atrasadasPainel.length} atrasada(s).
            </p>
          </div>
          <button
            onClick={onCalendario}
            className="flex h-9 items-center gap-2 rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 text-[9px] font-bold text-cyan-200 hover:bg-cyan-500/15"
          >
            <CalendarDays className="h-4 w-4" />
            Abrir calendário
          </button>
          <button
            onClick={onNova}
            className="tarefas-botao-primario h-9"
          >
            <Plus className="h-4 w-4" />
            Nova tarefa
          </button>
        </div>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <DashboardMetric
          icon={Circle}
          label="Em aberto"
          value={abertas.length}
          detail={`${aguardando.length} aguardando`}
          color="#38bdf8"
        />
        <DashboardMetric
          icon={CalendarDays}
          label="Para hoje"
          value={paraHoje.length}
          detail="Demandas do dia"
          color="#f59e0b"
        />
        <DashboardMetric
          icon={Clock3}
          label="Atrasadas"
          value={atrasadasPainel.length}
          detail="Precisam de atenção"
          color="#fb7185"
        />
        <DashboardMetric
          icon={CheckCircle2}
          label="Concluídas"
          value={concluidas.length}
          detail={`${progresso}% do quadro`}
          color="#34d399"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_.8fr]">
        <section className="rounded-2xl border border-slate-800 bg-[#07101c]">
          <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-orange-500/10">
              <Zap className="h-4 w-4 text-orange-400" />
            </span>
            <div>
              <h4 className="text-[11px] font-semibold text-slate-100">
                Próximas prioridades
              </h4>
              <p className="text-[9px] text-slate-500">
                Ordenadas por urgência e vencimento
              </p>
            </div>
          </div>
          <div className="divide-y divide-slate-800/70">
            {prioridadesPainel.length ? (
              prioridadesPainel.map((tarefa) => (
                <button
                  key={tarefa.id}
                  onClick={() => onAbrir(tarefa)}
                  className="grid w-full grid-cols-[8px_1fr_auto] items-center gap-3 px-4 py-3 text-left hover:bg-slate-800/35"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: tarefa.lista_cor || "#38bdf8",
                    }}
                  />
                  <span className="min-w-0">
                    <strong className="block truncate text-[10px] text-slate-200">
                      {tarefa.titulo}
                    </strong>
                    <span className="mt-0.5 block truncate text-[8px] text-slate-500">
                      {tarefa.responsavel_nome} •{" "}
                      {tarefa.lista_nome || nomesStatus[tarefa.status]}
                    </span>
                  </span>
                  <span
                    className={`rounded-md border px-2 py-1 text-[8px] font-semibold ${
                      tarefa.data_vencimento &&
                      isoData(tarefa.data_vencimento) < hoje
                        ? "border-red-500/25 bg-red-500/10 text-red-300"
                        : "border-slate-700 text-slate-400"
                    }`}
                  >
                    {formatarData(tarefa.data_vencimento)}
                  </span>
                </button>
              ))
            ) : (
              <div className="px-4 py-10 text-center text-[10px] text-slate-500">
                Nenhuma tarefa pendente neste quadro.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-[#07101c] p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-[11px] font-semibold text-slate-100">
                Progresso do quadro
              </h4>
              <p className="mt-0.5 text-[9px] text-slate-500">
                Visão consolidada atual
              </p>
            </div>
            <strong className="text-2xl font-semibold text-emerald-300">
              {progresso}%
            </strong>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all"
              style={{ width: `${progresso}%` }}
            />
          </div>
          <div className="mt-5 grid grid-cols-7 gap-1.5">
            {diasSemana.map((dia) => {
              const chave = format(dia, "yyyy-MM-dd");
              const quantidade = abertas.filter(
                (tarefa) => isoData(tarefa.data_vencimento) === chave
              ).length;
              return (
                <button
                  key={chave}
                  onClick={onCalendario}
                  className="rounded-lg border border-slate-800 bg-[#050c17] px-1 py-2 text-center hover:border-cyan-500/35"
                >
                  <span className="block text-[7px] font-bold uppercase text-slate-600">
                    {format(dia, "EEE", { locale: ptBR }).slice(0, 3)}
                  </span>
                  <strong
                    className={`mt-1 block text-xs ${
                      quantidade ? "text-cyan-300" : "text-slate-600"
                    }`}
                  >
                    {quantidade}
                  </strong>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-[8px] text-slate-600">
            Tarefas com vencimento nos próximos sete dias.
          </p>
        </section>
      </div>

      {supervisor && (
        <section className="mt-4 rounded-2xl border border-slate-800 bg-[#07101c]">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 px-4 py-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-500/10">
              <Users className="h-4 w-4 text-violet-300" />
            </span>
            <div className="min-w-0 flex-1">
              <h4 className="text-[11px] font-semibold text-slate-100">
                Capacidade da equipe
              </h4>
              <p className="text-[9px] text-slate-500">
                Distribuição das demandas no quadro selecionado
              </p>
            </div>
            <span className="rounded-full border border-slate-700 px-2.5 py-1 text-[8px] text-slate-400">
              {capacidade.length} responsável(is)
            </span>
          </div>

          {capacidade.length ? (
            <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
              {capacidade.map((pessoa) => {
                const percentual = Math.min(
                  100,
                  Math.round((pessoa.abertas / 8) * 100)
                );
                const cor =
                  pessoa.abertas >= 8
                    ? "#fb7185"
                    : pessoa.abertas >= 5
                      ? "#f59e0b"
                      : "#34d399";
                return (
                  <article
                    key={pessoa.cpf}
                    className="rounded-xl border border-slate-800 bg-[#050c17] p-3"
                  >
                    <div className="flex items-center gap-2">
                      <Avatar nome={pessoa.nome} small />
                      <div className="min-w-0 flex-1">
                        <strong className="block truncate text-[10px] text-slate-200">
                          {pessoa.nome}
                        </strong>
                        <span className="text-[8px] text-slate-500">
                          {pessoa.abertas} aberta(s) • {pessoa.hoje} hoje
                        </span>
                      </div>
                      {pessoa.atrasadas > 0 && (
                        <span className="rounded-md bg-red-500/10 px-2 py-1 text-[8px] font-bold text-red-300">
                          {pessoa.atrasadas} atrasada(s)
                        </span>
                      )}
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${percentual}%`,
                          backgroundColor: cor,
                        }}
                      />
                    </div>
                    <div className="mt-2 flex justify-between text-[8px] text-slate-600">
                      <span>{pessoa.concluidas} concluída(s)</span>
                      <span style={{ color: cor }}>
                        {pessoa.abertas >= 8
                          ? "Carga alta"
                          : pessoa.abertas >= 5
                            ? "Atenção"
                            : "Disponível"}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="px-4 py-8 text-center">
              <p className="text-[10px] text-slate-400">
                Abra um quadro de equipe para visualizar a distribuição.
              </p>
              <p className="mt-1 text-[8px] text-slate-600">
                Integrantes sem tarefas também aparecerão neste painel.
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function DashboardMetric({
  icon: Icon,
  label,
  value,
  detail,
  color,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: number;
  detail: string;
  color: string;
}) {
  return (
    <article className="rounded-xl border border-slate-800 bg-[#07101c] p-4">
      <div className="flex items-center justify-between">
        <span
          className="grid h-8 w-8 place-items-center rounded-lg"
          style={{ backgroundColor: `${color}16` }}
        >
          <Icon className="h-4 w-4" style={{ color }} />
        </span>
        <strong className="text-2xl font-semibold text-white">{value}</strong>
      </div>
      <h4 className="mt-3 text-[10px] font-semibold text-slate-200">{label}</h4>
      <p className="mt-0.5 text-[8px] text-slate-500">{detail}</p>
    </article>
  );
}

function CalendarioTarefas({
  tarefas,
  onAbrir,
  onCriar,
  onReagendar,
  podeReagendar,
}: {
  tarefas: TarefaKanban[];
  onAbrir: (tarefa: TarefaKanban) => void;
  onCriar: (data: string, hora?: string) => void;
  onReagendar: (
    tarefa: TarefaKanban,
    data: string,
    hora?: string | null
  ) => void;
  podeReagendar: (tarefa: TarefaKanban) => boolean;
}) {
  type ModoCalendario = "mes" | "semana" | "dia";
  const [referencia, setReferencia] = useState(() => new Date());
  const [modoCalendario, setModoCalendario] =
    useState<ModoCalendario>("mes");
  const inicioSemana = startOfWeek(referencia, { weekStartsOn: 0 });
  const diasSemana = Array.from({ length: 7 }, (_, indice) =>
    addDays(inicioSemana, indice)
  );
  const diasExibidos =
    modoCalendario === "dia" ? [referencia] : diasSemana;
  const horas = Array.from({ length: 14 }, (_, indice) => indice + 7);
  const tarefasSemData = tarefas.filter(
    (tarefa) => !isoData(tarefa.data_vencimento)
  );

  const tarefasDoDia = (data: Date) =>
    tarefas.filter(
      (tarefa) =>
        isoData(tarefa.data_vencimento) === format(data, "yyyy-MM-dd")
    );

  const navegarPeriodo = (direcao: -1 | 1) => {
    setReferencia((atual) =>
      modoCalendario === "mes"
        ? addMonths(atual, direcao)
        : addDays(atual, direcao * (modoCalendario === "semana" ? 7 : 1))
    );
  };

  const tituloPeriodo = (() => {
    if (modoCalendario === "mes") {
      const titulo = format(referencia, "MMMM 'de' yyyy", { locale: ptBR });
      return titulo.charAt(0).toUpperCase() + titulo.slice(1);
    }
    if (modoCalendario === "semana") {
      const ultimoDia = addDays(inicioSemana, 6);
      return `${format(inicioSemana, "dd MMM", {
        locale: ptBR,
      })} — ${format(ultimoDia, "dd MMM yyyy", { locale: ptBR })}`;
    }
    const titulo = format(referencia, "EEEE, dd 'de' MMMM", {
      locale: ptBR,
    });
    return titulo.charAt(0).toUpperCase() + titulo.slice(1);
  })();

  const iniciarArraste = (
    evento: DragEvent<HTMLElement>,
    tarefa: TarefaKanban
  ) => {
    evento.stopPropagation();
    evento.dataTransfer.effectAllowed = "move";
    evento.dataTransfer.setData("text/tarefa-calendario", String(tarefa.id));
  };

  const soltarNaData = (
    evento: DragEvent<HTMLElement>,
    data: Date,
    hora?: string
  ) => {
    evento.preventDefault();
    const id = Number(
      evento.dataTransfer.getData("text/tarefa-calendario")
    );
    const tarefa = tarefas.find((item) => item.id === id);
    if (!tarefa || !podeReagendar(tarefa)) return;
    onReagendar(
      tarefa,
      format(data, "yyyy-MM-dd"),
      hora === undefined
        ? tarefa.hora_vencimento?.slice(0, 5) || null
        : hora
    );
  };

  const renderizarEvento = (
    tarefa: TarefaKanban,
    compacto = false
  ) => (
    <button
      key={tarefa.id}
      draggable={podeReagendar(tarefa)}
      onDragStart={(evento) => iniciarArraste(evento, tarefa)}
      onClick={(evento) => {
        evento.stopPropagation();
        onAbrir(tarefa);
      }}
      className={`group relative w-full overflow-hidden rounded-md border px-2 text-left transition hover:brightness-125 ${
        compacto ? "min-h-7 py-1" : "min-h-9 py-1.5"
      } ${
        tarefa.status === "concluido"
          ? "border-emerald-500/20 opacity-60"
          : "border-slate-700/80"
      }`}
      style={{
        backgroundColor: `${tarefa.lista_cor || "#38bdf8"}18`,
        borderLeftColor: tarefa.lista_cor || "#38bdf8",
        borderLeftWidth: 3,
      }}
      title={`${tarefa.titulo}${
        tarefa.hora_vencimento
          ? ` • ${tarefa.hora_vencimento.slice(0, 5)}`
          : ""
      }`}
    >
      <span className="block truncate text-[9px] font-semibold text-slate-100">
        {tarefa.hora_vencimento && (
          <span
            className="mr-1.5 font-bold"
            style={{ color: tarefa.lista_cor || "#7dd3fc" }}
          >
            {tarefa.hora_vencimento.slice(0, 5)}
          </span>
        )}
        {tarefa.titulo}
      </span>
      {!compacto && (
        <span className="mt-0.5 block truncate text-[8px] text-slate-400">
          {tarefa.responsavel_nome || tarefa.lista_nome}
        </span>
      )}
    </button>
  );

  const renderizarMes = () => {
    const inicio = startOfWeek(startOfMonth(referencia), { weekStartsOn: 0 });
    const dias = Array.from({ length: 42 }, (_, indice) =>
      addDays(inicio, indice)
    );

    return (
      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-[32px_repeat(6,minmax(92px,1fr))] overflow-auto border-l border-t border-slate-800 tarefas-scroll">
        {["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"].map(
          (diaSemana) => (
            <div
              key={diaSemana}
              className="grid place-items-center border-b border-r border-slate-800 bg-[#07111f] text-[8px] font-bold tracking-[.16em] text-slate-500"
            >
              {diaSemana}
            </div>
          )
        )}
        {dias.map((dia) => {
          const itens = tarefasDoDia(dia);
          const chave = format(dia, "yyyy-MM-dd");
          return (
            <div
              key={chave}
              onDragOver={(evento) => evento.preventDefault()}
              onDrop={(evento) => soltarNaData(evento, dia)}
              onDoubleClick={() => onCriar(chave)}
              className={`group min-h-[92px] border-b border-r border-slate-800 p-1.5 transition hover:bg-cyan-950/15 ${
                isSameMonth(dia, referencia)
                  ? "bg-[#050d19]"
                  : "bg-[#030914] text-slate-700"
              }`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={`grid h-6 w-6 place-items-center rounded-full text-[10px] font-semibold ${
                    isToday(dia)
                      ? "bg-orange-500 text-white shadow-[0_0_14px_rgba(249,115,22,.35)]"
                      : isSameMonth(dia, referencia)
                        ? "text-slate-300"
                        : "text-slate-700"
                  }`}
                >
                  {format(dia, "d")}
                </span>
                <button
                  onClick={(evento) => {
                    evento.stopPropagation();
                    onCriar(chave);
                  }}
                  className="grid h-5 w-5 place-items-center rounded text-slate-600 opacity-0 transition hover:bg-slate-800 hover:text-cyan-300 group-hover:opacity-100"
                  title="Criar tarefa neste dia"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
              <div className="space-y-1">
                {itens.slice(0, 3).map((tarefa) =>
                  renderizarEvento(tarefa, true)
                )}
                {itens.length > 3 && (
                  <button
                    onClick={() => {
                      setReferencia(dia);
                      setModoCalendario("dia");
                    }}
                    className="w-full px-1 text-left text-[8px] font-semibold text-cyan-400 hover:text-cyan-300"
                  >
                    + {itens.length - 3} tarefa(s)
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderizarAgenda = () => (
    <div className="min-h-0 flex-1 overflow-auto tarefas-scroll">
      <div
        className="sticky top-0 z-10 grid min-w-[760px] border-b border-slate-800 bg-[#07111f]"
        style={{
          gridTemplateColumns: `64px repeat(${diasExibidos.length}, minmax(180px, 1fr))`,
        }}
      >
        <div className="border-r border-slate-800" />
        {diasExibidos.map((dia) => (
          <button
            key={format(dia, "yyyy-MM-dd")}
            onClick={() => {
              setReferencia(dia);
              setModoCalendario("dia");
            }}
            className="border-r border-slate-800 px-2 py-2 text-center hover:bg-slate-800/60"
          >
            <span className="block text-[8px] font-bold uppercase tracking-widest text-slate-500">
              {format(dia, "EEE", { locale: ptBR })}
            </span>
            <span
              className={`mx-auto mt-1 grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${
                isToday(dia)
                  ? "bg-orange-500 text-white"
                  : "text-slate-200"
              }`}
            >
              {format(dia, "d")}
            </span>
          </button>
        ))}
      </div>

      <div
        className="grid min-w-[760px] border-b border-slate-800"
        style={{
          gridTemplateColumns: `64px repeat(${diasExibidos.length}, minmax(180px, 1fr))`,
        }}
      >
        <div className="border-r border-slate-800 p-2 text-right text-[8px] uppercase text-slate-600">
          Dia inteiro
        </div>
        {diasExibidos.map((dia) => (
          <div
            key={format(dia, "yyyy-MM-dd")}
            onDragOver={(evento) => evento.preventDefault()}
            onDrop={(evento) => soltarNaData(evento, dia, "")}
            className="min-h-12 space-y-1 border-r border-slate-800 p-1.5"
          >
            {tarefasDoDia(dia)
              .filter((tarefa) => !tarefa.hora_vencimento)
              .map((tarefa) => renderizarEvento(tarefa, true))}
          </div>
        ))}
      </div>

      <div className="min-w-[760px]">
        {horas.map((hora) => (
          <div
            key={hora}
            className="grid min-h-[72px]"
            style={{
              gridTemplateColumns: `64px repeat(${diasExibidos.length}, minmax(180px, 1fr))`,
            }}
          >
            <div className="border-r border-t border-slate-800 pr-2 pt-1 text-right text-[9px] text-slate-600">
              {String(hora).padStart(2, "0")}:00
            </div>
            {diasExibidos.map((dia) => {
              const horaTexto = `${String(hora).padStart(2, "0")}:00`;
              return (
                <div
                  key={`${format(dia, "yyyy-MM-dd")}-${hora}`}
                  onDragOver={(evento) => evento.preventDefault()}
                  onDrop={(evento) =>
                    soltarNaData(evento, dia, horaTexto)
                  }
                  onDoubleClick={() =>
                    onCriar(format(dia, "yyyy-MM-dd"), horaTexto)
                  }
                  className={`space-y-1 border-r border-t border-slate-800 p-1.5 hover:bg-cyan-950/15 ${
                    isToday(dia) ? "bg-orange-950/5" : ""
                  }`}
                >
                  {tarefasDoDia(dia)
                    .filter(
                      (tarefa) =>
                        Number(tarefa.hora_vencimento?.slice(0, 2)) === hora
                    )
                    .map((tarefa) => renderizarEvento(tarefa))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#040b16]">
      <div className="flex min-h-[58px] flex-wrap items-center gap-2 border-b border-slate-800 bg-[#06101c] px-4 py-2">
        <button
          onClick={() => setReferencia(new Date())}
          className="h-8 rounded-lg border border-slate-700 px-3 text-[10px] font-semibold text-slate-200 transition hover:border-cyan-500/60 hover:bg-slate-800"
        >
          Hoje
        </button>
        <button
          onClick={() => navegarPeriodo(-1)}
          className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
          aria-label="Período anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => navegarPeriodo(1)}
          className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
          aria-label="Próximo período"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <strong className="min-w-0 flex-1 truncate px-2 text-sm font-semibold text-slate-100">
          {tituloPeriodo}
        </strong>

        {tarefasSemData.length > 0 && (
          <span className="hidden rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[8px] text-slate-400 lg:inline">
            {tarefasSemData.length} sem data
          </span>
        )}

        <div className="flex rounded-lg border border-slate-800 bg-[#030914] p-1">
          {(
            [
              ["mes", "Mês"],
              ["semana", "Semana"],
              ["dia", "Dia"],
            ] as Array<[ModoCalendario, string]>
          ).map(([valor, rotulo]) => (
            <button
              key={valor}
              onClick={() => setModoCalendario(valor)}
              className={`rounded-md px-3 py-1.5 text-[9px] font-semibold transition ${
                modoCalendario === valor
                  ? "bg-cyan-500/15 text-cyan-300"
                  : "text-slate-500 hover:text-slate-200"
              }`}
            >
              {rotulo}
            </button>
          ))}
        </div>
        <button
          onClick={() => onCriar(format(referencia, "yyyy-MM-dd"))}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-orange-500 px-3 text-[9px] font-bold text-white shadow-[0_0_16px_rgba(249,115,22,.18)] hover:bg-orange-400"
        >
          <Plus className="h-3.5 w-3.5" />
          Nova tarefa
        </button>
      </div>

      {modoCalendario === "mes" ? renderizarMes() : renderizarAgenda()}
    </div>
  );
}

function DetalhesDrawer({
  tarefa,
  listas,
  detalhes,
  loading,
  comentario,
  onComentario,
  onEnviarComentario,
  onFechar,
  onEditar,
  onArquivar,
  onMover,
  onChecklist,
  onAutomacao,
  mostrarAnexo,
  onMostrarAnexo,
  anexoNome,
  anexoUrl,
  onAnexoNome,
  onAnexoUrl,
  onAdicionarAnexo,
  salvando,
}: {
  tarefa: TarefaKanban;
  listas: ListaOrganizador[];
  detalhes: DetalhesTarefa;
  loading: boolean;
  comentario: string;
  onComentario: (valor: string) => void;
  onEnviarComentario: () => void;
  onFechar: () => void;
  onEditar?: () => void;
  onArquivar?: () => void;
  onMover: (lista: ListaOrganizador) => void;
  onChecklist: (indice: number) => void;
  onAutomacao: () => void;
  mostrarAnexo: boolean;
  onMostrarAnexo: (valor: boolean) => void;
  anexoNome: string;
  anexoUrl: string;
  onAnexoNome: (valor: string) => void;
  onAnexoUrl: (valor: string) => void;
  onAdicionarAnexo: () => void;
  salvando: boolean;
}) {
  const progresso = tarefa.checklist_total
    ? Math.round(
        (tarefa.checklist_concluido / tarefa.checklist_total) * 100
      )
    : 0;
  return (
    <aside
      data-tour="tarefas-detalhe"
      className="flex w-[370px] shrink-0 flex-col border-l border-slate-700 bg-[#06101d] shadow-2xl"
    >
      <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
        <select
          value={tarefa.lista_id || ""}
          onChange={(evento) => {
            const lista = listas.find(
              (item) => item.id === evento.target.value
            );
            if (lista) onMover(lista);
          }}
          className="bg-transparent text-[10px] font-bold uppercase tracking-wide text-cyan-300 outline-none"
        >
          {listas.map((lista) => (
            <option key={lista.id} value={lista.id}>
              {lista.nome.toUpperCase()}
            </option>
          ))}
        </select>
        <button className="ml-auto text-slate-600">
          <MoreHorizontal className="h-4 w-4" />
        </button>
        <button onClick={onFechar} className="text-slate-500 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 tarefas-scroll">
        <div className="flex items-start gap-2">
          <h3 className="flex-1 text-lg font-semibold leading-6 text-white">
            {tarefa.titulo}
          </h3>
          {onEditar && (
            <button
              onClick={onEditar}
              className="rounded-md border border-slate-700 px-2 py-1 text-[9px] text-slate-400 hover:text-white"
            >
              Editar
            </button>
          )}
        </div>
        <div className="mt-3 flex gap-1.5">
          <span className={`prioridade prioridade-${tarefa.prioridade}`}>
            {tarefa.prioridade}
          </span>
          <span className="rounded bg-violet-500/15 px-2 py-1 text-[9px] text-violet-300">
            {tarefa.categoria}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-[92px_1fr] gap-y-3 text-[10px]">
          <span className="text-slate-500">Responsável</span>
          <span className="flex items-center gap-2 text-slate-200">
            <Avatar nome={tarefa.responsavel_nome || "Operador"} small />
            {tarefa.responsavel_nome}
          </span>
          <span className="text-slate-500">Data de entrega</span>
          <span className="text-orange-300">
            {formatarData(tarefa.data_vencimento)}
            {tarefa.hora_vencimento
              ? `, ${tarefa.hora_vencimento.slice(0, 5)}`
              : ""}
          </span>
          {tarefa.recorrencia_tipo &&
            tarefa.recorrencia_tipo !== "nenhuma" && (
              <>
                <span className="text-slate-500">Recorrência</span>
                <span className="flex items-center gap-1.5 text-cyan-300">
                  <Repeat2 className="h-3.5 w-3.5" />
                  A cada {tarefa.recorrencia_intervalo || 1}{" "}
                  {tarefa.recorrencia_tipo === "diaria"
                    ? "dia(s)"
                    : tarefa.recorrencia_tipo === "semanal"
                      ? "semana(s)"
                      : "mês(es)"}
                </span>
              </>
            )}
          {Boolean(tarefa.lembrete_minutos) && (
            <>
              <span className="text-slate-500">Lembrete</span>
              <span className="flex items-center gap-1.5 text-violet-300">
                <BellRing className="h-3.5 w-3.5" />
                {tarefa.lembrete_minutos === 1440
                  ? "1 dia antes"
                  : tarefa.lembrete_minutos === 2880
                    ? "2 dias antes"
                    : tarefa.lembrete_minutos === 10080
                      ? "1 semana antes"
                      : `${tarefa.lembrete_minutos} minutos antes`}
              </span>
            </>
          )}
        </div>

        <DetailSection title="Descrição">
          <p className="whitespace-pre-wrap text-[10px] leading-5 text-slate-400">
            {tarefa.descricao || "Nenhuma descrição adicionada."}
          </p>
        </DetailSection>

        <DetailSection
          title={`Checklist ${tarefa.checklist_concluido}/${tarefa.checklist_total}`}
        >
          <div className="mb-3 h-1 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-cyan-400"
              style={{ width: `${progresso}%` }}
            />
          </div>
          <div className="space-y-1.5">
            {tarefa.checklist.map((item, indice) => (
              <button
                key={item.id || indice}
                onClick={() => onChecklist(indice)}
                className="flex w-full items-center gap-2 rounded-md p-1.5 text-left text-[10px] text-slate-300 hover:bg-slate-800/60"
              >
                {item.concluido ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-slate-600" />
                )}
                <span
                  className={
                    item.concluido ? "line-through opacity-50" : ""
                  }
                >
                  {item.texto}
                </span>
              </button>
            ))}
            {!tarefa.checklist.length && (
              <p className="text-[10px] text-slate-600">
                Nenhum item no checklist.
              </p>
            )}
          </div>
        </DetailSection>

        <DetailSection
          title={`Anexos ${detalhes.anexos.length}`}
          action={
            <button
              onClick={() => onMostrarAnexo(!mostrarAnexo)}
              className="text-[9px] text-cyan-400"
            >
              + Adicionar
            </button>
          }
        >
          {mostrarAnexo && (
            <div className="mb-3 space-y-2 rounded-lg border border-slate-800 bg-slate-900/40 p-2">
              <input
                value={anexoNome}
                onChange={(evento) => onAnexoNome(evento.target.value)}
                placeholder="Nome do arquivo"
                className="tarefas-input h-8"
              />
              <input
                value={anexoUrl}
                onChange={(evento) => onAnexoUrl(evento.target.value)}
                placeholder="https://..."
                className="tarefas-input h-8"
              />
              <button
                onClick={onAdicionarAnexo}
                className="tarefas-botao-primario h-8 w-full justify-center"
              >
                <Link2 className="h-3.5 w-3.5" />
                Adicionar link
              </button>
            </div>
          )}
          <div className="space-y-2">
            {detalhes.anexos.map((anexo) => (
              <AnexoItem key={anexo.id} anexo={anexo} />
            ))}
          </div>
        </DetailSection>

        <DetailSection title="Atividade">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
          ) : (
            <>
              <div className="space-y-2">
                {detalhes.comentarios.slice(0, 4).map((item) => (
                  <ComentarioItem key={item.id} comentario={item} />
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  value={comentario}
                  onChange={(evento) => onComentario(evento.target.value)}
                  onKeyDown={(evento) => {
                    if (evento.key === "Enter" && !evento.shiftKey) {
                      evento.preventDefault();
                      onEnviarComentario();
                    }
                  }}
                  className="tarefas-input h-9"
                  placeholder="Escreva um comentário..."
                />
                <button
                  onClick={onEnviarComentario}
                  disabled={salvando}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 space-y-3 border-l border-slate-800 pl-3">
                {detalhes.historico.slice(0, 6).map((item) => (
                  <HistoricoItem key={item.id} historico={item} />
                ))}
              </div>
            </>
          )}
        </DetailSection>

        <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900/40 p-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-400" />
            <strong className="text-[10px]">Automação</strong>
            <button
              onClick={onAutomacao}
              className={`ml-auto flex h-5 w-9 items-center rounded-full p-0.5 transition ${
                tarefa.sugerir_finalizacao
                  ? "justify-end bg-cyan-500"
                  : "justify-start bg-slate-700"
              }`}
            >
              <span className="h-4 w-4 rounded-full bg-white shadow" />
            </button>
          </div>
          <p className="mt-2 text-[9px] text-slate-500">
            Ao concluir o checklist, sugerir finalização.
          </p>
        </div>
      </div>
      <div className="flex gap-2 border-t border-slate-800 p-3">
        <button
          onClick={() => {
            const concluida = listas.find(
              (item) => item.status_base === "concluido"
            );
            if (concluida) onMover(concluida);
          }}
          className="tarefas-botao-primario flex-1 justify-center"
        >
          <Check className="h-4 w-4" />
          Concluir tarefa
        </button>
        {onArquivar && (
          <button
            onClick={onArquivar}
            className="grid h-10 w-10 place-items-center rounded-lg border border-orange-500/30 text-orange-300"
          >
            <Archive className="h-4 w-4" />
          </button>
        )}
      </div>
    </aside>
  );
}

function DetailSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5">
      <div className="mb-2 flex items-center">
        <strong className="text-[11px] text-slate-200">{title}</strong>
        <span className="ml-auto">{action}</span>
      </div>
      {children}
    </section>
  );
}

function ComentarioItem({
  comentario,
}: {
  comentario: ComentarioTarefa;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-2.5">
      <div className="flex items-center gap-2">
        <Avatar nome={comentario.autor_nome} small />
        <strong className="text-[9px] text-slate-300">
          {comentario.autor_nome}
        </strong>
        <span className="ml-auto text-[8px] text-slate-600">
          {formatarMomento(comentario.criado_em)}
        </span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-[9px] leading-4 text-slate-400">
        {comentario.conteudo}
      </p>
    </div>
  );
}

function HistoricoItem({ historico }: { historico: HistoricoTarefa }) {
  return (
    <div className="relative text-[9px] text-slate-500">
      <span className="absolute -left-[17px] top-0 grid h-3 w-3 place-items-center rounded-full bg-slate-800">
        <History className="h-2 w-2" />
      </span>
      <strong className="text-slate-400">{historico.autor_nome}</strong>{" "}
      {historico.descricao}
      {historico.valor_anterior && historico.valor_novo && (
        <span className="mt-1 block text-[8px] text-slate-600">
          {nomesStatus[historico.valor_anterior as TarefaStatus] ||
            historico.valor_anterior}{" "}
          →{" "}
          {nomesStatus[historico.valor_novo as TarefaStatus] ||
            historico.valor_novo}
        </span>
      )}
      <span className="mt-1 block text-[8px] text-slate-700">
        {formatarMomento(historico.criado_em)}
      </span>
    </div>
  );
}

function AnexoItem({ anexo }: { anexo: AnexoTarefa }) {
  return (
    <a
      href={anexo.url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-2.5 hover:border-cyan-500/30"
    >
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-red-500/10">
        <FileText className="h-4 w-4 text-red-400" />
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block truncate text-[10px] text-slate-300">
          {anexo.nome}
        </strong>
        <small className="text-[8px] text-slate-600">
          Adicionado por {anexo.autor_nome}
        </small>
      </span>
      <Link2 className="h-3.5 w-3.5 text-slate-500" />
    </a>
  );
}

function NotificacoesDrawer({
  notificacoes,
  onAbrir,
  onMarcarTodas,
  onFechar,
}: {
  notificacoes: NotificacaoTarefa[];
  onAbrir: (notificacao: NotificacaoTarefa) => void;
  onMarcarTodas: () => void;
  onFechar: () => void;
}) {
  const naoLidas = notificacoes.filter((item) => !item.lida).length;
  const estiloTipo: Record<
    NotificacaoTarefa["tipo"],
    {
      cor: string;
      icon: React.ComponentType<{
        className?: string;
        style?: React.CSSProperties;
      }>;
    }
  > = {
    ATRIBUICAO: { cor: "#38bdf8", icon: UserPlus },
    COMENTARIO: { cor: "#a78bfa", icon: MessageSquare },
    LEMBRETE: { cor: "#f59e0b", icon: BellRing },
    ATRASO: { cor: "#fb7185", icon: Clock3 },
    RECORRENCIA: { cor: "#34d399", icon: Repeat2 },
  };

  return (
    <div className="absolute inset-0 z-40 flex justify-end bg-black/55 backdrop-blur-sm">
      <aside className="flex h-full w-full max-w-md flex-col border-l border-slate-700 bg-[#06101d] shadow-2xl">
        <div className="flex items-center gap-3 border-b border-slate-800 p-5">
          <span className="relative grid h-10 w-10 place-items-center rounded-xl bg-orange-500/10">
            <Bell className="h-5 w-5 text-orange-300" />
            {naoLidas > 0 && (
              <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-orange-500 px-1 text-[7px] font-bold">
                {naoLidas}
              </span>
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-[.18em] text-orange-400">
              Central de avisos
            </p>
            <h3 className="mt-1 text-lg font-semibold text-white">
              Notificações
            </h3>
          </div>
          <button
            onClick={onFechar}
            className="text-slate-500 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center border-b border-slate-800 px-4 py-3">
          <span className="text-[9px] text-slate-500">
            {naoLidas} não lida(s)
          </span>
          {naoLidas > 0 && (
            <button
              onClick={onMarcarTodas}
              className="ml-auto text-[9px] font-semibold text-cyan-400 hover:text-cyan-300"
            >
              Marcar todas como lidas
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto tarefas-scroll">
          {notificacoes.length ? (
            notificacoes.map((notificacao) => {
              const estilo =
                estiloTipo[notificacao.tipo] || estiloTipo.LEMBRETE;
              const Icone = estilo.icon;
              return (
                <button
                  key={notificacao.id}
                  onClick={() => onAbrir(notificacao)}
                  className={`flex w-full gap-3 border-b border-slate-800/70 p-4 text-left transition hover:bg-slate-800/35 ${
                    notificacao.lida ? "opacity-55" : "bg-cyan-500/[.025]"
                  }`}
                >
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
                    style={{ backgroundColor: `${estilo.cor}16` }}
                  >
                    <Icone
                      className="h-4 w-4"
                      style={{ color: estilo.cor }}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start gap-2">
                      <strong className="flex-1 text-[10px] text-slate-200">
                        {notificacao.titulo}
                      </strong>
                      {!notificacao.lida && (
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-orange-400" />
                      )}
                    </span>
                    <span className="mt-1 block text-[9px] leading-4 text-slate-400">
                      {notificacao.mensagem}
                    </span>
                    <span className="mt-1.5 block text-[8px] text-slate-600">
                      {formatarMomento(notificacao.criada_em)}
                    </span>
                  </span>
                </button>
              );
            })
          ) : (
            <div className="grid h-64 place-items-center px-8 text-center">
              <div>
                <Bell className="mx-auto h-8 w-8 text-slate-700" />
                <p className="mt-3 text-[10px] text-slate-400">
                  Nenhuma notificação por enquanto.
                </p>
                <p className="mt-1 text-[8px] text-slate-600">
                  Lembretes, atribuições e comentários aparecerão aqui.
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function FormTarefaModal({
  form,
  setForm,
  listas,
  listaId,
  setListaId,
  editando,
  novoChecklist,
  setNovoChecklist,
  salvando,
  membros,
  mostrarResponsavel,
  usuarioCpf,
  onFechar,
  onSalvar,
}: {
  form: FormTarefa;
  setForm: React.Dispatch<React.SetStateAction<FormTarefa>>;
  listas: ListaOrganizador[];
  listaId: string;
  setListaId: (id: string) => void;
  editando: TarefaKanban | null;
  novoChecklist: string;
  setNovoChecklist: (valor: string) => void;
  salvando: boolean;
  membros: MembroEquipe[];
  mostrarResponsavel: boolean;
  usuarioCpf: string;
  onFechar: () => void;
  onSalvar: () => void;
}) {
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div
        data-tour="tarefas-form"
        className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#07101d] shadow-2xl"
      >
        <div className="flex items-center border-b border-slate-800 px-5 py-4">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[.18em] text-orange-400">
              Cartão
            </p>
            <h3 className="mt-1 text-lg font-semibold">
              {editando ? "Editar tarefa" : "Nova tarefa"}
            </h3>
          </div>
          <button
            onClick={onFechar}
            className="ml-auto text-slate-500 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 tarefas-scroll">
          <label className="tarefas-label">
            Título
            <input
              value={form.titulo}
              onChange={(evento) =>
                setForm({ ...form, titulo: evento.target.value })
              }
              className="tarefas-input mt-2"
              placeholder="O que precisa ser feito?"
            />
          </label>
          <label className="tarefas-label">
            Descrição
            <textarea
              value={form.descricao}
              onChange={(evento) =>
                setForm({ ...form, descricao: evento.target.value })
              }
              className="tarefas-input mt-2 min-h-24 resize-none py-3"
              placeholder="Adicione contexto e orientações..."
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Lista"
              value={listaId}
              onChange={setListaId}
              options={listas.map((item) => ({
                value: item.id,
                label: item.nome,
              }))}
            />
            <SelectField
              label="Prioridade"
              value={form.prioridade}
              onChange={(valor) =>
                setForm({
                  ...form,
                  prioridade: valor as TarefaPrioridade,
                })
              }
              options={prioridades}
            />
            <SelectField
              label="Categoria"
              value={form.categoria}
              onChange={(valor) => setForm({ ...form, categoria: valor })}
              options={categorias.map((item) => ({
                value: item,
                label: item,
              }))}
            />
            {mostrarResponsavel && !editando ? (
              <div data-tour="tarefas-responsavel">
              <SelectField
                label="Responsável"
                value={form.cpf_responsavel}
                onChange={(valor) =>
                  setForm({ ...form, cpf_responsavel: valor })
                }
                options={[
                  { value: "", label: "Selecione" },
                  { value: usuarioCpf, label: "Eu mesmo" },
                  ...membros.map((item) => ({
                    value: item.cpf,
                    label: item.nome,
                  })),
                ]}
              />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <label className="tarefas-label">
                  Data
                  <input
                    type="date"
                    value={form.data_vencimento}
                    onChange={(evento) =>
                      setForm({
                        ...form,
                        data_vencimento: evento.target.value,
                      })
                    }
                    className="tarefas-input mt-2"
                  />
                </label>
                <label className="tarefas-label">
                  Hora
                  <input
                    type="time"
                    value={form.hora_vencimento}
                    onChange={(evento) =>
                      setForm({
                        ...form,
                        hora_vencimento: evento.target.value,
                      })
                    }
                    className="tarefas-input mt-2"
                  />
                </label>
              </div>
            )}
          </div>
          {mostrarResponsavel && !editando && (
            <div className="grid grid-cols-2 gap-3">
              <label className="tarefas-label">
                Data
                <input
                  type="date"
                  value={form.data_vencimento}
                  onChange={(evento) =>
                    setForm({
                      ...form,
                      data_vencimento: evento.target.value,
                    })
                  }
                  className="tarefas-input mt-2"
                />
              </label>
              <label className="tarefas-label">
                Hora
                <input
                  type="time"
                  value={form.hora_vencimento}
                  onChange={(evento) =>
                    setForm({
                      ...form,
                      hora_vencimento: evento.target.value,
                    })
                  }
                  className="tarefas-input mt-2"
                />
              </label>
            </div>
          )}
          <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/5 p-3">
            <div className="mb-3 flex items-center gap-2">
              <Repeat2 className="h-4 w-4 text-cyan-300" />
              <div>
                <strong className="block text-[10px] text-slate-200">
                  Recorrência e lembrete
                </strong>
                <span className="text-[8px] text-slate-500">
                  A próxima ocorrência nasce quando esta for concluída.
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label="Repetir"
                value={form.recorrencia_tipo}
                onChange={(valor) =>
                  setForm({
                    ...form,
                    recorrencia_tipo: valor as RecorrenciaTipo,
                  })
                }
                options={[
                  { value: "nenhuma", label: "Não repetir" },
                  { value: "diaria", label: "Diariamente" },
                  { value: "semanal", label: "Semanalmente" },
                  { value: "mensal", label: "Mensalmente" },
                ]}
              />
              <SelectField
                label="Lembrar"
                value={String(form.lembrete_minutos || 0)}
                onChange={(valor) =>
                  setForm({
                    ...form,
                    lembrete_minutos:
                      Number(valor) > 0 ? Number(valor) : null,
                  })
                }
                options={[
                  { value: "0", label: "Sem lembrete" },
                  { value: "15", label: "15 minutos antes" },
                  { value: "30", label: "30 minutos antes" },
                  { value: "60", label: "1 hora antes" },
                  { value: "120", label: "2 horas antes" },
                  { value: "1440", label: "1 dia antes" },
                  { value: "2880", label: "2 dias antes" },
                  { value: "10080", label: "1 semana antes" },
                ]}
              />
            </div>
            {form.recorrencia_tipo !== "nenhuma" && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="tarefas-label">
                  A cada
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={form.recorrencia_intervalo}
                      onChange={(evento) =>
                        setForm({
                          ...form,
                          recorrencia_intervalo: Math.max(
                            1,
                            Number(evento.target.value) || 1
                          ),
                        })
                      }
                      className="tarefas-input"
                    />
                    <span className="text-[9px] text-slate-500">
                      {form.recorrencia_tipo === "diaria"
                        ? "dia(s)"
                        : form.recorrencia_tipo === "semanal"
                          ? "semana(s)"
                          : "mês(es)"}
                    </span>
                  </div>
                </label>
                <label className="tarefas-label">
                  Repetir até
                  <input
                    type="date"
                    value={form.recorrencia_ate}
                    min={form.data_vencimento || undefined}
                    onChange={(evento) =>
                      setForm({
                        ...form,
                        recorrencia_ate: evento.target.value,
                      })
                    }
                    className="tarefas-input mt-2"
                  />
                </label>
              </div>
            )}
          </div>
          <div>
            <span className="tarefas-label">Checklist</span>
            <div className="mt-2 space-y-2">
              {form.checklist.map((item, indice) => (
                <div
                  key={indice}
                  className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/40 p-2"
                >
                  <Circle className="h-3.5 w-3.5 text-slate-600" />
                  <span className="flex-1 text-[10px] text-slate-300">
                    {item.texto}
                  </span>
                  <button
                    onClick={() =>
                      setForm({
                        ...form,
                        checklist: form.checklist.filter(
                          (_, posicao) => posicao !== indice
                        ),
                      })
                    }
                    className="text-slate-600 hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  value={novoChecklist}
                  onChange={(evento) => setNovoChecklist(evento.target.value)}
                  onKeyDown={(evento) => {
                    if (evento.key === "Enter" && novoChecklist.trim()) {
                      evento.preventDefault();
                      setForm({
                        ...form,
                        checklist: [
                          ...form.checklist,
                          {
                            texto: novoChecklist.trim(),
                            concluido: false,
                          },
                        ],
                      });
                      setNovoChecklist("");
                    }
                  }}
                  className="tarefas-input"
                  placeholder="Adicionar item..."
                />
                <button
                  onClick={() => {
                    if (!novoChecklist.trim()) return;
                    setForm({
                      ...form,
                      checklist: [
                        ...form.checklist,
                        { texto: novoChecklist.trim(), concluido: false },
                      ],
                    });
                    setNovoChecklist("");
                  }}
                  className="tarefas-botao-secundario px-3"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-3 border-t border-slate-800 p-4">
          <button
            onClick={onFechar}
            className="tarefas-botao-secundario flex-1 justify-center"
          >
            Cancelar
          </button>
          <button
            onClick={onSalvar}
            disabled={salvando}
            className="tarefas-botao-primario flex-1 justify-center disabled:opacity-50"
          >
            {salvando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (valor: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="tarefas-label">
      {label}
      <select
        value={value}
        onChange={(evento) => onChange(evento.target.value)}
        className="tarefas-input mt-2"
      >
        {options.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function GestaoEquipeDrawer({
  nomeEquipe,
  centroCusto,
  busca,
  operadores,
  selecionados,
  membros,
  editando,
  salvando,
  onNomeEquipe,
  onCentroCusto,
  onBusca,
  onPesquisar,
  onSelecionar,
  onRemover,
  onSalvar,
  onFechar,
}: {
  nomeEquipe: string;
  centroCusto: string;
  busca: string;
  operadores: OperadorEquipe[];
  selecionados: string[];
  membros: MembroEquipe[];
  editando: boolean;
  salvando: boolean;
  onNomeEquipe: (valor: string) => void;
  onCentroCusto: (valor: string) => void;
  onBusca: (valor: string) => void;
  onPesquisar: () => void;
  onSelecionar: (cpf: string) => void;
  onRemover: (membro: MembroEquipe) => void;
  onSalvar: () => void;
  onFechar: () => void;
}) {
  return (
    <div className="absolute inset-0 z-30 flex justify-end bg-black/70 backdrop-blur-sm">
      <aside
        data-tour="tarefas-gestao-equipe"
        className="flex h-full w-full max-w-lg flex-col border-l border-slate-700 bg-[#07101d]"
      >
        <div className="flex items-center border-b border-slate-800 p-5">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[.18em] text-orange-400">
              Gestão de acesso
            </p>
            <h3 className="mt-1 text-lg font-semibold">
              {editando ? nomeEquipe : "Criar equipe"}
            </h3>
          </div>
          <button onClick={onFechar} className="ml-auto text-slate-500">
            <X />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 tarefas-scroll">
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-[10px] leading-5 text-cyan-100">
            O centro de custo serve somente para localizar operadores. Cada
            pessoa precisa aceitar o convite antes de entrar na equipe.
          </div>
          {!editando && (
            <label className="tarefas-label">
              Nome da equipe
              <input
                value={nomeEquipe}
                onChange={(evento) => onNomeEquipe(evento.target.value)}
                className="tarefas-input mt-2"
              />
            </label>
          )}
          <div className="grid grid-cols-2 gap-2">
            <input
              value={busca}
              onChange={(evento) => onBusca(evento.target.value)}
              className="tarefas-input"
              placeholder="Nome do operador"
            />
            <input
              value={centroCusto}
              onChange={(evento) => onCentroCusto(evento.target.value)}
              className="tarefas-input"
              placeholder="Centro de custo"
            />
          </div>
          <button
            onClick={onPesquisar}
            className="tarefas-botao-secundario w-full justify-center"
          >
            <Search className="h-4 w-4" />
            Localizar operadores
          </button>
          <div className="space-y-2">
            {operadores.map((operador) => (
              <button
                key={operador.cpf}
                onClick={() => onSelecionar(operador.cpf)}
                className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left ${
                  selecionados.includes(operador.cpf)
                    ? "border-orange-500/50 bg-orange-500/10"
                    : "border-slate-800 bg-slate-900/40"
                }`}
              >
                <Avatar nome={operador.nome} small />
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-[10px]">
                    {operador.nome}
                  </strong>
                  <small className="text-[8px] text-slate-500">
                    {operador.centro_custo}
                  </small>
                </span>
                {selecionados.includes(operador.cpf) && (
                  <Check className="h-4 w-4 text-orange-400" />
                )}
              </button>
            ))}
          </div>
          {membros.length > 0 && (
            <div>
              <p className="tarefas-label mb-2">Integrantes e convites</p>
              <div className="space-y-2">
                {membros.map((membro) => (
                  <div
                    key={membro.cpf}
                    className="flex items-center gap-3 rounded-lg border border-slate-800 p-3"
                  >
                    <Avatar nome={membro.nome} small />
                    <span className="min-w-0 flex-1 truncate text-[10px]">
                      {membro.nome}
                    </span>
                    <span
                      className={`rounded px-2 py-1 text-[8px] font-bold ${
                        membro.status === "ACEITO"
                          ? "bg-emerald-500/10 text-emerald-300"
                          : "bg-amber-500/10 text-amber-300"
                      }`}
                    >
                      {membro.status}
                    </span>
                    <button
                      onClick={() => onRemover(membro)}
                      className="text-slate-600 hover:text-red-400"
                      title="Remover membro"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="border-t border-slate-800 p-4">
          <button
            onClick={onSalvar}
            disabled={salvando}
            className="tarefas-botao-primario w-full justify-center"
          >
            {salvando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            {editando ? "Enviar convites" : "Criar equipe"}
          </button>
        </div>
      </aside>
    </div>
  );
}

function CriacaoRapidaModal({
  tipo,
  nome,
  cor,
  salvando,
  onNome,
  onCor,
  onFechar,
  onSalvar,
}: {
  tipo: "quadro" | "lista";
  nome: string;
  cor: string;
  salvando: boolean;
  onNome: (valor: string) => void;
  onCor: (valor: string) => void;
  onFechar: () => void;
  onSalvar: () => void;
}) {
  const cores = [
    "#38bdf8",
    "#8b5cf6",
    "#f59e0b",
    "#f97316",
    "#34d399",
    "#f43f5e",
    "#ec4899",
    "#94a3b8",
  ];
  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-[#07101d] p-5 shadow-2xl">
        <div className="flex items-center">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-orange-400">
              Organização
            </p>
            <h3 className="mt-1 text-lg font-semibold text-white">
              Nova {tipo === "quadro" ? "quadro" : "lista"}
            </h3>
          </div>
          <button
            onClick={onFechar}
            className="ml-auto text-slate-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <label className="tarefas-label mt-5 block">
          Nome
          <input
            autoFocus
            value={nome}
            onChange={(evento) => onNome(evento.target.value)}
            onKeyDown={(evento) => {
              if (evento.key === "Enter") onSalvar();
            }}
            className="tarefas-input mt-2"
            placeholder={
              tipo === "quadro"
                ? "Ex.: Retornos de clientes"
                : "Ex.: Em validação"
            }
          />
        </label>
        <div className="mt-5">
          <span className="tarefas-label">Cor de identificação</span>
          <div className="mt-3 grid grid-cols-8 gap-2">
            {cores.map((item) => (
              <button
                key={item}
                onClick={() => onCor(item)}
                className={`h-7 rounded-lg transition ${
                  cor === item
                    ? "ring-2 ring-white ring-offset-2 ring-offset-[#07101d]"
                    : ""
                }`}
                style={{ backgroundColor: item }}
                aria-label={`Selecionar cor ${item}`}
              />
            ))}
          </div>
        </div>
        <div className="mt-6 flex gap-3">
          <button
            onClick={onFechar}
            className="tarefas-botao-secundario flex-1 justify-center"
          >
            Cancelar
          </button>
          <button
            onClick={onSalvar}
            disabled={salvando}
            className="tarefas-botao-primario flex-1 justify-center"
          >
            {salvando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Criar
          </button>
        </div>
      </div>
    </div>
  );
}

export default TodoModal;
