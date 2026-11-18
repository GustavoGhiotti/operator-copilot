import React, { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
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
import { Save, Filter, CheckCircle2, Circle } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import axiosInstance from "@/utils/axiosInstance";

interface AcionamentoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AcionamentoEntry {
  id: string;
  cpf: string;
  nome_cliente: string;
  dias_atraso: number;
  profissao: string;
  valor_curva: number;
  capital_investido: number;
  data_ultimo_contato: string;
  ultima_acao: string;
  ultima_pessoa: string;
  data_ultima_atualizacao: string;
  status_acionamento: boolean;
  observacao_acionamento: string;
}

const AcionamentoModal: React.FC<AcionamentoModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [entries, setEntries] = useState<AcionamentoEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<AcionamentoEntry[]>(
    []
  );
  const [observationDialogOpen, setObservationDialogOpen] = useState(false);
  const [currentEntry, setCurrentEntry] = useState<AcionamentoEntry | null>(
    null
  );
  const [observationText, setObservationText] = useState("");
  const [loading, setLoading] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState({
    nome: "",
    cpf: "",
    diasAtraso: "",
    status: "",
  });

  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      loadAcionamentos();
    }
  }, [isOpen]);

  useEffect(() => {
    applyFilters();
  }, [filters, entries]);

  const loadAcionamentos = async () => {
    setLoading(true);
    try {
      const operador = localStorage.getItem("nomeCompleto").trim();

      const response = await axiosInstance.get(
        "/api/acionamentos",
        {
          params: { operador: operador },
        }
      );
      setEntries(response.data);
      setFilteredEntries(response.data);
      toast({
        title: "Dados carregados",
        description: "Acionamentos carregados com sucesso",
      });
    } catch (error) {
      console.error("Erro ao carregar acionamentos:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os acionamentos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...entries];

    if (filters.nome) {
      filtered = filtered.filter((entry) =>
        entry.nome_cliente.toLowerCase().includes(filters.nome.toLowerCase())
      );
    }

    if (filters.cpf) {
      filtered = filtered.filter((entry) => entry.cpf.includes(filters.cpf));
    }

    if (filters.diasAtraso) {
      filtered = filtered.filter(
        (entry) => entry.dias_atraso >= parseInt(filters.diasAtraso)
      );
    }

    if (filters.status) {
      const statusBool = filters.status === "acionado";
      filtered = filtered.filter(
        (entry) => entry.status_acionamento === statusBool
      );
    }

    setFilteredEntries(filtered);
  };

  const handleStatusChange = async (entryId: string, newStatus: boolean) => {
    try {
      await axiosInstance.put(
        `/api/acionamentos/${entryId}/status`,
        {
          status_acionamento: newStatus,
        }
      );

      setEntries(
        entries.map((entry) =>
          entry.id === entryId
            ? { ...entry, status_acionamento: newStatus }
            : entry
        )
      );

      toast({
        title: "Status atualizado",
        description: "Status do acionamento atualizado com sucesso",
      });
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status",
        variant: "destructive",
      });
    }
  };

  const openObservationDialog = (entry: AcionamentoEntry) => {
    setCurrentEntry(entry);
    setObservationText(entry.observacao_acionamento || "");
    setObservationDialogOpen(true);
  };

  const saveObservation = async () => {
    if (!currentEntry) return;

    try {
      await axiosInstance.put(
        `/api/acionamentos/${currentEntry.id}/observacao`,
        {
          observacao_acionamento: observationText,
        }
      );

      setEntries(
        entries.map((entry) =>
          entry.id === currentEntry.id
            ? { ...entry, observacao_acionamento: observationText }
            : entry
        )
      );

      toast({
        title: "Observação salva",
        description: "Observação do acionamento salva com sucesso",
      });

      setObservationDialogOpen(false);
      setCurrentEntry(null);
      setObservationText("");
    } catch (error) {
      console.error("Erro ao salvar observação:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar a observação",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatCPF = (cpf: string) => {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR");
  };

  const resetFilters = () => {
    setFilters({
      nome: "",
      cpf: "",
      diasAtraso: "",
      status: "",
    });
  };

  const toggleFilter = () => {
    setFilterOpen(!filterOpen);
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="bottom" className="h-[90vh]">
          <SheetHeader>
            <SheetTitle className="text-2xl font-heading">
              Acionamentos Manuais
            </SheetTitle>
            <SheetDescription>
              Visualize e gerencie os acionamentos pendentes
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            <div className="flex justify-between items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleFilter}
                className="gap-2"
              >
                <Filter className="h-4 w-4" />
                {filterOpen ? "Ocultar Filtros" : "Mostrar Filtros"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={loadAcionamentos}
                disabled={loading}
              >
                {loading ? "Carregando..." : "Atualizar"}
              </Button>
            </div>

            {filterOpen && (
              <div className="grid grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
                <Input
                  placeholder="Filtrar por nome"
                  value={filters.nome}
                  onChange={(e) =>
                    setFilters({ ...filters, nome: e.target.value })
                  }
                />
                <Input
                  placeholder="Filtrar por CPF"
                  value={filters.cpf}
                  onChange={(e) =>
                    setFilters({ ...filters, cpf: e.target.value })
                  }
                />
                <Input
                  placeholder="Dias em atraso (mínimo)"
                  type="number"
                  value={filters.diasAtraso}
                  onChange={(e) =>
                    setFilters({ ...filters, diasAtraso: e.target.value })
                  }
                />
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={filters.status}
                  onChange={(e) =>
                    setFilters({ ...filters, status: e.target.value })
                  }
                >
                  <option value="">Todos os status</option>
                  <option value="acionado">Acionado</option>
                  <option value="pendente">Pendente</option>
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetFilters}
                  className="col-span-4"
                >
                  Limpar Filtros
                </Button>
              </div>
            )}

            <ScrollArea className="h-[calc(90vh-200px)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">CPF</TableHead>
                    <TableHead className="w-[200px]">Nome</TableHead>
                    <TableHead className="w-[100px]">Dias Atraso</TableHead>
                    <TableHead className="w-[150px]">Profissão</TableHead>
                    <TableHead className="w-[120px]">Valor Curva</TableHead>
                    <TableHead className="w-[120px]">Capital Inv.</TableHead>
                    <TableHead className="w-[120px]">Últ. Contato</TableHead>
                    <TableHead className="w-[150px]">Última Ação</TableHead>
                    <TableHead className="w-[150px]">Últ. Pessoa</TableHead>
                    <TableHead className="w-[120px]">
                      Últ. Atualização
                    </TableHead>
                    <TableHead className="w-[100px] text-center">
                      Status
                    </TableHead>
                    <TableHead className="w-[100px]">Observação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-mono text-xs">
                        {formatCPF(entry.cpf)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {entry.nome_cliente}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`font-semibold ${
                            entry.dias_atraso > 90
                              ? "text-destructive"
                              : entry.dias_atraso > 60
                              ? "text-orange-500"
                              : "text-yellow-500"
                          }`}
                        >
                          {entry.dias_atraso} dias
                        </span>
                      </TableCell>
                      <TableCell>{entry.profissao || "-"}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {formatCurrency(entry.valor_curva)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {formatCurrency(entry.capital_investido)}
                      </TableCell>
                      <TableCell>
                        {formatDate(entry.data_ultimo_contato)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {entry.ultima_acao || "-"}
                      </TableCell>
                      <TableCell>{entry.ultima_pessoa || "-"}</TableCell>
                      <TableCell>
                        {formatDate(entry.data_ultima_atualizacao)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleStatusChange(
                              entry.id,
                              !entry.status_acionamento
                            )
                          }
                        >
                          {entry.status_acionamento ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : (
                            <Circle className="h-5 w-5 text-muted-foreground" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openObservationDialog(entry)}
                        >
                          {entry.observacao_acionamento
                            ? "Editar"
                            : "Adicionar"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog
        open={observationDialogOpen}
        onOpenChange={setObservationDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Observação do Acionamento</DialogTitle>
            <DialogDescription>
              Cliente: {currentEntry?.nome_cliente}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={observationText}
            onChange={(e) => setObservationText(e.target.value)}
            placeholder="Descreva o que aconteceu no acionamento..."
            className="min-h-[150px]"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setObservationDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button onClick={saveObservation}>
              <Save className="h-4 w-4 mr-2" />
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AcionamentoModal;
