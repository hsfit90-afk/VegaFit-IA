import { createHmac, timingSafeEqual } from 'node:crypto';

// Cliente do Mercado Pago para assinaturas (preapproval).
//
// Chamado só do servidor: o access token dá acesso total à conta de cobrança e nunca pode
// chegar ao navegador. Por isso nada aqui é importado por componente de cliente.

const API = 'https://api.mercadopago.com';

export const PLANOS = {
  mensal: { nome: 'VegaFit Mensal', valor: 37,  frequencia: 1,  unidade: 'months' as const },
  anual:  { nome: 'VegaFit Anual',  valor: 297, frequencia: 12, unidade: 'months' as const },
};
export type PlanoId = keyof typeof PLANOS;

/** Dias de teste gratuito antes da primeira cobrança. */
export const DIAS_DE_TESTE = 7;

function token(): string {
  const t = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!t) throw new Error('MERCADOPAGO_ACCESS_TOKEN nao configurado');
  return t;
}

export function mercadoPagoConfigurado(): boolean {
  return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN);
}

export interface Preapproval {
  id: string;
  status: 'pending' | 'authorized' | 'paused' | 'cancelled' | string;
  /** ISO. Durante o teste gratuito, é a data da primeira cobrança. */
  next_payment_date?: string | null;
  /** Nosso id de usuário, gravado na criação — é como o webhook acha o perfil. */
  external_reference?: string | null;
  payer_id?: number | string | null;
  init_point?: string | null;
}

/**
 * Cria a assinatura e devolve a URL de checkout.
 *
 * `external_reference` carrega o id do usuário. É o que permite ao webhook encontrar o
 * perfil sem depender de e-mail — que a pessoa pode trocar — nem de uma tabela de-para
 * que poderia sair de sincronia.
 */
export async function criarAssinatura(params: {
  plano: PlanoId;
  emailDoPagador: string;
  userId: string;
  urlDeRetorno: string;
}): Promise<Preapproval> {
  const p = PLANOS[params.plano];

  const res = await fetch(`${API}/preapproval`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      reason: p.nome,
      external_reference: params.userId,
      payer_email: params.emailDoPagador,
      back_url: params.urlDeRetorno,
      status: 'pending',
      auto_recurring: {
        frequency: p.frequencia,
        frequency_type: p.unidade,
        transaction_amount: p.valor,
        currency_id: 'BRL',
        free_trial: { frequency: DIAS_DE_TESTE, frequency_type: 'days' },
      },
    }),
  });

  const json = await res.json();
  if (!res.ok) {
    // A mensagem do Mercado Pago é útil no log, mas não volta para o aluno: ela pode citar
    // detalhes da conta de cobrança.
    console.error('[mercadopago] falha ao criar assinatura:', res.status, JSON.stringify(json));
    throw new Error('Nao foi possivel abrir o pagamento');
  }
  return json as Preapproval;
}

/**
 * Consulta o estado real de uma assinatura.
 *
 * ESTA É A FONTE DA VERDADE, não o corpo do webhook. A notificação diz apenas "a assinatura
 * X mudou"; quem responde "mudou para quê" é esta chamada, autenticada com o nosso token.
 * Assim, mesmo uma notificação forjada não libera nada: o Mercado Pago responderia 404 ou
 * um status não autorizado.
 */
export async function consultarAssinatura(id: string): Promise<Preapproval | null> {
  const res = await fetch(`${API}/preapproval/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token()}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    console.error('[mercadopago] falha ao consultar assinatura:', res.status);
    throw new Error('Falha ao consultar assinatura');
  }
  return (await res.json()) as Preapproval;
}

/** Cancela a assinatura no Mercado Pago. Idempotente do nosso lado. */
export async function cancelarAssinatura(id: string): Promise<void> {
  const res = await fetch(`${API}/preapproval/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'cancelled' }),
  });
  if (!res.ok && res.status !== 404) {
    console.error('[mercadopago] falha ao cancelar:', res.status);
    throw new Error('Falha ao cancelar assinatura');
  }
}

/**
 * Valida a assinatura HMAC da notificação.
 *
 * FALHA FECHADO, de propósito: sem segredo configurado, com header ausente ou com assinatura
 * que não bate, retorna false e a notificação é recusada.
 *
 * O template abaixo é o documentado pelo Mercado Pago. Se ele estiver diferente na sua conta,
 * o sintoma é assinatura nunca ativando — nunca o contrário —, porque a rota só libera acesso
 * depois de CONSULTAR a API. Em outras palavras: um erro aqui atrasa ativação, não abre porta.
 * O log de rejeição registra o manifest usado, para conferir contra o primeiro evento real.
 */
export function assinaturaDoWebhookConfere(params: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
}): boolean {
  const segredo = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!segredo || !params.xSignature || !params.dataId) return false;

  // x-signature: "ts=1704908010,v1=618c8534..."
  const partes = Object.fromEntries(
    params.xSignature.split(',').map(p => {
      const [k, ...resto] = p.split('=');
      return [k.trim(), resto.join('=').trim()];
    })
  );
  const ts = partes.ts;
  const v1 = partes.v1;
  if (!ts || !v1) return false;

  // O id vai em minúsculas quando for alfanumérico, conforme a documentação.
  const id = /^[a-zA-Z0-9]+$/.test(params.dataId) ? params.dataId.toLowerCase() : params.dataId;
  const manifest = `id:${id};request-id:${params.xRequestId ?? ''};ts:${ts};`;

  const esperado = createHmac('sha256', segredo).update(manifest).digest('hex');

  const a = Buffer.from(esperado, 'utf8');
  const b = Buffer.from(v1, 'utf8');
  if (a.length !== b.length) {
    console.warn('[mercadopago] assinatura com tamanho inesperado; manifest usado:', manifest);
    return false;
  }
  const bate = timingSafeEqual(a, b);
  if (!bate) console.warn('[mercadopago] assinatura nao confere; manifest usado:', manifest);
  return bate;
}

/**
 * Traduz o status do Mercado Pago para o nosso.
 *
 * Durante o teste gratuito a assinatura já vem como `authorized`, com next_payment_date na
 * data da primeira cobrança — então 'ativo' com vencimento nessa data descreve os dois casos
 * sem precisar de estado separado.
 */
export function statusParaAssinatura(mp: Preapproval): {
  subscription_status: 'ativo' | 'cancelado' | 'vencido';
  subscription_expires_at: string | null;
} {
  const vence = mp.next_payment_date ?? null;
  switch (mp.status) {
    case 'authorized':
      return { subscription_status: 'ativo', subscription_expires_at: vence };
    case 'cancelled':
      return { subscription_status: 'cancelado', subscription_expires_at: vence };
    // 'paused' e 'pending' cobrem cartão recusado e checkout abandonado. Nos dois casos não
    // há pagamento confirmado, e a tolerância de lib/subscription.ts não se aplica porque
    // não houve período pago.
    default:
      return { subscription_status: 'vencido', subscription_expires_at: vence };
  }
}
