import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Archive,
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  FileEdit,
  Layers3,
  ImageIcon,
  Plus,
  Save,
  Search,
  Send,
  Settings2,
  ShieldAlert,
  Trash2,
  Upload,
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { qualityWallets, type ChecklistBlockConfig } from "@/config/qualityChecklists";
import {
  ManagedChecklistDefinition,
  deactivateManagedChecklist,
  deleteQualityWallet,
  ensureInitialManagedChecklists,
  publishManagedChecklist,
  saveManagedChecklist,
  uploadQualityWalletLogo,
} from "@/services/qualityChecklistApi";

interface Props {
  token: string | null;
  onChanged: () => Promise<void> | void;
}

const slug = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const emptyChecklist = (): ManagedChecklistDefinition => ({
  id: "",
  label: "",
  description: "",
  walletId: "",
  walletLabel: "",
  walletDescription: "",
  channelId: "",
  channelLabel: "",
  channelDescription: "",
  blocks: [],
});

const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError<{ erro?: string }>(error)) {
    return error.response?.data?.erro || fallback;
  }
  return fallback;
};

const statusStyle: Record<string, string> = {
  PUBLICADO: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  RASCUNHO: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300",
  INATIVO: "border-slate-500/30 bg-slate-500/10 text-slate-500 dark:text-slate-300",
};

export default function QualityChecklistManager({ token, onChanged }: Props) {
  const { toast } = useToast();
  const [items, setItems] = useState<ManagedChecklistDefinition[]>([]);
  const [draft, setDraft] = useState<ManagedChecklistDefinition>(emptyChecklist());
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [walletToDelete, setWalletToDelete] = useState<{ id: string; label: string } | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const load = async (selectFirst = false) => {
    setBusy(true);
    try {
      const result = await ensureInitialManagedChecklists(token);
      setItems(result);
      if (selectFirst && result.length) setDraft(structuredClone(result[0]));
    } catch (error: unknown) {
      toast({
        title: "Não foi possível carregar a gestão",
        description: getErrorMessage(error, "Verifique a conexão com o backend."),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) =>
      `${item.label} ${item.walletLabel} ${item.channelLabel}`.toLowerCase().includes(term),
    );
  }, [items, search]);

  const groupedWallets = useMemo(() => {
    const groups = new Map<string, ManagedChecklistDefinition[]>();
    filteredItems.forEach((item) => {
      groups.set(item.walletId, [...(groups.get(item.walletId) || []), item]);
    });
    return Array.from(groups.entries()).map(([walletId, channels]) => ({
      walletId,
      walletLabel: channels[0].walletLabel,
      walletDescription: channels[0].walletDescription,
      walletLogoSrc:
        channels.find((channel) => channel.walletLogoSrc)?.walletLogoSrc ||
        qualityWallets.find((wallet) => wallet.id === walletId)?.logoSrc,
      channels,
    }));
  }, [filteredItems]);

  const totalItems = useMemo(
    () => draft.blocks.reduce((total, block) => total + block.items.length, 0),
    [draft.blocks],
  );

  const totalNcg = useMemo(
    () => draft.blocks.reduce(
      (total, block) => total + block.items.filter((item) => item.severe).length,
      0,
    ),
    [draft.blocks],
  );

  const updateBlock = (blockIndex: number, next: ChecklistBlockConfig) => {
    setDraft((current) => ({
      ...current,
      blocks: current.blocks.map((block, index) => (index === blockIndex ? next : block)),
    }));
  };

  const addBlock = () => {
    const index = draft.blocks.length + 1;
    setDraft((current) => ({
      ...current,
      blocks: [...current.blocks, { id: `bloco-${index}`, title: `Novo bloco ${index}`, items: [] }],
    }));
  };

  const selectChecklist = (item: ManagedChecklistDefinition) => {
    const fallbackLogo = qualityWallets.find((wallet) => wallet.id === item.walletId)?.logoSrc;
    setDraft(structuredClone({ ...item, walletLogoSrc: item.walletLogoSrc || fallbackLogo || "" }));
    setDetailsOpen(false);
    setAdvancedOpen(false);
  };

  const createChecklist = () => {
    setDraft(emptyChecklist());
    setDetailsOpen(true);
    setAdvancedOpen(false);
  };

  const createChannel = (wallet: (typeof groupedWallets)[number]) => {
    setDraft({
      ...emptyChecklist(),
      walletId: wallet.walletId,
      walletLabel: wallet.walletLabel,
      walletDescription: wallet.walletDescription || "",
      walletLogoSrc: wallet.walletLogoSrc || "",
    });
    setDetailsOpen(true);
    setAdvancedOpen(false);
  };

  const uploadLogo = async (file?: File) => {
    if (!file) return;
    setUploadingLogo(true);
    try {
      const url = await uploadQualityWalletLogo(token, file);
      setDraft((current) => ({ ...current, walletLogoSrc: url }));
      toast({ title: "Logo adicionada", description: "Ela será usada em todos os canais desta carteira." });
    } catch (error: unknown) {
      toast({ title: "Erro ao enviar a logo", description: getErrorMessage(error, "Não foi possível enviar a imagem."), variant: "destructive" });
    } finally {
      setUploadingLogo(false);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      const walletId = draft.walletId || slug(draft.walletLabel);
      const channelId = draft.channelId || slug(draft.channelLabel);
      const normalized = {
        ...draft,
        walletId,
        channelId,
        id: draft.id || slug(`${walletId}-${channelId}-${draft.label}`),
        blocks: draft.blocks.map((block, blockIndex) => ({
          ...block,
          id: block.id || slug(`${block.title}-${blockIndex + 1}`),
          items: block.items.map((item, itemIndex) => ({
            ...item,
            id: item.id || slug(`${block.title}-${item.title}-${itemIndex + 1}`),
            weight: Number(item.weight),
          })),
        })),
      };
      const saved = await saveManagedChecklist(token, normalized);
      setDraft(saved);
      toast({ title: "Rascunho salvo", description: "Revise e publique quando estiver pronto para uso." });
      await load();
      await onChanged();
    } catch (error: unknown) {
      toast({
        title: "Não foi possível salvar",
        description: getErrorMessage(error, "Revise os campos do checklist."),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!draft.versionId) return;
    setBusy(true);
    try {
      await publishManagedChecklist(token, draft.versionId);
      toast({ title: "Checklist publicado", description: "Novas monitorias já utilizarão esta versão." });
      await load();
      await onChanged();
    } catch (error: unknown) {
      toast({ title: "Erro ao publicar", description: getErrorMessage(error, "Não foi possível publicar."), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async () => {
    if (!draft.configId) return;
    setBusy(true);
    try {
      await deactivateManagedChecklist(token, draft.configId);
      toast({ title: "Checklist inativado" });
      setDraft(emptyChecklist());
      await load();
      await onChanged();
    } finally {
      setBusy(false);
    }
  };

  const deleteWallet = async () => {
    if (!walletToDelete) return;
    setBusy(true);
    try {
      await deleteQualityWallet(token, walletToDelete.id, deleteConfirmation);
      toast({ title: "Carteira excluída", description: "Todos os canais e rascunhos dessa carteira foram removidos." });
      if (draft.walletId === walletToDelete.id) setDraft(emptyChecklist());
      setWalletToDelete(null);
      setDeleteConfirmation("");
      await load(false);
      await onChanged();
    } catch (error: unknown) {
      toast({
        title: "Não foi possível excluir",
        description: getErrorMessage(error, "A carteira não pôde ser excluída."),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const setField = (field: keyof ManagedChecklistDefinition, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        {[
          ["1", "Escolha a monitoria", "Selecione uma existente ou comece uma nova.", BookOpenCheck],
          ["2", "Organize por etapas", "Edite primeiro os dados gerais e depois cada bloco.", Layers3],
          ["3", "Salve e publique", "Rascunhos não alteram a monitoria em uso.", CheckCircle2],
        ].map(([step, title, description, Icon]) => (
          <div key={String(step)} className="flex gap-3 rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-sm font-bold text-white">{String(step)}</div>
            <div>
              <div className="flex items-center gap-2 font-semibold"><Icon className="h-4 w-4 text-orange-500" />{String(title)}</div>
              <p className="mt-1 text-xs leading-5 text-slate-500">{String(description)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid min-h-[620px] gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="self-start rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/40 xl:sticky xl:top-0">
          <Button className="h-11 w-full bg-orange-500 hover:bg-orange-600" onClick={createChecklist}>
            <Plus className="mr-2 h-4 w-4" /> Criar nova carteira
          </Button>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar monitoria..." className="pl-9" />
          </div>
          <div className="mb-2 mt-5 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-slate-500">
            <span>Carteiras</span><span>{groupedWallets.length}</span>
          </div>
          <div className="max-h-[470px] space-y-2 overflow-y-auto pr-1">
            {groupedWallets.map((wallet) => (
              <div key={wallet.walletId} className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center gap-3 border-b border-slate-100 p-3 dark:border-slate-800">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                    {wallet.walletLogoSrc ? <img src={wallet.walletLogoSrc} alt={`Logo ${wallet.walletLabel}`} className="h-full w-full object-contain p-1" /> : <ImageIcon className="h-5 w-5 text-slate-400" />}
                  </div>
                  <div className="min-w-0 flex-1"><div className="truncate font-semibold">{wallet.walletLabel}</div><div className="text-[11px] text-slate-500">{wallet.channels.length} {wallet.channels.length === 1 ? "canal" : "canais"}</div></div>
                  <div className="flex shrink-0">
                    <Button variant="ghost" size="icon" title="Adicionar canal" onClick={() => createChannel(wallet)}><Plus className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" title="Excluir carteira" className="text-slate-400 hover:text-red-500" onClick={() => { setWalletToDelete({ id: wallet.walletId, label: wallet.walletLabel }); setDeleteConfirmation(""); }}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                <div className="space-y-1 p-2">
                  {wallet.channels.map((item) => (
                    <button type="button" key={`${item.id}-${item.versionId}`} onClick={() => selectChecklist(item)} className={`w-full rounded-lg p-2.5 text-left transition-colors ${draft.id === item.id ? "bg-orange-50 text-orange-950 dark:bg-orange-950/30 dark:text-orange-100" : "hover:bg-slate-50 dark:hover:bg-slate-900"}`}>
                      <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-medium">{item.channelLabel}</span><Badge variant="outline" className={`shrink-0 text-[9px] ${statusStyle[item.status || ""] || ""}`}>{item.status || "NOVO"}</Badge></div>
                      <div className="mt-1 text-[11px] text-slate-500">{item.label} · versão {item.version || 1}</div>
                    </button>
                  ))}
                  <button type="button" onClick={() => createChannel(wallet)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-950/20"><Plus className="h-3.5 w-3.5" />Adicionar outro canal</button>
                </div>
              </div>
            ))}
            {!groupedWallets.length && <div className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">Nenhuma carteira encontrada.</div>}
          </div>
        </aside>

        <section className="min-w-0 space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold">{draft.label || (draft.walletLabel ? `Novo canal de ${draft.walletLabel}` : "Nova carteira")}</h2>
                  {draft.status && <Badge variant="outline" className={statusStyle[draft.status] || ""}>{draft.status}</Badge>}
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {draft.walletLabel && draft.channelLabel ? `${draft.walletLabel} · ${draft.channelLabel}` : "Preencha os dados gerais para começar."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <Badge variant="secondary"><Layers3 className="mr-1 h-3 w-3" />{draft.blocks.length} blocos</Badge>
                  <Badge variant="secondary"><BookOpenCheck className="mr-1 h-3 w-3" />{totalItems} itens</Badge>
                  <Badge variant="secondary"><ShieldAlert className="mr-1 h-3 w-3" />{totalNcg} NCGs</Badge>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {draft.configId && <Button variant="ghost" onClick={deactivate} disabled={busy} className="text-slate-500"><Archive className="mr-2 h-4 w-4" />Inativar</Button>}
                <Button variant="outline" onClick={save} disabled={busy}><Save className="mr-2 h-4 w-4" />Salvar rascunho</Button>
                <Button onClick={publish} disabled={busy || !draft.versionId || draft.status === "PUBLICADO"} className="bg-orange-500 hover:bg-orange-600"><Send className="mr-2 h-4 w-4" />Publicar versão</Button>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40">
            <button type="button" onClick={() => setDetailsOpen((open) => !open)} className="flex w-full items-center justify-between gap-4 p-5 text-left">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-orange-500/10 p-2 text-orange-500"><FileEdit className="h-5 w-5" /></div>
                <div><h3 className="font-semibold">Dados gerais</h3><p className="text-xs text-slate-500">Nome, carteira, canal e descrição da monitoria.</p></div>
              </div>
              <ChevronDown className={`h-5 w-5 transition-transform ${detailsOpen ? "rotate-180" : ""}`} />
            </button>
            {detailsOpen && (
              <div className="border-t border-slate-200 p-5 dark:border-slate-800">
                <div className="mb-6 flex flex-col gap-4 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-center dark:bg-slate-900/60">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
                    {draft.walletLogoSrc ? <img src={draft.walletLogoSrc} alt="Prévia da logo da carteira" className="h-full w-full object-contain p-2" /> : <ImageIcon className="h-8 w-8 text-slate-300" />}
                  </div>
                  <div className="flex-1">
                    <Label className="text-sm font-semibold">Logo da carteira</Label>
                    <p className="mt-1 text-xs leading-5 text-slate-500">A mesma imagem aparecerá em todos os canais vinculados a esta carteira. Prefira PNG ou WEBP com fundo transparente.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground">
                        <Upload className="mr-2 h-4 w-4" />{uploadingLogo ? "Enviando..." : draft.walletLogoSrc ? "Trocar logo" : "Adicionar logo"}
                        <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={uploadingLogo} onChange={(event) => void uploadLogo(event.target.files?.[0])} />
                      </label>
                      {draft.walletLogoSrc && <Button type="button" variant="ghost" size="sm" className="text-slate-500" onClick={() => setDraft((current) => ({ ...current, walletLogoSrc: "" }))}>Remover</Button>}
                    </div>
                  </div>
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2"><Label>Nome do checklist</Label><Input placeholder="Ex.: Monitoria de voz GAMA" value={draft.label} onChange={(event) => setField("label", event.target.value)} /></div>
                  <div className="space-y-2"><Label>Carteira avaliada</Label><Input placeholder="Ex.: Banco Delta" value={draft.walletLabel} onChange={(event) => setField("walletLabel", event.target.value)} /></div>
                  <div className="space-y-2"><Label>Canal ou produto desta avaliação</Label><Input placeholder="Ex.: GAMA ou Reconquista GAMA" value={draft.channelLabel} onChange={(event) => setField("channelLabel", event.target.value)} /></div>
                  <div className="space-y-2 md:col-span-2"><Label>Objetivo da monitoria</Label><Textarea rows={3} placeholder="Explique quando este checklist deve ser utilizado." value={draft.description} onChange={(event) => setField("description", event.target.value)} /></div>
                </div>
                <button type="button" onClick={() => setAdvancedOpen((open) => !open)} className="mt-5 flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"><Settings2 className="h-4 w-4" />Configurações avançadas<ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`} /></button>
                {advancedOpen && (
                  <div className="mt-4 grid gap-4 rounded-xl bg-slate-50 p-4 md:grid-cols-2 dark:bg-slate-900/60">
                    <div className="space-y-2"><Label>Código da carteira</Label><Input placeholder="Gerado automaticamente" value={draft.walletId} onChange={(event) => setField("walletId", event.target.value)} /></div>
                    <div className="space-y-2"><Label>Código do canal</Label><Input placeholder="Gerado automaticamente" value={draft.channelId} onChange={(event) => setField("channelId", event.target.value)} /></div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3 px-1">
              <div><h3 className="text-lg font-bold">Etapas da avaliação</h3><p className="text-sm text-slate-500">Abra somente o bloco que deseja alterar.</p></div>
              <Button variant="outline" onClick={addBlock}><Plus className="mr-2 h-4 w-4" />Adicionar etapa</Button>
            </div>

            {!draft.blocks.length && (
              <div className="rounded-2xl border border-dashed border-orange-300 bg-orange-50/50 p-10 text-center dark:border-orange-500/30 dark:bg-orange-950/10">
                <Layers3 className="mx-auto h-9 w-9 text-orange-500" />
                <h4 className="mt-3 font-semibold">Comece criando a primeira etapa</h4>
                <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">Use etapas para separar assuntos como abertura, negociação, encerramento e não conformidades.</p>
                <Button className="mt-4 bg-orange-500 hover:bg-orange-600" onClick={addBlock}><Plus className="mr-2 h-4 w-4" />Criar primeira etapa</Button>
              </div>
            )}

            <Accordion type="multiple" className="space-y-3">
              {draft.blocks.map((block, blockIndex) => {
                const ncgCount = block.items.filter((item) => item.severe).length;
                const score = block.items.filter((item) => !item.severe).reduce((total, item) => total + Number(item.weight || 0), 0);
                return (
                  <AccordionItem key={`${block.id}-${blockIndex}`} value={`block-${blockIndex}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white px-0 dark:border-slate-800 dark:bg-slate-950/40">
                    <AccordionTrigger className="px-5 py-4 text-left hover:no-underline">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{blockIndex + 1}</div>
                        <div className="min-w-0"><div className="truncate font-semibold">{block.title || "Etapa sem nome"}</div><div className="mt-1 flex flex-wrap gap-x-3 text-xs font-normal text-slate-500"><span>{block.items.length} itens</span><span>até {score} pts de desconto</span>{ncgCount > 0 && <span className="text-red-500">{ncgCount} NCG</span>}</div></div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="border-t border-slate-200 px-5 pb-5 pt-5 dark:border-slate-800">
                      <div className="flex gap-2">
                        <div className="flex-1 space-y-2"><Label>Nome da etapa</Label><Input value={block.title} onChange={(event) => updateBlock(blockIndex, { ...block, title: event.target.value })} /></div>
                        <Button variant="ghost" size="icon" className="mt-7 text-red-500" title="Excluir etapa" onClick={() => setDraft((current) => ({ ...current, blocks: current.blocks.filter((_, index) => index !== blockIndex) }))}><Trash2 className="h-4 w-4" /></Button>
                      </div>

                      <Accordion type="single" collapsible className="mt-5 space-y-2">
                        {block.items.map((item, itemIndex) => (
                          <AccordionItem key={`${item.id}-${itemIndex}`} value={`item-${itemIndex}`} className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 dark:border-slate-800 dark:bg-slate-900/50">
                            <AccordionTrigger className="gap-3 py-3 text-left hover:no-underline">
                              <div className="flex min-w-0 flex-1 items-center justify-between gap-3 pr-2">
                                <div className="min-w-0"><div className="truncate text-sm font-medium">{item.title || "Novo item sem título"}</div><div className="mt-1 text-xs font-normal text-slate-500">Clique para editar pergunta, orientação e pontuação</div></div>
                                {item.severe ? <Badge variant="destructive" className="shrink-0">NCG</Badge> : <Badge variant="secondary" className="shrink-0">-{item.weight} se não conforme</Badge>}
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="border-t border-slate-200 pb-4 pt-4 dark:border-slate-800">
                              <div className="grid gap-4 md:grid-cols-[1fr_150px]">
                                <div className="space-y-2"><Label>Item avaliado</Label><Input placeholder="O que o monitor deve avaliar?" value={item.title} onChange={(event) => updateBlock(blockIndex, { ...block, items: block.items.map((current, index) => index === itemIndex ? { ...current, title: event.target.value } : current) })} /></div>
                                <div className="space-y-2"><Label>{item.severe ? "Penalidade" : "Desconto se não conforme"}</Label><Input type="number" value={item.weight} onChange={(event) => updateBlock(blockIndex, { ...block, items: block.items.map((current, index) => index === itemIndex ? { ...current, weight: Number(event.target.value) } : current) })} /></div>
                                <div className="space-y-2 md:col-span-2"><Label>Orientação para o monitor</Label><Textarea rows={2} placeholder="Explique de forma simples quando marcar este item." value={item.description} onChange={(event) => updateBlock(blockIndex, { ...block, items: block.items.map((current, index) => index === itemIndex ? { ...current, description: event.target.value } : current) })} /></div>
                              </div>
                              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3 dark:bg-slate-950">
                                <label className="flex cursor-pointer items-center gap-3 text-sm"><input type="checkbox" className="h-4 w-4 accent-red-500" checked={!!item.severe} onChange={(event) => updateBlock(blockIndex, { ...block, items: block.items.map((current, index) => index === itemIndex ? { ...current, severe: event.target.checked } : current) })} /><span><span className="font-medium">Este item é uma NCG</span><span className="ml-2 text-xs text-slate-500">Não conformidade grave</span></span></label>
                                <Button variant="ghost" size="sm" className="text-red-500" onClick={() => updateBlock(blockIndex, { ...block, items: block.items.filter((_, index) => index !== itemIndex) })}><Trash2 className="mr-2 h-4 w-4" />Excluir item</Button>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>

                      <Button variant="outline" size="sm" className="mt-4" onClick={() => updateBlock(blockIndex, { ...block, items: [...block.items, { id: "", title: "", description: "", weight: 0 }] })}><Plus className="mr-2 h-4 w-4" />Adicionar item nesta etapa</Button>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>

          <div className="flex gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-500/20 dark:bg-blue-950/20 dark:text-blue-200">
            <CircleHelp className="mt-0.5 h-5 w-5 shrink-0" />
            <div><strong>Dica:</strong> salve como rascunho sempre que quiser continuar depois. A monitoria usada pela operação só muda quando você clicar em “Publicar versão”.</div>
          </div>
        </section>
      </div>

      <AlertDialog open={!!walletToDelete} onOpenChange={(open) => { if (!open) { setWalletToDelete(null); setDeleteConfirmation(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600"><ShieldAlert className="h-5 w-5" />Excluir carteira de monitoria?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <span className="block">Essa ação excluirá a carteira <strong className="text-foreground">{walletToDelete?.label}</strong>, todos os seus canais e todas as versões que ainda não possuem monitorias registradas.</span>
              <span className="block rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-500/20 dark:bg-amber-950/20 dark:text-amber-200">Se já existir alguma monitoria vinculada, a exclusão será bloqueada para preservar o histórico.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label>Digite <strong>EXCLUIR {walletToDelete?.label}</strong> para confirmar</Label>
            <Input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} placeholder={`EXCLUIR ${walletToDelete?.label || ""}`} autoComplete="off" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <Button variant="destructive" disabled={busy || deleteConfirmation.trim().toUpperCase() !== `EXCLUIR ${walletToDelete?.label || ""}`.trim().toUpperCase()} onClick={() => void deleteWallet()}><Trash2 className="mr-2 h-4 w-4" />Excluir definitivamente</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
