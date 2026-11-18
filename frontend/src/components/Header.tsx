import React, { useEffect, useState } from "react";
import { Bell, Calculator, CalendarFold } from "lucide-react";
import AuthButton from "./AuthButton";
import Calendario from "./Calendario";
import Calculadora from "./Calculadora";
import { useTheme } from "@/context/ThemeContext"; // <-- seu contexto
import { Button } from "./ui/button";
import { Menu } from "lucide-react";
import { Sheet, SheetTrigger, SheetContent } from "@/components/ui/sheet";

interface HeaderProps {
  onChristmasClick?: () => void;
  onEstatisticasClick?: () => void;
  onAlbumClick?: () => void;
  visualVariant?: "default" | "aurora";
}

const Header: React.FC<HeaderProps> = ({
  onChristmasClick,
  onEstatisticasClick,
  visualVariant = "default",
}) => {
  const [calendarioAberto, setCalendarioAberto] = useState(false);
  const [calculadoraAberta, setCalculadoraAberta] = useState(false);
  const { isDarkMode } = useTheme(); // <-- usa seu contexto
  const [mounted, setMounted] = useState(false);
  // const Natal = ["BANCOALFA FIXA", "BANCOALFA VARIAVEL"].includes(
  //   (localStorage.getItem("centroCusto") || "").trim().toUpperCase()
  // );

  useEffect(() => {
    setMounted(true);
  }, []);

  const logoSrc =
    visualVariant === "aurora" || isDarkMode
      ? "/images/AcmeLogoBranco.png"
      : "/images/AcmeLogo.png";

  return (
    <header
      className={`w-full transition-all duration-300 ${
        visualVariant === "aurora"
          ? "absolute inset-x-0 top-0 z-40 bg-transparent text-white shadow-none backdrop-blur-none"
          : "relative z-10 border-gray-200 backdrop-blur-md dark:border-gray-800 shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_18px_rgba(0,0,0,0.35)]"
      }`}
    >
      {/* Linha luminosa superior */}
      <div
        className={`w-full h-[2px] bg-gradient-to-r ${
          visualVariant === "aurora"
            ? "from-transparent via-transparent to-transparent"
            : "from-orange-500/40 via-yellow-400/40 to-primary/40 dark:from-orange-300/30 dark:via-yellow-200/30 dark:to-white/20"
        }`}
      />

      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        {/* LOGO */}
        <div className="flex items-center space-x-2">
          {mounted && (
            <img
              src={logoSrc}
              alt="Logo"
              className={`h-full object-contain transition-all duration-500 hover:scale-[1.02] ${
                visualVariant === "aurora"
                  ? "w-40 drop-shadow-[0_0_12px_rgba(111,195,255,0.25)]"
                  : "w-60 hover:drop-shadow-[0_4px_12px_rgba(255,150,60,0.4)]"
              }`}
            />
          )}
        </div>

        {/* AÇÕES */}
        <Sheet>
          <div className="flex items-center gap-3">
            {/* <div> */}
            {/* Calendario */}
            {/* <Button
                type="button"
                variant="ghost"
                size="xlIcon"
                onClick={() => setCalendarioAberto((estadoAtual) => !estadoAtual)}
                className="
                  hover:bg-gray-200/50 dark:hover:bg-gray-800/40
                  rounded-lg transition-all duration-200
                "
              >
                <CalendarFold className="z-[9999]" />
              </Button>

              {calendarioAberto && (
                <Calendario onClose={() => setCalendarioAberto(false)} />
              )}

            {/* Calculadora */}
            {/* <Button
                type="button"
                variant="ghost"
                size="xlIcon"
                onClick={() => setCalculadoraAberta((estadoAtual) => !estadoAtual)}
                className="
                  hover:bg-gray-200/50 dark:hover:bg-gray-800/40
                  rounded-lg transition-all duration-200
                "
              >
                <Calculator />
              </Button>

              {calculadoraAberta && (
                <Calculadora onClose={() => setCalculadoraAberta(false)} />
              )}
            </div>

            {/* Dark mode */}
            {/* Christmas Icon */}
            {/* <Button
              variant="ghost"
              size="icon"
              onClick={onChristmasClick}
              className="
            p-2 rounded-full 
            hover:bg-red-100 dark:hover:bg-red-900/30 
            transition-all duration-200 
            relative group
            shadow-sm
          "
              title="Árvore de Natal"
            >
              <div className="animate-bounce">
                <span className="text-2xl group-hover:scale-110 transition-transform inline-block">
                  🎅
                </span>
              </div>

              <div
                className="
            absolute -top-1 -right-1 w-3 h-3 
            bg-red-500 rounded-full 
            animate-pulse 
            shadow-[0_0_6px_rgba(255,0,0,0.9)]
          "
              />
            </Button> */}
            {/* <Button
              variant="ghost"
              size="icon"
              onClick={onAlbumClick}
              className="p-2 rounded-full hover:bg-yellow-100 dark:hover:bg-yellow-900/20 transition-colors group relative"
              title="Álbum Copa 2026"
            >
              <span className="text-2xl group-hover:scale-110 transition-transform inline-block">
                🏆
              </span>
            </Button> */}

            {/* Album action removed from the streamlined header.
              <Button
                variant="ghost"
                size="icon"
                onClick={onAlbumClick}
                className="p-2 rounded-full hover:bg-yellow-100 dark:hover:bg-yellow-900/20 transition-colors group relative"
                title="Álbum Copa 2026"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform inline-block">
                  🏆
                </span>
              </Button>
            )}
            */}

            {/* Menu Hamburguer */}
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="xlIcon"
                className="
              hover:bg-gray-200/50 dark:hover:bg-gray-800/40 
              rounded-lg transition-all duration-200
            "
              >
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
          </div>

          {/* MENU LATERAL */}
          <SheetContent
            side="right"
            overlayClassName={
              visualVariant === "aurora"
                ? "z-[44] bg-[#010711]/45 backdrop-blur-[2px]"
                : "z-[44]"
            }
            className={`z-[45] w-[400px] sm:w-[460px] p-0 overflow-hidden backdrop-blur-xl rounded-l-xl shadow-2xl animate-fade-in ${
              visualVariant === "aurora"
                ? "copilot-quick-menu border-l border-blue-300/[0.08]"
                : "border-l border-gray-300 dark:border-gray-700"
            }`}
          >
            <div className="flex flex-col h-full">
              {/* Cabeçalho */}
              <div
                className={`relative flex items-center justify-between overflow-hidden border-b px-6 py-5 ${
                  visualVariant === "aurora"
                    ? "border-blue-300/[0.08] bg-black/10"
                    : "bg-gray-50/50 dark:bg-gray-800/40 dark:border-slate-700"
                }`}
              >
                {visualVariant === "aurora" && (
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-300/70 to-transparent" />
                )}
                <div className="flex items-center gap-3">
                  <div
                    className={`rounded-xl p-2 ${
                      visualVariant === "aurora"
                        ? "border border-blue-300/20 bg-blue-300/[0.08] shadow-[0_0_18px_rgba(34,211,238,0.12)]"
                        : ""
                    }`}
                  >
                    <Menu
                      className={`h-5 w-5 ${
                        visualVariant === "aurora"
                          ? "text-blue-200"
                          : "text-blue-600 dark:text-blue-300"
                      }`}
                    />
                  </div>
                  {visualVariant === "aurora" && (
                    <span className="copilot-quick-menu__eyebrow absolute left-[4.75rem] top-3.5">
                      SYSTEM / QUICK ACCESS
                    </span>
                  )}
                  <span
                    className={`font-semibold text-lg ${
                      visualVariant === "aurora"
                        ? "mt-3 tracking-wide text-white"
                        : "text-slate-800 dark:text-white"
                    }`}
                  >
                    Menu Rápido
                  </span>
                </div>
              </div>

              {/* Conteúdo */}
              <div
                className={`flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin ${
                  visualVariant === "aurora"
                    ? "bg-transparent scrollbar-thumb-blue-900"
                    : "scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600"
                }`}
              >
                <AuthButton
                  isInsideHamburguer={true}
                  visualVariant={visualVariant}
                />
              </div>

              {/* Rodapé */}
              <div
                className={`border-t px-6 py-4 text-xs ${
                  visualVariant === "aurora"
                    ? "border-blue-300/10 bg-blue-300/[0.02] uppercase tracking-[0.2em] text-orange-500 drop-shadow-2xl shadow-orange-600"
                    : "text-muted-foreground dark:border-slate-700 dark:text-gray-400"
                }`}
              >
                Copilot Acme
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
};

export default Header;
