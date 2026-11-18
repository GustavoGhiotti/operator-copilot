import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Bot, Calendar } from "lucide-react";
import AuroraQuestionInsightsPanel from "@/components/AuroraQuestionInsightsPanel";

interface AuroraInsightModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AuroraInsightModal: React.FC<AuroraInsightModalProps> = ({
  isOpen,
  onClose,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[1280px] h-[92vh] flex flex-col p-0 bg-background overflow-hidden">
        <DialogHeader className="px-6 py-5 border-b bg-gradient-to-r from-primary/10 to-primary/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Bot className="h-6 w-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold">
                Aurora Insight
              </DialogTitle>
              <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                <Calendar className="h-4 w-4" />
                Panorama das perguntas enviadas pelos operadores
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          <AuroraQuestionInsightsPanel variant="full" />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AuroraInsightModal;
