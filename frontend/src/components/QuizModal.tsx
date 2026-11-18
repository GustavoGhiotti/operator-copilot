import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  X,
  CheckCircle,
  XCircle,
  MessageSquare,
  Zap,
  Volume2,
  Search,
  Users,
  Target,
  ArrowLeft,
  Trophy,
  Lock,
  Calendar,
  Gift,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useQuizSystem } from "@/hooks/useQuizSystem";
import QuizScore from "./QuizScore";
import QuizRanking from "./QuizRanking";
import QuizRewards from "./QuizRewards";

interface QuizAnswer {
  id: number;
  text: string;
  points: number;
  explanation: string;
}

interface QuizQuestion {
  question: string;
  answers: QuizAnswer[];
}

interface QuizThemeData {
  id: string;
  codigo: string;
  title: string;
  description: string;
  quantidade_perguntas?: number;
}

interface QuizModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const QuizModal: React.FC<QuizModalProps> = ({ isOpen, onClose }) => {
  const {
    userQuizData,
    setUserQuizData,
    addPoints,
    isThemeCompletedToday,
    getThemePoints,
  } = useQuizSystem();
  const [themes, setThemes] = useState<QuizThemeData[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [sessionPoints, setSessionPoints] = useState(0);
  const [completedThemesToday, setCompletedThemesToday] = useState<string[]>(
    []
  );
  const [reloadPontuacao, setReloadPontuacao] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"quiz" | "ranking" | "rewards">(
    "quiz"
  );
  const [selectedAnswerId, setSelectedAnswerId] = useState<number | null>(null);

  const userName = localStorage.getItem("nomeCompleto")?.trim().toUpperCase();
  const centroCusto = localStorage.getItem("centroCusto");

  useEffect(() => {
    const nome = localStorage.getItem("nomeCompleto")?.trim().toUpperCase();

    axios
      .get("/api/quiz/concluidos", {
        params: { usuario: nome },
      })
      .then((res) => {
        const ids = (res.data.concluidos || []).map((id: number) =>
          id.toString()
        );
        setCompletedThemesToday(ids);
      })
      .catch(() => {
        setCompletedThemesToday([]);
      });
  }, []);

  useEffect(() => {
    const centroCusto = localStorage
      .getItem("centroCusto")
      ?.trim()
      .toUpperCase();
    axios
      .get("http:///quiz/temas", {
        params: { centro_custo: centroCusto },
      })
      .then((res) => {
        if (Array.isArray(res.data)) {
          setThemes(res.data);
        } else {
          console.error("Formato inesperado de dados para temas:", res.data);
          setThemes([]);
        }
      })
      .catch((err) => {
        console.error("Erro ao carregar temas:", err);
        setThemes([]);
      });
  }, []);

  const handleThemeSelect = async (themeCodigo: string) => {
    if (completedThemesToday.includes(themeCodigo)) return;
    const centroCusto = localStorage
      .getItem("centroCusto")
      ?.trim()
      .toUpperCase();
    setSelectedTheme(themeCodigo);

    try {
      const res = await axios.get("/api/quiz/perguntas/listar", {
        params: {
          tema: themeCodigo,
          usuario: userName,
          centro_custo: centroCusto,
        },
      });

      setQuestions(res.data);
      setCurrentQuestion(0);
      setSelectedAnswer(null);
      setShowResult(false);
      setQuizCompleted(false);
      setEarnedPoints(0);
      setSessionPoints(0);
      setQuizError(null);
    } catch (err) {
      console.error("Erro ao carregar perguntas:", err);
      setQuizError(err?.response?.data?.erro || "Erro ao carregar perguntas");
    }
  };

  const handleAnswerSelect = (answerIndex: number) => {
    setSelectedAnswer(answerIndex);
  };

  const handleShowResult = () => {
    if (selectedAnswer === null) return;

    const currentQ = questions[currentQuestion];
    const points = currentQ.answers[selectedAnswer].points;
    setEarnedPoints(points);
    setSessionPoints((prev) => prev + points);
    setShowResult(true);
  };

  const handleNextQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion((prev) => prev + 1);
      setSelectedAnswer(null);
      setShowResult(false);
      setEarnedPoints(0);
    } else {
      if (selectedTheme && userName) {
        const codigo = themes.find((t) => t.id === selectedTheme)?.codigo;

        axios
          .post("/api/quiz/finalizar", {
            usuario: userName,
            id_tema: selectedTheme,
            pontos: sessionPoints,
          })
          .then(() => {
            // Atualiza temas concluídos
            axios
              .get("/api/quiz/concluidos", {
                params: { usuario: userName },
              })
              .then((res) => {
                const ids = (res.data.concluidos || []).map((id: number) =>
                  id.toString()
                );
                setCompletedThemesToday(ids);
              });

            // Atualiza pontuação total
            axios
              .get("/api/quiz/pontuacao_total", {
                params: { usuario: userName },
              })
              .then((res) => {
                const data = res.data;
                const progress: any = {};

                Object.entries(data.porTema).forEach(
                  ([idTema, pontos]: any) => {
                    progress[idTema] = {
                      totalPoints: pontos,
                      completedToday: true,
                      lastCompleted: new Date().toDateString(),
                    };
                  }
                );

                setUserQuizData({
                  totalPoints: data.totalPoints,
                  dailyPoints: data.dailyPoints,
                  progress,
                });

                setQuizCompleted(true);
              });
          });

        setReloadPontuacao(true);
      }
    }
  };

  useEffect(() => {
    if (!reloadPontuacao) return;
    const nome = localStorage.getItem("nomeCompleto")?.trim().toUpperCase();
    if (!nome) return;

    axios
      .get("/api/quiz/pontuacao_total", {
        params: { usuario: nome },
      })
      .then((res) => {
        const data = res.data;
        const progress: any = {};

        Object.entries(data.porTema).forEach(([idTema, pontos]: any) => {
          progress[idTema] = {
            totalPoints: pontos,
            completedToday: true,
            lastCompleted: new Date().toDateString(),
          };
        });

        setUserQuizData({
          totalPoints: data.totalPoints,
          dailyPoints: data.dailyPoints,
          progress,
        });

        setReloadPontuacao(false);
      })
      .catch((err) => {
        console.error("Erro ao atualizar pontuação:", err);
        setReloadPontuacao(false);
      });
  }, [reloadPontuacao]);

  const handleBackToThemes = () => {
    setSelectedTheme(null);
    setQuestions([]);
    setCurrentQuestion(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setQuizCompleted(false);
    setEarnedPoints(0);
    setSessionPoints(0);
  };

  const handlePointsUpdate = (newPoints: number) => {
    setUserQuizData((prev) => ({
      ...prev,
      totalPoints: newPoints,
    }));
  };

  const resetQuiz = () => {
    setCurrentQuestion(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setQuizCompleted(false);
    setEarnedPoints(0);
    setSessionPoints(0);
  };

  if (!isOpen) return null;

  if (quizCompleted && selectedTheme) {
    const theme = themes.find((t) => t.id === selectedTheme);

    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Quiz Concluído!
              </h1>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <Card className="text-center">
              <CardHeader>
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <Trophy className="h-8 w-8 text-green-600" />
                </div>
                <CardTitle className="text-xl">{theme?.title}</CardTitle>
                <CardDescription>
                  Parabéns! Você ganhou {sessionPoints} pontos!
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="text-center">
                  <div className="text-4xl font-bold text-green-600 mb-2">
                    +{sessionPoints}
                  </div>
                  <p className="text-lg text-gray-600">Pontos conquistados</p>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Lock className="h-5 w-5 text-yellow-600" />
                    <span className="font-semibold text-yellow-800">
                      Quiz bloqueado até amanhã
                    </span>
                  </div>
                  <p className="text-sm text-yellow-700">
                    Novas perguntas estarão disponíveis amanhã!
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={handleBackToThemes}
                    className="flex-1"
                  >
                    Outros Temas
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

  if (selectedTheme) {
    const theme = themes.find((t) => t.id === selectedTheme);

    if (quizError) {
      return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full p-6">
            <div className="text-center">
              <h2 className="text-xl font-bold mb-4">
                Não foi possível iniciar o quiz
              </h2>
              <p className="text-white-600 mb-6">{quizError}</p>
              <Button onClick={handleBackToThemes}>Voltar</Button>
            </div>
          </div>
        </div>
      );
    }

    if (questions.length === 0) {
      return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full p-6">
            <div className="text-center">
              <h2 className="text-xl font-bold mb-4">
                Perguntas não disponíveis
              </h2>
              <p className="text-gray-600 mb-6">
                Não há perguntas disponíveis para este tema hoje.
              </p>
              <Button onClick={handleBackToThemes}>Voltar</Button>
            </div>
          </div>
        </div>
      );
    }

    const currentQ = questions[currentQuestion];

    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={handleBackToThemes}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {theme?.title}
                  </h1>
                  <p className="text-gray-600 dark:text-gray-300">
                    Pergunta {currentQuestion + 1} de {questions.length} •{" "}
                    {sessionPoints} pontos ganhos
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{currentQ.question}</CardTitle>
              </CardHeader>

              <CardContent className="space-y-6">
                <RadioGroup
                  value={selectedAnswer?.toString()}
                  onValueChange={(value) => handleAnswerSelect(parseInt(value))}
                >
                  {currentQ.answers.map((answer: QuizAnswer, index: number) => (
                    <div
                      key={index}
                      className="flex items-center space-x-2 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <RadioGroupItem
                        value={index.toString()}
                        id={`option-${index}`}
                      />
                      <Label
                        htmlFor={`option-${index}`}
                        className="flex-1 cursor-pointer"
                      >
                        {answer.text}
                      </Label>
                      {showResult && selectedAnswer === index && (
                        <Badge
                          variant={
                            answer.points === 100
                              ? "default"
                              : answer.points === 50
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {answer.points} pts
                        </Badge>
                      )}
                    </div>
                  ))}
                </RadioGroup>

                {showResult && selectedAnswer !== null && (
                  <div
                    className={`p-4 rounded-lg ${
                      earnedPoints === 100
                        ? "bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800"
                        : earnedPoints === 50
                        ? "bg-yellow-50 border border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800"
                        : "bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {earnedPoints === 100 ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : earnedPoints === 50 ? (
                        <Target className="h-5 w-5 text-yellow-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                      <span
                        className={`font-medium ${
                          earnedPoints === 100
                            ? "text-green-800 dark:text-green-300"
                            : earnedPoints === 50
                            ? "text-yellow-800 dark:text-yellow-300"
                            : "text-red-800 dark:text-red-300"
                        }`}
                      >
                        {earnedPoints === 100
                          ? "Excelente!"
                          : earnedPoints === 50
                          ? "Parcialmente correto"
                          : "Incorreto"}{" "}
                        (+{earnedPoints} pontos)
                      </span>
                    </div>

                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {currentQ.answers[selectedAnswer].explanation}
                    </p>
                  </div>
                )}

                <div className="flex gap-3">
                  {!showResult ? (
                    <Button
                      onClick={handleShowResult}
                      disabled={selectedAnswer === null}
                      className="flex-1"
                    >
                      Verificar Resposta
                    </Button>
                  ) : (
                    <Button onClick={handleNextQuestion} className="flex-1">
                      {currentQuestion < questions.length - 1
                        ? "Próxima Pergunta"
                        : "Finalizar Quiz"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Tela principal com abas
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                Quiz de Negociação
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                Teste seus conhecimentos e ganhe pontos!
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navegação por Abas */}
          <div className="flex mb-6 border-b border-gray-200 dark:border-gray-700">
            <Button
              variant={activeTab === "quiz" ? "default" : "ghost"}
              onClick={() => setActiveTab("quiz")}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Quiz
            </Button>
            <Button
              variant={activeTab === "ranking" ? "default" : "ghost"}
              onClick={() => setActiveTab("ranking")}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
            >
              <Trophy className="h-4 w-4 mr-2" />
              Ranking
            </Button>
            <Button
              variant={activeTab === "rewards" ? "default" : "ghost"}
              onClick={() => setActiveTab("rewards")}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
            >
              <Gift className="h-4 w-4 mr-2" />
              Prêmios
            </Button>
          </div>

          {/* Conteúdo das Abas */}
          {activeTab === "quiz" ? (
            <div>
              <div className="mb-6">
                <QuizScore
                  totalPoints={userQuizData.totalPoints}
                  dailyPoints={userQuizData.dailyPoints}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {themes.map((theme) => {
                  const isCompleted = completedThemesToday.includes(
                    theme.id.toString()
                  );
                  const themePoints = getThemePoints(theme.id.toString());

                  return (
                    <Card
                      key={theme.codigo}
                      className={`transition-all duration-200 hover:shadow-lg hover:scale-[1.02] 
                          ${
                            isCompleted
                              ? "bg-muted opacity-60 cursor-not-allowed"
                              : "bg-white border-2 border-blue-200 cursor-pointer"
                          }
                        `}
                      onClick={() => {
                        if (!isCompleted) {
                          handleThemeSelect(theme.codigo);
                        }
                      }}
                    >
                      <CardHeader className="text-center pb-4">
                        <div
                          className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-3 ${
                            isCompleted ? "bg-gray-200" : "bg-blue-50"
                          }`}
                        >
                          {theme.codigo === "argumentacao" && (
                            <MessageSquare
                              className={`h-8 w-8 ${
                                isCompleted ? "text-gray-500" : "text-blue-600"
                              }`}
                            />
                          )}
                          {theme.codigo === "gatilhos" && (
                            <Zap
                              className={`h-8 w-8 ${
                                isCompleted
                                  ? "text-gray-500"
                                  : "text-yellow-600"
                              }`}
                            />
                          )}
                          {theme.codigo === "tom-voz" && (
                            <Volume2
                              className={`h-8 w-8 ${
                                isCompleted ? "text-gray-500" : "text-green-600"
                              }`}
                            />
                          )}
                          {theme.codigo === "sondagem" && (
                            <Search
                              className={`h-8 w-8 ${
                                isCompleted
                                  ? "text-gray-500"
                                  : "text-purple-600"
                              }`}
                            />
                          )}
                          {theme.codigo === "relacionamento" && (
                            <Users
                              className={`h-8 w-8 ${
                                isCompleted ? "text-gray-500" : "text-red-600"
                              }`}
                            />
                          )}
                          {theme.codigo === "objecoes" && (
                            <Target
                              className={`h-8 w-8 ${
                                isCompleted
                                  ? "text-gray-500"
                                  : "text-orange-600"
                              }`}
                            />
                          )}
                        </div>
                        <CardTitle
                          className={`text-lg ${
                            isCompleted ? "text-gray-500" : "text-blue-600"
                          }`}
                        >
                          {theme.title}
                        </CardTitle>
                        <CardDescription className="text-sm">
                          {theme.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="text-center pt-0">
                        {isCompleted ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              <span className="text-sm text-green-600 font-medium">
                                Concluído hoje
                              </span>
                            </div>
                            <p className="text-xs text-gray-500">
                              {themePoints} pontos totais
                            </p>
                            <div className="flex items-center justify-center gap-1 text-xs text-gray-500">
                              <Calendar className="h-3 w-3" />
                              <span>Novas perguntas amanhã</span>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                            >
                              Começar Quiz
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div className="text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  💡 Complete todos os temas diariamente para maximizar sua
                  pontuação!
                </p>
              </div>
            </div>
          ) : activeTab === "ranking" ? (
            <QuizRanking />
          ) : (
            <QuizRewards
              userPoints={userQuizData.totalPoints}
              onPointsUpdate={handlePointsUpdate}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default QuizModal;
