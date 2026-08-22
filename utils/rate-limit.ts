import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

interface RateLimitOptions {
  limit: number;
  windowMinutes: number;
}

/**
 * Limita quantas vezes um usuário pode chamar uma rota de IA em uma janela de tempo,
 * usando a tabela ai_usage_log (database/13_ai_rate_limit.sql). Sem isso, um único
 * usuário autenticado poderia gerar chamadas ilimitadas contra a chave paga do servidor.
 *
 * @returns null se a chamada é permitida, ou uma NextResponse 429 pronta para retornar.
 */
export async function checkRateLimit(
  userId: string,
  endpoint: string,
  { limit, windowMinutes }: RateLimitOptions
): Promise<NextResponse | null> {
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const windowStart = new Date(Date.now() - windowMinutes * 60_000).toISOString();

  const { count, error } = await supabase
    .from('ai_usage_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('endpoint', endpoint)
    .gte('created_at', windowStart);

  if (error) {
    // Falha aberta: um erro de infraestrutura no log não deve derrubar a rota de IA.
    console.error('Rate limit check failed:', error);
    return null;
  }

  if ((count ?? 0) >= limit) {
    return NextResponse.json(
      { error: 'Você atingiu o limite de uso da IA por enquanto. Tente novamente mais tarde.' },
      { status: 429 }
    );
  }

  await supabase.from('ai_usage_log').insert({ user_id: userId, endpoint });
  return null;
}

// Custo estimado em tokens por chamada, por rota — não precisa ser exato, só não pode
// subestimar muito. Usado só pro throttle global abaixo, nunca pro checkRateLimit por usuário.
const GROQ_ESTIMATED_TOKENS_PER_CALL: Record<string, number> = {
  treino: 5000,
  'coach-chat': 2000,
  swap: 3000,
  nutrition: 1500,
  progression: 4000,
  'daily-tip': 500,
};

const GROQ_TPM_LIMIT = 8000;
const GROQ_SAFE_TPM_BUDGET = Math.floor(GROQ_TPM_LIMIT * 0.8); // deixa ~20% de folga pro erro de estimativa

/**
 * Limite GLOBAL da conta Groq — diferente do checkRateLimit acima (que é por usuário), esse
 * protege o teto real de tokens/minuto da CONTA INTEIRA (8000 TPM), somando o uso de TODOS os
 * usuários na última janela de 60s. Sem isso, vários usuários diferentes, cada um dentro do
 * próprio limite individual, ainda conseguem estourar o teto da conta se gerarem conteúdo ao
 * mesmo tempo — foi exatamente isso que causou o 413 em produção quando o catálogo de
 * exercícios cresceu além do que tínhamos calibrado.
 *
 * Reaproveita a mesma tabela ai_usage_log (cada chamada de qualquer usuário já é logada ali
 * pelo checkRateLimit), só que sem filtrar por user_id.
 *
 * @returns null se há capacidade, ou uma NextResponse 429 pronta para retornar.
 */
export async function checkGlobalAiCapacity(endpoint: string): Promise<NextResponse | null> {
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const windowStart = new Date(Date.now() - 60_000).toISOString();

  const { data: recentCalls, error } = await supabase
    .from('ai_usage_log')
    .select('endpoint')
    .gte('created_at', windowStart);

  if (error) {
    // Falha aberta: um erro de infraestrutura no log não deve derrubar a rota de IA.
    console.error('Global AI capacity check failed:', error);
    return null;
  }

  const estimatedTokensInWindow = (recentCalls || []).reduce((sum, call) => {
    return sum + (GROQ_ESTIMATED_TOKENS_PER_CALL[call.endpoint] || 2000);
  }, 0);

  const thisCallCost = GROQ_ESTIMATED_TOKENS_PER_CALL[endpoint] || 2000;

  if (estimatedTokensInWindow + thisCallCost > GROQ_SAFE_TPM_BUDGET) {
    return NextResponse.json(
      { error: 'Muita gente usando a IA ao mesmo tempo agora. Tente novamente em alguns segundos.' },
      { status: 429 }
    );
  }

  return null;
}
