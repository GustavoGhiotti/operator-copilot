import React, { useState } from "react";
import axios from "axios";
import Header from "../components/Header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Search, Key, ArrowLeft } from "lucide-react";
import axiosInstance from "@/utils/axiosInstance";

interface SupervisorPasswordResetProps {
  isModal?: boolean;
  onClose?: () => void;
}

const SupervisorPasswordReset: React.FC<SupervisorPasswordResetProps> = ({
  isModal,
  onClose,
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<
    { id: number; nome_colaborador: string; cpf: number }[]
  >([]);
  const [selectedOperator, setSelectedOperator] = useState<{
    id: number;
    nome_colaborador: string;
    cpf: number;
  } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [allOperators, setAllOperators] = useState<
    { id: number; nome_colaborador: string; cpf: number }[]
  >([]);

  // Check admin access
  React.useEffect(() => {
    if (isModal) return;

    const userName = localStorage.getItem("userName");
    const isAdmin =
      userName &&
      (userName.toLowerCase() === "admin" ||
        userName.toLowerCase() === "supervisor");

    if (!isAdmin) {
      toast({
        title: "Acesso Negado",
        description: "Você não tem permissões administrativas.",
        variant: "destructive",
      });
      navigate("/home");
    }
  }, [navigate, toast, isModal]);

  const token = localStorage.getItem("userToken");
  const headers = {
    Authorization: `Bearer ${token}`,
  };

  React.useEffect(() => {
    const fetchAllOperators = async () => {
      try {
        const response = await axiosInstance.get(
          "/api/supervisor/buscar_operadores"
        );
        setAllOperators(response.data.operador);
        setSearchResults(response.data.operador);
      } catch (error) {
        toast({
          title: "Erro ao carregar operadores",
          description: "Não foi possível obter a lista de operadores.",
          variant: "destructive",
        });
      }
    };

    fetchAllOperators();
  }, []);

  const handleSelectOperator = (operator: {
    id: number;
    nome_colaborador: string;
    cpf: number;
  }) => {
    setSelectedOperator({
      id: operator.id,
      nome_colaborador: operator.nome_colaborador.trim(),
      cpf: operator.cpf,
    });
  };

  const handleResetPassword = async () => {
    setIsResetting(true);
    try {
      await axiosInstance.post("/api/auth/change-password", {
        nome_usuario: selectedOperator.nome_colaborador,
        cpf: selectedOperator.cpf,
        senha: null,
      });

      toast({
        title: "Senha resetada com sucesso",
        description: (
          <>
            Senha de {selectedOperator.nome_colaborador} foi resetada com sucesso.
            <br />
            <br />
            <span className="text-orange-500 font-bold text-sm">(A senha é o primeiro nome do operador seguido de 123)</span>
          </>
        )
      });

      setSelectedOperator(null);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível resetar a senha.",
        variant: "destructive",
      });
    }
    setIsResetting(false);
  };

  if (isModal) {
    return (
      <div className="supervisor-password-reset space-y-6 text-slate-100">
        <Card className="copilot-password-card">
          <CardHeader>
            <CardTitle>Buscar Operador</CardTitle>
            <CardDescription>
              Digite o nome do operador para localizar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  className="copilot-password-input"
                  placeholder="Nome ou CPF do operador..."
                  value={searchTerm}
                  onChange={(e) => {
                    const term = e.target.value;
                    setSearchTerm(term);

                    if (term.trim() === "") {
                      setSearchResults(allOperators);
                    } else {
                      const filtered = allOperators.filter((op) =>
                        op.nome_colaborador
                          .toLowerCase()
                          .includes(term.toLowerCase()) ||
                        op.cpf.toString()
                          .includes(term.toLowerCase())
                      );
                      setSearchResults(filtered);
                    }
                  }}
                />
              </div>
              <Button
                onClick={() => {
                  const term = searchTerm.trim().toLowerCase();
                  if (term === "") {
                    setSearchResults(allOperators);
                  } else {
                    const filtered = allOperators.filter((op) =>
                      op.nome_colaborador.toLowerCase().includes(term)
                    );
                    setSearchResults(filtered);
                  }
                }}
                disabled={isSearching || !searchTerm.trim()}
                className="copilot-password-action flex items-center gap-1"
              >
                {isSearching ? "Buscando..." : "Buscar"}
                <Search className="h-4 w-4" />
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="copilot-password-results mt-4 overflow-hidden rounded-md">
                <div className="border-b border-blue-300/10 bg-blue-400/[0.06] p-3 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">
                  Resultados da busca
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {searchResults.map((operator) => (
                    <div
                      key={operator.id}
                      className="flex cursor-pointer items-center justify-between border-b border-blue-300/10 p-3 text-slate-100 transition-colors last:border-b-0 hover:bg-blue-400/[0.09]"
                      onClick={() => handleSelectOperator(operator)}
                    >
                      <span>
                        {operator.nome_colaborador.trim()}
                      </span>

                      <span className="text-sm text-slate-400">
                        {operator.cpf.slice(0, 3)}.{operator.cpf.slice(3, 6)}.{operator.cpf.slice(6, 9)}-{operator.cpf.slice(9, 11)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {selectedOperator && (
          <Card className="copilot-password-card copilot-password-card--accent">
            <CardHeader className="flex flex-row justify-between">
              <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5 text-amber-500" />
                Redefinir Senha
              </CardTitle>
              <CardDescription>
                Definindo nova senha para:{" "}
                <span className="font-semibold">
                  {selectedOperator?.nome_colaborador}
                </span>
              </CardDescription>
              </div>
              <div className="pt-2 flex items-center justify-end gap-2">
                <Button
                  className="copilot-password-action"
                  onClick={handleResetPassword}
                  // disabled={isResetting || !newPassword || !confirmPassword}
                >
                  {isResetting ? "Processando..." : "Resetar Senha"}
                </Button>
                {onClose && (
                  <Button
                    variant="outline"
                    onClick={onClose}
                    className="border-blue-300/20 bg-transparent text-slate-300 hover:bg-blue-400/10 hover:text-white"
                  >
                    Cancelar
                  </Button>
                )}                
              </div>
            </CardHeader>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020711] text-slate-100 flex flex-col transition-colors duration-200">
      <Header visualVariant="aurora" />

      <main className="supervisor-password-reset relative flex-1 container mx-auto px-4 pb-8 pt-28">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <span className="copilot-quick-menu__eyebrow block pb-2">
              SYSTEM / CREDENTIAL CONTROL
            </span>
            <h1 className="text-2xl md:text-3xl font-semibold text-white">
              Alteração de Senha de Operadores
            </h1>
            <p className="text-slate-400">
              Localize o operador e defina uma nova senha
            </p>
          </div>

          <Button
            onClick={() => navigate("/admin")}
            variant="outline"
            className="flex items-center gap-1 border-blue-300/20 bg-blue-400/[0.05] text-blue-100 hover:bg-blue-400/10 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para Admin
          </Button>
        </div>

        <Card className="copilot-password-card mb-6">
          <CardHeader>
            <CardTitle>Buscar Operador</CardTitle>
            <CardDescription>
              Digite o nome do operador para localizar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  className="copilot-password-input"
                  placeholder="Nome ou CPF do operador..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleKeyPress}
                />
              </div>
              <Button
                onClick={handleSearch}
                disabled={isSearching || !searchTerm.trim()}
                className="copilot-password-action flex items-center gap-1"
              >
                {isSearching ? "Buscando..." : "Buscar"}
                <Search className="h-4 w-4" />
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="copilot-password-results mt-4 overflow-hidden rounded-md">
                <div className="border-b border-blue-300/10 bg-blue-400/[0.06] p-3 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">
                  Resultados da busca
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {searchResults.map((operator) => (
                    <div
                      key={operator.id}
                      className="cursor-pointer border-b border-blue-300/10 p-3 text-slate-100 transition-colors last:border-b-0 hover:bg-blue-400/[0.09]"
                      onClick={() => handleSelectOperator(operator)}
                    >
                      {operator.nome_colaborador}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {selectedOperator && (
          <Card className="copilot-password-card copilot-password-card--accent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5 text-amber-500" />
                Redefinir Senha
              </CardTitle>
              <CardDescription>
                Definindo nova senha para:{" "}
                <span className="font-semibold">
                  {selectedOperator.nome_colaborador}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nova Senha</Label>
                  <Input
                    className="copilot-password-input"
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Digite a nova senha"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                  <Input
                    className="copilot-password-input"
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirme a nova senha"
                  />
                </div>
                <div className="pt-2 flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedOperator(null)}
                    className="border-blue-300/20 bg-transparent text-slate-300 hover:bg-blue-400/10 hover:text-white"
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="copilot-password-action"
                    onClick={handleResetPassword}
                    disabled={isResetting || !newPassword || !confirmPassword}
                  >
                    {isResetting ? "Processando..." : "Redefinir Senha"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default SupervisorPasswordReset;
