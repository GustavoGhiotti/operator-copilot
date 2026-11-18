import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import {
  TableCell,
  TableRow,
  TableHeader,
  TableHead,
  TableBody,
  Table,
} from "@/components/ui/table";
import { ArrowDown, ArrowUp, ChartBar, Users, Phone } from "lucide-react";
import { useResultadoOperador } from "@/context/ResultadoOperador";

interface Operator {
  id: number;
  name: string;
  agreementCount: number;
  agreementValue: number;
  closedAgreements: number;
  clientsContacted: number;
  pendingPayments?: number;
  portfolio: string;
  status: "online" | "offline";
  performanceRating: number;
  lastActivity: string;
}

interface OperatorDetailsModalProps {
  operator: Operator | null;
  onClose: () => void;
}

const OperatorDetailsModal: React.FC<OperatorDetailsModalProps> = ({
  operator,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<
    "overview" | "performance" | "tabulations"
  >("overview");
  const { operatorData } = useResultadoOperador();
  const [historicoPerformance, setHistoricoPerformance] = useState<any[]>([]);
  const [isLoadingHistorico, setIsLoadingHistorico] = useState(false);
  const [tabulacoes, setTabulacoes] = useState<
    { acao: string; quantidade: number }[]
  >([]);
  const [isLoadingTabulacoes, setIsLoadingTabulacoes] = useState(false);
  const [atividadesRecentes, setAtividadesRecentes] = useState<any[]>([]);
  const [isLoadingAtividades, setIsLoadingAtividades] = useState(false);

  useEffect(() => {
    const fetchHistorico = async () => {
      if (!operator) return;

      setIsLoadingHistorico(true);
      try {
        const response = await axios.post(
          "http:///resumo_operador_dia",
          {
            nome_supervisor: localStorage.getItem("nomeCompleto"),
          }
        );

        // Filtra apenas os dados do operador atual
        const dadosFiltrados = response.data.resumo.filter(
          (item: any) =>
            item.nome_operador.toLowerCase() === operator.name.toLowerCase()
        );

        setHistoricoPerformance(dadosFiltrados);
      } catch (error) {
        console.error("Erro ao carregar histórico de performance:", error);
      } finally {
        setIsLoadingHistorico(false);
      }
    };

    fetchHistorico();
  }, [operator]);

  const fetchTabulacoes = async () => {
    if (!operator) return;

    setIsLoadingTabulacoes(true);
    try {
      const response = await axios.post(
        "/api/supervisor/tabulacoes_operador",
        {
          nome_supervisor: localStorage.getItem("nomeCompleto"),
        }
      );

      const acoesPermitidas = [
        "Ligacao Muda",
        "Ligação Caiu",
        "Cliente Desligou",
        "Acordo Formalizado",
        "Recusa De Pagamento",
        "Cliente Nao Confirma Dados",
      ];

      const dadosFiltrados = response.data.dados.filter(
        (item: any) =>
          item.operador?.toLowerCase() === operator.name.toLowerCase() &&
          acoesPermitidas.includes(item.acao)
      );

      setTabulacoes(dadosFiltrados);
    } catch (error) {
      console.error("Erro ao carregar tabulações:", error);
    } finally {
      setIsLoadingTabulacoes(false);
    }
  };

  useEffect(() => {
    fetchTabulacoes();
  }, [operator]);

  useEffect(() => {
    const fetchAtividades = async () => {
      if (!operator) return;
      setIsLoadingAtividades(true);

      try {
        const response = await axios.post(
          "/api/supervisao_operadores/atividade_recente_operador",
          {
            nome_supervisor: localStorage.getItem("nomeCompleto"),
            nome_operador: operator.name,
          }
        );

        setAtividadesRecentes(response.data.dados);
      } catch (error) {
        console.error("Erro ao carregar atividades recentes:", error);
      } finally {
        setIsLoadingAtividades(false);
      }
    };

    fetchAtividades();
  }, [operator]);

  if (!operator) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getStatusBadge = (status: "online" | "offline") => {
    return status === "online" ? (
      <Badge className="bg-green-500">Online</Badge>
    ) : (
      <Badge variant="outline" className="text-gray-500">
        Offline
      </Badge>
    );
  };

  const performanceColor =
    operator.performanceRating > 90
      ? "text-green-600"
      : operator.performanceRating > 75
      ? "text-blue-600"
      : operator.performanceRating > 60
      ? "text-amber-600"
      : "text-red-600";

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#A569BD"];

  // Mock data for trends
  const trendData = {
    daily: operator.agreementCount > 5 ? "up" : "down",
    weekly: operator.agreementValue > 10000 ? "up" : "down",
    dailyPercent: Math.floor(Math.random() * 15) + 5,
    weeklyPercent: Math.floor(Math.random() * 20) + 3,
  };

  // Time spent data
  const timeSpentData = [
    { name: "Ligações", minutes: 234 },
    { name: "Pós-atendimento", minutes: 78 },
    { name: "Pausa", minutes: 45 },
    { name: "Treinamento", minutes: 32 },
  ];

  const mediaAcordos =
    historicoPerformance.length > 0
      ? Math.round(
          historicoPerformance.reduce(
            (acc, item) => acc + item.total_registros,
            0
          ) / historicoPerformance.length
        )
      : 0;

  const mediaValorPago =
    historicoPerformance.length > 0
      ? historicoPerformance.reduce(
          (acc, item) => acc + (item.valor_entrada || 0),
          0
        ) / historicoPerformance.length
      : 0;

  const calcularDuracao = (inicioStr: string, fimStr: string) => {
    const inicio = new Date(inicioStr);
    const fim = new Date(fimStr);

    const diffMs = fim.getTime() - inicio.getTime(); // diferença em milissegundos
    if (isNaN(diffMs) || diffMs < 0) return "-";

    const minutos = Math.floor(diffMs / 60000);
    const segundos = Math.floor((diffMs % 60000) / 1000);

    return `${minutos}m ${segundos}s`;
  };

  const ajustarParaBRT = (dataUtc: string) => {
    const data = new Date(dataUtc);
    data.setHours(data.getHours() + 3); // Corrige o fuso manualmente
    return data.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <Dialog open={!!operator} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            {operator.name} {getStatusBadge(operator.status)}
            <span className={`ml-auto ${performanceColor}`}>
              Performance: {operator.performanceRating}%
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center mb-4 border-b pb-2">
          <Button
            variant={activeTab === "overview" ? "default" : "ghost"}
            onClick={() => setActiveTab("overview")}
            className="flex items-center gap-2"
          >
            <Users className="h-4 w-4" />
            Visão Geral
          </Button>
          <Button
            variant={activeTab === "performance" ? "default" : "ghost"}
            onClick={() => setActiveTab("performance")}
            className="flex items-center gap-2"
          >
            <ChartBar className="h-4 w-4" />
            Performance
          </Button>
          <Button
            variant={activeTab === "tabulations" ? "default" : "ghost"}
            onClick={() => setActiveTab("tabulations")}
            className="flex items-center gap-2"
          >
            <Phone className="h-4 w-4" />
            Tabulações
          </Button>
        </div>

        {activeTab === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
            {/* Informações Principais */}
            <Card className="md:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Informações Gerais</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="font-medium text-gray-500">Carteira:</dt>
                    <dd>{operator.portfolio}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="font-medium text-gray-500">
                      Última atividade:
                    </dt>
                    <dd>{operator.lastActivity}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="font-medium text-gray-500">Performance:</dt>
                    <dd className={`font-semibold ${performanceColor}`}>
                      {operator.performanceRating}%
                    </dd>
                  </div>
                  {operator.pendingPayments !== undefined && (
                    <div className="flex justify-between">
                      <dt className="font-medium text-gray-500">
                        Pagamentos Pendentes:
                      </dt>
                      <dd className="font-semibold">
                        {formatCurrency(operator.pendingPayments)}
                      </dd>
                    </div>
                  )}
                  <Separator />
                </dl>
              </CardContent>
            </Card>

            {/* Resumo de Acordos */}
            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Resumo de Acordos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <div className="text-sm text-gray-500 mb-1">
                      Total de acordos
                    </div>
                    <div className="text-2xl font-bold">
                      {operator.agreementCount}
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <div className="text-sm text-gray-500 mb-1">Valor pago</div>
                    <div className="text-2xl font-bold">
                      {formatCurrency(operator.agreementValue)}
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <div className="text-sm text-gray-500 mb-1">
                      Clientes contatados
                    </div>
                    <div className="text-2xl font-bold">
                      {operator.clientsContacted}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Atividade Recente */}
            <Card className="md:col-span-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Atividade Recente</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Horário</TableHead>
                      <TableHead>Atividade</TableHead>
                      <TableHead>Resultado</TableHead>
                      <TableHead className="text-right">Duração</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingAtividades ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center text-gray-500"
                        >
                          Carregando atividades...
                        </TableCell>
                      </TableRow>
                    ) : atividadesRecentes.length > 0 ? (
                      atividadesRecentes.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            {ajustarParaBRT(item.data_acao)}
                          </TableCell>
                          <TableCell>{item.acao}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                item.acao.toLowerCase().includes("acordo")
                                  ? "bg-green-100 text-green-800 border-green-300"
                                  : item.acao.toLowerCase().includes("recusa")
                                  ? "bg-red-100 text-red-800 border-red-300"
                                  : "bg-gray-100 text-gray-800 border-gray-300"
                              }
                            >
                              {item.acao}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {calcularDuracao(item.data_inicio, item.data_acao)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center text-gray-500"
                        >
                          Nenhuma atividade encontrada.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "performance" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            {/* Métricas de Desempenho */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">
                  Métricas de Atendimento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3">
                  <div className="grid grid-cols-1 gap-2">
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                      <dt className="text-xs text-gray-500">
                        Média de acordo - Últimos dias
                      </dt>
                      <dd className="text-lg font-semibold">{mediaAcordos}</dd>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                      <dt className="text-xs text-gray-500">
                        Média de valor - Últimos dias
                      </dt>
                      <dd className="text-lg font-semibold">
                        {mediaValorPago > 0
                          ? formatCurrency(mediaValorPago)
                          : "Sem dados"}
                      </dd>
                    </div>
                  </div>
                </dl>
              </CardContent>
            </Card>

            {/* Custos e Receitas */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">
                  Valores fechados e recebidos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Fechados:</dt>
                    <dd className="font-medium">
                      {formatCurrency(operator.closedAgreements)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Recebidos:</dt>
                    <dd className="font-medium">
                      {formatCurrency(operator.agreementValue)}
                    </dd>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Porcentagem:</dt>
                    <dd
                      className={`font-semibold ${
                        operator.agreementValue > 1254.75
                          ? "text-green-500"
                          : "text-red-500"
                      }`}
                    >
                      {(
                        (operator.agreementValue / operator.closedAgreements) *
                        100
                      ).toFixed(1)}
                      %
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            {/* Histórico de Performance */}
            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">
                  Histórico de Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dia</TableHead>
                      <TableHead>Acordos</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Performance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingHistorico ? (
                      <p className="text-sm text-gray-500">
                        Carregando histórico...
                      </p>
                    ) : historicoPerformance.length > 0 ? (
                      historicoPerformance.map((item, idx) => {
                        const perf =
                          item.ideal_operador && item.ideal_operador > 0
                            ? Math.min(
                                100,
                                Math.round(
                                  (item.total_pago / item.ideal_operador) * 100
                                )
                              )
                            : 0;

                        return (
                          <TableRow key={idx}>
                            <TableCell>
                              {new Date(item.data).toLocaleDateString("pt-BR")}
                            </TableCell>
                            <TableCell>{item.total_registros}</TableCell>
                            <TableCell>
                              {formatCurrency(item.valor_entrada)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span
                                  className={
                                    perf > 90
                                      ? "text-green-500"
                                      : perf > 75
                                      ? "text-blue-500"
                                      : perf > 60
                                      ? "text-amber-500"
                                      : "text-red-500"
                                  }
                                >
                                  {perf}%
                                </span>
                                <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      perf > 90
                                        ? "bg-green-500"
                                        : perf > 75
                                        ? "bg-blue-500"
                                        : perf > 60
                                        ? "bg-amber-500"
                                        : "bg-red-500"
                                    }`}
                                    style={{ width: `${perf}%` }}
                                  ></div>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center text-gray-500"
                        >
                          Nenhum dado de performance encontrado.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "tabulations" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
            {/* Pie Chart - Tabulações */}
            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg mb-4">
                  Tabulações do Dia
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 h-auto">
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      data={tabulacoes.map((item) => ({
                        name: item.acao,
                        value: item.quantidade,
                      }))}
                      cx="40%"
                      cy="60%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name}: ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {tabulacoes.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${value} ligações`} />
                  </PieChart>
                </ResponsiveContainer>

                {/* Legenda manual com espaçamento */}
                <div className="mt-6 flex flex-wrap gap-4">
                  {tabulacoes.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{
                          backgroundColor: COLORS[index % COLORS.length],
                        }}
                      />
                      <span>{item.acao}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            {/* Tabulation Details */}
            <Card className="md:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">
                  Detalhes das Tabulações
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Qtd.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingTabulacoes ? (
                      <TableRow>
                        <TableCell
                          colSpan={2}
                          className="text-center text-gray-500"
                        >
                          Carregando...
                        </TableCell>
                      </TableRow>
                    ) : tabulacoes.length > 0 ? (
                      tabulacoes.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{
                                  backgroundColor:
                                    COLORS[index % COLORS.length],
                                }}
                              />
                              {item.acao}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {item.quantidade}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={2}
                          className="text-center text-gray-500"
                        >
                          Nenhuma tabulação encontrada.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                <div className="mt-4 space-y-3">
                  <div className="text-sm font-medium">Observações</div>
                  <p className="text-sm text-gray-500">
                    Acompanhe as principais tabulações realizadas pelo operador
                    ao longo do dia.
                  </p>
                  <p className="text-sm text-gray-500">
                    Utilize essas informações para identificar padrões de
                    atendimento e oportunidades de melhoria.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default OperatorDetailsModal;
