import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

interface RateLimitOptions {
  limit: number;
  windowMinutes: number;
}

/** Reserva de capacidade devolvida quando a chamada está liberada para seguir. */
export interface AiReservation {
  /** Reconcilia a reserva com o consumo REAL (usageMetadata.totalTokenCount). */
  settle: (tokens?: number | null) => Promise<void>;
  /** Devolve o orçamento quando a chamada falha antes de consumir tokens. */
  release: () => Promise<void>;
}

export type AiCapacityResult =
  | { error: NextResponse; slot: null }
  | { error: null; slot: AiReservation };

/** Janela do teto de tokens por minuto do provedor de IA. */
const WINDOW_MS = 60_000;

// Custo ESTIMADO por chamada, usado só como reserva inicial — o valor real substitui esse
// número assim que o modelo responde (ver settle). Não precisa ser exato, mas não pode
// subestimar muito, senão duas chamadas simultâneas passam juntas e estouram o teto.
const ESTIMATED_TOKENS_PER_CALL: Record<string, number> = {
  // MEDIDO em 22/09/2026 com o catálogo de 882 exercícios, no Groq (6969/6803) e depois no
  // Gemini (6818/7027) — o custo ficou praticamente igual na troca de provedor. O valor antigo
  // (5000) subestimava, e subestimar é o erro caro: o app libera a chamada achando que cabe e
  // quem recusa passa a ser o provedor.
  // As demais rotas continuam sendo chute; a calibração automática corrige cada uma assim que
  // houver 3 chamadas reais medidas.
  treino: 7000,
  'coach-chat': 2000,
  swap: 3000,
  nutrition: 1500,
  progression: 4000,
  'daily-tip': 500,
};

const DEFAULT_ESTIMATE = 2000;

// Teto de tokens/minuto da CONTA do provedor. Vem do ambiente para que um upgrade de tier seja
// uma variável de ambiente, e não uma alteração de código.
//
// O padrão era 8000, o free tier do Groq — e com ~7000 tokens por geração isso fazia o app
// inteiro servir UMA geração de treino por minuto, que era a origem do "Muita gente usando a
// IA ao mesmo tempo agora". Com a migração para o Gemini (22/09/2026) o padrão passa a 250.000,
// o free tier documentado da família Flash.
//
// CONFIRME o limite real da sua conta em aistudio.google.com/rate-limit e ajuste esta variável
// se for diferente. Vale lembrar que o Gemini também limita REQUISIÇÕES por minuto (~15 RPM no
// free tier do Flash-Lite), e esse teto não é modelado aqui: com ~7000 tokens por chamada, o
// RPM estoura antes do TPM. Um 429 real do provedor é tratado com retry em lib/geminiClient.ts.
const AI_TPM_LIMIT = Number(process.env.AI_TPM_LIMIT) || 250_000;
const SAFE_BUDGET = Math.floor(AI_TPM_LIMIT * 0.8); // ~20% de folga pro erro de estimativa

// Quanto tempo a requisição pode ESPERAR por capacidade antes de desistir e devolver 429.
// Esperar entrega o treino; recusar devolve um erro e nenhum treino. O teto existe porque a
// função ainda precisa caber no timeout do host (Vercel) junto com a chamada ao modelo.
const MAX_QUEUE_WAIT_MS = Number(process.env.AI_MAX_QUEUE_WAIT_MS) || 10_000;

function estimateFor(endpoint: string): number {
  return ESTIMATED_TOKENS_PER_CALL[endpoint] || DEFAULT_ESTIMATE;
}

/** Quantas chamadas passadas alimentam a reserva adaptativa. */
const CALIBRATION_SAMPLE_SIZE = 20;
const MIN_SAMPLES_TO_CALIBRATE = 3;

/**
 * Percentil por interpolação linear. p75 em vez de média porque a reserva precisa cobrir a
 * chamada típica ruim, não a média — subestimar deixa duas chamadas passarem juntas e estourar
 * o teto real da conta, que é o erro caro.
 */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * p;
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (pos - lower);
}

/**
 * Quanto reservar para esta chamada.
 *
 * As estimativas fixas acima servem só como piso: treino já esteve em 5000, e era justamente
 * esse número subestimado que fazia o app liberar uma chamada achando que cabia quando na
 * verdade não cabia. Agora que settle() grava o consumo verdadeiro, a reserva sai do p75 das
 * últimas chamadas reais daquela rota, então ela acompanha sozinha mudanças no prompt, no
 * catálogo de exercícios ou até uma troca de modelo — sem ninguém recalibrar à mão.
 *
 * A estimativa fixa continua valendo como piso de segurança enquanto não houver amostra
 * suficiente — é melhor reservar demais do que estourar o teto da conta.
 */
// A calibração seria uma ida extra ao banco em TODA chamada de IA, só para descobrir um número
// que muda devagar. Fica em memória por 60s: numa instância quente o custo some, e numa
// instância nova o pior caso é uma consulta a mais na primeira chamada.
const CALIBRATION_TTL_MS = 60_000;
const calibrationCache = new Map<string, { value: number; expiresAt: number }>();

/** Descarta a calibração em memória. Existe para os testes, que precisam de leitura fresca. */
export function resetCalibrationCache() {
  calibrationCache.clear();
}

async function reserveCostFor(
  supabase: ReturnType<typeof serviceClient>,
  endpoint: string
): Promise<number> {
  const fallback = estimateFor(endpoint);

  const cached = calibrationCache.get(endpoint);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const { data, error } = await supabase
    .from('ai_usage_log')
    .select('tokens')
    .eq('endpoint', endpoint)
    .not('tokens', 'is', null)
    .order('created_at', { ascending: false })
    .limit(CALIBRATION_SAMPLE_SIZE);

  if (error || !data || data.length < MIN_SAMPLES_TO_CALIBRATE) return fallback;

  const samples = data
    .map((row: any) => row.tokens)
    .filter((t: any) => typeof t === 'number' && Number.isFinite(t) && t > 0);

  if (samples.length < MIN_SAMPLES_TO_CALIBRATE) return fallback;

  // Teto no orçamento: uma reserva maior que o próprio budget recusaria tudo para sempre.
  const calibrated = Math.min(Math.ceil(percentile(samples, 0.75)), SAFE_BUDGET);
  calibrationCache.set(endpoint, { value: calibrated, expiresAt: Date.now() + CALIBRATION_TTL_MS });
  return calibrated;
}

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Reserva que não controla nada — usada quando o próprio log falha (falha aberta). */
const NOOP_SLOT: AiReservation = { settle: async () => {}, release: async () => {} };

export interface WindowRow {
  at: number;
  cost: number;
}

/** Exportado para os testes: o orçamento efetivo derivado do teto da conta. */
export const SAFE_TPM_BUDGET = SAFE_BUDGET;

/**
 * Em quantos ms haverá orçamento para uma chamada de `thisCallCost`.
 *
 * Retorna 0 se já há capacidade agora. Caso contrário, descobre o instante em que linhas
 * suficientes saem da janela de 60s — em vez de chutar um tempo de espera, o número é exato,
 * então dá para esperar a quantia certa ou dizer ao usuário quantos segundos faltam.
 */
export function msUntilCapacity(rows: WindowRow[], thisCallCost: number, now: number): number {
  let total = rows.reduce((sum, r) => sum + r.cost, 0);
  if (total + thisCallCost <= SAFE_BUDGET) return 0;

  // Da mais antiga para a mais nova: são as primeiras a expirar e liberar orçamento.
  const byAge = [...rows].sort((a, b) => a.at - b.at);
  const margin = 250;

  for (const row of byAge) {
    total -= row.cost;
    if (total + thisCallCost <= SAFE_BUDGET) {
      return Math.max(0, row.at + WINDOW_MS - now) + margin;
    }
  }

  // Nem com a janela vazia a chamada cabe no orçamento: ela sozinha é maior que o teto.
  // Espera a janela limpar e segue assim mesmo — recusar para sempre seria pior, e um 429
  // real do provedor ainda é tratado por generateWithRetry (lib/geminiClient.ts).
  const last = byAge[byAge.length - 1];
  return last ? Math.max(0, last.at + WINDOW_MS - now) + margin : 0;
}

/** Lê a janela de 60s. Retorna null se o log falhar, sinalizando falha aberta. */
async function loadWindow(
  supabase: ReturnType<typeof serviceClient>
): Promise<WindowRow[] | null> {
  const windowStart = new Date(Date.now() - WINDOW_MS).toISOString();

  const { data, error } = await supabase
    .from('ai_usage_log')
    .select('endpoint, created_at, tokens')
    .gte('created_at', windowStart);

  if (error) {
    console.error('Global AI capacity check failed:', error);
    return null;
  }

  return (data || []).map((row: any) => ({
    at: new Date(row.created_at).getTime(),
    // tokens NULL = linha anterior à migração 27, ou reserva ainda não reconciliada.
    cost: typeof row.tokens === 'number' ? row.tokens : estimateFor(row.endpoint),
  }));
}

/**
 * Autoriza (ou recusa) uma chamada de IA e reserva o orçamento dela.
 *
 * Reúne as duas travas que antes eram chamadas separadas:
 *
 *   1. Cota POR USUÁRIO — impede que um único usuário autenticado consuma a chave paga do
 *      servidor sem limite.
 *   2. Teto GLOBAL de tokens/minuto da conta do provedor — impede que vários usuários, cada um
 *      dentro da própria cota, estourem juntos o limite da conta.
 *
 * Sobre a trava global, duas diferenças em relação à versão anterior:
 *
 *   - A linha do log é uma RESERVA. Quem chama precisa fechá-la com `slot.settle(tokens)`
 *     depois da resposta do modelo, ou devolvê-la com `slot.release()` se a chamada falhar.
 *     Antes a linha era gravada antes da chamada e nunca removida, então requisições que
 *     falhavam (chave ausente, 401, JSON inválido) gastavam orçamento sem consumir tokens.
 *   - Sem capacidade, a requisição ESPERA o tempo exato que falta (até MAX_QUEUE_WAIT_MS)
 *     em vez de recusar na hora. Só devolve 429 se a espera for longa demais — e aí informa
 *     quantos segundos faltam, em vez de um vago "tente novamente em alguns segundos".
 *
 * Toda falha de infraestrutura no próprio log é falha ABERTA: um erro ao contabilizar uso
 * não deve derrubar a funcionalidade de IA.
 */
export async function reserveAiCapacity(
  userId: string,
  endpoint: string,
  { limit, windowMinutes }: RateLimitOptions
): Promise<AiCapacityResult> {
  const supabase = serviceClient();

  // 1. Cota por usuário.
  const userWindowStart = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const { count, error: countError } = await supabase
    .from('ai_usage_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('endpoint', endpoint)
    .gte('created_at', userWindowStart);

  if (countError) {
    console.error('Rate limit check failed:', countError);
    return { error: null, slot: NOOP_SLOT };
  }

  if ((count ?? 0) >= limit) {
    return {
      error: NextResponse.json(
        { error: 'Você atingiu o limite de uso da IA por enquanto. Tente novamente mais tarde.' },
        { status: 429 }
      ),
      slot: null,
    };
  }

  // 2. Teto global da conta, esperando por capacidade quando a espera for curta.
  const thisCallCost = await reserveCostFor(supabase, endpoint);
  let alreadyWaited = false;

  for (;;) {
    const rows = await loadWindow(supabase);
    if (rows === null) break; // falha aberta

    const waitMs = msUntilCapacity(rows, thisCallCost, Date.now());
    if (waitMs === 0) break;

    if (waitMs <= MAX_QUEUE_WAIT_MS && !alreadyWaited) {
      await sleep(waitMs);
      alreadyWaited = true;
      continue;
    }

    const retryAfterSec = Math.max(1, Math.ceil(waitMs / 1000));
    const plural = retryAfterSec === 1 ? '' : 's';
    return {
      error: NextResponse.json(
        {
          error: `Muita gente usando a IA ao mesmo tempo agora. Tente novamente em ${retryAfterSec} segundo${plural}.`,
          retryAfter: retryAfterSec,
        },
        { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
      ),
      slot: null,
    };
  }

  // 3. Reserva o orçamento. O valor vira o consumo real em settle().
  const { data, error: insertError } = await supabase
    .from('ai_usage_log')
    .insert({ user_id: userId, endpoint, tokens: thisCallCost })
    .select('id')
    .single();

  if (insertError || !data) {
    console.error('AI usage reservation failed:', insertError);
    return { error: null, slot: NOOP_SLOT };
  }

  const reservationId = data.id;

  return {
    error: null,
    slot: {
      async settle(tokens?: number | null) {
        if (typeof tokens !== 'number' || !Number.isFinite(tokens) || tokens <= 0) return;
        const { error } = await supabase
          .from('ai_usage_log')
          .update({ tokens })
          .eq('id', reservationId);
        if (error) console.error('AI usage settle failed:', error);
      },
      async release() {
        const { error } = await supabase
          .from('ai_usage_log')
          .delete()
          .eq('id', reservationId);
        if (error) console.error('AI usage release failed:', error);
      },
    },
  };
}
