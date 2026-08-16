import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/supabase/auth-guard";
import { checkRateLimit } from "@/utils/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const rateLimitError = await checkRateLimit(user.id, "swap", { limit: 30, windowMinutes: 60 });
    if (rateLimitError) return rateLimitError;

    const { apiKey, currentExerciseName, libraryExercises } = await req.json();
    const key = apiKey || process.env.GROQ_API_KEY;

    if (!key) {
      return NextResponse.json({ error: "API key is required." }, { status: 401 });
    }

    const groq = new Groq({ apiKey: key });

    // Filter library to only IDs and Names to save tokens
    const libraryStr = libraryExercises.map((e: any) => `${e.id}: ${e.name} (${e.muscleGroup})`).join('\n');

    const prompt = `Você é um personal trainer especialista em biomecânica. O aluno quer trocar o exercício atual: "${currentExerciseName}".
Abaixo está a lista de exercícios disponíveis na biblioteca do aluno no formato "ID: NOME (CATEGORIA)":

${libraryStr}

Sua tarefa:
1. Analise o exercício original "${currentExerciseName}" e identifique qual é o SEU VERDADEIRO foco muscular e padrão de movimento (Ex: Se for Elevação Pélvica, o foco verdadeiro é Glúteos/Membros Inferiores, mesmo que a CATEGORIA no banco esteja dizendo "Fullbody" ou outra coisa).
2. Olhe a lista de exercícios disponíveis e escolha a MELHOR alternativa que trabalhe A MESMA MUSCULATURA ALVO ou tenha o MESMO PADRÃO DE MOVIMENTO.
3. Retorne APENAS um JSON válido contendo o "id" do exercício escolhido da lista. Não escreva mais nada.

Exemplo de retorno OBRIGATÓRIO:
{
  "id": "123e4567-e89b-12d3-a456-426614174000"
}`;

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 100,
    });

    const text = response.choices[0]?.message?.content;
    if (!text) throw new Error("Empty response from AI");

    const json = JSON.parse(text);
    return NextResponse.json(json);
  } catch (error: any) {
    console.error("Groq Swap API error:", error);
    return NextResponse.json({ error: error.message || "Failed to swap exercise" }, { status: 500 });
  }
}
