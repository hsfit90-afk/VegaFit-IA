import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/supabase/auth-guard";
import { checkRateLimit, checkGlobalAiCapacity } from "@/utils/rate-limit";
import { createGroqCompletionWithRetry } from "@/lib/groqRetry";

const FALLBACK_TIP = "Mantenha a constância. A hidratação e um bom descanso são tão importantes quanto o treino.";

export async function POST(req: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    // Rota chamada automaticamente ao carregar telas, então não usamos 429 aqui:
    // se o limite estourar, cai de volta pra dica estática em vez de quebrar a UI.
    const rateLimitError = await checkRateLimit(user.id, "daily-tip", { limit: 30, windowMinutes: 1440 });
    if (rateLimitError) return NextResponse.json({ tip: FALLBACK_TIP });

    const globalCapacityError = await checkGlobalAiCapacity("daily-tip");
    if (globalCapacityError) return NextResponse.json({ tip: FALLBACK_TIP });

    const { apiKey, profile } = await req.json();
    const key = apiKey || process.env.GROQ_API_KEY;

    if (!key) {
      return NextResponse.json({ tip: FALLBACK_TIP });
    }

    const groq = new Groq({ apiKey: key });

    const prompt = `Você é um coach de saúde e fitness.
Gere UMA única dica curta (máximo 2 frases) de treino, nutrição ou recuperação para um aluno com o seguinte perfil:
- Objetivo: ${profile?.goal || 'Não especificado'}
- Nível: ${profile?.level || 'Não especificado'}
- Limitações/Intenção: ${profile?.intent || 'Nenhuma'}

A dica deve ser motivadora, direta e mudar o foco (as vezes falar de água, outras de sono, outras de proteína, outras de carga, dependendo do perfil).
Retorne apenas o texto da dica, sem aspas e sem formatação extra.`;

    const response = await createGroqCompletionWithRetry(groq, {
      model: "openai/gpt-oss-120b",
      messages: [{ role: "user", content: prompt }],
      reasoning_effort: "low",
      max_tokens: 300,
    }, 1);

    const text = response.choices[0]?.message?.content;

    if (!text) {
      throw new Error("Empty response from AI");
    }

    return NextResponse.json({ tip: text.trim() });

  } catch (error: any) {
    console.error("Groq API error:", error);
    return NextResponse.json({ tip: FALLBACK_TIP });
  }
}
