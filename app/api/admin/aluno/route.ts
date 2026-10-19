import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/utils/supabase/auth-guard';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { fetchLatestAnamneseAnswers } from '@/lib/aiHealthContext';
import { mapAnamneseLocationToEquipment } from '@/lib/trainingLocation';
import { primeiroObjetivo, minutosDaSessao, diasPorSemana } from '@/lib/anamneseParaGerador';
import { musculosEmFadiga } from '@/lib/proximoTreino';

/**
 * Resumo da anamnese de um aluno, para o montador do Treino do Personal.
 *
 * O PROBLEMA QUE RESOLVE
 *
 * O montador gerava com tudo chumbado no código: 'Academia completa', 'Hipertrofia',
 * 'Intermediário', 3 dias, 60 minutos. Como a rota de geração decide casa x academia pelo que
 * o corpo da requisição manda, um treino montado para quem treina na sala saía com leg press
 * e cadeira extensora — e o profissional não tinha como perceber, porque a anamnese do aluno
 * não aparecia em lugar nenhum da tela.
 *
 * Agora o montador pergunta ao banco quem é esse aluno, mostra na tela, e usa isso como
 * ponto de partida da geração.
 *
 * O QUE VOLTA, E O QUE NÃO VOLTA
 *
 * Volta o que serve para montar treino: onde treina, o que tem em casa, objetivo, nível,
 * tempo, dias, e o bloco de saúde. NÃO volta nutrição, ciclo hormonal, medidas corporais nem
 * dado de contato — não entram em nenhuma decisão do montador, e dado sensível que não é
 * usado não deve trafegar.
 */

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

const UUID = /^[0-9a-f-]{36}$/i;

export async function GET(req: NextRequest) {
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

    const alvo = req.nextUrl.searchParams.get('userId') ?? '';
    if (!UUID.test(alvo)) {
      return NextResponse.json({ error: 'Aluno invalido.' }, { status: 400 });
    }

    const cliente = admin();
    const [{ data: perfil }, respostas, { data: ultimos }, { data: indice }] = await Promise.all([
      cliente
        .from('profiles')
        .select('id, name, goal, level, training_location, equipamentos_casa, active_plan_id')
        .eq('id', alvo)
        .maybeSingle(),
      fetchLatestAnamneseAnswers(cliente, alvo),
      /**
       * Quando este aluno treinou pela última vez.
       *
       * Serve para o montador avisar antes de salvar: um treino EM ANDAMENTO vive no
       * localStorage do aparelho do aluno (utils/workoutCache.ts), o servidor não tem cópia e
       * não há como consultá-lo daqui. O que dá para saber é se ele treinou há pouco — e isso
       * basta para a tela dizer "pode ter alguém no meio de um treino agora".
       *
       * Não é certeza, é probabilidade, e a tela precisa dizer isso com essas palavras.
       */
      /**
       * Os treinos recentes, para a prévia dizer qual sessão o aluno vai abrir.
       *
       * O dashboard dele desvia de dia quando o músculo treinado nas últimas 24h ainda não
       * recuperou (lib/proximoTreino.ts). A prévia que ignorasse isso mostraria "Treino A" e
       * o aluno abriria o B — e o profissional entregaria confiando no que viu.
       *
       * Dez linhas bastam: a fadiga olha 24 horas, e ninguém treina dez vezes num dia.
       */
      cliente
        .from('workout_history')
        .select('date, exercises')
        .eq('user_id', alvo)
        .order('date', { ascending: false })
        .limit(10),
      cliente
        .from('user_session_index')
        .select('current_session_index')
        .eq('user_id', alvo)
        .maybeSingle(),
    ]);

    if (!perfil) {
      return NextResponse.json({ error: 'Aluno nao encontrado.' }, { status: 404 });
    }

    // A anamnese ganha da coluna do perfil quando as duas existem: ela é o que o aluno
    // respondeu por último e de forma deliberada.
    const local = (respostas?.local as string) || perfil.training_location || null;

    return NextResponse.json({
      aluno: {
        id: perfil.id,
        nome: perfil.name,
        temAnamnese: Boolean(respostas),
        // Qual plano o aluno realmente abre. A previa usa isto para mostrar o treino certo,
        // em vez de assumir que e o mais recente -- os dois divergem quando ele troca.
        activePlanId: perfil.active_plan_id ?? null,
        ultimoTreino: ultimos?.[0]?.date ?? null,
      },

      /**
       * O estado do treino dele, para a prévia reproduzir a tela que ele abre.
       *
       * `musculosEmFadiga` sai da MESMA função do dashboard (lib/proximoTreino.ts) — não de
       * uma segunda conta escrita aqui. É a regra que este projeto aprendeu a seguir depois
       * de três bugs com o mesmo formato.
       */
      treino: {
        indiceDaSessao: indice?.current_session_index ?? 0,
        musculosEmFadiga: [...musculosEmFadiga(
          (ultimos ?? []).map(h => ({
            date: Date.parse(h.date as string),
            exercises: Array.isArray(h.exercises) ? (h.exercises as { muscleGroup?: string | null }[]) : [],
          }))
        )],
      },
      // O que o montador mostra na tela.
      resumo: {
        local,
        equipamentosCasa: (perfil.equipamentos_casa as string[] | null) ?? [],
        objetivo: primeiroObjetivo(respostas?.objetivo) || perfil.goal || null,
        nivel: (respostas?.nivel as string) || perfil.level || null,
        frequencia: (respostas?.frequencia as string) || null,
        tempoSessao: (respostas?.tempo_sessao as string) || null,
        dias: (respostas?.dias as string) || null,
        lesoes: (respostas?.lesoes as string) || null,
        condicoes: (respostas?.condicoes as string) || null,
        liberacao: (respostas?.liberacao as string) || null,
      },
      // O que o montador usa como ponto de partida da geração, já no vocabulário do gerador.
      sugestao: {
        equipment: mapAnamneseLocationToEquipment(local),
        goal: primeiroObjetivo(respostas?.objetivo) || perfil.goal || 'Hipertrofia',
        level: (respostas?.nivel as string) || perfil.level || 'Iniciante',
        daysPerWeek: diasPorSemana(respostas?.frequencia) ?? 3,
        duration: minutosDaSessao(respostas?.tempo_sessao) ?? 60,
      },
    });
  } catch (e) {
    console.error('[admin/aluno] erro:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Nao consegui carregar.' }, { status: 500 });
  }
}
