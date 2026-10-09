"use client";

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useSomenteMaster } from '@/components/useSomenteMaster';
import { useToast } from '@/components/ui/Toast';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Loader2, Plus, Trash2, Sparkles, Save, GripVertical, Search, AlertTriangle } from 'lucide-react';
import { PADDING_TELA, LARGURA_CONTEUDO, RODAPE_SEGURO } from '@/lib/layout';

/**
 * Montador manual de treino, só para o master.
 *
 * Existe para o Treino do Personal: o aluno paga R$ 147 por um treino montado à mão, e sem
 * esta tela não havia onde montar.
 *
 * A ORDEM DOS BOTÕES NÃO É ACIDENTE. "Gerar com IA" vem antes de "Começar do zero" porque
 * revisar um plano gerado leva uns dez minutos e montar do zero leva quarenta — e é essa
 * diferença que decide se dez treinos por mês cabem na agenda de alguém que também atende
 * aluno presencial. O plano gerado já respeita a anamnese, o nível e a academia do aluno; o
 * trabalho vira ajustar o que o profissional discorda, não digitar tudo.
 */

interface ExercicioLinha {
  id: string;
  exerciseId: string;
  name: string;
  muscleGroup: string;
  sets: number;
  reps: string;
  restSeconds: number;
  tips: string;
}

interface SessaoLinha {
  id: string;
  name: string;
  exercises: ExercicioLinha[];
}

interface Aluno { id: string; name: string | null; role: string | null }

/** O que /api/admin/aluno devolve para a tela mostrar. */
interface ResumoDoAluno {
  local: string | null;
  equipamentosCasa: string[];
  objetivo: string | null;
  nivel: string | null;
  frequencia: string | null;
  tempoSessao: string | null;
  dias: string | null;
  lesoes: string | null;
  condicoes: string | null;
  liberacao: string | null;
}
interface ExercicioCatalogo { id: string; name: string; muscle_group: string }

const novaLinha = (): ExercicioLinha => ({
  id: crypto.randomUUID(),
  exerciseId: '',
  name: '',
  muscleGroup: '',
  sets: 3,
  reps: '8-12',
  restSeconds: 60,
  tips: '',
});

export default function MontarTreino() {
  const ehMaster = useSomenteMaster();
  const toast = useToast();

  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [catalogo, setCatalogo] = useState<ExercicioCatalogo[]>([]);
  const [alunoId, setAlunoId] = useState('');
  const [nome, setNome] = useState('');
  const [sessoes, setSessoes] = useState<SessaoLinha[]>([]);
  const [gerando, setGerando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);

  const [resumo, setResumo] = useState<ResumoDoAluno | null>(null);
  const [temAnamnese, setTemAnamnese] = useState(false);
  const [carregandoAluno, setCarregandoAluno] = useState(false);

  /**
   * A configuração da geração.
   *
   * ERA CHUMBADA NO CÓDIGO até 09/10/2026: 'Academia completa', 'Hipertrofia',
   * 'Intermediário', 3 dias, 60 min, para todo aluno. A rota de geração decide casa x academia
   * por este objeto, então um treino montado para quem treina na sala vinha com leg press e
   * cadeira extensora. Agora o padrão é a anamnese do aluno, e o profissional ajusta.
   */
  const [config, setConfig] = useState({
    equipment: 'Academia completa',
    goal: 'Hipertrofia',
    level: 'Intermediário',
    daysPerWeek: 3,
    duration: 60,
  });

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const [r, cat] = await Promise.all([
        fetch('/api/admin/plano'),
        supabase.from('exercises').select('id, name, muscle_group').order('name').limit(1000),
      ]);
      if (r.ok) setAlunos((await r.json()).alunos ?? []);
      if (cat.data) setCatalogo(cat.data);
      setCarregando(false);
    })();
  }, []);

  const alunoEscolhido = alunos.find(a => a.id === alunoId);

  /**
   * Ao escolher o aluno, busca a anamnese dele e pré-preenche a geração.
   *
   * Recarrega do banco a cada troca, sem guardar em memória por aluno: o aluno pode ter
   * refeito a anamnese entre uma montagem e outra, e aqui o custo de estar desatualizado é
   * entregar um treino que não serve.
   */
  useEffect(() => {
    if (!alunoId) { setResumo(null); setTemAnamnese(false); return; }
    let cancelado = false;
    (async () => {
      setCarregandoAluno(true);
      try {
        const r = await fetch(`/api/admin/aluno?userId=${encodeURIComponent(alunoId)}`);
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Não consegui carregar o aluno.');
        if (cancelado) return;
        setResumo(d.resumo);
        setTemAnamnese(Boolean(d.aluno?.temAnamnese));
        setConfig(c => ({ ...c, ...d.sugestao }));
      } catch (e) {
        if (!cancelado) {
          setResumo(null);
          setTemAnamnese(false);
          toast.erro(e instanceof Error ? e.message : 'Não consegui carregar o aluno.');
        }
      } finally {
        if (!cancelado) setCarregandoAluno(false);
      }
    })();
    // Troca rápida de aluno: a resposta antiga não pode sobrescrever a nova.
    return () => { cancelado = true; };
  }, [alunoId]);

  // ---- montagem ----

  const addSessao = () => setSessoes(s => [...s, {
    id: crypto.randomUUID(),
    name: `Treino ${String.fromCharCode(65 + s.length)}`,
    exercises: [novaLinha()],
  }]);

  const removeSessao = (id: string) => setSessoes(s => s.filter(x => x.id !== id));

  const mudaSessao = (id: string, campo: keyof SessaoLinha, valor: any) =>
    setSessoes(s => s.map(x => (x.id === id ? { ...x, [campo]: valor } : x)));

  const addExercicio = (sessaoId: string) =>
    setSessoes(s => s.map(x => (x.id === sessaoId ? { ...x, exercises: [...x.exercises, novaLinha()] } : x)));

  const removeExercicio = (sessaoId: string, exId: string) =>
    setSessoes(s => s.map(x => (x.id === sessaoId
      ? { ...x, exercises: x.exercises.filter(e => e.id !== exId) }
      : x)));

  const mudaExercicio = (sessaoId: string, exId: string, campo: keyof ExercicioLinha, valor: any) =>
    setSessoes(s => s.map(x => (x.id === sessaoId
      ? { ...x, exercises: x.exercises.map(e => (e.id === exId ? { ...e, [campo]: valor } : e)) }
      : x)));

  /** Ao escolher um exercício do catálogo, traz o grupo muscular junto — um campo a menos. */
  const escolheExercicio = (sessaoId: string, exId: string, nomeEscolhido: string) => {
    const achado = catalogo.find(c => c.name === nomeEscolhido);
    setSessoes(s => s.map(x => (x.id === sessaoId
      ? { ...x, exercises: x.exercises.map(e => (e.id === exId ? {
          ...e,
          name: nomeEscolhido,
          exerciseId: achado?.id ?? '',
          muscleGroup: achado?.muscle_group ?? e.muscleGroup,
        } : e)) }
      : x)));
  };

  // ---- gerar com IA como ponto de partida ----

  const gerarComIA = async () => {
    if (!alunoId) { toast.erro('Escolha o aluno primeiro.'); return; }
    setGerando(true);
    try {
      const res = await fetch('/api/treino', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // profile.id manda a rota gerar PARA este aluno: ela lê a anamnese, o histórico e o
        // nível dele do banco, e confere no servidor que quem pede é master.
        body: JSON.stringify({
          profile: {
            id: alunoId,
            name: alunoEscolhido?.name || 'Aluno',
            level: config.level,
            goal: config.goal,
          },
          config: {
            ...config,
            priorities: [],
            limitations: '',
            trainingMethod: 'tradicional',
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Não consegui gerar.');

      setSessoes((data.sessions || []).map((s: any, i: number) => ({
        id: crypto.randomUUID(),
        name: s.name || `Treino ${String.fromCharCode(65 + i)}`,
        exercises: (s.exercises || []).map((e: any) => ({
          id: crypto.randomUUID(),
          exerciseId: catalogo.find(c => c.name === e.name)?.id ?? '',
          name: e.name ?? '',
          muscleGroup: e.muscleGroup ?? '',
          sets: Number(e.sets) || 3,
          reps: String(e.reps || '8-12'),
          restSeconds: Number(e.restSeconds) || 60,
          tips: String(e.tips || ''),
        })),
      })));
      if (!nome) setNome(`Treino de ${alunoEscolhido?.name || 'aluno'}`);
      toast.sucesso('Plano gerado. Agora é só ajustar o que você mudaria.');
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : 'Não consegui gerar.');
    } finally {
      setGerando(false);
    }
  };

  // ---- salvar ----

  const salvar = async () => {
    if (!alunoId) { toast.erro('Escolha o aluno.'); return; }
    if (!nome.trim()) { toast.erro('Dê um nome ao treino.'); return; }
    const semExercicio = sessoes.filter(s => s.exercises.every(e => !e.name.trim()));
    if (sessoes.length === 0 || semExercicio.length === sessoes.length) {
      toast.erro('Adicione ao menos um exercício.'); return;
    }

    setSalvando(true);
    try {
      const res = await fetch('/api/admin/plano', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: alunoId,
          name: nome,
          split: `${sessoes.length} dias`,
          sessions: sessoes.map(s => ({
            ...s,
            exercises: s.exercises.filter(e => e.name.trim()),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Não consegui salvar.');
      toast.sucesso(`Treino salvo na conta de ${alunoEscolhido?.name || 'aluno'} (${data.dias} dias).`);
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : 'Não consegui salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const totalExercicios = useMemo(
    () => sessoes.reduce((n, s) => n + s.exercises.filter(e => e.name.trim()).length, 0),
    [sessoes]
  );

  if (!ehMaster || carregando) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>;
  }

  return (
    <div className={`${PADDING_TELA} ${LARGURA_CONTEUDO} mx-auto animate-fade-in ${RODAPE_SEGURO}`}>
      <header className="mb-6">
        <h1 className="text-3xl md:text-4xl font-outfit font-bold">Montar treino</h1>
        <p className="text-sm text-foreground-muted mt-1">
          Para entregar o Treino do Personal. O treino vai direto para a conta do aluno.
        </p>
      </header>

      {/* Aluno e nome */}
      <Card className="mb-5">
        <CardContent className="p-5 grid md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="aluno" className="text-sm font-semibold">Para quem é</label>
            <select
              id="aluno"
              value={alunoId}
              onChange={e => setAlunoId(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl p-3 text-sm focus:outline-none focus:border-primary/50"
            >
              <option value="">Escolha o aluno…</option>
              {alunos.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name || 'Sem nome'}{a.role === 'master' ? ' (master)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="nomeplano" className="text-sm font-semibold">Nome do treino</label>
            <Input id="nomeplano" value={nome} onChange={e => setNome(e.target.value)}
              placeholder="Ex: Hipertrofia — outubro" maxLength={120} />
          </div>
        </CardContent>
      </Card>

      {/* A anamnese do aluno, na tela.
          Antes disto o montador gerava com tudo chumbado no código: sempre "Academia
          completa", sempre Hipertrofia, sempre Intermediário. Como a rota decide casa x
          academia pelo que o corpo da requisição manda, um treino montado para quem treina na
          sala saía com leg press — e não havia como perceber, porque a anamnese não aparecia
          em lugar nenhum. Agora aparece, e é ela que pré-preenche a geração. */}
      {alunoId && carregandoAluno && (
        <Card className="mb-5">
          <CardContent className="p-5 flex items-center gap-2 text-sm text-foreground-muted">
            <Loader2 className="w-4 h-4 animate-spin" /> Buscando a anamnese do aluno…
          </CardContent>
        </Card>
      )}

      {alunoId && !carregandoAluno && resumo && (
        <Card className="mb-5">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <p className="font-outfit font-bold">O que {alunoEscolhido?.name || 'o aluno'} respondeu</p>
              {!temAnamnese && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-warning/15 text-warning font-semibold">
                  Sem anamnese
                </span>
              )}
            </div>

            {!temAnamnese ? (
              <p className="text-sm text-foreground-muted">
                Este aluno ainda não preencheu a anamnese. Os campos abaixo vieram do perfil dele
                e valem como chute — confirme com ele antes de entregar, principalmente o local
                de treino e as lesões.
              </p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
                {([
                  ['Local de treino', resumo.local],
                  ['Tem em casa', resumo.equipamentosCasa.length > 0 ? resumo.equipamentosCasa.join(', ') : (resumo.local === 'Em casa' ? 'Nada marcado — só peso do corpo' : null)],
                  ['Objetivo', resumo.objetivo],
                  ['Nível', resumo.nivel],
                  ['Frequência atual', resumo.frequencia],
                  ['Tempo por sessão', resumo.tempoSessao],
                  ['Dias possíveis', resumo.dias],
                  ['Liberação médica', resumo.liberacao],
                ] as [string, string | null][])
                  .filter(([, v]) => v)
                  .map(([rotulo, valor]) => (
                    <div key={rotulo} className="flex justify-between gap-3 border-b border-border/50 pb-1.5">
                      <span className="text-foreground-muted shrink-0">{rotulo}</span>
                      <span className="text-right">{valor}</span>
                    </div>
                  ))}
              </div>
            )}

            {/* Saúde separada e em destaque: é o que não pode passar batido na hora de montar. */}
            {(resumo.lesoes || resumo.condicoes) && (
              <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 text-sm space-y-1.5">
                {resumo.lesoes && (
                  <p><AlertTriangle className="w-4 h-4 inline mr-1.5 text-destructive" /><strong>Lesões:</strong> {resumo.lesoes}</p>
                )}
                {resumo.condicoes && (
                  <p className="pl-[22px]"><strong>Condições:</strong> {resumo.condicoes}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Ponto de partida. Gerar vem primeiro de propósito — ver comentário do componente. */}
      {sessoes.length === 0 && (
        <Card className="mb-5 border-primary/30">
          <CardContent className="p-6 flex flex-col gap-4">
            <div>
              <p className="font-outfit font-bold mb-1">Por onde começar</p>
              <p className="text-sm text-foreground-muted">
                Gerar com IA traz um plano que já respeita a anamnese, o nível e a academia do aluno.
                Aí você ajusta o que mudaria — leva uns 10 minutos, contra 40 montando do zero.
              </p>
            </div>

            {/* Editáveis de propósito: o aluno às vezes te conta por WhatsApp algo que não
                está na anamnese ("essa semana vou viajar e treinar no hotel"). O padrão é o
                que ele respondeu; a palavra final é sua. */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="g-local" className="text-xs font-semibold text-foreground-muted">Onde vai treinar</label>
                <select id="g-local" value={config.equipment}
                  onChange={e => setConfig({ ...config, equipment: e.target.value })}
                  className="w-full bg-surface border border-border rounded-xl p-2.5 text-sm focus:outline-none focus:border-primary/50">
                  <option>Academia completa</option>
                  <option>Em casa</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="g-objetivo" className="text-xs font-semibold text-foreground-muted">Objetivo</label>
                <select id="g-objetivo" value={config.goal}
                  onChange={e => setConfig({ ...config, goal: e.target.value })}
                  className="w-full bg-surface border border-border rounded-xl p-2.5 text-sm focus:outline-none focus:border-primary/50">
                  <option>Hipertrofia</option>
                  <option>Emagrecimento</option>
                  <option>Performance</option>
                  <option>Saúde geral</option>
                  <option>Definição muscular</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="g-nivel" className="text-xs font-semibold text-foreground-muted">Nível</label>
                <select id="g-nivel" value={config.level}
                  onChange={e => setConfig({ ...config, level: e.target.value })}
                  className="w-full bg-surface border border-border rounded-xl p-2.5 text-sm focus:outline-none focus:border-primary/50">
                  <option>Iniciante</option>
                  <option>Intermediário</option>
                  <option>Avançado</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="g-dias" className="text-xs font-semibold text-foreground-muted">Dias por semana</label>
                <select id="g-dias" value={config.daysPerWeek}
                  onChange={e => setConfig({ ...config, daysPerWeek: Number(e.target.value) })}
                  className="w-full bg-surface border border-border rounded-xl p-2.5 text-sm focus:outline-none focus:border-primary/50">
                  {[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={gerarComIA} disabled={gerando || !alunoId} className="flex-1">
                {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4" /> Gerar com IA e ajustar</>}
              </Button>
              <Button variant="outline" onClick={addSessao} className="flex-1">
                <Plus className="w-4 h-4" /> Começar do zero
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sessões */}
      <div className="flex flex-col gap-4">
        {sessoes.map((sessao, si) => (
          <Card key={sessao.id}>
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <GripVertical className="w-4 h-4 text-foreground-muted flex-none" />
                <Input
                  value={sessao.name}
                  onChange={e => mudaSessao(sessao.id, 'name', e.target.value)}
                  className="font-outfit font-bold"
                  maxLength={80}
                  aria-label={`Nome do dia ${si + 1}`}
                />
                <button
                  onClick={() => removeSessao(sessao.id)}
                  aria-label={`Remover ${sessao.name}`}
                  className="p-2 text-foreground-muted hover:text-destructive transition-colors flex-none"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-col gap-2">
                {sessao.exercises.map(ex => (
                  <div key={ex.id} className="grid grid-cols-12 gap-2 items-start bg-surface/60 rounded-xl p-2.5 border border-border">
                    <div className="col-span-12 md:col-span-5 flex flex-col gap-1">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none" />
                        <input
                          list="catalogo-exercicios"
                          value={ex.name}
                          onChange={e => escolheExercicio(sessao.id, ex.id, e.target.value)}
                          placeholder="Digite para buscar no catálogo…"
                          className="w-full bg-black/30 border border-border rounded-lg py-2 pl-9 pr-3 text-sm focus:outline-none focus:border-primary/50"
                        />
                      </div>
                      {ex.muscleGroup && (
                        <span className="text-[11px] text-foreground-muted pl-1">{ex.muscleGroup}</span>
                      )}
                    </div>

                    <div className="col-span-3 md:col-span-2 flex flex-col gap-1">
                      <label className="text-[10px] uppercase tracking-wider text-foreground-muted pl-1">Séries</label>
                      <input type="number" min={1} max={10} value={ex.sets}
                        onChange={e => mudaExercicio(sessao.id, ex.id, 'sets', Number(e.target.value))}
                        className="w-full bg-black/30 border border-border rounded-lg py-2 px-2 text-sm text-center tabular-nums focus:outline-none focus:border-primary/50" />
                    </div>

                    <div className="col-span-4 md:col-span-2 flex flex-col gap-1">
                      <label className="text-[10px] uppercase tracking-wider text-foreground-muted pl-1">Reps</label>
                      <input value={ex.reps} maxLength={20}
                        onChange={e => mudaExercicio(sessao.id, ex.id, 'reps', e.target.value)}
                        className="w-full bg-black/30 border border-border rounded-lg py-2 px-2 text-sm text-center focus:outline-none focus:border-primary/50" />
                    </div>

                    <div className="col-span-4 md:col-span-2 flex flex-col gap-1">
                      <label className="text-[10px] uppercase tracking-wider text-foreground-muted pl-1">Desc. (s)</label>
                      <input type="number" min={0} max={600} step={15} value={ex.restSeconds}
                        onChange={e => mudaExercicio(sessao.id, ex.id, 'restSeconds', Number(e.target.value))}
                        className="w-full bg-black/30 border border-border rounded-lg py-2 px-2 text-sm text-center tabular-nums focus:outline-none focus:border-primary/50" />
                    </div>

                    <div className="col-span-1 flex items-end justify-center h-full pb-1">
                      <button
                        onClick={() => removeExercicio(sessao.id, ex.id)}
                        aria-label={`Remover ${ex.name || 'exercício'}`}
                        className="p-1.5 text-foreground-muted hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="col-span-12">
                      <input
                        value={ex.tips}
                        onChange={e => mudaExercicio(sessao.id, ex.id, 'tips', e.target.value)}
                        placeholder="Observação para o aluno (opcional) — ex: controle a descida em 3 segundos"
                        maxLength={500}
                        className="w-full bg-transparent border-0 border-t border-border/60 rounded-none pt-2 px-1 text-xs text-foreground-muted focus:outline-none focus:text-foreground"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => addExercicio(sessao.id)}
                className="mt-3 text-sm font-semibold text-primary hover:text-primary-hover transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Adicionar exercício
              </button>
            </CardContent>
          </Card>
        ))}
      </div>

      {sessoes.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mt-5">
          <Button variant="outline" onClick={addSessao} className="sm:w-auto">
            <Plus className="w-4 h-4" /> Adicionar dia
          </Button>
          <div className="flex-1" />
          <Button onClick={salvar} disabled={salvando} className="sm:w-auto">
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Salvar na conta do aluno</>}
          </Button>
        </div>
      )}

      {sessoes.length > 0 && (
        <p className="text-xs text-foreground-muted mt-4 text-center">
          {sessoes.length} {sessoes.length === 1 ? 'dia' : 'dias'} · {totalExercicios} exercícios ·
          {alunoEscolhido ? ` vai para ${alunoEscolhido.name || 'o aluno'}` : ' escolha o aluno acima'}
        </p>
      )}

      {/* Um datalist só, compartilhado por todas as linhas: 882 opções repetidas por linha
          deixariam a tela pesada sem necessidade. */}
      <datalist id="catalogo-exercicios">
        {catalogo.map(c => <option key={c.id} value={c.name} />)}
      </datalist>
    </div>
  );
}
