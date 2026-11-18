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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Download,
  RefreshCw,
  Users,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  convertToCSV,
  convertToStylizedHTML,
  downloadFile,
  exportToXLSX,
} from "@/utils/exportUtils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import OperatorDetailsModal from "@/components/OperatorDetailsModal";

interface SupervisorOperatorMonitoringProps {
  isModal?: boolean;
  onClose?: () => void;
}

interface Operator {
  id: number;
  name: string;
  agreementCount: number;
  agreementValue: number;
  closedAgreements: number;
  clientsContacted: number;
  pendingPayments: number;
  portfolio: string;
  status: "online" | "offline";
  performanceRating: number;
  lastActivity: string;
}

const SupervisorOperatorMonitoring: React.FC<
  SupervisorOperatorMonitoringProps
> = ({ isModal, onClose }) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [filteredOperators, setFilteredOperators] = useState<Operator[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [sortKey, setSortKey] = useState<keyof Operator | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const username = localStorage.getItem("nomeCompleto");
  const id_cedente_num = parseInt(localStorage.getItem("id_cedente") || "0");
  const campoPagamento =
    id_cedente_num === 3 || id_cedente_num === 60
      ? "valor_risco_pago"
      : "valor_pago";
  const [selectedOperator, setSelectedOperator] = useState<Operator | null>(
    null
  );
  const [resumoPorDia, setResumoPorDia] = useState<any[]>([]);

  const loadOperators = async () => {
    setIsLoading(true);
    try {
      const supervisor = localStorage.getItem("nomeCompleto");
      const response = await axios.post(
        `/api/supervisor/supervisao_operadores`,
        {
          nome_supervisor: supervisor,
        }
      );

      const dados = response.data.dados;

      const formatted: Operator[] = dados.map((item: any, index: number) => {
        return {
          id: index + 1,
          name: item.nome_operador,
          agreementCount: item.acordos || 0,
          agreementValue: item.valor_pago,
          closedAgreements: item.valor_entrada,
          clientsContacted: item.cpc_dia || 0,
          portfolio: item.carteira || "Carteira A",
          status: item.status || "offline",
          performanceRating: item.ideal_operador
            ? Math.min(
                100,
                Math.round((item.valor_pago / item.ideal_operador) * 100)
              )
            : 0,
          lastActivity: item.ultima_atividade,
        };
      });

      setOperators(formatted);
      // Aplica ordenação se já estiver ativa
      if (sortKey) {
        const sorted = [...formatted].sort((a, b) => {
          const valA = a[sortKey];
          const valB = b[sortKey];

          if (typeof valA === "number" && typeof valB === "number") {
            return sortOrder === "asc" ? valA - valB : valB - valA;
          }

          if (typeof valA === "string" && typeof valB === "string") {
            return sortOrder === "asc"
              ? valA.localeCompare(valB)
              : valB.localeCompare(valA);
          }

          return 0;
        });
        setFilteredOperators(sorted);
      } else {
        setFilteredOperators(formatted);
      }
      setFilteredOperators(formatted);
    } catch (error) {
      console.error("Erro ao carregar operadores:", error);
      toast({
        title: "Erro ao carregar dados",
        description:
          "Verifique se o supervisor está correto ou tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadResumoDiario = async () => {
    setIsLoading(true);
    try {
      const supervisor = localStorage.getItem("nomeCompleto");

      const response = await axios.post(
        `/api/supervisor/resumo_operador_dia`,
        {
          nome_supervisor: supervisor,
        }
      );
    } catch (error) {
      console.error("Erro ao carregar resumo diário:", error);
      toast({
        title: "Erro ao carregar resumo diário",
        description:
          "Verifique se o supervisor está correto ou tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const OperatorDetails = ({
    operator,
    onClose,
  }: {
    operator: Operator;
    onClose: () => void;
  }) => {
    return (
      <Dialog open={!!operator} onOpenChange={onClose}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Detalhes de {operator.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p>
              <strong>Carteira:</strong> {operator.portfolio}
            </p>
            <p>
              <strong>Status:</strong> {operator.status}
            </p>
            <p>
              <strong>Acordos no mês:</strong> {operator.agreementCount}
            </p>
            <p>
              <strong>Valor negociado:</strong>{" "}
              {formatCurrency(operator.agreementValue)}
            </p>
            <p>
              <strong>CPC:</strong> {operator.clientsContacted}
            </p>
            <p>
              <strong>Performance:</strong> {operator.performanceRating}%
            </p>
            <p>
              <strong>Última atividade:</strong> {operator.lastActivity}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  useEffect(() => {
    loadOperators();
    loadResumoDiario();
  }, []);

  const sortOperators = (key: keyof Operator) => {
    const order = sortKey === key && sortOrder === "asc" ? "desc" : "asc";
    setSortKey(key);
    setSortOrder(order);

    const sorted = [...filteredOperators].sort((a, b) => {
      const valA = a[key];
      const valB = b[key];

      if (typeof valA === "number" && typeof valB === "number") {
        return order === "asc" ? valA - valB : valB - valA;
      }

      if (typeof valA === "string" && typeof valB === "string") {
        return order === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }

      return 0;
    });

    setFilteredOperators(sorted);
  };

  const handleSearch = () => {
    if (!searchTerm.trim()) {
      setFilteredOperators(operators);
      return;
    }

    const filtered = operators.filter(
      (operator) =>
        operator.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        operator.portfolio.toLowerCase().includes(searchTerm.toLowerCase())
    );

    setFilteredOperators(filtered);

    if (filtered.length === 0) {
      toast({
        title: "Sem resultados",
        description: "Nenhum operador encontrado com esse termo de busca.",
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const refreshData = async () => {
    setSearchTerm("");
    await loadOperators(); // isso já seta isLoading e mostra o toast em caso de erro
    toast({
      title: "Dados atualizados",
      description: "Os dados dos operadores foram atualizados com sucesso.",
    });
  };

  const exportData = (format: "csv" | "html" | "xlsx") => {
    setIsExporting(true);
    toast({
      title: "Exportando dados",
      description: `Preparando ${format.toUpperCase()} para download...`,
    });

    const headers = {
      id: "ID",
      name: "Nome",
      status: "Status",
      portfolio: "Carteira",
      agreementCount: "Acordos",
      agreementValue: "Valor (R$)",
      clientsContacted: "Clientes Contatados",
      performanceRating: "Performance (%)",
      lastActivity: "Última Atividade",
    };

    const date = new Date();
    const dateStr = `${date.getDate()}-${
      date.getMonth() + 1
    }-${date.getFullYear()}`;
    const timeStr = `${date.getHours()}-${date.getMinutes()}`;

    setTimeout(() => {
      try {
        if (format === "html") {
          const html = convertToStylizedHTML(filteredOperators, headers);
          downloadFile(
            html,
            `monitoramento-${dateStr}-${timeStr}.html`,
            "text/html;charset=utf-8;"
          );
        } else if (format === "csv") {
          const csv = convertToCSV(filteredOperators, headers);
          downloadFile(
            csv,
            `monitoramento-${dateStr}-${timeStr}.csv`,
            "text/csv;charset=utf-8;"
          );
        } else if (format === "xlsx") {
          exportToXLSX(
            filteredOperators,
            `monitoramento-${dateStr}-${timeStr}`,
            headers
          );
        }

        toast({
          title: "Exportação concluída",
          description: `Arquivo ${format.toUpperCase()} gerado com sucesso.`,
        });
      } catch {
        toast({
          title: "Erro na exportação",
          description: "Tente novamente.",
          variant: "destructive",
        });
      } finally {
        setIsExporting(false);
      }
    }, 500);
  };

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

  const renderContent = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                Olá, <span className="text-orange-600"> {username} </span>
              </CardTitle>
              <CardDescription>
                Acompanhe em tempo real o desempenho dos operadores da sua
                equipe
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refreshData}
                disabled={isLoading}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`}
                />
                Atualizar
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      isExporting || isLoading || filteredOperators.length === 0
                    }
                  >
                    <FileSpreadsheet
                      className={`h-4 w-4 mr-1 ${
                        isExporting ? "animate-spin" : ""
                      }`}
                    />
                    Exportar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={() => exportData("csv")}
                    className="flex items-center"
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => exportData("html")}
                    className="flex items-center"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    HTML
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => exportData("xlsx")}
                    className="flex items-center"
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Excel (.xlsx)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault(); // evita reload da página
              handleSearch();
            }}
            className="flex gap-2 mb-6"
          >
            <div className="flex-1">
              <Input
                placeholder="Buscar por nome ou carteira..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button type="submit" className="flex items-center gap-1">
              <Search className="h-4 w-4" />
              Buscar
            </Button>
          </form>

          {isLoading ? (
            <div className="py-16 flex justify-center items-center">
              <div className="flex flex-col items-center gap-2">
                <div className="h-8 w-8 border-2 border-t-transparent border-blue-500 rounded-full animate-spin"></div>
                <p className="text-sm text-gray-500">
                  Carregando dados dos operadores...
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableCaption>
                  <div className="flex justify-between items-center">
                    <span>Total de operadores: {filteredOperators.length}</span>
                    {filteredOperators.length > 0 && (
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => exportData("csv")}
                          disabled={isExporting}
                          className="text-sm text-muted-foreground flex items-center gap-1"
                        >
                          <Download className="h-3.5 w-3.5" />
                          CSV
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => exportData("html")}
                          disabled={isExporting}
                          className="text-sm text-muted-foreground flex items-center gap-1"
                        >
                          <Download className="h-3.5 w-3.5" />
                          HTML
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => exportData("xlsx")}
                          disabled={isExporting}
                          className="text-sm text-muted-foreground flex items-center gap-1"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Excel
                        </Button>
                      </div>
                    )}
                  </div>
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead
                      onClick={() => sortOperators("status")}
                      className="cursor-pointer"
                    >
                      Status{" "}
                      {sortKey === "status" &&
                        (sortOrder === "asc" ? "▲" : "▼")}
                    </TableHead>
                    <TableHead>Carteira</TableHead>
                    <TableHead
                      onClick={() => sortOperators("agreementCount")}
                      className="text-right cursor-pointer"
                    >
                      Acordos{" "}
                      {sortKey === "agreementCount" &&
                        (sortOrder === "asc" ? "▲" : "▼")}
                    </TableHead>
                    <TableHead
                      onClick={() => sortOperators("agreementValue")}
                      className="text-right cursor-pointer"
                    >
                      Valor{" "}
                      {sortKey === "agreementValue" &&
                        (sortOrder === "asc" ? "▲" : "▼")}
                    </TableHead>
                    <TableHead
                      onClick={() => sortOperators("clientsContacted")}
                      className="text-right cursor-pointer"
                    >
                      CPC{" "}
                      {sortKey === "clientsContacted" &&
                        (sortOrder === "asc" ? "▲" : "▼")}
                    </TableHead>

                    <TableHead
                      onClick={() => sortOperators("performanceRating")}
                      className="text-right cursor-pointer"
                    >
                      Performance{" "}
                      {sortKey === "performanceRating" &&
                        (sortOrder === "asc" ? "▲" : "▼")}
                    </TableHead>
                    <TableHead>Última Atividade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOperators.length > 0 ? (
                    filteredOperators.map((operator) => (
                      <TableRow key={operator.id} className="hover:bg-muted/30">
                        <TableCell
                          className="font-medium cursor-pointer text-white-600 hover:underline"
                          onClick={() => setSelectedOperator(operator)}
                        >
                          {operator.name}
                        </TableCell>
                        <TableCell>{getStatusBadge(operator.status)}</TableCell>
                        <TableCell>{operator.portfolio}</TableCell>
                        <TableCell className="text-right">
                          {operator.agreementCount}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(operator.agreementValue)}
                        </TableCell>
                        <TableCell className="text-right">
                          {operator.clientsContacted}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span>{operator.performanceRating}%</span>
                            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  operator.performanceRating > 90
                                    ? "bg-green-500"
                                    : operator.performanceRating > 75
                                    ? "bg-blue-500"
                                    : operator.performanceRating > 60
                                    ? "bg-amber-500"
                                    : "bg-red-500"
                                }`}
                                style={{
                                  width: `${operator.performanceRating}%`,
                                }}
                              ></div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{operator.lastActivity}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="text-center py-8 text-gray-500"
                      >
                        Nenhum operador encontrado com os filtros atuais.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {isModal && onClose && (
        <div className="flex justify-end">
          <Button onClick={onClose}>Fechar</Button>
        </div>
      )}

      <OperatorDetailsModal
        operator={selectedOperator}
        onClose={() => setSelectedOperator(null)}
      />
    </div>
  );

  // If used as a standalone page
  if (!isModal) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col transition-colors duration-200">
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="container mx-auto px-4 py-4">
            <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
              Painel de Supervisão - TeleCobrança
            </h1>
          </div>
        </header>

        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="mb-6 flex justify-between items-center">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold text-gray-800 dark:text-gray-100">
                Monitoramento de Operadores
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                Acompanhe o desempenho dos operadores em tempo real
              </p>
            </div>

            {onClose && (
              <Button
                onClick={onClose}
                variant="outline"
                className="flex items-center gap-1"
              >
                Voltar
              </Button>
            )}
          </div>

          {renderContent()}
        </main>
      </div>
    );
  }

  // If used within a modal
  return renderContent();
};

export default SupervisorOperatorMonitoring;
