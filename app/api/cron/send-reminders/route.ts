import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";

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

    const [{ data: subscriptions, error: subError }, { data: trainedToday, error: historyError }] =
      await Promise.all([
        supabase.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth"),
        supabase.from("workout_history").select("user_id").gte("date", new Date(todayStartUtc).toISOString()),
      ]);

    if (subError) throw subError;
    if (historyError) throw historyError;

    const trainedUserIds = new Set((trainedToday || []).map((h) => h.user_id));
    const targets = (subscriptions || []).filter((s) => !trainedUserIds.has(s.user_id));

    const payload = JSON.stringify({
      title: "Hora de treinar! 🔥",
      body: "Você ainda não treinou hoje. Não deixe sua sequência quebrar!",
      url: "/",
    });

    let sent = 0;
    const staleIds: string[] = [];

    await Promise.all(
      targets.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload
          );
          sent++;
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

    return NextResponse.json({ ok: true, sent, skipped: trainedUserIds.size, cleaned: staleIds.length });
  } catch (error: any) {
    console.error("send-reminders error:", error);
    return NextResponse.json({ error: error.message || "Failed to send reminders" }, { status: 500 });
  }
}
