import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/auth";
import { PageHeader, TextField, Notice } from "@/components/common";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({
    meta: [
      { title: "Nova senha — Bula Acessível" },
      { name: "description", content: "Defina uma nova senha." },
      { property: "og:title", content: "Nova senha — Bula Acessível" },
      { property: "og:description", content: "Definir nova senha." },
    ],
  }),
  component: Page,
});

function Page() {
  const navigate = useNavigate();
  const [p, setP] = useState("");
  const [c, setC] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (p.length < 8) return setErr("A senha precisa ter pelo menos 8 caracteres.");
    if (p !== c) return setErr("A confirmação não é igual à senha.");
    const { error } = await supabase.auth.updateUser({ password: p });
    if (error) return setErr(friendlyError(error));
    setOk(true);
    setTimeout(() => navigate({ to: "/app" }), 1500);
  }
  return (
    <div className="mx-auto max-w-lg space-y-5">
      <PageHeader title="Definir nova senha" />
      {ok && (
        <Notice tone="success" title="Senha alterada." live="polite">
          Redirecionando para o seu painel…
        </Notice>
      )}
      {err && (
        <Notice tone="error" title="Não foi possível alterar" live="assertive">
          {err}
        </Notice>
      )}
      <form onSubmit={submit} noValidate className="space-y-5">
        <TextField
          id="nova"
          label="Nova senha"
          type="password"
          autoComplete="new-password"
          required
          value={p}
          onChange={(e) => setP(e.target.value)}
        />
        <TextField
          id="conf"
          label="Confirmar nova senha"
          type="password"
          autoComplete="new-password"
          required
          value={c}
          onChange={(e) => setC(e.target.value)}
        />
        <Button type="submit" size="lg">
          Salvar nova senha
        </Button>
      </form>
    </div>
  );
}
