import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Award,
  Trophy,
  Gift,
  Medal,
  Crown,
  Users,
  Calendar,
  Clock,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Reward {
  id: string;
  title: string;
  description: string;
  pointsRequired: number;
  icon: string;
  category: "monthly" | "weekly" | "daily" | "special";
  position: number; // 1º, 2º, 3º lugar
  isActive: boolean;
  currentWinner?: {
    name: string;
    points: number;
    position: number;
  };
}

interface UserRanking {
  name: string;
  points: number;
  position: number;
  progress: number;
}

const SimulationRewards: React.FC = () => {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [ranking, setRanking] = useState<UserRanking[]>([]);
  const [userPosition, setUserPosition] = useState<number>(0);
  const [userPoints, setUserPoints] = useState<number>(0);
  const [activeTab, setActiveTab] = useState("monthly");
  const [isLoading, setIsLoading] = useState(true);

  const nomeUsuario = localStorage
    .getItem("nomeCompleto")
    ?.trim()
    .toUpperCase();

  useEffect(() => {
    loadRewards();
    loadRanking();
  }, [activeTab]);

  const loadRewards = async () => {
    try {
      const response = await axios.get(
        "http:///simulacao/premiacoes",
        {
          params: { categoria: activeTab },
        }
      );
      setRewards(response.data);
    } catch (error) {
      console.error("Erro ao carregar premiações:", error);
    }
  };

  const loadRanking = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(
        "http:///simulacao/ranking-premiacoes",
        {
          params: {
            categoria: activeTab,
            nome: nomeUsuario,
          },
        }
      );

      setRanking(response.data.ranking);
      setUserPosition(response.data.userPosition);
      setUserPoints(response.data.userPoints);
    } catch (error) {
      console.error("Erro ao carregar ranking:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderIcon = (iconName: string) => {
    const icons: Record<string, JSX.Element> = {
      Trophy: <Trophy className="h-8 w-8 text-yellow-500" />,
      Award: <Award className="h-8 w-8 text-orange-500" />,
      Medal: <Medal className="h-8 w-8 text-bronze-500" />,
      Crown: <Crown className="h-8 w-8 text-purple-500" />,
      Gift: <Gift className="h-8 w-8 text-pink-500" />,
    };
    return icons[iconName] || <Award className="h-8 w-8 text-blue-500" />;
  };

  const getPositionBadge = (position: number) => {
    const badges = {
      1: {
        variant: "default" as const,
        className: "bg-yellow-500 text-white",
        text: "1º Lugar",
      },
      2: {
        variant: "secondary" as const,
        className: "bg-gray-400 text-white",
        text: "2º Lugar",
      },
      3: {
        variant: "outline" as const,
        className: "bg-orange-600 text-white",
        text: "3º Lugar",
      },
    };

    return (
      badges[position as keyof typeof badges] || {
        variant: "outline" as const,
        className: "bg-blue-500 text-white",
        text: `${position}º Lugar`,
      }
    );
  };

  const getCategoryInfo = (category: string) => {
    const info = {
      monthly: {
        title: "Prêmios Mensais",
        icon: <Calendar className="h-5 w-5" />,
        desc: "Competição mensal",
      },
      weekly: {
        title: "Prêmios Semanais",
        icon: <Users className="h-5 w-5" />,
        desc: "Competição semanal",
      },
      daily: {
        title: "Prêmios Diários",
        icon: <Clock className="h-5 w-5" />,
        desc: "Competição diária",
      },
      special: {
        title: "Prêmios Especiais",
        icon: <Gift className="h-5 w-5" />,
        desc: "Eventos especiais",
      },
    };

    return info[category as keyof typeof info] || info.monthly;
  };

  if (isLoading) {
    return (
      <div className="py-16 flex justify-center items-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 border-2 border-t-transparent border-blue-500 rounded-full animate-spin"></div>
          <p className="text-sm text-gray-500">Carregando premiações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status do Usuário */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 dark:text-black">
            <Trophy className="h-5 w-5 text-yellow-600" />
            Sua Posição no Ranking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-blue-600">
                {userPosition}º
              </p>
              <p className="text-sm text-gray-600">Posição Atual</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{userPoints}</p>
              <p className="text-sm text-gray-600">Pontos Totais</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-600">
                {rewards.length > 0 && userPosition <= rewards.length
                  ? userPosition
                  : "N/A"}
              </p>
              <p className="text-sm text-gray-600">Premiação</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs para diferentes categorias */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="monthly">Mensal</TabsTrigger>
          <TabsTrigger value="weekly">Semanal</TabsTrigger>
          <TabsTrigger value="daily">Diário</TabsTrigger>
          <TabsTrigger value="special">Especial</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          <div className="space-y-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                {getCategoryInfo(activeTab).icon}
                <h3 className="text-xl font-semibold">
                  {getCategoryInfo(activeTab).title}
                </h3>
              </div>
              <p className="text-gray-600">{getCategoryInfo(activeTab).desc}</p>
            </div>

            {/* Lista de Prêmios */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rewards.map((reward) => {
                const positionBadge = getPositionBadge(reward.position);

                return (
                  <Card key={reward.id} className="relative overflow-hidden">
                    <CardHeader className="text-center pb-4">
                      <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-50 to-purple-50 rounded-full flex items-center justify-center mb-3">
                        {renderIcon(reward.icon)}
                      </div>
                      <div className="space-y-2">
                        <Badge
                          variant={positionBadge.variant}
                          className={positionBadge.className}
                        >
                          {positionBadge.text}
                        </Badge>
                        <CardTitle className="text-lg">
                          {reward.title}
                        </CardTitle>
                        <CardDescription className="text-sm">
                          {reward.description}
                        </CardDescription>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <div className="text-center">
                        <p className="text-sm text-gray-600 mb-2">
                          Pontos necessários:
                        </p>
                        <p className="text-xl font-bold text-blue-600">
                          {reward.pointsRequired}
                        </p>
                      </div>

                      {reward.currentWinner && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <p className="text-sm font-medium text-green-800 mb-1">
                            Líder atual:
                          </p>
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-green-700">
                              {reward.currentWinner.name}
                            </p>
                            <p className="text-sm font-bold text-green-800">
                              {reward.currentWinner.points} pts
                            </p>
                          </div>
                        </div>
                      )}

                      {!reward.currentWinner && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                          <p className="text-sm font-medium text-yellow-800 mb-1">
                            Mais bem colocado até agora:
                          </p>
                          {ranking.length >= reward.position ? (
                            <div className="flex items-center justify-between">
                              <p className="text-sm text-yellow-700">
                                {ranking[reward.position - 1].name}
                              </p>
                              <p className="text-sm font-bold text-yellow-800">
                                {ranking[reward.position - 1].points} pts
                              </p>
                            </div>
                          ) : (
                            <p className="text-sm text-yellow-700">
                              Sem candidatos na posição {reward.position} ainda
                            </p>
                          )}
                        </div>
                      )}

                      {/* Progress do usuário para este prêmio */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Seu progresso:</span>
                          <span className="font-medium">
                            {Math.min(userPoints, reward.pointsRequired)} /{" "}
                            {reward.pointsRequired}
                          </span>
                        </div>
                        <Progress
                          value={Math.min(
                            (userPoints / reward.pointsRequired) * 100,
                            100
                          )}
                          className="w-full h-2"
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {rewards.length === 0 && (
              <div className="text-center py-12">
                <Gift className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Nenhuma premiação disponível
                </h3>
                <p className="text-gray-600">
                  Não há premiações configuradas para esta categoria no momento.
                </p>
              </div>
            )}

            {/* Top 3 do Ranking Atual */}
            {ranking.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Top 10 - {getCategoryInfo(activeTab).title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {ranking.slice(0, 10).map((user, index) => (
                      <div
                        key={index}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          user.name === nomeUsuario
                            ? "bg-blue-50 border border-blue-200"
                            : "bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                              index === 0
                                ? "bg-yellow-500 text-white"
                                : index === 1
                                ? "bg-gray-400 text-white"
                                : index === 2
                                ? "bg-orange-600 text-white"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {index + 1}
                          </div>
                          <div>
                            <p
                              className={`font-medium ${
                                user.name === nomeUsuario
                                  ? "text-blue-800"
                                  : "text-gray-900"
                              }`}
                            >
                              {user.name}{" "}
                              {user.name === nomeUsuario && "(Você)"}
                            </p>
                            <p className="text-sm text-gray-600">
                              {user.points} pontos
                            </p>
                          </div>
                        </div>

                        {index < 3 && (
                          <Badge
                            variant={getPositionBadge(index + 1).variant}
                            className={getPositionBadge(index + 1).className}
                          >
                            {getPositionBadge(index + 1).text}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SimulationRewards;
