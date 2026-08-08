"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '@/app/context/AppContext';
import { Dumbbell, Flame, Trophy, Calendar, Lightbulb, ChevronRight, Activity, Zap, Star, LayoutList, Trash2, CheckCircle2, PlayCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { motion } from 'motion/react';
import { WorkoutPlan } from '@/lib/types';

export default function Dashboard() {
  const { profile, history, workoutPlans, activePlanId, setActivePlan, deleteWorkoutPlan, currentSessionIndex } = useAppContext();
  const [chartPeriod, setChartPeriod] = useState<'week' | 'month' | 'total'>('week');
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
          body: JSON.stringify({
            apiKey: profile?.geminiApiKey,
            profile: profile
          })
        });
        const data = await res.json();
        if (data.tip) {
          setDailyTip(data.tip);
          localStorage.setItem('dailyTip', data.tip);
          localStorage.setItem('dailyTipDate', today);
        }
      } catch (err) {
        setDailyTip('Mantenha a constância. A hidratação e um bom descanso são tão importantes quanto o treino.');
      }
    };

    if (profile) fetchTip();
  }, [profile]);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  // --- Active Plan Logic ---
  const activePlan = useMemo(() => {
    if (!workoutPlans.length) return null;
    if (activePlanId) {
      const plan = workoutPlans.find(p => p.id === activePlanId);
      if (plan) return plan;
    }
    return workoutPlans[0];
  }, [workoutPlans, activePlanId]);

  // --- Streak Logic ---
  const streak = useMemo(() => {
    if (history.length === 0) return 0;
    
    // Agrupar treinos por dia (ignorando horário)
    const uniqueDays = Array.from(new Set(
      history.map(h => new Date(h.date).setHours(0,0,0,0))
    )).sort((a, b) => b - a); // Decrescente

    let currentStreak = 0;
    const today = new Date().setHours(0,0,0,0);
    const yesterday = today - 86400000;

    // Se o último treino não foi hoje nem ontem, streak zerou
    if (uniqueDays[0] !== today && uniqueDays[0] !== yesterday) {
      return 0;
    }

    let expectedDay = uniqueDays[0];
    for (const day of uniqueDays) {
      if (day === expectedDay) {
        currentStreak++;
        expectedDay -= 86400000; // Subtrai 1 dia em ms
      } else {
        break; // Quebrou a sequência
      }
    }

    return currentStreak;
  }, [history]);

  // --- Achievements Logic ---
  const achievements = useMemo(() => {
    const list = [];
    if (history.length >= 1) list.push({ icon: <CheckCircle2 className="w-5 h-5 text-green-400"/>, title: "Primeiro Passo", desc: "Completou seu 1º treino!" });
    if (streak >= 3) list.push({ icon: <Flame className="w-5 h-5 text-orange-400"/>, title: "No Ritmo", desc: "3 dias seguidos treinando!" });
    if (history.length >= 10) list.push({ icon: <Star className="w-5 h-5 text-yellow-400"/>, title: "Dedicado", desc: "10 treinos concluídos" });
    
    const totalVol = history.reduce((acc, h) => acc + h.totalVolume, 0);
    if (totalVol >= 10000) list.push({ icon: <Trophy className="w-5 h-5 text-blue-400"/>, title: "Monstro", desc: "10 Toneladas levantadas" });

    return list.slice(0, 3); // Mostra os 3 mais relevantes (primeiros da fila)
  }, [history, streak]);

  // --- Chart Logic ---
  const currentWeekWorkouts = history.filter(h => {
    const today = new Date();
    const workoutDate = new Date(h.date);
    const diffDays = Math.ceil(Math.abs(today.getTime() - workoutDate.getTime()) / (1000 * 60 * 60 * 24)); 
    return diffDays <= 7;
  });

  const totalVolume = currentWeekWorkouts.reduce((sum, h) => sum + h.totalVolume, 0);

  const filteredWorkoutsForChart = history.filter(h => {
    if (chartPeriod === 'total') return true;
    const today = new Date();
    const workoutDate = new Date(h.date);
    const diffDays = Math.ceil(Math.abs(today.getTime() - workoutDate.getTime()) / (1000 * 60 * 60 * 24)); 
    if (chartPeriod === 'week') return diffDays <= 7;
    if (chartPeriod === 'month') return diffDays <= 30;
    return true;
  });

  const muscleVolumeMap: Record<string, number> = {};
  filteredWorkoutsForChart.forEach(workout => {
    workout.exercises.forEach(ex => {
      ex.sets.forEach(set => {
        if (set.completed) {
          const vol = set.reps * set.weight;
          muscleVolumeMap[ex.muscleGroup] = (muscleVolumeMap[ex.muscleGroup] || 0) + vol;
        }
      });
    });
  });

  const chartData = Object.entries(muscleVolumeMap).map(([name, volume]) => ({ name, volume }));

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div 
      className="p-5 md:p-8 max-w-7xl mx-auto min-h-screen pb-32"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.header variants={itemVariants} className="mb-8 mt-2">
        <h1 className="text-3xl md:text-4xl font-outfit font-bold tracking-tight mb-1">
          {greeting()}, <span className="text-primary">{profile?.name || 'Atleta'}</span>
        </h1>
        <p className="text-foreground-muted text-sm md:text-base">Pronto para superar seus limites hoje?</p>
      </motion.header>

      {/* Dica do Dia */}
      <motion.div variants={itemVariants} className="mb-8">
        <Card variant="glass" className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 md:p-5 flex items-start gap-4">
            <div className="bg-primary/20 p-2.5 rounded-xl flex-shrink-0">
              <Lightbulb className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h4 className="text-primary font-semibold text-sm mb-1 uppercase tracking-wider">Dica do Dia</h4>
              <p className="text-foreground/90 text-sm md:text-base leading-relaxed">{dailyTip}</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Métricas Principais */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5 mb-8">
        <DashboardCard 
          title="Treinos (Semana)" 
          value={currentWeekWorkouts.length.toString()} 
          icon={Calendar} 
          color="text-blue-400" 
          bg="bg-blue-400/10"
        />
        <DashboardCard 
          title="Volume Semanal" 
          value={`${totalVolume.toLocaleString()}kg`} 
          icon={Dumbbell} 
          color="text-primary" 
          bg="bg-primary/10"
        />
        <DashboardCard 
          title="Streak Atual" 
          value={`${streak} ${streak === 1 ? 'dia' : 'dias'}`} 
          icon={Flame} 
          color="text-orange-400" 
          bg="bg-orange-400/10"
        />
        <DashboardCard 
          title="Total Treinos" 
          value={history.length.toString()} 
          icon={Trophy} 
          color="text-secondary" 
          bg="bg-secondary/10"
        />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 mb-8">
        {/* Gráfico de Volume */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                <CardTitle>Carga Total por Músculo</CardTitle>
              </div>
              <div className="flex bg-surface-light rounded-lg p-1">
                {(['week', 'month', 'total'] as const).map(period => (
                  <button 
                    key={period}
                    onClick={() => setChartPeriod(period)}
                    className={`px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider rounded-md transition-all ${chartPeriod === period ? 'bg-surface text-primary shadow-sm' : 'text-foreground-muted hover:text-foreground'}`}
                  >
                    {period === 'week' ? 'Sem' : period === 'month' ? 'Mês' : 'Tudo'}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="flex-1 pt-4">
              {chartData.length > 0 ? (
                <div className="h-[250px] md:h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" stroke="#8e8e93" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#8e8e93" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `${val/1000}k`} />
                      <Tooltip 
                        cursor={{fill: 'var(--color-surface-light)'}}
                        contentStyle={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                        itemStyle={{ color: 'var(--color-primary)' }}
                      />
                      <Bar dataKey="volume" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index % 2 === 0 ? 'var(--color-primary)' : 'var(--color-secondary)'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[250px] md:h-[300px] flex items-center justify-center text-foreground-muted flex-col gap-3">
                  <Dumbbell className="w-10 h-10 opacity-20" />
                  <p className="text-sm">Nenhum treino registrado.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* CTA Treino de Hoje e Conquistas */}
        <motion.div variants={itemVariants} className="space-y-6">
          
          {/* Box de Treino */}
          <div className="bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/30 rounded-3xl p-6 relative overflow-hidden shadow-[0_0_40px_rgba(0,255,136,0.1)]">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-primary/20 rounded-full blur-[80px] pointer-events-none" />
            
            <div className="relative z-10 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_10px_rgba(0,255,136,1)]" />
                <h4 className="text-lg font-bold text-white m-0">Plano Ativo</h4>
              </div>
              
              {activePlan ? (
                <>
                  <p className="text-xl font-bold text-primary mb-1">{activePlan.name}</p>
                  <p className="text-xs text-foreground-muted mb-4 uppercase tracking-wider font-semibold">Próximo Treino: {activePlan.sessions[currentSessionIndex % activePlan.sessions.length]?.name}</p>
                  
                  <div className="space-y-3 bg-surface/40 backdrop-blur-sm p-4 rounded-2xl border border-white/5">
                    {activePlan.sessions[currentSessionIndex % activePlan.sessions.length]?.exercises.slice(0, 3).map((ex, i) => (
                      <div key={i} className="flex justify-between items-center text-sm border-b border-white/5 last:border-0 pb-2 last:pb-0">
                        <span className="text-foreground/90 font-medium truncate pr-4">{ex.name}</span>
                        <span className="text-primary font-mono bg-primary/10 px-2 py-0.5 rounded text-xs">{ex.sets}x{ex.reps}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-foreground/70 mb-5 mt-2">Você ainda não tem um treino programado para hoje.</p>
              )}
            </div>

            <div className="relative z-10">
              {activePlan ? (
                <Link href="/active" className="block">
                  <Button size="lg" fullWidth className="group text-base shadow-[0_4px_20px_rgba(0,255,136,0.3)]">
                    INICIAR TREINO
                    <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              ) : (
                <div className="flex flex-col gap-3">
                  {!profile?.trainerId ? (
                    <>
                      <Link href="/generator" className="block">
                        <Button size="lg" fullWidth className="group text-base shadow-[0_4px_20px_rgba(0,255,136,0.3)]">
                          GERAR TREINO COM IA
                          <Zap className="w-5 h-5 ml-2 group-hover:scale-110 transition-transform" />
                        </Button>
                      </Link>
                      <Link href="/manual-workout" className="block">
                        <Button size="lg" variant="outline" fullWidth className="group text-base border-primary/50 hover:bg-primary/10">
                          CRIAR TREINO MANUALMENTE
                          <Dumbbell className="w-5 h-5 ml-2 group-hover:rotate-12 transition-transform" />
                        </Button>
                      </Link>
                    </>
                  ) : (
                    <div className="text-center p-4 bg-surface rounded-xl border border-white/5">
                      <p className="text-foreground-muted">Aguardando seu professor enviar o seu treino.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Box de Conquistas (Gamification) */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-400" /> Suas Conquistas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {achievements.length > 0 ? (
                <div className="space-y-3">
                  {achievements.map((ach, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-surface rounded-xl border border-border">
                      <div className="bg-background rounded-lg p-2 shrink-0 border border-border">{ach.icon}</div>
                      <div>
                        <p className="font-bold text-sm text-white">{ach.title}</p>
                        <p className="text-[11px] text-foreground-muted">{ach.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-sm text-foreground-muted py-6">
                  Treine para desbloquear conquistas!
                </div>
              )}
            </CardContent>
          </Card>

        </motion.div>
      </div>

      {/* Meus Planos de Treino */}
      <motion.div variants={itemVariants} className="mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 px-1 gap-3">
          <h4 className="text-lg font-bold flex items-center gap-2">
            <LayoutList className="w-5 h-5 text-primary" /> Meus Planos de Treino
          </h4>
          <div className="flex gap-2">
            {!profile?.trainerId ? (
              <>
                <Link href="/manual-workout">
                  <Button size="sm" variant="outline" className="text-xs border-primary/30 hover:bg-primary/10">
                    <Dumbbell className="w-3.5 h-3.5 mr-1.5" /> Criar Manual
                  </Button>
                </Link>
                <Link href="/generator">
                  <Button size="sm" className="text-xs shadow-[0_2px_10px_rgba(0,255,136,0.2)]">
                    <Zap className="w-3.5 h-3.5 mr-1.5" /> Gerar com IA
                  </Button>
                </Link>
              </>
            ) : (
              <span className="text-xs text-primary px-3 py-1.5 bg-primary/10 rounded-lg flex items-center gap-2 font-semibold border border-primary/20">
                <Star className="w-3.5 h-3.5" /> Acompanhamento Personalizado
              </span>
            )}
          </div>
        </div>
        
        {workoutPlans.length > 0 ? (
          <div className="w-full">
            {(() => {
              // Puxar o plano ativo, se não achar puxar o primeiro (mais recente)
              const activePlan = workoutPlans.find(p => p.id === activePlanId) || workoutPlans[0];
              return (
              <Card key={activePlan.id} className="border-primary shadow-[0_0_20px_rgba(0,255,136,0.15)] bg-surface-light relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
                
                <CardContent className="p-6 md:p-8 relative z-10">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <span className="bg-primary/20 text-primary text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full inline-block mb-3">
                        🏋️ TREINO ATUAL
                      </span>
                      <h4 className="font-outfit font-extrabold text-3xl text-white mb-1">{activePlan.name}</h4>
                      <p className="text-sm text-gray-400 font-medium">{activePlan.split} • {activePlan.sessions.length} sessões</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col md:flex-row items-center gap-3 mt-8">
                    <Link href="/active" className="w-full md:w-auto flex-1">
                      <Button size="lg" className="w-full font-bold text-base h-14 shadow-[0_2px_15px_rgba(0,255,136,0.3)]">
                        <PlayCircle className="w-6 h-6 mr-2" /> INICIAR TREINO DE HOJE
                      </Button>
                    </Link>
                    
                    <button 
                      onClick={() => {
                        if (confirm(`Deseja realmente excluir este plano?`)) {
                          deleteWorkoutPlan(activePlan.id);
                        }
                      }}
                      className="w-full md:w-auto h-14 px-6 rounded-xl bg-surface border border-white/5 text-gray-400 hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30 flex items-center justify-center gap-2 transition-all font-semibold"
                    >
                      <Trash2 className="w-4 h-4" /> Excluir
                    </button>
                  </div>
                </CardContent>
              </Card>
              );
            })()}
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center flex flex-col items-center">
              <LayoutList className="w-10 h-10 text-foreground-muted opacity-30 mb-3" />
              <p className="text-white font-medium mb-1">Nenhum plano salvo.</p>
              {!profile?.trainerId ? (
                <>
                  <p className="text-sm text-foreground-muted mb-4">Gere um treino com IA ou crie o seu próprio plano.</p>
                  <div className="flex gap-3 justify-center">
                    <Link href="/generator">
                      <Button size="sm">Com IA</Button>
                    </Link>
                    <Link href="/manual-workout">
                      <Button size="sm" variant="outline">Manual</Button>
                    </Link>
                  </div>
                </>
              ) : (
                <p className="text-sm text-foreground-muted mb-4 mt-2">
                  Você está sendo acompanhado por um treinador. Seus treinos aparecerão aqui assim que forem enviados.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </motion.div>

      {/* Recuperação Muscular */}
      <motion.div variants={itemVariants} className="mt-8">
        <h4 className="text-lg font-bold mb-4 px-1">Recuperação Muscular</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {['Peito', 'Costas', 'Ombro', 'Bíceps', 'Tríceps', 'Pernas (quadríceps)'].map((muscle) => {
            const latestWorkout = [...history].sort((a,b) => b.date - a.date).find(h => 
              h.exercises.some(ex => ex.muscleGroup === muscle)
            );
            let statusColor = 'bg-success';
            let glowColor = 'shadow-success/40';
            let label = 'Recuperado';
            
            if (latestWorkout) {
              const diffHours = (Date.now() - latestWorkout.date) / (1000 * 60 * 60);
              if (diffHours < 24) {
                statusColor = 'bg-destructive';
                glowColor = 'shadow-destructive/40';
                label = 'Em Fadiga';
              } else if (diffHours < 48) {
                statusColor = 'bg-warning';
                glowColor = 'shadow-warning/40';
                label = 'Recuperando';
              }
            }

            const displayMuscle = muscle.replace(' (quadríceps)', '');

            return (
              <Card key={muscle} className="bg-surface/50 border-white/5 hover:bg-surface transition-colors">
                <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-surface-light flex items-center justify-center">
                    <div className={`w-3.5 h-3.5 rounded-full ${statusColor} shadow-[0_0_12px] ${glowColor}`}></div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground/90">{displayMuscle}</p>
                    <p className="text-[11px] text-foreground-muted font-medium mt-0.5 uppercase tracking-wider">{label}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}

function DashboardCard({ title, value, icon: Icon, color, bg }: { title: string, value: string, icon: any, color: string, bg: string }) {
  return (
    <Card className="hover:border-primary/20 transition-colors group">
      <CardContent className="p-4 md:p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`p-2 rounded-xl ${bg}`}>
            <Icon className={`w-4 h-4 md:w-5 md:h-5 ${color}`} />
          </div>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-foreground-muted uppercase tracking-wider mb-1">{title}</p>
          <h3 className="text-xl md:text-2xl font-bold text-foreground group-hover:text-primary transition-colors">{value}</h3>
        </div>
      </CardContent>
    </Card>
  );
}
