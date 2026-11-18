import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  X,
  MessageCircle,
  User,
  Bot,
  Trophy,
  Star,
  Target,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import SimulationScore from "./SimulationScore";
import SimulationRanking from "./SimulationRanking";
import SimulationRewards from "./SimulationRewards";
import { useSimulationSystem } from "@/hooks/useSimulationSystem";

interface SimulacaoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Scenario {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  difficulty: "Fácil" | "Médio" | "Difícil";
  maxPoints: number;
  interactions: ScenarioInteraction[];
}

interface ScenarioInteraction {
  id: number;
  clientMessage: string;
  options: ResponseOption[];
}

interface ResponseOption {
  text: string;
  points: number;
  feedback: string;
  isPositive: boolean;
  nextInteractionId?: number;
}

const SimulacaoModal: React.FC<SimulacaoModalProps> = ({ isOpen, onClose }) => {
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(
    null
  );
  const [currentInteraction, setCurrentInteraction] = useState(0);
  const [sessionPoints, setSessionPoints] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [gameCompleted, setGameCompleted] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<
    Array<{
      type: "client" | "operator";
      message: string;
      points?: number;
      isPositive?: boolean;
    }>
  >([]);
  const [activeTab, setActiveTab] = useState("scenarios");
  const nomeUsuario = localStorage
    .getItem("nomeCompleto")
    ?.trim()
    .toUpperCase();

  const { userSimulationData, addPoints, getBestScore } = useSimulationSystem();

  const renderIcon = (iconName: string): JSX.Element => {
    const icons: Record<string, JSX.Element> = {
      MessageCircle: <MessageCircle className="h-8 w-8 text-red-600" />,
      Bot: <Bot className="h-8 w-8 text-green-600" />,
      User: <User className="h-8 w-8 text-blue-600" />,
      Target: <Target className="h-8 w-8 text-purple-600" />,
      Trophy: <Trophy className="h-8 w-8 text-yellow-600" />,
      Star: <Star className="h-8 w-8 text-yellow-600" />,
    };

    if (icons[iconName]) {
      return icons[iconName];
    }
    return <span className="text-2xl">{iconName}</span>;
  };

  const [scenarios, setScenarios] = useState<Scenario[]>([]);

  useEffect(() => {
    if (!nomeUsuario) return;
    const centroCusto = localStorage.getItem("centroCusto") || "GERAL";
    axios
      .get("/api/simulacao/cenarios", {
        params: {
          nome: nomeUsuario,
          centro_custo: centroCusto,
        },
      })
      .then((res) => {
        const data = res.data.map((cenario: any) => ({
          ...cenario,
          icon: renderIcon(cenario.icon),
        }));
        setScenarios(data);
      })
      .catch((err) => {
        console.error("Erro ao buscar cenários:", err);
      });
  }, [nomeUsuario]);

  const handleScenarioSelect = (scenario: Scenario) => {
    setSelectedScenario(scenario);
    setCurrentInteraction(0);
    setSessionPoints(0);
    setSelectedOption(null);
    setShowFeedback(false);
    setGameCompleted(false);
    setConversationHistory([
      {
        type: "client",
        message: scenario.interactions[0].clientMessage,
      },
    ]);
  };

  const handleOptionSelect = (optionIndex: number) => {
    if (!selectedScenario || showFeedback) return;

    setSelectedOption(optionIndex);
    setShowFeedback(true);

    const option =
      selectedScenario.interactions[currentInteraction].options[optionIndex];
    setSessionPoints((prev) => prev + option.points);

    setConversationHistory((prev) => [
      ...prev,
      {
        type: "operator",
        message: option.text,
        points: option.points,
        isPositive: option.isPositive,
      },
    ]);
  };

  const handleNextInteraction = async () => {
    if (!selectedScenario || selectedOption === null) return;

    const option =
      selectedScenario.interactions[currentInteraction].options[selectedOption];

    if (
      option.nextInteractionId &&
      currentInteraction < selectedScenario.interactions.length - 1
    ) {
      const nextInteraction = currentInteraction + 1;
      setCurrentInteraction(nextInteraction);
      setSelectedOption(null);
      setShowFeedback(false);

      setConversationHistory((prev) => [
        ...prev,
        {
          type: "client",
          message: selectedScenario.interactions[nextInteraction].clientMessage,
        },
      ]);
    } else {
      addPoints(selectedScenario.id, sessionPoints);
      setGameCompleted(true);

      const salvarRespostasNoServidor = async () => {
        const cpf = localStorage.getItem("cpf");

        const respostas = conversationHistory
          .filter((msg) => msg.type === "operator")
          .map((msg, index) => {
            const interactionId = selectedScenario?.interactions[index]?.id;
            const selected = selectedScenario?.interactions[
              index
            ]?.options.find((opt) => opt.text === msg.message);
            return {
              nomeUsuario: nomeUsuario,
              id_cenario: selectedScenario?.id,
              id_interacao: interactionId,
              id_opcao_escolhida: selected?.id,
              pontos: msg.points,
              is_positiva: msg.isPositive,
            };
          });

        try {
          await axios.post(
            "http:///simulacao/salvar-respostas",
            {
              respostas,
            }
          );
        } catch (err) {
          console.error("Erro ao salvar respostas:", err);
        }
      };

      await salvarRespostasNoServidor();
      loadPontuacoes();
    }
  };

  const [realTotalPoints, setRealTotalPoints] = useState(0);
  const [realDailyPoints, setRealDailyPoints] = useState(0);
  const [pontuacaoPorCenario, setPontuacaoPorCenario] = useState<
    Record<string, number>
  >({});

  const loadPontuacoes = () => {
    if (!nomeUsuario) return;

    axios
      .get(`/api/simulacao/pontuacao`, {
        params: { nome: nomeUsuario },
      })
      .then((res) => {
        setRealTotalPoints(res.data.totalPoints);
        setRealDailyPoints(res.data.dailyPoints);
      })
      .catch((err) => {
        console.error("Erro ao buscar pontuação do usuário", err);
      });

    axios
      .get("/api/simulacao/pontuacao-por-cenario", {
        params: { nome: nomeUsuario },
      })
      .then((res) => {
        const dados: Record<string, number> = {};
        res.data.forEach((item: { idCenario: string; totalPontos: number }) => {
          dados[item.idCenario] = item.totalPontos;
        });
        setPontuacaoPorCenario(dados);
      })
      .catch((err) => {
        console.error("Erro ao buscar pontuação por cenário:", err);
      });
  };

  useEffect(() => {
    loadPontuacoes();
  }, [nomeUsuario]);

  useEffect(() => {
    if (activeTab === "score") {
      loadPontuacoes();
    }
  }, [activeTab]);

  const handleBackToScenarios = () => {
    setSelectedScenario(null);
    setCurrentInteraction(0);
    setSessionPoints(0);
    setSelectedOption(null);
    setShowFeedback(false);
    setGameCompleted(false);
    setConversationHistory([]);
    setActiveTab("scenarios");
  };

  const getScorePercentage = () => {
    if (!selectedScenario) return 0;
    return Math.round((sessionPoints / selectedScenario.maxPoints) * 100);
  };

  const getScoreLevel = () => {
    const percentage = getScorePercentage();
    if (percentage >= 90)
      return {
        text: "Excelente",
        color: "text-green-600",
        icon: <Trophy className="h-5 w-5" />,
      };
    if (percentage >= 70)
      return {
        text: "Bom",
        color: "text-blue-600",
        icon: <Star className="h-5 w-5" />,
      };
    if (percentage >= 50)
      return {
        text: "Regular",
        color: "text-yellow-600",
        icon: <Target className="h-5 w-5" />,
      };
    return {
      text: "Precisa Melhorar",
      color: "text-red-600",
      icon: <XCircle className="h-5 w-5" />,
    };
  };

  if (!isOpen) return null;

  // Tela de resultado final
  if (gameCompleted && selectedScenario) {
    const scoreLevel = getScoreLevel();

    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Simulação Concluída!
              </h1>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <Card className="text-center mb-6">
              <CardHeader>
                <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  {scoreLevel.icon}
                </div>
                <CardTitle className="text-xl">
                  {selectedScenario.title}
                </CardTitle>
                <CardDescription>
                  Você conquistou {sessionPoints} de{" "}
                  {selectedScenario.maxPoints} pontos possíveis
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="text-center">
                  <div
                    className={`text-4xl font-bold mb-2 ${scoreLevel.color}`}
                  >
                    {getScorePercentage()}%
                  </div>
                  <p className={`text-lg ${scoreLevel.color}`}>
                    {scoreLevel.text}
                  </p>
                  <Progress
                    value={getScorePercentage()}
                    className="w-full mt-4"
                  />
                </div>

                <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                  <h3 className="font-semibold mb-3">Resumo da Conversa:</h3>
                  <div className="space-y-2">
                    {conversationHistory.map((msg, index) => (
                      <div
                        key={index}
                        className={`text-sm p-2 rounded ${
                          msg.type === "client"
                            ? "bg-blue-100 text-blue-800"
                            : `bg-gray-100 text-gray-800 ${
                                msg.points !== undefined
                                  ? msg.isPositive
                                    ? "border-l-4 border-green-500"
                                    : "border-l-4 border-red-500"
                                  : ""
                              }`
                        }`}
                      >
                        <div className="font-medium">
                          {msg.type === "client" ? "👤 Cliente:" : "🎧 Você:"}
                        </div>
                        <div>{msg.message}</div>
                        {msg.points !== undefined && (
                          <div className="text-xs mt-1 font-medium">
                            +{msg.points} pontos
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={handleBackToScenarios}
                    className="flex-1"
                  >
                    Outros Cenários
                  </Button>
                  <Button onClick={onClose} className="flex-1">
                    Finalizar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Tela da simulação em andamento
  if (selectedScenario) {
    const currentInt = selectedScenario.interactions[currentInteraction];

    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToScenarios}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {selectedScenario.title}
                  </h1>
                  <p className="text-gray-600 dark:text-gray-300">
                    Interação {currentInteraction + 1} de{" "}
                    {selectedScenario.interactions.length} • {sessionPoints}{" "}
                    pontos
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Chat/Conversa */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageCircle className="h-5 w-5" />
                    Conversa
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 max-h-96 overflow-y-auto">
                  {conversationHistory.map((msg, index) => (
                    <div
                      key={index}
                      className={`flex ${
                        msg.type === "operator"
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[80%] p-3 rounded-lg ${
                          msg.type === "client"
                            ? "bg-blue-100 text-blue-900"
                            : "bg-green-100 text-green-900"
                        }`}
                      >
                        <div className="text-sm font-medium mb-1">
                          {msg.type === "client" ? "👤 Cliente" : "🎧 Você"}
                        </div>
                        <div className="text-sm">{msg.message}</div>
                        {msg.points !== undefined && (
                          <div className="text-xs mt-1 font-bold">
                            +{msg.points} pontos
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Opções de Resposta */}
              <Card>
                <CardHeader>
                  <CardTitle>Como você responderia?</CardTitle>
                  <CardDescription>
                    Escolha a melhor resposta para esta situação
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {currentInt.options.map((option, index) => (
                    <button
                      key={index}
                      onClick={() => handleOptionSelect(index)}
                      disabled={showFeedback}
                      className={`w-full p-4 text-left rounded-lg border transition-all ${
                        selectedOption === index
                          ? "border-blue-500 bg-blue-50"
                          : "border-orange-900 hover:border-orange-900 hover:bg-orange-90"
                      } ${
                        showFeedback
                          ? "cursor-not-allowed opacity-70"
                          : "cursor-pointer"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                            selectedOption === index
                              ? "bg-blue-500 text-white"
                              : "bg-gray-200 text-gray-600"
                          }`}
                        >
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-800 dark:text-orange-400">
                            {option.text}
                          </p>
                          {showFeedback && selectedOption === index && (
                            <div
                              className={`mt-3 p-3 rounded-md ${
                                option.isPositive
                                  ? "bg-green-50 border border-green-200"
                                  : "bg-yellow-50 border border-yellow-200"
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                {option.isPositive ? (
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-yellow-600" />
                                )}
                                <span
                                  className={`font-medium text-sm ${
                                    option.isPositive
                                      ? "text-green-800"
                                      : "text-yellow-800"
                                  }`}
                                >
                                  +{option.points} pontos
                                </span>
                              </div>
                              <p
                                className={`text-sm ${
                                  option.isPositive
                                    ? "text-green-700"
                                    : "text-yellow-700"
                                }`}
                              >
                                {option.feedback}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}

                  {showFeedback && (
                    <div className="pt-4">
                      <Button
                        onClick={handleNextInteraction}
                        className="w-full"
                      >
                        {currentInteraction <
                        selectedScenario.interactions.length - 1
                          ? "Próxima Interação"
                          : "Finalizar Simulação"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Tela principal com abas
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                Simulação de Atendimento
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                Pratique suas habilidades de negociação em cenários reais!
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="scenarios">Cenários</TabsTrigger>
              <TabsTrigger value="score">Minha Pontuação</TabsTrigger>
              <TabsTrigger value="ranking">Ranking</TabsTrigger>
              <TabsTrigger value="rewards">Premiação</TabsTrigger>
            </TabsList>

            <TabsContent value="scenarios" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                {scenarios.map((scenario) => {
                  const bestScore = getBestScore(scenario.id);
                  return (
                    <Card
                      key={scenario.id}
                      className="transition-all duration-200 hover:shadow-lg hover:scale-[1.02] cursor-pointer border-2 border-blue-200"
                      onClick={() => {
                        if (!pontuacaoPorCenario[scenario.id]) {
                          handleScenarioSelect(scenario);
                        }
                      }}
                    >
                      <CardHeader className="text-center pb-4">
                        <div className="mx-auto w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-3">
                          {scenario.icon}
                        </div>
                        <CardTitle className="text-lg text-blue-600">
                          {scenario.title}
                        </CardTitle>
                        <CardDescription className="text-sm">
                          {scenario.description}
                        </CardDescription>
                      </CardHeader>

                      <CardContent className="text-center pt-0">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Badge
                              variant={
                                scenario.difficulty === "Fácil"
                                  ? "default"
                                  : scenario.difficulty === "Médio"
                                  ? "secondary"
                                  : "destructive"
                              }
                            >
                              {scenario.difficulty}
                            </Badge>
                            <span className="text-sm text-gray-500">
                              Max: {scenario.maxPoints} pts
                            </span>
                          </div>

                          {pontuacaoPorCenario[scenario.id] > 0 && (
                            <div className="text-sm text-gray-600 font-medium">
                              Pontuação obtida:{" "}
                              {pontuacaoPorCenario[scenario.id]} pts
                            </div>
                          )}

                          <Button
                            variant={bestScore > 0 ? "ghost" : "outline"}
                            size="sm"
                            className="w-full"
                            disabled={pontuacaoPorCenario[scenario.id] > 0}
                          >
                            {pontuacaoPorCenario[scenario.id] > 0
                              ? "Já Respondido"
                              : "Iniciar Simulação"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div className="mt-8 text-center">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-800 mb-2">
                    Como funciona?
                  </h3>
                  <p className="text-sm text-blue-700">
                    🎭 Cada cenário simula uma situação real de atendimento
                    <br />
                    💬 Escolha as melhores respostas para cada situação
                    <br />
                    🏆 Ganhe pontos baseados na qualidade das suas respostas
                    <br />
                    📈 Receba feedback detalhado para melhorar suas técnicas
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="score" className="mt-6">
              <div className="max-w-2xl mx-auto">
                <SimulationScore
                  totalPoints={realTotalPoints}
                  dailyPoints={realDailyPoints}
                />

                <div className="mt-6 space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Histórico por Cenário
                  </h3>
                  {scenarios.map((scenario) => {
                    const bestScore = getBestScore(scenario.id);
                    const totalPoints = pontuacaoPorCenario[scenario.id] || 0;

                    if (totalPoints === 0) return null;

                    return (
                      <Card key={scenario.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
                                {scenario.icon}
                              </div>
                              <div>
                                <p className="font-medium">{scenario.title}</p>
                                <p className="text-sm text-gray-600">
                                  Total: {totalPoints} pts
                                </p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="ranking" className="mt-6">
              <SimulationRanking />
            </TabsContent>

            <TabsContent value="rewards" className="mt-6">
              <SimulationRewards />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default SimulacaoModal;
