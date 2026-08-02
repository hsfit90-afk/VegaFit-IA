import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

export async function POST(req: Request) {
  try {
    const { profile } = await req.json();

    if (!profile) {
      return NextResponse.json({ error: 'Missing profile' }, { status: 400 });
    }

    const keyToUse = process.env.GROQ_API_KEY;
    if (!keyToUse) {
      return NextResponse.json({ error: 'API Key is missing on server' }, { status: 500 });
    }

    const groq = new Groq({ apiKey: keyToUse });

    const systemPrompt = `Você é um Nutricionista Esportivo de alto nível.
Baseado no perfil do aluno abaixo, calcule a Taxa Metabólica Basal (TMB), o Gasto Energético Total (GET) assumindo treinos de força de 4 a 5 vezes na semana, e a divisão ideal de Macronutrientes diários em gramas (Proteína, Carboidrato e Gordura) para o objetivo principal do aluno.
Também recomende 3 exemplos de refeições principais ricas nos alimentos necessários.

PERFIL:
Nome: ${profile.name}
Idade: ${profile.age} | Peso: ${profile.weight}kg | Altura: ${profile.height}cm
Objetivo: ${profile.goal}
Limitações/Preferências: ${profile.intent || 'Nenhuma'}

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

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: systemPrompt }],
      response_format: { type: "json_object" },
      max_tokens: 2000,
    });

    const responseText = response.choices[0]?.message?.content;
    if (!responseText) throw new Error("Empty AI response");

    const nutritionPlan = JSON.parse(responseText);

    return NextResponse.json(nutritionPlan);
  } catch (error: any) {
    console.error('Nutrition API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
