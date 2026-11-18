import {
  AURA_COLORS,
  AURAS,
  FUNDOS,
  MOLDURAS,
  AURORA_DEFAULT_PRESET,
  AURORA_FULL_BODY_PRESETS,
} from "@/components/auroraVisual";

interface AuroraItemThumbProps {
  chaveVisual: string;
  filtroCor?: string | null;
  className?: string;
}

export default function AuroraItemThumb({
  chaveVisual,
  className = "",
}: AuroraItemThumbProps) {
  const fundo = FUNDOS[chaveVisual];
  const aura = AURAS[chaveVisual];
  const moldura = MOLDURAS[chaveVisual];

  if (fundo || aura || moldura) {
    const corAura = AURA_COLORS[chaveVisual];
    return (
      <div
        className={`relative isolate overflow-hidden rounded-lg bg-[#061424] ${className}`}
        style={{
          background: fundo || "#061424",
          boxShadow: moldura
            ? `inset 0 0 0 3px ${moldura}, inset 0 0 22px ${moldura}`
            : undefined,
        }}
      >
        {aura && (
          <span
            className="absolute left-1/2 top-[45%] h-[70%] w-[75%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border"
            style={{
              borderColor: corAura,
              boxShadow: `0 0 14px ${corAura}, inset 0 0 12px ${corAura}`,
            }}
          />
        )}
        <img
          src={AURORA_DEFAULT_PRESET}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-contain p-2"
          style={{ filter: aura }}
        />
      </div>
    );
  }

  const source = AURORA_FULL_BODY_PRESETS[chaveVisual];
  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-gradient-to-b from-[#0b1f33] to-[#050f1c] ${className}`}
    >
      {source && (
        <img
          src={source}
          alt=""
          aria-hidden="true"
          draggable={false}
          loading="lazy"
          decoding="async"
          className="pointer-events-none h-full w-full select-none object-contain p-1.5"
        />
      )}
    </div>
  );
}
