/**
 * Onde fica registrado que o operador já viu o tour.
 *
 * A fonte da verdade é o banco. Isto começou em `localStorage` e não sobrevivia
 * a nada: o front chama `localStorage.clear()` no logout manual
 * ([AuthButton]), no logout por inatividade ([useIdleLogout]) e no interceptor
 * de 401 ([axiosInstance]) — e o JWT expira em 1 hora. Na prática o operador
 * refazia o tour a cada sessão.
 *
 * O `localStorage` continua aqui, mas só como cache dentro da sessão, para a
 * home não bater no servidor a cada montagem. Ele nunca decide sozinho que o
 * tour deve aparecer — só pode adiantar que ele já foi visto.
 */
import axiosInstance from "@/utils/axiosInstance";

const PREFIXO = "copilot:tour:boas-vindas";

const chave = () => `${PREFIXO}:${localStorage.getItem("userCpf") || "anonimo"}`;

interface RespostaTour {
  disponivel: boolean;
  visto: boolean;
  concluido: boolean;
  deve_exibir: boolean;
}

const lerCache = (): boolean => {
  try {
    return localStorage.getItem(chave()) !== null;
  } catch {
    return false;
  }
};

const gravarCache = (concluido: boolean) => {
  try {
    localStorage.setItem(chave(), concluido ? "concluido" : "pulado");
  } catch {
    /* storage bloqueado não pode derrubar a home */
  }
};

const limparCache = () => {
  try {
    localStorage.removeItem(chave());
  } catch {
    /* idem */
  }
};

/**
 * Decide se o tour deve rodar agora.
 *
 * Quando o servidor responde, ele manda. Quando não responde — backend ainda
 * não reiniciado, rota 404, rede instável — cai para o `localStorage`, que é
 * o comportamento antigo: repete a cada sessão, mas existe.
 *
 * A versão anterior respondia `false` em qualquer falha, e isso transformou um
 * atraso de deploy em "o tour sumiu para todo mundo", sem nenhum sinal. Falhar
 * para o lado de mostrar é o certo aqui: o pior caso é ver o convite de novo,
 * e ele tem um "Agora não".
 */
export const deveExibirTour = async (): Promise<boolean> => {
  if (lerCache()) return false;

  try {
    const { data } = await axiosInstance.get<RespostaTour>(
      "/api/copilot/tour",
      // O tour não pode ser o motivo de alguém ser deslogado: sem isto, um 401
      // nesta chamada dispara o redirect para /login do interceptor.
      { skipAuthRedirect: true } as never,
    );

    if (data.disponivel) {
      if (data.visto) gravarCache(data.concluido);
      return Boolean(data.deve_exibir);
    }

    console.warn(
      "[tour] tabela de conclusão ausente no banco; " +
        "usando localStorage (o tour vai repetir a cada sessão)",
    );
    return true;
  } catch {
    console.warn(
      "[tour] não consegui falar com /api/copilot/tour — o backend foi " +
        "reiniciado depois do deploy? Usando localStorage por enquanto.",
    );
    return true;
  }
};

export const registrarTourConcluido = async (
  concluido: boolean,
): Promise<void> => {
  gravarCache(concluido);
  try {
    await axiosInstance.post("/api/copilot/tour", { concluido });
  } catch {
    // O cache já segura esta sessão. Se a gravação falhou, o tour volta no
    // próximo login — chato, mas não perde nada.
  }
};

/** Usado pelo comando @Tour, que faz o operador rever tudo. */
export const limparTourConcluido = async (): Promise<void> => {
  limparCache();
  try {
    await axiosInstance.post("/api/copilot/tour/reiniciar");
  } catch {
    /* o tour roda nesta sessão de qualquer forma */
  }
};
