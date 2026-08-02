"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, WorkoutPlan, WorkoutHistoryEntry } from '@/lib/types';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

interface AppContextState {
  profile: UserProfile | null;
  userId: string | null;
  setProfile: (profile: UserProfile) => void;
  workoutPlans: WorkoutPlan[];
  addWorkoutPlan: (plan: WorkoutPlan) => Promise<void>;
  updateWorkoutPlan: (plan: WorkoutPlan) => Promise<void>;
  history: WorkoutHistoryEntry[];
  addHistoryEntry: (entry: WorkoutHistoryEntry) => void;
  clearData: () => void;
  currentSessionIndex: number;
  advanceSession: (totalSessions: number) => void;
  resetSessionIndex: () => void;
  banExerciseForUser: (exerciseId: string) => Promise<void>;
}

const AppContext = createContext<AppContextState | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfileState] = useState<UserProfile | null>(null);
  const [workoutPlans, setWorkoutPlans] = useState<WorkoutPlan[]>([]);
  const [history, setHistory] = useState<WorkoutHistoryEntry[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentSessionIndex, setCurrentSessionIndex] = useState<number>(0);
  const [userId, setUserId] = useState<string | null>(null);

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
      const { data: profileData, error: profileError } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      
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
        });
      } else if (!profileData && mounted) {
        const path = window.location.pathname;
        if (path !== '/onboarding' && path !== '/login' && path !== '/register') {
          console.log("No profile found, redirecting to onboarding...");
          router.push('/onboarding');
          return;
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
      banned_exercises: newProfile.bannedExercises || []
    });
  };

  const banExerciseForUser = async (exerciseId: string) => {
    if (!profile || !userId) return;
    const currentBanned = profile.bannedExercises || [];
    if (currentBanned.includes(exerciseId)) return;
    
    const newBanned = [...currentBanned, exerciseId];
    
    setProfileState({
      ...profile,
      bannedExercises: newBanned
    });

    await supabase.from('profiles').update({
      banned_exercises: newBanned
    }).eq('id', userId);
  };

  const addWorkoutPlan = async (plan: WorkoutPlan) => {
    setWorkoutPlans(prev => [plan, ...prev]);
    setCurrentSessionIndex(0);
    if (!userId) return;

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
    setCurrentSessionIndex(0);
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#00ff88] border-t-transparent rounded-full animate-spin"></div>
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
        history,
        addHistoryEntry,
        clearData,
        currentSessionIndex,
        advanceSession,
        resetSessionIndex,
        banExerciseForUser,
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
