"use client";

import { useState, useMemo } from 'react';
import { useAppContext } from '@/app/context/AppContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TrendingUp, Scale, Trophy, Activity, Plus, BarChart2, ChevronDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, ReferenceLine } from 'recharts';

export default function ProgressPage() {
  const { profile, bodyWeightHistory, addBodyWeight, history } = useAppContext();
  const [newWeight, setNewWeight] = useState('');
  const [isAddingWeight, setIsAddingWeight] = useState(false);
  // FEATURE: Seleção de exercício para gráfico de evolução
  const [selectedExercise, setSelectedExercise] = useState<string>('');

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
        const completedSets = ex.sets.filter(s => s.completed).length;
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
    <div className="p-6 md:p-10 max-w-5xl mx-auto animate-fade-in pb-32">
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-outfit font-bold flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl backdrop-blur-md border border-border">
            <TrendingUp className="w-8 h-8 text-blue-400" />
          </div>
          Meu Progresso
        </h1>
        <p className="text-foreground-muted mt-2">Acompanhe sua evolução física e performance nos treinos.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUNA ESQUERDA: Peso e Gráficos */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Card de Peso Corporal */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xl flex items-center gap-2">
                <Scale className="w-5 h-5 text-blue-400" /> Peso Corporal
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => setIsAddingWeight(!isAddingWeight)}>
                <Plus className="w-4 h-4 mr-1" /> Registrar
              </Button>
            </CardHeader>
            <CardContent>
              {isAddingWeight && (
                <form onSubmit={handleAddWeight} className="flex gap-2 mb-6 p-4 bg-surface rounded-xl border border-border animate-fade-in">
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

              <div className="flex items-end gap-4 mb-6">
                <div>
                  <span className="text-sm text-foreground-muted font-semibold uppercase tracking-wider">Atual</span>
                  <p className="text-4xl font-mono font-bold text-white">{currentWeight.toFixed(1)} <span className="text-lg text-foreground-muted font-sans">kg</span></p>
                </div>
                {weightDiff !== 0 && (
                  <div className={`px-2 py-1 rounded-md text-sm font-bold flex items-center gap-1 mb-1 ${weightDiff > 0 ? 'bg-red-500/20 text-red-400' : 'bg-primary/20 text-primary'}`}>
                    {weightDiff > 0 ? '↗' : '↘'} {Math.abs(weightDiff).toFixed(1)} kg desde o início
                  </div>
                )}
              </div>

              <div className="h-[200px] w-full">
                {weightData.length > 1 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={weightData}>
                      <XAxis dataKey="dateStr" stroke="#4B5563" fontSize={12} tickMargin={10} minTickGap={20} />
                      <YAxis domain={['dataMin - 2', 'dataMax + 2']} stroke="#4B5563" fontSize={12} width={40} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f0f13', borderColor: '#1f2937', borderRadius: '12px' }}
                        itemStyle={{ color: '#60A5FA', fontWeight: 'bold' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="weight" 
                        stroke="#60A5FA" 
                        strokeWidth={3}
                        dot={{ r: 4, fill: '#60A5FA', strokeWidth: 0 }}
                        activeDot={{ r: 6, fill: '#3B82F6', stroke: '#1f2937', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
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
              <CardTitle className="text-xl flex items-center gap-2">
                <Activity className="w-5 h-5 text-accent" /> Volume Semanal (Últimos 7 dias)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {muscleVolume.length > 0 ? (
                <div className="h-[200px] w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={muscleVolume} layout="vertical" margin={{ top: 0, right: 0, left: 30, bottom: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" stroke="#9CA3AF" fontSize={12} axisLine={false} tickLine={false} />
                      <Tooltip 
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        contentStyle={{ backgroundColor: '#0f0f13', borderColor: '#1f2937', borderRadius: '12px' }}
                      />
                      <Bar dataKey="series" fill="#7C3AED" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
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
              <CardTitle className="text-xl flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-secondary" /> Evolução por Exercício
              </CardTitle>
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
                          <p className="text-[10px] text-foreground-muted uppercase tracking-wider font-bold mb-1">Máx. Atual</p>
                          <p className="text-2xl font-mono font-bold text-secondary">{exerciseEvolutionData[exerciseEvolutionData.length - 1].maxWeight}<span className="text-sm text-foreground-muted ml-1">kg</span></p>
                        </div>
                        <div className="flex-1 bg-surface rounded-xl p-3 border border-border text-center">
                          <p className="text-[10px] text-foreground-muted uppercase tracking-wider font-bold mb-1">Início</p>
                          <p className="text-2xl font-mono font-bold text-white">{exerciseEvolutionData[0].maxWeight}<span className="text-sm text-foreground-muted ml-1">kg</span></p>
                        </div>
                        {evolutionDiff && (
                          <div className="flex-1 bg-surface rounded-xl p-3 border border-border text-center">
                            <p className="text-[10px] text-foreground-muted uppercase tracking-wider font-bold mb-1">Evolução</p>
                            <p className={`text-2xl font-mono font-bold ${evolutionDiff.isPositive ? 'text-primary' : 'text-destructive'}`}>
                              {evolutionDiff.isPositive ? '+' : ''}{evolutionDiff.pct}%
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Gráfico de linha */}
                      <div className="h-[220px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={exerciseEvolutionData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <XAxis dataKey="dateStr" stroke="#6B7280" fontSize={11} tickLine={false} axisLine={false} />
                            <YAxis stroke="#6B7280" fontSize={11} tickLine={false} axisLine={false} domain={['dataMin - 5', 'dataMax + 5']} />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#0f0f13', borderColor: '#1f2937', borderRadius: '12px', fontSize: '12px' }}
                              formatter={(val: any) => [`${val} kg`, 'Carga Máx.']}
                            />
                            {exerciseEvolutionData.length > 0 && (
                              <ReferenceLine y={exerciseEvolutionData[0].maxWeight} stroke="#374151" strokeDasharray="4 4" />
                            )}
                            <Line
                              type="monotone"
                              dataKey="maxWeight"
                              stroke="var(--color-secondary)"
                              strokeWidth={3}
                              dot={{ r: 4, fill: 'var(--color-secondary)', strokeWidth: 0 }}
                              activeDot={{ r: 6, fill: 'var(--color-secondary)', stroke: '#1f2937', strokeWidth: 2 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
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
              <CardTitle className="text-xl flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-400" /> Recordes Pessoais
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {prs.length > 0 ? (
                <div className="space-y-4">
                  {prs.map((pr, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-surface rounded-xl border border-border group hover:border-yellow-400/30 transition-colors">
                      <div className="flex-1 min-w-0 pr-3">
                        <p className="text-white font-bold text-sm truncate">{pr.name}</p>
                        <p className="text-xs text-foreground-muted mt-0.5">{new Date(pr.date).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono font-bold text-yellow-400 text-lg leading-none">{pr.weight} <span className="text-xs text-yellow-400/70 font-sans">kg</span></p>
                        <p className="text-xs font-mono text-foreground-muted mt-1">{pr.reps} reps</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center flex flex-col items-center">
                  <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mb-3">
                    <Trophy className="w-8 h-8 text-foreground-muted opacity-30" />
                  </div>
                  <p className="text-white font-semibold">Nenhum recorde ainda</p>
                  <p className="text-sm text-foreground-muted max-w-[200px] mt-1">Conclua treinos registrando as cargas para ver seus recordes aqui.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
