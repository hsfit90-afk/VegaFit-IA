import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { requireAuth } from "@/utils/supabase/auth-guard";

export async function POST(req: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const { endpoint } = await req.json();
    if (!endpoint) {
      return NextResponse.json({ error: "endpoint é obrigatório." }, { status: 400 });
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("endpoint", endpoint);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Push unsubscribe error:", error);
    return NextResponse.json({ error: error.message || "Failed to unsubscribe" }, { status: 500 });
  }
}
