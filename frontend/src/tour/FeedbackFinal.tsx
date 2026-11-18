/**
 * Tela de feedback que fecha o tour.
 *
 * Aparece só para quem chega ao fim — quem fechou no meio já disse o que
 * queria. O texto anterior é carregado de volta ao reabrir, porque quem refaz
 * o @Tour cai aqui de novo e reescrever tudo do zero é atrito à toa.
 *
 * Se a tabela ainda não existir no banco, o backend responde
 * `registrado: false` e esta tela diz isso na cara — inventar um "obrigado"
 * sobre um texto que se perdeu seria a pior saída possível.
 */
import { useCallback, useEffect, useState } from "react";
import { Loader2, Send, Star, X } from "lucide-react";

import copilotFeedbackApi from "@/services/copilotFeedbackApi";

const LIMITE = 2000;
const NOTAS = [1, 2, 3, 4, 5];
const ROTULOS: Record<number, string> = {
  1: "Bem ruim",
  2: "Podia melhorar",
  3: "Tá ok",
  4: "Gostei",
  5: "Muito bom!",
};

type Estado = "carregando" | "escrevendo" | "enviando" | "enviado" | "sem-banco";

interface FeedbackFinalProps {
  aberto: boolean;
  aoFechar: () => void;
}

const FeedbackFinal: React.FC<FeedbackFinalProps> = ({ aberto, aoFechar }) => {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [nota, setNota] = useState<number | null>(null);
  const [notaSobrevoo, setNotaSobrevoo] = useState<number | null>(null);
  const [comentario, setComentario] = useState("");
  const [jaRespondeu, setJaRespondeu] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    setEstado("carregando");
    setErro("");
    try {
      const atual = await copilotFeedbackApi.consultar();
      if (!atual.disponivel) {
        setEstado("sem-banco");
        return;
      }
      setJaRespondeu(atual.respondido);
      setNota(atual.nota ?? null);
      setComentario(atual.comentario ?? "");
      setEstado("escrevendo");
    } catch {
      // Falha de rede não pode travar o fim do tour: deixa escrever e tenta
      // de novo no envio.
      setEstado("escrevendo");
    }
  }, []);

  useEffect(() => {
    if (aberto) void carregar();
  }, [aberto, carregar]);

  const enviar = async () => {
    const texto = comentario.trim();
    if (!texto && nota === null) {
      setErro("Escreve alguma coisa ou escolhe uma nota — nem que seja curta.");
      return;
    }

    setEstado("enviando");
    setErro("");
    try {
      const resposta = await copilotFeedbackApi.registrar({
        nota,
        comentario: texto,
      });
      setEstado(resposta.registrado ? "enviado" : "sem-banco");
    } catch {
      setErro("Não consegui enviar agora. Tenta de novo em instantes?");
      setEstado("escrevendo");
    }
  };

  if (!aberto) return null;

  const notaExibida = notaSobrevoo ?? nota;

  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-[#020711]/85 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-cyan-400/25 bg-[#030b16] shadow-[0_28px_90px_rgba(0,0,0,.65)]">
        {/* Cantoneiras: a mesma assinatura das outras superfícies do Copilot. */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, rgba(78,184,255,.68), transparent) left top / 84px 1px no-repeat," +
              "linear-gradient(180deg, rgba(78,184,255,.68), transparent) left top / 1px 84px no-repeat," +
              "linear-gradient(270deg, rgba(255,113,43,.52), transparent) right bottom / 84px 1px no-repeat," +
              "linear-gradient(0deg, rgba(255,113,43,.52), transparent) right bottom / 1px 84px no-repeat",
          }}
        />

        <button
          type="button"
          onClick={aoFechar}
          aria-label="Fechar"
          className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-white/5 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative p-6 md:p-7">
          <div className="flex items-center gap-4">
            <span
              className="h-14 w-14 shrink-0 rounded-full border border-cyan-300/45 bg-[#06152c] shadow-[0_0_22px_rgba(56,189,248,.28)]"
              style={{
                backgroundImage:
                  'url("/images/aurora/aurora-avatar-transparent-300-v1.png")',
                backgroundSize: "145%",
                backgroundPosition: "50% 24%",
                backgroundRepeat: "no-repeat",
              }}
            />
            <div className="min-w-0">
              <p className="font-mono text-[9px] tracking-[0.2em] text-orange-400">
                ÚLTIMA COISA, PROMETO
              </p>
              <h2 className="mt-1 text-lg font-semibold text-white">
                O que você achou?
              </h2>
            </div>
          </div>

          {estado === "carregando" && (
            <div className="grid h-40 place-items-center">
              <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
            </div>
          )}

          {estado === "enviado" && (
            <div className="py-8 text-center">
              <p className="text-base font-semibold text-emerald-300">
                Recebido. Obrigada de verdade!
              </p>
              <p className="mx-auto mt-2 max-w-sm text-sm text-slate-400">
                O Carlos e o Rafael vão ler. Se você lembrar de mais alguma
                coisa depois, é só chamar o <b className="text-orange-300">@Tour</b> de
                novo e escrever aqui.
              </p>
              <button
                type="button"
                onClick={aoFechar}
                className="mt-6 rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-6 py-3 text-xs font-bold tracking-[0.06em] text-cyan-100 transition hover:bg-cyan-400/20"
              >
                FECHAR
              </button>
            </div>
          )}

          {estado === "sem-banco" && (
            <div className="py-8 text-center">
              <p className="text-base font-semibold text-amber-300">
                O canal de feedback ainda não está no ar
              </p>
              <p className="mx-auto mt-2 max-w-sm text-sm text-slate-400">
                Não consegui guardar o seu recado — e prefiro te avisar a fingir
                que salvei. Fala direto com o seu supervisor por enquanto.
              </p>
              <button
                type="button"
                onClick={aoFechar}
                className="mt-6 rounded-xl border border-[#2a4159] px-6 py-3 text-xs font-bold tracking-[0.06em] text-slate-300 transition hover:border-slate-500 hover:text-white"
              >
                ENTENDI
              </button>
            </div>
          )}

          {(estado === "escrevendo" || estado === "enviando") && (
            <>
              <p className="mt-5 text-sm leading-relaxed text-slate-300">
                Os meus desenvolvedores, <b className="text-white">Carlos</b> e{" "}
                <b className="text-white">Rafael</b>, passaram meses nesta
                versão: a identidade visual nova, os comandos, o jeito que eu me
                mexo e converso com você.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                Agora eles estão ansiosos para saber o que{" "}
                <b className="text-white">você</b> achou. O que ficou bom, o que
                atrapalha, o que ainda falta. Pode escrever do seu jeito — eles
                leem tudo, e é isso que decide o que vem na próxima versão.
              </p>

              {jaRespondeu && (
                <p className="mt-4 rounded-lg border border-cyan-400/25 bg-cyan-400/[0.07] px-3 py-2 text-[11px] text-cyan-200">
                  Você já tinha respondido — trouxe o seu texto de volta. Se
                  editar e enviar, ele substitui o anterior.
                </p>
              )}

              <div className="mt-5">
                <span className="font-mono text-[9px] tracking-[0.18em] text-slate-500">
                  DE 1 A 5, COMO FICOU?
                </span>
                <div className="mt-2 flex items-center gap-2">
                  {NOTAS.map((valor) => (
                    <button
                      key={valor}
                      type="button"
                      aria-label={`Nota ${valor}`}
                      onClick={() => setNota(valor === nota ? null : valor)}
                      onMouseEnter={() => setNotaSobrevoo(valor)}
                      onMouseLeave={() => setNotaSobrevoo(null)}
                      className="rounded-lg p-1 transition hover:scale-110"
                    >
                      <Star
                        className={`h-7 w-7 transition ${
                          notaExibida !== null && valor <= notaExibida
                            ? "fill-orange-400 text-orange-400"
                            : "text-slate-600"
                        }`}
                      />
                    </button>
                  ))}
                  {notaExibida !== null && (
                    <span className="ml-1 text-xs text-orange-300">
                      {ROTULOS[notaExibida]}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <textarea
                  value={comentario}
                  maxLength={LIMITE}
                  onChange={(evento) => setComentario(evento.target.value)}
                  rows={5}
                  placeholder="Escreve aqui o que você achou..."
                  className="w-full resize-none rounded-xl border border-[#2b435d] bg-[#06111e] p-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-500/50"
                />
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[10px] text-red-300">{erro}</span>
                  <span className="text-[10px] text-slate-600">
                    {comentario.length}/{LIMITE}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={aoFechar}
                  className="rounded-xl px-4 py-3 text-xs font-semibold text-slate-400 transition hover:text-slate-200"
                >
                  Deixa pra depois
                </button>
                <button
                  type="button"
                  disabled={estado === "enviando"}
                  onClick={() => void enviar()}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-3 text-xs font-bold tracking-[0.06em] text-white transition hover:from-orange-400 hover:to-orange-500 disabled:opacity-50"
                >
                  {estado === "enviando" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  ENVIAR
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeedbackFinal;
