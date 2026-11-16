import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, friendlyError } from "@/lib/auth";
import { useMyMedications, useMyCategories, medName } from "@/lib/mydata";
import { USAGE_LABEL, formatDate } from "@/lib/medical";
import {
  PageHeader,
  EmptyState,
  Loading,
  Notice,
  LiveRegion,
  TextField,
} from "@/components/common";
import { nativeSelect } from "@/components/SearchPanel";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/app/minha-biblioteca")({
  head: () => ({
    meta: [
      { title: "Minha biblioteca — Bula Acessível" },
      { name: "description", content: "Suas bulas consultadas e salvas." },
      { property: "og:title", content: "Minha biblioteca — Bula Acessível" },
      { property: "og:description", content: "Biblioteca pessoal de bulas." },
    ],
  }),
  component: Library,
});

function Library() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const meds = useMyMedications();
  const cats = useMyCategories();
  const [status, setStatus] = useState("all");
  const [cat, setCat] = useState("all");
  const [newCat, setNewCat] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const list = (meds.data ?? []).filter(
    (m) =>
      (status === "all" || (status === "saved" ? m.is_saved : m.usage_state === status)) &&
      (cat === "all" || m.cats.some((c) => c.category_id === cat)),
  );

  async function addCat(e: FormEvent) {
    e.preventDefault();
    const name = newCat.trim();
    if (!name) return setErr("Informe o nome da categoria.");
    const { error } = await supabase
      .from("categories")
      .insert({ user_id: user!.id, name: name.slice(0, 60) });
    if (error) return setErr(friendlyError(error));
    setErr("");
    setNewCat("");
    setMsg(`Categoria ${name} criada.`);
    qc.invalidateQueries({ queryKey: ["my-cats"] });
  }
  async function delCat(id: string, name: string) {
    await supabase.from("categories").delete().eq("id", id);
    setMsg(`Categoria ${name} removida.`);
    qc.invalidateQueries();
  }
  async function remove(id: string, name: string) {
    const { error } = await supabase.from("user_medications").delete().eq("id", id);
    if (error) return setMsg(friendlyError(error));
    setMsg(`${name} removido da biblioteca.`);
    qc.invalidateQueries();
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Minha biblioteca"
        description="Você organiza seus próprios registros. Categorias pessoais não são orientação clínica."
      />
      <LiveRegion message={msg} />
      <section
        aria-labelledby="filtros"
        className="grid gap-4 rounded-xl border bg-surface p-5 md:grid-cols-2"
      >
        <h2 id="filtros" className="sr-only">
          Filtros
        </h2>
        <div className="space-y-1.5">
          <Label htmlFor="f-status" className="text-base">
            Situação
          </Label>
          <select
            id="f-status"
            className={nativeSelect}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">Todas</option>
            <option value="saved">Salvos</option>
            <option value="none">Somente consultado</option>
            <option value="taking">Em uso</option>
            <option value="stopped">Uso encerrado</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="f-cat" className="text-base">
            Categoria
          </Label>
          <select
            id="f-cat"
            className={nativeSelect}
            value={cat}
            onChange={(e) => setCat(e.target.value)}
          >
            <option value="all">Todas</option>
            {cats.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section aria-labelledby="lista">
        <h2 id="lista" className="text-2xl font-semibold">
          Registros ({list.length})
        </h2>
        {meds.isLoading ? (
          <Loading />
        ) : meds.error ? (
          <Notice tone="error" title="Erro ao carregar a biblioteca." />
        ) : list.length === 0 ? (
          <EmptyState title="Nada por aqui.">
            Pesquise um medicamento e abra a bula para começar.{" "}
            <Link to="/buscar" className="font-semibold text-primary underline">
              Pesquisar
            </Link>
          </EmptyState>
        ) : (
          <ul className="mt-4 space-y-3">
            {list.map((m) => (
              <li key={m.id} className="rounded-xl border bg-card p-5">
                <h3 className="text-xl font-semibold">{medName(m)}</h3>
                <p>
                  Situação: <strong>{USAGE_LABEL[m.usage_state]}</strong>
                  {m.is_saved ? " · Salvo" : ""}
                </p>
                <p className="text-sm text-muted-foreground">
                  Primeira consulta: {formatDate(m.first_accessed_at)} · Última:{" "}
                  {formatDate(m.last_accessed_at)}
                </p>
                {m.medicine?.therapeutic_group && m.medicine.therapeutic_group_verified && (
                  <p className="text-sm">
                    Grupo terapêutico (verificado): {m.medicine.therapeutic_group}
                  </p>
                )}
                {m.cats.length > 0 && (
                  <p className="text-sm">
                    Categorias:{" "}
                    {m.cats
                      .map((c) => cats.data?.find((x) => x.id === c.category_id)?.name)
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Link
                    to="/medicamentos/$id/bula"
                    params={{ id: m.medicine_id }}
                    className="inline-flex min-h-11 items-center font-semibold text-primary underline"
                  >
                    Abrir bula<span className="sr-only"> de {medName(m)}</span>
                  </Link>
                  <Link
                    to="/app/medicamentos/$id"
                    params={{ id: m.id }}
                    className="inline-flex min-h-11 items-center font-semibold text-primary underline"
                  >
                    Detalhes e histórico<span className="sr-only"> de {medName(m)}</span>
                  </Link>
                  <ConfirmButton
                    variant="outline"
                    title={`Remover ${medName(m)}?`}
                    confirmLabel="Remover"
                    description={
                      <p>
                        O registro, histórico, lembretes e check-ins ligados a ele serão apagados.
                      </p>
                    }
                    onConfirm={() => remove(m.id, medName(m))}
                  >
                    Remover<span className="sr-only"> {medName(m)}</span>
                  </ConfirmButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="cats" className="space-y-4">
        <h2 id="cats" className="text-2xl font-semibold">
          Minhas categorias
        </h2>
        <p className="text-muted-foreground">
          Exemplos: “Meus favoritos”, “Uso contínuo”. Elas só organizam a sua lista.
        </p>
        <form onSubmit={addCat} className="flex flex-wrap items-end gap-3" noValidate>
          <TextField
            id="nova-cat"
            label="Nova categoria"
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            maxLength={60}
            error={err}
            className="min-w-64 flex-1"
          />
          <Button type="submit">Criar categoria</Button>
        </form>
        {cats.data?.length ? (
          <ul className="space-y-2">
            {cats.data.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <span>{c.name}</span>
                <Button variant="ghost" onClick={() => delCat(c.id, c.name)}>
                  Excluir<span className="sr-only"> categoria {c.name}</span>
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Nenhuma categoria criada." />
        )}
      </section>
    </div>
  );
}
