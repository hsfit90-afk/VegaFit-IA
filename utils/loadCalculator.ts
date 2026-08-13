import { WorkoutHistoryEntry } from '@/lib/types';

/**
 * Calcula a Força Máxima (1RM - One Rep Max) usando a fórmula de Epley.
 * 1RM = Peso * (1 + 0.0333 * Repetições)
 * Usamos um limite prático de 20 repetições, pois a fórmula perde precisão acima disso.
 */
export const calculate1RM = (weight: number, reps: number): number => {
  if (weight <= 0 || reps <= 0) return 0;
  const effectiveReps = Math.min(reps, 20); 
  return weight * (1 + 0.0333 * effectiveReps);
};

/**
 * Analisa o histórico de treinos do usuário para encontrar o maior 1RM estimado
 * para um exercício específico.
 */
export const getHistorical1RM = (history: WorkoutHistoryEntry[], exerciseName: string): number => {
  let max1RM = 0;

  if (!history || !Array.isArray(history)) return 0;

  history.forEach(session => {
    if (!session.exercises) return;
    const exercise = session.exercises.find(e => 
      e.name.trim().toLowerCase() === exerciseName.trim().toLowerCase()
    );

    if (exercise && exercise.sets) {
      exercise.sets.forEach(set => {
        if (set.completed && set.weight > 0 && set.reps > 0) {
          const current1RM = calculate1RM(set.weight, set.reps);
          if (current1RM > max1RM) {
            max1RM = current1RM;
          }
        }
      });
    }
  });

  return Math.round(max1RM);
};

/**
 * Calcula a carga exata baseada nos protocolos científicos.
 * - Emagrecimento (EASO/ACSM): Alta repetição (12-20), carga menor (~55-65% do 1RM).
 * - Hipertrofia (Schoenfeld): Repetições médias (8-12), carga maior (~70-80% do 1RM).
 * Se não tivermos o 1RM (primeira vez fazendo), retorna 0 para o usuário preencher.
 */
export const calculateTargetWeight = (oneRM: number, userGoal: string, targetReps: number, isDeload: boolean = false): number => {
  if (oneRM <= 0) return 0; // Usuário nunca fez o exercício

  const goal = (userGoal || 'Hipertrofia').toLowerCase();
  const isWeightLoss = goal.includes('emagrec') || goal.includes('perder peso');

  let percentage = 0.75; // Padrão Hipertrofia (75%)

  if (isWeightLoss) {
    // Protocolo EASO/ACSM
    if (targetReps >= 15) percentage = 0.55;
    else if (targetReps >= 12) percentage = 0.65;
    else percentage = 0.65; 
  } else {
    // Protocolo Schoenfeld / Hipertrofia
    if (targetReps <= 5) percentage = 0.85; // Foco em Força
    else if (targetReps <= 10) percentage = 0.75;
    else percentage = 0.70;
  }

  // Calcula o peso alvo
  let targetWeight = oneRM * percentage;
  
  // Se for semana de Deload (Descanso Ativo), reduz a carga para cerca de 50-60% do 1RM (ou tira 20% da carga alvo)
  if (isDeload) {
    targetWeight = targetWeight * 0.8; 
  }
  
  // Arredonda para o inteiro mais próximo (ex: 45kg) para facilitar no app
  return Math.round(targetWeight);
};
