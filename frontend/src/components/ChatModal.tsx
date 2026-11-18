// ChatModal.tsx com estilo visual melhorado
import React, { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, ThumbsDown, ThumbsUp, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  id: number;
  content: string;
  isUser: boolean;
  timestamp: Date;
  isProcessing?: boolean;
  aiMessageId?: number | null;
  feedback?: "useful" | "not_useful" | null;
  feedbackPending?: boolean;
}

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ChatModal: React.FC<ChatModalProps> = ({ isOpen, onClose }) => {
  const conversationIdRef = useRef<string>(
    globalThis.crypto?.randomUUID?.() ??
      `aurora-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  );
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      content:
        "Olá, {username}! Eu sou a Aurora IA. Como posso ajudar você hoje?",
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [variaveisCliente, setVariaveisCliente] = useState<string | null>(null);
  const [variaveisClienteRaw, setVariaveisClienteRaw] = useState<string | null>(
    null,
  );
  const [mostrarPerfilCliente, setMostrarPerfilCliente] = useState(false);

  const [showSugestoesPopup, setShowSugestoesPopup] = useState(false);
  const [kpisLoading, setKpisLoading] = useState(false);
  const [kpis, setKpis] = useState<{
    total_pago?: number;
    total_risco_pago?: number;
    total_acordo?: number;
    qtd_registros?: number;
    qtd_acordos?: number;
  } | null>(null);

  const limparNome = (nome: string | null): string => {
    return nome ? nome.replace(/\s+/g, " ").trim() : "";
  };

  // Normaliza texto da IA (remove quebras duplicadas e espaços extras)
  const normalizeText = (text: string): string => {
    return text
      .replace(/\n{3,}/g, "\n\n") // no máximo 1 linha em branco
      .replace(/\s+\n/g, "\n") // remove espaços antes de quebras
      .trim();
  };

  useEffect(() => {
    const storedUserName = localStorage.getItem("nomeCompleto");
    const cleanedName = limparNome(storedUserName);
    setUserName(cleanedName);
  }, []);

  useEffect(() => {
    if (userName) {
      const firstName = userName.split(" ")[0];
      setMessages((prevMessages) => {
        const updatedMessages = [...prevMessages];
        updatedMessages[0].content = updatedMessages[0].content.replace(
          "{username}",
          firstName,
        );
        return updatedMessages;
      });
    }
  }, [userName]);

  useEffect(() => {
    if (!isOpen || !userName) return;

    const controller = new AbortController();

    const carregarKpis = async () => {
      setKpisLoading(true);

      try {
        const res = await fetch("/api/ia/desempenho/kpis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ OPERADOR: userName }),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`Erro na API de KPIs: ${res.status}`);

        const data = await res.json();
        setKpis(data.kpis || null);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("Erro ao carregar KPIs da Aurora:", error);
          setKpis(null);
        }
      } finally {
        if (!controller.signal.aborted) setKpisLoading(false);
      }
    };

    carregarKpis();
    return () => controller.abort();
  }, [isOpen, userName]);

  const fetchRespostaIA = async (pergunta: string) => {
    try {
      const isAdmin = localStorage.getItem("userIsAdmin") === "true";
      const centroCusto = localStorage.getItem("centroCusto");
      const idOlosCx = localStorage.getItem("user_id_olos_cx");
      const idOlosCob = localStorage.getItem("user_id_olos_cob");

      const res = await fetch("/api/ia/desempenho", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          OPERADOR: userName,
          PERGUNTA: pergunta,
          IS_ADMIN: isAdmin,
          CENTRO_CUSTO: centroCusto,
          CONVERSA_ID: conversationIdRef.current,
          ID_OLOS_CX: idOlosCx,
          ID_OLOS_COB: idOlosCob,

        }),
      });

      if (!res.ok) throw new Error(`Erro na API: ${res.status}`);

      const data = await res.json();
      setKpis(data.contexto?.kpis || null);
      setVariaveisCliente(data.contexto?.variaveis_cliente || null);
      setVariaveisClienteRaw(data.contexto?.variaveis_cliente_raw || null);
      return {
        resposta: data.resposta || "Nao consegui gerar uma resposta no momento.",
        aiMessageId: data.contexto?.resposta_id ?? null,
      };
    } catch (error) {
      console.error(error);
      return {
        resposta: "Erro ao se conectar com a IA.",
        aiMessageId: null,
      };
    }
  };

  const handleFeedbackResposta = async (
    messageId: number,
    aiMessageId: number,
    feedback: "useful" | "not_useful",
  ) => {
    const previousMessages = messages;
    const respostaUtil = feedback === "useful";

    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId
          ? { ...msg, feedback, feedbackPending: true }
          : msg,
      ),
    );

    try {
      const res = await fetch("/api/ia/desempenho/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          MENSAGEM_ID: aiMessageId,
          OPERADOR: userName,
          RESPOSTA_UTIL: respostaUtil,
        }),
      });

      if (!res.ok) throw new Error(`Erro na API: ${res.status}`);

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, feedbackPending: false } : msg,
        ),
      );
    } catch (error) {
      console.error("Erro ao salvar feedback da IA:", error);
      setMessages(previousMessages);
    }
  };

  const handleSendMessage = async () => {
    if (input.trim() === "") return;

    const pergunta = input.trim();
    const newUserMessage: Message = {
      id: messages.length + 1,
      content: pergunta,
      isUser: true,
      timestamp: new Date(),
    };

    // Mensagem "carregando"
    const thinkingMessage: Message = {
      id: messages.length + 2,
      content: "⌛ Aurora está pensando...",
      isUser: false,
      timestamp: new Date(),
      isProcessing: true,
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setInput("");

    const respostaPromise = fetchRespostaIA(pergunta);
    await new Promise((resolve) => setTimeout(resolve, 850));
    setMessages((prev) => [...prev, thinkingMessage]);

    const [respostaIA] = await Promise.all([
      respostaPromise,
      new Promise((resolve) => setTimeout(resolve, 1100)),
    ]);

    // Substitui mensagem de carregando pela resposta real
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === thinkingMessage.id
          ? {
              ...msg,
              isProcessing: false,
              content:
                typeof respostaIA === "string"
                  ? respostaIA
                  : respostaIA.resposta,
              aiMessageId:
                typeof respostaIA === "string" ? null : respostaIA.aiMessageId,
              feedback: null,
              feedbackPending: false,
            }
          : msg,
      ),
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-[500px] md:max-w-[1000px] h-[90vh] flex flex-col overflow-hidden rounded-[28px] border border-cyan-300/20 bg-[#020b1b]/95 p-0 font-['Oxanium'] text-slate-100 shadow-[0_0_80px_rgba(20,125,255,.22),inset_0_0_45px_rgba(31,103,218,.05)] backdrop-blur-2xl">
          {/* HEADER */}
          <DialogHeader className="relative flex flex-row items-center gap-4 overflow-hidden bg-[linear-gradient(110deg,rgba(1,7,20,.99),rgba(2,9,24,.99),rgba(18,8,8,.96))] px-4 py-3 pr-12 text-left text-white md:px-6">
            <div className="flex shrink-0 items-center gap-3">
              <img
                src="/images/aurora/aurora-avatar-transparent-300-v1.png"
                className="h-11 w-11 rounded-full border border-cyan-300/30 bg-blue-950/60 object-cover object-top shadow-[0_0_24px_rgba(66,184,255,.3)] md:h-12 md:w-12"
              />
              <div>
                <DialogTitle className="bg-gradient-to-r from-cyan-200 via-blue-200 to-orange-300 bg-clip-text text-lg font-bold tracking-wide text-transparent">
                  Aurora IA
                </DialogTitle>
                <p className="hidden text-xs uppercase tracking-[0.12em] text-cyan-100/55 sm:block">
                  Seu copiloto inteligente
                </p>
              </div>
            </div>
            {(kpis || kpisLoading) && (
              <div className="ml-auto grid min-w-0 flex-1 animate-fade-in grid-cols-4 gap-2 md:max-w-[570px] md:gap-5 md:pr-8">
                {[
                  {
                    label: "Total pago",
                    valor: kpis?.total_pago,
                    cor: "text-emerald-400",
                    moeda: true,
                  },
                  {
                    label: "Risco pago",
                    valor: kpis?.total_risco_pago,
                    cor: "text-red-400",
                    moeda: true,
                  },
                  {
                    label: "Total acordo",
                    valor: kpis?.total_acordo,
                    cor: "text-blue-300",
                    moeda: true,
                  },
                  {
                    label: "Nº de acordos",
                    valor: kpis?.qtd_acordos ?? kpis?.qtd_registros,
                    cor: "text-purple-300",
                    moeda: false,
                  },
                ].map((item) => (
                  <div key={item.label} className="min-w-0 text-right">
                    <p className="truncate text-[9px] uppercase tracking-[0.08em] text-cyan-100/45 md:text-[10px]">
                      {item.label}
                    </p>
                    <p
                      className={`truncate text-xs font-bold tabular-nums md:text-base ${item.cor} ${
                        kpisLoading ? "animate-pulse text-cyan-100/25" : ""
                      }`}
                      title={
                        typeof item.valor === "number"
                          ? item.valor.toLocaleString("pt-BR")
                          : String(item.valor ?? "—")
                      }
                    >
                      {kpisLoading
                        ? "Consultando..."
                        : typeof item.valor === "number"
                        ? item.moeda
                          ? item.valor.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })
                          : item.valor.toLocaleString("pt-BR")
                        : "—"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </DialogHeader>

          {/* PERFIL DO CLIENTE */}
          {variaveisCliente && (
            <div className="border-b border-cyan-300/10 bg-[#04142d]/45 p-4">
              <button
                onClick={() => setMostrarPerfilCliente(!mostrarPerfilCliente)}
                className="flex w-full items-center justify-between text-left font-semibold text-cyan-100/80 transition hover:text-orange-300"
              >
                <span>📋 Perfil do Cliente</span>
                <span className="text-sm text-cyan-100/40">
                  {mostrarPerfilCliente ? "▲ ocultar" : "▼ ver detalhes"}
                </span>
              </button>

              {mostrarPerfilCliente && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="rounded-2xl border border-cyan-300/15 bg-blue-950/35 p-4 shadow-[inset_0_0_18px_rgba(40,126,255,.06)] transition hover:border-cyan-200/35">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-500 text-white p-2 rounded-full shadow">
                        🏦
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-cyan-100/45">
                          Carteiras com Dívida
                        </p>
                        <p className="text-xl font-bold text-blue-700">
                          {variaveisClienteRaw?.carteiras || "—"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-emerald-300/15 bg-emerald-950/20 p-4 shadow-[inset_0_0_18px_rgba(16,185,129,.05)] transition hover:border-emerald-200/35">
                    <div className="flex items-center gap-3">
                      <div className="bg-green-500 text-white p-2 rounded-full shadow">
                        💸
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-cyan-100/45">
                          Valor Médio
                        </p>
                        <p className="text-xl font-bold text-green-700">
                          {variaveisClienteRaw?.valor_medio
                            ? parseFloat(
                                variaveisClienteRaw.valor_medio,
                              ).toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })
                            : "—"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-orange-300/15 bg-orange-950/20 p-4 shadow-[inset_0_0_18px_rgba(249,115,22,.05)] transition hover:border-orange-200/35">
                    <div className="flex items-center gap-3">
                      <div className="bg-yellow-500 text-white p-2 rounded-full shadow">
                        📅
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-cyan-100/45">
                          Melhor Data de Pagamento
                        </p>
                        <p className="text-xl font-bold text-yellow-700">
                          {variaveisClienteRaw?.melhor_data_pagamento || "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MENSAGENS */}
          <ScrollArea className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_50%_20%,rgba(14,78,160,.13),transparent_52%)] p-6">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex items-end gap-2 ${
                    message.isUser ? "justify-end" : "justify-start"
                  }`}
                >
                  {!message.isUser && (
                    <img
                      src="/images/aurora/aurora-avatar-transparent-300-v1.png"
                      alt="Aurora"
                      className="h-16 w-14 shrink-0 object-cover object-top"
                    />
                  )}
                  <div
                    className={`aurora-chat-bubble-enter max-w-[70%] px-4 py-3 rounded-t-2xl shadow-sm ${
                      message.isUser
                        ? "origin-bottom-left rounded-bl-sm border border-orange-300/20 bg-gradient-to-br from-blue-600/85 to-blue-800/85 text-white shadow-[0_0_24px_rgba(31,111,255,.14)]"
                        : "origin-bottom-right rounded-br-sm border border-cyan-300/15 bg-[#06172f]/78 leading-relaxed text-slate-100 shadow-[0_0_24px_rgba(29,139,255,.1)] backdrop-blur-xl"
                    }`}
                  >
                    {message.isProcessing ? (
                      <div
                        className="aurora-processing-indicator flex items-center gap-3 py-0.5"
                        role="status"
                        aria-label="Aurora está processando a resposta"
                      >
                        <span className="text-sm tracking-wide text-cyan-100/80">
                          Processando
                        </span>
                        <span
                          className="flex items-center gap-1"
                          aria-hidden="true"
                        >
                          <i />
                          <i />
                          <i />
                        </span>
                      </div>
                    ) : (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        strong: ({ node, ...props }) => (
                          <strong
                            className="font-bold text-orange-600"
                            {...props}
                          />
                        ),
                        a: ({ node, ...props }) => (
                          <a
                            className="text-orange-500 underline"
                            target="_blank"
                            {...props}
                          />
                        ),
                        p: ({ node, ...props }) => (
                          <p
                            className="mb-2 whitespace-pre-line leading-relaxed"
                            {...props}
                          />
                        ),
                        li: ({ node, ...props }) => (
                          <li
                            className="ml-4 list-disc leading-snug"
                            {...props}
                          />
                        ),
                      }}
                    >
                      {normalizeText(message.content)}
                    </ReactMarkdown>
                    )}

                    <div
                      className={`text-[10px] mt-1 flex justify-end ${
                        message.isUser ? "text-white/70" : "text-cyan-100/35"
                      }`}
                    >
                      {formatTime(message.timestamp)}
                    </div>

                    {!message.isUser && message.aiMessageId && (
                      <div className="mt-3 border-t border-cyan-300/10 pt-2">
                        <div className="flex items-center justify-between gap-2 text-[11px] text-cyan-100/45">
                          <span>Essa resposta foi útil?</span>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="Resposta útil"
                              disabled={message.feedbackPending}
                              onClick={() =>
                                handleFeedbackResposta(
                                  message.id,
                                  message.aiMessageId!,
                                  "useful",
                                )
                              }
                              className={`h-7 w-7 rounded-full ${
                                message.feedback === "useful"
                                  ? "text-green-700 hover:bg-gray-800 hover:text-green-700"
                                  : "text-gray-500 hover:bg-gray-800 hover:text-green-700"
                              }`}
                            >
                              <ThumbsUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="Resposta não útil"
                              disabled={message.feedbackPending}
                              onClick={() =>
                                handleFeedbackResposta(
                                  message.id,
                                  message.aiMessageId!,
                                  "not_useful",
                                )
                              }
                              className={`h-7 w-7 rounded-full ${
                                message.feedback === "not_useful"
                                  ? "text-red-700 hover:bg-gray-800 hover:text-red-700"
                                  : "text-gray-500 hover:bg-gray-800 hover:text-red-700"
                              }`}
                            >
                              <ThumbsDown className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* INPUT */}
          <div className="space-y-2 border-t border-cyan-300/15 bg-[#030e22]/92 px-4 py-3">
            <div className="flex items-center gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua mensagem..."
                className="h-11 min-h-11 flex-1 resize-none rounded-2xl border-cyan-300/20 bg-[#06152f]/70 px-4 py-2.5 text-slate-100 shadow-[inset_0_0_20px_rgba(28,100,210,.08)] transition placeholder:text-slate-400/60 focus-visible:border-cyan-200/50 focus-visible:ring-2 focus-visible:ring-cyan-300/15"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!input.trim()}
                className="h-11 w-11 shrink-0 rounded-full border border-orange-200/45 bg-orange-400/15 p-0 text-orange-100 shadow-[0_0_20px_rgba(255,130,46,.24)] transition hover:bg-orange-400/30"
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>

            <p className="text-xs italic text-cyan-100/35">
              Enter = enviar | Shift+Enter = nova linha
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ChatModal;
