import { useEffect, useState } from "react";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const IMAGEM = "/images/campaigns/indicacao-premiada-14-08.png";

// Versionar a chave faz a proxima campanha aparecer para quem ja fechou esta.
// Sem isso, quem dispensou o aviso do Natal nunca mais veria aviso nenhum.
const STORAGE_KEY = "avisoCampanhaVisto:indicacao-2026-08";

// A propria arte diz "prorrogado ate 14/08". Depois dessa data o popup vira
// informacao errada, entao ele para de aparecer sozinho -- ninguem precisa
// lembrar de tirar do ar.
const ULTIMO_DIA = new Date(2026, 7, 14, 23, 59, 59);

export default function AvisoCampanhaIndicacao() {
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("userToken")?.trim()) return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    if (new Date() > ULTIMO_DIA) return;

    setAberto(true);
  }, []);

  const fechar = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setAberto(false);
  };

  return (
    <Dialog
      open={aberto}
      onOpenChange={(proximo) => {
        // Cobre o clique fora, o Esc e o X do proprio Dialog: em todos, o
        // aviso conta como visto e nao volta no proximo carregamento.
        if (!proximo) fechar();
      }}
    >
      {/* Sem fundo e sem borda: a arte ja e o cartao. `max-w-2xl` mantem o
          popup longe das bordas da tela, como voce pediu. */}
      <DialogContent className="max-w-2xl border-0 bg-transparent p-0 shadow-none">
        <div className="overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-slate-950">
          <img
            src={IMAGEM}
            alt="Campanha de indicacao premiada, prorrogada ate 14/08"
            className="block w-full object-contain"
          />
          <div className="flex justify-end px-4 py-3">
            <Button variant="secondary" onClick={fechar}>
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
