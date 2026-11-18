import { useEffect, useRef, useState } from "react";
import useIdleLogout from "@/hooks/useIdleLogout";
import axiosInstance from "@/utils/axiosInstance";
import { sincronizarAreas } from "@/services/permissaoApi";

const SessionWatcher = () => {
  const warningTime = 60; // segundos
  const idleTimeout = 60 * 60 * 1000;
  const refreshInterval = 45 * 60 * 1000;
  const activeWindow = 5 * 60 * 1000;
  const { showWarning } = useIdleLogout(idleTimeout);
  const nomeCompleto = localStorage.getItem("nomeCompleto") || "Operador";
  const primeiroNome = nomeCompleto.split(" ")[0];

  const [remainingTime, setRemainingTime] = useState(warningTime);
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (showWarning) {
      setRemainingTime(warningTime);
      interval = setInterval(() => {
        setRemainingTime((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [showWarning]);

  // Revalida as areas na abertura. O login as grava no localStorage e elas
  // congelam ate a pessoa sair: sem isto, uma concessao dada hoje so valeria
  // no proximo login, e quem ja estava logado quando esta versao subiu ficaria
  // sem a chave `userAreas` -- e sem os comandos que dependem dela.
  useEffect(() => {
    void sincronizarAreas();
  }, []);

  useEffect(() => {
    const updateLastActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const events = ["mousemove", "keydown", "mousedown", "touchstart"];
    events.forEach((event) =>
      window.addEventListener(event, updateLastActivity),
    );

    const interval = setInterval(
      async () => {
        const token = localStorage.getItem("userToken");
        if (!token) return;

        const userIsActive = Date.now() - lastActivityRef.current <= activeWindow;
        if (!userIsActive) return;

        try {
          const response = await axiosInstance.post("/api/auth/refresh");
          localStorage.setItem("userToken", response.data.token);
        } catch (error) {
          console.warn("Erro ao renovar token:", error);
        }
      },
      refreshInterval,
    );

    return () => {
      clearInterval(interval);
      events.forEach((event) =>
        window.removeEventListener(event, updateLastActivity),
      );
    };
  }, []);

  const progressPercent = (remainingTime / warningTime) * 100;

  const getColor = () => {
    if (remainingTime <= 10) return "bg-red-500";
    if (remainingTime <= 30) return "bg-orange-400";
    return "bg-yellow-400";
  };

  return showWarning ? (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 w-[90%] max-w-md">
      <div className="bg-yellow-100 border border-yellow-300 text-yellow-900 rounded-lg shadow-lg p-4 relative">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">⚠️ Atenção!</p>
            <p className="text-sm">
              {primeiroNome}, você será desconectado(a) por inatividade em
              <span className="text-red-600 font-bold animate-pulse ml-1">
                {remainingTime}s
              </span>
              .
            </p>
            <p className="text-xs text-yellow-800 mt-1">
              Mova o mouse ou pressione uma tecla para continuar logado.
            </p>
          </div>
        </div>

        {/* Barra de progresso */}
        <div className="w-full h-2 mt-4 bg-yellow-200 rounded overflow-hidden">
          <div
            className={`h-full ${getColor()} transition-all duration-500`}
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>
      </div>
    </div>
  ) : null;
};

export default SessionWatcher;
