import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsPremium, friendlyError } from "@/lib/auth";
import { useMyCategories, MED_SELECT, medName } from "@/lib/mydata";
import { USAGE_LABEL, formatDate, formatDateTime } from "@/lib/medical";
import {
  Loading,
  Notice,
  LiveRegion,
  Card,
  MedicalDisclaimer,
  EmptyState,
} from "@/components/common";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/medicamentos/$id")({
  head: () => ({
    meta: [
      { title: "Meu registro de medicamento — Bula Acessível" },
      { name: "description", content: "Detalhes do seu registro pessoal." },
      { property: "og:title", content: "Meu registro — Bula Acessível" },
      { property: "og:description", content: "Registro pessoal." },
    ],
  }),
  component: MyMed,
});

function MyMed() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const premium = useIsPremium();
  const cats = useMyCategories();
  const [msg, setMsg] = useState("");
  const rec = useQuery({
    queryKey: ["my-med", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_medications")
        .select(MED_SELECT)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const hist = useQuery({
    queryKey: ["my-med-hist", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_medication_history")
        .select("id,event,created_at")
        .eq("user_medication_id", id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (rec.isLoading) return <Loading />;
  if (!rec.data)
    return (
      <div>
        <h1 className="text-3xl font-bold text-brand">Registro não encontrado</h1>
        <p className="mt-2">Ele pode ter sido removido ou pertencer a outra conta.</p>
        <Link to="/app/minha-biblioteca" className="text-primary underline">
          Voltar à biblioteca
        </Link>
      </div>
    );
  const m = rec.data;

  async function setState(state: "taking" | "stopped", event: string) {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("user_medications")
      .update(
        state === "taking"
          ? { usage_state: state, started_at: now, stopped_at: null }
          : { usage_state: state, stopped_at: now },
      )
      .eq("id", id);
    if (error) return setMsg(friendlyError(error));
    await supabase
      .from("user_medication_history")
      .insert({ user_id: user!.id, user_medication_id: id, event });
    setMsg(`Situação atualizada: ${USAGE_LABEL[state]}.`);
    qc.invalidateQueries();
  }
  async function toggleCat(catId: string, on: boolean, name: string) {
    const { error } = on
      ? await supabase
          .from("user_medication_categories")
          .insert({ user_id: user!.id, user_medication_id: id, category_id: catId })
      : await supabase
          .from("user_medication_categories")
          .delete()
          .eq("user_medication_id", id)
          .eq("category_id", catId);
    if (error) return setMsg(friendlyError(error));
    setMsg(on ? `Adicionado à categoria ${name}.` : `Removido da categoria ${name}.`);
    qc.invalidateQueries();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-brand">{medName(m)}</h1>
      <LiveRegion message={msg} />
      <Card aria-labelledby="sit">
        <h2 id="sit" className="text-xl font-semibold">
          Situação
        </h2>
        <p className="mt-1">
          <strong>{USAGE_LABEL[m.usage_state]}</strong>
          {m.is_saved ? " · Salvo" : ""}
        </p>
        <p className="text-sm text-muted-foreground">
          Primeira consulta: {formatDate(m.first_accessed_at)}
          {m.started_at ? ` · Início do uso: ${formatDate(m.started_at)}` : ""}
          {m.stopped_at ? ` · Fim do uso: ${formatDate(m.stopped_at)}` : ""}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {m.usage_state !== "taking" ? (
            <ConfirmButton
              title="Marcar como “Estou tomando”?"
              confirmLabel="Sim, estou tomando"
              description={<p>Apenas organiza sua biblioteca. Siga a prescrição recebida.</p>}
              onConfirm={() => setState("taking", "Marcado como em uso")}
            >
              Marcar como estou tomando
            </ConfirmButton>
          ) : (
            <ConfirmButton
              title="Registrar que deixou de usar?"
              confirmLabel="Registrar"
              description={
                <p>Mudanças no tratamento devem ser combinadas com um profissional de saúde.</p>
              }
              onConfirm={() => setState("stopped", "Uso encerrado")}
            >
              Deixar de usar
            </ConfirmButton>
          )}
          <Link
            to="/medicamentos/$id/bula"
            params={{ id: m.medicine_id }}
            className="inline-flex min-h-11 items-center px-2 font-semibold text-primary underline"
          >
            Abrir bula acessível
          </Link>
          {m.leaflet_version_id && (
            <Link
              to="/medicamentos/$id/bula"
              params={{ id: m.medicine_id }}
              search={{ versao: m.leaflet_version_id }}
              className="inline-flex min-h-11 items-center px-2 text-primary underline"
            >
              Versão consultada pela primeira vez
            </Link>
          )}
        </div>
      </Card>

      <Card aria-labelledby="cat">
        <fieldset>
          <legend id="cat" className="text-xl font-semibold">
            Categorias
          </legend>
          {cats.data?.length ? (
            <ul className="mt-2 space-y-1">
              {cats.data.map((c) => {
                const on = m.cats.some((x) => x.category_id === c.id);
                return (
                  <li key={c.id} className="flex min-h-11 items-center gap-3">
                    <input
                      id={`c-${c.id}`}
                      type="checkbox"
                      className="size-6"
                      checked={on}
                      onChange={(e) => toggleCat(c.id, e.target.checked, c.name)}
                    />
                    <label htmlFor={`c-${c.id}`}>{c.name}</label>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-2">
              Crie categorias na{" "}
              <Link to="/app/minha-biblioteca" className="text-primary underline">
                biblioteca
              </Link>
              .
            </p>
          )}
        </fieldset>
      </Card>

      <Card aria-labelledby="lemb">
        <h2 id="lemb" className="text-xl font-semibold">
          Lembretes
        </h2>
        {premium.data ? (
          <Link
            to="/app/lembretes"
            className="inline-flex min-h-11 items-center font-semibold text-primary underline"
          >
            Configurar lembretes
          </Link>
        ) : (
          <p className="mt-1">
            Lembretes fazem parte do Premium.{" "}
            <Link to="/planos" className="text-primary underline">
              Ver planos
            </Link>
            .
          </p>
        )}
      </Card>

      <Card aria-labelledby="hist">
        <h2 id="hist" className="text-xl font-semibold">
          Histórico
        </h2>
        {hist.data?.length ? (
          <ol className="mt-2 space-y-1">
            {hist.data.map((h) => (
              <li key={h.id}>
                {formatDateTime(h.created_at)} — {h.event}
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState title="Sem eventos registrados." />
        )}
      </Card>
      <MedicalDisclaimer />
    </div>
  );
}
