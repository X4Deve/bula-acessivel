import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin, useSettings, friendlyError } from "@/lib/auth";
import { formatDateTime } from "@/lib/medical";
import { PageHeader, Loading, Notice, LiveRegion, TextField } from "@/components/common";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { AdminRequests } from "@/components/admin/AdminRequests";
import { AdminCatalog } from "@/components/admin/AdminCatalog";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administração — Bula Acessível" },
      { name: "description", content: "Painel administrativo restrito." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Administração — Bula Acessível" },
      { property: "og:description", content: "Área restrita." },
    ],
  }),
  component: Admin,
});

function Admin() {
  const admin = useIsAdmin();
  if (admin.isLoading) return <Loading label="Verificando permissão…" />;
  if (!admin.data) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-brand">Sem permissão</h1>
        <p className="mt-2">
          Esta área é restrita a administradores. O acesso é validado no servidor.
        </p>
      </div>
    );
  }
  const tab = "min-h-11 px-4 text-base";
  return (
    <div className="space-y-6">
      <PageHeader
        title="Administração"
        description="Toda ação é validada no banco e registrada em auditoria."
      />
      <Stats />
      <Tabs defaultValue="pedidos">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="pedidos" className={tab}>
            Pedidos Premium
          </TabsTrigger>
          <TabsTrigger value="catalogo" className={tab}>
            Catálogo e bulas
          </TabsTrigger>
          <TabsTrigger value="config" className={tab}>
            Configurações
          </TabsTrigger>
          <TabsTrigger value="auditoria" className={tab}>
            Auditoria
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pedidos" className="pt-4">
          <h2 className="mb-3 text-2xl font-semibold">Pedidos Premium</h2>
          <AdminRequests />
        </TabsContent>
        <TabsContent value="catalogo" className="pt-4">
          <h2 className="mb-3 text-2xl font-semibold">Catálogo e bulas</h2>
          <AdminCatalog />
        </TabsContent>
        <TabsContent value="config" className="pt-4">
          <h2 className="mb-3 text-2xl font-semibold">Configurações</h2>
          <Config />
        </TabsContent>
        <TabsContent value="auditoria" className="pt-4">
          <h2 className="mb-3 text-2xl font-semibold">Auditoria</h2>
          <Audit />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stats() {
  const q = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_stats");
      if (error) throw error;
      return data as Record<string, number>;
    },
  });
  if (q.isLoading) return <Loading label="Carregando números agregados…" />;
  if (q.error) return <Notice tone="error" title={friendlyError(q.error)} />;
  if (!q.data) return null;
  const items: [string, string][] = [
    ["requests_pending", "Pedidos pendentes"],
    ["users", "Contas"],
    ["premium_active", "Premium ativos"],
    ["medicines_published", "Medicamentos publicados"],
    ["leaflets_in_review", "Bulas em revisão"],
  ];
  return (
    <section aria-labelledby="stats">
      <h2 id="stats" className="sr-only">
        Números agregados
      </h2>
      <dl className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {items.map(([k, l]) => (
          <div key={k} className="rounded-xl border bg-surface p-4">
            <dt className="text-sm text-muted-foreground">{l}</dt>
            <dd className="text-2xl font-bold">{q.data[k] ?? 0}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Config() {
  const s = useSettings();
  const qc = useQueryClient();
  const [price, setPrice] = useState("");
  const [days, setDays] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => {
    if (s.data) {
      setPrice(s.data.priceLabel);
      setDays(String(s.data.validityDays));
    }
  }, [s.data]);
  async function save() {
    const d = Number(days);
    if (!Number.isInteger(d) || d < 1 || d > 3650)
      return setMsg("Validade deve ser um número de dias entre 1 e 3650.");
    const r1 = await supabase
      .from("app_settings")
      .update({ value: price.trim().slice(0, 60) || "A definir" })
      .eq("key", "premium_price_label");
    const r2 = await supabase
      .from("app_settings")
      .update({ value: d })
      .eq("key", "curation_validity_days");
    setMsg(r1.error || r2.error ? friendlyError(r1.error ?? r2.error) : "Configurações salvas.");
    qc.invalidateQueries({ queryKey: ["app-settings"] });
  }
  return (
    <div className="max-w-xl space-y-4">
      <LiveRegion message={msg} />
      <TextField
        id="cfg-price"
        label="Rótulo de preço do Premium"
        hint="Apenas texto exibido. Não há cobrança."
        value={price}
        onChange={(e) => setPrice(e.target.value)}
      />
      <TextField
        id="cfg-days"
        label="Validade da curadoria (dias)"
        hint="Após esse prazo, a bula mostra aviso de conferência vencida."
        type="number"
        value={days}
        onChange={(e) => setDays(e.target.value)}
      />
      <Notice tone="info" title="Canal externo de lembretes: não configurado." />
      <Button onClick={save}>Salvar</Button>
    </div>
  );
}

function Audit() {
  const q = useQuery({
    queryKey: ["admin-audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_events")
        .select("id,action,target_table,created_at,details")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
  if (q.isLoading) return <Loading />;
  if (!q.data?.length) return <p>Nenhum evento registrado.</p>;
  return (
    <ul className="space-y-2">
      {q.data.map((a) => (
        <li key={a.id} className="rounded-lg border p-3">
          {formatDateTime(a.created_at)} — {a.action} ({a.target_table})
        </li>
      ))}
    </ul>
  );
}
