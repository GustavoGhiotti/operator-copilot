import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import ChangePassword from "./components/ChangePassword";
import NotFound from "./pages/NotFound";
import { useEffect, useState } from "react";
import { ThemeProvider } from "./context/ThemeContext";
import { OperatorDataProvider } from "./context/OperatorDataContext";
import { ResultadoOperadorProvider } from "./context/ResultadoOperador";
import { SearchProvider } from "./context/SearchContext";
import SessionWatcher from "./components/SessionWatcher";
import IndexAdmin from "./pages/IndexAdmin";
import CentralGestao from "./pages/CentralGestao";
import IndexGerencia from "./pages/IndexGerencia";
import ResultadosOperacionais from "./pages/ResultadosOperacionais";
import HalloweenEffect from "./components/NatalEffect";
import AvisoNatal from "./components/AvisoNatal";
import AvisoCampanhaIndicacao from "./components/AvisoCampanhaIndicacao";
import ChristmasEffect from "./components/NatalEffect";
import OperadorChat from "./pages/OperadorChat";
import ConversaDetalhe from "./pages/ConversaDetalhe";
import MonitoriaDashboard from "./pages/MonitoriaDashboard";
import { hasArea, normalizeCostCenter } from "./utils/adminCommandAccess";


// Create the QueryClient outside of the component
const queryClient = new QueryClient();

const hasAuthToken = () => Boolean(localStorage.getItem("userToken")?.trim());

// Componente para proteção de rotas
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = hasAuthToken();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = hasAuthToken();
  const isAdmin =
    String(localStorage.getItem("userIsAdmin")).toLowerCase() === "true";
  const isGerente =
    String(localStorage.getItem("userIsGerente")).toLowerCase() === "true";

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Permite admin OU gerente acessarem rotas administrativas
  if (!isAdmin && !isGerente) {
    return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
};

const GerenteRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = hasAuthToken();
  // As duas condicoes antigas continuam no OU porque a rota tem que seguir
  // funcionando entre o deploy e a migration 019: enquanto `userAreas` nao
  // existir na sessao, quem entrava ontem continua entrando. Isto aqui e so
  // navegacao — quem barra de verdade e o servidor, em cada endpoint.
  const isGerente =
    hasArea("gerencia.gestao") ||
    hasArea("gerencia.resultados") ||
    localStorage.getItem("userIsGerente") === "true" ||
    normalizeCostCenter(localStorage.getItem("centroCusto")) ===
      "GERENCIA OPERACIONAL";

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isGerente) {
    return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
};

const OperadorWhatsappRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = hasAuthToken();
  const podeOperadorWhatsapp =
    localStorage.getItem("userCanOperadorWhatsapp") === "true";

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!podeOperadorWhatsapp) {
    return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
};

const MonitoriaWhatsappRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = hasAuthToken();
  const podeMonitoriaWhatsapp =
    localStorage.getItem("userCanMonitoriaWhatsapp") === "true";

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!podeMonitoriaWhatsapp) {
    return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
};

// Make sure App is defined as a function component
function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Simular carregamento inicial
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null; // Pode ser substituído por um loader global
  }

  return (
    <ThemeProvider>
      <ResultadoOperadorProvider>
          <OperatorDataProvider>
            <SearchProvider>
              <QueryClientProvider client={queryClient}>
                <TooltipProvider>
                  <Toaster />
                  <Sonner />
                  <BrowserRouter>
                    <SessionWatcher />
                    <AvisoCampanhaIndicacao />
                    {/* <ChristmasEffect /> */}
                    <Routes>
                      <Route path="/login" element={<Login />} />
                      <Route
                        path="/change-password"
                        element={<ChangePassword />}
                      />
                      <Route
                        path="/home"
                        element={
                          <ProtectedRoute>
                            <Index />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/admin"
                        element={
                          <AdminRoute>
                            <IndexAdmin />
                          </AdminRoute>
                        }
                      />

                      {/*
                        /gerente e a home da gerencia (painel de comandos). A
                        Central de Gestao virou um destino dentro dela, e nao o
                        lugar onde o gerente cai: a Central de Gestao e os
                        Resultados sao telas cheias, sem SearchBar, entao pousar
                        direto em uma delas deixava a gerencia sem @Senhas,
                        @Arena e @Tour.
                      */}
                      <Route
                        path="/gerente"
                        element={
                          <GerenteRoute>
                            <IndexGerencia />
                          </GerenteRoute>
                        }
                      />
                      <Route
                        path="/gerente/central"
                        element={
                          <GerenteRoute>
                            <CentralGestao />
                          </GerenteRoute>
                        }
                      />
                      <Route
                        path="/gerente/resultados"
                        element={
                          <GerenteRoute>
                            <ResultadosOperacionais />
                          </GerenteRoute>
                        }
                      />

                      <Route
                        path="/"
                        element={<Navigate to="/login" replace />}
                      />
                      <Route
                        path="/monitoria-dev"
                        element={
                          <MonitoriaWhatsappRoute>
                            <MonitoriaDashboard />
                          </MonitoriaWhatsappRoute>
                        }
                      />

                      <Route
                        path="/monitoria-dev/conversa/:id"
                        element={
                          <MonitoriaWhatsappRoute>
                            <ConversaDetalhe />
                          </MonitoriaWhatsappRoute>
                        }
                      />

                      {/* ROTAS DO OPERADOR */}

                      <Route
                        path="/operador"
                        element={
                          <OperadorWhatsappRoute>
                            <OperadorChat />
                          </OperadorWhatsappRoute>
                        }
                      />
                      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </BrowserRouter>
                </TooltipProvider>
              </QueryClientProvider>
            </SearchProvider>
          </OperatorDataProvider>
      </ResultadoOperadorProvider>
    </ThemeProvider>
  );
}

export default App;
