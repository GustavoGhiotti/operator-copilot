import React, { useEffect, useState } from "react";
import {
  Calendar,
  CheckCircle,
  CircleAlert,
  Eye,
  Gauge,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import axiosInstance from "@/utils/axiosInstance";

interface FeedbacksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Feedback {
  id: number;
  monitor_nome: string;
  data_hora: string;
  id_ligacao: string;
  call_id?: string;
  tempo_ligacao_total?: string;
  descricao: string;
  pontos_positivos: string;
  pontos_melhorar: string;
  pontuacao: number;
  is_positivo: boolean;
  lido: boolean;
  ciente: boolean;
  ciente_em?: string | null;
}

interface FeedbackStats {
  total: number;
  positivos: number;
  negativos: number;
  taxa_qualidade: number;
  nao_lidos: number;
}

const FeedbacksModal: React.FC<FeedbacksModalProps> = ({ isOpen, onClose }) => {
  const { toast } = useToast();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [stats, setStats] = useState<FeedbackStats>({
    total: 0,
    positivos: 0,
    negativos: 0,
    taxa_qualidade: 0,
    nao_lidos: 0,
  });
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [cienteModalOpen, setCienteModalOpen] = useState(false);
  const [assinaturaSenha, setAssinaturaSenha] = useState("");
  const [isSigning, setIsSigning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const nomeUsuario = localStorage.getItem("nomeCompleto")?.trim().toUpperCase();
  const cpfUsuario = localStorage.getItem("userCpf")?.trim();

  const loadFeedbacks = async () => {
    if (!nomeUsuario) return;

    setIsLoading(true);
    try {
      const response = await axiosInstance.get("/api/feedbacks/operador", {
        params: { operador: nomeUsuario },
      });

      const feedbacksData = response.data.feedbacks || [];
      setFeedbacks(feedbacksData);

      const total = feedbacksData.length;
      const positivos = feedbacksData.filter((f: Feedback) => f.is_positivo).length;
      const negativos = total - positivos;
      const naoLidos = feedbacksData.filter((f: Feedback) => !f.lido).length;
      const taxaQualidade = total > 0 ? Math.round((positivos / total) * 100) : 0;

      setStats({
        total,
        positivos,
        negativos,
        taxa_qualidade: taxaQualidade,
        nao_lidos: naoLidos,
      });
    } catch (error) {
      console.error("Erro ao carregar feedbacks:", error);
      toast({
        title: "Erro ao carregar feedbacks",
        description: "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (feedbackId: number) => {
    try {
      await axiosInstance.post("/api/operadores/feedbacks/marcar-lido", {
        feedback_id: feedbackId,
      });

      setFeedbacks((prev) =>
        prev.map((feedback) =>
          feedback.id === feedbackId ? { ...feedback, lido: true } : feedback
        )
      );

      setStats((prev) => ({
        ...prev,
        nao_lidos: Math.max(0, prev.nao_lidos - 1),
      }));
    } catch (error) {
      console.error("Erro ao marcar como lido:", error);
      toast({
        title: "Erro ao registrar abertura",
        description: "Não foi possível confirmar que o feedback foi visualizado.",
        variant: "destructive",
      });
    }
  };

  const handleFeedbackClick = async (feedback: Feedback) => {
    setSelectedFeedback(feedback);

    if (!feedback.lido) {
      await markAsRead(feedback.id);
      setSelectedFeedback((prev) =>
        prev && prev.id === feedback.id ? { ...prev, lido: true } : prev
      );
    }
  };

  const handleRegistrarCiencia = async () => {
    if (!selectedFeedback || !assinaturaSenha.trim()) {
      toast({
        title: "Senha obrigatória",
        description: "Informe sua senha para confirmar a ciência do feedback.",
        variant: "destructive",
      });
      return;
    }

    if (!cpfUsuario) {
      toast({
        title: "Sessão inválida",
        description: "Não foi possível identificar o operador logado.",
        variant: "destructive",
      });
      return;
    }

    setIsSigning(true);
    try {
      await axiosInstance.post(
        "/api/operadores/feedbacks/registrar-ciencia",
        {
          feedback_id: selectedFeedback.id,
          senha: assinaturaSenha,
        },
        {
          skipAuthRedirect: true,
        } as never
      );

      const now = new Date();
      const cienteEm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
        now.getDate()
      ).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(
        now.getMinutes()
      ).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

      setFeedbacks((prev) =>
        prev.map((feedback) =>
          feedback.id === selectedFeedback.id
            ? { ...feedback, ciente: true, ciente_em: cienteEm, lido: true }
            : feedback
        )
      );
      setSelectedFeedback((prev) =>
        prev ? { ...prev, ciente: true, ciente_em: cienteEm, lido: true } : prev
      );
      setCienteModalOpen(false);
      setAssinaturaSenha("");

      toast({
        title: "Ciência registrada",
        description: "Sua confirmação de leitura foi salva com sucesso.",
      });
    } catch (error: any) {
      console.error("Erro ao registrar ciência:", error);
      const mensagem =
        error?.response?.status === 401
          ? "Senha incorreta. Revise e tente novamente."
          : "Não foi possível registrar sua ciência agora.";

      toast({
        title: "Erro ao registrar ciência",
        description: mensagem,
        variant: "destructive",
      });
    } finally {
      setIsSigning(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadFeedbacks();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      return;
    }

    const exitTimer = window.setTimeout(() => setShouldRender(false), 280);
    return () => window.clearTimeout(exitTimer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || selectedFeedback || cienteModalOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [cienteModalOpen, isOpen, onClose, selectedFeedback]);

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "-";

    const normalized = String(dateString).trim();
    const rfcMatch = normalized.match(
      /^[A-Za-z]{3},\s(\d{2})\s([A-Za-z]{3})\s(\d{4})\s(\d{2}):(\d{2}):(\d{2})\sGMT$/
    );

    if (rfcMatch) {
      const [, day, monthName, year, hour, minute, second] = rfcMatch;
      const monthMap: Record<string, string> = {
        Jan: "01",
        Feb: "02",
        Mar: "03",
        Apr: "04",
        May: "05",
        Jun: "06",
        Jul: "07",
        Aug: "08",
        Sep: "09",
        Oct: "10",
        Nov: "11",
        Dec: "12",
      };

      const month = monthMap[monthName];
      if (month) {
        return `${day}/${month}/${year}, ${hour}:${minute}:${second}`;
      }
    }

    const match = normalized.match(
      /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/
    );

    if (match) {
      const [, year, month, day, hour, minute, second = "00"] = match;
      const localDate = new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second)
      );

      return localDate.toLocaleString("pt-BR");
    }

    return new Date(normalized).toLocaleString("pt-BR");
  };

  const parseMonitorSummary = (description?: string) => {
    const rawLines = (description || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const checklistIndex = rawLines.findIndex((line) =>
      line.toLowerCase().includes("checklist aplicado")
    );

    const summaryLines =
      checklistIndex >= 0 ? rawLines.slice(0, checklistIndex) : rawLines;
    const checklistLines =
      checklistIndex >= 0 ? rawLines.slice(checklistIndex + 1) : [];

    const checklistItems = checklistLines
      .map((line) => {
        const normalized = line.replace(/^[•\-]\s*/, "").trim();
        const bracketMatch = normalized.match(/^\[(OK|NOK)\]\s*(.+)$/i);
        if (bracketMatch) {
          return {
            label: bracketMatch[2].trim().replace(/\s*\((-?\d+)\)\s*$/, ""),
            status: bracketMatch[1].toUpperCase() as "OK" | "NOK",
          };
        }

        const match = normalized.match(/^(.*?):\s*(OK|NOK)$/i);

        if (!match) return null;

        return {
          label: match[1].trim().replace(/\s*\((-?\d+)\)\s*$/, ""),
          status: match[2].toUpperCase() as "OK" | "NOK",
        };
      })
      .filter(Boolean) as { label: string; status: "OK" | "NOK" }[];

    return {
      summaryText: summaryLines.join("\n"),
      checklistItems,
      rawChecklistLines: checklistLines,
    };
  };

  const getScorePercent = (score: number) => Math.max(0, Math.min(100, Math.round(score)));

  const getScoreTone = (score: number) => {
    if (score >= 85) {
      return {
        label: "Excelente",
        chip: "bg-emerald-500/15 text-emerald-700 border-emerald-200",
        text: "text-emerald-600",
        bar: "[&>div]:bg-emerald-500",
        ring: "from-emerald-500 via-green-400 to-lime-300",
        card: "from-emerald-500 to-green-500",
      };
    }
    if (score >= 70) {
      return {
        label: "Bom",
        chip: "bg-sky-500/15 text-sky-700 border-sky-200",
        text: "text-sky-600",
        bar: "[&>div]:bg-sky-500",
        ring: "from-blue-600 via-blue-400 to-indigo-300",
        card: "from-sky-500 to-blue-500",
      };
    }
    if (score >= 50) {
      return {
        label: "Atenção",
        chip: "bg-amber-500/15 text-amber-700 border-amber-200",
        text: "text-amber-600",
        bar: "[&>div]:bg-amber-500",
        ring: "from-amber-500 via-yellow-400 to-orange-300",
        card: "from-amber-500 to-orange-500",
      };
    }
    return {
      label: "Crítico",
      chip: "bg-rose-500/15 text-rose-700 border-rose-200",
      text: "text-rose-600",
      bar: "[&>div]:bg-rose-500",
      ring: "from-rose-500 via-red-400 to-orange-300",
      card: "from-rose-500 to-red-500",
    };
  };

  const closeAll = () => {
    setSelectedFeedback(null);
    setCienteModalOpen(false);
    setAssinaturaSenha("");
  };

  if (!shouldRender) return null;

  const selectedTone = selectedFeedback
    ? getScoreTone(selectedFeedback.pontuacao)
    : getScoreTone(0);
  const selectedPercent = selectedFeedback
    ? getScorePercent(selectedFeedback.pontuacao)
    : 0;
  const parsedSummary = parseMonitorSummary(selectedFeedback?.descricao);
  const checklistDoneItems = parsedSummary.checklistItems.filter(
    (item) => item.status === "OK"
  );
  const checklistNotDoneItems = parsedSummary.checklistItems.filter(
    (item) => item.status === "NOK"
  );

  const formatChecklistLabel = (label: string) => {
    const parts = label.split(">").map((part) => part.trim()).filter(Boolean);

    if (parts.length <= 1) return { group: "Item avaliado", item: label };

    return {
      group: parts.slice(0, -1).join(" • "),
      item: parts[parts.length - 1],
    };
  };

  const getFeedbackPreview = (description?: string) => {
    const parsed = parseMonitorSummary(description);

    if (parsed.summaryText) {
      return parsed.summaryText.split("\n").find(Boolean) || "";
    }

    if (parsed.checklistItems.length > 0) {
      return `Checklist aplicado com ${parsed.checklistItems.length} item(ns) avaliados.`;
    }

    return (description || "").replace(/\s+/g, " ").trim();
  };

  return (
    <>
      <style>{`
        @keyframes feedback-glitch {
          0%, 91%, 100% { transform: translate(0); text-shadow: 0 0 18px rgba(59,130,246,.18); }
          92% { transform: translate(-2px, 1px); text-shadow: 3px 0 #3b82f6, -3px 0 #f97316; }
          94% { transform: translate(2px, -1px); text-shadow: -2px 0 #60a5fa, 2px 0 #f43f5e; }
          96% { transform: translate(-1px, 0); text-shadow: 2px 0 #3b82f6; }
        }
        @keyframes feedback-scan { from { transform: translateY(-100%); } to { transform: translateY(100vh); } }
        @keyframes feedback-pulse { 0%, 100% { opacity: .45; } 50% { opacity: 1; } }
        @keyframes feedback-modal-in {
          from { opacity: 0; transform: scale(.975) translateY(12px); filter: blur(5px); }
          to { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); }
        }
        @keyframes feedback-modal-out {
          from { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); }
          to { opacity: 0; transform: scale(.985) translateY(8px); filter: blur(3px); }
        }
        @keyframes feedback-backdrop-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes feedback-backdrop-out { from { opacity: 1; } to { opacity: 0; } }
        .feedback-glitch { animation: feedback-glitch 6s steps(1, end) infinite; }
        .feedback-scanline { animation: feedback-scan 9s linear infinite; }
        .feedback-backdrop-enter { animation: feedback-backdrop-in 260ms ease-out both; }
        .feedback-backdrop-exit { animation: feedback-backdrop-out 260ms ease-in both; pointer-events: none; }
        .feedback-modal-enter { animation: feedback-modal-in 300ms cubic-bezier(.16,1,.3,1) both; }
        .feedback-modal-exit { animation: feedback-modal-out 240ms ease-in both; }
        .feedback-tech-card { position: relative; isolation: isolate; overflow: hidden; }
        .feedback-hud-panel { position: relative; }
        .feedback-hud-panel::after {
          content: ""; position: absolute; inset: 5px; pointer-events: none; opacity: .75;
          background:
            linear-gradient(#3b82f6,#3b82f6) left top/12px 1px no-repeat,
            linear-gradient(#3b82f6,#3b82f6) left top/1px 12px no-repeat,
            linear-gradient(#3b82f6,#3b82f6) right top/12px 1px no-repeat,
            linear-gradient(#3b82f6,#3b82f6) right top/1px 12px no-repeat,
            linear-gradient(#3b82f6,#3b82f6) left bottom/12px 1px no-repeat,
            linear-gradient(#3b82f6,#3b82f6) left bottom/1px 12px no-repeat,
            linear-gradient(#3b82f6,#3b82f6) right bottom/12px 1px no-repeat,
            linear-gradient(#3b82f6,#3b82f6) right bottom/1px 12px no-repeat;
        }
        .feedback-tech-card::before {
          content: ""; position: absolute; inset: 0; z-index: -1; opacity: 0;
          background: linear-gradient(115deg, transparent 15%, rgba(59,130,246,.10) 48%, transparent 76%);
          transform: translateX(-70%); transition: opacity .25s, transform .65s ease;
        }
        .feedback-tech-card:hover::before { opacity: 1; transform: translateX(70%); }
        .feedback-neon-dot { animation: feedback-pulse 2.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .feedback-glitch, .feedback-scanline, .feedback-neon-dot { animation: none !important; }
          .feedback-backdrop-enter, .feedback-backdrop-exit, .feedback-modal-enter, .feedback-modal-exit {
            animation-duration: 1ms !important;
          }
          .feedback-tech-card::before { display: none; }
        }
      `}</style>
      <div className={`fixed inset-0 z-50 bg-[#020711]/95 text-slate-100 backdrop-blur-md ${isOpen ? "feedback-backdrop-enter" : "feedback-backdrop-exit"}`}>
        <div className="pointer-events-none absolute inset-0 opacity-[0.18] [background-image:radial-gradient(circle_at_86%_8%,rgba(59,130,246,.22),transparent_24%),linear-gradient(rgba(37,99,235,.16)_1px,transparent_1px),linear-gradient(90deg,rgba(37,99,235,.16)_1px,transparent_1px)] [background-size:auto,30px_30px,30px_30px]" />
        <div className="feedback-scanline pointer-events-none absolute inset-x-0 top-0 z-20 h-24 bg-gradient-to-b from-transparent via-blue-300/[0.025] to-transparent" />
        <div className={`relative flex h-full min-h-0 flex-col overflow-hidden border border-blue-500/15 bg-[#020b18]/88 shadow-[inset_0_0_100px_rgba(37,99,235,0.035)] ${isOpen ? "feedback-modal-enter" : "feedback-modal-exit"}`}>
          <div className="border-b border-blue-500/25 bg-[radial-gradient(circle_at_88%_30%,_rgba(37,99,235,0.13),_transparent_28%),#020b18]/90 px-4 py-4 text-white md:px-5">
            <div className="flex items-start justify-between gap-4">
              <div className="max-w-3xl">
                <div className="mb-2 flex flex-wrap items-center gap-4">
                  <img src="/images/AcmeLogoBranco.png" alt="Grupo Acme" className="h-6 w-auto object-contain opacity-80" />
                  <Badge className="rounded-lg border border-blue-400/60 bg-blue-500/[0.10] px-3 text-[10px] font-normal text-blue-300 shadow-[0_0_12px_rgba(59,130,246,0.45),inset_0_0_12px_rgba(59,130,246,0.12)] hover:bg-blue-500/[0.10]">
                    <span className="feedback-neon-dot mr-2 h-1.5 w-1.5 rounded-full bg-blue-300 shadow-[0_0_8px_#60a5fa]" />
                    Qualidade Aurora
                  </Badge>
                  {stats.nao_lidos > 0 && (
                    <Badge className="bg-rose-500 text-white hover:bg-rose-500">
                      {stats.nao_lidos} pendente(s) de abertura
                    </Badge>
                  )}
                </div>
                <h1 className="feedback-glitch w-fit text-2xl font-semibold tracking-tight text-slate-200 md:text-[28px]">Meus feedbacks</h1>
                <p className="mt-1 max-w-2xl text-xs text-slate-500">
                  Abra cada feedback para registrar a visualização e confirme a
                  ciência quando concluir a leitura.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="rounded-md border border-blue-400/70 bg-blue-500/[0.08] text-blue-300 shadow-[0_0_14px_rgba(59,130,246,0.35),inset_0_0_12px_rgba(59,130,246,0.08)] hover:bg-blue-500/15 hover:text-blue-100"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4">
              <Card className="feedback-hud-panel feedback-tech-card rounded-md border-blue-400/70 bg-[#031022]/85 shadow-[0_0_15px_rgba(59,130,246,0.10),inset_0_0_24px_rgba(37,99,235,0.035)]">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="rounded-md border border-blue-500/50 bg-blue-500/[0.08] p-3 text-blue-400 shadow-[0_0_18px_rgba(59,130,246,0.22)]">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Total
                    </p>
                    <p className="text-3xl font-medium text-blue-400 [text-shadow:0_0_12px_rgba(59,130,246,.75)]">{stats.total}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="feedback-hud-panel feedback-tech-card rounded-md border-blue-400/70 bg-[#031022]/85 shadow-[0_0_15px_rgba(59,130,246,0.10),inset_0_0_24px_rgba(37,99,235,0.035)]">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="rounded-md border border-blue-500/50 bg-blue-500/[0.08] p-3 text-blue-400 shadow-[0_0_18px_rgba(59,130,246,0.22)]">
                    <ThumbsUp className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Positivos
                    </p>
                    <p className="text-3xl font-medium text-blue-400 [text-shadow:0_0_12px_rgba(59,130,246,.75)]">{stats.positivos}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="feedback-hud-panel feedback-tech-card rounded-md border-blue-400/70 bg-[#031022]/85 shadow-[0_0_15px_rgba(59,130,246,0.10),inset_0_0_24px_rgba(37,99,235,0.035)]">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="rounded-md border border-red-500/60 bg-red-500/[0.08] p-3 text-red-400 shadow-[0_0_18px_rgba(248,113,113,0.28)]">
                    <ThumbsDown className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Negativos
                    </p>
                    <p className="text-3xl font-medium text-red-400 [text-shadow:0_0_12px_rgba(248,113,113,.75)]">{stats.negativos}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="feedback-hud-panel feedback-tech-card rounded-md border-blue-400/70 bg-[#031022]/85 shadow-[0_0_15px_rgba(59,130,246,0.10),inset_0_0_24px_rgba(37,99,235,0.035)]">
                <CardContent className="p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-300">
                      <Gauge className="h-4 w-4" />
                      <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
                        Taxa de qualidade
                      </span>
                    </div>
                    <span className="text-3xl font-medium text-blue-400 [text-shadow:0_0_12px_rgba(59,130,246,.75)]">
                      {stats.taxa_qualidade}%
                    </span>
                  </div>
                  <Progress value={stats.taxa_qualidade} className="h-1.5 bg-blue-950 [&>div]:bg-blue-500 [&>div]:shadow-[0_0_9px_#3b82f6]" />
                </CardContent>
              </Card>
            </div>

            <Card className="feedback-hud-panel rounded-md border-blue-400/70 bg-[#020d1d]/88 shadow-[0_0_22px_rgba(59,130,246,0.08),inset_0_0_34px_rgba(37,99,235,0.025)]">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-white">
                  <MessageSquare className="h-5 w-5 text-blue-300" />
                  Feedbacks recebidos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="py-12 text-center">
                    <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[#2b435d] border-t-blue-400" />
                    <p className="mt-3 text-sm text-slate-500">Carregando feedbacks...</p>
                  </div>
                ) : feedbacks.length === 0 ? (
                  <div className="m-1 min-h-[240px] bg-[linear-gradient(rgba(37,99,235,.13)_1px,transparent_1px),linear-gradient(90deg,rgba(37,99,235,.13)_1px,transparent_1px)] bg-[size:30px_30px] py-16 text-center text-slate-500">
                    <MessageSquare className="mx-auto mb-4 h-12 w-12 text-blue-500 [filter:drop-shadow(0_0_10px_rgba(59,130,246,.7))]" />
                    <p>Nenhum feedback encontrado.</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {feedbacks.map((feedback) => {
                      const scorePercent = getScorePercent(feedback.pontuacao);
                      const tone = getScoreTone(feedback.pontuacao);
                      const previewText = getFeedbackPreview(feedback.descricao);

                      return (
                        <button
                          key={feedback.id}
                          type="button"
                          onClick={() => handleFeedbackClick(feedback)}
                          className={`feedback-hud-panel feedback-tech-card group w-full rounded-md border p-0 text-left transition duration-300 hover:-translate-y-0.5 hover:border-blue-400/80 hover:shadow-[0_0_28px_rgba(59,130,246,0.14)] ${
                            feedback.lido
                              ? "border-blue-500/35 bg-[#031022]/90"
                              : "border-blue-400/70 bg-blue-500/[0.06] shadow-[0_0_28px_rgba(59,130,246,0.10)]"
                          }`}
                        >
                          <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center">
                            <div className="lg:min-w-[140px]">
                              <div
                                className={`inline-flex rounded-2xl bg-gradient-to-br ${tone.card} px-4 py-3 text-white shadow-sm`}
                              >
                                <div>
                                  <p className="text-[11px] uppercase tracking-[0.22em] text-white/75">
                                    Pontuação
                                  </p>
                                  <p className="text-3xl font-semibold leading-none">
                                    {feedback.pontuacao}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="mb-3 flex flex-wrap items-center gap-2">
                                <Badge
                                  className={
                                    feedback.is_positivo
                                      ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                                      : "bg-rose-100 text-rose-700 hover:bg-rose-100"
                                  }
                                >
                                  {feedback.is_positivo ? "Positivo" : "Negativo"}
                                </Badge>
                                <Badge variant="outline" className={tone.chip}>
                                  {tone.label}
                                </Badge>
                                {!feedback.lido && (
                                  <Badge className="bg-sky-600 text-white hover:bg-sky-600">
                                    Novo
                                  </Badge>
                                )}
                                {feedback.ciente && (
                                  <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                                    Ciência confirmada
                                  </Badge>
                                )}
                              </div>

                              <div className="mb-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-400">
                                <span className="flex items-center gap-1.5">
                                  <User className="h-4 w-4" />
                                  {feedback.monitor_nome}
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <Calendar className="h-4 w-4" />
                                  {formatDate(feedback.data_hora)}
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <Star className="h-4 w-4" />
                                  EC {feedback.id_ligacao || "-"}
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <Star className="h-4 w-4" />
                                  Call ID {feedback.call_id || "-"}
                                </span>
                                {feedback.tempo_ligacao_total && (
                                  <span className="flex items-center gap-1.5">
                                    <Gauge className="h-4 w-4" />
                                    Tempo {feedback.tempo_ligacao_total}
                                  </span>
                                )}
                              </div>

                              <p className="line-clamp-2 text-sm leading-6 text-slate-300">
                                {previewText}
                              </p>

                              <div className="mt-4 flex items-center gap-3">
                                <Progress
                                  value={scorePercent}
                                  className={`h-2.5 flex-1 bg-[#17283a] ${tone.bar}`}
                                />
                                <span className={`text-sm font-semibold ${tone.text}`}>
                                  {scorePercent}%
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-end">
                              <div className="rounded-md border border-blue-500/40 bg-blue-500/[0.05] p-3 text-blue-400 transition group-hover:border-blue-400/80 group-hover:text-blue-300 group-hover:shadow-[0_0_14px_rgba(59,130,246,.3)]">
                                <Eye className="h-5 w-5" />
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {selectedFeedback && (
        <Dialog open={!!selectedFeedback} onOpenChange={closeAll}>
          <DialogContent className="max-h-[88vh] w-[calc(100vw-1.5rem)] max-w-3xl overflow-y-auto border border-blue-400/30 bg-[#030b16] p-0 text-slate-100 shadow-[0_0_70px_rgba(59,130,246,0.14)] sm:w-[calc(100vw-3rem)] [&>button]:text-slate-400 [&>button:hover]:text-blue-300">
            <div className="overflow-hidden rounded-3xl">
              <div className="border-b border-blue-500/25 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(37,99,235,0.10),_transparent_28%),#040d19] p-4 text-white sm:p-6">
                <DialogHeader>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <Badge
                          className={
                            selectedFeedback.is_positivo
                              ? "bg-emerald-500 text-white hover:bg-emerald-500"
                              : "bg-rose-500 text-white hover:bg-rose-500"
                          }
                        >
                          {selectedFeedback.is_positivo ? "Feedback positivo" : "Feedback negativo"}
                        </Badge>
                        <Badge className="border border-white/15 bg-white/10 text-white hover:bg-white/10">
                          {selectedTone.label}
                        </Badge>
                        {selectedFeedback.ciente ? (
                          <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                            Ciência confirmada
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500 text-white hover:bg-amber-500">
                            Aguardando ciência
                          </Badge>
                        )}
                      </div>
                      <DialogTitle className="text-3xl font-semibold text-white">
                        <span className="feedback-glitch inline-block text-2xl sm:text-3xl">Detalhes do feedback</span>
                      </DialogTitle>
                      <DialogDescription className="mt-2 max-w-2xl text-slate-200">
                        Leitura registrada em {selectedFeedback.lido ? "abertura confirmada" : "pendente"}.
                        Confirme a ciência após revisar todos os pontos.
                      </DialogDescription>
                    </div>

                    <div className="flex flex-col gap-4 rounded-md border border-blue-400/25 bg-blue-400/[0.05] px-4 py-4 shadow-[inset_0_0_24px_rgba(59,130,246,0.05),0_0_24px_rgba(59,130,246,0.08)] sm:flex-row sm:items-center sm:px-5">
                      <div
                        className={`flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br shadow-[0_0_26px_rgba(59,130,246,0.22)] ${selectedTone.ring}`}
                      >
                        <div className="flex h-[84px] w-[84px] flex-col items-center justify-center rounded-full bg-slate-950/90 text-white">
                          <span className="text-[11px] uppercase tracking-[0.2em] text-slate-300">
                            Nota
                          </span>
                          <span className="text-3xl font-semibold leading-none">
                            {selectedFeedback.pontuacao}
                          </span>
                        </div>
                      </div>
                      <div className="min-w-0 flex-1 sm:min-w-[180px]">
                        <div className="mb-2 flex items-center justify-between text-sm text-slate-200">
                          <span>Aproveitamento visual</span>
                          <span className="font-semibold text-white">{selectedPercent}%</span>
                        </div>
                        <Progress
                          value={selectedPercent}
                          className={`h-2.5 bg-white/15 ${selectedTone.bar}`}
                        />
                      </div>
                    </div>
                  </div>
                </DialogHeader>
              </div>

              <div className="space-y-5 bg-[#030b16] p-4 sm:p-6">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <Card className="border-[#2b435d] bg-[#071421] shadow-none">
                    <CardContent className="p-4">
                      <p className="mb-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                        Monitor
                      </p>
                      <p className="font-semibold text-white">{selectedFeedback.monitor_nome}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-[#2b435d] bg-[#071421] shadow-none">
                    <CardContent className="p-4">
                      <p className="mb-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                        Data do feedback
                      </p>
                      <p className="font-semibold text-white">{formatDate(selectedFeedback.data_hora)}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-[#2b435d] bg-[#071421] shadow-none">
                    <CardContent className="p-4">
                      <p className="mb-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                        EC da ligação
                      </p>
                      <p className="font-semibold text-white">{selectedFeedback.id_ligacao || "-"}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-[#2b435d] bg-[#071421] shadow-none">
                    <CardContent className="p-4">
                      <p className="mb-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                        Call ID da ligação
                      </p>
                      <p className="font-semibold text-white">{selectedFeedback.call_id || "-"}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-[#2b435d] bg-[#071421] shadow-none">
                    <CardContent className="p-4">
                      <p className="mb-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                        Tempo total
                      </p>
                      <p className="font-semibold text-white">
                        {selectedFeedback.tempo_ligacao_total || "-"}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-[#2b435d] bg-[#071421] shadow-none">
                    <CardContent className="p-4">
                      <p className="mb-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                        Status
                      </p>
                      <div className="flex items-center gap-2 font-semibold text-white">
                        {selectedFeedback.ciente ? (
                          <>
                            <ShieldCheck className="h-4 w-4 text-emerald-600" />
                            Ciente
                          </>
                        ) : (
                          <>
                            <CircleAlert className="h-4 w-4 text-amber-500" />
                            Pendente
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="border-[#2b435d] bg-[#071421] shadow-none">
                  <CardContent className="p-5">
                    <div className="mb-3 flex items-center gap-2 text-white">
                      <Sparkles className="h-4 w-4" />
                      <h3 className="font-semibold">Resumo do monitor</h3>
                    </div>
                    {parsedSummary.summaryText ? (
                      <div className="space-y-3">
                        {parsedSummary.summaryText.split("\n").map((line, index) => (
                          <div
                            key={`${selectedFeedback.id}-summary-${index}`}
                            className="rounded-xl border border-[#2b435d] bg-[#050f1c] px-4 py-3 text-sm leading-7 text-slate-300"
                          >
                            {line}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="leading-7 text-slate-300">{selectedFeedback.descricao}</p>
                    )}
                  </CardContent>
                </Card>

                {parsedSummary.checklistItems.length > 0 && (
                  <Card className="border-[#2b435d] bg-[#071421] shadow-none">
                    <CardContent className="p-5">
                      <div className="mb-4 flex items-center gap-2 text-white">
                        <CheckCircle className="h-4 w-4" />
                        <h3 className="font-semibold">Checklist aplicado</h3>
                      </div>

                      <div className="grid gap-4 xl:grid-cols-2">
                        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4">
                          <div className="mb-4 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-emerald-700">
                              <CheckCircle className="h-4 w-4" />
                              <h4 className="font-semibold">Pontos feitos na ligação</h4>
                            </div>
                            <div className="rounded-full bg-emerald-600 px-3 py-1 text-sm font-semibold text-white">
                              {checklistDoneItems.length}
                            </div>
                          </div>

                          {checklistDoneItems.length > 0 ? (
                            <div className="space-y-3">
                              {checklistDoneItems.map((item, index) => {
                                const formatted = formatChecklistLabel(item.label);

                                return (
                                  <div
                                    key={`${selectedFeedback.id}-done-${index}`}
                                    className="rounded-xl border border-emerald-400/15 bg-[#071421] px-4 py-3"
                                  >
                                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">
                                      {formatted.group}
                                    </div>
                                    <div className="text-sm font-medium text-slate-200">
                                      {formatted.item}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="rounded-xl border border-emerald-400/15 bg-[#071421] px-4 py-3 text-sm text-slate-400">
                              Nenhum ponto concluído foi marcado neste checklist.
                            </div>
                          )}
                        </div>

                        <div className="rounded-2xl border border-rose-400/20 bg-rose-400/[0.05] p-4">
                          <div className="mb-4 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-rose-700">
                              <CircleAlert className="h-4 w-4" />
                              <h4 className="font-semibold">Pontos não feitos na ligação</h4>
                            </div>
                            <div className="rounded-full bg-rose-600 px-3 py-1 text-sm font-semibold text-white">
                              {checklistNotDoneItems.length}
                            </div>
                          </div>

                          {checklistNotDoneItems.length > 0 ? (
                            <div className="space-y-3">
                              {checklistNotDoneItems.map((item, index) => {
                                const formatted = formatChecklistLabel(item.label);

                                return (
                                  <div
                                    key={`${selectedFeedback.id}-not-done-${index}`}
                                    className="rounded-xl border border-rose-400/15 bg-[#071421] px-4 py-3"
                                  >
                                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-600">
                                      {formatted.group}
                                    </div>
                                    <div className="text-sm font-medium text-slate-200">
                                      {formatted.item}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="rounded-xl border border-rose-400/15 bg-[#071421] px-4 py-3 text-sm text-slate-400">
                              Nenhum ponto pendente foi marcado neste checklist.
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {parsedSummary.rawChecklistLines.length > 0 &&
                  parsedSummary.checklistItems.length === 0 && (
                    <Card className="border-[#2b435d] bg-[#071421] shadow-none">
                      <CardContent className="p-5">
                        <div className="mb-4 flex items-center gap-2 text-white">
                          <CheckCircle className="h-4 w-4" />
                          <h3 className="font-semibold">Checklist aplicado</h3>
                        </div>

                        <div className="space-y-2">
                          {parsedSummary.rawChecklistLines.map((line, index) => (
                            <div
                              key={`${selectedFeedback.id}-raw-check-${index}`}
                              className="rounded-xl border border-[#2b435d] bg-[#050f1c] px-4 py-3 text-sm text-slate-300"
                            >
                              {line}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                <div className="grid gap-4 lg:grid-cols-2">
                  <Card className="border-emerald-400/20 bg-emerald-400/[0.05] shadow-none">
                    <CardContent className="p-5">
                      <div className="mb-3 flex items-center gap-2 text-emerald-700">
                        <ThumbsUp className="h-4 w-4" />
                        <h3 className="font-semibold">Pontos positivos</h3>
                      </div>
                      <p className="whitespace-pre-line leading-7 text-slate-300">
                        {selectedFeedback.pontos_positivos || "Nenhum ponto positivo registrado neste feedback."}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-amber-400/20 bg-amber-400/[0.05] shadow-none">
                    <CardContent className="p-5">
                      <div className="mb-3 flex items-center gap-2 text-amber-700">
                        <ThumbsDown className="h-4 w-4" />
                        <h3 className="font-semibold">Pontos a melhorar</h3>
                      </div>
                      <p className="whitespace-pre-line leading-7 text-slate-300">
                        {selectedFeedback.pontos_melhorar || "Nenhum ponto de melhoria registrado neste feedback."}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="flex flex-col gap-3 rounded-2xl border border-[#2b435d] bg-[#071421] p-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    {selectedFeedback.ciente ? (
                      <div className="flex items-center gap-2 text-emerald-700">
                        <CheckCircle className="h-5 w-5" />
                        <span className="font-semibold">
                          Ciência registrada em {formatDate(selectedFeedback.ciente_em)}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-amber-700">
                        <CircleAlert className="h-5 w-5" />
                        <span className="font-semibold">
                          Falta confirmar a ciência deste feedback.
                        </span>
                      </div>
                    )}
                    <p className="mt-1 text-sm text-slate-500">
                      A abertura do feedback já foi registrada no sistema no momento do clique.
                    </p>
                  </div>

                  <div className="flex gap-3">
                    {!selectedFeedback.ciente && (
                      <Button onClick={() => setCienteModalOpen(true)} className="gap-2 bg-blue-600 text-white shadow-[0_0_16px_rgba(59,130,246,.24)] hover:bg-blue-500">
                        <CheckCircle className="h-4 w-4" />
                        Estou ciente
                      </Button>
                    )}
                    <Button variant="outline" onClick={closeAll} className="border-[#2b435d] bg-transparent text-slate-200 hover:bg-white/5 hover:text-white">
                      Fechar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={cienteModalOpen} onOpenChange={setCienteModalOpen}>
        <DialogContent className="max-w-md border border-blue-400/30 bg-[#071421] text-slate-100 shadow-[0_0_55px_rgba(59,130,246,0.14)] [&>button]:text-slate-400 [&>button:hover]:text-blue-300">
          <DialogHeader>
            <DialogTitle className="text-white">Confirmar ciência do feedback</DialogTitle>
            <DialogDescription className="text-slate-400">
              Digite sua senha de acesso para assinar que leu este feedback.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Input
              type="password"
              placeholder="Sua senha"
              value={assinaturaSenha}
              onChange={(event) => setAssinaturaSenha(event.target.value)}
              autoFocus
              className="border-[#2b435d] bg-[#030b16] text-white placeholder:text-slate-500 focus-visible:ring-blue-500/50"
            />
            <p className="text-sm text-slate-500">
              Se a senha estiver incorreta, o sistema apenas recusará a assinatura.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCienteModalOpen(false);
                setAssinaturaSenha("");
              }}
              disabled={isSigning}
              className="border-[#2b435d] bg-transparent text-slate-200 hover:bg-white/5 hover:text-white"
            >
              Cancelar
            </Button>
            <Button onClick={handleRegistrarCiencia} disabled={isSigning} className="bg-blue-600 text-white shadow-[0_0_16px_rgba(59,130,246,.24)] hover:bg-blue-500">
              {isSigning ? "Validando..." : "Assinar ciência"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FeedbacksModal;
