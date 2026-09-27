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
/**
 * Interruptor geral da cobrança.
 *
 * DESLIGADO por padrão, de propósito: a ausência da variável, um erro de digitação no painel
 * da Vercel ou um ambiente novo nunca podem começar barrando aluno. Só o valor exato "true"
 * liga — qualquer outra coisa ("TRUE", "1", "sim", vazio) mantém desligado.
 *
 * Com a cobrança desligada, este guarda libera todo mundo e ninguém vê tela de pagamento,
 * mesmo com o código inteiro publicado. É assim que dá para subir a integração, testar o
 * checkout e o webhook, e só depois abrir a venda — sem precisar de outro deploy.
 *
 * Para ligar: variável COBRANCA_ATIVA = true no painel da Vercel, e redeploy.
 * Para desligar: apague a variável ou troque para false, e redeploy.
 */
export function cobrancaAtiva(): boolean {
  return process.env.COBRANCA_ATIVA === 'true';
}

export async function requireSubscription(
  userId: string
): Promise<{ estado: EstadoDeAcesso; error: null } | { estado: null; error: NextResponse }> {
  // Cobrança desligada: ninguém é barrado, nem quem já passou dos 7 dias de teste.
  if (!cobrancaAtiva()) {
    return { estado: estadoDeAcesso({ subscriptionStatus: 'cortesia' }), error: null };
  }

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
