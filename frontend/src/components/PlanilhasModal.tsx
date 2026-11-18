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
} from "lucide-react";
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

interface PlanilhasModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ClientEntry {
  id: string;
  CPF: string;
  ID_CLIENTE: string;
  NM_NOME: string;
  NM_CONTRATO_CEDENTE: string;
  ID_CONTRATO: string;
  CARTEIRA: string;
  SEGMENTO: string;
  RISCO: string;
  FAIXA_CONTRATANTE: string;
  CPC: string;
  PROPENSAO: string;
  TELEFONE_1: string;
  LINK_WPP_TEL: string;
  USUARIO: string;
  OBS_USUARIO: string;
  DATA_ENTRADA: string;
  ULT_ATUALIZACAO: string;
  PREVENTIVO: string;
  QUEBRA: string;
  priority: "" | "baixa" | "média" | "alta";
  activated: "" | "sim" | "não";
}

type FilterOptions = {
  clientName: string;
  priority: "" | "baixa" | "média" | "alta";
  activated: "" | "sim" | "não";
};

const PlanilhasModal: React.FC<PlanilhasModalProps> = ({ isOpen, onClose }) => {
  const [entries, setEntries] = useState<ClientEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<ClientEntry[]>([]);
  const [userObservation, setUserObservation] = useState("");
  const [entryIdBeingEdited, setEntryIdBeingEdited] = useState<string | null>(
    null
  );
  const [currentClientId, setCurrentClientId] = useState<string | null>(null);
  const [observationDialogOpen, setObservationDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState({
    nome: "",
    cpf: "",
    valor: "",
    data: "",
  });

  // Estados para gerenciar mudanças pendentes
  const [pendingPreventivoChanges, setPendingPreventivoChanges] = useState<{
    [key: string]: string;
  }>({});

  const [pendingQuebraChanges, setPendingQuebraChanges] = useState<{
    [key: string]: string;
  }>({});

  const { toast } = useToast();
  const userName = localStorage.getItem("userName") || "";

  // ... keep existing code (useEffect for loading data and filtering)

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

    if (filters.nome) {
      filtered = filtered.filter((entry) =>
        entry.NM_NOME?.toLowerCase().includes(filters.nome.toLowerCase())
      );
    }

    if (filters.cpf) {
      filtered = filtered.filter((entry) =>
        entry.CPF?.toLowerCase().includes(filters.cpf.toLowerCase())
      );
    }

    if (filters.valor) {
      filtered = filtered.filter((entry) =>
        entry.RISCO?.toString().includes(filters.valor)
      );
    }

    if (filters.data) {
      filtered = filtered.filter((entry) =>
        entry.DATA_ENTRADA?.toString().includes(filters.data)
      );
    }

    setFilteredEntries(filtered);
  }, [entries, filters]);

  // Open the observation dialog for a client
  const openObservationDialog = (id: string) => {
    const entry = entries.find((e) => e.ID_CLIENTE === id);
    setCurrentClientId(id);
    setEntryIdBeingEdited(id);
    setUserObservation(entry?.OBS_USUARIO || "");
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
    try {
      const entry = entries.find((e) => e.ID_CLIENTE === entryIdBeingEdited);

      if (!entry) {
        console.error(
          "Entrada não encontrada para o ID_CLIENTE:",
          entryIdBeingEdited
        );
        return;
      }

      await axiosInstance.post(
        "/api/clientes/atualizar-observacao",
        {
          OBS_USUARIO: userObservation,
          ID_CLIENTE: entryIdBeingEdited,
          CARTEIRA: entry.CARTEIRA,
          COMANDO: "PLANILHAS",
        }
      );

      setEntries((prev) =>
        prev.map((e) =>
          e.ID_CLIENTE === entryIdBeingEdited
            ? { ...e, OBS_USUARIO: userObservation }
            : e
        )
      );

      setObservationDialogOpen(false);
      setUserObservation("");
      setEntryIdBeingEdited(null);
    } catch (error) {
      console.error("Erro ao salvar observação:", error);
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
        entry.id === id
          ? {
              ...entry,
              [field]:
                field === "priority" || field === "activated"
                  ? (value as "" | "baixa" | "média" | "alta" | "sim" | "não")
                  : value,
            }
          : entry
      )
    );
  };

  // Handlers para Preventivo
  const handlePreventivoSelectChange = (
    idCliente: string,
    novoValor: string,
    carteira: string
  ) => {
    setPendingPreventivoChanges((prev) => ({
      ...prev,
      [idCliente]: novoValor,
    }));
  };

  const handleConfirmPreventivo = async (
    idCliente: string,
    carteira: string
  ) => {
    const novoPreventivo = pendingPreventivoChanges[idCliente];
    if (!novoPreventivo) return;

    try {
      await axiosInstance.post(
        "/api/preventivo/atualizar-combate",
        {
          ID_CLIENTE: idCliente,
          CARTEIRA: carteira,
          COMANDO: "PLANILHAS",
          PREVENTIVO: novoPreventivo,
        }
      );

      setEntries((prev) =>
        prev.map((entry) =>
          entry.ID_CLIENTE === idCliente
            ? { ...entry, PREVENTIVO: novoPreventivo }
            : entry
        )
      );

      // Remove da lista de pendentes
      setPendingPreventivoChanges((prev) => {
        const updated = { ...prev };
        delete updated[idCliente];
        return updated;
      });

      toast({
        title: "Preventivo atualizado",
        description: "O preventivo foi atualizado com sucesso!",
      });
    } catch (error) {
      console.error("Erro ao atualizar preventivo:", error);
      toast({
        title: "Erro ao atualizar preventivo",
        description: "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  // Handlers para Quebra
  const handleQuebraSelectChange = (idCliente: string, novoValor: string) => {
    setPendingQuebraChanges((prev) => ({
      ...prev,
      [idCliente]: novoValor,
    }));
  };

  const handleConfirmQuebra = async (idCliente: string, idContrato: string) => {
    const novaQuebra = pendingQuebraChanges[idCliente];
    if (!novaQuebra) return;

    const entry = entries.find((e) => e.ID_CLIENTE === idCliente);
    if (!entry) {
      console.error("Entrada não encontrada para o ID:", idCliente);
      return;
    }

    try {
      await axiosInstance.post(
        "/api/quebra/atualizar-combate",
        {
          ID_CLIENTE: idCliente,
          QUEBRA: novaQuebra,
          COMANDO: "PLANILHAS",
          CARTEIRA: entry.CARTEIRA,
        }
      );

      setEntries((prev) =>
        prev.map((entry) =>
          entry.ID_CLIENTE === idCliente
            ? { ...entry, QUEBRA: novaQuebra }
            : entry
        )
      );

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

  // Reset all filters
  const resetFilters = () => {
    setFilters({
      nome: "",
      cpf: "",
      valor: "",
      data: "",
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

      axiosInstance
        .get(`/api/clientes/lista-combate`, {
          params: { userName },
        })
        .then((response) => {
          const data = response.data;

          const formatCpf = (cpf: string) =>
            cpf?.length === 11
              ? `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(
                  6,
                  9
                )}-${cpf.slice(9)}`
              : cpf;

          const formatPhone = (phone: string) =>
            phone?.length === 11
              ? `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`
              : phone;

          const formatCurrency = (value: any) => {
            if (value === null || value === undefined) return "";
            const num = typeof value === "number" ? value : parseFloat(value);
            return num.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            });
          };
          // Garantir que todos os campos estejam presentes
          const updated = Array.isArray(data)
            ? data.map((entry: any) => ({
                ...entry,
                CPF: formatCpf(entry.CPF),
                TELEFONE_1: formatPhone(entry.TELEFONE_1),
                RISCO: formatCurrency(entry.RISCO),
                DATA_ENTRADA: formatDate(entry.DATA_ENTRADA),
                ULT_ATUALIZACAO: formatDate(entry.ULT_ATUALIZACAO),
                priority: entry.priority || "",
                activated: entry.activated || "",
                PREVENTIVO: entry.PREVENTIVO || "",
                QUEBRA: entry.QUEBRA || "",
              }))
            : [];

          setEntries(updated);
          setFilteredEntries(updated);
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

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="!w-screen !max-w-none p-6 overflow-y-auto max-h-screen">
          <SheetHeader className="mb-4">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-6 w-6 text-green-600" />
              <SheetTitle>Dados dos Clientes</SheetTitle>
              {entries.length > 0 && (
                <span className="text-sm text-gray-500 ml-2">
                  Última Atualização: {entries[0].ULT_ATUALIZACAO}
                </span>
              )}
            </div>
            <SheetDescription>
              Visualize e gerencie informações dos clientes
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
            </div>

            {/* Filter Panel */}
            {filterOpen && (
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 dark:bg-gray-800">
                <h4 className="font-medium text-gray-800 mb-3 dark:text-white">
                  Filtros
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label
                      htmlFor="filterNome"
                      className="text-sm font-medium mb-1 block dark:text-white"
                    >
                      Nome do cliente
                    </label>
                    <Input
                      id="filterNome"
                      value={filters.nome}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          nome: e.target.value,
                        }))
                      }
                      placeholder="Digite para filtrar"
                      className="h-9"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="filterCpf"
                      className="text-sm font-medium mb-1 block dark:text-white"
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
                      className="text-sm font-medium mb-1 block dark:text-white"
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
                      className="text-sm font-medium mb-1 block dark:text-white"
                    >
                      Data Entrada
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
                </div>
              </div>
            )}
            {/* Client Data Table */}
            <div className="rounded-lg border overflow-x-auto">
              <ScrollArea className="h-[600px] min-w-full">
                <div className="min-w-[2200px] sm:min-w-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[120px]">CPF</TableHead>
                        <TableHead className="w-[100px]">ID Cliente</TableHead>
                        <TableHead className="w-[140px]">Nome</TableHead>
                        <TableHead className="w-[120px]">Carteira</TableHead>
                        <TableHead className="w-[100px]">Risco</TableHead>
                        <TableHead className="w-[130px]">Faixa</TableHead>
                        <TableHead className="w-[80px]">CPC</TableHead>
                        <TableHead className="w-[120px]">
                          Data Entrada
                        </TableHead>
                        <TableHead className="w-[120px]">Telefone</TableHead>
                        <TableHead className="w-[80px]">WhatsApp</TableHead>
                        <TableHead className="w-[140px]">Preventivo</TableHead>
                        <TableHead className="w-[100px]">Quebra</TableHead>
                        <TableHead className="text-center w-[80px]">
                          Observações
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEntries.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={13}
                            className="text-center py-4 text-gray-500"
                          >
                            {entries.length === 0
                              ? "Nenhum cliente registrado"
                              : "Nenhum cliente corresponde aos filtros aplicados"}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredEntries.filter(Boolean).map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell>{entry.CPF}</TableCell>
                            <TableCell>{entry.ID_CLIENTE}</TableCell>
                            <TableCell>{entry.NM_NOME}</TableCell>
                            <TableCell>{entry.CARTEIRA}</TableCell>
                            <TableCell>{entry.RISCO}</TableCell>
                            <TableCell>{entry.FAIXA_CONTRATANTE}</TableCell>
                            <TableCell>{entry.CPC}</TableCell>
                            <TableCell>
                              {formatDate(entry.DATA_ENTRADA)}
                            </TableCell>
                            <TableCell>{entry.TELEFONE_1}</TableCell>
                            <TableCell>
                              {entry.LINK_WPP_TEL && (
                                <a
                                  href={
                                    entry.LINK_WPP_TEL.startsWith("http")
                                      ? entry.LINK_WPP_TEL
                                      : `https://${entry.LINK_WPP_TEL}`
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-green-600 hover:text-green-800"
                                >
                                  WhatsApp
                                </a>
                              )}
                            </TableCell>

                            {/* Coluna Preventivo */}
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center gap-2">
                                <Select
                                  value={
                                    pendingPreventivoChanges[
                                      entry.ID_CLIENTE
                                    ] ?? entry.PREVENTIVO
                                  }
                                  onValueChange={(value) =>
                                    handlePreventivoSelectChange(
                                      entry.ID_CLIENTE,
                                      value
                                    )
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
                                            entry.CARTEIRA
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

                            {/* Coluna Quebra */}
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
                                    entry.OBS_USUARIO
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
              </ScrollArea>
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
            <DialogTitle>Observações do Usuário</DialogTitle>
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
    </>
  );
};

export default PlanilhasModal;
