import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/utils/supabase/auth-guard';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import type { StatusPedido } from '@/lib/treinoPersonalizado';

/**
 * Fila de Treino Personalizado, do lado do profissional.
 *
 * GET  lista os pedidos em andamento, do mais antigo para o mais novo — quem esperou mais
 *      aparece primeiro, que é a ordem em que eles devem ser atendidos.
 * POST muda o status de um pedido.
 *
 * Só o backend muda status, e é por isso que a migration 35 não criou policy de UPDATE para
 * o aluno: sem essa rota, qualquer um marcaria o próprio pedido como 'pago' e levaria um
 * treino de R$ 147 de graça.
 *
 * O papel é conferido no servidor, lendo do banco. A tela /admin esconder o painel é
 * conveniência visual — qualquer pessoa pode chamar esta rota direto.
 */

const VALIDOS: StatusPedido[] = ['aguardando_pagamento', 'pago', 'em_producao', 'entregue', 'cancelado'];

async function souMaster(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
  return data?.role === 'master';
}

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET() {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;
  // 404 e não 403: confirmar que a rota existe já entrega informação a quem está sondando.
  if (!(await souMaster(user.id))) return NextResponse.json({ error: 'Nao encontrado.' }, { status: 404 });

  const { data, error } = await admin()
    .from('treino_personalizado_pedidos')
    .select('id, user_id, status, valor, objetivo, observacoes, created_at, pago_em, entregue_em')
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) {
    console.error('[admin/personalizado] GET:', error.message);
    return NextResponse.json({ error: 'Nao consegui carregar.' }, { status: 500 });
  }

  // O nome do aluno vem numa segunda consulta em vez de join, para não trazer o perfil
  // inteiro de ninguém — mesmo cuidado do painel de usuários.
  const ids = [...new Set((data ?? []).map(p => p.user_id))];
  const { data: perfis } = ids.length
    ? await admin().from('profiles').select('id, name').in('id', ids)
    : { data: [] as { id: string; name: string | null }[] };

  const nomes = new Map((perfis ?? []).map(p => [p.id, p.name]));
  return NextResponse.json({
    pedidos: (data ?? []).map(p => ({ ...p, nome: nomes.get(p.user_id) ?? 'Sem nome' })),
  });
}

export async function POST(req: NextRequest) {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;
  if (!(await souMaster(user.id))) return NextResponse.json({ error: 'Nao encontrado.' }, { status: 404 });

  try {
    const body = await req.json().catch(() => ({}));
    const id = String(body?.id ?? '');
    const status = body?.status as StatusPedido;

    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: 'Pedido invalido.' }, { status: 400 });
    }
    if (!VALIDOS.includes(status)) {
      return NextResponse.json({ error: 'Status invalido.' }, { status: 400 });
    }

    // Carimba a data junto com a mudança. Sem isto, "quando esse pedido foi pago?" vira uma
    // pergunta sem resposta no dia em que alguém contestar a cobrança.
    const campos: Record<string, unknown> = { status };
    if (status === 'pago') campos.pago_em = new Date().toISOString();
    if (status === 'entregue') campos.entregue_em = new Date().toISOString();

    const { data, error } = await admin()
      .from('treino_personalizado_pedidos')
      .update(campos)
      .eq('id', id)
      .select('id, status, pago_em, entregue_em')
      .maybeSingle();

    if (error) {
      console.error('[admin/personalizado] POST:', error.message);
      return NextResponse.json({ error: 'Nao consegui alterar.' }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: 'Pedido nao encontrado.' }, { status: 404 });

    console.log(`[admin/personalizado] ${user.id} moveu ${id} para ${status}`);
    return NextResponse.json({ ok: true, pedido: data });
  } catch (e) {
    console.error('[admin/personalizado] POST:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Nao consegui alterar.' }, { status: 500 });
  }
}
