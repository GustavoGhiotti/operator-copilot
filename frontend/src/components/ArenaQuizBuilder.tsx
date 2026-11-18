import { useEffect, useState } from "react";
import { Check, CirclePlus, Copy, Loader2, Save, Sparkles, Trash2, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { arenaApi, ArenaQuizConfig, ArenaQuizQuestion } from "@/services/arenaApi";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ArenaQuizBuilderProps {
  campaignId: number;
  onSaved: (quiz: ArenaQuizConfig) => void;
}

const newQuestion = (): ArenaQuizQuestion => ({
  enunciado: "",
  explicacao: "",
  tempo_segundos: null,
  alternativas: [
    { texto: "", correta: true },
    { texto: "", correta: false },
    { texto: "", correta: false },
    { texto: "", correta: false },
  ],
});

const errorMessage = (error: unknown) => {
  const candidate = error as { response?: { data?: { erro?: string } } };
  return candidate.response?.data?.erro || "Não foi possível concluir esta ação.";
};

export default function ArenaQuizBuilder({
  campaignId,
  onSaved,
}: ArenaQuizBuilderProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiTheme, setAiTheme] = useState("Gatilhos de negociação em cobrança");
  const [aiContext, setAiContext] = useState("");
  const [aiDifficulty, setAiDifficulty] = useState<"BASICO" | "INTERMEDIARIO" | "AVANCADO">("INTERMEDIARIO");
  const [aiQuantity, setAiQuantity] = useState(10);
  const [aiSuggestions, setAiSuggestions] = useState<ArenaQuizQuestion[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
  const [activeQuestion, setActiveQuestion] = useState(0);
  const [quiz, setQuiz] = useState<ArenaQuizConfig>({
    id_campanha: campaignId,
    tempo_pergunta_segundos: 20,
    pontos_acerto: 100,
    bonus_velocidade_max: 50,
    embaralhar_perguntas: false,
    embaralhar_alternativas: true,
    status: "RASCUNHO",
    perguntas: [newQuestion(), newQuestion()],
  });

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await arenaApi.getQuiz(campaignId);
        if (!active) return;
        setQuiz({
          ...data,
          perguntas: data.perguntas.length
            ? data.perguntas
            : [newQuestion(), newQuestion()],
        });
      } catch (error) {
        toast({
          title: "Editor do Quiz indisponível",
          description: errorMessage(error),
          variant: "destructive",
        });
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [campaignId, toast]);

  const updateQuestion = (
    index: number,
    updater: (question: ArenaQuizQuestion) => ArenaQuizQuestion,
  ) => {
    setQuiz((current) => ({
      ...current,
      perguntas: current.perguntas.map((question, questionIndex) =>
        questionIndex === index ? updater(question) : question,
      ),
    }));
  };

  const addQuestion = () => {
    if (quiz.perguntas.length >= 50) return;
    setQuiz((current) => ({
      ...current,
      perguntas: [...current.perguntas, newQuestion()],
    }));
    setActiveQuestion(quiz.perguntas.length);
  };

  const duplicateQuestion = (index: number) => {
    if (quiz.perguntas.length >= 50) return;
    const copy = JSON.parse(
      JSON.stringify(quiz.perguntas[index]),
    ) as ArenaQuizQuestion;
    delete copy.id;
    copy.alternativas = copy.alternativas.map(({ texto, correta }) => ({
      texto,
      correta,
    }));
    setQuiz((current) => ({
      ...current,
      perguntas: [
        ...current.perguntas.slice(0, index + 1),
        copy,
        ...current.perguntas.slice(index + 1),
      ],
    }));
    setActiveQuestion(index + 1);
  };

  const removeQuestion = (index: number) => {
    if (quiz.perguntas.length <= 2) {
      toast({ title: "O Quiz precisa ter ao menos duas perguntas." });
      return;
    }
    setQuiz((current) => ({
      ...current,
      perguntas: current.perguntas.filter((_, questionIndex) => questionIndex !== index),
    }));
    setActiveQuestion((current) => Math.max(0, Math.min(current, quiz.perguntas.length - 2)));
  };

  const save = async () => {
    setSaving(true);
    try {
      const saved = await arenaApi.saveQuiz(campaignId, {
        tempo_pergunta_segundos: Number(quiz.tempo_pergunta_segundos),
        pontos_acerto: Number(quiz.pontos_acerto),
        bonus_velocidade_max: Number(quiz.bonus_velocidade_max),
        embaralhar_perguntas: quiz.embaralhar_perguntas,
        embaralhar_alternativas: quiz.embaralhar_alternativas,
        perguntas: quiz.perguntas,
      });
      toast({
        title: "Quiz salvo",
        description: `${saved.perguntas.length} perguntas prontas para a campanha.`,
      });
      onSaved(saved);
    } catch (error) {
      toast({
        title: "Revise as perguntas",
        description: errorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const generateSuggestions = async () => {
    setAiLoading(true);
    try {
      const result = await arenaApi.generateQuizSuggestions(campaignId, {
        tema: aiTheme,
        contexto: aiContext,
        dificuldade: aiDifficulty,
        quantidade: aiQuantity,
      });
      setAiSuggestions(result.perguntas);
      setSelectedSuggestions(new Set(result.perguntas.map((_, index) => index)));
      toast({
        title: "Sugestões prontas para revisão",
        description: "Nada foi salvo ou adicionado ao Quiz ainda.",
      });
    } catch (error) {
      toast({
        title: "Não foi possível gerar as sugestões",
        description: errorMessage(error),
        variant: "destructive",
      });
    } finally {
      setAiLoading(false);
    }
  };

  const importSuggestions = () => {
    const chosen = aiSuggestions.filter((_, index) => selectedSuggestions.has(index));
    if (!chosen.length) {
      toast({ title: "Selecione ao menos uma sugestão." });
      return;
    }
    const currentQuestions = quiz.perguntas.filter(
      (item) => item.enunciado.trim() || item.alternativas.some((alternative) => alternative.texto.trim()),
    );
    const available = Math.max(0, 50 - currentQuestions.length);
    if (!available) {
      toast({ title: "O Quiz já atingiu o limite de 50 perguntas." });
      return;
    }
    const imported = chosen.slice(0, available).map((item) => ({
      ...item,
      tempo_segundos: item.tempo_segundos || null,
      alternativas: item.alternativas.map(({ texto, correta }) => ({ texto, correta })),
    }));
    setQuiz((current) => ({
      ...current,
      perguntas: [...currentQuestions, ...imported],
    }));
    setActiveQuestion(currentQuestions.length);
    setAiOpen(false);
    setAiSuggestions([]);
    toast({
      title: `${imported.length} pergunta(s) adicionada(s)`,
      description: imported.length < chosen.length
        ? "Algumas sugestões não couberam no limite de 50 perguntas."
        : "Revise o conteúdo e salve o Quiz quando estiver pronto.",
    });
  };

  if (loading) {
    return (
      <div className="grid min-h-80 place-items-center">
        <Loader2 className="h-7 w-7 animate-spin text-cyan-300" />
      </div>
    );
  }

  const question = quiz.perguntas[activeQuestion];

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-3 rounded-xl border border-violet-400/30 bg-[linear-gradient(120deg,rgba(124,58,237,0.12),rgba(6,182,212,0.05))] p-4 sm:flex-row sm:items-center">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-violet-300/30 bg-violet-400/10">
          <Sparkles className="h-5 w-5 text-violet-300" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-white">Aurora cria um primeiro rascunho para você</p>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-400">Defina o tema, revise cada resposta e importe somente o que fizer sentido. A IA não salva nem publica automaticamente.</p>
        </div>
        <button type="button" onClick={() => setAiOpen(true)} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-violet-300/40 bg-violet-500/15 px-4 text-[10px] font-bold tracking-wide text-violet-100 transition hover:bg-violet-500/25">
          <Sparkles className="h-4 w-4" /> SUGESTÕES DA IA
        </button>
      </section>
      <section className="grid gap-3 rounded-xl border border-[#263e58] bg-[#071421] p-4 sm:grid-cols-3">
        <label>
          <span className="mb-2 block text-[9px] text-cyan-300">TEMPO PADRÃO</span>
          <input type="number" min={5} max={120} value={quiz.tempo_pergunta_segundos} onChange={(event) => setQuiz((current) => ({ ...current, tempo_pergunta_segundos: Number(event.target.value) }))} className="arena-input" />
        </label>
        <label>
          <span className="mb-2 block text-[9px] text-cyan-300">PONTOS POR ACERTO</span>
          <input type="number" min={1} max={10000} value={quiz.pontos_acerto} onChange={(event) => setQuiz((current) => ({ ...current, pontos_acerto: Number(event.target.value) }))} className="arena-input" />
        </label>
        <label>
          <span className="mb-2 block text-[9px] text-cyan-300">BÔNUS DE VELOCIDADE</span>
          <input type="number" min={0} max={10000} value={quiz.bonus_velocidade_max} onChange={(event) => setQuiz((current) => ({ ...current, bonus_velocidade_max: Number(event.target.value) }))} className="arena-input" />
        </label>
        <label className="flex items-center gap-3 text-xs text-slate-300">
          <input type="checkbox" checked={quiz.embaralhar_perguntas} onChange={(event) => setQuiz((current) => ({ ...current, embaralhar_perguntas: event.target.checked }))} className="accent-cyan-400" /> Embaralhar perguntas
        </label>
        <label className="flex items-center gap-3 text-xs text-slate-300">
          <input type="checkbox" checked={quiz.embaralhar_alternativas} onChange={(event) => setQuiz((current) => ({ ...current, embaralhar_alternativas: event.target.checked }))} className="accent-cyan-400" /> Embaralhar alternativas
        </label>
      </section>

      <div className="grid min-h-[430px] gap-4 lg:grid-cols-[190px_1fr]">
        <aside className="rounded-xl border border-[#263e58] bg-[#06111e] p-3">
          <div className="flex items-center justify-between px-1 pb-3">
            <span className="text-[9px] tracking-[0.13em] text-slate-500">PERGUNTAS</span>
            <span className="text-[9px] text-cyan-300">{quiz.perguntas.length}/50</span>
          </div>
          <div className="max-h-[335px] space-y-2 overflow-y-auto">
            {quiz.perguntas.map((item, index) => {
              const complete = item.enunciado.trim() && item.alternativas.every((alternative) => alternative.texto.trim());
              return (
                <button key={index} type="button" onClick={() => setActiveQuestion(index)} className={`flex w-full items-center gap-2 rounded-lg border p-2.5 text-left ${activeQuestion === index ? "border-cyan-400/60 bg-cyan-400/10" : "border-[#20364c] bg-[#071421]"}`}>
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-[#0b1d31] text-[10px] text-cyan-200">{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-[10px] text-slate-300">{item.enunciado || "Nova pergunta"}</span>
                  {complete && <Check className="h-3 w-3 text-emerald-400" />}
                </button>
              );
            })}
          </div>
          <button type="button" onClick={addQuestion} className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-cyan-400/40 text-[10px] text-cyan-300 hover:bg-cyan-400/5">
            <CirclePlus className="h-3.5 w-3.5" /> ADICIONAR
          </button>
        </aside>

        <section className="rounded-xl border border-[#263e58] bg-[#06111e] p-4">
          <div className="flex items-center gap-2 border-b border-[#20364c] pb-3">
            <Zap className="h-4 w-4 text-orange-400" />
            <h4 className="text-xs font-semibold text-white">Pergunta {activeQuestion + 1}</h4>
            <button type="button" onClick={() => duplicateQuestion(activeQuestion)} className="ml-auto text-slate-500 hover:text-cyan-300" title="Duplicar pergunta"><Copy className="h-4 w-4" /></button>
            <button type="button" onClick={() => removeQuestion(activeQuestion)} className="text-slate-500 hover:text-red-300" title="Excluir pergunta"><Trash2 className="h-4 w-4" /></button>
          </div>
          <label className="mt-4 block">
            <span className="mb-2 block text-[9px] text-cyan-300">ENUNCIADO</span>
            <textarea value={question.enunciado} onChange={(event) => updateQuestion(activeQuestion, (current) => ({ ...current, enunciado: event.target.value }))} rows={3} maxLength={1000} placeholder="Digite a pergunta que aparecerá para todos..." className="arena-input resize-none" />
          </label>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {question.alternativas.map((alternative, index) => (
              <label key={index} className={`flex items-center gap-3 rounded-xl border p-3 ${alternative.correta ? "border-emerald-400/50 bg-emerald-400/5" : "border-[#263e58] bg-[#071421]"}`}>
                <input type="radio" name={`correct-${activeQuestion}`} checked={alternative.correta} onChange={() => updateQuestion(activeQuestion, (current) => ({ ...current, alternativas: current.alternativas.map((item, alternativeIndex) => ({ ...item, correta: alternativeIndex === index })) }))} className="accent-emerald-400" />
                <input value={alternative.texto} onChange={(event) => updateQuestion(activeQuestion, (current) => ({ ...current, alternativas: current.alternativas.map((item, alternativeIndex) => alternativeIndex === index ? { ...item, texto: event.target.value } : item) }))} maxLength={600} placeholder={`Alternativa ${String.fromCharCode(65 + index)}`} className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-slate-600" />
              </label>
            ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_150px]">
            <label>
              <span className="mb-2 block text-[9px] text-cyan-300">EXPLICAÇÃO APÓS A RESPOSTA (OPCIONAL)</span>
              <input value={question.explicacao || ""} onChange={(event) => updateQuestion(activeQuestion, (current) => ({ ...current, explicacao: event.target.value }))} maxLength={1000} placeholder="Explique por que essa é a resposta correta..." className="arena-input" />
            </label>
            <label>
              <span className="mb-2 block text-[9px] text-cyan-300">TEMPO PRÓPRIO</span>
              <input type="number" min={5} max={120} value={question.tempo_segundos || ""} onChange={(event) => updateQuestion(activeQuestion, (current) => ({ ...current, tempo_segundos: event.target.value ? Number(event.target.value) : null }))} placeholder={`${quiz.tempo_pergunta_segundos}s`} className="arena-input" />
            </label>
          </div>
        </section>
      </div>

      <button type="button" disabled={saving} onClick={() => void save()} className="ml-auto flex h-11 items-center gap-2 rounded-xl bg-orange-500 px-5 text-xs font-bold text-white hover:bg-orange-400 disabled:opacity-50">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        SALVAR QUIZ E CONTINUAR
      </button>

      <Dialog open={aiOpen} onOpenChange={(open) => !aiLoading && setAiOpen(open)}>
        <DialogContent
          overlayClassName="z-[89]"
          className="z-[90] max-h-[88vh] max-w-3xl overflow-hidden border-[#29445e] bg-[#06111e] p-0 text-white"
        >
          <DialogHeader className="border-b border-[#20364c] bg-[linear-gradient(110deg,rgba(124,58,237,0.18),rgba(6,182,212,0.06))] px-6 py-5 text-left">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-violet-300/30 bg-violet-400/10"><Sparkles className="h-5 w-5 text-violet-300" /></span>
              <div>
                <DialogTitle className="text-base text-white">Sugestões da Aurora IA</DialogTitle>
                <DialogDescription className="mt-1 text-xs text-slate-400">Gere rascunhos e escolha o que será levado ao editor.</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="max-h-[calc(88vh-96px)] overflow-y-auto p-6">
            {!aiSuggestions.length ? (
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-[9px] tracking-[0.12em] text-cyan-300">TEMA DAS PERGUNTAS</span>
                  <input value={aiTheme} onChange={(event) => setAiTheme(event.target.value)} maxLength={300} className="arena-input" placeholder="Ex.: gatilhos de negociação em cobrança" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[9px] tracking-[0.12em] text-cyan-300">CONTEXTO PARA A IA (OPCIONAL)</span>
                  <textarea value={aiContext} onChange={(event) => setAiContext(event.target.value)} maxLength={2000} rows={4} className="arena-input resize-none" placeholder="Informe carteira, procedimento, público ou pontos que devem aparecer..." />
                  <span className="mt-1 block text-right text-[9px] text-slate-600">{aiContext.length}/2000</span>
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className="mb-2 block text-[9px] tracking-[0.12em] text-cyan-300">DIFICULDADE</span>
                    <select value={aiDifficulty} onChange={(event) => setAiDifficulty(event.target.value as typeof aiDifficulty)} className="arena-input">
                      <option value="BASICO">Básico</option>
                      <option value="INTERMEDIARIO">Intermediário</option>
                      <option value="AVANCADO">Avançado</option>
                    </select>
                  </label>
                  <label>
                    <span className="mb-2 block text-[9px] tracking-[0.12em] text-cyan-300">QUANTIDADE</span>
                    <input type="number" min={1} max={10} value={aiQuantity} onChange={(event) => setAiQuantity(Math.max(1, Math.min(10, Number(event.target.value) || 1)))} className="arena-input" />
                  </label>
                </div>
                <div className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-[10px] leading-relaxed text-amber-100/75">
                  As sugestões podem conter imprecisões. Revise conteúdo, política da carteira e resposta correta antes de salvar.
                </div>
                <button type="button" disabled={aiLoading || aiTheme.trim().length < 5} onClick={() => void generateSuggestions()} className="ml-auto flex h-11 items-center gap-2 rounded-xl bg-violet-500 px-5 text-xs font-bold text-white hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50">
                  {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {aiLoading ? "CRIANDO RASCUNHOS..." : "GERAR SUGESTÕES"}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold text-white">Revise antes de adicionar</p>
                    <p className="mt-1 text-[10px] text-slate-500">{selectedSuggestions.size} de {aiSuggestions.length} selecionadas</p>
                  </div>
                  <button type="button" onClick={() => { setAiSuggestions([]); setSelectedSuggestions(new Set()); }} className="text-[10px] font-semibold text-cyan-300 hover:text-cyan-200">AJUSTAR E GERAR NOVAMENTE</button>
                </div>
                <div className="space-y-3">
                  {aiSuggestions.map((item, index) => (
                    <label key={index} className={`block cursor-pointer rounded-xl border p-4 transition ${selectedSuggestions.has(index) ? "border-violet-400/50 bg-violet-400/10" : "border-[#20364c] bg-[#071421] opacity-65"}`}>
                      <div className="flex items-start gap-3">
                        <input type="checkbox" checked={selectedSuggestions.has(index)} onChange={() => setSelectedSuggestions((current) => { const next = new Set(current); if (next.has(index)) next.delete(index); else next.add(index); return next; })} className="mt-0.5 accent-violet-400" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold leading-relaxed text-white"><span className="mr-2 text-violet-300">{String(index + 1).padStart(2, "0")}</span>{item.enunciado}</p>
                          <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                            {item.alternativas.map((alternative, alternativeIndex) => (
                              <span key={alternativeIndex} className={`rounded-lg border px-2.5 py-2 text-[10px] ${alternative.correta ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-[#20364c] text-slate-400"}`}>{String.fromCharCode(65 + alternativeIndex)}. {alternative.texto}</span>
                            ))}
                          </div>
                          <p className="mt-3 text-[10px] leading-relaxed text-slate-400"><span className="text-cyan-300">Explicação:</span> {item.explicacao}</p>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="sticky bottom-0 flex justify-end border-t border-[#20364c] bg-[#06111e] pt-4">
                  <button type="button" onClick={importSuggestions} className="flex h-11 items-center gap-2 rounded-xl bg-orange-500 px-5 text-xs font-bold text-white hover:bg-orange-400"><CirclePlus className="h-4 w-4" /> ADICIONAR {selectedSuggestions.size} AO QUIZ</button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
