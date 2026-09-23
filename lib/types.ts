export type MuscleGroup = 'Peito' | 'Costas' | 'Ombro' | 'Bíceps' | 'Tríceps' | 'Pernas (quadríceps)' | 'Posterior de coxa' | 'Glúteos' | 'Core/Abdômen' | 'Panturrilhas' | 'Lombar';

export type Equipment = 'Barra' | 'Haltere' | 'Máquina' | 'Cabo' | 'Sem equipamento';

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  secondaryMuscles: string[];
  equipment: string;
  difficulty: number;
  youtubeId?: string;
  mediaUrl?: string; // New: Custom GIF/Video URL
  userId?: string; // New: To identify if it's a global or custom exercise
  instructions: string[];
  commonMistakes: string[];
  variations?: string[];
}

export interface WorkoutExercise {
  id: string; // id único para esta instância no treino
  exerciseId: string; // id do banco
  name: string; // nome do exercício para facilidade
  muscleGroup: string;
  sets: number;
  reps: string; // ex: "10-12"
  restSeconds: number;
  tips: string;
  method?: string;
  youtubeSearchTerm: string;
  targetWeights?: number[]; // Cargas alvo por série
  targetReps?: number[];    // Repetições alvo por série
  targetLabels?: string[];  // Nomes personalizados para as séries (ex: "S1", "Aquec", "Drop")
}

export interface WorkoutSession {
  id: string;
  name: string;
  exercises: WorkoutExercise[];
}

/**
 * Aeróbico do plano. Fica FORA de `sessions` de propósito: o rodízio A/B/C é aritmética de
 * módulo sobre sessions.length em quatro lugares, e um quarto item entraria no rodízio por
 * padrão. Aqui ele é avulso — o aluno faz em dia livre ou depois do treino.
 *
 * É prescrito por TEMPO TOTAL da sessão, não por exercício: "30 minutos, escolha o aparelho".
 * Por isso não tem sets, reps nem carga — as três grandezas não significam nada numa esteira.
 */
export interface CardioSession {
  name: string;
  /** Tempo total da sessão. É a única grandeza prescrita. */
  durationMinutes: number;
  /** Como o aluno percebe o esforço, em linguagem de aluno (não em bpm nem %FCmax). */
  intensity: string;
  /** Aparelhos ou modalidades sugeridos. O aluno escolhe um. */
  options: string[];
  notes?: string;
}

export interface WorkoutPlan {
  id: string;
  name: string;
  split: string;
  sessions: WorkoutSession[];
  /** Ver CardioSession. Ausente em planos gerados antes da migração 28. */
  cardioSession?: CardioSession | null;
  createdAt: number;
  cycleStartedAt?: number | null; // timestamp do início do ciclo de periodização atual (ver lib/periodization.ts)
  trainingMethod?: string; // tradicional | superset | drop_set | piramide | rest_pause | circuito
  equipment?: string; // Academia completa | Halteres em casa | Barra e anilhas | Sem equipamento (calistenia)
}

export interface ActiveSet {
  label?: string;
  reps: number;
  weight: number;
  rir?: number; // Reps in Reserve
  completed: boolean;
}

export interface ActiveExercise {
  workoutExerciseId: string;
  exerciseId: string;
  name: string;
  muscleGroup: string;
  targetSets: number;
  sets: ActiveSet[];
}

export interface WorkoutHistoryEntry {
  id: string;
  date: number; // timestamp
  workoutPlanId: string;
  workoutPlanName: string;
  sessionId: string;
  sessionName: string;
  durationSeconds: number;
  totalVolume: number;
  exercises: ActiveExercise[];
}

export interface UserProfile {
  name: string;
  age: number;
  weight: number;
  height: number;
  goal: string;
  level: string;
  intent: string;
  geminiApiKey: string;
  soundEnabled: boolean;
  defaultRestTimer: number;
  bannedExercises?: string[];
  favoriteExercises?: string[];
  role?: 'client' | 'trainer' | 'master';
  trainerId?: string | null;
  maxClients?: number;
  gender?: 'M' | 'F';
  waist?: number;
  hip?: number;
  trainingLocation?: string;
}
