import React from 'react';
import { Trophy, Star, Target, GamepadIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface SimulationScoreProps {
  totalPoints: number;
  dailyPoints: number;
  className?: string;
}

const SimulationScore: React.FC<SimulationScoreProps> = ({ totalPoints, dailyPoints, className = "" }) => {
  const getRank = (points: number) => {
    if (points >= 8000) return { name: "Master Negociador", color: "bg-purple-500", icon: <Trophy className="h-4 w-4" /> };
    if (points >= 5000) return { name: "Expert", color: "bg-gold-500 bg-yellow-500", icon: <Trophy className="h-4 w-4" /> };
    if (points >= 3000) return { name: "Avançado", color: "bg-blue-500", icon: <Star className="h-4 w-4" /> };
    if (points >= 1500) return { name: "Intermediário", color: "bg-green-500", icon: <Target className="h-4 w-4" /> };
    if (points >= 500) return { name: "Iniciante", color: "bg-orange-500", icon: <GamepadIcon className="h-4 w-4" /> };
    return { name: "Novato", color: "bg-gray-500", icon: <Target className="h-4 w-4" /> };
  };

  const rank = getRank(totalPoints);

  return (
    <Card className={`bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <GamepadIcon className="h-5 w-5 text-purple-600" />
          Pontuação Simulação
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-600">{totalPoints}</p>
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
        
        <div className="text-center text-xs text-gray-500">
          <p>🎭 Complete simulações para melhorar suas habilidades!</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default SimulationScore;