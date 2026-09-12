import type { WorkoutPlan, WorkoutHistoryEntry } from './types';

/**
 * Periodização relativa ao ALUNO, não ao calendário nem à criação do plano.
 *
 * Regras:
 *  - A semana 1 começa quando o aluno EXECUTA o primeiro treino do plano (cycleStartedAt), não
 *    quando o plano foi gerado. Personal que monta na segunda e aluno que começa na quinta não
 *    perde três dias de semana 1.
 *  - Ficou INACTIVITY_RESET_DAYS ou mais sem treinar: volta pra semana 1 do mesmo plano. Duas
 *    semanas parado o corpo destreinou; retomar na semana 3 com volume alto é pedir lesão.
 *  - Depois da semana CYCLE_WEEKS o ciclo recomeça (semana 5 = semana 1 do 2º mesociclo). Antes
 *    o cálculo travava em Math.min(..., 4) e o aluno ficava em deload pra sempre.
 *
 * Função pura: quem persiste o novo cycleStartedAt é a tela de treino, no ato do início — visitar
 * a home não conta como "voltar a treinar".
 */

export const CYCLE_WEEKS = 4;
export const INACTIVITY_RESET_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface PeriodizationState {
  /** Semana dentro do ciclo atual: 1..CYCLE_WEEKS. */
  week: number;
  /** Mesociclo atual: 1 no primeiro ciclo do plano, 2 depois de CYCLE_WEEKS semanas, etc. */
  cycle: number;
  /** Aluno ainda não fez nenhuma sessão deste plano. */
  isFirstStart: boolean;
  /** Último treino foi há INACTIVITY_RESET_DAYS ou mais — a semana já vem como 1. */
  needsReset: boolean;
  /** Dias desde o último treino deste plano, ou null se nunca treinou. */
  daysSinceLastSession: number | null;
  /** Timestamp que a tela de treino deve gravar em cycleStartedAt ao iniciar, se for o caso. */
  anchorToPersist: number | null;
}

export function computePeriodization(
  plan: Pick<WorkoutPlan, 'id' | 'createdAt' | 'cycleStartedAt'>,
  history: Pick<WorkoutHistoryEntry, 'workoutPlanId' | 'date'>[],
  now: number = Date.now()
): PeriodizationState {
  const dates = history
    .filter(h => h.workoutPlanId === plan.id)
    .map(h => h.date)
    .filter(d => Number.isFinite(d));

  const lastSession = dates.length ? Math.max(...dates) : null;
  const firstSession = dates.length ? Math.min(...dates) : null;
  const daysSinceLastSession = lastSession === null ? null : Math.floor((now - lastSession) / DAY_MS);

  // Nunca treinou: semana 1, e o início do treino vira a âncora.
  if (lastSession === null) {
    return { week: 1, cycle: 1, isFirstStart: true, needsReset: false, daysSinceLastSession, anchorToPersist: now };
  }

  const needsReset = daysSinceLastSession !== null && daysSinceLastSession >= INACTIVITY_RESET_DAYS;
  if (needsReset) {
    return { week: 1, cycle: 1, isFirstStart: false, needsReset: true, daysSinceLastSession, anchorToPersist: now };
  }

  // Âncora: o cycleStartedAt gravado; planos anteriores a essa regra caem no primeiro treino, e só
  // em último caso na criação do plano (comportamento antigo). A âncora nunca pode ser posterior
  // ao último treino — se for, foi gravada num reset que o aluno ainda não "consumou" treinando.
  let anchor = plan.cycleStartedAt ?? firstSession ?? plan.createdAt;
  if (anchor > lastSession) anchor = firstSession ?? plan.createdAt;

  const daysSinceAnchor = Math.max(0, Math.floor((now - anchor) / DAY_MS));
  const rawWeek = Math.floor(daysSinceAnchor / 7) + 1;
  const week = ((rawWeek - 1) % CYCLE_WEEKS) + 1;
  const cycle = Math.floor((rawWeek - 1) / CYCLE_WEEKS) + 1;

  // Plano antigo sem âncora gravada: persiste a que acabamos de deduzir pra ficar estável.
  const anchorToPersist = plan.cycleStartedAt == null ? anchor : null;

  return { week, cycle, isFirstStart: false, needsReset: false, daysSinceLastSession, anchorToPersist };
}
