import React, { useEffect, useState } from "react";
import Confetti from "react-confetti";
import { useWindowSize } from "react-use";

const ConfettiEffect: React.FC<{ show: boolean }> = ({ show }) => {
  const { width, height } = useWindowSize();
  const [visible, setVisible] = useState(show);

  const username = localStorage.getItem("nomeCompleto") ?? "Operador";


  useEffect(() => {
    if (show) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 6000); // mensagem some após 6s
      return () => clearTimeout(timer);
    }
  }, [show]);

  if (!visible) return null;

  return (
    <>
      <Confetti
        width={width}
        height={height}
        numberOfPieces={250}
        recycle={false}
        run={true}
        style={{
          zIndex: 9999,
          position: "fixed",
          top: 0,
          left: 0,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          zIndex: 10000,
          position: "fixed",
          top: "20px",
          left: "50%",
          transform: "translateX(-50%)", 
          backgroundColor: "#4ade80", // verde sucesso
          color: "#1f2937", // gray-800
          padding: "16px 32px",
          borderRadius: "12px",
          fontWeight: "600",
          fontSize: "1.2rem",
          boxShadow: "0 8px 20px rgba(0, 0, 0, 0.15)",
          animation: "fadeInUp 0.4s ease-out",
        }}
      >
        🎉 Parabéns, {username}! Você bateu o ideal do mês! 🚀
      </div>

      {/* animação CSS */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translate(-50%, -20px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
      `}</style>
    </>
  );
};

export default ConfettiEffect;
