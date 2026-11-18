import type { Mensagem } from "@/types/monitoria";

interface Props {
  mensagem: Mensagem;
}

function formatHora(dateStr?: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function MensagemBubble({ mensagem }: Props) {
  const isEnviada = mensagem.direcao === "ENVIADA";

  return (
    <div className={`mb-3 flex ${isEnviada ? "justify-end" : "justify-start"}`}>
      <div
        className={`group relative max-w-[72%] overflow-hidden rounded-[20px] px-3.5 py-2.5 text-sm leading-relaxed shadow-lg transition-transform duration-300 hover:scale-[1.01] ${
          isEnviada
            ? "rounded-br-md border border-primary/20 bg-gradient-to-br from-primary via-primary to-orange-500 text-primary-foreground shadow-[0_18px_40px_rgba(249,115,22,0.16)]"
            : "rounded-bl-md border border-white/10 bg-white/[0.05] text-foreground backdrop-blur-md"
        }`}
      >
        <div
          className={`absolute inset-0 opacity-60 ${
            isEnviada
              ? "bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_45%)]"
              : "bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_45%)]"
          }`}
        />
        {isEnviada && mensagem.operadorNome && (
          <p
            className={`relative mb-1 text-[9px] font-semibold uppercase tracking-[0.18em] ${
              isEnviada ? "text-primary-foreground/70" : "text-muted-foreground"
            }`}
          >
            {mensagem.operadorNome}
          </p>
        )}
        {!isEnviada && (
          <p className="relative mb-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Cliente
          </p>
        )}
        <p className="relative whitespace-pre-wrap break-words text-[13px] leading-6">
          {mensagem.conteudo}
        </p>
        <p
          className={`relative mt-1.5 text-right text-[9px] ${
            isEnviada ? "text-primary-foreground/60" : "text-muted-foreground"
          }`}
        >
          {formatHora(mensagem.criadoEm)}
        </p>
      </div>
    </div>
  );
}
