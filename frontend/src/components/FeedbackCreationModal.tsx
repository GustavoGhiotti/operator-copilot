import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Area,
  AreaChart,
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
  X,
  Search,
  User,
  Calendar,
  Headphones,
  MessageSquare,
  Send,
  BarChart3,
  Eye,
  EyeOff,
  TrendingUp,
  Sparkles,
  Filter,
  ChevronLeft,
  ChevronRight,
  Building2,
  CheckCircle2,
  AlertTriangle,
  PhoneCall,
  FileAudio,
  ClipboardCheck,
  Download,
  Users,
  Clock3,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  AreaChart as AreaChartIcon,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  ChecklistAnswer,
  ChecklistDefinition,
  ChecklistItemConfig,
  QualityWalletConfig,
  getChecklistDefinition,
  qualityWallets,
} from "@/config/qualityChecklists";
import { exportMatrixToXLSX, exportToXLSX } from "@/utils/exportUtils";
import QualityChecklistManager from "@/components/QualityChecklistManager";
import {
  buildRuntimeQualityConfig,
  ensureInitialManagedChecklists,
  loadManagedChecklists,
} from "@/services/qualityChecklistApi";

interface FeedbackCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Operator {
  id: string;
  cpf: string;
  nome: string;
  centro_custo: string;
  carteira: string;
}

interface FeedbackStats {
  total_enviados: number;
  total_lidos: number;
  total_positivos: number;
  total_negativos: number;
  taxa_leitura: number;
}

interface RecentFeedback {
  id: number;
  operador: string;
  data_hora: string;
  is_positivo: boolean;
  lido: boolean;
  descricao: string;
  id_ligacao?: string;
  call_id?: string;
  tempo_ligacao_total?: string;
  pontuacao?: number;
}

type AnalyticsPeriod = "diario" | "semanal" | "mensal";
type AnalyticsChartType = "linha" | "coluna" | "area" | "pizza";

interface WalletAveragePoint {
  key: string;
  label: string;
  media: number;
  total_feedbacks: number;
}

interface WalletAverageResponse {
  series: WalletAveragePoint[];
  resumo: {
    media_geral: number;
    total_feedbacks: number;
    operadores_avaliados: number;
  };
  comparativo?: AnalyticsComparison;
}

interface OffenderPoint {
  label: string;
  total: number;
  percentual: number;
}

interface OffenderComparisonItem {
  label: string;
  current_total: number;
  previous_total: number;
  current_percentual: number;
  previous_percentual: number;
  delta_percentual: number;
  delta_percent: number;
  trend: "melhorou" | "piorou" | "estavel";
}

interface OffenderResponse {
  series: OffenderPoint[];
  resumo: {
    total_ocorrencias: number;
    total_feedbacks: number;
    taxa_sucesso?: number;
    ocorrencias_por_feedback?: number;
  };
  comparativo?: AnalyticsComparison;
  itens_comparativo?: OffenderComparisonItem[];
  grupos_comparativo?: OffenderComparisonItem[];
}

interface AnalyticsOperator {
  cpf: string;
  nome: string;
  total_feedbacks: number;
  media_pontuacao: number;
}

interface OperatorAverageResponse {
  series: WalletAveragePoint[];
  resumo: {
    media_geral: number;
    total_feedbacks: number;
    nome_operador: string;
  };
  comparativo?: AnalyticsComparison;
}

interface AnalyticsComparison {
  metric_label: string;
  current_value: number;
  previous_value: number;
  delta_value: number;
  delta_percent: number;
  trend: "melhorou" | "piorou" | "estavel";
  current_label: string;
  previous_label: string;
  current_total_feedbacks?: number;
  previous_total_feedbacks?: number;
  current_occurrences_per_feedback?: number;
  previous_occurrences_per_feedback?: number;
}

interface AnalyticsDateRange {
  startDate: string;
  endDate: string;
  compareStartDate: string;
  compareEndDate: string;
}

type AnalyticsCompareModalType = "wallet" | "offenders" | "operator" | null;
type OffenderComparisonLimit = "1" | "2" | "all";

interface MonitorAnalyticsItem {
  monitor_nome: string;
  total_monitorias: number;
  monitorias_dia: number;
  monitorias_semana: number;
  monitorias_mes: number;
  media_geral: number;
  media_semanal: number;
  media_mensal: number;
  positivas: number;
  negativas: number;
  media_positivas: number;
  media_negativas: number;
}

interface MonitorAnalyticsResponse {
  monitores: MonitorAnalyticsItem[];
  resumo: {
    total_monitores: number;
    monitorias_dia: number;
    monitorias_semana: number;
    monitorias_mes: number;
    media_semanal_geral: number;
    media_mensal_geral: number;
    positivas: number;
    negativas: number;
  };
}

type MonitorFeedbackPeriod = "day" | "week" | "month" | "all";

interface FeedbackChecklistEntry {
  blockTitle: string;
  itemTitle: string;
}

interface StoredChecklistPayload {
  checklistId?: string;
  walletId?: string;
  walletLabel?: string;
  channelId?: string;
  channelLabel?: string;
  tempoLigacaoTotal?: string;
  metrics?: {
    baseScore?: number;
    maxScore?: number;
    deductionScore?: number;
    penaltyScore?: number;
    finalScore?: number;
    percentage?: number;
    severeCount?: number;
    notApplicableCount?: number;
  };
  done?: FeedbackChecklistEntry[];
  notDone?: FeedbackChecklistEntry[];
  notApplicable?: FeedbackChecklistEntry[];
  ncg?: FeedbackChecklistEntry[];
}

interface ReverseFeedbackDetail {
  id: number;
  operador: string;
  data_hora: string;
  id_ligacao?: string;
  call_id?: string;
  tempo_ligacao_total?: string;
  descricao: string;
  pontos_positivos?: string;
  pontos_melhorar?: string;
  pontuacao: number;
  is_positivo: boolean;
  lido: boolean;
  audio_path?: string;
  carteira_id?: string;
  carteira_label?: string;
  canal_id?: string;
  canal_label?: string;
  checklist_json?: string;
}

interface ReverseComparisonItem {
  itemId: string;
  blockId: string;
  blockTitle: string;
  itemTitle: string;
  severe: boolean;
  operatorAnswer: ChecklistAnswer | "ncg" | "no_ncg";
  monitorAnswer: ChecklistAnswer | "ncg" | "no_ncg";
  matches: boolean;
}

type ChecklistState = Record<string, ChecklistAnswer | undefined>;
type SevereChecklistState = Record<string, boolean>;

const getNowAsDatetimeLocal = (): string => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
};

const toDateInputValue = (date: Date) => {
  const adjusted = new Date(date);
  adjusted.setMinutes(adjusted.getMinutes() - adjusted.getTimezoneOffset());
  return adjusted.toISOString().slice(0, 10);
};

const formatAverage = (value: number) =>
  value.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

const formatPercent = (value: number) =>
  value.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

const formatDateInputLabel = (value: string) => {
  if (!value) return "-";
  const parsed = parseDateInputValue(value);
  return parsed
    ? parsed.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : value;
};

const getDateRangeDays = (startDate: string, endDate: string) => {
  const start = parseDateInputValue(startDate);
  const end = parseDateInputValue(endDate);
  if (!start || !end || end < start) return 0;
  return (
    Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  );
};

const splitOffenderLabel = (label: string) => {
  const separators = [" • ", "::", " - ", " – ", " | "];
  const separator = separators.find((item) => label.includes(item));
  if (!separator) {
    return {
      group: "Item do checklist",
      item: label,
    };
  }

  const [group, ...rest] = label.split(separator);
  return {
    group: group.trim() || "Item do checklist",
    item: rest.join(separator).trim() || label,
  };
};

const parseDateInputValue = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
};

const syncCompareRangeFromCurrent = (
  next: AnalyticsDateRange,
): AnalyticsDateRange => {
  const start = parseDateInputValue(next.startDate);
  const end = parseDateInputValue(next.endDate);

  if (!start || !end || end < start) return next;

  const diffDays =
    Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const compareEnd = new Date(start);
  compareEnd.setDate(compareEnd.getDate() - 1);
  const compareStart = new Date(compareEnd);
  compareStart.setDate(compareStart.getDate() - (diffDays - 1));

  return {
    ...next,
    compareStartDate: toDateInputValue(compareStart),
    compareEndDate: toDateInputValue(compareEnd),
  };
};

const getDefaultAnalyticsDateRange = (
  period: AnalyticsPeriod,
): AnalyticsDateRange => {
  const now = new Date();
  const currentStart = new Date(now);
  const currentEnd = new Date(now);

  if (period === "semanal") {
    const day = currentStart.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    currentStart.setDate(currentStart.getDate() + mondayOffset);
  } else if (period === "mensal") {
    currentStart.setDate(1);
  }

  currentStart.setHours(0, 0, 0, 0);
  currentEnd.setHours(0, 0, 0, 0);

  const diffDays = Math.max(
    1,
    Math.round(
      (currentEnd.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24),
    ) + 1,
  );
  const compareEnd = new Date(currentStart);
  compareEnd.setDate(compareEnd.getDate() - 1);
  const compareStart = new Date(compareEnd);
  compareStart.setDate(compareStart.getDate() - (diffDays - 1));

  return {
    startDate: toDateInputValue(currentStart),
    endDate: toDateInputValue(currentEnd),
    compareStartDate: toDateInputValue(compareStart),
    compareEndDate: toDateInputValue(compareEnd),
  };
};

const normalizeChecklistText = (value?: string | null) =>
  (value || "").trim().toLowerCase();

const getChecklistEntryKey = (
  blockTitle?: string | null,
  itemTitle?: string | null,
) =>
  `${normalizeChecklistText(blockTitle)}::${normalizeChecklistText(itemTitle)}`;

const parseStoredChecklistPayload = (
  rawValue?: string | null,
): StoredChecklistPayload | null => {
  if (!rawValue) return null;

  try {
    return JSON.parse(rawValue) as StoredChecklistPayload;
  } catch {
    return null;
  }
};

const CALL_DURATION_PATTERN = /^(\d{1,2}:)?\d{1,2}:\d{2}$/;

const isValidCallDuration = (value?: string | null) =>
  CALL_DURATION_PATTERN.test((value || "").trim());

const startOfLocalDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const isDateWithinMonitorPeriod = (
  dateString?: string | null,
  period: MonitorFeedbackPeriod = "all",
) => {
  if (!dateString || period === "all") return true;

  const target = new Date(dateString);
  if (Number.isNaN(target.getTime())) return false;

  const now = new Date();
  const today = startOfLocalDay(now);
  const candidate = startOfLocalDay(target);

  if (period === "day") {
    return candidate.getTime() === today.getTime();
  }

  if (period === "week") {
    const weekStart = startOfLocalDay(now);
    const weekday = weekStart.getDay();
    const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
    weekStart.setDate(weekStart.getDate() + mondayOffset);
    return candidate >= weekStart;
  }

  if (period === "month") {
    return (
      candidate.getMonth() === now.getMonth() &&
      candidate.getFullYear() === now.getFullYear()
    );
  }

  return true;
};

const FeedbackCreationModal: React.FC<FeedbackCreationModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { toast } = useToast();
  const token = localStorage.getItem("userToken");
  const monitorNome = localStorage
    .getItem("nomeCompleto")
    ?.trim()
    .toUpperCase();

  const [activeTab, setActiveTab] = useState("create");
  const [runtimeWallets, setRuntimeWallets] =
    useState<QualityWalletConfig[]>(qualityWallets);
  const [runtimeChecklists, setRuntimeChecklists] =
    useState<ChecklistDefinition[]>([]);
  const [createStep, setCreateStep] = useState(1);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    null,
  );
  const [selectedOperator, setSelectedOperator] = useState<Operator | null>(
    null,
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredOperators, setFilteredOperators] = useState<Operator[]>([]);
  const [showOperatorList, setShowOperatorList] = useState(false);
  const [isLoadingOperators, setIsLoadingOperators] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [recentFeedbacks, setRecentFeedbacks] = useState<RecentFeedback[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<any | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [filterOperator, setFilterOperator] = useState("");
  const [filterEC, setFilterEC] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filteredFeedbacks, setFilteredFeedbacks] = useState<RecentFeedback[]>(
    [],
  );
  const feedbacksPerPage = 10;
  const [analyticsWalletId, setAnalyticsWalletId] = useState<string | null>(
    null,
  );
  const [analyticsChannelId, setAnalyticsChannelId] = useState<string>("all");
  const [walletAveragePeriod, setWalletAveragePeriod] =
    useState<AnalyticsPeriod>("diario");
  const [walletAverageDateRange, setWalletAverageDateRange] =
    useState<AnalyticsDateRange>(() => getDefaultAnalyticsDateRange("diario"));
  const [walletAverageChartType, setWalletAverageChartType] =
    useState<AnalyticsChartType>("linha");
  const [offendersPeriod, setOffendersPeriod] =
    useState<AnalyticsPeriod>("diario");
  const [offendersDateRange, setOffendersDateRange] =
    useState<AnalyticsDateRange>(() => getDefaultAnalyticsDateRange("diario"));
  const [offendersChartType, setOffendersChartType] =
    useState<AnalyticsChartType>("coluna");
  const [operatorPeriod, setOperatorPeriod] =
    useState<AnalyticsPeriod>("diario");
  const [operatorDateRange, setOperatorDateRange] =
    useState<AnalyticsDateRange>(() => getDefaultAnalyticsDateRange("diario"));
  const [operatorChartType, setOperatorChartType] =
    useState<AnalyticsChartType>("linha");
  const [analyticsCompareModal, setAnalyticsCompareModal] =
    useState<AnalyticsCompareModalType>(null);
  const [selectedOffenderComparisonLabel, setSelectedOffenderComparisonLabel] =
    useState("all");
  const [offenderComparisonLimit, setOffenderComparisonLimit] =
    useState<OffenderComparisonLimit>("2");
  const [walletAverageData, setWalletAverageData] =
    useState<WalletAverageResponse | null>(null);
  const [offenderData, setOffenderData] = useState<OffenderResponse | null>(
    null,
  );
  const [analyticsOperators, setAnalyticsOperators] = useState<
    AnalyticsOperator[]
  >([]);
  const [selectedAnalyticsOperatorCpf, setSelectedAnalyticsOperatorCpf] =
    useState<string | null>(null);
  const [operatorAverageData, setOperatorAverageData] =
    useState<OperatorAverageResponse | null>(null);
  const [loadingWalletAverage, setLoadingWalletAverage] = useState(false);
  const [loadingOffenders, setLoadingOffenders] = useState(false);
  const [loadingAnalyticsOperators, setLoadingAnalyticsOperators] =
    useState(false);
  const [loadingOperatorAverage, setLoadingOperatorAverage] = useState(false);
  const [monitorAnalyticsData, setMonitorAnalyticsData] =
    useState<MonitorAnalyticsResponse | null>(null);
  const [loadingMonitorAnalytics, setLoadingMonitorAnalytics] = useState(false);
  const [monitorSearchTerm, setMonitorSearchTerm] = useState("");
  const [selectedMonitorName, setSelectedMonitorName] = useState<string | null>(
    null,
  );
  const [selectedMonitorFeedbacks, setSelectedMonitorFeedbacks] = useState<
    RecentFeedback[]
  >([]);
  const [loadingSelectedMonitorFeedbacks, setLoadingSelectedMonitorFeedbacks] =
    useState(false);
  const [showMonitorFeedbacksModal, setShowMonitorFeedbacksModal] =
    useState(false);
  const [exportingMonitorFeedbacks, setExportingMonitorFeedbacks] =
    useState(false);
  const [selectedMonitorFeedbackPeriod, setSelectedMonitorFeedbackPeriod] =
    useState<MonitorFeedbackPeriod>("all");
  const [
    selectedMonitorFeedbackOperatorFilter,
    setSelectedMonitorFeedbackOperatorFilter,
  ] = useState("");
  const [selectedReverseFeedback, setSelectedReverseFeedback] =
    useState<ReverseFeedbackDetail | null>(null);
  const [reverseChecklistAnswers, setReverseChecklistAnswers] =
    useState<ChecklistState>({});
  const [reverseSevereAnswers, setReverseSevereAnswers] =
    useState<SevereChecklistState>({});
  const [loadingReverseFeedback, setLoadingReverseFeedback] = useState(false);
  const [reverseCompleted, setReverseCompleted] = useState(false);

  const [callInfo, setCallInfo] = useState({
    data_hora: getNowAsDatetimeLocal(),
    id_ligacao: "",
    call_id: "",
    tempo_ligacao_total: "",
    observacoes_gerais: "",
    pontos_positivos: "",
    pontos_melhorar: "",
  });

  const [checklistAnswers, setChecklistAnswers] = useState<ChecklistState>({});
  const [severeAnswers, setSevereAnswers] = useState<SevereChecklistState>({});

  const selectedWallet = useMemo<QualityWalletConfig | null>(() => {
    if (!selectedWalletId) return null;
    return (
      runtimeWallets.find((wallet) => wallet.id === selectedWalletId) || null
    );
  }, [selectedWalletId, runtimeWallets]);

  const selectedAnalyticsWallet = useMemo<QualityWalletConfig | null>(() => {
    if (!analyticsWalletId) return null;
    return (
      runtimeWallets.find((wallet) => wallet.id === analyticsWalletId) || null
    );
  }, [analyticsWalletId, runtimeWallets]);

  const findChecklistDefinition = (checklistId: string) =>
    runtimeChecklists.find((item) => item.id === checklistId) ||
    getChecklistDefinition(checklistId);

  useEffect(() => {
    setAnalyticsChannelId("all");
  }, [analyticsWalletId]);

  useEffect(() => {
    setWalletAverageDateRange(
      getDefaultAnalyticsDateRange(walletAveragePeriod),
    );
  }, [walletAveragePeriod]);

  useEffect(() => {
    setOffendersDateRange(getDefaultAnalyticsDateRange(offendersPeriod));
  }, [offendersPeriod]);

  useEffect(() => {
    setOperatorDateRange(getDefaultAnalyticsDateRange(operatorPeriod));
  }, [operatorPeriod]);

  const selectedChecklist = useMemo<ChecklistDefinition | null>(() => {
    if (!selectedWallet || !selectedChannelId) return null;
    const channel = selectedWallet.channels.find(
      (item) => item.id === selectedChannelId,
    );
    if (!channel) return null;
    return findChecklistDefinition(channel.checklistId);
  }, [selectedWallet, selectedChannelId, runtimeChecklists]);

  const selectedReverseChecklist = useMemo<ChecklistDefinition | null>(() => {
    const storedChecklist = parseStoredChecklistPayload(
      selectedReverseFeedback?.checklist_json,
    );
    if (!storedChecklist?.checklistId) return null;
    return findChecklistDefinition(storedChecklist.checklistId);
  }, [selectedReverseFeedback, runtimeChecklists]);

  const selectedFeedbackChecklistPayload = useMemo(
    () => parseStoredChecklistPayload(selectedFeedback?.checklist_json),
    [selectedFeedback],
  );

  const filteredMonitors = useMemo(() => {
    const monitores = monitorAnalyticsData?.monitores || [];
    const normalizedSearch = monitorSearchTerm.trim().toLowerCase();

    if (!normalizedSearch) return monitores;

    return monitores.filter((monitor) =>
      monitor.monitor_nome.toLowerCase().includes(normalizedSearch),
    );
  }, [monitorAnalyticsData, monitorSearchTerm]);

  const selectedMonitorFilteredFeedbacks = useMemo(() => {
    const normalizedOperator = selectedMonitorFeedbackOperatorFilter
      .trim()
      .toLowerCase();

    return selectedMonitorFeedbacks.filter((feedback) => {
      const matchesPeriod = isDateWithinMonitorPeriod(
        feedback.data_hora,
        selectedMonitorFeedbackPeriod,
      );
      const matchesOperator = normalizedOperator
        ? feedback.operador.toLowerCase().includes(normalizedOperator)
        : true;

      return matchesPeriod && matchesOperator;
    });
  }, [
    selectedMonitorFeedbacks,
    selectedMonitorFeedbackPeriod,
    selectedMonitorFeedbackOperatorFilter,
  ]);

  const selectedMonitorAnalytics = useMemo(() => {
    if (!selectedMonitorName) return null;

    return (
      monitorAnalyticsData?.monitores.find(
        (monitor) => monitor.monitor_nome === selectedMonitorName,
      ) || null
    );
  }, [monitorAnalyticsData, selectedMonitorName]);

  const walletComparisonSummary = useMemo(() => {
    const comparison = walletAverageData?.comparativo;
    if (!comparison) return null;

    return {
      trend: comparison.trend,
      currentLabel: comparison.current_label,
      previousLabel: comparison.previous_label,
      currentValue: comparison.current_value,
      previousValue: comparison.previous_value,
      deltaPercent: Math.abs(comparison.delta_percent || 0),
      deltaValue: comparison.delta_value,
      currentTotalFeedbacks: comparison.current_total_feedbacks ?? 0,
      previousTotalFeedbacks: comparison.previous_total_feedbacks ?? 0,
    };
  }, [walletAverageData]);

  const offenderExecutiveSummary = useMemo(() => {
    const items = offenderData?.itens_comparativo || [];
    const improved = items.filter((item) => item.trend === "melhorou");
    const worsened = items.filter((item) => item.trend === "piorou");
    const stable = items.filter((item) => item.trend === "estavel");

    const topImproved = [...improved].sort(
      (left, right) =>
        Math.abs(right.delta_percentual) - Math.abs(left.delta_percentual),
    )[0];
    const topWorsened = [...worsened].sort(
      (left, right) =>
        Math.abs(right.delta_percentual) - Math.abs(left.delta_percentual),
    )[0];
    const highestCurrent = [...items].sort(
      (left, right) => right.current_percentual - left.current_percentual,
    )[0];

    return {
      improvedCount: improved.length,
      worsenedCount: worsened.length,
      stableCount: stable.length,
      topImproved,
      topWorsened,
      highestCurrent,
    };
  }, [offenderData]);

  useEffect(() => {
    if (selectedOffenderComparisonLabel === "all") return;

    const stillExists = offenderData?.itens_comparativo?.some(
      (item) => item.label === selectedOffenderComparisonLabel,
    );

    if (!stillExists) {
      setSelectedOffenderComparisonLabel("all");
    }
  }, [offenderData, selectedOffenderComparisonLabel]);

  const analyticsExecutiveHighlights = useMemo(() => {
    if (!selectedAnalyticsWallet) return [];

    const highlights: Array<{
      title: string;
      value: string;
      caption: string;
      tone: "neutral" | "positive" | "negative" | "warning";
    }> = [];

    highlights.push({
      title: "Carteira analisada",
      value: selectedAnalyticsWallet.shortLabel,
      caption:
        analyticsChannelId === "all"
          ? "Todos os canais"
          : selectedAnalyticsWallet.channels.find(
              (channel) => channel.id === analyticsChannelId,
            )?.label || "Canal selecionado",
      tone: "neutral",
    });

    if (walletComparisonSummary) {
      highlights.push({
        title: "Média da carteira",
        value: formatAverage(walletComparisonSummary.currentValue),
        caption:
          walletComparisonSummary.trend === "melhorou"
            ? `${formatPercent(walletComparisonSummary.deltaPercent)}% melhor que o período anterior`
            : walletComparisonSummary.trend === "piorou"
              ? `${formatPercent(walletComparisonSummary.deltaPercent)}% pior que o período anterior`
              : "Sem variação relevante no período",
        tone:
          walletComparisonSummary.trend === "melhorou"
            ? "positive"
            : walletComparisonSummary.trend === "piorou"
              ? "negative"
              : "neutral",
      });
    }

    if (offenderExecutiveSummary.highestCurrent) {
      highlights.push({
        title: "Maior ofensor atual",
        value: `${formatPercent(offenderExecutiveSummary.highestCurrent.current_percentual)}%`,
        caption: offenderExecutiveSummary.highestCurrent.label,
        tone: "warning",
      });
    }

    if (offenderExecutiveSummary.topWorsened) {
      highlights.push({
        title: "Maior piora",
        value: `${formatPercent(
          Math.abs(offenderExecutiveSummary.topWorsened.delta_percentual),
        )} p.p.`,
        caption: offenderExecutiveSummary.topWorsened.label,
        tone: "negative",
      });
    } else if (offenderExecutiveSummary.topImproved) {
      highlights.push({
        title: "Maior evolução",
        value: `${formatPercent(
          Math.abs(offenderExecutiveSummary.topImproved.delta_percentual),
        )} p.p.`,
        caption: offenderExecutiveSummary.topImproved.label,
        tone: "positive",
      });
    }

    return highlights.slice(0, 4);
  }, [
    selectedAnalyticsWallet,
    analyticsChannelId,
    walletComparisonSummary,
    offenderExecutiveSummary,
  ]);

  const positiveChecklistItems = useMemo(
    () =>
      selectedChecklist?.blocks
        .flatMap((block) => block.items)
        .filter((item) => !item.severe) || [],
    [selectedChecklist],
  );

  const severeChecklistItems = useMemo(
    () =>
      selectedChecklist?.blocks
        .flatMap((block) => block.items)
        .filter((item) => item.severe) || [],
    [selectedChecklist],
  );

  const checklistMetrics = useMemo(() => {
    const deductionScore = positiveChecklistItems.reduce((total, item) => {
      return checklistAnswers[item.id] === "no" ? total + item.weight : total;
    }, 0);

    const maxScore = 100;
    const baseScore = Math.max(0, maxScore - deductionScore);

    const penaltyScore = severeChecklistItems.reduce((total, item) => {
      return severeAnswers[item.id] ? total + item.weight : total;
    }, 0);

    const finalScore = Math.max(0, Math.min(maxScore, baseScore + penaltyScore));
    const percentage = finalScore;
    const severeCount = severeChecklistItems.filter(
      (item) => severeAnswers[item.id],
    ).length;
    const notApplicableCount = positiveChecklistItems.filter(
      (item) => checklistAnswers[item.id] === "na",
    ).length;

    return {
      baseScore,
      maxScore,
      deductionScore,
      penaltyScore,
      finalScore,
      percentage,
      severeCount,
      notApplicableCount,
    };
  }, [
    positiveChecklistItems,
    severeChecklistItems,
    checklistAnswers,
    severeAnswers,
  ]);

  const reversePositiveChecklistItems = useMemo(
    () =>
      selectedReverseChecklist?.blocks
        .flatMap((block) => block.items)
        .filter((item) => !item.severe) || [],
    [selectedReverseChecklist],
  );

  const reverseSevereChecklistItems = useMemo(
    () =>
      selectedReverseChecklist?.blocks
        .flatMap((block) => block.items)
        .filter((item) => item.severe) || [],
    [selectedReverseChecklist],
  );

  const reverseChecklistMetrics = useMemo(() => {
    const deductionScore = reversePositiveChecklistItems.reduce((total, item) => {
      return reverseChecklistAnswers[item.id] === "no"
        ? total + item.weight
        : total;
    }, 0);

    const maxScore = 100;
    const baseScore = Math.max(0, maxScore - deductionScore);

    const penaltyScore = reverseSevereChecklistItems.reduce((total, item) => {
      return reverseSevereAnswers[item.id] ? total + item.weight : total;
    }, 0);

    const finalScore = Math.max(0, Math.min(maxScore, baseScore + penaltyScore));
    const percentage = finalScore;
    const severeCount = reverseSevereChecklistItems.filter(
      (item) => reverseSevereAnswers[item.id],
    ).length;
    const notApplicableCount = reversePositiveChecklistItems.filter(
      (item) => reverseChecklistAnswers[item.id] === "na",
    ).length;

    return {
      baseScore,
      maxScore,
      deductionScore,
      penaltyScore,
      finalScore,
      percentage,
      severeCount,
      notApplicableCount,
    };
  }, [
    reversePositiveChecklistItems,
    reverseSevereChecklistItems,
    reverseChecklistAnswers,
    reverseSevereAnswers,
  ]);

  const reverseComparison = useMemo(() => {
    const storedChecklist = parseStoredChecklistPayload(
      selectedReverseFeedback?.checklist_json,
    );

    if (!selectedReverseChecklist || !storedChecklist) {
      return null;
    }

    const doneSet = new Set(
      (storedChecklist.done || []).map((entry) =>
        getChecklistEntryKey(entry.blockTitle, entry.itemTitle),
      ),
    );
    const notDoneSet = new Set(
      (storedChecklist.notDone || []).map((entry) =>
        getChecklistEntryKey(entry.blockTitle, entry.itemTitle),
      ),
    );
    const notApplicableSet = new Set(
      (storedChecklist.notApplicable || []).map((entry) =>
        getChecklistEntryKey(entry.blockTitle, entry.itemTitle),
      ),
    );
    const ncgSet = new Set(
      (storedChecklist.ncg || []).map((entry) =>
        getChecklistEntryKey(entry.blockTitle, entry.itemTitle),
      ),
    );

    const items: ReverseComparisonItem[] = [];

    selectedReverseChecklist.blocks.forEach((block) => {
      block.items.forEach((item) => {
        const key = getChecklistEntryKey(block.title, item.title);

        if (item.severe) {
          const monitorChecked = ncgSet.has(key);
          const operatorAnswer = reverseSevereAnswers[item.id] ? "ncg" : "no_ncg";
          const monitorAnswer = monitorChecked ? "ncg" : "no_ncg";
          items.push({
            itemId: item.id,
            blockId: block.id,
            blockTitle: block.title,
            itemTitle: item.title,
            severe: true,
            operatorAnswer,
            monitorAnswer,
            matches: operatorAnswer === monitorAnswer,
          });
          return;
        }

        const monitorAnswer: ChecklistAnswer = notApplicableSet.has(key)
          ? "na"
          : doneSet.has(key)
            ? "yes"
            : notDoneSet.has(key)
              ? "no"
              : "no";
        const operatorAnswer = reverseChecklistAnswers[item.id] || "no";
        items.push({
          itemId: item.id,
          blockId: block.id,
          blockTitle: block.title,
          itemTitle: item.title,
          severe: false,
          operatorAnswer,
          monitorAnswer,
          matches: operatorAnswer === monitorAnswer,
        });
      });
    });

    const matchedCount = items.filter((item) => item.matches).length;
    const divergenceCount = items.length - matchedCount;

    return {
      storedChecklist,
      items,
      matchedCount,
      divergenceCount,
    };
  }, [
    selectedReverseChecklist,
    selectedReverseFeedback,
    reverseChecklistAnswers,
    reverseSevereAnswers,
  ]);

  const canAdvanceFromChannel = !!selectedChannelId;
  const requiresCallDuration =
    selectedChecklist?.channelId === "voz" || selectedWallet?.id === "gama";
  const canAdvanceFromCallInfo =
    !!selectedOperator &&
    !!callInfo.data_hora &&
    !!callInfo.id_ligacao.trim() &&
    (!requiresCallDuration ||
      isValidCallDuration(callInfo.tempo_ligacao_total));
  const canAdvanceFromChecklist =
    !!selectedChecklist &&
    positiveChecklistItems.length > 0 &&
    positiveChecklistItems.every((item) => !!checklistAnswers[item.id]);
  const canCompleteReverseChecklist =
    reversePositiveChecklistItems.length > 0 &&
    reversePositiveChecklistItems.every(
      (item) => !!reverseChecklistAnswers[item.id],
    );

  const canSubmit =
    !!selectedWallet &&
    !!selectedChannelId &&
    !!selectedOperator &&
    !!callInfo.id_ligacao.trim() &&
    (!requiresCallDuration ||
      isValidCallDuration(callInfo.tempo_ligacao_total)) &&
    !!selectedChecklist &&
    positiveChecklistItems.every((item) => !!checklistAnswers[item.id]) &&
    !isSending;

  const resetChecklistState = (checklist: ChecklistDefinition | null) => {
    const nextChecklistAnswers: ChecklistState = {};
    const nextSevereAnswers: SevereChecklistState = {};

    checklist?.blocks.forEach((block) => {
      block.items.forEach((item) => {
        if (item.severe) {
          nextSevereAnswers[item.id] = false;
        } else {
          nextChecklistAnswers[item.id] = undefined;
        }
      });
    });

    setChecklistAnswers(nextChecklistAnswers);
    setSevereAnswers(nextSevereAnswers);
  };

  const resetForm = () => {
    setCreateStep(1);
    setSelectedWalletId(null);
    setSelectedChannelId(null);
    setSelectedOperator(null);
    setSearchTerm("");
    setFilteredOperators([]);
    setShowOperatorList(false);
    setAudioFile(null);
    setCallInfo({
      data_hora: getNowAsDatetimeLocal(),
      id_ligacao: "",
      call_id: "",
      tempo_ligacao_total: "",
      observacoes_gerais: "",
      pontos_positivos: "",
      pontos_melhorar: "",
    });
    setChecklistAnswers({});
    setSevereAnswers({});
  };

  const refreshRuntimeChecklists = async () => {
    try {
      await ensureInitialManagedChecklists(token);
      const published = await loadManagedChecklists(token, true);
      const runtime = buildRuntimeQualityConfig(published);
      setRuntimeWallets(runtime.wallets);
      setRuntimeChecklists(runtime.checklists);
    } catch {
      // Mantém a configuração embarcada como contingência durante a migração.
      setRuntimeWallets(qualityWallets);
      setRuntimeChecklists([]);
    }
  };

  useEffect(() => {
    if (isOpen) void refreshRuntimeChecklists();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setActiveTab("create");
      setCreateStep(1);
      resetForm();
      resetReverseMonitoring();
      setAnalyticsCompareModal(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedChecklist) {
      resetChecklistState(selectedChecklist);
    }
  }, [selectedChecklist]);

  useEffect(() => {
    if (isOpen && activeTab === "analytics") {
      loadStats();
      loadAllFeedbacks();
      if (!analyticsWalletId && runtimeWallets.length > 0) {
        setAnalyticsWalletId(runtimeWallets[0].id);
      }
    }
  }, [isOpen, activeTab, monitorNome, analyticsWalletId, runtimeWallets]);

  useEffect(() => {
    if (isOpen && activeTab === "monitor") {
      loadMonitorAnalytics();
      setSelectedMonitorName(null);
      setSelectedMonitorFeedbacks([]);
      setShowMonitorFeedbacksModal(false);
      setSelectedMonitorFeedbackOperatorFilter("");
      setSelectedMonitorFeedbackPeriod("all");
    }
  }, [isOpen, activeTab]);

  useEffect(() => {
    if (
      isOpen &&
      activeTab === "reverse" &&
      recentFeedbacks.length === 0 &&
      monitorNome
    ) {
      loadAllFeedbacks();
    }
  }, [isOpen, activeTab, recentFeedbacks.length, monitorNome]);

  useEffect(() => {
    if (!selectedReverseChecklist) {
      setReverseChecklistAnswers({});
      setReverseSevereAnswers({});
      return;
    }

    const nextChecklistAnswers: ChecklistState = {};
    const nextSevereAnswers: SevereChecklistState = {};

    selectedReverseChecklist.blocks.forEach((block) => {
      block.items.forEach((item) => {
        if (item.severe) {
          nextSevereAnswers[item.id] = false;
        } else {
          nextChecklistAnswers[item.id] = undefined;
        }
      });
    });

    setReverseChecklistAnswers(nextChecklistAnswers);
    setReverseSevereAnswers(nextSevereAnswers);
    setReverseCompleted(false);
  }, [selectedReverseChecklist]);

  useEffect(() => {
    applyFilters(recentFeedbacks);
  }, [filterOperator, filterEC, recentFeedbacks]);

  useEffect(() => {
    if (activeTab !== "analytics" || !analyticsWalletId) return;
    loadWalletAverage();
  }, [
    activeTab,
    analyticsWalletId,
    analyticsChannelId,
    walletAveragePeriod,
    walletAverageDateRange,
  ]);

  useEffect(() => {
    if (activeTab !== "analytics" || !analyticsWalletId) return;
    loadWalletOffenders();
  }, [
    activeTab,
    analyticsWalletId,
    analyticsChannelId,
    offendersPeriod,
    offendersDateRange,
  ]);

  useEffect(() => {
    if (activeTab !== "analytics" || !analyticsWalletId) return;
    loadAnalyticsOperators();
  }, [activeTab, analyticsWalletId, analyticsChannelId]);

  useEffect(() => {
    if (!analyticsOperators.length) {
      setSelectedAnalyticsOperatorCpf(null);
      return;
    }

    if (
      !selectedAnalyticsOperatorCpf ||
      !analyticsOperators.some(
        (operator) => operator.cpf === selectedAnalyticsOperatorCpf,
      )
    ) {
      setSelectedAnalyticsOperatorCpf(analyticsOperators[0].cpf);
    }
  }, [analyticsOperators, selectedAnalyticsOperatorCpf]);

  useEffect(() => {
    if (
      activeTab !== "analytics" ||
      !analyticsWalletId ||
      !selectedAnalyticsOperatorCpf
    ) {
      return;
    }

    loadOperatorAverage();
  }, [
    activeTab,
    analyticsWalletId,
    analyticsChannelId,
    selectedAnalyticsOperatorCpf,
    operatorPeriod,
    operatorDateRange,
  ]);

  const buscarOperadores = async () => {
    if (!searchTerm.trim()) return;
    if (!selectedWallet) {
      toast({
        title: "Selecione a carteira",
        description: "Escolha a carteira antes de buscar um operador.",
        variant: "destructive",
      });
      return;
    }

    setIsLoadingOperators(true);
    try {
      const response = await axios.get(
        `/api/qualidade/buscar?nome=${encodeURIComponent(searchTerm)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const operators = (response.data.operadores || []).filter(
        (operator: Operator) => selectedWallet.matchOperator(operator),
      );
      setFilteredOperators(operators);
      setShowOperatorList(true);
    } catch (error) {
      console.error("Erro ao buscar operadores:", error);
      toast({
        title: "Erro ao buscar operadores",
        description: "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingOperators(false);
    }
  };

  const loadStats = async () => {
    if (!monitorNome) return;
    setLoadingStats(true);
    try {
      const response = await axios.get(
        "/api/qualidade/feedbacks/stats-monitor",
        {
          params: { monitor_nome: monitorNome },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      setStats(response.data);
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
    } finally {
      setLoadingStats(false);
    }
  };

  const loadAllFeedbacks = async () => {
    if (!monitorNome) return;
    try {
      const response = await axios.get(
        "/api/qualidade/feedbacks/recentes-monitor",
        {
          params: { monitor_nome: monitorNome },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const allFeedbacks = response.data.feedbacks || [];
      setRecentFeedbacks(allFeedbacks);
      applyFilters(allFeedbacks);
    } catch (error) {
      console.error("Erro ao carregar feedbacks:", error);
    }
  };

  const loadWalletAverage = async () => {
    if (!analyticsWalletId || !token) return;
    setLoadingWalletAverage(true);
    try {
      const response = await axios.get(
        "/api/qualidade/analytics/carteira/media",
        {
          params: {
            wallet_id: analyticsWalletId,
            periodo: walletAveragePeriod,
            canal_id: analyticsChannelId === "all" ? "" : analyticsChannelId,
            start_date: walletAverageDateRange.startDate,
            end_date: walletAverageDateRange.endDate,
            compare_start_date: walletAverageDateRange.compareStartDate,
            compare_end_date: walletAverageDateRange.compareEndDate,
          },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      setWalletAverageData(response.data);
    } catch (error) {
      console.error("Erro ao carregar média da carteira:", error);
      setWalletAverageData(null);
    } finally {
      setLoadingWalletAverage(false);
    }
  };

  const loadWalletOffenders = async () => {
    if (!analyticsWalletId || !token) return;
    setLoadingOffenders(true);
    try {
      const response = await axios.get(
        "/api/qualidade/analytics/carteira/ofensores",
        {
          params: {
            wallet_id: analyticsWalletId,
            periodo: offendersPeriod,
            canal_id: analyticsChannelId === "all" ? "" : analyticsChannelId,
            start_date: offendersDateRange.startDate,
            end_date: offendersDateRange.endDate,
            compare_start_date: offendersDateRange.compareStartDate,
            compare_end_date: offendersDateRange.compareEndDate,
          },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      setOffenderData(response.data);
    } catch (error) {
      console.error("Erro ao carregar ofensores da carteira:", error);
      setOffenderData(null);
    } finally {
      setLoadingOffenders(false);
    }
  };

  const loadAnalyticsOperators = async () => {
    if (!analyticsWalletId || !token) return;
    setLoadingAnalyticsOperators(true);
    try {
      const response = await axios.get(
        "/api/qualidade/analytics/carteira/operadores",
        {
          params: {
            wallet_id: analyticsWalletId,
            canal_id: analyticsChannelId === "all" ? "" : analyticsChannelId,
          },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      setAnalyticsOperators(response.data.operadores || []);
    } catch (error) {
      console.error("Erro ao carregar operadores da carteira:", error);
      setAnalyticsOperators([]);
    } finally {
      setLoadingAnalyticsOperators(false);
    }
  };

  const loadOperatorAverage = async () => {
    if (!analyticsWalletId || !selectedAnalyticsOperatorCpf || !token) return;
    setLoadingOperatorAverage(true);
    try {
      const response = await axios.get(
        "/api/qualidade/analytics/operador/media",
        {
          params: {
            wallet_id: analyticsWalletId,
            cpf_operador: selectedAnalyticsOperatorCpf,
            periodo: operatorPeriod,
            canal_id: analyticsChannelId === "all" ? "" : analyticsChannelId,
            start_date: operatorDateRange.startDate,
            end_date: operatorDateRange.endDate,
            compare_start_date: operatorDateRange.compareStartDate,
            compare_end_date: operatorDateRange.compareEndDate,
          },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      setOperatorAverageData(response.data);
    } catch (error) {
      console.error("Erro ao carregar média do operador:", error);
      setOperatorAverageData(null);
    } finally {
      setLoadingOperatorAverage(false);
    }
  };

  const loadMonitorAnalytics = async () => {
    if (!token) return;
    setLoadingMonitorAnalytics(true);
    try {
      const response = await axios.get(
        "/api/qualidade/analytics/monitores/teleatendimento",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      setMonitorAnalyticsData(response.data);
    } catch (error) {
      console.error("Erro ao carregar analytics dos monitores:", error);
      setMonitorAnalyticsData(null);
    } finally {
      setLoadingMonitorAnalytics(false);
    }
  };

  const loadMonitorFeedbacks = async (monitorName: string) => {
    if (!token) return;

    setSelectedMonitorName(monitorName);
    setShowMonitorFeedbacksModal(true);
    setLoadingSelectedMonitorFeedbacks(true);
    setSelectedMonitorFeedbackOperatorFilter("");
    setSelectedMonitorFeedbackPeriod("all");

    try {
      const response = await axios.get(
        "/api/qualidade/feedbacks/recentes-monitor",
        {
          params: { monitor_nome: monitorName },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      setSelectedMonitorFeedbacks(response.data.feedbacks || []);
    } catch (error) {
      console.error("Erro ao carregar feedbacks do monitor:", error);
      setSelectedMonitorFeedbacks([]);
      toast({
        title: "Erro ao carregar feedbacks",
        description: "Não foi possível abrir o histórico dessa monitora.",
        variant: "destructive",
      });
    } finally {
      setLoadingSelectedMonitorFeedbacks(false);
    }
  };

  const loadReverseFeedbackDetail = async (id: number) => {
    if (!monitorNome || !token) return;

    setLoadingReverseFeedback(true);
    setReverseCompleted(false);
    try {
      const response = await axios.get(
        `/api/qualidade/feedbacks/detalhe/${id}`,
        {
          params: { monitor_nome: monitorNome },
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      setSelectedReverseFeedback(response.data);
    } catch (error) {
      console.error("Erro ao carregar monitoria invertida:", error);
      setSelectedReverseFeedback(null);
      toast({
        title: "Erro ao carregar monitoria",
        description: "Não foi possível abrir essa monitoria invertida.",
        variant: "destructive",
      });
    } finally {
      setLoadingReverseFeedback(false);
    }
  };

  const resetReverseMonitoring = () => {
    setSelectedReverseFeedback(null);
    setReverseChecklistAnswers({});
    setReverseSevereAnswers({});
    setReverseCompleted(false);
  };

  const applyFilters = (feedbacks: RecentFeedback[]) => {
    let filtered = feedbacks;

    if (filterOperator) {
      filtered = filtered.filter((feedback) =>
        feedback.operador.toLowerCase().includes(filterOperator.toLowerCase()),
      );
    }

    if (filterEC) {
      filtered = filtered.filter(
        (feedback) =>
          feedback.id_ligacao?.toString().includes(filterEC) ||
          feedback.call_id?.toString().includes(filterEC),
      );
    }

    setFilteredFeedbacks(filtered);
    setTotalPages(Math.max(1, Math.ceil(filtered.length / feedbacksPerPage)));
    setCurrentPage(1);
  };

  const getCurrentPageFeedbacks = () => {
    const startIndex = (currentPage - 1) * feedbacksPerPage;
    const endIndex = startIndex + feedbacksPerPage;
    return filteredFeedbacks.slice(startIndex, endIndex);
  };

  const handleOperatorSelect = (operator: Operator) => {
    setSelectedOperator(operator);
    setSearchTerm(operator.nome);
    setShowOperatorList(false);
  };

  const handleWalletSelect = (walletId: string) => {
    setSelectedWalletId(walletId);
    setCreateStep(1);
    const wallet = runtimeWallets.find((item) => item.id === walletId);
    setSelectedChannelId(wallet?.channels[0]?.id || null);
    setSelectedOperator(null);
    setSearchTerm("");
    setFilteredOperators([]);
    setShowOperatorList(false);
  };

  const handleChecklistAnswer = (itemId: string, answer: ChecklistAnswer) => {
    setChecklistAnswers((prev) => ({ ...prev, [itemId]: answer }));
  };

  const handleSevereAnswer = (itemId: string, checked: boolean) => {
    setSevereAnswers((prev) => ({ ...prev, [itemId]: checked }));
  };

  const getGeneratedSummary = () => {
    if (!selectedWallet || !selectedChecklist || !selectedOperator) return "";

    const checklistLines = selectedChecklist.blocks.flatMap((block) => {
      const itemLines = block.items.map((item) => {
        if (item.severe) {
          return `- [${severeAnswers[item.id] ? "X" : " "}] ${block.title} > ${item.title} (${item.weight})`;
        }

        const answer = checklistAnswers[item.id];
        const answerLabel = answer === "yes" ? "OK" : answer === "na" ? "N/A" : "NOK";
        return `- [${answerLabel}] ${block.title} > ${item.title} (${item.weight})`;
      });
      return itemLines;
    });

    return [
      `Carteira: ${selectedWallet.label}`,
      `Canal: ${selectedChecklist.channelLabel}`,
      `Operador: ${selectedOperator.nome}`,
      `EC da ligação: ${callInfo.id_ligacao}`,
      `Call ID da ligação: ${callInfo.call_id || "-"}`,
      ...(selectedChecklist.channelId === "voz"
        ? [`Tempo total da ligação: ${callInfo.tempo_ligacao_total || "-"}`]
        : []),
      `Nota inicial: ${checklistMetrics.maxScore}`,
      `Pontos descontados: -${checklistMetrics.deductionScore}`,
      `Penalidade NCG: ${checklistMetrics.penaltyScore}`,
      `Nota final: ${checklistMetrics.finalScore}`,
      `Aderência do checklist: ${checklistMetrics.percentage}%`,
      "",
      "Checklist aplicado:",
      ...checklistLines,
      "",
      "Observações gerais:",
      callInfo.observacoes_gerais || "Sem observações adicionais.",
    ].join("\n");
  };

  const getScoreTone = (score: number) => {
    if (score >= 85) {
      return {
        label: "Excelente",
        chip: "bg-emerald-100 text-emerald-700",
        card: "from-emerald-500 to-green-500",
        text: "text-emerald-600",
        panel: "border-emerald-200 bg-emerald-50",
      };
    }
    if (score >= 70) {
      return {
        label: "Bom",
        chip: "bg-sky-100 text-sky-700",
        card: "from-sky-500 to-blue-500",
        text: "text-sky-600",
        panel: "border-sky-200 bg-sky-50",
      };
    }
    if (score >= 50) {
      return {
        label: "Atenção",
        chip: "bg-amber-100 text-amber-700",
        card: "from-amber-500 to-orange-500",
        text: "text-amber-600",
        panel: "border-amber-200 bg-amber-50",
      };
    }
    return {
      label: "Crítico",
      chip: "bg-rose-100 text-rose-700",
      card: "from-rose-500 to-red-500",
      text: "text-rose-600",
      panel: "border-rose-200 bg-rose-50",
    };
  };

  const chartColors = ["#f97316", "#10b981", "#3b82f6", "#f43f5e", "#8b5cf6"];

  const getTrendPresentation = (trend?: "melhorou" | "piorou" | "estavel") => {
    if (trend === "melhorou") {
      return {
        label: "Melhorou",
        icon: ArrowUpRight,
        toneClass:
          "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-900",
        textClass: "text-emerald-600 dark:text-emerald-300",
      };
    }

    if (trend === "piorou") {
      return {
        label: "Piorou",
        icon: ArrowDownRight,
        toneClass:
          "text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-300 dark:bg-rose-950/40 dark:border-rose-900",
        textClass: "text-rose-600 dark:text-rose-300",
      };
    }

    return {
      label: "Estável",
      icon: Minus,
      toneClass:
        "text-slate-700 bg-slate-50 border-slate-200 dark:text-slate-300 dark:bg-slate-900 dark:border-slate-800",
      textClass: "text-slate-600 dark:text-slate-300",
    };
  };

  const renderExecutiveHighlight = (
    title: string,
    value: string,
    caption: string,
    tone: "neutral" | "positive" | "negative" | "warning" = "neutral",
    key?: React.Key,
  ) => {
    const toneClasses = {
      neutral:
        "border-slate-200 bg-white/80 text-slate-900 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-100",
      positive:
        "border-emerald-200 bg-emerald-50/90 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100",
      negative:
        "border-rose-200 bg-rose-50/90 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100",
      warning:
        "border-amber-200 bg-amber-50/90 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
    };

    return (
      <div
        key={key}
        className={`rounded-[24px] border p-4 shadow-sm backdrop-blur ${toneClasses[tone]}`}
      >
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">
          {title}
        </div>
        <div className="mt-3 text-2xl font-semibold">{value}</div>
        <div className="mt-2 text-sm opacity-80">{caption}</div>
      </div>
    );
  };

  const renderComparisonGauge = (
    comparison: AnalyticsComparison | undefined,
    accentColor: string,
    subtitle: string,
    extraLine?: string,
  ) => {
    if (!comparison) {
      return (
        <div className="rounded-3xl border border-dashed border-gray-300 p-5 text-sm text-gray-500">
          Comparativo indisponível para o período selecionado.
        </div>
      );
    }

    const rawPercent = comparison.delta_percent || 0;
    const gaugePercent = Math.min(Math.abs(rawPercent), 100);
    const trendPositive = comparison.trend === "melhorou";
    const trendNegative = comparison.trend === "piorou";
    const trendColor = trendPositive
      ? "text-emerald-600"
      : trendNegative
        ? "text-rose-600"
        : "text-slate-500";
    const TrendIcon = trendPositive
      ? ArrowUpRight
      : trendNegative
        ? ArrowDownRight
        : Minus;
    const needlePosition = trendPositive
      ? 50 + gaugePercent / 2
      : trendNegative
        ? 50 - gaugePercent / 2
        : 50;
    const needleAngle = -90 + needlePosition * 1.8;
    const radians = (needleAngle * Math.PI) / 180;
    const centerX = 100;
    const centerY = 100;
    const needleLength = 58;
    const needleX = centerX + needleLength * Math.cos(radians);
    const needleY = centerY + needleLength * Math.sin(radians);

    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              <Clock3 className="h-4 w-4" />
              Relógio comparativo
            </div>
            <div className="mt-2 text-base font-semibold text-slate-900">
              {subtitle}
            </div>
          </div>
          <div
            className="rounded-full px-3 py-1 text-xs font-semibold text-white"
            style={{ backgroundColor: accentColor }}
          >
            {comparison.metric_label}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-5 xl:flex-row xl:items-center">
          <div className="relative mx-auto h-40 w-56 xl:mx-0">
            <svg className="h-40 w-56" viewBox="0 0 200 120">
              <path
                d="M20 100 A80 80 0 0 1 180 100"
                stroke="#e5e7eb"
                strokeWidth="16"
                fill="none"
                strokeLinecap="round"
              />
              <path
                d="M20 100 A80 80 0 0 1 100 20"
                stroke="#f43f5e"
                strokeWidth="16"
                fill="none"
                strokeLinecap="round"
              />
              <path
                d="M100 20 A80 80 0 0 1 180 100"
                stroke="#10b981"
                strokeWidth="16"
                fill="none"
                strokeLinecap="round"
              />
              <line
                x1={centerX}
                y1={centerY}
                x2={needleX}
                y2={needleY}
                stroke={accentColor}
                strokeWidth="6"
                strokeLinecap="round"
              />
              <circle cx={centerX} cy={centerY} r="8" fill={accentColor} />
            </svg>
            <div className="absolute inset-x-0 bottom-1 flex flex-col items-center justify-center">
              <div
                className={`flex items-center gap-1 text-sm font-semibold ${trendColor}`}
              >
                <TrendIcon className="h-4 w-4" />
                {comparison.trend === "estavel"
                  ? "0%"
                  : `${formatPercent(Math.abs(rawPercent))}%`}
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-400">
                Evolução
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-[0.14em] text-slate-500">
                  Agora
                </div>
                <div className="mt-1 text-2xl font-bold text-slate-900">
                  {formatAverage(comparison.current_value)}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {comparison.current_label}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-[0.14em] text-slate-500">
                  Antes
                </div>
                <div className="mt-1 text-2xl font-bold text-slate-900">
                  {formatAverage(comparison.previous_value)}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {comparison.previous_label}
                </div>
              </div>
            </div>
            <div className={`text-sm font-medium ${trendColor}`}>
              {comparison.trend === "melhorou"
                ? "Houve evolução no período comparado."
                : comparison.trend === "piorou"
                  ? "O indicador caiu no período comparado."
                  : "O indicador ficou estável entre os períodos."}
            </div>
            {extraLine && (
              <div className="text-sm text-slate-500">{extraLine}</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderPercentGauge = (
    value: number,
    label: string,
    accentColor: string,
    caption?: string,
  ) => {
    const gaugeValue = Math.max(0, Math.min(100, value || 0));
    const dash = (gaugeValue / 100) * 251.2;

    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-xs uppercase tracking-[0.14em] text-slate-500">
          {label}
        </div>
        <div className="relative mx-auto mt-3 h-32 w-44">
          <svg className="h-32 w-44" viewBox="0 0 200 120">
            <path
              d="M20 100 A80 80 0 0 1 180 100"
              stroke="#e5e7eb"
              strokeWidth="16"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M20 100 A80 80 0 0 1 180 100"
              stroke={accentColor}
              strokeWidth="16"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${dash} 251.2`}
            />
          </svg>
          <div className="absolute inset-x-0 bottom-2 flex flex-col items-center justify-center">
            <div className="text-2xl font-bold text-slate-900">
              {formatPercent(gaugeValue)}%
            </div>
            {caption && (
              <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-400">
                {caption}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderAnalyticsRangeInputs = (
    range: AnalyticsDateRange,
    setRange: React.Dispatch<React.SetStateAction<AnalyticsDateRange>>,
  ) => (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label className="text-xs uppercase tracking-[0.14em] text-slate-500">
            De
          </Label>
          <Input
            type="date"
            value={range.startDate}
            onChange={(e) =>
              setRange((prev) =>
                syncCompareRangeFromCurrent({
                  ...prev,
                  startDate: e.target.value,
                }),
              )
            }
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-[0.14em] text-slate-500">
            Até
          </Label>
          <Input
            type="date"
            value={range.endDate}
            onChange={(e) =>
              setRange((prev) =>
                syncCompareRangeFromCurrent({
                  ...prev,
                  endDate: e.target.value,
                }),
              )
            }
            className="mt-1"
          />
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
        O período anterior é calculado automaticamente com a mesma duração:{" "}
        {range.compareStartDate && range.compareEndDate
          ? `${range.compareStartDate} até ${range.compareEndDate}`
          : "aguardando intervalo válido."}
      </div>
    </div>
  );

  const renderAnalyticsRangeInputsV2 = (
    range: AnalyticsDateRange,
    setRange: React.Dispatch<React.SetStateAction<AnalyticsDateRange>>,
  ) => (
    <div className="rounded-[28px] border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/70">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            <Calendar className="h-4 w-4" />
            Calendario do comparativo
          </div>
          <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Escolha o intervalo atual e ajuste o intervalo usado como base de
            comparacao quando fizer sentido.
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setRange((prev) => syncCompareRangeFromCurrent(prev))}
        >
          Recalcular periodo anterior
        </Button>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="rounded-3xl border border-orange-200 bg-white p-4 shadow-sm dark:border-orange-900/50 dark:bg-slate-950">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-600 dark:text-orange-300">
                Periodo atual
              </div>
              <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                {formatDateInputLabel(range.startDate)} a{" "}
                {formatDateInputLabel(range.endDate)}
              </div>
            </div>
            <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 dark:bg-orange-950/40 dark:text-orange-300">
              {getDateRangeDays(range.startDate, range.endDate) || "-"} dia(s)
            </Badge>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs uppercase tracking-[0.14em] text-slate-500">
                Inicio
              </Label>
              <Input
                type="date"
                value={range.startDate}
                onChange={(e) =>
                  setRange((prev) =>
                    syncCompareRangeFromCurrent({
                      ...prev,
                      startDate: e.target.value,
                    }),
                  )
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-[0.14em] text-slate-500">
                Fim
              </Label>
              <Input
                type="date"
                value={range.endDate}
                onChange={(e) =>
                  setRange((prev) =>
                    syncCompareRangeFromCurrent({
                      ...prev,
                      endDate: e.target.value,
                    }),
                  )
                }
                className="mt-1"
              />
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-sky-200 bg-white p-4 shadow-sm dark:border-sky-900/50 dark:bg-slate-950">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600 dark:text-sky-300">
                Periodo comparado
              </div>
              <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                {formatDateInputLabel(range.compareStartDate)} a{" "}
                {formatDateInputLabel(range.compareEndDate)}
              </div>
            </div>
            <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-100 dark:bg-sky-950/40 dark:text-sky-300">
              {getDateRangeDays(range.compareStartDate, range.compareEndDate) ||
                "-"}{" "}
              dia(s)
            </Badge>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs uppercase tracking-[0.14em] text-slate-500">
                Inicio
              </Label>
              <Input
                type="date"
                value={range.compareStartDate}
                onChange={(e) =>
                  setRange((prev) => ({
                    ...prev,
                    compareStartDate: e.target.value,
                  }))
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-[0.14em] text-slate-500">
                Fim
              </Label>
              <Input
                type="date"
                value={range.compareEndDate}
                onChange={(e) =>
                  setRange((prev) => ({
                    ...prev,
                    compareEndDate: e.target.value,
                  }))
                }
                className="mt-1"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAnalyticsComparisonModal = () => {
    if (!analyticsCompareModal) return null;

    const modalConfig =
      analyticsCompareModal === "wallet"
        ? {
            title:
              `Comparativo da média da carteira ${selectedAnalyticsWallet?.label || ""}`.trim(),
            subtitle: "Velocímetro de evolução da média de monitoria",
            accentColor: "#f97316",
            comparison: walletAverageData?.comparativo,
            range: walletAverageDateRange,
            setRange: setWalletAverageDateRange,
            loading: loadingWalletAverage,
            extraLine: walletAverageData?.comparativo
              ? `${walletAverageData.comparativo.current_total_feedbacks ?? 0} feedback(s) agora contra ${walletAverageData.comparativo.previous_total_feedbacks ?? 0} antes. Variação da média: ${formatPercent(Math.abs(walletAverageData.comparativo.delta_percent || 0))}% ${walletAverageData.comparativo.trend === "melhorou" ? "melhor" : walletAverageData.comparativo.trend === "piorou" ? "pior" : "estável"}.`
              : undefined,
          }
        : analyticsCompareModal === "offenders"
          ? {
              title:
                `Comparativo de ofensores da carteira ${selectedAnalyticsWallet?.label || ""}`.trim(),
              subtitle: "Velocímetro da taxa de sucesso do checklist",
              accentColor: "#f43f5e",
              comparison: offenderData?.comparativo,
              range: offendersDateRange,
              setRange: setOffendersDateRange,
              loading: loadingOffenders,
              extraLine: offenderData?.comparativo
                ? `Ocorrências por feedback: ${formatAverage(offenderData.comparativo.current_occurrences_per_feedback ?? 0)} agora, contra ${formatAverage(offenderData.comparativo.previous_occurrences_per_feedback ?? 0)} antes.`
                : undefined,
            }
          : {
              title:
                `Comparativo do operador ${operatorAverageData?.resumo.nome_operador || ""}`.trim(),
              subtitle: "Velocímetro de evolução individual",
              accentColor: "#3b82f6",
              comparison: operatorAverageData?.comparativo,
              range: operatorDateRange,
              setRange: setOperatorDateRange,
              loading: loadingOperatorAverage,
              extraLine: operatorAverageData?.comparativo
                ? `${operatorAverageData.comparativo.current_total_feedbacks ?? 0} feedback(s) agora contra ${operatorAverageData.comparativo.previous_total_feedbacks ?? 0} antes.`
                : undefined,
            };

    const offenderComparisonItems = offenderData?.itens_comparativo || [];
    const focusedOffenderItem =
      selectedOffenderComparisonLabel === "all"
        ? null
        : offenderComparisonItems.find(
            (item) => item.label === selectedOffenderComparisonLabel,
          ) || null;
    const visibleOffenderItems = focusedOffenderItem
      ? [focusedOffenderItem]
      : offenderComparisonLimit === "all"
        ? offenderComparisonItems
        : offenderComparisonItems.slice(Number(offenderComparisonLimit));

    return (
      <div className="fixed inset-0 z-[998] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
        <Card className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-3xl shadow-2xl">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock3 className="h-5 w-5" />
                {modalConfig.title}
              </CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                {modalConfig.subtitle}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setAnalyticsCompareModal(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {renderAnalyticsRangeInputsV2(
              modalConfig.range,
              modalConfig.setRange,
            )}
            {modalConfig.loading ? (
              <div className="flex h-[360px] items-center justify-center text-sm text-slate-500">
                Carregando comparativo...
              </div>
            ) : analyticsCompareModal === "offenders" ? (
              <div className="space-y-6">
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        <Clock3 className="h-4 w-4" />
                        Visão por ofensor
                      </div>
                      <div className="mt-2 text-base font-semibold text-slate-900">
                        Cada card mostra o comportamento de um ofensor no
                        período atual versus o anterior, com leitura direta de
                        evolução ou deterioração.
                      </div>
                      {offenderData?.comparativo && (
                        <div className="mt-2 text-sm text-slate-500">
                          Atual: {offenderData.comparativo.current_label} •
                          Anterior: {offenderData.comparativo.previous_label}
                        </div>
                      )}
                      {offenderData?.comparativo && (
                        <div className="mt-3 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                          <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-600">
                              Periodo atual
                            </div>
                            <div className="mt-1 font-semibold text-slate-900">
                              {offenderData.comparativo.current_label}
                            </div>
                            <div className="mt-1 text-slate-500">
                              {offenderData.comparativo.current_total_feedbacks ??
                                0}{" "}
                              monitoria(s)
                            </div>
                          </div>
                          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-600">
                              Periodo comparado
                            </div>
                            <div className="mt-1 font-semibold text-slate-900">
                              {offenderData.comparativo.previous_label}
                            </div>
                            <div className="mt-1 text-slate-500">
                              {offenderData.comparativo.previous_total_feedbacks ??
                                0}{" "}
                              monitoria(s)
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      {offenderComparisonItems.length} ofensor(es)
                      analisado(s)
                    </div>
                  </div>
                </div>

                {!!offenderComparisonItems.length && (
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
                      <div>
                        <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Focar em um item
                        </Label>
                        <select
                          value={selectedOffenderComparisonLabel}
                          onChange={(event) =>
                            setSelectedOffenderComparisonLabel(
                              event.target.value,
                            )
                          }
                          className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          <option value="all">
                            Todos os itens principais
                          </option>
                          {offenderComparisonItems.map((item) => (
                            <option
                              key={`offender-option-${item.label}`}
                              value={item.label}
                            >
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Quantidade visivel
                        </Label>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {(
                            [
                              ["1", "1 item"],
                              ["2", "2 itens"],
                              ["all", "Todos"],
                            ] as [OffenderComparisonLimit, string][]
                          ).map(([value, label]) => (
                            <Button
                              key={`offender-limit-${value}`}
                              type="button"
                              variant={
                                offenderComparisonLimit === value
                                  ? "default"
                                  : "outline"
                              }
                              className={
                                offenderComparisonLimit === value
                                  ? "bg-slate-900 hover:bg-slate-800"
                                  : ""
                              }
                              disabled={
                                selectedOffenderComparisonLabel !== "all"
                              }
                              onClick={() => setOffenderComparisonLimit(value)}
                            >
                              {label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                      Exibindo {visibleOffenderItems.length} de{" "}
                      {offenderComparisonItems.length} item(ns). Use o filtro
                      para investigar um ofensor especifico sem poluir a tela.
                    </div>
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-3">
                  {renderExecutiveHighlight(
                    "Melhoraram",
                    `${offenderExecutiveSummary.improvedCount}`,
                    "ofensores caíram em relação ao período anterior",
                    "positive",
                  )}
                  {renderExecutiveHighlight(
                    "Pioraram",
                    `${offenderExecutiveSummary.worsenedCount}`,
                    "ofensores cresceram no comparativo",
                    "negative",
                  )}
                  {renderExecutiveHighlight(
                    "Maior pressão atual",
                    offenderExecutiveSummary.highestCurrent
                      ? `${formatPercent(
                          offenderExecutiveSummary.highestCurrent
                            .current_percentual,
                        )}%`
                      : "-",
                    offenderExecutiveSummary.highestCurrent?.label ||
                      "Sem ofensor dominante",
                    "warning",
                  )}
                </div>

                {!!visibleOffenderItems.length ? (
                  <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                    {visibleOffenderItems.map((item) => {
                      const hasPreviousBase =
                        item.previous_total > 0 || item.previous_percentual > 0;
                      const trendPresentation = getTrendPresentation(item.trend);
                      const TrendIcon = trendPresentation.icon;
                      const labelParts = splitOffenderLabel(item.label);

                      const gaugeValue = Math.max(
                        0,
                        Math.min(100, item.current_percentual || 0),
                      );
                      const gaugeDegrees = (gaugeValue / 100) * 180;

                      return (
                        <div
                          key={`offender-item-card-${item.label}`}
                          className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-950"
                        >
                          <div className="flex flex-col gap-4">
                            <div
                              className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${trendPresentation.toneClass}`}
                            >
                              <TrendIcon className="h-4 w-4" />
                              {hasPreviousBase
                                ? trendPresentation.label
                                : "Sem base anterior"}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                                {labelParts.group}
                              </div>
                              <h4 className="mt-1 text-base font-semibold leading-snug text-slate-900 dark:text-slate-100 sm:text-lg">
                                {labelParts.item}
                              </h4>
                              {labelParts.item !== item.label && (
                                <p className="mt-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                                  Nome completo: {item.label}
                                </p>
                              )}
                              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                Participação desse ofensor no total de
                                feedbacks da carteira.
                              </p>
                            </div>
                          </div>

                          <div className="mt-5 flex flex-col gap-5">
                            <div className="relative mx-auto h-36 w-full max-w-[220px]">
                              <svg
                                className="h-36 w-full"
                                viewBox="0 0 200 120"
                              >
                                <path
                                  d="M20 100 A80 80 0 0 1 180 100"
                                  stroke="#e5e7eb"
                                  strokeWidth="16"
                                  fill="none"
                                  strokeLinecap="round"
                                />
                                <path
                                  d="M20 100 A80 80 0 0 1 180 100"
                                  stroke={
                                    item.trend === "melhorou"
                                      ? "#10b981"
                                      : item.trend === "piorou"
                                        ? "#f43f5e"
                                        : "#64748b"
                                  }
                                  strokeWidth="16"
                                  fill="none"
                                  strokeLinecap="round"
                                  strokeDasharray={`${(gaugeDegrees / 180) * 251.2} 251.2`}
                                />
                              </svg>
                              <div className="absolute inset-x-0 bottom-3 flex flex-col items-center justify-center">
                                <div className="text-3xl font-bold text-slate-900">
                                  {formatPercent(gaugeValue)}%
                                </div>
                                <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-400">
                                  período atual
                                </div>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                                  <div className="text-xs uppercase tracking-[0.14em] text-slate-500">
                                    Atual
                                  </div>
                                  <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                                    {formatPercent(item.current_percentual)}%
                                  </div>
                                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                    {item.current_total} ocorrência(s)
                                  </div>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                                  <div className="text-xs uppercase tracking-[0.14em] text-slate-500">
                                    Anterior
                                  </div>
                                  <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                                    {hasPreviousBase
                                      ? `${formatPercent(item.previous_percentual)}%`
                                      : "-"}
                                  </div>
                                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                    {hasPreviousBase
                                      ? `${item.previous_total} ocorrência(s)`
                                      : "Sem dados no período"}
                                  </div>
                                </div>
                              </div>

                              <div className={`text-sm font-medium ${trendPresentation.textClass}`}>
                                {hasPreviousBase
                                  ? item.trend === "melhorou"
                                    ? `Melhorou ${formatPercent(Math.abs(item.delta_percentual))} ponto(s) percentuais em relação ao período anterior.`
                                    : item.trend === "piorou"
                                      ? `Piorou ${formatPercent(Math.abs(item.delta_percentual))} ponto(s) percentuais em relação ao período anterior.`
                                      : "Permaneceu estável em relação ao período anterior."
                                  : "Sem base comparativa anterior. Exibindo somente o percentual atual."}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-3xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                    Nenhum ofensor encontrado para o período selecionado.
                  </div>
                )}
              </div>
            ) : (
              renderComparisonGauge(
                modalConfig.comparison,
                modalConfig.accentColor,
                modalConfig.subtitle,
                modalConfig.extraLine,
              )
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderTrendChart = (
    data: WalletAveragePoint[],
    chartType: AnalyticsChartType,
    dataKey: "media" | "total_feedbacks",
    color: string,
  ) => {
    if (chartType === "pizza") {
      return (
        <ResponsiveContainer width="100%" height={380}>
          <PieChart>
            <Pie
              data={data}
              dataKey={dataKey}
              nameKey="label"
              cx="50%"
              cy="50%"
              outerRadius={110}
              label
            >
              {data.map((entry, index) => (
                <Cell
                  key={`${entry.key}-${index}`}
                  fill={chartColors[index % chartColors.length]}
                />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === "coluna") {
      return (
        <ResponsiveContainer width="100%" height={380}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip />
            <Bar dataKey={dataKey} fill={color} radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === "area") {
      return (
        <ResponsiveContainer width="100%" height={380}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              fill={color}
              fillOpacity={0.18}
            />
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={380}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" />
          <YAxis />
          <Tooltip />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={3}
            dot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  const renderOffenderChart = (
    data: OffenderPoint[],
    chartType: AnalyticsChartType,
  ) => {
    const formatted = data.map((item, index) => ({
      ...item,
      shortLabel:
        item.label.length > 28 ? `${item.label.slice(0, 28)}...` : item.label,
      fill: chartColors[index % chartColors.length],
    }));
    const tooltipFormatter = (value: number, _name: string, payload: any) => {
      const percentual = payload?.payload?.percentual ?? 0;
      return [
        `${value} ocorrências • ${formatPercent(percentual)}%`,
        "Ofensor",
      ];
    };

    if (chartType === "pizza") {
      return (
        <ResponsiveContainer width="100%" height={380}>
          <PieChart>
            <Pie
              data={formatted}
              dataKey="total"
              nameKey="label"
              cx="50%"
              cy="50%"
              outerRadius={110}
              label={({ percent }) => `${formatPercent((percent || 0) * 100)}%`}
            >
              {formatted.map((entry, index) => (
                <Cell key={`${entry.label}-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip formatter={tooltipFormatter} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === "linha") {
      return (
        <ResponsiveContainer width="100%" height={380}>
          <LineChart data={formatted}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="shortLabel" />
            <YAxis />
            <Tooltip formatter={tooltipFormatter} />
            <Line
              type="monotone"
              dataKey="total"
              stroke="#f43f5e"
              strokeWidth={3}
            />
          </LineChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === "area") {
      return (
        <ResponsiveContainer width="100%" height={380}>
          <AreaChart data={formatted}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="shortLabel" />
            <YAxis />
            <Tooltip formatter={tooltipFormatter} />
            <Area
              type="monotone"
              dataKey="total"
              stroke="#f43f5e"
              fill="#f43f5e"
              fillOpacity={0.18}
            />
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={380}>
        <BarChart data={formatted}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="shortLabel" />
          <YAxis />
          <Tooltip formatter={tooltipFormatter} />
          <Bar dataKey="total" radius={[8, 8, 0, 0]}>
            {formatted.map((entry, index) => (
              <Cell key={`${entry.label}-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const exportOperatorAnalytics = () => {
    if (!selectedAnalyticsOperatorCpf || !operatorAverageData) {
      toast({
        title: "Sem dados para exportar",
        description: "Selecione um operador com dados de monitoria.",
        variant: "destructive",
      });
      return;
    }

    const selectedOperatorAnalytics = analyticsOperators.find(
      (operator) => operator.cpf === selectedAnalyticsOperatorCpf,
    );

    exportToXLSX(
      operatorAverageData.series.map((item) => ({
        Período: item.label,
        "Média da monitoria": item.media,
        "Total de feedbacks": item.total_feedbacks,
      })),
      `media-monitoria-${selectedOperatorAnalytics?.nome || "operador"}`,
      "Média monitoria operador",
    );
  };

  const exportWalletAverageAnalytics = () => {
    if (!selectedAnalyticsWallet || !walletAverageData?.series?.length) {
      toast({
        title: "Sem dados para exportar",
        description: "Não há média da carteira disponível no momento.",
        variant: "destructive",
      });
      return;
    }

    exportToXLSX(
      walletAverageData.series.map((item) => ({
        Período: item.label,
        "Média da carteira": item.media,
        "Total de feedbacks": item.total_feedbacks,
      })),
      `media-carteira-${selectedAnalyticsWallet.label}`,
      {
        Período: "Período",
        "Média da carteira": "Média da carteira",
        "Total de feedbacks": "Total de feedbacks",
      },
    );
  };

  const exportWalletOffendersAnalytics = () => {
    if (!selectedAnalyticsWallet || !offenderData?.series?.length) {
      toast({
        title: "Sem dados para exportar",
        description: "Não há ofensores consolidados para exportação.",
        variant: "destructive",
      });
      return;
    }

    const comparison = offenderData.comparativo;
    const selectedChannelLabel =
      analyticsChannelId === "all"
        ? "Todos os canais"
        : selectedAnalyticsWallet.channels.find(
            (channel) => channel.id === analyticsChannelId,
          )?.label || "Canal selecionado";
    const currentPeriodLabel = comparison?.current_label
      ? comparison.current_label
      : `${formatDateInputLabel(offendersDateRange.startDate)} a ${formatDateInputLabel(
          offendersDateRange.endDate,
        )}`;
    const previousPeriodLabel = comparison?.previous_label
      ? comparison.previous_label
      : `${formatDateInputLabel(
          offendersDateRange.compareStartDate,
        )} a ${formatDateInputLabel(offendersDateRange.compareEndDate)}`;
    const trendLabel = (trend?: "melhorou" | "piorou" | "estavel") => {
      if (trend === "melhorou") return "Melhorou";
      if (trend === "piorou") return "Piorou";
      return "Estavel";
    };
    const baseBorder = {
      top: { style: "thin", color: { rgb: "D7DEE7" } },
      bottom: { style: "thin", color: { rgb: "D7DEE7" } },
      left: { style: "thin", color: { rgb: "D7DEE7" } },
      right: { style: "thin", color: { rgb: "D7DEE7" } },
    };
    const solidFill = (rgb: string) => ({
      patternType: "solid",
      fgColor: { rgb },
    });
    const rows: Array<Array<string | number>> = [];
    const merges: Array<{
      s: { r: number; c: number };
      e: { r: number; c: number };
    }> = [];
    const cellStyles: Array<{
      fromRow: number;
      fromCol: number;
      toRow?: number;
      toCol?: number;
      style: Record<string, any>;
    }> = [];
    const lastColumnIndex = 8;
    const addSection = (title: string) => {
      const rowIndex = rows.length;
      rows.push([title, "", "", "", "", "", "", "", ""]);
      merges.push({
        s: { r: rowIndex, c: 0 },
        e: { r: rowIndex, c: lastColumnIndex },
      });
      cellStyles.push({
        fromRow: rowIndex,
        fromCol: 0,
        toCol: lastColumnIndex,
        style: {
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: solidFill("334155"),
          alignment: { horizontal: "left", vertical: "center" },
          border: baseBorder,
        },
      });
    };
    const addHeaderStyle = (rowIndex: number, fill = "0F172A") => {
      cellStyles.push({
        fromRow: rowIndex,
        fromCol: 0,
        toCol: lastColumnIndex,
        style: {
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: solidFill(fill),
          alignment: {
            horizontal: "center",
            vertical: "center",
            wrapText: true,
          },
          border: baseBorder,
        },
      });
    };

    rows.push([
      `Relatorio de ofensores - ${selectedAnalyticsWallet.label}`,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ]);
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: lastColumnIndex } });
    rows.push([
      `Canal: ${selectedChannelLabel} | Base de data: DATA_REGISTRO | Gerado em ${new Date().toLocaleString("pt-BR")}`,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ]);
    merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: lastColumnIndex } });
    rows.push([]);
    cellStyles.push(
      {
        fromRow: 0,
        fromCol: 0,
        toCol: lastColumnIndex,
        style: {
          font: { bold: true, sz: 16, color: { rgb: "FFFFFF" } },
          fill: solidFill("0F172A"),
          alignment: { horizontal: "center", vertical: "center" },
        },
      },
      {
        fromRow: 1,
        fromCol: 0,
        toCol: lastColumnIndex,
        style: {
          font: { italic: true, color: { rgb: "0F172A" } },
          fill: solidFill("DBEAFE"),
          alignment: { horizontal: "center", vertical: "center" },
        },
      },
    );

    addSection("Resumo executivo");
    const summaryHeaderRow = rows.length;
    rows.push([
      "Indicador",
      "Periodo atual",
      "Periodo comparado",
      "Variacao",
      "Tendencia",
      "Carteira",
      "Canal",
      "Base",
      "Observacao",
    ]);
    addHeaderStyle(summaryHeaderRow, "1E3A8A");
    rows.push([
      "Taxa de sucesso do checklist",
      `${formatPercent(comparison?.current_value ?? offenderData.resumo.taxa_sucesso ?? 0)}%`,
      comparison ? `${formatPercent(comparison.previous_value)}%` : "-",
      comparison ? `${formatPercent(Math.abs(comparison.delta_value))} p.p.` : "-",
      trendLabel(comparison?.trend),
      selectedAnalyticsWallet.label,
      selectedChannelLabel,
      "DATA_REGISTRO",
      comparison
        ? `${comparison.current_total_feedbacks ?? 0} monitoria(s) no periodo atual contra ${comparison.previous_total_feedbacks ?? 0} no periodo comparado.`
        : "Sem comparativo carregado.",
    ]);
    rows.push([
      "Ocorrencias por feedback",
      formatAverage(
        comparison?.current_occurrences_per_feedback ??
          offenderData.resumo.ocorrencias_por_feedback ??
          0,
      ),
      comparison
        ? formatAverage(comparison.previous_occurrences_per_feedback ?? 0)
        : "-",
      "-",
      "-",
      selectedAnalyticsWallet.label,
      selectedChannelLabel,
      "DATA_REGISTRO",
      `Total de ocorrencias atuais: ${offenderData.resumo.total_ocorrencias ?? 0}`,
    ]);
    rows.push([
      "Feedbacks analisados",
      comparison?.current_total_feedbacks ??
        offenderData.resumo.total_feedbacks ??
        0,
      comparison?.previous_total_feedbacks ?? "-",
      "-",
      "-",
      selectedAnalyticsWallet.label,
      selectedChannelLabel,
      "DATA_REGISTRO",
      `Atual: ${currentPeriodLabel} | Comparado: ${previousPeriodLabel}`,
    ]);
    rows.push([]);

    addSection("Ranking de ofensores no periodo atual");
    const rankingHeaderRow = rows.length;
    rows.push([
      "Posicao",
      "Grupo",
      "Item do checklist",
      "Ofensor completo",
      "Ocorrencias",
      "% na carteira",
      "Feedbacks analisados",
      "Periodo atual",
      "Leitura",
    ]);
    addHeaderStyle(rankingHeaderRow, "9F1239");
    offenderData.series.forEach((item, index) => {
      const labelParts = splitOffenderLabel(item.label);
      rows.push([
        index + 1,
        labelParts.group,
        labelParts.item,
        item.label,
        item.total,
        `${formatPercent(item.percentual)}%`,
        offenderData.resumo.total_feedbacks ?? 0,
        currentPeriodLabel,
        item.percentual >= 25
          ? "Alta concentracao"
          : item.percentual >= 10
            ? "Acompanhar"
            : "Pontual",
      ]);
    });
    rows.push([]);

    if (offenderData.itens_comparativo?.length) {
      addSection("Comparativo por item do checklist");
      const itemComparisonHeaderRow = rows.length;
      rows.push([
        "Grupo",
        "Item do checklist",
        "Ofensor completo",
        "Ocorrencias atual",
        "% atual",
        "Ocorrencias comparado",
        "% comparado",
        "Variacao p.p.",
        "Tendencia",
      ]);
      addHeaderStyle(itemComparisonHeaderRow, "7F1D1D");
      offenderData.itens_comparativo.forEach((item) => {
        const labelParts = splitOffenderLabel(item.label);
        rows.push([
          labelParts.group,
          labelParts.item,
          item.label,
          item.current_total,
          `${formatPercent(item.current_percentual)}%`,
          item.previous_total,
          `${formatPercent(item.previous_percentual)}%`,
          `${formatPercent(item.delta_percentual)} p.p.`,
          trendLabel(item.trend),
        ]);
      });
      rows.push([]);
    }

    if (offenderData.grupos_comparativo?.length) {
      addSection("Comparativo por grupo do checklist");
      const groupComparisonHeaderRow = rows.length;
      rows.push([
        "Grupo",
        "Descricao",
        "Base",
        "Ocorrencias atual",
        "% atual",
        "Ocorrencias comparado",
        "% comparado",
        "Variacao p.p.",
        "Tendencia",
      ]);
      addHeaderStyle(groupComparisonHeaderRow, "0F766E");
      offenderData.grupos_comparativo.forEach((item) => {
        rows.push([
          item.label,
          "Grupo consolidado do checklist",
          "Not done + NCG",
          item.current_total,
          `${formatPercent(item.current_percentual)}%`,
          item.previous_total,
          `${formatPercent(item.previous_percentual)}%`,
          `${formatPercent(item.delta_percentual)} p.p.`,
          trendLabel(item.trend),
        ]);
      });
    }

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      if (!rows[rowIndex]?.length) continue;
      if (
        cellStyles.some(
          (style) =>
            rowIndex >= style.fromRow &&
            rowIndex <= (style.toRow ?? style.fromRow),
        )
      ) {
        continue;
      }

      cellStyles.push({
        fromRow: rowIndex,
        fromCol: 0,
        toCol: lastColumnIndex,
        style: {
          alignment: { vertical: "center", wrapText: true },
          border: baseBorder,
        },
      });
    }

    exportMatrixToXLSX(
      rows,
      `ofensores-carteira-${selectedAnalyticsWallet.label}`,
      {
        sheetName: "Ofensores",
        columnWidths: [12, 24, 34, 42, 18, 16, 20, 26, 34],
        merges,
        rowHeights: rows.map((row, index) =>
          index === 0 ? 26 : row.length ? 22 : 8,
        ),
        cellStyles,
        autoFilter: {
          fromRow: rankingHeaderRow,
          fromCol: 0,
          toRow: Math.max(rankingHeaderRow, rows.length - 1),
          toCol: lastColumnIndex,
        },
      },
    );
    toast({
      title: "Excel gerado",
      description: `Relatorio de ofensores da carteira ${selectedAnalyticsWallet.label} exportado com resumo, ranking e comparativos.`,
    });
    return;

    exportToXLSX(
      offenderData.series.map((item) => ({
        Ofensor: item.label,
        Ocorrências: item.total,
        "Percentual na carteira": `${formatPercent(item.percentual)}%`,
      })),
      `ofensores-carteira-${selectedAnalyticsWallet.label}`,
      {
        Ofensor: "Ofensor",
        Ocorrências: "Ocorrências",
        "Percentual na carteira": "Percentual na carteira",
      },
    );
  };

  const exportSelectedMonitorFeedbacks = async () => {
    if (
      !selectedMonitorName ||
      !selectedMonitorFilteredFeedbacks.length ||
      !token
    ) {
      toast({
        title: "Sem dados para exportar",
        description: "Não há monitorias no filtro atual dessa monitora.",
        variant: "destructive",
      });
      return;
    }

    setExportingMonitorFeedbacks(true);
    try {
      const details = (
        await Promise.all(
          selectedMonitorFilteredFeedbacks.map(async (feedback) => {
            const response = await axios.get(
              `/api/qualidade/feedbacks/detalhe/${feedback.id}`,
              {
                params: { monitor_nome: selectedMonitorName },
                headers: { Authorization: `Bearer ${token}` },
              },
            );

            return response.data as ReverseFeedbackDetail & {
              checklist_json?: string;
            };
          }),
        )
      ).filter((item) => item?.checklist_json);

      if (!details.length) {
        toast({
          title: "Sem checklist para exportar",
          description:
            "As monitorias dessa monitora não possuem checklist estruturado salvo.",
          variant: "destructive",
        });
        return;
      }

      const checklistOrder: Array<{
        key: string;
        checklistId: string;
        blockTitle: string;
        itemTitle: string;
        groupHeader: string;
        weight: number;
        severe: boolean;
      }> = [];
      const checklistMap = new Map<
        string,
        {
          checklistId: string;
          blockTitle: string;
          itemTitle: string;
          groupHeader: string;
          weight: number;
          severe: boolean;
        }
      >();
      const detailEntries = details.map((detail) => {
        const storedChecklist = parseStoredChecklistPayload(detail.checklist_json);
        const checklistDefinition = storedChecklist?.checklistId
          ? findChecklistDefinition(storedChecklist.checklistId)
          : null;

        if (checklistDefinition) {
          checklistDefinition.blocks.forEach((block) => {
            block.items.forEach((item) => {
              const key = `${checklistDefinition.id}::${getChecklistEntryKey(
                block.title,
                item.title,
              )}`;
              if (!checklistMap.has(key)) {
                const column = {
                  key,
                  checklistId: checklistDefinition.id,
                  blockTitle: block.title,
                  itemTitle: item.title,
                  groupHeader: `${checklistDefinition.channelLabel} • ${block.title}`,
                  weight: item.weight,
                  severe: Boolean(item.severe),
                };
                checklistMap.set(key, column);
                checklistOrder.push(column);
              }
            });
          });
        }

        return {
          detail,
          storedChecklist,
        };
      });

      if (!checklistOrder.length) {
        toast({
          title: "Checklist não identificado",
          description:
            "Não foi possível montar as colunas do checklist para essa exportação.",
          variant: "destructive",
        });
        return;
      }

      const rows: Array<Array<string | number>> = [];
      const title = `Monitorias de ${selectedMonitorName}`;
      const orderedFeedbackDates = selectedMonitorFilteredFeedbacks
        .map((feedback) => feedback.data_hora)
        .filter(Boolean)
        .sort(
          (left, right) =>
            new Date(left).getTime() - new Date(right).getTime(),
        );
      const periodLabel = orderedFeedbackDates.length
        ? `${formatDate(orderedFeedbackDates[0])} até ${formatDate(
            orderedFeedbackDates[orderedFeedbackDates.length - 1],
          )}`
        : "-";
      const fixedColumns = [
        "Operador",
        "Data",
        "Carteira",
        "Canal",
        "EC",
        "Call ID",
      ];
      const totalColumnIndex = fixedColumns.length + checklistOrder.length;
      const lastColumnIndex = totalColumnIndex;
      const merges: Array<{
        s: { r: number; c: number };
        e: { r: number; c: number };
      }> = [
        {
          s: { r: 0, c: 0 },
          e: { r: 0, c: lastColumnIndex },
        },
        {
          s: { r: 1, c: 0 },
          e: { r: 1, c: lastColumnIndex },
        },
        {
          s: { r: 2, c: 0 },
          e: { r: 2, c: fixedColumns.length - 1 },
        },
      ];

      rows.push([title]);
      rows.push([
        `Exportado em ${new Date().toLocaleString("pt-BR")} • Total de monitorias: ${details.length} • Período carregado: ${periodLabel}`,
      ]);
      rows.push([
        "Dados da monitoria",
        ...fixedColumns.slice(1).map(() => ""),
        ...checklistOrder.map((column) => column.groupHeader),
        "Resultado",
      ]);
      rows.push([
        ...fixedColumns,
        ...checklistOrder.map((column) => column.itemTitle),
        "Nota final",
      ]);
      rows.push([
        ...fixedColumns.map(() => ""),
        ...checklistOrder.map((column) =>
          column.severe ? `${column.weight} pts NCG` : `${column.weight} pts`,
        ),
        "Soma",
      ]);

      let currentGroupStart = fixedColumns.length;
      checklistOrder.forEach((column, index) => {
        const absoluteIndex = fixedColumns.length + index;
        const nextColumn = checklistOrder[index + 1];
        const sameGroup = nextColumn?.groupHeader === column.groupHeader;

        if (!sameGroup) {
          if (currentGroupStart !== absoluteIndex) {
            merges.push({
              s: { r: 2, c: currentGroupStart },
              e: { r: 2, c: absoluteIndex },
            });
          }
          currentGroupStart = absoluteIndex + 1;
        }
      });

      detailEntries.forEach(({ detail, storedChecklist }) => {
        const doneSet = new Set(
          (storedChecklist?.done || []).map((entry) =>
            `${storedChecklist?.checklistId || ""}::${getChecklistEntryKey(
              entry.blockTitle,
              entry.itemTitle,
            )}`,
          ),
        );
        const ncgSet = new Set(
          (storedChecklist?.ncg || []).map((entry) =>
            `${storedChecklist?.checklistId || ""}::${getChecklistEntryKey(
              entry.blockTitle,
              entry.itemTitle,
            )}`,
          ),
        );

        const itemScores = checklistOrder.map((column) => {
          if (doneSet.has(column.key) || ncgSet.has(column.key)) {
            return column.weight;
          }
          return 0;
        });

        const totalScore =
          itemScores.reduce(
            (total, value) => total + (typeof value === "number" ? value : 0),
            0,
          );

        rows.push([
          detail.operador || "-",
          formatDate(detail.data_hora),
          detail.carteira_label ||
            storedChecklist?.walletLabel ||
            storedChecklist?.walletId ||
            "-",
          detail.canal_label || "-",
          detail.id_ligacao || "-",
          detail.call_id || "-",
          ...itemScores,
          totalScore,
        ]);
      });

      const columnWidths = [
        28,
        22,
        20,
        16,
        18,
        18,
        ...checklistOrder.map((column) =>
          Math.min(
            28,
            Math.max(column.itemTitle.length + 3, column.groupHeader.length / 2),
          ),
        ),
        14,
      ];

      const baseBorder = {
        top: { style: "thin", color: { rgb: "D7DEE7" } },
        bottom: { style: "thin", color: { rgb: "D7DEE7" } },
        left: { style: "thin", color: { rgb: "D7DEE7" } },
        right: { style: "thin", color: { rgb: "D7DEE7" } },
      };
      const solidFill = (rgb: string) => ({
        patternType: "solid",
        fgColor: { rgb },
      });
      const cellStyles: Array<{
        fromRow: number;
        fromCol: number;
        toRow?: number;
        toCol?: number;
        style: Record<string, any>;
      }> = [
        {
          fromRow: 0,
          fromCol: 0,
          toCol: lastColumnIndex,
          style: {
            font: { bold: true, sz: 15, color: { rgb: "FFFFFF" } },
            fill: solidFill("0F172A"),
            alignment: { horizontal: "center", vertical: "center" },
          },
        },
        {
          fromRow: 1,
          fromCol: 0,
          toCol: lastColumnIndex,
          style: {
            font: { italic: true, color: { rgb: "0F172A" } },
            fill: solidFill("DBEAFE"),
            alignment: { horizontal: "center", vertical: "center" },
          },
        },
        {
          fromRow: 2,
          fromCol: 0,
          toCol: fixedColumns.length - 1,
          style: {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: solidFill("1E3A8A"),
            alignment: { horizontal: "center", vertical: "center" },
            border: baseBorder,
          },
        },
        {
          fromRow: 2,
          fromCol: fixedColumns.length,
          toCol: lastColumnIndex - 1,
          style: {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: solidFill("0F766E"),
            alignment: { horizontal: "center", vertical: "center", wrapText: true },
            border: baseBorder,
          },
        },
        {
          fromRow: 2,
          fromCol: lastColumnIndex,
          style: {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: solidFill("9A3412"),
            alignment: { horizontal: "center", vertical: "center" },
            border: baseBorder,
          },
        },
        {
          fromRow: 3,
          fromCol: 0,
          toCol: fixedColumns.length - 1,
          style: {
            font: { bold: true, color: { rgb: "0F172A" } },
            fill: solidFill("E2E8F0"),
            alignment: { horizontal: "center", vertical: "center" },
            border: baseBorder,
          },
        },
        {
          fromRow: 3,
          fromCol: fixedColumns.length,
          toCol: lastColumnIndex - 1,
          style: {
            font: { bold: true, color: { rgb: "0F172A" } },
            fill: solidFill("CCFBF1"),
            alignment: { horizontal: "center", vertical: "center", wrapText: true },
            border: baseBorder,
          },
        },
        {
          fromRow: 3,
          fromCol: lastColumnIndex,
          style: {
            font: { bold: true, color: { rgb: "7C2D12" } },
            fill: solidFill("FED7AA"),
            alignment: { horizontal: "center", vertical: "center" },
            border: baseBorder,
          },
        },
        {
          fromRow: 4,
          fromCol: 0,
          toCol: lastColumnIndex,
          style: {
            font: { italic: true, sz: 10, color: { rgb: "475569" } },
            fill: solidFill("F8FAFC"),
            alignment: { horizontal: "center", vertical: "center", wrapText: true },
            border: baseBorder,
          },
        },
      ];

      for (let rowIndex = 5; rowIndex < rows.length; rowIndex += 1) {
        cellStyles.push(
          {
            fromRow: rowIndex,
            fromCol: 0,
            style: {
              font: { bold: true, color: { rgb: "0F172A" } },
              fill: solidFill("E0F2FE"),
              alignment: { horizontal: "center", vertical: "center" },
              border: baseBorder,
            },
          },
          {
            fromRow: rowIndex,
            fromCol: 1,
            toCol: fixedColumns.length - 1,
            style: {
              fill: solidFill(rowIndex % 2 === 0 ? "FFFFFF" : "F8FAFC"),
              alignment: { horizontal: "center", vertical: "center" },
              border: baseBorder,
            },
          },
          {
            fromRow: rowIndex,
            fromCol: lastColumnIndex,
            style: {
              font: { bold: true, color: { rgb: "7C2D12" } },
              fill: solidFill("FFEDD5"),
              alignment: { horizontal: "center", vertical: "center" },
              border: baseBorder,
            },
          },
        );

        checklistOrder.forEach((column, index) => {
          const colIndex = fixedColumns.length + index;
          const cellValue = rows[rowIndex]?.[colIndex];
          const isScored =
            typeof cellValue === "number" && Number(cellValue) !== 0;

          cellStyles.push({
            fromRow: rowIndex,
            fromCol: colIndex,
            style: {
              font: {
                bold: isScored,
                color: { rgb: isScored ? "166534" : "7F1D1D" },
              },
              fill: solidFill(
                isScored
                  ? column.severe
                    ? "FECACA"
                    : "DCFCE7"
                  : "FEF2F2",
              ),
              alignment: { horizontal: "center", vertical: "center" },
              border: baseBorder,
            },
          });
        });
      }

      exportMatrixToXLSX(rows, `monitorias-${selectedMonitorName}`, {
        sheetName: "Monitorias",
        columnWidths,
        merges,
        rowHeights: [24, 22, 24, 22, 22],
        cellStyles,
        autoFilter: {
          fromRow: 3,
          fromCol: 0,
          toRow: rows.length - 1,
          toCol: lastColumnIndex,
        },
      });
      toast({
        title: "Excel gerado",
        description: `${details.length} monitoria(s) exportada(s) da monitora ${selectedMonitorName} conforme os filtros atuais.`,
      });
    } catch (error) {
      console.error("Erro ao exportar monitorias da monitora:", error);
      toast({
        title: "Erro ao exportar",
        description: "Não foi possível gerar o Excel dessa monitora.",
        variant: "destructive",
      });
    } finally {
      setExportingMonitorFeedbacks(false);
    }
  };

  const checklistPreviewGroups = useMemo(() => {
    if (!selectedChecklist) {
      return { done: [], notDone: [], notApplicable: [], ncg: [] } as {
        done: Array<{ blockTitle: string; itemTitle: string }>;
        notDone: Array<{ blockTitle: string; itemTitle: string }>;
        notApplicable: Array<{ blockTitle: string; itemTitle: string }>;
        ncg: Array<{ blockTitle: string; itemTitle: string }>;
      };
    }

    const done: Array<{ blockTitle: string; itemTitle: string }> = [];
    const notDone: Array<{ blockTitle: string; itemTitle: string }> = [];
    const notApplicable: Array<{ blockTitle: string; itemTitle: string }> = [];
    const ncg: Array<{ blockTitle: string; itemTitle: string }> = [];

    selectedChecklist.blocks.forEach((block) => {
      block.items.forEach((item) => {
        if (item.severe) {
          if (severeAnswers[item.id]) {
            ncg.push({ blockTitle: block.title, itemTitle: item.title });
          }
          return;
        }

        if (checklistAnswers[item.id] === "yes") {
          done.push({ blockTitle: block.title, itemTitle: item.title });
        } else if (checklistAnswers[item.id] === "no") {
          notDone.push({ blockTitle: block.title, itemTitle: item.title });
        } else if (checklistAnswers[item.id] === "na") {
          notApplicable.push({ blockTitle: block.title, itemTitle: item.title });
        }
      });
    });

    return { done, notDone, notApplicable, ncg };
  }, [selectedChecklist, checklistAnswers, severeAnswers]);

  const checklistAnalyticsPayload = useMemo(
    () => ({
      checklistId: selectedChecklist?.id || "",
      walletId: selectedWallet?.id || "",
      walletLabel: selectedWallet?.label || "",
      channelId: selectedChecklist?.channelId || "",
      channelLabel: selectedChecklist?.channelLabel || "",
      tempoLigacaoTotal: callInfo.tempo_ligacao_total || "",
      metrics: checklistMetrics,
      done: checklistPreviewGroups.done,
      notDone: checklistPreviewGroups.notDone,
      notApplicable: checklistPreviewGroups.notApplicable,
      ncg: checklistPreviewGroups.ncg,
      generatedAt: callInfo.data_hora,
    }),
    [
      selectedChecklist,
      selectedWallet,
      callInfo.tempo_ligacao_total,
      checklistMetrics,
      checklistPreviewGroups,
      callInfo.data_hora,
    ],
  );

  const checklistItemsPayload = useMemo(() => {
    if (!selectedChecklist || !selectedWallet) {
      return [];
    }

    return selectedChecklist.blocks.flatMap((block, blockIndex) =>
      block.items.map((item, itemIndex) => {
        const isSevere = !!item.severe;
        const checked = isSevere ? !!severeAnswers[item.id] : false;
        const answer = isSevere ? undefined : checklistAnswers[item.id];
        const status = isSevere
          ? checked
            ? "NCG"
            : "NAO_APLICADO"
          : answer === "yes"
            ? "OK"
            : answer === "na"
              ? "NAO_APLICADO"
              : "NOK";

        return {
          checklist_id: selectedChecklist.id,
          carteira_id: selectedWallet.id,
          carteira_label: selectedWallet.label,
          canal_id: selectedChecklist.channelId,
          canal_label: selectedChecklist.channelLabel,
          bloco_id: block.id,
          bloco_titulo: block.title,
          item_id: item.id,
          item_titulo: item.title,
          item_descricao: item.description,
          peso: item.weight,
          tipo_item: isSevere ? "NCG" : "CHECKLIST",
          status_resposta: status,
          conforme: isSevere || answer === "na" ? null : answer === "yes",
          ncg_marcada: isSevere ? checked : false,
          pontos_obtidos:
            isSevere ? (checked ? item.weight : 0) : answer === "no" ? 0 : item.weight,
          ordem_bloco: blockIndex + 1,
          ordem_item: itemIndex + 1,
        };
      }),
    );
  }, [selectedChecklist, selectedWallet, checklistAnswers, severeAnswers]);

  const handleSubmit = async () => {
    if (
      !canSubmit ||
      !selectedWallet ||
      !selectedChecklist ||
      !selectedOperator
    ) {
      toast({
        title: "Checklist incompleto",
        description:
          "Selecione carteira, operador, dados da ligação e responda todos os itens obrigatórios antes de enviar.",
        variant: "destructive",
      });
      return;
    }

    if (
      requiresCallDuration &&
      !isValidCallDuration(callInfo.tempo_ligacao_total)
    ) {
      toast({
        title: "Tempo da ligação inválido",
        description: "Informe o tempo total no formato mm:ss ou hh:mm:ss.",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);

    try {
      const formData = new FormData();
      const isPositive =
        checklistMetrics.severeCount === 0 && checklistMetrics.percentage >= 80;

      const payload = {
        operador: selectedOperator.nome,
        cpf_operador: selectedOperator.cpf,
        data_hora: callInfo.data_hora,
        id_ligacao: callInfo.id_ligacao,
        call_id: callInfo.call_id,
        tempo_ligacao_total: callInfo.tempo_ligacao_total,
        descricao: getGeneratedSummary(),
        pontos_positivos: callInfo.pontos_positivos,
        pontos_melhorar: callInfo.pontos_melhorar,
        pontuacao: checklistMetrics.finalScore,
        is_positivo: isPositive,
        monitor_nome: monitorNome,
        carteira_id: selectedWallet.id,
        carteira_avaliada: selectedWallet.label,
        canal_id: selectedChecklist.channelId,
        canal_avaliado: selectedChecklist.channelLabel,
        checklist_id: selectedChecklist.id,
        checklist_config_id: selectedChecklist.configId || "",
        checklist_version_id: selectedChecklist.versionId || "",
        checklist_version: selectedChecklist.version || "",
        nota_base: checklistMetrics.baseScore,
        nota_maxima: checklistMetrics.maxScore,
        penalidade_ncg: checklistMetrics.penaltyScore,
        aderencia_percentual: checklistMetrics.percentage,
        quantidade_ncg: checklistMetrics.severeCount,
        checklist_json: JSON.stringify(checklistAnalyticsPayload),
        checklist_itens: JSON.stringify(checklistItemsPayload),
        checklist_resultado: JSON.stringify({
          answers: checklistAnswers,
          severeAnswers,
          metrics: checklistMetrics,
        }),
      };

      Object.entries(payload).forEach(([key, value]) => {
        formData.append(key, String(value));
      });

      if (audioFile) {
        formData.append("audio", audioFile);
      }

      await axios.post("/api/qualidade/feedbacks/criar", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      toast({
        title: "Checklist enviado",
        description: `Feedback salvo com sucesso para ${selectedOperator.nome}.`,
      });

      resetForm();
      if (activeTab === "analytics") {
        loadStats();
        loadAllFeedbacks();
      }
    } catch (error) {
      console.error("Erro ao enviar feedback:", error);
      toast({
        title: "Erro ao enviar feedback",
        description: "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const openFeedbackDetail = async (
    id: number,
    feedbackMonitorName: string | null = monitorNome || null,
  ) => {
    if (!feedbackMonitorName) return;

    try {
      const response = await axios.get(
        `/api/qualidade/feedbacks/detalhe/${id}`,
        {
          params: { monitor_nome: feedbackMonitorName },
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      setSelectedFeedback({
        ...response.data,
        monitor_nome: feedbackMonitorName,
      });
      setShowDetailModal(true);
    } catch {
      toast({
        title: "Erro",
        description: "Não foi possível carregar o feedback",
        variant: "destructive",
      });
    }
  };

  const deleteFeedback = async (id: number) => {
    try {
      await axios.delete("/api/qualidade/feedbacks/deletar", {
        headers: { Authorization: `Bearer ${token}` },
        data: { feedback_id: id, monitor_nome: monitorNome },
      });

      toast({ title: "Feedback apagado com sucesso" });
      setShowDetailModal(false);
      loadAllFeedbacks();
      loadStats();
    } catch {
      toast({
        title: "Erro",
        description: "Não foi possível apagar o feedback",
        variant: "destructive",
      });
    }
  };

  const clearFilters = () => {
    setFilterOperator("");
    setFilterEC("");
    applyFilters(recentFeedbacks);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("pt-BR");
  };

  const renderChecklistItemWithState = (
    item: ChecklistItemConfig,
    answers: ChecklistState,
    severeState: SevereChecklistState,
    onAnswerChange: (itemId: string, answer: ChecklistAnswer) => void,
    onSevereChange: (itemId: string, checked: boolean) => void,
  ) => {
    if (item.severe) {
      const checked = severeState[item.id] || false;
      return (
        <div
          key={item.id}
          className="rounded-2xl border border-red-200 bg-red-50/70 p-4 dark:border-red-900/40 dark:bg-red-950/30"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="font-semibold text-gray-900 dark:text-white">
                  {item.title}
                </div>
                <Badge className="bg-red-600 text-white hover:bg-red-600">
                  {item.weight}
                </Badge>
              </div>
              <p className="whitespace-pre-line text-sm text-gray-600 dark:text-gray-300">
                {item.description}
              </p>
            </div>

            <label className="flex cursor-pointer items-center gap-3 rounded-full border border-red-300 px-4 py-2 text-sm font-medium text-red-700 dark:border-red-800 dark:text-red-300">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onSevereChange(item.id, e.target.checked)}
                className="h-4 w-4 accent-red-600"
              />
              <AlertTriangle className="h-4 w-4" />
              Aplicar NCG
            </label>
          </div>
        </div>
      );
    }

    const answer = answers[item.id];

    return (
      <div
        key={item.id}
        className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900/50"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="font-semibold text-gray-900 dark:text-white">
                {item.title}
              </div>
              <Badge className="bg-orange-500 text-white hover:bg-orange-500">
                {item.weight} pts
              </Badge>
            </div>
            <p className="whitespace-pre-line text-sm text-gray-600 dark:text-gray-300">
              {item.description}
            </p>
          </div>

          <div className="grid w-full grid-cols-3 gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 lg:w-auto dark:border-gray-700 dark:bg-gray-800/60">
            {([
              ["yes", "Conforme", "border-emerald-500 bg-emerald-500 text-white"],
              ["no", "Não conforme", "border-red-500 bg-red-500 text-white"],
              ["na", "Não se aplica", "border-sky-500 bg-sky-500 text-white"],
            ] as const).map(([value, label, activeClass]) => (
              <button
                key={value}
                type="button"
                onClick={() => onAnswerChange(item.id, value)}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition sm:text-sm ${
                  answer === value
                    ? activeClass
                    : "border-transparent bg-transparent text-gray-500 hover:bg-white dark:text-gray-300 dark:hover:bg-gray-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderChecklistItem = (item: ChecklistItemConfig) =>
    renderChecklistItemWithState(
      item,
      checklistAnswers,
      severeAnswers,
      handleChecklistAnswer,
      handleSevereAnswer,
    );

  const renderReverseChecklistItem = (item: ChecklistItemConfig) =>
    renderChecklistItemWithState(
      item,
      reverseChecklistAnswers,
      reverseSevereAnswers,
      (itemId, answer) =>
        setReverseChecklistAnswers((prev) => ({ ...prev, [itemId]: answer })),
      (itemId, checked) =>
        setReverseSevereAnswers((prev) => ({ ...prev, [itemId]: checked })),
    );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 backdrop-blur-sm sm:p-4">
      <div className="max-h-[96vh] w-full max-w-[min(98vw,1760px)] overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        <div className="sticky top-0 z-10 rounded-t-2xl border-b border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500">
                <ClipboardCheck className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Checklist de Qualidade
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Estrutura configurável por carteira, canal e itens de
                  monitoria.
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-10 w-10 p-0 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="p-4 sm:p-6 lg:p-8">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid h-12 w-full grid-cols-5 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
              <TabsTrigger
                value="create"
                className="rounded-lg font-medium transition-all data-[state=active]:bg-orange-500 data-[state=active]:text-white"
              >
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Criar Checklist
              </TabsTrigger>
              <TabsTrigger
                value="reverse"
                className="rounded-lg font-medium transition-all data-[state=active]:bg-orange-500 data-[state=active]:text-white"
              >
                <FileAudio className="mr-2 h-4 w-4" />
                Monitoria Invertida
              </TabsTrigger>
              <TabsTrigger
                value="monitor"
                className="rounded-lg font-medium transition-all data-[state=active]:bg-orange-500 data-[state=active]:text-white"
              >
                <Headphones className="mr-2 h-4 w-4" />
                Monitor
              </TabsTrigger>
              <TabsTrigger
                value="analytics"
                className="rounded-lg font-medium transition-all data-[state=active]:bg-orange-500 data-[state=active]:text-white"
              >
                <BarChart3 className="mr-2 h-4 w-4" />
                Analytics
              </TabsTrigger>
              <TabsTrigger
                value="manage"
                className="rounded-lg font-medium transition-all data-[state=active]:bg-orange-500 data-[state=active]:text-white"
              >
                <Settings2 className="mr-2 h-4 w-4" />
                Gestão
              </TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="mt-8 space-y-8">
              {!selectedWallet ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 border-b border-gray-200 pb-4 dark:border-gray-700">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
                      <Building2 className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      1. Escolha a carteira da monitoria
                    </h2>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {runtimeWallets.map((wallet) => (
                      <button
                        key={wallet.id}
                        type="button"
                        disabled={!wallet.enabled}
                        onClick={() => handleWalletSelect(wallet.id)}
                        className={`group rounded-3xl border p-6 text-left transition-all ${wallet.cardClassName} ${
                          wallet.enabled
                            ? "hover:-translate-y-1 hover:shadow-xl"
                            : "cursor-not-allowed opacity-60"
                        }`}
                      >
                        <div className="flex justify-center">
                          {wallet.logoSrc ? (
                            <div className="flex h-36 w-36 items-center justify-center group-hover:scale-105">
                              <img
                                src={wallet.logoSrc}
                                alt={wallet.logoAlt || wallet.label}
                                className="h-full w-full object-contain"
                              />
                            </div>
                          ) : (
                            <div className="flex h-28 w-28 items-center justify-center rounded-3xl border-2 border-white bg-white/90 text-slate-500 shadow-lg ring-4 ring-white/50 transition-transform group-hover:scale-105">
                              <Building2 className="h-10 w-10" />
                            </div>
                          )}
                        </div>

                        <div className="mt-5 text-center">
                          <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                            {wallet.description}
                          </p>
                        </div>

                        <div className="mt-5 flex flex-wrap justify-center gap-2">
                          {wallet.channels.map((channel) => (
                            <Badge
                              key={channel.id}
                              variant="outline"
                              className="rounded-full"
                            >
                              {channel.label}
                            </Badge>
                          ))}
                        </div>

                        {!wallet.enabled && (
                          <div className="mt-4 text-center text-sm font-medium text-orange-600">
                            Em breve
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-900/30 dark:bg-orange-950/20">
                    <div>
                      <div className="text-sm font-semibold text-orange-700 dark:text-orange-300">
                        Carteira selecionada
                      </div>
                      <div className="text-xl font-bold text-gray-900 dark:text-white">
                        {selectedWallet.label}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full"
                      onClick={resetForm}
                    >
                      Trocar carteira
                    </Button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-4">
                    {[
                      { id: 1, title: "Canal/produto" },
                      { id: 2, title: "Operador e ligação" },
                      { id: 3, title: "Checklist" },
                      { id: 4, title: "Prévia e envio" },
                    ].map((step) => {
                      const isActive = createStep === step.id;
                      const isComplete = createStep > step.id;
                      return (
                        <button
                          key={step.id}
                          type="button"
                          onClick={() => {
                            if (step.id === 1) setCreateStep(1);
                            if (step.id === 2 && canAdvanceFromChannel)
                              setCreateStep(2);
                            if (step.id === 3 && canAdvanceFromCallInfo)
                              setCreateStep(3);
                            if (step.id === 4 && canAdvanceFromChecklist)
                              setCreateStep(4);
                          }}
                          className={`rounded-2xl border px-4 py-4 text-left transition ${
                            isActive
                              ? "border-orange-500 bg-orange-50 dark:bg-orange-950/20"
                              : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
                                isComplete || isActive
                                  ? "bg-orange-500 text-white"
                                  : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                              }`}
                            >
                              {step.id}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                                {step.title}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {isComplete
                                  ? "Concluído"
                                  : isActive
                                    ? "Etapa atual"
                                    : "Pendente"}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {createStep === 1 && (
                    <div className="space-y-6">
                      <div className="flex items-center gap-3 border-b border-gray-200 pb-4 dark:border-gray-700">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
                          <Headphones className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                        </div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                          2. Escolha o canal/produto da monitoria
                        </h2>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        {selectedWallet.channels.map((channel) => {
                          const isActive = selectedChannelId === channel.id;
                          return (
                            <button
                              key={channel.id}
                              type="button"
                              onClick={() => setSelectedChannelId(channel.id)}
                              className={`rounded-2xl border p-5 text-left transition ${
                                isActive
                                  ? "border-orange-500 bg-orange-50 ring-2 ring-orange-200 dark:bg-orange-950/20"
                                  : "border-gray-200 bg-white hover:border-orange-300 dark:border-gray-700 dark:bg-gray-900"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 text-white">
                                  {channel.id === "voz" ? (
                                    <PhoneCall className="h-5 w-5" />
                                  ) : channel.id === "chat" ? (
                                    <MessageSquare className="h-5 w-5" />
                                  ) : (
                                    <ClipboardCheck className="h-5 w-5" />
                                  )}
                                </div>
                                <div>
                                  <div className="font-semibold text-gray-900 dark:text-white">
                                    {channel.label}
                                  </div>
                                  <div className="text-sm text-gray-600 dark:text-gray-300">
                                    {channel.description}
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex justify-end">
                        <Button
                          type="button"
                          onClick={() => setCreateStep(2)}
                          disabled={!canAdvanceFromChannel}
                          className="rounded-full bg-orange-500 px-6 hover:bg-orange-600"
                        >
                          Avançar para operador
                        </Button>
                      </div>
                    </div>
                  )}

                  {createStep === 2 && (
                    <div className="space-y-6">
                      <div className="flex items-center gap-3 border-b border-gray-200 pb-4 dark:border-gray-700">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
                          <User className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                        </div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                          3. Operador e dados da ligação
                        </h2>
                      </div>

                      <Card className="border-gray-200 dark:border-gray-700">
                        <CardContent className="space-y-6 p-6">
                          <div className="space-y-4">
                            <Label className="text-sm font-semibold text-gray-900 dark:text-white">
                              Operador monitorado
                            </Label>
                            <div className="flex gap-3">
                              <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                <Input
                                  type="text"
                                  placeholder="Digite o nome do operador..."
                                  value={searchTerm}
                                  onChange={(e) =>
                                    setSearchTerm(e.target.value)
                                  }
                                  className="h-11 pl-10"
                                />
                              </div>
                              <Button
                                type="button"
                                onClick={buscarOperadores}
                                className="h-11 bg-orange-500 px-6 hover:bg-orange-600"
                              >
                                Buscar
                              </Button>
                            </div>

                            {selectedOperator && (
                              <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-900/20">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500">
                                    <User className="h-5 w-5 text-white" />
                                  </div>
                                  <div>
                                    <div className="font-semibold text-gray-900 dark:text-white">
                                      {selectedOperator.nome}
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                      {selectedOperator.carteira} •{" "}
                                      {selectedOperator.centro_custo}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {showOperatorList && (
                              <div className="max-h-60 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
                                {isLoadingOperators ? (
                                  <div className="p-8 text-center">
                                    <div className="mb-2 inline-block h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
                                    <p className="text-gray-500">
                                      Carregando operadores...
                                    </p>
                                  </div>
                                ) : filteredOperators.length === 0 ? (
                                  <div className="p-8 text-center text-gray-500">
                                    Nenhum operador encontrado para a carteira
                                    selecionada
                                  </div>
                                ) : (
                                  filteredOperators.map((operator) => (
                                    <div
                                      key={operator.id}
                                      className="cursor-pointer border-b border-gray-100 p-4 transition hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800"
                                      onClick={() =>
                                        handleOperatorSelect(operator)
                                      }
                                    >
                                      <div className="font-medium text-gray-900 dark:text-white">
                                        {operator.nome}
                                      </div>
                                      <div className="text-sm text-gray-500">
                                        {operator.carteira} •{" "}
                                        {operator.centro_custo}
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>

                          <div className="grid gap-6 md:grid-cols-3">
                            <div className="space-y-2">
                              <Label htmlFor="dataHora">Data e hora</Label>
                              <Input
                                id="dataHora"
                                type="datetime-local"
                                value={callInfo.data_hora}
                                onChange={(e) =>
                                  setCallInfo((prev) => ({
                                    ...prev,
                                    data_hora: e.target.value,
                                  }))
                                }
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="ecLigacao">EC da ligação</Label>
                              <Input
                                id="ecLigacao"
                                value={callInfo.id_ligacao}
                                onChange={(e) =>
                                  setCallInfo((prev) => ({
                                    ...prev,
                                    id_ligacao: e.target.value,
                                  }))
                                }
                                placeholder="Informe o EC da ligação"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="callIdLigacao">
                                Call ID da ligação
                              </Label>
                              <Input
                                id="callIdLigacao"
                                value={callInfo.call_id}
                                onChange={(e) =>
                                  setCallInfo((prev) => ({
                                    ...prev,
                                    call_id: e.target.value,
                                  }))
                                }
                                placeholder="Informe o Call ID da ligação"
                              />
                            </div>

                            {requiresCallDuration && (
                              <div className="space-y-2">
                                <Label htmlFor="tempoLigacao">
                                  Tempo total da ligação
                                </Label>
                                <Input
                                  id="tempoLigacao"
                                  value={callInfo.tempo_ligacao_total}
                                  onChange={(e) =>
                                    setCallInfo((prev) => ({
                                      ...prev,
                                      tempo_ligacao_total: e.target.value,
                                    }))
                                  }
                                  placeholder="Ex.: 12:34 ou 01:12:34"
                                />
                                <p className="text-xs text-gray-500">
                                  Preencha manualmente com minutos e segundos.
                                </p>
                              </div>
                            )}

                            <div className="space-y-2 md:col-span-3">
                              <Label htmlFor="audioFile">Áudio gravado</Label>
                              <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-4 transition hover:border-orange-400 hover:bg-orange-50/40 dark:border-gray-700 dark:bg-gray-900/50">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 text-white">
                                    <FileAudio className="h-5 w-5" />
                                  </div>
                                  <div>
                                    <div className="font-medium text-gray-900 dark:text-white">
                                      {audioFile
                                        ? audioFile.name
                                        : "Selecionar arquivo de áudio"}
                                    </div>
                                    <div className="text-sm text-gray-500">
                                      Aceita arquivos de áudio da ligação
                                      baixada
                                    </div>
                                  </div>
                                </div>
                                <Input
                                  id="audioFile"
                                  type="file"
                                  accept="audio/*"
                                  className="hidden"
                                  onChange={(e) =>
                                    setAudioFile(e.target.files?.[0] || null)
                                  }
                                />
                              </label>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <div className="flex justify-between">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setCreateStep(1)}
                        >
                          Voltar
                        </Button>
                        <Button
                          type="button"
                          onClick={() => setCreateStep(3)}
                          disabled={!canAdvanceFromCallInfo}
                          className="rounded-full bg-orange-500 px-6 hover:bg-orange-600"
                        >
                          Avançar para checklist
                        </Button>
                      </div>
                    </div>
                  )}

                  {createStep === 3 && selectedChecklist && (
                    <div className="space-y-6">
                      <div className="flex items-center gap-3 border-b border-gray-200 pb-4 dark:border-gray-700">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
                          {selectedChecklist.channelId === "voz" ? (
                            <PhoneCall className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                          ) : (
                            <MessageSquare className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                          )}
                        </div>
                        <div>
                          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            4. Checklist {selectedChecklist.label}
                          </h2>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            A avaliação começa em 100 pontos. Somente itens
                            “Não conforme” descontam nota; “Não se aplica” não
                            gera desconto.
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-4">
                        <Card className="border-gray-200 dark:border-gray-700">
                          <CardContent className="p-5">
                            <div className="text-sm text-gray-500">
                              Nota inicial
                            </div>
                            <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                              {checklistMetrics.maxScore}
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="border-gray-200 dark:border-gray-700">
                          <CardContent className="p-5">
                            <div className="text-sm text-gray-500">
                              Pontos descontados
                            </div>
                            <div className="mt-2 text-2xl font-bold text-red-600">
                              -{checklistMetrics.deductionScore}
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="border-gray-200 dark:border-gray-700">
                          <CardContent className="p-5">
                            <div className="text-sm text-gray-500">
                              Nota final
                            </div>
                            <div className="mt-2 text-2xl font-bold text-orange-600">
                              {checklistMetrics.finalScore}
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="border-gray-200 dark:border-gray-700">
                          <CardContent className="p-5">
                            <div className="text-sm text-gray-500">
                              Não se aplica
                            </div>
                            <div className="mt-2 text-2xl font-bold text-emerald-600">
                              {checklistMetrics.notApplicableCount}
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      <div className="space-y-6">
                        {selectedChecklist.blocks.map((block) => (
                          <Card
                            key={block.id}
                            className={`border-gray-200 dark:border-gray-700 ${
                              block.items.some((item) => item.severe)
                                ? "bg-red-50/30 dark:bg-red-950/10"
                                : ""
                            }`}
                          >
                            <CardHeader>
                              <CardTitle className="flex items-center justify-between gap-4">
                                <span className="text-gray-900 dark:text-white">
                                  {block.title}
                                </span>
                                <Badge
                                  className={
                                    block.items.some((item) => item.severe)
                                      ? "bg-red-600 text-white hover:bg-red-600"
                                      : "bg-orange-500 text-white hover:bg-orange-500"
                                  }
                                >
                                  {block.items.length} itens
                                </Badge>
                              </CardTitle>
                              {block.description && (
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  {block.description}
                                </p>
                              )}
                            </CardHeader>
                            <CardContent className="space-y-4">
                              {block.items.map((item) =>
                                renderChecklistItem(item),
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>

                      <div className="flex justify-between">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setCreateStep(2)}
                        >
                          Voltar
                        </Button>
                        <Button
                          type="button"
                          onClick={() => setCreateStep(4)}
                          disabled={!canAdvanceFromChecklist}
                          className="rounded-full bg-orange-500 px-6 hover:bg-orange-600"
                        >
                          Ver prévia do envio
                        </Button>
                      </div>
                    </div>
                  )}

                  {createStep === 4 &&
                    selectedChecklist &&
                    selectedOperator && (
                      <div className="space-y-6">
                        {(() => {
                          const previewTone = getScoreTone(
                            checklistMetrics.finalScore,
                          );
                          const previewStatus =
                            checklistMetrics.severeCount > 0
                              ? "Feedback negativo por NCG"
                              : checklistMetrics.percentage >= 80
                                ? "Feedback positivo"
                                : "Feedback com pontos de atenção";

                          return (
                            <div className="contents">
                              <div className="flex items-center gap-3 border-b border-gray-200 pb-4 dark:border-gray-700">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
                                  <Send className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                                </div>
                                <div>
                                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    5. Prévia e confirmação do envio
                                  </h2>
                                  <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Revise abaixo como a monitoria será
                                    registrada para o operador.
                                  </p>
                                </div>
                              </div>

                              <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                                <div className="space-y-6">
                                  <Card className="border-gray-200 dark:border-gray-700">
                                    <CardHeader>
                                      <CardTitle className="text-base">
                                        Observações do monitor
                                      </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                      <div className="space-y-2">
                                        <Label htmlFor="observacoes">
                                          Observações gerais
                                        </Label>
                                        <Textarea
                                          id="observacoes"
                                          rows={5}
                                          value={callInfo.observacoes_gerais}
                                          onChange={(e) =>
                                            setCallInfo((prev) => ({
                                              ...prev,
                                              observacoes_gerais:
                                                e.target.value,
                                            }))
                                          }
                                          placeholder="Descreva percepções gerais sobre a condução da ligação."
                                        />
                                      </div>

                                      <div className="space-y-2">
                                        <Label htmlFor="pontosPositivos">
                                          Pontos positivos
                                        </Label>
                                        <Textarea
                                          id="pontosPositivos"
                                          rows={4}
                                          value={callInfo.pontos_positivos}
                                          onChange={(e) =>
                                            setCallInfo((prev) => ({
                                              ...prev,
                                              pontos_positivos: e.target.value,
                                            }))
                                          }
                                          placeholder="Destaque comportamentos ou boas práticas observadas."
                                        />
                                      </div>

                                      <div className="space-y-2">
                                        <Label htmlFor="pontosMelhorar">
                                          Pontos a melhorar
                                        </Label>
                                        <Textarea
                                          id="pontosMelhorar"
                                          rows={4}
                                          value={callInfo.pontos_melhorar}
                                          onChange={(e) =>
                                            setCallInfo((prev) => ({
                                              ...prev,
                                              pontos_melhorar: e.target.value,
                                            }))
                                          }
                                          placeholder="Registre os principais pontos de atenção para o operador."
                                        />
                                      </div>
                                    </CardContent>
                                  </Card>

                                  <Card className="border-gray-200 dark:border-gray-700">
                                    <CardHeader>
                                      <CardTitle className="text-base">
                                        Prévia da mensagem
                                      </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                      <div className="space-y-4 rounded-[28px] border border-slate-200 bg-slate-50 p-4">
                                        <div className="flex flex-col gap-4 rounded-[24px] bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.18),_transparent_35%),linear-gradient(135deg,_#0f172a,_#1e293b)] p-5 text-white md:flex-row md:items-center md:justify-between">
                                          <div>
                                            <div className="mb-2 flex flex-wrap items-center gap-2">
                                              <Badge
                                                className={`${previewTone.chip} hover:${previewTone.chip}`}
                                              >
                                                {previewTone.label}
                                              </Badge>
                                              <Badge className="bg-white/10 text-white hover:bg-white/10">
                                                {previewStatus}
                                              </Badge>
                                            </div>
                                            <h3 className="text-xl font-semibold">
                                              Prévia da monitoria para o
                                              operador
                                            </h3>
                                            <p className="mt-1 text-sm text-slate-200">
                                              {selectedWallet.label} •{" "}
                                              {selectedChecklist.channelLabel} •
                                              EC {callInfo.id_ligacao}
                                              {callInfo.call_id
                                                ? ` • Call ID ${callInfo.call_id}`
                                                : ""}
                                            </p>
                                            {selectedChecklist.channelId ===
                                              "voz" && (
                                              <p className="mt-1 text-sm text-slate-300">
                                                Tempo total:{" "}
                                                {callInfo.tempo_ligacao_total ||
                                                  "-"}
                                              </p>
                                            )}
                                          </div>

                                          <div
                                            className={`rounded-3xl bg-gradient-to-br ${previewTone.card} px-5 py-4 text-white shadow-lg`}
                                          >
                                            <div className="text-[11px] uppercase tracking-[0.2em] text-white/75">
                                              Nota final
                                            </div>
                                            <div className="mt-1 text-4xl font-bold leading-none">
                                              {checklistMetrics.finalScore}
                                            </div>
                                            <div className="mt-2 text-sm text-white/85">
                                              Aderência de{" "}
                                              {checklistMetrics.percentage}%
                                            </div>
                                          </div>
                                        </div>

                                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                          <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                                              Operador
                                            </div>
                                            <div className="mt-2 font-semibold text-slate-900">
                                              {selectedOperator.nome}
                                            </div>
                                          </div>
                                          <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                                              Pontos descontados
                                            </div>
                                            <div className="mt-2 font-semibold text-slate-900">
                                              -{checklistMetrics.deductionScore}
                                            </div>
                                          </div>
                                          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                                            <div className="text-xs uppercase tracking-[0.18em] text-rose-600">
                                              Penalidade NCG
                                            </div>
                                            <div className="mt-2 font-semibold text-rose-700">
                                              {checklistMetrics.penaltyScore}
                                            </div>
                                          </div>
                                          <div
                                            className={`rounded-2xl border p-4 ${previewTone.panel}`}
                                          >
                                            <div
                                              className={`text-xs uppercase tracking-[0.18em] ${previewTone.text}`}
                                            >
                                              Status
                                            </div>
                                            <div
                                              className={`mt-2 font-semibold ${previewTone.text}`}
                                            >
                                              {previewTone.label}
                                            </div>
                                          </div>
                                        </div>

                                        <div className="grid gap-4 xl:grid-cols-3">
                                          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
                                            <div className="mb-3 flex items-center justify-between">
                                              <h4 className="font-semibold text-emerald-800">
                                                Pontos feitos
                                              </h4>
                                              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                                                {
                                                  checklistPreviewGroups.done
                                                    .length
                                                }
                                              </Badge>
                                            </div>
                                            <div className="space-y-2">
                                              {checklistPreviewGroups.done
                                                .length > 0 ? (
                                                checklistPreviewGroups.done.map(
                                                  (item, index) => (
                                                    <div
                                                      key={`preview-done-${index}`}
                                                      className="rounded-2xl border border-emerald-100 bg-white px-4 py-3"
                                                    >
                                                      <div className="text-[11px] uppercase tracking-[0.16em] text-emerald-600">
                                                        {item.blockTitle}
                                                      </div>
                                                      <div className="mt-1 text-sm font-medium text-slate-800">
                                                        {item.itemTitle}
                                                      </div>
                                                    </div>
                                                  ),
                                                )
                                              ) : (
                                                <div className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm text-slate-500">
                                                  Nenhum ponto marcado como
                                                  feito.
                                                </div>
                                              )}
                                            </div>
                                          </div>

                                          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
                                            <div className="mb-3 flex items-center justify-between">
                                              <h4 className="font-semibold text-amber-800">
                                                Pontos não feitos
                                              </h4>
                                              <Badge className="bg-amber-500 text-white hover:bg-amber-500">
                                                {
                                                  checklistPreviewGroups.notDone
                                                    .length
                                                }
                                              </Badge>
                                            </div>
                                            <div className="space-y-2">
                                              {checklistPreviewGroups.notDone
                                                .length > 0 ? (
                                                checklistPreviewGroups.notDone.map(
                                                  (item, index) => (
                                                    <div
                                                      key={`preview-not-done-${index}`}
                                                      className="rounded-2xl border border-amber-100 bg-white px-4 py-3"
                                                    >
                                                      <div className="text-[11px] uppercase tracking-[0.16em] text-amber-600">
                                                        {item.blockTitle}
                                                      </div>
                                                      <div className="mt-1 text-sm font-medium text-slate-800">
                                                        {item.itemTitle}
                                                      </div>
                                                    </div>
                                                  ),
                                                )
                                              ) : (
                                                <div className="rounded-2xl border border-amber-100 bg-white px-4 py-3 text-sm text-slate-500">
                                                  Todos os pontos foram marcados
                                                  como feitos.
                                                </div>
                                              )}
                                            </div>
                                          </div>

                                          <div className="rounded-3xl border border-sky-200 bg-sky-50 p-4">
                                            <div className="mb-3 flex items-center justify-between">
                                              <h4 className="font-semibold text-sky-800">
                                                Não se aplica
                                              </h4>
                                              <Badge className="bg-sky-500 text-white hover:bg-sky-500">
                                                {checklistPreviewGroups.notApplicable.length}
                                              </Badge>
                                            </div>
                                            <div className="space-y-2">
                                              {checklistPreviewGroups.notApplicable.length > 0 ? (
                                                checklistPreviewGroups.notApplicable.map((item, index) => (
                                                  <div key={`preview-na-${index}`} className="rounded-2xl border border-sky-100 bg-white px-4 py-3">
                                                    <div className="text-[11px] uppercase tracking-[0.16em] text-sky-600">{item.blockTitle}</div>
                                                    <div className="mt-1 text-sm font-medium text-slate-800">{item.itemTitle}</div>
                                                  </div>
                                                ))
                                              ) : (
                                                <div className="rounded-2xl border border-sky-100 bg-white px-4 py-3 text-sm text-slate-500">
                                                  Nenhum item marcado como não aplicável.
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>

                                        {checklistPreviewGroups.ncg.length >
                                          0 && (
                                          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4">
                                            <div className="mb-3 flex items-center justify-between">
                                              <h4 className="font-semibold text-rose-800">
                                                NCG aplicadas
                                              </h4>
                                              <Badge className="bg-rose-600 text-white hover:bg-rose-600">
                                                {
                                                  checklistPreviewGroups.ncg
                                                    .length
                                                }
                                              </Badge>
                                            </div>
                                            <div className="space-y-2">
                                              {checklistPreviewGroups.ncg.map(
                                                (item, index) => (
                                                  <div
                                                    key={`preview-ncg-${index}`}
                                                    className="rounded-2xl border border-rose-100 bg-white px-4 py-3"
                                                  >
                                                    <div className="text-[11px] uppercase tracking-[0.16em] text-rose-600">
                                                      {item.blockTitle}
                                                    </div>
                                                    <div className="mt-1 text-sm font-medium text-slate-800">
                                                      {item.itemTitle}
                                                    </div>
                                                  </div>
                                                ),
                                              )}
                                            </div>
                                          </div>
                                        )}

                                        <div className="grid gap-4 xl:grid-cols-3">
                                          <div className="rounded-3xl border border-slate-200 bg-white p-4 xl:col-span-1">
                                            <h4 className="mb-2 font-semibold text-slate-900">
                                              Observações gerais
                                            </h4>
                                            <p className="whitespace-pre-line text-sm leading-6 text-slate-700">
                                              {callInfo.observacoes_gerais ||
                                                "Sem observações adicionais."}
                                            </p>
                                          </div>
                                          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
                                            <h4 className="mb-2 font-semibold text-emerald-800">
                                              Pontos positivos
                                            </h4>
                                            <p className="whitespace-pre-line text-sm leading-6 text-slate-700">
                                              {callInfo.pontos_positivos ||
                                                "Nenhum ponto positivo registrado."}
                                            </p>
                                          </div>
                                          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
                                            <h4 className="mb-2 font-semibold text-amber-800">
                                              Pontos a melhorar
                                            </h4>
                                            <p className="whitespace-pre-line text-sm leading-6 text-slate-700">
                                              {callInfo.pontos_melhorar ||
                                                "Nenhum ponto de melhoria registrado."}
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                </div>

                                <div className="space-y-4">
                                  <Card className="border-gray-200 dark:border-gray-700">
                                    <CardContent className="space-y-4 p-6">
                                      <div>
                                        <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                          Operador
                                        </div>
                                        <div className="mt-1 font-semibold text-gray-900 dark:text-white">
                                          {selectedOperator.nome}
                                        </div>
                                      </div>
                                      <div>
                                        <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                          Carteira e canal
                                        </div>
                                        <div className="mt-1 font-semibold text-gray-900 dark:text-white">
                                          {selectedWallet.label} •{" "}
                                          {selectedChecklist.channelLabel}
                                        </div>
                                      </div>
                                      <div>
                                        <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                          EC da ligação
                                        </div>
                                        <div className="mt-1 font-semibold text-gray-900 dark:text-white">
                                          {callInfo.id_ligacao}
                                        </div>
                                      </div>
                                      <div>
                                        <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                          Call ID da ligação
                                        </div>
                                        <div className="mt-1 font-semibold text-gray-900 dark:text-white">
                                          {callInfo.call_id || "-"}
                                        </div>
                                      </div>
                                      {selectedChecklist.channelId ===
                                        "voz" && (
                                        <div>
                                          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                            Tempo total da ligação
                                          </div>
                                          <div className="mt-1 font-semibold text-gray-900 dark:text-white">
                                            {callInfo.tempo_ligacao_total ||
                                              "-"}
                                          </div>
                                        </div>
                                      )}
                                      <div className="grid grid-cols-2 gap-3">
                                        <div className="rounded-2xl bg-orange-50 p-4 dark:bg-orange-950/20">
                                          <div className="text-xs uppercase tracking-[0.2em] text-orange-600 dark:text-orange-300">
                                            Nota final
                                          </div>
                                          <div className="mt-2 text-2xl font-bold text-orange-600 dark:text-orange-300">
                                            {checklistMetrics.finalScore}
                                          </div>
                                        </div>
                                        <div className="rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-950/20">
                                          <div className="text-xs uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-300">
                                            Aderência
                                          </div>
                                          <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-300">
                                            {checklistMetrics.percentage}%
                                          </div>
                                        </div>
                                      </div>
                                      <div className="rounded-2xl border border-dashed border-gray-300 p-4 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
                                        {checklistMetrics.severeCount > 0
                                          ? `${checklistMetrics.severeCount} NCG(s) aplicada(s). O feedback será classificado como negativo.`
                                          : "Nenhuma NCG aplicada. A nota final será enviada junto com o checklist."}
                                      </div>
                                    </CardContent>
                                  </Card>

                                  <div className="flex flex-col gap-3">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={() => setCreateStep(3)}
                                    >
                                      Voltar ao checklist
                                    </Button>
                                    <Button
                                      onClick={handleSubmit}
                                      disabled={!canSubmit}
                                      className="h-12 rounded-full bg-orange-500 px-8 text-base hover:bg-orange-600"
                                    >
                                      {isSending ? (
                                        <div className="flex items-center gap-2">
                                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                          Enviando...
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-2">
                                          <Send className="h-4 w-4" />
                                          Confirmar envio ao operador
                                        </div>
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="reverse" className="mt-8">
              <div className="space-y-8">
                <div className="rounded-[28px] bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.22),_transparent_34%),linear-gradient(135deg,_#111827,_#1f2937)] p-6 text-white">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <h2 className="text-2xl font-semibold">
                        Monitoria Invertida
                      </h2>
                      <p className="mt-2 max-w-3xl text-sm text-slate-200">
                        Escolha uma monitoria já realizada, ouça a ligação e
                        peça para o operador preencher o mesmo checklist antes
                        de ver o resultado original do monitor.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                      <div className="rounded-2xl bg-white/10 p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-300">
                          Monitorias
                        </div>
                        <div className="mt-2 text-2xl font-bold">
                          {recentFeedbacks.length}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-white/10 p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-300">
                          Selecionada
                        </div>
                        <div className="mt-2 text-sm font-semibold">
                          {selectedReverseFeedback?.operador || "Nenhuma"}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-white/10 p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-300">
                          Status
                        </div>
                        <div className="mt-2 text-sm font-semibold">
                          {reverseCompleted
                            ? "Comparativo pronto"
                            : "Em preenchimento"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
                  <Card className="border-gray-200 dark:border-gray-700">
                    <CardHeader>
                      <div className="flex items-center justify-between gap-3">
                        <CardTitle className="text-base">
                          Monitorias já realizadas
                        </CardTitle>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            resetReverseMonitoring();
                            loadAllFeedbacks();
                          }}
                        >
                          Atualizar
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {recentFeedbacks.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
                            Nenhuma monitoria encontrada para este monitor.
                          </div>
                        ) : (
                          recentFeedbacks.map((feedback) => (
                            <button
                              key={`reverse-feedback-${feedback.id}`}
                              type="button"
                              onClick={() =>
                                loadReverseFeedbackDetail(feedback.id)
                              }
                              className={`w-full rounded-2xl border p-4 text-left transition ${
                                selectedReverseFeedback?.id === feedback.id
                                  ? "border-orange-400 bg-orange-50 shadow-sm"
                                  : "border-gray-200 bg-white hover:border-orange-300 dark:border-gray-700 dark:bg-gray-900/40"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="font-semibold text-gray-900 dark:text-white">
                                    {feedback.operador}
                                  </div>
                                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    {formatDate(feedback.data_hora)}
                                  </div>
                                </div>
                                <Badge
                                  variant={
                                    feedback.is_positivo
                                      ? "default"
                                      : "destructive"
                                  }
                                  className="rounded-full"
                                >
                                  {feedback.is_positivo
                                    ? "Positiva"
                                    : "Negativa"}
                                </Badge>
                              </div>
                              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-gray-400">
                                <div>EC: {feedback.id_ligacao || "-"}</div>
                                <div>Nota: {feedback.pontuacao ?? "-"}</div>
                                <div className="col-span-2">
                                  Call ID: {feedback.call_id || "-"}
                                </div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <div className="space-y-6">
                    {!selectedReverseFeedback ? (
                      <Card className="border-gray-200 dark:border-gray-700">
                        <CardContent className="flex min-h-[420px] items-center justify-center p-8">
                          <div className="max-w-lg text-center">
                            <FileAudio className="mx-auto h-10 w-10 text-orange-500" />
                            <h3 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">
                              Selecione uma monitoria para iniciar
                            </h3>
                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                              Ao abrir uma monitoria, o operador poderá ouvir a
                              ligação e preencher o mesmo checklist sem ver a
                              descrição, a nota e os apontamentos do monitor.
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    ) : loadingReverseFeedback ? (
                      <Card className="border-gray-200 dark:border-gray-700">
                        <CardContent className="flex min-h-[420px] items-center justify-center p-8 text-sm text-gray-500">
                          Carregando monitoria selecionada...
                        </CardContent>
                      </Card>
                    ) : !selectedReverseChecklist ? (
                      <Card className="border-gray-200 dark:border-gray-700">
                        <CardContent className="flex min-h-[420px] items-center justify-center p-8">
                          <div className="max-w-lg text-center">
                            <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
                            <h3 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">
                              Checklist original indisponível
                            </h3>
                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                              Essa monitoria não possui o `checklist_json` salvo
                              ou foi criada antes da nova estrutura.
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="contents">
                        <Card className="border-gray-200 dark:border-gray-700">
                          <CardHeader>
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                              <div>
                                <CardTitle className="text-base">
                                  Dados da monitoria selecionada
                                </CardTitle>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                  O operador vê os dados da ligação e o áudio,
                                  mas o resultado do monitor fica oculto até a
                                  finalização.
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={resetReverseMonitoring}
                                >
                                  Escolher outra
                                </Button>
                                <Button
                                  type="button"
                                  onClick={() => setReverseCompleted(true)}
                                  disabled={!canCompleteReverseChecklist}
                                  className="bg-orange-500 hover:bg-orange-600"
                                >
                                  Finalizar Monitoria Invertida
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-6">
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                  Operador
                                </div>
                                <div className="mt-2 text-lg font-semibold text-slate-900">
                                  {selectedReverseFeedback.operador}
                                </div>
                              </div>
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                  Data
                                </div>
                                <div className="mt-2 text-lg font-semibold text-slate-900">
                                  {formatDate(
                                    selectedReverseFeedback.data_hora,
                                  )}
                                </div>
                              </div>
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                  EC
                                </div>
                                <div className="mt-2 text-lg font-semibold text-slate-900">
                                  {selectedReverseFeedback.id_ligacao || "-"}
                                </div>
                              </div>
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                  Call ID
                                </div>
                                <div className="mt-2 text-lg font-semibold text-slate-900">
                                  {selectedReverseFeedback.call_id || "-"}
                                </div>
                              </div>
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                  Tempo total
                                </div>
                                <div className="mt-2 text-lg font-semibold text-slate-900">
                                  {selectedReverseFeedback.tempo_ligacao_total ||
                                    "-"}
                                </div>
                              </div>
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                  Carteira / canal
                                </div>
                                <div className="mt-2 text-sm font-semibold text-slate-900">
                                  {selectedReverseFeedback.carteira_label ||
                                    "-"}
                                  <br />
                                  {selectedReverseFeedback.canal_label || "-"}
                                </div>
                              </div>
                            </div>

                            {selectedReverseFeedback.audio_path ? (
                              <div className="rounded-3xl border border-orange-200 bg-orange-50 p-4">
                                <div className="mb-3 text-sm font-semibold text-orange-700">
                                  Áudio da ligação
                                </div>
                                <audio
                                  controls
                                  className="w-full"
                                  src={`http:///${selectedReverseFeedback.audio_path}`}
                                />
                              </div>
                            ) : (
                              <div className="rounded-3xl border border-dashed border-gray-300 p-4 text-sm text-gray-500">
                                Essa monitoria não possui áudio anexado.
                              </div>
                            )}

                            <div className="rounded-3xl border border-sky-200 bg-sky-50 p-4">
                              <div className="flex items-center gap-2 text-sm font-semibold text-sky-700">
                                <EyeOff className="h-4 w-4" />
                                Resultado do monitor oculto
                              </div>
                              <p className="mt-2 text-sm text-sky-700/90">
                                Nota, descrição, pontos positivos e pontos a
                                melhorar só aparecem depois que o operador
                                finalizar este checklist.
                              </p>
                            </div>
                          </CardContent>
                        </Card>

                        {!reverseCompleted && (
                          <Card className="border-gray-200 dark:border-gray-700">
                            <CardHeader>
                              <CardTitle className="text-base">
                                Checklist do operador
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                              {selectedReverseChecklist.blocks.map((block) => (
                                <div
                                  key={`reverse-block-${block.id}`}
                                  className="space-y-4"
                                >
                                  <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3">
                                    <div className="font-semibold text-orange-700">
                                      {block.title}
                                    </div>
                                    {block.description && (
                                      <p className="mt-1 text-sm text-orange-700/80">
                                        {block.description}
                                      </p>
                                    )}
                                  </div>
                                  <div className="space-y-3">
                                    {block.items.map((item) =>
                                      renderReverseChecklistItem(item),
                                    )}
                                  </div>
                                </div>
                              ))}
                            </CardContent>
                          </Card>
                        )}

                        {reverseCompleted && reverseComparison && (
                          <Card className="border-gray-200 dark:border-gray-700">
                            <CardHeader>
                              <CardTitle className="text-base">
                                Comparativo da monitoria invertida
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
                                  <div className="text-xs uppercase tracking-[0.16em] text-orange-600">
                                    Nota do operador
                                  </div>
                                  <div className="mt-2 text-3xl font-bold text-orange-700">
                                    {reverseChecklistMetrics.finalScore}
                                  </div>
                                  <div className="mt-1 text-sm text-orange-700/80">
                                    {reverseChecklistMetrics.percentage}% de
                                    aderência
                                  </div>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                  <div className="text-xs uppercase tracking-[0.16em] text-slate-600">
                                    Nota do monitor
                                  </div>
                                  <div className="mt-2 text-3xl font-bold text-slate-800">
                                    {selectedReverseFeedback.pontuacao}
                                  </div>
                                  <div className="mt-1 text-sm text-slate-600">
                                    {reverseComparison.storedChecklist.metrics
                                      ?.percentage ?? 0}
                                    % de aderência
                                  </div>
                                </div>
                                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                                  <div className="text-xs uppercase tracking-[0.16em] text-emerald-600">
                                    Acertos iguais
                                  </div>
                                  <div className="mt-2 text-3xl font-bold text-emerald-700">
                                    {reverseComparison.matchedCount}
                                  </div>
                                </div>
                                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                                  <div className="text-xs uppercase tracking-[0.16em] text-rose-600">
                                    Divergências
                                  </div>
                                  <div className="mt-2 text-3xl font-bold text-rose-700">
                                    {reverseComparison.divergenceCount}
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-6">
                                {selectedReverseChecklist.blocks.map(
                                  (block) => {
                                    const blockItems =
                                      reverseComparison.items.filter(
                                        (item) => item.blockId === block.id,
                                      );

                                    return (
                                      <div
                                        key={`reverse-compare-block-${block.id}`}
                                        className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-4"
                                      >
                                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                          <div className="font-semibold text-slate-900">
                                            {block.title}
                                          </div>
                                        </div>

                                        <div className="space-y-3">
                                          {blockItems.map((item) => {
                                            const answerLabel = (
                                              answer: ReverseComparisonItem["operatorAnswer"],
                                              prefix: string,
                                            ) => {
                                              if (answer === "ncg") return `${prefix}: Aplicou NCG`;
                                              if (answer === "no_ncg") return `${prefix}: Não aplicou NCG`;
                                              if (answer === "yes") return `${prefix}: Conforme`;
                                              if (answer === "na") return `${prefix}: Não se aplica`;
                                              return `${prefix}: Não conforme`;
                                            };
                                            const operatorLabel = answerLabel(
                                              item.operatorAnswer,
                                              "Operador marcou",
                                            );
                                            const monitorLabel = answerLabel(
                                              item.monitorAnswer,
                                              "Monitor marcou",
                                            );

                                            return (
                                              <div
                                                key={`reverse-compare-item-${item.itemId}`}
                                                className={`rounded-2xl border p-4 ${
                                                  item.matches
                                                    ? "border-emerald-200 bg-emerald-50"
                                                    : "border-rose-200 bg-rose-50"
                                                }`}
                                              >
                                                <div className="flex items-start justify-between gap-3">
                                                  <div>
                                                    <div
                                                      className={`font-semibold ${
                                                        item.matches
                                                          ? "text-emerald-800"
                                                          : "text-rose-800"
                                                      }`}
                                                    >
                                                      {item.itemTitle}
                                                    </div>
                                                    <div
                                                      className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                                        item.matches
                                                          ? "bg-emerald-100 text-emerald-700"
                                                          : "bg-rose-100 text-rose-700"
                                                      }`}
                                                    >
                                                      {item.matches
                                                        ? "Ambos marcaram igual"
                                                        : "Operador marcou diferente"}
                                                    </div>
                                                  </div>
                                                  <Badge
                                                    className={
                                                      item.matches
                                                        ? "bg-emerald-600 text-white hover:bg-emerald-600"
                                                        : "bg-rose-600 text-white hover:bg-rose-600"
                                                    }
                                                  >
                                                    {item.severe
                                                      ? "NCG"
                                                      : "Checklist"}
                                                  </Badge>
                                                </div>

                                                <div
                                                  className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-medium ${
                                                    item.matches
                                                      ? "border-emerald-200 bg-white text-emerald-700"
                                                      : "border-rose-200 bg-white text-rose-700"
                                                  }`}
                                                >
                                                  {operatorLabel}
                                                </div>

                                                {!item.matches && (
                                                  <div className="mt-3 rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-medium text-emerald-700">
                                                    {monitorLabel}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  },
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="monitor" className="mt-8">
              <div className="space-y-8">
                <div className="rounded-[28px] bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_32%),linear-gradient(135deg,_#0f172a,_#1e293b)] p-6 text-white">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <h2 className="text-2xl font-semibold">
                        Painel dos monitores de teleatendimento
                      </h2>
                      <p className="mt-2 max-w-3xl text-sm text-slate-200">
                        Visão consolidada de todos os monitores com volume
                        diário, semanal, mensal e qualidade média das
                        monitorias.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      <div className="rounded-2xl bg-white/10 p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-300">
                          Monitores
                        </div>
                        <div className="mt-2 text-2xl font-bold">
                          {loadingMonitorAnalytics
                            ? "..."
                            : (monitorAnalyticsData?.resumo.total_monitores ??
                              0)}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-white/10 p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-300">
                          Hoje
                        </div>
                        <div className="mt-2 text-2xl font-bold">
                          {loadingMonitorAnalytics
                            ? "..."
                            : (monitorAnalyticsData?.resumo.monitorias_dia ??
                              0)}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-white/10 p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-300">
                          Semana
                        </div>
                        <div className="mt-2 text-2xl font-bold">
                          {loadingMonitorAnalytics
                            ? "..."
                            : (monitorAnalyticsData?.resumo.monitorias_semana ??
                              0)}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-white/10 p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-300">
                          Mês
                        </div>
                        <div className="mt-2 text-2xl font-bold">
                          {loadingMonitorAnalytics
                            ? "..."
                            : (monitorAnalyticsData?.resumo.monitorias_mes ??
                              0)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <Card className="border-slate-200 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-950/60">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Users className="h-4 w-4" />
                      Buscar monitora
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          value={monitorSearchTerm}
                          onChange={(e) => setMonitorSearchTerm(e.target.value)}
                          placeholder="Buscar monitora por nome..."
                          className="h-12 rounded-2xl border-slate-200 bg-slate-50 pl-9 text-slate-900 placeholder:text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                        {monitorSearchTerm.trim()
                          ? `${filteredMonitors.length} resultado(s)`
                          : "Digite um nome"}
                      </div>
                    </div>

                    {loadingMonitorAnalytics ? (
                      <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                        Carregando monitores...
                      </div>
                    ) : !monitorAnalyticsData?.monitores?.length ? (
                      <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                        Nenhum monitor de teleatendimento encontrado.
                      </div>
                    ) : !monitorSearchTerm.trim() ? (
                      <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/80 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900/50">
                        <Users className="mx-auto mb-4 h-10 w-10 text-slate-400 dark:text-slate-500" />
                        <div className="text-base font-medium text-slate-700 dark:text-slate-200">
                          Busque pelo nome da monitora
                        </div>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                          Nenhuma lista é exibida antes da pesquisa.
                        </p>
                      </div>
                    ) : filteredMonitors.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                        Nenhuma monitora encontrada para a busca informada.
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {filteredMonitors.map((monitor) => {
                          const tone = getScoreTone(monitor.media_mensal);
                          return (
                            <button
                              key={monitor.monitor_nome}
                              type="button"
                              onClick={() =>
                                loadMonitorFeedbacks(monitor.monitor_nome)
                              }
                              className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-sky-300 hover:bg-white dark:border-slate-800 dark:bg-slate-900 dark:hover:border-sky-700 dark:hover:bg-slate-950"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
                                    {monitor.monitor_nome}
                                  </div>
                                  <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    {monitor.total_monitorias} monitoria(s) no
                                    histórico
                                  </div>
                                </div>
                                <Badge className={tone.chip}>
                                  {tone.label}
                                </Badge>
                              </div>

                              <div className="mt-4 grid grid-cols-3 gap-2">
                                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-center dark:border-slate-800 dark:bg-slate-950">
                                  <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                                    Dia
                                  </div>
                                  <div className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                                    {monitor.monitorias_dia}
                                  </div>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-center dark:border-slate-800 dark:bg-slate-950">
                                  <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                                    Semana
                                  </div>
                                  <div className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                                    {monitor.monitorias_semana}
                                  </div>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-center dark:border-slate-800 dark:bg-slate-950">
                                  <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                                    Mês
                                  </div>
                                  <div className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                                    {monitor.monitorias_mes}
                                  </div>
                                </div>
                              </div>

                              <div className="mt-4 flex items-center justify-between gap-3">
                                <div className="text-sm text-slate-500 dark:text-slate-400">
                                  Média mensal
                                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                                    {formatAverage(monitor.media_mensal)}
                                  </div>
                                </div>
                                <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300">
                                  Abrir monitorias
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="analytics" className="mt-8">
              <div className="space-y-8">
                <div className="space-y-6">
                  <div className="rounded-[28px] bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.18),_transparent_32%),linear-gradient(135deg,_#0f172a,_#1e293b)] p-6 text-white">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                      <div>
                        <h2 className="text-2xl font-semibold">
                          Analytics de evolução da monitoria
                        </h2>
                        <p className="mt-2 max-w-3xl text-sm text-slate-200">
                          Acompanhe a média da carteira, os ofensores mais
                          frequentes e a evolução individual dos operadores em
                          gráficos.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        <div className="rounded-2xl bg-white/10 p-4">
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-300">
                            Enviados
                          </div>
                          <div className="mt-2 text-2xl font-bold">
                            {loadingStats ? "..." : stats?.total_enviados || 0}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-white/10 p-4">
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-300">
                            Lidos
                          </div>
                          <div className="mt-2 text-2xl font-bold">
                            {loadingStats ? "..." : stats?.total_lidos || 0}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-white/10 p-4">
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-300">
                            Positivos
                          </div>
                          <div className="mt-2 text-2xl font-bold">
                            {loadingStats ? "..." : stats?.total_positivos || 0}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-white/10 p-4">
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-300">
                            Taxa leitura
                          </div>
                          <div className="mt-2 text-2xl font-bold">
                            {loadingStats
                              ? "..."
                              : `${stats?.taxa_leitura || 0}%`}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Card className="border-gray-200 dark:border-gray-700">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Building2 className="h-4 w-4" />
                        Escolha a carteira para acompanhar
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {runtimeWallets.map((wallet) => (
                          <button
                            key={`analytics-${wallet.id}`}
                            type="button"
                            onClick={() => setAnalyticsWalletId(wallet.id)}
                            className={`rounded-3xl border p-5 text-left transition-all ${
                              analyticsWalletId === wallet.id
                                ? "border-orange-400 ring-2 ring-orange-200"
                                : "border-gray-200 hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-700"
                            } ${wallet.cardClassName}`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div
                                className={`inline-flex rounded-2xl bg-gradient-to-r px-4 py-2 text-sm font-bold tracking-[0.18em] text-white ${wallet.accentClassName}`}
                              >
                                {wallet.shortLabel}
                              </div>
                              {wallet.logoSrc ? (
                                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-3xl border-2 border-white/80 bg-white p-3 shadow-md ring-4 ring-white/40">
                                  <img
                                    src={wallet.logoSrc}
                                    alt={wallet.logoAlt || wallet.label}
                                    className="h-full w-full object-contain"
                                  />
                                </div>
                              ) : (
                                <div className="flex h-16 w-16 items-center justify-center rounded-3xl border-2 border-white/70 bg-white/80 text-slate-500 shadow-md ring-4 ring-white/40">
                                  <Building2 className="h-7 w-7" />
                                </div>
                              )}
                            </div>
                            <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
                              {wallet.label}
                            </h3>
                            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                              {wallet.description}
                            </p>
                            <div className="mt-4 flex flex-wrap gap-2">
                              {wallet.channels.map((channel) => (
                                <Badge
                                  key={channel.id}
                                  variant="outline"
                                  className="rounded-full"
                                >
                                  {channel.label}
                                </Badge>
                              ))}
                            </div>
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {selectedAnalyticsWallet && (
                    <div className="space-y-6">
                      <div className="space-y-6">
                        <Card className="border-gray-200 dark:border-gray-700">
                          <CardHeader>
                            <CardTitle className="text-base">
                              Canal de atendimento
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant={
                                analyticsChannelId === "all"
                                  ? "default"
                                  : "outline"
                              }
                              className={
                                analyticsChannelId === "all"
                                  ? "bg-orange-500 hover:bg-orange-600"
                                  : ""
                              }
                              onClick={() => setAnalyticsChannelId("all")}
                            >
                              Todos os canais
                            </Button>
                            {selectedAnalyticsWallet.channels.map((channel) => (
                              <Button
                                key={`analytics-channel-${channel.id}`}
                                type="button"
                                variant={
                                  analyticsChannelId === channel.id
                                    ? "default"
                                    : "outline"
                                }
                                className={
                                  analyticsChannelId === channel.id
                                    ? "bg-orange-500 hover:bg-orange-600"
                                    : ""
                                }
                                onClick={() =>
                                  setAnalyticsChannelId(channel.id)
                                }
                              >
                                {channel.label}
                              </Button>
                            ))}
                            </div>
                          </CardContent>
                        </Card>

                      <div className="rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),_transparent_32%),linear-gradient(135deg,_rgba(255,255,255,0.95),_rgba(248,250,252,0.98))] p-5 shadow-sm dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.14),_transparent_28%),linear-gradient(135deg,_rgba(15,23,42,0.96),_rgba(2,6,23,0.98))]">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="max-w-3xl">
                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                              <Sparkles className="h-4 w-4" />
                              Visão executiva da carteira
                            </div>
                            <h3 className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">
                              {selectedAnalyticsWallet.label}
                            </h3>
                            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                              Consolidação da carteira para leitura gerencial:
                              média atual, principal ofensor e evolução dos
                              pontos mais sensíveis no período selecionado.
                            </p>
                          </div>
                          {walletComparisonSummary && (
                            <div
                              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${getTrendPresentation(walletComparisonSummary.trend).toneClass}`}
                            >
                              {React.createElement(
                                getTrendPresentation(walletComparisonSummary.trend)
                                  .icon,
                                {
                                  className: "h-4 w-4",
                                },
                              )}
                              {getTrendPresentation(walletComparisonSummary.trend)
                                .label}
                            </div>
                          )}
                        </div>

                        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                          {analyticsExecutiveHighlights.map((highlight) =>
                            renderExecutiveHighlight(
                              highlight.title,
                              highlight.value,
                              highlight.caption,
                              highlight.tone,
                              highlight.title,
                            ),
                          )}
                        </div>
                      </div>

                      <Card className="border-gray-200 dark:border-gray-700">
                        <CardHeader>
                          <div className="flex flex-col gap-5">
                            <div>
                              <CardTitle className="flex items-center gap-2 text-base">
                                <TrendingUp className="h-4 w-4" />
                                Média da carteira{" "}
                                {selectedAnalyticsWallet.label}
                              </CardTitle>
                              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                Comparativo diário, semanal e mensal da média de
                                monitoria da carteira.
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/70">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                  setAnalyticsCompareModal("wallet")
                                }
                              >
                                <Clock3 className="mr-2 h-4 w-4" />
                                Comparativo
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={exportWalletAverageAnalytics}
                                disabled={!walletAverageData?.series?.length}
                              >
                                <Download className="mr-2 h-4 w-4" />
                                Exportar Excel
                              </Button>
                              {(
                                [
                                  "diario",
                                  "semanal",
                                  "mensal",
                                ] as AnalyticsPeriod[]
                              ).map((period) => (
                                <Button
                                  key={`wallet-period-${period}`}
                                  type="button"
                                  variant={
                                    walletAveragePeriod === period
                                      ? "default"
                                      : "outline"
                                  }
                                  className={
                                    walletAveragePeriod === period
                                      ? "bg-orange-500 hover:bg-orange-600"
                                      : ""
                                  }
                                  onClick={() => setWalletAveragePeriod(period)}
                                >
                                  {period === "diario"
                                    ? "Diário"
                                    : period === "semanal"
                                      ? "Semanal"
                                      : "Mensal"}
                                </Button>
                              ))}
                              {(
                                [
                                  [
                                    "linha",
                                    <LineChartIcon
                                      className="h-4 w-4"
                                      key="line"
                                    />,
                                  ],
                                  [
                                    "coluna",
                                    <BarChart3 className="h-4 w-4" key="bar" />,
                                  ],
                                  [
                                    "area",
                                    <AreaChartIcon
                                      className="h-4 w-4"
                                      key="area"
                                    />,
                                  ],
                                  [
                                    "pizza",
                                    <PieChartIcon
                                      className="h-4 w-4"
                                      key="pie"
                                    />,
                                  ],
                                ] as [AnalyticsChartType, React.ReactNode][]
                              ).map(([type, icon]) => (
                                <Button
                                  key={`wallet-chart-${type}`}
                                  type="button"
                                  variant={
                                    walletAverageChartType === type
                                      ? "default"
                                      : "outline"
                                  }
                                  className={
                                    walletAverageChartType === type
                                      ? "bg-slate-900 hover:bg-slate-800"
                                      : ""
                                  }
                                  onClick={() =>
                                    setWalletAverageChartType(type)
                                  }
                                >
                                  {icon}
                                </Button>
                              ))}
                            </div>
                          </div>
                          </CardHeader>
                          <CardContent className="space-y-7">
                          {walletComparisonSummary && (
                            <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/80">
                              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                                    Leitura do período
                                  </div>
                                  <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                                    {walletComparisonSummary.currentLabel} teve
                                    média{" "}
                                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                                      {formatAverage(
                                        walletComparisonSummary.currentValue,
                                      )}
                                    </span>{" "}
                                    contra{" "}
                                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                                      {formatAverage(
                                        walletComparisonSummary.previousValue,
                                      )}
                                    </span>{" "}
                                    no período anterior.
                                  </div>
                                </div>
                                <div
                                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${getTrendPresentation(walletComparisonSummary.trend).toneClass}`}
                                >
                                  {React.createElement(
                                    getTrendPresentation(walletComparisonSummary.trend)
                                      .icon,
                                    {
                                      className: "h-4 w-4",
                                    },
                                  )}
                                  {walletComparisonSummary.trend === "estavel"
                                    ? "Sem mudança relevante"
                                    : `${formatPercent(walletComparisonSummary.deltaPercent)}% ${getTrendPresentation(walletComparisonSummary.trend).label.toLowerCase()}`}
                                </div>
                              </div>
                            </div>
                          )}

                            <div className="grid gap-4 md:grid-cols-3">
                            <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
                              <div className="text-xs uppercase tracking-[0.16em] text-orange-600">
                                Média geral
                              </div>
                              <div className="mt-2 text-3xl font-bold text-orange-700">
                                {loadingWalletAverage
                                  ? "..."
                                  : (walletAverageData?.resumo.media_geral ??
                                    0)}
                              </div>
                            </div>
                            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                              <div className="text-xs uppercase tracking-[0.16em] text-sky-600">
                                Monitorias
                              </div>
                              <div className="mt-2 text-3xl font-bold text-sky-700">
                                {loadingWalletAverage
                                  ? "..."
                                  : (walletAverageData?.resumo
                                      .total_feedbacks ?? 0)}
                              </div>
                            </div>
                            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                              <div className="text-xs uppercase tracking-[0.16em] text-emerald-600">
                                Operadores avaliados
                              </div>
                              <div className="mt-2 text-3xl font-bold text-emerald-700">
                                {loadingWalletAverage
                                  ? "..."
                                  : (walletAverageData?.resumo
                                      .operadores_avaliados ?? 0)}
                              </div>
                            </div>
                          </div>
                          {loadingWalletAverage ? (
                            <div className="flex h-[380px] items-center justify-center text-sm text-gray-500">
                              Carregando gráfico da carteira...
                            </div>
                          ) : walletAverageData?.series?.length ? (
                            renderTrendChart(
                              walletAverageData.series,
                              walletAverageChartType,
                              "media",
                              "#f97316",
                            )
                          ) : (
                            <div className="flex h-[380px] items-center justify-center rounded-2xl border border-dashed border-gray-300 text-sm text-gray-500">
                              Ainda não há dados suficientes para essa carteira.
                            </div>
                          )}
                          </CardContent>
                        </Card>

                        <Card className="border-gray-200 dark:border-gray-700">
                          <CardHeader>
                          <div className="flex flex-col gap-5">
                            <div>
                              <CardTitle className="flex items-center gap-2 text-base">
                                <AlertTriangle className="h-4 w-4" />
                                Ofensores da carteira
                              </CardTitle>
                              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                Itens que mais deixam de ser feitos ou recebem
                                NCG na carteira selecionada.
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/70">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                  setAnalyticsCompareModal("offenders")
                                }
                              >
                                <Clock3 className="mr-2 h-4 w-4" />
                                Comparativo
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={exportWalletOffendersAnalytics}
                                disabled={!offenderData?.series?.length}
                              >
                                <Download className="mr-2 h-4 w-4" />
                                Exportar Excel
                              </Button>
                              {(
                                [
                                  "diario",
                                  "semanal",
                                  "mensal",
                                ] as AnalyticsPeriod[]
                              ).map((period) => (
                                <Button
                                  key={`offender-period-${period}`}
                                  type="button"
                                  variant={
                                    offendersPeriod === period
                                      ? "default"
                                      : "outline"
                                  }
                                  className={
                                    offendersPeriod === period
                                      ? "bg-orange-500 hover:bg-orange-600"
                                      : ""
                                  }
                                  onClick={() => setOffendersPeriod(period)}
                                >
                                  {period === "diario"
                                    ? "Diário"
                                    : period === "semanal"
                                      ? "Semanal"
                                      : "Mensal"}
                                </Button>
                              ))}
                              {(
                                [
                                  [
                                    "coluna",
                                    <BarChart3 className="h-4 w-4" key="bar" />,
                                  ],
                                  [
                                    "linha",
                                    <LineChartIcon
                                      className="h-4 w-4"
                                      key="line"
                                    />,
                                  ],
                                  [
                                    "area",
                                    <AreaChartIcon
                                      className="h-4 w-4"
                                      key="area"
                                    />,
                                  ],
                                  [
                                    "pizza",
                                    <PieChartIcon
                                      className="h-4 w-4"
                                      key="pie"
                                    />,
                                  ],
                                ] as [AnalyticsChartType, React.ReactNode][]
                              ).map(([type, icon]) => (
                                <Button
                                  key={`offender-chart-${type}`}
                                  type="button"
                                  variant={
                                    offendersChartType === type
                                      ? "default"
                                      : "outline"
                                  }
                                  className={
                                    offendersChartType === type
                                      ? "bg-slate-900 hover:bg-slate-800"
                                      : ""
                                  }
                                  onClick={() => setOffendersChartType(type)}
                                >
                                  {icon}
                                </Button>
                              ))}
                            </div>
                          </div>
                          </CardHeader>
                          <CardContent className="space-y-7">
                          {!!offenderData?.itens_comparativo?.length && (
                            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                              <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/80">
                                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                                  Radar gerencial dos ofensores
                                </div>
                                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                  {renderExecutiveHighlight(
                                    "Melhoraram",
                                    `${offenderExecutiveSummary.improvedCount}`,
                                    "itens com queda de ofensor no comparativo",
                                    "positive",
                                  )}
                                  {renderExecutiveHighlight(
                                    "Pioraram",
                                    `${offenderExecutiveSummary.worsenedCount}`,
                                    "itens com aumento de ofensor no comparativo",
                                    "negative",
                                  )}
                                  {renderExecutiveHighlight(
                                    "Estáveis",
                                    `${offenderExecutiveSummary.stableCount}`,
                                    "itens sem mudança relevante",
                                    "neutral",
                                  )}
                                </div>
                              </div>

                              <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                                  Destaques do comparativo
                                </div>
                                <div className="mt-4 space-y-3">
                                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950/30">
                                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-600 dark:text-rose-300">
                                      Maior piora
                                    </div>
                                    <div className="mt-2 text-base font-semibold text-rose-900 dark:text-rose-100">
                                      {offenderExecutiveSummary.topWorsened?.label ||
                                        "Nenhuma piora relevante"}
                                    </div>
                                    <div className="mt-1 text-sm text-rose-700 dark:text-rose-200">
                                      {offenderExecutiveSummary.topWorsened
                                        ? `${formatPercent(
                                            Math.abs(
                                              offenderExecutiveSummary
                                                .topWorsened.delta_percentual,
                                            ),
                                          )} p.p. acima do período anterior`
                                        : "Os ofensores não tiveram avanço crítico no período."}
                                    </div>
                                  </div>
                                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
                                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-300">
                                      Maior evolução
                                    </div>
                                    <div className="mt-2 text-base font-semibold text-emerald-900 dark:text-emerald-100">
                                      {offenderExecutiveSummary.topImproved?.label ||
                                        "Nenhuma melhora relevante"}
                                    </div>
                                    <div className="mt-1 text-sm text-emerald-700 dark:text-emerald-200">
                                      {offenderExecutiveSummary.topImproved
                                        ? `${formatPercent(
                                            Math.abs(
                                              offenderExecutiveSummary
                                                .topImproved.delta_percentual,
                                            ),
                                          )} p.p. abaixo do período anterior`
                                        : "Ainda não há queda expressiva de ofensores para destacar."}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                              <div className="text-xs uppercase tracking-[0.16em] text-rose-600">
                                Ocorrências
                              </div>
                              <div className="mt-2 text-3xl font-bold text-rose-700">
                                {loadingOffenders
                                  ? "..."
                                  : (offenderData?.resumo.total_ocorrencias ??
                                    0)}
                              </div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                              <div className="text-xs uppercase tracking-[0.16em] text-slate-600">
                                Feedbacks analisados
                              </div>
                              <div className="mt-2 text-3xl font-bold text-slate-700">
                                {loadingOffenders
                                  ? "..."
                                  : (offenderData?.resumo.total_feedbacks ?? 0)}
                              </div>
                            </div>
                            <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
                              <div className="text-xs uppercase tracking-[0.16em] text-orange-600">
                                Taxa de sucesso
                              </div>
                              <div className="mt-2 text-3xl font-bold text-orange-700">
                                {loadingOffenders
                                  ? "..."
                                  : `${formatPercent(
                                      offenderData?.resumo.taxa_sucesso ?? 0,
                                    )}%`}
                              </div>
                            </div>
                            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                              <div className="text-xs uppercase tracking-[0.16em] text-sky-600">
                                Ocorrências por feedback
                              </div>
                              <div className="mt-2 text-3xl font-bold text-sky-700">
                                {loadingOffenders
                                  ? "..."
                                  : formatAverage(
                                      offenderData?.resumo
                                        .ocorrencias_por_feedback ?? 0,
                                    )}
                              </div>
                            </div>
                          </div>
                          {loadingOffenders ? (
                            <div className="flex h-[380px] items-center justify-center text-sm text-gray-500">
                              Carregando gráfico de ofensores...
                            </div>
                          ) : offenderData?.series?.length ? (
                            renderOffenderChart(
                              offenderData.series,
                              offendersChartType,
                            )
                          ) : (
                            <div className="flex h-[380px] items-center justify-center rounded-2xl border border-dashed border-gray-300 text-sm text-gray-500">
                              Ainda não há ofensores consolidados para esse
                              período.
                            </div>
                          )}
                          </CardContent>
                        </Card>
                      </div>

                      <Card className="border-gray-200 dark:border-gray-700">
                        <CardHeader>
                          <div className="flex flex-col gap-5">
                            <div>
                              <CardTitle className="flex items-center gap-2 text-base">
                                <Users className="h-4 w-4" />
                                Evolução individual do operador
                              </CardTitle>
                              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                Acompanhe a média de monitoria do operador e
                                exporte a evolução para Excel.
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                  setAnalyticsCompareModal("operator")
                                }
                                disabled={!selectedAnalyticsOperatorCpf}
                              >
                                <Clock3 className="mr-2 h-4 w-4" />
                                Comparativo
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={exportOperatorAnalytics}
                                disabled={!operatorAverageData?.series?.length}
                              >
                                <Download className="mr-2 h-4 w-4" />
                                Exportar Excel
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-7">
                          <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-700 dark:bg-gray-800/60">
                              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                                Operadores da carteira
                              </div>
                              <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
                                {loadingAnalyticsOperators ? (
                                  <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">
                                    Carregando operadores...
                                  </div>
                                ) : analyticsOperators.length === 0 ? (
                                  <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">
                                    Nenhum operador com feedback nessa carteira.
                                  </div>
                                ) : (
                                  analyticsOperators.map((operator) => (
                                    <button
                                      key={`analytics-operator-${operator.cpf}`}
                                      type="button"
                                      onClick={() =>
                                        setSelectedAnalyticsOperatorCpf(
                                          operator.cpf,
                                        )
                                      }
                                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                                        selectedAnalyticsOperatorCpf ===
                                        operator.cpf
                                          ? "border-orange-400 bg-white shadow-sm"
                                          : "border-gray-200 bg-white/70 hover:bg-white"
                                      }`}
                                    >
                                      <div className="font-semibold text-gray-900">
                                        {operator.nome}
                                      </div>
                                      <div className="mt-1 text-xs text-gray-500">
                                        {operator.total_feedbacks} feedback(s) •
                                        média {operator.media_pontuacao}
                                      </div>
                                    </button>
                                  ))
                                )}
                              </div>
                            </div>

                            <div className="space-y-4">
                              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/70">
                                {(
                                  [
                                    "diario",
                                    "semanal",
                                    "mensal",
                                  ] as AnalyticsPeriod[]
                                ).map((period) => (
                                  <Button
                                    key={`operator-period-${period}`}
                                    type="button"
                                    variant={
                                      operatorPeriod === period
                                        ? "default"
                                        : "outline"
                                    }
                                    className={
                                      operatorPeriod === period
                                        ? "bg-orange-500 hover:bg-orange-600"
                                        : ""
                                    }
                                    onClick={() => setOperatorPeriod(period)}
                                  >
                                    {period === "diario"
                                      ? "Diário"
                                      : period === "semanal"
                                        ? "Semanal"
                                        : "Mensal"}
                                  </Button>
                                ))}
                                {(
                                  [
                                    [
                                      "linha",
                                      <LineChartIcon
                                        className="h-4 w-4"
                                        key="line"
                                      />,
                                    ],
                                    [
                                      "coluna",
                                      <BarChart3
                                        className="h-4 w-4"
                                        key="bar"
                                      />,
                                    ],
                                    [
                                      "area",
                                      <AreaChartIcon
                                        className="h-4 w-4"
                                        key="area"
                                      />,
                                    ],
                                    [
                                      "pizza",
                                      <PieChartIcon
                                        className="h-4 w-4"
                                        key="pie"
                                      />,
                                    ],
                                  ] as [AnalyticsChartType, React.ReactNode][]
                                ).map(([type, icon]) => (
                                  <Button
                                    key={`operator-chart-${type}`}
                                    type="button"
                                    variant={
                                      operatorChartType === type
                                        ? "default"
                                        : "outline"
                                    }
                                    className={
                                      operatorChartType === type
                                        ? "bg-slate-900 hover:bg-slate-800"
                                        : ""
                                    }
                                    onClick={() => setOperatorChartType(type)}
                                  >
                                    {icon}
                                  </Button>
                                ))}
                              </div>

                              <div className="grid gap-4 md:grid-cols-2">
                                <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
                                  <div className="text-xs uppercase tracking-[0.16em] text-orange-600">
                                    Média do operador
                                  </div>
                                  <div className="mt-2 text-3xl font-bold text-orange-700">
                                    {loadingOperatorAverage
                                      ? "..."
                                      : (operatorAverageData?.resumo
                                          .media_geral ?? 0)}
                                  </div>
                                </div>
                                <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                                  <div className="text-xs uppercase tracking-[0.16em] text-sky-600">
                                    Feedbacks do operador
                                  </div>
                                  <div className="mt-2 text-3xl font-bold text-sky-700">
                                    {loadingOperatorAverage
                                      ? "..."
                                      : (operatorAverageData?.resumo
                                          .total_feedbacks ?? 0)}
                                  </div>
                                </div>
                              </div>

                              {loadingOperatorAverage ? (
                                <div className="flex h-[380px] items-center justify-center text-sm text-gray-500">
                                  Carregando evolução do operador...
                                </div>
                              ) : operatorAverageData?.series?.length ? (
                                renderTrendChart(
                                  operatorAverageData.series,
                                  operatorChartType,
                                  "media",
                                  "#3b82f6",
                                )
                              ) : (
                                <div className="flex h-[380px] items-center justify-center rounded-2xl border border-dashed border-gray-300 text-sm text-gray-500">
                                  Selecione um operador com dados para exibir a
                                  evolução.
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>

                <div>
                  <h2 className="mb-6 text-lg font-semibold text-gray-900 dark:text-white">
                    Histórico enviado
                  </h2>

                  <Card className="mb-6 border-gray-200 dark:border-gray-700">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Filter className="h-4 w-4" />
                        Filtros
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div>
                          <Label
                            htmlFor="filterOperator"
                            className="text-sm font-medium"
                          >
                            Nome do Operador
                          </Label>
                          <Input
                            id="filterOperator"
                            placeholder="Filtrar por operador..."
                            value={filterOperator}
                            onChange={(e) => setFilterOperator(e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label
                            htmlFor="filterEC"
                            className="text-sm font-medium"
                          >
                            EC / Call ID da Ligação
                          </Label>
                          <Input
                            id="filterEC"
                            placeholder="Filtrar por EC ou Call ID..."
                            value={filterEC}
                            onChange={(e) => setFilterEC(e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div className="flex items-end">
                          <Button
                            variant="outline"
                            onClick={clearFilters}
                            className="w-full"
                          >
                            Limpar Filtros
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-gray-200 dark:border-gray-700">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="h-5 w-5" />
                          Feedbacks ({filteredFeedbacks.length})
                        </div>
                        {filteredFeedbacks.length > feedbacksPerPage && (
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            Página {currentPage} de {totalPages}
                          </div>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {getCurrentPageFeedbacks().length === 0 ? (
                          <div className="py-12 text-center text-gray-500 dark:text-gray-400">
                            <MessageSquare className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                            <p>Nenhum feedback encontrado</p>
                          </div>
                        ) : (
                          getCurrentPageFeedbacks().map((feedback) => (
                            <div
                              key={feedback.id}
                              className="rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <div className="mb-2 flex items-center gap-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
                                      <User className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                                    </div>
                                    <span className="font-semibold text-gray-900 dark:text-white">
                                      {feedback.operador}
                                    </span>
                                    <Badge
                                      variant={
                                        feedback.is_positivo
                                          ? "default"
                                          : "destructive"
                                      }
                                      className={
                                        feedback.is_positivo
                                          ? "bg-green-100 text-green-800 hover:bg-green-100"
                                          : "bg-red-100 text-red-800 hover:bg-red-100"
                                      }
                                    >
                                      {feedback.is_positivo
                                        ? "Positivo"
                                        : "Negativo"}
                                    </Badge>
                                    <div className="flex items-center gap-1">
                                      {feedback.lido ? (
                                        <Eye className="h-4 w-4 text-green-500" />
                                      ) : (
                                        <EyeOff className="h-4 w-4 text-gray-400" />
                                      )}
                                      <span className="text-xs text-gray-500">
                                        {feedback.lido ? "Lido" : "Não lido"}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="mb-2 text-sm text-gray-600 dark:text-gray-400">
                                    <span className="font-medium">EC:</span>{" "}
                                    {feedback.id_ligacao || "N/A"}
                                  </div>
                                  <div className="mb-2 text-sm text-gray-600 dark:text-gray-400">
                                    <span className="font-medium">
                                      Call ID:
                                    </span>{" "}
                                    {feedback.call_id || "N/A"}
                                  </div>
                                  {feedback.tempo_ligacao_total && (
                                    <div className="mb-2 text-sm text-gray-600 dark:text-gray-400">
                                      <span className="font-medium">
                                        Tempo:
                                      </span>{" "}
                                      {feedback.tempo_ligacao_total}
                                    </div>
                                  )}

                                  <p className="mb-2 line-clamp-2 whitespace-pre-line text-gray-600 dark:text-gray-400">
                                    {feedback.descricao}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {formatDate(feedback.data_hora)}
                                  </p>
                                </div>

                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    openFeedbackDetail(feedback.id)
                                  }
                                >
                                  <Eye className="mr-1 h-4 w-4" />
                                  Ver
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {totalPages > 1 && (
                        <div className="mt-6 flex items-center justify-center gap-2 border-t border-gray-200 pt-4 dark:border-gray-700">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setCurrentPage((prev) => Math.max(1, prev - 1))
                            }
                            disabled={currentPage === 1}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>

                          <div className="flex gap-1">
                            {Array.from(
                              { length: Math.min(5, totalPages) },
                              (_, i) => {
                                const pageNum = i + 1;
                                return (
                                  <Button
                                    key={pageNum}
                                    variant={
                                      currentPage === pageNum
                                        ? "default"
                                        : "outline"
                                    }
                                    size="sm"
                                    onClick={() => setCurrentPage(pageNum)}
                                    className={
                                      currentPage === pageNum
                                        ? "bg-orange-500 hover:bg-orange-600"
                                        : ""
                                    }
                                  >
                                    {pageNum}
                                  </Button>
                                );
                              },
                            )}
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setCurrentPage((prev) =>
                                Math.min(totalPages, prev + 1),
                              )
                            }
                            disabled={currentPage === totalPages}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="manage" className="mt-8">
              <QualityChecklistManager
                token={token}
                onChanged={refreshRuntimeChecklists}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {renderAnalyticsComparisonModal()}

      {showMonitorFeedbacksModal && selectedMonitorName && (
        <div className="fixed inset-0 z-[998] flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-sm sm:p-4">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
            <div className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.22),_transparent_28%),linear-gradient(135deg,_#0f172a,_#1e293b)] p-5 text-white dark:border-slate-800">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-300">
                    Monitorias da monitora
                  </div>
                  <h3 className="mt-2 truncate text-2xl font-semibold">
                    {selectedMonitorName}
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm text-slate-200">
                    Abra um feedback para ver os pontos avaliados, com filtros
                    por período e operador monitorado.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowMonitorFeedbacksModal(false)}
                  className="self-start border border-white/10 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {selectedMonitorAnalytics && (
                <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <div className="rounded-2xl bg-white/10 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-300">
                      Total
                    </div>
                    <div className="mt-2 text-2xl font-bold">
                      {selectedMonitorAnalytics.total_monitorias}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-300">
                      Mês
                    </div>
                    <div className="mt-2 text-2xl font-bold">
                      {selectedMonitorAnalytics.monitorias_mes}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-300">
                      Média mensal
                    </div>
                    <div className="mt-2 text-2xl font-bold">
                      {formatAverage(selectedMonitorAnalytics.media_mensal)}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-300">
                      Positivas
                    </div>
                    <div className="mt-2 text-2xl font-bold">
                      {selectedMonitorAnalytics.positivas}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="max-h-[calc(92vh-220px)] overflow-y-auto p-4 sm:p-6">
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto_auto]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={selectedMonitorFeedbackOperatorFilter}
                    onChange={(e) =>
                      setSelectedMonitorFeedbackOperatorFilter(e.target.value)
                    }
                    placeholder="Buscar operador monitorado..."
                    className="h-12 rounded-2xl border-slate-200 bg-slate-50 pl-9 dark:border-slate-800 dark:bg-slate-900"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["day", "Dia"],
                      ["week", "Semana"],
                      ["month", "Mês"],
                      ["all", "Todos"],
                    ] as [MonitorFeedbackPeriod, string][]
                  ).map(([period, label]) => (
                    <Button
                      key={`monitor-modal-period-${period}`}
                      type="button"
                      variant={
                        selectedMonitorFeedbackPeriod === period
                          ? "default"
                          : "outline"
                      }
                      className={
                        selectedMonitorFeedbackPeriod === period
                          ? "bg-sky-600 hover:bg-sky-700"
                          : "dark:border-slate-700 dark:bg-slate-900"
                      }
                      onClick={() => setSelectedMonitorFeedbackPeriod(period)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                <Button
                  type="button"
                  onClick={exportSelectedMonitorFeedbacks}
                  disabled={
                    exportingMonitorFeedbacks ||
                    loadingSelectedMonitorFeedbacks ||
                    selectedMonitorFilteredFeedbacks.length === 0
                  }
                  className="h-12 rounded-2xl bg-emerald-600 px-5 text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download className="mr-2 h-4 w-4" />
                  {exportingMonitorFeedbacks
                    ? "Gerando Excel..."
                    : "Exportar filtradas"}
                </Button>
              </div>

              <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  {selectedMonitorFilteredFeedbacks.length} feedback(s)
                  encontrado(s).
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  A planilha respeita os filtros atuais de período e operador,
                  com os itens completos do checklist e a nota final.
                </span>
              </div>

              <div className="mt-5">
                {loadingSelectedMonitorFeedbacks ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    Carregando feedbacks da monitora...
                  </div>
                ) : selectedMonitorFilteredFeedbacks.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    Nenhum feedback encontrado para os filtros aplicados.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedMonitorFilteredFeedbacks.map((feedback) => (
                      <button
                        key={`monitor-modal-feedback-${feedback.id}`}
                        type="button"
                        onClick={() =>
                          openFeedbackDetail(feedback.id, selectedMonitorName)
                        }
                        className="w-full rounded-[24px] border border-slate-200 bg-white p-4 text-left transition hover:border-sky-300 hover:bg-sky-50/40 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-sky-700 dark:hover:bg-slate-900"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {feedback.operador}
                              </span>
                              <Badge
                                variant={
                                  feedback.is_positivo
                                    ? "default"
                                    : "destructive"
                                }
                                className={
                                  feedback.is_positivo
                                    ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300"
                                    : "bg-rose-100 text-rose-800 hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-300"
                                }
                              >
                                {feedback.is_positivo ? "Positivo" : "Negativo"}
                              </Badge>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
                              <span>
                                Data: {formatDate(feedback.data_hora)}
                              </span>
                              <span>EC: {feedback.id_ligacao || "-"}</span>
                              <span>Call ID: {feedback.call_id || "-"}</span>
                              <span>Nota: {feedback.pontuacao ?? "-"}</span>
                              {feedback.tempo_ligacao_total && (
                                <span>
                                  Tempo: {feedback.tempo_ligacao_total}
                                </span>
                              )}
                            </div>
                            <p className="mt-3 line-clamp-2 whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">
                              {feedback.descricao}
                            </p>
                          </div>

                          <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300">
                            Abrir feedback
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showDetailModal && selectedFeedback && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <Card className="max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-[28px] border border-slate-200 shadow-2xl dark:border-slate-800">
            <CardHeader className="relative border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_28%),linear-gradient(135deg,_#0f172a,_#1e293b)] text-white dark:border-slate-800">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border border-white/10 bg-white/10 text-white hover:bg-white/10">
                    {selectedFeedback.monitor_nome || "Monitoria"}
                  </Badge>
                  <Badge
                    className={
                      selectedFeedback.is_positivo
                        ? "bg-emerald-500 text-white hover:bg-emerald-500"
                        : "bg-rose-500 text-white hover:bg-rose-500"
                    }
                  >
                    {selectedFeedback.is_positivo ? "Positivo" : "Negativo"}
                  </Badge>
                </div>

                <div className="min-w-0">
                  <CardTitle className="text-2xl font-semibold text-white">
                    {selectedFeedback.operador}
                  </CardTitle>
                  <p className="mt-2 text-sm text-slate-200">
                    {formatDate(selectedFeedback.data_hora)}
                    {selectedFeedback.id_ligacao
                      ? ` • EC ${selectedFeedback.id_ligacao}`
                      : ""}
                    {selectedFeedback.call_id
                      ? ` • Call ID ${selectedFeedback.call_id}`
                      : ""}
                    {selectedFeedback.pontuacao != null
                      ? ` • Nota ${selectedFeedback.pontuacao}`
                      : ""}
                  </p>
                </div>
              </div>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowDetailModal(false)}
                className="absolute right-6 top-6 border border-white/10 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>

            <CardContent className="space-y-6 bg-slate-50 p-4 sm:p-6 dark:bg-slate-950">
              {selectedFeedbackChecklistPayload ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-[24px] border border-emerald-200 bg-[linear-gradient(180deg,_rgba(236,253,245,0.95),_rgba(255,255,255,1))] p-4 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h4 className="font-semibold text-emerald-800 dark:text-emerald-300">
                        Pontos feitos
                      </h4>
                      <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                        {selectedFeedbackChecklistPayload.done?.length ?? 0}
                      </Badge>
                    </div>
                    <div className="space-y-3">
                      {(selectedFeedbackChecklistPayload.done || []).length >
                      0 ? (
                        (selectedFeedbackChecklistPayload.done || []).map(
                          (entry, index) => (
                            <div
                              key={`detail-done-${index}`}
                              className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 dark:border-emerald-900/40 dark:bg-slate-950/80"
                            >
                              <div className="text-[11px] uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-400">
                                {entry.blockTitle}
                              </div>
                              <div className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
                                {entry.itemTitle}
                              </div>
                            </div>
                          ),
                        )
                      ) : (
                        <div className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm text-slate-500 dark:border-emerald-900/40 dark:bg-slate-950/80 dark:text-slate-400">
                          Nenhum ponto feito registrado.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-rose-200 bg-[linear-gradient(180deg,_rgba(255,241,242,0.95),_rgba(255,255,255,1))] p-4 shadow-sm dark:border-rose-900/40 dark:bg-rose-950/20">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h4 className="font-semibold text-rose-800 dark:text-rose-300">
                        Pontos não feitos
                      </h4>
                      <Badge className="bg-rose-600 text-white hover:bg-rose-600">
                        {selectedFeedbackChecklistPayload.notDone?.length ?? 0}
                      </Badge>
                    </div>
                    <div className="space-y-3">
                      {(selectedFeedbackChecklistPayload.notDone || []).length >
                      0 ? (
                        (selectedFeedbackChecklistPayload.notDone || []).map(
                          (entry, index) => (
                            <div
                              key={`detail-not-done-${index}`}
                              className="rounded-2xl border border-rose-100 bg-white px-4 py-3 dark:border-rose-900/40 dark:bg-slate-950/80"
                            >
                              <div className="text-[11px] uppercase tracking-[0.16em] text-rose-600 dark:text-rose-400">
                                {entry.blockTitle}
                              </div>
                              <div className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
                                {entry.itemTitle}
                              </div>
                            </div>
                          ),
                        )
                      ) : (
                        <div className="rounded-2xl border border-rose-100 bg-white px-4 py-3 text-sm text-slate-500 dark:border-rose-900/40 dark:bg-slate-950/80 dark:text-slate-400">
                          Nenhum ponto pendente registrado.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                  Este feedback não possui checklist estruturado salvo.
                </div>
              )}

              {((selectedFeedback.pontos_positivos || "").trim() ||
                (selectedFeedback.pontos_melhorar || "").trim()) && (
                <div className="grid gap-4 lg:grid-cols-2">
                  {!!selectedFeedback.pontos_positivos?.trim() && (
                    <div className="rounded-[24px] border border-sky-200 bg-white p-5 shadow-sm dark:border-sky-900/40 dark:bg-slate-900">
                      <h4 className="mb-3 font-semibold text-sky-800 dark:text-sky-300">
                        Comentários positivos
                      </h4>
                      <p className="whitespace-pre-line text-sm leading-7 text-slate-700 dark:text-slate-300">
                        {selectedFeedback.pontos_positivos}
                      </p>
                    </div>
                  )}

                  {!!selectedFeedback.pontos_melhorar?.trim() && (
                    <div className="rounded-[24px] border border-amber-200 bg-white p-5 shadow-sm dark:border-amber-900/40 dark:bg-slate-900">
                      <h4 className="mb-3 font-semibold text-amber-800 dark:text-amber-300">
                        Comentários de melhoria
                      </h4>
                      <p className="whitespace-pre-line text-sm leading-7 text-slate-700 dark:text-slate-300">
                        {selectedFeedback.pontos_melhorar}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {selectedFeedback.audio_path && (
                <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Áudio da ligação
                  </div>
                  <audio
                    controls
                    className="w-full"
                    src={`http:///${selectedFeedback.audio_path}`}
                  />
                </div>
              )}
            </CardContent>

            <div className="flex justify-end gap-2 border-t p-4">
              {selectedFeedback.monitor_nome === monitorNome && (
                <Button
                  variant="destructive"
                  onClick={() => deleteFeedback(selectedFeedback.id)}
                >
                  Apagar
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setShowDetailModal(false)}
              >
                Fechar
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default FeedbackCreationModal;
