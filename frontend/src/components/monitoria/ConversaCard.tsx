import type { Conversa, StatusConversa } from "@/types/monitoria";
import { useNavigate } from "react-router-dom";
import {
  Clock,
  User,
  AlertTriangle,
  ArrowUpRight,
  MessageSquareText,
} from "lucide-react";

const statusConfig: Record<StatusConversa, { label: string; classes: string }> = {
  ABERTA: {
    label: "Aberta",
    classes: "border-amber-400/20 bg-amber-400/10 text-amber-200",
  },
  EM_ATENDIMENTO: {
    label: "Em Atendimento",
    classes: "border-sky-400/20 bg-sky-400/10 text-sky-200",
  },
  ENCERRADA: {
    label: "Encerrada",
    classes: "border-slate-400/20 bg-slate-400/10 text-slate-300",
  },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

interface Props {
  conversa: Conversa;
}

export function ConversaCard({ conversa }: Props) {
  const navigate = useNavigate();
  const cfg = statusConfig[conversa.status] ?? statusConfig.ABERTA;

  const slaConfig = {
    OK: null,
    ATENCAO: {
      label: "Aguardando resposta",
      classes: "border-yellow-400/20 bg-yellow-400/10 text-yellow-200",
    },
    CRITICO: {
      label: "SLA crítico",
      classes: "border-rose-400/20 bg-rose-400/10 text-rose-200",
    },
  } as const;

  const sla = conversa.slaStatus ? slaConfig[conversa.slaStatus] : null;
  const origemUltimaMensagem =
    conversa.direcaoUltimaMensagem === "ENVIADA" ? "Operador" : "Cliente";

  return (
    <tr
      onClick={() => navigate(`/monitoria-dev/conversa/${conversa.id}`)}
      className={`group cursor-pointer border-b border-white/5 transition-all duration-300 hover:bg-white/[0.035] ${
        conversa.slaStatus === "CRITICO"
          ? "border-l-4 border-rose-500/80 bg-rose-500/5"
          : conversa.slaStatus === "ATENCAO"
            ? "border-l-4 border-yellow-400/80 bg-yellow-500/5"
            : ""
      }`}
    >
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-[18px] border border-primary/15 bg-gradient-to-br from-primary/16 via-primary/8 to-transparent text-sm font-semibold text-primary shadow-inner">
            {conversa.clienteNome?.charAt(0)?.toUpperCase() ?? "?"}

            {conversa.naoLidas && conversa.naoLidas > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {conversa.naoLidas}
              </span>
            )}
          </div>

          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-foreground">
              {conversa.clienteNome || conversa.clienteTelefone}
            </p>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>{conversa.clienteTelefone}</span>
              <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
              <span className="inline-flex items-center gap-1">
                <MessageSquareText className="h-3 w-3" />
                Conversa ativa
              </span>
            </div>
          </div>
        </div>
      </td>

      <td className="px-4 py-3.5">
        <div className="flex flex-col gap-1">
          <span
            className={`inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${cfg.classes}`}
          >
            {cfg.label}
          </span>

          {sla && (
            <span
              className={`inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${sla.classes}`}
            >
              {sla.label}
            </span>
          )}
        </div>
      </td>

      <td className="hidden px-4 py-3.5 md:table-cell">
        {conversa.operadorNome ? (
          <span className="inline-flex items-center gap-2 text-[13px] text-foreground">
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5">
              <User className="h-3 w-3" />
            </span>
            {conversa.operadorNome}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>

      <td className="hidden px-4 py-3.5 lg:table-cell">
        <div className="max-w-[260px]">
          <span
            className={`mb-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${
              conversa.direcaoUltimaMensagem === "ENVIADA"
                ? "border-sky-400/20 bg-sky-400/10 text-sky-200"
                : "border-amber-400/20 bg-amber-400/10 text-amber-200"
            }`}
          >
            {origemUltimaMensagem}
          </span>
          <p className="truncate text-[13px] text-muted-foreground">
            {conversa.ultimaMensagem || "—"}
          </p>
        </div>
      </td>

      <td className="px-4 py-3.5 text-right">
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/monitoria-dev/conversa/${conversa.id}`);
            }}
            className="inline-flex items-center gap-1 rounded-full border border-primary/15 bg-primary/10 px-3 py-1.5 text-[11px] font-semibold text-primary transition-all hover:border-primary/30 hover:bg-primary/15"
          >
            Abrir
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>

          {conversa.slaStatus === "CRITICO" && (
            <AlertTriangle className="h-4 w-4 text-red-500" />
          )}

          {conversa.slaStatus === "ATENCAO" && (
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          )}

          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            {conversa.atualizadoEm ? timeAgo(conversa.atualizadoEm) : "—"}
          </span>
        </div>
      </td>
    </tr>
  );
}
