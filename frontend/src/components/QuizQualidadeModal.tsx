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
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Theme {
  id: string;
  codigo: string;
  title: string;
  description: string;
  centro_custo: string;
}

interface Question {
  id: string;
  tema_id: string;
  question: string;
  available_date: string;
  centro_custo: string;
}

interface Answer {
  id: string;
  question_id: string;
  text: string;
  explanation: string;
  points: number;
}

interface QuizQualidadeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const QuizQualidadeModal: React.FC<QuizQualidadeModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Theme form state
  const [themeForm, setThemeForm] = useState({
    codigo: "",
    title: "",
    description: "",
    centro_custo: "",
  });

  // Question form state
  const [questionForm, setQuestionForm] = useState({
    tema_id: "",
    question: "",
    available_date: undefined as Date | undefined,
    centro_custo: "",
  });

  // Answer form state
  const [answerForm, setAnswerForm] = useState({
    question_id: "",
    answers: [
      { text: "", explanation: "", points: 0 },
      { text: "", explanation: "", points: 0 },
      { text: "", explanation: "", points: 0 },
      { text: "", explanation: "", points: 0 },
    ],
  });

  const [editingTheme, setEditingTheme] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null);

  const loadAllQuestions = async () => {
    try {
      const response = await axios.get(
        "/api/quiz/perguntas/listar"
      );
      setQuestions(response.data || []);
    } catch (err) {
      console.error("Erro ao carregar todas as perguntas:", err);
    }
  };

  const [activeTab, setActiveTab] = useState<
    "themes" | "questions" | "answers"
  >("themes");

  useEffect(() => {
    if (activeTab === "questions") {
      loadAllQuestions(); // <-- novo
    }
  }, [activeTab]);

  useEffect(() => {
    if (isOpen) {
      loadThemes();
      loadAnswers();
    }
  }, [isOpen]);

  useEffect(() => {
    if (questionForm.tema_id) {
      loadQuestions();
    }
  }, [questionForm.tema_id, questionForm.centro_custo]);

  const loadThemes = async () => {
    try {
      const response = await axios.get("/api/quiz/temas");
      setThemes(response.data || []);
    } catch (err) {
      console.error("Erro ao carregar temas:", err);
      setError("Erro ao carregar temas");
    }
  };

  const loadQuestions = async () => {
    try {
      const temaSelecionado = themes.find((t) => t.id === questionForm.tema_id);

      if (!temaSelecionado) {
        console.warn("Tema não encontrado pelo ID:", questionForm.tema_id);
        return;
      }

      const response = await axios.get(
        "/api/quiz/perguntas",
        {
          params: {
            tema: temaSelecionado.codigo, // Aqui vai o CÓDIGO correto
            usuario: localStorage.getItem("nome") || "QUALIDADE",
            centro_custo: questionForm.centro_custo || "GERAL",
          },
        }
      );

      setQuestions(response.data || []);
    } catch (err) {
      console.error("Erro ao carregar perguntas:", err);
    }
  };

  const loadAnswers = async () => {
    try {
      const response = await axios.get(
        "/api/quiz/respostas/todas"
      );
      setAnswers(response.data || []);
    } catch (err) {
      console.error("Erro ao carregar respostas:", err);
    }
  };

  const handleSaveTheme = async () => {
    if (!themeForm.codigo || !themeForm.title) {
      setError("Código e título são obrigatórios");
      return;
    }

    setLoading(true);
    try {
      if (editingTheme) {
        await axios.put(
          `/api/quiz/temas/${editingTheme}`,
          themeForm
        );
      } else {
        await axios.post("/api/quiz/temas/criar", themeForm);
      }

      setThemeForm({
        codigo: "",
        title: "",
        description: "",
        centro_custo: "",
      });
      setEditingTheme(null);
      await loadThemes();
      setError(null);
    } catch (err) {
      console.error("Erro ao salvar tema:", err);
      setError("Erro ao salvar tema");
    }
    setLoading(false);
  };

  const handleSaveQuestion = async () => {
    if (
      !questionForm.tema_id ||
      !questionForm.question ||
      !questionForm.available_date
    ) {
      setError("Todos os campos são obrigatórios");
      return;
    }

    setLoading(true);
    try {
      const data = {
        ...questionForm,
        available_date: format(questionForm.available_date, "yyyy-MM-dd"),
      };

      if (editingQuestion) {
        await axios.put(
          `http:///quiz/perguntas/${editingQuestion}`,
          data
        );
      } else {
        await axios.post("http:///quiz/perguntas", data);
      }

      setQuestionForm({
        tema_id: "",
        question: "",
        available_date: undefined,
        centro_custo: "",
      });
      setEditingQuestion(null);
      await loadAllQuestions();
      setError(null);
    } catch (err) {
      console.error("Erro ao salvar pergunta:", err);
      setError("Erro ao salvar pergunta");
    }
    setLoading(false);
  };

  const handleSaveAnswers = async () => {
    if (!answerForm.question_id) {
      setError("Selecione uma pergunta");
      return;
    }

    const validAnswers = answerForm.answers.filter((a) => a.text.trim() !== "");
    if (validAnswers.length < 2) {
      setError("Pelo menos 2 respostas são obrigatórias");
      return;
    }

    setLoading(true);
    try {
      await axios.post("http:///quiz/respostas", {
        question_id: answerForm.question_id,
        answers: validAnswers,
      });

      setAnswerForm({
        question_id: "",
        answers: [
          { text: "", explanation: "", points: 0 },
          { text: "", explanation: "", points: 0 },
          { text: "", explanation: "", points: 0 },
          { text: "", explanation: "", points: 0 },
        ],
      });
      await loadAnswers();
      setError(null);
    } catch (err) {
      console.error("Erro ao salvar respostas:", err);
      setError("Erro ao salvar respostas");
    }
    setLoading(false);
  };

  const handleDeleteTheme = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir este tema?")) {
      try {
        await axios.delete(`/api/quiz/temas/${id}`);
        await loadAllQuestions();
      } catch (err) {
        console.error("Erro ao excluir tema:", err);
        setError("Erro ao excluir tema");
      }
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta pergunta?")) {
      try {
        await axios.delete(`/api/quiz/perguntas/${id}`);
        await loadAllQuestions();
      } catch (err) {
        console.error("Erro ao excluir pergunta:", err);
        setError("Erro ao excluir pergunta");
      }
    }
  };

  const updateAnswerField = (
    index: number,
    field: "text" | "explanation" | "points",
    value: string | number
  ) => {
    const newAnswers = [...answerForm.answers];
    newAnswers[index] = { ...newAnswers[index], [field]: value };
    setAnswerForm({ ...answerForm, answers: newAnswers });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                Quiz Qualidade
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                Gerencie temas, perguntas e respostas dos quizzes
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

          {/* Navegação por Abas */}
          <div className="flex mb-6 border-b border-gray-200 dark:border-gray-700">
            <Button
              variant={activeTab === "themes" ? "default" : "ghost"}
              onClick={() => setActiveTab("themes")}
              className="rounded-none border-b-2 border-transparent"
            >
              <FileText className="h-4 w-4 mr-2" />
              Temas
            </Button>
            <Button
              variant={activeTab === "questions" ? "default" : "ghost"}
              onClick={() => setActiveTab("questions")}
              className="rounded-none border-b-2 border-transparent"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Perguntas
            </Button>
            <Button
              variant={activeTab === "answers" ? "default" : "ghost"}
              onClick={() => setActiveTab("answers")}
              className="rounded-none border-b-2 border-transparent"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Respostas
            </Button>
          </div>

          <div className="overflow-y-auto max-h-[60vh]">
            {/* Aba Temas */}
            {activeTab === "themes" && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {editingTheme ? "Editar Tema" : "Novo Tema"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="tema-codigo">Código do Tema</Label>
                      <Input
                        id="tema-codigo"
                        value={themeForm.codigo}
                        onChange={(e) =>
                          setThemeForm({ ...themeForm, codigo: e.target.value })
                        }
                        placeholder="ex: argumentacao"
                      />
                    </div>
                    <div>
                      <Label htmlFor="tema-title">Título</Label>
                      <Input
                        id="tema-title"
                        value={themeForm.title}
                        onChange={(e) =>
                          setThemeForm({ ...themeForm, title: e.target.value })
                        }
                        placeholder="ex: Técnicas de Argumentação"
                      />
                    </div>
                    <div>
                      <Label htmlFor="tema-desc">Descrição</Label>
                      <Textarea
                        id="tema-desc"
                        value={themeForm.description}
                        onChange={(e) =>
                          setThemeForm({
                            ...themeForm,
                            description: e.target.value,
                          })
                        }
                        placeholder="Descreva o tema..."
                      />
                    </div>
                    <div>
                      <Label htmlFor="tema-centro-custo">Centro de Custo</Label>
                      <Select
                        value={themeForm.centro_custo}
                        onValueChange={(value) =>
                          setThemeForm({ ...themeForm, centro_custo: value })
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
                            "VEGA",
                          ].map((cc) => (
                            <SelectItem key={cc} value={cc}>
                              {cc}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={handleSaveTheme} disabled={loading}>
                        <Save className="h-4 w-4 mr-2" />
                        {editingTheme ? "Atualizar" : "Salvar"}
                      </Button>
                      {editingTheme && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setEditingTheme(null);
                            setThemeForm({
                              codigo: "",
                              title: "",
                              description: "",
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
                  {themes.map((theme) => (
                    <Card key={theme.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">
                            {theme.title}
                          </CardTitle>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingTheme(theme.id);
                                setThemeForm({
                                  codigo: theme.codigo,
                                  title: theme.title,
                                  description: theme.description,
                                  centro_custo: theme.centro_custo || "",
                                });
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteTheme(theme.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <Badge variant="secondary">{theme.codigo}</Badge>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-gray-600">
                          {theme.description}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Centro de Custo: {theme.centro_custo || "Geral"}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Aba Perguntas */}
            {activeTab === "questions" && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {editingQuestion ? "Editar Pergunta" : "Nova Pergunta"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="question-tema">Tema</Label>
                      <Select
                        value={questionForm.tema_id}
                        onValueChange={(value) =>
                          setQuestionForm({ ...questionForm, tema_id: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um tema" />
                        </SelectTrigger>
                        <SelectContent>
                          {themes.map((theme) => (
                            <SelectItem key={theme.id} value={theme.id}>
                              {theme.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="question-text">Pergunta</Label>
                      <Textarea
                        id="question-text"
                        value={questionForm.question}
                        onChange={(e) =>
                          setQuestionForm({
                            ...questionForm,
                            question: e.target.value,
                          })
                        }
                        placeholder="Digite a pergunta..."
                      />
                    </div>
                    <div>
                      <Label>Data de Disponibilização</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !questionForm.available_date &&
                                "text-muted-foreground"
                            )}
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {questionForm.available_date ? (
                              format(questionForm.available_date, "dd/MM/yyyy")
                            ) : (
                              <span>Selecione uma data</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={questionForm.available_date}
                            onSelect={(date) =>
                              setQuestionForm({
                                ...questionForm,
                                available_date: date,
                              })
                            }
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div>
                      <Label>Centro de Custo da Pergunta</Label>
                      <Select
                        value={questionForm.centro_custo}
                        onValueChange={(value) =>
                          setQuestionForm({
                            ...questionForm,
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
                    <div className="flex gap-2">
                      <Button onClick={handleSaveQuestion} disabled={loading}>
                        <Save className="h-4 w-4 mr-2" />
                        {editingQuestion ? "Atualizar" : "Salvar"}
                      </Button>
                      {editingQuestion && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setEditingQuestion(null);
                            setQuestionForm({
                              tema_id: "",
                              question: "",
                              available_date: undefined,
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

                <div className="space-y-4">
                  {questions.map((question) => (
                    <Card key={question.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">
                              {question.question}
                            </CardTitle>
                            <CardDescription>
                              {
                                themes.find((t) => t.id === question.tema_id)
                                  ?.title
                              }{" "}
                              - Disponível em:{" "}
                              {format(
                                new Date(question.available_date),
                                "dd/MM/yyyy"
                              )}
                            </CardDescription>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingQuestion(question.id);
                                setQuestionForm({
                                  tema_id: question.tema_id,
                                  question: question.question,
                                  available_date: new Date(
                                    question.available_date
                                  ),
                                  centro_custo: question.centro_custo || "",
                                });
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteQuestion(question.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Aba Respostas */}
            {activeTab === "answers" && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Adicionar Respostas</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="answer-question">Pergunta</Label>
                      <Select
                        value={answerForm.question_id}
                        onValueChange={(value) =>
                          setAnswerForm({ ...answerForm, question_id: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma pergunta" />
                        </SelectTrigger>
                        <SelectContent>
                          {questions.map((question) => (
                            <SelectItem key={question.id} value={question.id}>
                              {question.question.substring(0, 50)}...
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {answerForm.answers.map((answer, index) => (
                      <Card key={index} className="p-4">
                        <h4 className="font-medium mb-3">
                          Resposta {index + 1}
                        </h4>
                        <div className="space-y-3">
                          <div>
                            <Label>Texto da Resposta</Label>
                            <Input
                              value={answer.text}
                              onChange={(e) =>
                                updateAnswerField(index, "text", e.target.value)
                              }
                              placeholder="Digite o texto da resposta..."
                            />
                          </div>
                          <div>
                            <Label>Explicação</Label>
                            <Textarea
                              value={answer.explanation}
                              onChange={(e) =>
                                updateAnswerField(
                                  index,
                                  "explanation",
                                  e.target.value
                                )
                              }
                              placeholder="Explique por que esta resposta está correta/incorreta..."
                            />
                          </div>
                          <div>
                            <Label>Pontos (0, 50 ou 100)</Label>
                            <Select
                              value={answer.points.toString()}
                              onValueChange={(value) =>
                                updateAnswerField(
                                  index,
                                  "points",
                                  parseInt(value)
                                )
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="0">
                                  0 pontos (Incorreta)
                                </SelectItem>
                                <SelectItem value="50">
                                  50 pontos (Parcialmente correta)
                                </SelectItem>
                                <SelectItem value="100">
                                  100 pontos (Correta)
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </Card>
                    ))}

                    <Button onClick={handleSaveAnswers} disabled={loading}>
                      <Save className="h-4 w-4 mr-2" />
                      Salvar Respostas
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizQualidadeModal;
