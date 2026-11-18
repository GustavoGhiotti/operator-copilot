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

const QuizRanking: React.FC = () => {
  const [rankingData, setRankingData] = useState<RankingData>({
    dia: [],
    semana: [],
    mes: [],
  });
  const [selectedPeriod, setSelectedPeriod] = useState<
    "dia" | "semana" | "mes"
  >("dia");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentUser = localStorage
    .getItem("nomeCompleto")
    ?.trim()
    .toUpperCase();

  useEffect(() => {
    const fetchRankingData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [diaRes, semanaRes, mesRes] = await Promise.all([
          axios.get("http:///quiz/ranking/dia"),
          axios.get("http:///quiz/ranking/semana"),
          axios.get("http:///quiz/ranking/mes"),
        ]);

        setRankingData({
          dia: diaRes.data || [],
          semana: semanaRes.data || [],
          mes: mesRes.data || [],
        });
      } catch (err) {
        console.error("Erro ao carregar ranking:", err);
        setError("Erro ao carregar ranking. Tente novamente.");
      } finally {
        setLoading(false);
      }
    };

    fetchRankingData();
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

  const currentRanking = rankingData[selectedPeriod];
  const userPosition = currentRanking.find(
    (user) => user.nome.toUpperCase() === currentUser
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

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600 mb-4">{error}</div>
        <Button onClick={() => window.location.reload()} variant="outline">
          Tentar Novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header do Ranking */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          🏆 Ranking de Pontuação
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          Veja como você está se saindo comparado aos outros operadores!
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
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-gray-900">
              <Users className="h-5 w-5 text-blue-600" />
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
                <div className="text-2xl font-bold text-blue-600">
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
            Top Operadores - {getPeriodLabel(selectedPeriod)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {currentRanking.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum dado de ranking disponível para este período.</p>
              <p className="text-sm">
                Complete alguns quizzes para aparecer no ranking!
              </p>
            </div>
          ) : (
            currentRanking.slice(0, 10).map((user, index) => {
              const isCurrentUser = user.nome.toUpperCase() === currentUser;

              return (
                <div
                  key={`${user.nome}-${index}`}
                  className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                    isCurrentUser
                      ? "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800"
                      : "bg-gray-50 border-gray-200 dark:bg-gray-700 dark:border-gray-600"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {getRankIcon(user.posicao)}
                    <div>
                      <p
                        className={`font-medium ${
                          isCurrentUser
                            ? "text-blue-900 dark:text-blue-100"
                            : "text-gray-900 dark:text-gray-100"
                        }`}
                      >
                        {isCurrentUser ? user.nome : `Operador ${user.posicao}`}
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
      <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
        <CardContent className="pt-6">
          <div className="text-center">
            <TrendingUp className="h-8 w-8 text-green-600 mx-auto mb-3" />
            <h3 className="font-semibold text-green-800 mb-2">
              💡 Dica para Subir no Ranking
            </h3>
            <p className="text-sm text-green-700">
              Complete quizzes de diferentes temas diariamente para maximizar
              sua pontuação! Cada resposta correta vale 100 pontos.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default QuizRanking;
