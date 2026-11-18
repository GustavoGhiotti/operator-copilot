
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Search, UserRound, Calendar, DollarSign } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface DeltaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CustomerInfo {
    nome: string;
    dataNascimento: string;
    valorContrato: number;
    valorParcela: number;
    quantidadeParcela: number;
    contrato: string;
  }

// Opções de tabulação para o select
const TABULACOES = [
  { id: "1", description: "Cliente não encontrado" },
  { id: "2", description: "Promessa de pagamento" },
  { id: "3", description: "Negociação iniciada" },
  { id: "4", description: "Cliente sem interesse" },
  { id: "5", description: "Número inválido" },
  { id: "6", description: "Retornar mais tarde" },
  { id: "7", description: "Pagamento já realizado" },
  { id: "8", description: "Contestação de dívida" }
];

const DeltaModal: React.FC<DeltaModalProps> = ({ isOpen, onClose }) => {
  const [cpf, setCpf] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [tabulacao, setTabulacao] = useState("");
  
  // Formata o CPF com pontuação
  const formatCPF = (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    if (numericValue.length <= 3) return numericValue;
    if (numericValue.length <= 6) return `${numericValue.slice(0, 3)}.${numericValue.slice(3)}`;
    if (numericValue.length <= 9) return `${numericValue.slice(0, 3)}.${numericValue.slice(3, 6)}.${numericValue.slice(6)}`;
    return `${numericValue.slice(0, 3)}.${numericValue.slice(3, 6)}.${numericValue.slice(6, 9)}-${numericValue.slice(9, 11)}`;
  };

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedCPF = formatCPF(e.target.value);
    setCpf(formattedCPF);
  };

  const searchCustomer = () => {
    if (!cpf || cpf.replace(/\D/g, '').length < 11) {
      toast({
        variant: "destructive",
        title: "CPF inválido",
        description: "Por favor, insira um CPF válido com 11 dígitos."
      });
      return;
    }

    setIsSearching(true);

    // Simula uma busca na API
    setTimeout(() => {
      // Mock de dados do cliente do Banco Delta
      // Em produção, isso seria substituído por uma chamada real à API
      const mockCustomer: CustomerInfo = {
        nome: "Carlos Andrade Lima",
        dataNascimento: "30/07/2001",
        valorContrato: 8500.00,
        valorParcela: 2750.45,
        quantidadeParcela: 3,
        contrato: "MC2023-87654"
      };

      setCustomerInfo(mockCustomer);
      setIsSearching(false);
    }, 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      searchCustomer();
    }
  };

  const handleSubmitTabulacao = () => {
    if (!tabulacao) {
      toast({
        variant: "destructive",
        title: "Tabulação não selecionada",
        description: "Por favor, selecione uma tabulação antes de salvar."
      });
      return;
    }

    const selectedTabulacao = TABULACOES.find(tab => tab.id === tabulacao);

    toast({
      title: "Tabulação registrada",
      description: `Cliente: ${customerInfo?.nome}, Tabulação: ${selectedTabulacao?.description}`
    });

    // Reset modal state
    setCpf('');
    setCustomerInfo(null);
    setTabulacao('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="p-6 border-b bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 text-white p-2 rounded-full">
                <UserRound className="h-5 w-5" />
              </div>
              <DialogTitle className="text-lg font-semibold">Consulta Banco Delta</DialogTitle>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose} 
              className="h-8 w-8 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="p-6">
          {!customerInfo ? (
            <div className="space-y-4">
              <h2 className="text-lg font-medium">Consulta de Cliente</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Informe o CPF do cliente para consultar suas informações no Banco Delta
              </p>
              <div className="flex gap-2">
                <Input
                  value={cpf}
                  onChange={handleCPFChange}
                  onKeyDown={handleKeyPress}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  className="flex-1"
                />
                <Button 
                  onClick={searchCustomer} 
                  disabled={isSearching || cpf.replace(/\D/g, '').length < 11}
                >
                  {isSearching ? (
                    <div className="h-4 w-4 border-2 border-t-transparent border-white rounded-full animate-spin mr-2"></div>
                  ) : (
                    <Search className="h-4 w-4 mr-2" />
                  )}
                  Buscar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <h2 className="text-lg font-medium border-b pb-2">Informações do Cliente</h2>
              
              <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-xs text-gray-500 dark:text-gray-400">Nome</Label>
                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 p-2 rounded-md border">
                    <UserRound className="h-4 w-4 text-gray-500" />
                    <span className="font-medium">{customerInfo.nome}</span>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label className="text-xs text-gray-500 dark:text-gray-400">Data de Nascimento</Label>
                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 p-2 rounded-md border">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span>{customerInfo.dataNascimento}</span>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label className="text-xs text-gray-500 dark:text-gray-400">Valor do Contrato</Label>
                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 p-2 rounded-md border">
                    <DollarSign className="h-4 w-4 text-gray-500" />
                    <span className="font-medium text-red-600 dark:text-red-400">
                        R$ {customerInfo.valorContrato.toFixed(2).replace('.', ',')}
                    </span>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label className="text-xs text-gray-500 dark:text-gray-400">Valor da Parcela</Label>
                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 p-2 rounded-md border">
                    <DollarSign className="h-4 w-4 text-gray-500" />
                    <span className="font-medium text-red-600 dark:text-red-400">
                        R$ {customerInfo.valorParcela.toFixed(2).replace('.', ',')}
                    </span>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label className="text-xs text-gray-500 dark:text-gray-400">Quantidade de Parcelas</Label>
                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 p-2 rounded-md border">
                    <span>{customerInfo.quantidadeParcela}</span>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label className="text-xs text-gray-500 dark:text-gray-400">Contrato</Label>
                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 p-2 rounded-md border">
                    <span className="font-medium">{customerInfo.contrato}</span>
                    </div>
                </div>
                </div>
                
                <div className="border-t pt-4 mt-4">
                  <div className="space-y-3">
                    <Label htmlFor="tabulacao">Selecione uma Tabulação</Label>
                    <Select value={tabulacao} onValueChange={setTabulacao}>
                      <SelectTrigger id="tabulacao">
                        <SelectValue placeholder="Escolha uma tabulação..." />
                      </SelectTrigger>
                      <SelectContent>
                        {TABULACOES.map(tab => (
                          <SelectItem key={tab.id} value={tab.id}>
                            {tab.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <div className="flex justify-end gap-2 mt-4">
                      <Button variant="outline" onClick={() => {
                        setCpf('');
                        setCustomerInfo(null);
                      }}>
                        Nova Consulta
                      </Button>
                      <Button onClick={handleSubmitTabulacao}>
                        Salvar Tabulação
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeltaModal;