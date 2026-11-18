import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  X,
  Award,
  BarChart,
  CalendarDays,
  User,
  Users,
  Clock,
  DollarSign,
  PiggyBank,
  Percent,
  Inbox,
  TrendingUp,
  UserCheck,
  PhoneOutgoing,
  PhoneCall,
  Handshake,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loading } from "./ui/loading";
import { Button } from "@/components/ui/button";
import { useResultadoOperador } from "@/context/ResultadoOperador";
import axiosInstance from "@/utils/axiosInstance";
import { allIcons } from "./AuthButton";

interface ResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRankingPosition: number | null;
}

const ResultsModal: React.FC<ResultsModalProps> = ({
  isOpen,
  onClose,
  userRankingPosition,
}) => {
  const { operatorData, isLoading } = useResultadoOperador();
  const [feedbackIA, setFeedbackIA] = useState<string>("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const operadoraFeedback =
    (localStorage.getItem("nomeCompleto") || "").trim().toUpperCase() ===
    "DAMARIS CHAVES DA PAZ";

  useEffect(() => {
    const fetchFeedback = async () => {
      if (!operatorData) return;
      try {
        const centroCusto = localStorage.getItem("centroCusto");
        const res = await axiosInstance.post(
          "/api/operadores/resultado/feedback",
          {
            operatorData,
            centroCusto,
          }
        );
        setFeedbackIA(res.data.feedback);
      } catch (err) {
        console.error(err);
        setFeedbackIA("⚠️ Erro ao buscar feedback da IA.");
      }
    };

    if (isOpen) {
      fetchFeedback();
    }
  }, [isOpen, operatorData]);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  if (isLoading || !operatorData) {
    return (
      <Loading variant="hourglass" text="Carregando resultados..." fullPage />
    );
  }

  const {
    name,
    role,
    avatar,
    metrics,
    ranking,
    topPerformance,
    projection,
    cpc,
    ce,
    acionamento,
  } = operatorData;
  const selectedIconIndex = Number.parseInt(
    localStorage.getItem("selectedIcon") || "",
    10
  );
  const selectedProfileOption =
    allIcons[Number.isNaN(selectedIconIndex) ? 0 : selectedIconIndex] ||
    allIcons[0];
  const SelectedProfileIcon = selectedProfileOption?.icon;
  const selectedProfileAvatar =
    selectedProfileOption?.image ||
    localStorage.getItem("selectedAvatar") ||
    "";

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const calculatePercentage = (value: number, total: number) => {
    if (!value) return "0";
    return ((value / total) * 100).toFixed(1);
  };

  const displayMetric = (
    value: number | null | undefined,
    isCurrency = false
  ) => {
    if (!value) return "-";
    return isCurrency ? formatCurrency(value) : value;
  };

  const calculateClientsPerAgreement = (cpc, agreementsDay) => {
    if (!cpc || !agreementsDay || agreementsDay === 0) return "-";
    return (cpc / agreementsDay).toFixed(1);
  };

  const calculateContactsPerAcionamento = (acionamento, ce) => {
    if (!acionamento || !ce || ce === 0) return "-";
    return (acionamento / ce).toFixed(1); // Calcula a média de acionamento por alô
  };

  const calculateAloPerCPC = (ce, cpc) => {
    if (!ce || !cpc || cpc === 0) return "-";
    return (ce / cpc).toFixed(1);
  };

  const formatPercentage = (numerator: number, denominator: number): string => {
    if (!denominator || denominator === 0) return "0%";
    const result = (numerator / denominator) * 100;
    return `${result.toFixed(2)}%`;
  };

  const getRateColor = (value: number) => {
    if (value >= 0.5) return "text-green-600"; // 50% ou mais
    if (value >= 0.25) return "text-yellow-600"; // entre 25% e 49%
    return "text-red-600"; // abaixo de 25%
  };

  return (
    <>
      <div className="results-hud-backdrop fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="results-hud-panel max-h-[92vh] w-[96vw] max-w-6xl overflow-hidden">
          <div className="results-hud-header flex items-center justify-between px-5 py-4 md:px-7">
            <h2 className="flex items-center gap-3 text-xl font-semibold text-white">
              <BarChart className="h-5 w-5" />
              <span>Painel de Resultados</span>
            </h2>
            <button
              onClick={onClose}
              className="results-hud-close rounded-md p-2 text-blue-200 transition"
              aria-label="Fechar painel de resultados"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="results-hud-body max-h-[calc(92vh-68px)] overflow-y-auto p-4 md:p-5">
            {/* Operator Info Card */}
            <div className="results-hud-operator mb-4 flex flex-col items-start gap-4 p-4 md:flex-row md:items-center">
              {/* Avatar */}
              <div className="results-hud-avatar flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-full">
                {selectedProfileAvatar ? (
                  <img
                    src={selectedProfileAvatar}
                    alt={`Avatar de ${name}`}
                    className="h-full w-full object-cover"
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = "/avatares/Avatar7.png";
                    }}
                  />
                ) : SelectedProfileIcon ? (
                  <SelectedProfileIcon className="h-8 w-8 text-blue-300" />
                ) : (
                  <User className="h-8 w-8 text-blue-300" />
                )}
              </div>

              {/* Nome + cargo + feedback */}
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-blue-50">{name}</h3>
                <p className="text-sm text-blue-200/50">Operador(a)</p>

                {operadoraFeedback && (
                  <>
                    {!showFeedback ? (
                      <Button
                        onClick={() => setShowFeedback(true)}
                        className="results-hud-feedback-trigger mt-2 h-8 rounded-[3px] px-3 text-[11px] font-medium"
                      >
                        Ver Feedback da Aurora IA
                      </Button>
                    ) : (
                      <div className="results-hud-feedback mt-3 rounded-xl p-4 animate-fade-in">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <img
                              src="/images/aurora/aurora-avatar-transparent-300-v1.png"
                              alt="Aurora"
                              className="w-5 h-5 rounded-full"
                            />
                            <span className="text-sm font-medium text-blue-300">
                              Feedback da Aurora IA
                            </span>
                          </div>
                          <button
                            onClick={() => setShowFeedback(false)}
                            className="text-xs text-blue-400 transition hover:text-blue-200"
                          >
                            Fechar
                          </button>
                        </div>

                        {/* Enquanto não carregou o feedback */}
                        {feedbackIA === "" ? (
                          <div className="flex items-center gap-2 text-sm text-blue-100/60 animate-pulse">
                            <span className="loading loading-dots loading-sm"></span>
                            <span>
                              Estou analisando seus dados para gerar um
                              feedback...
                            </span>
                          </div>
                        ) : (
                          <>
                            <p className="mb-3 whitespace-pre-line text-sm leading-relaxed text-blue-50/80">
                              {feedbackIA}
                            </p>

                            {/* --- Áudio da Aurora --- */}
                            <div className="flex items-center gap-2">
                              <Button
                                onClick={async () => {
                                  try {
                                    setIsSpeaking(true);
                                    const nome =
                                      localStorage.getItem("nomeCompleto");
                                    const res = await axiosInstance.post(
                                      "/api/resultado/feedback/audio",
                                      {
                                        feedback: feedbackIA,
                                        nome_operador: nome,
                                      },
                                      { responseType: "blob" }
                                    );

                                    const audioUrl = URL.createObjectURL(
                                      res.data
                                    );
                                    const audio = new Audio(audioUrl);

                                    audio.onended = () => setIsSpeaking(false);
                                    audio.play();
                                  } catch (err) {
                                    console.error("Erro ao gerar áudio:", err);
                                    setIsSpeaking(false);
                                  }
                                }}
                                disabled={isSpeaking}
                                className={`${
                                  isSpeaking
                                    ? "bg-indigo-400 cursor-not-allowed"
                                    : "bg-indigo-600 hover:bg-indigo-700"
                                } text-white text-sm flex items-center gap-2`}
                              >
                                🔊{" "}
                                {isSpeaking
                                  ? "Aurora está falando..."
                                  : "Ouvir Aurora"}
                              </Button>

                              {isSpeaking && (
                                <div className="flex items-center gap-1 animate-pulse">
                                  <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                                  <div className="w-2 h-2 bg-indigo-400 rounded-full"></div>
                                  <div className="w-2 h-2 bg-indigo-300 rounded-full"></div>
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Summary Metrics */}
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="results-hud-metric results-hud-metric--blue p-4">
                <div className="flex justify-between items-start">
                  <h4 className="text-sm font-medium text-blue-700">
                    Acordos Realizados
                  </h4>
                  <Inbox className="h-5 w-5 text-blue-500" />
                </div>
                <div className="mt-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Hoje:</span>
                    <span className="font-medium dark:text-gray-800">
                      {metrics.agreements.day}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Semana:</span>
                    <span className="font-medium dark:text-gray-800">
                      {metrics.agreements.week}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Mês:</span>
                    <span className="font-medium dark:text-gray-800">
                      {metrics.agreements.month}
                    </span>
                  </div>
                </div>
              </div>

              <div className="results-hud-metric results-hud-metric--green p-4">
                <div className="flex justify-between items-start">
                  <h4 className="text-sm font-medium text-blue-300">
                    Valor Total
                  </h4>
                  <DollarSign className="h-5 w-5 text-blue-400" />
                </div>
                <div className="mt-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Hoje:</span>
                    <span className="font-medium dark:text-gray-800">
                      {formatCurrency(metrics.values.day)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Semana:</span>
                    <span className="font-medium dark:text-gray-800">
                      {formatCurrency(metrics.values.week)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Mês:</span>
                    <span className="font-medium dark:text-gray-800">
                      {formatCurrency(metrics.values.month)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="results-hud-metric results-hud-metric--purple p-4">
                <div className="flex justify-between items-start">
                  <h4 className="text-sm font-medium text-blue-300">
                    Valores Pagos
                  </h4>
                  <PiggyBank className="h-5 w-5 text-blue-400" />
                </div>
                <div className="mt-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Hoje:</span>
                    <span className="font-medium dark:text-gray-800">
                      {formatCurrency(metrics.payments.day)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Semana:</span>
                    <span className="font-medium dark:text-gray-800">
                      {formatCurrency(metrics.payments.week)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Mês:</span>
                    <span className="font-medium dark:text-gray-800">
                      {formatCurrency(metrics.payments.month)}
                    </span>
                  </div>
                  <div className="mt-2 flex justify-between border-t border-blue-500/20 pt-2 text-sm">
                    <span className="font-medium text-blue-300">
                      Projeção do mês:
                    </span>
                    <span className="font-semibold text-blue-300">
                      {formatCurrency(projection.estimatedEndOfMonth)}
                    </span>
                  </div>
                </div>
              </div>

            </div>

            {/* Detailed Performance Metrics */}
            <div className="results-hud-section mb-5 overflow-hidden">
              <div className="results-hud-section__title p-3">
                <h3 className="flex items-center gap-2 font-medium text-blue-100">
                  <BarChart className="h-4 w-4" /> Métricas Detalhadas
                </h3>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="dark:text-white">Métrica</TableHead>

                    <TableHead className="dark:text-white">Mês</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium dark:text-gray-300">
                      Efetividade
                    </TableCell>
                    <TableCell className="dark:text-gray-300">
                      {calculatePercentage(
                        metrics.payments.month,
                        metrics.values.month
                      ) === "0"
                        ? "-"
                        : `${calculatePercentage(
                            metrics.payments.month,
                            metrics.values.month
                          )}%`}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div className="results-hud-section mb-5 overflow-hidden">
              <div className="results-hud-section__title p-3">
                <h3 className="flex items-center gap-2 font-medium text-blue-100">
                  <BarChart className="h-4 w-4" /> CPC's Detalhados
                </h3>
              </div>

              <Table>
                <TableHeader>
                  <TableRow className="h-auto">
                    {" "}
                    {/* altura automática e compacta */}
                    <TableHead className="py-1 dark:text-white">
                      Acionamento
                    </TableHead>
                    <TableHead className="py-1 dark:text-white">Alô</TableHead>
                    <TableHead className="py-1 dark:text-white">CPC</TableHead>
                    <TableHead className="py-1 dark:text-white">
                      Acordo
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="h-auto">
                    <TableCell className="py-1 font-medium dark:text-gray-300">
                      {acionamento}
                    </TableCell>
                    <TableCell className="py-1 dark:text-gray-300">
                      {ce}
                    </TableCell>
                    <TableCell className="py-1 dark:text-gray-300">
                      {cpc}
                    </TableCell>
                    <TableCell className="py-1 dark:text-gray-300">
                      {metrics.agreements.day}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              <div className="results-hud-conversion m-4 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-4">
                  <TrendingUp className="h-6 w-6 text-blue-400" />
                  <h4 className="text-lg font-semibold text-blue-200">
                    Taxas de Conversão
                  </h4>
                </div>

                <div className="space-y-5 text-sm text-blue-50/75">
                  {/* Alô por Acionamento */}
                  <div className="border-t border-blue-300/10 pt-4">
                    <div className="flex items-center gap-2">
                      <PhoneOutgoing className="h-4 w-4 text-blue-400" />
                      <p className="font-medium">Alô por Acionamento:</p>
                      <span
                        className={`font-semibold ml-auto ${getRateColor(
                          ce / acionamento
                        )}`}
                      >
                        {formatPercentage(ce, acionamento)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-blue-100/45">
                      Indica quantas ligações você precisa realizar até
                      conseguir que alguém atenda.
                    </p>
                  </div>

                  {/* CPC por Alô */}
                  <div className="border-t border-blue-300/10 pt-4">
                    <div className="flex items-center gap-2">
                      <PhoneCall className="h-4 w-4 text-blue-400" />
                      <p className="font-medium">CPC por Alô:</p>
                      <span
                        className={`font-semibold ml-auto ${getRateColor(
                          cpc / ce
                        )}`}
                      >
                        {formatPercentage(cpc, ce)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-blue-100/45">
                      Mostra o quanto dos contatos atendidos evoluem para uma
                      conversa com chance de acordo.
                    </p>
                  </div>

                  {/* Acordo por CPC */}
                  <div className="border-t border-blue-300/10 pt-4">
                    <div className="flex items-center gap-2">
                      <Handshake className="h-4 w-4 text-blue-400" />
                      <p className="font-medium">Acordo por CPC:</p>
                      <span
                        className={`font-semibold ml-auto ${getRateColor(
                          metrics.agreements.day / cpc
                        )}`}
                      >
                        {formatPercentage(metrics.agreements.day, cpc)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-blue-100/45">
                      Representa sua taxa de sucesso: quantos acordos você fecha
                      em relação às conversas com chance.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Performance Insights */}
            <div className="results-hud-insights mb-5 p-4">
              <h3 className="mb-3 flex items-center gap-2 font-medium text-blue-200">
                <Award className="h-4 w-4" /> Insights de Desempenho
              </h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm">
                  <CalendarDays className="h-4 w-4 text-blue-500 mt-0.5 " />
                  <span className="text-blue-50/75">
                    Seu melhor dia da semana é{" "}
                    <strong>{topPerformance.day}</strong>
                  </span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <Clock className="h-4 w-4 text-blue-500 mt-0.5" />
                  <span className="text-blue-50/75">
                    Seu horário mais produtivo é entre{" "}
                    <strong>{topPerformance.timeOfDay}</strong>
                  </span>
                </li>
              </ul>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={onClose}
                className="results-hud-action text-white"
              >
                Fechar Resultados
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ResultsModal;
