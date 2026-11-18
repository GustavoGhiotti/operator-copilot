import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  Award,
  Clock,
  Target,
  Star,
  TrendingUp,
  PlusCircle,
  AwardIcon,
} from "lucide-react";
import axiosInstance from "@/utils/axiosInstance";
import { useToast } from "@/hooks/use-toast";

interface PontuacaoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Operador {
  id: string;
  nome: string;
  cpf: string;
}

const categorias = [
  {
    key: "sem_abs",
    titulo: "Sem ABS",
    descricao: "Colaborador sem ABS",
    pontos: 2,
    icon: Award,
    color: "text-blue-500",
  },
  {
    key: "tempos_pausa",
    titulo: "Tempo produtivo",
    descricao: "Colaborador com bom tempo produtivo",
    pontos: 5,
    icon: Clock,
    color: "text-purple-500",
  },
  {
    key: "meta_100",
    titulo: "Meta 100%",
    descricao: "Atingimento de meta 100%",
    pontos: 5,
    icon: Target,
    color: "text-green-500",
  },
  {
    key: "meta_115",
    titulo: "Meta >115%",
    descricao: "Atingimento de meta superior a 115%",
    pontos: 10,
    icon: TrendingUp,
    color: "text-orange-500",
  },
  {
    key: "monitoria_85",
    titulo: "Monitoria >85%",
    descricao: "Média de monitoria superior a 85%",
    pontos: 8,
    icon: Star,
    color: "text-yellow-500",
  },
  {
    key: "dia_a_dia",
    titulo: "Campanha Dia a Dia",
    descricao: "Meta diária",
    pontos: 1,
    icon: Award,
    color: "text-yellow-500",
  },
];

const mapaTitulosPontos: Record<string, string> = {
  dia_a_dia: "Campanha Dia a Dia",
  meta_100: "Meta 100%",
  meta_115: "Meta >115%",
  monitoria_85: "Monitoria >85%",
  sem_abs: "Sem ABS",
  tempos_pausa: "Tempo Produtivo",
};

export const PontuacaoModal = ({ isOpen, onClose }: PontuacaoModalProps) => {
  const [loading, setLoading] = useState(false);
  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [operadorSelecionado, setOperadorSelecionado] = useState<string>("");
  const { toast } = useToast();
  const [pontuacaoOperador, setPontuacaoOperador] = useState<{
    total: number;
    pontos: Record<string, number>;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadOperadores();
    }
  }, [isOpen]);

  const loadOperadores = async () => {
    try {
      const response = await axiosInstance.get(
        "/api/operadores"
      );
      setOperadores(response.data);
    } catch (error) {
      console.error("Erro ao carregar operadores:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar a lista de operadores.",
        variant: "destructive",
      });
    }
  };

  const handleAddPontuacao = async (categoriaKey: string, pontos: number) => {
    if (!operadorSelecionado) {
      toast({
        title: "Atenção",
        description: "Selecione um operador antes de adicionar a pontuação.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await axiosInstance.post("/api/campanha/pontos", {
        operador_id: operadorSelecionado,
        categoria: categoriaKey,
        pontos,
      });

      toast({
        title: "Pontuação registrada",
        description: `+${pontos} pontos adicionados para a categoria ${categoriaKey.replace(
          "_",
          " "
        )}.`,
      });
    } catch (error) {
      console.error("Erro ao adicionar pontuação:", error);
      toast({
        title: "Erro",
        description: "Não foi possível registrar a pontuação.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  const loadPontuacao = async (cpf: string) => {
    try {
      const response = await axiosInstance.get(
        "/api/campanha/pontos",
        {
          params: { cpf },
        }
      );

      setPontuacaoOperador(response.data);
    } catch (err) {
      console.error("Erro ao carregar pontuação:", err);
      setPontuacaoOperador(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <PlusCircle className="w-6 h-6" />
            Registrar Pontuação - Zeta Coins
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Seleção de Operador */}
          <div className="space-y-2">
            <Label htmlFor="operador">Operador</Label>
            <Select
              value={operadorSelecionado}
              onValueChange={(usuario) => {
                setOperadorSelecionado(usuario);

                const operador = operadores.find((op) => op.id === usuario);
                if (operador) {
                  loadPontuacao(operador.cpf);
                }
              }}
            >
              {pontuacaoOperador && (
                <Card className="p-4 bg-slate-800/30 border-slate-700">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <AwardIcon className="w-5 h-5 text-yellow-400" /> Pontuação
                    Atual
                  </h3>

                  <p className="text-white mt-2 text-xl font-bold">
                    Total: {pontuacaoOperador.total} Coins
                  </p>

                  <div className="grid grid-cols-2 gap-2 mt-3 text-sm text-slate-300">
                    {Object.entries(pontuacaoOperador.pontos).map(
                      ([cat, val]) => (
                        <div
                          key={cat}
                          className="flex justify-between bg-black/20 px-2 py-1 rounded"
                        >
                          <span>{mapaTitulosPontos[cat] || cat}</span>
                          <span className="font-semibold">{val}</span>
                        </div>
                      )
                    )}
                  </div>
                </Card>
              )}

              <SelectTrigger id="operador">
                <SelectValue placeholder="Selecione um operador" />
              </SelectTrigger>
              <SelectContent>
                {operadores.map((op) => (
                  <SelectItem key={op.id} value={op.id}>
                    {op.nome} - {op.cpf}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Categorias de Pontuação */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categorias.map((categoria) => {
              const Icon = categoria.icon;
              return (
                <Card key={categoria.key}>
                  <CardContent className="p-4 flex flex-col gap-4">
                    <div className="flex items-start gap-3">
                      <Icon className={`w-5 h-5 ${categoria.color} mt-1`} />
                      <div>
                        <h3 className="font-semibold text-sm">
                          {categoria.titulo}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {categoria.descricao}
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() =>
                        handleAddPontuacao(categoria.key, categoria.pontos)
                      }
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90"
                    >
                      Adicionar +{categoria.pontos} Coins
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
