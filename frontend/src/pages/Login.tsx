import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Eye,
  EyeOff,
  HelpCircle,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface LoginUser {
  cpf: string;
  userName: string;
  nomeCompleto: string;
  funcao: string;
  centroCusto: string;
  id_cedente: string;
  primeiroAcesso: boolean;
  is_admin?: boolean;
  is_gerente?: boolean;
  areas?: string[];
  /** Áreas tiradas explicitamente na tela de acessos. */
  areas_negadas?: string[];
  supervisor?: string;
  pode_operador_whatsapp?: boolean;
  pode_monitoria_whatsapp?: boolean;
  id_olos_cx?: string;
  id_olos_cob?: string;
}

interface LoginResponse {
  token: string;
  usuario: LoginUser;
}

// A gerencia e testada antes do admin de proposito. `is_admin` inclui o centro
// de custo "Gerencia Operacional", entao a ordem anterior fazia todo gerente
// cair em /admin e so alcancar a Central de Gestao digitando @Gestao -- a tela
// feita para ele ficava escondida atras de um comando.
const resolveHomeRoute = (usuario: LoginUser) => {
  if (usuario.areas?.includes("gerencia.gestao")) return "/gerente";
  if (usuario.is_admin) return "/admin";
  if (usuario.is_gerente) return "/gerente";
  return "/home";
};

const Login = () => {
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordHint, setShowPasswordHint] = useState(true);
  const [hoverHint, setHoverHint] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [displayedWelcome, setDisplayedWelcome] = useState("");
  const [destination, setDestination] = useState("/home");
  const loginRef = useRef<HTMLElement>(null);
  const parallaxFrameRef = useRef<number | null>(null);
  const welcomeTimerRef = useRef<number | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowPasswordHint(false);
    }, 10000);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!welcomeMessage) return;

    setDisplayedWelcome("");
    let characterIndex = 0;
    const typingTimer = window.setInterval(() => {
      characterIndex += 1;
      setDisplayedWelcome(welcomeMessage.slice(0, characterIndex));
      if (characterIndex >= welcomeMessage.length) {
        window.clearInterval(typingTimer);
      }
    }, 36);

    welcomeTimerRef.current = window.setTimeout(
      () => window.location.replace(destination),
      Math.max(2600, welcomeMessage.length * 36 + 1000),
    );

    return () => {
      window.clearInterval(typingTimer);
      if (welcomeTimerRef.current !== null) {
        window.clearTimeout(welcomeTimerRef.current);
      }
    };
  }, [destination, welcomeMessage]);

  useEffect(
    () => () => {
      if (parallaxFrameRef.current !== null) {
        window.cancelAnimationFrame(parallaxFrameRef.current);
      }
    },
    [],
  );

  const updateLoginParallax = (clientX: number, clientY: number) => {
    const login = loginRef.current;
    if (
      !login ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const bounds = login.getBoundingClientRect();
    const pointerX = (clientX - bounds.left) / bounds.width - 0.5;
    const pointerY = (clientY - bounds.top) / bounds.height - 0.5;

    if (parallaxFrameRef.current !== null) {
      window.cancelAnimationFrame(parallaxFrameRef.current);
    }

    parallaxFrameRef.current = window.requestAnimationFrame(() => {
      login.style.setProperty("--login-pointer-x", pointerX.toFixed(3));
      login.style.setProperty("--login-pointer-y", pointerY.toFixed(3));
    });
  };

  const resetLoginParallax = () => {
    const login = loginRef.current;
    if (!login) return;
    login.style.setProperty("--login-pointer-x", "0");
    login.style.setProperty("--login-pointer-y", "0");
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      const response = await axios.post<LoginResponse>(
        "/api/auth/login",
        {
          CPF_COLABORADOR: cpf,
          senha: password,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      const { token, usuario } = response.data;

      if (usuario.primeiroAcesso) {
        toast({
          title: "Primeiro acesso detectado",
          description: "Por favor, altere sua senha para continuar.",
        });

        navigate("/change-password", {
          state: {
            userData: {
              cpf: usuario.cpf,
              userName: usuario.userName,
              nomeCompleto: usuario.nomeCompleto,
              funcao: usuario.funcao,
              centroCusto: usuario.centroCusto,
              id_cedente: usuario.id_cedente,
              token,
              is_admin: usuario.is_admin,
              is_gerente: usuario.is_gerente,
              areas: usuario.areas ?? [],
              supervisor: usuario.supervisor,
              pode_operador_whatsapp: usuario.pode_operador_whatsapp,
              pode_monitoria_whatsapp: usuario.pode_monitoria_whatsapp,
              id_olos_cx: usuario.id_olos_cx,
              id_olos_cob: usuario.id_olos_cob,
            },
          },
        });
        return;
      }

      if (!token?.trim()) {
        throw new Error("Token de autenticação não retornado pelo servidor.");
      }

      localStorage.setItem("userToken", token);
      localStorage.setItem("userCpf", usuario.cpf);
      localStorage.setItem("userName", usuario.userName);
      localStorage.setItem("nomeCompleto", usuario.nomeCompleto);
      localStorage.setItem("funcao", usuario.funcao);
      localStorage.setItem("centroCusto", usuario.centroCusto);
      localStorage.setItem("id_cedente", usuario.id_cedente);
      localStorage.setItem("Supervisor", usuario.supervisor || "");
      localStorage.setItem(
        "userCanOperadorWhatsapp",
        String(usuario.pode_operador_whatsapp),
      );
      localStorage.setItem(
        "userCanMonitoriaWhatsapp",
        String(usuario.pode_monitoria_whatsapp),
      );
      localStorage.setItem("userIsAdmin", String(usuario.is_admin));
      localStorage.setItem("userIsGerente", String(usuario.is_gerente));
      localStorage.setItem("userAreas", JSON.stringify(usuario.areas ?? []));
      localStorage.setItem(
        "userAreasNegadas",
        JSON.stringify(usuario.areas_negadas ?? []),
      );
      localStorage.setItem("user_id_olos_cx", String(usuario.id_olos_cx));
      localStorage.setItem("user_id_olos_cob", String(usuario.id_olos_cob));

      const nomeCompleto = usuario.nomeCompleto || usuario.userName || "operador";
      const primeiroNome = nomeCompleto.trim().split(/\s+/)[0];
      setDestination(resolveHomeRoute(usuario));
      setWelcomeMessage(
        `Bem-vindo, ${primeiroNome}. Seu ambiente está pronto para você.`,
      );
      setIsLoading(false);
    } catch (error: unknown) {
      setIsLoading(false);
      console.error("Erro ao fazer login:", error);

      const errorMessage = axios.isAxiosError(error)
        ? error.response?.data?.erro || "Erro ao conectar com o servidor"
        : error instanceof Error
          ? error.message
          : "Erro ao conectar com o servidor";

      toast({
        title: "Erro ao fazer login",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  return (
    <main
      ref={loginRef}
      className={`copilot-login ${
        welcomeMessage ? "copilot-login--welcoming" : ""
      }`}
      onPointerMove={(event) => {
        if (event.pointerType === "mouse") {
          updateLoginParallax(event.clientX, event.clientY);
        }
      }}
      onPointerLeave={resetLoginParallax}
    >
      <div className="copilot-login__visual" aria-hidden="true">
        <img
          src="/images/aurora/aurora-hologram-friendly-v1.png"
          alt=""
          className="copilot-login__aurora"
          draggable={false}
        />
        <div className="copilot-login__orbit copilot-login__orbit--one" />
        <div className="copilot-login__orbit copilot-login__orbit--two" />
        <div className="copilot-login__horizon" />
      </div>

      <header className="copilot-login__brand">
        <img src="/images/AcmeLogoBranco.png" alt="Grupo Acme" />
      </header>

      <section className="copilot-login__panel">
        {!welcomeMessage ? (
          <div className="copilot-login__card">
            <div className="copilot-login__heading">
              <span className="copilot-login__eyebrow">ACESSO AO SISTEMA</span>
              <h1 data-text="Bem-vindo de volta">Bem-vindo de volta</h1>
              <p>Acesse seu ambiente de trabalho.</p>
            </div>

            <form onSubmit={handleLogin} className="copilot-login__form">
              <div className="copilot-login__field">
                <Label htmlFor="cpf">CPF</Label>
                <div className="copilot-login__input">
                  <UserRound aria-hidden="true" />
                  <Input
                    id="cpf"
                    inputMode="numeric"
                    autoComplete="username"
                    placeholder="Digite seu CPF"
                    value={cpf}
                    onChange={(event) => setCpf(event.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="copilot-login__field">
                <div className="copilot-login__label-row">
                  <Label htmlFor="password">Senha</Label>
                  <button
                    type="button"
                    className="copilot-login__hint-trigger"
                    onClick={() => setShowPasswordHint((current) => !current)}
                    onMouseEnter={() => setHoverHint(true)}
                    onMouseLeave={() => setHoverHint(false)}
                  >
                    <HelpCircle aria-hidden="true" />
                    Primeiro acesso?
                  </button>
                </div>

                <div className="copilot-login__input">
                  <LockKeyhole aria-hidden="true" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Digite sua senha"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="copilot-login__password-toggle"
                    aria-label={
                      showPassword ? "Ocultar senha" : "Mostrar senha"
                    }
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>

                {(hoverHint || showPasswordHint) && (
                  <div className="copilot-login__hint">
                    Em caso de primeiro acesso ou reset, utilize seu primeiro
                    nome seguido de <strong>123</strong>.
                  </div>
                )}
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="copilot-login__submit"
              >
                <span>{isLoading ? "AUTENTICANDO..." : "ENTRAR"}</span>
              </Button>
            </form>

            <div className="copilot-login__secure">
              <ShieldCheck aria-hidden="true" />
              <span>AMBIENTE SEGURO</span>
            </div>
          </div>
        ) : (
          <div className="copilot-login__welcome" aria-live="polite">
            <span className="copilot-login__eyebrow">ACESSO AUTORIZADO</span>
            <h1>{displayedWelcome}</h1>
            <p>Abrindo seu ambiente de trabalho...</p>
            <div className="copilot-login__welcome-line" aria-hidden="true" />
          </div>
        )}
      </section>
    </main>
  );
};

export default Login;
