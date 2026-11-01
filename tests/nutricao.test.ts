import { describe, it, expect } from 'vitest';
import {
  tmbMifflin,
  treinosPorSemana,
  fatorDeAtividade,
  nomeDaFaixa,
  planoNutricional,
  AJUSTE_POR_OBJETIVO,
  PROTEINA_G_POR_KG,
  GORDURA_FRACAO_DAS_CALORIAS,
  KCAL_POR_GRAMA,
} from '@/lib/nutricao';

/**
 * A conta de macros, que até 01/11/2026 não existia em código — era a IA que calculava dentro
 * do prompt, sem teste e sem um "certo" escrito em lugar nenhum.
 *
 * O que estes testes mais protegem é a RECUSA: sem sexo, sem peso ou com objetivo
 * desconhecido, a conta não pode sair com um valor plausível. Um plano alimentar chutado é
 * pior que nenhum plano, e o chute passa despercebido justamente por parecer razoável.
 */

const AGORA = new Date(2026, 10, 1, 12, 0, 0).getTime();
const diaDe = (quantosAtras: number, hora = 18) =>
  new Date(2026, 10, 1 - quantosAtras, hora, 0, 0).getTime();

const HOMEM = { peso: 80, altura: 178, idade: 30, sexo: 'M', objetivo: 'Hipertrofia' };

describe('tmbMifflin', () => {
  it('homem: 10*peso + 6,25*altura - 5*idade + 5', () => {
    // 800 + 1112,5 - 150 + 5
    expect(tmbMifflin(80, 178, 30, 'M')).toBeCloseTo(1767.5, 1);
  });

  it('mulher: a mesma conta com -161', () => {
    // 800 + 1112,5 - 150 - 161
    expect(tmbMifflin(80, 178, 30, 'F')).toBeCloseTo(1601.5, 1);
  });

  it('O SEXO VALE 166 kcal — e por isso nunca pode ser chutado', () => {
    const h = tmbMifflin(70, 165, 40, 'M');
    const m = tmbMifflin(70, 165, 40, 'F');
    expect(h - m).toBeCloseTo(166, 6);
  });

  it('cada quilo vale 10 kcal e cada ano custa 5', () => {
    expect(tmbMifflin(81, 178, 30, 'M') - tmbMifflin(80, 178, 30, 'M')).toBeCloseTo(10, 6);
    expect(tmbMifflin(80, 178, 31, 'M') - tmbMifflin(80, 178, 30, 'M')).toBeCloseTo(-5, 6);
  });
});

describe('treinosPorSemana', () => {
  it('sem historico, zero', () => {
    expect(treinosPorSemana([], AGORA)).toBe(0);
  });

  it('oito treinos em quatro semanas dao dois por semana', () => {
    // Dias 1 a 17, nunca o dia 0: `diaDe` usa 18h e AGORA e meio-dia, entao "hoje as 18h"
    // ainda esta no futuro e e descartado de proposito (ver o teste de data no futuro).
    const h = [1, 3, 5, 8, 10, 12, 15, 17].map(d => ({ date: diaDe(d) }));
    expect(treinosPorSemana(h, AGORA)).toBe(2);
  });

  it('DOIS TREINOS NO MESMO DIA CONTAM UM', () => {
    // O fator descreve quantos DIAS o corpo gastou a mais, nao quantas sessoes foram abertas.
    const h = [{ date: diaDe(1, 7) }, { date: diaDe(1, 20) }];
    expect(treinosPorSemana(h, AGORA)).toBe(0.25);
  });

  it('ignora treino mais velho que quatro semanas', () => {
    const h = [{ date: diaDe(2) }, { date: diaDe(40) }, { date: diaDe(90) }];
    expect(treinosPorSemana(h, AGORA)).toBe(0.25);
  });

  it('ignora data no futuro', () => {
    const h = [{ date: diaDe(-5) }, { date: diaDe(1) }];
    expect(treinosPorSemana(h, AGORA)).toBe(0.25);
  });
});

describe('fatorDeAtividade', () => {
  it('as quatro faixas', () => {
    expect(fatorDeAtividade(0)).toBe(1.2);
    expect(fatorDeAtividade(1)).toBe(1.375);
    expect(fatorDeAtividade(3)).toBe(1.55);
    expect(fatorDeAtividade(6)).toBe(1.725);
  });

  it('as bordas sao fechadas embaixo', () => {
    expect(fatorDeAtividade(0.99)).toBe(1.2);
    expect(fatorDeAtividade(2.99)).toBe(1.375);
    expect(fatorDeAtividade(5.99)).toBe(1.55);
    expect(fatorDeAtividade(7)).toBe(1.725);
  });

  it('o nome da faixa acompanha o fator', () => {
    expect(nomeDaFaixa(0)).toBe('sedentario');
    expect(nomeDaFaixa(2)).toBe('leve');
    expect(nomeDaFaixa(4)).toBe('moderado');
    expect(nomeDaFaixa(6)).toBe('intenso');
  });
});

describe('planoNutricional — a recusa', () => {
  it('SEM SEXO NAO CALCULA, e diz que falta', () => {
    const r = planoNutricional({ ...HOMEM, sexo: null }, [], AGORA);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.faltando).toContain('sexo');
  });

  it('sexo invalido e o mesmo que sexo ausente', () => {
    for (const s of ['', 'm', 'Masculino', 'outro', 'X']) {
      const r = planoNutricional({ ...HOMEM, sexo: s }, [], AGORA);
      expect(r.ok, `sexo "${s}" nao deveria calcular`).toBe(false);
    }
  });

  it('OBJETIVO DESCONHECIDO NAO VIRA "manter"', () => {
    // Responder "manter" para quem pediu emagrecer e a falha mais cara possivel aqui.
    const r = planoNutricional({ ...HOMEM, objetivo: 'Perder barriga' }, [], AGORA);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.faltando).toContain('objetivo');
  });

  it('peso, altura e idade zerados ou ausentes contam como faltando', () => {
    const r = planoNutricional(
      { peso: 0, altura: null, idade: undefined, sexo: 'M', objetivo: 'Hipertrofia' },
      [],
      AGORA,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.faltando).toEqual(['peso', 'altura', 'idade']);
  });

  it('lista TUDO que falta de uma vez, nao um por vez', () => {
    const r = planoNutricional({}, [], AGORA);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.faltando).toEqual(['peso', 'altura', 'idade', 'sexo', 'objetivo']);
    }
  });

  it('perfil completo calcula', () => {
    expect(planoNutricional(HOMEM, [], AGORA).ok).toBe(true);
  });
});

describe('planoNutricional — os numeros', () => {
  /**
   * Homem 80kg/178cm/30a, hipertrofia, 4 treinos por semana nas ultimas 4 semanas.
   *
   * Dias 1 a 16, inteiros e todos no passado: 16 dias distintos / 4 semanas = 4,0.
   */
  const historico = Array.from({ length: 16 }, (_, i) => ({ date: diaDe(i + 1) }));

  it('monta TMB, GET e alvo na ordem certa', () => {
    const r = planoNutricional(HOMEM, [], AGORA);
    if (!r.ok) throw new Error('deveria calcular');

    // Sem historico: fator sedentario 1,2. TMB 1767,5 -> GET 2121 -> +10% = 2333.
    expect(r.plano.tmb).toBe(1768);
    expect(r.plano.get).toBe(2121);
    expect(r.plano.caloriasAlvo).toBe(2333);
  });

  it('A FREQUENCIA REAL MUDA O PLANO', () => {
    const parado = planoNutricional(HOMEM, [], AGORA);
    const ativo = planoNutricional(HOMEM, historico, AGORA);
    if (!parado.ok || !ativo.ok) throw new Error('deveriam calcular');

    expect(ativo.plano.get).toBeGreaterThan(parado.plano.get);
    expect(parado.plano.base.faixaDeAtividade).toBe('sedentario');
    expect(ativo.plano.base.faixaDeAtividade).toBe('moderado');
  });

  it('proteina e 1,8 g por kg de peso', () => {
    const r = planoNutricional(HOMEM, [], AGORA);
    if (!r.ok) throw new Error('deveria calcular');
    expect(r.plano.macros.proteina).toBe(Math.round(PROTEINA_G_POR_KG * 80));
  });

  it('gordura e 25% das calorias do alvo', () => {
    const r = planoNutricional(HOMEM, [], AGORA);
    if (!r.ok) throw new Error('deveria calcular');
    const esperado = (r.plano.caloriasAlvo * GORDURA_FRACAO_DAS_CALORIAS) / KCAL_POR_GRAMA.gordura;
    expect(r.plano.macros.gordura).toBe(Math.round(esperado));
  });

  it('OS MACROS FECHAM COM AS CALORIAS DO ALVO', () => {
    // O carboidrato e o resto, entao a soma tem que bater -- a menos do arredondamento
    // de cada grama, que no pior caso soma poucas calorias.
    for (const objetivo of Object.keys(AJUSTE_POR_OBJETIVO)) {
      const r = planoNutricional({ ...HOMEM, objetivo }, historico, AGORA);
      if (!r.ok) throw new Error('deveria calcular');
      const { proteina, carboidrato, gordura } = r.plano.macros;
      const soma =
        proteina * KCAL_POR_GRAMA.proteina +
        carboidrato * KCAL_POR_GRAMA.carboidrato +
        gordura * KCAL_POR_GRAMA.gordura;
      expect(Math.abs(soma - r.plano.caloriasAlvo), `objetivo ${objetivo}`).toBeLessThanOrEqual(10);
    }
  });

  it('emagrecer tira 20% e ganhar massa poe 10%', () => {
    const base = planoNutricional({ ...HOMEM, objetivo: 'Condicionamento Físico' }, [], AGORA);
    const cut = planoNutricional({ ...HOMEM, objetivo: 'Emagrecimento' }, [], AGORA);
    const bulk = planoNutricional({ ...HOMEM, objetivo: 'Hipertrofia' }, [], AGORA);
    if (!base.ok || !cut.ok || !bulk.ok) throw new Error('deveriam calcular');

    expect(base.plano.caloriasAlvo).toBe(base.plano.get);
    expect(cut.plano.caloriasAlvo).toBe(Math.round(base.plano.get * 0.8));
    expect(bulk.plano.caloriasAlvo).toBe(Math.round(base.plano.get * 1.1));
  });

  it('NENHUM MACRO SAI NEGATIVO, nem no pior caso realista', () => {
    // Peso alto em deficit e sedentario: o cenario que mais aperta o carboidrato.
    const pesado = { peso: 150, altura: 170, idade: 45, sexo: 'M', objetivo: 'Emagrecimento' };
    const r = planoNutricional(pesado, [], AGORA);
    if (!r.ok) throw new Error('deveria calcular');
    expect(r.plano.macros.carboidrato).toBeGreaterThan(0);
    expect(r.plano.macros.proteina).toBeGreaterThan(0);
    expect(r.plano.macros.gordura).toBeGreaterThan(0);
  });

  it('a mesma entrada da SEMPRE o mesmo resultado', () => {
    // Era o que nao valia quando a IA fazia a conta.
    const a = planoNutricional(HOMEM, historico, AGORA);
    const b = planoNutricional(HOMEM, historico, AGORA);
    expect(a).toEqual(b);
  });

  it('a mulher recebe menos caloria que o homem de mesmo corpo', () => {
    const h = planoNutricional(HOMEM, historico, AGORA);
    const m = planoNutricional({ ...HOMEM, sexo: 'F' }, historico, AGORA);
    if (!h.ok || !m.ok) throw new Error('deveriam calcular');
    expect(m.plano.caloriasAlvo).toBeLessThan(h.plano.caloriasAlvo);
  });

  it('a base explica de onde veio o numero', () => {
    const r = planoNutricional(HOMEM, historico, AGORA);
    if (!r.ok) throw new Error('deveria calcular');
    expect(r.plano.base.formula).toBe('Mifflin-St Jeor');
    expect(r.plano.base.fator).toBe(1.55);
    expect(r.plano.base.ajuste).toBe(0.1);
    expect(r.plano.base.treinosPorSemana).toBe(4);
  });
});
