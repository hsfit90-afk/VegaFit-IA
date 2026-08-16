import { ActiveExercise } from '@/lib/types';

interface CachedWorkoutState {
  planId: string;
  sessionIndex: number;
  activeExercises: ActiveExercise[];
  startTime: number;
  savedAt: number;
}

const MAX_AGE_MS = 8 * 60 * 60 * 1000; // não restaura treinos "esquecidos" de mais de 8h atrás

function cacheKey(userId: string) {
  return `vegafit_active_workout_${userId}`;
}

export function saveWorkoutState(
  userId: string,
  planId: string,
  sessionIndex: number,
  activeExercises: ActiveExercise[],
  startTime: number
) {
  if (typeof window === 'undefined') return;
  const state: CachedWorkoutState = { planId, sessionIndex, activeExercises, startTime, savedAt: Date.now() };
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(state));
  } catch {
    // localStorage cheio ou indisponível — não é crítico, apenas perde o cache offline
  }
}

export function loadWorkoutState(userId: string, planId: string, sessionIndex: number): CachedWorkoutState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    const state: CachedWorkoutState = JSON.parse(raw);
    if (state.planId !== planId || state.sessionIndex !== sessionIndex) return null;
    if (Date.now() - state.savedAt > MAX_AGE_MS) return null;
    return state;
  } catch {
    return null;
  }
}

export function clearWorkoutState(userId: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(cacheKey(userId));
  } catch {
    // ignora
  }
}
