import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Gift,
  Package,
  Search,
  Target,
  Trophy,
  UserRound,
} from "lucide-react";

import {
  createCopaCampaign,
  fetchCopaOperatorConfig,
  fetchCopaSupervisorConfig,
  saveCopaOperatorConfig,
  type CopaMetaConfig,
  type CopaMetaTipo,
  type CopaOperadorConfigResponse,
  type CopaSupervisorConfigResponse,
} from "@/services/metaCopaApi";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface MetaDraft {
  idMetaTipo: string;
  nome: string;
  codigo: string;
  unidade: string;
  regraComparacao: string;
  ativa: boolean;
  valorAlvo: string;
  frequencia: string;
  qtdPacotes: string;
  qtdFigurinhasPorPacote: string;
  ordemExibicao: number;
}

interface MetaCopaManagerProps {
  onClose?: () => void;
}

type SupervisorQuickAction = "recompensa" | "metas";

const FREQUENCY_OPTIONS = [
  { value: "DIARIA", label: "Diária" },
  { value: "SEMANAL", label: "Semanal" },
  { value: "MENSAL", label: "Mensal" },
];

const numberToInput = (value: number) => {
  if (!Number.isFinite(value)) return "";
  return String(value).replace(/\.0$/, "");
};

const buildGlobalDrafts = (
  tipos: CopaMetaTipo[],
  configs: CopaMetaConfig[],
): MetaDraft[] => {
  const configsByType = new Map(
    configs.map((item) => [item.id_meta_tipo, item]),
  );

  return tipos.map((tipo) => {
    const config = configsByType.get(tipo.id);
    return {
      idMetaTipo: tipo.id,
      nome: tipo.nome,
      codigo: tipo.codigo,
      unidade: tipo.unidade,
      regraComparacao: tipo.regra_comparacao,
      ativa: config?.ativa ?? false,
      valorAlvo: numberToInput(config?.valor_alvo ?? tipo.valor_alvo_padrao),
      frequencia: config?.frequencia ?? tipo.frequencia_padrao,
      qtdPacotes: numberToInput(config?.qtd_pacotes ?? tipo.qtd_pacotes_padrao),
      qtdFigurinhasPorPacote: numberToInput(
        config?.qtd_figurinhas_por_pacote ??
          tipo.qtd_figurinhas_por_pacote_padrao,
      ),
      ordemExibicao: config?.ordem_exibicao ?? tipo.ordem_exibicao,
    };
  });
};

const buildOperatorDrafts = (
  tipos: CopaMetaTipo[],
  globals: MetaDraft[],
  overrides: CopaMetaConfig[],
): MetaDraft[] => {
  const globalByType = new Map(globals.map((item) => [item.idMetaTipo, item]));
  const overridesByType = new Map(
    overrides.map((item) => [item.id_meta_tipo, item]),
  );

  return tipos.map((tipo) => {
    const inherited = globalByType.get(tipo.id);
    const override = overridesByType.get(tipo.id);
    const source = override ?? inherited;

    return {
      idMetaTipo: tipo.id,
      nome: tipo.nome,
      codigo: tipo.codigo,
      unidade: tipo.unidade,
      regraComparacao: tipo.regra_comparacao,
      ativa: source?.ativa ?? inherited?.ativa ?? false,
      valorAlvo: numberToInput(
        source?.valor_alvo ??
          (inherited?.valorAlvo ? Number(inherited.valorAlvo) : undefined) ??
          tipo.valor_alvo_padrao,
      ),
      frequencia:
        source?.frequencia ?? inherited?.frequencia ?? tipo.frequencia_padrao,
      qtdPacotes: numberToInput(
        source?.qtd_pacotes ??
          (inherited?.qtdPacotes ? Number(inherited.qtdPacotes) : undefined) ??
          tipo.qtd_pacotes_padrao,
      ),
      qtdFigurinhasPorPacote: numberToInput(
        source?.qtd_figurinhas_por_pacote ??
          (inherited?.qtdFigurinhasPorPacote
            ? Number(inherited.qtdFigurinhasPorPacote)
            : undefined) ??
          tipo.qtd_figurinhas_por_pacote_padrao,
      ),
      ordemExibicao:
        source?.ordem_exibicao ??
        inherited?.ordemExibicao ??
        tipo.ordem_exibicao,
    };
  });
};

const clampIntegerInput = (value: string, min: number, max: number) => {
  const numeric = Number(value.replace(/[^\d]/g, ""));
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return String(min);
  }
  return String(Math.min(max, Math.max(min, Math.trunc(numeric))));
};

const MetaCopaManager: React.FC<MetaCopaManagerProps> = ({ onClose }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [loadingOperator, setLoadingOperator] = useState(false);
  const [savingOperator, setSavingOperator] = useState(false);
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCpf, setSelectedCpf] = useState<string>("");
  const [campaignName, setCampaignName] = useState("");
  const [campaignPackages, setCampaignPackages] = useState("1");
  const [campaignStickers, setCampaignStickers] = useState("2");
  const [baseConfig, setBaseConfig] =
    useState<CopaSupervisorConfigResponse | null>(null);
  const [operatorConfig, setOperatorConfig] =
    useState<CopaOperadorConfigResponse | null>(null);
  const [globalDrafts, setGlobalDrafts] = useState<MetaDraft[]>([]);
  const [operatorDrafts, setOperatorDrafts] = useState<MetaDraft[]>([]);
  const [activeAction, setActiveAction] =
    useState<SupervisorQuickAction>("metas");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const response = await fetchCopaSupervisorConfig();
        if (cancelled) return;
        setBaseConfig(response);
        setGlobalDrafts(
          buildGlobalDrafts(response.tipos_meta, response.config_global),
        );
      } catch (error: any) {
        if (!cancelled) {
          toast({
            title: "Erro ao carregar metas da Copa",
            description:
              error.response?.data?.erro ||
              "Não foi possível carregar a configuração do supervisor.",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [toast]);

  useEffect(() => {
    if (!selectedCpf || !baseConfig) {
      setOperatorConfig(null);
      setOperatorDrafts([]);
      return;
    }

    let cancelled = false;

    const loadOperator = async () => {
      setLoadingOperator(true);
      try {
        const response = await fetchCopaOperatorConfig(selectedCpf);
        if (cancelled) return;
        setOperatorConfig(response);
      } catch (error: any) {
        if (!cancelled) {
          toast({
            title: "Erro ao carregar operador",
            description:
              error.response?.data?.erro ||
              "Não foi possível carregar as metas do operador.",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) {
          setLoadingOperator(false);
        }
      }
    };

    void loadOperator();

    return () => {
      cancelled = true;
    };
  }, [baseConfig, selectedCpf, toast]);

  useEffect(() => {
    if (!baseConfig || !operatorConfig) {
      return;
    }

    setOperatorDrafts(
      buildOperatorDrafts(
        operatorConfig.tipos_meta,
        globalDrafts,
        operatorConfig.overrides,
      ),
    );
  }, [baseConfig, globalDrafts, operatorConfig]);

  useEffect(() => {
    if (!selectedCpf) {
      setActiveAction("metas");
      return;
    }

    setActiveAction("metas");
  }, [selectedCpf]);

  const filteredOperators = useMemo(() => {
    if (!baseConfig) return [];
    const term = searchTerm.trim().toLowerCase();
    if (!term) return baseConfig.operadores;
    return baseConfig.operadores.filter(
      (operador) =>
        operador.nome.toLowerCase().includes(term) ||
        operador.cpf.toLowerCase().includes(term) ||
        operador.funcao.toLowerCase().includes(term) ||
        operador.centro_custo.toLowerCase().includes(term),
    );
  }, [baseConfig, searchTerm]);

  const selectedOperator = useMemo(
    () =>
      baseConfig?.operadores.find((item) => item.cpf === selectedCpf) ?? null,
    [baseConfig, selectedCpf],
  );

  const handleOperatorFieldChange = (
    idMetaTipo: string,
    field: keyof MetaDraft,
    value: string | boolean,
  ) => {
    setOperatorDrafts((prev) =>
      prev.map((item) =>
        item.idMetaTipo === idMetaTipo ? { ...item, [field]: value } : item,
      ),
    );
  };

  const saveOperator = async () => {
    if (!selectedOperator) return;

    setSavingOperator(true);
    try {
      const payload = {
        metas: operatorDrafts.map((item) => ({
          id_meta_tipo: item.idMetaTipo,
          ativa: item.ativa,
          valor_alvo: Number(item.valorAlvo || 0),
          frequencia: item.frequencia,
          qtd_pacotes: Number(item.qtdPacotes || 0),
          qtd_figurinhas_por_pacote: Number(item.qtdFigurinhasPorPacote || 0),
          ordem_exibicao: item.ordemExibicao,
        })),
      };

      const response = await saveCopaOperatorConfig(
        selectedOperator.cpf,
        payload,
      );
      setOperatorConfig(response.dados);
      setOperatorDrafts(
        buildOperatorDrafts(
          response.dados.tipos_meta,
          globalDrafts,
          response.dados.overrides,
        ),
      );

      toast({
        title: "Metas do operador atualizadas",
        description: `${selectedOperator.nome} já está com a nova configuração da Copa.`,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar operador",
        description:
          error.response?.data?.erro ||
          "Não foi possível salvar as metas personalizadas do operador.",
        variant: "destructive",
      });
    } finally {
      setSavingOperator(false);
    }
  };

  const handleCreateCampaign = async () => {
    if (!selectedOperator) return;

    setCreatingCampaign(true);
    try {
      const response = await createCopaCampaign({
        nome_campanha: campaignName,
        cpf_operador: selectedOperator.cpf,
        qtd_pacotes: Number(campaignPackages || 1),
        qtd_figurinhas_por_pacote: Number(campaignStickers || 1),
      });

      setBaseConfig(response.dados.configuracao);
      setGlobalDrafts(
        buildGlobalDrafts(
          response.dados.configuracao.tipos_meta,
          response.dados.configuracao.config_global,
        ),
      );
      setCampaignName("");
      setCampaignPackages("1");
      setCampaignStickers("2");

      toast({
        title: "Recompensa registrada",
        description: `${selectedOperator.nome} já recebeu os pacotes do álbum.`,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao registrar recompensa",
        description:
          error.response?.data?.erro ||
          "Não foi possível gerar a recompensa do álbum.",
        variant: "destructive",
      });
    } finally {
      setCreatingCampaign(false);
    }
  };

  if (loading) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        Carregando configuração da Copa...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-[#F97316]" />
              Escolha o operador
            </CardTitle>
            <div className="mt-1 text-sm text-muted-foreground">
              Primeiro selecione quem receberá ajuste de meta, recompensa ou
              consulta do álbum.
            </div>
          </div>
          {onClose && (
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Buscar por nome, CPF, função ou carteira..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />

          <div className="max-h-[320px] overflow-y-auto pr-1">
            {filteredOperators.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredOperators.map((operador) => (
                  <button
                    type="button"
                    key={operador.cpf}
                    onClick={() => setSelectedCpf(operador.cpf)}
                    className={`rounded-lg border p-3 text-left transition ${
                      selectedCpf === operador.cpf
                        ? "border-[#F97316] bg-[#F97316]/10"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <div className="text-sm font-black uppercase">
                      {operador.nome}
                    </div>
                    <div className="mt-1 text-xs font-semibold text-muted-foreground">
                      {operador.cpf}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {operador.centro_custo || "Sem carteira"} •{" "}
                      {operador.funcao || "Operador"}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Nenhum operador encontrado na carteira do supervisor.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-[#F97316]" />
            {selectedOperator ? selectedOperator.nome : "Selecione um operador"}
          </CardTitle>
          <div className="text-sm text-muted-foreground">
            {selectedOperator
              ? `${selectedOperator.centro_custo || "Sem carteira"} • ${selectedOperator.funcao || "Operador"}`
              : "Escolha um operador acima para continuar."}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedOperator ? (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              Selecione um operador para registrar recompensa, ajustar metas ou
              visualizar o álbum dele.
            </div>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setActiveAction("recompensa")}
                  className={`rounded-lg border p-4 text-left transition ${
                    activeAction === "recompensa"
                      ? "border-[#F97316] bg-[#F97316]/10"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-black uppercase">
                    <Gift className="h-4 w-4 text-[#F97316]" />
                    Registrar recompensa
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Entregue pacotes para quem venceu uma ação da operação.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveAction("metas")}
                  className={`rounded-lg border p-4 text-left transition ${
                    activeAction === "metas"
                      ? "border-[#F97316] bg-[#F97316]/10"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-black uppercase">
                    <Target className="h-4 w-4 text-[#F97316]" />
                    Ajustar metas
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Defina quando o operador ganha pacotes automaticamente.
                  </div>
                </button>
              </div>

              {activeAction === "recompensa" && (
                <div className="rounded-lg border border-[#F97316]/30 bg-[#F97316]/5 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-black uppercase">
                        <Gift className="h-4 w-4 text-[#F97316]" />
                        Registrar recompensa
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Use quando a ação foi decidida na operação e o
                        supervisor só precisa entregar os pacotes ao vencedor.
                      </div>
                    </div>
                    <div className="rounded-md border border-[#F97316]/30 bg-background px-3 py-2 text-xs font-bold uppercase text-[#C2410C]">
                      Operador vencedor já selecionado
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="space-y-2">
                      <Label>Nome da recompensa</Label>
                      <Input
                        value={campaignName}
                        onChange={(event) =>
                          setCampaignName(event.target.value)
                        }
                        placeholder="Ex.: Top acordo do dia"
                      />
                    </div>

                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
                      <div className="rounded-lg border bg-background p-3 text-sm">
                        <div className="flex items-center gap-2 text-[11px] font-black uppercase text-muted-foreground">
                          <UserRound className="h-4 w-4 text-[#F97316]" />
                          Vencedor
                        </div>
                        <div className="mt-2 font-black uppercase">
                          {selectedOperator.nome}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {selectedOperator.centro_custo || "Sem carteira"} •{" "}
                          {selectedOperator.funcao || "Operador"}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Pacotes</Label>
                        <Input
                          type="number"
                          min={1}
                          max={3}
                          value={campaignPackages}
                          onChange={(event) =>
                            setCampaignPackages(
                              clampIntegerInput(event.target.value, 1, 3),
                            )
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Figurinhas por pacote</Label>
                        <Input
                          type="number"
                          min={1}
                          max={5}
                          value={campaignStickers}
                          onChange={(event) =>
                            setCampaignStickers(
                              clampIntegerInput(event.target.value, 1, 5),
                            )
                          }
                        />
                      </div>
                    </div>

                    <div className="flex items-start gap-2 rounded-md border bg-background p-3 text-xs text-muted-foreground">
                      <Package className="mt-0.5 h-4 w-4 shrink-0 text-[#F97316]" />
                      <span>
                        A recompensa gera pacotes diretamente para o operador.
                        Limite de 3 pacotes e 5 figurinhas por pacote.
                      </span>
                    </div>

                    <Button
                      className="w-full"
                      onClick={handleCreateCampaign}
                      disabled={!selectedOperator || creatingCampaign}
                    >
                      {creatingCampaign
                        ? "Entregando pacotes..."
                        : "Registrar recompensa"}
                    </Button>
                  </div>
                </div>
              )}

              {activeAction === "metas" &&
                (loadingOperator ? (
                  <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                    Carregando metas do operador...
                  </div>
                ) : !(operatorConfig?.tipos_meta.length ?? 0) ? (
                  <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                    {operatorConfig?.contexto_meta?.tipo === "VEGA" ? (
                      <>
                        Nenhuma meta da <strong>Vega</strong> foi encontrada em{" "}
                        <strong>album.TB_ALBUM_META</strong>. Execute o script{" "}
                        <strong>Contatar time de Dev</strong> para liberar a
                        configuração desse operador.
                      </>
                    ) : (
                      <>
                        Nenhuma meta cadastrada em{" "}
                        <strong>album.TB_ALBUM_META</strong>. Cadastre as metas
                        base para liberar a configuração por operador.
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-col gap-4 rounded-lg border bg-muted/30 p-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex items-center gap-2 text-sm font-black uppercase">
                          <CheckCircle2 className="h-4 w-4 text-[#F97316]" />
                          Metas automáticas
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Ajuste só o que muda para este operador. Pacotes e
                          figurinhas continuam como recompensa fixa de cada
                          meta.
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {operatorConfig?.efetivas.length ? (
                            operatorConfig.efetivas.map((meta) => (
                              <span
                                key={meta.id_meta_tipo}
                                className="rounded-md border border-border bg-background px-3 py-2 text-xs font-bold uppercase"
                              >
                                {meta.nome}: {meta.valor_alvo} {meta.unidade}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              Nenhuma meta ativa para esse operador.
                            </span>
                          )}
                        </div>
                      </div>

                      <Button
                        onClick={saveOperator}
                        disabled={
                          !selectedOperator || savingOperator || loadingOperator
                        }
                      >
                        {savingOperator ? "Salvando..." : "Salvar metas"}
                      </Button>
                    </div>

                    {operatorDrafts.map((meta) => (
                      <div
                        key={meta.idMetaTipo}
                        className="rounded-lg border border-border p-4"
                      >
                        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_170px_repeat(2,minmax(0,1fr))_150px_170px]">
                          <div>
                            <div className="text-sm font-black uppercase">
                              {meta.nome}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {meta.regraComparacao} {meta.unidade}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label>Disponível</Label>
                            <label className="flex h-10 items-center gap-3 rounded-md border border-input px-3 text-sm">
                              <input
                                type="checkbox"
                                checked={meta.ativa}
                                onChange={(event) =>
                                  handleOperatorFieldChange(
                                    meta.idMetaTipo,
                                    "ativa",
                                    event.target.checked,
                                  )
                                }
                              />
                              <span>{meta.ativa ? "Sim" : "Não"}</span>
                            </label>
                          </div>

                          <div className="space-y-2">
                            <Label>Alvo</Label>
                            <Input
                              value={meta.valorAlvo}
                              disabled={!meta.ativa}
                              onChange={(event) =>
                                handleOperatorFieldChange(
                                  meta.idMetaTipo,
                                  "valorAlvo",
                                  event.target.value,
                                )
                              }
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Frequência</Label>
                            <select
                              value={meta.frequencia}
                              disabled={!meta.ativa}
                              onChange={(event) =>
                                handleOperatorFieldChange(
                                  meta.idMetaTipo,
                                  "frequencia",
                                  event.target.value,
                                )
                              }
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60"
                            >
                              {FREQUENCY_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-2">
                            <Label>Pacotes fixos</Label>
                            <div className="flex h-10 items-center rounded-md border border-input bg-muted/30 px-3 text-sm font-semibold">
                              {meta.qtdPacotes}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label>Figurinhas fixas</Label>
                            <div className="flex h-10 items-center rounded-md border border-input bg-muted/30 px-3 text-sm font-semibold">
                              {meta.qtdFigurinhasPorPacote}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {operatorDrafts.length === 0 && (
                      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                        Nenhuma opção de meta disponível para configuração.
                      </div>
                    )}
                  </div>
                ))}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-[#F97316]" />
            Recompensas registradas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {baseConfig?.campanhas_recentes?.length ? (
              baseConfig.campanhas_recentes.map((campanha) => (
                <div
                  key={campanha.id}
                  className="rounded-lg border bg-muted/20 p-3"
                >
                  <div className="text-sm font-black uppercase">
                    {campanha.nome}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {campanha.operador.nome} •{" "}
                    {campanha.operador.carteira || "Sem carteira"}
                  </div>
                  <div className="mt-2 text-xs font-semibold uppercase text-muted-foreground">
                    {campanha.qtd_pacotes} pacote
                    {campanha.qtd_pacotes > 1 ? "s" : ""} com{" "}
                    {campanha.qtd_figurinhas_por_pacote} figurinha
                    {campanha.qtd_figurinhas_por_pacote > 1 ? "s" : ""}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Nenhuma recompensa manual registrada até agora.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MetaCopaManager;

