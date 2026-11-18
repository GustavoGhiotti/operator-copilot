import { ScriptType } from "./ScriptDeltaModal";

import ConsignadoPrivadoDelta from "./ConsignadoPrivadoDelta";
import DeltaRetencao from "./ScriptDelta";
import DeltaPersona from "./ScriptDeltaPersona";
import ScriptGAMA from "./ScriptGAMA";
import Checklist from "./Checklist";
import Tabulacoes from "./ScriptDeltaTabulacoes";
import TabulacoesGAMA from "./ScriptsGamaTabulacoes";

interface ScriptRendererProps {
  script: ScriptType;
}

const SCRIPT_COMPONENTS: Record<ScriptType, JSX.Element> = {
  script_mercatil_retenção: <DeltaRetencao />,
  script_mercatil_persona: <DeltaPersona />,
  script_gama: <ScriptGAMA />,
  checklist: <Checklist />,
  consignado_privado: <ConsignadoPrivadoDelta />,
  tabulacoes: <Tabulacoes />,
  tabulacoes_gama: <TabulacoesGAMA />,
};

const ScriptRenderer = ({ script }: ScriptRendererProps) => {
  return SCRIPT_COMPONENTS[script] ?? null;
};

export default ScriptRenderer;