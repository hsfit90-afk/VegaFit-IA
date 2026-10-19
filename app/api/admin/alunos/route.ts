import { NextResponse } from 'next/server';
import { requireAuth } from '@/utils/supabase/auth-guard';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

/**
 * A lista de alunos com o estado do TREINO de cada um.
 *
 * POR QUE NÃO SERVIU O QUE JÁ EXISTIA
 *
 * `/api/admin/plano` sem userId já devolve os alunos, mas só id, nome e papel — é o seletor do
 * montador, e continua sendo. `/admin` lista os alunos com o estado da ASSINATURA, que é outra
 * pergunta. Nenhuma das duas responde o que o profissional precisa saber antes de abrir a
 * agenda: quem está sem treino, e quem parou de treinar.
 *
 * O QUE "SEM TREINO ATIVO" SIGNIFICA AQUI
 *
 * Não é "não tem plano nenhum". É `profiles.active_plan_id` vazio OU apontando para um plano
 * que não existe mais — e esse segundo caso é o que ninguém veria sem conferir, porque o app
 * do aluno disfarça caindo no plano mais recente. Do lado de cá, disfarce é defeito: se o
 * ponteiro está quebrado, o profissional precisa saber.
 *
 * O LIMITE DA DATA DO ÚLTIMO TREINO
 *
 * O Postgres faria "máximo por aluno" numa linha de SQL, mas o PostgREST não agrupa, e resolver
 * isso direito pediria uma migração (view ou função). Então: lê os treinos mais recentes dos
 * alunos listados, em ordem decrescente, e fica com o primeiro de cada um. Correto enquanto o
 * treino mais recente de TODO aluno couber nas LIMITE_HISTORICO linhas mais novas.
 *
 * Medido em 19/10/2026: 4 pessoas já treinaram no app, alguma dezena de registros no total. O
 * teto só começa a mentir com milhares de treinos entre os 200 alunos listados — e, quando
 * isso chegar, a correção é uma migração com função de agregação, não um teto maior.
 */

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/** Quantos alunos a tela lista. A busca é na tela, sobre esta lista. */
const LIMITE_ALUNOS = 200;
/** Ver a nota sobre o limite da data do último treino. */
const LIMITE_HISTORICO = 5000;
const LIMITE_PLANOS = 3000;

const DIA_MS = 24 * 60 * 60 * 1000;

export async function GET() {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    // 404 e não 403: confirmar que a rota existe já entrega informação a quem sonda.
    const supabase = await createClient();
    const { data: quemPediu } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (quemPediu?.role !== 'master') {
      return NextResponse.json({ error: 'Nao encontrado.' }, { status: 404 });
    }

    const cliente = admin();

    const { data: perfis, error: erroPerfis } = await cliente
      .from('profiles')
      .select('id, name, role, active_plan_id, subscription_status, created_at')
      .order('created_at', { ascending: false })
      .limit(LIMITE_ALUNOS);

    if (erroPerfis) {
      console.error('[admin/alunos] perfis:', erroPerfis.message);
      return NextResponse.json({ error: 'Nao consegui carregar os alunos.' }, { status: 500 });
    }

    const ids = (perfis ?? []).map(p => p.id);
    if (ids.length === 0) return NextResponse.json({ alunos: [] });

    const [{ data: planos }, { data: historico }] = await Promise.all([
      cliente
        .from('workout_plans')
        .select('id, user_id, name')
        .in('user_id', ids)
        .limit(LIMITE_PLANOS),
      cliente
        .from('workout_history')
        .select('user_id, date')
        .in('user_id', ids)
        .order('date', { ascending: false })
        .limit(LIMITE_HISTORICO),
    ]);

    // Quantos planos cada um tem, e o nome de cada plano, para dizer qual é o ativo.
    const quantosPlanos = new Map<string, number>();
    const nomeDoPlano = new Map<string, string>();
    for (const p of planos ?? []) {
      quantosPlanos.set(p.user_id, (quantosPlanos.get(p.user_id) ?? 0) + 1);
      nomeDoPlano.set(p.id, p.name);
    }

    // Lista vem em ordem decrescente de data: a PRIMEIRA ocorrência de cada aluno é a mais
    // recente dele.
    const ultimoTreino = new Map<string, string>();
    for (const h of historico ?? []) {
      if (!ultimoTreino.has(h.user_id)) ultimoTreino.set(h.user_id, h.date);
    }

    const agora = Date.now();

    const alunos = (perfis ?? []).map(p => {
      const ativoId = p.active_plan_id as string | null;
      // O ponteiro pode apontar para um plano apagado. Para o aluno isso se disfarça; aqui não.
      const planoAtivoExiste = Boolean(ativoId && nomeDoPlano.has(ativoId));
      const ultimo = ultimoTreino.get(p.id) ?? null;
      const quando = ultimo ? Date.parse(ultimo) : NaN;

      return {
        id: p.id,
        nome: p.name,
        role: p.role,
        assinatura: p.subscription_status,
        planos: quantosPlanos.get(p.id) ?? 0,
        temTreinoAtivo: planoAtivoExiste,
        planoAtivoId: planoAtivoExiste ? ativoId : null,
        planoAtivoNome: planoAtivoExiste ? nomeDoPlano.get(ativoId!) ?? null : null,
        /** Aponta para um plano que não existe mais: defeito, e não "sem treino". */
        ponteiroQuebrado: Boolean(ativoId) && !planoAtivoExiste,
        ultimoTreino: ultimo,
        diasSemTreinar: Number.isFinite(quando)
          ? Math.floor((agora - quando) / DIA_MS)
          : null,
      };
    });

    return NextResponse.json({ alunos });
  } catch (e) {
    console.error('[admin/alunos] erro:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Nao consegui carregar os alunos.' }, { status: 500 });
  }
}
