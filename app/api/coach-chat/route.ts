import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { requireAuth } from "@/utils/supabase/auth-guard";
import { checkRateLimit } from "@/utils/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const rateLimitError = await checkRateLimit(user.id, "coach-chat", { limit: 40, windowMinutes: 60 });
    if (rateLimitError) return rateLimitError;

    const { apiKey, profile, message, history } = await req.json();

    const key = apiKey || process.env.GROQ_API_KEY;

    if (!key) {
      return NextResponse.json({ error: "API key is required" }, { status: 401 });
    }

    const groq = new Groq({ apiKey: key });

    // BUG FIX: o Coach só recebia nome/objetivo/nível/peso/altura — não sabia o treino atual do
    // aluno, o histórico real de sessões, nem lesões/condições médicas da anamnese. Respostas
    // eram genéricas e, pior, podiam recomendar algo inseguro pra quem tem lesão relatada (mesmo
    // risco que já tínhamos corrigido no gerador de treino, mas nunca tinha chegado até aqui).
    // Todo mundo aqui é dono dos próprios dados (RLS via cliente autenticado — sem service role).
    const supabase = await createClient();
    const [{ data: plans }, { data: recentHistory }, { data: anamneseRows }] = await Promise.all([
      supabase.from('workout_plans').select('name, split, sessions').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1),
      supabase.from('workout_history').select('date, session_name, total_volume, duration_seconds').eq('user_id', user.id).order('date', { ascending: false }).limit(5),
      supabase.from('anamnese_history').select('answers').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1),
    ]);

    const currentPlan = plans?.[0];
    const planSummary = currentPlan
      ? `${currentPlan.name} (${currentPlan.split}) — Sessões: ${(currentPlan.sessions || []).map((s: any) => `${s.name} [${(s.exercises || []).map((e: any) => e.name).join(', ')}]`).join(' | ')}`
      : 'Nenhum plano de treino ativo no momento.';

    const historySummary = (recentHistory && recentHistory.length > 0)
      ? recentHistory.map((h: any) => `- ${new Date(h.date).toLocaleDateString('pt-BR')}: ${h.session_name || 'Sessão'}, volume total ${h.total_volume || 0}kg, duração ${Math.round((h.duration_seconds || 0) / 60)}min`).join('\n')
      : 'Nenhum treino registrado ainda.';

    const latestAnswers = anamneseRows?.[0]?.answers as Record<string, any> | undefined;
    const healthSummary = latestAnswers
      ? `- Lesões atuais ou histórico: ${latestAnswers.lesoes?.trim() || 'Nenhuma relatada'}\n- Condições médicas relevantes: ${latestAnswers.condicoes?.trim() || 'Nenhuma relatada'}\n- Liberação médica para treinar: ${latestAnswers.liberacao || 'Não informado'}`
      : 'Aluno ainda não preencheu a anamnese.';

    const systemInstruction = `Você é o VegaFit Coach, um personal trainer especialista em musculação, nutrição esportiva e biomecânica.
Você deve responder de forma motivadora, direta e técnica (mas acessível).
Perfil do aluno atual:
- Nome: ${profile?.name || 'Aluno'}
- Objetivo: ${profile?.goal || 'Não definido'}
- Nível: ${profile?.level || 'Não definido'}
- Peso: ${profile?.weight ? profile.weight + 'kg' : 'Não definido'}
- Altura: ${profile?.height ? profile.height + 'cm' : 'Não definido'}

PLANO DE TREINO ATUAL: ${planSummary}

HISTÓRICO RECENTE (últimas sessões realizadas):
${historySummary}

INFORMAÇÕES DE SAÚDE (extraídas da anamnese oficial):
${healthSummary}
REGRA CRÍTICA DE SEGURANÇA: NUNCA recomende exercício, carga ou progressão que possa agravar as lesões ou condições médicas listadas acima. Se o aluno perguntar sobre um exercício que conflita com uma lesão relatada, avise isso explicitamente antes de responder.

Use o plano atual e o histórico recente acima pra dar respostas específicas (ex: se perguntarem sobre progressão de carga, cite o volume/treinos recentes reais em vez de falar de forma genérica).
Sempre limite suas respostas a no máximo 2-3 parágrafos curtos para facilitar a leitura no celular.
Use formatação leve (negrito com **texto**) para destacar os pontos principais.`;

    const messages: Groq.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemInstruction },
      ...history.map((msg: any) => ({
        role: msg.role === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.content,
      })),
      { role: "user", content: message },
    ];

    const response = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages,
      reasoning_effort: "low",
      max_tokens: 512,
    });

    const text = response.choices[0]?.message?.content;

    return NextResponse.json({ text });

  } catch (error: any) {
    console.error("Groq API error:", error);
    return NextResponse.json({ error: error.message || "Failed to respond" }, { status: 500 });
  }
}
