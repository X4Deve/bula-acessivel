import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Exclui a conta do próprio usuário autenticado (id vem só do token verificado). */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error: e1 } = await context.supabase.rpc("delete_my_personal_data");
    if (e1) throw new Error("Não foi possível apagar os dados pessoais.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("subscription_requests").delete().eq("user_id", context.userId);
    await supabaseAdmin.from("subscription_entitlements").delete().eq("user_id", context.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) throw new Error("Não foi possível excluir a conta.");
    return { ok: true };
  });
