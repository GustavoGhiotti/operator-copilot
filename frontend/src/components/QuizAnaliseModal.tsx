import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  X,
  Search,
  User,
  CheckCircle,
  XCircle,
  Target,
  TrendingUp,
  Calendar,
  Award,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Operador {
  nome: string;
  totalRespostas: number;
  respostasCorretas: number;
  respostasIncorretas: number;
  respostasParciais: number;
  porcentagemAcerto: number;
  pontosTotal: number;
  detalhes: RespostaDetalhada[];
}

interface RespostaDetalhada {
  pergunta: string;
  resposta: string;
  pontos: number;
  tema: string;
  horario: string;
}

interface QuizAnaliseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const QuizAnaliseModal: React.FC<QuizAnaliseModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [operadores, setOperadores] = useState<string[]>([]);
  const [operadorSelecionado, setOperadorSelecionado] =
    useState<Operador | null>(null);
  const [loading, setLoading] = useState(false);
  const [filteredOperadores, setFilteredOperadores] = useState<string[]>([]);

  const handleSearch = async () => {
    if (!searchTerm) {
      setFilteredOperadores([]);
      return;
    }

    try {
      const response = await axios.get(
        "http:///quiz/operadores",
        {
          params: { nome: searchTerm },
        }
      );
      const lista = response.data.operadores || [];
      setFilteredOperadores(lista);
    } catch (error) {
      console.error("Erro ao buscar operadores:", error);
      setFilteredOperadores([]);
    }
  };

  const carregarOperadores = async () => {
    try {
      const response = await axios.get(
        "http:///quiz/operadores"
      );
      setOperadores(response.data.operadores || []);
    } catch (error) {
      console.error("Erro ao carregar operadores:", error);
    }
  };

  const carregarDetalhesOperador = async (nomeOperador: string) => {
    setLoading(true);
    try {
      const response = await axios.get(
        "http:///quiz/analise-operador",
        {
          params: { operador: nomeOperador },
        }
      );

      const data = response.data;
      const operador: Operador = {
        nome: nomeOperador,
        totalRespostas: data.totalRespostas || 0,
        respostasCorretas: data.respostasCorretas || 0,
        respostasIncorretas: data.respostasIncorretas || 0,
        respostasParciais: data.respostasParciais || 0,
        porcentagemAcerto: data.porcentagemAcerto || 0,
        pontosTotal: data.pontosTotal || 0,
        detalhes: data.detalhes || [],
      };

      setOperadorSelecionado(operador);
      setSearchTerm("");
      setFilteredOperadores([]);
    } catch (error) {
      console.error("Erro ao carregar detalhes do operador:", error);
    } finally {
      setLoading(false);
    }
  };

  const voltarParaPesquisa = () => {
    setOperadorSelecionado(null);
    setSearchTerm("");
    setFilteredOperadores([]);
  };

  const getPontosColor = (pontos: number) => {
    if (pontos === 100) return "text-green-600";
    if (pontos === 50) return "text-yellow-600";
    return "text-red-600";
  };

  const getPontosBadgeVariant = (
    pontos: number
  ): "default" | "secondary" | "destructive" => {
    if (pontos === 100) return "default";
    if (pontos === 50) return "secondary";
    return "destructive";
  };

  if (!isOpen) return null;

  // Tela de detalhes do operador
  if (operadorSelecionado && !loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={voltarParaPesquisa}>
                  <X className="h-5 w-5" />
                </Button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    Análise de Desempenho
                  </h1>
                  <p className="text-gray-600 dark:text-gray-300">
                    {operadorSelecionado.nome}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Cards de resumo */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="flex items-center justify-center mb-2">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="text-2xl font-bold text-blue-600">
                    {operadorSelecionado.totalRespostas}
                  </div>
                  <p className="text-sm text-gray-600">Total de Respostas</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  <div className="flex items-center justify-center mb-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="text-2xl font-bold text-green-600">
                    {operadorSelecionado.respostasCorretas}
                  </div>
                  <p className="text-sm text-gray-600">Respostas Corretas</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  <div className="flex items-center justify-center mb-2">
                    <TrendingUp className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="text-2xl font-bold text-purple-600">
                    {operadorSelecionado.porcentagemAcerto.toFixed(1)}%
                  </div>
                  <p className="text-sm text-gray-600">Taxa de Acerto</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  <div className="flex items-center justify-center mb-2">
                    <Award className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div className="text-2xl font-bold text-yellow-600">
                    {operadorSelecionado.pontosTotal}
                  </div>
                  <p className="text-sm text-gray-600">Pontos Total</p>
                </CardContent>
              </Card>
            </div>

            {/* Detalhes das respostas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Respostas de Hoje
                </CardTitle>
                <CardDescription>
                  Detalhamento de todas as respostas do operador
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {operadorSelecionado.detalhes.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      Nenhuma resposta encontrada para hoje
                    </div>
                  ) : (
                    operadorSelecionado.detalhes.map((detalhe, index) => (
                      <div
                        key={index}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                              {detalhe.pergunta}
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                              Resposta: {detalhe.resposta}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <Badge variant="outline">{detalhe.tema}</Badge>
                              <span>{detalhe.horario}</span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <Badge
                              variant={getPontosBadgeVariant(detalhe.pontos)}
                            >
                              {detalhe.pontos} pts
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Tela de loading
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-bold mb-2">Carregando análise...</h2>
            <p className="text-gray-600">Buscando dados do operador</p>
          </div>
        </div>
      </div>
    );
  }

  // Tela de pesquisa de operadores
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Análise de Desempenho no Quiz
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                Selecione um operador para ver seu desempenho
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Campo de pesquisa */}
          <div className="relative mb-6 flex gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <Input
                type="text"
                placeholder="Digite o nome do operador..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch}>Buscar</Button>
          </div>

          {/* Lista de operadores filtrados */}
          {filteredOperadores.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">
                  Operadores Encontrados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {filteredOperadores.map((operador, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                      onClick={() => carregarDetalhesOperador(operador)}
                    >
                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {operador}
                        </p>
                        <p className="text-sm text-gray-500">
                          Clique para ver detalhes
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Instrução inicial */}
          {searchTerm === "" && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                Buscar Operador
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Digite o nome do operador para ver seu desempenho no quiz
              </p>
            </div>
          )}

          {/* Nenhum resultado */}
          {searchTerm !== "" && filteredOperadores.length === 0 && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                Nenhum operador encontrado
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Tente buscar com um nome diferente
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuizAnaliseModal;
