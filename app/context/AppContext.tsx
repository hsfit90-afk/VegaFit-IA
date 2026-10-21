"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, WorkoutPlan, WorkoutHistoryEntry } from '@/lib/types';
import { proximaSessaoDoPlano } from '@/lib/rotacaoDeSessao';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/Skeleton';

export interface BodyWeightEntry {
  id: string;
  date: number;
  weight: number;
}

interface AppContextState {
  profile: UserProfile | null;
  userId: string | null;
  setProfile: (profile: UserProfile) => void;
  workoutPlans: WorkoutPlan[];
  addWorkoutPlan: (plan: WorkoutPlan) => Promise<void>;
  updateWorkoutPlan: (plan: WorkoutPlan) => Promise<void>;
  deleteWorkoutPlan: (planId: string) => Promise<void>;
  history: WorkoutHistoryEntry[];
  addHistoryEntry: (entry: WorkoutHistoryEntry) => void;
  clearData: () => void;
  currentSessionIndex: number;
  advanceSession: (totalSessions: number) => void;
  resetSessionIndex: () => void;
  banExerciseForUser: (exerciseId: string) => Promise<void>;
  toggleFavoriteExercise: (exerciseId: string) => Promise<void>;
  // Novidades
  bodyWeightHistory: BodyWeightEntry[];
  addBodyWeight: (weight: number) => Promise<void>;
  activePlanId: string | null;
  setActivePlan: (planId: string) => void;
}

const AppContext = createContext<AppContextState | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfileState] = useState<UserProfile | null>(null);
  const [workoutPlans, setWorkoutPlans] = useState<WorkoutPlan[]>([]);
  const [history, setHistory] = useState<WorkoutHistoryEntry[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentSessionIndex, setCurrentSessionIndex] = useState<number>(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [bodyWeightHistory, setBodyWeightHistory] = useState<BodyWeightEntry[]>([]);
  const [activePlanId, setActivePlanIdState] = useState<string | null>(null);

  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (mounted) setIsLoaded(true);
        router.push('/login');
        return;
      }
      if (mounted) setUserId(user.id);

      // Load Profile
      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      
      if (profileData && mounted) {
        setProfileState({
          name: profileData.name,
          age: profileData.age,
          weight: profileData.weight,
          height: profileData.height,
          goal: profileData.goal,
          level: profileData.level,
          intent: profileData.intent,
          geminiApiKey: profileData.gemini_api_key || '',
          soundEnabled: profileData.sound_enabled,
          defaultRestTimer: profileData.default_rest_timer,
          bannedExercises: profileData.banned_exercises || [],
          favoriteExercises: profileData.favorite_exercises || [],
          role: profileData.role || 'client',
          trainerId: profileData.trainer_id || null,
          maxClients: profileData.max_clients || 5,
          gender: profileData.gender || 'M',
          waist: profileData.waist || 0,
          hip: profileData.hip || 0,
          trainingLocation: profileData.training_location || undefined,
          equipamentosCasa: profileData.equipamentos_casa || [],
        });

        const path = window.location.pathname;
        const role = profileData.role || 'client';
        
        // Removido o bloqueio estrito de rotas para permitir navegação
        // Apenas redireciona se estiver na tela de login/onboarding
        if (path === '/login' || path === '/register') {
          router.push(role === 'master' ? '/admin' : '/');
        }
      } else if (!profileData && mounted) {
        const path = window.location.pathname;
        if (path !== '/onboarding' && path !== '/login' && path !== '/register') {
          router.push('/onboarding');
          // Important: We don't return here so that setIsLoaded(true) is reached
        }
      }

      /**
       * Load Plans — com TETO, e trazendo o ativo mesmo que ele seja antigo.
       *
       * Era `select('*')` sem limite, e isso roda em TODA abertura do app. Medido em
       * 15/10/2026: um plano pesa 13 KB em média, e as contas já acumulavam 29, 10 e 9 planos
       * — 340 KB, 148 KB e 134 KB baixados por abertura, quase tudo de planos antigos que
       * ninguém vai abrir. Nada limpa isso, e só cresce a cada treino gerado.
       *
       * Cinco cobre o uso real: o atual e os poucos anteriores que alguém revisita. O ativo
       * entra fora do teto porque pode ser mais velho que os cinco — o profissional pode ter
       * reativado um antigo pelo painel, e perder justo o plano que o aluno usa seria o pior
       * resultado possível.
       *
       * Os planos antigos NÃO são apagados: continuam no banco e aparecem no painel do
       * profissional. Deixar de BAIXAR é diferente de deixar de ter.
       */
      const PLANOS_NO_CONTEXTO = 5;
      const [{ data: recentes }, { data: ativoForaDoTeto }] = await Promise.all([
        supabase.from('workout_plans').select('*').eq('user_id', user.id)
          .order('created_at', { ascending: false }).limit(PLANOS_NO_CONTEXTO),
        profileData?.active_plan_id
          ? supabase.from('workout_plans').select('*')
              .eq('user_id', user.id).eq('id', profileData.active_plan_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      const plansData = (ativoForaDoTeto && !(recentes ?? []).some(p => p.id === ativoForaDoTeto.id))
        ? [ativoForaDoTeto, ...(recentes ?? [])]
        : recentes;
      if (plansData && mounted) {
        const parsedPlans = plansData.map(p => ({
          id: p.id,
          name: p.name,
          split: p.split,
          sessions: p.sessions,
          createdAt: new Date(p.created_at).getTime(),
          cycleStartedAt: p.cycle_started_at ? new Date(p.cycle_started_at).getTime() : null,
          trainingMethod: p.training_method || undefined,
          equipment: p.equipment || undefined,
          cardioSession: p.cardio_session || null,
        }));
        setWorkoutPlans(parsedPlans);
        
        /**
         * O PLANO ATIVO VEM DO BANCO, com o localStorage como reserva.
         *
         * Era só localStorage, e isso deixava o profissional sem alcance: ele entregava um
         * Treino do Personal e, se o aluno já tivesse trocado de plano alguma vez, o aparelho
         * dele continuava apontando para o antigo. O aluno abria no treino velho sem entender
         * por quê, e não havia como consertar do lado de cá.
         *
         * A ordem é: banco → localStorage → plano mais recente. O localStorage ainda serve,
         * para o caso de o perfil não ter carregado; e o mais recente é a rede final, que é o
         * comportamento que já existia.
         *
         * Em qualquer um dos casos, o id só vale se o plano EXISTIR entre os carregados —
         * plano apagado não pode deixar o aluno com a tela vazia.
         */
        const doBanco = profileData?.active_plan_id as string | null | undefined;
        const doAparelho = localStorage.getItem(`vegafit_active_plan_${user.id}`);
        const existe = (id: string | null | undefined) =>
          !!id && parsedPlans.some(p => p.id === id);

        const escolhido = existe(doBanco) ? doBanco!
          : existe(doAparelho) ? doAparelho!
          : (parsedPlans[0]?.id || null);

        if (mounted) {
          setActivePlanIdState(escolhido);
          // Realinha o aparelho com o banco, para a próxima abertura não divergir.
          if (escolhido) localStorage.setItem(`vegafit_active_plan_${user.id}`, escolhido);
        }
      }

      // Load History
      // D2: sem limite, isto baixava o histórico INTEIRO a cada abertura de qualquer tela —
      // o AppContext envolve o app todo. Hoje são poucas sessões; com dois anos de treino são
      // ~300, cada uma com o jsonb `exercises` cheio de séries. Degradação silenciosa que pega
      // justamente quem mais usa o app.
      //
      // 90 cobre tudo que o contexto precisa: streak (dias consecutivos), fadiga das últimas
      // 24h e os gráficos da home. A tela de histórico completo busca por conta própria.
      const HISTORICO_NO_CONTEXTO = 90;
      const { data: historyData } = await supabase
        .from('workout_history')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(HISTORICO_NO_CONTEXTO);
      if (historyData && mounted) {
        const parsedHistory = historyData.map(h => ({
          id: h.id,
          date: new Date(h.date).getTime(),
          workoutPlanId: h.workout_plan_id,
          workoutPlanName: h.workout_plan_name,
          sessionId: h.session_id,
          sessionName: h.session_name,
          durationSeconds: h.duration_seconds,
          totalVolume: h.total_volume,
          exercises: h.exercises
        }));
        setHistory(parsedHistory);
      }

      // Load Session Index
      const { data: indexData } = await supabase.from('user_session_index').select('current_session_index').eq('user_id', user.id).single();
      if (indexData && mounted) {
        setCurrentSessionIndex(indexData.current_session_index);
      }

      // Load Body Weight History (tabela criada separadamente)
      //
      // Teto de 365: era sem limite nenhum, e esta consulta roda em TODA abertura do app. Um
      // aluno que pesa todo dia por três anos traria mil linhas para alimentar um gráfico que
      // mostra o último ano. Ordem invertida para pegar os mais RECENTES quando houver mais
      // que isso, e desinvertida depois porque o gráfico espera ordem cronológica.
      const PESAGENS_NO_CONTEXTO = 365;
      const { data: weightRows } = await supabase
        .from('body_weight_history')
        .select('id, date, weight')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(PESAGENS_NO_CONTEXTO);
      const weightData = weightRows ? [...weightRows].reverse() : null;
      
      if (weightData && mounted) {
        setBodyWeightHistory(weightData.map(w => ({
          id: w.id,
          date: new Date(w.date).getTime(),
          weight: w.weight
        })));
      }

      if (mounted) setIsLoaded(true);
    }

    loadData();

    return () => { mounted = false; };
  }, [supabase]);

  const setProfile = async (newProfile: UserProfile) => {
    setProfileState(newProfile);
    if (!userId) return;
    await supabase.from('profiles').upsert({
      id: userId,
      name: newProfile.name,
      age: newProfile.age,
      weight: newProfile.weight,
      height: newProfile.height,
      goal: newProfile.goal,
      level: newProfile.level,
      intent: newProfile.intent,
      gemini_api_key: newProfile.geminiApiKey,
      sound_enabled: newProfile.soundEnabled,
      default_rest_timer: newProfile.defaultRestTimer,
      // banned_exercises e favorite_exercises NAO entram aqui de proposito.
      //
      // Este upsert grava a linha INTEIRA do perfil a partir da copia em memoria. Enquanto as
      // duas listas vinham no pacote, qualquer salvamento de perfil -- mudar o peso nos
      // ajustes, por exemplo -- reescrevia as listas com o que o navegador tinha carregado na
      // abertura do app. Isso apagava: (a) o que o profissional marcou pelo painel enquanto o
      // aluno estava com o app aberto, e (b) o que o proprio aluno marcou em outro aparelho.
      //
      // As duas listas so mudam por banExerciseForUser e toggleFavoriteExercise, que escrevem
      // a propria coluna e nada mais. Perfil novo nasce com as colunas nulas, e quem le trata
      // nulo como lista vazia.
      role: newProfile.role || 'client',
      trainer_id: newProfile.trainerId || null,
      max_clients: newProfile.maxClients || 5,
      gender: newProfile.gender || 'M',
      waist: newProfile.waist || 0,
      hip: newProfile.hip || 0
    });
  };

  const banExerciseForUser = async (exerciseId: string) => {
    if (!profile || !userId) return;
    const currentBanned = profile.bannedExercises || [];
    if (currentBanned.includes(exerciseId)) return;
    
    const newBanned = [...currentBanned, exerciseId];
    setProfileState({ ...profile, bannedExercises: newBanned });
    await supabase.from('profiles').update({ banned_exercises: newBanned }).eq('id', userId);
  };

  // Espelho de banExerciseForUser, mas alterna (favoritar / desfavoritar). Otimista: atualiza a
  // UI antes do banco, igual ao ban — o coração responde na hora mesmo em rede lenta.
  const toggleFavoriteExercise = async (exerciseId: string) => {
    if (!profile || !userId) return;
    const current = profile.favoriteExercises || [];
    const newFavorites = current.includes(exerciseId)
      ? current.filter(id => id !== exerciseId)
      : [...current, exerciseId];

    setProfileState({ ...profile, favoriteExercises: newFavorites });
    await supabase.from('profiles').update({ favorite_exercises: newFavorites }).eq('id', userId);
  };

  /**
   * Grava o plano ativo no BANCO e no aparelho.
   *
   * Os dois, sempre: o banco e a fonte da verdade e o que da alcance ao profissional; o
   * localStorage e o que faz a proxima abertura ser instantanea, antes de o perfil chegar.
   */
  const gravarPlanoAtivo = async (planId: string | null) => {
    setActivePlanIdState(planId);
    if (!userId) return;
    if (planId) localStorage.setItem(`vegafit_active_plan_${userId}`, planId);
    else localStorage.removeItem(`vegafit_active_plan_${userId}`);
    await supabase.from('profiles').update({ active_plan_id: planId }).eq('id', userId);
  };

  const addWorkoutPlan = async (plan: WorkoutPlan) => {
    setWorkoutPlans(prev => [plan, ...prev]);
    setCurrentSessionIndex(0);
    gravarPlanoAtivo(plan.id);
    if (!userId) return;

    await supabase.from('workout_plans').insert({
      id: plan.id,
      user_id: userId,
      name: plan.name,
      split: plan.split,
      sessions: plan.sessions,
      training_method: plan.trainingMethod || null,
      equipment: plan.equipment || null,
      cardio_session: plan.cardioSession || null,
    });

    await supabase.from('user_session_index').upsert({
      user_id: userId,
      current_session_index: 0
    });
  };

  const updateWorkoutPlan = async (plan: WorkoutPlan) => {
    setWorkoutPlans(prev => prev.map(p => p.id === plan.id ? plan : p));
    if (!userId) return;

    await supabase.from('workout_plans').update({
      name: plan.name,
      split: plan.split,
      sessions: plan.sessions,
      cycle_started_at: plan.cycleStartedAt ? new Date(plan.cycleStartedAt).toISOString() : null,
    }).eq('id', plan.id).eq('user_id', userId);
  };

  const deleteWorkoutPlan = async (planId: string) => {
    const remaining = workoutPlans.filter(p => p.id !== planId);
    setWorkoutPlans(remaining);
    
    // Se deletou o plano ativo, muda para o próximo
    if (activePlanId === planId) {
      gravarPlanoAtivo(remaining[0]?.id || null);
    }
    
    if (!userId) return;
    await supabase.from('workout_plans').delete().eq('id', planId).eq('user_id', userId);
  };

  /**
   * Troca o plano ativo e RETOMA a rotação dele, em vez de zerar.
   *
   * Zerava antes, e o índice é guardado por USUÁRIO e não por plano (`user_session_index` tem
   * `user_id` como chave primária) — então não havia onde lembrar o ponto de cada um.
   *
   * Na prática, quem tinha dois planos fazia Treino A, trocava, Treino A de novo, trocava de
   * volta, Treino A outra vez. Peito a vida inteira, e o dia de perna nunca chegava.
   *
   * A retomada vem do HISTÓRICO, não de uma coluna nova: o dado já existe, não pode
   * dessincronizar, e um plano editado continua retomando no lugar certo. Ver
   * lib/rotacaoDeSessao.ts.
   */
  const setActivePlan = (planId: string) => {
    const plano = workoutPlans.find(p => p.id === planId);
    const retomada = proximaSessaoDoPlano(planId, plano?.sessions ?? [], history);
    setCurrentSessionIndex(retomada);

    gravarPlanoAtivo(planId);

    if (userId) {
      supabase.from('user_session_index').upsert({
        user_id: userId,
        current_session_index: retomada
      });
    }
  };

  const addBodyWeight = async (weight: number) => {
    const newEntry: BodyWeightEntry = {
      id: crypto.randomUUID(),
      date: Date.now(),
      weight
    };
    setBodyWeightHistory(prev => [...prev, newEntry]);
    
    if (!userId) return;
    await supabase.from('body_weight_history').insert({
      id: newEntry.id,
      user_id: userId,
      weight: newEntry.weight,
      date: new Date(newEntry.date).toISOString()
    });
  };

  const addHistoryEntry = async (entry: WorkoutHistoryEntry) => {
    setHistory(prev => [entry, ...prev]);
    if (!userId) return;

    await supabase.from('workout_history').insert({
      id: entry.id,
      user_id: userId,
      workout_plan_id: entry.workoutPlanId,
      workout_plan_name: entry.workoutPlanName,
      session_id: entry.sessionId,
      session_name: entry.sessionName,
      duration_seconds: entry.durationSeconds,
      total_volume: entry.totalVolume,
      exercises: entry.exercises,
      date: new Date(entry.date).toISOString()
    });
  };

  const advanceSession = async (totalSessions: number) => {
    const next = (currentSessionIndex + 1) % totalSessions;
    setCurrentSessionIndex(next);
    if (!userId) return;

    await supabase.from('user_session_index').upsert({
      user_id: userId,
      current_session_index: next
    });
  };

  const resetSessionIndex = async () => {
    setCurrentSessionIndex(0);
    if (!userId) return;

    await supabase.from('user_session_index').upsert({
      user_id: userId,
      current_session_index: 0
    });
  };

  const clearData = async () => {
    setProfileState(null);
    setWorkoutPlans([]);
    setHistory([]);
    setBodyWeightHistory([]);
    setActivePlanIdState(null);
    setCurrentSessionIndex(0);
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (!isLoaded) {
    return (
      <div className="p-5 md:p-8 max-w-7xl mx-auto min-h-screen">
        <div className="mb-8 mt-2 space-y-2">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl mb-8" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  return (
    <AppContext.Provider
      value={{
        profile,
        userId,
        setProfile,
        workoutPlans,
        addWorkoutPlan,
        updateWorkoutPlan,
        deleteWorkoutPlan,
        history,
        addHistoryEntry,
        clearData,
        currentSessionIndex,
        advanceSession,
        resetSessionIndex,
        banExerciseForUser,
        toggleFavoriteExercise,
        bodyWeightHistory,
        addBodyWeight,
        activePlanId,
        setActivePlan,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
