"use client";

import { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '@/app/context/AppContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TrendingUp, TrendingDown, Scale, Trophy, Plus, ChevronDown, History, Flame, Star, CheckCircle2, Lightbulb, Trash2 } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ChartSkeleton } from '@/components/charts/ChartSkeleton';
import { PADDING_TELA, LARGURA_CONTEUDO, RODAPE_SEGURO } from '@/lib/layout';
import { contarSeriesNoVolume } from '@/lib/protocoloDeMetodo';
import { EmptyState } from '@/components/ui/EmptyState';
import { Rotulo } from '@/components/ui/Rotulo';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { diasSeguidos } from '@/lib/sequenciaDeTreinos';
import { WorkoutPlan } from '@/lib/types';

// recharts (~100 kB) sai do bundle inicial da rota. Os três gráficos vêm do mesmo módulo, então
// compartilham um único chunk em vez de baixar a biblioteca três vezes.
// ssr:false porque o recharts mede o container, o que não existe no servidor.
// As opções precisam ser objeto literal em cada chamada: o plugin do Next lê isso em tempo de
// compilação e recusa uma variável compartilhada.
const WeightChart = dynamic(
  () => import('@/components/charts/ProgressCharts').then(m => m.WeightChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
const MuscleVolumeChart = dynamic(
  () => import('@/components/charts/ProgressCharts').then(m => m.MuscleVolumeChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
const ExerciseEvolutionChart = dynamic(
  () => import('@/components/charts/ProgressCharts').then(m => m.ExerciseEvolutionChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

export default function ProgressPage() {
  const { profile, bodyWeightHistory, addBodyWeight, history, workoutPlans, activePlanId, deleteWorkoutPlan } = useAppContext();
  const confirmar = useConfirm();
  const [newWeight, setNewWeight] = useState('');
  const [isAddingWeight, setIsAddingWeight] = useState(false);
  // FEATURE: Seleção de exercício para gráfico de evolução
  const [selectedExercise, setSelectedExercise] = useState<string>('');

  /**
   * OS NÚMEROS QUE SAÍRAM DO PAINEL, EM 29/10/2026.
   *
   * O painel empilhava oito blocos e isso era o "desorganizado" da reclamação: nas
   * referências cada tela faz uma coisa. Quatro desceram para cá — semana, recuperação,
   * conquistas e plano — porque esta já é a aba onde o aluno procura número.
   *
   * O relógio é lido a cada render, e não guardado em estado com timer como no painel. Lá o
   * relógio congelava porque a tela fica aberta em segundo plano o dia inteiro; aqui o aluno
   * entra de propósito, olha e sai.
   */
  const agora = Date.now();
  const activePlan = workoutPlans.find(p => p.id === activePlanId) ?? null;

  const currentWeekWorkouts = history.filter(h => {
    const hoje = new Date(agora);
    const diaDoTreino = new Date(h.date);
    const diffDays = Math.ceil(Math.abs(hoje.getTime() - diaDoTreino.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 7;
  });
  const totalVolume = currentWeekWorkouts.reduce((sum, h) => sum + h.totalVolume, 0);
  const streak = diasSeguidos(history, agora);
  const metaSemanal = activePlan?.sessions.length ?? 0;

  const achievements = (() => {
    const list = [];
    if (history.length >= 1) list.push({ icon: <CheckCircle2 className="w-5 h-5 text-success"/>, title: "Primeiro Passo", desc: "Completou seu 1º treino!" });
    if (streak >= 3) list.push({ icon: <Flame className="w-5 h-5 text-flame"/>, title: "No Ritmo", desc: "3 dias seguidos treinando!" });
    if (history.length >= 10) list.push({ icon: <Star className="w-5 h-5 text-warning"/>, title: "Dedicado", desc: "10 treinos concluídos" });

    const totalVol = history.reduce((acc, h) => acc + h.totalVolume, 0);
    if (totalVol >= 10000) list.push({ icon: <Trophy className="w-5 h-5 text-info"/>, title: "Monstro", desc: "10 Toneladas levantadas" });

    return list.slice(0, 3); // Mostra os 3 mais relevantes (primeiros da fila)
  })();

  const [dailyTip, setDailyTip] = useState<string>('Carregando dica do dia...');

  useEffect(() => {
    const fetchTip = async () => {
      const today = new Date().toDateString();
      const savedTip = localStorage.getItem('dailyTip');
      const savedDate = localStorage.getItem('dailyTipDate');

      if (savedTip && savedDate === today) {
        setDailyTip(savedTip);
        return;
      }

      try {
        const res = await fetch('/api/daily-tip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: profile?.geminiApiKey, profile }),
        });
        const data = await res.json();
        if (data.tip) {
          setDailyTip(data.tip);
          localStorage.setItem('dailyTip', data.tip);
          localStorage.setItem('dailyTipDate', today);
        }
      } catch {
        setDailyTip('Mantenha a constância. A hidratação e um bom descanso são tão importantes quanto o treino.');
      }
    };

    if (profile) fetchTip();
  }, [profile]);

  /** Apagar o plano, com a mesma confirmação e as mesmas perdas listadas de antes. */
  const apagarPlano = async (plano: WorkoutPlan) => {
    const ok = await confirmar({
      titulo: 'Excluir este plano?',
      mensagem: `O plano "${plano.name}" será apagado da sua conta.`,
      perdas: [
        `As ${plano.sessions.length} sessões montadas neste plano`,
        'A periodização em andamento (semana e ciclo atuais)',
      ],
      textoConfirmar: 'Excluir plano',
    });
    if (ok) deleteWorkoutPlan(plano.id);
  };

  const handleAddWeight = async (e: React.FormEvent) => {
    e.preventDefault();
    const weight = parseFloat(newWeight);
    if (!isNaN(weight) && weight > 20 && weight < 300) {
      await addBodyWeight(weight);
      setNewWeight('');
      setIsAddingWeight(false);
    }
  };

  // --- Weight Graph Data ---
  const weightData = useMemo(() => {
    // Pegar o histórico, ou pelo menos o peso inicial se vazio
    let data = [...bodyWeightHistory].sort((a, b) => a.date - b.date).map(w => ({
      dateStr: new Date(w.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      weight: w.weight
    }));
    
    // Fallback para o peso do perfil se estiver vazio
    if (data.length === 0 && profile) {
      data = [{ dateStr: 'Início', weight: profile.weight }];
    }
    
    return data;
  }, [bodyWeightHistory, profile]);

  const currentWeight = weightData.length > 0 ? weightData[weightData.length - 1].weight : (profile?.weight || 0);
  const firstWeight = weightData.length > 0 ? weightData[0].weight : (profile?.weight || 0);
  const weightDiff = currentWeight - firstWeight;

  // --- Personal Records (PRs) ---
  const prs = useMemo(() => {
    const records: Record<string, { weight: number, reps: number, date: number }> = {};
    
    history.forEach(session => {
      session.exercises.forEach(ex => {
        ex.sets.forEach((set) => {
          if (!set.completed) return;
          const weight = set.weight || 0;
          const reps = set.reps || 0;
          
          if (weight > 0) {
            const currentRecord = records[ex.name];
            if (!currentRecord || weight > currentRecord.weight || (weight === currentRecord.weight && reps > currentRecord.reps)) {
              records[ex.name] = { weight, reps, date: session.date };
            }
          }
        });
      });
    });

    // Ordenar pelos PRs mais recentes (ou maiores pesos absolutos)
    return Object.entries(records)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 10); // Top 10 PRs
  }, [history]);

  // --- Weekly Volume by Muscle ---
  const muscleVolume = useMemo(() => {
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const recentHistory = history.filter(h => h.date >= oneWeekAgo);
    
    const volume: Record<string, number> = {
      'Peito': 0, 'Costas': 0, 'Ombro': 0, 'Bíceps': 0, 
      'Tríceps': 0, 'Pernas': 0, 'Glúteos': 0, 'Abdômen': 0
    };

    recentHistory.forEach(session => {
      session.exercises.forEach(ex => {
        // Retomada de rest-pause não soma série: é continuação da mesma (lib/protocoloDeMetodo.ts).
        const completedSets = contarSeriesNoVolume(ex.sets);
        if (completedSets > 0) {
          // Simplificação: tentamos encaixar o músculo numa das chaves
          const m = ex.muscleGroup || 'Geral';
          const match = Object.keys(volume).find(k => m.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(m.toLowerCase()));
          if (match) {
            volume[match] += completedSets;
          } else if (m.toLowerCase().includes('quad') || m.toLowerCase().includes('post')) {
            volume['Pernas'] += completedSets;
          }
        }
      });
    });

    return Object.entries(volume)
      .filter(([_, sets]) => sets > 0)
      .map(([name, sets]) => ({ name, series: sets }))
      .sort((a, b) => b.series - a.series);
  }, [history]);

  // FEATURE: Lista de exercícios únicos do histórico para o dropdown
  const exercisesInHistory = useMemo(() => {
    const names = new Set<string>();
    history.forEach(session => {
      session.exercises.forEach(ex => names.add(ex.name));
    });
    return Array.from(names).sort();
  }, [history]);

  // FEATURE: Dados do gráfico de evolução para o exercício selecionado
  const exerciseEvolutionData = useMemo(() => {
    if (!selectedExercise) return [];
    
    return [...history]
      .reverse() // ordem cronológica
      .filter(session => session.exercises.some(ex => ex.name === selectedExercise))
      .map(session => {
        const ex = session.exercises.find(e => e.name === selectedExercise)!;
        const completedSets = ex.sets.filter(s => s.completed && s.weight > 0);
        const maxWeight = completedSets.length > 0 ? Math.max(...completedSets.map(s => s.weight)) : 0;
        const totalReps = completedSets.reduce((sum, s) => sum + s.reps, 0);
        const date = new Date(session.date);
        return {
          dateStr: `${date.getDate()}/${date.getMonth() + 1}`,
          maxWeight,
          totalReps,
          volume: completedSets.reduce((sum, s) => sum + s.reps * s.weight, 0)
        };
      })
      .filter(d => d.maxWeight > 0);
  }, [history, selectedExercise]);

  // Calcula variação percentual do início ao fim
  const evolutionDiff = useMemo(() => {
    if (exerciseEvolutionData.length < 2) return null;
    const first = exerciseEvolutionData[0].maxWeight;
    const last = exerciseEvolutionData[exerciseEvolutionData.length - 1].maxWeight;
    const diff = last - first;
    const pct = ((diff / first) * 100).toFixed(1);
    return { diff, pct, isPositive: diff >= 0 };
  }, [exerciseEvolutionData]);

  if (!profile) return null;

  return (
    <div className={`${PADDING_TELA} ${LARGURA_CONTEUDO} mx-auto animate-fade-in ${RODAPE_SEGURO}`}>
      {/* O ÍCONE NUMA CAIXA COM GRADIENTE SAIU.
          Era decoração: não dizia nada que o título não dissesse, e um quadrado colorido de
          56px ao lado do texto empurrava o conteúdo para baixo em toda visita. O padrão do
          app agora é etiqueta miúda e título limpo — o mesmo da tela inicial e da de treino. */}
      <header className="mb-8">
        <p className="text-nano uppercase tracking-widest text-foreground-muted mb-2">
          Sua evolução
        </p>
        <h1 className="text-3xl md:text-4xl font-outfit font-bold tracking-tight">
          Progresso
        </h1>
        <p className="text-foreground-muted text-sm mt-2">Medidas, volume e recordes ao longo do tempo.</p>

        {/* A porta do Histórico no celular.
            `/history` só tinha link na barra lateral do desktop (`hidden md:flex`), então no
            telefone a tela existia e ninguém chegava nela. Aqui é onde o aluno procura: esta
            tela mostra medida e evolução corporal, e o Histórico mostra os treinos feitos e o
            volume — a pergunta seguinte de quem está olhando a própria evolução. */}
        <Link
          href="/history"
          className="inline-flex items-center gap-2 mt-4 text-sm font-medium text-info hover:text-info/80 bg-surface border border-border rounded-xl px-4 py-2.5 transition-colors"
        >
          <History className="w-4 h-4" />
          Ver treinos realizados
        </Link>
      </header>

      {/* A SEMANA, EM NÚMEROS GRANDES.
          Eram quatro cards de métrica com ícone colorido, moldura e valor em 20px. O ícone
          não informava nada que o rótulo já não dissesse, e a moldura competia com o treino.
          Agora o número é o elemento, e a barra mostra a semana sem precisar de outro card. */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <Rotulo as="h3">
            Esta semana
          </Rotulo>
          <Link href="/progress" className="text-xs text-foreground-muted hover:text-primary transition-colors">
            ver progresso
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-6">
          <Numero valor={currentWeekWorkouts.length.toString()} rotulo="treinos" />
          <Numero valor={totalVolume.toLocaleString('pt-BR')} unidade="kg" rotulo="levantados" />
          <Numero valor={streak.toString()} rotulo={streak === 1 ? 'dia seguido' : 'dias seguidos'} />
          <Numero valor={history.length.toString()} rotulo="no total" />
        </div>

        {/* A barra existe porque "2 treinos" sozinho não diz se é pouco ou muito. Contra a
            meta, diz. */}
        {metaSemanal > 0 && (
          <div className="mt-6">
            <div className="flex justify-between text-micro text-foreground-muted mb-2">
              <span>{currentWeekWorkouts.length} de {metaSemanal} na semana</span>
              <span className="tabular-nums">
                {Math.min(100, Math.round((currentWeekWorkouts.length / metaSemanal) * 100))}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-surface overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-secondary to-primary transition-all duration-700"
                style={{ width: `${Math.min(100, (currentWeekWorkouts.length / metaSemanal) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUNA ESQUERDA: Peso e Gráficos */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Card de Peso Corporal */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-nano uppercase tracking-widest text-foreground-muted font-semibold">Peso corporal</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setIsAddingWeight(!isAddingWeight)}>
                <Plus className="w-4 h-4 mr-1" /> Registrar
              </Button>
            </CardHeader>
            <CardContent>
              {isAddingWeight && (
                <form onSubmit={handleAddWeight} className="flex gap-2 mb-6 p-5 bg-surface rounded-xl border border-border animate-fade-in">
                  <input 
                    type="number" step="0.1"
                    placeholder="Seu peso (kg)"
                    value={newWeight}
                    onChange={e => setNewWeight(e.target.value)}
                    className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-white outline-none focus:border-primary"
                    required
                  />
                  <Button type="submit">Salvar</Button>
                </form>
              )}

              {/* O PESO É O NÚMERO DESTA TELA, e estava do tamanho de um subtítulo.
                  Quem abre Progresso quer saber um valor antes de qualquer outro. Foi para
                  60px, tabular — tabular porque o número muda de casa decimal e sem isso ele
                  dança na horizontal a cada registro. */}
              <div className="flex flex-wrap items-end gap-x-4 gap-y-2 mb-6">
                <div>
                  <p className="text-nano text-foreground-muted uppercase tracking-widest mb-1.5">
                    Peso atual
                  </p>
                  <p className="text-5xl md:text-6xl font-outfit font-bold tabular-nums leading-none">
                    {currentWeight.toFixed(1)}
                    <span className="text-xl text-foreground-muted font-medium ml-2">kg</span>
                  </p>
                </div>
                {weightDiff !== 0 && (
                  <div className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 mb-1.5 ${weightDiff > 0 ? 'bg-destructive/15 text-destructive' : 'bg-primary/15 text-primary'}`}>
                    {weightDiff > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    <span className="tabular-nums">{Math.abs(weightDiff).toFixed(1)} kg</span>
                    <span className="font-medium opacity-70">desde o início</span>
                  </div>
                )}
              </div>

              <div className="h-[240px] w-full">
                {weightData.length > 1 ? (
                  <WeightChart data={weightData} />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-foreground-muted border-2 border-dashed border-border rounded-xl">
                    <Scale className="w-8 h-8 opacity-20 mb-2" />
                    <p className="text-sm">Registre seu peso mais algumas vezes</p>
                    <p className="text-xs">para ver o gráfico de evolução.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Card de Volume por Músculo */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-nano uppercase tracking-widest text-foreground-muted font-semibold">Volume por músculo · últimos 7 dias</CardTitle>
            </CardHeader>
            <CardContent>
              {muscleVolume.length > 0 ? (
                <div className="h-[240px] w-full mt-4">
                  <MuscleVolumeChart data={muscleVolume} />
                </div>
              ) : (
                <div className="py-10 text-center text-foreground-muted">
                  Nenhum treino registrado nos últimos 7 dias.
                </div>
              )}
            </CardContent>
          </Card>

          {/* FEATURE: Gráfico de Evolução por Exercício */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-nano uppercase tracking-widest text-foreground-muted font-semibold">Evolução por exercício</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground-muted mb-4">Selecione um exercício para ver a evolução da sua carga máxima ao longo do tempo.</p>

              {exercisesInHistory.length > 0 ? (
                <>
                  {/* Dropdown de seleção */}
                  <div className="relative mb-5">
                    <select
                      value={selectedExercise}
                      onChange={e => setSelectedExercise(e.target.value)}
                      className="w-full bg-surface border border-border rounded-xl p-3 pr-10 text-white focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors appearance-none cursor-pointer"
                    >
                      <option value="">-- Selecione um exercício --</option>
                      {exercisesInHistory.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
                  </div>

                  {/* Gráfico ou placeholder */}
                  {selectedExercise && exerciseEvolutionData.length > 0 ? (
                    <>
                      {/* Resumo numérico */}
                      <div className="flex gap-4 mb-5">
                        <div className="flex-1 bg-surface rounded-xl p-3 border border-border text-center">
                          <p className="text-nano text-foreground-muted uppercase tracking-wider font-bold mb-1">Máx. Atual</p>
                          <p className="text-2xl font-mono font-bold text-secondary">{exerciseEvolutionData[exerciseEvolutionData.length - 1].maxWeight}<span className="text-sm text-foreground-muted ml-1">kg</span></p>
                        </div>
                        <div className="flex-1 bg-surface rounded-xl p-3 border border-border text-center">
                          <p className="text-nano text-foreground-muted uppercase tracking-wider font-bold mb-1">Início</p>
                          <p className="text-2xl font-mono font-bold text-white">{exerciseEvolutionData[0].maxWeight}<span className="text-sm text-foreground-muted ml-1">kg</span></p>
                        </div>
                        {evolutionDiff && (
                          <div className="flex-1 bg-surface rounded-xl p-3 border border-border text-center">
                            <p className="text-nano text-foreground-muted uppercase tracking-wider font-bold mb-1">Evolução</p>
                            <p className={`text-2xl font-mono font-bold ${evolutionDiff.isPositive ? 'text-primary' : 'text-destructive'}`}>
                              {evolutionDiff.isPositive ? '+' : ''}{evolutionDiff.pct}%
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Gráfico de linha */}
                      <div className="h-[260px] w-full">
                        <ExerciseEvolutionChart data={exerciseEvolutionData} />
                      </div>
                    </>
                  ) : selectedExercise ? (
                    <div className="py-10 text-center text-foreground-muted text-sm">
                      Nenhuma sessão registrada com carga para este exercício.
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="py-10 text-center text-foreground-muted text-sm">
                  Complete treinos registrando cargas para ver sua evolução.
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        {/* COLUNA DIREITA: PRs */}
        <div className="space-y-6">
          <Card className="h-full">
            <CardHeader className="pb-4 border-b border-border">
              <CardTitle className="text-nano uppercase tracking-widest text-foreground-muted font-semibold">Recordes pessoais</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {prs.length > 0 ? (
                <div className="space-y-4">
                  {prs.map((pr, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-surface rounded-xl border border-border group hover:border-gold/30 transition-colors">
                      <div className="flex-1 min-w-0 pr-3">
                        <p className="text-white font-bold text-sm truncate">{pr.name}</p>
                        <p className="text-xs text-foreground-muted mt-0.5">{new Date(pr.date).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono font-bold text-gold text-lg leading-none">{pr.weight} <span className="text-xs text-gold/70 font-sans">kg</span></p>
                        <p className="text-xs font-mono text-foreground-muted mt-1">{pr.reps} reps</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  semCard
                  icone={<Trophy className="w-12 h-12" />}
                  titulo="Nenhum recorde ainda"
                  descricao="Registre a carga de cada série durante o treino. O maior peso de cada exercício vira um recorde aqui."
                />
              )}
            </CardContent>
          </Card>
        </div>

      </div>

      {/* RECUPERAÇÃO MUSCULAR, em faixa.
          Eram seis cards quadrados numa grade. A informação é um estado por músculo — um
          ponto colorido e um nome bastam, e numa linha dá para ler os seis de uma vez. */}
      <section className="mb-8">
        <Rotulo as="h3" className="mb-4">
          Recuperação muscular
        </Rotulo>
        <div className="flex gap-2 overflow-x-auto barra-fina pb-2 -mx-1 px-1">
          {['Peito', 'Costas', 'Ombro', 'Bíceps', 'Tríceps', 'Pernas (quadríceps)'].map((muscle) => {
            const latestWorkout = [...history].sort((a, b) => b.date - a.date).find(h =>
              h.exercises.some(ex => ex.muscleGroup === muscle)
            );

            let statusColor = 'bg-success';
            let label = 'Recuperado';

            if (latestWorkout) {
              const diffHours = (agora - latestWorkout.date) / (1000 * 60 * 60);
              if (diffHours < 24) {
                statusColor = 'bg-destructive';
                label = 'Em fadiga';
              } else if (diffHours < 48) {
                statusColor = 'bg-warning';
                label = 'Recuperando';
              }
            }

            return (
              <div
                key={muscle}
                className="flex items-center gap-2.5 px-3 py-2 rounded-full bg-surface border border-border shrink-0"
              >
                <span className={`w-2 h-2 rounded-full ${statusColor}`} aria-hidden="true" />
                <span className="text-sm whitespace-nowrap">
                  {muscle === 'Pernas (quadríceps)' ? 'Pernas' : muscle}
                </span>
                <span className="text-micro text-foreground-muted whitespace-nowrap">{label}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* CONQUISTAS E DICA, abaixo da dobra.
          Estavam no topo, dividindo a primeira tela com o treino. Nenhum dos dois é motivo
          de alguém abrir o app — são recompensa e leitura, e ficam onde se lê depois. */}
      <section className="grid md:grid-cols-2 gap-5 mb-8">
        <div>
          <Rotulo as="h3" className="mb-4">
            Suas conquistas
          </Rotulo>
          {achievements.length > 0 ? (
            <div className="flex flex-col gap-2">
              {achievements.map((ach, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-surface border border-border">
                  <span className="shrink-0">{ach.icon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{ach.title}</p>
                    <p className="text-xs text-foreground-muted truncate">{ach.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-foreground-muted">
              Conclua o primeiro treino para desbloquear.
            </p>
          )}
        </div>

        <div>
          <Rotulo as="h3" className="mb-4">
            Dica do dia
          </Rotulo>
          <div className="flex items-start gap-3 p-5 rounded-xl bg-primary/5 border border-primary/15">
            <Lightbulb className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <p className="text-sm leading-relaxed text-foreground/90">{dailyTip}</p>
          </div>
        </div>
      </section>

      {/* O PLANO NA CONTA.
          Um só, de propósito: o aluno enxerga o ativo e nada mais. Quem troca é o
          profissional, pelo /admin/preview. */}
      {activePlan && (
        <section>
          <Rotulo as="h3" className="mb-4">
            Seu plano
          </Rotulo>
          <div className="flex flex-wrap items-center gap-4 p-5 rounded-xl bg-surface border border-border">
            <div className="min-w-0 flex-1">
              <p className="font-outfit font-bold truncate">{activePlan.name}</p>
              <p className="text-xs text-foreground-muted mt-0.5">
                {activePlan.split || `${activePlan.sessions.length} dias`} ·{' '}
                {activePlan.sessions.length} {activePlan.sessions.length === 1 ? 'treino' : 'treinos'}
              </p>
            </div>
            <button
              onClick={() => apagarPlano(activePlan)}
              className="p-3 rounded-lg text-foreground-muted hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
              aria-label={`Apagar ${activePlan.name}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </section>
      )}
    </div>
  );
}


/**
 * Um número da semana.
 *
 * Sem ícone e sem moldura, de propósito: o ícone colorido que havia antes não dizia nada que
 * o rótulo já não dissesse, e seis molduras numa faixa cancelam uma à outra. O que informa é
 * o número, então é ele que fica grande.
 */
function Numero({ valor, unidade, rotulo }: { valor: string; unidade?: string; rotulo: string }) {
  return (
    <div>
      <p className="text-2xl md:text-3xl font-outfit font-bold tabular-nums leading-none">
        {valor}
        {unidade && <span className="text-base font-medium text-foreground-muted ml-1">{unidade}</span>}
      </p>
      <p className="text-nano font-semibold uppercase tracking-widest text-foreground-muted mt-1.5">{rotulo}</p>
    </div>
  );
}
