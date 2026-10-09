import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/utils/supabase/auth-guard';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import {
  moverExercicio,
  normalizarListas,
  passouDoLimite,
  LIMITE_POR_LISTA,
  type Marca,
} from '@/lib/listasDoAluno';

/**
 * Deixa o profissional fixar ou proibir exercícios na conta de um aluno.
 *
 * PARA QUE SERVE
 *
 * O aluno já podia marcar coração e lixeira na tela de treino, mas o profissional não tinha
 * como fazer isso por ele — e é o profissional quem sabe que aquele aluno não deve agachar
 * livre depois da cirurgia de joelho. Antes disso, a única forma de garantir um exercício
 * específico era montar o treino inteiro à mão no /admin/montar.
 *
 * SÃO TRÊS ESTADOS, NÃO DUAS LISTAS
 *
 * Cada exercício está em um de três lugares: sempre (favorito), nunca (banido) ou neutro. A
 * tela trabalha assim e a rota garante: entrar numa lista SAI da outra. Se o mesmo id ficasse
 * nas duas, app/api/treino/route.ts filtra os banidos primeiro — o exercício seria descartado
 * e o favorito nunca apareceria, sem nenhum aviso de que as duas marcas se contradizem.
 *
 * O PESO DE CADA LISTA É DIFERENTE
 *
 * Banido é regra: o exercício sai do catálogo antes do prompt, em código. Favorito é pedido:
 * vai ao prompt como "priorize quando couber", porque favorito não pode furar o protocolo de
 * volume nem o split. Quem precisa de garantia absoluta de um exercício usa o montador.
 *
 * POR QUE ROTA DE SERVIDOR
 *
 * A RLS de profiles é `auth.uid() = id`: ninguém escreve no perfil de outra pessoa pelo
 * navegador, e está certo assim. O papel é conferido aqui, no servidor, e a escrita vai com
 * service_role.
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

const UUID = /^[0-9a-f-]{36}$/i;

export async function GET(req: NextRequest) {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;
  // 404 e não 403: confirmar que a rota existe já entrega informação a quem sonda.
  if (!(await souMaster(user.id))) return NextResponse.json({ error: 'Nao encontrado.' }, { status: 404 });

  const alvo = req.nextUrl.searchParams.get('userId') ?? '';
  if (!UUID.test(alvo)) {
    return NextResponse.json({ error: 'Aluno invalido.' }, { status: 400 });
  }

  const { data, error } = await admin()
    .from('profiles')
    .select('id, name, favorite_exercises, banned_exercises')
    .eq('id', alvo)
    .maybeSingle();

  if (error) {
    console.error('[admin/exercicios] GET:', error.message);
    return NextResponse.json({ error: 'Nao consegui carregar.' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Aluno nao encontrado.' }, { status: 404 });
  }

  return NextResponse.json({
    aluno: { id: data.id, name: data.name },
    favoritos: data.favorite_exercises ?? [],
    banidos: data.banned_exercises ?? [],
  });
}

export async function POST(req: NextRequest) {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;
  if (!(await souMaster(user.id))) return NextResponse.json({ error: 'Nao encontrado.' }, { status: 404 });

  try {
    const body = await req.json().catch(() => ({}));
    const alvo = String(body?.userId ?? '');
    const exercicio = String(body?.exerciseId ?? '');
    const lista = body?.lista as Marca;

    if (!UUID.test(alvo)) {
      return NextResponse.json({ error: 'Aluno invalido.' }, { status: 400 });
    }
    if (!UUID.test(exercicio)) {
      return NextResponse.json({ error: 'Exercicio invalido.' }, { status: 400 });
    }
    if (!['favorito', 'banido', 'nenhum'].includes(lista)) {
      return NextResponse.json({ error: 'Lista invalida.' }, { status: 400 });
    }

    const cliente = admin();

    // Lê, altera e grava. É leitura-escrita sem trava, mas quem usa esta tela é uma pessoa
    // só, num navegador só; a corrida que isso perderia precisaria de dois masters marcando o
    // mesmo aluno no mesmo segundo.
    const { data: atual, error: erroLeitura } = await cliente
      .from('profiles')
      .select('favorite_exercises, banned_exercises')
      .eq('id', alvo)
      .maybeSingle();

    if (erroLeitura) {
      console.error('[admin/exercicios] leitura:', erroLeitura.message);
      return NextResponse.json({ error: 'Nao consegui alterar.' }, { status: 500 });
    }
    if (!atual) {
      return NextResponse.json({ error: 'Aluno nao encontrado.' }, { status: 404 });
    }

    // A exclusividade entre as listas e o teto vivem em lib/listasDoAluno.ts, com teste.
    const { favoritos, banidos } = moverExercicio(
      normalizarListas(atual.favorite_exercises, atual.banned_exercises),
      exercicio,
      lista
    );

    if (passouDoLimite({ favoritos, banidos })) {
      return NextResponse.json(
        { error: `Limite de ${LIMITE_POR_LISTA} exercicios por lista.` },
        { status: 400 }
      );
    }

    const { error } = await cliente
      .from('profiles')
      .update({ favorite_exercises: favoritos, banned_exercises: banidos })
      .eq('id', alvo);

    if (error) {
      console.error('[admin/exercicios] POST:', error.message);
      return NextResponse.json({ error: 'Nao consegui alterar.' }, { status: 500 });
    }

    // Rastro: proibir exercício para um aluno é decisão clínica, e você vai querer saber
    // depois quem marcou e quando.
    console.log(`[admin/exercicios] ${user.id} marcou ${exercicio} como ${lista} para ${alvo}`);

    return NextResponse.json({ ok: true, favoritos, banidos });
  } catch (e) {
    console.error('[admin/exercicios] erro:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Nao consegui alterar.' }, { status: 500 });
  }
}
