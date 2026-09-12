import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { INACTIVITY_RESET_DAYS } from "@/lib/periodization";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT!,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );

    const { createClient: createServiceClient } = await import("@supabase/supabase-js");
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Início do dia de hoje no horário de Brasília (UTC-3), expresso como timestamp UTC
    const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;
    const nowBrt = new Date(Date.now() - BRT_OFFSET_MS);
    const todayStartUtc = new Date(
      Date.UTC(nowBrt.getUTCFullYear(), nowBrt.getUTCMonth(), nowBrt.getUTCDate())
    ).getTime() + BRT_OFFSET_MS;

    // Janela pra detectar quem cruza HOJE o limite de inatividade da periodização: último treino
    // entre (hoje - 15d) e (hoje - 14d). Como o cron roda uma vez por dia, cada aluno cai nessa
    // faixa num único dia — o aviso de reset sai uma vez só, não todo dia até ele voltar.
    const DAY_MS = 24 * 60 * 60 * 1000;
    const resetWindowStart = new Date(todayStartUtc - (INACTIVITY_RESET_DAYS + 1) * DAY_MS).toISOString();

    const [
      { data: subscriptions, error: subError },
      { data: trainedToday, error: historyError },
      { data: recentHistory, error: recentError },
    ] = await Promise.all([
      supabase.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth"),
      supabase.from("workout_history").select("user_id").gte("date", new Date(todayStartUtc).toISOString()),
      supabase.from("workout_history").select("user_id, date").gte("date", resetWindowStart),
    ]);

    if (subError) throw subError;
    if (historyError) throw historyError;
    if (recentError) throw recentError;

    const trainedUserIds = new Set((trainedToday || []).map((h) => h.user_id));
    const targets = (subscriptions || []).filter((s) => !trainedUserIds.has(s.user_id));

    // Último treino por aluno dentro da janela; quem não aparece aqui está parado há mais de 15 dias
    // (já recebeu o aviso de reset no dia certo) ou nunca treinou.
    const lastSessionByUser = new Map<string, number>();
    for (const h of recentHistory || []) {
      const t = new Date(h.date).getTime();
      if (t > (lastSessionByUser.get(h.user_id) ?? 0)) lastSessionByUser.set(h.user_id, t);
    }
    const resetThreshold = todayStartUtc - INACTIVITY_RESET_DAYS * DAY_MS;
    const crossingResetToday = (userId: string) => {
      const last = lastSessionByUser.get(userId);
      return last !== undefined && last < resetThreshold;
    };

    const reminderPayload = JSON.stringify({
      title: "Hora de treinar! 🔥",
      body: "Você ainda não treinou hoje. Não deixe sua sequência quebrar!",
      url: "/",
    });
    const resetPayload = JSON.stringify({
      title: "Sentimos sua falta 💪",
      body: `Já são ${INACTIVITY_RESET_DAYS} dias sem treinar. Quando voltar, sua periodização recomeça na semana 1 — mais leve, pra voltar com segurança.`,
      url: "/",
    });

    let sent = 0;
    let resetNotices = 0;
    const staleIds: string[] = [];

    await Promise.all(
      targets.map(async (sub) => {
        try {
          const isReset = crossingResetToday(sub.user_id);
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            isReset ? resetPayload : reminderPayload
          );
          sent++;
          if (isReset) resetNotices++;
        } catch (err: any) {
          // 404/410 = inscrição expirada ou revogada pelo navegador — limpa do banco
          if (err.statusCode === 404 || err.statusCode === 410) {
            staleIds.push(sub.id);
          } else {
            console.error("Push send error:", sub.id, err.message);
          }
        }
      })
    );

    if (staleIds.length > 0) {
      await supabase.from("push_subscriptions").delete().in("id", staleIds);
    }

    return NextResponse.json({ ok: true, sent, resetNotices, skipped: trainedUserIds.size, cleaned: staleIds.length });
  } catch (error: any) {
    console.error("send-reminders error:", error);
    return NextResponse.json({ error: error.message || "Failed to send reminders" }, { status: 500 });
  }
}
