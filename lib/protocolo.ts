// O protocolo de séries e repetições do app, num lugar só.
//
// POR QUE EXTRAIR
//
// Estes números viviam dentro da string do prompt em app/api/treino/route.ts. Funcionava
// enquanto só a IA prescrevia. Quando a sessão de abdominal passou a ser montada em código,
// eu reescrevi "3 séries de 12-15" na tela — e o protocolo diz 4 séries. Dois lugares com a
// mesma regra divergem no primeiro que alguém esquece de atualizar, e aqui a divergência
// aparece como prescrição errada na tela do aluno.
//
// O abdômen é ISOLADO segundo o próprio protocolo, que o cita pelo nome na lista: "rosca,
// elevação lateral, cadeira extensora, tríceps, panturrilha, abdômen".

export type Objetivo = 'hipertrofia' | 'emagrecimento';
export type TipoDeEsforco = 'composto' | 'isolado';

/** Séries da SEMANA 1. As seguintes somam uma por semana, até o deload. */
export const SERIES_INICIAIS: Record<TipoDeEsforco, number> = {
  composto: 3,
  isolado: 4,
};

export const REPETICOES: Record<Objetivo, Record<TipoDeEsforco, string>> = {
  hipertrofia:   { composto: '6-10',  isolado: '12-15' },
  emagrecimento: { composto: '10-12', isolado: '15-20' },
};

/** Descanso em segundos. Emagrecimento usa intervalo curto para manter o gasto calórico. */
export const DESCANSO: Record<Objetivo, number> = {
  hipertrofia: 75,
  emagrecimento: 45,
};

export const SEMANAS_DO_CICLO = 4;

/** Normaliza o que vem do perfil ("Hipertrofia", "Emagrecimento", "Perder peso"). */
export function normalizarObjetivo(texto: string | undefined | null): Objetivo {
  const t = (texto || '').toLowerCase();
  if (t.includes('emagre') || t.includes('perder') || t.includes('gordura')) return 'emagrecimento';
  return 'hipertrofia';
}

export interface Prescricao {
  series: number;
  reps: string;
  descansoSegundos: number;
  /** true na semana 4 — volume reduzido, não é hora de somar série. */
  deload: boolean;
}

/**
 * O que prescrever nesta semana do ciclo.
 *
 * Semana 1 parte do número inicial, 2 e 3 somam uma série cada, e a 4 é deload — volta ao
 * número inicial com uma série a menos. Insistir num corpo que acumulou três semanas de
 * volume crescente é como a maioria das pessoas estagna ou se machuca.
 */
export function prescrever(
  tipo: TipoDeEsforco,
  objetivo: Objetivo,
  semana: number = 1
): Prescricao {
  const base = SERIES_INICIAIS[tipo];
  const s = Math.min(Math.max(Math.round(semana) || 1, 1), SEMANAS_DO_CICLO);
  const deload = s === SEMANAS_DO_CICLO;

  return {
    // Semana 1 = base, 2 = base+1, 3 = base+2, 4 = base-1 (nunca menos que 2 séries).
    series: deload ? Math.max(2, base - 1) : base + (s - 1),
    reps: REPETICOES[objetivo][tipo],
    descansoSegundos: DESCANSO[objetivo],
    deload,
  };
}

/** Texto curto da semana, para a tela explicar por que o número mudou. */
export function descreverSemana(semana: number): string {
  const s = Math.min(Math.max(Math.round(semana) || 1, 1), SEMANAS_DO_CICLO);
  if (s === SEMANAS_DO_CICLO) return 'Semana 4 · deload — volume menor de propósito, para o corpo recuperar.';
  return `Semana ${s} de ${SEMANAS_DO_CICLO}`;
}
