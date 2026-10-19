import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/utils/supabase/auth-guard';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { fetchLatestAnamneseAnswers } from '@/lib/aiHealthContext';
import { treinaEmCasa, mapAnamneseLocationToEquipment } from '@/lib/trainingLocation';
import {
  filtrarParaCasa,
  filtrarParaAcademia,
  dicasDeImproviso,
  EQUIPAMENTOS_CASA,
} from '@/lib/equipamentoCasa';

/**
 * O catálogo de exercícios JÁ FILTRADO para um aluno, para o montador do profissional.
 *
 * O BUG QUE ISTO FECHA
 *
 * O montador carregava o catálogo direto do navegador, sem filtro nenhum:
 *
 *     supabase.from('exercises').select('id, name, muscle_group, media_url')
 *
 * Resultado: montando o treino de quem treina na sala de casa, o campo de busca oferecia os
 * 882, leg press e cadeira extensora incluídos. O profissional não tinha como saber qual
 * daqueles nomes o aluno consegue executar — a informação não estava na tela.
 *
 * É a TERCEIRA vez que este mesmo bug aparece em lugar diferente: na geração (corrigido em
 * 09/10/2026, com `filtrarParaCasa`) e na troca de exercício (15/10/2026, onde o filtro estava
 * desligado havia seis dias sem ninguém saber). A causa é sempre a mesma: quem precisa do
 * filtro busca o catálogo por conta própria em vez de pedir a lista certa.
 *
 * POR QUE ESTA ROTA EXISTE EM VEZ DE O MONTADOR FILTRAR SOZINHO
 *
 * O filtro depende do PERFIL do aluno — onde ele treina e o que ele tem em casa. Esse dado
 * decide prescrição, então não pode vir do navegador de quem pede, e nem o navegador do
 * profissional é exceção: ele é um cliente como outro qualquer. A leitura é aqui, com
 * service_role, pelo id do aluno. Mesmo princípio de papel e exercício banido.
 *
 * O QUE VOLTA
 *
 * O catálogo INTEIRO, com `cabe: true/false` em cada item — não só o que cabe. É deliberado:
 * quem tem CREF pode querer prescrever um exercício fora do inventário com nota de improviso,
 * e a tela precisa poder mostrar o resto sem uma segunda viagem ao servidor. O padrão da tela é
 * mostrar só o que cabe; ver tudo é um ato explícito, com aviso.
 *
 * Substitui a consulta própria do montador em vez de somar-se a ela: `media_url` vem junto,
 * então é uma requisição no lugar de duas, do mesmo tamanho de antes mais um booleano por linha.
 */

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

const UUID = /^[0-9a-f-]{36}$/i;

/** Rótulo legível de cada caixa de equipamento, para a tela dizer o que falta. */
const ROTULO_DO_EQUIPAMENTO = new Map(EQUIPAMENTOS_CASA.map(e => [e.id, e.rotulo]));

/** `maquina` não é caixa do formulário de casa, mas aparece em equipamento_necessario. */
function rotulosDoQueExige(exige: string[] | null | undefined): string[] {
  return (exige ?? []).map(id => ROTULO_DO_EQUIPAMENTO.get(id) ?? (id === 'maquina' ? 'Máquina' : id));
}

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
    const [{ data: perfil }, respostas, { data: catalogo, error: erroCatalogo }] = await Promise.all([
      cliente
        .from('profiles')
        .select('id, name, training_location, equipamentos_casa')
        .eq('id', alvo)
        .maybeSingle(),
      fetchLatestAnamneseAnswers(cliente, alvo),
      cliente
        .from('exercises')
        .select('id, name, muscle_group, media_url, equipamento_necessario, contexto')
        .order('name')
        .limit(2000),
    ]);

    if (!perfil) {
      return NextResponse.json({ error: 'Aluno nao encontrado.' }, { status: 404 });
    }
    if (erroCatalogo) {
      console.error('[admin/catalogo] catalogo:', erroCatalogo.message);
      return NextResponse.json({ error: 'Nao consegui carregar o catalogo.' }, { status: 500 });
    }

    const todos = catalogo ?? [];

    // A anamnese ganha da coluna do perfil quando as duas existem: é o que o aluno respondeu
    // por último e de forma deliberada. Mesma regra de /api/admin/aluno.
    const local = (respostas?.local as string) || perfil.training_location || null;
    const equipamentosCasa = (perfil.equipamentos_casa as string[] | null) ?? [];
    const emCasa = treinaEmCasa(mapAnamneseLocationToEquipment(local));

    /**
     * `cabe` sai do MESMO filtro que a geração usa, por pertencimento ao resultado — não de uma
     * segunda regra escrita aqui. É o que garante que o que o profissional vê no montador é
     * exatamente o que o aluno pode receber. Duas implementações divergiriam, e a divergência
     * apareceria como um exercício que o montador oferece e o gerador nunca escolhe.
     */
    const cabem = emCasa
      ? filtrarParaCasa(todos, equipamentosCasa)
      : filtrarParaAcademia(todos);
    const idsQueCabem = new Set(cabem.map(e => e.id));

    // A dica de improviso só existe para o que CABE por improvisação ("precisa de banco — dá
    // para usar uma cadeira"). Para o que não cabe, o motivo é o equipamento que falta.
    const dicas = emCasa
      ? dicasDeImproviso(cabem.map(e => e.name), equipamentosCasa)
      : new Map<string, string>();

    return NextResponse.json({
      aluno: {
        id: perfil.id,
        nome: perfil.name,
        local,
        emCasa,
        equipamentosCasa,
        rotulosDoEquipamento: equipamentosCasa
          .map(id => ROTULO_DO_EQUIPAMENTO.get(id))
          .filter((r): r is string => Boolean(r)),
      },
      total: todos.length,
      quantosCabem: idsQueCabem.size,
      exercicios: todos.map(e => {
        const cabe = idsQueCabem.has(e.id);
        return {
          id: e.id,
          name: e.name,
          muscleGroup: e.muscle_group,
          mediaUrl: e.media_url,
          cabe,
          dica: cabe ? dicas.get(e.name) ?? null : null,
          exige: cabe ? [] : rotulosDoQueExige(e.equipamento_necessario as string[] | null),
        };
      }),
    });
  } catch (e) {
    console.error('[admin/catalogo] erro:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Nao consegui carregar o catalogo.' }, { status: 500 });
  }
}
