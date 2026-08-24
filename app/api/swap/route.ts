import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { requireAuth } from "@/utils/supabase/auth-guard";
import { checkRateLimit, checkGlobalAiCapacity } from "@/utils/rate-limit";
import { classifyEquipmentTier, EQUIPMENT_ALLOWED_TIERS } from "@/lib/equipmentTier";
import { isMobilityOnly } from "@/lib/exerciseType";
import { fetchLatestAnamneseAnswers } from "@/lib/aiHealthContext";
import { createGroqCompletionWithRetry } from "@/lib/groqRetry";

export async function POST(req: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const rateLimitError = await checkRateLimit(user.id, "swap", { limit: 30, windowMinutes: 60 });
    if (rateLimitError) return rateLimitError;

    const globalCapacityError = await checkGlobalAiCapacity("swap");
    if (globalCapacityError) return globalCapacityError;

    const { apiKey, currentExerciseName, muscleGroup, equipment, libraryExercises } = await req.json();
    const key = apiKey || process.env.GROQ_API_KEY;

    if (!key) {
      return NextResponse.json({ error: "API key is required." }, { status: 401 });
    }

    const groq = new Groq({ apiKey: key });

    // BUG FIX (achado testando de verdade): mandar a biblioteca inteira (500+ exercícios, ~19500
    // tokens) sempre estourava o limite de 8000 tokens/min da Groq — o endpoint SEMPRE falhava com
    // 413 e caía silenciosamente no sorteio aleatório local (o botão "trocar com IA" nunca usava
    // IA de verdade, ninguém percebeu porque o fallback não quebra a UI). Filtra pelo grupo
    // muscular do exercício atual ANTES de montar o prompt, igual já fazemos na geração.
    let candidates = (libraryExercises || []) as { id: string; name: string; muscleGroup: string }[];

    if (muscleGroup) {
      const sameGroup = candidates.filter((e) => e.muscleGroup === muscleGroup);
      if (sameGroup.length > 0) candidates = sameGroup;
    }

    // Mesmo filtro de equipamento da geração — não sugerir exercício de máquina pra quem treina
    // em casa/ar livre (lib/equipmentTier.ts, compartilhado com app/api/treino/route.ts).
    const allowedTiers = equipment ? EQUIPMENT_ALLOWED_TIERS[equipment] : undefined;
    if (allowedTiers) {
      const filtered = candidates.filter((e) => allowedTiers.includes(classifyEquipmentTier(e.name)));
      if (filtered.length > 0) candidates = filtered;
    }

    // Tira alongamento/postura/liberação miofascial das opções de troca — mesmo motivo do gerador
    // (lib/exerciseType.ts): esses exercícios não têm série/repetição fixa e não fazem sentido como
    // substituto de um exercício de força. Com salvaguarda aqui (diferente do gerador): a lista já
    // está restrita a um único grupo muscular, então tem mais chance de esvaziar de vez.
    const nonMobility = candidates.filter((e) => !isMobilityOnly(e.name));
    if (nonMobility.length > 0) candidates = nonMobility;

    // Segunda salvaguarda de tamanho: mesmo já filtrado, corta num teto seguro de tokens (evita
    // repetir o mesmo erro caso um grupo muscular específico tenha crescido demais no catálogo).
    const MAX_CANDIDATES = 80;
    if (candidates.length > MAX_CANDIDATES) {
      candidates = [...candidates].sort(() => 0.5 - Math.random()).slice(0, MAX_CANDIDATES);
    }

    if (candidates.length === 0) {
      return NextResponse.json({ error: "Nenhuma alternativa disponível na biblioteca." }, { status: 400 });
    }

    // Dados de saúde da anamnese — mesma REGRA CRÍTICA DE SEGURANÇA do gerador de treino: a troca
    // de exercício não pode sugerir algo que agrave uma lesão/condição relatada. Busca direto do
    // banco (RLS via cliente autenticado, cada um só vê os próprios dados), não confia em dado
    // vindo do cliente pra isso.
    const supabase = await createClient();
    const latestAnswers = await fetchLatestAnamneseAnswers(supabase, user.id);
    const lesoes = latestAnswers?.lesoes?.trim();
    const condicoes = latestAnswers?.condicoes?.trim();
    const healthBlock = (lesoes || condicoes)
      ? `\n\nDADOS DE SAÚDE DO ALUNO (aplique SEMPRE): Lesões: ${lesoes || 'Nenhuma relatada'}. Condições médicas: ${condicoes || 'Nenhuma relatada'}. REGRA CRÍTICA DE SEGURANÇA: NUNCA escolha um substituto que possa agravar essas lesões/condições, mesmo que ele pareça biomecanicamente parecido com o original.`
      : '';

    const libraryStr = candidates.map((e) => `${e.id}: ${e.name} (${e.muscleGroup})`).join('\n');

    const prompt = `Você é um personal trainer especialista em biomecânica. O aluno quer trocar o exercício atual: "${currentExerciseName}".
Abaixo está a lista de exercícios disponíveis na biblioteca do aluno no formato "ID: NOME (CATEGORIA)":

${libraryStr}
${healthBlock}

Sua tarefa:
1. Analise o exercício original "${currentExerciseName}" e identifique qual é o SEU VERDADEIRO foco muscular e padrão de movimento (Ex: Se for Elevação Pélvica, o foco verdadeiro é Glúteos/Membros Inferiores, mesmo que a CATEGORIA no banco esteja dizendo "Fullbody" ou outra coisa).
2. Olhe a lista de exercícios disponíveis e escolha a MELHOR alternativa que trabalhe A MESMA MUSCULATURA ALVO ou tenha o MESMO PADRÃO DE MOVIMENTO.
3. Retorne APENAS um JSON válido contendo o "id" do exercício escolhido da lista. Não escreva mais nada.

Exemplo de retorno OBRIGATÓRIO:
{
  "id": "123e4567-e89b-12d3-a456-426614174000"
}`;

    const response = await createGroqCompletionWithRetry(groq, {
      model: "openai/gpt-oss-120b",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      reasoning_effort: "low",
      max_tokens: 300,
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
