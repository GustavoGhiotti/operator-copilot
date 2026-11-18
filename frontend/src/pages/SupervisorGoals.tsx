import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Search, Target } from "lucide-react";
import axiosInstance from "@/utils/axiosInstance";

interface SupervisorGoalsProps {
  isModal?: boolean;
  onClose?: () => void;
}

const SupervisorGoals: React.FC<SupervisorGoalsProps> = ({
  isModal,
  onClose,
}) => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<
    { id: number; name: string; currentGoal?: number }[]
  >([]);
  const [selectedOperator, setSelectedOperator] = useState<{
    id: number;
    name: string;
    currentGoal?: number;
  } | null>(null);
  const [newGoal, setNewGoal] = useState<string>("");
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const token = localStorage.getItem("userToken");
  const headers = {
    Authorization: `Bearer ${token}`,
  };

  useEffect(() => {
    const fetchData = async () => {
      setIsSearching(true);
      try {
        const response = await axiosInstance.get(
          `/api/supervisor/ideal-operadores`
        );
        if (response.status === 200) {
          const data = response.data?.operador || [];

          // Mapeia os dados para o formato esperado pelo componente
          const mappedData = data.map((item: any) => ({
            id: item.ID_COLABORADOR || item.id || Math.random(), // fallback se não tiver id
            name: item.NM_COLABORADOR,
            currentGoal: item.IDEAL_COLABORADOR,
          }));

          setSearchResults(mappedData);
        } else {
          toast({
            title: "Erro ao carregar operadores",
            description:
              "Não foi possível carregar os operadores. Tente novamente mais tarde.",
            variant: "destructive",
          });
        }
      } catch (error) {
        toast({
          title: "Erro ao carregar operadores",
          description:
            "Não foi possível carregar os operadores ao iniciar. Verifique a conexão.",
          variant: "destructive",
        });
      } finally {
        setIsSearching(false);
      }
    };

    fetchData();
  }, []);

  const filteredResults = searchTerm.trim()
    ? searchResults.filter((operator) =>
        operator.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : searchResults;

  const handleSelectOperator = (operator: {
    id: number;
    name: string;
    currentGoal?: number;
  }) => {
    setSelectedOperator(operator);
    setNewGoal(operator.currentGoal ? operator.currentGoal.toString() : "");
    setSearchResults([]);
    setSearchTerm("");
  };

  const handleSaveGoal = async () => {
    if (!selectedOperator) return;

    if (!newGoal) {
      toast({
        title: "Campo em branco",
        description: "Por favor, preencha o valor da meta.",
        variant: "destructive",
      });
      return;
    }

    const goalValue = parseFloat(newGoal);
    if (isNaN(goalValue) || goalValue <= 0) {
      toast({
        title: "Valor inválido",
        description:
          "Por favor, insira um valor numérico positivo para a meta.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        nome_colaborador: selectedOperator.name,
        nova_meta: goalValue,
      };

      const response = await axiosInstance.post(
        "/api/supervisor/atualizar_meta",
        payload
      );

      // Se chegou aqui, foi sucesso (status 200)
      toast({
        title: "Meta atualizada",
        description: `A meta de ${
          selectedOperator.name
        } foi definida como ${formatCurrency(goalValue)}.`,
      });

      // Atualiza o operador localmente também:
      setSelectedOperator({ ...selectedOperator, currentGoal: goalValue });
      setNewGoal("");
    } catch (error: any) {
      if (error.response?.status === 403) {
        toast({
          title: "Alteração não permitida",
          description:
            error.response.data?.erro ||
            "A meta deste operador já foi alterada neste mês.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro ao salvar",
          description:
            error.response?.data?.erro ||
            "Não foi possível atualizar a meta. Verifique sua conexão ou tente novamente.",
          variant: "destructive",
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Se estiver sendo usado como um modal, não renderize o layout completo da página
  if (isModal) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Buscar Operador</CardTitle>
            <CardDescription>
              Digite o nome do operador para localizar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder="Nome do operador..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleKeyPress}
                />
              </div>
            </div>

            {filteredResults.length > 0 && (
              <div className="mt-4 border rounded-md">
                <div className="p-2 bg-gray-50 dark:bg-gray-800 border-b font-medium text-sm">
                  Resultados da busca
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {filteredResults.map((operator, index) => {
                    const key = operator.id || operator.name; // Se id não estiver presente, use o nome (ou outro valor único)
                    return (
                      <div
                        key={`${operator.NM_COLABORADOR}-${index}`} // Usando key como operator.id ou fallback para operator.name
                        className="p-3 border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                        onClick={() => handleSelectOperator(operator)}
                      >
                        <div className="flex justify-between items-center">
                          <span>{operator.name}</span>
                          {operator.currentGoal && (
                            <span className="text-sm text-gray-500">
                              Meta atual: {formatCurrency(operator.currentGoal)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {selectedOperator && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-amber-500" />
                Definir Meta
              </CardTitle>
              <CardDescription>
                Definindo meta para:{" "}
                <span className="font-semibold">{selectedOperator.name}</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-goal">Meta Atual</Label>
                  <Input
                    id="current-goal"
                    value={
                      selectedOperator.currentGoal
                        ? formatCurrency(selectedOperator.currentGoal)
                        : "Não definida"
                    }
                    disabled
                    className="bg-gray-50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-goal">Nova Meta</Label>
                  <Input
                    id="new-goal"
                    type="text"
                    value={newGoal}
                    onChange={(e) => setNewGoal(e.target.value)}
                    placeholder="Digite o valor da meta"
                  />
                  <p className="text-xs text-gray-500">
                    Digite apenas números (ex: 100000)
                  </p>
                </div>
                <div className="pt-2 flex items-center justify-end gap-2">
                  {onClose && (
                    <Button variant="outline" onClick={onClose}>
                      Cancelar
                    </Button>
                  )}
                  <Button
                    onClick={handleSaveGoal}
                    disabled={isSaving || !newGoal}
                  >
                    {isSaving ? "Salvando..." : "Salvar Meta"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col transition-colors duration-200">
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
            Painel Administrativo - Telecobrança
          </h1>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-gray-800 dark:text-gray-100">
              Definição de Metas
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Defina as metas para cada operador da sua equipe
            </p>
          </div>

          <Button
            onClick={onClose}
            variant="outline"
            className="flex items-center gap-1"
          >
            Voltar
          </Button>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Buscar Operador</CardTitle>
            <CardDescription>
              Digite o nome do operador para localizar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder="Nome do operador..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleKeyPress}
                />
              </div>
            </div>

            {filteredResults.length > 0 && (
              <div className="mt-4 border rounded-md">
                <div className="p-2 bg-gray-50 dark:bg-gray-800 border-b font-medium text-sm">
                  Resultados da busca
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {searchResults.map((operator) => {
                    const key = operator.id || operator.name; // Se id não estiver presente, use o nome (ou outro valor único)
                    return (
                      <div
                        key={key} // Usando key como operator.id ou fallback para operator.name
                        className="p-3 border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                        onClick={() => handleSelectOperator(operator)}
                      >
                        <div className="flex justify-between items-center">
                          <span>{operator.name}</span>
                          {operator.currentGoal && (
                            <span className="text-sm text-gray-500">
                              Meta atual: {formatCurrency(operator.currentGoal)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {selectedOperator && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-amber-500" />
                Definir Meta
              </CardTitle>
              <CardDescription>
                Definindo meta para:{" "}
                <span className="font-semibold">{selectedOperator.name}</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-goal">Meta Atual</Label>
                  <Input
                    id="current-goal"
                    value={
                      selectedOperator.currentGoal
                        ? formatCurrency(selectedOperator.currentGoal)
                        : "Não definida"
                    }
                    disabled
                    className="bg-gray-50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-goal">Nova Meta</Label>
                  <Input
                    id="new-goal"
                    type="text"
                    value={newGoal}
                    onChange={(e) => setNewGoal(e.target.value)}
                    placeholder="Digite o valor da meta"
                  />
                  <p className="text-xs text-gray-500">
                    Digite apenas números (ex: 100000)
                  </p>
                </div>
                <div className="pt-2 flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedOperator(null)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSaveGoal}
                    disabled={isSaving || !newGoal}
                  >
                    {isSaving ? "Salvando..." : "Salvar Meta"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default SupervisorGoals;
