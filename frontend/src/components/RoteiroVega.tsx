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
  Tags,
  Workflow,
  X,
} from "lucide-react";
import CanaisPage from "./CanaisPage";
import BancoArgumentacaoPage from "./BancoArgumentacaoPage";
import { linkify } from "./RoteiroVegaAdm";
import { renderRichText } from "@/utils/richText";
import TabulacoesPage from "./TabulacoesPage";
import SituacoesPage from "./SituacoesPage";
import { categorias } from "@/utils/roteiroCategorias";

interface RoteiroModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SelectOption {
  id: string;
  nome: string;
  codigo?: string;
}

interface MensagemFluxo {
  id_mensagem: string;
  titulo: string;
  mensagem: string;
  ordem_exibicao?: number;
  opcoes: OpcaoFluxo[];
}

// Os nomes seguem o que o backend devolve em `mensagem-inicial`. A interface
// dizia `id`/`texto`, que nao existem na resposta -- o JSX ja lia
// `id_opcao`/`texto_opcao` e so o tipo estava errado.
interface OpcaoFluxo {
  id_opcao: string;
  texto_opcao: string;
  proxima_mensagem_id: string | null;
  ordem_opcao?: number;
}
// A lista vive em utils/roteiroCategorias: havia uma cópia aqui e outra no
// BasesAuxiliaresPage, e elas divergiram.
export { categorias };

/**
 * Fluxos que existem para alimentar as abas, e por isso não podem aparecer
 * como opção de roteiro nos selects do operador.
 *
 * `situacoes_adversas` é o nome real do fluxo de Outras Situações no banco —
 * sem ele na lista, "Situaçoes Adversas" vazava para o combo de Produto como
 * se fosse um roteiro de atendimento.
 */
export const categoriasAuxiliares = new Set([
  "acoes_diversas",
  "banco_de_argumentacao",
  "canais_de_atendimento",
  "outras_situacoes",
  "situacoes_adversas",
  "tabulacoes",
]);

export const filtraOpcoes = (lista) =>
  (lista || []).filter((item) => {
    const key1 = normalize(item.id);
    const key2 = normalize(item.nome);
    return !categoriasAuxiliares.has(key1) && !categoriasAuxiliares.has(key2);
  });

// `trim` antes de trocar espaço por "_": ao contrário, um nome cadastrado com
// espaço sobrando virava "banco_de_argumentacao_" e não casava com nada.
export const normalize = (str: unknown) =>
  String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, "_");

const RoteiroModal: React.FC<RoteiroModalProps> = ({ isOpen, onClose }) => {
  const [tiposLigacao, setTiposLigacao] = useState<SelectOption[]>([]);
  const [produtos, setProdutos] = useState<SelectOption[]>([]);
  const [tiposCliente, setTiposCliente] = useState<SelectOption[]>([]);
  // "Roteiro" com maiuscula: e o `value` da aba. Com "roteiro" nenhuma aba
  // nascia destacada, apesar de o conteudo dela estar na tela.
  const [categoriaAtiva, setCategoriaAtiva] = useState("Roteiro");
  const [tipoLigacaoSelecionado, setTipoLigacaoSelecionado] = useState("");
  const [produtoSelecionado, setProdutoSelecionado] = useState("");
  const [tipoClienteSelecionado, setTipoClienteSelecionado] = useState("");
  const [fluxoCompleto, setFluxoCompleto] = useState<MensagemFluxo[]>([]);

  const [mensagemAtual, setMensagemAtual] = useState<MensagemFluxo | null>(
    null,
  );
  const [historicoMensagens, setHistoricoMensagens] = useState<MensagemFluxo[]>(
    [],
  );
  const [loading, setLoading] = useState(false);

  const nomeOperador = localStorage.getItem("nomeCompleto") || "Operador";

  // Buscar opções dos selects ao abrir o modal
  useEffect(() => {
    if (isOpen) {
      carregarOpcoes();
    }
  }, [isOpen]);

  //filtro das opcoes de fluxo

  //bucar opcoes de fluxo

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

  // Buscar mensagem inicial quando todos os selects forem preenchidos
  useEffect(() => {
    if (
      tipoLigacaoSelecionado &&
      produtoSelecionado &&
      tipoClienteSelecionado
    ) {
      buscarMensagemInicial();
    }
  }, [tipoLigacaoSelecionado, produtoSelecionado, tipoClienteSelecionado]);

  const buscarMensagemInicial = async (categoriaValue?: string) => {
    const tipo = categoriaValue || tipoLigacaoSelecionado;

    const params = {
      tipo_ligacao: tipo,
      produto: tipo,
      tipo_cliente: tipo,
    };
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
      if (response.data?.fluxo?.mensagens?.length > 0) {
        const mensagens = response.data.fluxo.mensagens;
        setFluxoCompleto(mensagens);

        const mensagemInicial =
          mensagens.find((m) => m.ordem_exibicao === 1) || mensagens[0];

        if (mensagemInicial) {
          setMensagemAtual(mensagemInicial);
          setHistoricoMensagens([mensagemInicial]);
          setTrocandoFluxo(false);
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
  const [mostrarFiltros, setMostrarFiltros] = useState(true);
  /**
   * Com o fluxo carregado, os três combos recolhem para uma faixa fina.
   *
   * O operador lê a mensagem em voz alta durante a ligação: ela precisa ser a
   * primeira coisa que ele vê, não algo abaixo de um título e de três selects
   * que já cumpriram o papel. "Trocar" reabre os filtros.
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

  /** Ícone de cada aba no menu lateral — mesmo mapa da tela de administração. */
  const iconeDaCategoria: Record<string, typeof Workflow> = {
    "Roteiro": Workflow,
    "Tabulações": Tags,
    "outras_situacoes": AlertTriangle,
    "Banco de Argumentação": MessageSquareQuote,
    "Canais de Atendimento": Headphones,
  };

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

  const handleFinalizarAtendimento = () => {
    setTipoLigacaoSelecionado("");
    setProdutoSelecionado("");
    setTipoClienteSelecionado("");
    setMensagemAtual(null);
    setHistoricoMensagens([]);
    toast.success("Atendimento finalizado");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {/* Fullscreen, igual ao da administração. O DialogContent nasce
          centralizado (`left-[50%] translate-x-[-50%]`) e travado em
          `max-w-lg`, então é preciso desfazer o posicionamento, o
          arredondamento e a borda — não basta aumentar. O operador lê isto
          durante a ligação: cada pixel a mais ajuda. */}
      <DialogContent className="roteiro-fonte left-0 top-0 flex h-screen w-screen max-w-none translate-x-0 translate-y-0 flex-col overflow-hidden rounded-none border-0 bg-white p-0 text-slate-900 sm:max-w-none sm:rounded-none dark:bg-[#050b19] dark:text-slate-100 [&>button:last-child]:right-4 [&>button:last-child]:top-4 [&>button:last-child]:rounded-full [&>button:last-child]:border [&>button:last-child]:border-slate-200 [&>button:last-child]:bg-white/80 [&>button:last-child]:text-slate-500 [&>button:last-child]:opacity-100 [&>button:last-child]:transition-colors [&>button:last-child]:hover:bg-white [&>button:last-child]:hover:text-slate-900 dark:[&>button:last-child]:border-white/10 dark:[&>button:last-child]:bg-white/5 dark:[&>button:last-child]:text-slate-300 dark:[&>button:last-child]:hover:bg-white/10 dark:[&>button:last-child]:hover:text-white">
        <DialogHeader className="shrink-0 space-y-0 border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-orange-50 px-6 pb-0 pt-5 dark:border-white/10 dark:bg-gradient-to-r dark:from-[#071224] dark:via-[#081428] dark:to-[#0d1b32]">
          <DialogTitle className="flex flex-wrap items-center justify-between gap-4 pr-14">
            <div className="space-y-1 py-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-orange-500/80 dark:text-orange-400/80">
                Roteiro Vega
              </div>
              <div className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
                Roteiro de Atendimento
              </div>
            </div>
          </DialogTitle>
          {/* Abaixo de `md` não há menu lateral: as abas viram faixa
              horizontal, que quebra linha em vez de cortar a última. */}
          <div className="mt-5 flex w-full flex-wrap gap-x-1 gap-y-0 rounded-t-xl border border-b-0 border-slate-200 bg-slate-100 px-2 dark:border-white/10 dark:bg-white/5 md:hidden">
            {categorias.map((categoria) => (
              <button
                key={categoria.value}
                onClick={() => handleCategoriaClick(categoria)}
                className={`shrink-0 whitespace-nowrap px-3 py-2.5 text-xs font-medium transition-colors sm:px-4 sm:py-3 sm:text-sm ${
                  categoriaAtiva === categoria.value
                    ? "border-b-2 border-orange-400 bg-white text-orange-600 dark:bg-[#091327] dark:text-orange-300"
                    : "text-slate-500 hover:bg-white hover:text-slate-900 dark:text-slate-300/80 dark:hover:bg-white/5 dark:hover:text-white"
                }`}
              >
                {categoria.label}
              </button>
            ))}
          </div>
        </DialogHeader>

        {/* Menu lateral + conteúdo, igual à tela de administração. Aqui o
            menu tem só a navegação: as ações do atendimento — Voltar e
            Finalizar — ficam na linha abaixo da mensagem, no mesmo lugar em
            que estão lá. */}
        <div className="flex min-h-0 flex-1">
          {/* O menu é agrupado por finalidade, não por ordem alfabética: o
              Roteiro é o que se segue durante a ligação; o resto é o que se
              consulta quando o cliente puxa um assunto fora do fluxo. */}
          <aside className="hidden w-56 shrink-0 flex-col gap-5 border-r border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-[#040d1a] md:flex">
            {[
              {
                titulo: "Durante a ligação",
                itens: categorias.filter((c) => c.value === "Roteiro"),
              },
              {
                titulo: "Consulta rápida",
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
          </aside>

          <main className="custom-scrollbar min-w-0 flex-1 overflow-y-auto">
          <div className="px-6 pt-4">
            {categoriaAtiva === "Tabulações" && <TabulacoesPage />}
            {categoriaAtiva === "Canais de Atendimento" && <CanaisPage />}
            {categoriaAtiva === "Banco de Argumentação" && (
              <BancoArgumentacaoPage />
            )}

            {categoriaAtiva === "outras_situacoes" && <SituacoesPage />}
          </div>
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
                  Carregue o fluxo
                </h2>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  Escolha os três filtros. O roteiro abre sozinho assim que
                  todos estiverem preenchidos.
                </p>
              </div>
            )}

            <div
              className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${
                mensagemAtual && !trocandoFluxo ? "hidden" : ""
              }`}
            >
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Tipo de Ligação
                </label>
                <Select
                  value={tipoLigacaoSelecionado}
                  onValueChange={setTipoLigacaoSelecionado}
                  disabled={loading}
                >
                  <SelectTrigger className="w-full border-slate-200 bg-white text-slate-900 dark:border-white/10 dark:bg-[#050b19] dark:text-slate-100">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent className="border-slate-200 bg-white text-slate-900 dark:border-white/10 dark:bg-[#081224] dark:text-slate-100">
                    {tiposLigacao.map((tipo) => (
                      <SelectItem key={tipo.id} value={String(tipo.id)}>
                        {tipo.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Produto
                </label>
                <Select
                  value={produtoSelecionado}
                  onValueChange={setProdutoSelecionado}
                  disabled={loading}
                >
                  <SelectTrigger className="w-full border-slate-200 bg-white text-slate-900 dark:border-white/10 dark:bg-[#050b19] dark:text-slate-100">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent className="border-slate-200 bg-white text-slate-900 dark:border-white/10 dark:bg-[#081224] dark:text-slate-100">
                    {produtos.map((produto) => (
                      <SelectItem key={produto.id} value={String(produto.id)}>
                        {produto.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Tipo de Cliente
                </label>
                <Select
                  value={tipoClienteSelecionado}
                  onValueChange={setTipoClienteSelecionado}
                  disabled={loading}
                >
                  <SelectTrigger className="w-full border-slate-200 bg-white text-slate-900 dark:border-white/10 dark:bg-[#050b19] dark:text-slate-100">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent className="border-slate-200 bg-white text-slate-900 dark:border-white/10 dark:bg-[#081224] dark:text-slate-100">
                    {tiposCliente.map((tipo) => (
                      <SelectItem key={tipo.id} value={String(tipo.id)}>
                        {tipo.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {loading && (
              <div className="flex items-center justify-center gap-3 py-10 text-sm text-slate-500 dark:text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Carregando o fluxo...
              </div>
            )}

            {/* Antes daqui não havia nada: com os filtros vazios a tela ficava
                em branco abaixo dos combos, sem dizer o que fazer. */}
            {!loading && !mensagemAtual && (
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 px-6 py-12 text-center dark:border-slate-700">
                <Workflow className="h-7 w-7 text-slate-400" />
                <p className="text-base font-medium text-slate-700 dark:text-slate-200">
                  Nenhum fluxo carregado
                </p>
                <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">
                  Preencha tipo de ligação, produto e tipo de cliente acima para
                  o roteiro começar. Enquanto isso, use a{" "}
                  <strong>Consulta rápida</strong> no menu para tabulações,
                  canais e argumentação.
                </p>
              </div>
            )}

            {/* `key` na mensagem: trocar de mensagem remonta o bloco, e é isso
                que faz a animação rodar de novo a cada passo do fluxo. */}
            {!loading && mensagemAtual && (
              <div
                key={mensagemAtual.id_mensagem}
                className={`space-y-4 animate-in fade-in duration-300 ${
                  direcaoMensagem === "avancar"
                    ? "slide-in-from-right-4"
                    : "slide-in-from-left-4"
                }`}
              >
                <Card className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-[#030816]">
                  {/* O titulo nao aparecia nesta tela: o operador via so o
                      corpo, enquanto o administrador via titulo e corpo. Mesma
                      classe e mesma funcao de renderizacao dos dois lados. */}
                  {mensagemAtual.titulo ? (
                    <div
                      className="roteiro-titulo mb-6 text-slate-900 dark:text-slate-50"
                      dangerouslySetInnerHTML={{
                        __html: renderRichText(mensagemAtual.titulo),
                      }}
                    />
                  ) : null}
                  {/* `roteiro-mensagem` cuida do texto que vem do editor: o
                      HTML gravado traz os próprios <p>/<h2>/<li>, então não
                      adianta só aumentar a fonte do <p> de fora. */}
                  <div
                    className="roteiro-mensagem mb-8 text-slate-800 dark:text-slate-100"
                    dangerouslySetInnerHTML={{
                      // Mesma funcao do admin. Antes saia daqui o `linkify`,
                      // que devolve o HTML intacto: a tela do operador ficava
                      // sem a caixa da tabulacao e sem a limpeza de cor do tema.
                      __html: renderRichText(mensagemAtual.mensagem || ""),
                    }}
                  />
                </Card>

                {/* As opções ficam FORA do card: o card é o que se lê, os
                    botões são o que se faz. Laranja sólido — o mesmo
                    `bg-orange-500 hover:bg-orange-600` das outras telas — para
                    a ação saltar do texto durante a ligação. */}
                {mensagemAtual.opcoes && mensagemAtual.opcoes.length > 0 && (
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

            {/* Mesmo lugar da tela de administração: linha de botões logo
                abaixo da mensagem, com o Finalizar à direita. */}
            {mensagemAtual && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-white/10">
                <Button
                  className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10"
                  onClick={handleVoltarMensagem}
                  variant="outline"
                >
                  Voltar
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
          </div>
        )}
          </main>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RoteiroModal;
