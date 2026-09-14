import { describe, it, expect } from 'vitest';
import { computePeriodization, CYCLE_WEEKS, INACTIVITY_RESET_DAYS } from '@/lib/periodization';

/**
 * A periodização decide quantas séries o aluno faz hoje e se a semana é de deload.
 * Errar aqui significa prescrever volume alto pra quem voltou de duas semanas parado.
 */

const DIA = 86_400_000;
const HOJE = Date.parse('2026-09-13T10:00:00Z');
const dia = (n: number) => HOJE + n * DIA;
const sessao = (planoId: string, n: number) => ({ workoutPlanId: planoId, date: dia(n) });

const PLANO = { id: 'p1', createdAt: dia(-60), cycleStartedAt: null };

describe('âncora do ciclo', () => {
  it('começa no primeiro treino EXECUTADO, não na criação do plano', () => {
    // Plano criado há 60 dias, primeiro treino há 3. Se a âncora fosse a criação, o aluno
    // estaria na semana 9; ancorado no treino, está na semana 1.
    const r = computePeriodization(PLANO, [sessao('p1', -3)], HOJE);
    expect(r.week).toBe(1);
  });

  it('pede pra gravar a âncora quando o aluno ainda não treinou', () => {
    const r = computePeriodization(PLANO, [], HOJE);
    expect(r.isFirstStart).toBe(true);
    expect(r.anchorToPersist).toBe(HOJE);
  });

  it('deduz e persiste a âncora de um plano anterior a esta regra', () => {
    // cycleStartedAt null + histórico existente: usa o primeiro treino e manda gravar.
    const r = computePeriodization(PLANO, [sessao('p1', -10), sessao('p1', -2)], HOJE);
    expect(r.anchorToPersist).toBe(dia(-10));
  });

  it('não regrava a âncora quando ela já existe', () => {
    const r = computePeriodization(
      { ...PLANO, cycleStartedAt: dia(-10) }, [sessao('p1', -10), sessao('p1', -1)], HOJE);
    expect(r.anchorToPersist).toBeNull();
  });

  it('ignora treinos de OUTRO plano', () => {
    // Histórico cheio, mas de outro plano: para este, o aluno nunca treinou.
    const r = computePeriodization(PLANO, [sessao('p2', -30), sessao('p2', -1)], HOJE);
    expect(r.isFirstStart).toBe(true);
    expect(r.week).toBe(1);
  });
});

describe('avanço de semana', () => {
  const comAncora = (diasAtras: number) => ({ ...PLANO, cycleStartedAt: dia(-diasAtras) });

  it.each([
    [0, 1], [6, 1],   // primeira semana vai do dia 0 ao 6
    [7, 2], [13, 2],
    [14, 3],
    [21, 4], [27, 4], // semana 4 é a de deload
  ])('%i dias após a âncora => semana %i', (dias, semanaEsperada) => {
    const r = computePeriodization(comAncora(dias), [sessao('p1', -dias), sessao('p1', 0)], HOJE);
    expect(r.week).toBe(semanaEsperada);
  });

  it('recomeça o ciclo depois da semana 4 em vez de travar em deload', () => {
    // Era o bug antigo: Math.min(..., 4) deixava o aluno em deload pra sempre.
    const r = computePeriodization(comAncora(28), [sessao('p1', -28), sessao('p1', 0)], HOJE);
    expect(r.week).toBe(1);
    expect(r.cycle).toBe(2);
  });

  it('mantém a contagem de ciclos em uso longo', () => {
    const r = computePeriodization(comAncora(28 * 3 + 14), [sessao('p1', -100), sessao('p1', 0)], HOJE);
    expect(r.cycle).toBe(4);
    expect(r.week).toBe(3);
  });
});

describe('reset por inatividade', () => {
  it(`reseta com exatamente ${INACTIVITY_RESET_DAYS} dias parado`, () => {
    const r = computePeriodization(
      { ...PLANO, cycleStartedAt: dia(-30) }, [sessao('p1', -INACTIVITY_RESET_DAYS)], HOJE);
    expect(r.needsReset).toBe(true);
    expect(r.week).toBe(1);
    expect(r.anchorToPersist).toBe(HOJE);
  });

  it('NÃO reseta um dia antes do limite', () => {
    // O limite tem que ser exato: 13 dias parado ainda é continuidade.
    // Âncora de 20 dias para não cair no início de um ciclo novo — assim "week 1" só poderia
    // vir de reset, e o teste distingue as duas causas em vez de confundi-las.
    const r = computePeriodization(
      { ...PLANO, cycleStartedAt: dia(-20) }, [sessao('p1', -(INACTIVITY_RESET_DAYS - 1))], HOJE);
    expect(r.needsReset).toBe(false);
    expect(r.week).toBe(3);
    expect(r.anchorToPersist).toBeNull(); // continuidade não regrava a âncora
  });

  it('distingue "semana 1 por ciclo novo" de "semana 1 por reset"', () => {
    // Os dois caem em week 1, mas por motivos opostos — o app precisa saber qual é pra decidir
    // se mostra o aviso de reset ao aluno.
    const cicloNovo = computePeriodization(
      { ...PLANO, cycleStartedAt: dia(-28) }, [sessao('p1', -28), sessao('p1', 0)], HOJE);
    const porReset = computePeriodization(
      { ...PLANO, cycleStartedAt: dia(-28) }, [sessao('p1', -30)], HOJE);

    expect(cicloNovo.week).toBe(1);
    expect(porReset.week).toBe(1);
    expect(cicloNovo.needsReset).toBe(false);
    expect(porReset.needsReset).toBe(true);
    expect(cicloNovo.cycle).toBe(2);
    expect(porReset.cycle).toBe(1);
  });

  it('conta a partir do reset depois que o aluno volta a treinar', () => {
    // Reset gravado no dia -20, e o aluno treinou naquele dia: a semana conta de lá.
    const r = computePeriodization(
      { ...PLANO, cycleStartedAt: dia(-20) },
      [sessao('p1', -60), sessao('p1', -20), sessao('p1', -1)], HOJE);
    expect(r.needsReset).toBe(false);
    expect(r.week).toBe(3);
  });

  it('informa há quantos dias o aluno não treina', () => {
    const r = computePeriodization(PLANO, [sessao('p1', -25)], HOJE);
    expect(r.daysSinceLastSession).toBe(25);
  });

  it('não inventa dias quando não há histórico', () => {
    expect(computePeriodization(PLANO, [], HOJE).daysSinceLastSession).toBeNull();
  });
});

describe('robustez', () => {
  it('sobrevive a data inválida no histórico', () => {
    const sujo = [{ workoutPlanId: 'p1', date: NaN }, sessao('p1', -5)];
    const r = computePeriodization(PLANO, sujo, HOJE);
    expect(r.week).toBe(1);
    expect(Number.isFinite(r.daysSinceLastSession!)).toBe(true);
  });

  it('nunca devolve semana fora de 1..CYCLE_WEEKS', () => {
    for (let dias = 0; dias < 400; dias += 7) {
      const r = computePeriodization(
        { ...PLANO, cycleStartedAt: dia(-dias) }, [sessao('p1', -dias), sessao('p1', 0)], HOJE);
      expect(r.week).toBeGreaterThanOrEqual(1);
      expect(r.week).toBeLessThanOrEqual(CYCLE_WEEKS);
    }
  });
});
