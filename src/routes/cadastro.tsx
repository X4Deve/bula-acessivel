import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/auth";
import { TERMS_VERSION } from "@/lib/medical";
import { PageHeader, TextField, ErrorSummary, Notice } from "@/components/common";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Criar conta — Bula Acessível" },
      {
        name: "description",
        content: "Crie sua conta gratuita para salvar bulas e preferências de acessibilidade.",
      },
      { property: "og:title", content: "Criar conta — Bula Acessível" },
      { property: "og:description", content: "Cadastro gratuito e acessível." },
    ],
  }),
  component: Signup,
});

function Signup() {
  const [f, setF] = useState({ name: "", email: "", password: "", confirm: "" });
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<{ id: string; msg: string }[]>([]);
  const [formError, setFormError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: { id: string; msg: string }[] = [];
    if (f.name.trim().length < 2)
      errs.push({ id: "nome", msg: "Informe seu nome (pelo menos 2 letras)." });
    if (!/^\S+@\S+\.\S+$/.test(f.email))
      errs.push({ id: "email", msg: "Informe um email válido." });
    if (f.password.length < 8)
      errs.push({ id: "senha", msg: "A senha precisa ter pelo menos 8 caracteres." });
    if (f.confirm !== f.password)
      errs.push({ id: "confirmar", msg: "A confirmação de senha não é igual à senha." });
    if (!terms)
      errs.push({
        id: "termos",
        msg: "É preciso aceitar os Termos de uso e a Política de privacidade.",
      });
    setErrors(errs);
    setFormError("");
    if (errs.length) return;
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: f.email.trim(),
      password: f.password,
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
        data: { display_name: f.name.trim(), terms_version: TERMS_VERSION },
      },
    });
    setBusy(false);
    if (error) {
      setFormError(friendlyError(error));
      return;
    }
    setDone(true);
  }
  const err = (id: string) => errors.find((e) => e.id === id)?.msg;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: e.target.value });

  if (done) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <PageHeader title="Confirme seu email" />
        <Notice tone="success" title="Conta criada. Falta confirmar o email." live="polite">
          Enviamos um link de confirmação para {f.email}. Abra o link para ativar a conta e depois{" "}
          <Link to="/entrar" className="font-semibold text-primary underline">
            entre
          </Link>
          . Se não encontrar, verifique a caixa de spam.
        </Notice>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader
        title="Criar conta"
        description="Ler bulas é grátis e não exige conta. A conta serve para salvar sua biblioteca e preferências."
      />
      <form onSubmit={submit} noValidate className="space-y-5">
        <ErrorSummary errors={errors} />
        {formError && (
          <Notice tone="error" title="Não foi possível criar a conta" live="assertive">
            {formError}
          </Notice>
        )}
        <p className="text-sm text-muted-foreground">Campos marcados com * são obrigatórios.</p>
        <TextField
          id="nome"
          label="Nome"
          autoComplete="name"
          required
          value={f.name}
          onChange={set("name")}
          error={err("nome")}
          maxLength={120}
        />
        <TextField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={f.email}
          onChange={set("email")}
          error={err("email")}
        />
        <TextField
          id="senha"
          label="Senha"
          type="password"
          autoComplete="new-password"
          required
          hint="Mínimo de 8 caracteres."
          value={f.password}
          onChange={set("password")}
          error={err("senha")}
        />
        <TextField
          id="confirmar"
          label="Confirmar senha"
          type="password"
          autoComplete="new-password"
          required
          value={f.confirm}
          onChange={set("confirm")}
          error={err("confirmar")}
        />
        <fieldset className="space-y-3 rounded-lg border p-4">
          <legend className="px-1 font-semibold">Privacidade (LGPD)</legend>
          <p className="text-sm">
            Guardamos apenas o necessário: nome, email e o que você decidir salvar. Dados sobre
            medicamentos que você usa são dados de saúde e só são guardados se você os registrar. O
            acompanhamento de bem-estar exige um consentimento separado, que você pode dar depois.
          </p>
          <div className="flex items-start gap-3">
            <input
              id="termos"
              type="checkbox"
              className="mt-1 size-6"
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
              aria-invalid={!!err("termos") || undefined}
              aria-describedby={err("termos") ? "termos-err" : undefined}
            />
            <label htmlFor="termos">
              Li e aceito os{" "}
              <Link to="/termos" className="text-primary underline">
                Termos de uso
              </Link>{" "}
              e a{" "}
              <Link to="/privacidade" className="text-primary underline">
                Política de privacidade
              </Link>
              .{" "}
              <span aria-hidden="true" className="text-destructive">
                *
              </span>
            </label>
          </div>
          {err("termos") && (
            <p id="termos-err" className="text-sm font-medium text-destructive">
              Erro: {err("termos")}
            </p>
          )}
        </fieldset>
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "Criando…" : "Criar conta"}
        </Button>
      </form>
      <p className="mt-6">
        Já tem conta?{" "}
        <Link
          to="/entrar"
          className="inline-flex min-h-11 items-center font-semibold text-primary underline"
        >
          Entrar
        </Link>
      </p>
    </div>
  );
}
