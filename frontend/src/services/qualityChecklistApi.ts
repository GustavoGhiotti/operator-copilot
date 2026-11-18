import axios from "axios";
import {
  ChecklistDefinition,
  QualityWalletConfig,
  checklistDefinitions,
  qualityWallets,
} from "@/config/qualityChecklists";

export interface ManagedChecklistDefinition extends ChecklistDefinition {
  configId?: number;
  versionId?: number;
  version?: number;
  status?: "RASCUNHO" | "PUBLICADO" | "ARQUIVADO" | "INATIVO";
  walletLabel: string;
  walletDescription?: string;
  channelDescription?: string;
  walletLogoSrc?: string;
}

const headers = (token: string | null) => ({
  Authorization: `Bearer ${token}`,
});

export const toManagedDefinition = (
  definition: ChecklistDefinition,
): ManagedChecklistDefinition => {
  const wallet = qualityWallets.find((item) => item.id === definition.walletId);
  const channel = wallet?.channels.find((item) => item.id === definition.channelId);
  return {
    ...definition,
    walletLabel: wallet?.label || definition.walletId,
    walletDescription: wallet?.description || "",
    walletLogoSrc: wallet?.logoSrc || "",
    channelDescription: channel?.description || "",
  };
};

export async function loadManagedChecklists(
  token: string | null,
  publishedOnly = false,
) {
  const response = await axios.get<{ checklists: ManagedChecklistDefinition[] }>(
    `/api/qualidade/checklists${publishedOnly ? "?published=true" : ""}`,
    { headers: headers(token) },
  );
  return response.data.checklists || [];
}

export async function saveManagedChecklist(
  token: string | null,
  definition: ManagedChecklistDefinition,
) {
  const response = await axios.post<ManagedChecklistDefinition>(
    "/api/qualidade/checklists",
    definition,
    { headers: headers(token) },
  );
  return response.data;
}

export async function publishManagedChecklist(
  token: string | null,
  versionId: number,
) {
  await axios.post(
    `/api/qualidade/checklists/${versionId}/publicar`,
    {},
    { headers: headers(token) },
  );
}

export async function deactivateManagedChecklist(
  token: string | null,
  configId: number,
) {
  await axios.post(
    `/api/qualidade/checklists/${configId}/desativar`,
    {},
    { headers: headers(token) },
  );
}

export async function uploadQualityWalletLogo(token: string | null, file: File) {
  const data = new FormData();
  data.append("logo", file);
  const response = await axios.post<{ url: string }>(
    "/api/qualidade/carteiras/logo",
    data,
    { headers: { ...headers(token), "Content-Type": "multipart/form-data" } },
  );
  return response.data.url;
}

export async function deleteQualityWallet(
  token: string | null,
  walletId: string,
  confirmation: string,
) {
  await axios.delete(
    `/api/qualidade/checklists/carteiras/${encodeURIComponent(walletId)}`,
    {
      headers: headers(token),
      data: { confirmacao: confirmation },
    },
  );
}

export async function ensureInitialManagedChecklists(token: string | null) {
  const existing = await loadManagedChecklists(token);
  if (existing.length) return existing;

  const imported: ManagedChecklistDefinition[] = [];
  for (const definition of checklistDefinitions) {
    const draft = await saveManagedChecklist(token, toManagedDefinition(definition));
    if (draft.versionId) {
      await publishManagedChecklist(token, draft.versionId);
    }
    imported.push(draft);
  }
  return loadManagedChecklists(token);
}

export function buildRuntimeQualityConfig(
  definitions: ManagedChecklistDefinition[],
): { wallets: QualityWalletConfig[]; checklists: ChecklistDefinition[] } {
  if (!definitions.length) {
    return { wallets: qualityWallets, checklists: checklistDefinitions };
  }

  const checklists: ChecklistDefinition[] = definitions.map((item) => ({
    id: item.id,
    label: item.label,
    walletId: item.walletId,
    channelId: item.channelId,
    channelLabel: item.channelLabel,
    description: item.description,
    blocks: item.blocks,
    configId: item.configId,
    versionId: item.versionId,
    version: item.version,
    walletLogoSrc: item.walletLogoSrc,
  }));

  const grouped = new Map<string, ManagedChecklistDefinition[]>();
  definitions.forEach((definition) => {
    grouped.set(definition.walletId, [
      ...(grouped.get(definition.walletId) || []),
      definition,
    ]);
  });

  const wallets = Array.from(grouped.entries()).map(([walletId, items]) => {
    const fallback = qualityWallets.find((wallet) => wallet.id === walletId);
    const first = items[0];
    const walletLogoSrc = items.find((item) => item.walletLogoSrc)?.walletLogoSrc;
    const matchTerms = [walletId, first.walletLabel].map((value) => value.toLowerCase());
    return {
      id: walletId,
      label: first.walletLabel,
      shortLabel: fallback?.shortLabel || first.walletLabel.toUpperCase(),
      description: first.walletDescription || fallback?.description || "",
      logoSrc: walletLogoSrc || fallback?.logoSrc,
      logoAlt: fallback?.logoAlt,
      accentClassName:
        fallback?.accentClassName || "from-orange-500 via-amber-500 to-yellow-500",
      cardClassName:
        fallback?.cardClassName ||
        "border-orange-200 bg-gradient-to-br from-orange-50 via-white to-amber-50 dark:border-orange-500/20 dark:from-orange-500/10 dark:via-slate-900 dark:to-amber-500/10",
      enabled: true,
      channels: items.map((item) => ({
        id: item.channelId,
        label: item.channelLabel,
        description: item.channelDescription || item.description,
        checklistId: item.id,
      })),
      matchOperator: (operator: { carteira?: string; centro_custo?: string }) => {
        const source = `${operator.carteira || ""} ${operator.centro_custo || ""}`.toLowerCase();
        return matchTerms.some((term) => source.includes(term));
      },
    } satisfies QualityWalletConfig;
  });

  return { wallets, checklists };
}
