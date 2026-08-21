import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { createClient } from '@/utils/supabase/server';
import { requireAuth } from '@/utils/supabase/auth-guard';
import { checkRateLimit } from '@/utils/rate-limit';
import { fetchLatestAnamneseAnswers } from '@/lib/aiHealthContext';
import { createGroqCompletionWithRetry } from '@/lib/groqRetry';

export async function POST(req: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const rateLimitError = await checkRateLimit(user.id, 'progression', { limit: 15, windowMinutes: 1440 });
    if (rateLimitError) return rateLimitError;

    const { apiKey, profile, recentHistory, effectiveSets, currentPlan, feedback } = await req.json();

    if (!currentPlan || !profile) {
      return NextResponse.json({ error: 'Missing current plan or profile' }, { status: 400 });
    }

    const keyToUse = apiKey || process.env.GROQ_API_KEY;
    if (!keyToUse) {
      return NextResponse.json({ error: 'API Key is missing. Configure nas configurações.' }, { status: 401 });
    }
    const groq = new Groq({ apiKey: keyToUse, timeout: 25000, maxRetries: 1 });

    // BUG FIX: essa era a única rota de IA do app que nunca teve checagem de lesão/condição
    // médica da anamnese — mesmo risco de segurança já corrigido em treino/coach/swap/nutrition.
    // Relevante aqui porque a regra de deload/sobrecarga pode aumentar carga num exercício que
    // agrava uma lesão relatada, se não souber que ela existe.
    const supabase = await createClient();
    const latestAnswers = await fetchLatestAnamneseAnswers(supabase, user.id);
    const lesoes = latestAnswers?.lesoes?.trim();
    const condicoes = latestAnswers?.condicoes?.trim();
    const healthBlock = (lesoes || condicoes)
      ? `\nDADOS DE SAÚDE DO ALUNO (aplique SEMPRE): Lesões: ${lesoes || 'Nenhuma relatada'}. Condições médicas: ${condicoes || 'Nenhuma relatada'}. REGRA CRÍTICA DE SEGURANÇA: NUNCA aumente carga/volume de um exercício que possa agravar essas lesões/condições — nesse caso, mantenha ou reduza, mesmo que a regra de progressão pediria aumento.`
      : '';

    const systemPrompt = `Você é um Personal Trainer especialista em Periodização, Hipertrofia e Sobrecarga Progressiva.
Seu objetivo é analisar o check-in semanal do aluno e ajustar seu plano de treino atual.

PERFIL DO ALUNO:
Nome: ${profile.name}
Idade: ${profile.age} | Peso: ${profile.weight}kg | Altura: ${profile.height}cm
Objetivo: ${profile.goal} | Nível: ${profile.level}
Limitações: ${profile.intent || 'Nenhuma'}
${healthBlock}

FEEDBACK DA SEMANA:
Nível de Fadiga (1-5): ${feedback.fatigueLevel}
Dor articular: ${feedback.jointPain ? 'Sim' : 'Não'}
Treinos realizados na semana: ${recentHistory.length}
Séries Efetivas na semana (RIR <= 3): ${effectiveSets ?? 'Não mensurado'}

PLANO ATUAL:
${JSON.stringify(currentPlan, null, 2)}

REGRAS DE PROGRESSÃO (Microciclo Baseado em RIR e Tonelagem):
1. REGRA DE SEGURANÇA — PRIORIDADE MÁXIMA, SE SOBREPÕE A TODAS AS OUTRAS REGRAS ABAIXO: Se o aluno tem lesão ou condição médica relatada em "DADOS DE SAÚDE DO ALUNO" acima, identifique QUAL exercício do plano envolve a região/movimento lesionado (ex: lesão no joelho -> agachamento, afundo, extensão de perna; lesão no ombro -> desenvolvimento, elevação lateral). Para ESSE exercício específico, NUNCA aumente séries, carga ou repetições nesse check-in — mantenha exatamente como está ou reduza, mesmo que as regras 2-5 abaixo mandem aumentar. As regras 2-5 continuam valendo normalmente para os exercícios que NÃO envolvem a lesão.
2. Se Fadiga >= 4 ou Dor Articular = Sim -> Faça um DELOAD (reduza volume de séries em 20% e mantenha a carga, permitindo que o RIR suba naturalmente).
3. Se Séries Efetivas forem muito baixas (ex: aluno reportou muita tonelagem mas RIR > 3) -> O treino está fofo. Aumente significativamente a Carga (peso) e reduza ligeiramente as repetições alvo se necessário, para forçá-lo a chegar mais perto da falha.
4. Se Fadiga <= 2 e Sem dor -> Aumente ligeiramente a carga (2-5%) nos exercícios base, ou adicione 1 repetição no alvo (Sobrecarga Progressiva tradicional).
5. Se Fadiga == 3 -> Mantenha as séries, apenas foque na progressão sutil em exercícios específicos se possível.
6. Mantenha a mesma estrutura de exercícios, split e nomes. Só altere 'sets', 'reps' (pode ser range, ex: "8-10") ou 'weight' se existir.
7. EXTREMAMENTE IMPORTANTE: NUNCA crie exercícios novos ou altere o nome dos exercícios existentes. Use EXATAMENTE os mesmos nomes que estão no "PLANO ATUAL". Se você mudar o nome, o vídeo do exercício vai quebrar no aplicativo.
8. Se for o momento, altere o nome do plano adicionando "V2" ou "Semana 2", etc.

RETORNE APENAS UM JSON VÁLIDO no exato formato da interface WorkoutPlan. NADA de markdown.
Exemplo do retorno:
{
  "id": "gerado-aqui",
  "name": "Nome Atualizado V2",
  "split": "Mesmo split",
  "sessions": [ ... ]
}`;

    const response = await createGroqCompletionWithRetry(groq, {
      model: "openai/gpt-oss-120b",
      messages: [{ role: "user", content: systemPrompt }],
      response_format: { type: "json_object" },
      reasoning_effort: "low",
      max_tokens: 3500,
    });

    const responseText = response.choices[0]?.message?.content;
    if (!responseText) throw new Error("Empty AI response");

    const newPlan = JSON.parse(responseText);

    // Garantir ID novo
    newPlan.id = crypto.randomUUID();

    return NextResponse.json({ plan: newPlan });
  } catch (error: any) {
    console.error('Progression API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
