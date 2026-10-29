import { describe, it, expect } from 'vitest';
import { diasSeguidos } from '@/lib/sequenciaDeTreinos';

/**
 * A conta saiu de dentro de app/page.tsx em 29/10/2026, quando o Progresso passou a precisar
 * dela também. Estes testes fixam o comportamento que ela já tinha — foram escritos a partir
 * do código antigo, não de uma regra nova.
 */

const DIA = 86_400_000;

/** Meio-dia de hoje, para os testes não dependerem da hora em que rodam. */
const agora = new Date(2026, 9, 29, 12, 0, 0).getTime();
const diaDe = (quantosDiasAtras: number, hora = 18) =>
  new Date(2026, 9, 29 - quantosDiasAtras, hora, 0, 0).getTime();

describe('diasSeguidos', () => {
  it('sem historico, zero', () => {
    expect(diasSeguidos([], agora)).toBe(0);
  });

  it('treinou hoje: um', () => {
    expect(diasSeguidos([{ date: diaDe(0) }], agora)).toBe(1);
  });

  it('tres dias seguidos terminando hoje', () => {
    const h = [{ date: diaDe(0) }, { date: diaDe(1) }, { date: diaDe(2) }];
    expect(diasSeguidos(h, agora)).toBe(3);
  });

  it('ONTEM AINDA CONTA: o dia de hoje nao acabou', () => {
    const h = [{ date: diaDe(1) }, { date: diaDe(2) }];
    expect(diasSeguidos(h, agora)).toBe(2);
  });

  it('ANTEONTEM NAO: a sequencia e zero, nao a de antes', () => {
    const h = [{ date: diaDe(2) }, { date: diaDe(3) }, { date: diaDe(4) }];
    expect(diasSeguidos(h, agora)).toBe(0);
  });

  it('DOIS TREINOS NO MESMO DIA CONTAM UM', () => {
    // Quem treina de manha e de noite nao ganha dois dias de sequencia.
    const h = [{ date: diaDe(0, 7) }, { date: diaDe(0, 20) }];
    expect(diasSeguidos(h, agora)).toBe(1);
  });

  it('para no buraco: so conta ate a falha', () => {
    // Hoje, ontem, [buraco], e tres dias antes disso.
    const h = [{ date: diaDe(0) }, { date: diaDe(1) }, { date: diaDe(3) }, { date: diaDe(4) }];
    expect(diasSeguidos(h, agora)).toBe(2);
  });

  it('a ordem do historico nao importa', () => {
    const baguncado = [{ date: diaDe(2) }, { date: diaDe(0) }, { date: diaDe(1) }];
    expect(diasSeguidos(baguncado, agora)).toBe(3);
  });

  it('o horario do treino nao importa, so o dia', () => {
    const h = [{ date: diaDe(0, 23) }, { date: diaDe(1, 1) }];
    expect(diasSeguidos(h, agora)).toBe(2);
  });

  it('historico so com treino antigo: zero', () => {
    expect(diasSeguidos([{ date: agora - 30 * DIA }], agora)).toBe(0);
  });
});
