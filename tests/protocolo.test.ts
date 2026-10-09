import { describe, it, expect } from 'vitest';
import {
  prescrever, normalizarObjetivo, SERIES_INICIAIS, REPETICOES, descreverSemana,
} from '@/lib/protocolo';

/**
 * Estes numeros viviam dentro da string do prompt em app/api/treino/route.ts. Quando a sessao
 * de abdominal passou a ser montada em codigo, eu reescrevi "3 series de 12-15" na tela -- e o
 * protocolo diz 4. Dois lugares com a mesma regra divergem no primeiro que alguem esquece de
 * atualizar, e aqui a divergencia aparece como prescricao errada na tela do aluno.
 */

describe('o abdomen e ISOLADO, segundo o proprio protocolo', () => {
  it('hipertrofia: 4 series de 12-15 na semana 1', () => {
    // A instrucao do prompt cita o abdomen pelo nome na lista de isolados:
    // "rosca, elevacao lateral, cadeira extensora, triceps, panturrilha, abdomen".
    const p = prescrever('isolado', 'hipertrofia', 1);
    expect(p.series).toBe(4);
    expect(p.reps).toBe('12-15');
  });

  it('emagrecimento muda as repeticoes e o descanso, nao as series', () => {
    const p = prescrever('isolado', 'emagrecimento', 1);
    expect(p.series).toBe(4);
    expect(p.reps).toBe('15-20');
    expect(p.descansoSegundos).toBeLessThan(prescrever('isolado', 'hipertrofia', 1).descansoSegundos);
  });

  it('composto parte de 3, nao de 4', () => {
    expect(prescrever('composto', 'hipertrofia', 1).series).toBe(3);
    expect(prescrever('composto', 'hipertrofia', 1).reps).toBe('6-10');
  });
});

describe('periodizacao de 4 semanas', () => {
  it('soma uma serie por semana ate a 3', () => {
    expect(prescrever('isolado', 'hipertrofia', 1).series).toBe(4);
    expect(prescrever('isolado', 'hipertrofia', 2).series).toBe(5);
    expect(prescrever('isolado', 'hipertrofia', 3).series).toBe(6);
  });

  it('semana 4 e DELOAD: desce, nao sobe', () => {
    // Insistir num corpo que acumulou tres semanas de volume crescente e como a maioria das
    // pessoas estagna ou se machuca.
    const p = prescrever('isolado', 'hipertrofia', 4);
    expect(p.deload).toBe(true);
    expect(p.series).toBeLessThan(prescrever('isolado', 'hipertrofia', 3).series);
    expect(p.series).toBeLessThan(prescrever('isolado', 'hipertrofia', 1).series);
  });

  it('nunca desce abaixo de 2 series, nem no deload', () => {
    expect(prescrever('composto', 'hipertrofia', 4).series).toBeGreaterThanOrEqual(2);
  });

  it('semana invalida cai na 1, em vez de quebrar', () => {
    expect(prescrever('isolado', 'hipertrofia', 0).series).toBe(SERIES_INICIAIS.isolado);
    expect(prescrever('isolado', 'hipertrofia', 99).deload).toBe(true);
    expect(prescrever('isolado', 'hipertrofia', NaN).series).toBe(SERIES_INICIAIS.isolado);
  });
});

describe('normalizarObjetivo', () => {
  it('reconhece as formas que o app usa', () => {
    expect(normalizarObjetivo('Hipertrofia')).toBe('hipertrofia');
    expect(normalizarObjetivo('Emagrecimento')).toBe('emagrecimento');
    expect(normalizarObjetivo('Perder peso')).toBe('emagrecimento');
    expect(normalizarObjetivo('Queima de gordura')).toBe('emagrecimento');
  });

  it('na duvida, hipertrofia', () => {
    // E o objetivo mais comum no app, e o protocolo dele nao tem risco: descanso maior e
    // repeticao moderada servem para quase todo mundo.
    expect(normalizarObjetivo(undefined)).toBe('hipertrofia');
    expect(normalizarObjetivo('sei la')).toBe('hipertrofia');
  });
});

describe('descreverSemana', () => {
  it('avisa quando e deload, para o aluno nao achar que o app errou', () => {
    expect(descreverSemana(4)).toMatch(/deload/i);
    expect(descreverSemana(2)).toBe('Semana 2 de 4');
  });
});
