import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/utils/supabase/auth-guard';
import { requireSubscription } from '@/utils/supabase/subscription-guard';
import { createClient } from '@supabase/supabase-js';
import { reserveAiCapacity } from '@/utils/rate-limit';
import { generateWithRetry } from '@/lib/geminiClient';
import { casarComCatalogo, limparNumeros, precisamDeConferencia } from '@/lib/importarTreino';

export const maxDuration = 60;

/**
 * Lê a ficha de treino que o aluno já tem — foto ou PDF — e devolve os exercícios.
 *
 * NÃO SALVA NADA. Devolve o que leu para a tela conferir, e só depois o aluno confirma. Ficha
 * de academia é escrita à mão, com abreviação e letra ruim; importar direto para a conta de
 * alguém sem revisão seria entregar um treino que ninguém prescreveu.
 *
 * POR QUE O MODELO E NÃO UM OCR
 *
 * OCR devolve texto solto e erra mais em letra manuscrita. O modelo entende o contexto: sabe
 * que "3x12" é série por repetição, que "sup. reto" é supino reto, e que a coluna da direita
 * costuma ser carga. A leitura é só o começo — o que faz a importação valer é casar com o
 * catálogo (lib/importarTreino.ts), para o exercício importado ter vídeo e entrar nos filtros.
 */

const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];
const TAMANHO_MAXIMO = 8 * 1024 * 1024;

export async function POST(req: NextRequest) {
  let aiSlot: Awaited<ReturnType<typeof reserveAiCapacity>>['slot'] = null;
  let aiSettled = false;

  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const { error: subError } = await requireSubscription(user.id);
    if (subError) return subError;

    // Limite baixo de propósito: ler imagem custa mais que gerar texto, e importar ficha é
    // coisa que se faz uma ou duas vezes, não dez por dia.
    const capacity = await reserveAiCapacity(user.id, 'importar-treino', { limit: 5, windowMinutes: 1440 });
    if (capacity.error) return capacity.error;
    aiSlot = capacity.slot;

    const form = await req.formData();
    const arquivo = form.get('arquivo');

    if (!(arquivo instanceof File)) {
      return NextResponse.json({ error: 'Envie uma foto ou um PDF da sua ficha.' }, { status: 400 });
    }
    if (!TIPOS_ACEITOS.includes(arquivo.type)) {
      return NextResponse.json({ error: 'Formato nao aceito. Use foto (JPG, PNG) ou PDF.' }, { status: 400 });
    }
    if (arquivo.size > TAMANHO_MAXIMO) {
      return NextResponse.json({ error: 'Arquivo muito grande. O limite e 8 MB.' }, { status: 400 });
    }

    const base64 = Buffer.from(await arquivo.arrayBuffer()).toString('base64');

    const prompt = `Esta imagem ou PDF é uma ficha de treino de academia.

Extraia os exercícios exatamente como estão escritos, sem corrigir nem melhorar os nomes.

REGRAS:
1. Se a ficha estiver dividida em dias (Treino A, B, C / Segunda, Terça), preserve essa divisão.
2. Se não houver divisão, devolva um único dia chamado "Treino importado".
3. "3x12" significa sets: 3, reps: "12". "3x10-12" significa sets: 3, reps: "10-12".
4. Se não houver série ou repetição para um exercício, use sets: 3 e reps: "8-12".
5. Descanso, quando houver, em SEGUNDOS. "1 min" vira 60. Sem informação, use 60.
6. NÃO invente exercício que não está escrito. Se não conseguir ler um item, pule.
7. Ignore anotações que não sejam exercício (nome do aluno, data, assinatura, observações).

Responda APENAS com este JSON:
{
  "sessoes": [
    { "nome": "Treino A", "exercicios": [ { "name": "Supino reto", "sets": 3, "reps": "10-12", "restSeconds": 60 } ] }
  ]
}`;

    const chave = process.env.GEMINI_API_KEY;
    if (!chave) {
      return NextResponse.json({ error: 'Leitura indisponivel agora.' }, { status: 503 });
    }

    const resposta = await generateWithRetry(chave, {
      prompt,
      arquivos: [{ mimeType: arquivo.type, base64 }],
      json: true,
      maxOutputTokens: 4000,
    });

    if (aiSlot) { await aiSlot.settle(resposta.totalTokens ?? 0); aiSettled = true; }

    const lido = JSON.parse(resposta.text);
    const sessoesLidas = Array.isArray(lido?.sessoes) ? lido.sessoes : [];

    if (sessoesLidas.length === 0) {
      return NextResponse.json(
        { error: 'Nao consegui ler exercicios nessa imagem. Tente uma foto mais nitida, de frente e com boa luz.' },
        { status: 422 }
      );
    }

    // Catálogo lido com service_role: é dado público do app, e a RLS de exercises não precisa
    // entrar no caminho de uma leitura que só serve para casar nomes.
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
    const { data: catalogo } = await admin.from('exercises').select('id, name, muscle_group').limit(1000);

    const sessoes = sessoesLidas.slice(0, 7).map((s: any, i: number) => {
      const exercicios = (Array.isArray(s?.exercicios) ? s.exercicios : [])
        .slice(0, 20)
        .map(limparNumeros);
      return {
        nome: String(s?.nome || `Treino ${String.fromCharCode(65 + i)}`).slice(0, 80),
        exercicios: casarComCatalogo(exercicios, catalogo ?? []),
      };
    }).filter((s: any) => s.exercicios.length > 0);

    const total = sessoes.reduce((n: number, s: any) => n + s.exercicios.length, 0);
    const conferir = sessoes.reduce((n: number, s: any) => n + precisamDeConferencia(s.exercicios), 0);

    console.log(`[importar-treino] ${user.id}: ${total} exercícios lidos, ${conferir} sem correspondente.`);
    return NextResponse.json({ sessoes, total, precisamConferencia: conferir });
  } catch (e) {
    console.error('[importar-treino]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Nao consegui ler a ficha agora. Tente novamente.' }, { status: 500 });
  } finally {
    if (aiSlot && !aiSettled) await aiSlot.release();
  }
}
