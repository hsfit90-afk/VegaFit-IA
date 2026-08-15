"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '@/app/context/AppContext';
import { Dumbbell, Flame, Trophy, Calendar, Lightbulb, ChevronRight, Activity, Zap, Star, LayoutList, Trash2, CheckCircle2, PlayCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { motion } from 'motion/react';
import { WorkoutPlan } from '@/lib/types';

export default function Dashboard() {
  const { profile, history, workoutPlans, activePlanId, setActivePlan, deleteWorkoutPlan, currentSessionIndex } = useAppContext();
  const router = useRouter();
  const [dailyTip, setDailyTip] = useState<string>('Carregando dica do dia...');
  const [manualSessionIndex, setManualSessionIndex] = useState<number | null>(null);
  
  // Resolve o bug do "tempo congelado" quando o app fica aberto em background
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setNow(Date.now());
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);
    const interval = setInterval(() => setNow(Date.now()), 60000); // Atualiza a cada 1 minuto
    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, []);

  // Métricas
  const currentWeekWorkouts = history.filter(h => {
    const today = new Date(now);
    const workoutDate = new Date(h.date);
    const diffDays = Math.ceil(Math.abs(today.getTime() - workoutDate.getTime()) / (1000 * 60 * 60 * 24)); 
    return diffDays <= 7;
  });

  const totalVolume = currentWeekWorkouts.reduce((sum, h) => sum + h.totalVolume, 0);

  // Removed strict redirect so trainers can also use their own dashboard for working out.
  // Trainers have "Meus Alunos" in the navigation if they want to manage clients.
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
    const hour = new Date(now).getHours();
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

  // --- Smart Session Suggestion (Fadiga Muscular) ---
  // Detecta músculos em fadiga (treinados nas últimas 24h)
  const fatigueMuscleSets = useMemo(() => {
    const fatigued = new Set<string>();
    const recentHistory = [...history].sort((a, b) => b.date - a.date);
    recentHistory.forEach(h => {
      const diffHours = (now - h.date) / (1000 * 60 * 60);
      if (diffHours < 24) {
        h.exercises.forEach(ex => {
          if (ex.muscleGroup) fatigued.add(ex.muscleGroup.toLowerCase());
        });
      }
    });
    return fatigued;
  }, [history, now]);

  // Encontra a próxima sessão cujos músculos estejam recuperados
  const smartSessionIndex = useMemo(() => {
    if (!activePlan || fatigueMuscleSets.size === 0) return currentSessionIndex;
    const total = activePlan.sessions.length;
    for (let i = 0; i < total; i++) {
      const idx = (currentSessionIndex + i) % total;
      const session = activePlan.sessions[idx];
      const sessionMuscles = session.exercises.map(ex => (ex.muscleGroup || '').toLowerCase());
      const hasFatigue = sessionMuscles.some(m => fatigueMuscleSets.has(m));
      if (!hasFatigue) return idx;
    }
    // Todos os treinos têm fadiga — retorna o próximo mesmo assim
    return currentSessionIndex;
  }, [activePlan, currentSessionIndex, fatigueMuscleSets]);

  const displaySessionIndex = manualSessionIndex !== null ? manualSessionIndex : smartSessionIndex;

  const suggestedSession = activePlan?.sessions[displaySessionIndex % (activePlan?.sessions.length || 1)];
  const originalSession = activePlan?.sessions[currentSessionIndex % (activePlan?.sessions.length || 1)];
  const wasRedirectedDueToFatigue = manualSessionIndex === null && smartSessionIndex !== currentSessionIndex;

  const cycleNextSession = () => {
    if (!activePlan) return;
    const nextIdx = (displaySessionIndex + 1) % activePlan.sessions.length;
    setManualSessionIndex(nextIdx);
  };

  // Próximo treino com músculos recuperados (pula o smartSessionIndex atual)
  const nextSmartSessionIndex = useMemo(() => {
    if (!activePlan) return (smartSessionIndex + 1) % (activePlan?.sessions.length || 1);
    const total = activePlan.sessions.length;
    for (let i = 1; i <= total; i++) {
      const idx = (smartSessionIndex + i) % total;
      const session = activePlan.sessions[idx];
      const sessionMuscles = session.exercises.map(ex => (ex.muscleGroup || '').toLowerCase());
      const hasFatigue = sessionMuscles.some(m => fatigueMuscleSets.has(m));
      if (!hasFatigue) return idx;
    }
    // Todos têm fadiga — retorna o próximo do ciclo mesmo assim
    return (smartSessionIndex + 1) % total;
  }, [activePlan, smartSessionIndex, fatigueMuscleSets]);

  const nextSuggestedSession = activePlan?.sessions[nextSmartSessionIndex % (activePlan?.sessions.length || 1)];

  // --- Streak Logic ---
  const streak = useMemo(() => {
    if (history.length === 0) return 0;
    
    // Agrupar treinos por dia (ignorando horário)
    const uniqueDays = Array.from(new Set(
      history.map(h => new Date(h.date).setHours(0,0,0,0))
    )).sort((a, b) => b - a); // Decrescente

    let currentStreak = 0;
    const today = new Date(now).setHours(0,0,0,0);
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 mb-8">
        
        {/* CTA Treino de Hoje */}
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
                  
                  {wasRedirectedDueToFatigue && (
                    <div className="flex items-start gap-2 bg-orange-500/10 border border-orange-500/30 rounded-xl p-3 mb-3">
                      <span className="text-lg">⚠️</span>
                      <div>
                        <p className="text-orange-400 font-bold text-xs uppercase tracking-wider">Fadiga Detectada</p>
                        <p className="text-orange-300/80 text-xs mt-0.5">
                          {originalSession?.name} usa músculos em recuperação. Sugerindo sessão alternativa!
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="mb-4">
                    <p className="text-xs text-foreground-muted mb-1 uppercase tracking-wider font-semibold">
                      {wasRedirectedDueToFatigue ? '💪 Treino Alternativo' : 'Próximo Treino'}
                    </p>
                    <p className="text-lg font-bold text-white mb-3">
                      {suggestedSession?.name}
                    </p>
                    <div className="flex gap-3">
                      <div className="flex items-center gap-1.5 text-xs text-foreground-muted bg-surface/60 px-3 py-1.5 rounded-lg border border-white/5">
                        <span className="text-primary">⚡</span> {suggestedSession?.exercises?.length || 0} exercícios
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-foreground-muted bg-surface/60 px-3 py-1.5 rounded-lg border border-white/5">
                        <span className="text-primary">⏱️</span> ~{(suggestedSession?.exercises?.length || 0) * 5} min
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-foreground/70 mb-5 mt-2">Você ainda não tem um treino programado para hoje.</p>
              )}
            </div>

            <div className="relative z-10">
              {activePlan ? (
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => router.push(`/active?sessionIndex=${displaySessionIndex}`)}
                    className="block w-full"
                  >
                    <Button size="lg" className="w-full text-sm md:text-base shadow-[0_4px_20px_rgba(0,255,136,0.3)] group">
                      INICIAR TREINO
                      <ChevronRight className="w-4 h-4 md:w-5 md:h-5 ml-1 md:ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </button>
                  {activePlan.sessions.length > 1 && (
                    <button
                      onClick={cycleNextSession}
                      className="block w-full"
                      title="Ver outro treino"
                    >
                      <Button size="sm" variant="outline" className="w-full text-xs md:text-sm border-white/20 text-gray-400 hover:border-primary/40 hover:text-primary h-auto py-2">
                        <span className="truncate">Ver Próximo Treino</span>
                        <ChevronRight className="w-3 h-3 md:w-4 md:h-4 ml-1 flex-shrink-0" />
                      </Button>
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {(!profile?.trainerId || profile?.role === 'master' || profile?.role === 'trainer') ? (
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
        </motion.div>
        
        {/* Conquistas (Gamification) */}
        <motion.div variants={itemVariants} className="space-y-6">
          <Card className="h-full">
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
            {(!profile?.trainerId || profile?.role === 'master' || profile?.role === 'trainer') ? (
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
                  
                  <div className="flex flex-col md:flex-row items-center gap-3 mt-6">
                    <button 
                      onClick={() => {
                        if (confirm(`Deseja realmente excluir este plano?`)) {
                          deleteWorkoutPlan(activePlan.id);
                        }
                      }}
                      className="w-full md:w-auto h-12 px-6 rounded-xl bg-surface border border-white/5 text-gray-400 hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30 flex items-center justify-center gap-2 transition-all font-semibold"
                    >
                      <Trash2 className="w-4 h-4" /> Excluir Plano Atual
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
              {(!profile?.trainerId || profile?.role === 'master' || profile?.role === 'trainer') ? (
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
              const diffHours = (now - latestWorkout.date) / (1000 * 60 * 60);
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
              <Card key={muscle} variant="neon-hover" className="bg-surface/50 cursor-pointer">
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
    <Card variant="neon-hover" className="group cursor-pointer">
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
