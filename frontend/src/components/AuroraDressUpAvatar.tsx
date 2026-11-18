import {
  AURAS,
  FUNDOS,
  MOLDURAS,
  presetFromEquipped,
  AURORA_DEFAULT_PRESET,
  AURORA_FULL_BODY_PRESETS,
} from "@/components/auroraVisual";
import type { ArenaAuroraSlot } from "@/services/arenaApi";

interface AuroraDressUpAvatarProps {
  equipped?: Partial<Record<ArenaAuroraSlot, string>>;
  /** Mantido no contrato durante a migracao; presets completos nao usam filtro. */
  filtros?: Partial<Record<ArenaAuroraSlot, string>>;
  semPalco?: boolean;
  className?: string;
}

export default function AuroraDressUpAvatar({
  equipped = {},
  semPalco = false,
  className = "",
}: AuroraDressUpAvatarProps) {
  const preset = presetFromEquipped(equipped);
  const source = preset
    ? AURORA_FULL_BODY_PRESETS[preset]
    : AURORA_DEFAULT_PRESET;
  const fundo = semPalco ? undefined : FUNDOS[equipped.FUNDO || ""];
  const aura = semPalco ? undefined : AURAS[equipped.AURA || ""];
  const moldura = semPalco ? undefined : MOLDURAS[equipped.MOLDURA || ""];

  return (
    <div
      role="img"
      aria-label="Aurora em visual completo"
      className={`relative isolate overflow-hidden ${className}`}
      style={{
        background: fundo,
        borderRadius: moldura ? "1.25rem" : undefined,
        boxShadow: moldura
          ? `inset 0 0 0 2px ${moldura}, 0 0 24px ${moldura}`
          : undefined,
      }}
    >
      <img
        src={source}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="pointer-events-none block h-full w-full select-none object-contain"
        style={{ filter: aura }}
      />
    </div>
  );
}
