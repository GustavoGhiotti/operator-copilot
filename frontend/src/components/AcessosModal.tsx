import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  RotateCcw,
  Search,
  ShieldCheck,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import permissaoApi, {
  AreaPermissao,
  Perfil,
  Pessoa,
  sincronizarAreas,
} from "@/services/permissaoApi";
import {
  COMANDOS_ADMIN,
  ComandoAdmin,
  getAdminCommandAccessFor,
} from "@/utils/adminCommandAccess";

interface AcessosModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TAMANHO_PAGINA = 20;
const SEM_VISAO = "__padrao__";

/**
 * A tela fala em comando, não em área: ninguém pensa em "senhas.reset", pensa
 * em "@Senhas". O mapa vem de `COMANDOS_ADMIN` justamente para não virar uma
 * cópia que discorda das outras.
 *
 * A concessão continua sendo por área — é o que TB_PERMISSAO_AREA aceita —,
 * então comandos que dividem a mesma área ligam e desligam juntos.
 */
const rotuloDoComando = (item: ComandoAdmin) =>
  item.detalhe ? `${item.comando} · ${item.detalhe}` : item.comando;

const areaPrincipal = (item: ComandoAdmin) => item.areas[0] ?? "";

/**
 * O que a pessoa realmente enxerga, e não só o que as áreas dizem.
 *
 * As regras legadas por centro de custo e função concedem sem área nenhuma —
 * um supervisor tem a Arena pela função. Desenhar a caixinha a partir de
 * `pessoa.areas` mostraria "desmarcado" para um comando que a pessoa usa todo
 * dia. Aqui a tela calcula com a mesma função que o app usa em runtime.
 */
const acessoEfetivo = (pessoa: Pessoa) =>
  getAdminCommandAccessFor({
    costCenter: pessoa.centro_custo,
    role: pessoa.funcao,
    areas: pessoa.areas,
    negadas: Object.entries(pessoa.ajustes ?? {})
      .filter(([, concedida]) => !concedida)
      .map(([area]) => area),
  });

const comandoLigado = (pessoa: Pessoa, item: ComandoAdmin) => {
  const acesso = acessoEfetivo(pessoa);
  return item.flags.some((flag) => acesso[flag]);
};

const formatarCpf = (cpf: string) => {
  const so = (cpf || "").replace(/\D/g, "").padStart(11, "0");
  if (so.length !== 11) return cpf;
  return `${so.slice(0, 3)}.${so.slice(3, 6)}.${so.slice(6, 9)}-${so.slice(9)}`;
};

const AcessosModal: React.FC<AcessosModalProps> = ({ isOpen, onClose }) => {
  const { toast } = useToast();

  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [areasCatalogo, setAreasCatalogo] = useState<AreaPermissao[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<Pessoa | null>(null);

  const [busca, setBusca] = useState("");
  const [filtroPerfil, setFiltroPerfil] = useState<string>("todos");
  const [pagina, setPagina] = useState(1);

  const buscaLimpa = busca.trim();

  /**
   * Universo de áreas, para o ajuste fino oferecer todas.
   *
   * O catálogo (`TB_PERMISSAO_AREA`) entra junto com o que os perfis usam
   * porque é ele que o backend valida em `definir_ajuste`. Derivar só dos
   * perfis funcionava por acidente — a visão "desenvolvimento" contém todas —,
   * e qualquer área nova que não entrasse nela sumia da tela mesmo sendo
   * concedível.
   */
  const todasAsAreas = useMemo(() => {
    const vistas = new Set<string>();
    perfis.forEach((perfil) => perfil.areas.forEach((a) => vistas.add(a)));
    areasCatalogo
      .filter((area) => area.ATIVO !== false)
      .forEach((area) => vistas.add(area.AREA));
    return [...vistas].sort();
  }, [perfis, areasCatalogo]);

  const descricaoDaArea = useMemo(() => {
    const mapa: Record<string, string> = {};
    areasCatalogo.forEach((area) => {
      if (area.DESCRICAO) mapa[area.AREA] = area.DESCRICAO;
    });
    return mapa;
  }, [areasCatalogo]);

  /**
   * Comandos agrupados pela área que os concede. Áreas sem comando conhecido
   * ainda aparecem, com a própria chave como rótulo: melhor mostrar cru do que
   * esconder uma permissão que existe.
   */
  const gruposDeComandos = useMemo(() => {
    const grupos = new Map<string, ComandoAdmin[]>();

    COMANDOS_ADMIN.forEach((item) => {
      const area = areaPrincipal(item);
      // @Tarefas não tem área: é liberado para todo mundo e não se edita.
      if (!area) return;
      grupos.set(area, [...(grupos.get(area) ?? []), item]);
    });

    return todasAsAreas.map((area) => ({
      area,
      descricao: descricaoDaArea[area] ?? "",
      comandos: grupos.get(area) ?? [],
    }));
  }, [todasAsAreas, descricaoDaArea]);

  const comandosSempreLiberados = useMemo(
    () => COMANDOS_ADMIN.filter((item) => !item.areas.length),
    [],
  );

  const avisarErro = useCallback(
    (erro: unknown, titulo: string) => {
      const descricao =
        (erro as { response?: { data?: { erro?: string } } })?.response?.data
          ?.erro ?? "Não foi possível concluir a operação.";
      toast({ title: titulo, description: descricao, variant: "destructive" });
    },
    [toast],
  );

  useEffect(() => {
    if (!isOpen) return;
    let ativo = true;
    (async () => {
      try {
        const lista = await permissaoApi.listarPerfis();
        if (ativo) setPerfis(lista);
      } catch (erro) {
        if (ativo) avisarErro(erro, "Erro ao carregar as visões");
      }

      try {
        const areas = await permissaoApi.listarAreas();
        if (ativo) setAreasCatalogo(areas);
      } catch {
        // Sem o catálogo a tela ainda funciona com as áreas dos perfis.
      }
    })();
    return () => {
      ativo = false;
    };
  }, [isOpen, avisarErro]);

  // Busca no servidor com debounce e cancelamento — mesmo padrão do
  // ArenaSupervisorPanel. Sem o cancelamento, uma resposta lenta de "jo"
  // chega depois de "josielho" e sobrescreve a lista certa.
  useEffect(() => {
    if (!isOpen) return;

    let ativo = true;
    setCarregando(true);
    const timer = window.setTimeout(async () => {
      try {
        const resultado = await permissaoApi.listarPessoas({
          busca: buscaLimpa || undefined,
          perfil: filtroPerfil === "todos" ? undefined : filtroPerfil,
          pagina,
          tamanho: TAMANHO_PAGINA,
        });
        if (!ativo) return;
        setPessoas(resultado.pessoas);
        setTotal(resultado.total);
      } catch (erro) {
        if (ativo) avisarErro(erro, "Erro ao listar colaboradores");
      } finally {
        if (ativo) setCarregando(false);
      }
    }, 250);

    return () => {
      ativo = false;
      window.clearTimeout(timer);
    };
  }, [isOpen, buscaLimpa, filtroPerfil, pagina, avisarErro]);

  const aplicar = async (cpf: string, acao: () => Promise<Pessoa>) => {
    setSalvando(cpf);
    try {
      const atualizada = await acao();
      setPessoas((atuais) =>
        atuais.map((p) => (p.cpf === cpf ? { ...p, ...atualizada } : p)),
      );
      if (expandido === cpf) setDetalhe(atualizada);
      // Quem está mexendo pode ter alterado o próprio acesso.
      await sincronizarAreas();
      return atualizada;
    } catch (erro) {
      avisarErro(erro, "Erro ao alterar o acesso");
      return null;
    } finally {
      setSalvando(null);
    }
  };

  const trocarVisao = async (pessoa: Pessoa, valor: string) => {
    const atualizada = await aplicar(pessoa.cpf, () =>
      valor === SEM_VISAO
        ? permissaoApi.removerVisao(pessoa.cpf)
        : permissaoApi.definirVisao(pessoa.cpf, valor),
    );
    if (!atualizada) return;

    toast({
      title: valor === SEM_VISAO ? "Voltou ao padrão do cargo" : "Visão definida",
      description:
        valor === SEM_VISAO
          ? `${pessoa.nome} volta a ver o que a função dele dá.`
          : `${pessoa.nome} agora tem a visão ${
              perfis.find((p) => p.codigo === valor)?.nome ?? valor
            }.`,
    });
  };

  const alternarArea = async (pessoa: Pessoa, area: string) => {
    await aplicar(pessoa.cpf, () =>
      // Sempre explícito: ver `alternarComando`.
      permissaoApi.definirAjuste(pessoa.cpf, area, !pessoa.areas.includes(area)),
    );
  };

  /** Apaga o ajuste: a área volta a seguir a visão ou o padrão do cargo. */
  const voltarAoPadrao = async (pessoa: Pessoa, item: ComandoAdmin) => {
    await aplicar(pessoa.cpf, async () => {
      let atualizada = pessoa;
      for (const area of item.areas) {
        atualizada = await permissaoApi.definirAjuste(pessoa.cpf, area, null);
      }
      return atualizada;
    });
  };

  /**
   * Liga/desliga um comando mexendo nas áreas que o concedem.
   *
   * O ajuste é gravado **sempre explícito** (`true`/`false`), nunca `null`.
   * Colapsar em `null` quando o novo estado coincidia com o pacote era o que
   * tornava a tela não-absoluta: para quem não tem visão atribuída, desmarcar
   * apagava o ajuste e a área voltava pela regra de cargo — a caixinha
   * reaparecia sozinha. Quem quer o comportamento antigo usa "voltar ao
   * padrão".
   *
   * Desligar nega todas as áreas que liberam o comando: deixar uma de pé faria
   * o comando continuar aparecendo. Ligar concede só a principal.
   */
  const alternarComando = async (pessoa: Pessoa, item: ComandoAdmin) => {
    // Estado efetivo, o mesmo que a linha desenha: um comando concedido pelo
    // cargo aparece marcado, e clicar nele precisa negar, não conceder.
    const ligado = comandoLigado(pessoa, item);
    const alvos = ligado ? item.areas : [areaPrincipal(item)];

    if (!alvos.filter(Boolean).length) return;

    await aplicar(pessoa.cpf, async () => {
      let atualizada = pessoa;
      for (const area of alvos) {
        atualizada = await permissaoApi.definirAjuste(pessoa.cpf, area, !ligado);
      }
      return atualizada;
    });
  };

  const expandir = async (pessoa: Pessoa) => {
    if (expandido === pessoa.cpf) {
      setExpandido(null);
      setDetalhe(null);
      return;
    }
    setExpandido(pessoa.cpf);
    setDetalhe(null);
    try {
      // `obterPessoa` e nao a listagem: só o detalhe traz `ajustes`, que é o
      // que separa "não tem" de "foi tirado" na hora de desenhar as linhas.
      setDetalhe(await permissaoApi.obterPessoa(pessoa.cpf));
    } catch {
      setDetalhe(pessoa);
    }
  };

  const totalPaginas = Math.max(1, Math.ceil(total / TAMANHO_PAGINA));

  return (
    <Dialog open={isOpen} onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <span className="copilot-quick-menu__eyebrow">
            SYSTEM / ACCESS CONTROL
          </span>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Visões de acesso
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Procure a pessoa e escolha a visão dela. A visão substitui o que o
          cargo dá — inclusive para reduzir alguém. Operadores sem visão
          atribuída continuam exatamente como estão.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setPagina(1);
              }}
              placeholder="Buscar por nome ou CPF"
              className="pl-8"
            />
          </div>
          <Select
            value={filtroPerfil}
            onValueChange={(v) => {
              setFiltroPerfil(v);
              setPagina(1);
            }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as visões</SelectItem>
              {perfis.map((perfil) => (
                <SelectItem key={perfil.codigo} value={perfil.codigo}>
                  {perfil.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          {buscaLimpa
            ? `${total} resultado(s) para "${buscaLimpa}"`
            : `${total} pessoa(s) com algum acesso. Use a busca para alcançar qualquer colaborador.`}
        </p>

        <div className="mt-3 space-y-1.5">
          {carregando && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          )}

          {!carregando && pessoas.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Ninguém encontrado neste recorte.
            </div>
          )}

          {!carregando &&
            pessoas.map((pessoa) => {
              const aberta = expandido === pessoa.cpf;
              const emEdicao = detalhe?.cpf === pessoa.cpf ? detalhe : pessoa;

              return (
                <div
                  key={pessoa.cpf}
                  className="rounded-lg border border-border"
                >
                  <div className="flex flex-wrap items-center gap-3 p-3">
                    <button
                      onClick={() => expandir(pessoa)}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Ajuste fino"
                    >
                      {aberta ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>

                    <div className="min-w-[210px] flex-1">
                      <div className="text-sm font-medium">{pessoa.nome}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatarCpf(pessoa.cpf)} · {pessoa.centro_custo || "—"}{" "}
                        · {pessoa.funcao || "—"}
                      </div>
                    </div>

                    {/* Sem esta marca, remover a visão de alguém parece não
                        ter efeito: o Select volta a mostrar um valor. */}
                    <Badge
                      variant={
                        pessoa.origem === "PERFIL" ? "default" : "secondary"
                      }
                      className="text-[10px]"
                    >
                      {pessoa.origem === "PERFIL" ? "definida" : "padrão do cargo"}
                    </Badge>

                    <Select
                      value={pessoa.perfil ?? SEM_VISAO}
                      onValueChange={(v) => trocarVisao(pessoa, v)}
                      disabled={salvando === pessoa.cpf}
                    >
                      <SelectTrigger className="w-[190px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SEM_VISAO}>
                          Padrão do cargo
                        </SelectItem>
                        {perfis.map((perfil) => (
                          <SelectItem key={perfil.codigo} value={perfil.codigo}>
                            {perfil.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {salvando === pessoa.cpf && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>

                  {aberta && (
                    <div className="border-t border-border bg-muted/30 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Comandos desta pessoa
                        </span>
                        {pessoa.origem === "PERFIL" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            onClick={() => trocarVisao(pessoa, SEM_VISAO)}
                          >
                            <RotateCcw className="h-3 w-3" /> Voltar ao padrão
                          </Button>
                        )}
                      </div>

                      <div className="space-y-2">
                        {gruposDeComandos.map((grupo) => {
                          const tem = emEdicao.areas.includes(grupo.area);
                          const ajustes = emEdicao.ajustes ?? {};
                          // Ajuste explícito: a tela mandou, não é herança.
                          const ajustado = grupo.area in ajustes;
                          const travado = salvando === pessoa.cpf;

                          return (
                            <div
                              key={grupo.area}
                              className="rounded-md border border-border bg-background/60 p-2"
                            >
                              <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                  {grupo.area}
                                </span>
                                {grupo.comandos.length > 1 && (
                                  <span className="text-[10px] text-muted-foreground">
                                    · {grupo.comandos.length} comandos, ligam e
                                    desligam juntos
                                  </span>
                                )}
                                {ajustado && (
                                  <span className="text-[10px] text-amber-600 dark:text-amber-400">
                                    · {tem ? "concedido" : "negado"} nesta tela
                                  </span>
                                )}
                                {ajustado && grupo.comandos.length > 0 && (
                                  <button
                                    type="button"
                                    disabled={travado}
                                    onClick={() =>
                                      voltarAoPadrao(emEdicao, grupo.comandos[0])
                                    }
                                    className="inline-flex items-center gap-1 text-[10px] text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
                                    title="Apaga o ajuste: volta a seguir a visão ou o padrão do cargo"
                                  >
                                    <RotateCcw className="h-2.5 w-2.5" />
                                    voltar ao padrão
                                  </button>
                                )}
                                {grupo.descricao && (
                                  <span className="w-full text-[10px] text-muted-foreground">
                                    {grupo.descricao}
                                  </span>
                                )}
                              </div>

                              {grupo.comandos.length ? (
                                <div className="grid gap-0.5 sm:grid-cols-2">
                                  {grupo.comandos.map((item) => {
                                    // Estado efetivo, não só as áreas: uma
                                    // regra de cargo pode estar concedendo.
                                    const ligado = comandoLigado(emEdicao, item);
                                    const porArea = item.areas.some((area) =>
                                      emEdicao.areas.includes(area),
                                    );
                                    // Ligado sem nenhuma área: quem concede é a
                                    // regra por centro de custo ou função.
                                    const porCargo = ligado && !porArea;

                                    return (
                                      <label
                                        key={`${grupo.area}-${item.comando}-${item.detalhe ?? ""}`}
                                        className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-muted"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={ligado}
                                          disabled={travado}
                                          onChange={() =>
                                            alternarComando(emEdicao, item)
                                          }
                                        />
                                        <span className="min-w-0 flex-1 truncate font-medium">
                                          {rotuloDoComando(item)}
                                        </span>
                                        {porCargo && (
                                          <span
                                            className="shrink-0 text-[10px] text-muted-foreground"
                                            title={`Concedido pelo centro de custo (${emEdicao.centro_custo || "—"}) ou pela função (${emEdicao.funcao || "—"}), não por área. Desmarcar grava uma negação explícita, que vence essa regra.`}
                                          >
                                            pelo cargo
                                          </span>
                                        )}
                                      </label>
                                    );
                                  })}
                                </div>
                              ) : (
                                // Área sem comando mapeado: edita crua, para
                                // não sumir da tela só por não ter rótulo.
                                <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-muted">
                                  <input
                                    type="checkbox"
                                    checked={tem}
                                    disabled={travado}
                                    onChange={() =>
                                      alternarArea(emEdicao, grupo.area)
                                    }
                                  />
                                  <span className="text-muted-foreground">
                                    Conceder esta área
                                  </span>
                                </label>
                              )}
                            </div>
                          );
                        })}

                        {comandosSempreLiberados.length > 0 && (
                          <p className="px-1 text-[10px] text-muted-foreground">
                            Não editável aqui (dependem de cargo ou centro
                            de custo):{" "}
                            {comandosSempreLiberados
                              .map((item) => item.comando)
                              .join(", ")}
                            .
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        {totalPaginas > 1 && (
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Página {pagina} de {totalPaginas}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagina <= 1}
                onClick={() => setPagina((p) => p - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagina >= totalPaginas}
                onClick={() => setPagina((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AcessosModal;
