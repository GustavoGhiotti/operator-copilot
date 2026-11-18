import { useEffect, useState } from "react";
import { Check, Grid3X3, Loader2, Save, Sparkles, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  arenaApi,
  ArenaBingoConfig,
  ArenaBingoWinningPattern,
} from "@/services/arenaApi";

interface ArenaBingoBuilderProps {
  campaignId: number;
  onSaved: (config: ArenaBingoConfig) => void;
}

const patterns: Array<{
  value: ArenaBingoWinningPattern;
  title: string;
  description: string;
}> = [
  { value: "LINHA", title: "Uma linha", description: "Horizontal, vertical ou diagonal." },
  { value: "DUAS_LINHAS", title: "Duas linhas", description: "Duas combinações completas." },
  { value: "QUATRO_CANTOS", title: "Quatro cantos", description: "As quatro extremidades da cartela." },
  { value: "CARTELA_CHEIA", title: "Cartela cheia", description: "Todas as 25 casas marcadas." },
];

const preview = [
  [7, 18, 31, 52, 71],
  [12, 25, 42, 47, 64],
  [3, 29, null, 60, 75],
  [15, 20, 39, 55, 68],
  [9, 16, 35, 49, 62],
];

const errorMessage = (error: unknown) => {
  const candidate = error as { response?: { data?: { erro?: string } } };
  return candidate.response?.data?.erro || "Não foi possível configurar o Bingo.";
};

export default function ArenaBingoBuilder({
  campaignId,
  onSaved,
}: ArenaBingoBuilderProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<ArenaBingoConfig>({
    id_campanha: campaignId,
    padrao_vitoria: "LINHA",
    casa_livre: true,
    xp_participacao: 25,
    xp_vitoria: 100,
    status: "RASCUNHO",
  });

  useEffect(() => {
    let active = true;
    arenaApi.getBingo(campaignId)
      .then((result) => {
        if (active) setConfig(result);
      })
      .catch((error) => {
        toast({
          title: "Editor do Bingo indisponível",
          description: errorMessage(error),
          variant: "destructive",
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [campaignId, toast]);

  const save = async () => {
    setSaving(true);
    try {
      const saved = await arenaApi.saveBingo(campaignId, {
        padrao_vitoria: config.padrao_vitoria,
        casa_livre: config.casa_livre,
        xp_participacao: Number(config.xp_participacao),
        xp_vitoria: Number(config.xp_vitoria),
      });
      toast({
        title: "Bingo configurado",
        description: "As cartelas serão geradas individualmente ao iniciar a partida.",
      });
      onSaved(saved);
    } catch (error) {
      toast({
        title: "Revise as regras do Bingo",
        description: errorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="grid min-h-80 place-items-center"><Loader2 className="h-7 w-7 animate-spin text-violet-300" /></div>;
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-violet-400/30 bg-[linear-gradient(120deg,rgba(139,92,246,.14),rgba(6,182,212,.05))] p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-violet-300/35 bg-violet-400/10 text-violet-200"><Grid3X3 className="h-5 w-5" /></span>
          <div><h4 className="text-sm font-semibold text-white">Bingo numérico 5×5</h4><p className="mt-1 text-[10px] leading-relaxed text-slate-400">Cada operador recebe uma cartela única. Os números são sorteados e marcados automaticamente pelo servidor.</p></div>
        </div>
      </section>

      <section>
        <p className="mb-3 font-mono text-[9px] tracking-[0.15em] text-cyan-300">PADRÃO DE VITÓRIA</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {patterns.map((pattern) => {
            const selected = config.padrao_vitoria === pattern.value;
            return (
              <button key={pattern.value} type="button" onClick={() => setConfig((current) => ({ ...current, padrao_vitoria: pattern.value }))} className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${selected ? "border-violet-400/60 bg-violet-400/10" : "border-[#263e58] bg-[#071421] hover:border-cyan-400/35"}`}>
                <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border ${selected ? "border-violet-300 bg-violet-400 text-white" : "border-slate-600"}`}>{selected && <Check className="h-3 w-3" />}</span>
                <span><strong className="block text-xs text-white">{pattern.title}</strong><span className="mt-1 block text-[10px] text-slate-500">{pattern.description}</span></span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <div className="space-y-4 rounded-2xl border border-[#263e58] bg-[#06111e] p-5">
          <label className="flex items-center justify-between gap-4 rounded-xl border border-[#263e58] bg-[#071421] p-4">
            <span><strong className="block text-xs text-white">Casa central livre</strong><span className="mt-1 block text-[10px] text-slate-500">A posição central começa marcada.</span></span>
            <input type="checkbox" checked={config.casa_livre} onChange={(event) => setConfig((current) => ({ ...current, casa_livre: event.target.checked }))} className="h-4 w-4 accent-violet-400" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label><span className="mb-2 block text-[9px] text-cyan-300">XP DE PARTICIPAÇÃO</span><input type="number" min={0} max={10000} value={config.xp_participacao} onChange={(event) => setConfig((current) => ({ ...current, xp_participacao: Number(event.target.value) }))} className="arena-input" /></label>
            <label><span className="mb-2 block text-[9px] text-cyan-300">BÔNUS DO VENCEDOR</span><input type="number" min={0} max={10000} value={config.xp_vitoria} onChange={(event) => setConfig((current) => ({ ...current, xp_vitoria: Number(event.target.value) }))} className="arena-input" /></label>
          </div>
          <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4 text-[10px] leading-relaxed text-slate-300"><Sparkles className="mr-2 inline h-3.5 w-3.5 text-cyan-300" />O primeiro pedido válido encerra a partida. A conferência acontece no backend.</div>
        </div>

        <div className="rounded-2xl border border-violet-400/30 bg-[#071421] p-4">
          <div className="grid grid-cols-5 gap-1 text-center font-bold text-violet-200">{"BINGO".split("").map((letter) => <span key={letter} className="py-1">{letter}</span>)}</div>
          <div className="mt-1 grid grid-cols-5 gap-1">
            {preview.flatMap((row, rowIndex) => row.map((number, columnIndex) => (
              <span key={`${rowIndex}-${columnIndex}`} className={`grid aspect-square place-items-center rounded border text-[10px] ${number === null && config.casa_livre ? "border-orange-400/60 bg-orange-400/15 text-orange-200" : "border-[#31506d] bg-[#0a1a2b] text-cyan-100"}`}>{number === null && config.casa_livre ? <Zap className="h-3.5 w-3.5" /> : number || 38}</span>
            ))) }
          </div>
          <p className="mt-3 text-center font-mono text-[8px] tracking-[0.14em] text-slate-500">PRÉVIA DA CARTELA</p>
        </div>
      </section>

      <button type="button" disabled={saving} onClick={() => void save()} className="ml-auto flex h-11 items-center gap-2 rounded-xl bg-orange-500 px-5 text-xs font-bold text-white hover:bg-orange-400 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} SALVAR BINGO E CONTINUAR</button>
    </div>
  );
}
