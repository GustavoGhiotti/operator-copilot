import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "@/utils/axiosInstance";

const useIdleLogout = (timeout = 60 * 1000) => {
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);
  const warningTimeout = 60 * 1000;
  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const logout = async () => {
      try {
        await axiosInstance.post("/api/auth/logout"); // ✅ registra no backend
      } catch (error) {
        console.warn("Erro ao registrar logout no backend:", error);
      } finally {
        localStorage.clear();
        navigate("/login");
      }
    };

    const resetTimers = () => {
      if (logoutTimer.current) clearTimeout(logoutTimer.current);
      if (warningTimer.current) clearTimeout(warningTimer.current);
      setShowWarning(false);

      warningTimer.current = setTimeout(() => {
        setShowWarning(true);
      }, timeout - warningTimeout);

      logoutTimer.current = setTimeout(() => {
        logout();
      }, timeout);
    };

    const events = ["mousemove", "keydown", "mousedown", "touchstart"];
    events.forEach((event) => window.addEventListener(event, resetTimers));

    resetTimers(); // inicializa contadores

    return () => {
      if (logoutTimer.current) clearTimeout(logoutTimer.current);
      if (warningTimer.current) clearTimeout(warningTimer.current);
      events.forEach((event) => window.removeEventListener(event, resetTimers));
    };
  }, [navigate, timeout]);

  // Retorna estado para exibir alerta se quiser mostrar no App
  return { showWarning };
};

export default useIdleLogout;
