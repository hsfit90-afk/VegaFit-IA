import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { requireAuth } from '@/utils/supabase/auth-guard';
import { reserveAiCapacity, type AiReservation } from '@/utils/rate-limit';
import { fetchLatestAnamneseAnswers } from '@/lib/aiHealthContext';
import { generateWithRetry } from '@/lib/geminiClient';

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

    const capacity = await reserveAiCapacity(user.id, 'nutrition', { limit: 10, windowMinutes: 1440 });
    if (capacity.error) return capacity.error;
    aiSlot = capacity.slot;

    const { profile } = await req.json();

    if (!profile) {
      return NextResponse.json({ error: 'Missing profile' }, { status: 400 });
    }

    const keyToUse = process.env.GEMINI_API_KEY;
    if (!keyToUse) {
      return NextResponse.json({ error: 'API Key is missing on server' }, { status: 500 });
    }

    // BUG FIX: essa rota sugeria refeições sem saber de alergia/restrição alimentar ou condição
    // médica cadastrada na anamnese — mesmo risco de segurança já corrigido no gerador de treino,
    // no Coach e na troca de exercício, que faltava aqui. Busca direto do banco (RLS via cliente
    // autenticado), não confia em dado vindo do cliente pra isso.
    const supabase = await createClient();
    const latestAnswers = await fetchLatestAnamneseAnswers(supabase, user.id);
    const restricoes = latestAnswers?.restricoes?.trim();
    const condicoes = latestAnswers?.condicoes?.trim();
    const healthBlock = (restricoes || condicoes)
      ? `\nRestrições alimentares/alergias: ${restricoes || 'Nenhuma relatada'}\nCondições médicas relevantes: ${condicoes || 'Nenhuma relatada'}\nREGRA CRÍTICA DE SEGURANÇA: NUNCA inclua nas refeições sugeridas nenhum alimento que conflite com as restrições/alergias acima.`
      : '';

    const systemPrompt = `Você é um Nutricionista Esportivo de alto nível.
Baseado no perfil do aluno abaixo, calcule a Taxa Metabólica Basal (TMB), o Gasto Energético Total (GET) assumindo treinos de força de 4 a 5 vezes na semana, e a divisão ideal de Macronutrientes diários em gramas (Proteína, Carboidrato e Gordura) para o objetivo principal do aluno.
Também recomende 3 exemplos de refeições principais ricas nos alimentos necessários.

PERFIL:
Nome: ${profile.name}
Idade: ${profile.age} | Peso: ${profile.weight}kg | Altura: ${profile.height}cm
Objetivo: ${profile.goal}
Limitações/Preferências: ${profile.intent || 'Nenhuma'}
${healthBlock}

RETORNE APENAS UM JSON VÁLIDO no seguinte formato exato, sem NENHUM markdown:
{
  "tmb": 2000,
  "get": 2800,
  "targetCalories": 2500,
  "macros": {
    "protein": 180,
    "carbs": 250,
    "fat": 70
  },
  "meals": [
    {
      "name": "Café da Manhã",
      "description": "Ovos mexidos com aveia e frutas"
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

    const nutritionPlan = JSON.parse(responseText);

    return NextResponse.json(nutritionPlan);
  } catch (error: any) {
    console.error('Nutrition API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    if (aiSlot && !aiSettled) await aiSlot.release();
  }
}
