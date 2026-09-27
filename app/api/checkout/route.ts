import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/utils/supabase/auth-guard';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { criarAssinatura, mercadoPagoConfigurado, PLANOS, type PlanoId } from '@/lib/mercadopago';
import { estadoDeAcesso } from '@/lib/subscription';

/**
 * Abre o checkout de assinatura e devolve a URL para onde o navegador deve ir.
 *
 * O valor NUNCA vem do cliente — só o identificador do plano. Aceitar preço do navegador é
 * como um aluno assinaria por R$ 1,00.
 */
export async function POST(req: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    if (!mercadoPagoConfigurado()) {
      return NextResponse.json(
        { error: 'O pagamento ainda nao esta configurado. Tente novamente em instantes.' },
        { status: 503 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const plano = body?.plano as PlanoId;
    if (plano !== 'mensal' && plano !== 'anual') {
      return NextResponse.json({ error: 'Plano invalido.' }, { status: 400 });
    }

    // Quem já tem assinatura ativa não pode abrir outra: o Mercado Pago cobraria as duas.
    const supabase = await createClient();
    const { data: perfil } = await supabase
      .from('profiles')
      .select('subscription_status, trial_ends_at, subscription_expires_at, gateway_subscription_id')
      .eq('id', user.id)
      .maybeSingle();

    const estado = estadoDeAcesso({
      subscriptionStatus: perfil?.subscription_status,
      trialEndsAt: perfil?.trial_ends_at,
      subscriptionExpiresAt: perfil?.subscription_expires_at,
    });
    if (estado.status === 'ativo' && estado.temAcesso) {
      return NextResponse.json(
        { error: 'Voce ja tem uma assinatura ativa.' },
        { status: 409 }
      );
    }

    const origem = req.nextUrl.origin;
    const assinatura = await criarAssinatura({
      plano,
      emailDoPagador: user.email ?? '',
      userId: user.id,
      urlDeRetorno: `${origem}/assinar/retorno`,
    });

    if (!assinatura.init_point) {
      console.error('[checkout] Mercado Pago nao devolveu init_point:', assinatura.id);
      return NextResponse.json({ error: 'Nao foi possivel abrir o pagamento.' }, { status: 502 });
    }

    // Grava o vínculo ANTES de mandar a pessoa pagar. Se ela pagar e o webhook chegar antes
    // de gravarmos, o webhook não acharia o perfil pelo id da assinatura — e o pagamento
    // ficaria órfão. Escreve com service_role porque o gatilho da migration 34 bloqueia
    // qualquer escrita nessas colunas vinda de conexão autenticada.
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
    const { error: erroGravacao } = await admin
      .from('profiles')
      .update({
        gateway: 'mercadopago',
        gateway_subscription_id: assinatura.id,
        subscription_plan: plano,
      })
      .eq('id', user.id);

    if (erroGravacao) {
      console.error('[checkout] falha ao gravar vinculo da assinatura:', erroGravacao.message);
      return NextResponse.json({ error: 'Nao foi possivel abrir o pagamento.' }, { status: 500 });
    }

    return NextResponse.json({ url: assinatura.init_point, valor: PLANOS[plano].valor });
  } catch (e) {
    console.error('[checkout] erro inesperado:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Nao foi possivel abrir o pagamento.' }, { status: 500 });
  }
}
