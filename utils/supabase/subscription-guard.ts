import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  estadoDeAcesso,
  mensagemDeBloqueio,
  HTTP_ASSINATURA_NECESSARIA,
  type EstadoDeAcesso,
} from '@/lib/subscription';

/**
 * Barra as rotas que consomem IA quando a assinatura não está em dia.
 *
 * Vai logo depois de requireAuth() e ANTES de reserveAiCapacity(): reservar orçamento de IA
 * para uma chamada que vai ser recusada suja a janela de throttle de quem está pagando.
 *
 * O QUE ESTE GUARDA *NÃO* BLOQUEIA, de propósito: histórico, biblioteca, execução do treino
 * já gerado, gráficos e peso corporal. Assinatura vencida para de gerar coisa nova; nunca
 * tira o que o aluno já tem. Bloquear alguém no meio de um treino transforma vencimento em
 * raiva, e raiva não volta a assinar.
 *
 * Lê o perfil com o cliente autenticado (respeitando RLS), não com service_role: a pessoa
 * só pode consultar a própria assinatura mesmo.
 */
export async function requireSubscription(
  userId: string
): Promise<{ estado: EstadoDeAcesso; error: null } | { estado: null; error: NextResponse }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('profiles')
    .select('subscription_status, trial_ends_at, subscription_expires_at, subscription_plan')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    // Falha ao LER a assinatura não é o mesmo que não ter assinatura. Um erro de rede ou uma
    // migration ainda não aplicada barraria todo mundo, inclusive quem paga. Libera e deixa
    // o rastro no log — o prejuízo de uma geração indevida é de centavos.
    console.error('[subscription-guard] falha ao ler assinatura, liberando por seguranca:', error.message);
    return {
      estado: estadoDeAcesso({ subscriptionStatus: 'cortesia' }),
      error: null,
    };
  }

  const estado = estadoDeAcesso({
    subscriptionStatus: data?.subscription_status,
    trialEndsAt: data?.trial_ends_at,
    subscriptionExpiresAt: data?.subscription_expires_at,
    subscriptionPlan: data?.subscription_plan,
  });

  if (!estado.temAcesso) {
    return {
      estado: null,
      error: NextResponse.json(
        {
          error: mensagemDeBloqueio(estado),
          code: 'ASSINATURA_NECESSARIA',
          status: estado.status,
        },
        { status: HTTP_ASSINATURA_NECESSARIA }
      ),
    };
  }

  return { estado, error: null };
}
