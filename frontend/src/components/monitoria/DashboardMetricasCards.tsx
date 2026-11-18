import type { DashboardMetricas } from "@/types/monitoria";
import {
  MessageSquare,
  Headphones,
  AlertTriangle,
  Users,
  Sparkles,
} from "lucide-react";

interface Props {
  metricas: DashboardMetricas | null;
  loading?: boolean;
  totalConversas?: number;
}

const cards = [
  {
    key: "totalAbertas" as const,
    label: "Total Abertas",
    icon: MessageSquare,
    color: "text-amber-300",
    bg: "from-amber-500/20 via-amber-500/8 to-transparent",
    border: "border-amber-500/20",
    glow: "shadow-[0_0_60px_rgba(245,158,11,0.12)]",
    hint: "Conversas aguardando primeira resposta",
  },
  {
    key: "emAtendimento" as const,
    label: "Em Atendimento",
    icon: Headphones,
    color: "text-sky-300",
    bg: "from-sky-500/20 via-sky-500/8 to-transparent",
    border: "border-sky-500/20",
    glow: "shadow-[0_0_60px_rgba(56,189,248,0.12)]",
    hint: "Clientes com operador atuando agora",
  },
  {
    key: "foraSLA" as const,
    label: "Fora SLA",
    icon: AlertTriangle,
    color: "text-rose-300",
    bg: "from-rose-500/20 via-rose-500/8 to-transparent",
    border: "border-rose-500/20",
    glow: "shadow-[0_0_60px_rgba(244,63,94,0.12)]",
    hint: "Conversas que exigem prioridade imediata",
  },
  {
    key: "operadoresAtivos" as const,
    label: "Operadores Ativos",
    icon: Users,
    color: "text-emerald-300",
    bg: "from-emerald-500/20 via-emerald-500/8 to-transparent",
    border: "border-emerald-500/20",
    glow: "shadow-[0_0_60px_rgba(16,185,129,0.12)]",
    hint: "Pessoas com conversa assumida na carteira",
  },
];

export function DashboardMetricasCards({
  metricas,
  loading,
  totalConversas = 0,
}: Props) {
  const baseConversas = Math.max(totalConversas, 0);

  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const value = metricas ? metricas[card.key] : 0;
        const larguraBarra = (() => {
          if (loading) return 0;

          if (card.key === "operadoresAtivos") {
            const baseOperadores = Math.max(metricas?.emAtendimento ?? 0, 0);
            if (baseOperadores <= 0 || Number(value) <= 0) return 0;
            return Math.min(100, Math.round((Number(value) / baseOperadores) * 100));
          }

          if (baseConversas <= 0 || Number(value) <= 0) return 0;
          return Math.min(100, Math.round((Number(value) / baseConversas) * 100));
        })();

        return (
          <div
            key={card.key}
            className={`group relative overflow-hidden rounded-[20px] border ${card.border} bg-gradient-to-b from-card/85 to-card/70 p-3 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:bg-card/90 ${card.glow}`}
          >
            <div
              className={`absolute inset-0 bg-gradient-to-br ${card.bg} opacity-80 transition-opacity duration-300 group-hover:opacity-100`}
            />
            <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/5 blur-3xl" />

            <div className="relative flex items-start justify-between gap-2.5">
              <div className="min-w-0 flex-1">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  <Sparkles className="h-3 w-3" />
                  {card.label}
                </div>
                <p
                  className={`mt-2.5 text-[1.55rem] font-black leading-none tracking-tight ${card.color}`}
                >
                  {loading ? "—" : value}
                </p>
                <p className="mt-2.5 min-h-[42px] max-w-[14rem] text-[11.5px] leading-5 text-muted-foreground">
                  {card.hint}
                </p>
              </div>
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[15px] border border-white/10 bg-slate-950/35 shadow-inner">
                <Icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </div>
            <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${
                  card.key === "foraSLA"
                    ? "from-rose-400 via-orange-300 to-amber-200"
                    : card.key === "emAtendimento"
                      ? "from-sky-400 via-cyan-300 to-blue-200"
                      : card.key === "operadoresAtivos"
                        ? "from-emerald-400 via-teal-300 to-lime-200"
                        : "from-amber-400 via-orange-300 to-yellow-200"
                }`}
                style={{
                  width: `${larguraBarra}%`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
