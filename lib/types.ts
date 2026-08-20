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

export interface WorkoutPlan {
  id: string;
  name: string;
  split: string;
  sessions: WorkoutSession[];
  createdAt: number;
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
  role?: 'client' | 'trainer' | 'master';
  trainerId?: string | null;
  maxClients?: number;
  gender?: 'M' | 'F';
  waist?: number;
  hip?: number;
  trainingLocation?: string;
}
