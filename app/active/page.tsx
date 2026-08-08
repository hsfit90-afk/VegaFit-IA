"use client";

import { useState, useEffect, useRef } from 'react';
import { useAppContext } from '@/app/context/AppContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, Clock, Play, Trophy, Zap, RefreshCw, Trash2, Share2, Timer, Flame } from 'lucide-react';
import { ActiveExercise, ActiveSet, WorkoutHistoryEntry } from '@/lib/types';
import confetti from 'canvas-confetti';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getExercises, deleteExercise } from '@/lib/db/exercises';

export default function ActiveWorkout() {
  const { workoutPlans, addHistoryEntry, profile, currentSessionIndex, advanceSession, updateWorkoutPlan, userId, banExerciseForUser, history, activePlanId } = useAppContext();
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentPlan = activePlanId 
    ? workoutPlans.find(p => p.id === activePlanId) || (workoutPlans.length > 0 ? workoutPlans[0] : null)
    : (workoutPlans.length > 0 ? workoutPlans[0] : null);

  // Usa sessionIndex da URL (quando houve fadiga e home redirecionou) ou o índice normal do contexto
  const urlSessionIndex = searchParams.get('sessionIndex');
  const effectiveIndex = urlSessionIndex !== null ? parseInt(urlSessionIndex) : currentSessionIndex;

  // Usa o índice da sessão atual (A, B, C...) em vez de sempre a sessão 0
  const safeIndex = currentPlan ? effectiveIndex % currentPlan.sessions.length : 0;
  const currentSession = currentPlan ? currentPlan.sessions[safeIndex] : null;

  const [activeExercises, setActiveExercises] = useState<ActiveExercise[]>([]);
  const [startTime, setStartTime] = useState<number>(0);
  const [restTimer, setRestTimer] = useState<number>(0);
  const [isFinished, setIsFinished] = useState(false);
  const [finishedVolume, setFinishedVolume] = useState(0);
  const [finishedDuration, setFinishedDuration] = useState(0);
  const [finishedExercises, setFinishedExercises] = useState<ActiveExercise[]>([]);
  const [showToast, setShowToast] = useState(false);
  // BUG FIX: Substituído o hack window.recentPRs por useState
  const [recentPRs, setRecentPRs] = useState<string[]>([]);
  // FEATURE: Cronômetro ao vivo do treino
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [showVideoFor, setShowVideoFor] = useState<string | null>(null);
  const [libraryExercises, setLibraryExercises] = useState<any[]>([]); // To store DB exercises for mediaUrl

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

  // FEATURE: Cronômetro ao vivo — atualiza a cada segundo
  useEffect(() => {
    if (startTime === 0 || isFinished) return;
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, isFinished]);

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
        <Button onClick={() => router.push('/generator')} size="lg">
          Gerar Treino
        </Button>
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
    
    // BUG FIX: Normalização sem includes() bidirecional — evita falsos positivos
    // Ex: "Peito".includes("") === true (string vazia bate com tudo!)
    const normalize = (s: string) => s ? s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : "";
    const currentMuscle = normalize(currentActiveEx.muscleGroup);

    // Se o muscleGroup estiver vazio ou 'geral', não permite swap (exercício inválido da IA)
    if (!currentMuscle || currentMuscle === 'geral' || currentMuscle === 'desconhecido') {
      alert(`O exercício "${currentActiveEx.name}" não tem um grupo muscular válido definido. Não é possível buscar alternativas.`);
      return;
    }

    const alternatives = libraryExercises.filter(ex => {
      const exMuscle = normalize(ex.muscleGroup);
      // BUG FIX: Comparação ESTRITA por igualdade — sem includes() que causava falsos positivos
      const isSameMuscle = exMuscle === currentMuscle;
      
      return isSameMuscle && 
             ex.id !== currentActiveEx.exerciseId &&
             !banned.includes(ex.id);
    });
    
    if (alternatives.length === 0) {
      alert(`Você não tem outras opções de "${currentActiveEx.muscleGroup || 'mesmo grupo muscular'}" cadastradas na sua biblioteca para fazer a troca.`);
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

    // 2. Atualizar o plano master no Supabase (persiste a troca)
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
        
        // BUG FIX: Não mutamos o array do profile diretamente — criamos uma nova lista
        const currentBanned = [...(profile?.bannedExercises || [])];
        if (!isOwner) currentBanned.push(realExerciseId);

        // BUG FIX: Comparação estrita — sem includes() bidirecional
        const normalize = (s: string) => s ? s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : "";
        const currentMuscle = normalize(currentActiveEx.muscleGroup);

        const alternatives = updatedDb.filter(ex => {
          const exMuscle = normalize(ex.muscleGroup);
          // Comparação estrita por igualdade evita falsos positivos
          return exMuscle === currentMuscle && !currentBanned.includes(ex.id);
        });
        
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
    
    // BUG FIX: Substituído o hack window.recentPRs por useState
    setFinishedVolume(totalVolume);
    setFinishedDuration(durationSeconds);
    setFinishedExercises([...activeExercises]);
    setRecentPRs(newPrs);

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

  // FEATURE: Compartilhar treino concluído via Web Share API
  const handleShare = async () => {
    const durationMin = Math.floor(finishedDuration / 60);
    const completedExNames = finishedExercises.map(ex => `• ${ex.name}`).join('\n');
    const prText = recentPRs.length > 0 ? `\n\n🏆 Recordes pessoais:\n${recentPRs.map(pr => `• ${pr}`).join('\n')}` : '';
    const text = `💪 Treino concluído no VegaFit!\n\n📋 ${currentSession?.name || 'Treino'}\n⏱️ Duração: ${durationMin} min\n🔥 Volume: ${finishedVolume} kg\n\nExercícios:\n${completedExNames}${prText}\n\n🚀 Gerado com IA no VegaFit`;
    
    if (navigator.share) {
      try {
        await navigator.share({ title: 'VegaFit — Treino Concluído!', text });
      } catch (e) { /* usuário cancelou */ }
    } else {
      // Fallback: copia para clipboard
      await navigator.clipboard.writeText(text);
      alert('Resumo copiado! Cole onde quiser 😊');
    }
  };

  if (isFinished) {
    const durationMin = Math.floor(finishedDuration / 60);
    const completedSetsCount = finishedExercises.reduce((acc, ex) => acc + ex.sets.filter(s => s.completed).length, 0);

    return (
      <div className="p-6 md:p-10 max-w-2xl mx-auto text-center pt-12 animate-fade-in pb-32">
        {/* Trophy Icon */}
        <div className="w-24 h-24 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_60px_rgba(0,255,136,0.4)]">
          <Trophy className="w-12 h-12 text-[#0a0a0f]" />
        </div>
        <h1 className="text-4xl font-outfit font-bold mb-2 text-primary">Treino Concluído!</h1>
        <p className="text-foreground-muted mb-8 text-base">Excelente trabalho, {profile?.name || 'Atleta'}! 🔥</p>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-surface border border-border rounded-2xl p-4 flex flex-col items-center gap-2">
            <Timer className="w-5 h-5 text-blue-400" />
            <span className="text-2xl font-mono font-bold text-white">{durationMin}</span>
            <span className="text-[10px] text-foreground-muted uppercase tracking-widest font-semibold">min</span>
          </div>
          <div className="bg-surface border border-border rounded-2xl p-4 flex flex-col items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            <span className="text-2xl font-mono font-bold text-white">{finishedVolume}</span>
            <span className="text-[10px] text-foreground-muted uppercase tracking-widest font-semibold">kg vol.</span>
          </div>
          <div className="bg-surface border border-border rounded-2xl p-4 flex flex-col items-center gap-2">
            <Flame className="w-5 h-5 text-orange-400" />
            <span className="text-2xl font-mono font-bold text-white">{completedSetsCount}</span>
            <span className="text-[10px] text-foreground-muted uppercase tracking-widest font-semibold">séries</span>
          </div>
        </div>

        {/* PR destaque */}
        {recentPRs.length > 0 && (
          <div className="mb-6 p-4 bg-gradient-to-r from-[#ffd700]/10 to-transparent border border-[#ffd700]/30 rounded-2xl text-left">
            <p className="text-[11px] text-[#ffd700]/70 uppercase tracking-widest font-bold mb-2 flex items-center gap-2">
              <Trophy className="w-4 h-4" /> Novos Recordes Pessoais!
            </p>
            {recentPRs.map((pr, i) => (
              <p key={i} className="text-[#ffd700] font-bold font-outfit text-base">{pr}</p>
            ))}
          </div>
        )}

        {/* Botões de ação */}
        <div className="flex flex-col gap-3">
          <Button onClick={handleShare} variant="outline" size="lg" className="border-primary/40 text-primary hover:bg-primary/10 gap-2">
            <Share2 className="w-5 h-5" />
            Compartilhar Treino
          </Button>
          <Button onClick={() => router.push('/')} size="lg">
            Voltar ao Início
          </Button>
        </div>

        {/* Toast de volume (fica embaixo da tela) */}
        {showToast && (
          <div className="fixed bottom-6 left-6 right-6 md:left-auto md:right-10 md:bottom-10 flex flex-col gap-3 z-50">
            <div className="bg-background/90 border border-primary/30 text-primary p-4 rounded-xl backdrop-blur-xl animate-fade-in shadow-[0_0_30px_rgba(0,255,136,0.15)] flex items-center gap-4">
              <div className="bg-primary/20 p-3 rounded-lg">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-xs m-0 text-white/70 uppercase tracking-wider">Volume Alcançado</p>
                <p className="text-primary text-xl font-outfit font-bold m-0">{finishedVolume} kg <span className="text-sm font-normal text-white/50">total</span></p>
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
      <header className="mb-8 sticky top-0 bg-background/80 backdrop-blur-xl z-40 py-4 border-b border-white/[0.08]">
        {/* FEATURE: Cronômetro ao vivo + nome da sessão */}
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-outfit font-bold text-accent">{currentSession.name}</h1>
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl">
            <Clock className="w-4 h-4 text-primary" />
            <span className="font-mono text-primary font-bold text-base">{formatTime(elapsedSeconds)}</span>
          </div>
        </div>
        <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
          <div className="bg-primary h-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
        </div>
        <div className="flex justify-between text-[10px] text-foreground-muted mt-1.5 font-semibold uppercase tracking-wider">
          <span>{completedSets}/{totalSets} séries</span>
          <span>{Math.round(progressPercent)}% concluído</span>
        </div>
      </header>

      {/* Floating Rest Timer */}
      {restTimer > 0 && (
        <div className="fixed bottom-24 right-6 bg-background/80 backdrop-blur-xl border border-primary/50 p-4 rounded-[20px] shadow-[0_0_20px_rgba(0,255,136,0.1)] z-50 flex items-center justify-center animate-pulse">
          <Clock className="w-5 h-5 text-primary mr-2" />
          <span className="font-mono text-primary font-bold text-lg">{formatTime(restTimer)}</span>
        </div>
      )}

      <div className="space-y-6">
        {activeExercises.map((ex, exIndex) => {
          const exercise = currentSession.exercises[exIndex];
          let dbMatch = libraryExercises.find(e => e.id === exercise.exerciseId || e.name.trim().toLowerCase() === ex.name.trim().toLowerCase());
          
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
          <Card key={ex.workoutExerciseId} variant="glass" className="p-0 relative overflow-hidden group">
            {/* Glow effect in background */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-accent/10 rounded-full blur-[80px] -z-10 group-hover:bg-accent/20 transition-all duration-700 pointer-events-none"></div>
            
            {/* Mídia no TOPO (Header do Card) */}
            <div className="w-full bg-black/50 border-b border-border/50">
              {customMediaUrl ? (
                <div className="w-full h-56 md:h-72 lg:h-80 relative flex items-center justify-center bg-black">
                  {customMediaUrl.endsWith('.mp4') ? (
                    <video src={customMediaUrl} autoPlay loop muted playsInline className="w-full h-full object-cover opacity-90" />
                  ) : (
                    <img src={customMediaUrl} alt={ex.name} className="w-full h-full object-contain" />
                  )}
                  <div className="absolute bottom-2 left-3 px-2 py-1 bg-black/60 rounded-md backdrop-blur-md flex items-center gap-1.5 border border-white/10">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                    <span className="text-[10px] text-primary font-bold uppercase tracking-wider">Verificado</span>
                  </div>
                </div>
              ) : (
                <div className="w-full bg-surface-light border-b border-border/50">
                  <iframe
                    src={`https://www.youtube.com/embed?listType=search&list=${searchQuery}&autoplay=0`}
                    title={`Como fazer ${ex.name}`}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-56 md:h-72 lg:h-80"
                  />
                  <div className="px-4 py-2 bg-black/40 flex items-center gap-2 border-t border-white/5">
                    <Play className="w-3 h-3 text-red-400" />
                    <span className="text-xs text-gray-400">Pesquisa YouTube: <span className="text-white font-medium">{exercise.youtubeSearchTerm || ex.name}</span></span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 md:p-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                  <h2 className="text-2xl font-outfit font-bold text-white mb-2">{ex.name}</h2>
                  <p className="text-sm text-primary flex items-center gap-2 mb-2">
                     <Zap className="w-4 h-4 shrink-0" /> {currentSession.exercises[exIndex].tips}
                  </p>
                  {currentSession.exercises[exIndex].method && (() => {
                    // Detecta semana atual baseado na criação do plano (createdAt)
                    const planCreatedAt = currentPlan?.createdAt || Date.now();
                    const daysSinceStart = Math.floor((Date.now() - planCreatedAt) / (1000 * 60 * 60 * 24));
                    const currentWeek = Math.min(Math.floor(daysSinceStart / 7) + 1, 4);

                    // Parseia o texto da IA em semanas (separa por "Semana X")
                    const methodText = currentSession.exercises[exIndex].method || '';
                    const weekRegex = /semana\s+(\d+(?:[–\-–]\d+)?)[:\s]+([^Ss]*?)(?=semana\s+\d|$)/gi;
                    const parsedWeeks: { label: string; content: string; weekNum: number }[] = [];
                    let match;
                    while ((match = weekRegex.exec(methodText)) !== null) {
                      const weekNumStr = match[1].split(/[-–]/)[0];
                      parsedWeeks.push({
                        label: `Semana ${match[1]}`,
                        content: match[2].trim().replace(/\.$/, ''),
                        weekNum: parseInt(weekNumStr),
                      });
                    }

                    // Fallback: se o texto não for parseável, mostra como antes mas formatado
                    if (parsedWeeks.length === 0) {
                      return (
                        <div className="bg-[#0a0a0f] border border-blue-500/30 p-3 rounded-xl mt-2">
                          <p className="text-[11px] text-blue-400 font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5">
                            <span>📅</span> Periodização (4 Semanas)
                          </p>
                          <p className="text-sm text-gray-300 leading-relaxed">{methodText}</p>
                        </div>
                      );
                    }

                    const motivationalMessages: Record<number, string> = {
                      2: 'Semana 2 está chegando! Prepare-se para subir a carga 🔥',
                      3: 'Semana 3 chegando: sua força vai explodir! 💪',
                      4: 'Última semana do ciclo! Prepare o Deload e celebre sua evolução 🏆',
                    };

                    return (
                      <div className="mt-3 rounded-xl overflow-hidden border border-blue-500/20 bg-[#0a0a0f]">
                        {/* Header */}
                        <div className="px-4 py-2.5 border-b border-blue-500/20 flex items-center gap-2">
                          <span className="text-base">📅</span>
                          <span className="text-[11px] text-blue-400 font-bold uppercase tracking-widest">Plano de Periodização — 4 Semanas</span>
                        </div>

                        <div className="p-3 space-y-2">
                          {parsedWeeks.map((week) => {
                            const isCurrentWeek = week.weekNum === currentWeek;
                            const isFuture = week.weekNum > currentWeek;
                            const isPast = week.weekNum < currentWeek;

                            return (
                              <div key={week.label} className={`relative rounded-xl p-3 border transition-all ${
                                isCurrentWeek
                                  ? 'bg-gradient-to-r from-blue-500/15 to-purple-500/10 border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.15)]'
                                  : isPast
                                  ? 'bg-white/[0.03] border-white/5 opacity-60'
                                  : 'bg-white/[0.02] border-white/5'
                              }`}>
                                {/* Badge da semana */}
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                                    isCurrentWeek
                                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                                      : isPast
                                      ? 'bg-green-500/10 text-green-500/70 border border-green-500/20'
                                      : 'bg-white/5 text-gray-500 border border-white/10'
                                  }`}>
                                    {isPast ? '✓ ' : isCurrentWeek ? '▶ ' : '🔒 '}{week.label}
                                  </span>
                                  {isCurrentWeek && (
                                    <span className="text-[9px] bg-blue-500 text-white font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                                      AGORA
                                    </span>
                                  )}
                                </div>

                                {/* Conteúdo — bloqueado ou visível */}
                                {isFuture ? (
                                  <div className="relative">
                                    <p className="text-sm text-gray-400 blur-[4px] select-none pointer-events-none leading-relaxed">
                                      {week.content || 'Conteúdo desbloqueado em breve...'}
                                    </p>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                                      <span className="text-lg">🔒</span>
                                      <p className="text-[10px] text-gray-400 font-semibold text-center">
                                        {motivationalMessages[week.weekNum] || 'Continue treinando para desbloquear!'}
                                      </p>
                                    </div>
                                  </div>
                                ) : (
                                  <p className={`text-sm leading-relaxed ${isCurrentWeek ? 'text-white font-medium' : 'text-gray-500'}`}>
                                    {week.content}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Footer motivacional */}
                        <div className="px-4 py-2 border-t border-blue-500/10 bg-blue-500/5">
                          <p className="text-[10px] text-blue-400/70 text-center font-medium">
                            🚀 Ciclo Semana {currentWeek}/4 — Complete cada semana para evoluir o plano
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                </div>
                <div className="flex flex-wrap gap-3 items-center">
                  {/* Swap and Ban Buttons */}
                  <div className="flex gap-1 mr-2">
                    <button 
                      onClick={() => handleAutoSwap(exIndex)}
                      className="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:text-primary transition-all text-gray-400 flex items-center justify-center shadow-lg"
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
                    ? 'bg-gradient-to-r from-primary/10 to-transparent border-primary/30 shadow-[0_0_20px_rgba(0,255,136,0.15)]' 
                    : 'bg-surface border-border hover:bg-white/[0.06]'
                }`}>
                  <div className="col-span-1 flex justify-center">
                    <span className={`text-xs font-mono font-bold ${ set.completed ? 'text-primary' : 'text-gray-600' }`}>{setIndex + 1}</span>
                  </div>
                  
                  <div className="col-span-3">
                    <div className={`relative flex items-center bg-black/40 rounded-xl overflow-hidden border transition-all duration-300 ${
                      set.completed ? 'border-primary/30' : 'border-border focus-within:border-primary/50 focus-within:bg-black/60'
                    }`}>
                      <input 
                        type="number" 
                        value={set.weight || ''}
                        onChange={e => handleSetUpdate(exIndex, setIndex, 'weight', parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className={`w-full bg-transparent py-2 md:py-3 text-center font-mono text-lg md:text-xl outline-none transition-all ${
                          set.completed ? 'text-primary font-bold' : 'text-white placeholder:text-white/20'
                        }`}
                        disabled={set.completed}
                      />
                    </div>
                  </div>
                  
                  <div className="col-span-3">
                    <div className={`relative flex items-center bg-black/40 rounded-xl overflow-hidden border transition-all duration-300 ${
                      set.completed ? 'border-primary/30' : 'border-border focus-within:border-accent/50 focus-within:bg-black/60'
                    }`}>
                      <input 
                        type="number" 
                        value={set.reps || ''}
                        onChange={e => handleSetUpdate(exIndex, setIndex, 'reps', parseInt(e.target.value) || 0)}
                        placeholder="0"
                        className={`w-full bg-transparent py-2 md:py-3 text-center font-mono text-lg md:text-xl outline-none transition-all ${
                          set.completed ? 'text-primary font-bold' : 'text-white placeholder:text-white/20'
                        }`}
                        disabled={set.completed}
                      />
                    </div>
                  </div>

                  <div className="col-span-3">
                    <div className={`relative flex items-center bg-black/40 rounded-xl overflow-hidden border transition-all duration-300 ${
                      set.completed ? 'border-primary/30' : 'border-border focus-within:border-blue-500/50 focus-within:bg-black/60'
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
                          ? 'bg-primary text-[#0a0a0f] shadow-[0_0_20px_rgba(0,255,136,0.5)]' 
                          : 'bg-white/5 text-gray-500 hover:bg-primary/20 hover:text-primary hover:scale-110'
                      }`}
                    >
                      <Check className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
              
              <div className="flex justify-center gap-4 mt-4 pt-4 border-t border-white/5">
                <Button 
                  onClick={() => handleRemoveSet(exIndex)}
                  variant="ghost"
                  size="sm"
                  className="font-medium text-xs"
                >
                  - Remover
                </Button>
                <Button 
                  onClick={() => handleAddExtraSet(exIndex)}
                  variant="outline"
                  size="sm"
                  className="font-medium text-xs border-primary/50 text-primary hover:bg-primary/10"
                >
                  + Adicionar Série
                </Button>
              </div>
            </div>
            </div>
          </Card>
          );
        })}
      </div>

      <Button 
        onClick={finishWorkout}
        fullWidth
        size="lg"
        className="mt-10 font-bold text-xl shadow-[0_0_30px_rgba(0,255,136,0.3)] h-16"
      >
        Finalizar Treino
      </Button>
    </div>
  );
}
