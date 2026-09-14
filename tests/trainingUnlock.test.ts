import { describe, it, expect } from 'vitest';
import { computeUnlock, textoBloqueio, FASES, TODOS_METODOS } from '@/lib/trainingUnlock';

/**
 * Este módulo decide se o aluno tem acesso a Drop Set, Rest-Pause e Pirâmide — técnicas que
 * levam à falha muscular. Liberar cedo demais para quem não tem base é risco de lesão, então
 * os limites importam mais que o caminho feliz.
 */

const DIA = 86_400_000;
const MES = 30 * DIA;
const HOJE = Date.parse('2026-09-13T10:00:00Z');

/** n treinos distribuídos entre `mesesAtras` e hoje. */
function historico(n: number, mesesAtras: number) {
  if (n === 0) return [];
  const inicio = HOJE - mesesAtras * MES;
  const passo = n > 1 ? (HOJE - inicio) / (n - 1) : 0;
  return Array.from({ length: n }, (_, i) => ({ date: inicio + i * passo }));
}

const SO_TRADICIONAL = ['tradicional'];
const FASE_2 = ['tradicional', 'superset', 'circuito'];

describe('as duas condições precisam valer juntas', () => {
  it('volume alto em pouco tempo NÃO libera', () => {
    // 24 treinos em 1 mês é 6x/semana: esforço real, mas sem tempo de adaptação.
    const r = computeUnlock(historico(24, 1), HOJE);
    expect(r.liberados).toEqual(SO_TRADICIONAL);
  });

  it('tempo longo com pouco treino NÃO libera', () => {
    // 5 treinos em 4 meses: cadastrou e quase não usou.
    const r = computeUnlock(historico(5, 4), HOJE);
    expect(r.liberados).toEqual(SO_TRADICIONAL);
  });

  it('tempo E volume juntos liberam a fase 2', () => {
    const r = computeUnlock(historico(24, 3), HOJE);
    expect(r.liberados).toEqual(FASE_2);
    expect(r.fase).toBe(2);
  });
});

describe('limites exatos', () => {
  const { meses, treinos } = FASES.find(f => f.fase === 2)!;

  it('um treino a menos não passa', () => {
    expect(computeUnlock(historico(treinos - 1, meses + 1), HOJE).fase).toBe(1);
  });

  it('o número exato passa', () => {
    expect(computeUnlock(historico(treinos, meses + 1), HOJE).fase).toBe(2);
  });

  it('as fases são cumulativas: não pula a 2 pra chegar na 3', () => {
    // Volume de fase 3 mas tempo de fase 1 — não pode liberar nada além do tradicional.
    const r = computeUnlock(historico(60, 1), HOJE);
    expect(r.fase).toBe(1);
  });
});

describe('caso real do banco', () => {
  it('quem se declara avançado sem nenhum treino fica no tradicional', () => {
    // Nos dados reais do app, dois usuários se declararam "Avançado" e somavam 1 treino.
    // O nível declarado não entra nesta função de propósito.
    const r = computeUnlock([], HOJE);
    expect(r.liberados).toEqual(SO_TRADICIONAL);
    expect(r.treinosFeitos).toBe(0);
  });
});

describe('papel master', () => {
  it('vê tudo liberado sem nenhum treino', () => {
    const r = computeUnlock([], HOJE, 'master');
    expect(r.liberados).toEqual(TODOS_METODOS);
    expect(r.liberadoPorPapel).toBe(true);
    expect(r.proximaFase).toBeNull();
  });

  it.each([undefined, null, 'client', 'admin', 'MASTER', ''])(
    'papel %o NÃO vira atalho', (papel) => {
      // Só a string exata 'master' libera. Qualquer outro valor — inclusive maiúsculo ou
      // um papel inventado — segue a regra de constância.
      const r = computeUnlock([], HOJE, papel as string | null | undefined);
      expect(r.liberados).toEqual(SO_TRADICIONAL);
      expect(r.liberadoPorPapel).toBe(false);
    }
  );
});

describe('texto do que falta', () => {
  it('devolve null para método já liberado', () => {
    expect(textoBloqueio(computeUnlock([], HOJE), 'tradicional')).toBeNull();
  });

  it('cita treinos e meses quando faltam os dois', () => {
    const t = textoBloqueio(computeUnlock([], HOJE), 'superset')!;
    expect(t).toMatch(/treinos/);
    expect(t).toMatch(/mes(es)?/);
  });

  it('cita só os treinos quando o tempo já foi cumprido', () => {
    // 4 meses de app, mas só 20 dos 24 treinos.
    const t = textoBloqueio(computeUnlock(historico(20, 4), HOJE), 'superset')!;
    expect(t).toMatch(/Faltam 4 treinos/);
    expect(t).not.toMatch(/mes/);
  });

  it('usa singular quando falta um só', () => {
    const t = textoBloqueio(computeUnlock(historico(23, 4), HOJE), 'superset')!;
    expect(t).toBe('Faltam 1 treino');
  });
});

describe('contagem de progresso', () => {
  it('nunca reporta valor negativo no que falta', () => {
    const r = computeUnlock(historico(200, 24), HOJE);
    expect(r.proximaFase).toBeNull(); // já está na última fase
    expect(r.treinosFeitos).toBe(200);
  });

  it('ignora datas inválidas na contagem', () => {
    const sujo = [...historico(24, 3), { date: NaN }, { date: Infinity }];
    expect(computeUnlock(sujo, HOJE).treinosFeitos).toBe(24);
  });
});
