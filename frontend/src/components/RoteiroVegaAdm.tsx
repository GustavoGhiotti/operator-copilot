import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import axiosInstance from "@/utils/axiosInstance";
import { toast } from "sonner";
import {
  AlertTriangle,
  Headphones,
  Loader2,
  MessageSquareQuote,
  Plus,
  Tags,
  Trash2,
  TrendingUp,
  Workflow,
  X,
} from "lucide-react";
import ReactQuill, { Quill } from "react-quill";
import "react-quill/dist/quill.snow.css";
import { Input } from "./ui/input";
import axios from "axios";
import { categorias } from "@/utils/roteiroCategorias";
import CanaisPage from "./CanaisPage";
import BancoArgumentacaoPage from "./BancoArgumentacaoPage";
import SeletorFluxoDaAba from "./SeletorFluxoDaAba";
import SituacoesPage from "./SituacoesPage";
import TabulacoesPage from "./TabulacoesPage";
import { filtraOpcoes } from "./RoteiroVega";
import RoteiroFluxoBuilderModal, {
  normalizeEditorHtmlForStorage,
  normalizeTituloForStorage,
  renderRichText,
} from "./RoteiroFluxoBuilderModal";

export interface RoteiroModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface SelectOption {
  id: string;
  nome: string;
  codigo?: string;
}

export interface MensagemFluxo {
  id_mensagem: string;
  id_fluxo: string;
  titulo: string;
  ordem_exibicao: number;
  mensagem: string;
  opcoes: OpcaoFluxo[];
}

export interface OpcaoFluxo {
  id_opcao: string;
  texto_opcao: string;
  proxima_mensagem_id: string | null;
}

const editorFontSizes = [
  "12px",
  "14px",
  "16px",
  "18px",
  "24px",
  "32px",
  "48px",
];

const editorFonts = [
  "arial",
  "georgia",
  "times-new-roman",
  "verdana",
  "courier-new",
];

const SizeStyle = Quill.import("attributors/style/size");
SizeStyle.whitelist = editorFontSizes;
Quill.register(SizeStyle, true);

const FontStyle = Quill.import("attributors/style/font");
FontStyle.whitelist = editorFonts;
Quill.register(FontStyle, true);

export const modules = {
  toolbar: [
    // Títulos (H1, H2, H3) e tamanho da fonte
    [{ font: editorFonts }, { size: editorFontSizes }],

    // Estilos de texto
    ["bold", "italic", "underline", "strike", "blockquote"],

    // Cores e fundo
    [{ color: [] }, { background: [] }],

    // Listas e indentação
    [
      { list: "ordered" },
      { list: "bullet" },
      { indent: "-1" },
      { indent: "+1" },
    ],

    // Alinhamento
    [{ align: [] }],

    // Links e imagens
    ["link", "image"],

    // Limpar formatação
    ["clean"],
  ],
};

export const formats = [
  "font",
  "size",
  "bold",
  "italic",
  "underline",
  "strike",
  "blockquote",
  "color",
  "background",
  "list",
  "bullet",
  "indent",
  "align",
  "link",
  "image",
];

const quillFontPickerStyles = `
  .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="arial"]::before,
  .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="arial"]::before { content: "Arial"; font-family: Arial, sans-serif; }
  .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="georgia"]::before,
  .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="georgia"]::before { content: "Georgia"; font-family: Georgia, serif; }
  .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="times-new-roman"]::before,
  .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="times-new-roman"]::before { content: "Times New Roman"; font-family: "Times New Roman", serif; }
  .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="verdana"]::before,
  .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="verdana"]::before { content: "Verdana"; font-family: Verdana, sans-serif; }
  .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="courier-new"]::before,
  .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="courier-new"]::before { content: "Courier New"; font-family: "Courier New", monospace; }
  .ql-editor { font-family: Arial, sans-serif; }
`;

export const linkify = (text: string = "") => {
  if (!text) return "";
  if (/<[a-z][\s\S]*>/i.test(text)) {
    return text;
  }
  return text
    .replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>',
    )
    .replace(
      /(^|[^\/])(www\.[^\s<]+)/g,
      '$1<a href="http://$2" target="_blank" rel="noopener noreferrer">$2</a>',
    );
};

const RoteiroAdmModal: React.FC<RoteiroModalProps> = ({ isOpen, onClose }) => {
  const [tiposLigacao, setTiposLigacao] = useState<SelectOption[]>([]);
  const [produtos, setProdutos] = useState<SelectOption[]>([]);
  const [mensagemEditandoId, setMensagemEditandoId] = useState<string | null>(
    null,
  );
  const [fluxoEditandoId, setFluxoEditandoId] = useState<string | null>(null);
  const [tiposCliente, setTiposCliente] = useState<SelectOption[]>([]);
  const [conteudoEditado, setConteudoEditado] = useState<string>("");
  const [tituloEditado, setTituloEditado] = useState<string>("");
  const [ordemexibicaoEditada, setOrdemExibicaoEditada] = useState<number>();
  const [opcoesEditadas, setOpcoesEditadas] = useState<OpcaoFluxo[]>([]);
  const [roteiro, setRoteiro] = useState<MensagemFluxo[]>([]);
  const [modoEdicao, setModoEdicao] = useState<boolean>(false);
  const [mostrarFiltros, setMostrarFiltros] = useState(true);
  /**
   * Com o fluxo carregado, os três combos recolhem para uma faixa fina — o
   * mesmo do roteiro do operador. Quem revisa quer ver a mensagem, não os
   * filtros que já cumpriram o papel. "Trocar" reabre.
   */
  const [trocandoFluxo, setTrocandoFluxo] = useState(false);

  /**
   * De onde a próxima mensagem entra: da direita ao avançar, da esquerda ao
   * voltar. Sem isso as duas navegações têm a mesma animação e o operador
   * perde a noção de estar indo ou desfazendo.
   */
  const [direcaoMensagem, setDirecaoMensagem] = useState<"avancar" | "voltar">(
    "avancar",
  );
  const [tipoLigacaoSelecionado, setTipoLigacaoSelecionado] = useState("");
  const [produtoSelecionado, setProdutoSelecionado] = useState("");
  const [tipoClienteSelecionado, setTipoClienteSelecionado] = useState("");
  const [tipoLigacaoEditada, setTipoLigacaoEditada] = useState("");
  const [produtoEditada, setProdutoEditada] = useState("");
  const [tipoClienteEditada, setTipoClienteEditada] = useState("");
  const [fluxoCompleto, setFluxoCompleto] = useState<MensagemFluxo[]>([]);
  const [mensagemAnteriorEdicao, setMensagemAnteriorEdicao] =
    useState<MensagemFluxo | null>(null);
  const [mensagemAtual, setMensagemAtual] = useState<MensagemFluxo | null>(
    null,
  );
  const [historicoMensagens, setHistoricoMensagens] = useState<MensagemFluxo[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [showFluxoBuilder, setShowFluxoBuilder] = useState(false);
  /** Muda a cada vínculo trocado, para a prévia refazer a busca. */
  const [recargaDaAba, setRecargaDaAba] = useState(0);

  const nomeOperador = localStorage.getItem("nomeCompleto") || "Operador";

  function MyEditor() {
    const [value, setValue] = useState("");
    return <ReactQuill value={value} onChange={setValue} />;
  }

  // Buscar opções dos selects ao abrir o modal
  useEffect(() => {
    if (isOpen) {
      carregarOpcoes();
    }
  }, [isOpen]);

  const carregarOpcoes = async () => {
    setLoading(true);
    try {
      // Buscar tipos de ligação
      const tiposLigacaoRes = await axiosInstance.get(
        "/api/roteiro/tipos-ligacao",
      );
      setTiposLigacao(filtraOpcoes(tiposLigacaoRes.data));
      // Buscar produtos
      const produtosRes = await axiosInstance.get("/api/roteiro/produtos");
      setProdutos(filtraOpcoes(produtosRes.data));
      // Buscar tipos de cliente
      const tiposClienteRes = await axiosInstance.get(
        "/api/roteiro/tipos-cliente",
      );
      setTiposCliente(filtraOpcoes(tiposClienteRes.data));
    } catch (error) {
      console.error("Erro ao carregar opções:", error);
      toast.error("Erro ao carregar opções dos selects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!modoEdicao) {
      setFluxoCompleto([]);
      setMensagemAtual(null);
      setHistoricoMensagens([]);
    }
  }, [tipoLigacaoSelecionado, produtoSelecionado, tipoClienteSelecionado]);

  // Buscar mensagem inicial quando todos os selects forem preenchidos
  useEffect(() => {
    if (
      !modoEdicao &&
      tipoLigacaoSelecionado &&
      produtoSelecionado &&
      tipoClienteSelecionado
    ) {
      buscarMensagemInicial();
    }
  }, [tipoLigacaoSelecionado, produtoSelecionado, tipoClienteSelecionado]);

  const buscarMensagemInicial = async (
    filtros?: Partial<{
      tipo_ligacao: string;
      produto: string;
      tipo_cliente: string;
    }>,
  ) => {
    const tipoLigacao = filtros?.tipo_ligacao ?? tipoLigacaoSelecionado;
    const produto = filtros?.produto ?? produtoSelecionado;
    const tipoCliente = filtros?.tipo_cliente ?? tipoClienteSelecionado;

    setLoading(true);

    try {
      const response = await axiosInstance.get(
        "/api/roteiro/mensagem-inicial",
        {
          params: {
            tipo_ligacao: tipoLigacao,
            produto,
            tipo_cliente: tipoCliente,
          },
        },
      );
      if (response.data?.fluxo?.mensagens?.length > 0) {
        const mensagens = response.data.fluxo.mensagens;
        setFluxoCompleto(mensagens);

        const mensagemInicial =
          mensagens.find((m) => m.ordem_exibicao === 1) || mensagens[0];

        if (mensagemInicial) {
          setMensagemAtual(mensagemInicial);
          setTrocandoFluxo(false);
          setHistoricoMensagens([mensagemInicial]);
        }
      } else {
        toast.error("Nenhuma mensagem encontrada para esse fluxo.");
      }
    } catch (error) {
      console.error("Erro ao buscar mensagem inicial:", error);
      toast.error("Erro ao carregar mensagem inicial");
    } finally {
      setLoading(false);
    }
  };

  const handleVoltarMensagem = () => {
    setDirecaoMensagem("voltar");
    if (historicoMensagens.length === 0) {
      toast.info("Não há mensagens anteriores.");
      return;
    }
    if (historicoMensagens.length === 1) {
      const primeiraMensagem = historicoMensagens[0];
      setMensagemAtual(primeiraMensagem);
      return;
    }

    const novoHistorico = [...historicoMensagens];
    novoHistorico.pop();

    setHistoricoMensagens(novoHistorico);

    const mensagemAnterior = novoHistorico[novoHistorico.length - 1];
    setMensagemAtual(mensagemAnterior);
  };

  const handleOpcaoClick = (opcao: OpcaoFluxo) => {
    setDirecaoMensagem("avancar");
    if (!opcao.proxima_mensagem_id) {
      toast.info("Fluxo finalizado!");
      return;
    }

    const proximaMensagem = fluxoCompleto.find(
      (m) => m.id_mensagem === opcao.proxima_mensagem_id,
    );

    if (!proximaMensagem) {
      toast.error(
        "Próxima mensagem não encontrada no fluxo: " +
          opcao.proxima_mensagem_id,
      );

      return;
    }

    const mensagemComNome = { ...proximaMensagem };

    setHistoricoMensagens((prev) => [...prev, mensagemComNome]);
    setMensagemAtual(mensagemComNome);
  };

  const handleToggleEdicao = () => {
    setModoEdicao((prev) => {
      const entrandoEdicao = !prev;

      if (entrandoEdicao) {
        // entrando no modo edição
        if (mensagemAtual) {
          setTipoLigacaoEditada(tipoLigacaoSelecionado);
          setProdutoEditada(produtoSelecionado);
          setTipoClienteEditada(tipoClienteSelecionado);

          setMensagemEditandoId(mensagemAtual.id_mensagem || "");
          setFluxoEditandoId(mensagemAtual.id_fluxo || "");
          setTituloEditado(mensagemAtual.titulo || "");
          setOrdemExibicaoEditada(mensagemAtual.ordem_exibicao || 1);
          setConteudoEditado(mensagemAtual.mensagem || "");
          setOpcoesEditadas(
            mensagemAtual.opcoes
              ? mensagemAtual.opcoes.map((opcao) => ({
                  id_opcao: opcao.id_opcao,
                  texto_opcao: opcao.texto_opcao,
                  proxima_mensagem_id: opcao.proxima_mensagem_id,
                }))
              : [],
          );
        }

        setMensagemAnteriorEdicao(mensagemAtual);
      } else {
        // saindo da edição, restaurar
        if (mensagemAnteriorEdicao) {
          setMensagemAtual(mensagemAnteriorEdicao);
        }
      }

      return entrandoEdicao;
    });
  };

  const handleSalvarEdicao = async () => {
    try {
      const payloadMensagem = {
        id_mensagem: mensagemEditandoId,
        id_fluxo: fluxoEditandoId,
        titulo: normalizeTituloForStorage(tituloEditado),
        ordem_exibicao: ordemexibicaoEditada,
        mensagem: normalizeEditorHtmlForStorage(conteudoEditado),
        opcoes: opcoesEditadas,
      };

      const response = await axios.put(
        `/api/roteiro/mensagem`,
        payloadMensagem,
      );

      if (fluxoEditandoId) {
        await handleAtualizarFluxo(fluxoEditandoId);
      }

      if (response.status === 200) {
        toast.success("Mensagem e opções atualizadas com sucesso!");
        await recarregarFluxoMantendoMensagem(mensagemEditandoId);
        setModoEdicao(false);
      }
    } catch (error) {
      console.error("Erro ao salvar edição:", error);
      toast.error("Erro ao salvar alterações.");
    }
  };

  const recarregarFluxoMantendoMensagem = async (idMensagemAtual: string) => {
    setLoading(true);
    try {
      const response = await axiosInstance.get(
        "/api/roteiro/mensagem-inicial",
        {
          params: {
            tipo_ligacao: tipoLigacaoSelecionado,
            produto: produtoSelecionado,
            tipo_cliente: tipoClienteSelecionado,
          },
        },
      );

      if (!response.data?.fluxo?.mensagens?.length) {
        toast.error("Nenhuma mensagem encontrada ao recarregar o fluxo.");
        return;
      }

      //  Atualiza o fluxo completo
      const mensagens = response.data.fluxo.mensagens;
      setFluxoCompleto(mensagens);

      // ✅ Localiza a mensagem correspondente ao ID atual
      const mensagemAtualizada = mensagens.find(
        (m) =>
          m.id_mensagem?.toUpperCase() === idMensagemAtual?.toUpperCase() ||
          m.id?.toUpperCase() === idMensagemAtual?.toUpperCase(),
      );

      if (!mensagemAtualizada) {
        toast.error(
          "Não foi possível encontrar a mensagem atual no novo fluxo: " +
            idMensagemAtual,
        );
        return;
      }

      // ✅ Atualiza a mensagem atual
      setMensagemAtual(mensagemAtualizada);

      // ✅ Atualiza o histórico mantendo o fluxo percorrido
      setHistoricoMensagens((prev) => {
        const jaExiste = prev.some(
          (msg) =>
            msg.id_mensagem?.toUpperCase() ===
            mensagemAtualizada.id_mensagem?.toUpperCase(),
        );
        if (jaExiste) {
          return prev.map((msg) =>
            msg.id_mensagem === mensagemAtualizada.id_mensagem
              ? mensagemAtualizada
              : msg,
          );
        } else {
          return [...prev, mensagemAtualizada];
        }
      });

      toast.success("Mensagem recarregada com sucesso!");
    } catch (error) {
      console.error("Erro ao recarregar fluxo:", error);
      toast.error("Erro ao recarregar fluxo. Verifique o console.");
    } finally {
      setLoading(false);
    }
  };

  {
    loading && (
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="flex flex-col items-center">
          <Loader2 className="h-6 w-6 text-primary animate-spin mb-2" />
          <span className="text-sm text-muted-foreground">Atualizando...</span>
        </div>
      </div>
    );
  }

  const handleExcluirOpcao = async (opcao: any) => {
    const id = opcao.id || opcao.id_opcao;

    if (!id) {
      toast.error("⚠️ ID da opção não encontrado.");
      console.warn("Opção recebida sem ID:", opcao);
      return;
    }

    try {
      if (!window.confirm("Deseja realmente excluir esta opção?")) return;

      const response = await axios.delete(`/api/roteiro/opcao/${id}`);
      const idMensagemAtual = mensagemEditandoId;

      if (response.status === 200) {
        toast.success(" Opção excluída com sucesso!");

        setOpcoesEditadas((prev) =>
          prev.filter((op) => op.id_opcao !== id && op.id_opcao !== id),
        );
        await handleSalvarEdicao();
        setModoEdicao(false);
      } else {
        toast.error("Falha ao excluir a opção no servidor.");
      }
    } catch (error) {
      console.error(" Erro ao excluir opção:", error);
      toast.error("Erro ao excluir opção. Verifique o console.");
    }
  };

  const handleExcluirMensagem = async (id_mensagem: string) => {
    try {
      if (!window.confirm("Deseja realmente excluir esta mensagem?")) return;

      const response = await axios.delete(
        `/api/roteiro/mensagem/${id_mensagem}`,
      );
      const idMensagemAtual = mensagemEditandoId;

      if (response.status === 200) {
        toast.success("mensagem excluída com sucesso!");
        await handleSalvarEdicao();
        setModoEdicao(false);
      }
    } catch (error) {
      console.error("Erro ao excluir mensagem:", error);
      toast.error("Erro ao excluir mensagem. Verifique o console.");
    }
  };

  // `handleExcluirFluxo` vivia aqui e nunca foi chamado pelo JSX: a exclusão
  // de fluxo acontece no builder, que já recusa os fluxos fixos das abas.
  // Mantê-lo era um caminho de exclusão sem essa checagem, esperando alguém
  // ligar um botão nele.

  const handleAtualizarFluxo = async (id_fluxo: string) => {
    try {
      if (!window.confirm("Deseja realmente atualizar essse fluxo?")) return;

      const payloadMensagem = {
        tipo_ligacao: tipoLigacaoEditada,
        tipo_cliente: tipoClienteEditada,
        produto: produtoEditada,
      };

      const response = await axios.put(
        `/api/roteiro/fluxo/${id_fluxo}`,
        payloadMensagem,
      );

      if (response.status === 200) {
        // Sai do modo edição
        setModoEdicao(false);

        // Limpa o fluxo atual para forçar o recarregamento
        setFluxoCompleto([]);
        setMensagemAtual(null);
        setHistoricoMensagens([]);

        // Atualiza os selects para refletir o que foi editado
        setTipoLigacaoSelecionado(tipoLigacaoEditada);
        setProdutoSelecionado(produtoEditada);
        setTipoClienteSelecionado(tipoClienteEditada);

        // Recarrega tudo

        await carregarOpcoes();
        await buscarMensagemInicial();
      }
      toast.success("Fluxo atualizado com sucesso!");
    } catch (error) {
      console.error("Erro ao atualizar fluxo:", error);
      toast.error("Erro ao atualizar fluxo. Verifique o console.");
    }
  };

  const handleCriarFluxo = async () => {
    setShowFluxoBuilder(true);
  };

  const handleFinalizarAtendimento = () => {
    setTipoLigacaoSelecionado("");
    setProdutoSelecionado("");
    setTipoClienteSelecionado("");
    setMensagemAtual(null);
    setHistoricoMensagens([]);
    toast.success("Atendimento finalizado");
  };
  const [categoriaAtiva, setCategoriaAtiva] = useState("roteiro");

  /** Ícone de cada aba no menu lateral, na linha do que a Academia faz. */
  const iconeDaCategoria: Record<string, typeof Workflow> = {
    "Roteiro": Workflow,
    "Tabulações": Tags,
    "outras_situacoes": AlertTriangle,
    "Banco de Argumentação": MessageSquareQuote,
    "Canais de Atendimento": Headphones,
  };

  /** Chave da aba no backend, ou null quando a categoria ativa é o Roteiro. */
  const abaAtiva =
    {
      "Tabulações": "tabulacoes",
      "outras_situacoes": "outras_situacoes",
      "Banco de Argumentação": "banco_de_argumentacao",
      "Canais de Atendimento": "canais_de_atendimento",
    }[categoriaAtiva] ?? null;

  const handleCategoriaClick = (categoria) => {
    setCategoriaAtiva(categoria.value);

    // Se for roteiro, apenas mostra a área de filtros e não mexe no fluxo
    if (categoria.value === "Roteiro") {
      setMostrarFiltros(true);
      return;
    }

    // Para outras categorias, esconder filtros e carregar fluxo automático
    setMostrarFiltros(false);
  };
  const tiposLigacaoFixos = [
    { value: "Ligação Ativa", label: "Ligação Ativa" },
    { value: "Ligação Receptiva", label: "Ligação Receptiva" },
  ];

  const tiposClienteFixos = [
    { value: "fisica", label: "fisica" },
    { value: "juridica", label: "juridica" },
    { value: "vulnerável", label: "vulnerável" },
  ];

  return (
    <>
      <style>{quillFontPickerStyles}</style>
      <Dialog open={isOpen} onOpenChange={onClose}>
        {/* Fullscreen de verdade. O DialogContent nasce centralizado
            (`left-[50%] translate-x-[-50%]`) e travado em `max-w-lg`, então
            não basta aumentar: é preciso desfazer o posicionamento, o
            arredondamento e a borda. */}
        <DialogContent className="roteiro-fonte left-0 top-0 flex h-screen w-screen max-w-none translate-x-0 translate-y-0 flex-col overflow-hidden rounded-none border-0 bg-white p-0 text-slate-900 sm:max-w-none sm:rounded-none dark:bg-[#050b19] dark:text-slate-100 [&>button:last-child]:right-4 [&>button:last-child]:top-4 [&>button:last-child]:rounded-full [&>button:last-child]:border [&>button:last-child]:border-slate-200 [&>button:last-child]:bg-white/80 [&>button:last-child]:text-slate-500 [&>button:last-child]:opacity-100 [&>button:last-child]:transition-colors [&>button:last-child]:hover:bg-white [&>button:last-child]:hover:text-slate-900 dark:[&>button:last-child]:border-white/10 dark:[&>button:last-child]:bg-white/5 dark:[&>button:last-child]:text-slate-300 dark:[&>button:last-child]:hover:bg-white/10 dark:[&>button:last-child]:hover:text-white">
          <DialogHeader className="shrink-0 space-y-0 border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-orange-50 px-6 pb-0 pt-5 dark:border-white/10 dark:bg-gradient-to-r dark:from-[#071224] dark:via-[#081428] dark:to-[#0d1b32]">
            <DialogTitle className="flex flex-wrap items-center justify-between gap-4 pr-14">
              <div className="space-y-1 py-2">
                <div className="text-[11px] font-semibold uppercase  tracking-[0.32em] text-orange-500/80 dark:text-orange-400/80">
                  Administração de roteiro
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                  Roteiro de Atendimento
                </div>
              </div>
            </DialogTitle>

            {/* Abaixo de `md` não há menu lateral, então as abas viram a
                faixa horizontal de sempre — que quebra linha em vez de
                cortar a última. */}
            <div className="mt-5 flex w-full flex-wrap gap-x-1 gap-y-0 rounded-t-xl border border-b-0 border-slate-200 bg-slate-100 px-2 dark:border-white/10 dark:bg-white/5 md:hidden">
              {categorias.map((categoria) => (
                <button
                  key={categoria.value}
                  onClick={() => handleCategoriaClick(categoria)}
                  className={`shrink-0 whitespace-nowrap rounded-t-lg px-3 py-2.5 text-xs font-medium transition-all sm:px-4 sm:py-3 sm:text-sm ${
                    categoriaAtiva === categoria.value
                      ? "border-b-2 border-orange-400 bg-white text-orange-600 dark:bg-[#091327] dark:text-orange-300"
                      : "text-slate-500 hover:bg-white hover:text-slate-900 dark:text-slate-300/80 dark:hover:bg-white/5 dark:hover:text-white"
                  }`}
                >
                  {categoria.label}
                </button>
              ))}
            </div>
            {/* As abas aqui escolhem QUAL fluxo aparece; as mensagens em si
                continuam sendo editadas no builder, que é o editor de verdade.
                Antes cada aba tinha seu próprio editor Quill duplicado, e a
                ligação com o fluxo era deduzida do nome -- foi assim que a de
                Canais ficou apontando para o nada. */}
          </DialogHeader>

          {/* Menu lateral + conteúdo, no formato da Academia Qualidade: nav em
              cima, ação principal presa no rodapé com `mt-auto`. O cabeçalho
              fica parado e só o `main` rola. */}
          <div className="flex min-h-0 flex-1">
            {/* Agrupado pelo que cada seção significa AQUI: o Roteiro é o
                fluxo que se revisa e edita; as outras quatro decidem qual
                fluxo alimenta cada aba que o operador vê. */}
            <aside className="hidden w-56 shrink-0 flex-col gap-5 border-r border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-[#040d1a] md:flex">
              {[
                {
                  titulo: "Fluxo de atendimento",
                  itens: categorias.filter((c) => c.value === "Roteiro"),
                },
                {
                  titulo: "Abas do operador",
                  itens: categorias.filter((c) => c.value !== "Roteiro"),
                },
              ].map((grupo) => (
                <nav key={grupo.titulo} className="space-y-1">
                  <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                    {grupo.titulo}
                  </p>
                  {grupo.itens.map((categoria) => {
                    const Icone = iconeDaCategoria[categoria.value] ?? Workflow;
                    const ativa = categoriaAtiva === categoria.value;

                    return (
                      <button
                        key={categoria.value}
                        onClick={() => handleCategoriaClick(categoria)}
                        className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm transition ${
                          ativa
                            ? "border-orange-300 bg-orange-50 font-medium text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300"
                            : "border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.035] dark:hover:text-white"
                        }`}
                      >
                        <Icone className="h-4 w-4 shrink-0" />
                        <span className="flex-1 leading-tight">
                          {categoria.label}
                        </span>
                      </button>
                    );
                  })}
                </nav>
              ))}

              <button
                onClick={() => handleCriarFluxo()}
                className="mt-auto flex items-center justify-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/[0.07] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-orange-600 transition hover:bg-orange-500/15 dark:text-orange-300"
              >
                <TrendingUp className="h-4 w-4" />
                Abrir Builder
              </button>
            </aside>

            <main className="custom-scrollbar min-w-0 flex-1 overflow-y-auto">
            {abaAtiva && (
              <div className="px-6 pt-4">
                <SeletorFluxoDaAba
                  key={`${abaAtiva}-${recargaDaAba}`}
                  aba={abaAtiva}
                  onVinculado={() => setRecargaDaAba((n) => n + 1)}
                />
                <div key={`preview-${abaAtiva}-${recargaDaAba}`}>
                  {categoriaAtiva === "Tabulações" && <TabulacoesPage />}
                  {categoriaAtiva === "Canais de Atendimento" && <CanaisPage />}
                  {categoriaAtiva === "Banco de Argumentação" && (
                    <BancoArgumentacaoPage />
                  )}
                  {categoriaAtiva === "outras_situacoes" && <SituacoesPage />}
                </div>
              </div>
            )}
          {mostrarFiltros && (
            <div className="mt-4 space-y-6 px-6 pb-6">
              {/* Fluxo carregado: título e combos recolhem para esta faixa, e a
                  mensagem passa a ser a primeira coisa na tela. */}
              {mensagemAtual && !trocandoFluxo && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-white/10 dark:bg-white/5">
                  <span className="flex min-w-0 items-center gap-2 text-slate-600 dark:text-slate-300">
                    <Workflow className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">
                      {[produtoSelecionado, tipoClienteSelecionado, tipoLigacaoSelecionado]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    <span className="hidden text-slate-400 sm:inline">
                      — é o que o operador lê
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setTrocandoFluxo(true)}
                  >
                    Trocar
                  </Button>
                </div>
              )}

              {(!mensagemAtual || trocandoFluxo) && (
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                    Escolha o fluxo
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                    Os três filtros identificam um roteiro. Preencha todos para
                    abrir e revisar as mensagens que o operador vê.
                  </p>
                </div>
              )}

              <div
                className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${
                  mensagemAtual && !trocandoFluxo ? "hidden" : ""
                }`}
              >
                {/* Tipo de Ligação */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Tipo de Ligação
                  </label>

                  {modoEdicao ? (
                    <Select
                      value={tipoLigacaoEditada}
                      onValueChange={setTipoLigacaoEditada}
                      disabled={loading}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>

                      <SelectContent className="bg-popover">
                        {tiposLigacaoFixos.map((op) => (
                          <SelectItem key={op.value} value={op.value}>
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select
                      value={tipoLigacaoSelecionado}
                      onValueChange={setTipoLigacaoSelecionado}
                      disabled={loading}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        {tiposLigacao.map((tipo) => (
                          <SelectItem key={tipo.id} value={String(tipo.id)}>
                            {tipo.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Produto */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Produto
                  </label>

                  {modoEdicao ? (
                    <Input
                      value={produtoEditada}
                      onChange={(e) => setProdutoEditada(e.target.value)}
                      className="w-full"
                    />
                  ) : (
                    <Select
                      value={produtoSelecionado}
                      onValueChange={setProdutoSelecionado}
                      disabled={loading}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        {produtos.map((produto) => (
                          <SelectItem
                            key={produto.id}
                            value={String(produto.id)}
                          >
                            {produto.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Tipo de Cliente */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Tipo de Cliente
                  </label>

                  {modoEdicao ? (
                    <Select
                      value={tipoClienteEditada}
                      onValueChange={setTipoClienteEditada}
                      disabled={loading}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>

                      <SelectContent className="bg-popover">
                        {tiposClienteFixos.map((op) => (
                          <SelectItem key={op.value} value={op.value}>
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select
                      value={tipoClienteSelecionado}
                      onValueChange={setTipoClienteSelecionado}
                      disabled={loading}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        {tiposCliente.map((tipo) => (
                          <SelectItem key={tipo.id} value={String(tipo.id)}>
                            {tipo.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              {loading && (
                <div className="flex items-center justify-center gap-3 py-10 text-sm text-slate-500 dark:text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  Carregando o fluxo...
                </div>
              )}

              {/* Antes daqui não havia nada: com os filtros vazios a tela
                  ficava em branco abaixo dos combos. */}
              {!loading && !mensagemAtual && (
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 px-6 py-12 text-center dark:border-slate-700">
                  <Workflow className="h-7 w-7 text-slate-400" />
                  <p className="text-base font-medium text-slate-700 dark:text-slate-200">
                    Nenhum fluxo aberto
                  </p>
                  <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">
                    Preencha os três filtros acima para revisar um roteiro
                    existente, ou use <strong>Abrir Builder</strong> no menu
                    para criar um novo e montar as mensagens.
                  </p>
                </div>
              )}

              {/* `key` na mensagem: trocar de mensagem remonta o bloco, e é
                  isso que faz a animação rodar de novo a cada passo. */}
              {!loading && mensagemAtual && (
                <div
                  key={mensagemAtual.id_mensagem}
                  className={`space-y-4 animate-in fade-in duration-300 ${
                    direcaoMensagem === "avancar"
                      ? "slide-in-from-right-4"
                      : "slide-in-from-left-4"
                  }`}
                >
                  <Card className="p-6 bg-card border-2 border-primary/20 space-y-6">
                    {/* Editor ou visualização */}
                    {modoEdicao ? (
                      <>
                        <ReactQuill
                          theme="snow"
                          value={tituloEditado}
                          onChange={setTituloEditado}
                          modules={modules}
                          formats={formats}
                          placeholder="Edite o conteúdo..."
                          className="w-full bg-background text-foreground rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </>
                    ) : (
                      <>
                        {/* `roteiro-titulo` e a mesma classe da tela do
                            operador. Saiu daqui o `ql-editor`, que trazia a
                            tipografia do editor para uma area de leitura, e o
                            `normalizeEditorHtml`, que devolve o HTML intacto:
                            os titulos guardam cor propria e precisam da mesma
                            limpeza de tema que o corpo. */}
                        <div
                          className="roteiro-titulo mb-6 w-full break-words text-slate-900 dark:text-slate-50"
                          dangerouslySetInnerHTML={{
                            __html: renderRichText(mensagemAtual.titulo || ""),
                          }}
                        />
                      </>
                    )}

                    {modoEdicao ? (
                      <>
                        <ReactQuill
                          theme="snow"
                          value={conteudoEditado}
                          onChange={setConteudoEditado}
                          modules={modules}
                          formats={formats}
                          placeholder="Edite o conteúdo..."
                          className="w-full bg-background text-foreground rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <div className="mb-3 flex justify-end">
                          <Button
                            className="h-9 rounded-lg border border-red-300 bg-red-500 px-3 text-sm text-white transition-colors hover:bg-red-600 dark:border-red-400/20 dark:bg-red-500/90 dark:hover:bg-red-500"
                            variant="destructive"
                            onClick={() =>
                              handleExcluirMensagem(mensagemAtual.id_mensagem)
                            }
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir mensagem
                          </Button>
                        </div>
                      </>
                    ) : (
                      // Fora do modo edição, o admin lê a mensagem igual ao
                      // operador — mesma classe, mesmo tamanho.
                      <div
                        className="roteiro-mensagem text-foreground"
                        dangerouslySetInnerHTML={{
                          __html: renderRichText(mensagemAtual.mensagem || ""),
                        }}
                      />
                    )}

                    {/* Aqui abaixo podem vir as opções ou botões */}
                    {modoEdicao ? (
                      // 🔧 MODO EDIÇÃO
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-muted-foreground">
                          Editar opções:
                        </h4>

                        {/* Lista de opções editáveis */}
                        <div className="space-y-3">
                          {opcoesEditadas.map((opcao, index) => (
                            <div
                              key={index}
                              className="flex flex-col sm:flex-row gap-3 items-start sm:items-center border border-border rounded-md p-3"
                            >
                              {/* Texto da opção */}
                              <Input
                                type="text"
                                value={opcao.texto_opcao}
                                onChange={(e) =>
                                  setOpcoesEditadas((prev) =>
                                    prev.map((op, i) =>
                                      i === index
                                        ? { ...op, texto_opcao: e.target.value }
                                        : op,
                                    ),
                                  )
                                }
                                placeholder={`Texto da opção ${index + 1}`}
                                className="flex-1"
                              />

                              {/* Próxima mensagem */}
                              <Select
                                value={opcao.proxima_mensagem_id || ""}
                                onValueChange={(valor) =>
                                  setOpcoesEditadas((prev) =>
                                    prev.map((op, i) =>
                                      i === index
                                        ? {
                                            ...op,
                                            proxima_mensagem_id:
                                              valor === "nenhuma"
                                                ? null
                                                : valor,
                                          }
                                        : op,
                                    ),
                                  )
                                }
                              >
                                <SelectTrigger className="flex-1 bg-background border border-border">
                                  <SelectValue placeholder="Selecione a próxima mensagem" />
                                </SelectTrigger>

                                <SelectContent>
                                  {/* 🔸 Opção nula para encerrar o fluxo */}
                                  <SelectItem value="nenhuma">
                                    <span className="italic text-muted-foreground">
                                      Nenhuma (fluxo finaliza aqui)
                                    </span>
                                  </SelectItem>

                                  <div className="border-t border-border my-1" />

                                  {/* 🔹 Lista de mensagens reais */}
                                  {fluxoCompleto.map((mensagem) => (
                                    <SelectItem
                                      key={mensagem.id_mensagem}
                                      value={mensagem.id_mensagem}
                                    >
                                      <div className="truncate max-w-[300px]">
                                        {mensagem.titulo
                                          ? mensagem.titulo.replace(
                                              /<[^>]+>/g,
                                              "",
                                            )
                                          : "(sem título)"}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              {/* Botão remover */}
                              <Button
                                variant="destructive"
                                size="icon"
                                onClick={() => handleExcluirOpcao(opcao)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>

                        {/* Botão adicionar nova opção */}
                        <Button
                          onClick={() =>
                            setOpcoesEditadas((prev) => [
                              ...prev,
                              {
                                id_opcao: "",
                                texto_opcao: "",
                                proxima_mensagem_id: null,
                              },
                            ])
                          }
                          variant="secondary"
                          className="mt-2"
                        >
                          <Plus className="w-4 h-4 mr-2" /> Adicionar opção
                        </Button>
                      </div>
                    ) : null}
                  </Card>

                  {/* Fora do card, igual ao roteiro do operador: o card é o
                      que se lê, os botões são o caminho. Só no modo
                      visualização — em edição os controles de opção são
                      formulário e continuam dentro. */}
                  {!modoEdicao && mensagemAtual.opcoes.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Selecione uma opção
                      </h4>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {mensagemAtual?.opcoes?.map((opcao) => (
                          <Button
                            key={opcao.id_opcao}
                            onClick={() => handleOpcaoClick(opcao)}
                            className="h-auto min-h-[3.25rem] justify-start whitespace-normal rounded-xl bg-orange-500 px-5 py-4 text-left text-base font-semibold leading-snug text-white shadow-sm transition-colors hover:bg-orange-600"
                            dangerouslySetInnerHTML={{
                              __html: linkify(opcao.texto_opcao),
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Botão finalizar */}
              {mensagemAtual && (
                <>
                  {modoEdicao ? (
                    <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border">
                      <Button
                        onClick={handleSalvarEdicao}
                        className="w-full bg-orange-500 text-white hover:bg-orange-400"
                      >
                        Salvar
                      </Button>
                      <Button
                        onClick={handleToggleEdicao}
                        variant="outline"
                        className="w-full border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10"
                      >
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    //  Modo visualização: mostrar Voltar, Editar e Finalizar
                    <div className="justify-center grid grid-cols-3 gap-3 pt-4 border-t border-border">
                      <Button
                        className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar"
                        onClick={handleVoltarMensagem}
                      >
                        Voltar
                      </Button>

                      <Button
                        onClick={handleToggleEdicao}
                        variant="outline"
                        className="w-full border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10"
                      >
                        Editar Texto
                      </Button>

                      <Button
                        onClick={handleFinalizarAtendimento}
                        variant="destructive"
                        className="gap-2"
                      >
                        <X className="h-4 w-4" />
                        Finalizar Atendimento
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
            </main>
          </div>
        </DialogContent>
      </Dialog>
      <RoteiroFluxoBuilderModal
        isOpen={showFluxoBuilder}
        onClose={() => setShowFluxoBuilder(false)}
        initialTipoLigacao={tipoLigacaoSelecionado}
        initialProduto={produtoSelecionado}
        initialTipoCliente={tipoClienteSelecionado}
      />
    </>
  );
};

export default RoteiroAdmModal;
