import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Loader2,
  Minus,
  Search,
} from "lucide-react";

import Header from "@/components/Header";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import resultadosApi, {
  FiltrosResultados,
  OperadorResultado,
} from "@/services/resultadosApi";

const ALBUM_EXTERNAL_URL = "http://album.empresa.local/login";
const TAMANHO_PAGINA = 25;

const hojeISO = () => new Date().toISOString().slice(0, 10);
const primeiroDiaDoMesISO = () => {
  const hoje = new Date();
  return new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
};

const moeda = (valor: number) =>
  valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

const numero = (valor: number) => valor.toLocaleString("pt-BR");

type Recorte = "todos" | "abaixo_da_meta" | "sem_acordo" | "offline";

const RECORTES: Array<{ id: Recorte; rotulo: string }> = [
  { id: "todos", rotulo: "Todos" },
  { id: "abaixo_da_meta", rotulo: "Abaixo da meta" },
  { id: "sem_acordo", rotulo: "Sem acordo" },
  { id: "offline", rotulo: "Offline agora" },
];

/** Faixa de KPI com comparação contra o período anterior. */
const Indicador = ({
  titulo,
  valor,
  variacao,
  detalhe,
}: {
  titulo: string;
  valor: string;
  variacao?: number | null;
  detalhe?: string;
}) => {
  const Icone =
    variacao == null ? Minus : variacao >= 0 ? ArrowUp : ArrowDown;
  const cor =
    variacao == null
      ? "text-slate-400"
      : variacao >= 0
        ? "text-emerald-500"
        : "text-rose-500";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
        {titulo}
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
        {valor}
      </div>
      <div className={`mt-1 flex items-center gap-1 text-xs ${cor}`}>
        <Icone className="h-3 w-3" />
        {variacao == null
          ? (detalhe ?? "sem base de comparação")
          : `${Math.abs(variacao).toFixed(1)}% vs. período anterior`}
      </div>
    </div>
  );
};

const Atingimento = ({ operador }: { operador: OperadorResultado }) => {
  // "Sem meta" e 0% são coisas diferentes: só 116 de 1.260 operadores têm meta
  // cadastrada, e mostrar 0% culparia a pessoa por uma lacuna de cadastro.
  if (operador.meta == null || operador.atingimento == null) {
    return (
      <span className="text-xs italic text-slate-400 dark:text-slate-500">
        sem meta
      </span>
    );
  }

  const pct = operador.atingimento;
  const cor =
    pct >= 100 ? "bg-emerald-500" : pct >= 70 ? "bg-amber-500" : "bg-rose-500";

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div
          className={`h-full ${cor}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-slate-600 dark:text-slate-300">
        {pct.toFixed(0)}%
      </span>
    </div>
  );
};

const ResultadosOperacionais = () => {
  const navigate = useNavigate();

  const [dataInicio, setDataInicio] = useState(primeiroDiaDoMesISO());
  const [dataFim, setDataFim] = useState(hojeISO());
  const [carteira, setCarteira] = useState<string>("todas");
  const [supervisor, setSupervisor] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const [ordenarPor, setOrdenarPor] = useState("RECUPERADO");
  const [pagina, setPagina] = useState(1);
  const [recorte, setRecorte] = useState<Recorte>("todos");
  const [selecionado, setSelecionado] = useState<OperadorResultado | null>(null);

  const filtros: FiltrosResultados = useMemo(
    () => ({
      data_inicio: dataInicio,
      data_fim: dataFim,
      id_carteira: carteira === "todas" ? null : carteira,
      supervisor: supervisor === "todos" ? null : supervisor,
    }),
    [dataInicio, dataFim, carteira, supervisor],
  );

  const chaveBase = [dataInicio, dataFim, carteira, supervisor];

  const opcoes = useQuery({
    queryKey: ["resultados", "filtros"],
    queryFn: () => resultadosApi.filtros(),
    staleTime: 5 * 60 * 1000,
  });

  const resumo = useQuery({
    queryKey: ["resultados", "resumo", ...chaveBase],
    queryFn: () => resultadosApi.resumo(filtros),
  });

  const evolucao = useQuery({
    queryKey: ["resultados", "evolucao", carteira],
    queryFn: () =>
      resultadosApi.evolucao({ meses: 12, id_carteira: filtros.id_carteira }),
  });

  const operadores = useQuery({
    queryKey: [
      "resultados",
      "operadores",
      ...chaveBase,
      busca,
      ordenarPor,
      pagina,
    ],
    queryFn: () =>
      resultadosApi.operadores({
        ...filtros,
        busca: busca || null,
        ordenar_por: ordenarPor,
        pagina,
        tamanho: TAMANHO_PAGINA,
      }),
    placeholderData: (anterior) => anterior,
  });

  const ficha = useQuery({
    queryKey: ["resultados", "ficha", selecionado?.chave, dataInicio, dataFim],
    queryFn: () => resultadosApi.ficha(selecionado!.chave, filtros),
    enabled: Boolean(selecionado),
  });

  // O recorte é aplicado sobre a página já carregada: é um atalho de leitura,
  // não um filtro de servidor. A contagem do rodapé segue sendo a do servidor.
  const listaVisivel = useMemo(() => {
    const lista = operadores.data?.operadores ?? [];
    if (recorte === "abaixo_da_meta")
      return lista.filter((o) => o.atingimento != null && o.atingimento < 100);
    if (recorte === "sem_acordo") return lista.filter((o) => o.acordos === 0);
    if (recorte === "offline") return lista.filter((o) => o.status === "offline");
    return lista;
  }, [operadores.data, recorte]);

  const dados = resumo.data;
  const cobertura = dados?.cobertura_meta;
  const totalPaginas = Math.max(
    1,
    Math.ceil((operadores.data?.total ?? 0) / TAMANHO_PAGINA),
  );

  const atualizadoEm = dados?.atualizado_em?.em
    ? new Date(dados.atualizado_em.em).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="min-h-screen bg-[#f4f6fb] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Sem a variante "aurora": aquela e `absolute top-0` e existe para
          flutuar sobre o hero da home. Aqui o header entra no fluxo, e o
          conteudo nao precisa adivinhar a altura dele para nao ficar embaixo. */}
      <Header
        onAlbumClick={() => {
          window.open(ALBUM_EXTERNAL_URL, "_blank", "noopener,noreferrer");
        }}
      />

      <main className="mx-auto max-w-[1500px] px-4 pb-16 pt-6 md:px-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/gerente")}
              className="mb-3 gap-1.5"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao Copilot
            </Button>
            <h1 className="text-2xl font-semibold sm:text-3xl">
              Resultados operacionais
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {/* Dado defasado sem carimbo de hora vira desconfiança na ferramenta. */}
              {atualizadoEm
                ? `Atualizado em ${atualizadoEm}`
                : "Aguardando a primeira carga do snapshot"}
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                De
              </label>
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => {
                  setDataInicio(e.target.value);
                  setPagina(1);
                }}
                className="h-9 w-[150px]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Até
              </label>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => {
                  setDataFim(e.target.value);
                  setPagina(1);
                }}
                className="h-9 w-[150px]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Carteira
              </label>
              <Select
                value={carteira}
                onValueChange={(v) => {
                  setCarteira(v);
                  setPagina(1);
                }}
              >
                <SelectTrigger className="h-9 w-[190px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as carteiras</SelectItem>
                  {opcoes.data?.carteiras.map((c) => (
                    <SelectItem key={c.id_carteira} value={String(c.id_carteira)}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Supervisor
              </label>
              <Select
                value={supervisor}
                onValueChange={(v) => {
                  setSupervisor(v);
                  setPagina(1);
                }}
              >
                <SelectTrigger className="h-9 w-[190px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {opcoes.data?.supervisores.filter(Boolean).map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* ---------- Camada 1: pulso da operação ---------- */}
        {resumo.isLoading ? (
          <div className="flex h-28 items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando indicadores...
          </div>
        ) : dados ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {dados.tem_vega && (
              <Indicador
                titulo="Recuperado"
                valor={moeda(dados.valor_recuperado)}
                variacao={dados.comparativo.valor_recuperado}
              />
            )}
            <Indicador
              titulo="Fechado"
              valor={moeda(dados.valor_fechado)}
              variacao={dados.comparativo.valor_fechado}
            />
            <Indicador
              titulo="Acordos"
              valor={numero(dados.acordos)}
              variacao={dados.comparativo.acordos}
            />
            <Indicador titulo="CPC" valor={numero(dados.cpc)} />
            <Indicador
              titulo="Operadores ativos"
              valor={`${numero(dados.operadores_ativos)} / ${numero(dados.operadores)}`}
              detalhe="com acesso registrado no período"
            />
            {dados.tem_vega && (
              <Indicador
                titulo="Conversão"
                valor={`${dados.conversao.toFixed(1)}%`}
                detalhe="recuperado sobre fechado"
              />
            )}
          </div>
        ) : null}

        {/* Avisos que explicam lacunas do dado em vez de escondê-las. */}
        <div className="mt-3 space-y-2">
          {cobertura && cobertura.com_meta < cobertura.operadores && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-300/40 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/25 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <span>
                <strong>
                  {numero(cobertura.com_meta)} de {numero(cobertura.operadores)}
                </strong>{" "}
                operadores têm meta cadastrada. Quem não tem aparece como “sem
                meta”, não como 0% de atingimento.
              </span>
            </div>
          )}
          {dados && !dados.tem_vega && (
            <div className="flex items-start gap-2 rounded-xl border border-slate-300/50 bg-slate-100 px-3 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <span>
                Não há dado de pagamento para este período — a origem só guarda
                os meses recentes. Os números mostram fechamento.
              </span>
            </div>
          )}
          {dados && dados.valor_nao_atribuido > 0 && (
            <div className="rounded-xl border border-slate-300/50 bg-slate-100 px-3 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              {moeda(dados.valor_nao_atribuido)} de produção não casou com
              nenhum colaborador do cadastro (parceiros externos e nomes com
              sufixo). Entra no total, mas não no ranking.
            </div>
          )}
        </div>

        {/* ---------- Evolução ---------- */}
        {evolucao.data && evolucao.data.serie.length > 1 && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold">Evolução mensal</h2>
              {evolucao.data.vega_comeca_em && (
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Recuperado disponível a partir de{" "}
                  {evolucao.data.vega_comeca_em}
                </span>
              )}
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={evolucao.data.serie}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                  />
                  <Tooltip
                    formatter={(v: number) => moeda(Number(v))}
                    labelClassName="text-xs"
                  />
                  <Area
                    type="monotone"
                    dataKey="valor_fechado"
                    name="Fechado"
                    stroke="#0ea5e9"
                    fill="#0ea5e9"
                    fillOpacity={0.15}
                  />
                  {/* A linha some onde não há vega em vez de cair a zero — o
                      dado não existe, a operação não parou. */}
                  <Line
                    type="monotone"
                    dataKey={(ponto: { tem_vega: boolean; valor_recuperado: number }) =>
                      ponto.tem_vega ? ponto.valor_recuperado : null
                    }
                    name="Recuperado"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ---------- Camada 2: mesa de operadores ---------- */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-semibold">Mesa de operadores</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {numero(operadores.data?.total ?? 0)} operadores no período ·
                clique numa linha para abrir a ficha
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {RECORTES.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setRecorte(item.id)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    recorte === item.id
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {item.rotulo}
                </button>
              ))}
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  value={busca}
                  onChange={(e) => {
                    setBusca(e.target.value);
                    setPagina(1);
                  }}
                  placeholder="Buscar operador"
                  className="h-9 w-[190px] pl-7"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  {[
                    { id: "NOME", rotulo: "Operador" },
                    { id: "RECUPERADO", rotulo: "Recuperado" },
                    { id: "FECHADO", rotulo: "Fechado" },
                    { id: "ACORDOS", rotulo: "Acordos" },
                    { id: "CPC", rotulo: "CPC" },
                    { id: "ATINGIMENTO", rotulo: "Atingimento" },
                  ].map((coluna) => (
                    <TableHead
                      key={coluna.id}
                      onClick={() => {
                        setOrdenarPor(coluna.id);
                        setPagina(1);
                      }}
                      className={`cursor-pointer select-none whitespace-nowrap ${
                        ordenarPor === coluna.id
                          ? "text-slate-900 dark:text-white"
                          : ""
                      }`}
                    >
                      {coluna.rotulo}
                      {ordenarPor === coluna.id && " ↓"}
                    </TableHead>
                  ))}
                  <TableHead>Carteira</TableHead>
                  <TableHead>Supervisor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operadores.isLoading && (
                  <TableRow>
                    <TableCell colSpan={10} className="py-10 text-center text-sm">
                      <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                    </TableCell>
                  </TableRow>
                )}
                {!operadores.isLoading && listaVisivel.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      className="py-10 text-center text-sm text-slate-500"
                    >
                      Nenhum operador neste recorte.
                    </TableCell>
                  </TableRow>
                )}
                {listaVisivel.map((operador) => (
                  <TableRow
                    key={operador.chave}
                    onClick={() => setSelecionado(operador)}
                    className="cursor-pointer"
                  >
                    <TableCell className="tabular-nums text-xs text-slate-400">
                      {operador.posicao}
                    </TableCell>
                    <TableCell className="font-medium">{operador.nome}</TableCell>
                    <TableCell className="tabular-nums">
                      {moeda(operador.valor_recuperado)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {moeda(operador.valor_fechado)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {numero(operador.acordos)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {numero(operador.cpc)}
                    </TableCell>
                    <TableCell>
                      <Atingimento operador={operador} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {operador.carteira}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-slate-500">
                      {operador.supervisor}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          operador.status === "online" ? "default" : "secondary"
                        }
                        className="text-[10px]"
                      >
                        {operador.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 p-3 text-xs dark:border-slate-800">
            <span className="text-slate-500">
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
        </div>
      </main>

      {/* ---------- Camada 3: ficha do operador ---------- */}
      <Sheet
        open={Boolean(selecionado)}
        onOpenChange={(aberto) => !aberto && setSelecionado(null)}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{selecionado?.nome}</SheetTitle>
          </SheetHeader>

          {ficha.isLoading && (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}

          {ficha.data && (
            <div className="mt-4 space-y-5">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {ficha.data.operador.funcao} · {ficha.data.operador.supervisor}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">
                    Recuperado
                  </div>
                  <div className="text-lg font-semibold">
                    {moeda(ficha.data.operador.valor_recuperado)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">
                    Fechado
                  </div>
                  <div className="text-lg font-semibold">
                    {moeda(ficha.data.operador.valor_fechado)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">
                    Meta do período
                  </div>
                  <div className="text-lg font-semibold">
                    {ficha.data.operador.meta
                      ? moeda(ficha.data.operador.meta)
                      : "sem meta"}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">
                    Dias trabalhados
                  </div>
                  <div className="text-lg font-semibold">
                    {numero(ficha.data.operador.dias_trabalhados)}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Evolução diária
                </h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={ficha.data.serie}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis
                        dataKey="data"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v) => String(v).slice(8, 10)}
                      />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                      />
                      <Tooltip formatter={(v: number) => moeda(Number(v))} />
                      <Area
                        type="monotone"
                        dataKey="valor_fechado"
                        name="Fechado"
                        stroke="#0ea5e9"
                        fill="#0ea5e9"
                        fillOpacity={0.15}
                      />
                      <Line
                        type="monotone"
                        dataKey="valor_recuperado"
                        name="Recuperado"
                        stroke="#10b981"
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {ficha.data.carteiras.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Por carteira
                  </h3>
                  <div className="space-y-1">
                    {ficha.data.carteiras.map((linha) => (
                      <div
                        key={linha.carteira}
                        className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-800"
                      >
                        <span>{linha.carteira}</span>
                        <span className="tabular-nums font-medium">
                          {moeda(linha.valor_fechado)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default ResultadosOperacionais;
