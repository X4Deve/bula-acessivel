import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDateTime, formatDate } from "@/lib/medical";
import { PageHeader, Notice, Loading, EmptyState, Card } from "@/components/common";

export const Route = createFileRoute("/_authenticated/app/assinatura")({
  head: () => ({
    meta: [
      { title: "Minha assinatura — Bula Acessível" },
      { name: "description", content: "Pedidos de Premium e situação do seu plano." },
      { property: "og:title", content: "Minha assinatura — Bula Acessível" },
      { property: "og:description", content: "Situação da assinatura." },
    ],
  }),
  component: Sub,
});
const ST = {
  pending: "Pendente",
  approved: "Aprovado (administrativo)",
  rejected: "Rejeitado",
} as const;

function Sub() {
  const { user } = useAuth();
  const reqs = useQuery({
    queryKey: ["my-requests", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const ent = useQuery({
    queryKey: ["my-ent", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_entitlements")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const active =
    ent.data?.tier === "premium" &&
    ent.data.status === "active" &&
    (!ent.data.valid_until || new Date(ent.data.valid_until) > new Date());
  return (
    <div className="space-y-6">
      <PageHeader title="Minha assinatura" />
      <Notice tone="info" title="Nenhum pagamento foi processado.">
        Não existe meio de pagamento integrado nesta fase piloto. A ativação do Premium é uma
        aprovação administrativa manual, não uma compra.
      </Notice>
      <Card aria-labelledby="plano">
        <h2 id="plano" className="text-xl font-semibold">
          Plano atual
        </h2>
        {ent.isLoading ? (
          <Loading />
        ) : (
          <p className="mt-1">
            <strong>{active ? "Premium" : "Gratuito"}</strong>
            {active && (
              <>
                {" "}
                — liberado por aprovação administrativa
                {ent.data?.valid_until
                  ? ` até ${formatDate(ent.data.valid_until)}`
                  : ", sem data de término"}
                . Pagamento confirmado:{" "}
                {ent.data?.is_payment_confirmed ? "sim" : "não (sem cobrança)"}.
              </>
            )}
            {ent.data?.status === "revoked" && " — acesso Premium revogado."}
          </p>
        )}
      </Card>
      <section aria-labelledby="pedidos">
        <h2 id="pedidos" className="text-2xl font-semibold">
          Meus pedidos
        </h2>
        {reqs.isLoading ? (
          <Loading />
        ) : !reqs.data?.length ? (
          <EmptyState title="Você ainda não fez pedidos.">
            <Link to="/planos" className="font-semibold text-primary underline">
              Ver planos e solicitar Premium
            </Link>
          </EmptyState>
        ) : (
          <ul className="mt-3 space-y-3">
            {reqs.data.map((r) => (
              <li key={r.id} className="rounded-xl border p-4">
                <p>
                  <strong>Status: {ST[r.status]}</strong>
                </p>
                <p className="text-sm">
                  Pedido em {formatDateTime(r.created_at)}
                  {r.reviewed_at ? ` · Revisado em ${formatDateTime(r.reviewed_at)}` : ""}
                </p>
                {r.admin_note && <p className="text-sm">Observação da equipe: {r.admin_note}</p>}
                <p className="text-sm text-muted-foreground">Sem cobrança associada.</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
