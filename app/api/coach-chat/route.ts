import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { requireAuth } from "@/utils/supabase/auth-guard";
import { reserveAiCapacity, type AiReservation } from "@/utils/rate-limit";
import { fetchLatestAnamneseAnswers, campoAnamneseParaPrompt, AVISO_CONTEUDO_DO_ALUNO } from "@/lib/aiHealthContext";
import { generateWithRetry } from "@/lib/geminiClient";

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

    const capacity = await reserveAiCapacity(user.id, "coach-chat", { limit: 40, windowMinutes: 60 });
    if (capacity.error) return capacity.error;
    aiSlot = capacity.slot;

    const { apiKey, profile, message, history } = await req.json();

    // M3: o apiKey vem do CORPO da requisicao e acaba virando um header HTTP. Uma chave do
    // Gemini nao tem espaco nem quebra de linha; uma que tenha veio colada errada ou forjada.
    // Nos dois casos, ignorar e usar a do servidor.
    const chaveDoCorpo = typeof apiKey === 'string' ? apiKey.trim() : '';
    const key = /^[A-Za-z0-9._-]+$/.test(chaveDoCorpo) ? chaveDoCorpo : process.env.GEMINI_API_KEY;

    if (!key) {
      return NextResponse.json({ error: "API key is required" }, { status: 401 });
    }

    // BUG FIX: o Coach só recebia nome/objetivo/nível/peso/altura — não sabia o treino atual do
    // aluno, o histórico real de sessões, nem lesões/condições médicas da anamnese. Respostas
    // eram genéricas e, pior, podiam recomendar algo inseguro pra quem tem lesão relatada (mesmo
    // risco que já tínhamos corrigido no gerador de treino, mas nunca tinha chegado até aqui).
    // Todo mundo aqui é dono dos próprios dados (RLS via cliente autenticado — sem service role).
    const supabase = await createClient();
    const [{ data: plans }, { data: recentHistory }, latestAnswers] = await Promise.all([
      supabase.from('workout_plans').select('name, split, sessions').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1),
      supabase.from('workout_history').select('date, session_name, total_volume, duration_seconds').eq('user_id', user.id).order('date', { ascending: false }).limit(5),
      fetchLatestAnamneseAnswers(supabase, user.id),
    ]);

    const currentPlan = plans?.[0];
    const planSummary = currentPlan
      ? `${currentPlan.name} (${currentPlan.split}) — Sessões: ${(currentPlan.sessions || []).map((s: any) => `${s.name} [${(s.exercises || []).map((e: any) => e.name).join(', ')}]`).join(' | ')}`
      : 'Nenhum plano de treino ativo no momento.';

    const historySummary = (recentHistory && recentHistory.length > 0)
      ? recentHistory.map((h: any) => `- ${new Date(h.date).toLocaleDateString('pt-BR')}: ${h.session_name || 'Sessão'}, volume total ${h.total_volume || 0}kg, duração ${Math.round((h.duration_seconds || 0) / 60)}min`).join('\n')
      : 'Nenhum treino registrado ainda.';

    const healthSummary = latestAnswers
      ? `- Lesões atuais ou histórico: ${campoAnamneseParaPrompt(latestAnswers.lesoes, 'Nenhuma relatada')}\n- Condições médicas relevantes: ${campoAnamneseParaPrompt(latestAnswers.condicoes, 'Nenhuma relatada')}\n- Liberação médica para treinar: ${campoAnamneseParaPrompt(latestAnswers.liberacao, 'Não informado')}\n${AVISO_CONTEUDO_DO_ALUNO}`
      : 'Aluno ainda não preencheu a anamnese.';

    const systemInstruction = `Você é o VegaFit Coach, um personal trainer especialista em musculação, nutrição esportiva e biomecânica.
Você deve responder de forma motivadora, direta e técnica (mas acessível).
Perfil do aluno atual:
- Nome: ${profile?.name || 'Aluno'}
- Objetivo: ${profile?.goal || 'Não definido'}
- Nível: ${profile?.level || 'Não definido'}
- Peso: ${profile?.weight ? profile.weight + 'kg' : 'Não definido'}
- Altura: ${profile?.height ? profile.height + 'cm' : 'Não definido'}

PLANO DE TREINO ATUAL: ${planSummary}

HISTÓRICO RECENTE (últimas sessões realizadas):
${historySummary}

INFORMAÇÕES DE SAÚDE (extraídas da anamnese oficial):
${healthSummary}
REGRA CRÍTICA DE SEGURANÇA: NUNCA recomende exercício, carga ou progressão que possa agravar as lesões ou condições médicas listadas acima. Se o aluno perguntar sobre um exercício que conflita com uma lesão relatada, avise isso explicitamente antes de responder.

Use o plano atual e o histórico recente acima pra dar respostas específicas (ex: se perguntarem sobre progressão de carga, cite o volume/treinos recentes reais em vez de falar de forma genérica).
Sempre limite suas respostas a no máximo 2-3 parágrafos curtos para facilitar a leitura no celular.
Use formatação leve (negrito com **texto**) para destacar os pontos principais.`;

    const response = await generateWithRetry(key, {
      system: systemInstruction,
      history: (history || []).map((msg: any) => ({
        role: msg.role === 'user' ? ('user' as const) : ('model' as const),
        text: msg.content,
      })),
      prompt: message,
      maxOutputTokens: 1024,
    });

    // Troca a estimativa pelo consumo real antes de qualquer validação que possa falhar:
    // estes tokens foram gastos de fato, então o orçamento tem que refletir isso.
    await aiSlot.settle(response.totalTokens);
    aiSettled = true;

    const text = response.text;

    return NextResponse.json({ text });

  } catch (error: any) {
    console.error("Coach chat AI error:", error);
    // A2: a mensagem do SDK pode conter a CHAVE DE API -- foi o que apareceu na tela do
    // aluno em 23/09/2026 ("Headers.append: AQ.Ab8... is an invalid header value"). O erro
    // inteiro vai para o log do servidor; o navegador recebe texto generico.
    return NextResponse.json({ error: "O coach nao conseguiu responder agora. Tente novamente." }, { status: 500 });
  } finally {
    if (aiSlot && !aiSettled) await aiSlot.release();
  }
}
