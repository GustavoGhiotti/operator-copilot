import { useState, useEffect } from "react";
import axios from "axios";

interface QuizProgress {
  [theme: string]: {
    lastCompleted: string;
    totalPoints: number;
    completedToday: boolean;
  };
}

interface UserQuizData {
  totalPoints: number;
  dailyPoints: number;
  progress: QuizProgress;
}

export const useQuizSystem = () => {
  const [userQuizData, setUserQuizData] = useState<UserQuizData>({
    totalPoints: 0,
    dailyPoints: 0,
    progress: {},
  });

  const today = new Date().toDateString();

  useEffect(() => {
    const nome = localStorage.getItem("nomeCompleto")?.trim().toUpperCase();
    if (!nome) return;

    axios
      .get("/api/quiz/pontuacao_total", {
        params: { usuario: nome },
      })
      .then((res) => {
        const data = res.data;
        const progress: QuizProgress = {};

        Object.entries(data.porTema).forEach(([idTema, pontos]) => {
          progress[idTema] = {
            totalPoints: pontos,
            completedToday: true,
            lastCompleted: today,
          };
        });

        setUserQuizData({
          totalPoints: data.totalPoints,
          dailyPoints: data.dailyPoints,
          progress,
        });
      })
      .catch((err) => {
        console.error("Erro ao carregar pontuação:", err);
      });
  }, [today]);

  const addPoints = (theme: string, points: number) => {
    // Removido uso do localStorage, pontuação deve vir do backend
  };

  const isThemeCompletedToday = (theme: string): boolean => {
    return userQuizData.progress[theme]?.completedToday || false;
  };

  const getThemePoints = (theme: string): number => {
    return userQuizData.progress[theme]?.totalPoints || 0;
  };

  return {
    userQuizData,
    setUserQuizData,
    addPoints,
    isThemeCompletedToday,
    getThemePoints,
  };
};
