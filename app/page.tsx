"use client";

import { useState, useEffect } from 'react';
import { useAppContext } from '@/app/context/AppContext';
import { Dumbbell, Flame, Trophy, Calendar, Lightbulb } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Link from 'next/link';

export default function Dashboard() {
  const { profile, history, workoutPlans, currentSessionIndex } = useAppContext();
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

    fetchTip();
  }, [profile]);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const currentWeekWorkouts = history.filter(h => {
    const today = new Date();
    const workoutDate = new Date(h.date);
    const diffTime = Math.abs(today.getTime() - workoutDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    return diffDays <= 7;
  });

  const totalVolume = currentWeekWorkouts.reduce((sum, h) => sum + h.totalVolume, 0);

  const filteredWorkoutsForChart = history.filter(h => {
    if (chartPeriod === 'total') return true;
    
    const today = new Date();
    const workoutDate = new Date(h.date);
    const diffTime = Math.abs(today.getTime() - workoutDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    
    if (chartPeriod === 'week') return diffDays <= 7;
    if (chartPeriod === 'month') return diffDays <= 30;
    
    return true;
  });

  // Calc volume by muscle group for chart
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

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto animate-fade-in">
      <header className="mb-10">
        <h1 className="text-4xl md:text-5xl font-outfit font-bold mb-2">
          {greeting()}, <span className="text-[#00ff88]">{profile?.name || 'Atleta'}</span>
        </h1>
        <p className="text-gray-400 text-lg">Pronto para superar seus limites hoje?</p>
      </header>

      <div className="mb-10 bg-gradient-to-r from-[#0a0a0f] to-[#12121a] border border-white/10 rounded-2xl p-5 md:p-6 flex items-start gap-4 shadow-lg">
        <div className="bg-[#00ff88]/20 p-3 rounded-full flex-shrink-0">
          <Lightbulb className="w-6 h-6 text-[#00ff88]" />
        </div>
        <div>
          <h4 className="text-[#00ff88] font-semibold mb-1">Dica do Dia</h4>
          <p className="text-gray-300 text-sm md:text-base leading-relaxed">{dailyTip}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <DashboardCard 
          title="Treinos na Semana" 
          value={currentWeekWorkouts.length.toString()} 
          icon={Calendar} 
          color="text-blue-400" 
        />
        <DashboardCard 
          title="Volume Semanal" 
          value={`${totalVolume.toLocaleString()} kg`} 
          icon={Dumbbell} 
          color="text-[#00ff88]" 
        />
        <DashboardCard 
          title="Streak Atual" 
          value={`${currentWeekWorkouts.length > 0 ? 'Ativo' : '0 dias'}`} 
          icon={Flame} 
          color="text-orange-400" 
        />
        <DashboardCard 
          title="Próximo Treino" 
          value={workoutPlans.length > 0 
            ? workoutPlans[0].sessions[currentSessionIndex % workoutPlans[0].sessions.length]?.name 
            : 'Nenhum'} 
          icon={Trophy} 
          color="text-[#7c3aed]" 
          subtitle={workoutPlans.length > 0 
            ? `Sessão ${currentSessionIndex % workoutPlans[0].sessions.length + 1} de ${workoutPlans[0].sessions.length}`
            : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white/[0.03] border border-white/[0.08] rounded-3xl p-6 backdrop-blur-md flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h4 className="m-0 text-lg font-semibold flex items-center gap-2">
              <BarChart className="w-5 h-5 text-[#00ff88]" />
              Volume por Grupo Muscular
            </h4>
            <div className="flex bg-white/5 rounded-lg p-1">
              <button 
                onClick={() => setChartPeriod('week')}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${chartPeriod === 'week' ? 'bg-white/10 text-white font-medium' : 'text-white/40 hover:text-white/70'}`}
              >
                Semana
              </button>
              <button 
                onClick={() => setChartPeriod('month')}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${chartPeriod === 'month' ? 'bg-white/10 text-white font-medium' : 'text-white/40 hover:text-white/70'}`}
              >
                Mês
              </button>
              <button 
                onClick={() => setChartPeriod('total')}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${chartPeriod === 'total' ? 'bg-white/10 text-white font-medium' : 'text-white/40 hover:text-white/70'}`}
              >
                Total
              </button>
            </div>
          </div>
          {chartData.length > 0 ? (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val/1000}k`} />
                  <Tooltip 
                    cursor={{fill: '#ffffff10'}}
                    contentStyle={{ backgroundColor: '#0a0a0f', borderColor: '#ffffff20', borderRadius: '12px', color: '#fff' }}
                  />
                  <Bar dataKey="volume" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#00ff88' : '#7c3aed'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500 flex-col gap-4">
              <Dumbbell className="w-12 h-12 opacity-20" />
              <p>Nenhum treino registrado esta semana.</p>
            </div>
          )}
        </div>

        <div className="bg-gradient-to-br from-[#00ff88]/15 to-[#7c3aed]/15 border border-[#00ff88]/20 rounded-3xl p-6 relative overflow-hidden group flex flex-col backdrop-blur-md">
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div>
              <h4 className="m-0 mb-2 text-lg font-semibold">Treino de Hoje</h4>
              {workoutPlans.length > 0 ? (
                <>
                  <p className="text-sm text-white/70 mb-5">{workoutPlans[0].sessions[0].name}</p>
                  <div className="space-y-3 mb-8">
                    {workoutPlans[0].sessions[0].exercises.slice(0, 3).map((ex, i) => (
                      <div key={i} className="flex justify-between items-center text-sm">
                        <span className="text-gray-300 truncate max-w-[150px]">{ex.name}</span>
                        <span className="text-[#00ff88] font-mono">{ex.sets}x{ex.reps}</span>
                      </div>
                    ))}
                    {workoutPlans[0].sessions[0].exercises.length > 3 && (
                      <p className="text-xs text-gray-500 italic">+ {workoutPlans[0].sessions[0].exercises.length - 3} exercícios</p>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-white/70 mb-5">Você ainda não tem um treino programado.</p>
              )}
            </div>
            {workoutPlans.length > 0 ? (
              <Link 
                href="/active"
                className="w-full block text-center bg-[#00ff88] text-black border-none py-3 px-6 rounded-xl font-bold hover:bg-[#00cc6a] transition-all"
              >
                INICIAR AGORA
              </Link>
            ) : (
              <Link 
                href="/generator"
                className="w-full block text-center bg-[#00ff88] text-black border-none py-3 px-6 rounded-xl font-bold hover:bg-[#00cc6a] transition-all"
              >
                GERAR COM IA
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 bg-white/[0.03] border border-white/[0.08] rounded-3xl p-6 backdrop-blur-md">
        <h4 className="m-0 mb-4 text-base font-semibold">Recuperação Muscular</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {['Peito', 'Costas', 'Ombro', 'Bíceps', 'Tríceps', 'Pernas (quadríceps)'].map(muscle => {
            // Find last time trained
            const latestWorkout = [...history].sort((a,b) => b.date - a.date).find(h => 
              h.exercises.some(ex => ex.muscleGroup === muscle)
            );
            let statusColor = 'bg-[#00ff88]';
            let label = 'Recuperado';
            
            if (latestWorkout) {
              const diffHours = (Date.now() - latestWorkout.date) / (1000 * 60 * 60);
              if (diffHours < 24) {
                statusColor = 'bg-red-500';
                label = 'Em Fadiga';
              } else if (diffHours < 48) {
                statusColor = 'bg-yellow-400';
                label = 'Recuperando';
              }
            }

            return (
              <div key={muscle} className="bg-white/5 p-4 rounded-2xl flex flex-col items-center justify-center text-center gap-2">
                <div className="w-10 h-10 rounded-full bg-[#0a0a0f] flex items-center justify-center border border-white/10">
                  <div className={`w-4 h-4 rounded-full ${statusColor} shadow-[0_0_10px] shadow-current`}></div>
                </div>
                <div>
                  <p className="text-sm font-medium">{muscle}</p>
                  <p className="text-xs text-gray-400">{label}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DashboardCard({ title, value, icon: Icon, color, subtitle }: { title: string, value: string, icon: any, color: string, subtitle?: string }) {
  return (
    <div className="bg-white/[0.04] backdrop-blur-md p-5 rounded-[20px] border border-white/10 hover:bg-white/[0.06] transition-all group">
      <div className="flex items-start justify-between mb-2">
        <p className="text-[12px] text-white/40 m-0 uppercase tracking-widest">{title}</p>
        <Icon className={`w-4 h-4 ${color} opacity-80`} />
      </div>
      <h3 className={`text-2xl m-0 font-bold ${title === 'Streak Atual' ? 'text-[#00ff88]' : 'text-white'}`}>{value}</h3>
      {subtitle && <p className="text-xs text-white/30 mt-1">{subtitle}</p>}
    </div>
  );
}
