import { describe, it, expect } from 'vitest';
import { calculate1RM, getHistorical1RM, calculateTargetWeight } from '@/utils/loadCalculator';
import type { WorkoutHistoryEntry } from '@/lib/types';

/**
 * Estas funções definem quanto peso o aluno coloca na barra. Um erro aqui não é um número
 * errado na tela — é carga errada numa série até a falha.
 */

// Monta um histórico mínimo com uma série só.
function sessaoCom(nome: string, sets: Array<{ weight: number; reps: number; completed: boolean }>) {
  return {
    id: 's1', date: Date.now(), workoutPlanId: 'p1', workoutPlanName: 'Plano',
    sessionId: 'a', sessionName: 'A', durationSeconds: 0, totalVolume: 0,
    exercises: [{
      workoutExerciseId: 'we1', exerciseId: 'e1', name: nome, muscleGroup: 'Peito',
      targetSets: sets.length,
      sets: sets.map((s, i) => ({ label: `S${i + 1}`, ...s })),
    }],
  } as unknown as WorkoutHistoryEntry;
}

describe('calculate1RM (fórmula de Epley)', () => {
  it('1 repetição devolve praticamente o próprio peso', () => {
    // Epley: 100 * (1 + 0.0333*1) = 103,33
    expect(calculate1RM(100, 1)).toBeCloseTo(103.33, 1);
  });

  it('mais repetições estimam um 1RM maior', () => {
    expect(calculate1RM(100, 10)).toBeGreaterThan(calculate1RM(100, 5));
  });

  it('trava em 20 repetições, onde a fórmula perde precisão', () => {
    // Sem o teto, 50 reps daria um 1RM absurdo e a carga alvo sairia perigosa.
    expect(calculate1RM(100, 50)).toBe(calculate1RM(100, 20));
  });

  it.each([[0, 10], [100, 0], [-50, 10], [100, -5]])(
    'peso %i e reps %i devolvem 0 em vez de número inválido', (peso, reps) => {
      expect(calculate1RM(peso, reps)).toBe(0);
    });
});

describe('getHistorical1RM', () => {
  it('acha o exercício ignorando caixa e espaços', () => {
    const h = [sessaoCom('  Supino Reto com Barra ', [{ weight: 80, reps: 8, completed: true }])];
    expect(getHistorical1RM(h, 'supino reto com barra')).toBeGreaterThan(0);
  });

  it('considera apenas séries CONCLUÍDAS', () => {
    // Série pesada não concluída não pode virar referência de carga.
    const h = [sessaoCom('Supino', [
      { weight: 200, reps: 10, completed: false },
      { weight: 50, reps: 10, completed: true },
    ])];
    expect(getHistorical1RM(h, 'Supino')).toBe(Math.round(calculate1RM(50, 10)));
  });

  it('pega o MAIOR 1RM entre as séries', () => {
    const h = [sessaoCom('Supino', [
      { weight: 60, reps: 10, completed: true },
      { weight: 90, reps: 3, completed: true },
    ])];
    expect(getHistorical1RM(h, 'Supino')).toBe(Math.round(calculate1RM(90, 3)));
  });

  it('devolve 0 para exercício que o aluno nunca fez', () => {
    const h = [sessaoCom('Supino', [{ weight: 80, reps: 8, completed: true }])];
    expect(getHistorical1RM(h, 'Agachamento')).toBe(0);
  });

  it.each([
    { descricao: 'histórico vazio', entrada: [] as unknown },
    { descricao: 'null', entrada: null as unknown },
    { descricao: 'undefined', entrada: undefined as unknown },
  ])('não quebra com $descricao', ({ entrada }) => {
    expect(getHistorical1RM(entrada as never, 'Supino')).toBe(0);
  });
});

describe('calculateTargetWeight', () => {
  const RM = 100;

  it('devolve 0 quando não há 1RM — o aluno preenche na primeira vez', () => {
    expect(calculateTargetWeight(0, 'Hipertrofia', 10)).toBe(0);
  });

  it('hipertrofia: menos repetições pedem percentual maior', () => {
    const forca = calculateTargetWeight(RM, 'Hipertrofia', 5);
    const medio = calculateTargetWeight(RM, 'Hipertrofia', 10);
    const alto = calculateTargetWeight(RM, 'Hipertrofia', 15);
    expect(forca).toBeGreaterThan(medio);
    expect(medio).toBeGreaterThan(alto);
  });

  it('emagrecimento usa carga menor que hipertrofia nas mesmas repetições', () => {
    expect(calculateTargetWeight(RM, 'Emagrecimento', 15))
      .toBeLessThan(calculateTargetWeight(RM, 'Hipertrofia', 15));
  });

  it.each(['Emagrecimento', 'emagrecer', 'Perder peso', 'PERDER PESO'])(
    'reconhece "%s" como emagrecimento', (objetivo) => {
      expect(calculateTargetWeight(RM, objetivo, 15)).toBe(55);
    });

  it('objetivo desconhecido cai em hipertrofia, não em zero', () => {
    expect(calculateTargetWeight(RM, 'Objetivo Inventado', 10)).toBe(75);
  });

  it('deload reduz 20% da carga alvo', () => {
    const normal = calculateTargetWeight(RM, 'Hipertrofia', 10, false);
    const deload = calculateTargetWeight(RM, 'Hipertrofia', 10, true);
    expect(deload).toBe(Math.round(normal * 0.8));
  });

  it('devolve inteiro, para o aluno montar a barra', () => {
    const v = calculateTargetWeight(87.3, 'Hipertrofia', 9);
    expect(Number.isInteger(v)).toBe(true);
  });
});
