import { describe, it, expect } from 'vitest';
import {
  aplicarTetoDeIntensificacao,
  contarSeriesNoVolume,
  ehMetodoIntensificado,
  indicesQueMantemTecnica,
  rotulosNeutros,
  TETO_INTENSIFICADO_POR_GRUPO,
} from '@/lib/protocoloDeMetodo';

/**
 * Medido em 27/09/2026, gerando treino em producao: a IA aplicou drop set em 21 de 21
 * exercicios. A revisao de evidencia de 22/10/2026 pede o contrario -- "limitar a poucos
 * exercicios por sessao" --, porque drop set e rest-pause elevam esforco percebido, lactato e
 * fadiga neuromuscular. Sem teto em codigo, o prompt era a unica regra, e prompt nao segura.
 */

const dropSet = ['S1', 'S2', 'Drop Set'];
const restPause = ['S1', 'RP1', 'RP2'];
const comum = ['S1', 'S2', 'S3'];

const ex = (muscleGroup: string, targetLabels?: string[] | null) => ({ muscleGroup, targetLabels });

describe('ehMetodoIntensificado', () => {
  it('pega drop set e rest-pause', () => {
    expect(ehMetodoIntensificado('drop_set')).toBe(true);
    expect(ehMetodoIntensificado('rest_pause')).toBe(true);
  });

  it('NAO pega piramide: ela varia carga e repeticao, nao leva a falha repetida', () => {
    expect(ehMetodoIntensificado('piramide')).toBe(false);
  });

  it('nao pega os demais nem valor ausente', () => {
    expect(ehMetodoIntensificado('tradicional')).toBe(false);
    expect(ehMetodoIntensificado('superset')).toBe(false);
    expect(ehMetodoIntensificado('circuito')).toBe(false);
    expect(ehMetodoIntensificado(null)).toBe(false);
    expect(ehMetodoIntensificado(undefined)).toBe(false);
    expect(ehMetodoIntensificado('')).toBe(false);
  });

  it('ignora espaco em volta', () => {
    expect(ehMetodoIntensificado('  drop_set ')).toBe(true);
  });
});

describe('rotulosNeutros', () => {
  it('devolve S1..Sn', () => {
    expect(rotulosNeutros(3)).toEqual(['S1', 'S2', 'S3']);
  });

  it('devolve vazio para quantidade invalida', () => {
    expect(rotulosNeutros(0)).toEqual([]);
    expect(rotulosNeutros(-2)).toEqual([]);
    expect(rotulosNeutros(NaN)).toEqual([]);
  });
});

describe('indicesQueMantemTecnica', () => {
  it('mantem um por grupo muscular, o ultimo de cada', () => {
    const sessao = [
      ex('Peito', dropSet),   // 0
      ex('Peito', dropSet),   // 1  <- ultimo de Peito
      ex('Triceps', dropSet), // 2  <- ultimo de Triceps
    ];
    expect(indicesQueMantemTecnica(sessao)).toEqual([1, 2]);
  });

  it('o teto e por grupo, entao tres grupos podem ter tres', () => {
    const sessao = [
      ex('Peito', dropSet),
      ex('Ombro', dropSet),
      ex('Triceps', dropSet),
    ];
    expect(indicesQueMantemTecnica(sessao)).toHaveLength(3);
  });

  it('escolhe entre os que JA TEM a tecnica, nao o ultimo do grupo em absoluto', () => {
    // Se mirasse no ultimo exercicio de Peito (indice 1), a sessao ficaria sem tecnica
    // nenhuma -- o aluno que pediu Drop Set receberia treino tradicional.
    const sessao = [
      ex('Peito', dropSet), // 0  <- o unico com tecnica
      ex('Peito', comum),   // 1
    ];
    expect(indicesQueMantemTecnica(sessao)).toEqual([0]);
  });

  it('ignora exercicio sem rotulo nenhum', () => {
    const sessao = [ex('Peito', null), ex('Peito', undefined), ex('Peito', dropSet)];
    expect(indicesQueMantemTecnica(sessao)).toEqual([2]);
  });

  it('trata grupo ausente ou vazio como UM grupo so, nao um por exercicio', () => {
    const sessao = [ex('', dropSet), ex('', dropSet), ex('  ', dropSet)];
    expect(indicesQueMantemTecnica(sessao)).toEqual([2]);
  });

  it('agrupa ignorando maiusculas', () => {
    const sessao = [ex('Peito', dropSet), ex('PEITO', dropSet)];
    expect(indicesQueMantemTecnica(sessao)).toEqual([1]);
  });

  it('devolve os indices em ordem crescente', () => {
    const sessao = [
      ex('Triceps', dropSet), // 0
      ex('Peito', dropSet),   // 1
      ex('Triceps', dropSet), // 2
    ];
    expect(indicesQueMantemTecnica(sessao)).toEqual([1, 2]);
  });

  it('sessao sem tecnica nenhuma nao mantem nada', () => {
    expect(indicesQueMantemTecnica([ex('Peito', comum), ex('Costas', comum)])).toEqual([]);
  });

  it('aguenta entrada que nao e array', () => {
    expect(indicesQueMantemTecnica(undefined as never)).toEqual([]);
  });
});

describe('aplicarTetoDeIntensificacao', () => {
  it('OS 21 DE 21: tira a tecnica de todo mundo menos o ultimo de cada grupo', () => {
    const sessao = [
      ex('Peito', dropSet),
      ex('Peito', dropSet),
      ex('Peito', dropSet),
      ex('Triceps', dropSet),
      ex('Triceps', dropSet),
    ];
    const r = aplicarTetoDeIntensificacao(sessao, 'drop_set');

    expect(r.map(e => e.targetLabels)).toEqual([comum, comum, dropSet, comum, dropSet]);
  });

  it('preserva a quantidade de series ao neutralizar', () => {
    const r = aplicarTetoDeIntensificacao(
      [ex('Peito', ['S1', 'S2', 'S3', 'Drop Set']), ex('Peito', dropSet)],
      'drop_set',
    );
    expect(r[0].targetLabels).toEqual(['S1', 'S2', 'S3', 'S4']);
  });

  it('funciona igual para rest-pause', () => {
    const r = aplicarTetoDeIntensificacao([ex('Costas', restPause), ex('Costas', restPause)], 'rest_pause');
    expect(r.map(e => e.targetLabels)).toEqual([comum, restPause]);
  });

  it('nao toca em metodo que nao e intensificado', () => {
    const sessao = [ex('Peito', dropSet), ex('Peito', dropSet)];
    expect(aplicarTetoDeIntensificacao(sessao, 'piramide')).toBe(sessao);
    expect(aplicarTetoDeIntensificacao(sessao, 'tradicional')).toBe(sessao);
    expect(aplicarTetoDeIntensificacao(sessao, null)).toBe(sessao);
  });

  it('devolve o MESMO objeto para o exercicio que nao muda', () => {
    const mantido = ex('Peito', dropSet);
    const sessao = [ex('Peito', dropSet), mantido];
    const r = aplicarTetoDeIntensificacao(sessao, 'drop_set');

    expect(r[1]).toBe(mantido);
    expect(r[0]).not.toBe(sessao[0]);
  });

  it('nao altera o array recebido', () => {
    const sessao = [ex('Peito', dropSet), ex('Peito', dropSet)];
    aplicarTetoDeIntensificacao(sessao, 'drop_set');
    expect(sessao[0].targetLabels).toEqual(dropSet);
  });

  it('preserva os outros campos do exercicio', () => {
    const sessao = [
      { muscleGroup: 'Peito', targetLabels: dropSet, name: 'Supino', sets: 3 },
      { muscleGroup: 'Peito', targetLabels: dropSet, name: 'Crucifixo', sets: 3 },
    ];
    const r = aplicarTetoDeIntensificacao(sessao, 'drop_set');
    expect(r[0]).toEqual({ muscleGroup: 'Peito', targetLabels: comum, name: 'Supino', sets: 3 });
  });

  it('sessao de um grupo so guarda exatamente o teto', () => {
    const sessao = Array.from({ length: 6 }, () => ex('Peito', dropSet));
    const r = aplicarTetoDeIntensificacao(sessao, 'drop_set');
    const comTecnica = r.filter(e => e.targetLabels?.some(l => /drop/i.test(l)));
    expect(comTecnica).toHaveLength(TETO_INTENSIFICADO_POR_GRUPO);
  });
});

/**
 * O volume semanal contava TODA serie concluida, inclusive RP1 e RP2. Um exercicio com
 * "S1 RP1 RP2" aparecia como 3 series no grafico, quando a revisao de 22/10/2026 diz que as
 * retomadas sao continuacao da mesma serie. Quem treinava rest-pause via a semana inflada.
 */
describe('contarSeriesNoVolume', () => {
  const s = (label: string, completed = true) => ({ label, completed, reps: 10, weight: 20 });

  it('rest-pause inteiro conta como UMA serie', () => {
    expect(contarSeriesNoVolume([s('S1'), s('RP1'), s('RP2')])).toBe(1);
  });

  it('drop set conta TODAS: cada queda e serie de trabalho com carga menor', () => {
    expect(contarSeriesNoVolume([s('S1'), s('S2'), s('Drop Set')])).toBe(3);
  });

  it('serie comum conta normal', () => {
    expect(contarSeriesNoVolume([s('S1'), s('S2'), s('S3')])).toBe(3);
  });

  it('serie nao concluida nao conta', () => {
    expect(contarSeriesNoVolume([s('S1'), s('S2', false), s('S3')])).toBe(2);
  });

  it('retomada nao concluida tambem nao conta', () => {
    expect(contarSeriesNoVolume([s('S1'), s('RP1', false)])).toBe(1);
  });

  it('aceita as variacoes de rotulo que o resto do app aceita', () => {
    expect(contarSeriesNoVolume([s('S1'), s('RP'), s('RP 2'), s('Rest-Pause'), s('Rest Pause')])).toBe(1);
  });

  it('serie sem rotulo conta: plano antigo nao tem targetLabels', () => {
    expect(contarSeriesNoVolume([{ completed: true }, { completed: true }])).toBe(2);
  });

  it('aguenta lista vazia, nula ou que nao e array', () => {
    expect(contarSeriesNoVolume([])).toBe(0);
    expect(contarSeriesNoVolume(null)).toBe(0);
    expect(contarSeriesNoVolume(undefined)).toBe(0);
    expect(contarSeriesNoVolume('nao e array' as never)).toBe(0);
  });

  it('nao confunde um rotulo qualquer com RP', () => {
    // A regex nao pode casar com qualquer coisa que tenha r e p.
    expect(contarSeriesNoVolume([s('Rampa'), s('Prep'), s('Reps')])).toBe(3);
  });
});
