import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

import robot404 from "@/images/crmweb-inoperante.gif";

function AvisoCRMWEB({ isOpen, onClose }) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-3xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold sm:text-xl">
            Sistema Indisponível
          </DialogTitle>
        </DialogHeader>

        <Card className="border-gray-200 bg-yellow-50 dark:bg-blue-50">
          <CardContent className="flex flex-col items-center gap-4 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
            <div className="order-2 text-sm text-gray-600 break-words hyphens-auto sm:order-1 sm:text-base md:text-lg">
              <p className="mb-3 flex items-center gap-3 font-semibold text-gray-800">
                <AlertTriangle className="h-6 w-6 shrink-0 text-orange-600 sm:h-8 sm:w-8 animate-bounce" />
                <span>
                  O sistema para consultar contratos habitacionais está
                  indisponível no momento.
                </span>
              </p>

              <p>
                Não será possível realizar novas consultas após as 20:00 e aos
                sábados, em qualquer horário. Solicito que por ora, sejam
                utilizadas apenas as informações disponíveis no CRM do CollectSys.
              </p>
            </div>

            <img
              src={robot404}
              alt="CRMWEB-Inoperante"
              className="order-1 h-auto w-28 shrink-0 sm:order-2 sm:w-36 md:w-44"
            />
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}

export default AvisoCRMWEB;