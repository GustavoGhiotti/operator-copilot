import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "@/utils/axiosInstance";
import type { Conversa, Mensagem } from "@/types/monitoria";
import { MensagemBubble } from "@/components/monitoria/MensagemBubble";
import { Input } from "@/components/ui/input";
import { Home, Send, Search, XCircle, UserCheck } from "lucide-react";
import { useMonitoriaSSE } from "@/hooks/useMonitoriaSSE";
import { toast } from "sonner";

type Aba = "ABERTAS" | "MINHAS";

export default function OperadorChat() {
  const navigate = useNavigate();

  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [conversaAtual, setConversaAtual] = useState<Conversa | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [busca, setBusca] = useState("");
  const [aba, setAba] = useState<Aba>("MINHAS");
  const [acessoNegado, setAcessoNegado] = useState(false);
  const [sseHabilitado, setSseHabilitado] = useState(false);
  const [assumindoConversa, setAssumindoConversa] = useState(false);
  const [encerrandoConversa, setEncerrandoConversa] = useState(false);
  const [enviandoMensagem, setEnviandoMensagem] = useState(false);

  const [unread, setUnread] = useState<Record<string, number>>({});

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const erroListagemAtivoRef = useRef(false);
  const erroMensagensAtivoRef = useRef(false);
  const conversaRemovidaAtivoRef = useRef(false);

  const cpfOperador = localStorage.getItem("userCpf") || "";
  const nomeOperador = localStorage.getItem("nomeCompleto") || "";
  const centroCusto = localStorage.getItem("centroCusto") || "";

  // ===============================
  // BUSCAR CONVERSAS
  // ===============================

  const fetchConversas = useCallback(async () => {
    try {
      const { data } = await axiosInstance.get(
        "/api/monitoria-whatsapp/conversas",
        { params: { centro_custo: centroCusto } }
      );

      const ordenadas = data.sort(
        (a: Conversa, b: Conversa) =>
          new Date(b.atualizadoEm).getTime() -
          new Date(a.atualizadoEm).getTime()
      );

      setConversas(ordenadas);
      setConversaAtual((atual) => {
        if (!atual) return null;

        const conversaAtualizada =
          ordenadas.find((conversa: Conversa) => conversa.id === atual.id) ?? null;

        if (!conversaAtualizada) {
          setMensagens([]);
          setTexto("");

          if (!conversaRemovidaAtivoRef.current) {
            toast.info("A conversa selecionada nao esta mais disponivel nesta fila.");
            conversaRemovidaAtivoRef.current = true;
          }

          return null;
        }

        conversaRemovidaAtivoRef.current = false;
        return conversaAtualizada;
      });
      setAcessoNegado(false);
      setSseHabilitado(true);
      erroListagemAtivoRef.current = false;
    } catch (err: any) {
      if (err?.response?.status === 403) {
        setAcessoNegado(true);
        setSseHabilitado(false);
        setConversas([]);
        setConversaAtual(null);
        erroListagemAtivoRef.current = false;
        return;
      }

      console.error("Erro ao carregar conversas:", err);
      setSseHabilitado(false);

      if (!erroListagemAtivoRef.current) {
        toast.error(
          err?.response?.data?.mensagem ||
            "Nao foi possivel carregar a fila da monitoria. Tente novamente em instantes."
        );
        erroListagemAtivoRef.current = true;
      }
    }

  }, [centroCusto]);

  // ===============================
  // BUSCAR MENSAGENS
  // ===============================

  const fetchMensagens = useCallback(async (id: string) => {
    try {
      const { data } = await axiosInstance.get(
        `/api/monitoria-whatsapp/conversas/${id}/mensagens`
      );

      const msgs: Mensagem[] = data.map((m: any) => ({
        id: m.ID_MENSAGEM,
        conversaId: id,
        conteudo: m.CONTEUDO_MENSAGEM,
        direcao: m.DIRECAO,
        operadorNome: m.NOME_OPERADOR_ENVIO,
        criadoEm: m.DATA_COLETA_SISTEMA
      }));

      setMensagens(msgs);
      erroMensagensAtivoRef.current = false;
    } catch (err: any) {
      if (err?.response?.status === 403) {
        setAcessoNegado(true);
        setSseHabilitado(false);
        setMensagens([]);
        setConversaAtual(null);
        erroMensagensAtivoRef.current = false;
        return;
      }

      console.error("Erro ao carregar mensagens:", err);

      if (!erroMensagensAtivoRef.current) {
        toast.error(
          err?.response?.data?.mensagem ||
            "Nao foi possivel carregar as mensagens da conversa no momento."
        );
        erroMensagensAtivoRef.current = true;
      }
    }

  }, []);

  // ===============================
  // SSE REALTIME
  // ===============================

  useMonitoriaSSE({
    enabled: sseHabilitado && !acessoNegado,

    onMensagemUpdate: (data: any) => {

      fetchConversas();

      const conversaId = String(data?.conversaId);

      if (conversaAtual?.id === conversaId) {

        fetchMensagens(conversaAtual.id);

      } else {

        setUnread(prev => ({
          ...prev,
          [conversaId]: (prev[conversaId] || 0) + 1
        }));

      }

    },

    onConversaUpdate: () => {
      fetchConversas();
    }

  });

  // ===============================
  // AÇÕES
  // ===============================

  function obterMensagemErro(err: any, fallback: string) {
    return (
      err?.response?.data?.mensagem ||
      err?.response?.data?.erro ||
      err?.message ||
      fallback
    );
  }

  function abrirConversa(c: Conversa) {

    setConversaAtual(c);
    conversaRemovidaAtivoRef.current = false;

    setUnread(prev => ({
      ...prev,
      [c.id]: 0
    }));

    fetchMensagens(c.id);

  }

  async function assumirConversa() {

    if (!conversaAtual) return;

    try {
      setAssumindoConversa(true);

      await axiosInstance.post("/api/monitoria-whatsapp/assumir-conversa", {
        id_conversa: conversaAtual.id
      });

      await fetchConversas();
      await fetchMensagens(conversaAtual.id);
      toast.success("Conversa assumida com sucesso.");
    } catch (err) {
      console.error("Erro ao assumir conversa:", err);
      toast.error(obterMensagemErro(err, "Nao foi possivel assumir a conversa."));
    } finally {
      setAssumindoConversa(false);
    }
 
  }

  async function encerrarConversa() {
 
    if (!conversaAtual) return;

    try {
      setEncerrandoConversa(true);

      await axiosInstance.post("/api/monitoria-whatsapp/finalizar-atendimento", {
        id_conversa: conversaAtual.id
      });

      setConversaAtual(null);
      setMensagens([]);
      setTexto("");
      conversaRemovidaAtivoRef.current = false;
      await fetchConversas();
      toast.success("Atendimento encerrado.");
    } catch (err) {
      console.error("Erro ao encerrar conversa:", err);
      toast.error(obterMensagemErro(err, "Nao foi possivel encerrar a conversa."));
    } finally {
      setEncerrandoConversa(false);
    }
 
  }

  async function enviarMensagem() {
 
    if (!texto.trim() || !conversaAtual) return;

    try {
      setEnviandoMensagem(true);

      await axiosInstance.post("/api/monitoria-whatsapp/enviar", {
        numero_cliente: conversaAtual.clienteTelefone,
        cpf_operador: cpfOperador,
        nome_operador: nomeOperador,
        conteudo: texto
      });

      setTexto("");

      await fetchMensagens(conversaAtual.id);
      await fetchConversas();
      toast.success("Mensagem enviada.");
    } catch (err) {
      console.error("Erro ao enviar mensagem:", err);
      toast.error(obterMensagemErro(err, "Nao foi possivel enviar a mensagem."));
    } finally {
      setEnviandoMensagem(false);
    }
 
  }

  function handleKeyDown(e: React.KeyboardEvent) {

    if (e.key === "Enter" && !e.shiftKey) {

      e.preventDefault();
      enviarMensagem();

    }

  }

  // ===============================
  // INIT
  // ===============================

  useEffect(() => {
    fetchConversas();
  }, [fetchConversas]);

  useEffect(() => {
    if (acessoNegado) return;

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      fetchConversas();
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [acessoNegado, fetchConversas]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (acessoNegado) return;

      fetchConversas();

      if (conversaAtual?.id) {
        fetchMensagens(conversaAtual.id);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [acessoNegado, conversaAtual?.id, fetchConversas, fetchMensagens]);

  // ===============================
  // SCROLL INTELIGENTE
  // ===============================

  useEffect(() => {

    const el = scrollRef.current;

    if (!el) return;

    const isNearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 120;

    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }

  }, [mensagens]);

  // ===============================
  // FILTRO
  // ===============================

  function filtrar(lista: Conversa[]) {
 
    const termo = busca.trim().toLowerCase();

    if (!termo) return lista;
 
    return lista.filter((c) => {
      const clienteNome = (c.clienteNome || "").toLowerCase();
      const clienteTelefone = c.clienteTelefone || "";
      const numeroEmpresa = c.numeroEmpresa || c.numero_empresa || "";

      return (
        clienteTelefone.includes(termo) ||
        numeroEmpresa.includes(termo) ||
        clienteNome.includes(termo)
      );
    });
 
  }

  // ===============================
  // LISTAS
  // ===============================

  const abertas = filtrar(
    conversas.filter((c) => c.status === "ABERTA")
  );

  const minhas = filtrar(
    conversas.filter(
      (c) =>
        c.status === "EM_ATENDIMENTO" &&
        c.operadorNome === nomeOperador
    )
  );

  const listaAtual = busca.trim()
    ? filtrar(conversas)
    : aba === "ABERTAS"
      ? abertas
      : minhas;

  function formatHora(data?: string) {

    if (!data) return "";

    const d = new Date(data);

    return d.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit"
    });

  }

  // ===============================
  // RENDER
  // ===============================

  return (
    acessoNegado ? (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Acesso nao permitido
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Sua carteira nao esta habilitada para operar no modulo de monitoria WhatsApp.
          </p>
        </div>
      </div>
    ) : (

    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.12),transparent_20%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.08),transparent_24%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(2,6,23,1))] p-2.5">
      <div className="flex h-[calc(100vh-1.25rem)] w-full overflow-hidden rounded-[24px] border border-white/10 bg-card/70 shadow-[0_18px_56px_rgba(2,6,23,0.4)] backdrop-blur-xl">

      {/* SIDEBAR */}

      <div className="flex w-[292px] flex-col border-r border-white/10 bg-slate-950/45">

        {/* BUSCA */}

        <div className="border-b border-white/10 p-2.5">

          <div className="mb-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                  Operador
                </p>
                <h1 className="mt-1 text-[1.35rem] font-black tracking-tight text-foreground">
                  Atendimento
                </h1>
              </div>
              <button
                onClick={() => navigate("/home")}
                aria-label="Voltar para a pagina inicial"
                title="Ir para o inicio"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] border border-white/10 bg-white/[0.04] text-muted-foreground transition-all hover:border-primary/30 hover:bg-white/[0.08] hover:text-foreground"
              >
                <Home className="h-4 w-4" />
              </button>
            </div>
            <h1 className="mt-1 text-[1.35rem] font-black tracking-tight text-foreground">
              
            </h1>
            <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
              Assuma, responda e finalize conversas da sua carteira.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-[16px] border border-white/10 bg-white/[0.04] px-3 transition-all duration-200 focus-within:border-primary/30 focus-within:bg-white/[0.06] focus-within:shadow-[0_0_0_1px_rgba(249,115,22,0.12)]">

            <Search size={16} />

            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar conversa..."
               className="h-10 w-full bg-transparent py-2 pr-1 text-[13px] outline-none"
              />

          </div>

        </div>

        {/* ABAS */}

        <div className="border-b border-white/10 px-2.5 pb-2.5">
          <div className="mb-2 grid grid-cols-2 gap-2">
            <div className="rounded-[16px] border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.03] px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Abertas
              </p>
              <p className="mt-1 text-[1.2rem] font-black text-foreground">{abertas.length}</p>
            </div>
            <div className="rounded-[16px] border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.03] px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Minhas
              </p>
              <p className="mt-1 text-[1.2rem] font-black text-foreground">{minhas.length}</p>
            </div>
          </div>

          <div className="flex rounded-[16px] border border-white/10 bg-white/[0.04] p-1">

          <button
            onClick={() => setAba("ABERTAS")}
                className={`flex-1 rounded-xl py-1.5 text-[13px] font-semibold transition-all ${
              aba === "ABERTAS"
                ? "bg-primary text-primary-foreground shadow-[0_10px_24px_rgba(249,115,22,0.25)]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Abertas ({abertas.length})
          </button>

          <button
            onClick={() => setAba("MINHAS")}
                className={`flex-1 rounded-xl py-1.5 text-[13px] font-semibold transition-all ${
              aba === "MINHAS"
                ? "bg-primary text-primary-foreground shadow-[0_10px_24px_rgba(249,115,22,0.25)]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Minhas ({minhas.length})
          </button>

          </div>
        </div>

        {/* LISTA */}

        <div className="custom-scrollbar flex-1 overflow-y-auto p-1.5">

          {listaAtual.length === 0 && (
            <div className="rounded-[16px] border border-dashed border-white/10 bg-white/[0.03] px-4 py-6 text-center text-[13px] text-muted-foreground">
              {busca.trim()
                ? "Nenhuma conversa encontrada para a busca informada."
                : aba === "MINHAS"
                  ? "Voce ainda nao possui conversas em atendimento."
                  : "Nao ha conversas abertas no momento."}
            </div>
          )}

          {listaAtual.map((c) => (

            <div
              key={c.id}
              onClick={() => abrirConversa(c)}
              className={`mb-1.5 cursor-pointer rounded-[16px] border border-white/8 p-2.5 transition-all hover:border-white/15 hover:bg-white/[0.05] ${
                conversaAtual?.id === c.id
                  ? "border-primary/30 bg-[linear-gradient(135deg,rgba(249,115,22,0.12),rgba(249,115,22,0.05),transparent)] shadow-[0_16px_32px_rgba(249,115,22,0.14)]"
                  : ""
              }`}
            >

              <div className="flex items-start justify-between gap-3">

                <div className="min-w-0">
                  <span className="block truncate text-[0.86rem] font-semibold">
                    {c.clienteNome || c.clienteTelefone}
                  </span>
                  <span className="mt-1 block text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
                    {c.status === "ABERTA" ? "Aguardando operador" : "Em atendimento"}
                  </span>
                </div>

                {unread[c.id] > 0 && (

                  <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                    {unread[c.id]}
                  </span>

                )}

              </div>

              {c.ultimaMensagem && (

                  <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">

                    <span className="max-w-[150px] truncate">

                    {c.ultimaMensagem}

                  </span>

                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5">

                    {formatHora(c.ultimaMensagemEm)}

                  </span>

                </div>

              )}

            </div>

          ))}

        </div>

      </div>

      {/* CHAT */}

      <div className="relative flex flex-1 flex-col bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.08),transparent_20%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_35%)]">

        {!conversaAtual && (

          <div className="flex flex-1 items-center justify-center px-5">
            <div className="max-w-md text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[24px] border border-primary/15 bg-primary/10 text-primary shadow-[0_18px_44px_rgba(249,115,22,0.14)]">
                <Send size={22} />
              </div>
              <h2 className="mt-5 text-xl font-black tracking-tight text-foreground">
                Selecione uma conversa
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Escolha uma conversa na lateral para visualizar o historico e iniciar a interacao com o cliente.
              </p>
            </div>
          </div>

        )}

        {conversaAtual && (

          <>

            <header className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-4 py-3.5 backdrop-blur-xl">

              <div>

                  <div className="text-[15px] font-black tracking-tight sm:text-base">
                    {conversaAtual.clienteTelefone}
                  </div>

                {conversaAtual.status === "EM_ATENDIMENTO" && (

                  <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    Atendendo: {conversaAtual.operadorNome}
                  </div>

                )}

              </div>

              <div className="flex gap-2">

                {conversaAtual.status === "ABERTA" && (

                  <button
                    onClick={assumirConversa}
                    disabled={assumindoConversa}
                    className="inline-flex items-center gap-2 rounded-[18px] bg-sky-500 px-3.5 py-2 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(14,165,233,0.22)] transition-all hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <UserCheck size={16} />
                    {assumindoConversa ? "Assumindo..." : "Assumir"}
                  </button>

                )}

                {conversaAtual.status === "EM_ATENDIMENTO" &&
                  conversaAtual.operadorNome === nomeOperador && (

                    <button
                      onClick={encerrarConversa}
                      disabled={encerrandoConversa}
                      className="inline-flex items-center gap-2 rounded-[18px] border border-rose-400/20 bg-rose-500/10 px-3.5 py-2 text-sm font-semibold text-rose-200 transition-all hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <XCircle size={16} />
                      {encerrandoConversa ? "Encerrando..." : "Encerrar"}
                    </button>

                  )}

              </div>

            </header>

            <div
              ref={scrollRef}
               className="custom-scrollbar flex-1 overflow-y-auto bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_18%),radial-gradient(circle_at_top_left,rgba(249,115,22,0.07),transparent_16%)] px-4 py-4"
             >

              {mensagens.map((m) => (
                <MensagemBubble key={m.id} mensagem={m} />
              ))}

              <div ref={bottomRef} />

            </div>

            {conversaAtual.status === "EM_ATENDIMENTO" &&
              conversaAtual.operadorNome === nomeOperador && (

                 <div className="border-t border-white/10 bg-white/[0.03] px-4 py-3.5">
                   <div className="mx-auto flex max-w-4xl items-end gap-3">

                   <Input
                     value={texto}
                     onChange={(e) => setTexto(e.target.value)}
                     onKeyDown={handleKeyDown}
                     placeholder="Digite uma mensagem..."
                      disabled={enviandoMensagem}
                      className="h-12 rounded-[18px] border-white/10 bg-white/[0.04] px-4"
                    />
  
                    <button
                      onClick={enviarMensagem}
                      disabled={enviandoMensagem}
                      className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-primary text-white shadow-[0_16px_30px_rgba(249,115,22,0.22)] transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                    <Send size={16} />
                  </button>

                  </div>
                </div>

              )}

          </>

        )}

      </div>

      </div>
    </div>
    )

  );

}
