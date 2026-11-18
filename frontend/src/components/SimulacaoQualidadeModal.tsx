import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  X,
  Plus,
  Edit,
  Trash2,
  Save,
  Calendar,
  FileText,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  Target,
  Star,
  Users,
  Clock,
  Zap,
  ArrowRight,
  ArrowLeft,
  Move,
  Bank,
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface Scenario {
  id: string;
  title: string;
  description: string;
  icon: string;
  difficulty: "Fácil" | "Médio" | "Difícil";
  maxPoints: number;
  centro_custo: string;
}

interface Interaction {
  id: string;
  scenario_id: string;
  ordem: number;
  mensagem_cliente?: string;
  messages?: string[];
}

interface InteractionResponse {
  id: string;
  interaction_id: string;
  text: string;
  points: number;
  feedback: string;
  is_positive: boolean;
  next_interaction_id?: string;
}

interface SimulacaoQualidadeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SimulacaoQualidadeModal: React.FC<SimulacaoQualidadeModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<
    "scenarios" | "interactions" | "responses"
  >("scenarios");
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [responses, setResponses] = useState<InteractionResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Scenario form state
  const [scenarioForm, setScenarioForm] = useState({
    title: "",
    description: "",
    icon: "😤",
    difficulty: "Médio" as "Fácil" | "Médio" | "Difícil",
    maxPoints: 100,
    centro_custo: "",
  });

  // Interaction form state - agora suporta múltiplas interações por cenário
  const [interactionForm, setInteractionForm] = useState({
    scenario_id: "",
    interactions: [{ ordem: 1, mensagem_cliente: "" }],
  });

  // Response form state
  const [responseForm, setResponseForm] = useState({
    interaction_id: "",
    responses: [
      {
        text: "",
        points: 0,
        feedback: "",
        is_positive: true,
        next_interaction_id: "",
      },
      {
        text: "",
        points: 0,
        feedback: "",
        is_positive: true,
        next_interaction_id: "",
      },
      {
        text: "",
        points: 0,
        feedback: "",
        is_positive: true,
        next_interaction_id: "",
      },
      {
        text: "",
        points: 0,
        feedback: "",
        is_positive: true,
        next_interaction_id: "",
      },
    ],
  });

  const [editingScenario, setEditingScenario] = useState<string | null>(null);
  const [editingInteraction, setEditingInteraction] = useState<string | null>(
    null
  );

  const availableIcons = [
    "😤",
    "😢",
    "😰",
    "🤔",
    "😴",
    "🤒",
    "💸",
    "😡",
    "🙄",
    "😭",
  ];

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Fácil":
        return "bg-green-500";
      case "Médio":
        return "bg-yellow-500";
      case "Difícil":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    try {
      const scenariosRes = await axios.get(
        "/api/simulacao/admin/cenarios"
      );
      setScenarios(scenariosRes.data);

      const interactionsRes = await axios.get(
        "/api/simulacao/admin/interacoes"
      );
      setInteractions(interactionsRes.data);

      const responsesRes = await axios.get(
        "/api/simulacao/admin/respostas"
      );
      setResponses(responsesRes.data);

      setError(null);
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
      setError("Erro ao carregar dados do servidor");
    }
    setLoading(false);
  };

  const handleSaveScenario = async () => {
    if (!scenarioForm.title || !scenarioForm.description) {
      setError("Título e descrição são obrigatórios");
      return;
    }

    setLoading(true);
    try {
      if (editingScenario) {
        await axios.put(
          `/api/simulacao/admin/cenarios/${editingScenario}`,
          scenarioForm
        );
      } else {
        await axios.post(
          "/api/simulacao/admin/cenarios",
          scenarioForm
        );
      }

      await loadData();
      setScenarioForm({
        title: "",
        description: "",
        icon: "😤",
        difficulty: "Médio",
        maxPoints: 100,
        centro_custo: "",
      });
      setEditingScenario(null);
      setError(null);
    } catch (err) {
      console.error("Erro ao salvar cenário:", err);
      setError("Erro ao salvar cenário");
    }
    setLoading(false);
  };

  const handleSaveInteractions = async () => {
    if (
      !interactionForm.scenario_id ||
      interactionForm.interactions.some((i) => !i.mensagem_cliente.trim())
    ) {
      setError(
        "Cenário é obrigatório e todas as mensagens devem estar preenchidas"
      );
      return;
    }

    setLoading(true);
    try {
      const interactionsData = {
        scenario_id: interactionForm.scenario_id,
        interactions: interactionForm.interactions.map(
          (interaction, index) => ({
            ordem: index + 1,
            mensagem_cliente: interaction.mensagem_cliente.trim(),
          })
        ),
      };

      if (editingInteraction) {
        await axios.put(
          `/api/simulacao/admin/interacoes/${editingInteraction}`,
          interactionsData
        );
      } else {
        await axios.post(
          "/api/simulacao/admin/interacoes",
          interactionsData
        );
      }

      await loadData();
      setInteractionForm({
        scenario_id: "",
        interactions: [{ ordem: 1, mensagem_cliente: "" }],
      });
      setEditingInteraction(null);
      setError(null);
    } catch (err) {
      console.error("Erro ao salvar interações:", err);
      setError("Erro ao salvar interações");
    }
    setLoading(false);
  };

  const handleSaveResponses = async () => {
    if (!responseForm.interaction_id) {
      setError("Selecione uma interação");
      return;
    }

    const validResponses = responseForm.responses.filter(
      (r) => r.text.trim() !== ""
    );
    if (validResponses.length < 2) {
      setError("Pelo menos 2 respostas são obrigatórias");
      return;
    }

    setLoading(true);
    try {
      const responsesData = {
        interaction_id: responseForm.interaction_id,
        responses: validResponses,
      };

      await axios.post(
        "/api/simulacao/admin/respostas",
        responsesData
      );

      await loadData();
      setResponseForm({
        interaction_id: "",
        responses: [
          {
            text: "",
            points: 0,
            feedback: "",
            is_positive: true,
            next_interaction_id: "",
          },
          {
            text: "",
            points: 0,
            feedback: "",
            is_positive: true,
            next_interaction_id: "",
          },
          {
            text: "",
            points: 0,
            feedback: "",
            is_positive: true,
            next_interaction_id: "",
          },
          {
            text: "",
            points: 0,
            feedback: "",
            is_positive: true,
            next_interaction_id: "",
          },
        ],
      });
      setError(null);
    } catch (err) {
      console.error("Erro ao salvar respostas:", err);
      setError("Erro ao salvar respostas");
    }
    setLoading(false);
  };

  const handleDeleteScenario = async (id: string) => {
    if (window.confirm("Tem certeza que deseja deletar este cenário?")) {
      try {
        await axios.delete(
          `/api/simulacao/admin/cenarios/${id}`
        );
        await loadData();
      } catch (err) {
        console.error("Erro ao deletar cenário:", err);
        setError("Erro ao deletar cenário");
      }
    }
  };

  const addInteraction = () => {
    setInteractionForm((prev) => ({
      ...prev,
      interactions: [
        ...prev.interactions,
        { ordem: prev.interactions.length + 1, mensagem_cliente: "" },
      ],
    }));
  };

  const updateInteraction = (index: number, value: string) => {
    setInteractionForm((prev) => ({
      ...prev,
      interactions: prev.interactions.map((interaction, i) =>
        i === index ? { ...interaction, mensagem_cliente: value } : interaction
      ),
    }));
  };

  const removeInteraction = (index: number) => {
    if (interactionForm.interactions.length > 1) {
      setInteractionForm((prev) => ({
        ...prev,
        interactions: prev.interactions.filter((_, i) => i !== index),
      }));
    }
  };

  type ResponseField =
    | "text"
    | "points"
    | "feedback"
    | "is_positive"
    | "next_interaction_id";

  const updateResponseField = (
    index: number,
    field: ResponseField,
    value: string | number | boolean
  ) => {
    setResponseForm((prev) => ({
      ...prev,
      responses: prev.responses.map((response, i) =>
        i === index ? { ...response, [field]: value } : response
      ),
    }));
  };

  // Agrupar interações por cenário
  const getInteractionsByScenario = () => {
    const grouped: { [key: string]: Interaction[] } = {};
    interactions.forEach((interaction) => {
      if (!grouped[interaction.scenario_id]) {
        grouped[interaction.scenario_id] = [];
      }
      grouped[interaction.scenario_id].push(interaction);
    });

    // Ordenar por ordem
    Object.keys(grouped).forEach((scenarioId) => {
      grouped[scenarioId].sort((a, b) => a.ordem - b.ordem);
    });

    return grouped;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                🎭 Simulação Qualidade
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                Gerencie cenários, interações e respostas das simulações
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <span className="text-red-800">{error}</span>
              </div>
            </div>
          )}

          {loading && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 border-2 border-t-transparent border-blue-600 rounded-full animate-spin"></div>
                <span className="text-blue-800">Carregando...</span>
              </div>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex mb-6 border-b border-gray-200 dark:border-gray-700">
            <Button
              variant={activeTab === "scenarios" ? "default" : "ghost"}
              onClick={() => setActiveTab("scenarios")}
              className="rounded-none border-b-2 border-transparent"
            >
              <Target className="h-4 w-4 mr-2" />
              Cenários
            </Button>
            <Button
              variant={activeTab === "interactions" ? "default" : "ghost"}
              onClick={() => setActiveTab("interactions")}
              className="rounded-none border-b-2 border-transparent"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Interações
            </Button>
            <Button
              variant={activeTab === "responses" ? "default" : "ghost"}
              onClick={() => setActiveTab("responses")}
              className="rounded-none border-b-2 border-transparent"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Respostas
            </Button>
          </div>

          <div className="overflow-y-auto max-h-[60vh]">
            {/* Scenarios Tab */}
            {activeTab === "scenarios" && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {editingScenario ? "Editar Cenário" : "Novo Cenário"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="scenario-title">Título</Label>
                        <Input
                          id="scenario-title"
                          value={scenarioForm.title}
                          onChange={(e) =>
                            setScenarioForm({
                              ...scenarioForm,
                              title: e.target.value,
                            })
                          }
                          placeholder="ex: Cliente Nervoso"
                        />
                      </div>
                      <div>
                        <Label htmlFor="scenario-icon">Ícone</Label>
                        <Select
                          value={scenarioForm.icon}
                          onValueChange={(value) =>
                            setScenarioForm({ ...scenarioForm, icon: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {availableIcons.map((icon) => (
                              <SelectItem key={icon} value={icon}>
                                <span className="text-lg mr-2">{icon}</span>
                                {icon}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="scenario-desc">Descrição</Label>
                      <Textarea
                        id="scenario-desc"
                        value={scenarioForm.description}
                        onChange={(e) =>
                          setScenarioForm({
                            ...scenarioForm,
                            description: e.target.value,
                          })
                        }
                        placeholder="Descreva o cenário de simulação..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="scenario-difficulty">Dificuldade</Label>
                        <Select
                          value={scenarioForm.difficulty}
                          onValueChange={(
                            value: "Fácil" | "Médio" | "Difícil"
                          ) =>
                            setScenarioForm({
                              ...scenarioForm,
                              difficulty: value,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Fácil">🟢 Fácil</SelectItem>
                            <SelectItem value="Médio">🟡 Médio</SelectItem>
                            <SelectItem value="Difícil">🔴 Difícil</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="scenario-points">
                          Máximo de Pontos
                        </Label>
                        <Input
                          id="scenario-points"
                          type="number"
                          value={scenarioForm.maxPoints}
                          onChange={(e) =>
                            setScenarioForm({
                              ...scenarioForm,
                              maxPoints: parseInt(e.target.value) || 100,
                            })
                          }
                          min={50}
                          max={500}
                        />
                      </div>

                      <div>
                        <Label htmlFor="scenario-centro-custo">
                          Centro de Custo
                        </Label>
                        <Select
                          value={scenarioForm.centro_custo}
                          onValueChange={(value) =>
                            setScenarioForm({
                              ...scenarioForm,
                              centro_custo: value,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o centro de custo" />
                          </SelectTrigger>
                          <SelectContent>
                            {[
                              "ETA",
                              "ANTARES",
                              "BANCO GAMA",
                              "BANCO DELTA",
                              "GAMA",
                              "MU",
                              "SIGMA",
                              "PAGSEGURO",
                              "PI",
                              "BANCOALFA FIXA",
                              "BANCOALFA VARIAVEL",
                              "NU",
                            ].map((cc) => (
                              <SelectItem key={cc} value={cc}>
                                {cc}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={handleSaveScenario} disabled={loading}>
                        <Save className="h-4 w-4 mr-2" />
                        {editingScenario ? "Atualizar" : "Salvar"}
                      </Button>
                      {editingScenario && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setEditingScenario(null);
                            setScenarioForm({
                              title: "",
                              description: "",
                              icon: "😤",
                              difficulty: "Médio",
                              maxPoints: 100,
                              centro_custo: "",
                            });
                          }}
                        >
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {scenarios.map((scenario) => (
                    <Card key={scenario.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{scenario.icon}</span>
                            <div>
                              <CardTitle className="text-lg">
                                {scenario.title}
                              </CardTitle>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge
                                  className={`${getDifficultyColor(
                                    scenario.difficulty
                                  )} text-white`}
                                >
                                  {scenario.difficulty}
                                </Badge>
                                <Badge variant="secondary">
                                  <Star className="h-3 w-3 mr-1" />
                                  {scenario.maxPoints} pts
                                </Badge>
                                <Badge variant="secondary">
                                  <Star className="h-3 w-3 mr-1" />
                                  {scenario.centro_custo}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingScenario(scenario.id);
                                setScenarioForm({
                                  title: scenario.title,
                                  description: scenario.description,
                                  icon: scenario.icon,
                                  difficulty: scenario.difficulty,
                                  maxPoints: scenario.maxPoints,
                                  centro_custo: scenario.centro_custo || "",
                                });
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteScenario(scenario.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-gray-600">
                          {scenario.description}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Interactions Tab */}
            {activeTab === "interactions" && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {editingInteraction
                        ? "Editar Interações"
                        : "Novas Interações"}
                    </CardTitle>
                    <CardDescription>
                      Crie a sequência de mensagens do cliente (Cliente →
                      Operador → Cliente → Operador...)
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="interaction-scenario">Cenário</Label>
                      <Select
                        value={interactionForm.scenario_id}
                        onValueChange={(value) =>
                          setInteractionForm({
                            ...interactionForm,
                            scenario_id: value,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um cenário" />
                        </SelectTrigger>
                        <SelectContent>
                          {scenarios.map((scenario) => (
                            <SelectItem key={scenario.id} value={scenario.id}>
                              <span className="mr-2">{scenario.icon}</span>
                              {scenario.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <Label>Sequência de Mensagens do Cliente</Label>
                        <Button size="sm" onClick={addInteraction}>
                          <Plus className="h-4 w-4 mr-1" />
                          Adicionar Interação
                        </Button>
                      </div>
                      <div className="space-y-3">
                        {interactionForm.interactions.map(
                          (interaction, index) => (
                            <div key={index} className="border rounded-lg p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge
                                  variant="outline"
                                  className="flex-shrink-0"
                                >
                                  Interação {index + 1}
                                </Badge>
                                <div className="flex items-center gap-1 text-sm text-gray-500">
                                  <MessageSquare className="h-3 w-3" />
                                  Cliente fala
                                  <ArrowRight className="h-3 w-3" />
                                  <span className="text-blue-600">
                                    Operador responde
                                  </span>
                                </div>
                                {interactionForm.interactions.length > 1 && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => removeInteraction(index)}
                                    className="ml-auto"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                              <Textarea
                                value={interaction.mensagem_cliente}
                                onChange={(e) =>
                                  updateInteraction(index, e.target.value)
                                }
                                placeholder="Digite o que o cliente fala nesta interação..."
                                rows={2}
                              />
                            </div>
                          )
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={handleSaveInteractions}
                        disabled={loading}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {editingInteraction ? "Atualizar" : "Salvar Sequência"}
                      </Button>
                      {editingInteraction && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setEditingInteraction(null);
                            setInteractionForm({
                              scenario_id: "",
                              interactions: [
                                { ordem: 1, mensagem_cliente: "" },
                              ],
                            });
                          }}
                        >
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">
                    Interações por Cenário
                  </h3>
                  {Object.entries(getInteractionsByScenario()).map(
                    ([scenarioId, scenarioInteractions]) => {
                      const scenario = scenarios.find(
                        (s) => s.id === scenarioId
                      );
                      if (!scenario) return null;

                      return (
                        <Card key={scenarioId}>
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-lg flex items-center gap-2">
                                <span>{scenario.icon}</span>
                                {scenario.title}
                              </CardTitle>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingInteraction(scenarioId);
                                  setInteractionForm({
                                    scenario_id: scenarioId,
                                    interactions: scenarioInteractions.map(
                                      (inter) => ({
                                        id: inter.id,
                                        ordem: inter.ordem,
                                        mensagem_cliente:
                                          inter.mensagem_cliente,
                                      })
                                    ),
                                  });

                                  // Garante que o React aplique os estados antes de renderizar a aba
                                  setTimeout(
                                    () => setActiveTab("interactions"),
                                    0
                                  );
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {scenarioInteractions.map(
                                (interaction, index) => {
                                  return (
                                    <div
                                      key={interaction.id}
                                      className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg dark:bg-slate-600"
                                    >
                                      <Badge variant="outline" className="mt-1">
                                        {interaction.ordem}
                                      </Badge>
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                          <MessageSquare className="h-4 w-4 text-blue-600 dark:text-white" />
                                          <span className="text-sm font-medium text-blue-600  dark:text-white">
                                            Cliente:
                                          </span>
                                        </div>
                                        {interaction.messages?.map((msg, i) => (
                                          <p
                                            key={i}
                                            className="text-sm text-gray-700 dark:text-white"
                                          >
                                            "{msg}"
                                          </p>
                                        )) || (
                                          <p className="text-sm text-gray-700 dark:text-white">
                                            [sem mensagem]
                                          </p>
                                        )}
                                      </div>
                                      {index <
                                        scenarioInteractions.length - 1 && (
                                        <ArrowRight className="h-4 w-4 text-gray-400 mt-1" />
                                      )}
                                    </div>
                                  );
                                }
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    }
                  )}
                </div>
              </div>
            )}

            {/* Responses Tab */}
            {activeTab === "responses" && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Adicionar Respostas</CardTitle>
                    <CardDescription>
                      Adicione as opções de resposta para uma interação
                      específica
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="response-interaction">Interação</Label>
                      <Select
                        value={responseForm.interaction_id}
                        onValueChange={(value) =>
                          setResponseForm({
                            ...responseForm,
                            interaction_id: value,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma interação" />
                        </SelectTrigger>
                        <SelectContent>
                          {interactions.map((interaction) => {
                            const scenario = scenarios.find(
                              (s) => s.id === interaction.scenario_id
                            );
                            return (
                              <SelectItem
                                key={interaction.id}
                                value={interaction.id}
                              >
                                {scenario?.title} - Interação{" "}
                                {interaction.ordem}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {responseForm.responses.map((response, index) => (
                      <Card key={index} className="p-4">
                        <h4 className="font-medium mb-3">
                          Opção de Resposta {index + 1}
                        </h4>
                        <div className="space-y-3">
                          <div>
                            <Label>Texto da Resposta</Label>
                            <Textarea
                              value={response.text}
                              onChange={(e) =>
                                updateResponseField(
                                  index,
                                  "text",
                                  e.target.value
                                )
                              }
                              placeholder="Digite o que o operador pode responder..."
                              rows={2}
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <Label>Pontos</Label>
                              <Input
                                type="number"
                                value={response.points}
                                onChange={(e) =>
                                  updateResponseField(
                                    index,
                                    "points",
                                    parseInt(e.target.value) || 0
                                  )
                                }
                                min={0}
                                max={200}
                                placeholder="0"
                              />
                            </div>
                            <div>
                              <Label>Tipo</Label>
                              <Select
                                value={
                                  response.is_positive ? "positive" : "negative"
                                }
                                onValueChange={(value) =>
                                  updateResponseField(
                                    index,
                                    "is_positive",
                                    value === "positive"
                                  )
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="positive">
                                    ✅ Positiva
                                  </SelectItem>
                                  <SelectItem value="negative">
                                    ❌ Negativa
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div>
                            <Label>Feedback</Label>
                            <Textarea
                              value={response.feedback}
                              onChange={(e) =>
                                updateResponseField(
                                  index,
                                  "feedback",
                                  e.target.value
                                )
                              }
                              placeholder="Explique por que esta resposta é boa/ruim e dê dicas..."
                              rows={2}
                            />
                          </div>
                          <div>
                            <Label>Próxima Interação</Label>
                            <Select
                              value={String(
                                response.next_interaction_id || "none"
                              )}
                              onValueChange={(value) =>
                                updateResponseField(
                                  index,
                                  "next_interaction_id",
                                  value === "none" ? null : value
                                )
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione a próxima interação" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">
                                  Nenhuma (fim do fluxo)
                                </SelectItem>
                                {interactions
                                  .filter(
                                    (i) => i.id !== responseForm.interaction_id
                                  )
                                  .map((i) => {
                                    return (
                                      <SelectItem
                                        key={i.id}
                                        value={String(i.id)}
                                      >
                                        <span
                                          title={i.messages?.[0]}
                                          className="block truncate max-w-[300px]"
                                        >
                                          Interação {i.ordem} -{" "}
                                          {i.messages?.[0] || "[sem mensagem]"}
                                        </span>
                                      </SelectItem>
                                    );
                                  })}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </Card>
                    ))}

                    <Button onClick={handleSaveResponses} disabled={loading}>
                      <Save className="h-4 w-4 mr-2" />
                      Salvar Respostas
                    </Button>
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">
                    Respostas Cadastradas
                  </h3>
                  {interactions.map((interaction) => {
                    const interactionResponses = responses.filter(
                      (r) => r.interaction_id === interaction.id
                    );
                    if (interactionResponses.length === 0) return null;

                    const scenario = scenarios.find(
                      (s) => s.id === interaction.scenario_id
                    );

                    return (
                      <Card key={interaction.id}>
                        <CardHeader>
                          <CardTitle className="text-lg">
                            {scenario?.title} - Interação {interaction.ordem}
                          </CardTitle>
                          <CardDescription>
                            "{interaction.mensagem_cliente}"
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {interactionResponses.map((response, index) => (
                              <div
                                key={response.id}
                                className="border rounded-lg p-3"
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-medium">
                                    Opção {index + 1}
                                  </span>
                                  <div className="flex gap-2">
                                    <Badge variant="outline">
                                      {response.points} pts
                                    </Badge>
                                    <Badge
                                      variant={
                                        response.is_positive
                                          ? "default"
                                          : "destructive"
                                      }
                                    >
                                      {response.is_positive
                                        ? "✅ Positiva"
                                        : "❌ Negativa"}
                                    </Badge>
                                  </div>
                                </div>
                                <p className="text-sm text-gray-700 mb-2">
                                  {response.text}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {response.feedback}
                                </p>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimulacaoQualidadeModal;
