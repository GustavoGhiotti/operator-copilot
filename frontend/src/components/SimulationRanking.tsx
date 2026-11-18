import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Trophy,
  Medal,
  Award,
  Users,
  Calendar,
  Clock,
  TrendingUp,
  GamepadIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/ui/loading";

interface RankingUser {
  nome: string;
  pontos: number;
  posicao: number;
}

interface RankingData {
  dia: RankingUser[];
  semana: RankingUser[];
  mes: RankingUser[];
}

const SimulationRanking: React.FC = () => {
  const [rankingData, setRankingData] = useState<RankingData>({
    dia: [],
    semana: [],
    mes: [],
  });
  const [selectedPeriod, setSelectedPeriod] = useState<
    "dia" | "semana" | "mes"
  >("dia");
  const [loading, setLoading] = useState(false);

  const currentUser = localStorage
    .getItem("nomeCompleto")
    ?.trim()
    .toUpperCase();

  // Dados simulados para demonstração
  useEffect(() => {
    setLoading(true);
    const fetchRanking = async () => {
      try {
        const periods = ["dia", "semana", "mes"];
        const nome = localStorage.getItem("nomeCompleto")?.trim().toUpperCase();
        const data: RankingData = { dia: [], semana: [], mes: [] };

        for (const periodo of periods) {
          const res = await axios.get(
            `http:///simulacao/ranking`,
            {
              params: { periodo, nome },
            }
          );
          data[periodo] = res.data;
        }

        setRankingData(data);
      } catch (err) {
        console.error("Erro ao buscar ranking:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchRanking();
  }, []);

  const getRankIcon = (position: number) => {
    switch (position) {
      case 1:
        return <Trophy className="h-6 w-6 text-yellow-500" />;
      case 2:
        return <Medal className="h-6 w-6 text-gray-400" />;
      case 3:
        return <Award className="h-6 w-6 text-amber-600" />;
      default:
        return (
          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
            {position}
          </div>
        );
    }
  };

  const getPeriodLabel = (period: string) => {
    switch (period) {
      case "dia":
        return "Hoje";
      case "semana":
        return "Esta Semana";
      case "mes":
        return "Este Mês";
      default:
        return period;
    }
  };

  const getPeriodIcon = (period: string) => {
    switch (period) {
      case "dia":
        return <Clock className="h-4 w-4" />;
      case "semana":
        return <Calendar className="h-4 w-4" />;
      case "mes":
        return <TrendingUp className="h-4 w-4" />;
      default:
        return <Users className="h-4 w-4" />;
    }
  };

  const currentRankingRaw = rankingData[selectedPeriod];

  // Mapeia os nomes dos outros usuários como "Operador 1", "Operador 2", etc.
  const currentRanking = currentRankingRaw.map((user, index) => {
    const isCurrentUser = user.nome.toUpperCase() === currentUser;
    return {
      ...user,
      nomeExibicao: isCurrentUser ? user.nome : `Operador ${index + 1}`,
    };
  });
  const userPosition = currentRanking.find(
    (user) => user.nomeExibicao.toUpperCase() === currentUser
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <Loading
          variant="working"
          size="md"
          text="Carregando ranking..."
          className="w-full py-8"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header do Ranking */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          🎭 Ranking de Simulação
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          Veja como você está se saindo nas simulações de atendimento!
        </p>
      </div>

      {/* Seletor de Período */}
      <div className="flex justify-center">
        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          {["dia", "semana", "mes"].map((period) => (
            <Button
              key={period}
              variant={selectedPeriod === period ? "default" : "ghost"}
              size="sm"
              onClick={() =>
                setSelectedPeriod(period as "dia" | "semana" | "mes")
              }
              className="flex items-center gap-2"
            >
              {getPeriodIcon(period)}
              {getPeriodLabel(period)}
            </Button>
          ))}
        </div>
      </div>

      {/* Sua Posição Atual */}
      {userPosition && (
        <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <GamepadIcon className="h-5 w-5 text-purple-600" />
              Sua Posição ({getPeriodLabel(selectedPeriod)})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getRankIcon(userPosition.posicao)}
                <div>
                  <p className="font-semibold text-gray-900">
                    {userPosition.nome}
                  </p>
                  <p className="text-sm text-gray-600">Você está aqui!</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-purple-600">
                  {userPosition.pontos}
                </div>
                <p className="text-sm text-gray-600">pontos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista do Ranking */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-600" />
            Top Negociadores - {getPeriodLabel(selectedPeriod)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {currentRanking.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <GamepadIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum dado de ranking disponível para este período.</p>
              <p className="text-sm">
                Complete algumas simulações para aparecer no ranking!
              </p>
            </div>
          ) : (
            currentRanking.slice(0, 10).map((user, index) => {
              const isCurrentUser = user.nome.toUpperCase() === currentUser;

              return (
                <div
                  key={`${user.nomeExibicao}-${index}`}
                  className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                    isCurrentUser
                      ? "bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800"
                      : "bg-gray-50 border-gray-200 dark:bg-gray-700 dark:border-gray-600"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {getRankIcon(user.posicao)}
                    <div>
                      <p
                        className={`font-medium ${
                          isCurrentUser
                            ? "text-purple-900 dark:text-purple-100"
                            : "text-gray-900 dark:text-gray-100"
                        }`}
                      >
                        {user.nomeExibicao}
                        {isCurrentUser && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            Você
                          </Badge>
                        )}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {user.posicao}º lugar
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      className={`text-xl font-bold ${
                        user.posicao === 1
                          ? "text-yellow-600"
                          : user.posicao === 2
                          ? "text-gray-500"
                          : user.posicao === 3
                          ? "text-amber-600"
                          : "text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {user.pontos}
                    </div>
                    <p className="text-xs text-gray-500">pontos</p>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Dicas de Motivação */}
      <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
        <CardContent className="pt-6">
          <div className="text-center">
            <GamepadIcon className="h-8 w-8 text-purple-600 mx-auto mb-3" />
            <h3 className="font-semibold text-purple-800 mb-2">
              💡 Dica para Subir no Ranking
            </h3>
            <p className="text-sm text-purple-700">
              Complete diferentes cenários de simulação diariamente para
              maximizar sua pontuação! Quanto melhor suas respostas, mais pontos
              você ganha.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SimulationRanking;
