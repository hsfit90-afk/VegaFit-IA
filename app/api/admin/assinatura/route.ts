import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/utils/supabase/auth-guard';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

/**
 * Permite ao dono do produto mudar a assinatura de um aluno na mão.
 *
 * POR QUE PRECISA SER ROTA DE SERVIDOR
 *
 * O gatilho da migration 34 preserva as colunas de assinatura em QUALQUER escrita vinda de
 * conexão autenticada — inclusive a sua, de master. É proposital: o gatilho não sabe quem é
 * master, ele só sabe distinguir "veio do navegador" de "veio do backend". Então a alteração
 * legítima tem que passar por aqui, com service_role, depois de conferir o papel no servidor.
 *
 * O PAPEL É CONFERIDO AQUI, NÃO NO NAVEGADOR
 *
 * A tela /admin já esconde o painel de quem não é master, mas isso é conveniência visual:
 * qualquer pessoa pode chamar esta rota direto. A checagem que vale é a de baixo, lendo o
 * papel do banco com a sessão de quem pediu.
 */

type Acao = 'cortesia' | 'ativo' | 'trial' | 'vencido';

const DIA_MS = 24 * 60 * 60 * 1000;

/** Quantos dias cada ação concede. null = sem prazo. */
const DIAS_PADRAO: Record<Acao, number | null> = {
  cortesia: null,   // vitalício
  ativo: 30,        // um mês pago, o padrão de quem pagou por fora (Pix, dinheiro)
  trial: 7,         // um teste novo
  vencido: 0,       // corta agora
};

export async function POST(req: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    // A checagem que importa: o papel vem do banco, na sessão de quem chamou.
    const supabase = await createClient();
    const { data: quemPediu } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (quemPediu?.role !== 'master') {
      // 404 e não 403: para quem não é master, esta rota não existe. Confirmar que existe já
      // entrega informação a quem está sondando.
      return NextResponse.json({ error: 'Nao encontrado.' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const alvo = String(body?.userId ?? '');
    const acao = body?.acao as Acao;
    const diasPedidos = body?.dias === undefined ? undefined : Number(body.dias);

    if (!/^[0-9a-f-]{36}$/i.test(alvo)) {
      return NextResponse.json({ error: 'Aluno invalido.' }, { status: 400 });
    }
    if (!['cortesia', 'ativo', 'trial', 'vencido'].includes(acao)) {
      return NextResponse.json({ error: 'Acao invalida.' }, { status: 400 });
    }
    if (diasPedidos !== undefined && (!Number.isFinite(diasPedidos) || diasPedidos < 0 || diasPedidos > 3650)) {
      return NextResponse.json({ error: 'Prazo invalido.' }, { status: 400 });
    }

    const dias = diasPedidos ?? DIAS_PADRAO[acao];
    const agora = Date.now();
    const ate = dias === null ? null : new Date(agora + dias * DIA_MS).toISOString();

    // Cada ação grava um conjunto coerente. Deixar data velha em campo que não pertence ao
    // novo estado é a origem clássica de "o aluno perdeu o acesso e ninguém sabe por quê".
    const campos: Record<string, unknown> = { subscription_status: acao };
    if (acao === 'cortesia') {
      campos.trial_ends_at = null;
      campos.subscription_expires_at = null;
    } else if (acao === 'trial') {
      campos.trial_ends_at = ate;
      campos.subscription_expires_at = null;
    } else if (acao === 'ativo') {
      campos.subscription_expires_at = ate;
    } else {
      campos.subscription_expires_at = new Date(agora - DIA_MS).toISOString();
    }

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const { data, error } = await admin
      .from('profiles')
      .update(campos)
      .eq('id', alvo)
      .select('id, name, subscription_status, trial_ends_at, subscription_expires_at')
      .maybeSingle();

    if (error) {
      console.error('[admin/assinatura] falha:', error.message);
      return NextResponse.json({ error: 'Nao consegui alterar.' }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Aluno nao encontrado.' }, { status: 404 });
    }

    // Rastro: alteração manual de acesso é o tipo de coisa que você vai querer conferir
    // depois, quando não lembrar por que fulano está liberado.
    console.log(`[admin/assinatura] ${user.id} definiu ${alvo} como ${acao}${dias ? ` por ${dias} dias` : ''}`);

    return NextResponse.json({ ok: true, perfil: data });
  } catch (e) {
    console.error('[admin/assinatura] erro:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Nao consegui alterar.' }, { status: 500 });
  }
}
