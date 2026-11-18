import React, { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import axiosInstance from "@/utils/axiosInstance";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  BrainCircuit,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  History,
  Loader2,
  MessageSquareText,
  Users,
  XCircle,
} from "lucide-react";

type AnalyticsPeriod = "diario" | "semanal" | "mensal";
type Variant = "compact" | "full";

interface TopicPoint {
  topico: string;
  total: number;
  percentual: number;
}

interface TimelinePoint {
  key: string;
  label: string;
  total: number;
}

interface OperatorPoint {
  operador: string;
  total_perguntas: number;
  topico_principal: string;
  ultima_pergunta_em?: string | null;
}

interface CentroCustoPoint {
  centro_custo: string;
  total_perguntas: number;
  percentual: number;
}

interface FeedbackSummary {
  total_respostas: number;
  total_feedbacks: number;
  uteis: number;
  nao_uteis: number;
  sem_feedback: number;
  taxa_utilidade: number;
  taxa_feedback: number;
}

interface FeedbackDistributionPoint {
  status: string;
  total: number;
  percentual: number;
}

interface FeedbackTimelinePoint {
  key: string;
  label: string;
  uteis: number;
  nao_uteis: number;
  sem_feedback: number;
  total_respostas: number;
}

interface RecentQuestion {
  operador: string;
  carteira: string;
  conversa_id?: string | null;
  topico: string;
  pergunta: string;
  justificativa?: string | null;
  data_pergunta?: string | null;
}

interface ConversationMessage {
  operador?: string | null;
  mensagem: string;
  is_user: boolean;
  data_mensagem?: string | null;
}

interface ConversationPayload {
  conversa_id: string;
  operador: string;
  data_inicio?: string | null;
  data_fim?: string | null;
  mensagens: ConversationMessage[];
}

interface OperatorDetailPayload {
  operador: string;
  total_perguntas: number;
  topico_principal: string;
  topicos: Array<{
    topico: string;
    total: number;
  }>;
  perguntas: RecentQuestion[];
}

interface InsightsPayload {
  summary: {
    total_perguntas: number;
    operadores_unicos: number;
    topico_lider: string;
    topico_lider_total: number;
    centro_custo_lider?: string;
    centro_custo_lider_total?: number;
    taxa_utilidade_respostas?: number;
    total_feedbacks_respostas?: number;
  };
  comparativo: {
    metric_label: string;
    current_value: number;
    previous_value: number;
    delta_value: number;
    delta_percent: number;
    trend: "melhorou" | "piorou" | "estavel";
    current_label: string;
    previous_label: string;
  };
  topic_distribution: TopicPoint[];
  timeline: TimelinePoint[];
  operators: OperatorPoint[];
  operators_top?: OperatorPoint[];
  operators_all?: OperatorPoint[];
  recent_questions: RecentQuestion[];
  available_centros_custo: string[];
  centro_custo_distribution?: CentroCustoPoint[];
  feedback_summary?: FeedbackSummary;
  feedback_distribution?: FeedbackDistributionPoint[];
  feedback_timeline?: FeedbackTimelinePoint[];
}

interface Props {
  variant?: Variant;
  centroCusto?: string | null;
  className?: string;
}

const COLORS = ["#f97316", "#fb923c", "#fdba74", "#f59e0b", "#f43f5e", "#0ea5e9"];

export default function AuroraQuestionInsightsPanel({
  variant = "compact",
  centroCusto,
  className,
}: Props) {
  const [data, setData] = useState<InsightsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<AnalyticsPeriod>("diario");
  const [topico, setTopico] = useState("Todos");
  const [centroCustoFiltro, setCentroCustoFiltro] = useState("Todos");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [operatorsSheetOpen, setOperatorsSheetOpen] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<RecentQuestion | null>(null);
  const [conversationOpen, setConversationOpen] = useState(false);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [conversationError, setConversationError] = useState<string | null>(null);
  const [conversationData, setConversationData] = useState<ConversationPayload | null>(null);
  const [operatorDetailOpen, setOperatorDetailOpen] = useState(false);
  const [operatorDetailLoading, setOperatorDetailLoading] = useState(false);
  const [operatorDetailError, setOperatorDetailError] = useState<string | null>(null);
  const [operatorDetailData, setOperatorDetailData] = useState<OperatorDetailPayload | null>(null);

  const effectiveCentroCusto = centroCusto || localStorage.getItem("centroCusto") || "";
  const isFull = variant === "full";

  const topicOptions = useMemo(() => {
    const base = ["Todos"];
    const dynamic = (data?.topic_distribution || []).map((item) => item.topico);
    return [...base, ...dynamic];
  }, [data]);

  const centroCustoOptions = useMemo(() => {
    const base = ["Todos"];
    return [...base, ...(data?.available_centros_custo || [])];
  }, [data]);

  const operatorsTop = data?.operators_top || data?.operators || [];
  const operatorsAll = data?.operators_all || data?.operators || [];
  const chartTickColor = isDarkMode ? "#cbd5e1" : "#475569";
  const chartGridColor = isDarkMode ? "#334155" : "#e2e8f0";
  const tooltipStyle = {
    backgroundColor: isDarkMode ? "#0f172a" : "#ffffff",
    border: `1px solid ${isDarkMode ? "#334155" : "#e2e8f0"}`,
    borderRadius: 16,
    color: isDarkMode ? "#f8fafc" : "#0f172a",
  };

  useEffect(() => {
    const fetchInsights = async () => {
      setLoading(true);
      setError(null);
      try {
        const params: Record<string, string> = { periodo };
        if (!isFull) {
          params.centro_custo = effectiveCentroCusto;
        } else if (centroCustoFiltro !== "Todos") {
          params.centro_custo = centroCustoFiltro;
        }
        if (topico !== "Todos") {
          params.topico = topico;
        }

        const response = await axiosInstance.get<InsightsPayload>(
          "/api/qualidade/analytics/ia-perguntas",
          { params },
        );
        setData(response.data);
      } catch (err) {
        console.error("Erro ao carregar insights da Aurora:", err);
        setError("Não foi possível carregar os insights das perguntas.");
      } finally {
        setLoading(false);
      }
    };

    fetchInsights();
  }, [periodo, topico, centroCustoFiltro, effectiveCentroCusto, isFull]);

  useEffect(() => {
    const updateDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    };

    updateDarkMode();

    const observer = new MutationObserver(updateDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  const comparisonTone =
    data?.comparativo.trend === "melhorou"
      ? "text-emerald-600"
      : data?.comparativo.trend === "piorou"
        ? "text-rose-600"
        : "text-slate-600 dark:text-slate-300";

  const formatDate = (value?: string | null) =>
    value ? new Date(value).toLocaleDateString("pt-BR") : "Sem data";

  const formatDateTime = (value?: string | null) =>
    value
      ? new Date(value).toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "Sem data";

  const handleOpenConversation = async (question: RecentQuestion) => {
    if (!question.conversa_id) {
      setSelectedQuestion(question);
      setConversationData(null);
      setConversationError("Essa pergunta não possui ID de conversa salvo, então o histórico completo não está disponível.");
      setConversationOpen(true);
      return;
    }

    setSelectedQuestion(question);
    setConversationOpen(true);
    setConversationLoading(true);
    setConversationError(null);
    setConversationData(null);

    try {
      const response = await axiosInstance.get<ConversationPayload>(
        `/api/qualidade/analytics/ia-perguntas/conversa/${encodeURIComponent(question.conversa_id)}`,
      );
      setConversationData(response.data);
    } catch (err) {
      console.error("Erro ao carregar conversa da Aurora:", err);
      setConversationError("Não foi possível carregar o histórico dessa conversa.");
    } finally {
      setConversationLoading(false);
    }
  };

  const handleOpenOperator = async (operatorName: string) => {
    setOperatorDetailOpen(true);
    setOperatorDetailLoading(true);
    setOperatorDetailError(null);
    setOperatorDetailData(null);

    try {
      const response = await axiosInstance.get<OperatorDetailPayload>(
        "/api/qualidade/analytics/ia-perguntas/operador",
        {
          params: {
            operador: operatorName,
          },
        },
      );
      setOperatorDetailData(response.data);
    } catch (err) {
      console.error("Erro ao carregar histórico do operador:", err);
      setOperatorDetailError("Não foi possível carregar o histórico completo desse operador.");
    } finally {
      setOperatorDetailLoading(false);
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      <div className="rounded-[28px] bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.18),_transparent_34%),linear-gradient(135deg,_#111827,_#1f2937)] p-6 text-white">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-semibold">
              <BrainCircuit className="h-6 w-6 text-orange-300" />
              Insights das perguntas da Aurora
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-200 dark:text-slate-300">
              Entenda os temas que mais geram dúvidas, quem mais pergunta e como o volume está evoluindo.
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm">
            <div className="text-slate-300 dark:text-slate-400">Comparativo atual</div>
            <div className={cn("mt-1 text-lg font-semibold", comparisonTone)}>
              {data ? `${data.comparativo.delta_percent}%` : "--"}
            </div>
          </div>
        </div>
      </div>

      {isFull && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Centro de custo das perguntas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {centroCustoOptions.map((item) => (
                <Button
                  key={item}
                  type="button"
                  variant={centroCustoFiltro === item ? "default" : "outline"}
                  className={centroCustoFiltro === item ? "bg-orange-500 hover:bg-orange-600" : ""}
                  onClick={() => setCentroCustoFiltro(item)}
                >
                  {item}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {(["diario", "semanal", "mensal"] as AnalyticsPeriod[]).map((item) => (
            <Button
              key={item}
              type="button"
              variant={periodo === item ? "default" : "outline"}
              className={periodo === item ? "bg-orange-500 hover:bg-orange-600" : ""}
              onClick={() => setPeriodo(item)}
            >
              {item === "diario" ? "Diário" : item === "semanal" ? "Semanal" : "Mensal"}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {topicOptions.map((item) => (
            <Button
              key={item}
              type="button"
              size="sm"
              variant={topico === item ? "default" : "outline"}
              className={topico === item ? "bg-slate-900 hover:bg-slate-800" : ""}
              onClick={() => setTopico(item)}
            >
              {item}
            </Button>
          ))}
        </div>
      </div>

      {error ? (
        <Card>
          <CardContent className="py-8 text-sm text-rose-600 dark:text-rose-400">{error}</CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={MessageSquareText} label="Perguntas" value={loading ? "..." : data?.summary.total_perguntas ?? 0} />
            <MetricCard icon={Users} label="Operadores" value={loading ? "..." : data?.summary.operadores_unicos ?? 0} />
            <MetricCard icon={BrainCircuit} label="Tópico líder" value={loading ? "..." : data?.summary.topico_lider ?? "Sem dados"} />
            <MetricCard icon={CalendarDays} label="Ocorrências líder" value={loading ? "..." : data?.summary.topico_lider_total ?? 0} />
            <MetricCard icon={Building2} label="Centro líder" value={loading ? "..." : data?.summary.centro_custo_lider ?? "Sem dados"} />
            <MetricCard icon={MessageSquareText} label="Perguntas no centro" value={loading ? "..." : data?.summary.centro_custo_lider_total ?? 0} />
            <MetricCard icon={CheckCircle2} label="Taxa de utilidade" value={loading ? "..." : `${data?.summary.taxa_utilidade_respostas ?? 0}%`} />
            <MetricCard icon={XCircle} label="Feedbacks recebidos" value={loading ? "..." : data?.summary.total_feedbacks_respostas ?? 0} />
          </div>

          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                <span className="font-semibold">Comparativo:</span>{" "}
                <span className={comparisonTone}>
                  {loading ? "..." : `${data?.comparativo.current_value ?? 0} perguntas no período atual`}
                </span>{" "}
                contra {loading ? "..." : data?.comparativo.previous_value ?? 0} no período anterior.
              </p>
            </CardContent>
          </Card>

          <div className={cn("grid gap-6", isFull ? "xl:grid-cols-2" : "xl:grid-cols-[1.1fr_0.9fr]")}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BrainCircuit className="h-4 w-4" />
                  Distribuição por tópico
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[320px]">
                  {loading ? (
                    <EmptyState text="Carregando distribuição..." />
                  ) : !data?.topic_distribution.length ? (
                    <EmptyState text="Sem perguntas para esse filtro." />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.topic_distribution}>
                        <CartesianGrid stroke={chartGridColor} strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="topico"
                          angle={-20}
                          textAnchor="end"
                          height={70}
                          interval={0}
                          tick={{ fill: chartTickColor, fontSize: 12 }}
                          axisLine={{ stroke: chartGridColor }}
                          tickLine={{ stroke: chartGridColor }}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fill: chartTickColor, fontSize: 12 }}
                          axisLine={{ stroke: chartGridColor }}
                          tickLine={{ stroke: chartGridColor }}
                        />
                        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: isDarkMode ? "#1e293b" : "#f8fafc" }} />
                        <Bar dataKey="total" radius={[10, 10, 0, 0]}>
                          {data.topic_distribution.map((entry, index) => (
                            <Cell key={entry.topico} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-4 w-4" />
                  Evolução do volume
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[320px]">
                  {loading ? (
                    <EmptyState text="Carregando evolução..." />
                  ) : !data?.timeline.length ? (
                    <EmptyState text="Sem histórico suficiente." />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.timeline}>
                        <CartesianGrid stroke={chartGridColor} strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="label"
                          interval={0}
                          angle={-15}
                          textAnchor="end"
                          height={60}
                          tick={{ fill: chartTickColor, fontSize: 12 }}
                          axisLine={{ stroke: chartGridColor }}
                          tickLine={{ stroke: chartGridColor }}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fill: chartTickColor, fontSize: 12 }}
                          axisLine={{ stroke: chartGridColor }}
                          tickLine={{ stroke: chartGridColor }}
                        />
                        <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: chartGridColor }} />
                        <Line type="monotone" dataKey="total" stroke="#f97316" strokeWidth={3} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className={cn("grid gap-6", isFull ? "xl:grid-cols-2" : "xl:grid-cols-[1fr_1fr]")}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="h-4 w-4" />
                  Centros de custo mais acionados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[320px]">
                  {loading ? (
                    <EmptyState text="Carregando centros de custo..." />
                  ) : !data?.centro_custo_distribution?.length ? (
                    <EmptyState text="Sem centro de custo salvo nesse período." />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.centro_custo_distribution.slice(0, 8)}>
                        <CartesianGrid stroke={chartGridColor} strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="centro_custo"
                          angle={-20}
                          textAnchor="end"
                          height={80}
                          interval={0}
                          tick={{ fill: chartTickColor, fontSize: 12 }}
                          axisLine={{ stroke: chartGridColor }}
                          tickLine={{ stroke: chartGridColor }}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fill: chartTickColor, fontSize: 12 }}
                          axisLine={{ stroke: chartGridColor }}
                          tickLine={{ stroke: chartGridColor }}
                        />
                        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: isDarkMode ? "#1e293b" : "#f8fafc" }} />
                        <Bar dataKey="total_perguntas" name="Perguntas" radius={[10, 10, 0, 0]}>
                          {(data.centro_custo_distribution || []).slice(0, 8).map((entry, index) => (
                            <Cell key={entry.centro_custo} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle2 className="h-4 w-4" />
                  Utilidade das respostas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                    <div className="text-xs text-emerald-700 dark:text-emerald-300">Úteis</div>
                    <div className="mt-1 text-xl font-bold text-emerald-800 dark:text-emerald-200">
                      {data?.feedback_summary?.uteis ?? 0}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-900 dark:bg-rose-950/30">
                    <div className="text-xs text-rose-700 dark:text-rose-300">Não úteis</div>
                    <div className="mt-1 text-xl font-bold text-rose-800 dark:text-rose-200">
                      {data?.feedback_summary?.nao_uteis ?? 0}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                    <div className="text-xs text-slate-600 dark:text-slate-300">Sem feedback</div>
                    <div className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">
                      {data?.feedback_summary?.sem_feedback ?? 0}
                    </div>
                  </div>
                </div>
                <div className="h-[250px]">
                  {loading ? (
                    <EmptyState text="Carregando feedbacks..." />
                  ) : !data?.feedback_distribution?.length ? (
                    <EmptyState text="Sem respostas para avaliar nesse período." />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.feedback_distribution}>
                        <CartesianGrid stroke={chartGridColor} strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="status"
                          tick={{ fill: chartTickColor, fontSize: 12 }}
                          axisLine={{ stroke: chartGridColor }}
                          tickLine={{ stroke: chartGridColor }}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fill: chartTickColor, fontSize: 12 }}
                          axisLine={{ stroke: chartGridColor }}
                          tickLine={{ stroke: chartGridColor }}
                        />
                        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: isDarkMode ? "#1e293b" : "#f8fafc" }} />
                        <Bar dataKey="total" radius={[10, 10, 0, 0]}>
                          {(data.feedback_distribution || []).map((entry, index) => (
                            <Cell
                              key={entry.status}
                              fill={index === 0 ? "#10b981" : index === 1 ? "#f43f5e" : "#94a3b8"}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4" />
                Evolução dos feedbacks das respostas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {loading ? (
                  <EmptyState text="Carregando evolução dos feedbacks..." />
                ) : !data?.feedback_timeline?.length ? (
                  <EmptyState text="Sem histórico de feedback suficiente." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.feedback_timeline}>
                      <CartesianGrid stroke={chartGridColor} strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="label"
                        interval={0}
                        angle={-15}
                        textAnchor="end"
                        height={60}
                        tick={{ fill: chartTickColor, fontSize: 12 }}
                        axisLine={{ stroke: chartGridColor }}
                        tickLine={{ stroke: chartGridColor }}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fill: chartTickColor, fontSize: 12 }}
                        axisLine={{ stroke: chartGridColor }}
                        tickLine={{ stroke: chartGridColor }}
                      />
                      <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: chartGridColor }} />
                      <Line type="monotone" dataKey="uteis" name="Úteis" stroke="#10b981" strokeWidth={3} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="nao_uteis" name="Não úteis" stroke="#f43f5e" strokeWidth={3} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="sem_feedback" name="Sem feedback" stroke="#94a3b8" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          <div className={cn("grid gap-6", isFull ? "xl:grid-cols-[0.9fr_1.1fr]" : "xl:grid-cols-2")}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base">Top 10 operadores com mais dúvidas</CardTitle>
                  {!!operatorsAll.length && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setOperatorsSheetOpen(true)}>
                      Ver todos
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {loading ? (
                    <EmptyState text="Carregando operadores..." />
                  ) : !data?.operators.length ? (
                    <EmptyState text="Nenhum operador encontrado." />
                  ) : (
                    operatorsTop.map((item, index) => (
                      <div
                        key={`${item.operador}-${index}`}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <button
                              type="button"
                              onClick={() => void handleOpenOperator(item.operador)}
                              className="font-semibold text-slate-900 underline-offset-4 transition hover:text-orange-600 hover:underline dark:text-slate-100 dark:hover:text-orange-300"
                            >
                              {item.operador}
                            </button>
                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              Tópico principal: {item.topico_principal}
                            </div>
                            <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                              Última pergunta: {formatDate(item.ultima_pergunta_em)}
                            </div>
                          </div>
                          <Badge variant="outline">{item.total_perguntas} pergunta(s)</Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Perguntas recentes</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[360px] pr-3">
                  <div className="space-y-3">
                    {loading ? (
                      <EmptyState text="Carregando perguntas..." />
                    ) : !data?.recent_questions.length ? (
                      <EmptyState text="Nenhuma pergunta encontrada para esse filtro." />
                  ) : (
                    data.recent_questions.map((item, index) => (
                        <button
                          key={`${item.operador}-${index}`}
                          type="button"
                          onClick={() => void handleOpenConversation(item)}
                          className="w-full rounded-2xl border border-gray-200 p-4 text-left transition hover:border-orange-300 hover:bg-orange-50/50 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:border-orange-500/40 dark:hover:bg-slate-900"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                            <Badge>{item.topico}</Badge>
                            <span className="text-xs text-slate-500 dark:text-slate-400">{item.operador}</span>
                            <span className="text-xs text-slate-400 dark:text-slate-500">{formatDate(item.data_pergunta)}</span>
                              {item.conversa_id ? (
                                <span className="text-xs text-orange-600 dark:text-orange-300">Ver conversa</span>
                              ) : (
                                <span className="text-xs text-slate-400 dark:text-slate-500">Sem histórico completo</span>
                              )}
                            </div>
                            <ChevronRight className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                          </div>
                          <p className="mt-3 text-sm text-slate-800 dark:text-slate-100">{item.pergunta}</p>
                          {item.justificativa && (
                            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{item.justificativa}</p>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <Sheet open={operatorsSheetOpen} onOpenChange={setOperatorsSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Todos os operadores com dúvidas</SheetTitle>
            <SheetDescription>
              Lista completa de operadores que fizeram perguntas para a Aurora no filtro atual.
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="mt-6 h-[calc(100vh-140px)] pr-4">
            <div className="space-y-3">
              {operatorsAll.map((item, index) => (
                <div
                  key={`${item.operador}-${index}-all`}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <button
                        type="button"
                        onClick={() => void handleOpenOperator(item.operador)}
                        className="font-semibold text-slate-900 underline-offset-4 transition hover:text-orange-600 hover:underline dark:text-slate-100 dark:hover:text-orange-300"
                      >
                        {item.operador}
                      </button>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Tópico principal: {item.topico_principal}
                      </div>
                      <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                        Última pergunta: {formatDate(item.ultima_pergunta_em)}
                      </div>
                    </div>
                    <Badge variant="outline">{item.total_perguntas} pergunta(s)</Badge>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <Dialog open={conversationOpen} onOpenChange={setConversationOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-orange-500" />
              Histórico da conversa
            </DialogTitle>
            <DialogDescription>
              {selectedQuestion
                ? `${selectedQuestion.operador} • ${selectedQuestion.topico} • ${formatDateTime(selectedQuestion.data_pergunta)}`
                : "Mensagens trocadas entre o operador e a Aurora."}
            </DialogDescription>
          </DialogHeader>

          {conversationLoading ? (
            <div className="flex min-h-[320px] items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando conversa...
            </div>
          ) : conversationError ? (
            <div className="min-h-[320px] rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
              {conversationError}
            </div>
          ) : (
            <ScrollArea className="h-[60vh] pr-4">
              <div className="space-y-4">
                {conversationData?.mensagens.map((message, index) => (
                  <div
                    key={`${message.data_mensagem}-${index}`}
                    className={cn("flex", message.is_user ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[82%] rounded-2xl px-4 py-3 shadow-sm",
                        message.is_user
                          ? "bg-orange-500 text-white"
                          : "border border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100",
                      )}
                    >
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">{message.mensagem}</div>
                      <div
                        className={cn(
                          "mt-2 text-[11px]",
                          message.is_user ? "text-orange-100" : "text-slate-500 dark:text-slate-400",
                        )}
                      >
                        {message.is_user ? "Operador" : "Aurora"} • {formatDateTime(message.data_mensagem)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={operatorDetailOpen} onOpenChange={setOperatorDetailOpen}>
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>Histórico de perguntas do operador</DialogTitle>
            <DialogDescription>
              {operatorDetailData
                ? `${operatorDetailData.operador} • ${operatorDetailData.total_perguntas} pergunta(s) no Copilot`
                : "Veja tudo o que esse operador já perguntou para a Aurora."}
            </DialogDescription>
          </DialogHeader>

          {operatorDetailLoading ? (
            <div className="flex min-h-[320px] items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando histórico do operador...
            </div>
          ) : operatorDetailError ? (
            <div className="min-h-[320px] rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
              {operatorDetailError}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                      Total de perguntas
                    </div>
                    <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                      {operatorDetailData?.total_perguntas ?? 0}
                    </div>
                  </CardContent>
                </Card>
                <Card className="md:col-span-2">
                  <CardContent className="pt-6">
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                      Principais tópicos
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {operatorDetailData?.topicos.map((item) => (
                        <Badge key={`${item.topico}-${item.total}`} variant="outline">
                          {item.topico}: {item.total}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <ScrollArea className="h-[55vh] pr-4">
                <div className="space-y-3">
                  {operatorDetailData?.perguntas.map((item, index) => (
                    <div
                      key={`${item.data_pergunta}-${index}-${item.pergunta.slice(0, 20)}`}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge>{item.topico}</Badge>
                          <span className="text-xs text-slate-400 dark:text-slate-500">
                            {formatDateTime(item.data_pergunta)}
                          </span>
                          {item.carteira ? (
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {item.carteira}
                            </span>
                          ) : null}
                        </div>
                        {item.conversa_id ? (
                          <Button type="button" variant="ghost" size="sm" onClick={() => void handleOpenConversation(item)}>
                            Ver conversa
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-slate-500">
                            Sem histórico completo
                          </span>
                        )}
                      </div>
                      <p className="mt-3 text-sm text-slate-800 dark:text-slate-100">{item.pergunta}</p>
                      {item.justificativa ? (
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{item.justificativa}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-6">
        <div className="rounded-2xl bg-orange-100 p-3 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{label}</div>
          <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">{text}</div>;
}
