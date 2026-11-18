import { useCallback, useEffect, useState } from "react";
import { Link2, Loader2, Pencil, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import axiosInstance from "@/utils/axiosInstance";
import {
  listarAbasRoteiro,
  vincularAbaRoteiro,
  type AbaRoteiro,
} from "@/hooks/useFluxoAuxiliar";

type FluxoResumo = {
  id_fluxo: string;
  produto: string;
  tipo_cliente: string;
  tipo_ligacao: string;
};

type Props = {
  aba: string;
  /** Recarrega a pré-visualização depois de trocar o vínculo. */
  onVinculado?: () => void;
};

const SEM_FLUXO = "__sem_fluxo__";

const rotuloDoFluxo = (fluxo: FluxoResumo) => {
  const partes = [fluxo.produto, fluxo.tipo_cliente, fluxo.tipo_ligacao]
    .map((parte) => (parte || "").trim())
    .filter(Boolean);

  // Fluxo sem nome nenhum ainda precisa ser escolhível: é exatamente o caso
  // do conteúdo de Canais de Atendimento, que existe mas está sem cadastro.
  return partes.length
    ? [...new Set(partes)].join(" · ")
    : `(sem nome) ${fluxo.id_fluxo.slice(0, 8)}`;
};

/**
 * Escolhe qual fluxo alimenta uma aba do roteiro do operador.
 *
 * Antes a ligação era por nome, deduzida em silêncio, e quebrava com um acento
 * ou um espaço a mais. Aqui ela vira uma escolha explícita — e o combo lista
 * inclusive os fluxos sem nome, que a dedução nunca conseguiria alcançar.
 */
const SeletorFluxoDaAba: React.FC<Props> = ({ aba, onVinculado }) => {
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [info, setInfo] = useState<AbaRoteiro | null>(null);
  const [fluxos, setFluxos] = useState<FluxoResumo[]>([]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [abas, listaFluxos] = await Promise.all([
        listarAbasRoteiro(),
        axiosInstance.get<FluxoResumo[]>("/api/roteiro/fluxos"),
      ]);
      setInfo(abas.find((item) => item.aba === aba) ?? null);
      setFluxos(listaFluxos.data || []);
    } catch (erro) {
      console.error("Erro ao carregar o vínculo da aba:", erro);
    } finally {
      setCarregando(false);
    }
  }, [aba]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const trocar = async (valor: string) => {
    setSalvando(true);
    try {
      await vincularAbaRoteiro(aba, valor === SEM_FLUXO ? null : valor);
      toast.success("Aba vinculada.");
      setAberto(false);
      await carregar();
      onVinculado?.();
    } catch (erro) {
      const detalhe =
        (erro as { response?: { data?: { erro?: string } } })?.response?.data
          ?.erro ?? "Não foi possível vincular a aba.";
      toast.error(detalhe);
    } finally {
      setSalvando(false);
    }
  };

  if (carregando && !info) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Verificando o fluxo desta aba...
      </div>
    );
  }

  const descricao = (() => {
    if (!info || info.origem === "sem-fluxo") return "Nenhum fluxo vinculado";
    const nome = info.produto?.trim() || "(fluxo sem nome)";
    return info.origem === "vinculo"
      ? `Mostrando: ${nome}`
      : `Mostrando: ${nome} — encontrado pelo nome, não fixado`;
  })();

  return (
    <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex min-w-0 flex-1 items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <Link2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="truncate" title={descricao}>
            {descricao}
          </span>
        </span>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => setAberto((prev) => !prev)}
          disabled={salvando}
        >
          {aberto ? (
            <>
              <X className="h-3 w-3" /> Fechar
            </>
          ) : (
            <>
              <Pencil className="h-3 w-3" /> Trocar fluxo
            </>
          )}
        </Button>
      </div>

      {aberto && (
        <div className="mt-2 space-y-2">
          {info?.editavel === false ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
              O vínculo por escolha ainda não está habilitado neste ambiente.
              Rode <code>backend/scripts/roteiro_abas.sql</code> — até lá a aba
              continua achando o fluxo pelo nome.
            </p>
          ) : (
            <>
              <Select
                value={info?.id_fluxo ?? SEM_FLUXO}
                onValueChange={trocar}
                disabled={salvando}
              >
                <SelectTrigger className="h-8 min-w-0 text-xs [&>span]:truncate">
                  <SelectValue placeholder="Escolha o fluxo" />
                </SelectTrigger>
                <SelectContent className="max-w-[min(28rem,90vw)]">
                  <SelectItem value={SEM_FLUXO}>
                    Nenhum (deixar a aba vazia)
                  </SelectItem>
                  {fluxos.map((fluxo) => (
                    <SelectItem key={fluxo.id_fluxo} value={fluxo.id_fluxo}>
                      <span className="block truncate">
                        {rotuloDoFluxo(fluxo)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                As mensagens continuam sendo editadas no builder. Aqui você só
                escolhe qual fluxo esta aba mostra.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SeletorFluxoDaAba;
