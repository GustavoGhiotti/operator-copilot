import React from "react";
import { useResultadoOperador } from "@/context/ResultadoOperador";
import {
  BadgeCheck,
  BriefcaseBusiness,
  CircleDollarSign,
  TrendingUp,
  Users,
  RefreshCw,
} from "lucide-react";

interface UserInsightsProps {
  portfolio: string;
  goal: number;
  isVisible?: boolean;
}

const currency = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const UserInsights: React.FC<UserInsightsProps> = ({ isVisible = true }) => {
  const { operatorData, isLoading, operatorError, fetchOperatorData } =
    useResultadoOperador();
  const centroCusto = localStorage.getItem("centroCusto") || "Não informado";
  const nomeSupervisao = localStorage.getItem("Supervisor") || "Não informada";
  const supervisaoResumida =
    nomeSupervisao === "Não informada"
      ? nomeSupervisao
      : nomeSupervisao.trim().split(/\s+/).slice(0, 2).join(" ");

  if (operatorError && !operatorData?.metrics) {
    return (
      <div className="rounded-2xl border border-orange-300/60 bg-orange-50/75 p-4 text-sm dark:border-orange-800/60 dark:bg-orange-950/30">
        <p className="font-semibold text-orange-800 dark:text-orange-200">
          Consulta temporariamente indisponível
        </p>
        <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          {operatorError}
        </p>
        <button
          type="button"
          onClick={fetchOperatorData}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-600"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Consultar novamente
        </button>
      </div>
    );
  }

  if (isLoading || !operatorData?.metrics) {
    return (
      <div className="space-y-3 py-2" aria-label="Consultando desempenho">
        <div className="flex items-center gap-3 rounded-xl border border-blue-200/70 bg-blue-50/70 p-3 dark:border-blue-800/60 dark:bg-blue-950/35">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-orange-500" />
          </span>
          <div>
            <p className="text-sm font-bold text-blue-800 dark:text-blue-200">
              Consultando seu desempenho
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Buscando resultados e indicadores do operador...
            </p>
          </div>
        </div>
        {[72, 92, 80, 96].map((width, index) => (
          <div
            key={index}
            className="h-14 animate-pulse rounded-xl bg-blue-100/60 dark:bg-blue-950/50"
            style={{ width: `${width}%` }}
          />
        ))}
      </div>
    );
  }

  const { metrics, projection } = operatorData;
  const valorTotal = metrics.values.month || 0;
  const paidAmount = metrics.payments.month || 0;
  const totalAcordos = metrics.agreements.month || 0;

  const metricClass =
    "performance-hud-card group pointer-events-auto relative px-2 py-3";

  return (
    <div
      className={`performance-hud-grid ${
        isVisible ? "" : "performance-hud-grid--hidden"
      }`}
    >
      <div className={metricClass}>
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-700 dark:text-blue-300">
            <BriefcaseBusiness className="h-3.5 w-3.5 text-orange-500" />
            Carteira
          </span>
          <strong className="min-w-0 truncate text-right text-sm text-slate-900 dark:text-white">
            {centroCusto}
          </strong>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 pt-1 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <Users className="h-3 w-3 text-blue-500" /> Supervisão
          </span>
          <span className="max-w-[150px] truncate text-right">
            {supervisaoResumida}
          </span>
        </div>
      </div>

      <div className={metricClass}>
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-700 dark:text-blue-300">
            <CircleDollarSign className="h-3.5 w-3.5 text-orange-500" />
            Valores pagos
          </span>
          <strong className="text-lg text-slate-900 dark:text-white">
            {currency(paidAmount)}
          </strong>
        </div>
        <div className="mt-2 grid grid-cols-1 gap-1.5 pt-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">Hoje</span>
            <strong className="text-slate-800 dark:text-slate-100">
              {currency(metrics.payments.day || 0)}
            </strong>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">Semana</span>
            <strong className="text-blue-700 dark:text-blue-300">
              {currency(metrics.payments.week || 0)}
            </strong>
          </div>
        </div>
      </div>

      <div className={metricClass}>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-700 dark:text-blue-300">
            <BadgeCheck className="h-3.5 w-3.5 text-orange-500" />
            Acordos
          </span>
          <strong className="text-2xl text-slate-900 dark:text-white">{totalAcordos}</strong>
        </div>
        <div className="mt-2 grid grid-cols-1 gap-1.5 pt-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">Fechados</span>
            <strong className="text-slate-800 dark:text-slate-100">
              {currency(valorTotal)}
            </strong>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">Pagos</span>
            <strong className="text-blue-700 dark:text-blue-300">
              {currency(paidAmount)}
            </strong>
          </div>
        </div>
      </div>

      <div className={`${metricClass} border-b-0`}>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-700 dark:text-blue-300">
            <TrendingUp className="h-3.5 w-3.5 text-orange-500" />
            Projeção do mês
          </span>
          <strong className="bg-gradient-to-r from-blue-500 to-orange-500 bg-clip-text text-lg font-black text-transparent">
            {currency(projection.estimatedEndOfMonth || 0)}
          </strong>
        </div>
        <p className="mt-2 flex justify-between pt-1 text-xs text-slate-600 dark:text-slate-300">
          <span>Média diária</span>
          <strong className="text-slate-900 dark:text-white">
            {currency(projection.dailyAverage || 0)}
          </strong>
        </p>
        <p className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-orange-600 dark:text-orange-400">
          {projection.businessDaysRemaining || 0} dias úteis restantes
        </p>
      </div>
    </div>
  );
};

export default UserInsights;
