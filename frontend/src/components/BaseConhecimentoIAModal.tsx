import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Trash2,
  Undo2,
  X,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { useToast } from "@/hooks/use-toast";
import baseConhecimentoIaApi, {
  ConhecimentoIA,
  Diagnostico,
  EntradaConhecimento,
  RespostaSimulada,
} from "@/services/baseConhecimentoIaApi";

interface BaseConhecimentoIAModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TAMANHO_PAGINA = 20;
const TAMANHO_MAXIMO_TEXTO = 8000;
const TODAS = "__todas__";

/**
 * Carteiras que já têm o @IA liberado no SearchBar.
 *
 * A lista existe para o cadastro ser um Select e não texto livre: a busca casa
 * carteira por substring, então um "GAMA" digitado à mão alcançaria também
 * "GAMA DIGITAL" e vazaria treinamento de uma carteira para a outra.
 */
const CARTEIRAS_SUGERIDAS = [
  "BANCOALFA GERAL",
  "BANCOALFA FIXA",
  "BANCOALFA VARIAVEL",
  "BANCO DELTA",
  "BANCO BETA",
  "BANCO GAMA",
  "GAMA DIGITAL",
  "ZETA",
  "MU",
  "ETA",
  "TETA",
  "SIRIUS",
];

const CATEGORIAS = [
  "script",
  "regras",
  "procedimento",
  "informativo",
  "argumentacao",
  "campanha",
  "definicao",
];

const VAZIO: EntradaConhecimento = {
  carteira: "",
  produto: "",
  categoria: "",
  descricao: "",
  texto: "",
  sinonimos: [],
};

const BaseConhecimentoIAModal: React.FC<BaseConhecimentoIAModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { toast } = useToast();

  const [itens, setItens] = useState<ConhecimentoIA[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [busca, setBusca] = useState("");
  const [filtroCarteira, setFiltroCarteira] = useState(TODAS);
  const [incluirInativos, setIncluirInativos] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [recarregar, setRecarregar] = useState(0);

  const [selecionado, setSelecionado] = useState<ConhecimentoIA | null>(null);
  const [formulario, setFormulario] = useState<EntradaConhecimento>(VAZIO);
  const [sinonimoNovo, setSinonimoNovo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(false);

  const [carteiraTeste, setCarteiraTeste] = useState("");
  const [perguntaTeste, setPerguntaTeste] = useState("");
  const [diagnostico, setDiagnostico] = useState<Diagnostico | null>(null);
  const [testando, setTestando] = useState(false);
  const [simulacao, setSimulacao] = useState<RespostaSimulada | null>(null);
  const [simulando, setSimulando] = useState(false);

  const buscaLimpa = busca.trim();
  const editando = selecionado !== null;

  const avisarErro = useCallback(
    (erro: unknown, titulo: string) => {
      const descricao =
        (erro as { response?: { data?: { erro?: string } } })?.response?.data
          ?.erro ?? "Não foi possível concluir a operação.";
      toast({ title: titulo, description: descricao, variant: "destructive" });
    },
    [toast],
  );

  // Busca no servidor com debounce e cancelamento — mesmo padrão do
  // AcessosModal. Sem o cancelamento, a resposta lenta de "ab" chega depois de
  // "abertura" e sobrescreve a lista certa.
  useEffect(() => {
    if (!isOpen) return;

    let ativo = true;
    setCarregando(true);
    const timer = window.setTimeout(async () => {
      try {
        const resultado = await baseConhecimentoIaApi.listar({
          carteira: filtroCarteira === TODAS ? undefined : filtroCarteira,
          busca: buscaLimpa || undefined,
          incluir_inativos: incluirInativos || undefined,
          pagina,
          tamanho: TAMANHO_PAGINA,
        });
        if (!ativo) return;
        setItens(resultado.itens);
        setTotal(resultado.total);
      } catch (erro) {
        if (ativo) avisarErro(erro, "Erro ao listar os treinamentos");
      } finally {
        if (ativo) setCarregando(false);
      }
    }, 250);

    return () => {
      ativo = false;
      window.clearTimeout(timer);
    };
  }, [
    isOpen,
    buscaLimpa,
    filtroCarteira,
    incluirInativos,
    pagina,
    recarregar,
    avisarErro,
  ]);

  useEffect(() => {
    setPagina(1);
  }, [buscaLimpa, filtroCarteira, incluirInativos]);

  useEffect(() => {
    if (isOpen) return;
    setSelecionado(null);
    setFormulario(VAZIO);
    setDiagnostico(null);
    setSimulacao(null);
  }, [isOpen]);

  const totalPaginas = Math.max(1, Math.ceil(total / TAMANHO_PAGINA));

  const carteiras = useMemo(() => {
    const vistas = new Set(CARTEIRAS_SUGERIDAS);
    itens.forEach((item) => vistas.add(item.carteira));
    return [...vistas].sort();
  }, [itens]);

  const abrir = (item: ConhecimentoIA) => {
    setSelecionado(item);
    setFormulario({
      carteira: item.carteira,
      produto: item.produto,
      categoria: item.categoria,
      descricao: item.descricao,
      texto: item.texto,
      sinonimos: item.sinonimos,
    });
  };

  const novo = () => {
    setSelecionado(null);
    setFormulario({
      ...VAZIO,
      carteira: filtroCarteira === TODAS ? "" : filtroCarteira,
    });
  };

  const alterar = (campo: keyof EntradaConhecimento, valor: string) =>
    setFormulario((atual) => ({ ...atual, [campo]: valor }));

  const adicionarSinonimo = () => {
    const limpo = sinonimoNovo.trim();
    if (!limpo) return;
    setFormulario((atual) => ({
      ...atual,
      sinonimos: [...new Set([...(atual.sinonimos ?? []), limpo])],
    }));
    setSinonimoNovo("");
  };

  const removerSinonimo = (alvo: string) =>
    setFormulario((atual) => ({
      ...atual,
      sinonimos: (atual.sinonimos ?? []).filter((item) => item !== alvo),
    }));

  const aplicarResultado = (item: ConhecimentoIA, titulo: string) => {
    setSelecionado(item);
    setRecarregar((valor) => valor + 1);
    if (item.aviso) {
      // Salvou, mas ficou sem vetor. Não é erro de gravação — o operador ainda
      // encontra o texto por palavra-chave — mas o supervisor precisa saber
      // que a busca semântica não cobre esse registro até reindexar.
      toast({ title: "Salvo com indexação pendente", description: item.aviso });
      return;
    }
    toast({ title: titulo });
  };

  const salvar = async () => {
    if (!formulario.carteira.trim()) {
      toast({
        title: "Informe a carteira",
        description:
          "O treinamento só é usado na carteira em que está cadastrado.",
        variant: "destructive",
      });
      return;
    }

    setSalvando(true);
    try {
      const entrada: EntradaConhecimento = {
        ...formulario,
        produto: formulario.produto.trim(),
        texto: formulario.texto.trim(),
      };
      const item = selecionado
        ? await baseConhecimentoIaApi.atualizar(selecionado.id, entrada)
        : await baseConhecimentoIaApi.criar(entrada);
      aplicarResultado(
        item,
        selecionado ? "Treinamento atualizado" : "Treinamento criado",
      );
    } catch (erro) {
      avisarErro(erro, "Erro ao salvar o treinamento");
    } finally {
      setSalvando(false);
    }
  };

  const alternarAtivo = async (item: ConhecimentoIA) => {
    setSalvando(true);
    try {
      const atualizado = item.ativo
        ? await baseConhecimentoIaApi.desativar(item.id)
        : await baseConhecimentoIaApi.reativar(item.id);
      aplicarResultado(
        atualizado,
        item.ativo ? "Treinamento desativado" : "Treinamento reativado",
      );
    } catch (erro) {
      avisarErro(erro, "Erro ao alterar o treinamento");
    } finally {
      setSalvando(false);
      setConfirmandoRemocao(false);
    }
  };

  const reindexar = async () => {
    if (!selecionado) return;
    setSalvando(true);
    try {
      const resultado = await baseConhecimentoIaApi.reindexar(selecionado.id);
      setRecarregar((valor) => valor + 1);
      toast({
        title: "Reindexado",
        description: `${resultado.indexados} treinamento(s) atualizados na busca semântica.`,
      });
    } catch (erro) {
      avisarErro(erro, "Erro ao reindexar");
    } finally {
      setSalvando(false);
    }
  };

  const validarTeste = () => {
    const carteira = carteiraTeste || formulario.carteira;
    if (!carteira || !perguntaTeste.trim()) {
      toast({
        title: "Preencha carteira e pergunta",
        description: "O teste simula exatamente a busca que a Aurora faz.",
        variant: "destructive",
      });
      return null;
    }
    return carteira;
  };

  const testar = async () => {
    const carteira = validarTeste();
    if (!carteira) return;

    setTestando(true);
    // A resposta antiga descreve a pergunta anterior; deixá-la na tela durante
    // a nova busca faz o supervisor ler o texto errado como se fosse o novo.
    setSimulacao(null);
    try {
      setDiagnostico(
        await baseConhecimentoIaApi.testar(carteira, perguntaTeste),
      );
    } catch (erro) {
      avisarErro(erro, "Erro ao testar a busca");
    } finally {
      setTestando(false);
    }
  };

  const verResposta = async () => {
    const carteira = validarTeste();
    if (!carteira) return;

    setSimulando(true);
    try {
      setSimulacao(
        await baseConhecimentoIaApi.testarResposta(carteira, perguntaTeste),
      );
    } catch (erro) {
      avisarErro(erro, "Erro ao gerar a resposta");
    } finally {
      setSimulando(false);
    }
  };

  const excedeuTexto = (formulario.texto?.length ?? 0) > TAMANHO_MAXIMO_TEXTO;

  return (
    <Dialog open={isOpen} onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Treinamentos da Aurora
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            O que está aqui é a fonte que a Aurora usa para responder aos
            operadores. Salvou, vale — sem deploy.
          </p>
        </DialogHeader>

        <Tabs
          defaultValue="cadastro"
          className="flex-1 overflow-hidden flex flex-col"
        >
          <TabsList className="w-fit">
            <TabsTrigger value="cadastro">Cadastro</TabsTrigger>
            <TabsTrigger value="teste">Testar busca</TabsTrigger>
          </TabsList>

          <TabsContent
            value="cadastro"
            className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-[minmax(0,340px)_1fr] gap-4 mt-4"
          >
            <div className="flex flex-col gap-3 overflow-hidden">
              <div className="flex gap-2">
                <Select
                  value={filtroCarteira}
                  onValueChange={setFiltroCarteira}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Carteira" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TODAS}>Todas as carteiras</SelectItem>
                    {carteiras.map((carteira) => (
                      <SelectItem key={carteira} value={carteira}>
                        {carteira}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={novo}
                  title="Novo treinamento"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Buscar por produto, descrição ou conteúdo"
                  value={busca}
                  onChange={(evento) => setBusca(evento.target.value)}
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={incluirInativos}
                  onChange={(evento) =>
                    setIncluirInativos(evento.target.checked)
                  }
                />
                Mostrar desativados
              </label>

              <div className="flex-1 overflow-y-auto border rounded-md divide-y">
                {carregando && (
                  <div className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando...
                  </div>
                )}

                {!carregando && itens.length === 0 && (
                  <div className="p-4 text-sm text-muted-foreground">
                    {filtroCarteira === TODAS
                      ? "Nenhum treinamento encontrado."
                      : `Nenhum treinamento cadastrado para ${filtroCarteira} ainda. Cadastre o primeiro no botão +.`}
                  </div>
                )}

                {itens.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => abrir(item)}
                    className={`w-full text-left p-3 hover:bg-muted/60 transition ${
                      selecionado?.id === item.id ? "bg-muted" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">
                        {item.produto}
                      </span>
                      <div className="flex gap-1 shrink-0">
                        {!item.ativo && (
                          <Badge variant="secondary">inativo</Badge>
                        )}
                        {!item.indexado && (
                          <Badge
                            variant="outline"
                            title="Sem busca semântica; só é encontrado por palavra-chave."
                          >
                            sem índice
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.carteira}
                      {item.descricao ? ` · ${item.descricao}` : ""}
                    </p>
                  </button>
                ))}
              </div>

              {totalPaginas > 1 && (
                <div className="flex items-center justify-between text-xs">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagina <= 1}
                    onClick={() => setPagina((valor) => valor - 1)}
                  >
                    Anterior
                  </Button>
                  <span className="text-muted-foreground">
                    {pagina} de {totalPaginas} · {total} itens
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagina >= totalPaginas}
                    onClick={() => setPagina((valor) => valor + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 overflow-y-auto pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Carteira</Label>
                  <Select
                    value={formulario.carteira}
                    onValueChange={(valor) => alterar("carteira", valor)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a carteira" />
                    </SelectTrigger>
                    <SelectContent>
                      {carteiras.map((carteira) => (
                        <SelectItem key={carteira} value={carteira}>
                          {carteira}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Produto / assunto</Label>
                  <Input
                    value={formulario.produto}
                    onChange={(evento) =>
                      alterar("produto", evento.target.value)
                    }
                    placeholder="ex.: treinamento_abertura"
                  />
                </div>

                <div className="space-y-1">
                  <Label>Categoria</Label>
                  <Select
                    value={formulario.categoria || ""}
                    onValueChange={(valor) => alterar("categoria", valor)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS.map((categoria) => (
                        <SelectItem key={categoria} value={categoria}>
                          {categoria}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Descrição</Label>
                  <Input
                    value={formulario.descricao}
                    onChange={(evento) =>
                      alterar("descricao", evento.target.value)
                    }
                    placeholder="Resumo em uma linha"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Sinônimos</Label>
                <p className="text-xs text-muted-foreground">
                  Como o operador chamaria isso na prática. Ajuda quando ele usa
                  a gíria da carteira em vez do termo oficial.
                </p>
                <div className="flex gap-2">
                  <Input
                    value={sinonimoNovo}
                    onChange={(evento) => setSinonimoNovo(evento.target.value)}
                    onKeyDown={(evento) => {
                      if (evento.key === "Enter") {
                        evento.preventDefault();
                        adicionarSinonimo();
                      }
                    }}
                    placeholder="ex.: raspa conta"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={adicionarSinonimo}
                  >
                    Adicionar
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1 pt-1">
                  {(formulario.sinonimos ?? []).map((sinonimo) => (
                    <Badge key={sinonimo} variant="secondary" className="gap-1">
                      {sinonimo}
                      <button
                        type="button"
                        onClick={() => removerSinonimo(sinonimo)}
                        className="hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label>Conteúdo do treinamento</Label>
                  <span
                    className={`text-xs ${
                      excedeuTexto ? "text-destructive" : "text-muted-foreground"
                    }`}
                  >
                    {formulario.texto?.length ?? 0} / {TAMANHO_MAXIMO_TEXTO}
                  </span>
                </div>
                <Textarea
                  rows={12}
                  value={formulario.texto}
                  onChange={(evento) => alterar("texto", evento.target.value)}
                  placeholder="Escreva a orientação como você a passaria para o operador. Trechos curtos e específicos são recuperados com mais precisão que textos longos."
                />
              </div>

              {selecionado && !selecionado.indexado && (
                <div className="flex items-start gap-2 text-xs rounded-md border border-amber-300 bg-amber-50 p-2 text-amber-900">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Sem índice semântico. A Aurora só encontra este treinamento
                    por palavra-chave até você reindexar.
                  </span>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <Button onClick={salvar} disabled={salvando || excedeuTexto}>
                  {salvando ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {editando ? "Salvar alterações" : "Criar treinamento"}
                </Button>

                {selecionado && (
                  <>
                    <Button
                      variant="outline"
                      onClick={reindexar}
                      disabled={salvando}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Reindexar
                    </Button>

                    {selecionado.ativo ? (
                      <Button
                        variant="outline"
                        onClick={() => setConfirmandoRemocao(true)}
                        disabled={salvando}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Desativar
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => alternarAtivo(selecionado)}
                        disabled={salvando}
                      >
                        <Undo2 className="h-4 w-4 mr-2" />
                        Reativar
                      </Button>
                    )}
                  </>
                )}
              </div>

              {selecionado?.atualizado_em && (
                <p className="text-xs text-muted-foreground">
                  Última alteração em{" "}
                  {new Date(selecionado.atualizado_em).toLocaleString("pt-BR")}
                  {selecionado.atualizado_por
                    ? ` por ${selecionado.atualizado_por}`
                    : ""}
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent
            value="teste"
            className="flex-1 overflow-y-auto mt-4 space-y-3"
          >
            <p className="text-sm text-muted-foreground">
              Faça a pergunta como o operador faria. O resultado é exatamente o
              que a Aurora encontraria — inclusive o corte de relevância.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,240px)_1fr_auto] gap-2">
              <Select
                value={carteiraTeste || formulario.carteira}
                onValueChange={setCarteiraTeste}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Carteira" />
                </SelectTrigger>
                <SelectContent>
                  {carteiras.map((carteira) => (
                    <SelectItem key={carteira} value={carteira}>
                      {carteira}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                value={perguntaTeste}
                onChange={(evento) => setPerguntaTeste(evento.target.value)}
                onKeyDown={(evento) => evento.key === "Enter" && testar()}
                placeholder="ex.: o cliente disse que está sem grana"
              />

              <div className="flex gap-2">
                <Button onClick={testar} disabled={testando}>
                  {testando ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Search className="h-4 w-4 mr-2" />
                  )}
                  Ver o que ela acha
                </Button>
                <Button
                  variant="outline"
                  onClick={verResposta}
                  disabled={simulando}
                >
                  {simulando ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Ver a resposta
                </Button>
              </div>
            </div>

            {simulacao && (
              <div className="rounded-md border bg-muted/40 p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    Resposta da Aurora
                  </span>
                  <Badge
                    variant={simulacao.usou_treinamento ? "default" : "outline"}
                  >
                    {simulacao.usou_treinamento
                      ? "com treinamento"
                      : "sem treinamento"}
                  </Badge>
                </div>

                {!simulacao.usou_treinamento && (
                  <p className="text-xs text-amber-700">
                    Nenhum treinamento foi usado — isso é resposta genérica. Se a
                    pergunta deveria ter orientação da carteira, falta cadastrar
                    ou ajustar a ficha.
                  </p>
                )}

                <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {simulacao.resposta}
                  </ReactMarkdown>
                </div>

                {simulacao.itens.length > 0 && (
                  <p className="text-xs text-muted-foreground pt-1 border-t">
                    Baseada em:{" "}
                    {simulacao.itens.map((item) => item.produto).join(", ")}
                  </p>
                )}

                <p className="text-xs text-muted-foreground">
                  Teste isolado: não entra no histórico do chat nem nos
                  indicadores. Os KPIs do operador não fazem parte da simulação.
                </p>
              </div>
            )}

            {diagnostico && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">
                    {diagnostico.modo === "hibrido"
                      ? "busca semântica + palavra-chave"
                      : "somente palavra-chave"}
                  </Badge>
                  <span>corte em {diagnostico.limiar}</span>
                </div>

                {diagnostico.modo === "lexical" && (
                  <p className="text-xs text-amber-700">
                    Nenhum treinamento desta carteira está indexado (ou a
                    indexação está indisponível). A busca caiu para
                    palavra-chave.
                  </p>
                )}

                {diagnostico.itens.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Nada foi encontrado. Para a Aurora, essa pergunta hoje não
                    tem treinamento — ela responderia de forma genérica.
                  </p>
                )}

                <div className="border rounded-md divide-y">
                  {diagnostico.itens.map((item) => (
                    <div
                      key={`${item.id}-${item.produto}`}
                      className={`p-3 text-sm ${item.usado ? "" : "opacity-60"}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{item.produto}</span>
                        <Badge variant={item.usado ? "default" : "outline"}>
                          {item.usado ? "usado" : "cortado"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {item.carteira}
                        {item.descricao ? ` · ${item.descricao}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        final {item.score} · semântico {item.score_vetorial} ·
                        palavra-chave {item.score_lexical}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>

      <AlertDialog
        open={confirmandoRemocao}
        onOpenChange={setConfirmandoRemocao}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar este treinamento?</AlertDialogTitle>
            <AlertDialogDescription>
              A Aurora para de usá-lo imediatamente. O texto continua no banco
              e pode ser reativado a qualquer momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selecionado && alternarAtivo(selecionado)}
            >
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};

export default BaseConhecimentoIAModal;
