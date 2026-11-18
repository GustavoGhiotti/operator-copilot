import type { ArenaAuroraSlot } from "@/services/arenaApi";

const AURORA_ASSET_ROOT = "/images/arena/aurora";
const auroraAsset = (arquivo: string) => `${AURORA_ASSET_ROOT}/${arquivo}`;

/**
 * Presets completos e revisados visualmente.
 *
 * Cada entrada aponta para uma imagem de corpo inteiro pronta. O provador nunca
 * recorta, colore ou sobrepoe partes da personagem: trocar o visual substitui
 * este unico arquivo.
 */
const AURORA_PRESET_CATALOG = Object.fromEntries(
  Array.from({ length: 50 }, (_, index) => {
    const numero = String(index + 1).padStart(2, "0");
    return [
      `look-${numero}`,
      auroraAsset(`presets/aurora-look-${numero}.webp`),
    ];
  }),
);

/** Compatibilidade de leitura para partidas gravadas antes da migration 022. */
const AURORA_LEGACY_PRESETS: Record<string, string> = {
  "oculos-pulse": auroraAsset("aurora-oculos-pulse.png"),
  "oculos-solar-orbita": auroraAsset("aurora-oculos-orbita.png"),
  "bone-arena": auroraAsset("aurora-bone-arena.png"),
  "fone-neon": auroraAsset("aurora-fone-neon.png"),
  "brinco-orbita": auroraAsset("aurora-brinco-orbita.png"),
  "jaqueta-lunar": auroraAsset("aurora-jaqueta-lunar.png"),
  "moletom-cosmos": auroraAsset("aurora-moletom-cosmos.png"),
  "calca-cargo-ciano": auroraAsset("aurora-calca-cargo-ciano.png"),
  "calca-pulse-orange": auroraAsset("aurora-calca-pulse-orange.png"),
  "sandalia-holo": auroraAsset("aurora-sandalia-holo.png"),
  "tenis-casual-arena": auroraAsset("aurora-tenis-casual-arena.png"),
  "coturno-cosmos": auroraAsset("aurora-coturno-cosmos.png"),
};

export const AURORA_FULL_BODY_PRESETS: Record<string, string> = {
  ...AURORA_PRESET_CATALOG,
  ...AURORA_LEGACY_PRESETS,
};

/** Look completo gratuito usado quando nenhum preset esta equipado. */
export const AURORA_DEFAULT_PRESET = auroraAsset(
  "aurora-avatar-default-v2.png",
);

export const AURORA_CHARACTER_SLOTS: ArenaAuroraSlot[] = [
  "VISUAL",
  "CABECA",
  "OCULOS",
  "BRINCO",
  "MAQUIAGEM",
  "SUPERIOR",
  "INFERIOR",
  "CALCADO",
];

export const isAuroraCharacterSlot = (slot: ArenaAuroraSlot) =>
  AURORA_CHARACTER_SLOTS.includes(slot);

export const isAuroraPresetAvailable = (chaveVisual: string) =>
  Boolean(AURORA_FULL_BODY_PRESETS[chaveVisual]);

export const presetFromEquipped = (
  equipped: Partial<Record<ArenaAuroraSlot, string>>,
) => {
  const visual = equipped.VISUAL;
  if (visual && isAuroraPresetAvailable(visual)) return visual;

  // Compatibilidade temporaria com estados gravados antes da migration 021.
  for (const slot of AURORA_CHARACTER_SLOTS) {
    const chave = equipped[slot];
    if (chave && isAuroraPresetAvailable(chave)) return chave;
  }
  return null;
};

export const FUNDOS: Record<string, string> = {
  "fundo-estudio":
    "radial-gradient(circle at 50% 30%, rgba(56,189,248,.22), transparent 62%), #04101d",
  "fundo-arquibancada":
    "radial-gradient(circle at 50% 18%, rgba(249,115,22,.18), transparent 55%)," +
    "repeating-linear-gradient(180deg, #061424 0 6px, #08192c 6px 12px)",
  "fundo-nebulosa":
    "radial-gradient(circle at 28% 22%, rgba(139,92,246,.35), transparent 52%)," +
    "radial-gradient(circle at 72% 68%, rgba(34,211,238,.28), transparent 54%), #050c1a",
  "fundo-podio":
    "radial-gradient(circle at 50% 78%, rgba(250,204,21,.28), transparent 58%)," +
    "radial-gradient(circle at 50% 20%, rgba(249,115,22,.2), transparent 55%), #0a0f1c",
};

export const AURAS: Record<string, string> = {
  "aura-pulso":
    "drop-shadow(0 0 26px rgba(56,189,248,.55)) drop-shadow(0 0 60px rgba(56,189,248,.28))",
  "aura-chama":
    "drop-shadow(0 0 26px rgba(249,115,22,.6)) drop-shadow(0 0 64px rgba(249,115,22,.3))",
  "aura-aurora":
    "drop-shadow(0 0 22px rgba(139,92,246,.55)) drop-shadow(0 0 52px rgba(34,211,238,.45))",
  "aura-lendaria":
    "drop-shadow(0 0 26px rgba(250,204,21,.65)) drop-shadow(0 0 70px rgba(249,115,22,.4))",
};

export const AURA_COLORS: Record<string, string> = {
  "aura-pulso": "rgba(56,189,248,.9)",
  "aura-chama": "rgba(249,115,22,.9)",
  "aura-aurora": "rgba(139,92,246,.9)",
  "aura-lendaria": "rgba(250,204,21,.95)",
};

export const MOLDURAS: Record<string, string> = {
  "moldura-bronze": "rgba(180,110,60,.75)",
  "moldura-prata": "rgba(203,213,225,.8)",
  "moldura-ouro": "rgba(250,204,21,.9)",
};
