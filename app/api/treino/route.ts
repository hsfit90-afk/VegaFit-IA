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
    
    // Fetch exercises using service_role to bypass RLS — garante acesso a todos os exercícios globais
    // para qualquer usuário, incluindo novos cadastros.
    const { createClient: createServiceClient } = await import('@supabase/supabase-js');
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: dbExercises } = await serviceSupabase
      .from('exercises')
      .select('id, name, muscle_group'); // Buscar todos os exercícios, ignorando user_id por enquanto (B2C)
    
    let availableExercises = dbExercises || [];

    // Filter out banned exercises if any exist in the profile
    if (profile?.bannedExercises && profile.bannedExercises.length > 0) {
      availableExercises = availableExercises.filter((ex: any) => !profile.bannedExercises.includes(ex.id));
    }

    // BUG FIX: Limit exercises per muscle group to avoid exceeding Groq TPM token limits (413 Payload Too Large)
    const MAX_EXERCISES_PER_MUSCLE = 15;
    const exercisesByMuscle: Record<string, any[]> = {};
    
    // Sort randomly so users don't always get the exact same 15 exercises for the prompt
    const shuffledExercises = availableExercises.sort(() => 0.5 - Math.random());
    
    shuffledExercises.forEach((ex: any) => {
      const muscle = ex.muscle_group || 'Outros';
      if (!exercisesByMuscle[muscle]) exercisesByMuscle[muscle] = [];
      if (exercisesByMuscle[muscle].length < MAX_EXERCISES_PER_MUSCLE) {
        exercisesByMuscle[muscle].push(ex);
      }
    });
    
    const limitedExercises = Object.values(exercisesByMuscle).flat();

    if (limitedExercises.length === 0) {
      return NextResponse.json({ error: "Sua biblioteca de exercícios está vazia ou todos os exercícios foram ocultados. Adicione mais exercícios!" }, { status: 400 });
    }

    // Create a compact string of available exercises to save tokens
    const exerciseListStr = limitedExercises.map((e: any) => `${e.name} (${e.muscle_group})`).join(', ');

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

    const userGoal = config.goal || profile?.goal || 'Hipertrofia';
    
    // Novo: Base científica dinâmica baseada no objetivo
    const scientificBasis = userGoal.toLowerCase().includes('emagrec') || userGoal.toLowerCase().includes('perder peso')
      ? "Baseie-se ESTRITAMENTE no consenso EASO (Bellicha et al., 2021) e ACSM para emagrecimento: priorize a manutenção de massa magra com musculação (tensão mecânica) associada a alto gasto calórico no volume total."
      : "Baseie-se ESTRITAMENTE no consenso científico atual sobre hipertrofia (Schoenfeld et al., 2021 - IUSCA).";

    // Dynamic rules based on goal
    const isWeightLoss = userGoal.toLowerCase().includes('emagrec') || userGoal.toLowerCase().includes('perder peso');
    const ruleTitle = isWeightLoss 
      ? "REGRA CRÍTICA SOBRE VOLUME E INTENSIDADE (EASO / ACSM - EMAGRECIMENTO):" 
      : "REGRA CRÍTICA SOBRE QUANTIDADE DE EXERCÍCIOS E VOLUME (SCHOENFELD, 2021 - HIPERTROFIA):";
    
    const goalSpecificInstructions = isWeightLoss
      ? "1. Cada sessão DEVE conter EXATAMENTE " + exercisesPerSession + " exercícios.\n2. Repetições e Descanso: Para maximizar o gasto calórico, use faixas de repetições mais altas (ex: 12-15 ou 15-20) e descansos mais curtos (ex: 30 a 45 segundos).\n3. Periodização de 4 Semanas: O plano DEVE ser um Mesociclo de 4 semanas. O campo 'method' deve OBRIGATORIAMENTE conter a progressão começando com 'Semana' (ex: 'Semana 1: 3 séries. Semana 2: 4 séries. Semana 3: + repetições. Semana 4: Deload (Emagrecimento)')."
      : "1. Cada sessão DEVE conter EXATAMENTE " + exercisesPerSession + " exercícios.\n2. Volume Semanal: Busque entre 10 a 20 séries semanais por grupo muscular. Use repetições clássicas (ex: 8-12) e descansos de 60-90s.\n3. Periodização de 4 Semanas: O plano DEVE ser um Mesociclo de 4 semanas com progressão de volume (Progressive Overload). O campo 'method' deve OBRIGATORIAMENTE conter a progressão começando com 'Semana' (ex: 'Semana 1: 3 séries. Semana 2: 4 séries. Semana 3: 5 séries. Semana 4: Deload (Hipertrofia)').";

    const prompt = `Você é um personal trainer especialista em musculação, hipertrofia e periodização esportiva.
${scientificBasis}
Crie um plano de treino estruturado em JSON para um aluno com o seguinte perfil:
- Objetivo: ${userGoal}
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
NÃO invente exercícios fora dessa lista. Use o NOME EXATO que está na lista. Se precisar de um substituto, escolha o mais próximo dentro desta lista, copiando o nome perfeitamente.

REGRA CRÍTICA SOBRE A DIVISÃO MUSCULAR (SPLIT E COERÊNCIA):
1. Os exercícios escolhidos DEVEM OBRIGATORIAMENTE focar EXCLUSIVAMENTE nos músculos declarados no "name" da sessão. NUNCA insira exercícios de outros grupos musculares (incluindo Cardio ou Pernas) em um dia de Peito e Tríceps, por exemplo.
2. A dica (tips) DEVE fazer sentido para o exercício. Jamais gere dicas sobre "alongar o peito" para um exercício de Cardio ou Perna.
3. Se o método for Superset (Biset), certifique-se de parear exercícios coerentes com a sessão atual.

${ruleTitle}
${goalSpecificInstructions}

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
          "reps": "${isWeightLoss ? '12-15' : '10-12'}",
          "restSeconds": ${isWeightLoss ? 45 : 60},
          "tips": "EXPLICAÇÃO DE COMO EXECUTAR O MÉTODO (ex: Como fazer o Drop Set) + Dica de execução do exercício.",
          "method": "DESCRIÇÃO DA PROGRESSÃO DE 4 SEMANAS (Siga o exemplo das Regras Críticas).",
          "targetLabels": ["S1", "S2", "Drop Set"],
          "youtubeSearchTerm": "nome do exercício como executar corretamente"
        }
      ]
    }
  ]
}

Certifique-se de que a quantidade de sessões (sessions) corresponde a "Dias por semana" informados (${config.daysPerWeek}).
OBRIGATÓRIO: Cada sessão deve ter EXATAMENTE ${exercisesPerSession} exercícios — nem a mais, nem a menos.
Gere exercícios compatíveis com os "Equipamentos disponíveis" (${config.equipment}).
Aplique o método ${methodLabel.toUpperCase()} de forma coerente em todos os exercícios.
REGRA CRÍTICA PARA MÉTODOS AVANÇADOS: Se o método for Drop Set, Rest-Pause, Pirâmide, etc: 
1. Use o array "targetLabels" para nomear as séries (ex: ["S1", "S2", "Drop Set"]). O tamanho DEVE ser igual ao número de "sets". Para o método tradicional, use ["S1", "S2", "S3"].
2. Você DEVE explicar brevemente como executar o método no campo "tips" de CADA exercício (ex: "No Drop Set, ao falhar, reduza 20% da carga e continue sem descanso").`;

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      // BUG FIX: 2500 tokens era insuficiente para planos de 5-6 dias com muitos exercícios
      // JSON truncado causava JSON.parse() falhar silenciosamente
      max_tokens: 4096,
    });

    const text = response.choices[0]?.message?.content;

    if (!text) {
      throw new Error("Empty response from AI");
    }

    const json = JSON.parse(text);

    // BUG FIX: Validação do schema antes de retornar ao cliente
    if (!json.sessions || !Array.isArray(json.sessions) || json.sessions.length === 0) {
      throw new Error('A IA não gerou sessões de treino. Tente novamente.');
    }

    // Garante que nenhuma sessão veio sem exercícios
    for (const session of json.sessions) {
      if (!session.exercises || !Array.isArray(session.exercises) || session.exercises.length === 0) {
        throw new Error(`A sessão "${session.name || 'sem nome'}" veio sem exercícios. Tente novamente.`);
      }
    }

    return NextResponse.json(json);

  } catch (error: any) {
    console.error("Groq API error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate workout" }, { status: 500 });
  }
}
