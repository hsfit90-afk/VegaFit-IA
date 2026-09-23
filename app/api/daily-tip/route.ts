import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/utils/supabase/auth-guard";
import { reserveAiCapacity, type AiReservation } from "@/utils/rate-limit";
import { generateWithRetry } from "@/lib/geminiClient";

const FALLBACK_TIP = "Mantenha a constância. A hidratação e um bom descanso são tão importantes quanto o treino.";

// Teto de execução da função no host. A geração de treino levou ~15s medidos, e a fila de
// capacidade (utils/rate-limit.ts) pode somar até AI_MAX_QUEUE_WAIT_MS em cima disso. Sem esta
// linha vale o default do plano na Vercel, que é menor e mata a chamada por timeout. É um TETO,
// não uma reserva: rotas rápidas continuam respondendo rápido. 60s é o máximo do plano Hobby.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  // A reserva de orçamento de IA é devolvida no finally sempre que a chamada termina sem
  // consumir tokens de verdade — qualquer return antecipado daqui pra baixo ou qualquer throw.
  let aiSlot: AiReservation | null = null;
  let aiSettled = false;

  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    // Rota chamada automaticamente ao carregar telas, então não usamos 429 aqui:
    // se o limite estourar, cai de volta pra dica estática em vez de quebrar a UI.
    const capacity = await reserveAiCapacity(user.id, "daily-tip", { limit: 30, windowMinutes: 1440 });
    if (capacity.error) return NextResponse.json({ tip: FALLBACK_TIP });
    aiSlot = capacity.slot;

    const { apiKey, profile } = await req.json();
    // M3: o apiKey vem do CORPO da requisicao e acaba virando um header HTTP. Uma chave do
    // Gemini nao tem espaco nem quebra de linha; uma que tenha veio colada errada ou forjada.
    // Nos dois casos, ignorar e usar a do servidor.
    const chaveDoCorpo = typeof apiKey === 'string' ? apiKey.trim() : '';
    const key = /^[A-Za-z0-9._-]+$/.test(chaveDoCorpo) ? chaveDoCorpo : process.env.GEMINI_API_KEY;

    if (!key) {
      return NextResponse.json({ tip: FALLBACK_TIP });
    }

    const prompt = `Você é um coach de saúde e fitness.
Gere UMA única dica curta (máximo 2 frases) de treino, nutrição ou recuperação para um aluno com o seguinte perfil:
- Objetivo: ${profile?.goal || 'Não especificado'}
- Nível: ${profile?.level || 'Não especificado'}
- Limitações/Intenção: ${profile?.intent || 'Nenhuma'}

A dica deve ser motivadora, direta e mudar o foco (as vezes falar de água, outras de sono, outras de proteína, outras de carga, dependendo do perfil).
Retorne apenas o texto da dica, sem aspas e sem formatação extra.`;

    const response = await generateWithRetry(key, {
      prompt,
      maxOutputTokens: 500,
    }, 1);

    // Troca a estimativa pelo consumo real antes de qualquer validação que possa falhar:
    // estes tokens foram gastos de fato, então o orçamento tem que refletir isso.
    await aiSlot.settle(response.totalTokens);
    aiSettled = true;

    const text = response.text;

    if (!text) {
      throw new Error("Empty response from AI");
    }

    return NextResponse.json({ tip: text.trim() });

  } catch (error: any) {
    console.error("Daily tip AI error:", error);
    return NextResponse.json({ tip: FALLBACK_TIP });
  } finally {
    if (aiSlot && !aiSettled) await aiSlot.release();
  }
}
