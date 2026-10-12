import { describe, it, expect } from 'vitest';
import { calcularNivel, normalizar, descreverNivel } from '@/lib/progressaoDeNivel';

const DIA = 24 * 60 * 60 * 1000;
const MES = 30 * DIA;
const AGORA = new Date('2026-10-11T12:00:00Z').getTime();

/** n treinos de forca espalhados nos ultimos `meses`. */
const treinos = (n: number, meses: number, prefixo = '') =>
  Array.from({ length: n }, (_, i) => ({
    date: AGORA - meses * MES + (i * meses * MES) / Math.max(1, n),
    workoutPlanId: `${prefixo}plano-1`,
  }));

describe('normalizar', () => {
  it('le o nivel com e sem acento, em qualquer caixa', () => {
    expect(normalizar('Intermediário')).toBe('Intermediário');
    expect(normalizar('INTERMEDIARIO')).toBe('Intermediário');
    expect(normalizar('avancado')).toBe('Avançado');
    expect(normalizar('Avançado')).toBe('Avançado');
  });

  it('cai em Iniciante quando nao sabe', () => {
    expect(normalizar(null)).toBe('Iniciante');
    expect(normalizar('')).toBe('Iniciante');
    expect(normalizar('sei la')).toBe('Iniciante');
  });
});

describe('calcularNivel', () => {
  it('aluno novo comeca Iniciante', () => {
    const r = calcularNivel('Iniciante', [], AGORA);
    expect(r.efetivo).toBe('Iniciante');
    expect(r.subiu).toBe(false);
  });

  it('sobe para Intermediario com 2 meses e 16 treinos', () => {
    // O caso que o app nao fazia: a pessoa treina seis meses e continua recebendo exercicio
    // de iniciante porque marcou isso no primeiro dia.
    const r = calcularNivel('Iniciante', treinos(16, 2.5), AGORA);
    expect(r.conquistado).toBe('Intermediário');
    expect(r.efetivo).toBe('Intermediário');
    expect(r.subiu).toBe(true);
  });

  it('nao sobe so com tempo', () => {
    // Um ano no app com tres treinos nao e adaptacao.
    const r = calcularNivel('Iniciante', treinos(3, 12), AGORA);
    expect(r.efetivo).toBe('Iniciante');
  });

  it('nao sobe so com volume concentrado', () => {
    // 20 treinos em duas semanas e pique, nao habito -- e o tecido conjuntivo nao acompanha.
    const r = calcularNivel('Iniciante', treinos(20, 0.5), AGORA);
    expect(r.efetivo).toBe('Iniciante');
  });

  it('chega a Avancado com 6 meses e 60 treinos', () => {
    const r = calcularNivel('Iniciante', treinos(60, 7), AGORA);
    expect(r.efetivo).toBe('Avançado');
    expect(r.proximo).toBe(null);
  });

  it('NUNCA rebaixa quem se declarou acima', () => {
    // Pode ser alguem que treina ha dez anos e acabou de instalar o app.
    const r = calcularNivel('Avançado', [], AGORA);
    expect(r.efetivo).toBe('Avançado');
    expect(r.conquistado).toBe('Iniciante');
    expect(r.subiu).toBe(false);
  });

  it('sessao avulsa NAO conta como treino', () => {
    // Cinco minutos de abdomen nao habilitam ninguem a agachamento bulgaro. Mesma regra de
    // trainingUnlock.ts.
    const r = calcularNivel('Iniciante', treinos(30, 3, 'avulso-'), AGORA);
    expect(r.treinosFeitos).toBe(0);
    expect(r.efetivo).toBe('Iniciante');
  });

  it('conta so os de forca quando ha mistura', () => {
    const r = calcularNivel(
      'Iniciante',
      [...treinos(16, 3), ...treinos(40, 3, 'avulso-')],
      AGORA
    );
    expect(r.treinosFeitos).toBe(16);
    expect(r.efetivo).toBe('Intermediário');
  });

  it('diz o que falta para o proximo degrau', () => {
    const r = calcularNivel('Iniciante', treinos(10, 3), AGORA);
    expect(r.proximo?.nivel).toBe('Intermediário');
    expect(r.proximo?.faltamTreinos).toBe(6);
    expect(r.proximo?.faltamMeses).toBe(0);
  });
});

describe('descreverNivel', () => {
  it('conta quantos treinos faltam', () => {
    const r = calcularNivel('Iniciante', treinos(10, 3), AGORA);
    expect(descreverNivel(r)).toContain('6 treinos');
    expect(descreverNivel(r)).toContain('Intermediário');
  });

  it('no topo nao promete proximo degrau', () => {
    const r = calcularNivel('Avançado', treinos(60, 7), AGORA);
    expect(descreverNivel(r)).toContain('topo');
  });

  it('singular quando falta so um treino', () => {
    const r = calcularNivel('Iniciante', treinos(15, 3), AGORA);
    expect(descreverNivel(r)).toContain('1 treino para');
  });
});
