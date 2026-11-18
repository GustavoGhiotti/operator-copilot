import {
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText } from "lucide-react";

import { ScriptType } from "./ScriptDeltaModal";

interface ScriptTabsProps {
  scriptAtivo: ScriptType;
  onChange: (value: ScriptType) => void;
}

const ScriptTabsGAMA = ({
  scriptAtivo,
  onChange,
}: ScriptTabsProps) => {
  return (
    <DialogHeader className="p-6 pb-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-white/20 rounded-lg">
          <FileText className="h-6 w-6" />
        </div>

        <div className="flex-1">
          <DialogTitle className="text-xl font-bold text-white">
            Script de Atendimento
          </DialogTitle>

          <p className="text-orange-100 text-sm mt-1">
            Selecione script ou tabulações
          </p>
        </div>
      </div>

      <Tabs
        value={scriptAtivo}
        onValueChange={(v) => onChange(v as ScriptType)}
        className="mt-4"
      >
        <TabsList className="text-white bg-white/20">
            <TabsTrigger value="script_gama">
            Script Reconquista
            </TabsTrigger>

            <TabsTrigger value="tabulacoes_gama">
            Tabulações
            </TabsTrigger>
        </TabsList>
      </Tabs>
    </DialogHeader>
  );
};

export default ScriptTabsGAMA;