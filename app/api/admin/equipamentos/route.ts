import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/utils/supabase/auth-guard';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { cabeEmCasa, IDS_CASA } from '@/lib/equipamentoCasa';

/**
 * Revisão do equipamento de cada exercício do catálogo.
 *
 * O catálogo foi classificado uma vez pela IA, offline (scripts/classificarEquipamento.mjs).
 * Isso não decide nada sozinho: enquanto `equipamento_origem` for 'ia', o dado existe mas
 * ainda não foi conferido por quem tem CREF. Esta rota é o que transforma sugestão em dado.
 *
 * A ORDEM EM QUE OS EXERCÍCIOS VOLTAM É O PRODUTO AQUI
 *
 * São 882, e ninguém revisa 882. Mas a regra antiga, por nome, acerta a maioria — então onde
 * ela e a IA DISCORDAM está concentrado tanto o vazamento antigo quanto o erro novo. São 24
 * casos. Revisar esses 24 vale mais que varrer os 882 no escuro.
 */

const IDS_VALIDOS = [...IDS_CASA, 'maquina'];

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

  const filtro = req.nextUrl.searchParams.get('filtro') ?? 'divergentes';

  const { data, error } = await admin()
    .from('exercises')
    .select('id, name, muscle_group, media_url, equipamento_necessario, equipamento_origem')
    .order('name')
    .limit(1000);

  if (error) {
    console.error('[admin/equipamentos] GET:', error.message);
    return NextResponse.json({ error: 'Nao consegui carregar o catalogo.' }, { status: 500 });
  }

  // TODO o equipamento marcado: a pergunta aqui é "precisa de aparelho de academia?", e para
  // isolar isso o aluno imaginário tem tudo que dá para ter em casa.
  const TUDO_DE_CASA = [...IDS_CASA];

  const comDivergencia = (data ?? []).map(e => {
    const ids: string[] = e.equipamento_necessario ?? [];
    const naoClassificado = e.equipamento_necessario === null;
    const iaDizQueCabeEmCasa = !ids.includes('maquina');
    const nomeDizQueCabeEmCasa = cabeEmCasa(e.name, TUDO_DE_CASA);
    return {
      ...e,
      naoClassificado,
      divergente: !naoClassificado && iaDizQueCabeEmCasa !== nomeDizQueCabeEmCasa,
      // Para a tela explicar de que lado está a discordância.
      iaDizQueCabeEmCasa,
      nomeDizQueCabeEmCasa,
    };
  });

  const lista =
    filtro === 'divergentes' ? comDivergencia.filter(e => e.divergente || e.naoClassificado)
    : filtro === 'revisados' ? comDivergencia.filter(e => e.equipamento_origem === 'profissional')
    : comDivergencia;

  return NextResponse.json({
    exercicios: lista,
    resumo: {
      total: comDivergencia.length,
      divergentes: comDivergencia.filter(e => e.divergente).length,
      naoClassificados: comDivergencia.filter(e => e.naoClassificado).length,
      revisados: comDivergencia.filter(e => e.equipamento_origem === 'profissional').length,
    },
  });
}

export async function POST(req: NextRequest) {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;
  if (!(await souMaster(user.id))) return NextResponse.json({ error: 'Nao encontrado.' }, { status: 404 });

  try {
    const body = await req.json().catch(() => ({}));
    const id = String(body?.id ?? '');
    const bruto = body?.equipamento;

    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: 'Exercicio invalido.' }, { status: 400 });
    }
    if (!Array.isArray(bruto)) {
      return NextResponse.json({ error: 'Equipamento invalido.' }, { status: 400 });
    }

    // Só ids conhecidos, sem repetição. Lista vazia é resposta legítima: peso corporal.
    const equipamento = [...new Set(bruto.map(String).filter(x => IDS_VALIDOS.includes(x)))];

    const { error } = await admin()
      .from('exercises')
      .update({
        equipamento_necessario: equipamento,
        // A partir daqui o dado é do profissional, e não volta a ser sugestão.
        equipamento_origem: 'profissional',
        equipamento_revisado_em: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('[admin/equipamentos] POST:', error.message);
      return NextResponse.json({ error: 'Nao consegui salvar.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, equipamento });
  } catch (e) {
    console.error('[admin/equipamentos] erro:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Nao consegui salvar.' }, { status: 500 });
  }
}
