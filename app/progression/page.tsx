"use client";

import { useState } from 'react';
import { useAppContext } from '@/app/context/AppContext';
import { Target, TrendingUp, TrendingDown, Activity, CheckCircle, RefreshCcw, Sparkles } from 'lucide-react';
import { WorkoutPlan } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

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
        // Preserva método de treino e equipamento do plano atual — o endpoint de progressão não
        // pergunta nenhum dos dois, então sem isso Superset/Circuito/Rest-Pause e o filtro de
        // equipamento no swap se perderiam a cada check-in.
        setNewPlan({ ...data.plan, trainingMethod: workoutPlans[0]?.trainingMethod, equipment: workoutPlans[0]?.equipment });
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
    <div className="p-6 md:p-10 max-w-3xl mx-auto animate-fade-in pb-32">
      <header className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-accent flex items-center justify-center shadow-lg">
            <RefreshCcw className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-outfit font-bold">Check-in Semanal</h1>
        </div>
        <p className="text-foreground-muted">É hora de avaliar seus resultados e evoluir seu treino.</p>
      </header>

      {step === 1 && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-primary">Resumo da Última Semana</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-2">
                <div className="bg-surface p-4 rounded-xl text-center border border-border">
                  <p className="text-foreground-muted text-[10px] md:text-xs mb-1 uppercase tracking-wider font-semibold">Treinos Feitos</p>
                  <p className="text-xl md:text-2xl font-bold font-mono">{lastWeekWorkouts.length}</p>
                </div>
                <div className="bg-surface p-4 rounded-xl text-center border border-border">
                  <p className="text-foreground-muted text-[10px] md:text-xs mb-1 uppercase tracking-wider font-semibold">Carga (Vol)</p>
                  <p className="text-xl md:text-2xl font-bold font-mono">{totalVolume.toLocaleString()} <span className="text-sm font-sans font-normal text-foreground-muted">kg</span></p>
                </div>
                <div className="bg-blue-500/10 p-4 rounded-xl text-center border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                  <p className="text-blue-400 text-[10px] md:text-xs mb-1 uppercase tracking-wider font-bold">Séries Efetivas</p>
                  <p className="text-xl md:text-2xl font-bold text-blue-400 font-mono">{totalEffectiveSets}</p>
                </div>
              </div>
              {lastWeekWorkouts.length === 0 && (
                <p className="text-sm text-yellow-400 mt-4 bg-yellow-400/10 p-3 rounded-lg">Você não registrou treinos nos últimos 7 dias. O check-in pode não ser tão preciso.</p>
              )}
            </CardContent>
          </Card>

          <Card variant="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Como você se sentiu nesta semana?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="block text-sm text-foreground-muted mb-4 font-medium">Nível de Fadiga Geral</label>
                <div className="flex justify-between items-center bg-surface p-2 rounded-xl border border-border">
                  {[1, 2, 3, 4, 5].map(num => (
                    <button
                      key={num}
                      onClick={() => setFatigueLevel(num)}
                      className={`w-12 h-12 rounded-lg font-bold transition-all ${fatigueLevel === num ? 'bg-primary text-black scale-110 shadow-[0_0_15px_rgba(0,255,136,0.5)]' : 'bg-background/50 text-foreground-muted hover:bg-white/10 border border-transparent hover:border-border'}`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-foreground-muted mt-2 px-1 font-medium">
                  <span>Tranquilo</span>
                  <span>Exausto</span>
                </div>
              </div>
  
              <div>
                <label className="block text-sm text-foreground-muted mb-3 font-medium">Sentiu dores articulares anormais?</label>
                <div className="flex gap-4">
                  <button
                    onClick={() => setJointPain(true)}
                    className={`flex-1 py-3 rounded-xl border font-semibold transition-colors ${jointPain ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-surface border-border text-foreground-muted hover:bg-surface-light'}`}
                  >
                    Sim, senti dor
                  </button>
                  <button
                    onClick={() => setJointPain(false)}
                    className={`flex-1 py-3 rounded-xl border font-semibold transition-colors ${!jointPain ? 'bg-primary/20 border-primary text-primary' : 'bg-surface border-border text-foreground-muted hover:bg-surface-light'}`}
                  >
                    Não, tudo 100%
                  </button>
                </div>
              </div>
  
              <Button
                onClick={() => {
                  setStep(2);
                  handleGenerateProgression();
                }}
                className="mt-6 font-bold shadow-[0_0_20px_rgba(124,58,237,0.3)] bg-gradient-to-r from-blue-600 to-accent hover:from-blue-500 hover:to-accent/80 border-0"
                fullWidth
                size="lg"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Analisar e Ajustar Treino
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 2 && (
        <Card className="text-center p-8 flex flex-col items-center">
          {!newPlan && isGenerating ? (
            <>
              <div className="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin mb-6"></div>
              <h3 className="text-2xl font-bold font-outfit mb-2">A IA está analisando sua performance...</h3>
              <p className="text-foreground-muted text-sm max-w-sm mb-4">
                Estamos calculando volumes, verificando sua fadiga e aplicando o princípio da Sobrecarga Progressiva.
              </p>
            </>
          ) : newPlan ? (
            <>
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-6">
                <CheckCircle className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-3xl font-outfit font-bold mb-2">Treino Evoluído!</h3>
              <p className="text-foreground-muted mb-8 max-w-md">
                Analisamos sua semana e fizemos micro-ajustes nas cargas e volumes para garantir que você continue tendo resultados sem estagnar.
              </p>
              
              <div className="bg-surface w-full rounded-2xl p-6 mb-8 text-left border border-border">
                <p className="font-semibold text-sm text-accent mb-2 uppercase tracking-wider">Novo Plano de Treino:</p>
                <p className="text-2xl font-bold font-outfit">{newPlan.name}</p>
                <p className="text-sm text-foreground-muted mt-2 flex items-center gap-2">
                   <span className="px-2 py-1 bg-white/5 rounded-md">{newPlan.sessions.length} sessões</span>
                   <span className="px-2 py-1 bg-white/5 rounded-md">{newPlan.split}</span>
                </p>
              </div>
  
              <div className="flex gap-4 w-full">
                <Button onClick={() => setStep(1)} variant="outline" className="flex-1">
                  Voltar
                </Button>
                <Button onClick={saveAndApplyPlan} className="flex-1 shadow-[0_0_20px_rgba(0,255,136,0.3)]">
                  Aplicar Mudanças
                </Button>
              </div>
            </>
          ) : (
            <div className="text-destructive font-bold">Falha ao gerar o treino. Tente novamente.</div>
          )}
        </Card>
      )}
    </div>
  );
}
