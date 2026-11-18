/**
 * Minha Aurora — o guarda-roupa da Arena.
 *
 * A tela é uma ficha de personagem: dock de slots à esquerda, Aurora grande
 * no centro, catálogo à direita. Três decisões sustentam isso:
 *
 * 1. Ela é o produto da tela. Ver o visual mudar no corpo dela é a recompensa,
 *    e num quadradinho lateral isso não acontece.
 * 2. O dock responde "o que estou usando?" sem varrer a lista, e ainda é a
 *    navegação por categoria — dois trabalhos num controle só.
 * 3. Comprar e equipar moram no palco, sob a Aurora. Escolher no tile e agir
 *    olhando para ela fecha o ciclo ver → provar → decidir.
 */
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Coins,
  Frame,
  Image as ImageIcon,
  Loader2,
  LockKeyhole,
  ShoppingBag,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import {
  arenaApi,
  type ArenaAuroraCustomization,
  type ArenaAuroraItem,
  type ArenaAuroraSlot,
} from "@/services/arenaApi";
import AuroraDressUpAvatar from "@/components/AuroraDressUpAvatar";
import AuroraItemThumb from "@/components/AuroraItemThumb";
import {
  isAuroraCharacterSlot,
  isAuroraPresetAvailable,
  AURORA_CHARACTER_SLOTS,
} from "@/components/auroraVisual";

interface ArenaAuroraWardrobeProps {
  searchTerm: string;
  xpFallback: number;
}

type Categoria = "TODOS" | "VISUAL" | "FUNDO" | "AURA" | "MOLDURA";

const SLOTS: Array<{
  id: Exclude<Categoria, "TODOS">;
  label: string;
  icon: typeof Sparkles;
}> = [
  { id: "VISUAL", label: "Visual completo", icon: Sparkles },
  { id: "FUNDO", label: "Cenário", icon: ImageIcon },
  { id: "AURA", label: "Aura", icon: Wand2 },
  { id: "MOLDURA", label: "Moldura", icon: Frame },
];

/**
 * A raridade precisa ser sentida, não lida.
 *
 * Um lendário com a mesma borda cinza de um comum não é lendário — é uma
 * etiqueta. Cada nível tem borda, fundo e brilho próprios.
 */
const RARIDADE = {
  COMUM: {
    rotulo: "COMUM",
    borda: "border-slate-500/40",
    fundo: "bg-slate-400/[0.04]",
    texto: "text-slate-300",
    selo: "bg-slate-500/20 text-slate-300",
    brilho: "",
  },
  RARO: {
    rotulo: "RARO",
    borda: "border-cyan-400/50",
    fundo: "bg-cyan-400/[0.07]",
    texto: "text-cyan-300",
    selo: "bg-cyan-400/20 text-cyan-200",
    brilho: "shadow-[0_0_18px_rgba(34,211,238,.14)]",
  },
  EPICO: {
    rotulo: "ÉPICO",
    borda: "border-violet-400/55",
    fundo: "bg-violet-400/[0.09]",
    texto: "text-violet-300",
    selo: "bg-violet-400/25 text-violet-200",
    brilho: "shadow-[0_0_22px_rgba(139,92,246,.2)]",
  },
  LENDARIO: {
    rotulo: "LENDÁRIO",
    borda: "border-orange-400/65",
    fundo: "bg-gradient-to-br from-orange-400/[0.16] to-amber-300/[0.05]",
    texto: "text-orange-300",
    selo: "bg-orange-400/25 text-orange-200",
    brilho: "shadow-[0_0_28px_rgba(249,115,22,.24)]",
  },
} as const;

const raridadeDe = (valor: string) =>
  RARIDADE[valor as keyof typeof RARIDADE] || RARIDADE.COMUM;

/** Um card por preset completo ou item de ambiente. */
interface GrupoVisual {
  chave: string;
  slot: ArenaAuroraSlot;
  variantes: ArenaAuroraItem[];
}

/**
 * Rede de emergência para backend fora do ar.
 *
 * Cobre um item de cada família — inclusive cenário e aura — para o layout não
 * aparecer quebrado justamente quando algo já deu errado.
 */
const fallbackItems: ArenaAuroraItem[] = [
  {
    id: 1, codigo: "AURORA_LOOK_01", nome: "Essencial",
    descricao: "Camiseta clara, jeans escuro e tênis ciano.", slot: "VISUAL",
    raridade: "COMUM", preco_coins: 80, xp_necessario: 0,
    chave_visual: "look-01", adquirido: false, equipado: false,
    desbloqueado: true, pode_comprar: false,
  },
  {
    id: 2, codigo: "AURORA_LOOK_02", nome: "Polo Acme",
    descricao: "Polo marinho e alfaiataria casual.", slot: "VISUAL",
    raridade: "COMUM", preco_coins: 100, xp_necessario: 100,
    chave_visual: "look-02", adquirido: false, equipado: false,
    desbloqueado: true, pode_comprar: false,
  },
  {
    id: 3, codigo: "AURORA_LOOK_03", nome: "Moletom Pulse",
    descricao: "Moletom marinho e jogger coordenada.", slot: "VISUAL",
    raridade: "COMUM", preco_coins: 120, xp_necessario: 200,
    chave_visual: "look-03", adquirido: false, equipado: false,
    desbloqueado: true, pode_comprar: false,
  },
  {
    id: 4, codigo: "AURORA_LOOK_04", nome: "Sobreposição Clara",
    descricao: "Camisa azul-clara sobre camiseta branca.", slot: "VISUAL",
    raridade: "COMUM", preco_coins: 140, xp_necessario: 300,
    chave_visual: "look-04", adquirido: false, equipado: false,
    desbloqueado: true, pode_comprar: false,
  },
  {
    id: 20, codigo: "FUNDO_ESTUDIO", nome: "Estúdio Neon",
    descricao: "Fundo escuro com halo ciano.", slot: "FUNDO",
    raridade: "COMUM", preco_coins: 80, xp_necessario: 0,
    chave_visual: "fundo-estudio", adquirido: false, equipado: false,
    desbloqueado: true, pode_comprar: false,
  },
  {
    id: 21, codigo: "AURA_PULSO", nome: "Aura Pulso",
    descricao: "Um pulso ciano ao seu redor.", slot: "AURA",
    raridade: "COMUM", preco_coins: 120, xp_necessario: 200,
    chave_visual: "aura-pulso", adquirido: false, equipado: false,
    desbloqueado: true, pode_comprar: false,
  },
];

export default function ArenaAuroraWardrobe({
  searchTerm,
  xpFallback,
}: ArenaAuroraWardrobeProps) {
  const { toast } = useToast();
  const [visual, setVisual] = useState<ArenaAuroraCustomization | null>(null);
  const [categoria, setCategoria] = useState<Categoria>("TODOS");
  const [emFoco, setEmFoco] = useState<ArenaAuroraItem | null>(null);
  const [comprando, setComprando] = useState<ArenaAuroraItem | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [acaoPendente, setAcaoPendente] = useState<string | null>(null);
  const [modoDemo, setModoDemo] = useState(false);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    void arenaApi.getAuroraCustomization()
      .then((dados) => {
        if (!ativo) return;
        setVisual(dados);
        setModoDemo(false);
      })
      .catch(() => {
        if (!ativo) return;
        setVisual({
          xp_total: xpFallback,
          saldo_coins: 0,
          equipado: {},
          filtros: {},
          colecao: {
            total: fallbackItems.length,
            adquiridos: 0,
            proximo_desbloqueio: null,
          },
          conjuntos: [],
          itens: fallbackItems.map((item) => ({
            ...item,
            desbloqueado: xpFallback >= item.xp_necessario,
          })),
        });
        setModoDemo(true);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [xpFallback]);

  const itens = useMemo(() => (visual?.itens || []).flatMap((item) => {
    if (isAuroraCharacterSlot(item.slot)) {
      // Preset corporal só entra no catálogo quando existe uma imagem inteira
      // revisada. Variantes por filtro e renders parciais ficam indisponíveis.
      if (item.filtro_cor || !isAuroraPresetAvailable(item.chave_visual)) {
        return [];
      }
      return [{ ...item, slot: "VISUAL" as const, filtro_cor: null }];
    }
    return [item];
  }), [visual?.itens]);

  /** Peças com suas colorações reunidas — uma silhueta, um tile. */
  const grupos = useMemo(() => {
    const busca = searchTerm.trim().toLocaleLowerCase("pt-BR");
    const mapa = new Map<string, GrupoVisual>();

    itens.forEach((item) => {
      if (categoria !== "TODOS" && item.slot !== categoria) return;
      if (
        busca
        && !`${item.nome} ${item.descricao || ""} ${item.raridade}`
          .toLocaleLowerCase("pt-BR")
          .includes(busca)
      ) {
        return;
      }
      const chave = `${item.slot}:${item.codigo}`;
      const grupo = mapa.get(chave);
      if (grupo) {
        grupo.variantes.push(item);
      } else {
        mapa.set(chave, { chave, slot: item.slot, variantes: [item] });
      }
    });

    return Array.from(mapa.values());
  }, [categoria, itens, searchTerm]);

  /** O palco troca o preset inteiro pelo item em foco. */
  const previa = useMemo(() => {
    const equipado = { ...(visual?.equipado || {}) };
    const filtros = { ...(visual?.filtros || {}) };
    if (emFoco) {
      if (emFoco.slot === "VISUAL") {
        AURORA_CHARACTER_SLOTS.forEach((slot) => {
          delete equipado[slot];
          delete filtros[slot];
        });
      }
      equipado[emFoco.slot] = emFoco.chave_visual;
    }
    return { equipado, filtros };
  }, [emFoco, visual?.equipado, visual?.filtros]);

  /** O que está equipado em cada slot, para o dock. */
  const equipadoPorSlot = useMemo(() => {
    const mapa = new Map<ArenaAuroraSlot, ArenaAuroraItem>();
    itens.forEach((item) => {
      if (item.equipado) mapa.set(item.slot, item);
    });
    return mapa;
  }, [itens]);

  const atualizar = (proximo: ArenaAuroraCustomization) => {
    setVisual(proximo);
    if (emFoco) {
      setEmFoco(
        proximo.itens.find((item) => item.codigo === emFoco.codigo) || null,
      );
    }
  };

  const comprar = async () => {
    if (!comprando || modoDemo) return;
    setAcaoPendente(`buy:${comprando.codigo}`);
    try {
      atualizar(await arenaApi.buyAuroraVisual(comprando.codigo));
      toast({
        title: "Está no seu armário",
        description: `${comprando.nome} foi comprado com Aurora Coins.`,
      });
      setComprando(null);
    } catch (erro) {
      const candidato = erro as { response?: { data?: { erro?: string } } };
      toast({
        title: "Não foi possível comprar",
        description: candidato.response?.data?.erro
          || "Confira o saldo e tente de novo.",
        variant: "destructive",
      });
    } finally {
      setAcaoPendente(null);
    }
  };

  const equipar = async (item: ArenaAuroraItem, remover = false) => {
    if (modoDemo) return;
    const tirando = remover || item.equipado;
    setAcaoPendente(`equip:${item.codigo}`);
    try {
      atualizar(
        await arenaApi.equipAuroraVisual(
          item.slot,
          tirando ? null : item.codigo,
        ),
      );
      toast({
        title: tirando ? "Visual removido" : "Aurora atualizada",
        description: tirando
          ? "A Aurora voltou ao visual completo padrão."
          : `${item.nome} foi aplicado por inteiro.`,
      });
    } catch (erro) {
      const candidato = erro as { response?: { data?: { erro?: string } } };
      toast({
        title: "Não foi possível atualizar",
        description: candidato.response?.data?.erro || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setAcaoPendente(null);
    }
  };

  if (carregando) {
    return (
      <div className="grid min-h-[60vh] place-items-center text-center text-cyan-200">
        <div>
          <Loader2 className="mx-auto h-8 w-8 animate-spin" />
          <p className="mt-4 font-mono text-[10px] tracking-[0.2em]">
            PREPARANDO SUA AURORA
          </p>
        </div>
      </div>
    );
  }

  const colecao = visual?.colecao;
  const progresso = colecao?.total
    ? Math.round((colecao.adquiridos / colecao.total) * 100)
    : 0;
  const xpTotal = visual?.xp_total || 0;

  return (
    <section data-arena-enter className="space-y-4">
      {modoDemo && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-400/35 bg-amber-400/[0.08] p-3 text-xs text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <div>
            <strong className="font-semibold">Modo de prévia.</strong>{" "}
            Dá para experimentar o visual, mas comprar e equipar só depois de
            aplicar a migration da personalização.
          </div>
        </div>
      )}

      {/* Cabeçalho leve: o palco, e não uma faixa de métricas, abre a tela. */}
      <div className="flex flex-wrap items-end gap-4 px-1">
        <div className="min-w-[260px] flex-1">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold tracking-[0.04em] text-white">
                MINHA AURORA
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Seu visual. Sua conquista.
              </p>
            </div>
            <strong className="text-xs text-slate-300">
              {colecao?.adquiridos || 0}
              <span className="text-slate-600">/{colecao?.total || 0}</span>
              <span className="ml-1 font-normal text-slate-500">na coleção</span>
            </strong>
          </div>
          <div className="mt-3 h-1 max-w-xl overflow-hidden rounded-full bg-[#0d2136]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-orange-400 transition-all duration-500"
              style={{ width: `${progresso}%` }}
            />
          </div>
          {colecao?.proximo_desbloqueio ? (
            <p className="mt-2 text-[10px] text-slate-500">
              Próximo:{" "}
              <strong
                className={raridadeDe(colecao.proximo_desbloqueio.raridade).texto}
              >
                {colecao.proximo_desbloqueio.nome}
              </strong>{" "}
              — faltam{" "}
              <strong className="text-white">
                {colecao.proximo_desbloqueio.xp_faltando} XP
              </strong>
            </p>
          ) : (
            <p className="mt-2 text-[10px] text-emerald-300">
              Você desbloqueou tudo que existe.
            </p>
          )}
        </div>
        <Carteira
          icone={Sparkles}
          rotulo="XP ACUMULADO"
          valor={xpTotal}
          tom="cyan"
        />
        <Carteira
          icone={Coins}
          rotulo="AURORA COINS"
          valor={visual?.saldo_coins || 0}
          tom="orange"
        />
      </div>

      {/* Ficha de personagem: rail mínima, palco dominante e armário secundário. */}
      <div className="grid gap-3 xl:grid-cols-[72px_minmax(0,1fr)_minmax(0,340px)]">
        <aside className="rounded-2xl border border-[#263e58] bg-[#071421]/80 p-2 backdrop-blur-xl">
          <p className="px-1 text-center font-mono text-[8px] tracking-[0.12em] text-slate-600 xl:sr-only">
            EQUIPADOS
          </p>
          <div className="arena-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1 xl:grid xl:overflow-visible xl:pb-0">
            {SLOTS.map((slot) => {
              const Icone = slot.icon;
              const usando = equipadoPorSlot.get(slot.id);
              const ativa = categoria === slot.id;
              return (
                <div
                  key={slot.id}
                  className={`group relative flex shrink-0 items-center justify-center gap-2 rounded-xl border p-2 transition xl:shrink ${
                    ativa
                      ? "border-cyan-400/60 bg-cyan-400/10"
                      : "border-[#20364c] hover:border-cyan-400/35"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setCategoria(ativa ? "TODOS" : slot.id)}
                    className="flex min-w-0 flex-1 items-center justify-center gap-2 text-left"
                  >
                    {usando ? (
                      <AuroraItemThumb
                        chaveVisual={usando.chave_visual}
                        filtroCor={usando.filtro_cor}
                        className="h-9 w-9 shrink-0"
                      />
                    ) : (
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-dashed border-[#2b435d] text-slate-600">
                        <Icone className="h-4 w-4" />
                      </span>
                    )}
                    <span className="hidden min-w-0 flex-1">
                      <span className="block truncate text-[10px] font-semibold text-slate-300">
                        {slot.label}
                      </span>
                      <span className="block truncate text-[9px] text-slate-500">
                        {usando ? usando.nome : "vazio"}
                      </span>
                    </span>
                  </button>
                  {usando && (
                    <button
                      type="button"
                      aria-label={`Tirar ${usando.nome}`}
                      title={`Tirar ${usando.nome}`}
                      disabled={acaoPendente === `equip:${usando.codigo}`}
                      onClick={() => void equipar(usando, true)}
                      className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full border border-[#2b435d] bg-[#06111e] text-slate-500 opacity-0 transition hover:text-white focus:opacity-100 group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        <div className="relative min-h-[720px] overflow-hidden rounded-[28px] border border-cyan-400/25 bg-[#040d19] p-4 shadow-[inset_0_0_80px_rgba(34,211,238,.035)]">
          <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(34,211,238,.7)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,.7)_1px,transparent_1px)] [background-size:42px_42px]" />
          <div className="pointer-events-none absolute left-1/2 top-[43%] h-[62%] w-[62%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(34,211,238,.2),rgba(34,211,238,.055)_42%,transparent_70%)] blur-xl" />
          <div className="pointer-events-none absolute bottom-5 left-1/2 h-20 w-[62%] -translate-x-1/2 rounded-[50%] border border-cyan-300/35 bg-cyan-400/[0.04] shadow-[0_0_45px_rgba(34,211,238,.2),inset_0_0_25px_rgba(34,211,238,.12)]" />
          <div className="pointer-events-none absolute bottom-9 left-1/2 h-10 w-[44%] -translate-x-1/2 rounded-[50%] border border-dashed border-orange-400/35" />

          <div className="relative z-30 flex items-center justify-between">
            <p className="font-mono text-[9px] tracking-[0.18em] text-cyan-300">
              {emFoco ? "EXPERIMENTANDO" : "SEU VISUAL"}
            </p>
            {emFoco && (
              <button
                type="button"
                onClick={() => setEmFoco(null)}
                className="text-[10px] font-bold text-slate-400 hover:text-white"
              >
                VOLTAR AO ATUAL
              </button>
            )}
          </div>

          <AuroraDressUpAvatar
            equipped={previa.equipado}
            filtros={previa.filtros}
            className="absolute inset-x-3 bottom-7 top-10 z-10 mx-auto w-full max-w-[700px]"
          />

          {emFoco ? (
            <div className="absolute bottom-4 right-4 z-30 w-[min(310px,calc(100%-2rem))] xl:w-[270px] 2xl:w-[310px]">
              <PainelDoItem
                item={emFoco}
                xpTotal={xpTotal}
                acaoPendente={acaoPendente}
                aoComprar={setComprando}
                aoEquipar={equipar}
              />
            </div>
          ) : (
            <p className="absolute bottom-5 left-5 z-30 rounded-full border border-[#294158] bg-[#06111e]/80 px-4 py-2 text-center text-[10px] text-slate-400 backdrop-blur-xl">
              Escolha um visual completo ao lado para experimentar.
            </p>
          )}
        </div>

        <div className="min-w-0 space-y-3">
          <div className="rounded-2xl border border-[#263e58] bg-[#06111e]/90 p-3 shadow-[0_20px_50px_rgba(0,0,0,.22)] backdrop-blur-xl">
            <div className="flex items-center justify-between px-1">
              <p className="font-mono text-[9px] tracking-[0.18em] text-slate-500">
                {categoria === "TODOS"
                  ? "VISUAIS E AMBIENTE"
                  : SLOTS.find((slot) => slot.id === categoria)?.label.toUpperCase()}
              </p>
              {categoria !== "TODOS" && (
                <button
                  type="button"
                  onClick={() => setCategoria("TODOS")}
                  className="text-[10px] font-bold text-cyan-300 hover:text-cyan-100"
                >
                  VER TUDO
                </button>
              )}
            </div>

            {grupos.length === 0 ? (
              <p className="grid min-h-40 place-items-center text-xs text-slate-500">
                Nada por aqui com esse filtro.
              </p>
            ) : (
              <div className="arena-scrollbar mt-2 grid max-h-[680px] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 xl:grid-cols-2">
                {grupos.map((grupo) => (
                  <TileVisual
                    key={grupo.chave}
                    grupo={grupo}
                    xpTotal={xpTotal}
                    emFoco={emFoco}
                    aoFocar={setEmFoco}
                  />
                ))}
              </div>
            )}
          </div>

          {Boolean(visual?.conjuntos?.length) && (
            <div className="rounded-2xl border border-[#263e58] bg-[#06111e] p-3">
              <p className="px-1 font-mono text-[9px] tracking-[0.18em] text-slate-500">
                COLEÇÕES
              </p>
              <div className="mt-2 space-y-1.5">
                {visual?.conjuntos.map((conjunto) => (
                  <div
                    key={conjunto.codigo}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] ${
                      conjunto.completo
                        ? "border-orange-400/50 bg-orange-400/10 text-orange-200"
                        : "border-[#22384f] text-slate-400"
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {conjunto.nome}
                    </span>
                    <span className="font-mono">
                      {conjunto.adquiridos}/{conjunto.total}
                    </span>
                    {conjunto.completo && <Check className="h-3.5 w-3.5" />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {comprando && (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-black/75 p-4 backdrop-blur-sm">
          <section className="w-full max-w-sm rounded-2xl border border-orange-400/40 bg-[#06111e] p-6 text-center">
            <ShoppingBag className="mx-auto h-8 w-8 text-orange-300" />
            <h3 className="mt-4 text-lg font-bold text-white">
              {comprando.nome}
            </h3>
            <p className="mt-2 text-xs text-slate-400">{comprando.descricao}</p>
            <p className="mt-4 text-sm text-slate-300">
              Custa{" "}
              <strong className="text-orange-300">
                {comprando.preco_coins} coins
              </strong>{" "}
              do seu saldo de {visual?.saldo_coins || 0}.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setComprando(null)}
                className="h-11 rounded-xl border border-[#2b435d] text-xs font-bold text-slate-300 hover:text-white"
              >
                AGORA NÃO
              </button>
              <button
                type="button"
                disabled={acaoPendente === `buy:${comprando.codigo}`}
                onClick={() => void comprar()}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-xs font-bold text-white disabled:opacity-50"
              >
                {acaoPendente === `buy:${comprando.codigo}` && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                COMPRAR
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

/** Tile do inventário: a mesma imagem completa exibida no palco. */
function TileVisual({
  grupo,
  xpTotal,
  emFoco,
  aoFocar,
}: {
  grupo: GrupoVisual;
  xpTotal: number;
  emFoco: ArenaAuroraItem | null;
  aoFocar: (item: ArenaAuroraItem) => void;
}) {
  // O tile representa a silhueta: mostra a variante equipada, ou a base.
  const item = grupo.variantes.find((variante) => variante.equipado)
    || grupo.variantes[0];
  const estilo = raridadeDe(item.raridade);
  const selecionado = grupo.variantes.some(
    (variante) => variante.codigo === emFoco?.codigo,
  );
  const faltamXp = Math.max(0, item.xp_necessario - xpTotal);
  const progressoXp = item.xp_necessario
    ? Math.min(100, Math.round((xpTotal / item.xp_necessario) * 100))
    : 100;

  return (
    <button
      type="button"
      onClick={() => aoFocar(item)}
      title={item.nome}
      className={`group relative flex flex-col overflow-hidden rounded-xl border text-left transition ${estilo.borda} ${estilo.fundo} ${estilo.brilho} ${
        selecionado ? "ring-2 ring-cyan-300/70" : "hover:-translate-y-0.5"
      }`}
    >
      <div className="relative aspect-square w-full">
        <AuroraItemThumb
          chaveVisual={item.chave_visual}
          filtroCor={item.filtro_cor}
          className={`h-full w-full rounded-none ${
            item.desbloqueado ? "" : "opacity-30 grayscale"
          }`}
        />
        {item.equipado && (
          <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-cyan-400 text-[#04101d]">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
        )}
        {!item.desbloqueado && (
          <span className="absolute inset-x-1 bottom-1">
            <span className="flex items-center justify-center gap-1 text-[9px] font-bold text-slate-300">
              <LockKeyhole className="h-3 w-3" /> faltam {faltamXp} XP
            </span>
            <span className="mt-1 block h-1 overflow-hidden rounded-full bg-black/60">
              <span
                className="block h-full rounded-full bg-slate-400"
                style={{ width: `${progressoXp}%` }}
              />
            </span>
          </span>
        )}
      </div>
      <div className="border-t border-white/5 px-2 py-1.5">
        <p className="truncate text-[10px] font-bold text-white">{item.nome}</p>
        <span className="flex items-center justify-between">
          <span
            className={`font-mono text-[7px] tracking-[0.1em] ${estilo.texto}`}
          >
            {estilo.rotulo}
          </span>
          <span className="inline-flex items-center gap-0.5 text-[9px] text-orange-300">
            <Coins className="h-2.5 w-2.5" /> {item.preco_coins}
          </span>
        </span>
      </div>
    </button>
  );
}

/** A decisão fica sob a Aurora: escolher, ver no corpo, aí sim agir. */
function PainelDoItem({
  item,
  xpTotal,
  acaoPendente,
  aoComprar,
  aoEquipar,
}: {
  item: ArenaAuroraItem;
  xpTotal: number;
  acaoPendente: string | null;
  aoComprar: (item: ArenaAuroraItem) => void;
  aoEquipar: (item: ArenaAuroraItem) => void;
}) {
  const estilo = raridadeDe(item.raridade);
  const ocupado = acaoPendente === `equip:${item.codigo}`;
  const faltamXp = Math.max(0, item.xp_necessario - xpTotal);

  return (
    <div className={`rounded-2xl border bg-[#06111e]/90 p-4 shadow-[0_18px_45px_rgba(0,0,0,.38)] backdrop-blur-xl ${estilo.borda} ${estilo.fundo}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white">{item.nome}</p>
          <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-400">
            {item.descricao}
          </p>
        </div>
        <span
          className={`shrink-0 rounded px-2 py-0.5 font-mono text-[8px] font-bold tracking-[0.1em] ${estilo.selo}`}
        >
          {estilo.rotulo}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-3 text-[10px]">
        <span
          className={item.desbloqueado ? "text-emerald-300" : "text-slate-500"}
        >
          {item.desbloqueado
            ? `✓ liberado em ${item.xp_necessario} XP`
            : `faltam ${faltamXp} XP`}
        </span>
        <span className="ml-auto inline-flex items-center gap-1 text-orange-300">
          <Coins className="h-3 w-3" /> {item.preco_coins}
        </span>
      </div>

      <div className="mt-3">
        {item.adquirido ? (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => aoEquipar(item)}
            className={`inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg text-[11px] font-bold transition disabled:opacity-50 ${
              item.equipado
                ? "border border-cyan-400/50 bg-cyan-400/10 text-cyan-200"
                : "bg-gradient-to-r from-cyan-500 to-cyan-600 text-white"
            }`}
          >
            {ocupado ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : item.equipado ? (
              <Check className="h-3.5 w-3.5" />
            ) : null}
            {item.equipado ? "TIRAR" : "EQUIPAR"}
          </button>
        ) : item.desbloqueado ? (
          <button
            type="button"
            onClick={() => aoComprar(item)}
            className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 text-[11px] font-bold text-white"
          >
            <ShoppingBag className="h-3.5 w-3.5" /> COMPRAR POR{" "}
            {item.preco_coins}
          </button>
        ) : (
          <span className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-[#2b435d] text-[11px] font-bold text-slate-600">
            <LockKeyhole className="h-3.5 w-3.5" /> BLOQUEADO
          </span>
        )}
      </div>
    </div>
  );
}

function Carteira({
  icone: Icone,
  rotulo,
  valor,
  tom,
}: {
  icone: typeof Sparkles;
  rotulo: string;
  valor: number;
  tom: "cyan" | "orange";
}) {
  const cores = tom === "cyan"
    ? "border-cyan-400/30 text-cyan-300"
    : "border-orange-400/30 text-orange-300";
  return (
    <div
      className={`min-w-[132px] rounded-full border bg-[#06111e]/90 px-3 py-2 ${cores}`}
    >
      <div className="flex items-center gap-2.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5">
          <Icone className="h-3.5 w-3.5" />
        </span>
        <span>
          <p className="font-mono text-[7px] tracking-[0.12em]">{rotulo}</p>
          <strong className="mt-0.5 block text-sm leading-none text-white">
            {valor.toLocaleString("pt-BR")}
          </strong>
        </span>
      </div>
    </div>
  );
}
