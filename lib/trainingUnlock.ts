import type { WorkoutHistoryEntry } from './types';

/**
 * Libera os métodos de treino avançados por CONSTÂNCIA COMPROVADA, não por nível declarado.
 *
 * Motivo: o nível é auto-declarado e não se sustenta. Nos dados reais do app, dois usuários se
 * declararam "Avançado" e somavam 1 treino feito entre os dois. Drop Set, Rest-Pause e Pirâmide
 * levam à falha muscular — em quem ainda não tem base de força e técnica, é risco de lesão, não
 * ganho. Histórico de treino é fato; nível declarado é opinião.
 *
 * Duas condições SOMADAS por fase, porque cada uma sozinha tem furo:
 *  - só tempo  -> quem cadastra e some desbloqueia sem nunca ter treinado;
 *  - só volume -> 48 treinos em 3 semanas não constroem base nenhuma.
 *
 * O relógio começa no PRIMEIRO TREINO, não no cadastro — mesma âncora de lib/periodization.ts.
 */

export type MethodId = 'tradicional' | 'superset' | 'circuito' | 'drop_set' | 'rest_pause' | 'piramide';

const DAY_MS = 24 * 60 * 60 * 1000;
const MES_MS = 30 * DAY_MS;

/** Fase 1 é o ponto de partida de todo aluno; 2 e 3 exigem meses E treinos. */
export const FASES: { fase: 1 | 2 | 3; meses: number; treinos: number; libera: MethodId[] }[] = [
  { fase: 1, meses: 0, treinos: 0, libera: ['tradicional'] },
  { fase: 2, meses: 3, treinos: 24, libera: ['superset', 'circuito'] },
  { fase: 3, meses: 6, treinos: 48, libera: ['drop_set', 'rest_pause', 'piramide'] },
];

export interface UnlockState {
  fase: 1 | 2 | 3;
  liberados: MethodId[];
  treinosFeitos: number;
  mesesTreinando: number;
  /** O que falta pra próxima fase; null quando já está na fase 3. */
  proximaFase: { fase: 2 | 3; mesesFaltando: number; treinosFaltando: number } | null;
}

export function computeUnlock(
  history: Pick<WorkoutHistoryEntry, 'date'>[],
  now: number = Date.now()
): UnlockState {
  const datas = (history || []).map(h => h.date).filter(d => Number.isFinite(d));
  const treinosFeitos = datas.length;
  const primeiro = treinosFeitos ? Math.min(...datas) : null;
  const mesesTreinando = primeiro === null ? 0 : Math.floor((now - primeiro) / MES_MS);

  let fase: 1 | 2 | 3 = 1;
  const liberados: MethodId[] = [];

  for (const f of FASES) {
    // Fases são cumulativas: não libera a 3 sem ter cumprido a 2.
    if (mesesTreinando >= f.meses && treinosFeitos >= f.treinos) {
      fase = f.fase;
      liberados.push(...f.libera);
    } else {
      break;
    }
  }

  const seguinte = FASES.find(f => f.fase === fase + 1);
  const proximaFase = seguinte
    ? {
        fase: seguinte.fase as 2 | 3,
        mesesFaltando: Math.max(0, seguinte.meses - mesesTreinando),
        treinosFaltando: Math.max(0, seguinte.treinos - treinosFeitos),
      }
    : null;

  return { fase, liberados, treinosFeitos, mesesTreinando, proximaFase };
}

/** Texto curto do que falta, pra mostrar no cartão bloqueado. */
export function textoBloqueio(estado: UnlockState, metodo: MethodId): string | null {
  if (estado.liberados.includes(metodo)) return null;
  const faseDoMetodo = FASES.find(f => f.libera.includes(metodo));
  if (!faseDoMetodo) return null;

  const faltamTreinos = Math.max(0, faseDoMetodo.treinos - estado.treinosFeitos);
  const faltamMeses = Math.max(0, faseDoMetodo.meses - estado.mesesTreinando);

  if (faltamTreinos > 0 && faltamMeses > 0) {
    return `Faltam ${faltamTreinos} treinos e ${faltamMeses} ${faltamMeses === 1 ? 'mês' : 'meses'}`;
  }
  if (faltamTreinos > 0) return `Faltam ${faltamTreinos} ${faltamTreinos === 1 ? 'treino' : 'treinos'}`;
  if (faltamMeses > 0) return `Faltam ${faltamMeses} ${faltamMeses === 1 ? 'mês' : 'meses'} de constância`;
  return 'Bloqueado';
}
