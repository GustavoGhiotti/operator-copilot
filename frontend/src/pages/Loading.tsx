import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const Loading = () => {
  const [progress, setProgress] = useState(0);
  const navigate = useNavigate();
  const userName = localStorage.getItem("userName") || "Usuário";
  const isAdmin = localStorage.getItem("userIsAdmin") === "true";
  const isGerente = localStorage.getItem("userIsGerente") === "true";

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prevProgress) => {
        if (prevProgress >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            // ✅ Hierarquia de acesso
            if (isGerente) {
              navigate("/gerente");
            } else if (isAdmin) {
              navigate("/admin");
            } else {
              navigate("/home");
            }

            // Força recarregar componentes após o navigate
            setTimeout(() => {
              window.location.reload();
            }, 100);
          }, 500);

          return 100;
        }
        return prevProgress + 5;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [navigate, isAdmin, isGerente]);

  return (
    <div
      className="
    min-h-screen flex flex-col items-center justify-center 
    px-4 relative overflow-hidden 
    bg-gradient-to-b from-gray-900 via-gray-800 to-black
    dark:from-black dark:via-gray-900 dark:to-gray-950
    text-white
  "
    >
      {/* BRILHOS DE FUNDO */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute w-72 h-72 bg-primary/30 blur-[100px] top-10 left-10 animate-pulse-slow" />
        <div className="absolute w-96 h-96 bg-purple-700/20 blur-[140px] bottom-10 right-10 animate-pulse-slower" />
      </div>

      {/* CONTEÚDO */}
      <div className="relative z-10 text-center max-w-md animate-fade-up">
        {/* LOGO */}
        <img
          src="./images/AcmeLogoBranco.png"
          alt="Acme Logo"
          className="object-cover h-auto mx-auto mb-10 drop-shadow-[0_0_20px_rgba(255,255,255,0.8)] animate-soft-glow"
        />

        {/* TÍTULO */}
        <h1 className="text-3xl font-bold tracking-tight mb-6">
          Bem-vindo(a), <span className="text-primary">{userName}</span>
        </h1>

        {/* LOADER CÍRCULO PERSONALIZADO */}
        <div className="flex justify-center mb-8">
          <div className="w-14 h-14 border-4 border-primary/30 border-t-primary rounded-full animate-spin-smooth" />
        </div>

        {/* PROGRESSO */}
        <div className="w-full max-w-md mx-auto mb-4">
          <Progress
            value={progress}
            className="h-2 bg-white/10 border border-white/20 rounded-full overflow-hidden"
          />
          <p className="text-sm text-gray-300 mt-2">
            Carregando recursos... {progress}%
          </p>
        </div>

        <p className="text-gray-400 tracking-wide">
          Preparando seu ambiente de trabalho...
        </p>
      </div>
    </div>
  );
};

export default Loading;
