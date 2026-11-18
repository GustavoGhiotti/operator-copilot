import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  ClipboardList,
  Download,
  FileBarChart,
  Gamepad2,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  SlidersHorizontal,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import TodoModal from "@/components/TodoModal";
import tarefasApi, {
  CentralGestaoArea,
  CentralGestaoPayload,
} from "@/services/tarefasApi";

type Section =
  | "overview"
  | "portfolio"
  | "teams"
  | "academy"
  | "quality"
  | "arena"
  | "copilot"
  | "reports";

const menu: Array<{
  id: Section;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: "overview", label: "Visão executiva", icon: LayoutDashboard },
  { id: "portfolio", label: "Portfólio de tarefas", icon: ClipboardList },
  { id: "teams", label: "Equipes", icon: Users },
  { id: "academy", label: "Academia", icon: GraduationCap },
  { id: "quality", label: "Qualidade", icon: ShieldCheck },
  { id: "arena", label: "Arena", icon: Gamepad2 },
  { id: "copilot", label: "Uso do Copilot", icon: Sparkles },
  { id: "reports", label: "Relatórios", icon: FileBarChart },
];

const panel =
  "rounded-2xl border border-slate-800 bg-[#081522]/90 shadow-[0_18px_50px_rgba(0,0,0,.22)]";

const toneClasses = {
  orange: { icon: "text-orange-400", glow: "bg-orange-400/5" },
  cyan: { icon: "text-cyan-400", glow: "bg-cyan-400/5" },
  emerald: { icon: "text-emerald-400", glow: "bg-emerald-400/5" },
  rose: { icon: "text-rose-400", glow: "bg-rose-400/5" },
} as const;

const emptyTeams: CentralGestaoPayload["equipes"] = {
  resumo: { equipes: 0, membros: 0, convites_pendentes: 0, tarefas: 0, atrasadas: 0 },
  lista: [],
};
const emptyQuality: CentralGestaoPayload["qualidade"] = {
  resumo: { monitorias: 0, operadores: 0, monitores: 0, nota_media: 0, negativas: 0, ultimos_30_dias: 0 },
  carteiras: [],
  evolucao: [],
};
const emptyUsage: CentralGestaoPayload["uso_copilot"] = {
  resumo: { acessos: 0, usuarios: 0, acessos_30_dias: 0, usuarios_30_dias: 0, ultimo_acesso: null },
  centros: [],
  comandos: [],
};

const normalizeTeams = (teams?: CentralGestaoPayload["equipes"]): CentralGestaoPayload["equipes"] => ({
  resumo: { ...emptyTeams.resumo, ...teams?.resumo },
  lista: teams?.lista ?? [],
});

const normalizeQuality = (quality?: CentralGestaoPayload["qualidade"]): CentralGestaoPayload["qualidade"] => ({
  resumo: { ...emptyQuality.resumo, ...quality?.resumo },
  carteiras: quality?.carteiras ?? [],
  evolucao: quality?.evolucao ?? [],
});

const normalizeUsage = (usage?: CentralGestaoPayload["uso_copilot"]): CentralGestaoPayload["uso_copilot"] => ({
  resumo: { ...emptyUsage.resumo, ...usage?.resumo },
  centros: usage?.centros ?? [],
  comandos: usage?.comandos ?? [],
});

const comparisonText = (current: number, previous: number, suffix = "") => {
  if (current === 0 && previous === 0) return "Aguardando dados";
  if (previous === 0) return "Novo no período";
  const change = Math.round(((current - previous) / previous) * 1000) / 10;
  const signal = change > 0 ? "+" : "";
  return `${signal}${change}% vs. período anterior${suffix}`;
};

const comparisonClass = (current: number, previous: number) => {
  if (current === 0 && previous === 0) return "text-slate-500";
  if (current >= previous) return "text-emerald-300";
  return "text-rose-300";
};

const monthLabel = (value: string) => {
  const [year, month] = value.split("-");
  return new Intl.DateTimeFormat("pt-BR", { month: "short" })
    .format(new Date(Number(year), Number(month) - 1, 1))
    .replace(".", "");
};

const areaStatus = (area: CentralGestaoArea) => {
  if (area.atrasadas > 0) return { label: "Atenção", color: "#fb7185" };
  if (area.em_andamento > 0) return { label: "Em curso", color: "#38bdf8" };
  return { label: "Estável", color: "#34d399" };
};

const exportManagementReport = (data: CentralGestaoPayload) => {
  const reportPeriod = data.filtros?.periodo_dias ?? 30;
  const rows: Array<Array<string | number>> = [
    ["Módulo", "Indicador", "Valor"],
    ["Tarefas", "Total", data.resumo.total_tarefas],
    ["Tarefas", "Atrasadas", data.resumo.atrasadas],
    ["Equipes", "Equipes ativas", data.equipes.resumo.equipes],
    ["Equipes", "Membros", data.equipes.resumo.membros],
    ["Academia", "Matrículas", data.academia.resumo.total_matriculas],
    ["Academia", "Conclusão média", data.academia.resumo.conclusao_media],
    ["Qualidade", "Monitorias", data.qualidade.resumo.monitorias],
    ["Qualidade", "Nota média", data.qualidade.resumo.nota_media],
    ["Arena", "Campanhas", data.arena.resumo.campanhas],
    ["Arena", "Participantes", data.arena.resumo.participantes],
    ["Copilot", `Acessos em ${reportPeriod} dias`, data.uso_copilot.resumo.acessos_30_dias],
    ["Copilot", `Usuários em ${reportPeriod} dias`, data.uso_copilot.resumo.usuarios_30_dias],
  ];
  const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(";")).join("\n");
  const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `central-gestao-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

const CentralGestao = () => {
  const navigate = useNavigate();
  const [section, setSection] = useState<Section>("overview");
  const [data, setData] = useState<CentralGestaoPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTasks, setShowTasks] = useState(false);
  const [period, setPeriod] = useState(30);
  const [costCenter, setCostCenter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await tarefasApi.carregarCentralGestao({
        periodo: period,
        centroCusto: costCenter,
      }));
    } catch (requestError) {
      console.error("Erro ao carregar a Central de Gestão", requestError);
      setError("Não foi possível carregar os indicadores gerenciais.");
    } finally {
      setLoading(false);
    }
  }, [costCenter, period]);

  useEffect(() => {
    load();
  }, [load]);

  const firstName = useMemo(() => {
    const name = data?.gestor.nome || localStorage.getItem("nomeCompleto") || "Gestor";
    return name.trim().split(/\s+/)[0];
  }, [data?.gestor.nome]);

  const mostCritical = data?.areas[0];

  const content = () => {
    if (loading) {
      return (
        <div className={`${panel} grid min-h-[420px] place-items-center`}>
          <div className="flex items-center gap-3 text-slate-300">
            <RefreshCw className="h-5 w-5 animate-spin text-cyan-400" />
            Consolidando a visão da empresa...
          </div>
        </div>
      );
    }

    if (error || !data) {
      return (
        <div className={`${panel} grid min-h-[420px] place-items-center p-8 text-center`}>
          <div>
            <AlertTriangle className="mx-auto mb-4 h-9 w-9 text-orange-400" />
            <h2 className="text-xl font-bold text-white">Painel indisponível</h2>
            <p className="mt-2 text-sm text-slate-400">{error}</p>
            <button onClick={load} className="mt-5 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-400">
              Tentar novamente
            </button>
          </div>
        </div>
      );
    }

    if (section === "portfolio") {
      return (
        <div className="space-y-5">
          <section className={`${panel} overflow-hidden`}>
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 p-6">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[.28em] text-cyan-400">Visão corporativa</span>
                <h2 className="mt-2 text-2xl font-black text-white">Portfólio de tarefas</h2>
                <p className="mt-1 text-sm text-slate-400">Acompanhamento consolidado, sem alterar os quadros das equipes.</p>
              </div>
              <button onClick={() => setShowTasks(true)} className="rounded-xl border border-orange-400/50 bg-orange-500/10 px-4 py-2.5 text-sm font-bold text-orange-300 hover:bg-orange-500/20">
                Abrir minhas tarefas
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead className="bg-[#0b1b2b] text-[10px] uppercase tracking-[.18em] text-slate-500">
                  <tr>
                    <th className="px-6 py-4">Centro de custo</th>
                    <th className="px-4 py-4">Equipes</th>
                    <th className="px-4 py-4">Tarefas</th>
                    <th className="px-4 py-4">Em andamento</th>
                    <th className="px-4 py-4">Atrasadas</th>
                    <th className="px-4 py-4">Conclusão</th>
                    <th className="px-6 py-4">Saúde</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {data.areas.map((area) => {
                    const status = areaStatus(area);
                    return (
                      <tr key={area.centro_custo} className="hover:bg-cyan-400/[.035]">
                        <td className="px-6 py-4 font-semibold text-slate-100">{area.centro_custo}</td>
                        <td className="px-4 py-4 text-slate-300">{area.equipes}</td>
                        <td className="px-4 py-4 text-slate-300">{area.total_tarefas}</td>
                        <td className="px-4 py-4 text-cyan-300">{area.em_andamento}</td>
                        <td className="px-4 py-4 font-semibold text-rose-300">{area.atrasadas}</td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-800">
                              <div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.min(area.taxa_conclusao, 100)}%` }} />
                            </div>
                            <span className="text-xs text-slate-300">{area.taxa_conclusao}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-2 text-xs font-bold" style={{ color: status.color }}>
                            <span className="h-2 w-2 rounded-full bg-current" />{status.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
          {data.areas.length === 0 && (
            <div className={`${panel} p-10 text-center text-slate-400`}>Ainda não existem tarefas corporativas para consolidar.</div>
          )}
        </div>
      );
    }

    if (section === "academy") {
      const academy = data.academia;
      const criticalCenter = academy.centros[0];
      const criticalLesson = academy.abandonos[0];
      const academyCards = [
        { label: "Cursos publicados", value: academy.resumo.cursos_publicados, hint: "Conteúdos disponíveis", icon: GraduationCap, tone: "cyan" },
        { label: "Matrículas", value: academy.resumo.total_matriculas, hint: `${academy.resumo.alunos_ativos} alunos ativos`, icon: Users, tone: "violet" },
        { label: "Conclusão", value: `${academy.resumo.conclusao_media}%`, hint: `${academy.resumo.total_concluidos} concluídas`, icon: CheckCircle2, tone: "emerald" },
        { label: "Precisam de atenção", value: academy.resumo.alunos_em_risco + academy.resumo.alunos_interrompidos, hint: "Em risco ou interrompidos", icon: AlertTriangle, tone: "rose" },
      ] as const;
      return (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {academyCards.map(({ label, value, hint, icon: Icon, tone }) => (
              <div key={label} className={`${panel} p-5`}>
                <div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-slate-500">{label}</p><p className="mt-3 text-3xl font-black text-white">{value}</p><p className="mt-2 text-xs text-slate-400">{hint}</p></div><Icon className={`h-5 w-5 ${tone === "violet" ? "text-violet-400" : toneClasses[tone].icon}`} /></div>
              </div>
            ))}
          </div>
          <div className="grid gap-5 xl:grid-cols-[1.4fr_.7fr]">
            <section className={`${panel} overflow-hidden`}>
              <div className="border-b border-slate-800 px-6 py-5"><p className="text-[10px] font-bold uppercase tracking-[.25em] text-cyan-400">Desempenho educacional</p><h2 className="mt-1 text-lg font-bold text-white">Cursos publicados</h2></div>
              <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left"><thead className="bg-[#0b1b2b] text-[10px] uppercase tracking-[.16em] text-slate-500"><tr><th className="px-6 py-4">Curso</th><th className="px-4 py-4">Matrículas</th><th className="px-4 py-4">Concluídos</th><th className="px-4 py-4">Progresso</th><th className="px-6 py-4">Conclusão</th></tr></thead><tbody className="divide-y divide-slate-800">{academy.desempenho.map((course) => <tr key={course.curso_id}><td className="px-6 py-4 font-semibold text-slate-100">{course.titulo}</td><td className="px-4 py-4 text-slate-300">{course.matriculas}</td><td className="px-4 py-4 text-emerald-300">{course.concluidos}</td><td className="px-4 py-4 text-cyan-300">{course.progresso_medio}%</td><td className="px-6 py-4"><div className="flex items-center gap-3"><div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-orange-400" style={{ width: `${Math.min(course.taxa_conclusao, 100)}%` }} /></div><span className="text-xs text-slate-300">{course.taxa_conclusao}%</span></div></td></tr>)}</tbody></table></div>
              {academy.desempenho.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Ainda não existem cursos publicados para analisar.</p>}
            </section>
            <section className={`${panel} p-6`}><p className="text-[10px] font-bold uppercase tracking-[.25em] text-orange-400">Insight da Academia</p><h2 className="mt-2 text-lg font-bold text-white">Atenção recomendada</h2>{criticalCenter ? <div className="mt-5"><p className="text-xl font-black text-white">{criticalCenter.centro_custo}</p><p className="mt-2 text-sm leading-6 text-slate-400">Possui <strong className="text-rose-300">{criticalCenter.em_risco + criticalCenter.interrompidos} matrícula(s)</strong> em risco ou interrompidas, com progresso médio de {criticalCenter.progresso_medio}%.</p></div> : <p className="mt-5 text-sm text-slate-400">Sem matrículas suficientes para gerar um insight.</p>}{criticalLesson && <div className="mt-5 rounded-xl border border-rose-400/20 bg-rose-400/5 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-rose-300">Maior abandono</p><p className="mt-2 text-sm font-bold text-white">{criticalLesson.aula_titulo}</p><p className="mt-1 text-xs text-slate-400">{criticalLesson.curso_titulo} · {criticalLesson.taxa_abandono}%</p></div>}</section>
          </div>
          <section className={`${panel} overflow-hidden`}><div className="border-b border-slate-800 px-6 py-5"><p className="text-[10px] font-bold uppercase tracking-[.25em] text-violet-400">Comparativo corporativo</p><h2 className="mt-1 text-lg font-bold text-white">Aprendizado por centro de custo</h2></div><div className="grid gap-px bg-slate-800 md:grid-cols-2 xl:grid-cols-3">{academy.centros.map((center) => <div key={center.centro_custo} className="bg-[#081522] p-5"><div className="flex items-center justify-between gap-3"><p className="truncate font-bold text-white">{center.centro_custo}</p><span className="text-sm font-black text-cyan-300">{center.progresso_medio}%</span></div><p className="mt-2 text-xs text-slate-500">{center.matriculas} matrículas · {center.concluidos} concluídas</p><div className="mt-4 flex gap-2"><span className="rounded-md bg-orange-400/10 px-2 py-1 text-[10px] font-bold text-orange-300">{center.em_risco} em risco</span><span className="rounded-md bg-rose-400/10 px-2 py-1 text-[10px] font-bold text-rose-300">{center.interrompidos} interrompidas</span></div></div>)}</div>{academy.centros.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Sem matrículas por centro de custo.</p>}</section>
        </div>
      );
    }

    if (section === "arena") {
      const arena = data.arena;
      const adhesion = arena.resumo.convites > 0 ? Math.round((arena.resumo.confirmacoes / arena.resumo.convites) * 1000) / 10 : 0;
      const lowAdhesion = [...arena.centros].filter((item) => item.convites > 0).sort((a, b) => (a.confirmacoes / a.convites) - (b.confirmacoes / b.convites))[0];
      const arenaCards = [
        { label: "Campanhas", value: arena.resumo.campanhas, hint: `${arena.resumo.campanhas_ativas} ativas`, icon: Gamepad2, tone: "orange" },
        { label: "Participantes", value: arena.resumo.participantes, hint: "Pessoas alcançadas", icon: Users, tone: "cyan" },
        { label: "Adesão", value: `${adhesion}%`, hint: `${arena.resumo.confirmacoes} confirmações`, icon: CheckCircle2, tone: "emerald" },
        { label: "XP distribuído", value: arena.resumo.xp_distribuido, hint: `${arena.resumo.finalizadas} finalizadas`, icon: Activity, tone: "violet" },
      ] as const;
      return (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{arenaCards.map(({ label, value, hint, icon: Icon, tone }) => <div key={label} className={`${panel} p-5`}><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-slate-500">{label}</p><p className="mt-3 text-3xl font-black text-white">{value}</p><p className="mt-2 text-xs text-slate-400">{hint}</p></div><Icon className={`h-5 w-5 ${tone === "violet" ? "text-violet-400" : toneClasses[tone].icon}`} /></div></div>)}</div>
          <div className="grid gap-5 xl:grid-cols-[1.4fr_.7fr]">
            <section className={`${panel} overflow-hidden`}><div className="border-b border-slate-800 px-6 py-5"><p className="text-[10px] font-bold uppercase tracking-[.25em] text-cyan-400">Engajamento</p><h2 className="mt-1 text-lg font-bold text-white">Participação por centro de custo</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left"><thead className="bg-[#0b1b2b] text-[10px] uppercase tracking-[.16em] text-slate-500"><tr><th className="px-6 py-4">Centro de custo</th><th className="px-4 py-4">Campanhas</th><th className="px-4 py-4">Participantes</th><th className="px-4 py-4">Adesão</th><th className="px-6 py-4">XP</th></tr></thead><tbody className="divide-y divide-slate-800">{arena.centros.map((center) => { const rate = center.convites > 0 ? Math.round(center.confirmacoes / center.convites * 1000) / 10 : 0; return <tr key={center.centro_custo}><td className="px-6 py-4 font-semibold text-slate-100">{center.centro_custo}</td><td className="px-4 py-4 text-slate-300">{center.campanhas}</td><td className="px-4 py-4 text-cyan-300">{center.participantes}</td><td className="px-4 py-4"><span className={rate < 50 ? "font-bold text-rose-300" : "font-bold text-emerald-300"}>{rate}%</span></td><td className="px-6 py-4 font-bold text-violet-300">{center.xp}</td></tr>; })}</tbody></table></div>{arena.centros.length === 0 && <p className="p-8 text-center text-sm text-slate-500">A Arena ainda não possui participação registrada.</p>}</section>
            <section className={`${panel} p-6`}><p className="text-[10px] font-bold uppercase tracking-[.25em] text-orange-400">Insight da Arena</p><h2 className="mt-2 text-lg font-bold text-white">Engajamento recomendado</h2>{lowAdhesion ? <><p className="mt-5 text-xl font-black text-white">{lowAdhesion.centro_custo}</p><p className="mt-2 text-sm leading-6 text-slate-400">Apresenta a menor adesão entre os centros convidados: <strong className="text-rose-300">{Math.round(lowAdhesion.confirmacoes / lowAdhesion.convites * 1000) / 10}%</strong>. Vale revisar comunicação e horário das campanhas.</p></> : <p className="mt-5 text-sm text-slate-400">Sem convites suficientes para comparar engajamento.</p>}</section>
          </div>
          <section className={`${panel} overflow-hidden`}><div className="border-b border-slate-800 px-6 py-5"><p className="text-[10px] font-bold uppercase tracking-[.25em] text-violet-400">Atividade recente</p><h2 className="mt-1 text-lg font-bold text-white">Últimas campanhas</h2></div><div className="grid gap-px bg-slate-800 md:grid-cols-2 xl:grid-cols-3">{arena.campanhas.map((campaign) => <div key={campaign.id} className="bg-[#081522] p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-white">{campaign.titulo}</p><p className="mt-1 text-xs text-cyan-300">{campaign.tipo_jogo}</p></div><span className="rounded-md border border-violet-400/25 bg-violet-400/10 px-2 py-1 text-[9px] font-bold uppercase text-violet-300">{campaign.status}</span></div><p className="mt-4 text-xs text-slate-500">{campaign.centro_custo || "Público misto"}</p><p className="mt-2 text-sm text-slate-300">{campaign.confirmacoes} de {campaign.participantes} confirmados</p></div>)}</div>{arena.campanhas.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Nenhuma campanha registrada.</p>}</section>
        </div>
      );
    }

    if (section === "teams") {
      const teams = normalizeTeams(data.equipes);
      const attentionTeam = teams.lista.find((team) => team.atrasadas > 0 || team.convites_pendentes > 0);
      return (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[{ label: "Equipes ativas", value: teams.resumo.equipes, hint: "Estruturas cadastradas", icon: Users, color: "text-cyan-400" }, { label: "Membros", value: teams.resumo.membros, hint: "Convites aceitos", icon: CheckCircle2, color: "text-emerald-400" }, { label: "Convites pendentes", value: teams.resumo.convites_pendentes, hint: "Aguardando resposta", icon: AlertTriangle, color: "text-orange-400" }, { label: "Tarefas atrasadas", value: teams.resumo.atrasadas, hint: `${teams.resumo.tarefas} tarefas ativas`, icon: ClipboardList, color: "text-rose-400" }].map(({ label, value, hint, icon: Icon, color }) => <div key={label} className={`${panel} p-5`}><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-slate-500">{label}</p><p className="mt-3 text-3xl font-black text-white">{value}</p><p className="mt-2 text-xs text-slate-400">{hint}</p></div><Icon className={`h-5 w-5 ${color}`} /></div></div>)}
          </div>
          <div className="grid gap-5 xl:grid-cols-[1.45fr_.65fr]">
            <section className={`${panel} overflow-hidden`}><div className="border-b border-slate-800 px-6 py-5"><p className="text-[10px] font-bold uppercase tracking-[.25em] text-cyan-400">Estrutura organizacional</p><h2 className="mt-1 text-lg font-bold text-white">Visão das equipes</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="bg-[#0b1b2b] text-[10px] uppercase tracking-[.16em] text-slate-500"><tr><th className="px-6 py-4">Equipe</th><th className="px-4 py-4">Centro de custo</th><th className="px-4 py-4">Supervisor</th><th className="px-4 py-4">Membros</th><th className="px-4 py-4">Pendentes</th><th className="px-6 py-4">Tarefas</th></tr></thead><tbody className="divide-y divide-slate-800">{teams.lista.map((team) => <tr key={team.id}><td className="px-6 py-4 font-bold text-white">{team.nome}</td><td className="px-4 py-4 text-slate-300">{team.centro_custo}</td><td className="px-4 py-4 text-slate-400">{team.supervisor}</td><td className="px-4 py-4 text-cyan-300">{team.membros}</td><td className="px-4 py-4 font-bold text-orange-300">{team.convites_pendentes}</td><td className="px-6 py-4 text-slate-300">{team.tarefas} <span className="text-rose-300">({team.atrasadas} atrasadas)</span></td></tr>)}</tbody></table></div>{teams.lista.length === 0 && <p className="p-10 text-center text-sm text-slate-500">Nenhuma equipe foi criada no organizador de tarefas.</p>}</section>
            <section className={`${panel} p-6`}><p className="text-[10px] font-bold uppercase tracking-[.25em] text-orange-400">Insight de Equipes</p><h2 className="mt-2 text-lg font-bold text-white">Ponto de atenção</h2>{attentionTeam ? <><p className="mt-5 text-xl font-black text-white">{attentionTeam.nome}</p><p className="mt-2 text-sm leading-6 text-slate-400">Possui {attentionTeam.convites_pendentes} convite(s) pendente(s) e {attentionTeam.atrasadas} tarefa(s) atrasada(s). O acompanhamento é apenas informativo para a Gerência.</p></> : <p className="mt-5 text-sm leading-6 text-slate-400">As equipes cadastradas não possuem pendências críticas no momento.</p>}</section>
          </div>
        </div>
      );
    }

    if (section === "quality") {
      const quality = normalizeQuality(data.qualidade);
      const criticalWallet = quality.carteiras[0];
      const qualityHasData = quality.resumo.monitorias > 0;
      const previousMonitoring = quality.resumo.monitorias_anteriores ?? 0;
      const previousScore = quality.resumo.nota_media_anterior ?? 0;
      const qualityCards = [
        { label: "Monitorias", value: quality.resumo.monitorias, hint: `Nos últimos ${period} dias`, comparison: comparisonText(quality.resumo.monitorias, previousMonitoring), comparisonTone: comparisonClass(quality.resumo.monitorias, previousMonitoring), icon: ShieldCheck, color: "text-cyan-400" },
        { label: "Nota média", value: quality.resumo.nota_media, hint: "Média no período", comparison: comparisonText(quality.resumo.nota_media, previousScore), comparisonTone: comparisonClass(quality.resumo.nota_media, previousScore), icon: BarChart3, color: "text-violet-400" },
        { label: "Operadores", value: quality.resumo.operadores, hint: `${quality.resumo.monitores} monitores`, icon: Users, color: "text-emerald-400" },
        { label: "Avaliações negativas", value: quality.resumo.negativas, hint: "Precisam de análise", icon: AlertTriangle, color: "text-rose-400" },
      ];
      return (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{qualityCards.map(({ label, value, hint, comparison, comparisonTone, icon: Icon, color }) => <div key={label} className={`${panel} p-5`}><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-slate-500">{label}</p>{qualityHasData ? <p className="mt-3 text-3xl font-black text-white">{value}</p> : <p className="mt-3 text-sm font-bold text-slate-500">Aguardando dados</p>}<p className="mt-2 text-xs text-slate-400">{hint}</p>{comparison && <p className={`mt-2 text-[10px] font-bold ${comparisonTone}`}>{comparison}</p>}</div><Icon className={`h-5 w-5 ${color}`} /></div></div>)}</div>
          <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
            <section className={`${panel} overflow-hidden`}><div className="border-b border-slate-800 px-6 py-5"><p className="text-[10px] font-bold uppercase tracking-[.25em] text-cyan-400">Comparativo de qualidade</p><h2 className="mt-1 text-lg font-bold text-white">Desempenho por carteira</h2></div><div className="divide-y divide-slate-800">{quality.carteiras.slice(0, 10).map((wallet) => <div key={wallet.carteira} className="grid grid-cols-[1fr_auto] items-center gap-5 px-6 py-4"><div><p className="font-bold text-white">{wallet.carteira}</p><p className="mt-1 text-xs text-slate-500">{wallet.monitorias} monitorias · {wallet.operadores} operadores · {wallet.negativas} negativas</p></div><div className="text-right"><p className={`text-xl font-black ${wallet.nota_media < 80 ? "text-rose-300" : "text-emerald-300"}`}>{wallet.nota_media}</p><p className="text-[9px] uppercase tracking-wider text-slate-500">nota média</p></div></div>)}{quality.carteiras.length === 0 && <p className="p-10 text-center text-sm text-slate-500">Nenhuma monitoria registrada.</p>}</div></section>
            <section className={`${panel} p-6`}><p className="text-[10px] font-bold uppercase tracking-[.25em] text-orange-400">Insight de Qualidade</p><h2 className="mt-2 text-lg font-bold text-white">Carteira prioritária</h2>{criticalWallet ? <><p className="mt-5 text-xl font-black text-white">{criticalWallet.carteira}</p><p className="mt-2 text-sm leading-6 text-slate-400">Apresenta a menor nota média do conjunto analisado: <strong className="text-rose-300">{criticalWallet.nota_media}</strong>, com {criticalWallet.negativas} avaliação(ões) negativa(s).</p></> : <p className="mt-5 text-sm text-slate-400">Sem dados suficientes para gerar uma recomendação.</p>}</section>
          </div>
          <section className={`${panel} p-6`}><div><p className="text-[10px] font-bold uppercase tracking-[.25em] text-violet-400">Últimos seis meses</p><h2 className="mt-1 text-lg font-bold text-white">Evolução da nota</h2></div><div className="mt-5 h-56"><ResponsiveContainer width="100%" height="100%"><AreaChart data={quality.evolucao}><defs><linearGradient id="qualityArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a78bfa" stopOpacity={0.35}/><stop offset="100%" stopColor="#a78bfa" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="mes" tickFormatter={monthLabel} stroke="#64748b" fontSize={11} tickLine={false} axisLine={false}/><YAxis domain={[0, 100]} stroke="#64748b" fontSize={11} tickLine={false} axisLine={false}/><Tooltip contentStyle={{ background: "#07121f", border: "1px solid #334155", borderRadius: 12 }} labelFormatter={monthLabel}/><Area type="monotone" dataKey="nota_media" stroke="#a78bfa" fill="url(#qualityArea)" strokeWidth={2} name="Nota média"/></AreaChart></ResponsiveContainer></div></section>
        </div>
      );
    }

    if (section === "copilot") {
      const usage = normalizeUsage(data.uso_copilot);
      const topCommand = usage.comandos[0];
      const usageHasData = usage.resumo.acessos_30_dias > 0;
      const previousAccesses = usage.resumo.acessos_anteriores ?? 0;
      const previousUsers = usage.resumo.usuarios_anteriores ?? 0;
      const usageCards = [
        { label: "Acessos históricos", value: usage.resumo.acessos, hint: `${usage.resumo.usuarios} usuários`, hasData: usage.resumo.acessos > 0, icon: Activity, color: "text-cyan-400" },
        { label: `Acessos em ${period} dias`, value: usage.resumo.acessos_30_dias, hint: "Uso recente", hasData: usageHasData, comparison: comparisonText(usage.resumo.acessos_30_dias, previousAccesses), comparisonTone: comparisonClass(usage.resumo.acessos_30_dias, previousAccesses), icon: BarChart3, color: "text-orange-400" },
        { label: `Usuários em ${period} dias`, value: usage.resumo.usuarios_30_dias, hint: "Pessoas ativas", hasData: usageHasData, comparison: comparisonText(usage.resumo.usuarios_30_dias, previousUsers), comparisonTone: comparisonClass(usage.resumo.usuarios_30_dias, previousUsers), icon: Users, color: "text-emerald-400" },
        { label: "Comandos monitorados", value: usage.comandos.length, hint: "Eventos registrados", hasData: usage.comandos.length > 0, icon: Sparkles, color: "text-violet-400" },
      ];
      return (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{usageCards.map(({ label, value, hint, hasData, comparison, comparisonTone, icon: Icon, color }) => <div key={label} className={`${panel} p-5`}><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-slate-500">{label}</p>{hasData ? <p className="mt-3 text-3xl font-black text-white">{value}</p> : <p className="mt-3 text-sm font-bold text-slate-500">Aguardando dados</p>}<p className="mt-2 text-xs text-slate-400">{hint}</p>{comparison && <p className={`mt-2 text-[10px] font-bold ${comparisonTone}`}>{comparison}</p>}</div><Icon className={`h-5 w-5 ${color}`} /></div></div>)}</div>
          <div className="grid gap-5 xl:grid-cols-[1.3fr_.7fr]">
            <section className={`${panel} overflow-hidden`}><div className="border-b border-slate-800 px-6 py-5"><p className="text-[10px] font-bold uppercase tracking-[.25em] text-cyan-400">Adoção</p><h2 className="mt-1 text-lg font-bold text-white">Uso por centro de custo · {period} dias</h2></div><div className="divide-y divide-slate-800">{usage.centros.slice(0, 12).map((center) => <div key={center.centro_custo} className="grid grid-cols-[1fr_auto_auto] items-center gap-5 px-6 py-4"><div><p className="font-bold text-white">{center.centro_custo}</p><p className="mt-1 text-xs text-slate-500">Último acesso {center.ultimo_acesso ? new Date(center.ultimo_acesso).toLocaleString("pt-BR") : "não registrado"}</p></div><div className="text-right"><p className="font-black text-cyan-300">{center.usuarios}</p><p className="text-[9px] uppercase text-slate-500">usuários</p></div><div className="text-right"><p className="font-black text-orange-300">{center.acessos}</p><p className="text-[9px] uppercase text-slate-500">acessos</p></div></div>)}{usage.centros.length === 0 && <p className="p-10 text-center text-sm font-semibold text-slate-500">Aguardando dados para este filtro.</p>}</div></section>
            <section className={`${panel} overflow-hidden`}><div className="border-b border-slate-800 px-6 py-5"><p className="text-[10px] font-bold uppercase tracking-[.25em] text-violet-400">Comandos</p><h2 className="mt-1 text-lg font-bold text-white">Mais utilizados</h2></div><div className="divide-y divide-slate-800">{usage.comandos.map((command, index) => <div key={command.comando} className="flex items-center justify-between gap-4 px-6 py-4"><div className="flex items-center gap-3"><span className="text-xs font-black text-slate-600">{String(index + 1).padStart(2, "0")}</span><p className="font-bold text-white">{command.comando}</p></div><div className="text-right"><p className="font-black text-violet-300">{command.usos}</p><p className="text-[9px] text-slate-500">{command.usuarios} usuários</p></div></div>)}{usage.comandos.length === 0 && <p className="p-8 text-center text-sm text-slate-500">A coleta por comando foi iniciada nesta versão. Os dados aparecerão conforme o uso.</p>}</div>{topCommand && <div className="border-t border-slate-800 bg-violet-400/5 p-4 text-xs text-slate-400"><strong className="text-violet-300">{topCommand.comando}</strong> é o comando mais utilizado no período.</div>}</section>
          </div>
        </div>
      );
    }

    if (section === "reports") {
      const teams = normalizeTeams(data.equipes);
      const quality = normalizeQuality(data.qualidade);
      const usage = normalizeUsage(data.uso_copilot);
      return (
        <div className="space-y-5">
          <section className={`${panel} overflow-hidden`}><div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 p-6"><div><p className="text-[10px] font-bold uppercase tracking-[.25em] text-cyan-400">Relatório executivo</p><h2 className="mt-2 text-2xl font-black text-white">Consolidado da Central de Gestão</h2><p className="mt-1 text-sm text-slate-400">Resumo atualizado de todos os módulos já conectados.</p></div><button onClick={() => exportManagementReport({ ...data, equipes: teams, qualidade: quality, uso_copilot: usage })} className="flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-black text-white hover:bg-orange-400"><Download className="h-4 w-4"/>Exportar CSV</button></div><div className="grid gap-px bg-slate-800 sm:grid-cols-2 xl:grid-cols-3">{[{ title: "Tarefas e Equipes", main: `${data.resumo.total_tarefas} tarefas`, detail: `${teams.resumo.equipes} equipes · ${data.resumo.atrasadas} atrasadas`, icon: ClipboardList }, { title: "Academia", main: `${data.academia.resumo.conclusao_media}% conclusão`, detail: `${data.academia.resumo.total_matriculas} matrículas`, icon: GraduationCap }, { title: "Qualidade", main: `${quality.resumo.nota_media} de média`, detail: `${quality.resumo.monitorias} monitorias em ${period} dias`, icon: ShieldCheck }, { title: "Arena", main: `${data.arena.resumo.campanhas} campanhas`, detail: `${data.arena.resumo.participantes} participantes`, icon: Gamepad2 }, { title: "Uso do Copilot", main: `${usage.resumo.acessos_30_dias} acessos`, detail: `${usage.resumo.usuarios_30_dias} usuários em ${period} dias`, icon: Sparkles }, { title: "Atualização", main: new Date(data.atualizado_em).toLocaleDateString("pt-BR"), detail: new Date(data.atualizado_em).toLocaleTimeString("pt-BR"), icon: RefreshCw }].map(({ title, main, detail, icon: Icon }) => <div key={title} className="bg-[#081522] p-6"><Icon className="h-5 w-5 text-cyan-400"/><p className="mt-5 text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">{title}</p><p className="mt-2 text-xl font-black text-white">{main}</p><p className="mt-1 text-xs text-slate-400">{detail}</p></div>)}</div></section>
          <section className={`${panel} p-6`}><p className="text-[10px] font-bold uppercase tracking-[.25em] text-orange-400">Leitura da Aurora</p><h2 className="mt-2 text-lg font-bold text-white">Resumo executivo automático</h2><div className="mt-5 grid gap-3 md:grid-cols-2"><div className="rounded-xl border border-slate-800 bg-[#06111e] p-4 text-sm leading-6 text-slate-400">O portfólio possui <strong className="text-white">{data.resumo.total_tarefas} tarefas</strong>, sendo <strong className="text-rose-300">{data.resumo.atrasadas} atrasadas</strong>.</div><div className="rounded-xl border border-slate-800 bg-[#06111e] p-4 text-sm leading-6 text-slate-400">A Academia registra <strong className="text-white">{data.academia.resumo.conclusao_media}% de conclusão</strong> e {data.academia.resumo.alunos_em_risco + data.academia.resumo.alunos_interrompidos} jornada(s) sob atenção.</div><div className="rounded-xl border border-slate-800 bg-[#06111e] p-4 text-sm leading-6 text-slate-400">A Qualidade apresenta nota média <strong className="text-white">{quality.resumo.nota_media}</strong> em {quality.resumo.monitorias} monitorias.</div><div className="rounded-xl border border-slate-800 bg-[#06111e] p-4 text-sm leading-6 text-slate-400">O Copilot teve <strong className="text-white">{usage.resumo.usuarios_30_dias} usuários ativos</strong> nos últimos {period} dias.</div></div></section>
        </div>
      );
    }

    if (section !== "overview") {
      const selected = menu.find((item) => item.id === section)!;
      const Icon = selected.icon;
      return (
        <div className={`${panel} grid min-h-[520px] place-items-center p-8 text-center`}>
          <div className="max-w-lg">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-cyan-400/25 bg-cyan-400/10">
              <Icon className="h-7 w-7 text-cyan-300" />
            </div>
            <h2 className="mt-5 text-2xl font-black text-white">{selected.label}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Esta área já faz parte da arquitetura da Central. Os indicadores serão ativados quando houver uma fonte corporativa autorizada, sem exibir números simulados.
            </p>
          </div>
        </div>
      );
    }

    const cards = [
      { label: "Tarefas no portfólio", value: data.resumo.total_tarefas, hint: `${data.resumo.areas} áreas acompanhadas`, icon: ClipboardList, tone: "orange" },
      { label: "Em andamento", value: data.resumo.em_andamento, hint: "Demandas em execução", icon: Activity, tone: "cyan" },
      { label: "Concluídas", value: data.resumo.concluidas, hint: `${data.resumo.taxa_conclusao}% de conclusão`, icon: CheckCircle2, tone: "emerald" },
      { label: "Precisam de atenção", value: data.resumo.atrasadas, hint: "Demandas vencidas", icon: AlertTriangle, tone: "rose" },
    ];

    return (
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(({ label, value, hint, icon: Icon, tone }) => (
            <div key={label} className={`${panel} relative overflow-hidden p-5`}>
              <div className={`absolute -right-5 -top-5 h-24 w-24 rounded-full blur-xl ${toneClasses[tone as keyof typeof toneClasses].glow}`} />
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.2em] text-slate-500">{label}</p>
                  <p className="mt-3 text-3xl font-black text-white">{value}</p>
                  <p className="mt-2 text-xs text-slate-400">{hint}</p>
                </div>
                <Icon className={`h-5 w-5 ${toneClasses[tone as keyof typeof toneClasses].icon}`} />
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.55fr_.85fr]">
          <section className={`${panel} overflow-hidden`}>
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-5">
              <div><p className="text-[10px] font-bold uppercase tracking-[.25em] text-cyan-400">Panorama corporativo</p><h2 className="mt-1 text-lg font-bold text-white">Saúde das áreas</h2></div>
              <button onClick={() => setSection("portfolio")} className="flex items-center gap-1 text-xs font-bold text-orange-300 hover:text-orange-200">Ver portfólio <ChevronRight className="h-4 w-4" /></button>
            </div>
            <div className="divide-y divide-slate-800">
              {data.areas.slice(0, 6).map((area) => {
                const status = areaStatus(area);
                return (
                  <div key={area.centro_custo} className="grid grid-cols-[1fr_auto] items-center gap-4 px-6 py-4 hover:bg-cyan-400/[.03]">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: status.color }} /><p className="truncate font-semibold text-slate-100">{area.centro_custo}</p></div>
                      <p className="mt-1 text-xs text-slate-500">{area.equipes} equipes · {area.colaboradores} responsáveis · {area.total_tarefas} tarefas</p>
                    </div>
                    <div className="text-right"><p className="font-bold text-slate-100">{area.taxa_conclusao}%</p><p className="text-[10px] uppercase tracking-wider text-slate-500">concluído</p></div>
                  </div>
                );
              })}
              {data.areas.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Sem dados de tarefas para exibir.</p>}
            </div>
          </section>

          <section className={`${panel} overflow-hidden`}>
            <div className="border-b border-slate-800 px-6 py-5"><p className="text-[10px] font-bold uppercase tracking-[.25em] text-orange-400">Prioridade executiva</p><h2 className="mt-1 text-lg font-bold text-white">Central de atenção</h2></div>
            <div className="divide-y divide-slate-800">
              {data.atencoes.slice(0, 5).map((item) => (
                <div key={item.id} className="px-6 py-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                    <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-100">{item.titulo}</p><p className="mt-1 truncate text-xs text-slate-500">{item.centro_custo} · {item.responsavel}</p>{item.dias_atraso > 0 && <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-rose-300">{item.dias_atraso} dia(s) em atraso</p>}</div>
                  </div>
                </div>
              ))}
              {data.atencoes.length === 0 && <div className="p-8 text-center"><CheckCircle2 className="mx-auto h-7 w-7 text-emerald-400" /><p className="mt-3 text-sm text-slate-400">Nenhum alerta crítico no momento.</p></div>}
            </div>
          </section>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
          <section className={`${panel} p-6`}>
            <div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.25em] text-violet-400">Últimos seis meses</p><h2 className="mt-1 text-lg font-bold text-white">Evolução das entregas</h2></div><BarChart3 className="h-5 w-5 text-violet-300" /></div>
            <div className="mt-5 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.evolucao}>
                  <defs><linearGradient id="gestaoArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22d3ee" stopOpacity={0.35}/><stop offset="100%" stopColor="#22d3ee" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="mes" tickFormatter={monthLabel} stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "#07121f", border: "1px solid #334155", borderRadius: 12 }} labelFormatter={monthLabel} />
                  <Area type="monotone" dataKey="criadas" stroke="#a78bfa" fill="transparent" strokeWidth={2} name="Criadas" />
                  <Area type="monotone" dataKey="concluidas" stroke="#22d3ee" fill="url(#gestaoArea)" strokeWidth={2} name="Concluídas" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section className={`${panel} p-6`}>
            <p className="text-[10px] font-bold uppercase tracking-[.25em] text-orange-400">Leitura executiva</p>
            <h2 className="mt-2 text-lg font-bold text-white">Foco recomendado</h2>
            {mostCritical ? <><p className="mt-5 text-2xl font-black text-white">{mostCritical.centro_custo}</p><p className="mt-2 text-sm leading-6 text-slate-400">É a área com maior necessidade de atenção no portfólio atual, com <strong className="text-rose-300">{mostCritical.atrasadas} tarefa(s) atrasada(s)</strong>.</p><button onClick={() => setSection("portfolio")} className="mt-6 w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-black text-white hover:bg-orange-400">Analisar portfólio</button></> : <p className="mt-5 text-sm text-slate-400">A leitura será gerada quando houver tarefas cadastradas.</p>}
          </section>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#020914] text-slate-100 [background-image:radial-gradient(circle_at_78%_8%,rgba(14,165,233,.10),transparent_27%),linear-gradient(rgba(30,41,59,.18)_1px,transparent_1px),linear-gradient(90deg,rgba(30,41,59,.18)_1px,transparent_1px)] [background-size:auto,40px_40px,40px_40px]">
      <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-slate-800 bg-[#030b16]/95 px-5 backdrop-blur-xl lg:px-8">
        <div className="flex items-center gap-4"><div className="grid h-10 w-10 place-items-center rounded-xl border border-orange-500/40 bg-orange-500/10"><BriefcaseBusiness className="h-5 w-5 text-orange-400" /></div><div><p className="text-sm font-black tracking-[.14em] text-white">CENTRAL DE <span className="text-orange-400">GESTÃO</span></p><p className="text-[9px] uppercase tracking-[.28em] text-slate-500">Copilot 2.0 · visão corporativa</p></div></div>
        <div className="flex items-center gap-2"><button onClick={load} aria-label="Atualizar" className="grid h-10 w-10 place-items-center rounded-xl border border-slate-700 text-slate-400 hover:border-cyan-400/50 hover:text-cyan-300"><RefreshCw className="h-4 w-4" /></button><button onClick={() => { localStorage.clear(); navigate("/login"); }} className="flex h-10 items-center gap-2 rounded-xl border border-slate-700 px-3 text-xs font-bold text-slate-400 hover:border-rose-400/40 hover:text-rose-300"><LogOut className="h-4 w-4" /><span className="hidden sm:inline">Sair</span></button></div>
      </header>
      <div className="mx-auto grid max-w-[1680px] lg:grid-cols-[250px_1fr]">
        <aside className="border-b border-slate-800 bg-[#030c17]/80 p-4 lg:sticky lg:top-[72px] lg:h-[calc(100vh-72px)] lg:border-b-0 lg:border-r">
          <div className="mb-5 rounded-2xl border border-slate-800 bg-[#091727] p-4"><p className="text-[10px] uppercase tracking-[.2em] text-slate-500">Bem-vindo,</p><p className="mt-1 font-bold text-white">{firstName}</p><p className="mt-1 text-xs text-cyan-400">Gerência Operacional</p></div>
          <nav className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-1">
            {menu.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setSection(id)} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left text-xs font-semibold transition ${section === id ? "border border-orange-500/35 bg-orange-500/10 text-orange-300" : "border border-transparent text-slate-400 hover:bg-slate-800/60 hover:text-white"}`}><Icon className="h-4 w-4 shrink-0" /><span className="truncate">{label}</span></button>)}
          </nav>
          <button onClick={() => navigate("/gerente/resultados")} className="mt-5 flex w-full items-center justify-between rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-4 py-3 text-left text-xs font-bold text-cyan-300 hover:bg-cyan-400/10"><span>Resultados operacionais</span><ChevronRight className="h-4 w-4" /></button>
          {/* Esta tela nao tem painel de comandos; sem esta volta, o unico
              caminho de saida era o "Sair", que derruba a sessao. */}
          <button onClick={() => navigate("/gerente")} className="mt-2 flex w-full items-center gap-2 rounded-xl border border-slate-800 px-4 py-3 text-left text-xs font-bold text-slate-400 hover:border-slate-600 hover:text-white"><ChevronLeft className="h-4 w-4" /><span>Voltar ao Copilot</span></button>
        </aside>
        <main className="min-w-0 p-4 sm:p-6 lg:p-8">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.28em] text-cyan-400">Comando executivo</p><h1 className="mt-2 text-2xl font-black text-white sm:text-3xl">Visão completa da operação</h1><p className="mt-2 text-sm text-slate-400">Indicadores reais, riscos e entregas reunidos em uma leitura gerencial.</p></div><div className="rounded-xl border border-slate-800 bg-[#081522] px-4 py-2 text-[10px] uppercase tracking-[.16em] text-slate-500">Atualizado {data?.atualizado_em ? new Date(data.atualizado_em).toLocaleString("pt-BR") : "agora"}</div></div>
          <div className="mb-7 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-800 bg-[#071321]/90 p-3">
            <div className="flex items-center gap-2 px-2 text-[10px] font-bold uppercase tracking-[.2em] text-cyan-300"><SlidersHorizontal className="h-4 w-4" /> Filtros executivos</div>
            <label className="flex items-center gap-2 rounded-xl border border-slate-700 bg-[#030c17] px-3 py-2 text-xs text-slate-400">
              Período
              <select value={period} onChange={(event) => setPeriod(Number(event.target.value))} style={{ colorScheme: "dark" }} className="bg-transparent font-bold text-white outline-none [&>option]:bg-[#071321] [&>option]:text-slate-100"><option value={7}>7 dias</option><option value={30}>30 dias</option><option value={90}>90 dias</option></select>
            </label>
            <label className="flex min-w-[250px] flex-1 items-center gap-2 rounded-xl border border-slate-700 bg-[#030c17] px-3 py-2 text-xs text-slate-400 sm:max-w-md">
              Centro de custo
              <select value={costCenter} onChange={(event) => setCostCenter(event.target.value)} style={{ colorScheme: "dark" }} className="min-w-0 flex-1 bg-transparent font-bold text-white outline-none [&>option]:bg-[#071321] [&>option]:text-slate-100"><option value="">Todos</option>{(data?.filtros?.centros_disponiveis ?? []).map((center) => <option key={center} value={center}>{center}</option>)}</select>
            </label>
            {(period !== 30 || costCenter) && <button onClick={() => { setPeriod(30); setCostCenter(""); }} className="rounded-xl border border-orange-400/30 px-3 py-2 text-xs font-bold text-orange-300 hover:bg-orange-400/10">Limpar filtros</button>}
            <p className="ml-auto px-2 text-[10px] text-slate-500">Comparação com os {period} dias anteriores</p>
          </div>
          {content()}
        </main>
      </div>
      <TodoModal isOpen={showTasks} onClose={() => setShowTasks(false)} />
    </div>
  );
};

export default CentralGestao;
