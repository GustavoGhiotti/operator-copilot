import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, ChevronRight, Send, Sparkles, User } from "lucide-react";
import { toast } from "sonner";
import axiosInstance from "@/utils/axiosInstance";

interface PesquisaPortabilidadeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DadosCliente {
  nomeCompleto: string;
  cpf: string;
}

interface Respostas {
  recebeSalarioContaSalario: string;
  conhecePortabilidade: string;
  trariaParaDelta: string;
  motivacaoBeneficio: string;
}

const perguntas = [
  {
    id: 1,
    pergunta:
      "Você recebe seu salário em uma conta-salário indicada pelo seu empregador?",
    tipo: "escolha",
    opcoes: ["Sim", "Não"],
    campo: "recebeSalarioContaSalario",
  },
  {
    id: 2,
    pergunta:
      "Você sabe o que é portabilidade de salário? Já fez a portabilidade alguma vez?",
    tipo: "escolha",
    opcoes: ["Sim, sei e já fiz", "Sim, sei mas nunca fiz", "Não sei o que é"],
    campo: "conhecePortabilidade",
  },
  {
    id: 3,
    pergunta:
      "Você traria seu salário para o Delta, para ser possível gerenciar melhor suas dívidas e quitar seus atrasos?",
    tipo: "escolha",
    opcoes: ["Sim", "Não", "Talvez"],
    campo: "trariaParaDelta",
  },
  {
    id: 4,
    pergunta:
      "O que faria você optar por trazer seu salário para o Delta? Que tipo de benefício poderia te motivar?",
    tipo: "texto",
    campo: "motivacaoBeneficio",
  },
];

const formatarCPF = (valor: string) => {
  const apenasNumeros = valor.replace(/\D/g, "").slice(0, 11);
  return apenasNumeros
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

export default function PesquisaPortabilidadeModal({
  isOpen,
  onClose,
}: PesquisaPortabilidadeModalProps) {
  const [etapaAtual, setEtapaAtual] = useState(-1); // -1 = etapa de dados do cliente
  const [dadosCliente, setDadosCliente] = useState<DadosCliente>({
    nomeCompleto: "",
    cpf: "",
  });
  const [respostas, setRespostas] = useState<Respostas>({
    recebeSalarioContaSalario: "",
    conhecePortabilidade: "",
    trariaParaDelta: "",
    motivacaoBeneficio: "",
  });
  const [enviando, setEnviando] = useState(false);
  const [concluido, setConcluido] = useState(false);

  const totalEtapas = perguntas.length + 1; // +1 para etapa de dados do cliente
  const progresso = ((etapaAtual + 2) / totalEtapas) * 100;
  const perguntaAtual = etapaAtual >= 0 ? perguntas[etapaAtual] : null;

  const handleResposta = (valor: string) => {
    if (perguntaAtual) {
      setRespostas((prev) => ({
        ...prev,
        [perguntaAtual.campo]: valor,
      }));
    }
  };

  const handleDadosCliente = (campo: keyof DadosCliente, valor: string) => {
    if (campo === "cpf") {
      setDadosCliente((prev) => ({ ...prev, cpf: formatarCPF(valor) }));
    } else {
      setDadosCliente((prev) => ({ ...prev, [campo]: valor }));
    }
  };

  const proximaEtapa = () => {
    if (etapaAtual < perguntas.length - 1) {
      setEtapaAtual((prev) => prev + 1);
    }
  };

  const iniciarPesquisa = () => {
    setEtapaAtual(0);
  };

  const podeIniciar = () => {
    const cpfLimpo = dadosCliente.cpf.replace(/\D/g, "");
    return (
      dadosCliente.nomeCompleto.trim().length >= 3 && cpfLimpo.length === 11
    );
  };

  const podeAvancar = () => {
    if (!perguntaAtual) return false;
    const resposta = respostas[perguntaAtual.campo as keyof Respostas];
    return resposta && resposta.trim() !== "";
  };

  const enviarPesquisa = async () => {
    setEnviando(true);
    const operador = localStorage.getItem("nomeCompleto").trim();
    try {
      const payload = {
        operador: operador,
        cliente: {
          nomeCompleto: dadosCliente.nomeCompleto.trim(),
          cpf: dadosCliente.cpf.replace(/\D/g, ""),
        },
        respostas,
      };
      console.log(payload);
      // TODO: Ajustar endpoint conforme sua API
      await axiosInstance.post(
        "/api/delta/enviar-pesquisa",
        payload
      );
      setConcluido(true);
      toast.success("Pesquisa enviada com sucesso!");
    } catch (error) {
      console.error("Erro ao enviar pesquisa:", error);
      toast.error("Erro ao enviar pesquisa. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  const fecharModal = () => {
    setEtapaAtual(-1);
    setDadosCliente({ nomeCompleto: "", cpf: "" });
    setRespostas({
      recebeSalarioContaSalario: "",
      conhecePortabilidade: "",
      trariaParaDelta: "",
      motivacaoBeneficio: "",
    });
    setConcluido(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-gradient-to-br from-background via-background to-primary/5 border-primary/20">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Sparkles className="h-5 w-5 text-primary" />
            Pesquisa - Portabilidade de Salário
          </DialogTitle>
        </DialogHeader>

        {!concluido ? (
          <div className="space-y-6">
            {/* Barra de progresso */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>
                  {etapaAtual === -1
                    ? "Dados do Cliente"
                    : `Pergunta ${etapaAtual + 1} de ${perguntas.length}`}
                </span>
                <span>{Math.round(progresso)}%</span>
              </div>
              <Progress value={progresso} className="h-2" />
            </div>

            {/* Etapa de dados do cliente */}
            {etapaAtual === -1 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-4">
                <div className="flex items-center gap-2 text-lg font-medium mb-2">
                  <User className="h-5 w-5 text-primary" />
                  Informações do Cliente
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Preencha os dados do cliente antes de iniciar a pesquisa.
                </p>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="nomeCompleto">Nome Completo</Label>
                    <Input
                      id="nomeCompleto"
                      placeholder="Digite o nome completo do cliente"
                      value={dadosCliente.nomeCompleto}
                      onChange={(e) =>
                        handleDadosCliente("nomeCompleto", e.target.value)
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cpf">CPF</Label>
                    <Input
                      id="cpf"
                      placeholder="000.000.000-00"
                      value={dadosCliente.cpf}
                      onChange={(e) =>
                        handleDadosCliente("cpf", e.target.value)
                      }
                      maxLength={14}
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button
                    onClick={iniciarPesquisa}
                    disabled={!podeIniciar()}
                    className="gap-2"
                  >
                    Iniciar Pesquisa
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Pergunta atual com animação */}
            {etapaAtual >= 0 && perguntaAtual && (
              <div
                key={perguntaAtual.id}
                className="animate-in fade-in slide-in-from-right-4 duration-300"
              >
                <p className="text-lg font-medium mb-4">
                  {perguntaAtual.pergunta}
                </p>

                {perguntaAtual.tipo === "escolha" && perguntaAtual.opcoes && (
                  <RadioGroup
                    value={respostas[perguntaAtual.campo as keyof Respostas]}
                    onValueChange={handleResposta}
                    className="space-y-3"
                  >
                    {perguntaAtual.opcoes.map((opcao) => (
                      <div
                        key={opcao}
                        className={`flex items-center space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer hover:border-primary/50 hover:bg-primary/5 ${
                          respostas[perguntaAtual.campo as keyof Respostas] ===
                          opcao
                            ? "border-primary bg-primary/10"
                            : "border-border"
                        }`}
                        onClick={() => handleResposta(opcao)}
                      >
                        <RadioGroupItem value={opcao} id={opcao} />
                        <Label
                          htmlFor={opcao}
                          className="flex-1 cursor-pointer font-medium"
                        >
                          {opcao}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}

                {perguntaAtual.tipo === "texto" && (
                  <Textarea
                    placeholder="Digite sua resposta aqui..."
                    value={respostas[perguntaAtual.campo as keyof Respostas]}
                    onChange={(e) => handleResposta(e.target.value)}
                    className="min-h-[120px] resize-none"
                  />
                )}

                {/* Botões de navegação */}
                <div className="flex justify-end gap-3 pt-4">
                  {etapaAtual < perguntas.length - 1 ? (
                    <Button
                      onClick={proximaEtapa}
                      disabled={!podeAvancar()}
                      className="gap-2"
                    >
                      Próxima
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      onClick={enviarPesquisa}
                      disabled={!podeAvancar() || enviando}
                      className="gap-2"
                    >
                      {enviando ? (
                        <>Enviando...</>
                      ) : (
                        <>
                          Enviar Pesquisa
                          <Send className="h-4 w-4" />
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Tela de conclusão */
          <div className="py-8 text-center space-y-4 animate-in fade-in zoom-in duration-500">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
            </div>
            <h3 className="text-xl font-bold">Obrigado pela pesquisa!</h3>
            <p className="text-muted-foreground">
              Suas respostas foram enviadas com sucesso.
            </p>
            <Button onClick={fecharModal} className="mt-4">
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
