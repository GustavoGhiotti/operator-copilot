import { useEffect, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import {
  Activity,
  CheckCircle2,
  Clock3,
  Crown,
  RefreshCw,
  Search,
  ShieldAlert,
  Users,
  Wrench,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import axiosInstance from "@/utils/axiosInstance";

interface AnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface OperatorUsage {
  cpf: string | null;
  nome: string;
  supervisor: string;
  total_consultas: number;
  resolvidas: number;
  falhas: number;
  ultima_consulta: string | null;
}

interface SupervisorUsage {
  nome: string;
  total_consultas: number;
  operadores: number;
  resolvidas: number;
  ultima_consulta: string | null;
}

interface RecentQuery {
  status: string;
  contrato: string | number | null;
  data_pagamento: string | null;
  criada_em: string | null;
  cpf: string | null;
  operador: string;
  supervisor: string;
  possui_resultado: boolean;
}

interface ToolUsagePayload {
  ferramenta: string;
  periodo_dias: number;
  resumo: {
    total_consultas: number;
    operadores_ativos: number;
    supervisores_ativos: number;
    resolvidas: number;
    falhas: number;
    taxa_resolucao: number;
    primeira_consulta: string | null;
    ultima_consulta: string | null;
    operador_lider: OperatorUsage | null;
    supervisor_lider: SupervisorUsage | null;
  };
  operadores: OperatorUsage[];
  supervisores: SupervisorUsage[];
  status: Array<{ status: string; total: number }>;
  evolucao: Array<{
    data: string;
    total_consultas: number;
    operadores: number;
  }>;
  consultas_recentes: RecentQuery[];
}

const STATUS_FINALIZADOS = ["resolvido", "falha"];

const normalizeStatus = (status: string | null | undefined) =>
  (status || "").trim().toLowerCase();

const isStatusFinalizado = (status: string | null | undefined) =>
  STATUS_FINALIZADOS.includes(normalizeStatus(status));

const STATUS_COLORS: Record<string, string> = {
  resolvido: "#22c55e",
  falha: "#ef4444",
};

const formatNumber = (value: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR").format(value || 0);

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatShortDate = (value: string) => {
  const [, month, day] = value.slice(0, 10).split("-");
  return day && month ? `${day}/${month}` : value;
};

const statusClass = (status: string) => {
  const normalized = normalizeStatus(status);
  if (normalized === "resolvido") {
    return "border-emerald-400/25 bg-emerald-400/10 text-emerald-300";
  }
  if (normalized === "falha") {
    return "border-rose-400/25 bg-rose-400/10 text-rose-300";
  }
  return "border-amber-400/25 bg-amber-400/10 text-amber-300";
};

const MetricCard = ({
  label,
  value,
  detail,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Activity;
  accent: string;
}) => (
  <article className="relative overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900/75 p-4 shadow-xl">
    <div className={`absolute inset-x-0 top-0 h-px ${accent}`} />
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
          {label}
        </p>
        <p className="mt-2 truncate text-2xl font-black text-white">{value}</p>
        <p className="mt-1 truncate text-xs text-slate-400">{detail}</p>
      </div>
      <div className="rounded-xl border border-cyan-300/15 bg-cyan-300/5 p-2.5 text-cyan-300">
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </article>
);

const EmptyState = ({ text }: { text: string }) => (
  <div className="flex h-52 items-center justify-center text-sm text-slate-500">
    {text}
  </div>
);

const AnalyticsModal = ({ isOpen, onClose }: AnalyticsModalProps) => {
  const [period, setPeriod] = useState(0);
  const [data, setData] = useState<ToolUsagePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [operatorSearch, setOperatorSearch] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await axiosInstance.get<ToolUsagePayload>(
          "/api/analytics/ferramentas/consultar-contrato",
          { params: { periodo: period } },
        );
        if (active) setData(response.data);
      } catch (requestError) {
        if (!active) return;
        const message = isAxiosError(requestError)
          ? requestError.response?.data?.erro
          : null;
        setError(message || "Não foi possível carregar os resultados da ferramenta.");
        setData(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [isOpen, period]);

  const operators = useMemo(() => {
    const term = operatorSearch.trim().toLocaleLowerCase("pt-BR");
    if (!term) return data?.operadores || [];
    return (data?.operadores || []).filter((item) =>
      `${item.nome} ${item.supervisor} ${item.cpf || ""}`
        .toLocaleLowerCase("pt-BR")
        .includes(term),
    );
  }, [data?.operadores, operatorSearch]);

  const statusFinalizados = useMemo(
    () => (data?.status || []).filter((item) => isStatusFinalizado(item.status)),
    [data?.status],
  );

  const consultasRecentes = useMemo(
    () =>
      (data?.consultas_recentes || []).filter((item) =>
        isStatusFinalizado(item.status),
      ),
    [data?.consultas_recentes],
  );

  const topOperators = (data?.operadores || []).slice(0, 10).map((item) => ({
    ...item,
    nome_curto:
      item.nome.length > 22 ? `${item.nome.slice(0, 20)}…` : item.nome,
  }));

  const panel = "rounded-2xl border border-slate-700/70 bg-slate-900/65 shadow-xl";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="h-[92vh] w-[calc(100vw-1.5rem)] max-w-[1500px] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden border-cyan-400/25 bg-[#050d19] p-0 text-slate-100 shadow-[0_0_80px_rgba(14,165,233,.15)] sm:w-[calc(100vw-3rem)]">
        <DialogHeader className="border-b border-slate-800 bg-[#071321] px-6 py-5 pr-16 text-left">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-cyan-300">
                <Wrench className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-400">
                  Analytics de ferramentas
                </p>
                <DialogTitle className="mt-1 text-xl font-black text-white sm:text-2xl">
                  Uso do @ConsultarContrato
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs text-slate-400">
                  Volume, resolução e participação por operador e supervisor.
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="analytics-period" className="text-xs font-semibold text-slate-400">
                Período
              </label>
              <select
                id="analytics-period"
                value={period}
                onChange={(event) => setPeriod(Number(event.target.value))}
                className="h-10 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-200 outline-none focus:border-cyan-400"
              >
                <option value={0}>Todo o período</option>
                <option value={1}>Hoje</option>
                <option value={7}>7 dias</option>
                <option value={30}>30 dias</option>
                <option value={90}>90 dias</option>
                <option value={180}>180 dias</option>
                <option value={365}>365 dias</option>
              </select>
            </div>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto px-4 py-5 sm:px-6">
          {loading ? (
            <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-3 text-cyan-300">
              <RefreshCw className="h-8 w-8 animate-spin" />
              <p className="text-sm font-semibold">Consolidando as consultas…</p>
            </div>
          ) : error ? (
            <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-4 text-center">
              <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-rose-300">
                <ShieldAlert className="h-8 w-8" />
              </div>
              <div>
                <h3 className="font-bold text-white">Analytics indisponível</h3>
                <p className="mt-1 max-w-md text-sm text-slate-400">{error}</p>
              </div>
            </div>
          ) : data ? (
            <div className="space-y-5">
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <MetricCard label="Consultas" value={formatNumber(data.resumo.total_consultas)} detail={`Última: ${formatDateTime(data.resumo.ultima_consulta)}`} icon={Activity} accent="bg-cyan-400" />
                <MetricCard label="Operadores ativos" value={formatNumber(data.resumo.operadores_ativos)} detail={`${formatNumber(data.resumo.supervisores_ativos)} supervisores`} icon={Users} accent="bg-violet-400" />
                <MetricCard label="Taxa de resolução" value={`${data.resumo.taxa_resolucao.toLocaleString("pt-BR")}%`} detail={`${formatNumber(data.resumo.resolvidas)} resolvidas`} icon={CheckCircle2} accent="bg-emerald-400" />
                <MetricCard label="Operador líder" value={data.resumo.operador_lider?.nome || "Sem dados"} detail={`${formatNumber(data.resumo.operador_lider?.total_consultas)} consultas`} icon={Crown} accent="bg-amber-400" />
                <MetricCard label="Supervisor líder" value={data.resumo.supervisor_lider?.nome || "Sem dados"} detail={`${formatNumber(data.resumo.supervisor_lider?.total_consultas)} consultas`} icon={Crown} accent="bg-orange-400" />
              </section>

              <section className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,.8fr)]">
                <article className={`${panel} p-5`}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400">Adoção</p>
                  <h3 className="mt-1 font-bold text-white">Consultas por operador</h3>
                  {topOperators.length ? (
                    <div className="mt-5 h-[310px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topOperators} layout="vertical" margin={{ left: 12, right: 16 }}>
                          <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" stroke="#64748b" tickLine={false} axisLine={false} />
                          <YAxis dataKey="nome_curto" type="category" width={145} stroke="#94a3b8" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                          <Tooltip contentStyle={{ background: "#071321", border: "1px solid #334155", borderRadius: 12 }} cursor={{ fill: "rgba(56,189,248,.05)" }} />
                          <Bar dataKey="total_consultas" name="Consultas" fill="#38bdf8" radius={[0, 7, 7, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <EmptyState text="Nenhuma consulta no período." />}
                </article>

                <article className={`${panel} p-5`}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-400">Resultado técnico</p>
                  <h3 className="mt-1 font-bold text-white">Distribuição por status</h3>
                  {statusFinalizados.length ? (
                    <div className="mt-4 h-[310px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={statusFinalizados} dataKey="total" nameKey="status" innerRadius={62} outerRadius={94} paddingAngle={3}>
                            {statusFinalizados.map((item) => <Cell key={item.status} fill={STATUS_COLORS[normalizeStatus(item.status)]} />)}
                          </Pie>
                          <Tooltip contentStyle={{ background: "#5c5c5c", border: "1px solid #334155", borderRadius: 12 }} />
                          <Legend wrapperStyle={{ fontSize: 11, color: "#cbd5e1" }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <EmptyState text="Nenhum status no período." />}
                </article>
              </section>

              <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,1fr)]">
                <article className={`${panel} p-5`}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">Tendência</p>
                  <h3 className="mt-1 font-bold text-white">Evolução diária</h3>
                  {data.evolucao.length ? (
                    <div className="mt-5 h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data.evolucao} margin={{ left: -15, right: 10 }}>
                          <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                          <XAxis dataKey="data" tickFormatter={formatShortDate} stroke="#64748b" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                          <YAxis stroke="#64748b" tickLine={false} axisLine={false} allowDecimals={false} />
                          <Tooltip labelFormatter={(value) => `Data: ${formatShortDate(String(value))}`} contentStyle={{ background: "#071321", border: "1px solid #334155", borderRadius: 12 }} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Line type="monotone" dataKey="total_consultas" name="Consultas" stroke="#34d399" strokeWidth={3} dot={false} />
                          <Line type="monotone" dataKey="operadores" name="Operadores" stroke="#a78bfa" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <EmptyState text="Sem evolução para exibir." />}
                </article>

                <article className={`${panel} overflow-hidden`}>
                  <div className="border-b border-slate-800 px-5 py-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-400">Liderança</p>
                    <h3 className="mt-1 font-bold text-white">Ranking de supervisores</h3>
                  </div>
                  <div className="max-h-[310px] divide-y divide-slate-800 overflow-y-auto">
                    {data.supervisores.map((item, index) => (
                      <div key={item.nome} className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3.5">
                        <span className="text-sm font-black text-slate-600">{String(index + 1).padStart(2, "0")}</span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-100">{item.nome}</p>
                          <p className="mt-0.5 text-[10px] text-slate-500">{item.operadores} operadores · {item.resolvidas} resolvidas</p>
                        </div>
                        <span className="font-black text-orange-300">{formatNumber(item.total_consultas)}</span>
                      </div>
                    ))}
                    {!data.supervisores.length && <EmptyState text="Nenhum supervisor encontrado." />}
                  </div>
                </article>
              </section>

              <section className={`${panel} overflow-hidden`}>
                <div className="flex flex-col justify-between gap-3 border-b border-slate-800 px-5 py-4 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400">Detalhamento</p>
                    <h3 className="mt-1 font-bold text-white">Operadores</h3>
                  </div>
                  <div className="relative w-full sm:w-80">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input value={operatorSearch} onChange={(event) => setOperatorSearch(event.target.value)} placeholder="Buscar operador, CPF ou supervisor" className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-400" />
                  </div>
                </div>
                <div className="max-h-[360px] overflow-auto">
                  <table className="w-full min-w-[820px] text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-[#0a1726] text-[10px] uppercase tracking-[0.14em] text-slate-500">
                      <tr><th className="px-5 py-3">Operador</th><th className="px-4 py-3">Supervisor</th><th className="px-4 py-3 text-right">Consultas</th><th className="px-4 py-3 text-right">Resolvidas</th><th className="px-4 py-3 text-right">Falhas</th><th className="px-5 py-3">Última consulta</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {operators.map((item) => (
                        <tr key={`${item.cpf}-${item.nome}`} className="hover:bg-cyan-400/[.035]">
                          <td className="px-5 py-3.5"><p className="font-semibold text-slate-100">{item.nome}</p><p className="mt-0.5 text-[10px] text-slate-500">{item.cpf || "CPF não identificado"}</p></td>
                          <td className="px-4 py-3.5 text-slate-400">{item.supervisor}</td>
                          <td className="px-4 py-3.5 text-right font-black text-cyan-300">{formatNumber(item.total_consultas)}</td>
                          <td className="px-4 py-3.5 text-right text-emerald-300">{formatNumber(item.resolvidas)}</td>
                          <td className="px-4 py-3.5 text-right text-rose-300">{formatNumber(item.falhas)}</td>
                          <td className="px-5 py-3.5 text-xs text-slate-400">{formatDateTime(item.ultima_consulta)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!operators.length && <EmptyState text="Nenhum operador corresponde à busca." />}
                </div>
              </section>

              <section className={`${panel} overflow-hidden`}>
                <div className="border-b border-slate-800 px-5 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-400">Rastreabilidade</p>
                  <h3 className="mt-1 font-bold text-white">100 consultas mais recentes</h3>
                </div>
                <div className="max-h-[360px] overflow-auto">
                  <table className="w-full min-w-[950px] text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-[#0a1726] text-[10px] uppercase tracking-[0.14em] text-slate-500">
                      <tr><th className="px-5 py-3">Data</th><th className="px-4 py-3">Operador</th><th className="px-4 py-3">Supervisor</th><th className="px-4 py-3">Contrato</th><th className="px-4 py-3">Pagamento</th><th className="px-5 py-3">Status</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {consultasRecentes.map((item, index) => (
                        <tr key={`${item.criada_em}-${item.contrato}-${index}`} className="hover:bg-violet-400/[.035]">
                          <td className="px-5 py-3.5 text-xs text-slate-400">{formatDateTime(item.criada_em)}</td>
                          <td className="px-4 py-3.5 font-semibold text-slate-100">{item.operador}</td>
                          <td className="px-4 py-3.5 text-slate-400">{item.supervisor}</td>
                          <td className="px-4 py-3.5 font-mono text-xs text-cyan-300">{String(item.contrato || "—")}</td>
                          <td className="px-4 py-3.5 text-xs text-slate-400">{formatDateTime(item.data_pagamento)}</td>
                          <td className="px-5 py-3.5"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${statusClass(item.status || "")}`}>{item.status || "sem status"}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!consultasRecentes.length && <EmptyState text="Nenhuma consulta recente." />}
                </div>
              </section>

              <p className="flex items-center gap-2 px-1 text-[10px] text-slate-600">
                <Clock3 className="h-3.5 w-3.5" />
                Dados obtidos de TB_CONSULTA_CRMWEB, considerando apenas consultas finalizadas (resolvido e falha). O conteúdo bruto de RESULTADO_BUSCA não é exposto nesta visão.
              </p>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AnalyticsModal;
