import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import SupervisorOperatorMonitoring from '@/pages/SupervisorOperatorMonitoring';

interface SupervisorOperatorMonitoringModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SupervisorOperatorMonitoringModal: React.FC<SupervisorOperatorMonitoringModalProps> = ({
  isOpen,
  onClose,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
        <DialogTitle className="text-xl font-heading">
            Monitoramento de Operadores
          </DialogTitle>
        </DialogHeader>
        <div className="mt-2">
          <SupervisorOperatorMonitoring isModal={true} onClose={onClose} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SupervisorOperatorMonitoringModal;