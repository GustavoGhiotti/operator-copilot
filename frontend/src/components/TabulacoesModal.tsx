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
import { Database, Search, SlidersHorizontal } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface VisualizarTabulacoesModalProps {
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

const mapearTabulacaoApi = (item: TabulacaoApi): Tabulacao => {
  return {
    id: item.ID,
    tabulacao: item.TABULACAO,
    descricao: item.DESCRICAO,
    carteira: item.CARTEIRA,
    ocultar: item.OCULTAR === true || item.OCULTAR === 1 ? 1 : 0,
  };
};

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

const normalizarBusca = (valor: string) => {
  return valor
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
};

export default function VisualizarTabulacoes({
  isOpen,
  onClose,
}: VisualizarTabulacoesModalProps) {
  const { toast } = useToast();

  const [tabulacoes, setTabulacoes] = useState<Tabulacao[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(false);

  const [buscaTabulacao, setBuscaTabulacao] = useState("");
  const [filtroCarteira, setFiltroCarteira] = useState("TODAS");
  const [filtroVisibilidade, setFiltroVisibilidade] = useState("TODOS");

  const carteira = localStorage.getItem("centroCusto")?.trim() || "";

  const carregarTabulacoes = useCallback(async () => {
    try {
      setCarregandoLista(true);

      const response = await axiosInstance.get<unknown>(`/api/tabulacoes/listar/${carteira}`);

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

    carregarTabulacoes();
  }, [isOpen, carregarTabulacoes]);

  const fecharModalPrincipal = useCallback(
    (open: boolean) => {
      if (!open) {
        onClose();
      }
    },
    [onClose],
  );

  const carteirasFiltro = useMemo(() => {
    const carteirasUnicas = Array.from(
      new Set(tabulacoes.map((item) => item.carteira).filter(Boolean)),
    );

    return carteirasUnicas.sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [tabulacoes]);

  const tabulacoesParaRenderizar = useMemo(() => {
    const buscaNormalizada = normalizarBusca(buscaTabulacao);

    return tabulacoes.filter((item) => {
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

  const limparFiltros = useCallback(() => {
    setBuscaTabulacao("");
    setFiltroCarteira("TODAS");
    setFiltroVisibilidade("TODOS");
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={fecharModalPrincipal}>
      <DialogContent className="max-h-[84vh] w-[calc(100vw-2rem)] max-w-5xl overflow-hidden rounded-xl border border-blue-400/50 bg-[#020b18] p-0 text-slate-100 shadow-[0_0_60px_rgba(37,99,235,0.2),inset_0_0_50px_rgba(37,99,235,0.03)] sm:w-[calc(100vw-4rem)] [&>button]:right-5 [&>button]:top-5 [&>button]:rounded-md [&>button]:border [&>button]:border-blue-400/50 [&>button]:bg-blue-500/10 [&>button]:p-2 [&>button]:text-blue-300 [&>button:hover]:bg-blue-500/20 [&>button:hover]:text-blue-100">
        <div className="pointer-events-none absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(37,99,235,.15)_1px,transparent_1px),linear-gradient(90deg,rgba(37,99,235,.15)_1px,transparent_1px)] [background-size:28px_28px]" />

        <DialogHeader className="relative border-b border-blue-500/25 bg-[radial-gradient(circle_at_85%_20%,rgba(37,99,235,.16),transparent_32%),rgba(2,11,24,.96)] px-5 py-5 pr-16 text-left">
          <div className="flex items-center gap-3">
            <div className="rounded-md border border-blue-400/50 bg-blue-500/10 p-2 text-blue-300 shadow-[0_0_18px_rgba(59,130,246,.25)]">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold tracking-tight text-slate-100">Visualizar Tabulações</DialogTitle>
              <DialogDescription className="mt-1 text-xs text-blue-200/45">Consulte as tabulações disponíveis para sua operação.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="relative max-h-[calc(84vh-82px)] overflow-y-auto p-4 [scrollbar-color:rgba(59,130,246,.65)_rgba(3,15,35,.7)] md:p-5">
          <Card className="rounded-b-none border-blue-400/45 bg-[#031022]/90 shadow-[0_0_25px_rgba(37,99,235,.07)]">
            <CardContent className="space-y-4 p-4 md:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-500/15 pb-4">
                <div className="flex items-center gap-3">
                  <Database className="h-5 w-5 text-blue-400 [filter:drop-shadow(0_0_7px_rgba(59,130,246,.65))]" />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">Tabulações cadastradas</h3>
                    <p className="mt-0.5 text-xs text-blue-200/40">Base de consulta atualizada para a carteira ativa.</p>
                  </div>
                </div>
                <div className="rounded-md border border-blue-500/35 bg-blue-500/[0.07] px-3 py-1.5 text-xs text-blue-300">
                  {tabulacoesParaRenderizar.length} / {tabulacoes.length} registros
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="buscar-tabulacao" className="text-[11px] uppercase tracking-[0.14em] text-blue-200/55">Buscar tabulação</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-400" />
                  <Input id="buscar-tabulacao" value={buscaTabulacao} placeholder="Buscar por nome ou descrição..." onChange={(event) => setBuscaTabulacao(event.target.value)} className="h-10 rounded-md border-blue-500/35 bg-[#020b18]/90 pl-10 text-sm text-slate-100 placeholder:text-blue-200/25 focus-visible:border-blue-400 focus-visible:ring-blue-500/30" />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-blue-200/40">Exibindo {tabulacoesParaRenderizar.length} de {tabulacoes.length} tabulações.</p>
                <Button type="button" variant="ghost" size="sm" onClick={limparFiltros} className="h-8 rounded-md border border-blue-500/25 bg-blue-500/[0.05] text-xs text-blue-300 hover:bg-blue-500/15 hover:text-blue-100">Limpar filtro</Button>
              </div>

              <div className="overflow-hidden rounded-md border border-blue-400/45 bg-[#020b18]/80 shadow-[inset_0_0_28px_rgba(37,99,235,.025)]">
              <Table>
                <TableHeader className="bg-blue-500/[0.09]">
                  <TableRow className="border-blue-500/25 hover:bg-transparent">
                    <TableHead className="h-10 text-[11px] uppercase tracking-[0.12em] text-blue-200/65">Tabulação</TableHead>
                    <TableHead className="h-10 text-[11px] uppercase tracking-[0.12em] text-blue-200/65">Descrição</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {tabulacoesParaRenderizar.length === 0 ? (
                    <TableRow className="border-blue-500/15 hover:bg-transparent">
                      <TableCell
                        colSpan={4}
                        className="h-32 text-center text-sm text-blue-200/40"
                      >
                        {carregandoLista
                          ? "Carregando tabulações..."
                          : "Nenhuma tabulação encontrada com os filtros aplicados."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    tabulacoesParaRenderizar.map((item) => (
                      <TableRow key={item.id} className="border-blue-500/15 transition-colors hover:bg-blue-500/[0.07]">
                        <TableCell className="font-medium text-blue-100">
                          {item.tabulacao}
                        </TableCell>

                        <TableCell className="text-slate-400">
                          {item.descricao}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
