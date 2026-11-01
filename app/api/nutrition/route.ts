import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { requireAuth } from '@/utils/supabase/auth-guard';
import { requireSubscription } from "@/utils/supabase/subscription-guard";
import { reserveAiCapacity, type AiReservation } from '@/utils/rate-limit';
import { fetchLatestAnamneseAnswers, campoAnamneseParaPrompt, AVISO_CONTEUDO_DO_ALUNO } from '@/lib/aiHealthContext';
import { generateWithRetry } from '@/lib/geminiClient';
import { planoNutricional } from '@/lib/nutricao';

// Teto de execução da função no host. A geração de treino levou ~15s medidos, e a fila de
// capacidade (utils/rate-limit.ts) pode somar até AI_MAX_QUEUE_WAIT_MS em cima disso. Sem esta
// linha vale o default do plano na Vercel, que é menor e mata a chamada por timeout. É um TETO,
// não uma reserva: rotas rápidas continuam respondendo rápido. 60s é o máximo do plano Hobby.
export const maxDuration = 60;

export async function POST(req: Request) {
  // A reserva de orçamento de IA é devolvida no finally sempre que a chamada termina sem
  // consumir tokens de verdade — qualquer return antecipado daqui pra baixo ou qualquer throw.
  let aiSlot: AiReservation | null = null;
  let aiSettled = false;

  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    // Assinatura vem ANTES de reservar orcamento de IA: reservar para uma chamada que vai
    // ser recusada suja a janela de throttle de quem esta pagando.
    const { error: subError } = await requireSubscription(user.id);
    if (subError) return subError;

    const capacity = await reserveAiCapacity(user.id, 'nutrition', { limit: 10, windowMinutes: 1440 });
    if (capacity.error) return capacity.error;
    aiSlot = capacity.slot;

    /*
     * O CORPO DA REQUISIÇÃO NÃO É MAIS LIDO (01/11/2026).
     *
     * Até aqui esta rota fazia `const { profile } = await req.json()` e montava o plano
     * alimentar a partir disso — peso, altura, idade e objetivo vindos do NAVEGADOR. Era
     * a única rota de IA assim: `/api/treino` e `/api/swap` já liam do banco.
     *
     * Na prática dava para mandar peso 45 ou idade 15 e receber um plano alimentar para
     * isso. Vale a regra que já estava escrita para as outras: nunca confiar em perfil
     * vindo do corpo para decidir prescrição.
     */

    const keyToUse = process.env.GEMINI_API_KEY;
    if (!keyToUse) {
      return NextResponse.json({ error: 'API Key is missing on server' }, { status: 500 });
    }

    // BUG FIX: essa rota sugeria refeições sem saber de alergia/restrição alimentar ou condição
    // médica cadastrada na anamnese — mesmo risco de segurança já corrigido no gerador de treino,
    // no Coach e na troca de exercício, que faltava aqui. Busca direto do banco (RLS via cliente
    // autenticado), não confia em dado vindo do cliente pra isso.
    const supabase = await createClient();

    /*
     * O PERFIL E O HISTÓRICO, DO BANCO.
     *
     * O histórico serve para o fator de atividade: antes a rota mandava no texto do prompt
     * "assumindo treinos de força de 4 a 5 vezes na semana" para TODO MUNDO, inclusive para
     * quem não treina há um mês. Agora a frequência é contada.
     *
     * Quatro semanas de histórico bastam para a conta (lib/nutricao.ts olha essa janela), e
     * só a coluna `date` é lida — não há motivo para trazer as séries de cada treino.
     */
    const [{ data: perfilDoBanco }, { data: historico }] = await Promise.all([
      supabase
        .from('profiles')
        .select('weight, height, age, gender, goal')
        .eq('id', user.id)
        .single(),
      supabase
        .from('workout_history')
        .select('date')
        .eq('user_id', user.id)
        .gte(
          'date',
          new Date(Date.now() - 28 * 86_400_000).toISOString(),
        ),
    ]);

    /*
     * A CONTA SAI DO PROMPT E VEM PARA O CÓDIGO.
     *
     * Antes era a IA que calculava TMB, GET e macros dentro do texto. Modelo de linguagem
     * não é calculadora: a mesma pessoa podia receber números diferentes em duas gerações,
     * e não havia um "certo" escrito em lugar nenhum para comparar.
     *
     * Agora `lib/nutricao.ts` decide, com 28 testes, e a IA só sugere refeições.
     * É o mesmo princípio do gerador de treino: restrição se resolve em CÓDIGO, antes do
     * prompt — pedir para a IA "respeitar" já falhou três vezes neste app.
     */
    const calculo = planoNutricional(
      {
        peso: perfilDoBanco?.weight,
        altura: perfilDoBanco?.height,
        idade: perfilDoBanco?.age,
        sexo: perfilDoBanco?.gender,
        objetivo: perfilDoBanco?.goal,
      },
      (historico ?? []).map(h => ({ date: new Date(h.date).getTime() })),
      Date.now(),
    );

    /*
     * Sem dado, SEM PLANO — e a resposta diz exatamente o que falta, para a tela pedir.
     *
     * O sexo é o caso que mais importa: em Mifflin-St Jeor ele vale 166 kcal por dia, e
     * `app/context/AppContext.tsx` já traz `gender || 'M'`, ou seja, quem nunca preencheu
     * vira homem em silêncio. Esta conta não herda esse chute.
     *
     * 422 e não 400: o pedido está bem formado, o que falta é dado do cadastro. E não é 402,
     * que neste app significa "vá pagar".
     */
    if (!calculo.ok) {
      await aiSlot.release();
      aiSettled = true;
      return NextResponse.json(
        { error: 'perfil_incompleto', faltando: calculo.faltando },
        { status: 422 },
      );
    }

    const { tmb, get, caloriasAlvo, macros, base } = calculo.plano;

    const latestAnswers = await fetchLatestAnamneseAnswers(supabase, user.id);
    const restricoes = latestAnswers?.restricoes?.trim();
    const condicoes = latestAnswers?.condicoes?.trim();
    const healthBlock = (restricoes || condicoes)
      ? `\nRestrições alimentares/alergias: ${campoAnamneseParaPrompt(restricoes, 'Nenhuma relatada')}\nCondições médicas relevantes: ${campoAnamneseParaPrompt(condicoes, 'Nenhuma relatada')}\n${AVISO_CONTEUDO_DO_ALUNO}\nREGRA CRÍTICA DE SEGURANÇA: NUNCA inclua nas refeições sugeridas nenhum alimento que conflite com as restrições/alergias acima.`
      : '';

    /*
     * A IA NÃO CALCULA MAIS NADA. Ela recebe os números prontos e monta refeições que
     * cheguem neles. É a tarefa em que um modelo de linguagem é bom — conhecer alimento,
     * combinar prato, respeitar restrição — em vez de aritmética, em que ele não é.
     */
    const systemPrompt = `Você é um Nutricionista Esportivo de alto nível.

Os números do dia JÁ ESTÃO CALCULADOS e não devem ser recalculados nem alterados:
Calorias do dia: ${caloriasAlvo} kcal
Proteína: ${macros.proteina} g | Carboidrato: ${macros.carboidrato} g | Gordura: ${macros.gordura} g
Objetivo do aluno: ${perfilDoBanco?.goal}
${healthBlock}

Sua tarefa: montar 3 refeições principais que, somadas, cheguem perto desses valores, e dar uma dica curta.
Em cada refeição, cite porções aproximadas em gramas ou medidas caseiras.

RETORNE APENAS UM JSON VÁLIDO no seguinte formato exato, sem NENHUM markdown:
{
  "meals": [
    {
      "name": "Café da Manhã",
      "description": "3 ovos mexidos, 60g de aveia e 1 banana"
    }
  ],
  "tips": "Beba 3 litros de água por dia."
}`;

    const response = await generateWithRetry(keyToUse, {
      prompt: systemPrompt,
      json: true,
      maxOutputTokens: 4000,
    });

    // Troca a estimativa pelo consumo real antes de qualquer validação que possa falhar:
    // estes tokens foram gastos de fato, então o orçamento tem que refletir isso.
    await aiSlot.settle(response.totalTokens);
    aiSettled = true;

    const responseText = response.text;
    if (!responseText) throw new Error("Empty AI response");

    const sugestao = JSON.parse(responseText);

    /*
     * Os NÚMEROS vêm do código; só `meals` e `tips` vêm da IA.
     *
     * A ordem importa: o que a IA devolveu é espalhado primeiro, e os campos calculados
     * sobrescrevem. Se o modelo resolver mandar um "targetCalories" por conta própria —
     * contrariando o prompt —, ele é descartado em vez de chegar à tela do aluno.
     *
     * `base` acompanha para a tela poder mostrar de onde saiu o número (fórmula, frequência
     * medida e ajuste do objetivo), em vez de o plano ser uma caixa preta.
     */
    return NextResponse.json({
      meals: Array.isArray(sugestao?.meals) ? sugestao.meals : [],
      tips: typeof sugestao?.tips === 'string' ? sugestao.tips : '',
      tmb,
      get,
      targetCalories: caloriasAlvo,
      macros: {
        protein: macros.proteina,
        carbs: macros.carboidrato,
        fat: macros.gordura,
      },
      base,
    });
  } catch (error: any) {
    console.error('Nutrition API Error:', error);
    // A2: a mensagem do SDK pode conter a CHAVE DE API -- foi o que apareceu na tela do
    // aluno em 23/09/2026 ("Headers.append: AQ.Ab8... is an invalid header value"). O erro
    // inteiro vai para o log do servidor; o navegador recebe texto generico.
    return NextResponse.json({ error: "Nao conseguimos montar o plano alimentar agora. Tente novamente." }, { status: 500 });
  } finally {
    if (aiSlot && !aiSettled) await aiSlot.release();
  }
}
