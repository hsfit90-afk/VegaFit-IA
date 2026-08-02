"use client";

import { useState } from 'react';
import { useAppContext } from '@/app/context/AppContext';
import { Target, TrendingUp, TrendingDown, Activity, CheckCircle, RefreshCcw, Sparkles } from 'lucide-react';
import { WorkoutPlan } from '@/lib/types';
import { useRouter } from 'next/navigation';

export default function ProgressionCheckIn() {
  const { profile, history, workoutPlans, addWorkoutPlan } = useAppContext();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [fatigueLevel, setFatigueLevel] = useState<number>(3); // 1 = descansado, 5 = exausto
  const [jointPain, setJointPain] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [newPlan, setNewPlan] = useState<WorkoutPlan | null>(null);

  // Calcula estatísticas básicas dos últimos 7 dias
  const lastWeekWorkouts = history.filter(h => {
    const diffDays = (Date.now() - new Date(h.date).getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 7;
  });

  const totalVolume = lastWeekWorkouts.reduce((acc, curr) => acc + curr.totalVolume, 0);
  
  // RIR <= 3 is considered an effective set for hypertrophy
  const totalEffectiveSets = lastWeekWorkouts.reduce((acc, workout) => {
    return acc + workout.exercises.reduce((exAcc, ex) => {
      return exAcc + ex.sets.filter(s => s.completed && s.rir !== undefined && s.rir <= 3).length;
    }, 0);
  }, 0);

  const handleGenerateProgression = async () => {
    if (!profile) return;
    setIsGenerating(true);

    try {
      const response = await fetch('/api/progression', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: profile.geminiApiKey,
          profile,
          recentHistory: lastWeekWorkouts,
          effectiveSets: totalEffectiveSets,
          currentPlan: workoutPlans[0], // Pega o plano atual
          feedback: {
            fatigueLevel,
            jointPain
          }
        })
      });

      const data = await response.json();
      if (data.plan) {
        setNewPlan(data.plan);
      } else {
        alert("Erro ao analisar a progressão.");
      }
    } catch (e) {
      alert("Erro na conexão com a IA.");
    } finally {
      setIsGenerating(false);
    }
  };

  const saveAndApplyPlan = () => {
    if (newPlan) {
      addWorkoutPlan(newPlan);
      router.push('/');
    }
  };

  if (!profile) return null;

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto animate-fade-in">
      <header className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-[#7c3aed] flex items-center justify-center shadow-lg">
            <RefreshCcw className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-outfit font-bold">Check-in Semanal</h1>
        </div>
        <p className="text-gray-400">É hora de avaliar seus resultados e evoluir seu treino.</p>
      </header>

      {step === 1 && (
        <div className="space-y-6">
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
            <h3 className="text-lg font-semibold mb-4 text-[#00ff88]">Resumo da Última Semana</h3>
            <div className="grid grid-cols-3 gap-4 mb-2">
              <div className="bg-black/30 p-4 rounded-xl text-center">
                <p className="text-gray-400 text-[10px] md:text-xs mb-1 uppercase tracking-wider">Treinos Feitos</p>
                <p className="text-xl md:text-2xl font-bold">{lastWeekWorkouts.length}</p>
              </div>
              <div className="bg-black/30 p-4 rounded-xl text-center">
                <p className="text-gray-400 text-[10px] md:text-xs mb-1 uppercase tracking-wider">Carga (Vol)</p>
                <p className="text-xl md:text-2xl font-bold">{totalVolume.toLocaleString()} kg</p>
              </div>
              <div className="bg-black/30 p-4 rounded-xl text-center border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                <p className="text-blue-400 text-[10px] md:text-xs mb-1 uppercase tracking-wider font-bold">Séries Efetivas</p>
                <p className="text-xl md:text-2xl font-bold text-blue-400">{totalEffectiveSets}</p>
              </div>
            </div>
            {lastWeekWorkouts.length === 0 && (
              <p className="text-sm text-yellow-400 mt-4 bg-yellow-400/10 p-3 rounded-lg">Você não registrou treinos nos últimos 7 dias. O check-in pode não ser tão preciso.</p>
            )}
          </div>

          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 space-y-6">
            <h3 className="text-lg font-semibold">Como você se sentiu nesta semana?</h3>
            
            <div>
              <label className="block text-sm text-gray-400 mb-4">Nível de Fadiga Geral</label>
              <div className="flex justify-between items-center bg-black/30 p-2 rounded-xl">
                {[1, 2, 3, 4, 5].map(num => (
                  <button
                    key={num}
                    onClick={() => setFatigueLevel(num)}
                    className={`w-12 h-12 rounded-lg font-bold transition-all ${fatigueLevel === num ? 'bg-[#00ff88] text-black scale-110 shadow-[0_0_15px_rgba(0,255,136,0.5)]' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                  >
                    {num}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-2 px-1">
                <span>Tranquilo</span>
                <span>Exausto</span>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-3">Sentiu dores articulares anormais?</label>
              <div className="flex gap-4">
                <button
                  onClick={() => setJointPain(true)}
                  className={`flex-1 py-3 rounded-xl border ${jointPain ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-black/30 border-white/10 text-gray-400'}`}
                >
                  Sim, senti dor
                </button>
                <button
                  onClick={() => setJointPain(false)}
                  className={`flex-1 py-3 rounded-xl border ${!jointPain ? 'bg-[#00ff88]/20 border-[#00ff88] text-[#00ff88]' : 'bg-black/30 border-white/10 text-gray-400'}`}
                >
                  Não, tudo 100%
                </button>
              </div>
            </div>

            <button
              onClick={() => {
                setStep(2);
                handleGenerateProgression();
              }}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-bold mt-4 transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="w-5 h-5" />
              Analisar e Ajustar Treino
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-8 text-center flex flex-col items-center">
          {!newPlan && isGenerating ? (
            <>
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
              <h3 className="text-xl font-bold mb-2">A IA está analisando sua performance...</h3>
              <p className="text-gray-400 text-sm max-w-sm">
                Estamos calculando volumes, verificando sua fadiga e aplicando o princípio da Sobrecarga Progressiva.
              </p>
            </>
          ) : newPlan ? (
            <>
              <div className="w-16 h-16 bg-[#00ff88]/20 rounded-full flex items-center justify-center mb-6">
                <CheckCircle className="w-8 h-8 text-[#00ff88]" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Treino Evoluído!</h3>
              <p className="text-gray-400 mb-8 max-w-md">
                Analisamos sua semana e fizemos micro-ajustes nas cargas e volumes para garantir que você continue tendo resultados sem estagnar.
              </p>
              
              <div className="bg-black/40 w-full rounded-xl p-4 mb-8 text-left border border-white/5">
                <p className="font-semibold text-sm text-blue-400 mb-2">Novo Plano de Treino:</p>
                <p className="text-xl">{newPlan.name}</p>
                <p className="text-sm text-gray-500 mt-1">{newPlan.sessions.length} sessões • {newPlan.split}</p>
              </div>

              <div className="flex gap-4 w-full">
                <button onClick={() => setStep(1)} className="flex-1 bg-white/5 hover:bg-white/10 py-3 rounded-xl font-semibold">
                  Voltar
                </button>
                <button onClick={saveAndApplyPlan} className="flex-1 bg-[#00ff88] text-black hover:bg-[#00cc6a] py-3 rounded-xl font-bold shadow-[0_0_15px_rgba(0,255,136,0.3)]">
                  Aplicar Mudanças
                </button>
              </div>
            </>
          ) : (
            <div className="text-red-400">Falha ao gerar o treino. Tente novamente.</div>
          )}
        </div>
      )}
    </div>
  );
}
