import { describe, it, expect } from 'vitest';
import {
  agruparEmBlocos,
  grupoCanonico,
  montarBlocos,
  PARES_ANTAGONISTAS,
  saoAntagonistas,
  tipoDoBloco,
} from '@/lib/blocosDeTreino';

/**
 * Superset e Circuito eram so rotulo: nao havia onde gravar o par. O prompt pedia "pareie
 * exercicios coerentes" e o par sumia no salvamento, entao o aluno que esperou tres meses pelo
 * metodo recebia uma lista igual a do tradicional.
 */

const ex = (muscleGroup: string): { muscleGroup: string; bloco?: number } => ({ muscleGroup });

describe('grupoCanonico', () => {
  it('normaliza o que o catalogo escreve, com acento e tudo', () => {
    expect(grupoCanonico('Pernas (quadríceps)')).toBe('quadriceps');
    expect(grupoCanonico('Posterior de coxa')).toBe('posterior');
    expect(grupoCanonico('Bíceps')).toBe('biceps');
    expect(grupoCanonico('Core/Abdômen')).toBe('core');
  });

  it('nao se importa com caixa nem espaco', () => {
    expect(grupoCanonico('  PEITO ')).toBe('peito');
  });

  it('SEPARA quadriceps de posterior: MUSCLE_ALIASES junta os dois em "perna"', () => {
    // Se caissem no mesmo grupo, o par antagonista classico das pernas viraria bi-set.
    expect(grupoCanonico('Pernas (quadríceps)')).not.toBe(grupoCanonico('Posterior de coxa'));
  });

  it('devolve null para grupo desconhecido ou ausente', () => {
    expect(grupoCanonico('Tchutchuca')).toBeNull();
    expect(grupoCanonico('')).toBeNull();
    expect(grupoCanonico(null)).toBeNull();
    expect(grupoCanonico(undefined)).toBeNull();
  });
});

describe('saoAntagonistas', () => {
  it('reconhece os tres pares da revisao, nas duas ordens', () => {
    expect(saoAntagonistas('Peito', 'Costas')).toBe(true);
    expect(saoAntagonistas('Costas', 'Peito')).toBe(true);
    expect(saoAntagonistas('Bíceps', 'Tríceps')).toBe(true);
    expect(saoAntagonistas('Pernas (quadríceps)', 'Posterior de coxa')).toBe(true);
  });

  it('mesmo musculo nao e antagonista de si mesmo', () => {
    expect(saoAntagonistas('Peito', 'Peito')).toBe(false);
  });

  it('OMBRO nao tem antagonista: a oposicao do deltoide e entre porcoes, nao entre grupos', () => {
    expect(PARES_ANTAGONISTAS.flat()).not.toContain('ombro');
    expect(saoAntagonistas('Ombro', 'Costas')).toBe(false);
  });

  it('grupo desconhecido nunca e antagonista', () => {
    expect(saoAntagonistas('Peito', 'Tchutchuca')).toBe(false);
    expect(saoAntagonistas(null, 'Costas')).toBe(false);
  });
});

describe('tipoDoBloco', () => {
  it('mesmo musculo e BI-SET', () => {
    expect(tipoDoBloco([ex('Peito'), ex('Peito')], 'superset')).toBe('biset');
  });

  it('musculos diferentes e SUPERSET, antagonistas ou nao', () => {
    expect(tipoDoBloco([ex('Peito'), ex('Costas')], 'superset')).toBe('superset');
    expect(tipoDoBloco([ex('Peito'), ex('Ombro')], 'superset')).toBe('superset');
  });

  it('circuito manda, qualquer que seja o par', () => {
    expect(tipoDoBloco([ex('Peito'), ex('Peito')], 'circuito')).toBe('circuito');
  });

  it('grupo desconhecido nao vira bi-set por acidente', () => {
    expect(tipoDoBloco([ex('Tchutchuca'), ex('Tchutchuca')], 'superset')).toBe('superset');
  });

  it('bloco que nao tem dois nao e bi-set', () => {
    expect(tipoDoBloco([ex('Peito')], 'superset')).toBe('superset');
    expect(tipoDoBloco([ex('Peito'), ex('Peito'), ex('Peito')], 'superset')).toBe('superset');
  });
});

describe('montarBlocos — superset', () => {
  it('pareia dois a dois na ordem recebida', () => {
    const r = montarBlocos([ex('Peito'), ex('Costas'), ex('Biceps'), ex('Triceps')], 'superset');
    expect(r.map(e => e.bloco)).toEqual([1, 1, 2, 2]);
  });

  it('numero IMPAR deixa o ultimo sem bloco, e ele vira tradicional', () => {
    const r = montarBlocos([ex('Peito'), ex('Costas'), ex('Ombro')], 'superset');
    expect(r.map(e => e.bloco)).toEqual([1, 1, undefined]);
  });

  it('um exercicio so nao forma bloco nenhum', () => {
    expect(montarBlocos([ex('Peito')], 'superset').map(e => e.bloco)).toEqual([undefined]);
  });

  it('preserva os outros campos', () => {
    const r = montarBlocos([{ muscleGroup: 'Peito', name: 'Supino', sets: 3 }], 'superset');
    expect(r[0]).toMatchObject({ muscleGroup: 'Peito', name: 'Supino', sets: 3 });
  });

  it('nao altera o array recebido', () => {
    const sessao = [ex('Peito'), ex('Costas')];
    montarBlocos(sessao, 'superset');
    expect(sessao[0]).not.toHaveProperty('bloco', 1);
  });
});

describe('montarBlocos — circuito', () => {
  it('a sessao inteira e um bloco so', () => {
    const r = montarBlocos([ex('Peito'), ex('Costas'), ex('Ombro'), ex('Biceps'), ex('Triceps')], 'circuito');
    expect(r.map(e => e.bloco)).toEqual([1, 1, 1, 1, 1]);
  });
});

describe('montarBlocos — metodos sem bloco', () => {
  it('devolve o MESMO array para tradicional, drop set, rest-pause e piramide', () => {
    const sessao = [ex('Peito'), ex('Costas')];
    for (const m of ['tradicional', 'drop_set', 'rest_pause', 'piramide', '', null, undefined]) {
      expect(montarBlocos(sessao, m)).toBe(sessao);
    }
  });

  it('aguenta entrada que nao e array', () => {
    expect(montarBlocos(undefined as never, 'superset')).toEqual([]);
  });
});

describe('agruparEmBlocos', () => {
  it('junta os exercicios do mesmo bloco', () => {
    const r = agruparEmBlocos([
      { muscleGroup: 'Peito', bloco: 1 },
      { muscleGroup: 'Costas', bloco: 1 },
      { muscleGroup: 'Biceps', bloco: 2 },
      { muscleGroup: 'Triceps', bloco: 2 },
    ]);
    expect(r).toHaveLength(2);
    expect(r[0]).toHaveLength(2);
  });

  it('exercicio sem bloco vira grupo de um', () => {
    const r = agruparEmBlocos([
      { muscleGroup: 'Peito', bloco: 1 },
      { muscleGroup: 'Costas', bloco: 1 },
      { muscleGroup: 'Ombro' },
    ]);
    expect(r.map(g => g.length)).toEqual([2, 1]);
  });

  it('PLANO ANTIGO, sem bloco em lugar nenhum, vira uma lista de grupos de um', () => {
    // Nenhuma migracao foi necessaria: a tela percorre grupos e desenha cartao simples.
    const r = agruparEmBlocos([{ muscleGroup: 'Peito' }, { muscleGroup: 'Costas' }]);
    expect(r.map(g => g.length)).toEqual([1, 1]);
  });

  it('nao funde blocos de numero diferente que estao lado a lado', () => {
    const r = agruparEmBlocos([
      { muscleGroup: 'Peito', bloco: 1 },
      { muscleGroup: 'Costas', bloco: 2 },
    ]);
    expect(r.map(g => g.length)).toEqual([1, 1]);
  });

  it('nao junta dois blocos iguais separados por um exercicio solto', () => {
    const r = agruparEmBlocos([
      { muscleGroup: 'Peito', bloco: 1 },
      { muscleGroup: 'Ombro' },
      { muscleGroup: 'Costas', bloco: 1 },
    ]);
    expect(r.map(g => g.length)).toEqual([1, 1, 1]);
  });

  it('aguenta lista vazia', () => {
    expect(agruparEmBlocos([])).toEqual([]);
  });
});
