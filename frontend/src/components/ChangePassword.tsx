import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock } from "lucide-react";
import axiosInstance from "@/utils/axiosInstance";

const ChangePassword = () => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const location = useLocation();
  const { toast } = useToast();

  // Get user data from location state
  const userData = location.state?.userData;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (newPassword.length < 6) {
      toast({
        title: "Senha muito curta",
        description: "A senha deve ter pelo menos 6 caracteres",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Senhas não coincidem",
        description: "A confirmação de senha não corresponde à nova senha",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Replace with your actual API endpoint for password change
      // O token vai explicito porque nesta tela ele ainda nao esta no
      // localStorage: o Login manda o primeiro acesso para ca antes de gravar
      // a sessao, e o interceptor do axiosInstance le de la. Sem este header a
      // troca da propria senha bate no `@jwt_required` da rota e volta 401.
      await axiosInstance.post("/api/auth/change-password", {
        cpf: userData?.cpf,
        novaSenha: newPassword,
      }, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userData?.token ?? ""}`,
        },
      });
      
      toast({
        title: "Senha alterada com sucesso!",
        description: "Sua senha foi atualizada. Você pode fazer login agora.",
      });

      // Store user data if needed
      localStorage.setItem("userToken", userData?.token ?? "");
      localStorage.setItem("userCpf", userData?.cpf);
      localStorage.setItem("userName", userData?.userName);
      localStorage.setItem("nomeCompleto", userData?.nomeCompleto);
      localStorage.setItem("funcao", userData?.funcao);
      localStorage.setItem("centroCusto", userData?.centroCusto);
      localStorage.setItem("id_cedente", userData?.id_cedente);
      localStorage.setItem("Supervisor", userData?.supervisor ?? "");
      localStorage.setItem("userIsAdmin", String(userData?.is_admin));
      localStorage.setItem("userIsGerente", String(userData?.is_gerente));
      localStorage.setItem("userAreas", JSON.stringify(userData?.areas ?? []));
      localStorage.setItem(
        "userAreasNegadas",
        JSON.stringify(userData?.areas_negadas ?? []),
      );
      localStorage.setItem(
        "userCanOperadorWhatsapp",
        String(userData?.pode_operador_whatsapp)
      );
      localStorage.setItem(
        "userCanMonitoriaWhatsapp",
        String(userData?.pode_monitoria_whatsapp)
      );

      setTimeout(() => {
        // Mesma ordem do resolveHomeRoute do Login: a gerencia vem antes do
        // admin, senao o gerente de primeiro acesso cai em /admin.
        const areas: string[] = userData?.areas ?? [];
        const destination = areas.includes("gerencia.gestao")
          ? "/gerente"
          : userData?.is_admin
            ? "/admin"
            : userData?.is_gerente
              ? "/gerente"
              : "/home";
        window.location.replace(destination);
      }, 1000);
    } catch (error: unknown) {
      setIsLoading(false);
      console.error("Erro ao alterar senha:", error);
      const errorMessage = axios.isAxiosError(error)
        ? error.response?.data?.erro || "Erro ao conectar com o servidor"
        : "Erro ao conectar com o servidor";

      toast({
        title: "Erro ao alterar senha",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const toggleNewPasswordVisibility = () => {
    setShowNewPassword(!showNewPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  return (
    <div className="copilot-login">
      <div className="copilot-login__visual" aria-hidden="true">
        <img
          src="/images/aurora/aurora-hologram-friendly-v1.png"
          alt=""
          className="copilot-login__aurora"
        />
        <div className="copilot-login__orbit copilot-login__orbit--one" />
        <div className="copilot-login__orbit copilot-login__orbit--two" />
        <div className="copilot-login__horizon" />
      </div>

      <div className="copilot-login__panel w-full">
      <div className="w-full max-w-[580px] space-y-6">
        <div className="flex flex-col items-center justify-center">
          <img
            src="/images/AcmeLogoBranco.png"
            alt="Acme Logo"
            className="mb-5 h-12 drop-shadow-[0_0_16px_rgba(59,130,246,0.22)]"
          />
          <span className="copilot-quick-menu__eyebrow">
            SYSTEM / FIRST ACCESS
          </span>
          <h2 className="text-2xl font-semibold text-white">Primeiro Acesso</h2>
          <p className="mt-2 text-center text-sm text-slate-400">
            Altere sua senha para continuar
          </p>
        </div>

        <Card className="copilot-password-card copilot-password-card--accent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-300/20 bg-blue-400/[0.08] shadow-[0_0_18px_rgba(59,130,246,0.14)]">
                <Lock className="h-4 w-4 text-blue-200" />
              </span>
              Alteração de Senha
            </CardTitle>
            <CardDescription className="text-slate-400">
              Por favor, defina uma nova senha para o seu primeiro acesso ao
              sistema
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nova Senha</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    className="copilot-password-input pr-11"
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Digite sua nova senha"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={toggleNewPasswordVisibility}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-300/60 transition-colors hover:text-blue-100"
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    className="copilot-password-input pr-11"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirme sua nova senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={toggleConfirmPasswordVisibility}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-300/60 transition-colors hover:text-blue-100"
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-blue-300/10 bg-blue-400/[0.04] px-3 py-2 text-sm text-slate-400">
                <Lock size={14} className="text-blue-300" />
                <span>A senha deve ter no mínimo 6 caracteres</span>
              </div>
            </CardContent>

            <CardFooter>
              <Button
                type="submit"
                className="copilot-password-action w-full"
                disabled={isLoading}
              >
                {isLoading ? "Processando..." : "Confirmar Alteração"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
      </div>
    </div>
  );
};

export default ChangePassword;
