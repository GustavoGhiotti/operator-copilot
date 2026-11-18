import React from 'react';
import { Trophy, Star, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface QuizScoreProps {
  totalPoints: number;
  dailyPoints: number;
  className?: string;
}

const QuizScore: React.FC<QuizScoreProps> = ({ totalPoints, dailyPoints, className = "" }) => {
  const getRank = (points: number) => {
    if (points >= 50000) return { name: "Avançado", color: "bg-purple-600", icon: <Trophy className="h-4 w-4" />, min: 50000, max: 50000 };
    if (points >= 10000) return { name: "Intermediário", color: "bg-blue-600", icon: <Star className="h-4 w-4" />, min: 10000, max: 50000 };
    if (points > 0) return { name: "Novato", color: "bg-green-600", icon: <Target className="h-4 w-4" />, min: 0, max: 10000 };
    return { name: "Sem Pontos", color: "bg-gray-400", icon: <Target className="h-4 w-4" />, min: 0, max: 10000 };
  };

  const rank = getRank(totalPoints);
  const nextLevelProgress = Math.min(100, ((totalPoints - rank.min) / (rank.max - rank.min)) * 100);

  return (
    <Card className={`bg-gradient-to-r from-cian-50 to-purple-50 border-blue-200 ${className} mb-10`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-600" />
          Sua Pontuação
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{totalPoints}</p>
            <p className="text-sm text-gray-600">Total de Pontos</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{dailyPoints}</p>
            <p className="text-sm text-gray-600">Pontos Hoje</p>
          </div>
        </div>

        <div className="flex justify-center">
          <Badge className={`${rank.color} text-white flex items-center gap-1`}>
            {rank.icon}
            {rank.name}
          </Badge>
        </div>

        {rank.max !== rank.min && (
          <div>
            <p className="text-xs text-gray-500 text-center mb-1">
              Progresso até próximo nível ({rank.max} pts)
            </p>
            <Progress value={nextLevelProgress} className="h-2" />
          </div>
        )}

        <div className="text-center text-xs text-gray-500">
          <p>💡 Complete quizzes diários para ganhar mais pontos!</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default QuizScore;
