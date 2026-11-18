import { createContext, useContext } from "react";

export interface AuroraInteractionController {
  announceCommand: (command: string, action: () => void) => void;
  isAnnouncing: boolean;
}

export const AuroraInteractionContext =
  createContext<AuroraInteractionController | null>(null);

export const useAuroraInteraction = () =>
  useContext(AuroraInteractionContext);
