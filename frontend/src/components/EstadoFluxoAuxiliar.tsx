import { AlertTriangle, Inbox, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { EstadoFluxoAuxiliar as Estado } from "@/hooks/useFluxoAuxiliar";

type Props = {
  estado: Estado;
  /** Nome da aba, para a mensagem dizer o que falta cadastrar. */
  nome: string;
  onTentarNovamente: () => void;
};

/**
 * O que a aba mostra quando não tem conteúdo.
 *
 * Antes não mostrava nada: o fluxo não era encontrado, o erro morria num
 * `console.error` e a aba abria em branco, sem dizer se estava carregando, se
 * tinha quebrado ou se simplesmente ninguém cadastrou o conteúdo ainda.
 */
const EstadoFluxoAuxiliar: React.FC<Props> = ({
  estado,
  nome,
  onTentarNovamente,
}) => {
  if (estado === "ok") {
    return null;
  }

  if (estado === "carregando") {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando {nome}...
      </div>
    );
  }

  if (estado === "sem-cadastro") {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center dark:border-slate-700">
        <Inbox className="h-6 w-6 text-slate-400" />
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Nada cadastrado em {nome}
        </p>
        <p className="max-w-md text-xs text-slate-500 dark:text-slate-400">
          O conteúdo desta aba vem de um fluxo do roteiro. Peça para a Qualidade
          criar o fluxo <strong>{nome}</strong> pelo @RoteiroAdm — assim que
          existir, ele aparece aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-6 py-8 text-center dark:border-red-900/50 dark:bg-red-950/20">
      <AlertTriangle className="h-6 w-6 text-red-500" />
      <p className="text-sm font-medium text-red-800 dark:text-red-200">
        Não foi possível carregar {nome}
      </p>
      <Button variant="outline" size="sm" onClick={onTentarNovamente}>
        Tentar novamente
      </Button>
    </div>
  );
};

export default EstadoFluxoAuxiliar;
