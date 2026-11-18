
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import MetaCopaManager from "@/components/MetaCopaManager";

interface SupervisorGoalsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SupervisorGoalsModal: React.FC<SupervisorGoalsModalProps> = ({
  isOpen,
  onClose,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-7xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Metas da Copa por Operador</DialogTitle>
        </DialogHeader>
        <div className="mt-2">
          <MetaCopaManager onClose={onClose} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SupervisorGoalsModal;
