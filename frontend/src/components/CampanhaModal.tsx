import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Trophy,
  Award,
  Clock,
  Target,
  Star,
  TrendingUp,
  Coins,
} from "lucide-react";
import axiosInstance from "@/utils/axiosInstance";
import { useToast } from "@/hooks/use-toast";

interface CampanhaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PontosCategoria {
  sem_abs: number;
  tempos_pausa: number;
  meta_100: number;
  meta_115: number;
  monitoria_85: number;
  dia_a_dia: number;
}

interface CampanhaData {
  total: number;
  pontos: PontosCategoria;
}

const categorias = [
  {
    key: "sem_abs" as keyof PontosCategoria,
    titulo: "Sem ABS",
    descricao: "Colaborador sem ABS",
    icon: Award,
    maxCoins: 2,
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    key: "tempos_pausa" as keyof PontosCategoria,
    titulo: "Tempo produtivo",
    descricao: "Colaborador com bom tempo produtivo",
    icon: Clock,
    maxCoins: 5,
    gradient: "from-purple-500 to-pink-500",
  },
  {
    key: "meta_100" as keyof PontosCategoria,
    titulo: "Meta 100%",
    descricao: "Atingimento de meta 100%",
    icon: Target,
    maxCoins: 5,
    gradient: "from-green-500 to-emerald-500",
  },
  {
    key: "meta_115" as keyof PontosCategoria,
    titulo: "Meta >115%",
    descricao: "Atingimento de meta superior a 115%",
    icon: TrendingUp,
    maxCoins: 10,
    gradient: "from-orange-500 to-red-500",
  },
  {
    key: "monitoria_85" as keyof PontosCategoria,
    titulo: "Monitoria >85%",
    descricao: "Média de monitoria superior a 85%",
    icon: Star,
    maxCoins: 8,
    gradient: "from-yellow-500 to-amber-500",
  },
  {
    key: "dia_a_dia" as keyof PontosCategoria,
    titulo: "Campanha Dia a Dia",
    descricao: "Meta diária",
    icon: Award,
    maxCoins: 1,
    gradient: "from-yellow-500 to-amber-500",
  },
];

export const CampanhaModal = ({ isOpen, onClose }: CampanhaModalProps) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CampanhaData | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      loadCampanhaData();
    }
  }, [isOpen]);

  const loadCampanhaData = async () => {
    setLoading(true);
    try {
      const cpf = localStorage.getItem("userCpf");

      const response = await axiosInstance.get(
        "/api/campanha/pontos",
        {
          headers: {
            cpf: cpf || "",
          },
        }
      );

      // 🧩 Define valores padrão caso não venha nada do backend
      const dataRecebida = response.data || {};
      const pontos = dataRecebida.pontos || {};

      setData({
        total: dataRecebida.total ?? 0,
        pontos: {
          sem_abs: pontos.sem_abs ?? 0,
          tempos_pausa: pontos.tempos_pausa ?? 0,
          meta_100: pontos.meta_100 ?? 0,
          meta_115: pontos.meta_115 ?? 0,
          monitoria_85: pontos.monitoria_85 ?? 0,
          dia_a_dia: pontos.dia_a_dia ?? 0,
        },
      });
    } catch (error) {
      console.error("Erro ao carregar dados da campanha:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados da campanha.",
        variant: "destructive",
      });
      // 🧩 Mesmo em erro, mantém a tela funcional com 0
      setData({
        total: 0,
        pontos: {
          sem_abs: 0,
          tempos_pausa: 0,
          meta_100: 0,
          meta_115: 0,
          monitoria_85: 0,
          dia_a_dia: 0,
        },
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-gradient-to-br from-amber-500 to-orange-500">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-3xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
                Zeta Coins
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                Sua pontuação na campanha
              </p>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : data ? (
          <div className="space-y-6 py-4">
            {/* Total de Coins */}
            <Card className="overflow-hidden border-2 border-amber-500/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-4 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 animate-pulse">
                      <Coins className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        Total de Coins
                      </p>
                      <p className="text-5xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
                        {data.total}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pontos por Categoria */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categorias.map((categoria) => {
                const Icon = categoria.icon;
                const pontosObtidos = data.pontos[categoria.key];
                const percentual = (pontosObtidos / categoria.maxCoins) * 100;

                return (
                  <Card
                    key={categoria.key}
                    className="overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div
                          className={`p-3 rounded-lg bg-gradient-to-br ${categoria.gradient}`}
                        >
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg mb-1">
                            {categoria.titulo}
                          </h3>
                          <p className="text-sm text-muted-foreground mb-3">
                            {categoria.descricao}
                          </p>

                          <div className="flex items-center justify-between mb-2">
                            <span className="text-2xl font-bold">
                              {pontosObtidos}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            Nenhum dado disponível no momento.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
