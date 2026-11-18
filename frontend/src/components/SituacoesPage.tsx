import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import EstadoFluxoAuxiliar from "@/components/EstadoFluxoAuxiliar";
import { useFluxoAuxiliar } from "@/hooks/useFluxoAuxiliar";
import { renderRichText } from "@/utils/richText";

export default function SituacoesPage() {
  const { mensagens, estado, recarregar } =
    useFluxoAuxiliar("outras_situacoes");
  const [mensagemAberta, setMensagemAberta] = useState<string | null>(null);

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold">
        Outras Situações — Consulta de Mensagens
      </h2>

      <EstadoFluxoAuxiliar
        estado={estado}
        nome="Outras Situações"
        onTentarNovamente={recarregar}
      />

      {mensagens.map((m) => {
        const aberta = mensagemAberta === m.id_mensagem;

        return (
          <Card
            key={m.id_mensagem}
            className="overflow-hidden border border-gray-300 bg-white p-0 dark:border-gray-700 dark:bg-gray-900"
          >
            {/* `button` em vez de `onClick` no Card: dá teclado e leitor de
                tela de graça, e o `aria-expanded` conta o estado. */}
            <button
              type="button"
              aria-expanded={aberta}
              onClick={() =>
                setMensagemAberta((prev) =>
                  prev === m.id_mensagem ? null : m.id_mensagem
                )
              }
              className="flex w-full items-start justify-between gap-3 p-4 text-left transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
            >
              <h3 className="text-md min-w-0 flex-1 font-bold">
                {/* `renderRichText` tira a cor fixa quando ela é quase preto ou
                    quase branco: essas mensagens foram gravadas com
                    `color: rgb(17,17,17)` e sumiam no tema escuro. */}
                <div
                  className="leading-relaxed text-foreground"
                  dangerouslySetInnerHTML={{
                    __html: renderRichText(m.titulo) || "Sem título",
                  }}
                />
              </h3>
              <ChevronDown
                className={`mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform duration-300 ${
                  aberta ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Abre para baixo animando a altura de verdade: `grid-rows` de
                `0fr` para `1fr` cresce até o tamanho do conteúdo sem que
                ninguém precise medi-lo. `height: auto` não é animável. */}
            <div
              className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                aberta ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <div
                  className="prose prose-sm dark:prose-invert px-4 pb-4 text-foreground"
                  dangerouslySetInnerHTML={{
                    __html: renderRichText(m.mensagem),
                  }}
                />
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
