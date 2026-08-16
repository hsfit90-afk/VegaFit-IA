"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, WorkoutPlan, WorkoutHistoryEntry } from '@/lib/types';
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
          role: profileData.role || 'client',
          trainerId: profileData.trainer_id || null,
          maxClients: profileData.max_clients || 5,
          gender: profileData.gender || 'M',
          waist: profileData.waist || 0,
          hip: profileData.hip || 0,
        });

        const path = window.location.pathname;
        const role = profileData.role || 'client';
        
        // Removido o bloqueio estrito de rotas para permitir navegação
        // Apenas redireciona se estiver na tela de login/onboarding
        if (path === '/login' || path === '/register') {
          if (role === 'master') {
            router.push('/admin');
          } else if (role === 'trainer') {
            router.push('/trainer');
          } else {
            router.push('/');
          }
        }
      } else if (!profileData && mounted) {
        const path = window.location.pathname;
        if (path !== '/onboarding' && path !== '/login' && path !== '/register') {
          router.push('/onboarding');
          // Important: We don't return here so that setIsLoaded(true) is reached
        }
      }

      // Load Plans
      const { data: plansData } = await supabase.from('workout_plans').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (plansData && mounted) {
        const parsedPlans = plansData.map(p => ({
          id: p.id,
          name: p.name,
          split: p.split,
          sessions: p.sessions,
          createdAt: new Date(p.created_at).getTime()
        }));
        setWorkoutPlans(parsedPlans);
        
        // Load activePlanId from localStorage, fallback to first plan
        const storedActivePlanId = localStorage.getItem(`vegafit_active_plan_${user.id}`);
        const validActivePlan = parsedPlans.find(p => p.id === storedActivePlanId);
        if (mounted) {
          setActivePlanIdState(validActivePlan ? storedActivePlanId : (parsedPlans[0]?.id || null));
        }
      }

      // Load History
      const { data: historyData } = await supabase.from('workout_history').select('*').eq('user_id', user.id).order('date', { ascending: false });
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
      const { data: weightData } = await supabase
        .from('body_weight_history')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: true });
      
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
      banned_exercises: newProfile.bannedExercises || [],
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

  const addWorkoutPlan = async (plan: WorkoutPlan) => {
    setWorkoutPlans(prev => [plan, ...prev]);
    setActivePlanIdState(plan.id);
    setCurrentSessionIndex(0);
    if (!userId) return;

    if (userId) {
      localStorage.setItem(`vegafit_active_plan_${userId}`, plan.id);
    }

    await supabase.from('workout_plans').insert({
      id: plan.id,
      user_id: userId,
      name: plan.name,
      split: plan.split,
      sessions: plan.sessions
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
      sessions: plan.sessions
    }).eq('id', plan.id).eq('user_id', userId);
  };

  const deleteWorkoutPlan = async (planId: string) => {
    const remaining = workoutPlans.filter(p => p.id !== planId);
    setWorkoutPlans(remaining);
    
    // Se deletou o plano ativo, muda para o próximo
    if (activePlanId === planId) {
      const newActivePlanId = remaining[0]?.id || null;
      setActivePlanIdState(newActivePlanId);
      if (userId && newActivePlanId) {
        localStorage.setItem(`vegafit_active_plan_${userId}`, newActivePlanId);
      }
    }
    
    if (!userId) return;
    await supabase.from('workout_plans').delete().eq('id', planId).eq('user_id', userId);
  };

  const setActivePlan = (planId: string) => {
    setActivePlanIdState(planId);
    setCurrentSessionIndex(0);
    if (userId) {
      localStorage.setItem(`vegafit_active_plan_${userId}`, planId);
    }
    // Reset session index no Supabase
    if (userId) {
      supabase.from('user_session_index').upsert({
        user_id: userId,
        current_session_index: 0
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
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-3xl mb-8" />
        <Skeleton className="h-40 rounded-2xl" />
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
