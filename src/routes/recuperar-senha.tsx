import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/auth";
import { PageHeader, TextField, Notice } from "@/components/common";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/recuperar-senha")({
  head: () => ({
    meta: [
      { title: "Recuperar senha — Bula Acessível" },
      { name: "description", content: "Receba um link para criar uma nova senha." },
      { property: "og:title", content: "Recuperar senha — Bula Acessível" },
      { property: "og:description", content: "Recuperação de senha." },
    ],
  }),
  component: Page,
});

function Page() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<{ ok?: boolean; err?: string }>({});
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setState({ err: "Informe um email válido." });
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    setState(error ? { err: friendlyError(error) } : { ok: true });
  }
  return (
    <div className="mx-auto max-w-lg space-y-5">
      <PageHeader
        title="Recuperar senha"
        description="Informe seu email. Se houver uma conta, enviaremos um link para criar nova senha."
      />
      {state.ok && (
        <Notice tone="success" title="Pedido enviado" live="polite">
          Se o email estiver cadastrado, você receberá o link em instantes.
        </Notice>
      )}
      <form onSubmit={submit} noValidate className="space-y-5">
        <TextField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={state.err}
        />
        <Button type="submit" size="lg">
          Enviar link
        </Button>
      </form>
    </div>
  );
}
