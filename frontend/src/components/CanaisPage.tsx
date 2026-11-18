import { Card } from "@/components/ui/card";
import EstadoFluxoAuxiliar from "@/components/EstadoFluxoAuxiliar";
import { useFluxoAuxiliar } from "@/hooks/useFluxoAuxiliar";

export default function CanaisPage() {
  const { mensagens, estado, recarregar } =
    useFluxoAuxiliar("canais_de_atendimento");

  function linkify(text: string) {
    const urlRegex = /((https?:\/\/|www\.)[^\s<]+)/gi;
    return text.replace(
      urlRegex,
      (url) =>
        `<a href="${url}" target="_blank" class="text-blue-600 underline">${url}</a>`
    );
  }

  if (estado !== "ok") {
    return (
      <div className="p-4">
        <EstadoFluxoAuxiliar
          estado={estado}
          nome="Canais de Atendimento"
          onTentarNovamente={recarregar}
        />
      </div>
    );
  }

  return (
    <div className="p-4 grid grid-cols-2 gap-4">
      {mensagens.map((m) => (
        <Card
          key={m.id_mensagem}
          className="p-4 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700"
        >
          <h3 className="text-md font-bold mb-2">
            <div
              className="text-foreground leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: linkify(m.titulo),
              }}
            />
          </h3>
          <div
            className="prose prose-sm dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: linkify(m.mensagem) }}
          />
        </Card>
      ))}
    </div>
  );
}
