import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/utils/supabase/auth-guard';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { limparAlvosPorSerie } from '@/lib/metodoTreino';

/**
 * Salva um plano de treino montado à mão pelo profissional, na conta de um aluno.
 *
 * POR QUE PRECISA SER ROTA DE SERVIDOR
 *
 * A RLS de workout_plans é `auth.uid() = user_id` — o que está certo: ninguém deve poder
 * escrever plano na conta de outra pessoa pelo navegador. Só que o master PRECISA, para
 * entregar o Treino do Personal. A permissão é conferida aqui, no servidor, e a escrita vai
 * com service_role.
 *
 * GET com ?userId= devolve os planos que o aluno já tem, para o editor partir de um existente
 * em vez do zero. Revisar um plano gerado leva uns dez minutos; montar do zero leva quarenta,
 * e é o que decide se o produto cabe na agenda.
 */

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

async function souMaster(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
  return data?.role === 'master';
}

export async function GET(req: NextRequest) {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;
  // 404 e não 403: confirmar que a rota existe já entrega informação a quem sonda.
  if (!(await souMaster(user.id))) return NextResponse.json({ error: 'Nao encontrado.' }, { status: 404 });

  const alvo = req.nextUrl.searchParams.get('userId');

  // Sem aluno indicado, devolve a lista de alunos para o seletor.
  if (!alvo) {
    const { data } = await admin()
      .from('profiles')
      .select('id, name, role')
      .order('created_at', { ascending: false })
      .limit(200);
    return NextResponse.json({ alunos: data ?? [] });
  }

  if (!/^[0-9a-f-]{36}$/i.test(alvo)) {
    return NextResponse.json({ error: 'Aluno invalido.' }, { status: 400 });
  }

  const { data, error } = await admin()
    .from('workout_plans')
    .select('id, name, split, sessions, training_method, equipment, created_at')
    .eq('user_id', alvo)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('[admin/plano] GET:', error.message);
    return NextResponse.json({ error: 'Nao consegui carregar.' }, { status: 500 });
  }
  return NextResponse.json({ planos: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;
  if (!(await souMaster(user.id))) return NextResponse.json({ error: 'Nao encontrado.' }, { status: 404 });

  try {
    const body = await req.json().catch(() => ({}));
    const alvo = String(body?.userId ?? '');
    const nome = String(body?.name ?? '').trim().slice(0, 120);
    const split = String(body?.split ?? '').trim().slice(0, 60);
    const sessoes = body?.sessions;

    if (!/^[0-9a-f-]{36}$/i.test(alvo)) {
      return NextResponse.json({ error: 'Escolha um aluno.' }, { status: 400 });
    }
    if (!nome) {
      return NextResponse.json({ error: 'Dê um nome ao treino.' }, { status: 400 });
    }
    if (!Array.isArray(sessoes) || sessoes.length === 0) {
      return NextResponse.json({ error: 'O treino precisa de pelo menos um dia.' }, { status: 400 });
    }

    // Normaliza o que veio da tela. Sanidade de número aqui e não só no formulário: um
    // "sets": 0 ou um descanso negativo viram sessão quebrada na tela do aluno, e ele não tem
    // como consertar sozinho.
    const limpas = sessoes.slice(0, 7).map((s: any, i: number) => ({
      id: String(s?.id || `s${i + 1}`),
      name: String(s?.name || `Treino ${String.fromCharCode(65 + i)}`).slice(0, 80),
      exercises: (Array.isArray(s?.exercises) ? s.exercises : []).slice(0, 20).map((e: any, j: number) =>
        limparAlvosPorSerie({
          id: String(e?.id || `${i}-${j}`),
          exerciseId: String(e?.exerciseId || ''),
          name: String(e?.name || '').slice(0, 160),
          muscleGroup: String(e?.muscleGroup || '').slice(0, 60),
          sets: Math.min(10, Math.max(1, Number(e?.sets) || 3)),
          reps: String(e?.reps || '8-12').slice(0, 20),
          restSeconds: Math.min(600, Math.max(0, Number(e?.restSeconds) || 60)),
          tips: String(e?.tips || '').slice(0, 500),
          youtubeSearchTerm: String(e?.name || '').slice(0, 120),
          targetLabels: e?.targetLabels,
          targetReps: e?.targetReps,
          targetWeights: e?.targetWeights,
        })
      ),
    })).filter((s: any) => s.exercises.length > 0);

    if (limpas.length === 0) {
      return NextResponse.json({ error: 'Nenhum dia tem exercício.' }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const { error } = await admin().from('workout_plans').insert({
      id,
      user_id: alvo,
      name: nome,
      split: split || 'Personalizado',
      sessions: limpas,
      training_method: body?.trainingMethod || 'tradicional',
      equipment: body?.equipment || null,
      cardio_session: body?.cardioSession ?? null,
    });

    if (error) {
      console.error('[admin/plano] POST:', error.message);
      return NextResponse.json({ error: 'Nao consegui salvar o treino.' }, { status: 500 });
    }

    // Rastro: entrega de treino personalizado é o que você vai querer conferir depois, quando
    // um aluno disser que não recebeu.
    console.log(`[admin/plano] ${user.id} salvou o plano ${id} para ${alvo} (${limpas.length} dias)`);
    return NextResponse.json({ ok: true, planoId: id, dias: limpas.length });
  } catch (e) {
    console.error('[admin/plano] erro:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Nao consegui salvar o treino.' }, { status: 500 });
  }
}
