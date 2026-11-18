import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  ClipboardList,
  Phone,
  Calendar,
  Search,
  ExternalLink,
} from "lucide-react";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import axiosInstance from "@/utils/axiosInstance";

interface PendentesModalProps {
  isOpen: boolean;
  onClose: () => void;
  operador: string; // Novo prop para passar o operador logado
}

const PendentesModal: React.FC<PendentesModalProps> = ({
  isOpen,
  onClose,
  operador,
}) => {
  const [clientesPendentes, setClientesPendentes] = useState<any[]>([]);
  const [filtroNome, setFiltroNome] = useState("");
  const [filtroPrioridade, setFiltroPrioridade] = useState("");
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);

  const limparNome = (nome: string | null): string => {
    return nome ? nome.replace(/\s+/g, " ").trim() : "";
  };

  useEffect(() => {
    const storedUserName = localStorage.getItem("nomeCompleto");
    setUserName(limparNome(storedUserName));
  }, []);

  useEffect(() => {
    if (isOpen && userName) {
      setLoading(true);
      axiosInstance
        .post("/api/clientes/pendentes", {
          nome_usuario: userName,
        })
        .then((res) => {
          // Adiciona prioridade com base no valor numérico
          const dadosComPrioridade = res.data.dados.map((cliente: any) => {
            const valorNumerico = parseFloat(
              cliente.valor
                .replace(/[^\d,.-]/g, "") // remove R$, espaços e símbolos
                .replace(".", "") // remove o ponto do milhar
                .replace(",", ".") // troca vírgula por ponto
            );

            let prioridade = "Baixa";
            if (valorNumerico >= 1000) prioridade = "Alta";
            else if (valorNumerico >= 500) prioridade = "Média";

            return { ...cliente, prioridade };
          });

          // Remove duplicados com base no nome
          const dadosUnicos = dadosComPrioridade.filter(
            (cliente, index, self) =>
              index === self.findIndex((c) => c.nome === cliente.nome)
          );

          setClientesPendentes(dadosUnicos);
        })
        .catch((err) => {
          console.error("Erro ao buscar clientes pendentes:", err);
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, operador, userName]);

  const getPriorityClass = (prioridade: string) => {
    switch (prioridade) {
      case "Alta":
        return "bg-red-50 text-red-700 border-red-200";
      case "Média":
        return "bg-yellow-50 text-yellow-700 border-yellow-200";
      case "Baixa":
        return "bg-green-50 text-green-700 border-green-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case "Pendente":
        return "bg-gray-100 text-gray-700";
      case "Agendado":
        return "bg-blue-100 text-blue-700";
      case "Prometido":
        return "bg-green-100 text-green-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const clientesFiltrados = clientesPendentes.filter(
    (cliente) =>
      cliente.nome.toLowerCase().includes(filtroNome.toLowerCase()) &&
      (filtroPrioridade === "" || cliente.prioridade === filtroPrioridade)
  );

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-md md:max-w-lg">
        <SheetHeader className="mb-6">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-orange-500" />
            <SheetTitle>Clientes Pendentes</SheetTitle>
          </div>
          <SheetDescription>
            Clientes com pagamentos a vencer hoje
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
            <div className="flex justify-between items-center">
              <h3 className="font-medium text-gray-800">
                Pagamentos previstos
              </h3>
              <span className="text-sm text-gray-500">
                Total: {clientesPendentes.length}
              </span>
            </div>
            <div className="flex items-center gap-1 mt-1 text-sm text-gray-600">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span>Vencimento: Hoje</span>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-2">
            <div className="relative w-full">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                value={filtroNome}
                onChange={(e) => setFiltroNome(e.target.value)}
                className="pl-10 w-full py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary/60 focus:outline-none text-sm"
                placeholder="Filtrar por nome..."
              />
            </div>
            <select
              value={filtroPrioridade}
              onChange={(e) => setFiltroPrioridade(e.target.value)}
              className="w-full md:w-48 py-2 px-3 border border-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 dark:text-gray-800"
            >
              <option value="">Todas as Prioridades</option>
              <option value="Alta">Alta</option>
              <option value="Média">Média</option>
              <option value="Baixa">Baixa</option>
            </select>
          </div>

          <div className="rounded-lg border overflow-hidden max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500">Carregando...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Prioridade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientesFiltrados.map((cliente, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <div className="font-medium">{cliente.nome}</div>
                        <div className="text-xs text-gray-500">
                          {cliente.cpf}
                        </div>
                        <div className="mt-1">
                          <span
                            className={`inline-block text-xs px-2 py-0.5 rounded-full ${getStatusClass(
                              cliente.status
                            )}`}
                          >
                            {cliente.status}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {cliente.valor}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-block text-xs px-2 py-1 rounded-full border ${getPriorityClass(
                            cliente.prioridade
                          )}`}
                        >
                          {cliente.prioridade}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="p-4 bg-gray-50 rounded-lg border text-sm text-gray-600">
            <p>
              <strong>Dica:</strong> Clientes com prioridade alta devem ser
              contatados primeiro. Clique no ícone do telefone para copiar o
              número.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default PendentesModal;
