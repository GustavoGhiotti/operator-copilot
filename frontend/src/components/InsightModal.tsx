import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Bot,
  ChevronRight,
  Calendar,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface InsightModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Operador {
  nome: string;
  status: "evolucao" | "decadencia" | "estavel";
  metricas: {
    acordos_hoje: number;
    acordos_ontem: number;
    valor_total: number;
    taxa_conversao: number;
  };
  comparativos?: {
    comparativo_dia: "melhorou" | "piorou" | "estavel" | "sem dados";
    comparativo_semana: "melhorou" | "piorou" | "estavel" | "sem dados";
    comparativo_mes: "melhorou" | "piorou" | "estavel" | "sem dados";
  };
  analise_ia?: string;
  sugestoes_feedback?: string[];
}

const InsightModal: React.FC<InsightModalProps> = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [resumoGeral, setResumoGeral] = useState<string>("");
  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [operadorSelecionado, setOperadorSelecionado] =
    useState<Operador | null>(null);
  const [dataAnalise, setDataAnalise] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      fetchInsights();
    }
  }, [isOpen]);

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const centroCusto = localStorage.getItem("centroCusto");
      const nomeCompleto = localStorage.getItem("nomeCompleto");

      const response = await fetch("/api/ia/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          SUPERVISOR: nomeCompleto,
          CENTRO_CUSTO: centroCusto,
        }),
      });

      if (!response.ok) throw new Error("Erro ao buscar insights");

      const data = await response.json();
      setResumoGeral(data.resumo_geral || "");
      setOperadores(data.operadores || []);
      setDataAnalise(
        data.data_analise || new Date().toLocaleDateString("pt-BR")
      );
    } catch (error) {
      console.error("Erro ao buscar insights:", error);
      setResumoGeral(
        "⚠️ Erro ao carregar insights. Tente novamente mais tarde."
      );
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "evolucao":
        return <TrendingUp className="h-5 w-5 text-green-600" />;
      case "decadencia":
        return <TrendingDown className="h-5 w-5 text-red-600" />;
      default:
        return <Minus className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "evolucao":
        return (
          <Badge className="bg-green-100 text-green-700 border-green-300">
            Em Evolução
          </Badge>
        );
      case "decadencia":
        return (
          <Badge className="bg-red-100 text-red-700 border-red-300">
            Em Decadência
          </Badge>
        );
      default:
        return (
          <Badge className="bg-gray-100 text-gray-700 border-gray-300">
            Estável
          </Badge>
        );
    }
  };

  const getTendenciaIcon = (tendencia?: string) => {
    switch (tendencia) {
      case "melhorou":
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case "piorou":
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      case "estavel":
        return <Minus className="h-4 w-4 text-gray-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-300" />;
    }
  };

  const getTendenciaBadge = (tendencia?: string) => {
    switch (tendencia) {
      case "melhorou":
        return (
          <Badge className="bg-green-100 text-green-700 border-green-200">
            Melhorou
          </Badge>
        );
      case "piorou":
        return (
          <Badge className="bg-red-100 text-red-700 border-red-200">
            Piorou
          </Badge>
        );
      case "estavel":
        return (
          <Badge className="bg-gray-100 text-gray-700 border-gray-200">
            Estável
          </Badge>
        );
      default:
        return (
          <Badge className="bg-gray-50 text-gray-400 border-gray-100">
            Sem dados
          </Badge>
        );
    }
  };

  const getStatusCount = (status: string) => {
    return operadores.filter((op) => op.status === status).length;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[1100px] h-[90vh] flex flex-col p-0 bg-background overflow-hidden">
        {/* HEADER */}
        <DialogHeader className="px-6 py-5 border-b bg-gradient-to-r from-primary/10 to-primary/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Bot className="h-6 w-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold">
                Insights Diários
              </DialogTitle>
              <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                <Calendar className="h-4 w-4" />
                Análise do dia {dataAnalise}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden">
          {/* SIDEBAR - Lista de Operadores */}
          <div className="w-80 border-r bg-muted/30">
            <div className="p-4 border-b bg-background">
              <h3 className="font-semibold text-sm text-muted-foreground mb-3">
                RESUMO GERAL
              </h3>
              <div className="grid grid-cols-3 gap-2">
                <Card className="border-green-200 bg-green-50/50">
                  <CardContent className="p-3 text-center">
                    <TrendingUp className="h-5 w-5 text-green-600 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-green-700">
                      {getStatusCount("evolucao")}
                    </p>
                    <p className="text-xs text-green-600">Evolução</p>
                  </CardContent>
                </Card>
                <Card className="border-red-200 bg-red-50/50">
                  <CardContent className="p-3 text-center">
                    <TrendingDown className="h-5 w-5 text-red-600 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-red-700">
                      {getStatusCount("decadencia")}
                    </p>
                    <p className="text-xs text-red-600">Decadência</p>
                  </CardContent>
                </Card>
                <Card className="border-gray-200 bg-gray-50/50">
                  <CardContent className="p-3 text-center">
                    <Minus className="h-5 w-5 text-gray-600 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-gray-700">
                      {getStatusCount("estavel")}
                    </p>
                    <p className="text-xs text-gray-600">Estável</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            <ScrollArea className="h-[calc(90vh-250px)]">
              <div className="p-3 space-y-2">
                {loading
                  ? Array(5)
                      .fill(0)
                      .map((_, i) => (
                        <Skeleton key={i} className="h-20 w-full" />
                      ))
                  : operadores.map((operador, idx) => (
                      <Card
                        key={idx}
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          operadorSelecionado?.nome === operador.nome
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted/50"
                        }`}
                        onClick={() => setOperadorSelecionado(operador)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(operador.status)}
                              <span className="font-semibold text-sm">
                                {operador.nome}
                              </span>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                          {getStatusBadge(operador.status)}
                        </CardContent>
                      </Card>
                    ))}
              </div>
            </ScrollArea>
          </div>

          {/* MAIN CONTENT - Resumo Geral e Detalhes do Operador */}
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">
              {/* Resumo Geral da IA */}
              <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">
                      Análise Geral do Time
                    </CardTitle>
                  </div>
                  <CardDescription>
                    Insights gerados pela Aurora IA
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-5/6" />
                    </div>
                  ) : (
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          strong: ({ node, ...props }) => (
                            <strong
                              className="font-bold text-primary"
                              {...props}
                            />
                          ),
                          p: ({ node, ...props }) => (
                            <p
                              className="mb-3 leading-relaxed text-foreground"
                              {...props}
                            />
                          ),
                          li: ({ node, ...props }) => (
                            <li
                              className="ml-4 list-disc text-foreground"
                              {...props}
                            />
                          ),
                        }}
                      >
                        {resumoGeral}
                      </ReactMarkdown>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Detalhes do Operador Selecionado */}
              {operadorSelecionado && (
                <Card className="border-primary/20">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(operadorSelecionado.status)}
                        <div>
                          <CardTitle className="text-lg">
                            {operadorSelecionado.nome}
                          </CardTitle>
                          <CardDescription>Análise Individual</CardDescription>
                        </div>
                      </div>
                      {getStatusBadge(operadorSelecionado.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Métricas */}
                    <div>
                      <h4 className="font-semibold mb-3 text-sm text-muted-foreground">
                        MÉTRICAS DE DESEMPENHO
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Card className="bg-muted/30">
                          <CardContent className="p-4 text-center">
                            <p className="text-xs text-muted-foreground mb-1">
                              Acordos Hoje
                            </p>
                            <p className="text-2xl font-bold text-foreground">
                              {operadorSelecionado.metricas.acordos_hoje}
                            </p>
                          </CardContent>
                        </Card>
                        <Card className="bg-muted/30">
                          <CardContent className="p-4 text-center">
                            <p className="text-xs text-muted-foreground mb-1">
                              Acordos Ontem
                            </p>
                            <p className="text-2xl font-bold text-foreground">
                              {operadorSelecionado.metricas.acordos_ontem}
                            </p>
                          </CardContent>
                        </Card>
                        <Card className="bg-muted/30">
                          <CardContent className="p-4 text-center">
                            <p className="text-xs text-muted-foreground mb-1">
                              Valor Total
                            </p>
                            <p className="text-xl font-bold text-foreground">
                              {operadorSelecionado.metricas.valor_total.toLocaleString(
                                "pt-BR",
                                { style: "currency", currency: "BRL" }
                              )}
                            </p>
                          </CardContent>
                        </Card>
                        <Card className="bg-muted/30">
                          <CardContent className="p-4 text-center">
                            <p className="text-xs text-muted-foreground mb-1">
                              Taxa Conversão
                            </p>
                            <p className="text-2xl font-bold text-foreground">
                              {operadorSelecionado.metricas.taxa_conversao}%
                            </p>
                          </CardContent>
                        </Card>
                      </div>
                    </div>

                    {/* Análise da IA */}
                    {operadorSelecionado.analise_ia && (
                      <div>
                        <h4 className="font-semibold mb-3 text-sm text-muted-foreground flex items-center gap-2">
                          <Bot className="h-4 w-4" />
                          ANÁLISE DETALHADA
                        </h4>
                        <Card className="bg-primary/5 border-primary/20">
                          <CardContent className="p-4">
                            <div className="prose prose-sm max-w-none">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  strong: ({ node, ...props }) => (
                                    <strong
                                      className="font-bold text-primary"
                                      {...props}
                                    />
                                  ),
                                  p: ({ node, ...props }) => (
                                    <p
                                      className="mb-2 leading-relaxed text-foreground"
                                      {...props}
                                    />
                                  ),
                                }}
                              >
                                {operadorSelecionado.analise_ia}
                              </ReactMarkdown>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}

                    {/* Comparativos de Desempenho */}
                    {operadorSelecionado.comparativos && (
                      <div>
                        <h4 className="font-semibold mb-3 text-sm text-muted-foreground">
                          COMPARATIVOS DE DESEMPENHO
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {/* Dia */}
                          <Card className="bg-muted/30">
                            <CardContent className="p-4 text-center">
                              <div className="flex items-center justify-center gap-2 mb-1">
                                {getTendenciaIcon(
                                  operadorSelecionado.comparativos
                                    .comparativo_dia
                                )}
                                <span className="text-sm text-muted-foreground">
                                  Hoje
                                </span>
                              </div>
                              {getTendenciaBadge(
                                operadorSelecionado.comparativos.comparativo_dia
                              )}
                            </CardContent>
                          </Card>

                          {/* Semana */}
                          <Card className="bg-muted/30">
                            <CardContent className="p-4 text-center">
                              <div className="flex items-center justify-center gap-2 mb-1">
                                {getTendenciaIcon(
                                  operadorSelecionado.comparativos
                                    .comparativo_semana
                                )}
                                <span className="text-sm text-muted-foreground">
                                  Semana
                                </span>
                              </div>
                              {getTendenciaBadge(
                                operadorSelecionado.comparativos
                                  .comparativo_semana
                              )}
                            </CardContent>
                          </Card>

                          {/* Mês */}
                          <Card className="bg-muted/30">
                            <CardContent className="p-4 text-center">
                              <div className="flex items-center justify-center gap-2 mb-1">
                                {getTendenciaIcon(
                                  operadorSelecionado.comparativos
                                    .comparativo_mes
                                )}
                                <span className="text-sm text-muted-foreground">
                                  Mês
                                </span>
                              </div>
                              {getTendenciaBadge(
                                operadorSelecionado.comparativos.comparativo_mes
                              )}
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    )}

                    {/* Sugestões de Feedback */}
                    {operadorSelecionado.sugestoes_feedback && (
                      <div>
                        <h4 className="font-semibold mb-3 text-sm text-muted-foreground">
                          SUGESTÕES DE FEEDBACK
                        </h4>
                        <div className="space-y-2">
                          {operadorSelecionado.sugestoes_feedback.map(
                            (sugestao, idx) => (
                              <Card key={idx} className="bg-muted/30">
                                <CardContent className="p-3 flex items-start gap-2">
                                  <ChevronRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                                  <p className="text-sm text-foreground">
                                    {sugestao}
                                  </p>
                                </CardContent>
                              </Card>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {!operadorSelecionado && !loading && operadores.length > 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Selecione um operador para ver a análise detalhada</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* FOOTER */}
        <div className="px-6 py-4 border-t bg-muted/30 flex justify-between items-center">
          <p className="text-xs text-muted-foreground">
            Última atualização: {new Date().toLocaleTimeString("pt-BR")}
          </p>
          <Button
            onClick={fetchInsights}
            disabled={loading}
            variant="outline"
            size="sm"
          >
            {loading ? "Atualizando..." : "Atualizar Insights"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InsightModal;
