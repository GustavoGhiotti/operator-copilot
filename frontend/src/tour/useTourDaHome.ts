/**
 * Liga o tour a uma tela inicial.
 *
 * Existem duas: `Index` (/home) e `IndexAdmin` (/admin). E é fácil esquecer da
 * segunda — foi o que aconteceu: como `is_admin` inclui "supervisor(a) de
 * operacoes", todo supervisor cai em /admin, onde o tour simplesmente não
 * estava montado. Nenhum deles via nada, e não havia erro para investigar.
 *
 * Concentrar o wiring aqui é o que impede a próxima tela inicial de nascer
 * sem tour de novo.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MutableRefObject,
} from "react";

import type { ControleBusca } from "@/components/SearchBar";

import {
  deveExibirTour,
  limparTourConcluido,
  registrarTourConcluido,
} from "./persistencia";
import { useTourCopilot } from "./useTourCopilot";

export interface OpcoesTourDaHome {
  /** Controle da barra de comandos desta tela. */
  controleBusca: MutableRefObject<ControleBusca | null>;
  /**
   * Fecha os modais que o tour abre aqui. Cada tela conhece os seus, então a
   * lista mora na tela — mas precisa ser estável (useCallback).
   */
  fecharModais: () => void;
  /** Abre o bingo de treino. Ausente em telas que não têm @Arena. */
  aoAbrirTreinoBingo?: () => void;
}

export const useTourDaHome = ({
  controleBusca,
  fecharModais,
}: OpcoesTourDaHome) => {
  const [tourAtivo, setTourAtivo] = useState(false);
  const [treinoBingoAberto, setTreinoBingoAberto] = useState(false);
  const [feedbackAberto, setFeedbackAberto] = useState(false);

  useEffect(() => {
    // `ativo` evita ligar o tour se a tela desmontar antes da resposta —
    // a pessoa digitaria um comando e veria o tour abrir por cima.
    let ativo = true;
    void deveExibirTour().then((exibir) => {
      if (ativo && exibir) setTourAtivo(true);
    });
    return () => {
      ativo = false;
    };
  }, []);

  const acoes = useMemo(
    () => ({
      abrirPainelComandos: () => controleBusca.current?.abrirPainel(),
      voltarAoPainel: () => {
        fecharModais();
        setTreinoBingoAberto(false);
        controleBusca.current?.abrirPainel();
      },
      fecharTudo: () => {
        fecharModais();
        setTreinoBingoAberto(false);
        controleBusca.current?.fecharPainel();
      },
      abrirTreinoBingo: () => setTreinoBingoAberto(true),
      fecharTreinoBingo: () => setTreinoBingoAberto(false),
    }),
    [controleBusca, fecharModais],
  );

  const encerrarTour = useCallback(
    (concluido: boolean) => {
      // Destranca antes de sair: se o tour cair no meio de um passo que abriu
      // o painel, ele ficaria preso na tela sem responder a clique fora.
      controleBusca.current?.fecharPainel();
      void registrarTourConcluido(concluido);
      setTourAtivo(false);
      // Só pede feedback de quem foi até o fim. Quem fechou no meio já disse
      // o que achava — insistir ali vira cobrança.
      if (concluido) setFeedbackAberto(true);
    },
    [controleBusca],
  );

  useTourCopilot({ ativo: tourAtivo, acoes, aoEncerrar: encerrarTour });

  const iniciarTour = useCallback(() => {
    // Não espera a rede: a pessoa pediu para rever agora, e a limpeza no banco
    // só importa para o próximo login.
    void limparTourConcluido();
    setTourAtivo(true);
  }, []);

  return {
    /** Handler do comando @Tour. */
    iniciarTour,
    treinoBingoAberto,
    fecharTreinoBingo: useCallback(() => setTreinoBingoAberto(false), []),
    feedbackAberto,
    fecharFeedback: useCallback(() => setFeedbackAberto(false), []),
  };
};
