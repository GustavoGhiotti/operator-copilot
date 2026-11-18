import { useState } from "react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { renderRichText } from "@/utils/richText";
import EstadoFluxoAuxiliar from "@/components/EstadoFluxoAuxiliar";
import {
  useFluxoAuxiliar,
  type MensagemAuxiliar,
} from "@/hooks/useFluxoAuxiliar";

export default function TabulacoesPage() {
  const { mensagens, estado, recarregar } = useFluxoAuxiliar("tabulacoes");
  const [mensagemSelecionada, setMensagemSelecionada] =
    useState<MensagemAuxiliar | null>(null);

  const handleSelecionarMensagem = (idMensagem: string) => {
    const msg = mensagens.find((m) => m.id_mensagem === idMensagem);
    if (!msg) return;

    setMensagemSelecionada({ ...msg });
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold">
        Tabulação — Consulta de Mensagens
      </h2>

      <EstadoFluxoAuxiliar
        estado={estado}
        nome="Tabulações"
        onTentarNovamente={recarregar}
      />

      {estado === "ok" && (
        <div>
        <label className="text-sm font-medium block mb-2">
          Selecione uma mensagem do fluxo
        </label>
        <Select onValueChange={(value) => handleSelecionarMensagem(value)}>
          <SelectTrigger className="w-full bg-white dark:bg-gray-900">
            <SelectValue placeholder="Escolher mensagem" />
          </SelectTrigger>

          <SelectContent>
            {mensagens.map((m) => (
              <SelectItem key={m.id_mensagem} value={m.id_mensagem}>
                <div
                  className="text-foreground leading-relaxed"
                  dangerouslySetInnerHTML={{
                    __html: m.titulo,
                  }}
                />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        </div>
      )}

      {/* `key` na tabulação escolhida: trocar de opção remonta o card e a
          animação roda de novo, em vez de o texto ser substituído no lugar
          sem que nada indique que mudou. `renderRichText` limpa a cor fixa
          que some no tema escuro. */}
      {mensagemSelecionada && (
        <Card
          key={mensagemSelecionada.id_mensagem}
          className="animate-in fade-in slide-in-from-top-2 border border-gray-300 bg-white p-4 duration-300 dark:border-gray-700 dark:bg-gray-900"
        >
          <h3 className="text-md font-bold mb-2">
            <div
              className="text-foreground leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: renderRichText(mensagemSelecionada.titulo),
              }}
            />
          </h3>
          <div
            className="prose prose-sm dark:prose-invert text-foreground"
            dangerouslySetInnerHTML={{
              __html: renderRichText(mensagemSelecionada.mensagem),
            }}
          />
        </Card>
      )}
    </div>
  );
}
