import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send, Phone, Globe, MessageSquare, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import axiosInstance from "@/utils/axiosInstance";

interface PortalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PortalModal: React.FC<PortalModalProps> = ({ isOpen, onClose }) => {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [messageType, setMessageType] = useState<
    "acordo_realizado" | "acordo_nao_realizado" | ""
  >("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const portalLink = "https://portalacordo.example/";

  const messageTemplates = {
    acordo_realizado: `🎉 Parabéns! Seu acordo foi realizado com sucesso! 

Estamos muito felizes em ajudá-lo a resolver sua situação financeira. Agora você pode acompanhar todos os detalhes do seu acordo de forma prática e segura através do nosso portal.

🌐 Acesse: ${portalLink}

No portal você poderá:
✅ Visualizar detalhes do acordo
✅ Acompanhar parcelas
✅ Consultar histórico de pagamentos
✅ Fazer segunda via de boletos

Qualquer dúvida, estamos sempre à disposição! 💙`,

    acordo_nao_realizado: `Olá! 👋

Entendemos que nem sempre é o momento ideal para fechar um acordo, e isso é totalmente compreensível. 

🤝 Estamos sempre aqui para ajudá-lo quando você estiver pronto!

Que tal conhecer nosso portal de negociação? Lá você pode:
🏠 Negociar no conforto da sua casa
💻 Ver ofertas personalizadas
📱 Simular acordos
⏰ Escolher o melhor horário para você

🌐 Acesse: ${portalLink}

Lembre-se: estamos sempre dispostos a encontrar a melhor solução para sua situação! 💙`,
  };

  const formatPhoneNumber = (value: string) => {
    // Remove tudo que não é número
    const numbers = value.replace(/\D/g, "");

    // Limita a 11 dígitos
    const limited = numbers.slice(0, 11);

    if (limited.length <= 2) {
      return limited;
    } else if (limited.length <= 7) {
      return `(${limited.slice(0, 2)}) ${limited.slice(2)}`;
    } else {
      return `(${limited.slice(0, 2)}) ${limited.slice(2, 7)}-${limited.slice(
        7
      )}`;
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
  };

  const validatePhoneNumber = (phone: string) => {
    const numbers = phone.replace(/\D/g, "");
    return numbers.length === 11 || numbers.length === 10;
  };

  const handleSendMessage = async () => {
    if (!phoneNumber || !messageType) {
      toast({
        title: "Campos obrigatórios",
        description:
          "Por favor, preencha o telefone e selecione o tipo de mensagem.",
        variant: "destructive",
      });
      return;
    }

    if (!validatePhoneNumber(phoneNumber)) {
      toast({
        title: "Telefone inválido",
        description: "Por favor, digite um número de telefone válido.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const cleanPhone = phoneNumber.replace(/\D/g, "");
      const operatorName = localStorage.getItem("nomeCompleto") || "Operador";

      await axiosInstance.post("/api/enviar-whatsapp-portal", {
        telefone: cleanPhone,
        tipo_mensagem: messageType,
        operador: operatorName,
      });

      toast({
        title: "Mensagem enviada!",
        description: `A mensagem foi enviada com sucesso para ${phoneNumber}`,
      });

      // Limpar formulário
      setPhoneNumber("");
      setMessageType("");
      onClose();
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      toast({
        title: "Erro ao enviar mensagem",
        description: "Não foi possível enviar a mensagem. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setPhoneNumber("");
    setMessageType("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
              <Globe className="h-6 w-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl">
                Portal de Negociação
              </DialogTitle>
              <DialogDescription>
                Envie mensagem WhatsApp com link do portal para o cliente
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Campo de Telefone */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm font-medium">
              Telefone do Cliente *
            </Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="phone"
                type="text"
                placeholder="(11) 99999-9999"
                value={phoneNumber}
                onChange={handlePhoneChange}
                className="pl-10 h-11"
                maxLength={15}
              />
            </div>
          </div>

          {/* Seleção do Tipo de Mensagem */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Tipo de Mensagem *</Label>
            <Select
              value={messageType}
              onValueChange={(
                value: "acordo_realizado" | "acordo_nao_realizado"
              ) => setMessageType(value)}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Selecione o tipo de mensagem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="acordo_realizado">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    Acordo Realizado
                  </div>
                </SelectItem>
                <SelectItem value="acordo_nao_realizado">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                    Acordo Não Realizado
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Preview da Mensagem */}
          {messageType && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Preview da Mensagem</Label>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border">
                <div className="flex items-start gap-3">
                  <MessageSquare className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                  <div className="flex-1">
                    <Textarea
                      value={messageTemplates[messageType]}
                      readOnly
                      className="min-h-[200px] resize-none bg-transparent border-none p-0 text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSendMessage}
            disabled={!phoneNumber || !messageType || isLoading}
            className="bg-green-500 hover:bg-green-600"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 border-2 border-t-transparent border-white rounded-full animate-spin" />
                Enviando...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                Enviar WhatsApp
              </div>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PortalModal;
