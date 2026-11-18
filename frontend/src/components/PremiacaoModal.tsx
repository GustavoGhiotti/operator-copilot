import React, { useState, useEffect } from "react";
import axios from "axios";
import { Gift, Plus, Edit, Trash2, Save, X, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";

interface Reward {
  id: number;
  nome: string;
  descricao: string;
  pontos_necessarios: number;
  categoria: string;
  icone: string;
  disponivel: boolean;
  quantidade_disponivel?: number;
  data_criacao?: string;
  criado_por?: string;
}

interface PremiacaoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PremiacaoModal: React.FC<PremiacaoModalProps> = ({ isOpen, onClose }) => {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [rewardToDelete, setRewardToDelete] = useState<Reward | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    pontos_necessarios: 0,
    categoria: "",
    icone: "gift",
    disponivel: true,
    quantidade_disponivel: undefined as number | undefined,
  });

  const categorias = [
    { value: "folga", label: "Folga" },
    { value: "alimentacao", label: "Alimentação" },
    { value: "pausa", label: "Pausa" },
    { value: "beneficio", label: "Benefício" },
    { value: "premio", label: "Prêmio" },
  ];

  const icones = [
    { value: "gift", label: "🎁 Presente" },
    { value: "clock", label: "⏰ Relógio" },
    { value: "star", label: "⭐ Estrela" },
  ];

  useEffect(() => {
    if (isOpen) {
      fetchRewards();
    }
  }, [isOpen]);

  const fetchRewards = async () => {
    setLoading(true);
    try {
      const response = await axios.get("/api/quiz/premios");
      setRewards(response.data);
    } catch (error) {
      console.error("Erro ao carregar prêmios:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os prêmios.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const resetForm = () => {
    setFormData({
      nome: "",
      descricao: "",
      pontos_necessarios: 0,
      categoria: "",
      icone: "gift",
      disponivel: true,
      quantidade_disponivel: undefined,
    });
  };

  const handleCreate = () => {
    setEditingReward(null);
    resetForm();
    setShowCreateDialog(true);
  };

  const handleEdit = (reward: Reward) => {
    setEditingReward(reward);
    setFormData({
      nome: reward.nome,
      descricao: reward.descricao,
      pontos_necessarios: reward.pontos_necessarios,
      categoria: reward.categoria,
      icone: reward.icone,
      disponivel: reward.disponivel,
      quantidade_disponivel: reward.quantidade_disponivel,
    });
    setShowCreateDialog(true);
  };

  const handleSave = async () => {
    if (
      !formData.nome ||
      !formData.categoria ||
      formData.pontos_necessarios <= 0
    ) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    const userName = localStorage.getItem("nomeCompleto");

    try {
      if (editingReward) {
        // Atualizar prêmio existente
        await axios.put(
          `/api/quiz/premios/${editingReward.id}`,
          {
            ...formData,
            atualizado_por: userName,
          }
        );

        toast({
          title: "Prêmio atualizado!",
          description: "O prêmio foi atualizado com sucesso.",
        });
      } else {
        // Criar novo prêmio
        await axios.post("/api/quiz/premios", {
          ...formData,
          criado_por: userName,
        });
s
        toast({
          title: "Prêmio criado!",
          description: "O novo prêmio foi criado com sucesso.",
        });
      }

      setShowCreateDialog(false);
      resetForm();
      setEditingReward(null);
      await fetchRewards();
    } catch (error) {
      console.error("Erro ao salvar prêmio:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o prêmio.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!rewardToDelete) return;

    try {
      await axios.delete(
        `/api/quiz/premios/${rewardToDelete.id}`
      );

      toast({
        title: "Prêmio excluído!",
        description: "O prêmio foi excluído com sucesso.",
      });

      setShowDeleteDialog(false);
      setRewardToDelete(null);
      await fetchRewards();
    } catch (error) {
      console.error("Erro ao excluir prêmio:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o prêmio.",
        variant: "destructive",
      });
    }
  };

  const toggleDisponibilidade = async (reward: Reward) => {
    try {
      await axios.put(`/api/quiz/premios/${reward.id}`, {
        ...reward,
        disponivel: !reward.disponivel,
        atualizado_por: localStorage.getItem("nomeCompleto"),
      });

      await fetchRewards();

      toast({
        title: "Status atualizado!",
        description: `Prêmio ${
          !reward.disponivel ? "ativado" : "desativado"
        } com sucesso.`,
      });
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status do prêmio.",
        variant: "destructive",
      });
    }
  };

  const getCategoriaLabel = (categoria: string) => {
    return categorias.find((c) => c.value === categoria)?.label || categoria;
  };

  const getIconeDisplay = (icone: string) => {
    return icones.find((i) => i.value === icone)?.label || "🎁 Presente";
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Gift className="h-6 w-6 text-purple-600" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    Gestão de Premiações
                  </h1>
                  <p className="text-gray-600 dark:text-gray-300">
                    Criar e gerenciar prêmios do sistema de pontuação
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleCreate}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Prêmio
                </Button>
                <Button variant="ghost" size="sm" onClick={onClose}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>

          <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">
                    Prêmios Cadastrados ({rewards.length})
                  </h2>
                </div>

                <div className="rounded-lg border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Pontos</TableHead>
                        <TableHead>Quantidade</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rewards.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="text-center py-8 text-gray-500"
                          >
                            Nenhum prêmio cadastrado
                          </TableCell>
                        </TableRow>
                      ) : (
                        rewards.map((reward) => (
                          <TableRow key={reward.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <span className="text-2xl">
                                  {getIconeDisplay(reward.icone).charAt(0)}
                                </span>
                                <div>
                                  <div className="font-medium">
                                    {reward.nome}
                                  </div>
                                  <div className="text-sm text-gray-500 truncate max-w-xs">
                                    {reward.descricao}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {getCategoriaLabel(reward.categoria)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="font-semibold text-purple-600">
                                {reward.pontos_necessarios} pts
                              </span>
                            </TableCell>
                            <TableCell>
                              {reward.quantidade_disponivel || "Ilimitado"}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={reward.disponivel}
                                  onCheckedChange={() =>
                                    toggleDisponibilidade(reward)
                                  }
                                />
                                <span className="text-sm">
                                  {reward.disponivel ? "Ativo" : "Inativo"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(reward)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setRewardToDelete(reward);
                                    setShowDeleteDialog(true);
                                  }}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dialog de Criação/Edição */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingReward ? "Editar Prêmio" : "Novo Prêmio"}
            </DialogTitle>
            <DialogDescription>
              {editingReward
                ? "Atualize as informações do prêmio"
                : "Preencha os dados para criar um novo prêmio"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome do Prêmio *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => handleInputChange("nome", e.target.value)}
                  placeholder="Ex: Kit Kat, Folga extra..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pontos">Pontos Necessários *</Label>
                <Input
                  id="pontos"
                  type="number"
                  value={formData.pontos_necessarios}
                  onChange={(e) =>
                    handleInputChange(
                      "pontos_necessarios",
                      parseInt(e.target.value) || 0
                    )
                  }
                  placeholder="Ex: 500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={formData.descricao}
                onChange={(e) => handleInputChange("descricao", e.target.value)}
                placeholder="Descreva o prêmio..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="categoria">Categoria *</Label>
                <Select
                  value={formData.categoria}
                  onValueChange={(value) =>
                    handleInputChange("categoria", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categorias.map((categoria) => (
                      <SelectItem key={categoria.value} value={categoria.value}>
                        {categoria.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="icone">Ícone</Label>
                <Select
                  value={formData.icone}
                  onValueChange={(value) => handleInputChange("icone", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {icones.map((icone) => (
                      <SelectItem key={icone.value} value={icone.value}>
                        {icone.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantidade">Quantidade Disponível</Label>
                <Input
                  id="quantidade"
                  type="number"
                  value={formData.quantidade_disponivel || ""}
                  onChange={(e) =>
                    handleInputChange(
                      "quantidade_disponivel",
                      e.target.value ? parseInt(e.target.value) : undefined
                    )
                  }
                  placeholder="Deixe vazio para ilimitado"
                />
              </div>

              <div className="space-y-2 flex items-end">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.disponivel}
                    onCheckedChange={(checked) =>
                      handleInputChange("disponivel", checked)
                    }
                  />
                  <Label>Disponível para resgate</Label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Save className="h-4 w-4 mr-2" />
              {editingReward ? "Atualizar" : "Criar"} Prêmio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o prêmio "{rewardToDelete?.nome}"?
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PremiacaoModal;
