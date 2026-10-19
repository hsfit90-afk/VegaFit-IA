import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/utils/supabase/auth-guard';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { limparAlvosPorSerie } from '@/lib/metodoTreino';
import { selecionarMobilidade, chaveDeMobilidade, sementeDaChave } from '@/lib/preparoFinalizacao';
import { filtrarParaCasa } from '@/lib/equipamentoCasa';
import { treinaEmCasa, mapAnamneseLocationToEquipment } from '@/lib/trainingLocation';
import {
  mesclarSessoesEditadas,
  type ExercicioComChave,
  type SessaoComExercicios,
} from '@/lib/edicaoDePlano';

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


/**
 * Normaliza o que veio da tela, para POST e PUT.
 *
 * Sanidade de número aqui e não só no formulário: um "sets": 0 ou um descanso negativo viram
 * sessão quebrada na tela do aluno, e ele não tem como consertar sozinho.
 *
 * Uma função só porque criar e atualizar precisam EXATAMENTE da mesma limpeza — duas cópias
 * divergiriam no primeiro limite que alguém ajustasse num lado só.
 */
function normalizarSessoes(sessoes: any[]) {
  // "sets": 0 ou um descanso negativo viram sessão quebrada na tela do aluno, e ele não tem
  // como consertar sozinho.
  return sessoes.slice(0, 7).map((s: any, i: number) => ({
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

        /**
         * A PERIODIZAÇÃO, que esta função apagava.
         *
         * Achado em 19/10/2026: `method` guarda o texto da progressão de 4 semanas que a
         * geração escreve em cada exercício ("Semana 1: 3 séries. ... Semana 4: Deload"). Como
         * ele não estava nesta lista, abrir um plano gerado no montador e salvar apagava a
         * progressão de TODOS os exercícios — em POST e em PUT. O treino continuava abrindo,
         * só sem a instrução que diz ao aluno o que muda na semana seguinte.
         *
         * undefined e não string vazia quando não há: '' é um valor, e a tela do aluno
         * renderizaria a tarja de método vazia como se alguém tivesse prescrito isso.
         */
        method: typeof e?.method === 'string' && e.method.trim()
          ? e.method.trim().slice(0, 300)
          : undefined,

        targetLabels: e?.targetLabels,
        targetReps: e?.targetReps,
        targetWeights: e?.targetWeights,
      })
    ),

    // O que o profissional escolheu à mão para este dia. Lista VAZIA é resposta válida e
    // significa "decidi não prescrever" — diferente de ausente, que significa "preencha
    // automaticamente". Sem essa distinção, quem apagasse o aquecimento de um dia o veria
    // voltar sozinho no salvamento seguinte, sem entender por quê.
    warmup: Array.isArray(s?.warmup) ? s.warmup.slice(0, 8).map(limparPreparo) : undefined,
    alongamento: Array.isArray(s?.alongamento) ? s.alongamento.slice(0, 8).map(limparPreparo) : undefined,

    // Abdominal não tem `segundos`: é prescrito por série e repetição, e as duas vêm do
    // protocolo do objetivo na tela do aluno. Guardar um campo de tempo aqui seria dado falso.
    abdominal: Array.isArray(s?.abdominal) ? s.abdominal.slice(0, 8).map(limparPrescrito) : undefined,
  })).filter((s: any) => s.exercises.length > 0);
}

/** Um exercício escolhido à mão, sem tempo: o abdominal. */
function limparPrescrito(e: any) {
  return {
    exerciseId: String(e?.exerciseId || ''),
    name: String(e?.name || '').slice(0, 160),
    muscleGroup: String(e?.muscleGroup || '').slice(0, 60),
  };
}

/** Um item de aquecimento ou alongamento, normalizado. */
function limparPreparo(e: any) {
  return {
    exerciseId: String(e?.exerciseId || ''),
    name: String(e?.name || '').slice(0, 160),
    muscleGroup: String(e?.muscleGroup || '').slice(0, 60),
    segundos: Math.min(300, Math.max(10, Number(e?.segundos) || 40)),
  };
}

/**
 * O AQUECIMENTO, que faltava aqui.
 *
 * Achado em 15/10/2026, ao construir a prévia do aluno: o plano gerado pela IA recebia
 * `session.warmup` no servidor, e o montado à mão não recebia nada. Ou seja, o Treino do
 * Personal — o produto de R$ 147 — chegava ao aluno com MENOS que o treino gerado de
 * graça. Ninguém tinha percebido porque nunca se via o resultado do outro lado.
 *
 * Mesma regra da geração: mobilidade dos grupos que o dia carrega, escolhida em código, do
 * catálogo completo, sem custo de IA. Quem treina em casa recebe só o que cabe no que tem
 * — rolo de espuma é equipamento, e isso já nos mordeu uma vez.
 */
async function aplicarAquecimento(limpas: any[], alunoId: string) {
  const [{ data: catalogo }, { data: perfilDoAluno }] = await Promise.all([
    admin().from('exercises').select('id, name, muscle_group, equipamento_necessario, contexto'),
    admin().from('profiles').select('training_location, equipamentos_casa').eq('id', alunoId).maybeSingle(),
  ]);

  const poolDeMobilidade = treinaEmCasa(mapAnamneseLocationToEquipment(perfilDoAluno?.training_location))
    ? filtrarParaCasa(catalogo ?? [], perfilDoAluno?.equipamentos_casa as string[] | null)
    : (catalogo ?? []);

  for (const sessao of limpas) {
    // O automático só preenche o que a tela NÃO mandou. Ver o comentário de normalizarSessoes
    // sobre a diferença entre lista vazia e ausente.
    if ((sessao as any).warmup !== undefined) continue;

    const grupos = [...new Set(
      (sessao.exercises ?? []).map((e: any) => e.muscleGroup).filter(Boolean)
    )] as string[];

    /**
     * SEMENTE, e não sorteio aleatório.
     *
     * O montador mostra a prévia do automático usando esta MESMA chave. Sorteando aleatório
     * aqui, o profissional veria três exercícios na tela e o aluno receberia outros três — e
     * a prévia, que existe justamente para ele não entregar às cegas, passaria a enganar.
     */
    const semente = sementeDaChave(chaveDeMobilidade(String(sessao.id ?? ''), grupos));

    (sessao as any).warmup = selecionarMobilidade(poolDeMobilidade, grupos, 3, { semente }).map((m: any) => ({
      exerciseId: m.id,
      name: m.name,
      muscleGroup: m.muscle_group || '',
      segundos: 40,
    }));
  }
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

    const limpas = normalizarSessoes(sessoes);

    if (limpas.length === 0) {
      return NextResponse.json({ error: 'Nenhum dia tem exercício.' }, { status: 400 });
    }

    await aplicarAquecimento(limpas, alvo);

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

    /**
     * O TREINO ENTREGUE JÁ NASCE ATIVO.
     *
     * Sem isto, o profissional entregava e o aluno continuava no treino antigo: o plano ativo
     * vivia só no localStorage do aparelho dele, e quem já tinha trocado de plano alguma vez
     * ficava apontando para o velho. O aluno abria o app, não via o treino novo, e não havia
     * como consertar do lado de cá.
     *
     * Falha aqui não derruba a entrega: o plano JÁ está salvo na conta, e um ativo que não
     * gravou ainda cai no mais recente — que é este. O log fica para quem for investigar.
     */
    const { error: erroAtivo } = await admin()
      .from('profiles')
      .update({ active_plan_id: id })
      .eq('id', alvo);
    if (erroAtivo) {
      console.error('[admin/plano] plano salvo mas nao ativado:', erroAtivo.message);
    }

    // Rastro: entrega de treino personalizado é o que você vai querer conferir depois, quando
    // um aluno disser que não recebeu.
    console.log(`[admin/plano] ${user.id} salvou o plano ${id} para ${alvo} (${limpas.length} dias)`);
    return NextResponse.json({ ok: true, planoId: id, dias: limpas.length, ativado: !erroAtivo });
  } catch (e) {
    console.error('[admin/plano] erro:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Nao consegui salvar o treino.' }, { status: 500 });
  }
}

/**
 * Domínio sobre a conta do aluno: tornar um plano ativo, ou apagá-lo.
 *
 * Por que isso é do profissional e não só do aluno: ele entrega o Treino do Personal e
 * precisa garantir que é AQUELE que o aluno vai abrir — e precisa poder limpar os antigos,
 * que ficam na conta e o aluno pode abrir sem entender por quê.
 *
 * PATCH ativa, DELETE apaga. Os dois exigem master e conferem que o plano é do aluno
 * indicado: service_role ignora RLS, então o filtro por user_id aqui não é redundante — sem
 * ele, um id trocado mexeria na conta de outra pessoa.
 */
export async function PATCH(req: NextRequest) {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;
  if (!(await souMaster(user.id))) return NextResponse.json({ error: 'Nao encontrado.' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const alvo = String(body?.userId ?? '');
  const planoId = String(body?.planoId ?? '');

  if (!/^[0-9a-f-]{36}$/i.test(alvo) || !planoId) {
    return NextResponse.json({ error: 'Aluno ou plano invalido.' }, { status: 400 });
  }

  // Confere que o plano é mesmo deste aluno antes de apontar o perfil para ele.
  const { data: plano } = await admin()
    .from('workout_plans')
    .select('id')
    .eq('id', planoId)
    .eq('user_id', alvo)
    .maybeSingle();

  if (!plano) {
    return NextResponse.json({ error: 'Plano nao encontrado para este aluno.' }, { status: 404 });
  }

  const { error } = await admin()
    .from('profiles')
    .update({ active_plan_id: planoId })
    .eq('id', alvo);

  if (error) {
    console.error('[admin/plano] PATCH:', error.message);
    return NextResponse.json({ error: 'Nao consegui ativar.' }, { status: 500 });
  }

  console.log(`[admin/plano] ${user.id} ativou o plano ${planoId} para ${alvo}`);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;
  if (!(await souMaster(user.id))) return NextResponse.json({ error: 'Nao encontrado.' }, { status: 404 });

  const alvo = req.nextUrl.searchParams.get('userId') ?? '';
  const planoId = req.nextUrl.searchParams.get('planoId') ?? '';

  if (!/^[0-9a-f-]{36}$/i.test(alvo) || !planoId) {
    return NextResponse.json({ error: 'Aluno ou plano invalido.' }, { status: 400 });
  }

  const { error } = await admin()
    .from('workout_plans')
    .delete()
    .eq('id', planoId)
    .eq('user_id', alvo);

  if (error) {
    console.error('[admin/plano] DELETE:', error.message);
    return NextResponse.json({ error: 'Nao consegui apagar.' }, { status: 500 });
  }

  /**
   * Se o apagado era o ativo, aponta para o mais recente que sobrou.
 *
   * Sem isto o perfil ficaria apontando para um plano que não existe mais. O app cai no mais
   * recente de qualquer forma (AppContext só aceita id que exista), mas deixar lixo no banco
   * é o tipo de coisa que confunde quem for depurar daqui a seis meses.
   */
  const { data: restantes } = await admin()
    .from('workout_plans')
    .select('id')
    .eq('user_id', alvo)
    .order('created_at', { ascending: false })
    .limit(1);

  await admin()
    .from('profiles')
    .update({ active_plan_id: restantes?.[0]?.id ?? null })
    .eq('id', alvo)
    .eq('active_plan_id', planoId);

  console.log(`[admin/plano] ${user.id} apagou o plano ${planoId} de ${alvo}`);
  return NextResponse.json({ ok: true });
}

/**
 * Atualiza um plano que o aluno JÁ TEM, no lugar.
 *
 * POR QUE NÃO SALVAR COMO PLANO NOVO
 *
 * A periodização é por plano: `computePeriodization` filtra o histórico por workoutPlanId.
 * Salvar as alterações como plano novo zeraria o ciclo do aluno — ele voltaria para a semana 1
 * mesmo estando na terceira, e perderia o deload que vinha construindo. Ajustar dois
 * exercícios não pode custar isso.
 *
 * Em troca, o id se mantém, o histórico continua apontando para ele e a progressão de carga
 * segue intacta.
 *
 * O aquecimento é remontado: se o profissional trocou os grupos do dia, a mobilidade tem que
 * acompanhar — mobilidade de ombro num dia que virou perna não prepara nada.
 */
export async function PUT(req: NextRequest) {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;
  if (!(await souMaster(user.id))) return NextResponse.json({ error: 'Nao encontrado.' }, { status: 404 });

  try {
    const body = await req.json().catch(() => ({}));
    const alvo = String(body?.userId ?? '');
    const planoId = String(body?.planoId ?? '');
    const nome = String(body?.name ?? '').trim().slice(0, 120);
    const sessoes = body?.sessions;

    if (!/^[0-9a-f-]{36}$/i.test(alvo) || !planoId) {
      return NextResponse.json({ error: 'Aluno ou plano invalido.' }, { status: 400 });
    }
    if (!nome) {
      return NextResponse.json({ error: 'De um nome ao treino.' }, { status: 400 });
    }
    if (!Array.isArray(sessoes) || sessoes.length === 0) {
      return NextResponse.json({ error: 'O treino precisa de pelo menos um dia.' }, { status: 400 });
    }

    // O plano tem que ser deste aluno. service_role ignora RLS, então sem este filtro um id
    // trocado reescreveria o treino de outra pessoa.
    //
    // `sessions` vem junto porque a mesclagem precisa do que ESTÁ salvo: ver abaixo.
    const { data: existente } = await admin()
      .from('workout_plans')
      .select('id, sessions')
      .eq('id', planoId)
      .eq('user_id', alvo)
      .maybeSingle();

    if (!existente) {
      return NextResponse.json({ error: 'Plano nao encontrado para este aluno.' }, { status: 404 });
    }

    /**
     * O QUE A TELA NÃO MANDOU CONTINUA EXISTINDO.
     *
     * O editor devolve a sessão INTEIRA, então um campo que o formulário não tem não significa
     * "não mudou" — significa "apaga". Era assim que a carga alvo por série e a periodização
     * desapareciam ao ajustar um exercício (ver lib/edicaoDePlano.ts).
     *
     * A mesclagem vem ANTES de normalizar, de propósito: `limparAlvosPorSerie`, dentro de
     * normalizarSessoes, tem que manter a palavra final sobre alvo desalinhado. Mesclar depois
     * reintroduziria exatamente o desalinhamento que a limpeza acabou de tirar.
     */
    const mescladas = mesclarSessoesEditadas(
      sessoes,
      (existente.sessions as SessaoComExercicios<ExercicioComChave>[] | null) ?? []
    );

    const limpas = normalizarSessoes(mescladas);
    if (limpas.length === 0) {
      return NextResponse.json({ error: 'Nenhum dia tem exercício.' }, { status: 400 });
    }

    await aplicarAquecimento(limpas, alvo);

    const { error } = await admin()
      .from('workout_plans')
      .update({ name: nome, split: String(body?.split ?? '').trim() || `${limpas.length} dias`, sessions: limpas })
      .eq('id', planoId)
      .eq('user_id', alvo);

    if (error) {
      console.error('[admin/plano] PUT:', error.message);
      return NextResponse.json({ error: 'Nao consegui salvar as alteracoes.' }, { status: 500 });
    }

    /**
     * EDITAR UM PLANO QUE NÃO É O ATIVO NÃO MUDA NADA PARA O ALUNO.
     *
     * O aluno abre UM plano: o que `profiles.active_plan_id` aponta. Salvar alterações num
     * plano que não é esse é trabalho que não chega do outro lado — e, pior, o profissional
     * sai da tela achando que chegou.
     *
     * Ativar sozinho seria pior ainda: trocar o treino do aluno sem pedir, só porque alguém
     * abriu um plano antigo para conferir. Então a rota ATIVA quando pedem (`ativar: true`) e,
     * de qualquer forma, DIZ se este é o plano que o aluno vê. Quem decide é quem está olhando
     * a tela; o que a rota garante é que ninguém decide sem saber.
     */
    const { data: perfil } = await admin()
      .from('profiles')
      .select('active_plan_id')
      .eq('id', alvo)
      .maybeSingle();

    let ativo = perfil?.active_plan_id === planoId;

    if (!ativo && body?.ativar === true) {
      const { error: erroAtivo } = await admin()
        .from('profiles')
        .update({ active_plan_id: planoId })
        .eq('id', alvo);
      if (erroAtivo) {
        console.error('[admin/plano] PUT salvou mas nao ativou:', erroAtivo.message);
      } else {
        ativo = true;
        console.log(`[admin/plano] ${user.id} ativou o plano ${planoId} para ${alvo} ao salvar`);
      }
    }

    console.log(`[admin/plano] ${user.id} atualizou o plano ${planoId} de ${alvo} (${limpas.length} dias)`);
    return NextResponse.json({ ok: true, planoId, dias: limpas.length, ativo });
  } catch (e) {
    console.error('[admin/plano] PUT erro:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Nao consegui salvar as alteracoes.' }, { status: 500 });
  }
}
