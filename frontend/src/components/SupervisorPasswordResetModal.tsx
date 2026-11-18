import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import SupervisorPasswordReset from '@/pages/SupervisorPasswordReset';

interface SupervisorPasswordResetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SupervisorPasswordResetModal: React.FC<SupervisorPasswordResetModalProps> = ({
  isOpen,
  onClose,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="copilot-password-dialog max-w-4xl max-h-[90vh] overflow-y-auto border-blue-300/10 text-slate-100">
        <DialogHeader>
          <span className="copilot-quick-menu__eyebrow">
            SYSTEM / CREDENTIAL CONTROL
          </span>
          <DialogTitle className="text-white">
            Alteração de Senha de Operadores
          </DialogTitle>
        </DialogHeader>
        <div className="mt-2">
          <SupervisorPasswordReset isModal={true} onClose={onClose} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SupervisorPasswordResetModal;
