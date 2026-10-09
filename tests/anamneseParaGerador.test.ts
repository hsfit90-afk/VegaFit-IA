import { describe, it, expect } from 'vitest';
import {
  primeiroObjetivo,
  minutosDaSessao,
  diasPorSemana,
} from '@/lib/anamneseParaGerador';

describe('primeiroObjetivo', () => {
  it('pega o primeiro de uma lista', () => {
    expect(primeiroObjetivo(['Emagrecimento', 'Definição muscular'])).toBe('Emagrecimento');
  });

  it('aceita string solta', () => {
    expect(primeiroObjetivo('Hipertrofia')).toBe('Hipertrofia');
  });

  it('pula entrada vazia dentro da lista', () => {
    expect(primeiroObjetivo(['', '  ', 'Performance'])).toBe('Performance');
  });

  it('devolve null quando nao da para decidir', () => {
    expect(primeiroObjetivo([])).toBe(null);
    expect(primeiroObjetivo('')).toBe(null);
    expect(primeiroObjetivo(undefined)).toBe(null);
    expect(primeiroObjetivo(null)).toBe(null);
  });
});

describe('minutosDaSessao', () => {
  it('le as opcoes reais da anamnese', () => {
    expect(minutosDaSessao('30 min')).toBe(30);
    expect(minutosDaSessao('45 min')).toBe(45);
    expect(minutosDaSessao('60 min')).toBe(60);
    expect(minutosDaSessao('90 min+')).toBe(90);
  });

  it('recusa valor fora da faixa util', () => {
    expect(minutosDaSessao('5 min')).toBe(null);
    expect(minutosDaSessao('300 min')).toBe(null);
  });

  it('devolve null sem numero', () => {
    expect(minutosDaSessao('nao sei')).toBe(null);
    expect(minutosDaSessao(undefined)).toBe(null);
  });
});

describe('diasPorSemana', () => {
  it('le as opcoes reais da anamnese', () => {
    expect(diasPorSemana('3x')).toBe(3);
    expect(diasPorSemana('4x')).toBe(4);
    expect(diasPorSemana('5x')).toBe(5);
  });

  it('no intervalo pega o maior', () => {
    // "1-2x" significa que a pessoa consegue duas. Montar para uma entrega menos do que ela
    // disse que aguenta.
    expect(diasPorSemana('1-2x')).toBe(2);
  });

  it('o mais ("6x+") nao vira 7', () => {
    // Sete dias de treino de forca por semana nao e prescricao, e falta de descanso.
    expect(diasPorSemana('6x+')).toBe(6);
  });

  it('devolve null sem numero', () => {
    expect(diasPorSemana('')).toBe(null);
    expect(diasPorSemana(undefined)).toBe(null);
  });
});
