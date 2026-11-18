import React, { useState, useEffect } from "react";
import axios from "axios";
import { Gift, Clock, CheckCircle, AlertCircle, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface Reward {
  id: number;
  nome: string;
  descricao: string;
  pontos_necessarios: number;
  categoria: string;
  icone: string;
  disponivel: boolean;
  quantidade_disponivel?: number;
}

interface UserReward {
  id: number;
  premio_id: number;
  usuario: string;
  data_resgate: string;
  status: "pendente" | "aprovado" | "rejeitado";
  premio: Reward;
}

interface QuizRewardsProps {
  userPoints: number;
  onPointsUpdate: (newPoints: number) => void;
}

const QuizRewards: React.FC<QuizRewardsProps> = ({
  userPoints,
  onPointsUpdate,
}) => {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [userRewards, setUserRewards] = useState<UserReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const { toast } = useToast();

  const userName = localStorage.getItem("nomeCompleto")?.trim().toUpperCase();

  // Carregar prêmios disponíveis
  useEffect(() => {
    const fetchRewards = async () => {
      try {
        const response = await axios.get("/api/quiz/premios");
        setRewards(response.data);
      } catch (error) {
        console.error("Erro ao carregar prêmios:", error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar os prêmios disponíveis.",
          variant: "destructive",
        });
      }
    };

    const fetchUserRewards = async () => {
      if (!userName) return;

      try {
        const response = await axios.get(
          "/api/quiz/meus-resgates",
          {
            params: { usuario: userName },
          }
        );
        setUserRewards(response.data);
      } catch (error) {
        console.error("Erro ao carregar resgates do usuário:", error);
      }
    };

    Promise.all([fetchRewards(), fetchUserRewards()]).finally(() => {
      setLoading(false);
    });
  }, [userName, toast]);

  const getRewardIcon = (iconName: string) => {
    switch (iconName) {
      case "gift":
        return <Gift className="h-8 w-8" />;
      case "clock":
        return <Clock className="h-8 w-8" />;
      case "star":
        return <Star className="h-8 w-8" />;
      default:
        return <Gift className="h-8 w-8" />;
    }
  };

  const getRewardColor = (categoria: string) => {
    switch (categoria) {
      case "folga":
        return "text-green-600 bg-green-50";
      case "alimentacao":
        return "text-orange-600 bg-orange-50";
      case "pausa":
        return "text-blue-600 bg-blue-50";
      case "beneficio":
        return "text-purple-600 bg-purple-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  const handleRewardSelect = (reward: Reward) => {
    setSelectedReward(reward);
    setShowConfirmDialog(true);
  };

  const handleRedeemReward = async () => {
    if (!selectedReward || !userName) return;

    setRedeeming(true);

    try {
      const response = await axios.post(
        "/api/quiz/resgatar-premio",
        {
          usuario: userName,
          premio_id: selectedReward.id,
          pontos_gastos: selectedReward.pontos_necessarios,
        }
      );

      // Atualizar pontos do usuário
      onPointsUpdate(userPoints - selectedReward.pontos_necessarios);

      // Atualizar lista de resgates do usuário
      const updatedUserRewards = await axios.get(
        "/api/quiz/meus-resgates",
        {
          params: { usuario: userName },
        }
      );
      setUserRewards(updatedUserRewards.data);

      toast({
        title: "Prêmio resgatado com sucesso!",
        description: `Você resgatou: ${selectedReward.nome}. Aguarde a aprovação.`,
      });

      setShowConfirmDialog(false);
      setSelectedReward(null);
    } catch (error) {
      console.error("Erro ao resgatar prêmio:", error);
      toast({
        title: "Erro ao resgatar prêmio",
        description: "Não foi possível resgatar o prêmio. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setRedeeming(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pendente":
        return <Badge variant="secondary">Pendente</Badge>;
      case "aprovado":
        return <Badge variant="default">Aprovado</Badge>;
      case "rejeitado":
        return <Badge variant="destructive">Rejeitado</Badge>;
      default:
        return <Badge variant="secondary">Pendente</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pontos disponíveis */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Seus Pontos</h3>
            <p className="text-2xl font-bold text-blue-600">{userPoints}</p>
          </div>
          <div className="text-blue-600">
            <Star className="h-8 w-8" />
          </div>
        </div>
      </div>

      {/* Prêmios disponíveis */}
      <div>
        <h3 className="text-lg font-semibold text-orange-600 mb-4">
          Prêmios Disponíveis
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rewards.map((reward) => {
            const canRedeem =
              userPoints >= reward.pontos_necessarios && reward.disponivel;
            const colorClass = getRewardColor(reward.categoria);

            return (
              <Card
                key={reward.id}
                className={`transition-all duration-200 hover:shadow-lg ${
                  canRedeem ? "cursor-pointer hover:scale-[1.02]" : "opacity-60"
                }`}
                onClick={() => canRedeem && handleRewardSelect(reward)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${colorClass}`}>
                      {getRewardIcon(reward.icone)}
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg">{reward.nome}</CardTitle>
                      <p className="text-sm text-white">{reward.descricao}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {reward.pontos_necessarios} pontos
                      </p>
                      {reward.quantidade_disponivel && (
                        <p className="text-xs text-gray-500">
                          {reward.quantidade_disponivel} disponíveis
                        </p>
                      )}
                    </div>
                    <Button
                      variant={canRedeem ? "default" : "secondary"}
                      size="sm"
                      disabled={!canRedeem}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (canRedeem) handleRewardSelect(reward);
                      }}
                    >
                      {canRedeem ? "Resgatar" : "Pontos insuficientes"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Histórico de resgates */}
      {userRewards.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-orange-500 mb-4">
            Meus Resgates
          </h3>
          <div className="space-y-3">
            {userRewards.map((userReward) => (
              <Card key={userReward.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-full ${getRewardColor(
                        userReward.premio.categoria
                      )}`}
                    >
                      {getRewardIcon(userReward.premio.icone)}
                    </div>
                    <div>
                      <h4 className="font-medium">{userReward.premio.nome}</h4>
                      <p className="text-sm text-gray-600">
                        Resgatado em{" "}
                        {new Date(userReward.data_resgate).toLocaleDateString(
                          "pt-BR"
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {getStatusBadge(userReward.status)}
                    <p className="text-sm text-gray-500 mt-1">
                      {userReward.premio.pontos_necessarios} pontos
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Dialog de confirmação */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Resgate</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja resgatar este prêmio?
            </DialogDescription>
          </DialogHeader>

          {selectedReward && (
            <div className="py-4">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className={`p-3 rounded-full ${getRewardColor(
                    selectedReward.categoria
                  )}`}
                >
                  {getRewardIcon(selectedReward.icone)}
                </div>
                <div>
                  <h3 className="font-semibold">{selectedReward.nome}</h3>
                  <p className="text-sm text-gray-600">
                    {selectedReward.descricao}
                  </p>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  <strong>Pontos necessários:</strong>{" "}
                  {selectedReward.pontos_necessarios}
                </p>
                <p className="text-sm text-yellow-800">
                  <strong>Pontos restantes:</strong>{" "}
                  {userPoints - selectedReward.pontos_necessarios}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={redeeming}
            >
              Cancelar
            </Button>
            <Button onClick={handleRedeemReward} disabled={redeeming}>
              {redeeming ? "Resgatando..." : "Confirmar Resgate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuizRewards;
