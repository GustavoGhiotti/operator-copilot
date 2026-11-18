import { useState } from "react";

import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

import { ScrollArea } from "@/components/ui/scroll-area";

import ScriptTabs from "./ScriptsTabs";
import ScriptRenderer from "./ScriptRenderer";

export type ScriptType =
  | "script_mercatil_retenção"
  | "script_mercatil_persona"
  | "script_gama"
  | "checklist"
  | "consignado_privado"
  | "tabulacoes"
  | "tabulacoes_gama"

interface ScriptAtendimentoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ScriptAtendimentoModal = ({
  isOpen,
  onClose,
}: ScriptAtendimentoModalProps) => {
  const [scriptAtivo, setScriptAtivo] =
    useState<ScriptType>("consignado_privado");

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
        <ScriptTabs
          scriptAtivo={scriptAtivo}
          onChange={setScriptAtivo}
        />

        <ScrollArea className="h-[calc(90vh-160px)]">
          <ScriptRenderer script={scriptAtivo} />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default ScriptAtendimentoModal;