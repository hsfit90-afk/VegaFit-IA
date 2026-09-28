import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/utils/supabase/auth-guard';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { vagasDoMes, jaTemPedidoAberto, VALOR } from '@/lib/treinoPersonalizado';

/**
 * Pedido de Treino Personalizado.
 *
 * GET  devolve quantas vagas restam no mês e o pedido em aberto do aluno, se houver.
 * POST abre um pedido.
 *
 * As duas regras — vagas do mês e um pedido por aluno — são conferidas AQUI, mesmo já
 * aparecendo na tela. A tela informa; o servidor decide. Sem esta checagem, dois alunos
 * clicando ao mesmo tempo na última vaga abrem os dois pedidos, e quem fica devendo o treino
 * é você.
 */

/** Contagem de vagas precisa enxergar os pedidos de TODO mundo, não só os de quem pediu. */
function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

async function estadoAtual(userId: string) {
  const db = admin();
  const inicioDoMes = new Date();
  inicioDoMes.setUTCDate(1);
  inicioDoMes.setUTCHours(0, 0, 0, 0);

  const [{ data: doMes }, { data: doAluno }] = await Promise.all([
    db.from('treino_personalizado_pedidos')
      .select('status, created_at')
      .gte('created_at', inicioDoMes.toISOString()),
    db.from('treino_personalizado_pedidos')
      .select('id, status, created_at, objetivo, workout_plan_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const vagas = vagasDoMes((doMes ?? []).map(p => ({ status: p.status, createdAt: p.created_at })));
  const meus = (doAluno ?? []).map(p => ({ status: p.status, createdAt: p.created_at }));
  return { vagas, pedidos: doAluno ?? [], temAberto: jaTemPedidoAberto(meus) };
}

export async function GET() {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const { vagas, pedidos, temAberto } = await estadoAtual(user.id);
    return NextResponse.json({
      valor: VALOR,
      vagasRestantes: vagas.restantes,
      esgotado: vagas.esgotado,
      temPedidoAberto: temAberto,
      pedidos,
      // Só os dígitos do número, sem formatação: a tela monta o link wa.me.
      whatsapp: (process.env.WHATSAPP_PROFISSIONAL ?? '').replace(/\D/g, '') || null,
    });
  } catch (e) {
    console.error('[personalizado] GET:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Nao consegui carregar.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const body = await req.json().catch(() => ({}));
    const objetivo = String(body?.objetivo ?? '').trim().slice(0, 200);
    const observacoes = String(body?.observacoes ?? '').trim().slice(0, 1000);

    if (!objetivo) {
      return NextResponse.json({ error: 'Conte qual e o seu objetivo.' }, { status: 400 });
    }

    // A tela já mostra as vagas, mas quem decide é aqui: dois alunos clicando ao mesmo tempo
    // na última vaga abririam os dois pedidos, e a conta sobraria para você.
    const { vagas, temAberto } = await estadoAtual(user.id);
    if (vagas.esgotado) {
      return NextResponse.json(
        { error: 'As vagas deste mes acabaram. Volte no dia 1º.' },
        { status: 409 }
      );
    }
    if (temAberto) {
      return NextResponse.json(
        { error: 'Voce ja tem um pedido em andamento.' },
        { status: 409 }
      );
    }

    // Insere com a sessão do aluno, respeitando a RLS: a política de INSERT garante que
    // ninguém abre pedido no nome de outra pessoa. O valor vem da constante do servidor —
    // nunca do corpo da requisição.
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('treino_personalizado_pedidos')
      .insert({ user_id: user.id, valor: VALOR, objetivo, observacoes, status: 'aguardando_pagamento' })
      .select('id, status, created_at')
      .single();

    if (error) {
      console.error('[personalizado] POST:', error.message);
      return NextResponse.json({ error: 'Nao consegui registrar o pedido.' }, { status: 500 });
    }

    console.log(`[personalizado] pedido ${data.id} aberto por ${user.id}`);
    return NextResponse.json({ ok: true, pedido: data, valor: VALOR });
  } catch (e) {
    console.error('[personalizado] POST:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Nao consegui registrar o pedido.' }, { status: 500 });
  }
}
