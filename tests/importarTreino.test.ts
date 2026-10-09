import { describe, it, expect } from 'vitest';
import {
  normalizar, semelhanca, casarComCatalogo, limparNumeros, precisamDeConferencia,
  CONFIANCA_MINIMA,
} from '@/lib/importarTreino';

/**
 * Casar o nome lido da ficha com o catalogo e a parte que decide se a importacao serve.
 * Um nome solto nao traz video, nao passa pelos filtros e nao entra na conta de volume --
 * vira texto numa tela.
 */

const catalogo = [
  { id: '1', name: 'Supino reto com barra', muscle_group: 'Peito' },
  { id: '2', name: 'Supino inclinado com halteres', muscle_group: 'Peito' },
  { id: '3', name: 'Agachamento livre com barra', muscle_group: 'Pernas (quadríceps)' },
  { id: '4', name: 'Rosca direta com barra W', muscle_group: 'Bíceps' },
  { id: '5', name: 'Leg press 45 graus', muscle_group: 'Pernas (quadríceps)' },
];

describe('normalizar — ficha escrita a mao', () => {
  it('tira acento e pontuacao', () => {
    expect(normalizar('Supino Reto c/ Barra')).toEqual(['supino', 'reto', 'barra']);
    expect(normalizar('Agachamento Livre')).toEqual(['agachamento', 'livre']);
  });

  it('descarta palavras que aparecem em todo nome', () => {
    // "com", "de", "no" nao distinguem nada e so atrapalham a contagem.
    expect(normalizar('Rosca de biceps com halteres')).not.toContain('com');
    expect(normalizar('Rosca de biceps com halteres')).not.toContain('de');
  });
});

describe('semelhanca — a ficha e mais curta que o catalogo', () => {
  it('nome parcial casa alto', () => {
    // A ficha diz "Supino reto", o catalogo "Supino reto com barra". Dividir pelo nome longo
    // puniria justamente o caso comum.
    expect(semelhanca('Supino reto', 'Supino reto com barra')).toBe(1);
  });

  it('nome igual casa 1', () => {
    expect(semelhanca('Leg press 45 graus', 'Leg press 45 graus')).toBe(1);
  });

  it('nome diferente casa baixo', () => {
    expect(semelhanca('Remada curvada', 'Supino reto com barra')).toBeLessThan(0.5);
  });
});

describe('casarComCatalogo', () => {
  it('casa o que da, trazendo id e grupo muscular', () => {
    const r = casarComCatalogo([{ name: 'Supino reto' }], catalogo);
    expect(r[0].exerciseId).toBe('1');
    expect(r[0].nomeNoCatalogo).toBe('Supino reto com barra');
    expect(r[0].muscleGroup).toBe('Peito');
  });

  it('escolhe o MAIS parecido entre semelhantes', () => {
    const r = casarComCatalogo([{ name: 'Supino inclinado' }], catalogo);
    expect(r[0].nomeNoCatalogo).toBe('Supino inclinado com halteres');
  });

  it('abaixo da confianca minima, devolve sem correspondente', () => {
    // Melhor admitir que nao sabe do que empurrar o exercicio errado para o treino de alguem.
    const r = casarComCatalogo([{ name: 'Exercício que não existe aqui' }], catalogo);
    expect(r[0].exerciseId).toBeUndefined();
    expect(r[0].confianca).toBeLessThan(CONFIANCA_MINIMA);
  });

  it('preserva series e reps lidas da ficha', () => {
    const r = casarComCatalogo([{ name: 'Supino reto', sets: 4, reps: '10-12' }], catalogo);
    expect(r[0].sets).toBe(4);
    expect(r[0].reps).toBe('10-12');
  });
});

describe('limparNumeros — ficha traz numero torto', () => {
  it('series fora da faixa viram o padrao', () => {
    // "sets: 0" vira sessao quebrada na tela do aluno, que nao tem como consertar sozinho.
    expect(limparNumeros({ name: 'X', sets: 0 }).sets).toBe(3);
    expect(limparNumeros({ name: 'X', sets: 99 }).sets).toBe(3);
    expect(limparNumeros({ name: 'X', sets: NaN }).sets).toBe(3);
  });

  it('series validas passam', () => {
    expect(limparNumeros({ name: 'X', sets: 4 }).sets).toBe(4);
  });

  it('descanso negativo vira o padrao', () => {
    expect(limparNumeros({ name: 'X', restSeconds: -30 }).restSeconds).toBe(60);
  });

  it('reps vazia vira a faixa padrao', () => {
    expect(limparNumeros({ name: 'X', reps: '' }).reps).toBe('8-12');
  });
});

describe('precisamDeConferencia', () => {
  it('conta so os que nao casaram', () => {
    const r = casarComCatalogo(
      [{ name: 'Supino reto' }, { name: 'Coisa inexistente xyz' }],
      catalogo
    );
    expect(precisamDeConferencia(r)).toBe(1);
  });
});
