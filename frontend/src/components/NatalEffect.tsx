import React, { useState, useEffect } from "react";
import {loadTree} from "@/components/ui/natal/loadTree"

/* --------------------------- COMPONENTES BASE --------------------------- */

// ❄ Floco de neve com layers de profundidade
const Snowflake = ({ size = 12, speed = 8, delay = 0 }) => (
  <div
    className="absolute text-white opacity-90 drop-shadow-[0_0_8px_rgba(255,255,255,0.7)] animate-snowfall"
    style={{
      left: `${Math.random() * 100}%`,
      top: `-${Math.random() * 20}%`,
      fontSize: size,
      animationDuration: `${speed}s`,
      animationDelay: `${delay}s`,
    }}
  >{loadTree ? "❄" : ""}    
  </div>
);

// 🎄 Árvore estilizada com iluminação
const ChristmasTree = () => (
  <div className="relative scale-[1.4] select-none">
    <div className="text-5xl drop-shadow-[0_0_12px_rgba(0,255,120,0.5)]">
      🎄
    </div>
  </div>
);

// 🎅 Papai noel voando com rastro mágico
const Santa = () => (
  <div className="relative">
    <div className="text-6xl animate-bounce-slow">🎅</div>
    <div className="absolute left-[-60px] top-4 w-[60px] h-2 bg-gradient-to-r from-red-400/60 to-transparent blur-md animate-trail" />
  </div>
);

// 🎁 Presente animado mais suave
const Gift = () => (
  <div className="text-5xl animate-gift-wiggle drop-shadow-[0_0_6px_rgba(255,0,0,0.5)] select-none">
    🎁
  </div>
);

const Stocking = () => (
  <div className="relative text-5xl animate-stock-swing drop-shadow-[0_0_6px_rgba(255,0,0,0.4)] select-none">
    🧦
    <div className="absolute top-[6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-red-400/70 rounded-full blur-[2px] animate-soft-glow" />
  </div>
);

const Reindeer = () => (
  <div className="relative text-6xl select-none">
    🦌
    <div className="absolute left-[22px] top-[14px] w-2 h-2 bg-red-500 rounded-full animate-rudolph-glow blur-[1px]" />
  </div>
);

const ElfRunner = () => (
  <div className="elf-runner">
    <div className="elf">
      <div className="hat" />
      <div className="head" />
      <div className="body" />
      <div className="arm arm-left" />
      <div className="arm arm-right" />
      <div className="leg leg-left" />
      <div className="leg leg-right" />
    </div>
  </div>
);

/* --------------------------- EFEITO PRINCIPAL --------------------------- */

export default function ChristmasEffect() {
  const [surprise, setSurprise] = useState<"tree" | "gift" | "santa" | null>(
    null
  );

  useEffect(() => {
    const sequence = ["tree", "gift", "santa"] as const;
    let current = 0;

    const trigger = () => {
      setSurprise(sequence[current]);
      current = (current + 1) % sequence.length;

      setTimeout(() => setSurprise(null), 3500);
    };

    const first = setTimeout(trigger, 7000);
    const interval = setInterval(trigger, 100000);

    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden select-none">
      {/* --------------------------- NEVE EM 3 CAMADAS --------------------------- */}
      {[...Array(25)].map((_, i) => (
        <Snowflake
          key={`snow-front-${i}`}
          size={12 + Math.random() * 6}
          speed={6 + Math.random() * 4}
          delay={Math.random() * 4}
        />
      ))}

      {[...Array(15)].map((_, i) => (
        <Snowflake
          key={`snow-mid-${i}`}
          size={10}
          speed={10}
          delay={Math.random() * 4}
        />
      ))}

      {[...Array(10)].map((_, i) => (
        <Snowflake
          key={`snow-back-${i}`}
          size={8}
          speed={14}
          delay={Math.random() * 4}
        />
      ))}

      {/* --------------------------- DECORAÇÕES FIXAS --------------------------- */}
      <div className="absolute top-4 left-4">
        <ChristmasTree />
      </div>

      <div className="absolute top-4 right-4">
        <Stocking />
      </div>

      <div className="absolute bottom-4 left-4">
        <Gift />
      </div>

      <div className="absolute bottom-4 right-4">
        <Reindeer />
      </div>

      {/* --------------------------- PAPAI NOEL VOANDO --------------------------- */}
      <div
        className="absolute top-24 animate-santa-fly"
        style={{ animationDuration: "14s" }}
      >
        <Santa />
      </div>

      {/* --------------------------- SURPRESAS SUAVES --------------------------- */}
      {surprise === "tree" && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-surprise-pop">
          <ChristmasTree />
        </div>
      )}

      {surprise === "gift" && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 animate-surprise-bounce">
          <Gift />
        </div>
      )}

      {surprise === "santa" && (
        <div className="absolute top-1/2 right-0 -translate-y-1/2 animate-surprise-slide-left">
          <Santa />
        </div>
      )}
    </div>
  );
}
