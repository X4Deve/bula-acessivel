import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError, useAuth } from "@/lib/auth";
import { isOfficialAnvisaUrl, SOURCE_TYPE_LABEL } from "@/lib/medical";
import { Loading, EmptyState, LiveRegion, TextField, ErrorSummary } from "@/components/common";
import { nativeSelect } from "@/components/SearchPanel";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AdminLeaflets } from "./AdminLeaflets";

export const sourceSchema = z
  .object({
    source_type: z.enum(["anvisa_bulario", "fabricante", "fornecedor_autorizado"]),
    source_url: z
      .string()
      .trim()
      .url("Link inválido")
      .startsWith("https://", "O link precisa começar com https://"),
  })
  .refine((v) => v.source_type !== "anvisa_bulario" || isOfficialAnvisaUrl(v.source_url), {
    message:
      "Links rotulados como Anvisa precisam ser de consultas.anvisa.gov.br, anvisa.gov.br ou gov.br/anvisa.",
    path: ["source_url"],
  });

const empty = {
  brand_name: "",
  active_ingredient: "",
  manufacturer: "",
  strength: "",
  formulation: "",
  presentation: "",
  registration_code: "",
  source_url: "",
  source_type: "anvisa_bulario" as const,
};

export function AdminCatalog() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [f, setF] = useState<
    typeof empty | (Omit<typeof empty, "source_type"> & { source_type: string })
  >(empty);
  const [errors, setErrors] = useState<{ id: string; msg: string }[]>([]);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ["admin-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medicine_catalog")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: { id: string; msg: string }[] = [];
    if (!f.brand_name.trim()) errs.push({ id: "m-brand", msg: "Informe o nome comercial." });
    const s = sourceSchema.safeParse(f);
    if (!s.success) s.error.issues.forEach((i) => errs.push({ id: "m-url", msg: i.message }));
    setErrors(errs);
    if (errs.length) return;
    const n = (v: string) => v.trim() || null;
    const { error } = await supabase.from("medicine_catalog").insert({
      brand_name: f.brand_name.trim(),
      active_ingredient: n(f.active_ingredient),
      manufacturer: n(f.manufacturer),
      strength: n(f.strength),
      formulation: n(f.formulation),
      presentation: n(f.presentation),
      registration_code: n(f.registration_code),
      source_url: f.source_url.trim(),
      source_type: f.source_type as typeof empty.source_type,
      status: "draft",
      created_by: user!.id,
    });
    if (error) return setErrors([{ id: "m-brand", msg: friendlyError(error) }]);
    setF(empty);
    setMsg("Medicamento criado como rascunho. Cadastre a bula para revisão.");
    qc.invalidateQueries({ queryKey: ["admin-catalog"] });
  }
  const set =
    (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setF({ ...f, [k]: e.target.value });
  const err = (id: string) => errors.find((x) => x.id === id)?.msg;

  return (
    <div className="space-y-8">
      <LiveRegion message={msg} />
      <form onSubmit={submit} noValidate className="space-y-4 rounded-xl border p-5">
        <h3 className="text-xl font-semibold">Novo medicamento (rascunho)</h3>
        <p className="text-sm text-muted-foreground">
          Copie os dados exatamente do documento oficial. Não preencha campos desconhecidos.
        </p>
        <ErrorSummary errors={errors} />
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            id="m-brand"
            label="Nome comercial"
            required
            value={f.brand_name}
            onChange={set("brand_name")}
            error={err("m-brand")}
          />
          <TextField
            id="m-ing"
            label="Princípio ativo"
            value={f.active_ingredient}
            onChange={set("active_ingredient")}
          />
          <TextField
            id="m-man"
            label="Fabricante"
            value={f.manufacturer}
            onChange={set("manufacturer")}
          />
          <TextField
            id="m-str"
            label="Concentração"
            value={f.strength}
            onChange={set("strength")}
          />
          <TextField
            id="m-form"
            label="Forma farmacêutica"
            value={f.formulation}
            onChange={set("formulation")}
          />
          <TextField
            id="m-pres"
            label="Apresentação"
            value={f.presentation}
            onChange={set("presentation")}
          />
          <TextField
            id="m-reg"
            label="Número de registro (se conhecido)"
            value={f.registration_code}
            onChange={set("registration_code")}
          />
          <div className="space-y-1.5">
            <Label htmlFor="m-type" className="text-base">
              Tipo de fonte
            </Label>
            <select
              id="m-type"
              className={nativeSelect}
              value={f.source_type}
              onChange={set("source_type")}
            >
              {Object.entries(SOURCE_TYPE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <TextField
            id="m-url"
            label="Link oficial da fonte"
            type="url"
            required
            value={f.source_url}
            onChange={set("source_url")}
            error={err("m-url")}
            className="md:col-span-2"
          />
        </div>
        <Button type="submit">Criar rascunho</Button>
      </form>

      <section aria-labelledby="cat-list">
        <h3 id="cat-list" className="text-xl font-semibold">
          Catálogo
        </h3>
        {list.isLoading ? (
          <Loading />
        ) : !list.data?.length ? (
          <EmptyState title="Catálogo vazio. Nenhuma bula foi cadastrada ainda." />
        ) : (
          <ul className="mt-3 space-y-3">
            {list.data.map((m) => (
              <li key={m.id} className="rounded-xl border p-4">
                <h4 className="text-lg font-semibold">
                  {m.brand_name} {m.strength ?? ""}
                </h4>
                <p className="text-sm">
                  Status:{" "}
                  <strong>
                    {m.status === "published"
                      ? "Publicado"
                      : m.status === "draft"
                        ? "Rascunho"
                        : "Arquivado"}
                  </strong>{" "}
                  · {SOURCE_TYPE_LABEL[m.source_type]}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    aria-expanded={open === m.id}
                    onClick={() => setOpen(open === m.id ? null : m.id)}
                  >
                    {open === m.id ? "Fechar bulas" : "Gerenciar bulas"}
                    <span className="sr-only"> de {m.brand_name}</span>
                  </Button>
                  {m.status !== "archived" && (
                    <Button
                      variant="ghost"
                      onClick={async () => {
                        const { error } = await supabase.rpc("archive_medicine", { _id: m.id });
                        setMsg(error ? friendlyError(error) : "Arquivado.");
                        qc.invalidateQueries();
                      }}
                    >
                      Arquivar<span className="sr-only"> {m.brand_name}</span>
                    </Button>
                  )}
                </div>
                {open === m.id && <AdminLeaflets medicine={m} />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
