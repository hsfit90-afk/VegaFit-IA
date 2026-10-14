import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/utils/supabase/auth-guard';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

/**
 * Modelos de dia de treino do profissional.
 *
 * O Treino do Personal é montado à mão, e dez alunos com perfis parecidos recebem treinos
 * parecidos. Salvar o dia uma vez e carregar depois é o que faz dez treinos por mês caberem
 * numa agenda que também atende aluno presencial.
 *
 * Organizados por OBJETIVO, por decisão do profissional: é a primeira pergunta que ele se faz
 * ao abrir o montador, e é o que mais muda séries, repetições e descanso.
 *
 * O MODELO GUARDA O NOME DO EXERCÍCIO, NÃO O ID. O montador reencontra o id no catálogo ao
 * carregar. Assim um exercício recadastrado não transforma o modelo em linha vazia, e o
 * modelo sobrevive a mudanças no catálogo — que já aconteceram mais de uma vez neste projeto.
 */

const OBJETIVOS = ['Hipertrofia', 'Emagrecimento', 'Performance', 'Saúde geral', 'Definição muscular'];

const LIMITE_MODELOS = 200;
const LIMITE_EXERCICIOS = 20;

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

const UUID = /^[0-9a-f-]{36}$/i;

export async function GET(req: NextRequest) {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;
  // 404 e não 403: confirmar que a rota existe já entrega informação a quem sonda.
  if (!(await souMaster(user.id))) return NextResponse.json({ error: 'Nao encontrado.' }, { status: 404 });

  const objetivo = req.nextUrl.searchParams.get('objetivo');

  let consulta = admin()
    .from('modelos_de_sessao')
    .select('id, nome, objetivo, nota, exercicios, created_at')
    .eq('master_id', user.id)
    .order('created_at', { ascending: false })
    .limit(LIMITE_MODELOS);

  // Sem objetivo na URL devolve todos: a tela usa isso para contar quantos existem no total.
  if (objetivo) consulta = consulta.eq('objetivo', objetivo);

  const { data, error } = await consulta;
  if (error) {
    console.error('[admin/modelos] GET:', error.message);
    return NextResponse.json({ error: 'Nao consegui carregar os modelos.' }, { status: 500 });
  }

  return NextResponse.json({ modelos: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;
  if (!(await souMaster(user.id))) return NextResponse.json({ error: 'Nao encontrado.' }, { status: 404 });

  try {
    const body = await req.json().catch(() => ({}));
    const nome = String(body?.nome ?? '').trim().slice(0, 120);
    const objetivo = String(body?.objetivo ?? '').trim();
    const nota = String(body?.nota ?? '').trim().slice(0, 300) || null;

    if (!nome) {
      return NextResponse.json({ error: 'De um nome ao modelo.' }, { status: 400 });
    }
    if (!OBJETIVOS.includes(objetivo)) {
      return NextResponse.json({ error: 'Objetivo invalido.' }, { status: 400 });
    }

    // Normaliza o que veio da tela, pelo mesmo motivo de /api/admin/plano: um "sets": 0 ou um
    // descanso negativo viram sessão quebrada, e o aluno não tem como consertar sozinho.
    const exercicios = (Array.isArray(body?.exercicios) ? body.exercicios : [])
      .slice(0, LIMITE_EXERCICIOS)
      .map((e: any) => ({
        name: String(e?.name ?? '').slice(0, 160),
        muscleGroup: String(e?.muscleGroup ?? '').slice(0, 60),
        sets: Math.min(10, Math.max(1, Number(e?.sets) || 3)),
        reps: String(e?.reps ?? '8-12').slice(0, 20),
        restSeconds: Math.min(600, Math.max(0, Number(e?.restSeconds) || 60)),
        tips: String(e?.tips ?? '').slice(0, 500),
      }))
      .filter((e: any) => e.name);

    if (exercicios.length === 0) {
      return NextResponse.json({ error: 'O modelo precisa de ao menos um exercicio.' }, { status: 400 });
    }

    const { data, error } = await admin()
      .from('modelos_de_sessao')
      .insert({ master_id: user.id, nome, objetivo, nota, exercicios })
      .select('id, nome, objetivo, nota, exercicios, created_at')
      .single();

    if (error) {
      console.error('[admin/modelos] POST:', error.message);
      return NextResponse.json({ error: 'Nao consegui salvar o modelo.' }, { status: 500 });
    }

    console.log(`[admin/modelos] ${user.id} salvou "${nome}" (${objetivo}, ${exercicios.length} exercicios)`);
    return NextResponse.json({ ok: true, modelo: data });
  } catch (e) {
    console.error('[admin/modelos] erro:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Nao consegui salvar o modelo.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;
  if (!(await souMaster(user.id))) return NextResponse.json({ error: 'Nao encontrado.' }, { status: 404 });

  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!UUID.test(id)) {
    return NextResponse.json({ error: 'Modelo invalido.' }, { status: 400 });
  }

  // O master_id no filtro não é redundante com a RLS: esta rota usa service_role, que ignora
  // RLS. Sem ele, um id vazado apagaria o modelo de outra conta.
  const { error } = await admin()
    .from('modelos_de_sessao')
    .delete()
    .eq('id', id)
    .eq('master_id', user.id);

  if (error) {
    console.error('[admin/modelos] DELETE:', error.message);
    return NextResponse.json({ error: 'Nao consegui apagar.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
