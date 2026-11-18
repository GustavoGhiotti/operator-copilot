import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  Save,
  Trash2,
  FileSpreadsheet,
  StickyNote,
  Filter,
  FileText,
  Handshake,
} from "lucide-react";
import { PieChart, Pie, Tooltip, Cell } from "recharts";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import axiosInstance from "@/utils/axiosInstance";

interface AcordosModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ClientEntry {
  NM_USUARIO: string;
  NM_LOGIN_DISCADOR: string;
  CPF_CNPJ_INT: string;
  ID_CLIENTE: string;
  ID_ACORDO: string;
  ID_CONTRATO: string;
  CARTEIRA: string;
  GRUPO: string;
  DATA_ACORDO: string;
  DATA_PAGO: string;
  NU_PLANO: number;
  VL_ENTRADA: number;
  VL_PARCELA: number;
  VL_ACORDO: number;
  VL_RISCO: number;
  DT_VENCIMENTO: string;
  STATUS_ACORDO: string;
  PREVENTIVO: string;
  QUEBRA: string;
  DESCRICAO: string;
  DATA_ATUALIZACAO: string;
}

const AcordosOperador: React.FC<AcordosModalProps> = ({ isOpen, onClose }) => {
  const [entries, setEntries] = useState<ClientEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<ClientEntry[]>([]);
  const [userObservation, setUserObservation] = useState("");
  const [editedEntry, setEditedEntry] = useState(null);
  const [entryIdBeingEdited, setEntryIdBeingEdited] = useState(null);
  const [entryWalletBeingEdited, setEntryWalletBeingEdited] = useState(null);
  const [entryContractIdBeingEdited, setEntryContractIdBeingEdited] =
    useState(null);
  const [entryAcordoBeingEdited, SetEntryAcordoBeingEdited] = useState(null);
  const [currentClientId, setCurrentClientId] = useState<string | null>(null);
  const [observationDialogOpen, setObservationDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState({
    cpf: "",
    valor: "",
    data: "",
    vencimento: "",
    preventivo: "",
    status: "",
  });

  const { toast } = useToast();
  const userName = localStorage.getItem("userName") || "";
  const totalEntrada = filteredEntries.reduce(
    (acc, curr) => acc + (curr.VL_ENTRADA || 0),
    0
  );
  const totalRisco = filteredEntries.reduce(
    (acc, curr) => acc + (curr.VL_RISCO || 0),
    0
  );
  const totalAcordos = filteredEntries.length;
  const [graficoAberto, setGraficoAberto] = useState(false);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Load saved data
  useEffect(() => {
    if (isOpen) {
      // Load saved entries from localStorage when the modal opens
      const savedEntries = localStorage.getItem(`clientData_${userName}`);
      if (savedEntries) {
        try {
          const parsedEntries = JSON.parse(savedEntries);

          // Handle upgrading old entries that don't have the new fields
          const updatedEntries = parsedEntries.map((entry: any) => ({
            ...entry,
            priority: entry.priority || "",
            activated: entry.activated || "",
          }));

          setEntries(updatedEntries);
          setFilteredEntries(updatedEntries);
        } catch (error) {
          console.error("Error parsing saved entries:", error);
          toast({
            title: "Erro ao carregar dados",
            description: "Não foi possível carregar os dados salvos",
            variant: "destructive",
          });
        }
      }
    }
  }, [isOpen, userName, toast]);

  // Apply filters to entries
  useEffect(() => {
    let filtered = [...entries];

    if (filters.cpf) {
      filtered = filtered.filter((entry) =>
        entry.CPF_CNPJ_INT?.toLowerCase().includes(filters.cpf.toLowerCase())
      );
    }

    if (filters.data) {
      filtered = filtered.filter((entry) =>
        entry.DATA_ACORDO?.toString().includes(filters.data)
      );
    }

    if (filters.valor) {
      filtered = filtered.filter((entry) =>
        entry.VL_ACORDO?.toString().includes(filters.valor)
      );
    }

    if (filters.vencimento) {
      filtered = filtered.filter((entry) =>
        entry.DT_VENCIMENTO?.toString().includes(filters.vencimento)
      );
    }
    if (filters.preventivo) {
      filtered = filtered.filter((entry) =>
        entry.PREVENTIVO?.toLowerCase().includes(
          filters.preventivo.toLowerCase()
        )
      );
    }

    if (filters.status) {
      filtered = filtered.filter((entry) =>
        entry.STATUS_ACORDO?.toLowerCase().includes(
          filters.status.toLowerCase()
        )
      );
    }

    setFilteredEntries(filtered);
  }, [entries, filters]);

  // Open the observation dialog for a client
  const openObservationDialog = (id: string) => {
    const entry = entries.find((e) => e.ID_CLIENTE === id);
    if (!entry) return;

    setEditedEntry(entry);
    setCurrentClientId(id);
    setUserObservation(entry?.DESCRICAO || "");
    setObservationDialogOpen(true);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";

    // Se estiver no formato dd/mm/yyyy
    if (dateStr.includes("/")) {
      const [day, month, year] = dateStr.split("/");
      const date = new Date(Number(year), Number(month) - 1, Number(day)); // Mês começa do 0
      return date.toLocaleDateString("pt-BR");
    }

    // Se já estiver em formato ISO (yyyy-mm-dd)
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR");
  };

  // Save an observation for a client
  const saveObservation = async () => {
    if (!editedEntry) return;

    const { ID_CLIENTE, ID_CONTRATO, ID_ACORDO, CARTEIRA } = editedEntry;

    try {
      await axiosInstance.post(
        "/api/clientes/atualizar-descricao",
        {
          OBS_USUARIO: userObservation,
          ID_CLIENTE,
          CARTEIRA: CARTEIRA,
          ID_CONTRATO,
          ID_ACORDO,
          COMANDO: "ACORDOS",
        }
      );

      setEntries((prev) =>
        prev.map((entry) =>
          entry.ID_CLIENTE === ID_CLIENTE
            ? { ...entry, DESCRICAO: userObservation }
            : entry
        )
      );

      setObservationDialogOpen(false);
      setUserObservation("");
      setEditedEntry(null);

      toast({
        title: "Descrição salva",
        description: "A observação foi salva com sucesso!",
      });
    } catch (error) {
      console.error("Erro ao salvar observação:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar a observação.",
        variant: "destructive",
      });
    }
  };

  // Update a cell value in the table
  const updateCellValue = (
    id: string,
    field: keyof ClientEntry,
    value: string
  ) => {
    setEntries(
      entries.map((entry) =>
        entry.ID_CLIENTE === id ? { ...entry, [field]: value } : entry
      )
    );
  };

  // Reset all filters
  const resetFilters = () => {
    setFilters({
      cpf: "",
      valor: "",
      data: "",
      vencimento: "",
      preventivo: "",
      status: "",
    });

    toast({
      title: "Filtros resetados",
      description: "Todos os filtros foram removidos",
    });
  };

  // Toggle filter dialog
  const toggleFilter = () => {
    setFilterOpen(!filterOpen);
  };

  useEffect(() => {
    if (isOpen) {
      setLoading(true);

      const userName = localStorage.getItem("nomeCompleto");

      if (!userName) {
        toast({
          title: "Erro",
          description: "Nome do usuário não encontrado.",
          variant: "destructive",
        });
        return;
      }

      axiosInstance
        .get(`/api/acordos/lista`, {
          params: { userName },
        })
        .then((response) => {
          const data = response.data; // pode ser um objeto ou um array
          // Se o retorno for um único objeto, transforme em array
          const dataArray = Array.isArray(data) ? data : [data];

          const formatted = dataArray.map((entry) => ({
            ...entry,
            CPF_CNPJ_INT: entry.CPF_CNPJ_INT.toString(),
            VL_RISCO: parseFloat(entry.VL_RISCO),
            VL_ENTRADA: parseFloat(entry.VL_ENTRADA),
            VL_PARCELA: parseFloat(entry.VL_PARCELA),
            VL_ACORDO: parseFloat(entry.VL_ACORDO),
          }));

          setEntries(formatted);
          setFilteredEntries(formatted);
        })
        .catch((error) => {
          console.error("Erro ao buscar dados:", error);
          toast({
            title: "Erro ao carregar dados",
            description: "Não foi possível carregar os dados do operador",
            variant: "destructive",
          });
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, userName, toast]);

  const sortByDataAcordo = () => {
    const sorted = [...filteredEntries].sort((a, b) => {
      const dateA = new Date(a.DATA_ACORDO).getTime();
      const dateB = new Date(b.DATA_ACORDO).getTime();

      return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
    });

    setFilteredEntries(sorted);
    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  function formatCurrency(value: number) {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  const [pendingPreventivoChanges, setPendingPreventivoChanges] = useState<{
    [key: number]: string;
  }>({});

  const [pendingQuebraChanges, setPendingQuebraChanges] = useState<{
    [key: number]: string;
  }>({});

  const handleSelectChange = (idCliente: number, novoValor: string) => {
    setPendingPreventivoChanges((prev) => ({
      ...prev,
      [idCliente]: novoValor,
    }));
  };

  const handleQuebraSelectChange = (idCliente: number, novoValor: string) => {
    setPendingQuebraChanges((prev) => ({
      ...prev,
      [idCliente]: novoValor,
    }));
  };

  const handleConfirmPreventivo = async (
    idCliente: number,
    idAcordo: number,
    idContrato: number
  ) => {
    const novoPreventivo = pendingPreventivoChanges[idCliente];
    if (!novoPreventivo) return;

    const entry = entries.find((e) => e.ID_CLIENTE === idCliente);
    if (!entry) return;

    const { CARTEIRA } = entry;

    try {
      await axiosInstance.post("/api/preventivo/atualizar", {
        ID_CLIENTE: idCliente,
        CARTEIRA,
        ID_ACORDO: idAcordo,
        ID_CONTRATO: idContrato,
        PREVENTIVO: novoPreventivo,
        COMANDO: "ACORDOS",
      });

      setEntries((prev) =>
        prev.map((entry) =>
          entry.ID_CLIENTE === idCliente
            ? { ...entry, PREVENTIVO: novoPreventivo }
            : entry
        )
      );

      setPendingPreventivoChanges((prev) => {
        const updated = { ...prev };
        delete updated[idCliente];
        return updated;
      });
    } catch (error) {
      console.error("Erro ao atualizar preventivo:", error);
    }
  };

  const handleConfirmQuebra = async (
    idCliente: number,
    idAcordo: number,
    idContrato: number
  ) => {
    const novaQuebra = pendingQuebraChanges[idCliente];
    if (!novaQuebra) return;

    const entry = entries.find((e) => e.ID_CLIENTE === idCliente);
    if (!entry) return;

    const { CARTEIRA } = entry;

    try {
      await axiosInstance.post("/api/quebra/atualizar", {
        ID_CLIENTE: idCliente,
        CARTEIRA,
        ID_ACORDO: idAcordo,
        ID_CONTRATO: idContrato,
        QUEBRA: novaQuebra,
        COMANDO: "ACORDOS",
      });

      setEntries((prev) =>
        prev.map((entry) =>
          entry.ID_CLIENTE === idCliente
            ? { ...entry, QUEBRA: novaQuebra }
            : entry
        )
      );

      // Remove da lista de pendentes
      setPendingQuebraChanges((prev) => {
        const updated = { ...prev };
        delete updated[idCliente];
        return updated;
      });

      toast({
        title: "Quebra atualizada",
        description: "A quebra foi atualizada com sucesso!",
      });
    } catch (error) {
      console.error("Erro ao atualizar quebra:", error);
      toast({
        title: "Erro ao atualizar quebra",
        description: "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="!w-screen !max-w-none p-6 overflow-y-auto max-h-screen">
          <SheetHeader className="mb-4">
            <div className="flex items-center gap-2">
              <Handshake className="h-6 w-6 text-red-600" />
              <SheetTitle>Dados dos Clientes (Acordos)</SheetTitle>
              {entries.length > 0 && (
                <span className="text-sm text-gray-500 ml-2">
                  Última Atualização:{" "}
                  {new Date(entries[0].DATA_ATUALIZACAO).toLocaleDateString(
                    "pt-BR"
                  )}
                </span>
              )}
            </div>
            <SheetDescription>
              Visualize e gerencie seus acordos
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6">
            {/* Spreadsheet Controls */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={toggleFilter}
                  className="flex items-center gap-2"
                >
                  <Filter className="h-4 w-4" />
                  Filtrar
                </Button>
                {filterOpen && (
                  <Button variant="ghost" onClick={resetFilters} size="sm">
                    Limpar filtros
                  </Button>
                )}
              </div>

              <Button
                variant="default"
                className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow hover:brightness-110 transition"
                onClick={() => setGraficoAberto(true)}
              >
                📊 Ver Resumo
              </Button>
            </div>

            {/* Filter Panel */}
            {filterOpen && (
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 dark:bg-gray-900">
                <h4 className="font-medium text-white-800 mb-3 dark:text-black-900">
                  Filtros
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label
                      htmlFor="filterCpf"
                      className="text-sm font-medium mb-1 block dark:text-white-900"
                    >
                      CPF
                    </label>
                    <Input
                      id="filterCpf"
                      value={filters.cpf}
                      onChange={(e) =>
                        setFilters((prev) => ({ ...prev, cpf: e.target.value }))
                      }
                      placeholder="Digite o CPF"
                      className="h-9"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="filterValor"
                      className="text-sm font-medium mb-1 block dark:text-white-900"
                    >
                      Valor
                    </label>
                    <Input
                      id="filterValor"
                      value={filters.valor}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          valor: e.target.value,
                        }))
                      }
                      placeholder="Digite o valor"
                      className="h-9"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="filterData"
                      className="text-sm font-medium mb-1 block dark:text-white-900"
                    >
                      Data Acordo
                    </label>
                    <Input
                      id="filterData"
                      value={filters.data}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          data: e.target.value,
                        }))
                      }
                      placeholder="Digite a data"
                      className="h-9"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="filterData"
                      className="text-sm font-medium mb-1 block dark:text-white-900"
                    >
                      Data Vencimento
                    </label>
                    <Input
                      id="filterData"
                      value={filters.vencimento}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          vencimento: e.target.value,
                        }))
                      }
                      placeholder="Digite a data"
                      className="h-9"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="filterStatus"
                      className="text-sm font-medium mb-1 block dark:text-white-900"
                    >
                      Status Acordo
                    </label>
                    <Input
                      id="filterStatus"
                      value={filters.status}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          status: e.target.value,
                        }))
                      }
                      placeholder="Digite o status"
                      className="h-9"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="filterPreventivo"
                      className="text-sm font-medium mb-1 block dark:text-white-900"
                    >
                      Preventivo
                    </label>
                    <Select
                      id="filterPreventivo"
                      value={filters.preventivo}
                      onValueChange={(value) =>
                        setFilters((prev) => ({ ...prev, preventivo: value }))
                      }
                      placeholder="Selecionar"
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Selecionar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Confirmado">Confirmado</SelectItem>
                        <SelectItem value="Não confirmado">
                          Não confirmado
                        </SelectItem>
                        <SelectItem value="Não vai pagar">
                          Não vai pagar
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
            {/* Client Data Table */}
            <div className="rounded-lg border overflow-x-auto">
              <div className="w-full h-[600px] overflow-auto">
                <div className="min-w-[2000px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[250px]">NOME OP.</TableHead>
                        <TableHead className="w-[120px]">CPF</TableHead>
                        <TableHead className="w-[100px]">ID Cliente</TableHead>
                        <TableHead className="w-[140px]">ID Acordo</TableHead>
                        <TableHead className="w-[120px]">ID Contrato</TableHead>
                        <TableHead className="w-[100px]">Carteira</TableHead>
                        <TableHead className="w-[130px]">
                          Data do Acordo
                        </TableHead>
                        <TableHead className="w-[80px]">Nº parcelas</TableHead>
                        <TableHead className="w-[120px]">
                          Valor de entrada
                        </TableHead>
                        <TableHead className="w-[120px]">
                          Valor de parcelas
                        </TableHead>
                        <TableHead className="w-[80px]">
                          Valor do acordo
                        </TableHead>
                        <TableHead className="w-[80px]">Valor Risco</TableHead>
                        <TableHead className="w-[80px]">
                          Data de vencimento
                        </TableHead>
                        <TableHead className="w-[100px]">
                          Status Acordo
                        </TableHead>
                        <TableHead className="w-[80px]">Preventivo</TableHead>
                        <TableHead className="w-[80px]">Quebra</TableHead>
                        <TableHead className="w-[80px]">Descrição</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEntries.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={17}
                            className="text-center py-4 text-gray-500"
                          >
                            {entries.length === 0
                              ? "Nenhum cliente registrado"
                              : "Nenhum cliente corresponde aos filtros aplicados"}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredEntries.filter(Boolean).map((entry) => (
                          <TableRow key={entry.ID_ACORDO}>
                            <TableCell>{entry.NM_USUARIO}</TableCell>
                            <TableCell>{entry.CPF_CNPJ_INT}</TableCell>
                            <TableCell>{entry.ID_CLIENTE}</TableCell>
                            <TableCell>{entry.ID_ACORDO}</TableCell>
                            <TableCell>{entry.ID_CONTRATO}</TableCell>
                            <TableCell>{entry.CARTEIRA}</TableCell>
                            <TableCell>
                              {formatDate(entry.DATA_ACORDO)}
                            </TableCell>
                            <TableCell>{entry.NU_PLANO}</TableCell>
                            <TableCell>
                              {formatCurrency(entry.VL_ENTRADA)}
                            </TableCell>
                            <TableCell>
                              {formatCurrency(entry.VL_PARCELA)}
                            </TableCell>
                            <TableCell>
                              {formatCurrency(entry.VL_ACORDO)}
                            </TableCell>
                            <TableCell>
                              {formatCurrency(entry.VL_RISCO)}
                            </TableCell>
                            <TableCell>
                              {formatDate(entry.DT_VENCIMENTO)}
                            </TableCell>
                            <TableCell>
                              <span
                                className={`font-semibold px-2 py-1 rounded-md text-sm
                                      ${
                                        entry.STATUS_ACORDO === "PAGO"
                                          ? "text-green-600 bg-green-100"
                                          : entry.STATUS_ACORDO === "VENCIDO"
                                          ? "text-red-600 bg-red-100"
                                          : "text-white-900"
                                      }`}
                              >
                                {entry.STATUS_ACORDO}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center gap-2">
                                <Select
                                  value={
                                    pendingPreventivoChanges[
                                      entry.ID_CLIENTE
                                    ] ?? entry.PREVENTIVO
                                  }
                                  onValueChange={(value) =>
                                    handleSelectChange(entry.ID_CLIENTE, value)
                                  }
                                >
                                  <SelectTrigger className="w-[140px]">
                                    <SelectValue placeholder="Selecionar" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Confirmado">
                                      Confirmado
                                    </SelectItem>
                                    <SelectItem value="Não confirmado">
                                      Não confirmado
                                    </SelectItem>
                                    <SelectItem value="Não vai pagar">
                                      Não vai pagar
                                    </SelectItem>
                                  </SelectContent>
                                </Select>

                                {pendingPreventivoChanges[entry.ID_CLIENTE] &&
                                  pendingPreventivoChanges[entry.ID_CLIENTE] !==
                                    entry.PREVENTIVO && (
                                    <div className="flex gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-xs px-2 py-1"
                                        onClick={() =>
                                          handleConfirmPreventivo(
                                            entry.ID_CLIENTE,
                                            entry.ID_ACORDO,
                                            entry.ID_CONTRATO
                                          )
                                        }
                                      >
                                        Confirmar?
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-xs px-2 py-1 text-red-500"
                                        onClick={() =>
                                          setPendingPreventivoChanges(
                                            (prev) => {
                                              const updated = { ...prev };
                                              delete updated[entry.ID_CLIENTE];
                                              return updated;
                                            }
                                          )
                                        }
                                      >
                                        Fechar
                                      </Button>
                                    </div>
                                  )}
                              </div>
                            </TableCell>

                            <TableCell className="text-center">
                              <div className="flex flex-col items-center gap-2">
                                <Select
                                  value={
                                    pendingQuebraChanges[entry.ID_CLIENTE] ??
                                    entry.QUEBRA
                                  }
                                  onValueChange={(value) =>
                                    handleQuebraSelectChange(
                                      entry.ID_CLIENTE,
                                      value
                                    )
                                  }
                                >
                                  <SelectTrigger className="w-[100px]">
                                    <SelectValue placeholder="Selecionar" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Sim">Sim</SelectItem>
                                    <SelectItem value="Não">Não</SelectItem>
                                  </SelectContent>
                                </Select>

                                {pendingQuebraChanges[entry.ID_CLIENTE] &&
                                  pendingQuebraChanges[entry.ID_CLIENTE] !==
                                    entry.QUEBRA && (
                                    <div className="flex gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-xs px-2 py-1"
                                        onClick={() =>
                                          handleConfirmQuebra(
                                            entry.ID_CLIENTE,
                                            entry.ID_ACORDO,
                                            entry.ID_CONTRATO
                                          )
                                        }
                                      >
                                        Confirmar?
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-xs px-2 py-1 text-red-500"
                                        onClick={() =>
                                          setPendingQuebraChanges((prev) => {
                                            const updated = { ...prev };
                                            delete updated[entry.ID_CLIENTE];
                                            return updated;
                                          })
                                        }
                                      >
                                        Fechar
                                      </Button>
                                    </div>
                                  )}
                              </div>
                            </TableCell>

                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() =>
                                  openObservationDialog(entry.ID_CLIENTE)
                                }
                              >
                                <FileText
                                  className={`h-4 w-4 ${
                                    entry.DESCRICAO
                                      ? "text-blue-500"
                                      : "text-gray-400"
                                  }`}
                                />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </div>

          <SheetFooter className="mt-6">
            <div className="text-xs text-gray-500">
              Dica: Clique no ícone de documento para adicionar observações aos
              clientes.
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* User Observation Dialog */}
      <Dialog
        open={observationDialogOpen}
        onOpenChange={setObservationDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Descrição</DialogTitle>
            <DialogDescription>
              Adicione anotações sobre este cliente.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Textarea
              placeholder="Digite suas observações aqui..."
              value={userObservation}
              onChange={(e) => setUserObservation(e.target.value)}
              className="min-h-[120px]"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setObservationDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button onClick={saveObservation}>Salvar Observações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resumo Financeiro */}
      <Dialog open={graficoAberto} onOpenChange={setGraficoAberto}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Resumo Financeiro</DialogTitle>
            <DialogDescription>
              Totais considerando os filtros atuais
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-white shadow border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-500">Total de Entrada</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(totalEntrada)}
              </p>
            </div>
            <div className="bg-white shadow border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-500">Total de Risco</p>
              <p className="text-2xl font-bold text-red-600">
                {formatCurrency(totalRisco)}
              </p>
            </div>

            <div className="bg-white shadow border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-500">Total de Acordos</p>
              <p className="text-2xl font-bold text-blue-600">{totalAcordos}</p>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setGraficoAberto(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AcordosOperador;
