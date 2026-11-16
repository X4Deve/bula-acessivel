import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useSettings, useIsPremium, friendlyError } from "@/lib/auth";
import { PageHeader, Notice } from "@/components/common";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/planos")({
  head: () => ({
    meta: [
      { title: "Planos — Bula Acessível" },
      {
        name: "description",
        content: "Compare o plano Gratuito e o Premium. A leitura de bulas é sempre gratuita.",
      },
      { property: "og:title", content: "Planos — Bula Acessível" },
      { property: "og:description", content: "Gratuito x Premium, com transparência." },
    ],
  }),
  component: Plans,
});

const rows: [string, string, string][] = [
  ["Leitura de bulas verificadas", "Sim, ilimitada", "Sim, ilimitada"],
  ["Link para a bula oficial", "Sim", "Sim"],
  ["Biblioteca pessoal e categorias", "Sim", "Sim"],
  ["Ajustes de fonte, contraste e espaçamento", "Sim", "Sim"],
  ["Lembretes com horários definidos por você", "Não", "Sim"],
  ["Acompanhamento pessoal (check-in opcional)", "Não", "Sim"],
];

function Plans() {
  const { user } = useAuth();
  const settings = useSettings();
  const premium = useIsPremium();
  const qc = useQueryClient();
  const [state, setState] = useState<{ ok?: boolean; err?: string }>({});
  const [busy, setBusy] = useState(false);

  async function request() {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("subscription_requests")
      .insert({ user_id: user.id, type: "premium" });
    setBusy(false);
    setState(error ? { err: friendlyError(error) } : { ok: true });
    qc.invalidateQueries({ queryKey: ["my-requests"] });
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Planos"
        description="A leitura de bulas nunca é bloqueada. O Premium cobre somente organização de lembretes e acompanhamento."
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-left">
          <caption className="mb-2 text-left text-muted-foreground">
            Comparativo entre os planos Gratuito e Premium
          </caption>
          <thead>
            <tr className="border-b-2">
              <th scope="col" className="p-3">
                Recurso
              </th>
              <th scope="col" className="p-3">
                Gratuito
              </th>
              <th scope="col" className="p-3">
                Premium
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([r, f, p]) => (
              <tr key={r} className="border-b">
                <th scope="row" className="p-3 font-medium">
                  {r}
                </th>
                <td className="p-3">{f}</td>
                <td className="p-3">{p}</td>
              </tr>
            ))}
            <tr className="border-b">
              <th scope="row" className="p-3 font-medium">
                Preço
              </th>
              <td className="p-3">Grátis</td>
              <td className="p-3">{settings.data?.priceLabel ?? "A definir"}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <section
        aria-labelledby="solicitar"
        className="max-w-2xl space-y-3 rounded-xl border bg-surface p-6"
      >
        <h2 id="solicitar" className="text-2xl font-semibold">
          Solicitar Premium
        </h2>
        <p>
          Nesta fase piloto <strong>não existe pagamento</strong>. O pedido fica pendente até uma
          aprovação manual da equipe. Nenhum cartão é cobrado.
        </p>
        {state.ok && (
          <Notice tone="success" title="Pedido registrado como pendente." live="polite">
            Não houve pagamento. Acompanhe em{" "}
            <Link to="/app/assinatura" className="text-primary underline">
              Minha assinatura
            </Link>
            .
          </Notice>
        )}
        {state.err && (
          <Notice tone="error" title="Pedido não registrado" live="assertive">
            {state.err}
          </Notice>
        )}
        {!user ? (
          <p>
            <Link to="/cadastro" className="font-semibold text-primary underline">
              Crie uma conta
            </Link>{" "}
            ou{" "}
            <Link to="/entrar" className="font-semibold text-primary underline">
              entre
            </Link>{" "}
            para solicitar.
          </p>
        ) : premium.data ? (
          <Notice
            tone="success"
            title="Seu Premium já está ativo (aprovação administrativa, sem pagamento)."
          />
        ) : (
          <Button onClick={request} disabled={busy}>
            {busy ? "Enviando…" : "Solicitar Premium"}
          </Button>
        )}
      </section>
    </div>
  );
}
