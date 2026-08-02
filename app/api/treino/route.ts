import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { apiKey, profile, config } = await req.json();

    const key = apiKey || process.env.GROQ_API_KEY;

    if (!key) {
      return NextResponse.json({ error: "API key is required. Configure nas configurações." }, { status: 401 });
    }

    const groq = new Groq({ apiKey: key });
    
    // Fetch user exercises from Supabase
    const supabase = await createClient();
    const { data: dbExercises } = await supabase.from('exercises').select('id, name, muscle_group');
    
    let availableExercises = dbExercises || [];

    // Filter out banned exercises if any exist in the profile
    if (profile?.bannedExercises && profile.bannedExercises.length > 0) {
      availableExercises = availableExercises.filter((ex: any) => !profile.bannedExercises.includes(ex.id));
    }

    if (availableExercises.length === 0) {
      return NextResponse.json({ error: "Sua biblioteca de exercícios está vazia ou todos os exercícios foram ocultados. Adicione mais exercícios!" }, { status: 400 });
    }

    // Create a compact string of available exercises to save tokens
    const exerciseListStr = availableExercises.map((e: any) => `${e.name} (${e.muscle_group})`).join(', ');

    const methodDescriptions: Record<string, string> = {
      tradicional: 'Séries e repetições tradicionais com descanso entre cada série',
      superset: 'Supersets: pares de exercícios realizados alternadamente sem descanso',
      drop_set: 'Drop Sets: ao falhar, reduza a carga imediatamente e continue',
      piramide: 'Pirâmide: aumente a carga e reduza as reps a cada série',
      rest_pause: 'Rest-Pause: faça reps até a falha, descanse 10-15s, repita',
      circuito: 'Circuito: todos os exercícios em sequência com mínimo descanso',
    };
    const methodLabel = config.trainingMethod || 'tradicional';
    const methodDesc = methodDescriptions[methodLabel] || methodDescriptions['tradicional'];

    const durationMinutes = parseInt(config.duration) || 60;
    const level = (config.level || profile?.level || 'Iniciante').toLowerCase();
    
    // Calcula exercícios por sessão baseado em duração e nível
    let exercisesPerSession: number;
    if (durationMinutes <= 30) {
      exercisesPerSession = level.includes('inici') ? 3 : level.includes('interm') ? 4 : 5;
    } else if (durationMinutes <= 45) {
      exercisesPerSession = level.includes('inici') ? 4 : level.includes('interm') ? 5 : 6;
    } else if (durationMinutes <= 60) {
      exercisesPerSession = level.includes('inici') ? 5 : level.includes('interm') ? 6 : 7;
    } else {
      exercisesPerSession = level.includes('inici') ? 6 : level.includes('interm') ? 7 : 8;
    }

    const prompt = `Você é um personal trainer especialista em musculação e periodização.
Crie um plano de treino estruturado em JSON para um aluno com o seguinte perfil:
- Objetivo: ${config.goal || profile?.goal || 'Hipertrofia'}
- Nível de experiência: ${config.level || profile?.level || 'Iniciante'}
- Dias por semana: ${config.daysPerWeek}
- Duração por sessão: ${config.duration} minutos
- Equipamentos disponíveis: ${config.equipment}
- Grupos musculares prioritários: ${config.priorities.join(', ')}
- Limitações: ${config.limitations || 'Nenhuma'}
- Método de treino: ${methodLabel.toUpperCase()} — ${methodDesc}

REGRA CRÍTICA DE EXERCÍCIOS DISPONÍVEIS:
Você DEVE escolher os exercícios APENAS desta lista aprovada:
[${exerciseListStr}]
NÃO invente exercícios fora dessa lista. Use o NOME EXATO que está na lista. Se você mudar uma única letra ou inventar um exercício, o vídeo vai quebrar no aplicativo. Se precisar de um substituto, escolha o mais próximo dentro desta lista, copiando o nome perfeitamente.

REGRA CRÍTICA SOBRE QUANTIDADE DE EXERCÍCIOS:
Cada sessão DEVE conter EXATAMENTE ${exercisesPerSession} exercícios. Não menos, não mais.
Isso é calculado com base na duração de ${config.duration} minutos e nível ${config.level || profile?.level || 'Iniciante'}.
Um treino de ${config.duration} minutos para nível ${config.level || profile?.level || 'Iniciante'} REQUER ${exercisesPerSession} exercícios para preencher o tempo adequadamente com aquecimento, séries e descanso.

RETORNE APENAS O JSON, SEM MARCAÇÃO MARKDOWN.
Formato OBRIGATÓRIO do JSON:
{
  "name": "Nome do Treino (ex: Hipertrofia 4 dias)",
  "split": "Nome da divisão (ex: ABCD, Push/Pull/Legs)",
  "method": "${methodLabel}",
  "sessions": [
    {
      "name": "Nome da Sessão (ex: Treino A - Peito e Tríceps)",
      "exercises": [
        {
          "name": "Nome do Exercício",
          "muscleGroup": "Grupo muscular principal",
          "sets": 3,
          "reps": "10-12",
          "restSeconds": 60,
          "tips": "Dica curta de execução",
          "method": "Descrição breve do método aplicado a este exercício (ex: Drop Set nas últimas 2 séries)",
          "youtubeSearchTerm": "nome do exercício como executar corretamente"
        }
      ]
    }
  ]
}

Certifique-se de que a quantidade de sessões (sessions) corresponde a "Dias por semana" informados (${config.daysPerWeek}).
OBRIGATÓRIO: Cada sessão deve ter EXATAMENTE ${exercisesPerSession} exercícios — nem a mais, nem a menos.
Gere exercícios compatíveis com os "Equipamentos disponíveis" (${config.equipment}).
Aplique o método ${methodLabel.toUpperCase()} de forma coerente em todos os exercícios.`;

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 2500,
    });

    const text = response.choices[0]?.message?.content;

    if (!text) {
      throw new Error("Empty response from AI");
    }

    const json = JSON.parse(text);

    return NextResponse.json(json);

  } catch (error: any) {
    console.error("Groq API error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate workout" }, { status: 500 });
  }
}
