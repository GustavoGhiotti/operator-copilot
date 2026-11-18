import { useState, useEffect } from "react";

interface SimulationProgress {
  [scenario: string]: {
    lastCompleted: string;
    totalPoints: number;
    completedToday: boolean;
    bestScore: number;
  };
}

interface UserSimulationData {
  totalPoints: number;
  dailyPoints: number;
  progress: SimulationProgress;
}

export const useSimulationSystem = () => {
  const [userSimulationData, setUserSimulationData] =
    useState<UserSimulationData>({
      totalPoints: 0,
      dailyPoints: 0,
      progress: {},
    });

  const today = new Date().toDateString();

  useEffect(() => {
    const savedData = localStorage.getItem("simulationUserData");
    if (savedData) {
      const data = JSON.parse(savedData);

      const lastUpdate = localStorage.getItem("simulationLastUpdate");
      if (lastUpdate !== today) {
        data.dailyPoints = 0;
        Object.keys(data.progress).forEach((scenario) => {
          data.progress[scenario].completedToday = false;
        });
        localStorage.setItem("simulationLastUpdate", today);
      }

      setUserSimulationData(data);
    }
  }, [today]);

  const saveUserData = (data: UserSimulationData) => {
    setUserSimulationData(data);
    localStorage.setItem("simulationUserData", JSON.stringify(data));
    localStorage.setItem("simulationLastUpdate", today);
  };

  const addPoints = (scenario: string, points: number) => {
    const currentProgress = userSimulationData.progress[scenario];
    const bestScore = currentProgress
      ? Math.max(currentProgress.bestScore, points)
      : points;

    const newData = {
      ...userSimulationData,
      totalPoints: userSimulationData.totalPoints + points,
      dailyPoints: userSimulationData.dailyPoints + points,
      progress: {
        ...userSimulationData.progress,
        [scenario]: {
          lastCompleted: today,
          totalPoints: (currentProgress?.totalPoints || 0) + points,
          completedToday: true,
          bestScore: bestScore,
        },
      },
    };
    saveUserData(newData);
  };

  const isScenarioCompletedToday = (scenario: string): boolean => {
    return userSimulationData.progress[scenario]?.completedToday || false;
  };

  const getScenarioPoints = (scenario: string): number => {
    return userSimulationData.progress[scenario]?.totalPoints || 0;
  };

  const getBestScore = (scenario: string): number => {
    return userSimulationData.progress[scenario]?.bestScore || 0;
  };

  return {
    userSimulationData,
    setUserSimulationData,
    addPoints,
    isScenarioCompletedToday,
    getScenarioPoints,
    getBestScore,
  };
};
