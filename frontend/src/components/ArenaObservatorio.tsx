/**
 * Observatório da Arena — visão ao vivo de todas as partidas.
 *
 * Existe porque as consultas da Arena são escopadas por `CPF_CRIADOR`: cada
 * supervisor só enxerga o que ele mesmo criou, e ninguém via o conjunto. Aqui
 * o Desenvolvimento acompanha qualquer jogo e, se precisar, assume o comando.
 *
 * Assumir troca o dono da campanha de verdade — não é um modo especial de
 * controle. Por isso a confirmação é explícita: o supervisor original perde o
 * comando na hora.
 */
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Dices,
  Gamepad2,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Users,
  X,
} from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import {
  arenaApi,
  ArenaCartelaObservada,
  ArenaLiveBingoState,
  ArenaSessaoAoVivo,
} from "@/services/arenaApi";

const COLUNAS = ["B", "I", "N", "G", "O"] as const;
/** A lista se atualiza sozinha: o ponto do observatório é ser ao vivo. */
const INTERVALO_LISTA = 10000;
const INTERVALO_PARTIDA = 3000;

const erroDe = (erro: unknown) => {
  const candidato = erro as { response?: { data?: { erro?: string } } };
  return candidato.response?.data?.erro || "Não foi possível concluir a ação.";
};

interface ArenaObservatorioProps {
  onClose: () => void;
}

export default function ArenaObservatorio({ onClose }: ArenaObservatorioProps) {
  const { toast } = useToast();
  const [sessoes, setSessoes] = useState<ArenaSessaoAoVivo[]>([]);
  const [podeAssumir, setPodeAssumir] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [aberta, setAberta] = useState<ArenaSessaoAoVivo | null>(null);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    try {
      const dados = await arenaApi.getObservatorio();
      setSessoes(dados.sessoes);
      setPodeAssumir(dados.pode_assumir);
    } catch (erro) {
      if (!silencioso) {
        toast({
          title: "Observatório indisponível",
          description: erroDe(erro),
          variant: "destructive",
        });
      }
    } finally {
      if (!silencioso) setCarregando(false);
    }
  }, [toast]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (aberta) return;
    const timer = window.setInterval(
      () => void carregar(true),
      INTERVALO_LISTA,
    );
    return () => window.clearInterval(timer);
  }, [aberta, carregar]);

  if (aberta) {
    return (
      <PartidaObservada
        sessao={aberta}
        podeAssumir={podeAssumir}
        onVoltar={() => {
          setAberta(null);
          void carregar(true);
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#020711]/98 p-3 text-slate-100 backdrop-blur-md">
      <div className="mx-auto flex min-h-full max-w-6xl flex-col">
        <header className="flex items-center gap-3 border-b border-[#20364c] py-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl border border-violet-400/50 bg-violet-400/10 text-violet-300">
            <Gamepad2 className="h-5 w-5" />
          </div>
          <div>
            <p className="font-mono text-[9px] tracking-[0.16em] text-cyan-300">
              OBSERVATÓRIO DA ARENA
            </p>
            <h1 className="mt-1 text-base font-semibold text-white">
              O que está acontecendo agora
            </h1>
          </div>
          <button
            type="button"
            onClick={() => void carregar()}
            aria-label="Atualizar"
            className="ml-auto grid h-10 w-10 place-items-center rounded-xl border border-[#2b435d] text-slate-400 hover:border-cyan-400/50 hover:text-cyan-300"
          >
            <RefreshCw className={`h-4 w-4 ${carregando ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-xl border border-[#2b435d] text-slate-400 hover:border-orange-400/50 hover:text-orange-300"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <main className="flex-1 py-6">
          {carregando && (
            <div className="grid min-h-60 place-items-center">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
            </div>
          )}

          {!carregando && sessoes.length === 0 && (
            <div className="grid min-h-60 place-items-center text-center">
              <div>
                <Gamepad2 className="mx-auto h-10 w-10 text-slate-600" />
                <p className="mt-4 text-sm text-slate-400">
                  Nenhuma partida acontecendo agora.
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  A lista se atualiza sozinha a cada 10 segundos.
                </p>
              </div>
            </div>
          )}

          <div className="grid gap-3 lg:grid-cols-2">
            {sessoes.map((sessao) => {
              const emJogo = sessao.status === "EM_ANDAMENTO";
              return (
                <button
                  key={sessao.id}
                  type="button"
                  onClick={() => setAberta(sessao)}
                  className={`rounded-2xl border p-5 text-left transition hover:-translate-y-0.5 ${
                    emJogo
                      ? "border-orange-400/50 bg-orange-400/[0.07] hover:border-orange-300"
                      : "border-[#263e58] bg-[#071421] hover:border-cyan-400/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        emJogo
                          ? "bg-orange-400 shadow-[0_0_10px_#fb923c]"
                          : "bg-cyan-400"
                      }`}
                    />
                    <span className="font-mono text-[9px] tracking-[0.16em] text-slate-400">
                      {emJogo ? "EM ANDAMENTO" : "SALA ABERTA"}
                    </span>
                    <span className="ml-auto font-mono text-[9px] text-cyan-300">
                      {sessao.tipo_jogo_nome}
                    </span>
                  </div>
                  <h2 className="mt-3 truncate text-base font-semibold text-white">
                    {sessao.titulo}
                  </h2>
                  <p className="mt-1 truncate text-[11px] text-slate-500">
                    {sessao.nome_supervisor}
                    {sessao.centro_custo ? ` · ${sessao.centro_custo}` : ""}
                  </p>
                  <div className="mt-4 flex gap-5 border-t border-[#20364c] pt-3 text-[10px] text-slate-400">
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" /> {sessao.na_sala} na sala
                    </span>
                    <span>{sessao.convidados} convidados</span>
                    {sessao.tipo_jogo === "BINGO" && (
                      <span className="ml-auto inline-flex items-center gap-1.5 text-orange-300">
                        <Dices className="h-3.5 w-3.5" />
                        {sessao.total_sorteios} sorteios
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}

/** Uma partida por dentro: sorteios, operadores e as cartelas de todos. */
function PartidaObservada({
  sessao,
  podeAssumir,
  onVoltar,
}: {
  sessao: ArenaSessaoAoVivo;
  podeAssumir: boolean;
  onVoltar: () => void;
}) {
  const { toast } = useToast();
  const [estado, setEstado] = useState<ArenaLiveBingoState | null>(null);
  const [cartelas, setCartelas] = useState<ArenaCartelaObservada[]>([]);
  const [assumindo, setAssumindo] = useState(false);

  const ehBingo = sessao.tipo_jogo === "BINGO";

  const carregar = useCallback(async () => {
    if (!ehBingo) return;
    // Independentes de propósito: com `Promise.all`, uma leitura que falha
    // descarta a outra que respondeu — foi assim que um 404 no estado deixou
    // a tela com "0 cartelas" mesmo tendo recebido as 25.
    const [live, todas] = await Promise.allSettled([
      arenaApi.getLiveBingo(sessao.id),
      arenaApi.getObservatorioCartelas(sessao.id),
    ]);
    if (live.status === "fulfilled") setEstado(live.value);
    if (todas.status === "fulfilled") setCartelas(todas.value.cartelas);
  }, [ehBingo, sessao.id]);

  useEffect(() => {
    void carregar();
    const timer = window.setInterval(() => void carregar(), INTERVALO_PARTIDA);
    return () => window.clearInterval(timer);
  }, [carregar]);

  const assumir = async () => {
    if (
      !window.confirm(
        `Assumir o controle desta partida?\n\n${sessao.nome_supervisor} perde ` +
          "o comando imediatamente e passa a ser você quem sorteia.",
      )
    ) {
      return;
    }
    setAssumindo(true);
    try {
      const resultado = await arenaApi.assumirControle(sessao.id);
      toast({
        title: "Controle assumido",
        description: `A partida saiu de ${resultado.supervisor_anterior} para você.`,
      });
      onVoltar();
    } catch (erro) {
      toast({
        title: "Não foi possível assumir",
        description: erroDe(erro),
        variant: "destructive",
      });
    } finally {
      setAssumindo(false);
    }
  };

  const ultimo = estado?.sorteios?.[0];

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#020711]/98 p-3 text-slate-100 backdrop-blur-md">
      <div className="mx-auto flex min-h-full max-w-[1500px] flex-col">
        <header className="flex items-center gap-3 border-b border-[#20364c] py-4">
          <button
            type="button"
            onClick={onVoltar}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#2b435d] px-4 text-xs text-slate-300 hover:border-cyan-400/50 hover:text-cyan-300"
          >
            <ArrowLeft className="h-4 w-4" /> VOLTAR
          </button>
          <div className="min-w-0">
            <p className="font-mono text-[9px] tracking-[0.16em] text-cyan-300">
              ACOMPANHANDO · {sessao.nome_supervisor}
            </p>
            <h1 className="mt-1 truncate text-base font-semibold text-white">
              {sessao.titulo}
            </h1>
          </div>
          {podeAssumir && (
            <button
              type="button"
              disabled={assumindo}
              onClick={() => void assumir()}
              className="ml-auto inline-flex h-10 items-center gap-2 rounded-xl border border-orange-400/50 bg-orange-400/10 px-4 text-[10px] font-bold text-orange-200 hover:bg-orange-400/20 disabled:opacity-50"
            >
              {assumindo ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldAlert className="h-4 w-4" />
              )}
              ASSUMIR CONTROLE
            </button>
          )}
        </header>

        {!ehBingo ? (
          <div className="grid flex-1 place-items-center text-center">
            <p className="text-sm text-slate-400">
              O acompanhamento detalhado está disponível para o Bingo.
            </p>
          </div>
        ) : (
          <main className="grid flex-1 gap-5 py-5 xl:grid-cols-[340px_1fr]">
            <aside className="space-y-4">
              <section className="rounded-2xl border border-orange-400/30 bg-[#071421] p-6 text-center">
                <p className="font-mono text-[9px] tracking-[0.16em] text-slate-400">
                  ÚLTIMO SORTEIO
                </p>
                {ultimo ? (
                  <strong className="mt-3 block text-6xl text-orange-300">
                    <small className="text-2xl">{ultimo.letra}</small>
                    {ultimo.numero}
                  </strong>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">
                    Ainda não começou
                  </p>
                )}
                <p className="mt-3 text-[10px] text-slate-500">
                  {estado?.total_sorteios ?? 0} de 75 sorteados
                </p>
              </section>

              <section className="rounded-2xl border border-[#263e58] bg-[#071421] p-5">
                <div className="flex items-center gap-2 text-cyan-300">
                  <Users className="h-4 w-4" />
                  <p className="font-mono text-[9px] tracking-[0.16em]">
                    OPERADORES
                  </p>
                </div>
                <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto">
                  {(estado?.progresso || []).map((jogador) => (
                    <div
                      key={jogador.id_participante}
                      className={`rounded-xl border p-3 ${
                        jogador.quase_bingo
                          ? "border-orange-300/60 bg-orange-400/10"
                          : "border-[#29455f] bg-[#081726]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs text-white">
                          {jogador.nome}
                        </span>
                        <strong
                          className={
                            jogador.quase_bingo
                              ? "text-orange-300"
                              : "text-cyan-300"
                          }
                        >
                          {jogador.faltam_para_vencer === 1
                            ? "FALTA 1"
                            : `FALTAM ${jogador.faltam_para_vencer}`}
                        </strong>
                      </div>
                      {jogador.numeros_necessarios.length > 0 && (
                        <p className="mt-1.5 text-[10px] text-slate-500">
                          Esperando: {jogador.numeros_necessarios.join(", ")}
                        </p>
                      )}
                    </div>
                  ))}
                  {!estado?.progresso?.length && (
                    <p className="py-6 text-center text-xs text-slate-600">
                      Sem dados de progresso ainda.
                    </p>
                  )}
                </div>
              </section>
            </aside>

            <section className="rounded-2xl border border-[#263e58] bg-[#06111e] p-5">
              <div className="flex items-center gap-2 border-b border-[#20364c] pb-3">
                <Gamepad2 className="h-4 w-4 text-violet-300" />
                <h2 className="text-sm font-semibold text-white">
                  Cartelas em jogo
                </h2>
                <span className="ml-auto text-[10px] text-slate-500">
                  {cartelas.length} CARTELAS
                </span>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                {cartelas.map((cartela) => (
                  <article
                    key={cartela.id_cartela}
                    className="rounded-xl border border-[#263e58] bg-[#071421] p-3"
                  >
                    <p className="truncate text-xs font-semibold text-white">
                      {cartela.nome}
                    </p>
                    <div className="mt-2 grid grid-cols-5 gap-1 text-center">
                      {COLUNAS.map((letra) => (
                        <span
                          key={letra}
                          className="font-mono text-[9px] text-cyan-400"
                        >
                          {letra}
                        </span>
                      ))}
                      {cartela.casas.map((casa, indice) => (
                        <span
                          key={`${cartela.id_cartela}-${indice}`}
                          className={`grid aspect-square place-items-center rounded text-[10px] font-bold ${
                            casa.livre
                              ? "border border-[#31506d] bg-[#0a1a2b] text-slate-500"
                              : casa.marcada
                                ? "bg-orange-500/80 text-white"
                                : "border border-[#22384f] bg-[#06111e] text-slate-400"
                          }`}
                        >
                          {casa.livre ? "★" : casa.numero}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </main>
        )}
      </div>
    </div>
  );
}
