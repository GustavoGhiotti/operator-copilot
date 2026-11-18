import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, ChevronsUpDown, Send, UserCheck, PhoneOff } from "lucide-react";
import axiosInstance from "@/utils/axiosInstance";
import { useMonitoriaSSE } from "@/hooks/useMonitoriaSSE";
import { MensagemBubble } from "@/components/monitoria/MensagemBubble";
import type { Conversa, Mensagem } from "@/types/monitoria";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

type OperadorTransferencia = {
  cpf: string;
  nome: string;
  funcao?: string;
  centro_custo?: string;
};

export default function ConversaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [conversa, setConversa] = useState<Conversa | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [acessoNegado, setAcessoNegado] = useState(false);
  const [sseHabilitado, setSseHabilitado] = useState(false);
  const [operadoresTransferencia, setOperadoresTransferencia] = useState<OperadorTransferencia[]>([]);
  const [cpfDestinoTransferencia, setCpfDestinoTransferencia] = useState("");
  const [carregandoOperadores, setCarregandoOperadores] = useState(false);
  const [transferindo, setTransferindo] = useState(false);
  const [popoverTransferenciaAberto, setPopoverTransferenciaAberto] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const debounceRef= useRef<any>(null);

  const cpfOperador = localStorage.getItem("userCpf") || "";
  const nomeOperador = localStorage.getItem("nomeCompleto") || "";
  const podeOperarWhatsapp =
    localStorage.getItem("userCanOperadorWhatsapp") === "true";
  const podeMonitoriaWhatsapp =
    localStorage.getItem("userCanMonitoriaWhatsapp") === "true";

  const normalizarMensagem = useCallback((msg: any): Mensagem => {
    return {
      id: msg.ID_MENSAGEM ?? msg.id ?? Date.now(),
      conversaId: msg.ID_CONVERSA ?? msg.conversaId ?? Number(id),
      conteudo: msg.CONTEUDO_MENSAGEM ?? msg.conteudo ?? "",
      direcao: msg.DIRECAO ?? msg.direcao ?? "",
      operadorNome: msg.NOME_OPERADOR_ENVIO ?? msg.operadorNome ?? undefined,
      criadoEm: msg.DATA_COLETA_SISTEMA ?? msg.criadoEm ?? new Date().toISOString(),
    };
  }, [id]);

  const fetchConversa = useCallback(async () => {
    try {
      const centroCusto = localStorage.getItem("centroCusto");

      const { data } = await axiosInstance.get("/api/monitoria-whatsapp/conversas", {
        params: { centro_custo: centroCusto }
      });

      const lista = Array.isArray(data) ? data : [];
      const conv = lista.find((item: any) => Number(item.id) === Number(id));

      if (conv) {
        setConversa(conv);
      } else {
        setConversa(null);
      }
      setAcessoNegado(false);
      setSseHabilitado(true);
    } catch (err: any) {
      if (err?.response?.status === 403) {
        setAcessoNegado(true);
        setSseHabilitado(false);
        setConversa(null);
        return;
      }
      console.error("Erro ao carregar conversa:", err);
    }
  }, [id]);

  const fetchMensagens = useCallback(async () => {
    try {
      const { data } = await axiosInstance.get(
        `/api/monitoria-whatsapp/conversas/${id}/mensagens`
      );

      const mensagensNormalizadas = Array.isArray(data)
        ? data.map(normalizarMensagem)
        : [];

      setMensagens(mensagensNormalizadas);
      setSseHabilitado(true);
    } catch (err: any) {
      if (err?.response?.status === 403) {
        setAcessoNegado(true);
        setSseHabilitado(false);
        setMensagens([]);
        return;
      }
      console.error("Erro ao carregar mensagens:", err);
    }
  }, [id, normalizarMensagem]);

  const fetchOperadoresTransferencia = useCallback(async () => {
    if (!podeMonitoriaWhatsapp) return;

    setCarregandoOperadores(true);

    try {
      const { data } = await axiosInstance.get(
        "/api/monitoria-whatsapp/operadores-disponiveis"
      );

      const lista = Array.isArray(data) ? data : [];
      setOperadoresTransferencia(lista);
      setCpfDestinoTransferencia((atual) => {
        if (atual && lista.some((item: OperadorTransferencia) => item.cpf === atual)) {
          return atual;
        }
        return "";
      });
    } catch (err) {
      console.error("Erro ao carregar operadores para transferencia:", err);
      toast.error("Nao foi possivel carregar operadores para transferencia.");
    } finally {
      setCarregandoOperadores(false);
    }
  }, [podeMonitoriaWhatsapp]);

  useEffect(() => {
    fetchConversa();
    fetchMensagens();
  }, [fetchConversa, fetchMensagens]);

  useEffect(() => {
    if (!podeMonitoriaWhatsapp) return;
    if (conversa?.status !== "EM_ATENDIMENTO") {
      setCpfDestinoTransferencia("");
      setPopoverTransferenciaAberto(false);
      return;
    }
  }, [conversa?.status, podeMonitoriaWhatsapp]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

useMonitoriaSSE({
  enabled: sseHabilitado && !acessoNegado,
  onMensagemUpdate: (data) => {

    const conversaIdEvento = Number((data as any).conversaId);

    if (conversaIdEvento === Number(id)) {

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {

        fetchMensagens();
        fetchConversa();

      }, 300);

    }

  },

  onConversaUpdate: (data) => {

    const conv = data as Partial<Conversa> & { id?: number };

    if (Number(conv.id) === Number(id)) {
      fetchConversa();
    }

  }

});

  if (acessoNegado) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Acesso nao permitido
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Sua carteira nao esta habilitada para visualizar esta conversa.
          </p>
        </div>
      </div>
    );
  }

  const enviarMensagem = async () => {
    if (!texto.trim() || enviando || !conversa) return;

    setEnviando(true);

    try {
      await axiosInstance.post("/api/monitoria-whatsapp/enviar", {
        cpf_operador: cpfOperador,
        nome_operador: nomeOperador,
        numero_cliente: conversa.clienteTelefone,
        conteudo: texto.trim(),
      });

      setTexto("");
      fetchMensagens();
      fetchConversa();
    } catch (err) {
      console.error("Erro ao enviar mensagem:", err);
    } finally {
      setEnviando(false);
    }
  };

  const assumirConversa = async () => {

  if (!conversa) return;

  try {

    await axiosInstance.post("/api/monitoria-whatsapp/assumir-conversa", {
      id_conversa: conversa.id,
      cpf_operador: cpfOperador,
      nome_operador: nomeOperador
    });

    fetchConversa();

  } catch (err) {
    console.error("Erro ao assumir conversa:", err);
    toast.error("Nao foi possivel assumir a conversa.");
  }
};

  const finalizarAtendimento = async () => {
    if (!conversa) return;

    try {
      await axiosInstance.post("/api/monitoria-whatsapp/finalizar-atendimento", {
        id_conversa: conversa.id,
        cpf_operador: cpfOperador,
        nome_operador: nomeOperador,
      });

      fetchConversa();
      toast.success("Atendimento finalizado.");
    } catch (err) {
      console.error("Erro ao finalizar atendimento:", err);
      toast.error("Nao foi possivel finalizar o atendimento.");
    }
  };

  const encerrarComoSupervisor = async () => {
    if (!conversa) return;

    const motivo =
      window.prompt(
        "Informe o motivo do encerramento:",
        "ENCERRADO_SUPERVISOR"
      ) || "ENCERRADO_SUPERVISOR";
    const observacao =
      window.prompt(
        "Observacao do encerramento (opcional):",
        ""
      ) || "";

    try {
      await axiosInstance.post("/api/monitoria-whatsapp/encerrar-supervisor", {
        id_conversa: conversa.id,
        motivo_finalizacao: motivo.trim() || "ENCERRADO_SUPERVISOR",
        observacao_finalizacao: observacao.trim() || undefined,
      });

      await fetchConversa();
      await fetchMensagens();
      toast.success("Conversa encerrada pelo supervisor.");
    } catch (err) {
      console.error("Erro ao encerrar conversa como supervisor:", err);
      toast.error("Nao foi possivel encerrar a conversa.");
    }
  };

  const reabrirComoSupervisor = async () => {
    if (!conversa) return;

    try {
      await axiosInstance.post("/api/monitoria-whatsapp/reabrir", {
        id_conversa: conversa.id,
      });

      await fetchConversa();
      await fetchMensagens();
      toast.success("Conversa reaberta com sucesso.");
    } catch (err) {
      console.error("Erro ao reabrir conversa:", err);
      toast.error("Nao foi possivel reabrir a conversa.");
    }
  };

  const transferirComoSupervisor = async () => {
    if (!conversa || !cpfDestinoTransferencia) return;

    const destino = operadoresTransferencia.find(
      (operador) => operador.cpf === cpfDestinoTransferencia
    );

    if (!destino) {
      toast.error("Selecione um operador valido para transferencia.");
      return;
    }

    setTransferindo(true);

    try {
      await axiosInstance.post("/api/monitoria-whatsapp/transferir", {
        id_conversa: conversa.id,
        cpf_destino: destino.cpf,
        nome_destino: destino.nome,
      });

      setPopoverTransferenciaAberto(false);
      setCpfDestinoTransferencia("");
      await fetchConversa();
      await fetchMensagens();
      toast.success(`Conversa transferida para ${destino.nome}.`);
    } catch (err) {
      console.error("Erro ao transferir conversa:", err);
      toast.error("Nao foi possivel transferir a conversa.");
    } finally {
      setTransferindo(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviarMensagem();
    }
  };

  const operadorSelecionadoTransferencia =
    operadoresTransferencia.find((operador) => operador.cpf === cpfDestinoTransferencia) ?? null;
  const operadoresElegiveisTransferencia = operadoresTransferencia.filter(
    (operador) => operador.nome !== conversa?.operadorNome
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.14),transparent_22%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.10),transparent_24%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(2,6,23,1))] p-4">
      <div className="flex h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-[32px] border border-white/10 bg-card/70 shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl">
      <header className="flex items-center gap-3 border-b border-white/10 bg-white/[0.03] px-5 py-4 backdrop-blur-xl">
        <button
          onClick={() => navigate("/monitoria-dev")}
          className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        {conversa && (
          <div className="flex flex-1 items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/20 to-primary/5 text-sm font-bold text-primary shadow-inner">
              {conversa.clienteNome?.charAt(0)?.toUpperCase() ?? "?"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {conversa.clienteNome}
              </p>
              <p className="text-xs text-muted-foreground">
                {conversa.clienteTelefone}
              </p>
            </div>
          </div>
        )}

          <div className="flex gap-2">
          {podeOperarWhatsapp && conversa?.status === "ABERTA" && (
            <button
              onClick={assumirConversa}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-sky-500 px-4 py-2.5 text-xs font-semibold text-white shadow-[0_16px_30px_rgba(14,165,233,0.22)] transition-colors hover:bg-sky-400"
            >
              <UserCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Assumir</span>
            </button>
          )}

          {podeOperarWhatsapp && conversa?.status === "EM_ATENDIMENTO" && (
            <button
              onClick={finalizarAtendimento}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-2.5 text-xs font-semibold text-rose-200 transition-colors hover:bg-rose-500/15"
            >
              <PhoneOff className="h-4 w-4" />
              <span className="hidden sm:inline">Finalizar</span>
            </button>
          )}

          {podeMonitoriaWhatsapp && conversa?.status === "EM_ATENDIMENTO" && (
            <Popover
              open={popoverTransferenciaAberto}
              onOpenChange={(aberto) => {
                setPopoverTransferenciaAberto(aberto);

                if (
                  aberto &&
                  !carregandoOperadores &&
                  operadoresTransferencia.length === 0
                ) {
                  fetchOperadoresTransferencia();
                }
              }}
            >
              <PopoverTrigger asChild>
                <button
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-2.5 text-xs font-semibold text-amber-200 transition-colors hover:bg-amber-500/15"
                >
                  <ChevronsUpDown className="h-4 w-4" />
                  <span className="hidden sm:inline">Transferir</span>
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-[360px] rounded-[24px] border border-white/10 bg-slate-950/95 p-0 text-foreground shadow-[0_24px_60px_rgba(2,6,23,0.55)] backdrop-blur-xl"
              >
                <div className="border-b border-white/10 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Transferir conversa
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    Busque o operador de destino da mesma carteira.
                  </p>
                </div>
                <Command className="bg-transparent text-foreground">
                  <CommandInput
                    placeholder="Digite o nome do operador..."
                    className="text-foreground placeholder:text-muted-foreground"
                  />
                  <CommandList className="max-h-[280px]">
                    <CommandEmpty>
                      {carregandoOperadores
                        ? "Carregando operadores..."
                        : "Nenhum operador elegivel encontrado."}
                    </CommandEmpty>
                    <CommandGroup>
                      {operadoresElegiveisTransferencia.map((operador) => (
                        <CommandItem
                          key={operador.cpf}
                          value={`${operador.nome} ${operador.cpf}`}
                          onSelect={() => setCpfDestinoTransferencia(operador.cpf)}
                          className="flex items-center gap-3 rounded-xl px-3 py-3 text-foreground data-[selected=true]:bg-white/[0.08] data-[selected=true]:text-foreground"
                        >
                          <Check
                            className={`h-4 w-4 ${
                              cpfDestinoTransferencia === operador.cpf
                                ? "opacity-100 text-primary"
                                : "opacity-0"
                            }`}
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {operador.nome}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {operador.funcao || "Operador"} {operador.centro_custo ? `• ${operador.centro_custo}` : ""}
                            </p>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
                <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
                  <div className="min-w-0 space-y-2">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Atual
                      </p>
                      <p className="truncate text-sm text-foreground">
                        {conversa?.operadorNome || "Sem operador atual"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Destino
                      </p>
                      <p className="truncate text-sm text-foreground">
                        {operadorSelecionadoTransferencia?.nome || "Nenhum operador selecionado"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={transferirComoSupervisor}
                    disabled={
                      !cpfDestinoTransferencia ||
                      carregandoOperadores ||
                      transferindo ||
                      operadorSelecionadoTransferencia?.nome === conversa?.operadorNome
                    }
                    className="inline-flex h-10 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 text-xs font-semibold text-amber-200 transition-colors hover:bg-amber-500/15 disabled:opacity-50"
                  >
                    {transferindo ? "Transferindo..." : "Confirmar"}
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          )}

          {podeMonitoriaWhatsapp && conversa?.status === "EM_ATENDIMENTO" && (
            <button
              onClick={encerrarComoSupervisor}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-2.5 text-xs font-semibold text-rose-200 transition-colors hover:bg-rose-500/15"
            >
              <PhoneOff className="h-4 w-4" />
              <span className="hidden sm:inline">Encerrar</span>
            </button>
          )}

          {podeMonitoriaWhatsapp && conversa?.status === "ENCERRADA" && (
            <button
              onClick={reabrirComoSupervisor}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-2.5 text-xs font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/15"
            >
              <UserCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Reabrir</span>
            </button>
          )}
        </div>
      </header>

       <div className="custom-scrollbar flex-1 overflow-y-auto bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_18%),radial-gradient(circle_at_top_left,rgba(249,115,22,0.07),transparent_16%)] px-6 py-6">
        {mensagens.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma mensagem ainda.
          </p>
        ) : (
          mensagens.map((m) => <MensagemBubble key={m.id} mensagem={m} />)
        )}
        <div ref={bottomRef} />
      </div>

      {podeOperarWhatsapp && conversa?.status !== "ENCERRADA" && (
        <div className="border-t border-white/10 bg-white/[0.03] px-6 py-5">
          <div className="mx-auto flex max-w-4xl items-end gap-3">
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite uma mensagem..."
              rows={1}
              className="flex-1 resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              onClick={enviarMensagem}
              disabled={!texto.trim() || enviando}
              className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_16px_30px_rgba(249,115,22,0.22)] transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
