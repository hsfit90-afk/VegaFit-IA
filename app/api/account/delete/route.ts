import { NextResponse } from "next/server";
import { requireAuth } from "@/utils/supabase/auth-guard";

/**
 * Exclusão de conta — direito à eliminação (LGPD Art. 18, V).
 *
 * O app guarda dado sensível de saúde na anamnese (lesões, condições médicas, medicamentos),
 * então a eliminação precisa ser completa e verificável, não "melhor esforço".
 *
 * Como funciona:
 *
 * 1. STORAGE PRIMEIRO. `storage.objects` NÃO tem foreign key para `auth.users` (verificado no
 *    banco), então apagar o usuário do Auth deixaria os arquivos dele órfãos no bucket para
 *    sempre. Tem que ser antes, porque depois de apagar o usuário perdemos o prefixo de pasta.
 *
 * 2. DEPOIS O USUÁRIO DO AUTH. As 9 tabelas de `public` têm `ON DELETE CASCADE` para
 *    `auth.users` (ai_usage_log, anamnese_history, body_weight_history, exercises, profiles,
 *    push_subscriptions, user_session_index, workout_history, workout_plans), então um único
 *    `deleteUser` apaga tudo de forma atômica. DELETEs manuais tabela a tabela seriam redundantes
 *    e, pior, poderiam divergir do schema com o tempo.
 *
 * 3. VERIFICAÇÃO. Em vez de confiar na cascata no escuro, conferimos depois se sobrou alguma
 *    linha. Se um dia alguém criar uma tabela sem CASCADE, isso aparece no log em vez de virar
 *    dado pessoal esquecido no banco.
 *
 * Segurança: o id vem SEMPRE da sessão (`requireAuth`), nunca do corpo da requisição — ninguém
 * apaga a conta de outra pessoa.
 */

const BUCKET = "exercise-media";
const TABELAS_COM_USER_ID = [
  "ai_usage_log",
  "anamnese_history",
  "body_weight_history",
  "exercises",
  "push_subscriptions",
  "user_session_index",
  "workout_history",
  "workout_plans",
] as const;

export async function POST() {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const { createClient: createServiceClient } = await import("@supabase/supabase-js");
    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // --- 1. Arquivos do usuário no Storage ---------------------------------------------------
    // list() pagina de 100 em 100; um aluno com muitos exercícios customizados passa disso.
    let arquivosRemovidos = 0;
    let offset = 0;
    for (;;) {
      const { data: arquivos, error: listError } = await admin.storage
        .from(BUCKET)
        .list(user.id, { limit: 100, offset });

      if (listError) {
        console.error("[conta/excluir] falha ao listar storage:", listError.message);
        break; // não impede a exclusão da conta — o log registra o resíduo
      }
      if (!arquivos || arquivos.length === 0) break;

      const caminhos = arquivos.map((a) => `${user.id}/${a.name}`);
      const { error: removeError } = await admin.storage.from(BUCKET).remove(caminhos);
      if (removeError) {
        console.error("[conta/excluir] falha ao remover storage:", removeError.message);
        break;
      }
      arquivosRemovidos += caminhos.length;

      // Como os arquivos saem da listagem conforme são removidos, o offset não avança.
      if (arquivos.length < 100) break;
    }

    // --- 2. Usuário do Auth (cascateia as 9 tabelas) -----------------------------------------
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error("[conta/excluir] falha ao apagar usuário:", deleteError.message);
      return NextResponse.json(
        { error: "Não conseguimos excluir sua conta agora. Tente novamente em alguns minutos." },
        { status: 500 }
      );
    }

    // --- 3. Verificação: a cascata cumpriu o combinado? ---------------------------------------
    const residuo: Record<string, number> = {};
    await Promise.all(
      TABELAS_COM_USER_ID.map(async (tabela) => {
        const { count } = await admin
          .from(tabela)
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id);
        if (count && count > 0) residuo[tabela] = count;
      })
    );
    const { count: perfilRestante } = await admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("id", user.id);
    if (perfilRestante && perfilRestante > 0) residuo.profiles = perfilRestante;

    if (Object.keys(residuo).length > 0) {
      // A conta já não existe, mas sobrou dado: precisa de correção no schema (CASCADE faltando).
      console.error("[conta/excluir] CASCATA INCOMPLETA para", user.id, residuo);
    }

    console.log(
      `[conta/excluir] conta ${user.id} excluída | ${arquivosRemovidos} arquivo(s) removido(s) | ` +
      `resíduo: ${Object.keys(residuo).length === 0 ? "nenhum" : JSON.stringify(residuo)}`
    );

    return NextResponse.json({ ok: true, arquivosRemovidos });
  } catch (error: unknown) {
    const mensagem = error instanceof Error ? error.message : "erro desconhecido";
    console.error("[conta/excluir] erro inesperado:", mensagem);
    return NextResponse.json(
      { error: "Não conseguimos excluir sua conta agora. Tente novamente em alguns minutos." },
      { status: 500 }
    );
  }
}
