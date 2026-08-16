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
