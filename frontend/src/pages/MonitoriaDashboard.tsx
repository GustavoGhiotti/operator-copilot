/**
 * Página principal do módulo Monitoria WhatsApp.
 *
 * Para integrar ao React Router, adicione no seu arquivo de rotas:
 *   import MonitoriaDashboard from "@/pages/MonitoriaDashboard";
 *   <Route path="/monitoria-whatsapp" element={<MonitoriaDashboard />} />
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Home, RefreshCw, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "@/utils/axiosInstance";
import { useMonitoriaSSE } from "@/hooks/useMonitoriaSSE";
import { DashboardMetricasCards } from "@/components/monitoria/DashboardMetricasCards";
import { ConversaCard } from "@/components/monitoria/ConversaCard";
import type { DashboardMetricas, Conversa } from "@/types/monitoria";

type FiltroStatus = "TODAS" | "ABERTA" | "EM_ATENDIMENTO" | "ENCERRADA";

const filtros: { value: FiltroStatus; label: string }[] = [
  { value: "TODAS", label: "Todas" },
  { value: "ABERTA", label: "Abertas" },
  { value: "EM_ATENDIMENTO", label: "Em Atendimento" },
  { value: "ENCERRADA", label: "Encerradas" },
];

function normalizarBusca(valor?: string) {
  return (valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatarQuantidadeConversa(valor: number) {
  return `${valor} ${valor === 1 ? "conversa" : "conversas"} em tela`;
}

export default function MonitoriaDashboard() {
  const navigate = useNavigate();
  const [metricas, setMetricas] = useState<DashboardMetricas | null>(null);
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [filtro, setFiltro] = useState<FiltroStatus>("TODAS");
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [acessoNegado, setAcessoNegado] = useState(false);
  const [sseHabilitado, setSseHabilitado] = useState(false);
  const reloadTimeout = useRef<ReturnType<typeof setTimeout>>();

  const normalizarMetricas = useCallback((data: any): DashboardMetricas => {
    const operadoresAtivos = Array.isArray(data?.OPERADORES)
      ? data.OPERADORES.length
      : Number(data?.operadoresAtivos ?? 0);

    return {
      totalAbertas: Number(data?.TOTAL_ABERTAS ?? data?.totalAbertas ?? 0),
      emAtendimento: Number(data?.TOTAL_EM_ATENDIMENTO ?? data?.emAtendimento ?? 0),
      foraSLA: Number(data?.TOTAL_FORA_SLA ?? data?.foraSLA ?? 0),
      operadoresAtivos
    };
  }, []);

  const fetchDashboard = useCallback(async () => {
    try {
      const cpfUsuario = localStorage.getItem("userCpf");

      const { data } = await axiosInstance.get("/api/monitoria-whatsapp/dashboard", {
        params: {
          cpf_usuario: cpfUsuario
        }
      });
      setMetricas(normalizarMetricas(data));
      setSseHabilitado(true);
    } catch (err: any) {
      if (err?.response?.status === 403) {
        setAcessoNegado(true);
        setSseHabilitado(false);
        setMetricas(null);
        return;
      }
      console.error("Erro ao carregar dashboard:", err);
    }
  }, [normalizarMetricas]);

  const fetchConversas = useCallback(async () => {
    try {
      const cpfUsuario = localStorage.getItem("userCpf");
      const centroCusto = localStorage.getItem("centroCusto");

      const params: any = {
        cpf_usuario: cpfUsuario,
        centro_custo: centroCusto
      };

      if (filtro !== "TODAS") {
        params.status = filtro;
      }

      const { data } = await axiosInstance.get(
        "/api/monitoria-whatsapp/conversas",
        { params }
      );
      setConversas(data);
      setAcessoNegado(false);
      setSseHabilitado(true);
    } catch (err: any) {
      if (err?.response?.status === 403) {
        setAcessoNegado(true);
        setSseHabilitado(false);
        setConversas([]);
        return;
      }
      console.error("Erro ao carregar conversas:", err);
    } finally {
      setLoading(false);
    }
  }, [filtro]);

  useEffect(() => {
    fetchDashboard();
    fetchConversas();
  }, [fetchDashboard, fetchConversas]);

  // SSE realtime
  useMonitoriaSSE({
    enabled: sseHabilitado && !acessoNegado,
    onDashboardUpdate: (data) => {
      setMetricas(normalizarMetricas(data));
    },
    onConversaUpdate: () => {
      fetchConversas();
    },
    onMensagemUpdate: () => {

      clearTimeout(reloadTimeout.current);

      reloadTimeout.current = setTimeout(() => {
        fetchConversas();
      }, 800);

    }
  });

  // Ordenar: foraSLA primeiro, depois por data
  const ordemStatus: Record<string, number> = {
  ABERTA: 1,
  EM_ATENDIMENTO: 2,
  ENCERRADA: 3
};

const contadores = useMemo(() => {
  return conversas.reduce(
    (acc, conversa) => {
      acc.TODAS += 1;
      acc[conversa.status as Exclude<FiltroStatus, "TODAS">] += 1;
      return acc;
    },
    {
      TODAS: 0,
      ABERTA: 0,
      EM_ATENDIMENTO: 0,
      ENCERRADA: 0,
    } as Record<FiltroStatus, number>
  );
}, [conversas]);

const conversasOrdenadas = useMemo(() => {
  const termoBusca = normalizarBusca(busca);
  const statusLabel: Record<FiltroStatus, string> = {
    TODAS: "todas",
    ABERTA: "aberta",
    EM_ATENDIMENTO: "em atendimento",
    ENCERRADA: "encerrada",
  };

  return [...conversas]
    .filter((c) => {
      if (filtro === "TODAS") return true;
      return c.status === filtro;
    })
    .filter((c) => {
      if (!termoBusca) return true;

      const camposBusca = [
        c.clienteNome,
        c.clienteTelefone,
        c.operadorNome,
        c.ultimaMensagem,
        c.numeroEmpresa,
        c.status,
        statusLabel[c.status],
        c.direcaoUltimaMensagem === "ENVIADA" ? "operador" : "cliente",
      ]
        .map((valor) => normalizarBusca(valor))
        .filter(Boolean);

      return camposBusca.some((valor) => valor.includes(termoBusca));
    })
    .sort((a, b) => {

      if (a.foraSLA && !b.foraSLA) return -1;
      if (!a.foraSLA && b.foraSLA) return 1;

      const statusDiff = ordemStatus[a.status] - ordemStatus[b.status];
      if (statusDiff !== 0) return statusDiff;

      return new Date(b.atualizadoEm).getTime() - new Date(a.atualizadoEm).getTime();

    });

}, [conversas, busca, filtro]);

  if (acessoNegado) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Acesso nao permitido
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Sua carteira nao esta habilitada para utilizar a monitoria WhatsApp.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.14),transparent_24%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.12),transparent_22%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(2,6,23,1))]">
      <div className="mx-auto max-w-[1280px] px-3 py-4 sm:px-4 lg:px-5">
        <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-card/65 p-4 shadow-[0_20px_64px_rgba(2,6,23,0.4)] backdrop-blur-xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.10),transparent_24%)]" />
          <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="relative">
        {/* Header */}
        <div className="mb-5 flex flex-col gap-3.5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">
                Operacao em tempo real
              </span>
              <button
                onClick={() => navigate("/home")}
                aria-label="Voltar para a pagina inicial"
                title="Ir para o inicio"
                className="inline-flex h-9 w-9 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.04] text-muted-foreground transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-white/[0.08] hover:text-foreground"
              >
                <Home className="h-4 w-4" />
              </button>
            </div>
            <h1 className="mt-2.5 text-[1.8rem] font-black tracking-tight text-foreground sm:text-[2.2rem]">
              Monitoria WhatsApp
            </h1>
            <p className="mt-2 max-w-xl text-[13px] leading-6 text-muted-foreground">
              Visualize a carteira, priorize riscos de SLA e acompanhe a distribuicao dos atendimentos com uma interface mais clara e operacional.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="rounded-[18px] border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.03] px-3.5 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Visao atual
              </p>
              <p className="mt-1 text-[13px] font-semibold text-foreground">
                {formatarQuantidadeConversa(conversasOrdenadas.length)}
              </p>
            </div>
            <button
              onClick={() => {
                fetchDashboard();
                fetchConversas();
              }}
              className="inline-flex items-center justify-center gap-2 rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-2 text-[13px] font-semibold text-foreground shadow-lg transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-white/[0.08]"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar painel
            </button>
          </div>
        </div>

        {/* Métricas */}
        <DashboardMetricasCards
          metricas={metricas}
          loading={loading}
          totalConversas={contadores.TODAS}
        />

        {/* Filtros e Busca */}
        <div className="mb-4 mt-5 flex flex-col gap-3 rounded-[18px] border border-white/10 bg-slate-950/30 p-2.5 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <div className="mr-2 flex items-center text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Filtros
            </div>
            <div className="flex gap-1 rounded-[16px] border border-white/10 bg-white/[0.04] p-1">
            {filtros.map((f) => (
              <button
                key={f.value}
                onClick={() => setFiltro(f.value)}
                className={`rounded-xl px-3 py-1.5 text-[11px] font-semibold transition-all ${
                  filtro === f.value
                    ? "bg-primary text-primary-foreground shadow-[0_10px_24px_rgba(249,115,22,0.25)]"
                    : "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"
                }`}
              >
                {f.label} ({contadores[f.value]})
              </button>
            ))}
            </div>
          </div>
          <div className="relative sm:w-[286px]">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar conversa, operador ou telefone"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-10 w-full rounded-[16px] border border-white/10 bg-white/[0.04] pl-11 pr-4 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>

        {/* Tabela */}
        <div className="overflow-hidden rounded-[22px] border border-white/10 bg-slate-950/35 shadow-inner">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03]">
                  <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    Cliente
                  </th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    Status
                  </th>
                  <th className="hidden px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground md:table-cell">
                    Operador
                  </th>
                  <th className="hidden px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground lg:table-cell">
                    Última Mensagem
                  </th>
                  <th className="px-4 py-3.5 text-right text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    Tempo
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-16 text-center text-sm text-muted-foreground">
                      Carregando conversas...
                    </td>
                  </tr>
                ) : conversasOrdenadas.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-16 text-center text-sm text-muted-foreground">
                      {busca.trim()
                        ? "Nenhuma conversa encontrada para a busca informada."
                        : filtro === "TODAS"
                          ? "Nenhuma conversa encontrada."
                          : `Nenhuma conversa em ${filtros.find((item) => item.value === filtro)?.label.toLowerCase()}.`}
                    </td>
                  </tr>
                ) : (
                  conversasOrdenadas.map((c) => <ConversaCard key={c.id} conversa={c} />)
                )}
              </tbody>
            </table>
          </div>
        </div>
          </div>
        </div>
      </div>
    </div>
  );
}

