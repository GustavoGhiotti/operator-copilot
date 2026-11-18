import { useEffect, useRef, useCallback } from "react";

interface UseMonitoriaSSEOptions {
  enabled?: boolean;
  onMessage?: (event: MessageEvent) => void;
  onDashboardUpdate?: (data: unknown) => void;
  onConversaUpdate?: (data: unknown) => void;
  onMensagemUpdate?: (data: unknown) => void;
}

const STORAGE_KEY = "monitoria_ultimo_evento_id";

export function useMonitoriaSSE(options: UseMonitoriaSSEOptions = {}) {
  const sourceRef = useRef<EventSource | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout>>();
  const mountedRef = useRef(true);
  const ultimoEventoIdRef = useRef<number>(
    Number(sessionStorage.getItem(STORAGE_KEY) || 0)
  );

  const connect = useCallback(() => {
    if (options.enabled === false) return;
    if (!mountedRef.current) return;

    const token = localStorage.getItem("userToken") || "";
    const url = `/api/monitoria-whatsapp/sse?ultimo_evento_id=${ultimoEventoIdRef.current}&token=${encodeURIComponent(token)}`;

    const source = new EventSource(url);
    sourceRef.current = source;

    source.onmessage = (event) => {
      options.onMessage?.(event);

      try {
        const parsed = JSON.parse(event.data);

        if (parsed?.id_evento) {
          ultimoEventoIdRef.current = Number(parsed.id_evento);
          sessionStorage.setItem(STORAGE_KEY, String(parsed.id_evento));
        }

        const tipo = parsed?.tipo;
        const payload = parsed?.payload;
        const conversaId = parsed?.id_conversa;

        if (
          tipo === "MENSAGEM_RECEBIDA" ||
          tipo === "MENSAGEM_ENVIADA" ||
          tipo === "STATUS_ATUALIZADO"
        ) {
          options.onMensagemUpdate?.({
            ...payload,
            conversaId
          });
        }

        if (
          tipo === "ATENDIMENTO_INICIADO" ||
          tipo === "ATENDIMENTO_FINALIZADO"
        ) {
          options.onConversaUpdate?.({
            id: conversaId,
            ...payload
          });
        }

        if (tipo === "DASHBOARD_UPDATE") {
          options.onDashboardUpdate?.(payload);
        }
      } catch (err) {
        console.error("Erro ao processar evento SSE:", err);
      }
    };

    source.onerror = () => {
      source.close();
      sourceRef.current = null;

      if (mountedRef.current) {
        retryRef.current = setTimeout(connect, 3000);
      }
    };
  }, [options]);

  useEffect(() => {
    mountedRef.current = true;

    if (options.enabled === false) {
      sourceRef.current?.close();
      sourceRef.current = null;
      if (retryRef.current) clearTimeout(retryRef.current);
      return () => {
        mountedRef.current = false;
      };
    }

    connect();

    return () => {
      mountedRef.current = false;
      sourceRef.current?.close();
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [connect]);
}
