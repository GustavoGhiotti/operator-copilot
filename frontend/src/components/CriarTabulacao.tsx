import { useCallback, useEffect, useMemo, useState } from "react";
import axiosInstance from "@/utils/axiosInstance";
import { useToast } from "@/hooks/use-toast";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "./ui/textarea";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@radix-ui/react-checkbox";

interface CriarTabulacaoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TabulacaoApi {
  ID: number;
  TABULACAO: string;
  DESCRICAO: string;
  CARTEIRA: string;
  OCULTAR: boolean | 0 | 1;
}

interface Tabulacao {
  id: number;
  tabulacao: string;
  descricao: string;
  carteira: string;
  ocultar: 0 | 1;
}

interface FormTabulacao {
  tabulacao: string;
  descricao: string;
  carteira: string;
  ocultar: boolean;
}

interface TabulacaoPayload {
  tabulacao: string;
  descricao: string;
  carteira: string;
  ocultar: 0 | 1;
}

const carteirasDisponiveis = [
  {
    label: "MU",
    value: "MU",
  },
  {
    label: "ORION S.A",
    value: "ANTARES",
  },
  {
    label: "BANCO IOTA",
    value: "PAULISTA",
  },
  {
    label: "BANCO KAPPA",
    value: "KAPPA",
  },
  {
    label: "BANCO PHI",
    value: "RIGEL",
  },
  {
    label: "RHO",
    value: "RHO",
  },
  {
    label: "NU",
    value: "NU",
  },
  {
    label: "BANCO ALFA",
    value: "ALFA",
  },
  {
    label: "GAMA",
    value: "GAMA",
  },
  {
    label: "TETA",
    value: "TETA",
  },
  {
    label: "DELTA",
    value: "DELTA",
  },
  {
    label: "BANCO BETA",
    value: "BETA",
  },
  {
    label: "ZETA",
    value: "ZETA",
  },
  {
    label: "CREDYSYTEM",
    value: "CREDYSYTEM",
  },
  {
    label: "VEGA",
    value: "VEGA",
  },
  {
    label: "PI",
    value: "PI",
  },
  {
    label: "ARC4",
    value: "ARC4",
  },
  {
    label: "SIGMA",
    value: "SIGMA",
  },
  {
    label: "SIRIUS",
    value: "SIRIUS",
  }
];

const formInicial: FormTabulacao = {
  tabulacao: "",
  descricao: "",
  carteira: "",
  ocultar: false,
};

const mapearTabulacaoApi = (item: TabulacaoApi): Tabulacao => {
  return {
    id: item.ID,
    tabulacao: item.TABULACAO,
    descricao: item.DESCRICAO,
    carteira: item.CARTEIRA,
    ocultar: item.OCULTAR === true || item.OCULTAR === 1 ? 1 : 0,
  };
};

const normalizarTexto = (valor: string) => valor.trim();

const normalizarParaComparacao = (valor: string) =>
  valor.trim().toLowerCase();

export default function CriarTabulacao({
  isOpen,
  onClose,
}: CriarTabulacaoModalProps) {
  const carteirasOrdenadas = useMemo(() => {
    return [...carteirasDisponiveis].sort((a, b) =>
      a.label.localeCompare(b.label, "pt-BR"),
    );
  }, []);

  const { toast } = useToast();

  const [tabulacoes, setTabulacoes] = useState<Tabulacao[]>([]);

  const [formCadastro, setFormCadastro] =
    useState<FormTabulacao>(formInicial);

  const [formEdicao, setFormEdicao] =
    useState<FormTabulacao>(formInicial);

  const [tabulacaoEditando, setTabulacaoEditando] =
    useState<Tabulacao | null>(null);

  const [modalEdicaoAberto, setModalEdicaoAberto] = useState(false);

  const [carregandoLista, setCarregandoLista] = useState(false);
  const [salvandoCadastro, setSalvandoCadastro] = useState(false);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [excluindoId, setExcluindoId] = useState<number | null>(null);
  const [alterandoStatusId, setAlterandoStatusId] = useState<number | null>(
    null,
  );

  const listaBloqueada =
    carregandoLista ||
    salvandoCadastro ||
    salvandoEdicao ||
    excluindoId !== null ||
    alterandoStatusId !== null;

  const limparFormularioCadastro = useCallback(() => {
    setFormCadastro(formInicial);
  }, []);

  const fecharModalEdicao = useCallback(() => {
    setModalEdicaoAberto(false);
    setTabulacaoEditando(null);
    setFormEdicao(formInicial);
  }, []);

  const atualizarCampoCadastro = useCallback(
    <K extends keyof FormTabulacao>(campo: K, valor: FormTabulacao[K]) => {
      setFormCadastro((estadoAtual) => ({
        ...estadoAtual,
        [campo]: valor,
      }));
    },
    [],
  );

  const atualizarCampoEdicao = useCallback(
    <K extends keyof FormTabulacao>(campo: K, valor: FormTabulacao[K]) => {
      setFormEdicao((estadoAtual) => ({
        ...estadoAtual,
        [campo]: valor,
      }));
    },
    [],
  );

  const montarPayload = useCallback((form: FormTabulacao): TabulacaoPayload => {
    return {
      tabulacao: normalizarTexto(form.tabulacao),
      descricao: normalizarTexto(form.descricao),
      carteira: normalizarTexto(form.carteira),
      ocultar: form.ocultar ? 1 : 0,
    };
  }, []);

  const verificarDuplicidade = useCallback(
    (form: FormTabulacao, idIgnorado?: number | null) => {
      const tabulacaoAtual = normalizarParaComparacao(form.tabulacao);
      const carteiraAtual = normalizarParaComparacao(form.carteira);

      if (!tabulacaoAtual || !carteiraAtual) {
        return false;
      }

      return tabulacoes.some((item) => {
        const mesmaTabulacao =
          normalizarParaComparacao(item.tabulacao) === tabulacaoAtual;

        const mesmaCarteira =
          normalizarParaComparacao(item.carteira) === carteiraAtual;

        const mesmoRegistro = item.id === idIgnorado;

        return mesmaTabulacao && mesmaCarteira && !mesmoRegistro;
      });
    },
    [tabulacoes],
  );

  const cadastroDuplicado = useMemo(() => {
    return verificarDuplicidade(formCadastro, null);
  }, [formCadastro, verificarDuplicidade]);

  const edicaoDuplicada = useMemo(() => {
    return verificarDuplicidade(formEdicao, tabulacaoEditando?.id ?? null);
  }, [formEdicao, tabulacaoEditando, verificarDuplicidade]);

  const validarFormulario = useCallback(
    (form: FormTabulacao, duplicado: boolean) => {
      if (!form.tabulacao.trim()) {
        toast({
          title: "Campo obrigatório",
          description: "Informe a tabulação.",
          variant: "destructive",
        });

        return false;
      }

      if (!form.descricao.trim()) {
        toast({
          title: "Campo obrigatório",
          description: "Informe a descrição.",
          variant: "destructive",
        });

        return false;
      }

      if (!form.carteira.trim()) {
        toast({
          title: "Campo obrigatório",
          description: "Informe a carteira.",
          variant: "destructive",
        });

        return false;
      }

      if (duplicado) {
        toast({
          title: "Tabulação duplicada",
          description: "Já existe uma tabulação com esse nome para esta carteira.",
          variant: "destructive",
        });

        return false;
      }

      return true;
    },
    [toast],
  );

  const extrairTabulacoesDaResposta = (data: unknown): Tabulacao[] => {
    const resposta = data as
      | TabulacaoApi[]
      | {
          resultado?: TabulacaoApi[];
          data?: TabulacaoApi[];
          tabulacoes?: TabulacaoApi[];
          result?: TabulacaoApi[];
        };

    if (Array.isArray(resposta)) {
      return resposta.map(mapearTabulacaoApi);
    }

    if (Array.isArray(resposta.resultado)) {
      return resposta.resultado.map(mapearTabulacaoApi);
    }

    if (Array.isArray(resposta.data)) {
      return resposta.data.map(mapearTabulacaoApi);
    }

    if (Array.isArray(resposta.tabulacoes)) {
      return resposta.tabulacoes.map(mapearTabulacaoApi);
    }

    if (Array.isArray(resposta.result)) {
      return resposta.result.map(mapearTabulacaoApi);
    }

    return [];
  };

  const carregarTabulacoes = useCallback(async () => {
    try {
      setCarregandoLista(true);

      const response = await axiosInstance.get<unknown>("/api/tabulacoes");

      const lista = extrairTabulacoesDaResposta(response.data);

      setTabulacoes(lista);
    } catch (error) {
      console.error("Erro ao carregar tabulações:", error);

      toast({
        title: "Erro",
        description: "Não foi possível carregar as tabulações.",
        variant: "destructive",
      });

      setTabulacoes([]);
    } finally {
      setCarregandoLista(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    limparFormularioCadastro();
    fecharModalEdicao();
    carregarTabulacoes();
  }, [isOpen, limparFormularioCadastro, fecharModalEdicao, carregarTabulacoes]);

  const salvarCadastro = useCallback(async () => {
    if (!validarFormulario(formCadastro, cadastroDuplicado)) {
      return;
    }

    try {
      setSalvandoCadastro(true);

      const payload = montarPayload(formCadastro);

      await axiosInstance.post("/api/tabulacoes", payload);

      toast({
        title: "Tabulação cadastrada",
        description: "A tabulação foi cadastrada com sucesso.",
      });

      limparFormularioCadastro();
      await carregarTabulacoes();
    } catch (error) {
      console.error("Erro ao cadastrar tabulação:", error);

      toast({
        title: "Erro",
        description: "Não foi possível cadastrar a tabulação.",
        variant: "destructive",
      });
    } finally {
      setSalvandoCadastro(false);
    }
  }, [
    formCadastro,
    cadastroDuplicado,
    validarFormulario,
    montarPayload,
    toast,
    limparFormularioCadastro,
    carregarTabulacoes,
  ]);

  const abrirModalEdicao = useCallback((item: Tabulacao) => {
    setTabulacaoEditando(item);

    setFormEdicao({
      tabulacao: item.tabulacao,
      descricao: item.descricao,
      carteira: item.carteira,
      ocultar: item.ocultar === 1,
    });

    setModalEdicaoAberto(true);
  }, []);

  const salvarEdicao = useCallback(async () => {
    if (!tabulacaoEditando) {
      return;
    }

    if (!validarFormulario(formEdicao, edicaoDuplicada)) {
      return;
    }

    try {
      setSalvandoEdicao(true);

      const payload = montarPayload(formEdicao);

      await axiosInstance.put(`/api/tabulacoes/${tabulacaoEditando.id}`, payload);

      toast({
        title: "Tabulação atualizada",
        description: "A tabulação foi atualizada com sucesso.",
      });

      fecharModalEdicao();
      await carregarTabulacoes();
    } catch (error) {
      console.error("Erro ao editar tabulação:", error);

      toast({
        title: "Erro",
        description: "Não foi possível editar a tabulação.",
        variant: "destructive",
      });
    } finally {
      setSalvandoEdicao(false);
    }
  }, [
    tabulacaoEditando,
    formEdicao,
    edicaoDuplicada,
    validarFormulario,
    montarPayload,
    toast,
    fecharModalEdicao,
    carregarTabulacoes,
  ]);

  const excluirTabulacao = useCallback(
    async (id: number) => {
      const confirmar = window.confirm(
        "Tem certeza que deseja excluir esta tabulação?",
      );

      if (!confirmar) {
        return;
      }

      try {
        setExcluindoId(id);

        await axiosInstance.delete(`/api/tabulacoes/${id}`);

        toast({
          title: "Tabulação excluída",
          description: "A tabulação foi excluída com sucesso.",
        });

        if (tabulacaoEditando?.id === id) {
          fecharModalEdicao();
        }

        await carregarTabulacoes();
      } catch (error) {
        console.error("Erro ao excluir tabulação:", error);

        toast({
          title: "Erro",
          description: "Não foi possível excluir a tabulação.",
          variant: "destructive",
        });
      } finally {
        setExcluindoId(null);
      }
    },
    [tabulacaoEditando, toast, fecharModalEdicao, carregarTabulacoes],
  );

  const alternarStatus = useCallback(
    async (item: Tabulacao) => {
      const novoStatus: 0 | 1 = item.ocultar === 1 ? 0 : 1;

      const tabulacoesAnteriores = tabulacoes;

      try {
        setAlterandoStatusId(item.id);

        setTabulacoes((estadoAtual) =>
          estadoAtual.map((tabulacao) =>
            tabulacao.id === item.id
              ? {
                  ...tabulacao,
                  ocultar: novoStatus,
                }
              : tabulacao,
          ),
        );

        await axiosInstance.put(`/api/tabulacoes/${item.id}`, {
          tabulacao: item.tabulacao,
          descricao: item.descricao,
          carteira: item.carteira,
          ocultar: novoStatus,
        } satisfies TabulacaoPayload);

        toast({
          title: "Status atualizado",
          description: "O status da tabulação foi alterado.",
        });
      } catch (error) {
        console.error("Erro ao alterar status da tabulação:", error);

        setTabulacoes(tabulacoesAnteriores);

        toast({
          title: "Erro",
          description: "Não foi possível alterar o status.",
          variant: "destructive",
        });
      } finally {
        setAlterandoStatusId(null);
      }
    },
    [tabulacoes, toast],
  );

  const fecharModalPrincipal = useCallback(
    (open: boolean) => {
      if (!open) {
        onClose();
      }
    },
    [onClose],
  );

  const normalizarBusca = (valor: string) =>
    valor
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  const [buscaTabulacao, setBuscaTabulacao] = useState("");
  const [filtroCarteira, setFiltroCarteira] = useState("TODAS");
  const [filtroVisibilidade, setFiltroVisibilidade] = useState("TODOS");

  const tabulacoesParaRenderizar = useMemo(() => {
    const lista = Array.isArray(tabulacoes) ? tabulacoes : [];

    const buscaNormalizada = normalizarBusca(buscaTabulacao);

    return lista.filter((item) => {
      const textoCompleto = normalizarBusca(
        `${item.tabulacao} ${item.descricao} ${item.carteira}`,
      );

      const passouNaBusca =
        !buscaNormalizada || textoCompleto.includes(buscaNormalizada);

      const passouNaCarteira =
        filtroCarteira === "TODAS" || item.carteira === filtroCarteira;

      const passouNaVisibilidade =
        filtroVisibilidade === "TODOS" ||
        (filtroVisibilidade === "VISIVEIS" && item.ocultar === 0) ||
        (filtroVisibilidade === "OCULTOS" && item.ocultar === 1);

      return passouNaBusca && passouNaCarteira && passouNaVisibilidade;
    });
  }, [tabulacoes, buscaTabulacao, filtroCarteira, filtroVisibilidade]);

  const carteirasFiltro = useMemo(() => {
    const lista = Array.isArray(tabulacoes) ? tabulacoes : [];

    const carteirasUnicas = Array.from(
      new Set(lista.map((item) => item.carteira).filter(Boolean)),
    );

    return carteirasUnicas.sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [tabulacoes]);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={fecharModalPrincipal}>
        <DialogContent className="max-w-[95%] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Cadastro de Tabulações
            </DialogTitle>

            <DialogDescription>
              Cadastre, ative, desative, edite ou exclua tabulações disponíveis no sistema.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Card>
              <CardContent className="p-4 space-y-4">
                <div>
                  <h3 className="text-sm font-bold">Nova tabulação</h3>

                  <p className="text-xs text-muted-foreground">
                    Preencha os dados abaixo para cadastrar uma nova tabulação.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="tabulacao">Tabulação</Label>

                      <Input
                        id="tabulacao"
                        value={formCadastro.tabulacao}
                        maxLength={100}
                        placeholder="Ex: ACORDO REALIZADO"
                        disabled={salvandoCadastro}
                        onChange={(event) =>
                          atualizarCampoCadastro("tabulacao", event.target.value)
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="carteira">Carteira</Label>

                      <Select
                        value={formCadastro.carteira}
                        disabled={salvandoCadastro}
                        onValueChange={(value) =>
                          atualizarCampoCadastro("carteira", value)
                        }
                      >
                        <SelectTrigger id="carteira">
                          <SelectValue placeholder="Selecione uma carteira" />
                        </SelectTrigger>

                        <SelectContent>
                          {carteirasOrdenadas.map((carteira) => (
                            <SelectItem key={carteira.value} value={carteira.value}>
                              {carteira.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="descricao">Descrição</Label>

                    <Textarea
                      className="max-h-[10vh]"
                      id="descricao"
                      value={formCadastro.descricao}
                      maxLength={1255}
                      placeholder="Descrição da tabulação"
                      disabled={salvandoCadastro}
                      onChange={(event) =>
                        atualizarCampoCadastro("descricao", event.target.value)
                      }
                    />
                  </div>
                </div>

                {cadastroDuplicado && (
                  <p className="text-sm text-destructive">
                    Já existe uma tabulação com esse nome para esta carteira.
                  </p>
                )}

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={limparFormularioCadastro}
                    disabled={salvandoCadastro}
                  >
                    Limpar
                  </Button>

                  <Button
                    type="button"
                    onClick={salvarCadastro}
                    disabled={salvandoCadastro || cadastroDuplicado}
                  >
                    {salvandoCadastro ? "Salvando..." : "Cadastrar"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="text-sm font-bold">Tabulações cadastradas</h3>

                    <p className="text-xs text-muted-foreground">
                      Gerencie as tabulações disponíveis para uso no sistema.
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={carregarTabulacoes}
                    disabled={carregandoLista}
                  >
                    {carregandoLista ? "Atualizando..." : "Atualizar lista"}
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="buscar-tabulacao">Buscar</Label>

                    <Input
                      id="buscar-tabulacao"
                      value={buscaTabulacao}
                      placeholder="Buscar por tabulação, descrição ou carteira..."
                      onChange={(event) => setBuscaTabulacao(event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Carteira</Label>

                    <Select
                      value={filtroCarteira}
                      onValueChange={setFiltroCarteira}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todas as carteiras" />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="TODAS">Todas</SelectItem>

                        {carteirasFiltro.map((carteira) => (
                          <SelectItem key={carteira} value={carteira}>
                            {carteira}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Visibilidade</Label>

                    <Select
                      value={filtroVisibilidade}
                      onValueChange={setFiltroVisibilidade}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todos os status" />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="TODOS">Todos</SelectItem>
                        <SelectItem value="VISIVEIS">Visíveis</SelectItem>
                        <SelectItem value="OCULTOS">Ocultos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-xs text-muted-foreground">
                    Exibindo {tabulacoesParaRenderizar.length} de {tabulacoes.length} tabulações.
                  </p>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setBuscaTabulacao("");
                      setFiltroCarteira("TODAS");
                      setFiltroVisibilidade("TODOS");
                    }}
                  >
                    Limpar filtros
                  </Button>
                </div>

                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tabulações cadastradas</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {tabulacoesParaRenderizar.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={1}
                            className="text-center text-sm text-muted-foreground"
                          >
                            {carregandoLista
                              ? "Carregando tabulações..."
                              : "Nenhuma tabulação encontrada com os filtros aplicados."}
                          </TableCell>
                        </TableRow>
                      ) : (
                        tabulacoesParaRenderizar.map((item) => {
                          const alterandoEsteStatus = alterandoStatusId === item.id;
                          const excluindoEsteItem = excluindoId === item.id;

                          return (
                            <TableRow key={item.id}>
                              <TableCell colSpan={1} className="py-4">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="min-w-0 flex-1 space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-semibold text-sm">
                                        {item.tabulacao}
                                      </span>

                                      <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                                        {item.carteira}
                                      </span>
                                    </div>

                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                      {item.descricao}
                                    </p>
                                  </div>

                                  <div className="flex shrink-0 items-center justify-end gap-3">
                                    <label className="flex items-center gap-2 cursor-pointer text-sm whitespace-nowrap">
                                      <span>
                                        {alterandoEsteStatus
                                          ? "Alterando..."
                                          : item.ocultar === 1
                                            ? "Oculto"
                                            : "Visível"}
                                      </span>

                                      <input
                                        type="checkbox"
                                        checked={item.ocultar === 1}
                                        disabled={listaBloqueada}
                                        onChange={() => alternarStatus(item)}
                                      />
                                    </label>

                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => abrirModalEdicao(item)}
                                      disabled={listaBloqueada}
                                    >
                                      Editar
                                    </Button>

                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => excluirTabulacao(item.id)}
                                      disabled={listaBloqueada}
                                    >
                                      {excluindoEsteItem ? "Excluindo..." : "Excluir"}
                                    </Button>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={modalEdicaoAberto}
        onOpenChange={(open) => {
          if (!open) {
            fecharModalEdicao();
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar tabulação</DialogTitle>

            <DialogDescription>
              Altere os dados da tabulação selecionada e salve as modificações.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editar-tabulacao">Tabulação</Label>

              <Input
                id="editar-tabulacao"
                value={formEdicao.tabulacao}
                maxLength={100}
                placeholder="Ex: ACORDO REALIZADO"
                disabled={salvandoEdicao}
                onChange={(event) =>
                  atualizarCampoEdicao("tabulacao", event.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editar-descricao">Descrição</Label>

              <Input
                id="editar-descricao"
                value={formEdicao.descricao}
                maxLength={255}
                placeholder="Descrição da tabulação"
                disabled={salvandoEdicao}
                onChange={(event) =>
                  atualizarCampoEdicao("descricao", event.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editar-carteira">Carteira</Label>

              <Select
                value={formEdicao.carteira}
                disabled={salvandoEdicao}
                onValueChange={(value) =>
                  atualizarCampoEdicao("carteira", value)
                }
              >
                <SelectTrigger id="editar-carteira">
                  <SelectValue placeholder="Selecione uma carteira" />
                </SelectTrigger>

                <SelectContent>
                  {carteirasOrdenadas.map((carteira) => (
                    <SelectItem key={carteira.value} value={carteira.value}>
                      {carteira.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="editar-ocultar"
                type="checkbox"
                checked={formEdicao.ocultar}
                disabled={salvandoEdicao}
                onChange={(event) =>
                  atualizarCampoEdicao("ocultar", event.target.checked)
                }
              />

              <Label htmlFor="editar-ocultar">Ocultar</Label>
            </div>

            {edicaoDuplicada && (
              <p className="text-sm text-destructive">
                Já existe uma tabulação com esse nome para esta carteira.
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={fecharModalEdicao}
                disabled={salvandoEdicao}
              >
                Cancelar
              </Button>

              <Button
                type="button"
                onClick={salvarEdicao}
                disabled={salvandoEdicao || edicaoDuplicada}
              >
                {salvandoEdicao ? "Salvando..." : "Salvar alterações"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}