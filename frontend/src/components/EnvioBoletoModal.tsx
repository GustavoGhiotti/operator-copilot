import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FileText,
  Smartphone,
  Send,
  AlertTriangle,
  MousePointer2,
} from "lucide-react";
import axiosInstance from "@/utils/axiosInstance";
import { useToast } from "@/hooks/use-toast";

interface EnvioBoletoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TipoEnvio = "PREVENTIVO";

interface InsightEnvio {
  preventivo: number;
  recusa: number;
  desligou: number;
  total: number;
}

interface AcordoAtivo {
  ID_ACORDO: number | string;
  ID_CEDENTE?: number | string;
  NM_CONTRATO_CEDENTE?: string;
  NU_PARCELA?: number | string;
  DT_PARCELA?: string;
  DT_PAGAMENTO?: string;
  VL_PARCELA?: number | string;
}

const EnvioBoletoModal: React.FC<EnvioBoletoModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [tipoEnvio, setTipoEnvio] = useState<TipoEnvio | null>(null);

  const [idCliente, setIdCliente] = useState("");
  const [telefoneCliente, setTelefoneCliente] = useState("");

  const [insight, setInsight] = useState<InsightEnvio | null>(null);

  const [boletoFile, setBoletoFile] = useState<File | null>(null);
  const [acordosAtivos, setAcordosAtivos] = useState<AcordoAtivo[]>([]);
  const [idAcordoSelecionado, setIdAcordoSelecionado] = useState<
    string | null
  >(null);

  const carteira = localStorage.getItem("centroCusto") || "Não identificada";
  const idCedente = localStorage.getItem("id_cedente") || "";
  const operador = (localStorage.getItem("nomeCompleto") || "")
    .trim()
    .toUpperCase();

  // ==========================
  // Helpers de formatação
  // ==========================
  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 2) return `(${numbers}`;
    if (numbers.length <= 7)
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length <= 11)
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(
        7,
      )}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(
      7,
      11,
    )}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setTelefoneCliente(formatted);
  };

  const handleIdClienteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIdCliente(e.target.value);
    setAcordosAtivos([]);
    setIdAcordoSelecionado(null);
  };

  const formatValorAcordo = (valor?: number | string) => {
    if (valor === undefined || valor === null || valor === "") return null;

    const valorNumerico =
      typeof valor === "number"
        ? valor
        : Number(String(valor).replace(/\./g, "").replace(",", "."));

    if (Number.isNaN(valorNumerico)) return String(valor);

    return valorNumerico.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  const formatDataAcordo = (data?: string) => {
    if (!data) return null;

    const dataObj = new Date(data);
    if (Number.isNaN(dataObj.getTime())) return data;

    return dataObj.toLocaleDateString("pt-BR", { timeZone: "UTC" });
  };

  const montarLabelAcordo = (acordo: AcordoAtivo) => {
    const partes = [`Acordo ${acordo.ID_ACORDO}`];
    const dataPagamento = formatDataAcordo(
      acordo.DT_PAGAMENTO || acordo.DT_PARCELA,
    );
    const valor = formatValorAcordo(acordo.VL_PARCELA);

    if (dataPagamento) partes.push(dataPagamento);
    if (valor) partes.push(valor);

    return partes.join(" - ");
  };

  // ==========================
  // Insights
  // ==========================
  const carregarInsights = async () => {
    try {
      const { data } = await axiosInstance.get<InsightEnvio>(
        `/api/digital/operador/envio-mensagens?operador=${encodeURIComponent(
          operador,
        )}`,
      );
      setInsight(data);
    } catch (error) {
      console.error("Erro ao carregar insights:", error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      carregarInsights();
    } else {
      setTipoEnvio(null);
      setIdCliente("");
      setTelefoneCliente("");
      setBoletoFile(null);
      setAcordosAtivos([]);
      setIdAcordoSelecionado(null);
    }
  }, [isOpen]);

  const carregarAcordosAtivos = async () => {
    const { data } = await axiosInstance.get<{
      status: boolean;
      acordos: AcordoAtivo[];
      msg?: string;
    }>(
      `/api/digital/cliente/acordos-ativos?idCliente=${encodeURIComponent(
        idCliente.trim(),
      )}&cedente=${encodeURIComponent(carteira)}`,
    );

    if (!data.status) {
      throw new Error(data.msg || "Nao foi possivel validar os acordos.");
    }

    const acordosUnicos = new Map<string, AcordoAtivo>();
    for (const acordo of data.acordos || []) {
      const idAcordo = String(acordo.ID_ACORDO);
      if (!acordosUnicos.has(idAcordo)) {
        acordosUnicos.set(idAcordo, acordo);
      }
    }

    return Array.from(acordosUnicos.values());
  };

  // ==========================
  // Envio
  // ==========================
  const handleSubmit = async () => {
    if (!tipoEnvio) {
      toast({
        title: "Selecione um tipo de envio",
        description: "Escolha entre: Acordo, Recusa ou Cliente desligou.",
        variant: "destructive",
      });
      return;
    }

    if (!idCliente.trim() || !telefoneCliente.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha ID e telefone do cliente.",
        variant: "destructive",
      });
      return;
    }

    const telefoneNumerico = telefoneCliente.replace(/\D/g, "");
    if (telefoneNumerico.length < 10) {
      toast({
        title: "Telefone inválido",
        description: "Informe um número de WhatsApp válido.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      let response;
      let idAcordoParaEnvio = idAcordoSelecionado;

      if (!boletoFile && !idAcordoParaEnvio) {
        const acordos = await carregarAcordosAtivos();

        if (acordos.length === 0) {
          toast({
            title: "Nenhum acordo encontrado",
            description: "Nao foi encontrado acordo ativo para emitir o boleto.",
            variant: "destructive",
          });
          return;
        }

        if (acordos.length > 1) {
          setAcordosAtivos(acordos);
          toast({
            title: "Selecione o acordo",
            description: "Este cliente possui mais de um acordo ativo.",
          });
          return;
        }

        idAcordoParaEnvio = String(acordos[0].ID_ACORDO);
        setIdAcordoSelecionado(idAcordoParaEnvio);
        setAcordosAtivos(acordos);
      }

      if (boletoFile) {
        // Envio com anexo: nao depende de acordo ativo, pois o PDF ja foi informado.
        const formData = new FormData();

        formData.append("idCliente", idCliente);
        formData.append("numeroCliente", telefoneNumerico);
        formData.append("carteira", carteira);
        formData.append("idCedente", idCedente);
        formData.append("operador", operador);
        formData.append("tipoEnvio", tipoEnvio);
        formData.append("boleto", boletoFile);
        if (idAcordoParaEnvio) {
          formData.append("idAcordo", idAcordoParaEnvio);
        }

        console.log("boletoFile:", boletoFile);

        response = await axiosInstance.post(
          "/api/digital/enviar-mensagem",
          formData,
          { headers: { "Content-Type": "multipart/form-data" } },
        );
      } else {
        // 🔹 Envio normal (sem anexo)
        response = await axiosInstance.post(
          "/api/digital/enviar-mensagem",
          {
            idCliente,
            numeroCliente: telefoneNumerico,
            carteira,
            idCedente,
            operador,
            tipoEnvio,
            idAcordo: idAcordoParaEnvio,
          },
        );
      }

      const { data } = response;

      if (data.status) {
        toast({
          title: "Sucesso",
          description: data.msg,
        });

        carregarInsights();
        setIdCliente("");
        setTelefoneCliente("");
        setTipoEnvio(null);
        setBoletoFile(null);
        setAcordosAtivos([]);
        setIdAcordoSelecionado(null);
        onClose();
      } else {
        toast({
          title: "Atenção",
          description: data.msg,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao enviar",
        description:
          error.response?.data?.msg ?? error.message ?? "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // ==========================
  // Pré-visualização
  // ==========================
  const mensagemPreview = gerarMensagemPreview({
    tipoEnvio,
    carteira,
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="boleto-hud-panel max-w-5xl p-4 text-blue-50 md:p-5">
        {/* HEADER */}
        <DialogHeader className="boleto-hud-header mb-1">
          <DialogTitle className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="boleto-hud-title-icon flex h-10 w-10 items-center justify-center rounded-xl">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h2 className="boleto-hud-title text-xl font-semibold">
                  Envio de Mensagem via WhatsApp
                </h2>
                <p className="text-xs text-blue-100/45">
                  Operador:{" "}
                  <span className="font-medium text-blue-50/85">{operador}</span>{" "}
                  • Carteira:{" "}
                  <span className="font-medium text-cyan-300">
                    {carteira}
                  </span>
                </p>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* INSIGHTS */}
        <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-4">
          <Card className="boleto-hud-stat boleto-hud-stat--blue relative rounded-xl p-3.5">
            <p className="text-xs uppercase text-blue-100/60">Total Hoje</p>
            <p className="text-3xl font-bold text-white mt-1">
              {insight?.total ?? 0}
            </p>
          </Card>

          <Card className="boleto-hud-stat boleto-hud-stat--cyan relative rounded-xl p-3.5">
            <p className="text-xs uppercase text-cyan-100/65">Preventivo</p>
            <p className="text-3xl font-bold text-white mt-1">
              {insight?.preventivo ?? 0}
            </p>
          </Card>

          {/* <Card className="relative p-4 bg-yellow-600/20 border border-yellow-500/40 rounded-xl">
            <p className="text-xs text-yellow-200 uppercase">Recusa</p>
            <p className="text-3xl font-bold text-white mt-1">
              {insight?.recusa ?? 0}
            </p>
          </Card>

          <Card className="relative p-4 bg-red-600/20 border border-red-500/40 rounded-xl">
            <p className="text-xs text-red-200 uppercase">Desligou</p>
            <p className="text-3xl font-bold text-white mt-1">
              {insight?.desligou ?? 0}
            </p>
          </Card> */}
        </div>

        {/* TIPOS */}
        <div className="mb-3">
          <p className="mb-2 text-xs text-blue-100/48">
            Escolha o tipo de mensagem:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {["PREVENTIVO"].map((tipo) => (
              <Button
                key={tipo}
                onClick={() => setTipoEnvio("PREVENTIVO")}
                className={`boleto-hud-type ${
                  tipoEnvio === "PREVENTIVO"
                    ? "boleto-hud-type--active"
                    : ""
                }`}
              >
                Preventivo
              </Button>
            ))}
          </div>
        </div>

        {/* FORM */}
        <Card className="boleto-hud-form mb-4 p-3.5">
          {tipoEnvio && (
            <div className="space-y-3">
              <div>
                <Label className="text-blue-50/78">ID do Cliente (EC)</Label>
                <Input
                  value={idCliente}
                  onChange={handleIdClienteChange}
                  placeholder="Digite o EC"
                  className="boleto-hud-input"
                />
              </div>

              <div>
                <Label className="text-blue-50/78">Telefone (WhatsApp)</Label>
                <Input
                  value={telefoneCliente}
                  onChange={handlePhoneChange}
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                  className="boleto-hud-input"
                />
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById("input-boleto")?.click()}
                className="boleto-hud-attach flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Anexar boleto
              </Button>

              {boletoFile && (
                <div className="boleto-hud-file mt-2 flex items-center justify-between rounded-md px-3 py-2">
                  <span className="truncate text-sm text-blue-50/75">
                    📎 {boletoFile.name}
                  </span>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setBoletoFile(null)}
                    className="text-rose-400 hover:text-rose-300"
                  >
                    Remover
                  </Button>
                </div>
              )}

              {acordosAtivos.length > 1 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                  <div className="mb-3 flex items-center gap-2 text-sm text-amber-100">
                    <AlertTriangle className="h-4 w-4 text-amber-300" />
                    Cliente com mais de um acordo ativo. Escolha qual boleto
                    sera enviado.
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {acordosAtivos.map((acordo) => {
                      const idAcordo = String(acordo.ID_ACORDO);
                      const selecionado = idAcordoSelecionado === idAcordo;

                      return (
                        <Button
                          key={idAcordo}
                          type="button"
                          variant="outline"
                          onClick={() => setIdAcordoSelecionado(idAcordo)}
                          className={
                            selecionado
                              ? "justify-start border-emerald-400 bg-emerald-600 text-white"
                              : "justify-start border-zinc-700 bg-zinc-950 text-zinc-200"
                          }
                        >
                          <MousePointer2 className="mr-2 h-4 w-4" />
                          <span className="truncate">
                            {montarLabelAcordo(acordo)}
                          </span>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* PRÉ-VISUALIZAÇÃO */}
        <Card className="boleto-hud-preview rounded-xl p-3.5">
          <div className="flex items-center gap-2 mb-3">
            <Smartphone className="text-cyan-300" />
            <span className="text-sm text-blue-50">Pré-visualização</span>
          </div>

          <pre className="whitespace-pre-wrap break-words text-sm text-blue-50/68">
            {mensagemPreview}
          </pre>
        </Card>

        <input
          type="file"
          accept="application/pdf"
          id="input-boleto"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            setBoletoFile(file ?? null);
          }}
        />

        <DialogFooter className="mt-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="boleto-hud-cancel"
          >
            Cancelar
          </Button>

          <Button
            onClick={handleSubmit}
            disabled={loading || !tipoEnvio}
            className="boleto-hud-send"
          >
            <Send className="mr-2 h-4 w-4" />
            {loading ? "Enviando..." : "Enviar mensagem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EnvioBoletoModal;

/* =============================================
   Função de mensagem (simplificada)
============================================= */

interface PreviewParams {
  tipoEnvio: TipoEnvio | null;
  carteira: string;
}

function gerarMensagemPreview({ tipoEnvio, carteira }: PreviewParams): string {
  if (!tipoEnvio)
    return "Selecione o tipo de envio para visualizar a mensagem.";

  const cart = carteira || "sua carteira";

  switch (tipoEnvio) {
    case "PREVENTIVO":
      return `Prezado(a), Cliente. 
      Seu boleto referente ao ${cart} já está disponivel, em caso de duvidas estamos a disposição.

        Tenha um ótimo dia!`;
    default:
      return "";
  }
}
