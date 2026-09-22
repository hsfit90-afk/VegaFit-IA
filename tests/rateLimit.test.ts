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

/**
 * Custo como fração do orçamento. Os casos abaixo são escritos em relação ao teto e não em
 * números absolutos porque o orçamento muda com o tier do provedor — era 6400 no free tier do
 * Groq e é 200.000 no Gemini. O que precisa continuar valendo é a regra, não a escala.
 */
const pct = (fracao: number) => Math.floor(SAFE_TPM_BUDGET * fracao);

describe('SAFE_TPM_BUDGET', () => {
  it('reserva ~20% do teto da conta como folga', () => {
    // 250.000 é o free tier documentado da família Flash do Gemini; o valor real da conta
    // vem de AI_TPM_LIMIT no ambiente.
    expect(SAFE_TPM_BUDGET).toBe(Math.floor((Number(process.env.AI_TPM_LIMIT) || 250_000) * 0.8));
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
    const rows = [row(50, pct(0.4)), row(5, pct(0.3))];
    const wait = msUntilCapacity(rows, pct(0.5), NOW);
    expect(wait).toBeGreaterThanOrEqual(10 * 1000);
    expect(wait).toBeLessThan(11 * 1000);
  });

  it('espera a segunda expiração quando liberar só a primeira não basta', () => {
    // Precisa que as de 50s E 45s saiam para caber; a segunda expira em 15s.
    const rows = [row(50, pct(0.3)), row(45, pct(0.3)), row(5, pct(0.3))];
    const wait = msUntilCapacity(rows, pct(0.5), NOW);
    expect(wait).toBeGreaterThanOrEqual(15 * 1000);
    expect(wait).toBeLessThan(16 * 1000);
  });

  it('não devolve espera negativa para linha já expirada', () => {
    expect(msUntilCapacity([row(70, SAFE_TPM_BUDGET)], 1000, NOW)).toBeLessThanOrEqual(250);
  });

  it('espera a janela limpar quando a chamada sozinha estoura o orçamento', () => {
    // Recusar para sempre seria pior: espera a janela esvaziar e deixa o provedor decidir.
    const rows = [row(30, 1000)];
    const wait = msUntilCapacity(rows, SAFE_TPM_BUDGET + 5000, NOW);
    expect(wait).toBeGreaterThanOrEqual(30 * 1000);
    expect(wait).toBeLessThan(31 * 1000);
  });

  it('a regressão que motivou a correção: 2 treinos no mesmo minuto', () => {
    // Relativo ao orçamento, e não a números fixos, porque o teto muda com o tier do provedor
    // (era 8000 no free tier do Groq, hoje 250.000 no Gemini) — o que se testa aqui é a regra.
    //
    // Quando a reserva por chamada passa de metade do orçamento, a 2ª do minuto NUNCA cabe.
    // Era exatamente o caso antigo: 5000 reservados contra 6400 de orçamento.
    const reservaAlta = Math.floor(SAFE_TPM_BUDGET * 0.6);
    expect(msUntilCapacity([row(5, reservaAlta)], reservaAlta, NOW)).toBeGreaterThan(0);

    // Com a reserva abaixo de metade do orçamento, as duas passam a caber no mesmo minuto.
    const reservaReal = Math.floor(SAFE_TPM_BUDGET * 0.3);
    expect(msUntilCapacity([row(5, reservaReal)], reservaReal, NOW)).toBe(0);
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
