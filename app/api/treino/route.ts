import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { requireAuth } from "@/utils/supabase/auth-guard";
import { checkRateLimit } from "@/utils/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const rateLimitError = await checkRateLimit(user.id, "treino", { limit: 15, windowMinutes: 1440 });
    if (rateLimitError) return rateLimitError;

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

    // profile?.id existe quando um trainer gera treino para um cliente (app/trainer/[clientId]/ai-builder);
    // no fluxo do próprio aluno o profile do AppContext não carrega o id, então cai no user.id da sessão.
    const targetUserId = profile?.id || user.id;

    const [{ data: dbExercises }, { data: anamneseRows }] = await Promise.all([
      serviceSupabase
        .from('exercises')
        .select('id, name, muscle_group'), // Buscar todos os exercícios, ignorando user_id por enquanto (B2C)
      serviceSupabase
        .from('anamnese_history')
        .select('answers')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false })
        .limit(1),
    ]);

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

    // Create a grouped string of available exercises to make it EXTREMELY clear to the LLM
    const groupedListStr = Object.entries(exercisesByMuscle).map(([muscle, exercises]) => {
      return `[MÚSCULO: ${muscle.toUpperCase()}]\n${exercises.map((e: any) => `- ${e.name}`).join('\n')}`;
    }).join('\n\n');

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
    
    // Faixas de reps E séries iniciais diferentes por tipo de exercício — sem isso a IA tende a
    // copiar o mesmo número de exemplo do schema JSON pra todos os exercícios (agachamento e rosca
    // direta saindo com a mesma faixa de reps/séries, o que não faz sentido fisiologicamente).
    // A periodização de 4 semanas (progressão + deload) continua obrigatória — só o PONTO DE PARTIDA
    // (semana 1) passa a variar por tipo de exercício; a progressão semana a semana é somada em cima dele.
    const compoundReps = isWeightLoss ? '10-12' : '6-10';
    const isolationReps = isWeightLoss ? '15-20' : '12-15';
    const compoundSets = 3;
    const isolationSets = 4;

    const goalSpecificInstructions = isWeightLoss
      ? "1. Cada sessão DEVE conter EXATAMENTE " + exercisesPerSession + " exercícios.\n2. Repetições e Séries por Tipo de Exercício: NÃO use a mesma faixa de repetições nem o mesmo número de séries em todos os exercícios da sessão. Para exercícios COMPOSTOS multiarticulares (ex: agachamento, supino, terra, remada, desenvolvimento, leg press), use " + compoundReps + " repetições e comece (Semana 1) com " + compoundSets + " séries. Para exercícios ISOLADOS/acessórios (ex: rosca, elevação lateral, cadeira extensora, tríceps, panturrilha), use " + isolationReps + " repetições e comece (Semana 1) com " + isolationSets + " séries. Descansos curtos (ex: 30 a 45 segundos) para maximizar o gasto calórico.\n3. Periodização de 4 Semanas (OBRIGATÓRIA, respeitando o número inicial de séries do item 2): O plano DEVE ser um Mesociclo de 4 semanas. O campo 'method' de CADA exercício deve OBRIGATORIAMENTE conter a progressão começando com 'Semana', incrementando 1 série na Semana 2 a partir do número inicial, aumentando repetições na Semana 3, e Deload na Semana 4. Exemplo COMPOSTO (parte de " + compoundSets + "): 'Semana 1: " + compoundSets + " séries. Semana 2: " + (compoundSets + 1) + " séries. Semana 3: + repetições. Semana 4: Deload (Emagrecimento)'. Exemplo ISOLADO (parte de " + isolationSets + "): 'Semana 1: " + isolationSets + " séries. Semana 2: " + (isolationSets + 1) + " séries. Semana 3: + repetições. Semana 4: Deload (Emagrecimento)'. O valor numérico do campo 'sets' de cada exercício DEVE ser IGUAL ao número escrito em 'Semana 1' no 'method' do mesmo exercício."
      : "1. Cada sessão DEVE conter EXATAMENTE " + exercisesPerSession + " exercícios.\n2. Volume Semanal, Repetições e Séries por Tipo de Exercício: Busque entre 10 a 20 séries semanais por grupo muscular, com descansos de 60-90s. NÃO use a mesma faixa de repetições nem o mesmo número de séries em todos os exercícios da sessão: para exercícios COMPOSTOS multiarticulares (ex: agachamento, supino, terra, remada, desenvolvimento, leg press), use " + compoundReps + " repetições e comece (Semana 1) com " + compoundSets + " séries; para exercícios ISOLADOS/acessórios (ex: rosca, elevação lateral, cadeira extensora, tríceps, panturrilha, abdômen), use " + isolationReps + " repetições e comece (Semana 1) com " + isolationSets + " séries.\n3. Periodização de 4 Semanas (OBRIGATÓRIA, respeitando o número inicial de séries do item 2): O plano DEVE ser um Mesociclo de 4 semanas com progressão de volume (Progressive Overload), incrementando 1 série por semana a partir do número inicial até a Semana 3, com Deload na Semana 4. Exemplo COMPOSTO (parte de " + compoundSets + "): 'Semana 1: " + compoundSets + " séries. Semana 2: " + (compoundSets + 1) + " séries. Semana 3: " + (compoundSets + 2) + " séries. Semana 4: Deload (Hipertrofia)'. Exemplo ISOLADO (parte de " + isolationSets + "): 'Semana 1: " + isolationSets + " séries. Semana 2: " + (isolationSets + 1) + " séries. Semana 3: " + (isolationSets + 2) + " séries. Semana 4: Deload (Hipertrofia)'. O valor numérico do campo 'sets' de cada exercício DEVE ser IGUAL ao número escrito em 'Semana 1' no 'method' do mesmo exercício.";

    // BUG FIX: config.limitations (o que o aluno escreveu AGORA na tela do gerador) tinha prioridade
    // menor que profile?.intent (a anamnese salva), então editar o campo na hora de gerar não tinha
    // efeito nenhum. Prioriza o que foi escrito agora; só cai pra anamnese se o campo ficar vazio.
    const studentPreferences = config.limitations || profile?.intent || 'Nenhuma';

    // Dados de saúde vêm SEMPRE da anamnese estruturada (anamnese_history), não do texto livre acima —
    // se o aluno editar/apagar o campo de preferências, lesões e condições médicas não podem sumir do prompt.
    const latestAnswers = anamneseRows?.[0]?.answers as Record<string, any> | undefined;
    const healthBlock = latestAnswers
      ? `

INFORMAÇÕES DE SAÚDE DO ALUNO (extraídas da anamnese oficial, aplique SEMPRE — independem do texto de "Preferências e Limitações" acima):
- Lesões atuais ou histórico: ${latestAnswers.lesoes?.trim() || 'Nenhuma relatada'}
- Condições médicas relevantes: ${latestAnswers.condicoes?.trim() || 'Nenhuma relatada'}
- Medicamentos contínuos: ${latestAnswers.medicamentos?.trim() || 'Nenhum relatado'}
- Liberação médica para treinar: ${latestAnswers.liberacao || 'Não informado'}

REGRA CRÍTICA DE SEGURANÇA (PRIORIDADE MÁXIMA, INEGOCIÁVEL): NUNCA selecione exercícios que agravem as lesões ou condições médicas listadas acima, mesmo que o aluno não as repita no campo de preferências. Se a liberação médica for "Não" ou "Não verifiquei", priorize exercícios de baixo impacto e adicione um aviso breve no campo "tips" do primeiro exercício da primeira sessão recomendando confirmar a liberação médica antes de treinar.`
      : '';

    const prompt = `Você é um personal trainer especialista em musculação, hipertrofia e periodização esportiva.
${scientificBasis}
Crie um plano de treino estruturado em JSON para um aluno com o seguinte perfil:
- Objetivo: ${userGoal}
- Nível de experiência: ${config.level || profile?.level || 'Iniciante'}
- Dias por semana: ${config.daysPerWeek}
- Duração por sessão: ${config.duration} minutos
- Equipamentos disponíveis: ${config.equipment}
- Grupos musculares prioritários: ${config.priorities.join(', ')}
- Preferências e Limitações do Aluno: ${studentPreferences}
- Método de treino: ${methodLabel.toUpperCase()} — ${methodDesc}
${healthBlock}

REGRA CRÍTICA SOBRE AS PREFERÊNCIAS DO ALUNO (RESPEITAR OS PROTOCOLOS CIENTÍFICOS):
O aluno forneceu as seguintes preferências: "${studentPreferences}".
Você DEVE adaptar a seleção de exercícios e o foco do treino para atender a esses pedidos do aluno (ex: evitar exercícios que causem dor, priorizar os músculos que ele pediu, respeitar o horário/local se mencionado).
PORÉM, os pedidos do aluno NUNCA podem violar os dois protocolos científicos obrigatórios definidos abaixo (REGRA CRÍTICA SOBRE VOLUME/INTENSIDADE e REGRA CRÍTICA DE EXERCÍCIOS DISPONÍVEIS): a quantidade exata de exercícios por sessão, o volume/intensidade do objetivo (hipertrofia ou emagrecimento) e a periodização de 4 semanas são inegociáveis. Se o pedido do aluno conflitar com essas regras (ex: pedir muito menos exercícios do que o protocolo exige), encaixe a preferência dele DENTRO do protocolo em vez de quebrar o protocolo — nunca o contrário.

REGRA CRÍTICA DE EXERCÍCIOS DISPONÍVEIS:
Abaixo está o catálogo oficial de exercícios agrupados por MÚSCULO. Você DEVE escolher os exercícios APENAS desta lista aprovada:

${groupedListStr}

NÃO invente exercícios fora dessa lista. Use o NOME EXATO que está na lista. Se precisar de um substituto, escolha o mais próximo dentro desta lista, copiando o nome perfeitamente.

REGRA CRÍTICA SOBRE A DIVISÃO MUSCULAR (SPLIT E COERÊNCIA):
1. A seleção de exercícios DEVE SER 100% COERENTE COM O NOME DA SESSÃO.
2. Quando criar uma sessão (ex: "Treino A - Peito, Ombro, Tríceps"), vá até a lista acima, procure o bloco "[MÚSCULO: PEITO]" e escolha os exercícios dali. Depois vá no bloco "[MÚSCULO: OMBRO]" etc.
3. É ESTRITAMENTE PROIBIDO colocar um exercício do bloco "[MÚSCULO: BÍCEPS]" ou "[MÚSCULO: COSTAS]" em um dia de "Peito/Tríceps". ISSO É UM ERRO GRAVE.
4. A dica (tips) DEVE fazer sentido para o exercício escolhido. Jamais gere dicas sobre "alongar o peito" para um exercício de perna.
5. Se o método for Superset (Biset), certifique-se de parear exercícios coerentes com a sessão atual.

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
          "sets": ${compoundSets},
          "reps": "${compoundReps} (composto) OU ${isolationReps} (isolado) — varia por exercício, ver regra abaixo",
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
REGRA CRÍTICA SOBRE O CAMPO "reps": o valor no exemplo do JSON acima é ilustrativo, NÃO copie o mesmo número pra todos os exercícios. Classifique CADA exercício como composto ou isolado e defina "reps" com um valor numérico real dentro da faixa correspondente (${compoundReps} para composto, ${isolationReps} para isolado) — exercícios diferentes na mesma sessão DEVEM ter valores de "reps" diferentes quando forem de tipos diferentes.
REGRA CRÍTICA SOBRE O CAMPO "sets": o valor ${compoundSets} no exemplo do JSON acima também é só o exemplo pra exercício COMPOSTO. Para exercício ISOLADO, "sets" DEVE ser ${isolationSets}. Em AMBOS os casos, esse número tem que ser EXATAMENTE IGUAL ao número escrito em "Semana 1" dentro do campo "method" do mesmo exercício — os dois campos nunca podem contradizer um ao outro. A progressão das semanas seguintes (Semana 2, 3, 4) parte desse número inicial, conforme a REGRA CRÍTICA de Periodização.
Aplique o método ${methodLabel.toUpperCase()} de forma coerente em todos os exercícios.
REGRA CRÍTICA PARA MÉTODOS AVANÇADOS: Se o método for Drop Set, Rest-Pause, Pirâmide, etc: 
1. Use o array "targetLabels" para nomear as séries (ex: ["S1", "S2", "Drop Set"]). O tamanho DEVE ser igual ao número de "sets". Para o método tradicional, use ["S1", "S2", "S3"].
2. Você DEVE explicar brevemente como executar o método no campo "tips" de CADA exercício (ex: "No Drop Set, ao falhar, reduza 20% da carga e continue sem descanso").`;

    const response = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      reasoning_effort: "low",
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
