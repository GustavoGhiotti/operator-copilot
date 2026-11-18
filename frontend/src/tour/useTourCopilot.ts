/**
 * Motor do tour. Lê o roteiro, monta os passos do Shepherd e cuida das três
 * coisas que quebram um tour guiado neste app:
 *
 * 1. os alvos montam e desmontam (os comandos abrem modais condicionais);
 * 2. entre o clique e o modal existe a animação de anúncio da Aurora;
 * 3. os comandos são filtrados por permissão — apontar para um card que aquele
 *    operador não enxerga seria pior que não ter tour.
 */
import { useEffect, useRef } from "react";
import Shepherd from "shepherd.js";
import type { StepOptionsButton, Tour } from "shepherd.js";

// A base vem primeiro: ela define layout, seta e o par opacity/visibility que
// faz o balão aparecer — sem ela o tour monta invisível. O tema só repinta.
import "shepherd.js/dist/css/shepherd.css";
import "./tour.css";

import { ROTEIRO, type AcaoTour, type PassoTour } from "./roteiro";

/** Teto de espera por um alvo que ainda não montou. */
const TIMEOUT_ALVO = 8000;

export interface OpcoesTour {
  /** O tour roda enquanto isto for verdadeiro. */
  ativo: boolean;
  /** Efeitos colaterais que os passos pedem. */
  acoes: Record<AcaoTour, () => void>;
  /** `true` = chegou ao fim; `false` = fechou no meio. */
  aoEncerrar: (concluido: boolean) => void;
}

/**
 * Resolve quando o elemento aparecer — ou quando o tempo estourar.
 *
 * Resolve mesmo no timeout, nunca rejeita: se um seletor mudar de nome num
 * refactor, o passo vira um balão centralizado com o texto certo, em vez de
 * travar o tour na cara do operador.
 */
const esperarElemento = (
  seletor: string,
  presente = true,
): Promise<void> =>
  new Promise((resolve) => {
    const satisfeito = () => Boolean(document.querySelector(seletor)) === presente;

    if (satisfeito()) {
      resolve();
      return;
    }

    let observador: MutationObserver | null = null;
    let expiracao = 0;

    const encerrar = () => {
      observador?.disconnect();
      window.clearTimeout(expiracao);
      resolve();
    };

    observador = new MutationObserver(() => {
      if (satisfeito()) encerrar();
    });
    observador.observe(document.body, { childList: true, subtree: true });

    expiracao = window.setTimeout(() => {
      console.warn(
        `[tour] "${seletor}" não ${presente ? "apareceu" : "sumiu"} em ` +
          `${TIMEOUT_ALVO}ms; o passo segue assim mesmo`,
      );
      encerrar();
    }, TIMEOUT_ALVO);
  });

const botao = (
  rotulo: string,
  acao: (this: Tour) => void,
  principal = true,
): StepOptionsButton => ({
  text: rotulo,
  classes: principal
    ? "tour-copilot__botao tour-copilot__botao--principal"
    : "tour-copilot__botao tour-copilot__botao--secundario",
  action: acao,
});

/**
 * Navegação só para a frente, e é decisão, não esquecimento: voltar de dentro
 * do @Tarefas para o painel exigiria desfazer efeito colateral (fechar modal,
 * reabrir painel) e é justamente onde esse tipo de tour costuma quebrar. Sair
 * a qualquer momento continua disponível pelo X.
 */
const montarBotoes = (
  passo: PassoTour,
  ultimo: boolean,
  pularGrupo: (grupo: string) => void,
) => {
  // O passo de clique nao tem "Avancar" — quem avanca e o clique no alvo. Mas
  // precisa de saida: se o alvo sumir, sem isto o operador fica preso.
  if (passo.avancarAoClicar) {
    if (!passo.grupo) return [];
    const grupo = passo.grupo;
    return [
      botao(
        "Pular esta parte",
        function () {
          pularGrupo(grupo);
          this.next();
        },
        false,
      ),
    ];
  }
  if (passo.convite) {
    return [
      botao(
        "Agora não",
        function () {
          this.cancel();
        },
        false,
      ),
      botao("Vamos lá", function () {
        this.next();
      }),
    ];
  }
  if (ultimo) {
    return [
      botao("Concluir", function () {
        this.complete();
      }),
    ];
  }
  return [
    botao("Avançar", function () {
      this.next();
    }),
  ];
};

export const useTourCopilot = ({
  ativo,
  acoes,
  aoEncerrar,
}: OpcoesTour): void => {
  // Refs para que uma nova identidade de callback a cada render não reinicie
  // o tour do zero no meio da execução.
  const acoesRef = useRef(acoes);
  const encerrarRef = useRef(aoEncerrar);
  acoesRef.current = acoes;
  encerrarRef.current = aoEncerrar;

  useEffect(() => {
    if (!ativo) return;

    const tour = new Shepherd.Tour({
      tourName: "copilot-boas-vindas",
      useModalOverlay: true,
      exitOnEsc: true,
      keyboardNavigation: false,
      defaultStepOptions: {
        classes: "tour-copilot",
        cancelIcon: { enabled: true, label: "Fechar o tour" },
        modalOverlayOpeningPadding: 8,
        scrollTo: { behavior: "smooth", block: "center" },
      },
    });

    /**
     * Grupos derrubados em tempo de execução. O Shepherd avalia `showOn` logo
     * antes de exibir cada passo — e como o portão de um grupo só é avaliado
     * com o painel já aberto, dá para perguntar ao DOM se aquele comando
     * existe para este operador em vez de recalcular permissão aqui.
     */
    const gruposIgnorados = new Set<string>();
    const pularGrupo = (grupo: string) => gruposIgnorados.add(grupo);

    /**
     * Grupos são hierárquicos por ponto: derrubar "arena" derruba junto
     * "arena.operador" e "arena.supervisor". Sem isso, um operador sem acesso
     * ao @Arena escaparia do portão e cairia nos passos de dentro do modal.
     */
    const grupoIgnorado = (grupo?: string) => {
      if (!grupo) return false;
      for (const ignorado of gruposIgnorados) {
        if (grupo === ignorado || grupo.startsWith(`${ignorado}.`)) return true;
      }
      return false;
    };

    ROTEIRO.forEach((passo, indice) => {
      const ultimo = indice === ROTEIRO.length - 1;

      tour.addStep({
        id: passo.id,
        // O cabeçalho vai montado à mão porque `.shepherd-title` é `display:
        // flex` no CSS base — um `::before` ali vira item de flex e senta ao
        // lado do título, não acima dele.
        title:
          '<span class="tour-copilot__etapa"></span>' +
          `<span class="tour-copilot__titulo">${passo.titulo}</span>`,
        text: passo.texto,
        attachTo: passo.alvo
          ? { element: passo.alvo, on: passo.posicao ?? "bottom" }
          : undefined,
        // Por padrão o alvo fica só ilustrativo — um clique perdido no meio de
        // uma explicação não deve disparar ação. Abre-se a exceção para os
        // passos que pedem o clique e para os que convidam a experimentar.
        canClickTarget: Boolean(
          passo.avancarAoClicar || passo.permitirInteracao,
        ),
        advanceOn:
          passo.avancarAoClicar && passo.alvo
            ? { selector: passo.alvo, event: "click" }
            : undefined,
        showOn: () => {
          if (grupoIgnorado(passo.grupo)) return false;
          const sonda = passo.alvoDoPortao || passo.alvo;
          if (!passo.portaoDoGrupo || !sonda || !passo.grupo) return true;

          const existe = Boolean(document.querySelector(sonda));
          const aprovado = passo.portaoNegativo ? !existe : existe;
          if (!aprovado) gruposIgnorados.add(passo.grupo);
          return aprovado;
        },
        beforeShowPromise: async () => {
          if (passo.aoEntrar) acoesRef.current[passo.aoEntrar]?.();
          // Primeiro o que precisa sair de cena, depois o que precisa entrar.
          if (passo.aguardarSaida) {
            await esperarElemento(passo.aguardarSaida, false);
          }
          if (passo.aguardarEntrada) {
            await esperarElemento(passo.aguardarEntrada);
          }
          if (passo.aguardarAlvo && passo.alvo) {
            await esperarElemento(passo.alvo);
          }
        },
        buttons: montarBotoes(passo, ultimo, pularGrupo),
        when: {
          show() {
            const elemento = this.el;
            if (!elemento) return;

            // Conta só o que este operador vai mesmo ver: um grupo derrubado
            // não pode inflar o "de quantos" e fazer a aula parecer maior do
            // que é.
            const ativos = ROTEIRO.filter((item) => !grupoIgnorado(item.grupo));
            const total = ativos.length;
            const posicao = ativos.findIndex((item) => item.id === passo.id) + 1;

            elemento.style.setProperty(
              "--tour-progresso",
              String(total ? posicao / total : 0),
            );

            // Formato do sistema: rótulo curto, monoespaçado, com zero à
            // esquerda — o mesmo tom de "SYSTEM / COMMAND DIRECTORY" da
            // paleta de comandos.
            const etapa = elemento.querySelector(".tour-copilot__etapa");
            if (etapa) {
              const numero = String(posicao).padStart(2, "0");
              etapa.textContent = `PASSO ${numero} DE ${total}`;
            }
          },
        },
        classes: passo.avancarAoClicar
          ? "tour-copilot tour-copilot--aguarda-clique"
          : "tour-copilot",
      });
    });

    // Desmontar a home não é o operador desistindo: sem esta trava o cleanup
    // marcaria o tour como visto por conta própria.
    let desmontando = false;
    tour.on("complete", () => {
      if (!desmontando) encerrarRef.current(true);
    });
    tour.on("cancel", () => {
      if (!desmontando) encerrarRef.current(false);
    });

    void tour.start();

    return () => {
      desmontando = true;
      if (Shepherd.activeTour === tour) tour.complete();
    };
  }, [ativo]);
};
