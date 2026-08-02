import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { apiKey, profile, message, history } = await req.json();

    const key = apiKey || process.env.GROQ_API_KEY;

    if (!key) {
      return NextResponse.json({ error: "API key is required" }, { status: 401 });
    }

    const groq = new Groq({ apiKey: key });

    const systemInstruction = `Você é o VegaFit Coach, um personal trainer especialista em musculação, nutrição esportiva e biomecânica.
Você deve responder de forma motivadora, direta e técnica (mas acessível).
Perfil do aluno atual:
- Nome: ${profile?.name || 'Aluno'}
- Objetivo: ${profile?.goal || 'Não definido'}
- Nível: ${profile?.level || 'Não definido'}
- Peso: ${profile?.weight ? profile.weight + 'kg' : 'Não definido'}
- Altura: ${profile?.height ? profile.height + 'cm' : 'Não definido'}

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
      model: "llama-3.3-70b-versatile",
      messages,
      max_tokens: 512,
    });

    const text = response.choices[0]?.message?.content;

    return NextResponse.json({ text });

  } catch (error: any) {
    console.error("Groq API error:", error);
    return NextResponse.json({ error: error.message || "Failed to respond" }, { status: 500 });
  }
}
