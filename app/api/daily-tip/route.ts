import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { apiKey, profile } = await req.json();
    const key = apiKey || process.env.GROQ_API_KEY;

    if (!key) {
      return NextResponse.json({ tip: "Mantenha a constância. A hidratação e um bom descanso são tão importantes quanto o treino." });
    }

    const groq = new Groq({ apiKey: key });

    const prompt = `Você é um coach de saúde e fitness.
Gere UMA única dica curta (máximo 2 frases) de treino, nutrição ou recuperação para um aluno com o seguinte perfil:
- Objetivo: ${profile?.goal || 'Não especificado'}
- Nível: ${profile?.level || 'Não especificado'}
- Limitações/Intenção: ${profile?.intent || 'Nenhuma'}

A dica deve ser motivadora, direta e mudar o foco (as vezes falar de água, outras de sono, outras de proteína, outras de carga, dependendo do perfil).
Retorne apenas o texto da dica, sem aspas e sem formatação extra.`;

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 150,
    });

    const text = response.choices[0]?.message?.content;

    if (!text) {
      throw new Error("Empty response from AI");
    }

    return NextResponse.json({ tip: text.trim() });

  } catch (error: any) {
    console.error("Groq API error:", error);
    return NextResponse.json({ tip: "Mantenha a constância. A hidratação e um bom descanso são tão importantes quanto o treino." });
  }
}
