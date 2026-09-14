import { useEffect } from 'react';
import { saveWorkoutState } from '@/utils/workoutCache';
import type { ActiveExercise } from '@/lib/types';

/**
 * Salva o treino em andamento no armazenamento local a cada mudança, para o aluno não perder as
 * séries já marcadas se fechar o app ou o navegador descartar a aba no meio do treino.
 *
 * Só grava enquanto o treino está rodando: depois de concluído, quem limpa é a própria página.
 */
export function useWorkoutPersistence(params: {
  userId: string | null;
  planId: string | undefined;
  sessionIndex: number;
  activeExercises: ActiveExercise[];
  startTime: number;
  concluido: boolean;
}) {
  const { userId, planId, sessionIndex, activeExercises, startTime, concluido } = params;

  useEffect(() => {
    if (!userId || !planId || activeExercises.length === 0 || concluido) return;
    saveWorkoutState(userId, planId, sessionIndex, activeExercises, startTime);
  }, [userId, planId, sessionIndex, activeExercises, startTime, concluido]);
}
