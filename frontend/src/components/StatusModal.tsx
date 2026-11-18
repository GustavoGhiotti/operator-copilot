import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Activity, Clock, PhoneCall, Calendar, TrendingUp, TrendingDown, CheckCircle2 } from 'lucide-react';
import { Progress } from "@/components/ui/progress";

interface StatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const StatusModal: React.FC<StatusModalProps> = ({ isOpen, onClose }) => {
  // Data atual
  const hoje = new Date().toLocaleDateString('pt-BR', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-md md:max-w-lg">
        <SheetHeader className="mb-6">
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-red-500" />
            <SheetTitle>Status do Dia</SheetTitle>
          </div>
          <SheetDescription>
            Produtividade e estatísticas do seu dia
          </SheetDescription>
        </SheetHeader>
        
        <div className="space-y-6">
          <div className="bg-red-50 p-4 rounded-lg border border-red-100">
            <div className="flex justify-between items-center">
              <h3 className="font-medium text-gray-800">Hoje</h3>
              <span className="text-sm text-gray-500">{hoje}</span>
            </div>
            <div className="flex items-center gap-1 mt-1 text-sm text-gray-600">
              <Clock className="h-4 w-4 text-gray-500" />
              <span>Tempo online: 4h 35min</span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-lg border shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <PhoneCall className="h-5 w-5 text-blue-500" />
                <h3 className="font-medium">Ligações</h3>
              </div>
              <div className="text-3xl font-semibold mb-1">38</div>
              <div className="flex items-center text-xs text-green-600">
                <TrendingUp className="h-3 w-3 mr-1" />
                <span>12% acima da média</span>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg border shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <h3 className="font-medium">Acordos</h3>
              </div>
              <div className="text-3xl font-semibold mb-1">7</div>
              <div className="flex items-center text-xs text-red-600">
                <TrendingDown className="h-3 w-3 mr-1" />
                <span>5% abaixo da meta</span>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg border shadow-sm">
            <h3 className="font-medium mb-3">Progresso no dia</h3>
            
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1 text-sm">
                  <span>Meta de ligações (50)</span>
                  <span className="font-medium">76%</span>
                </div>
                <Progress value={76} className="h-2" />
              </div>
              
              <div>
                <div className="flex justify-between mb-1 text-sm">
                  <span>Meta de negociações (12)</span>
                  <span className="font-medium">58%</span>
                </div>
                <Progress value={58} className="h-2" />
              </div>
              
              <div>
                <div className="flex justify-between mb-1 text-sm">
                  <span>Meta de valor recuperado (R$ 15.000)</span>
                  <span className="font-medium">82%</span>
                </div>
                <Progress value={82} className="h-2" />
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-lg border shadow-sm">
              <h3 className="font-medium mb-2">Tempo médio</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Por ligação:</span>
                  <span className="font-medium">4m 28s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Por acordo:</span>
                  <span className="font-medium">12m 15s</span>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg border shadow-sm">
              <h3 className="font-medium mb-2">Valor recuperado</h3>
              <div className="text-xl font-semibold text-green-600">R$ 12.350,00</div>
              <div className="text-xs text-gray-500 mt-1">Meta diária: R$ 15.000,00</div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default StatusModal;