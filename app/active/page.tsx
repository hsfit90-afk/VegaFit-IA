"use client";

import { useState, useEffect, useRef } from 'react';
import { useAppContext } from '@/app/context/AppContext';
import { useRouter } from 'next/navigation';
import { Check, Clock, Play, PlayCircle, Trophy, X, Zap, RefreshCw, Trash2 } from 'lucide-react';
import { ActiveExercise, ActiveSet, WorkoutHistoryEntry } from '@/lib/types';
import confetti from 'canvas-confetti';

export default function ActiveWorkout() {
  const { workoutPlans, addHistoryEntry, profile, currentSessionIndex, advanceSession, updateWorkoutPlan, userId, banExerciseForUser } = useAppContext();
  const router = useRouter();

  const currentPlan = workoutPlans.length > 0 ? workoutPlans[0] : null;
  // Usa o índice da sessão atual (A, B, C...) em vez de sempre a sessão 0
  const safeIndex = currentPlan ? currentSessionIndex % currentPlan.sessions.length : 0;
  const currentSession = currentPlan ? currentPlan.sessions[safeIndex] : null;

  const [activeExercises, setActiveExercises] = useState<ActiveExercise[]>([]);
  const [startTime, setStartTime] = useState<number>(0);
  const [restTimer, setRestTimer] = useState<number>(0);
  const [isFinished, setIsFinished] = useState(false);
  const [finishedVolume, setFinishedVolume] = useState(0);
  const [showToast, setShowToast] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [showVideoFor, setShowVideoFor] = useState<string | null>(null);
  const [libraryExercises, setLibraryExercises] = useState<any[]>([]); // To store DB exercises for mediaUrl
  const { getExercises, deleteExercise } = require('@/lib/db/exercises');

  useEffect(() => {
    // Load library exercises to map mediaUrl
    getExercises().then((data: any) => {
      setLibraryExercises(data);
    });
    
    if (currentSession && activeExercises.length === 0) {
      const initialized = currentSession.exercises.map(ex => ({
        workoutExerciseId: ex.id,
        exerciseId: ex.exerciseId,
        name: ex.name,
        muscleGroup: ex.muscleGroup,
        targetSets: ex.sets,
        sets: Array.from({length: ex.sets}).map((_, i) => ({ 
          label: ex.targetLabels?.[i] || `S${i + 1}`,
          reps: ex.targetReps?.[i] ?? (parseInt(ex.reps.split('-')[0]) || 10), 
          weight: ex.targetWeights?.[i] || 0, 
          completed: false 
        }))
      }));
      setActiveExercises(initialized);
      setStartTime(Date.now());
    }
    
    // Initialize audio
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
  }, [currentSession, activeExercises.length]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (restTimer > 0) {
      interval = setInterval(() => {
        setRestTimer(prev => {
          if (prev <= 1) {
            if (profile?.soundEnabled && audioRef.current) {
              audioRef.current.play().catch(e => console.log('Audio play failed', e));
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [restTimer, profile?.soundEnabled]);

  if (!currentSession) {
    return (
      <div className="p-6 md:p-10 text-center pt-20">
        <h2 className="text-2xl font-outfit mb-4">Nenhum treino programado.</h2>
        <button onClick={() => router.push('/generator')} className="px-6 py-3 bg-[#7c3aed] rounded-xl font-bold">
          Gerar Treino
        </button>
      </div>
    );
  }

  const handleSetUpdate = (exerciseIndex: number, setIndex: number, field: keyof ActiveSet, value: any) => {
    setActiveExercises(prev => {
      const updated = [...prev];
      const currentEx = { ...updated[exerciseIndex] };
      const currentSets = [...currentEx.sets];
      
      currentSets[setIndex] = {
        ...currentSets[setIndex],
        [field]: value
      };
      
      currentEx.sets = currentSets;
      updated[exerciseIndex] = currentEx;
      return updated;
    });
  };

  const handleLabelUpdate = (exerciseIndex: number, setIndex: number, value: string) => {
    setActiveExercises(prev => {
      const updated = [...prev];
      const currentEx = { ...updated[exerciseIndex] };
      const currentSets = [...currentEx.sets];
      
      currentSets[setIndex] = {
        ...currentSets[setIndex],
        label: value
      };
      
      currentEx.sets = currentSets;
      updated[exerciseIndex] = currentEx;
      return updated;
    });
  };

  const toggleSetComplete = (exerciseIndex: number, setIndex: number) => {
    try {
      const isCurrentlyCompleted = activeExercises[exerciseIndex].sets[setIndex].completed;
      
      setActiveExercises(prev => {
        const updated = [...prev];
        const currentEx = { ...updated[exerciseIndex] };
        const currentSets = [...currentEx.sets];
        const currentSet = { ...currentSets[setIndex] };
        
        currentSet.completed = !isCurrentlyCompleted;
        
        currentSets[setIndex] = currentSet;
        currentEx.sets = currentSets;
        updated[exerciseIndex] = currentEx;
        
        return updated;
      });

      // Start rest timer if completed (outside state updater!)
      if (!isCurrentlyCompleted) {
         setRestTimer(profile?.defaultRestTimer || currentSession?.exercises[exerciseIndex]?.restSeconds || 60);
      } else {
         setRestTimer(0);
      }
    } catch (e: any) {
      alert("Erro ao ticar: " + e.message);
    }
  };

  const handleAddExtraSet = (exerciseIndex: number) => {
    setActiveExercises(prev => {
      const updated = [...prev];
      const currentEx = { ...updated[exerciseIndex] };
      const currentSets = [...currentEx.sets];
      
      const currentLength = currentSets.length;
      const lastSet = currentSets[currentLength - 1];
      currentSets.push({
        label: `S${currentLength + 1}`,
        reps: lastSet ? lastSet.reps : 10,
        weight: lastSet ? lastSet.weight : 0,
        completed: false
      });
      
      currentEx.sets = currentSets;
      updated[exerciseIndex] = currentEx;
      return updated;
    });
  };

  const handleRemoveSet = (exerciseIndex: number) => {
    setActiveExercises(prev => {
      const updated = [...prev];
      const currentEx = { ...updated[exerciseIndex] };
      const currentSets = [...currentEx.sets];
      
      if (currentSets.length > 1) {
        currentSets.pop();
      }
      
      currentEx.sets = currentSets;
      updated[exerciseIndex] = currentEx;
      return updated;
    });
  };

  const handleSetCount = (exerciseIndex: number, count: number) => {
    const newCount = Math.max(1, Math.min(20, count));
    setActiveExercises(prev => {
      const updated = [...prev];
      const currentEx = { ...updated[exerciseIndex] };
      const currentSets = [...currentEx.sets];
      
      if (newCount > currentSets.length) {
        const last = currentSets[currentSets.length - 1];
        for (let i = currentSets.length; i < newCount; i++) {
          currentSets.push({ label: `${i + 1}`, reps: last?.reps || 10, weight: last?.weight || 0, completed: false });
        }
      } else if (newCount < currentSets.length) {
        currentEx.sets = currentSets.slice(0, newCount);
      } else {
        currentEx.sets = currentSets;
      }
      
      updated[exerciseIndex] = currentEx;
      return updated;
    });
  };

  const handleCopyFromFirstSet = (exerciseIndex: number) => {
    setActiveExercises(prev => {
      const updated = [...prev];
      const currentEx = { ...updated[exerciseIndex] };
      const currentSets = [...currentEx.sets];
      
      if (currentSets.length <= 1) return updated;
      
      const s1 = currentSets[0];
      for (let i = 1; i < currentSets.length; i++) {
        // Only override if it wasn't completed yet
        if (!currentSets[i].completed) {
          currentSets[i] = {
            ...currentSets[i],
            weight: s1.weight,
            reps: s1.reps
          };
        }
      }
      
      currentEx.sets = currentSets;
      updated[exerciseIndex] = currentEx;
      return updated;
    });
  };

  const handleAutoSwap = (exIndex: number) => {
    const currentActiveEx = activeExercises[exIndex];
    
    // Pegar alternativas da biblioteca
    const banned = profile?.bannedExercises || [];
    const alternatives = libraryExercises.filter(ex => 
      ex.muscleGroup === currentActiveEx.muscleGroup && 
      ex.id !== currentActiveEx.exerciseId &&
      !banned.includes(ex.id)
    );
    
    if (alternatives.length === 0) {
      alert(`Você não tem outras opções de "${currentActiveEx.muscleGroup}" cadastradas na sua biblioteca para fazer a troca.`);
      return;
    }

    // Escolher um aleatoriamente da lista filtrada
    const randomAlternative = alternatives[Math.floor(Math.random() * alternatives.length)];

    // 1. Atualizar a UI ativa imediatamente
    setActiveExercises(prev => {
      const updated = [...prev];
      updated[exIndex] = {
        ...updated[exIndex],
        exerciseId: randomAlternative.id,
        name: randomAlternative.name,
        muscleGroup: randomAlternative.muscleGroup
      };
      return updated;
    });

    // 2. Atualizar o plano master no Supabase (se quisermos persistir)
    if (currentPlan) {
      const updatedPlan = {
        ...currentPlan,
        sessions: currentPlan.sessions.map((s, i) => {
          if (i !== safeIndex) return s;
          return {
            ...s,
            exercises: s.exercises.map((e, j) => {
              if (j !== exIndex) return e;
              return {
                ...e,
                exerciseId: randomAlternative.id,
                name: randomAlternative.name,
                muscleGroup: randomAlternative.muscleGroup
              };
            })
          };
        })
      };
      updateWorkoutPlan(updatedPlan);
    }
  };

  const handleBanExercise = async (exIndex: number) => {
    const currentActiveEx = activeExercises[exIndex];
    
    // Tenta encontrar o exercício real no banco de dados, mesmo se o ID original for 'custom-'
    const dbEx = libraryExercises.find(e => 
      e.id === currentActiveEx.exerciseId || 
      e.name.trim().toLowerCase() === currentActiveEx.name.trim().toLowerCase()
    );

    if (!dbEx) {
      alert("Este exercício não está na sua biblioteca oficial (foi gerado solto pela IA). Apenas troque-o usando o botão ao lado.");
      return;
    }

    const realExerciseId = dbEx.id;
    const isOwner = dbEx.userId === userId;
    const confirmMessage = isOwner 
      ? `DESEJA BANIR PERMANENTEMENTE?\n\nO exercício "${currentActiveEx.name}" será excluído da sua biblioteca GLOBAL e a IA nunca mais o utilizará para ninguém. Esta ação não pode ser desfeita.\n\nApós excluir, colocaremos outro no lugar automaticamente.`
      : `DESEJA OCULTAR ESTE EXERCÍCIO?\n\nO exercício "${currentActiveEx.name}" será ocultado da sua conta e a IA não o recomendará mais para você.\n\nApós ocultar, colocaremos outro no lugar automaticamente.`;

    if (confirm(confirmMessage)) {
      
      let success = true;
      if (isOwner) {
        success = await deleteExercise(realExerciseId);
      } else {
        await banExerciseForUser(realExerciseId);
      }
      
      if (success) {
        // Atualiza o estado local para tirar da roleta
        const updatedDb = libraryExercises.filter(e => e.id !== realExerciseId);
        setLibraryExercises(updatedDb);
        
        const banned = profile?.bannedExercises || [];
        // Add the newly banned one to the list so we don't pick it as alternative right away if not owner
        if (!isOwner) banned.push(realExerciseId);

        const alternatives = updatedDb.filter(ex => 
          ex.muscleGroup === currentActiveEx.muscleGroup &&
          !banned.includes(ex.id)
        );
        
        if (alternatives.length > 0) {
          const randomAlternative = alternatives[Math.floor(Math.random() * alternatives.length)];

          setActiveExercises(prev => {
            const updated = [...prev];
            updated[exIndex] = {
              ...updated[exIndex],
              exerciseId: randomAlternative.id,
              name: randomAlternative.name,
              muscleGroup: randomAlternative.muscleGroup
            };
            return updated;
          });

          if (currentPlan) {
            const updatedPlan = {
              ...currentPlan,
              sessions: currentPlan.sessions.map((s, i) => {
                if (i !== safeIndex) return s;
                return {
                  ...s,
                  exercises: s.exercises.map((e, j) => {
                    if (j !== exIndex) return e;
                    return {
                      ...e,
                      exerciseId: randomAlternative.id,
                      name: randomAlternative.name,
                      muscleGroup: randomAlternative.muscleGroup
                    };
                  })
                };
              })
            };
            updateWorkoutPlan(updatedPlan);
          }
        } else {
          alert("Exercício banido! Como não há mais nenhum exercício cadastrado para este grupo muscular, não foi possível colocar outro no lugar.");
        }
      } else {
        alert("Erro ao excluir o exercício do banco de dados.");
      }
    }
  };

  const finishWorkout = () => {
    const endTime = Date.now();
    const durationSeconds = Math.floor((endTime - startTime) / 1000);
    
    let totalVolume = 0;
    activeExercises.forEach(ex => {
      ex.sets.forEach(set => {
        if (set.completed) {
          totalVolume += (set.reps * set.weight);
        }
      });
    });

    const entry: WorkoutHistoryEntry = {
      id: crypto.randomUUID(),
      date: endTime,
      workoutPlanId: currentPlan!.id,
      workoutPlanName: currentPlan!.name,
      sessionId: currentSession.id,
      sessionName: currentSession.name,
      durationSeconds,
      totalVolume,
      exercises: activeExercises
    };

    // CALCULAR RECORDES PESSOAIS (PRs)
    let newPrs: string[] = [];
    activeExercises.forEach(ex => {
      // Pega o maior peso levantado nesse exercício no treino atual
      const currentMaxWeight = Math.max(...ex.sets.filter(s => s.completed).map(s => s.weight), 0);
      if (currentMaxWeight === 0) return;

      // Procura no histórico passado qual foi o máximo levantado nesse exercício
      let pastMaxWeight = 0;
      history.forEach(h => {
        const pastEx = h.exercises.find(e => e.name === ex.name);
        if (pastEx) {
          const pastMax = Math.max(...pastEx.sets.filter(s => s.completed).map(s => s.weight), 0);
          if (pastMax > pastMaxWeight) {
            pastMaxWeight = pastMax;
          }
        }
      });

      // Se o máximo atual for maior que o histórico (e ele já tiver histórico), é um novo Recorde Pessoal!
      if (currentMaxWeight > pastMaxWeight && pastMaxWeight > 0) {
        newPrs.push(`${ex.name} (${currentMaxWeight}kg)`);
      }
    });

    addHistoryEntry(entry);
    // Avança automaticamente para a próxima sessão (A→B→C→A...)
    if (currentPlan) {
      advanceSession(currentPlan.sessions.length);
    }
    
    // Configura os estados de finalização
    setFinishedVolume(totalVolume);
    // Se teve PR, salva no state provisório (vamos reaproveitar o showToast para exibir PR)
    if (newPrs.length > 0) {
      (window as any).recentPRs = newPrs; // Hack rápido para passar o estado sem criar novo useState agora
    } else {
      (window as any).recentPRs = [];
    }

    setIsFinished(true);
    setShowToast(true);
    
    setTimeout(() => setShowToast(false), 8000);
    
    confetti({
      particleCount: 200,
      spread: 90,
      origin: { y: 0.6 },
      colors: ['#00ff88', '#7c3aed', '#ffffff', '#ffd700']
    });
  };

  if (isFinished) {
    return (
      <div className="p-6 md:p-10 max-w-2xl mx-auto text-center pt-20 animate-fade-in">
        <div className="w-24 h-24 bg-gradient-to-br from-[#00ff88] to-[#7c3aed] rounded-full flex items-center justify-center mx-auto mb-6">
          <Trophy className="w-12 h-12 text-[#0a0a0f]" />
        </div>
        <h1 className="text-4xl font-outfit font-bold mb-4 text-[#00ff88]">Treino Concluído!</h1>
        <p className="text-gray-400 mb-8 text-lg">Excelente trabalho! O descanso também faz parte do processo.</p>
        <button onClick={() => router.push('/')} className="px-8 py-4 bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-xl font-bold hover:bg-white/[0.06] transition-all">
          Voltar ao Início
        </button>

        {/* Toast Notification */}
        {showToast && (
          <div className="fixed bottom-6 left-6 right-6 md:left-auto md:right-10 md:bottom-10 flex flex-col gap-3 z-50">
            {/* PR Gamification Toast */}
            {((window as any).recentPRs || []).map((pr: string, idx: number) => (
              <div key={idx} className="bg-gradient-to-r from-[#ffd700]/20 to-[#ffd700]/5 border border-[#ffd700]/50 text-[#ffd700] p-4 rounded-xl backdrop-blur-xl animate-fade-in shadow-[0_0_30px_rgba(255,215,0,0.2)] flex items-center gap-4">
                <div className="bg-[#ffd700]/20 p-3 rounded-lg">
                  <Trophy className="w-6 h-6 text-[#ffd700]" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-xs m-0 text-white/90 uppercase tracking-wider">Novo Recorde Pessoal!</p>
                  <p className="text-[#ffd700] text-lg font-outfit font-bold m-0">{pr}</p>
                </div>
              </div>
            ))}

            {/* Volume Toast */}
            <div className="bg-[#0a0a0f]/90 border border-[#00ff88]/30 text-[#00ff88] p-4 rounded-xl backdrop-blur-xl animate-fade-in shadow-[0_0_30px_rgba(0,255,136,0.15)] flex items-center gap-4">
              <div className="bg-[#00ff88]/20 p-3 rounded-lg">
                <Zap className="w-6 h-6 text-[#00ff88]" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-xs m-0 text-white/70 uppercase tracking-wider">Volume Alcançado</p>
                <p className="text-[#00ff88] text-xl font-outfit font-bold m-0">{finishedVolume} kg <span className="text-sm font-normal text-white/50">total</span></p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const totalSets = activeExercises.reduce((acc, ex) => acc + ex.targetSets, 0);
  const completedSets = activeExercises.reduce((acc, ex) => acc + ex.sets.filter(s => s.completed).length, 0);
  const progressPercent = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto animate-fade-in pb-32">
      <header className="mb-8 sticky top-0 bg-[#0a0a0f]/80 backdrop-blur-xl z-40 py-4 border-b border-white/[0.08]">
        <h1 className="text-2xl font-outfit font-bold text-[#7c3aed] mb-2">{currentSession.name}</h1>
        <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
          <div className="bg-[#00ff88] h-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
        </div>
      </header>

      {/* Floating Rest Timer */}
      {restTimer > 0 && (
        <div className="fixed bottom-24 right-6 bg-[#0a0a0f]/80 backdrop-blur-xl border border-[#00ff88]/50 p-4 rounded-[20px] shadow-[0_0_20px_rgba(0,255,136,0.1)] z-50 flex items-center justify-center animate-pulse">
          <Clock className="w-5 h-5 text-[#00ff88] mr-2" />
          <span className="font-mono text-[#00ff88] font-bold text-lg">{formatTime(restTimer)}</span>
        </div>
      )}

      <div className="space-y-6">
        {activeExercises.map((ex, exIndex) => (
          <div key={ex.workoutExerciseId} className="bg-[#0a0a0f]/60 backdrop-blur-2xl rounded-[32px] p-6 md:p-8 border border-white/[0.05] shadow-2xl relative overflow-hidden group">
            {/* Glow effect in background */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#7c3aed]/10 rounded-full blur-[80px] -z-10 group-hover:bg-[#7c3aed]/20 transition-all duration-700"></div>
            
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-2xl font-outfit font-bold text-white mb-2">{ex.name}</h2>
                <p className="text-sm text-[#00ff88] flex items-center gap-2">
                   <Zap className="w-4 h-4" /> {currentSession.exercises[exIndex].tips}
                </p>
              </div>
              <div className="flex gap-3 items-center">
                {/* Swap and Ban Buttons */}
                <div className="flex gap-1 mr-2">
                  <button 
                    onClick={() => handleAutoSwap(exIndex)}
                    className="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:text-[#00ff88] transition-all text-gray-400 flex items-center justify-center shadow-lg"
                    title="Substituir por outro do mesmo músculo"
                  >
                    <RefreshCw className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => handleBanExercise(exIndex)}
                    className="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-400 transition-all text-gray-400 flex items-center justify-center shadow-lg"
                    title="Banir exercício (excluir da biblioteca)"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                {/* Botão de vídeo */}
                <button
                  onClick={() => setShowVideoFor(showVideoFor === ex.workoutExerciseId ? null : ex.workoutExerciseId)}
                  className={`p-3 rounded-2xl border transition-all duration-300 flex items-center gap-2 ${
                    showVideoFor === ex.workoutExerciseId
                      ? 'bg-red-500/20 border-red-500/40 text-red-400'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:bg-[#7c3aed]/20 hover:border-[#7c3aed]/40 hover:text-[#7c3aed]'
                  }`}
                  title="Ver vídeo do exercício"
                >
                  {showVideoFor === ex.workoutExerciseId ? <X className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  <span className="text-xs font-bold hidden sm:inline">{showVideoFor === ex.workoutExerciseId ? 'Fechar' : 'Vídeo'}</span>
                </button>
                <div className="bg-white/5 px-4 py-2 rounded-2xl border border-white/10 text-center flex flex-col items-center justify-center backdrop-blur-md">
                   <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-1">Séries</span>
                   <input
                     type="number"
                     value={ex.sets.length}
                     min={1}
                     max={20}
                     onChange={e => handleSetCount(exIndex, parseInt(e.target.value) || 1)}
                     className="w-12 text-center bg-transparent text-xl font-mono font-bold text-white outline-none"
                   />
                </div>
                <div className="bg-white/5 px-4 py-2 rounded-2xl border border-white/10 text-center flex flex-col items-center justify-center backdrop-blur-md">
                   <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-1">Volume Atual</span>
                   <div className="text-xl font-mono font-bold text-white flex items-baseline gap-1">
                      {ex.sets.filter(s => s.completed).reduce((acc, s) => acc + (s.reps * s.weight), 0)} <span className="text-sm text-gray-500 font-medium">kg</span>
                   </div>
                </div>
              </div>
            </div>

            {/* Video Player */}
            {showVideoFor === ex.workoutExerciseId && (() => {
              const exercise = currentSession.exercises[exIndex];
              let dbMatch = libraryExercises.find(e => e.id === exercise.exerciseId || e.name.trim().toLowerCase() === ex.name.trim().toLowerCase());
              
              // Fallback para fuzzy match se a IA tiver gerado um nome ligeiramente diferente
              if (!dbMatch) {
                const exName = ex.name.trim().toLowerCase();
                dbMatch = libraryExercises.find(e => {
                  const dbName = e.name.toLowerCase();
                  return dbName.includes(exName) || exName.includes(dbName);
                });
              }

              const customMediaUrl = dbMatch?.mediaUrl;
              const searchQuery = encodeURIComponent(exercise.youtubeSearchTerm || `${ex.name} como fazer exercicio`);
              
              return (
                <div className="mb-6 rounded-2xl overflow-hidden border border-white/10 bg-black/50">
                  {customMediaUrl ? (
                    <div className="w-full aspect-video relative">
                      {customMediaUrl.endsWith('.mp4') ? (
                        <video src={customMediaUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                      ) : (
                        <img src={customMediaUrl} alt={ex.name} className="w-full h-full object-contain" />
                      )}
                    </div>
                  ) : (
                    <iframe
                      width="100%"
                      height="240"
                      src={`https://www.youtube.com/embed?listType=search&list=${searchQuery}&autoplay=0`}
                      title={`Como fazer ${ex.name}`}
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full"
                    />
                  )}
                  
                  <div className="px-4 py-2 bg-black/40 flex items-center gap-2 border-t border-white/5">
                    {customMediaUrl ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse"></span>
                        <span className="text-xs text-[#00ff88] font-medium tracking-wide">Mídia Verificada (Biblioteca Própria)</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 text-red-400" />
                        <span className="text-xs text-gray-400">Pesquisando: <span className="text-white font-medium">{exercise.youtubeSearchTerm || ex.name}</span></span>
                        <a 
                          href={`https://www.youtube.com/results?search_query=${searchQuery}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto text-xs text-[#7c3aed] hover:underline"
                        >
                          Ver no YouTube ↗
                        </a>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}
            <div className="space-y-4">
              <div className="grid grid-cols-12 gap-2 text-[10px] text-gray-400 font-bold px-2 mb-2 uppercase tracking-widest">
                <div className="col-span-1 text-center">#</div>
                <div className="col-span-3 text-center">Carga</div>
                <div className="col-span-3 text-center">Reps</div>
                <div className="col-span-3 text-center" title="Repetições na Reserva">RIR</div>
                <div className="col-span-2 text-center"></div>
              </div>
              
              {ex.sets.map((set, setIndex) => (
                <div key={setIndex} className={`grid grid-cols-12 gap-2 items-center p-2 md:p-3 rounded-2xl border transition-all duration-300 relative group ${
                  set.completed 
                    ? 'bg-gradient-to-r from-[#00ff88]/10 to-transparent border-[#00ff88]/30 shadow-[0_0_20px_rgba(0,255,136,0.15)]' 
                    : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-white/10'
                }`}>
                  <div className="col-span-1 flex justify-center">
                    <span className={`text-xs font-mono font-bold ${ set.completed ? 'text-[#00ff88]' : 'text-gray-600' }`}>{setIndex + 1}</span>
                  </div>
                  
                  <div className="col-span-3">
                    <div className={`relative flex items-center bg-black/40 rounded-xl overflow-hidden border transition-all duration-300 ${
                      set.completed ? 'border-[#00ff88]/30' : 'border-white/5 focus-within:border-[#00ff88]/50 focus-within:bg-black/60'
                    }`}>
                      <input 
                        type="number" 
                        value={set.weight || ''}
                        onChange={e => handleSetUpdate(exIndex, setIndex, 'weight', parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className={`w-full bg-transparent py-2 md:py-3 text-center font-mono text-lg md:text-xl outline-none transition-all ${
                          set.completed ? 'text-[#00ff88] font-bold' : 'text-white placeholder:text-white/20'
                        }`}
                        disabled={set.completed}
                      />
                    </div>
                  </div>
                  
                  <div className="col-span-3">
                    <div className={`relative flex items-center bg-black/40 rounded-xl overflow-hidden border transition-all duration-300 ${
                      set.completed ? 'border-[#00ff88]/30' : 'border-white/5 focus-within:border-[#7c3aed]/50 focus-within:bg-black/60'
                    }`}>
                      <input 
                        type="number" 
                        value={set.reps || ''}
                        onChange={e => handleSetUpdate(exIndex, setIndex, 'reps', parseInt(e.target.value) || 0)}
                        placeholder="0"
                        className={`w-full bg-transparent py-2 md:py-3 text-center font-mono text-lg md:text-xl outline-none transition-all ${
                          set.completed ? 'text-[#00ff88] font-bold' : 'text-white placeholder:text-white/20'
                        }`}
                        disabled={set.completed}
                      />
                    </div>
                  </div>

                  <div className="col-span-3">
                    <div className={`relative flex items-center bg-black/40 rounded-xl overflow-hidden border transition-all duration-300 ${
                      set.completed ? 'border-[#00ff88]/30' : 'border-white/5 focus-within:border-blue-500/50 focus-within:bg-black/60'
                    }`}>
                      <input 
                        type="number" 
                        value={set.rir !== undefined ? set.rir : ''}
                        onChange={e => handleSetUpdate(exIndex, setIndex, 'rir', parseInt(e.target.value) || 0)}
                        placeholder="RIR"
                        min="0"
                        max="5"
                        className={`w-full bg-transparent py-2 md:py-3 text-center font-mono text-lg md:text-xl outline-none transition-all ${
                          set.completed ? (set.rir !== undefined && set.rir <= 3 ? 'text-blue-400 font-bold' : 'text-gray-400') : 'text-white placeholder:text-white/20'
                        }`}
                        disabled={set.completed}
                      />
                    </div>
                  </div>
                  
                  <div className="col-span-2 flex justify-center relative">
                    <button 
                      onClick={() => toggleSetComplete(exIndex, setIndex)}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                        set.completed 
                          ? 'bg-[#00ff88] text-[#0a0a0f] shadow-[0_0_20px_rgba(0,255,136,0.5)]' 
                          : 'bg-white/5 text-gray-500 hover:bg-[#00ff88]/20 hover:text-[#00ff88] hover:scale-110'
                      }`}
                    >
                      <Check className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
              
              <div className="flex justify-center gap-4 mt-4 pt-4 border-t border-white/5">
                <button 
                  onClick={() => handleRemoveSet(exIndex)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-400 rounded-xl transition-all font-medium text-sm flex items-center gap-2"
                >
                  - Remover
                </button>
                <button 
                  onClick={() => handleAddExtraSet(exIndex)}
                  className="px-4 py-2 bg-[#00ff88]/10 hover:bg-[#00ff88]/20 text-[#00ff88] rounded-xl transition-all font-medium text-sm flex items-center gap-2"
                >
                  + Adicionar Série
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button 
        onClick={finishWorkout}
        className="w-full mt-10 py-5 rounded-2xl bg-gradient-to-r from-[#00ff88] to-[#00cc6a] text-[#0a0a0f] font-bold text-xl hover:shadow-[0_0_30px_rgba(0,255,136,0.3)] transition-all"
      >
        Finalizar Treino
      </button>
    </div>
  );
}
