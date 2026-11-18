/**
 * Bingo de treino — uma partida de mentira, só para ensinar a mecânica.
 *
 * Não fala com o `arenaApi` de propósito. O jogo real é acoplado a uma sessão
 * viva (estado por polling, marcação e vitória no servidor), e simular aquilo
 * com mocks deixaria o treino frágil e ainda arriscaria disparar efeito numa
 * campanha de verdade. Aqui tudo acontece na memória do componente: nada é
 * gravado, nada pontua, nada aparece para o supervisor.
 *
 * O sorteio é roteirizado — só saem números que estão na linha do meio da
 * cartela — porque o objetivo é o operador entender o ciclo
 * "sorteou → marquei → cantei bingo" em menos de um minuto, não jogar.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, X } from "lucide-react";

const COLUNAS = ["B", "I", "N", "G", "O"] as const;
const NUMEROS_POR_COLUNA = 15;
const LINHA_DO_MEIO = 2;
const CENTRO = 2;
/** Respiro entre marcar um número e o próximo ser sorteado. */
const INTERVALO_SORTEIO = 900;

interface Celula {
  coluna: string;
  /** `null` no espaço livre do centro. */
  numero: number | null;
  sorteada: boolean;
  marcada: boolean;
}

type Fase = "intro" | "jogando" | "pronto" | "vitoria";

const embaralhar = <T,>(itens: T[]): T[] => {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
};

/** Cartela padrão: cada coluna sorteia 5 números da sua faixa, centro livre. */
const montarCartela = (): Celula[] => {
  const porColuna = COLUNAS.map((_, indice) => {
    const base = indice * NUMEROS_POR_COLUNA + 1;
    const faixa = Array.from(
      { length: NUMEROS_POR_COLUNA },
      (_, posicao) => base + posicao,
    );
    return embaralhar(faixa).slice(0, 5);
  });

  const celulas: Celula[] = [];
  for (let linha = 0; linha < 5; linha += 1) {
    for (let coluna = 0; coluna < 5; coluna += 1) {
      const livre = linha === LINHA_DO_MEIO && coluna === CENTRO;
      celulas.push({
        coluna: COLUNAS[coluna],
        numero: livre ? null : porColuna[coluna][linha],
        sorteada: livre,
        marcada: livre,
      });
    }
  }
  return celulas;
};

/** Índices da linha do meio, sem o centro — é a linha que o treino completa. */
const indicesDaLinha = () =>
  [0, 1, 2, 3, 4]
    .filter((coluna) => coluna !== CENTRO)
    .map((coluna) => LINHA_DO_MEIO * 5 + coluna);

interface TreinoBingoProps {
  aberto: boolean;
  aoFechar: () => void;
}

const TreinoBingo: React.FC<TreinoBingoProps> = ({ aberto, aoFechar }) => {
  const [cartela, setCartela] = useState<Celula[]>(montarCartela);
  const [fila, setFila] = useState<number[]>([]);
  const [atual, setAtual] = useState<Celula | null>(null);
  const [fase, setFase] = useState<Fase>("intro");
  const [aviso, setAviso] = useState("");
  const temporizador = useRef(0);

  // Cada abertura é uma partida nova: cartela nova, fila nova, do zero.
  useEffect(() => {
    if (!aberto) return;
    setCartela(montarCartela());
    setFila(embaralhar(indicesDaLinha()));
    setAtual(null);
    setFase("intro");
    setAviso("");
  }, [aberto]);

  useEffect(
    () => () => {
      window.clearTimeout(temporizador.current);
    },
    [],
  );

  const sortear = useCallback((restantes: number[], base: Celula[]) => {
    const [proximo, ...resto] = restantes;
    if (proximo === undefined) {
      setAtual(null);
      setFase("pronto");
      return;
    }
    setCartela(
      base.map((celula, indice) =>
        indice === proximo ? { ...celula, sorteada: true } : celula,
      ),
    );
    setAtual(base[proximo]);
    setFila(resto);
  }, []);

  const comecar = () => {
    setFase("jogando");
    sortear(fila, cartela);
  };

  const marcar = (indice: number) => {
    const celula = cartela[indice];
    if (fase !== "jogando" || celula.marcada) return;

    if (!celula.sorteada) {
      setAviso("Esse ainda não saiu. Marque o número que está no sorteio.");
      return;
    }

    setAviso("");
    const atualizada = cartela.map((item, posicao) =>
      posicao === indice ? { ...item, marcada: true } : item,
    );
    setCartela(atualizada);
    setAtual(null);

    temporizador.current = window.setTimeout(
      () => sortear(fila, atualizada),
      INTERVALO_SORTEIO,
    );
  };

  if (!aberto) return null;

  const faltam = indicesDaLinha().filter(
    (indice) => !cartela[indice].marcada,
  ).length;

  return (
    <div
      data-tour="treino-bingo"
      className="fixed left-1/2 top-1/2 z-[90] w-[22rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-cyan-400/25 bg-[#030b16] shadow-[0_25px_80px_rgba(0,0,0,.6)]"
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(34,211,238,.7)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,.7)_1px,transparent_1px)] [background-size:28px_28px]" />

      <header className="relative flex items-center gap-3 border-b border-[#1d3248] px-4 py-3">
        <div>
          <p className="font-mono text-[8px] tracking-[0.18em] text-orange-400">
            MODO TREINO · NÃO VALE PONTO
          </p>
          <h3 className="mt-0.5 text-sm font-semibold text-white">
            Bingo da Arena
          </h3>
        </div>
        <button
          type="button"
          onClick={aoFechar}
          aria-label="Fechar treino"
          className="ml-auto grid h-8 w-8 place-items-center rounded-lg border border-[#2a4159] text-slate-400 transition hover:border-orange-500/50 hover:text-orange-300"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="relative px-4 py-3">
        {/* Visor do sorteio */}
        <div className="flex h-16 items-center justify-center rounded-xl border border-[#243d57] bg-[#06111e]">
          {fase === "intro" && (
            <span className="text-[11px] text-slate-400">
              O supervisor é quem sorteia. Aqui, sorteio eu.
            </span>
          )}
          {fase === "jogando" && atual && (
            <span className="flex items-baseline gap-2 text-cyan-200">
              <span className="font-mono text-xs tracking-[0.2em] text-cyan-400">
                {atual.coluna}
              </span>
              <strong className="text-3xl font-black text-white">
                {atual.numero}
              </strong>
            </span>
          )}
          {fase === "jogando" && !atual && (
            <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
          )}
          {fase === "pronto" && (
            <span className="text-[11px] font-semibold text-orange-300">
              Linha completa! Agora cante o bingo.
            </span>
          )}
          {fase === "vitoria" && (
            <span className="text-[11px] font-semibold text-emerald-300">
              É assim que se ganha. Simples, né?
            </span>
          )}
        </div>

        {/* Cartela */}
        <div className="mt-3 grid grid-cols-5 gap-1">
          {COLUNAS.map((letra) => (
            <span
              key={letra}
              className="pb-1 text-center font-mono text-[10px] tracking-[0.16em] text-cyan-400"
            >
              {letra}
            </span>
          ))}
          {cartela.map((celula, indice) => {
            const livre = celula.numero === null;
            const aguardando = celula.sorteada && !celula.marcada;
            return (
              <button
                key={indice}
                type="button"
                disabled={fase !== "jogando" || celula.marcada}
                onClick={() => marcar(indice)}
                className={`grid h-10 place-items-center rounded-md border text-xs font-semibold transition ${
                  celula.marcada
                    ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-100"
                    : aguardando
                      ? "animate-pulse border-orange-400/70 bg-orange-500/15 text-orange-200"
                      : "border-[#22384f] bg-[#06111e] text-slate-400"
                } ${fase === "jogando" && !celula.marcada ? "cursor-pointer hover:border-cyan-400/40" : ""}`}
              >
                {livre ? "★" : celula.numero}
              </button>
            );
          })}
        </div>

        {aviso && (
          <p className="mt-2 text-center text-[10px] text-orange-300">{aviso}</p>
        )}

        {fase === "jogando" && !aviso && (
          <p className="mt-2 text-center text-[10px] text-slate-500">
            {faltam === 1
              ? "Falta 1 número para fechar a linha."
              : `Faltam ${faltam} números para fechar a linha.`}
          </p>
        )}

        {/* Ação principal muda conforme a fase */}
        {fase === "intro" && (
          <button
            type="button"
            onClick={comecar}
            className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-xs font-bold tracking-[0.06em] text-white transition hover:from-orange-400 hover:to-orange-500"
          >
            COMEÇAR O SORTEIO
          </button>
        )}

        {(fase === "jogando" || fase === "pronto") && (
          <button
            type="button"
            disabled={fase !== "pronto"}
            onClick={() => setFase("vitoria")}
            className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-lg font-black text-white shadow-[0_0_26px_rgba(249,115,22,.3)] transition hover:from-orange-400 hover:to-orange-500 disabled:opacity-30 disabled:shadow-none"
          >
            <Sparkles className="h-5 w-5" /> BINGO!
          </button>
        )}

        {fase === "vitoria" && (
          <button
            type="button"
            onClick={aoFechar}
            className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl border border-cyan-400/40 bg-cyan-400/10 text-xs font-bold tracking-[0.06em] text-cyan-100 transition hover:bg-cyan-400/20"
          >
            ENTENDI, PODE SEGUIR
          </button>
        )}
      </div>
    </div>
  );
};

export default TreinoBingo;
