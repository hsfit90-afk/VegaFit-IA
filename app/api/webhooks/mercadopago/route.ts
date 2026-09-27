import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  assinaturaDoWebhookConfere,
  consultarAssinatura,
  statusParaAssinatura,
  mercadoPagoConfigurado,
} from '@/lib/mercadopago';

/**
 * Recebe as notificações de assinatura do Mercado Pago.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O CORPO DA NOTIFICAÇÃO NÃO É CONFIÁVEL E NÃO É USADO PARA DECIDIR NADA.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * A URL é pública — qualquer pessoa na internet pode fazer POST aqui. Por isso a rota trata
 * a notificação apenas como um aviso de "a assinatura X mudou" e vai CONSULTAR a API do
 * Mercado Pago, autenticada com o nosso access token, para descobrir o estado real.
 *
 * Consequência prática: mesmo que alguém forje uma notificação perfeita, com assinatura HMAC
 * válida, ela não libera acesso nenhum — porque o Mercado Pago responderia que a assinatura
 * não existe, ou que não está autorizada. A validação HMAC é a primeira barreira; a consulta
 * é a que de fato decide.
 *
 * SEMPRE RESPONDE 200 quando a notificação é legítima, mesmo em erro interno. O Mercado Pago
 * reenvia o que não recebe 2xx, e uma falha nossa viraria uma fila de reenvios. O caso real é
 * recuperado na próxima notificação ou pela consulta ao abrir o app.
 */

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Assinatura inválida: 401 sem detalhe. Não confirmamos nada a quem está sondando.
  const confere = assinaturaDoWebhookConfere({
    xSignature: req.headers.get('x-signature'),
    xRequestId: req.headers.get('x-request-id'),
    dataId: req.nextUrl.searchParams.get('data.id'),
  });
  if (!confere) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (!mercadoPagoConfigurado()) {
    console.error('[webhook mp] recebido sem MERCADOPAGO_ACCESS_TOKEN configurado');
    return NextResponse.json({ ok: true });
  }

  let corpo: { type?: string; action?: string; data?: { id?: string } } = {};
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  // Só assinatura interessa. Pagamento avulso e plano são ignorados de propósito — a fonte
  // da verdade do acesso é o estado da assinatura, não o de um pagamento isolado.
  const tipo = corpo.type ?? corpo.action?.split('.')[0];
  if (tipo !== 'subscription_preapproval' && tipo !== 'subscription_authorized_payment') {
    return NextResponse.json({ ok: true });
  }

  const idAssinatura = corpo.data?.id ?? req.nextUrl.searchParams.get('data.id');
  if (!idAssinatura) return NextResponse.json({ ok: true });

  try {
    // A consulta é quem decide. Nada do corpo da requisição chega ao banco.
    const mp = await consultarAssinatura(idAssinatura);
    if (!mp) {
      console.warn('[webhook mp] assinatura inexistente na API:', idAssinatura);
      return NextResponse.json({ ok: true });
    }

    const userId = mp.external_reference;
    if (!userId) {
      console.error('[webhook mp] assinatura sem external_reference:', idAssinatura);
      return NextResponse.json({ ok: true });
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // Nunca rebaixa quem está em cortesia. Se um dos seus testadores um dia assinar e depois
    // cancelar, ele volta a ser cortesia — não pode virar 'vencido' e perder o acesso que
    // tinha antes de existir cobrança.
    const { data: perfil } = await admin
      .from('profiles')
      .select('subscription_status')
      .eq('id', userId)
      .maybeSingle();

    if (perfil?.subscription_status === 'cortesia') {
      console.log('[webhook mp] perfil em cortesia, status preservado:', userId);
      return NextResponse.json({ ok: true });
    }

    const novo = statusParaAssinatura(mp);
    const { error } = await admin
      .from('profiles')
      .update({
        ...novo,
        gateway: 'mercadopago',
        gateway_subscription_id: mp.id,
        gateway_customer_id: mp.payer_id ? String(mp.payer_id) : null,
      })
      .eq('id', userId);

    if (error) console.error('[webhook mp] falha ao gravar:', error.message);
    else console.log(`[webhook mp] ${userId} -> ${novo.subscription_status} (mp: ${mp.status})`);
  } catch (e) {
    // 200 mesmo assim: reenvio em massa por falha nossa é pior que perder um evento, que a
    // próxima notificação recupera.
    console.error('[webhook mp] erro ao processar:', e instanceof Error ? e.message : e);
  }

  return NextResponse.json({ ok: true });
}
