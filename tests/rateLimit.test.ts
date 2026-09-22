import { describe, it, expect } from 'vitest';
import { msUntilCapacity, percentile, SAFE_TPM_BUDGET } from '@/utils/rate-limit';

/**
 * O throttle global de IA (utils/rate-limit.ts) já falhou três vezes em produção por erro de
 * cálculo, a última delas recusando toda 2ª geração de treino do minuto. A decisão em si é
 * matemática pura, então fica testada aqui separada do acesso ao banco.
 */

const WINDOW_MS = 60_000;
const NOW = 1_700_000_000_000;

/** Linha da janela: `ageSec` segundos atrás, custando `cost` tokens. */
const row = (ageSec: number, cost: number) => ({ at: NOW - ageSec * 1000, cost });

describe('SAFE_TPM_BUDGET', () => {
  it('reserva ~20% do teto da conta como folga', () => {
    // 8000 é o free tier do Groq; o valor real vem de GROQ_TPM_LIMIT no ambiente.
    expect(SAFE_TPM_BUDGET).toBe(Math.floor((Number(process.env.GROQ_TPM_LIMIT) || 8000) * 0.8));
  });
});

describe('msUntilCapacity', () => {
  it('libera na hora quando a janela está vazia', () => {
    expect(msUntilCapacity([], 5000, NOW)).toBe(0);
  });

  it('libera na hora quando a chamada cabe no que sobra', () => {
    const rows = [row(10, 1000), row(20, 1500)];
    expect(msUntilCapacity(rows, 2000, NOW)).toBe(0);
  });

  it('bloqueia exatamente no limite do orçamento', () => {
    // Cabe cravado: total == orçamento não pode ser recusado.
    expect(msUntilCapacity([row(10, SAFE_TPM_BUDGET - 1000)], 1000, NOW)).toBe(0);
    // Um token além já espera.
    expect(msUntilCapacity([row(10, SAFE_TPM_BUDGET - 1000)], 1001, NOW)).toBeGreaterThan(0);
  });

  it('espera até a linha mais antiga sair da janela, não um tempo chutado', () => {
    // Uma linha de 40s atrás ocupando quase tudo: faltam 20s para ela expirar.
    const rows = [row(40, SAFE_TPM_BUDGET)];
    const wait = msUntilCapacity(rows, 1000, NOW);
    expect(wait).toBeGreaterThanOrEqual(20 * 1000);
    expect(wait).toBeLessThan(21 * 1000);
  });

  it('só espera o necessário: a expiração da mais antiga já basta', () => {
    // Duas linhas; liberar a de 50s atrás (expira em 10s) já abre espaço.
    const rows = [row(50, 3000), row(5, 2000)];
    const wait = msUntilCapacity(rows, 3000, NOW);
    expect(wait).toBeGreaterThanOrEqual(10 * 1000);
    expect(wait).toBeLessThan(11 * 1000);
  });

  it('espera a segunda expiração quando liberar só a primeira não basta', () => {
    // Precisa que as de 50s E 45s saiam para caber; a segunda expira em 15s.
    const rows = [row(50, 2000), row(45, 2000), row(5, 2000)];
    const wait = msUntilCapacity(rows, 3000, NOW);
    expect(wait).toBeGreaterThanOrEqual(15 * 1000);
    expect(wait).toBeLessThan(16 * 1000);
  });

  it('não devolve espera negativa para linha já expirada', () => {
    expect(msUntilCapacity([row(70, SAFE_TPM_BUDGET)], 1000, NOW)).toBeLessThanOrEqual(250);
  });

  it('espera a janela limpar quando a chamada sozinha estoura o orçamento', () => {
    // Recusar para sempre seria pior: espera a janela esvaziar e deixa o Groq decidir.
    const rows = [row(30, 1000)];
    const wait = msUntilCapacity(rows, SAFE_TPM_BUDGET + 5000, NOW);
    expect(wait).toBeGreaterThanOrEqual(30 * 1000);
    expect(wait).toBeLessThan(31 * 1000);
  });

  it('a regressão que motivou a correção: 2 treinos no mesmo minuto', () => {
    // Com a estimativa fixa de 5000, o 2º treino era sempre recusado (5000 + 5000 > 6400).
    const comEstimativaFixa = msUntilCapacity([row(5, 5000)], 5000, NOW);
    expect(comEstimativaFixa).toBeGreaterThan(0);

    // Com consumo real medido (~1800), os mesmos dois treinos passam a caber.
    const comConsumoReal = msUntilCapacity([row(5, 1800)], 1800, NOW);
    expect(comConsumoReal).toBe(0);
  });
});

describe('percentile', () => {
  it('devolve 0 para amostra vazia', () => {
    expect(percentile([], 0.75)).toBe(0);
  });

  it('devolve o próprio valor para amostra de um', () => {
    expect(percentile([1234], 0.75)).toBe(1234);
  });

  it('calcula o p75 com interpolação', () => {
    expect(percentile([1, 2, 3, 4, 5], 0.75)).toBe(4);
    expect(percentile([10, 20], 0.5)).toBe(15);
  });

  it('ignora a ordem de entrada', () => {
    expect(percentile([5, 1, 4, 2, 3], 0.75)).toBe(percentile([1, 2, 3, 4, 5], 0.75));
  });

  it('fica acima da mediana, cobrindo a chamada ruim e não a típica', () => {
    const amostra = [1000, 1100, 1200, 1300, 9000];
    expect(percentile(amostra, 0.75)).toBeGreaterThan(percentile(amostra, 0.5));
  });
});
