"use client";

import { useState, useEffect } from 'react';
import { useAppContext } from '@/app/context/AppContext';
import { Zap, Loader2, Check, RefreshCw, Trash2 } from 'lucide-react';
import { WorkoutPlan, Exercise as DbExercise } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { getExercises, deleteExercise } from '@/lib/db/exercises';

export default function Generator() {
  const { addWorkoutPlan, profile, userId, banExerciseForUser } = useAppContext();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<WorkoutPlan | null>(null);
  const [error, setError] = useState('');
  
  // Db exercises for swapping
  const [dbExercises, setDbExercises] = useState<DbExercise[]>([]);

  useEffect(() => {
    getExercises().then(setDbExercises);
  }, []);

  const TRAINING_METHODS = [
    { id: 'tradicional', label: 'Tradicional', icon: '🏋️', desc: 'Séries e repetições padrão com descanso entre séries' },
    { id: 'superset', label: 'Superset', icon: '⚡', desc: 'Dois exercícios alternados sem descanso entre eles' },
    { id: 'drop_set', label: 'Drop Set', icon: '📉', desc: 'Reduz a carga ao falhar para continuar a série' },
    { id: 'piramide', label: 'Pirâmide', icon: '🔺', desc: 'Aumenta a carga e reduz reps a cada série' },
    { id: 'rest_pause', label: 'Rest-Pause', icon: '⏸️', desc: 'Microdescansos dentro da própria série' },
    { id: 'circuito', label: 'Circuito', icon: '🔄', desc: 'Exercícios em sequência com mínimo descanso' },
  ];

  const [form, setForm] = useState({
    goal: profile?.goal || 'Hipertrofia',
    level: profile?.level || 'Intermediário',
    daysPerWeek: 4,
    duration: 60,
    equipment: 'Academia completa',
    priorities: [] as string[],
    limitations: profile?.intent || '',
    trainingMethod: 'tradicional',
  });

  const handlePriorityToggle = (muscle: string) => {
    setForm(prev => {
      if (prev.priorities.includes(muscle)) {
        return { ...prev, priorities: prev.priorities.filter(p => p !== muscle) };
      }
      return { ...prev, priorities: [...prev.priorities, muscle] };
    });
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setGeneratedPlan(null);

    try {
      const res = await fetch('/api/treino', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: profile?.geminiApiKey,
          profile,
          config: form
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar treino');

      // Tenta cruzar os nomes gerados com o banco para ter o ID real e garantir o swap e o ban depois
      // O gerador AI manda apenas `name`, precisamos do `exerciseId` correspondente se existir
      
      const plan: WorkoutPlan = {
        ...data,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        sessions: data.sessions.map((session: any) => ({
          ...session,
          id: crypto.randomUUID(),
          exercises: session.exercises.map((ex: any) => {
            // Tenta achar na biblioteca pelo nome (case insensitive)
            const matchedDbEx = dbExercises.find(dbEx => dbEx.name.trim().toLowerCase() === ex.name.trim().toLowerCase());
            
            return {
              ...ex,
              id: crypto.randomUUID(),
              exerciseId: matchedDbEx ? matchedDbEx.id : ('custom-' + crypto.randomUUID()),
              muscleGroup: matchedDbEx ? matchedDbEx.muscleGroup : (ex.muscleGroup || 'Geral')
            };
          })
        }))
      };

      setGeneratedPlan(plan);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const savePlan = () => {
    if (generatedPlan) {
      addWorkoutPlan(generatedPlan);
      router.push('/');
    }
  };

  const handleTargetUpdate = (sessionId: string, exerciseId: string, setIndex: number, field: 'weight' | 'reps', value: number) => {
    setGeneratedPlan(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        sessions: prev.sessions.map(s => {
          if (s.id !== sessionId) return s;
          return {
            ...s,
            exercises: s.exercises.map(ex => {
              if (ex.id !== exerciseId) return ex;
              const targetWeights = [...(ex.targetWeights || Array(ex.sets).fill(0))];
              const targetReps = [...(ex.targetReps || Array(ex.sets).fill(parseInt(ex.reps.split('-')[0]) || 10))];
              
              if (field === 'weight') targetWeights[setIndex] = value;
              if (field === 'reps') targetReps[setIndex] = value;
              
              return { ...ex, targetWeights, targetReps };
            })
          };
        })
      };
    });
  };

  const handleModifySets = (sessionId: string, exerciseId: string, newCount: number) => {
    const targetCount = Math.max(1, Math.min(20, newCount));
    setGeneratedPlan(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        sessions: prev.sessions.map(s => {
          if (s.id !== sessionId) return s;
          return {
            ...s,
            exercises: s.exercises.map(ex => {
              if (ex.id !== exerciseId) return ex;
              if (targetCount === ex.sets) return ex;
              
              const targetWeights = [...(ex.targetWeights || Array(ex.sets).fill(0))];
              const targetReps = [...(ex.targetReps || Array(ex.sets).fill(parseInt(ex.reps.split('-')[0]) || 10))];
              
              while (targetWeights.length < targetCount) {
                targetWeights.push(targetWeights[targetWeights.length - 1] || 0);
                targetReps.push(targetReps[targetReps.length - 1] || 10);
              }
              targetWeights.length = targetCount;
              targetReps.length = targetCount;
              
              return { ...ex, sets: targetCount, targetWeights, targetReps };
            })
          };
        })
      };
    });
  };

  const handleCopyFromFirstSet = (sessionId: string, exerciseId: string) => {
    setGeneratedPlan(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        sessions: prev.sessions.map(s => {
          if (s.id !== sessionId) return s;
          return {
            ...s,
            exercises: s.exercises.map(ex => {
              if (ex.id !== exerciseId) return ex;
              if (ex.sets <= 1) return ex;
              
              const targetWeights = [...(ex.targetWeights || Array(ex.sets).fill(0))];
              const targetReps = [...(ex.targetReps || Array(ex.sets).fill(parseInt(ex.reps.split('-')[0]) || 10))];
              
              const s1Weight = targetWeights[0];
              const s1Reps = targetReps[0];
              
              for (let i = 1; i < ex.sets; i++) {
                targetWeights[i] = s1Weight;
                targetReps[i] = s1Reps;
              }
              
              return { ...ex, targetWeights, targetReps };
            })
          };
        })
      };
    });
  };

  // 1-Click Auto Swap
  const handleAutoSwap = (sessionId: string, exerciseId: string, currentMuscle: string, currentDbId: string) => {
    // Pegar alternativas do mesmo grupo muscular que não seja o atual e não esteja banido
    const banned = profile?.bannedExercises || [];
    const alternatives = dbExercises.filter(ex => 
      ex.muscleGroup === currentMuscle && 
      ex.id !== currentDbId && 
      !banned.includes(ex.id)
    );
    
    if (alternatives.length === 0) {
      alert(`Você não tem outras opções de "${currentMuscle}" cadastradas na sua biblioteca para fazer a troca.`);
      return;
    }

    // Escolher um aleatoriamente da lista filtrada
    const randomAlternative = alternatives[Math.floor(Math.random() * alternatives.length)];

    setGeneratedPlan(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        sessions: prev.sessions.map(s => {
          if (s.id !== sessionId) return s;
          return {
            ...s,
            exercises: s.exercises.map(ex => {
              if (ex.id !== exerciseId) return ex;
              return {
                ...ex,
                name: randomAlternative.name,
                muscleGroup: randomAlternative.muscleGroup,
                exerciseId: randomAlternative.id,
              };
            })
          };
        })
      };
    });
  };

  const handleBanExercise = async (sessionId: string, exerciseId: string, currentMuscle: string, currentDbId: string, currentName: string) => {
    // Tenta achar o verdadeiro DB Id mesmo se o generator deu 'custom-'
    const dbEx = dbExercises.find(e => 
      e.id === currentDbId || 
      e.name.trim().toLowerCase() === currentName.trim().toLowerCase()
    );

    if (!dbEx) {
      alert("Este exercício não está na sua biblioteca oficial (foi gerado solto pela IA). Apenas troque-o usando o botão ao lado.");
      return;
    }

    const realExerciseId = dbEx.id;
    const isOwner = dbEx.userId === userId;
    const confirmMessage = isOwner 
      ? `DESEJA BANIR PERMANENTEMENTE?\n\nO exercício "${currentName}" será excluído da sua biblioteca GLOBAL e a IA nunca mais o utilizará para ninguém. Esta ação não pode ser desfeita.\n\nApós excluir, colocaremos outro no lugar automaticamente.`
      : `DESEJA OCULTAR ESTE EXERCÍCIO?\n\nO exercício "${currentName}" será ocultado da sua conta e a IA não o recomendará mais para você.\n\nApós ocultar, colocaremos outro no lugar automaticamente.`;

    if (confirm(confirmMessage)) {
      
      let success = true;
      if (isOwner) {
        success = await deleteExercise(realExerciseId);
      } else {
        await banExerciseForUser(realExerciseId);
      }
      
      if (success) {
        // 2. Atualiza o estado local de exercícios para tirar ele da roleta
        const updatedDb = dbExercises.filter(e => e.id !== realExerciseId);
        setDbExercises(updatedDb);

        // 3. Tenta fazer um AutoSwap para colocar outro no lugar
        const alternatives = updatedDb.filter(ex => ex.muscleGroup === currentMuscle);
        
        if (alternatives.length > 0) {
          const randomAlternative = alternatives[Math.floor(Math.random() * alternatives.length)];
          setGeneratedPlan(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              sessions: prev.sessions.map(s => {
                if (s.id !== sessionId) return s;
                return {
                  ...s,
                  exercises: s.exercises.map(ex => {
                    if (ex.id !== exerciseId) return ex;
                    return {
                      ...ex,
                      name: randomAlternative.name,
                      muscleGroup: randomAlternative.muscleGroup,
                      exerciseId: randomAlternative.id,
                    };
                  })
                };
              })
            };
          });
        } else {
          // Se não tem alternativa, só remove o exercício do plano
          alert(`Exercício banido! Como não há mais nenhum exercício de "${currentMuscle}" cadastrado, ele foi removido do treino.`);
          setGeneratedPlan(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              sessions: prev.sessions.map(s => {
                if (s.id !== sessionId) return s;
                return {
                  ...s,
                  exercises: s.exercises.filter(ex => ex.id !== exerciseId)
                };
              })
            };
          });
        }
      } else {
        alert("Erro ao excluir do banco de dados.");
      }
    }
  };

  const getSessionVolume = (session: any) => {
    return session.exercises.reduce((acc: number, ex: any) => {
      const weights = ex.targetWeights || Array(ex.sets).fill(0);
      const reps = ex.targetReps || Array(ex.sets).fill(parseInt(ex.reps.split('-')[0]) || 10);
      const exerciseVol = weights.reduce((sum: number, w: number, i: number) => sum + (w * reps[i]), 0);
      return acc + exerciseVol;
    }, 0);
  };

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto animate-fade-in">
      <header className="mb-10">
        <h1 className="text-3xl md:text-4xl font-outfit font-bold flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-[#00ff88]/20 to-[#7c3aed]/20 rounded-xl backdrop-blur-md border border-white/10">
            <Zap className="w-8 h-8 text-[#00ff88]" />
          </div>
          Gerador de Treino IA
        </h1>
        <p className="text-white/60 mt-2">Crie um treino periodizado com IA</p>
      </header>

      {!generatedPlan ? (
        <form onSubmit={handleGenerate} className="space-y-8 bg-white/[0.04] backdrop-blur-md p-6 md:p-8 rounded-[20px] border border-white/10">
          {error && <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-400 text-sm">{error}</div>}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm text-gray-400 font-medium">Objetivo Principal</label>
              <select 
                value={form.goal} onChange={e => setForm({...form, goal: e.target.value})}
                className="w-full bg-[#0a0a0f]/80 backdrop-blur-md border border-white/10 rounded-xl p-3 text-white focus:border-[#00ff88] focus:ring-1 focus:ring-[#00ff88] outline-none transition-all"
              >
                <option>Hipertrofia</option>
                <option>Força</option>
                <option>Resistência</option>
                <option>Emagrecimento</option>
                <option>Misto</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-400 font-medium">Nível de Experiência</label>
              <select 
                value={form.level} onChange={e => setForm({...form, level: e.target.value})}
                className="w-full bg-[#0a0a0f]/80 backdrop-blur-md border border-white/10 rounded-xl p-3 text-white focus:border-[#00ff88] focus:ring-1 focus:ring-[#00ff88] outline-none transition-all"
              >
                <option>Iniciante</option>
                <option>Intermediário</option>
                <option>Avançado</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-400 font-medium">Dias por Semana</label>
              <select 
                value={form.daysPerWeek} onChange={e => setForm({...form, daysPerWeek: Number(e.target.value)})}
                className="w-full bg-[#0a0a0f]/80 backdrop-blur-md border border-white/10 rounded-xl p-3 text-white focus:border-[#00ff88] focus:ring-1 focus:ring-[#00ff88] outline-none transition-all"
              >
                {[2,3,4,5,6].map(n => <option key={n} value={n}>{n} dias</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-400 font-medium">Duração da Sessão (min)</label>
              <select 
                value={form.duration} onChange={e => setForm({...form, duration: Number(e.target.value)})}
                className="w-full bg-[#0a0a0f]/80 backdrop-blur-md border border-white/10 rounded-xl p-3 text-white focus:border-[#00ff88] focus:ring-1 focus:ring-[#00ff88] outline-none transition-all"
              >
                <option value="45">45 minutos</option>
                <option value="60">60 minutos</option>
                <option value="90">90 minutos</option>
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm text-gray-400 font-medium">Equipamentos</label>
              <select 
                value={form.equipment} onChange={e => setForm({...form, equipment: e.target.value})}
                className="w-full bg-[#0a0a0f]/80 backdrop-blur-md border border-white/10 rounded-xl p-3 text-white focus:border-[#00ff88] focus:ring-1 focus:ring-[#00ff88] outline-none transition-all"
              >
                <option>Academia completa</option>
                <option>Halteres em casa</option>
                <option>Barra e anilhas</option>
                <option>Sem equipamento (calistenia)</option>
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm text-gray-400 font-medium">Músculos Prioritários (Opcional)</label>
              <div className="flex flex-wrap gap-2">
                {['Peito', 'Costas', 'Ombro', 'Bíceps', 'Tríceps', 'Pernas', 'Glúteos', 'Abdômen'].map(muscle => (
                  <button
                    type="button"
                    key={muscle}
                    onClick={() => handlePriorityToggle(muscle)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${form.priorities.includes(muscle) ? 'bg-[#7c3aed] text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                  >
                    {muscle}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 md:col-span-2">
              <label className="text-sm text-gray-400 font-medium">Método de Treino</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {TRAINING_METHODS.map(method => (
                  <button
                    type="button"
                    key={method.id}
                    onClick={() => setForm({...form, trainingMethod: method.id})}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      form.trainingMethod === method.id
                        ? 'border-[#00ff88] bg-[#00ff88]/10 text-white'
                        : 'border-white/10 bg-white/[0.02] text-gray-400 hover:bg-white/[0.05] hover:border-white/20'
                    }`}
                  >
                    <div className="text-xl mb-1">{method.icon}</div>
                    <div className="font-semibold text-sm">{method.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5 leading-tight">{method.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm text-gray-400 font-medium">Limitações, Foco ou Intenção</label>
              <textarea 
                placeholder="Ex: Dor no joelho esquerdo, evitar agachamento pesado..."
                value={form.limitations} onChange={e => setForm({...form, limitations: e.target.value})}
                className="w-full bg-[#0a0a0f]/80 backdrop-blur-md border border-white/10 rounded-xl p-3 text-white focus:border-[#00ff88] focus:ring-1 focus:ring-[#00ff88] outline-none transition-all min-h-[80px]"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-gradient-to-r from-[#00ff88] to-[#00cc6a] text-[#0a0a0f] font-bold text-lg p-4 rounded-xl hover:shadow-[0_0_20px_rgba(0,255,136,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Zap className="w-6 h-6" /> Gerar Treino com IA</>}
          </button>
        </form>
      ) : (
        <div className="space-y-8 animate-fade-in">
          <div className="bg-white/[0.04] backdrop-blur-md border border-[#00ff88]/30 rounded-[20px] p-6 md:p-8">
            <h2 className="text-2xl font-outfit font-bold text-[#00ff88] mb-1">{generatedPlan.name}</h2>
            <p className="text-white/60 mb-6">Divisão: {generatedPlan.split}</p>
            
            <div className="space-y-6">
              {generatedPlan.sessions.map((session) => (
                <div key={session.id} className="bg-white/[0.02] rounded-3xl p-6 border border-white/5 backdrop-blur-sm shadow-xl">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-outfit font-semibold text-2xl text-[#7c3aed]">{session.name}</h3>
                    <div className="bg-[#00ff88]/10 border border-[#00ff88]/20 px-4 py-2 rounded-xl text-[#00ff88] flex flex-col items-end">
                      <span className="text-[10px] uppercase tracking-wider font-semibold opacity-80">Volume Planejado</span>
                      <span className="font-mono font-bold">{getSessionVolume(session)} kg</span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {session.exercises.map((ex, i) => (
                      <div key={i} className="bg-white/[0.03] p-5 rounded-2xl border border-white/[0.08] hover:border-white/20 transition-all">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-white text-lg mr-2">{ex.name}</p>
                              
                              <button 
                                onClick={() => handleAutoSwap(session.id, ex.id, ex.muscleGroup, ex.exerciseId)}
                                className="p-1.5 bg-white/5 hover:bg-[#00ff88]/20 text-gray-400 hover:text-[#00ff88] rounded-md transition-colors border border-transparent hover:border-[#00ff88]/30"
                                title="Mudar Exercício (Substituir por outro)"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                              
                              <button 
                                onClick={() => handleBanExercise(session.id, ex.id, ex.muscleGroup, ex.exerciseId, ex.name)}
                                className="p-1.5 bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-md transition-colors border border-transparent hover:border-red-500/30 ml-1"
                                title="Banir para Sempre (Excluir da Biblioteca)"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            <p className="text-sm text-gray-400 mt-1 flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-white/10 rounded-md text-xs">{ex.muscleGroup}</span> 
                              <span>{ex.tips}</span>
                            </p>
                          </div>
                          <div className="text-right ml-4 shrink-0 bg-[#00ff88]/10 px-3 py-1.5 rounded-lg border border-[#00ff88]/20">
                            <span className="text-[#00ff88] font-mono text-xl font-bold">{ex.sets}x{ex.reps}</span>
                            {ex.method && (
                              <p className="text-xs text-[#7c3aed] mt-1 font-medium max-w-[120px] leading-tight">{ex.method}</p>
                            )}
                          </div>
                        </div>
                        
                        <div className="grid gap-3 pt-4 border-t border-white/5">
                          <div className="flex justify-between items-center">
                            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold flex items-center gap-2">
                              <Zap className="w-3 h-3 text-[#7c3aed]" />
                              Planejamento de Cargas e Séries
                            </p>
                            <div className="flex gap-2 items-center">
                              <div className="flex items-center gap-2 bg-white/5 rounded-lg border border-white/10 px-3 py-1">
                                <span className="text-xs text-gray-400 font-bold">Séries:</span>
                                <input
                                  type="number"
                                  value={ex.sets}
                                  min={1}
                                  max={20}
                                  onChange={(e) => handleModifySets(session.id, ex.id, parseInt(e.target.value) || 1)}
                                  className="w-10 text-center bg-transparent text-sm font-mono font-bold text-white outline-none"
                                />
                              </div>
                              <div className="text-xs font-mono text-white/50 bg-black/30 px-2 py-1 rounded-md">
                                Vol: {
                                  (ex.targetWeights || Array(ex.sets).fill(0)).reduce((acc: number, w: number, idx: number) => {
                                    const r = (ex.targetReps || Array(ex.sets).fill(parseInt(ex.reps.split('-')[0]) || 10))[idx];
                                    return acc + (w * r);
                                  }, 0)
                                } kg
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {Array.from({ length: ex.sets }).map((_, setIdx) => {
                              const currentWeight = ex.targetWeights?.[setIdx] || '';
                              const currentReps = ex.targetReps?.[setIdx] ?? (parseInt(ex.reps.split('-')[0]) || 10);
                              return (
                                <div key={setIdx} className="flex gap-3 items-center bg-black/20 p-2 rounded-xl hover:bg-black/40 transition-all border border-transparent hover:border-white/5 relative group">
                                  <span className="w-6 text-center text-xs text-gray-600 font-mono font-bold">{setIdx + 1}</span>
                                  <div className="flex-1 flex items-center bg-white/[0.04] rounded-lg px-3 py-2 border border-white/5 focus-within:border-[#00ff88]/50 focus-within:bg-[#00ff88]/5 transition-all">
                                    <input
                                      type="number"
                                      value={currentWeight}
                                      onChange={(e) => handleTargetUpdate(session.id, ex.id, setIdx, 'weight', parseFloat(e.target.value) || 0)}
                                      placeholder="0"
                                      className="w-full bg-transparent text-white font-mono text-center outline-none text-base placeholder:text-white/20"
                                    />
                                    <span className="text-xs text-gray-500 ml-2 font-medium">kg</span>
                                  </div>
                                  
                                  <div className="flex items-center text-gray-500 mx-1">×</div>
                                  
                                  <div className="flex-1 flex items-center bg-white/[0.04] rounded-lg px-3 py-2 border border-white/5 focus-within:border-[#7c3aed]/50 focus-within:bg-[#7c3aed]/5 transition-all">
                                    <input
                                      type="number"
                                      value={currentReps}
                                      onChange={(e) => handleTargetUpdate(session.id, ex.id, setIdx, 'reps', parseInt(e.target.value) || 0)}
                                      className="w-full bg-transparent text-white font-mono text-center outline-none text-base placeholder:text-white/20"
                                    />
                                    <span className="text-xs text-gray-500 ml-2 font-medium">reps</span>
                                  </div>

                                  {setIdx === 0 && ex.sets > 1 && (
                                    <button 
                                      onClick={() => handleCopyFromFirstSet(session.id, ex.id)}
                                      className="absolute -right-2 top-1/2 -translate-y-1/2 translate-x-full ml-2 opacity-0 group-hover:opacity-100 bg-[#7c3aed]/20 hover:bg-[#7c3aed]/40 text-[#7c3aed] text-[10px] px-2 py-1.5 rounded-lg border border-[#7c3aed]/30 transition-all font-bold flex items-center gap-1 uppercase tracking-wider shadow-lg"
                                      title="Aplicar carga e reps para todas as séries"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>
                                      Aplicar
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-4 mt-8">
              <button onClick={() => setGeneratedPlan(null)} className="flex-1 py-4 rounded-xl border border-white/20 text-white font-semibold hover:bg-white/5 transition-all">
                Regenerar
              </button>
              <button onClick={savePlan} className="flex-1 py-4 rounded-xl bg-[#00ff88] text-[#0a0a0f] font-bold flex justify-center items-center gap-2 hover:shadow-[0_0_20px_rgba(0,255,136,0.4)] transition-all">
                <Check className="w-5 h-5" /> Salvar Treino
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
