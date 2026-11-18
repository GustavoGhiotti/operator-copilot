import { useState } from "react";

import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

import { ScrollArea } from "@/components/ui/scroll-area";

import ScriptTabs from "./ChecklistTabsGAMA";
import ScriptRenderer from "./ScriptRenderer";

export type ScriptType =
  | "script_mercatil_retenção"
  | "script_mercatil_persona"
  | "script_gama"
  | "checklist"
  | "consignado_privado"
  | "tabulacoes"
  | "tabulacoes_gama"

interface ScriptGamaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ScriptGamaModal = ({
  isOpen,
  onClose,
}: ScriptGamaModalProps) => {
  const [abertura, setAbertura] =
    useState<ScriptType>("checklist");

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
        <ScriptTabs
          scriptAtivo={abertura}
          onChange={setAbertura}
        />

        <ScrollArea className="h-[calc(90vh-160px)]">
          <ScriptRenderer script={abertura} />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default ScriptGamaModal;