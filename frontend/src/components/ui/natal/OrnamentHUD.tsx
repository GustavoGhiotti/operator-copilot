import React from "react";

interface OrnamentHUDProps {
  ORNAMENTS_CONFIG: {
    id: string;
    label: string;
    path: string;
    scale: number;
  }[];

  ornamentThumbs: Record<string, string>;

  ornamentsLeft: number;

  onStartDrag: (id: string, e: React.PointerEvent<HTMLButtonElement>) => void;
}

export default function OrnamentHUD({
  ORNAMENTS_CONFIG,
  ornamentThumbs,
  ornamentsLeft,
  onStartDrag,
}: OrnamentHUDProps) {
  return (
    <div
      className="fixed top-4 right-10 flex flex-col gap-3 pointer-events-none"
      style={{ zIndex: 60 }}
    >
      {ORNAMENTS_CONFIG.map((ornament) => (
        <button
          key={ornament.id}
          className="pointer-events-auto bg-slate-900/80 text-white text-xs px-2 py-2 rounded-md border border-slate-600 hover:bg-slate-800 transition flex flex-col items-center w-24"
          onPointerDown={(e) => {
            if (ornamentsLeft <= 0) return;
            onStartDrag(ornament.id, e);
          }}
        >
          <div className="w-14 h-14 mb-1 bg-slate-800/80 rounded-md flex items-center justify-center overflow-hidden">
            {ornamentThumbs[ornament.id] ? (
              <img
                src={ornamentThumbs[ornament.id]}
                alt={ornament.label}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                }}
              />
            ) : (
              <span className="text-[10px] text-slate-300">Carregando</span>
            )}
          </div>

          <div className="text-[10px] text-slate-100 text-center leading-tight">
            {ornament.label}
            <br />
            {ornamentsLeft}
          </div>
        </button>
      ))}
    </div>
  );
}
