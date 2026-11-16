import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthCtx = { user: User | null; session: Session | null; loading: boolean };
const Ctx = createContext<AuthCtx>({ user: null, session: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthCtx>({ user: null, session: null, loading: true });
  const qc = useQueryClient();
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setState({ user: session?.user ?? null, session, loading: false });
      if (event === "SIGNED_IN" || event === "USER_UPDATED") qc.invalidateQueries();
      if (event === "SIGNED_OUT") qc.clear();
    });
    (async () => {
      // "Lembrar sessão" desmarcado: encerra sessão quando o navegador é reaberto.
      if (localStorage.getItem("ba-ephemeral") === "1" && !sessionStorage.getItem("ba-alive")) {
        localStorage.removeItem("ba-ephemeral");
        await supabase.auth.signOut();
      }
      const { data } = await supabase.auth.getSession();
      setState({ user: data.session?.user ?? null, session: data.session, loading: false });
    })();
    return () => sub.subscription.unsubscribe();
  }, [qc]);
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

export function useIsAdmin() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: user!.id,
        _role: "admin",
      });
      if (error) throw error;
      return !!data;
    },
  });
}

export function useIsPremium() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is-premium", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_premium", { _user_id: user!.id });
      if (error) throw error;
      return !!data;
    },
  });
}

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useSettings() {
  return useQuery({
    queryKey: ["app-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("key,value");
      if (error) throw error;
      const m = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
      return {
        priceLabel:
          typeof m["premium_price_label"] === "string" ? m["premium_price_label"] : "A definir",
        validityDays:
          typeof m["curation_validity_days"] === "number" ? m["curation_validity_days"] : 180,
        externalChannel:
          typeof m["external_delivery_channel"] === "string"
            ? m["external_delivery_channel"]
            : "nao_configurado",
      };
    },
  });
}

export async function signOutClean(qc: ReturnType<typeof useQueryClient>) {
  await qc.cancelQueries();
  qc.clear();
  localStorage.removeItem("ba-ephemeral");
  await supabase.auth.signOut();
}

/** Converte erros técnicos em mensagens compreensíveis, sem expor dados. */
export function friendlyError(e: unknown): string {
  const msg =
    e instanceof Error
      ? e.message
      : typeof e === "object" && e && "message" in e
        ? String((e as { message: unknown }).message)
        : "";
  if (/Invalid login credentials/i.test(msg)) return "Email ou senha incorretos.";
  if (/Email not confirmed/i.test(msg))
    return "Seu email ainda não foi confirmado. Verifique sua caixa de entrada.";
  if (/already registered|already exists/i.test(msg))
    return "Este email já está cadastrado. Tente entrar ou recuperar a senha.";
  if (/one_pending_request|duplicate key/i.test(msg))
    return "Já existe um registro igual (por exemplo, um pedido pendente).";
  if (/row-level security|permission denied|Sem permissão/i.test(msg))
    return "Você não tem permissão para esta ação.";
  if (/rate limit/i.test(msg))
    return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  if (/Failed to fetch|NetworkError/i.test(msg))
    return "Sem conexão com o servidor. Verifique sua internet e tente novamente.";
  return msg || "Ocorreu um erro inesperado. Tente novamente.";
}
