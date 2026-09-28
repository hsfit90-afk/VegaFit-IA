import { NextResponse } from 'next/server';
import { requireAuth } from '@/utils/supabase/auth-guard';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { consultarAssinatura, statusParaAssinatura, mercadoPagoConfigurado } from '@/lib/mercadopago';
import { estadoDeAcesso } from '@/lib/subscription';

/**
 * Pergunta ao Mercado Pago o estado real da assinatura DESTE aluno e grava o resultado.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EXISTE PARA O WEBHOOK NÃO SER PONTO ÚNICO DE FALHA.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * O webhook é a via rápida: o Mercado Pago avisa e o acesso libera em segundos. Mas ele
 * depende de coisas fora do nosso controle — a notificação pode atrasar, a Vercel pode estar
 * reiniciando, a validação da assinatura HMAC pode recusar por um detalhe de formato. Em
 * qualquer um desses casos o sintoma é o pior possível: o aluno paga, o dinheiro sai, e o
 * acesso não abre.
 *
 * Esta rota fecha esse buraco. Ela é chamada quando o aluno volta do checkout e sempre que
 * ele cai na tela de assinatura, e faz a mesma pergunta que o webhook faria — só que puxando
 * em vez de esperar empurrarem. O resultado é o mesmo, com alguns segundos a mais.
 *
 * Com ela, o webhook vira otimização, não requisito.
 *
 * Não é uma porta de entrada: exige sessão, e só consulta a assinatura vinculada ao próprio
 * perfil de quem pediu. O aluno não consegue sincronizar a assinatura de outra pessoa nem
 * inventar um id — o id vem do banco, não do corpo da requisição.
 */
export async function POST() {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const supabase = await createClient();
    const { data: perfil } = await supabase
      .from('profiles')
      .select('subscription_status, trial_ends_at, subscription_expires_at, gateway_subscription_id')
      .eq('id', user.id)
      .maybeSingle();

    // Cortesia nunca é rebaixada, nem por engano nem por assinatura cancelada lá fora.
    if (perfil?.subscription_status === 'cortesia') {
      return NextResponse.json({ status: 'cortesia', temAcesso: true, sincronizado: false });
    }

    const idAssinatura = perfil?.gateway_subscription_id;
    if (!idAssinatura || !mercadoPagoConfigurado()) {
      const estado = estadoDeAcesso({
        subscriptionStatus: perfil?.subscription_status,
        trialEndsAt: perfil?.trial_ends_at,
        subscriptionExpiresAt: perfil?.subscription_expires_at,
      });
      return NextResponse.json({ status: estado.status, temAcesso: estado.temAcesso, sincronizado: false });
    }

    const mp = await consultarAssinatura(idAssinatura);
    if (!mp) {
      return NextResponse.json({ status: perfil?.subscription_status, temAcesso: false, sincronizado: false });
    }

    // A assinatura consultada precisa ser mesmo deste aluno. O id veio do nosso banco, então
    // isto é defesa em profundidade: protege contra um vínculo gravado errado em algum ponto.
    if (mp.external_reference && mp.external_reference !== user.id) {
      console.error('[sincronizar] assinatura de outro usuario:', idAssinatura, mp.external_reference);
      return NextResponse.json({ error: 'Assinatura nao confere.' }, { status: 409 });
    }

    const novo = statusParaAssinatura(mp);
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
    const { error } = await admin.from('profiles').update(novo).eq('id', user.id);
    if (error) {
      console.error('[sincronizar] falha ao gravar:', error.message);
      return NextResponse.json({ error: 'Falha ao sincronizar.' }, { status: 500 });
    }

    const estado = estadoDeAcesso({
      subscriptionStatus: novo.subscription_status,
      subscriptionExpiresAt: novo.subscription_expires_at,
    });
    console.log(`[sincronizar] ${user.id} -> ${novo.subscription_status} (mp: ${mp.status})`);
    return NextResponse.json({ status: estado.status, temAcesso: estado.temAcesso, sincronizado: true });
  } catch (e) {
    console.error('[sincronizar] erro:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Falha ao sincronizar.' }, { status: 500 });
  }
}
