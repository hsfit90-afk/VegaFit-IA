import { useEffect } from 'react';
import { saveWorkoutState } from '@/utils/workoutCache';
import type { ActiveExercise } from '@/lib/types';

/**
 * Salva o treino em andamento no armazenamento local a cada mudança, para o aluno não perder as
 * séries já marcadas se fechar o app ou o navegador descartar a aba no meio do treino.
 *
 * Só grava enquanto o treino está rodando: depois de concluído, quem limpa é a própria página.
 *
 * E só DEPOIS que ele começa de verdade. `startTime === 0` significa que nenhuma série foi
 * concluída ainda — abrir a tela e sair não pode deixar um treino "em andamento" guardado,
 * que é o que fazia a tela reabrir horas depois com o cronômetro correndo (01/11/2026).
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
    if (startTime === 0) return;
    saveWorkoutState(userId, planId, sessionIndex, activeExercises, startTime);
  }, [userId, planId, sessionIndex, activeExercises, startTime, concluido]);
}
