import React, { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Send,
  Bot,
  AlertCircle,
  CheckCircle2,
  Trophy,
  X,
  HeartPulse,
  Brain,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface Message {
  id: number;
  content: string;
  isUser: boolean;
  timestamp: Date;
  feedback?: {
    type: "positive" | "negative";
    message: string;
  };
}

interface TreinamentoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TreinamentoModal: React.FC<TreinamentoModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [feedback, setFeedback] = useState<any>(null);
  const [chanceAcordo, setChanceAcordo] = useState<number>(0);
  const [comentario, setComentario] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [eventoAtivo, setEventoAtivo] = useState<any>(null);

  const [userName, setUserName] = useState<string | null>(null);

  const [clientePerfil, setClientePerfil] = useState<{
    nome?: string;
    tipo?: string;
    descricao?: string;
    tom?: string;
    humor_inicial?: string;
  } | null>(null);

  useEffect(() => {
    const startSession = async () => {
      const centroCusto = localStorage.getItem("centroCusto");
      setIsStarting(true);

      try {
        const response = await fetch("/api/ia/treinamento", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            centroCusto,
            OPERADOR: userName,
            MENSAGEM: "INICIAR",
            HISTORICO: [],
          }),
        });

        const data = await response.json();

        setClientePerfil({
          nome: data.cliente?.nome,
          tipo: data.cliente?.perfil?.tipo,
          descricao: data.cliente?.perfil?.descricao,
          tom: data.cliente?.perfil?.tom,
          humor_inicial: data.cliente?.perfil?.humor_inicial,
        });

        // Dá tempo pro loader "respirar"
        setTimeout(() => {
          setMessages([
            {
              id: 1,
              content: data.resposta,
              isUser: false,
              timestamp: new Date(),
            },
          ]);
          setIsStarting(false);
        }, 1500);
      } catch (err) {
        console.error(err);
        setIsStarting(false);
      }
    };

    if (isOpen && userName && hasStarted && isStarting) {
      startSession();
    }
  }, [isOpen, userName, hasStarted, isStarting]);

  useEffect(() => {
    const storedUserName = localStorage.getItem("nomeCompleto");
    setUserName(storedUserName?.trim() || null);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const fetchIAResponse = async (userMessage: string) => {
    try {
      const centroCusto = localStorage.getItem("centroCusto");
      const response = await fetch("/api/ia/treinamento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          centroCusto: centroCusto,
          OPERADOR: userName,
          MENSAGEM: userMessage,
          HISTORICO: messages.slice(1).map((m) => ({
            role: m.isUser ? "operador" : "cliente",
            content: m.content,
          })),
        }),
      });

      if (!response.ok) throw new Error(`Erro na API: ${response.status}`);

      const data = await response.json();
      return {
        response: data.resposta || "Não consegui gerar uma resposta.",
        chanceAcordo: data.chance_acordo ?? 0,
        comentario: data.comentario || "",
        shouldEnd: data.finalizar || false,
        summary: data.resumo || null,
        feedback: data.feedback_final || null,
        evento: data.evento || null,
      };
    } catch (error) {
      console.error("Erro ao conectar com IA:", error);
      return {
        response: "⚠️ Erro ao conectar com a IA de treinamento.",
        feedback: null,
        shouldEnd: false,
        summary: null,
        evento: null,
      };
    }
  };

  const handleSendMessage = async () => {
    if (input.trim() === "" || sessionEnded || isTyping) return;

    const userMessage: Message = {
      id: messages.length + 1,
      content: input,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    const iaData = await fetchIAResponse(input);
    setChanceAcordo(iaData.chanceAcordo);
    setComentario(iaData.comentario);

    setTimeout(() => {
      const iaMessage: Message = {
        id: messages.length + 2,
        content: iaData.response,
        isUser: false,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, iaMessage]);

      setIsTyping(false);

      if (iaData.evento) {
        setEventoAtivo(iaData.evento);
        return; // pausa a conversa até o usuário escolher
      }

      if (iaData.shouldEnd) {
        setSessionEnded(true);

        // adiciona o resumo se vier
        if (iaData.summary) {
          setTimeout(() => {
            const summaryMessage: Message = {
              id: messages.length + 3,
              content: iaData.summary,
              isUser: false,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, summaryMessage]);
          }, 800);
        }

        // adiciona feedback final (se veio do backend)
        if (iaData.feedback) {
          setFeedback(iaData.feedback);
        }
      }
    }, 1000);
  };

  const handleEventoEscolha = (opcao: any) => {
    setEventoAtivo(null);
    const ajuste = opcao.efeito;

    // Aplica efeitos
    if (ajuste.humor_cliente) {
      setChanceAcordo((prev) =>
        Math.min(100, Math.max(0, prev + ajuste.humor_cliente))
      );
    }
    if (ajuste.chance_acordo) {
      setChanceAcordo((prev) =>
        Math.min(100, Math.max(0, prev + ajuste.chance_acordo))
      );
    }

    // Exibe comentário visual
    setMessages((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        content: `🧩 ${
          ajuste.comentario || "Sua escolha influenciou a negociação."
        }`,
        isUser: false,
        timestamp: new Date(),
      },
    ]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const resetSession = async () => {
    const centroCusto = localStorage.getItem("centroCusto");
    const response = await fetch("/api/ia/treinamento", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        centroCusto,
        OPERADOR: userName,
        MENSAGEM: "INICIAR",
        HISTORICO: [],
      }),
    });

    if (!response.ok) return;

    const data = await response.json();
    setMessages([
      {
        id: 1,
        content: data.resposta,
        isUser: false,
        timestamp: new Date(),
      },
    ]);
    setSessionEnded(false);
  };

  if (!hasStarted) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[600px] bg-gradient-to-b from-background to-primary/5 p-8 rounded-2xl text-center border border-primary/20 shadow-xl flex flex-col items-center justify-center min-h-[90vh]">
          <div className="w-full max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-primary">
                Simulação de Atendimento
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-2">
                Antes de começar, leia atentamente as orientações abaixo.
              </p>
            </DialogHeader>

            <div className="text-left mt-6 space-y-3 text-sm leading-relaxed text-foreground/90">
              <p>
                🧠 <strong>Objetivo:</strong> Treinar técnicas de empatia,
                argumentação e fechamento de negociação com clientes simulados
                pela IA Aurora.
              </p>
              <p>
                ⚙️ <strong>Como funciona:</strong> A IA se comporta como um
                cliente real, com emoções, distrações e justificativas. Cada
                fala sua influencia o rumo da conversa.
              </p>
              <p>
                📞 <strong>Importante:</strong> Após iniciar a simulação, ela
                funciona como uma ligação real. Se fechar este painel ou sair da
                tela, o atendimento será encerrado automaticamente.
              </p>
              <p>
                🕐 <strong>Duração:</strong> Em média, 3 a 5 minutos. O objetivo
                é alcançar o fechamento de um acordo.
              </p>
              <p>
                🧩 <strong>Atenção:</strong> Ao clicar em{" "}
                <em>“Iniciar Simulação”</em>, a IA será ativada e o cliente será
                gerado. Isso consome processamento do sistema — use apenas
                quando for realmente treinar.
              </p>
            </div>

            <div className="mt-8 flex flex-col gap-3">
              <Button
                onClick={() => {
                  setIsStarting(true);
                  setHasStarted(true);
                }}
                className="bg-primary text-primary-foreground hover:opacity-90 shadow-md"
              >
                Iniciar Simulação de Atendimento
              </Button>

              <Button
                onClick={onClose}
                variant="outline"
                className="text-muted-foreground hover:bg-muted/50"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[1000px] min-h-[95vh] max-h-[95vh] flex flex-col p-0 gap-0 border-2 border-primary/20 bg-gradient-to-br from-background to-primary/5">
          {eventoAtivo && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in-50">
              <div className="relative bg-gradient-to-br from-background via-card to-background border border-primary/30 rounded-2xl shadow-2xl p-8 max-w-lg w-[90%] text-center space-y-6 animate-in zoom-in-95 duration-200">
                {/* Ícone e título */}
                <div className="flex justify-center">
                  <div className="p-3 rounded-full bg-primary/10 border border-primary/20 shadow-md">
                    <AlertCircle className="w-8 h-8 text-primary animate-pulse" />
                  </div>
                </div>

                <h3 className="text-xl font-bold text-primary drop-shadow-sm">
                  {eventoAtivo.descricao}
                </h3>

                {/* Botões neutros */}
                <div className="space-y-3">
                  {eventoAtivo.opcoes.map((op: any, i: number) => (
                    <Button
                      key={i}
                      onClick={() => handleEventoEscolha(op)}
                      variant="outline"
                      className="w-full justify-start text-left rounded-xl py-3 px-4 transition-all text-sm font-medium shadow-sm
              hover:bg-primary/10 hover:text-primary border-border"
                    >
                      {op.texto}
                    </Button>
                  ))}
                </div>

                {/* Rodapé informativo */}
                <div className="text-xs text-muted-foreground italic pt-2 border-t border-border/50">
                  Suas escolhas moldam a percepção do cliente.
                </div>

                {/* Efeitos de fundo suaves */}
                <div className="absolute -top-10 -left-10 w-40 h-40 bg-primary/10 blur-3xl rounded-full animate-pulse" />
                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-accent/10 blur-3xl rounded-full animate-pulse" />
              </div>
            </div>
          )}

          <DialogHeader className="p-6 pb-4 border-b border-border bg-gradient-to-r from-primary/10 to-transparent">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
                  <Bot className="w-8 h-8 text-primary-foreground" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-background animate-pulse" />
              </div>
              <div className="flex-1">
                <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  Aurora IA - Treinamento
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Simulador de atendimento ao cliente
                </p>
              </div>
              {sessionEnded && (
                <Badge
                  variant="outline"
                  className="gap-2 px-3 py-1 bg-primary/10 border-primary text-primary"
                >
                  <Trophy className="w-4 h-4" />
                  Sessão Finalizada
                </Badge>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 flex gap-4 p-4 overflow-hidden">
            <div className="flex-1 flex flex-col gap-3">
              <ScrollArea className="flex-1 pr-4 rounded-xl border border-border bg-card p-4">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.isUser ? "justify-end" : "justify-start"
                      } animate-fade-in`}
                    >
                      <div className="flex flex-col max-w-[80%]">
                        <div
                          className={`rounded-2xl px-4 py-3 shadow-md ${
                            message.isUser
                              ? "bg-primary text-primary-foreground rounded-tr-md"
                              : "bg-muted text-foreground rounded-tl-md border border-border"
                          }`}
                        >
                          {typeof message.content === "object" ? (
                            <div className="mt-1 p-2 text-xs bg-muted rounded-md border border-border font-mono text-foreground/80">
                              {Object.entries(message.content).map(
                                ([key, value]) => (
                                  <div
                                    key={key}
                                    className="flex justify-between gap-2"
                                  >
                                    <span className="text-muted-foreground">
                                      {key}:
                                    </span>
                                    <span>{String(value)}</span>
                                  </div>
                                )
                              )}
                            </div>
                          ) : (
                            message.content
                          )}

                          <div
                            className={`text-xs mt-1 flex justify-end ${
                              message.isUser
                                ? "text-primary-foreground/70"
                                : "text-muted-foreground"
                            }`}
                          >
                            {formatTime(message.timestamp)}
                          </div>
                        </div>

                        {message.feedback && (
                          <div
                            className={`mt-2 rounded-lg p-3 border flex items-start gap-2 ${
                              message.feedback.type === "positive"
                                ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                                : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
                            }`}
                          >
                            {message.feedback.type === "positive" ? (
                              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                            ) : (
                              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1">
                              <p
                                className={`text-sm font-semibold ${
                                  message.feedback.type === "positive"
                                    ? "text-green-700 dark:text-green-300"
                                    : "text-red-700 dark:text-red-300"
                                }`}
                              >
                                {message.feedback.type === "positive"
                                  ? "✓ Ótimo!"
                                  : "⚠ Atenção"}
                              </p>
                              <p
                                className={`text-xs mt-1 ${
                                  message.feedback.type === "positive"
                                    ? "text-green-600 dark:text-green-400"
                                    : "text-red-600 dark:text-red-400"
                                }`}
                              >
                                {message.feedback.message}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {isTyping && (
                    <div className="flex justify-start animate-fade-in">
                      <div className="bg-muted border border-border rounded-2xl rounded-tl-md px-4 py-3 shadow-md">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                          <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                          <span className="w-2 h-2 rounded-full bg-primary animate-bounce" />
                        </div>
                      </div>
                    </div>
                  )}
                  {sessionEnded && feedback && (
                    <div
                      className={`mt-4 p-4 rounded-xl border text-sm animate-fade-in ${
                        feedback.avaliacao_geral === "excelente"
                          ? "bg-green-50 border-green-300 text-green-800 dark:bg-green-900/20 dark:text-green-300"
                          : feedback.avaliacao_geral === "regular"
                          ? "bg-yellow-50 border-yellow-300 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300"
                          : "bg-red-50 border-red-300 text-red-800 dark:bg-red-900/20 dark:text-red-300"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {feedback.avaliacao_geral === "excelente" && (
                          <CheckCircle2 className="w-5 h-5" />
                        )}
                        {feedback.avaliacao_geral === "regular" && (
                          <AlertCircle className="w-5 h-5" />
                        )}
                        {feedback.avaliacao_geral === "negativo" && (
                          <X className="w-5 h-5" />
                        )}
                        <strong>Feedback da Aurora:</strong>
                      </div>
                      <p>{feedback.feedback_texto}</p>

                      {feedback.violacoes && feedback.violacoes.length > 0 && (
                        <ul className="mt-2 list-disc list-inside text-xs text-red-600 dark:text-red-400">
                          {feedback.violacoes.map((v: string, i: number) => (
                            <li key={i}>{v}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex gap-2">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      sessionEnded
                        ? "Sessão finalizada. Clique em 'Nova Sessão' para continuar."
                        : isTyping
                        ? "Aguarde a resposta da IA..."
                        : "Digite sua resposta ao cliente..."
                    }
                    disabled={sessionEnded || isTyping}
                    className="min-h-[80px] flex-1 resize-none rounded-xl bg-background focus-visible:ring-primary"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!input.trim() || sessionEnded || isTyping}
                    className="self-end rounded-xl shadow-md h-[80px]"
                    size="icon"
                  >
                    {isTyping ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-primary-foreground" />
                    ) : (
                      <Send className="h-5 w-5" />
                    )}
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground italic">
                    Pressione Enter para enviar, Shift+Enter para nova linha
                  </p>
                  {sessionEnded && (
                    <Button
                      onClick={resetSession}
                      variant="outline"
                      size="sm"
                      className="gap-2"
                    >
                      <Bot className="w-4 h-4" />
                      Nova Sessão
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="w-[280px] rounded-2xl bg-gradient-to-br from-primary/10 via-background to-background border border-border shadow-inner flex flex-col p-4">
              {clientePerfil && (
                <div className="mb-4 p-3 rounded-xl border border-border bg-background/50">
                  <h3 className="font-semibold text-base mb-1 text-primary">
                    Personalidade do Cliente
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    <strong>{clientePerfil.nome}</strong> —{" "}
                    <span className="capitalize">{clientePerfil.tipo}</span>
                  </p>
                  <p className="text-sm mt-1 text-foreground/80 leading-snug">
                    {clientePerfil.descricao}
                  </p>
                  <div className="mt-2 text-[10px] text-muted-foreground italic">
                    Tom: {clientePerfil.tom} | Humor inicial:{" "}
                    {clientePerfil.humor_inicial}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm flex items-center gap-2 text-primary">
                    <HeartPulse className="w-4 h-4" />
                    Chance de Acordo
                  </h3>
                  <span
                    className={`text-xs font-bold ${
                      chanceAcordo < 40
                        ? "text-red-600"
                        : chanceAcordo < 70
                        ? "text-yellow-600"
                        : "text-green-600"
                    }`}
                  >
                    {typeof chanceAcordo === "number"
                      ? chanceAcordo.toFixed(0)
                      : "0"}
                    %
                  </span>
                </div>

                <Progress
                  value={chanceAcordo}
                  className={`h-2 rounded-full overflow-hidden ${
                    chanceAcordo < 40
                      ? "[&>*]:bg-red-500"
                      : chanceAcordo < 70
                      ? "[&>*]:bg-yellow-500"
                      : "[&>*]:bg-green-500"
                  } transition-all duration-700 ease-out`}
                />

                <p
                  className={`mt-3 text-xs leading-snug font-medium ${
                    chanceAcordo < 40
                      ? "text-red-600"
                      : chanceAcordo < 70
                      ? "text-yellow-600"
                      : "text-green-600"
                  }`}
                >
                  {comentario || "Aguardando progresso da negociação..."}
                </p>
              </div>

              {/* Indicador de estado com ícone e fundo suave */}
              <div
                className={`mt-4 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold shadow-sm border transition-all duration-500 ${
                  chanceAcordo < 40
                    ? "bg-red-50 dark:bg-red-950/20 border-red-200 text-red-700 dark:text-red-400"
                    : chanceAcordo < 70
                    ? "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 text-yellow-700 dark:text-yellow-400"
                    : "bg-green-50 dark:bg-green-950/20 border-green-200 text-green-700 dark:text-green-400"
                }`}
              >
                {chanceAcordo < 40 ? (
                  <AlertCircle className="w-4 h-4" />
                ) : chanceAcordo < 70 ? (
                  <HeartPulse className="w-4 h-4 animate-pulse" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                {chanceAcordo < 40
                  ? "Cliente resistente"
                  : chanceAcordo < 70
                  ? "Negociação em progresso"
                  : "Cliente confiante"}
              </div>
              <div className="mt-8 flex items-center justify-center gap-5 mb-2">
                <TooltipProvider delayDuration={100}>
                  {/* Objetivo da IA */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex flex-col items-center cursor-help group">
                        <div className="p-2 rounded-full bg-cyan-500/10 border border-cyan-500/30 group-hover:bg-cyan-500/20 transition-all">
                          <HeartPulse className="w-4 h-4 text-cyan-400 animate-pulse" />
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-1">
                          Objetivo
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      className="max-w-[220px] text-[11px] leading-snug bg-background/95 border-border backdrop-blur-md"
                    >
                      <p>
                        A Aurora IA treina empatia, técnica e clareza nas
                        negociações, ajudando cada operador a evoluir a cada
                        conversa.
                      </p>
                    </TooltipContent>
                  </Tooltip>

                  {/* Aprendizado Contínuo */}

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex flex-col items-center cursor-help group">
                        <div className="p-2 rounded-full bg-violet-500/10 border border-violet-500/30 group-hover:bg-violet-500/20 transition-all">
                          <Brain className="w-4 h-4 text-violet-400 animate-pulse" />
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-1">
                          Aprendizado
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      className="max-w-[220px] text-[11px] leading-snug bg-background/95 border-border backdrop-blur-md"
                    >
                      <p>
                        Cada interação é analisada anonimamente, aprimorando a
                        inteligência e adaptando o modelo para novos contextos.
                      </p>
                    </TooltipContent>
                  </Tooltip>

                  {/* Auditoria */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex flex-col items-center cursor-help group">
                        <div className="p-2 rounded-full bg-pink-500/10 border border-pink-500/30 group-hover:bg-pink-500/20 transition-all">
                          <ShieldCheck className="w-4 h-4 text-pink-400 animate-pulse" />
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-1">
                          Auditoria
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      className="max-w-[220px] text-[11px] leading-snug bg-background/95 border-border backdrop-blur-md"
                    >
                      <p>
                        Todas as simulações são auditadas para garantir ética,
                        segurança e melhoria contínua da experiência.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TreinamentoModal;
