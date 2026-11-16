import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/auth";
import { PageHeader, TextField, ErrorSummary, Notice } from "@/components/common";
import { Button } from "@/components/ui/button";

type S = { redirect?: string };
export const Route = createFileRoute("/entrar")({
  validateSearch: (s: Record<string, unknown>): S =>
    typeof s["redirect"] === "string" &&
    s["redirect"].startsWith("/") &&
    !s["redirect"].startsWith("//")
      ? { redirect: s["redirect"] }
      : {},
  head: () => ({
    meta: [
      { title: "Entrar — Bula Acessível" },
      { name: "description", content: "Entre na sua conta do Bula Acessível." },
      { property: "og:title", content: "Entrar — Bula Acessível" },
      { property: "og:description", content: "Acesse sua biblioteca de bulas." },
    ],
  }),
  component: Login,
});

function Login() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<{ id: string; msg: string }[]>([]);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: { id: string; msg: string }[] = [];
    if (!/^\S+@\S+\.\S+$/.test(email)) errs.push({ id: "email", msg: "Informe um email válido." });
    if (!password) errs.push({ id: "senha", msg: "Informe sua senha." });
    setErrors(errs);
    setFormError("");
    if (errs.length) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      setFormError(friendlyError(error));
      return;
    }
    if (remember) localStorage.removeItem("ba-ephemeral");
    else {
      localStorage.setItem("ba-ephemeral", "1");
      sessionStorage.setItem("ba-alive", "1");
    }
    navigate({ to: redirect ?? "/app" });
  }
  const err = (id: string) => errors.find((e) => e.id === id)?.msg;

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="Entrar" />
      <form onSubmit={submit} noValidate className="space-y-5">
        <ErrorSummary errors={errors} />
        {formError && (
          <Notice tone="error" title="Não foi possível entrar" live="assertive">
            {formError}
          </Notice>
        )}
        <TextField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={err("email")}
        />
        <TextField
          id="senha"
          label="Senha"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={err("senha")}
        />
        <div className="flex min-h-11 items-center gap-3">
          <input
            id="lembrar"
            type="checkbox"
            className="size-6"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          <label htmlFor="lembrar" className="text-base">
            Lembrar minha sessão neste dispositivo
          </label>
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "Entrando…" : "Entrar"}
        </Button>
      </form>
      <p className="mt-6">
        <Link
          to="/recuperar-senha"
          className="inline-flex min-h-11 items-center text-primary underline"
        >
          Esqueci minha senha
        </Link>
      </p>
      <p>
        Ainda não tem conta?{" "}
        <Link
          to="/cadastro"
          className="inline-flex min-h-11 items-center font-semibold text-primary underline"
        >
          Criar conta
        </Link>
      </p>
    </div>
  );
}
