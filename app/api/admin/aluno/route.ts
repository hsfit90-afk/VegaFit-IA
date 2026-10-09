import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/utils/supabase/auth-guard';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { fetchLatestAnamneseAnswers } from '@/lib/aiHealthContext';
import { mapAnamneseLocationToEquipment } from '@/lib/trainingLocation';
import { primeiroObjetivo, minutosDaSessao, diasPorSemana } from '@/lib/anamneseParaGerador';

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
    const [{ data: perfil }, respostas] = await Promise.all([
      cliente
        .from('profiles')
        .select('id, name, goal, level, training_location, equipamentos_casa')
        .eq('id', alvo)
        .maybeSingle(),
      fetchLatestAnamneseAnswers(cliente, alvo),
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
