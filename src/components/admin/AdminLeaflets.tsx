import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError, useAuth } from "@/lib/auth";
import { LEAFLET_SECTIONS, SOURCE_TYPE_LABEL, formatDate, parseSections } from "@/lib/medical";
import { Loading, LiveRegion, TextField, ErrorSummary, Notice } from "@/components/common";
import { nativeSelect } from "@/components/SearchPanel";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { sourceSchema } from "./AdminCatalog";

const ST: Record<string, string> = {
  draft: "Rascunho",
  in_review: "Em revisão",
  published: "Publicada",
  superseded: "Substituída (histórica)",
  rejected: "Rejeitada",
};

export function AdminLeaflets({
  medicine,
}: {
  medicine: { id: string; brand_name: string; source_url: string; source_type: string };
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [msg, setMsg] = useState("");
  const [errors, setErrors] = useState<{ id: string; msg: string }[]>([]);
  const [rejectNote, setRejectNote] = useState("");
  const [f, setF] = useState({
    version_label: "",
    source_url: medicine.source_url,
    source_type: medicine.source_type,
    checked: "",
    full_text: "",
    sections: {} as Record<string, string>,
  });
  const p = `lf-${medicine.id.slice(0, 8)}`;
  const list = useQuery({
    queryKey: ["admin-leaflets", medicine.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leaflet_versions")
        .select("*")
        .eq("medicine_id", medicine.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-leaflets", medicine.id] });
    qc.invalidateQueries({ queryKey: ["admin-catalog"] });
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: { id: string; msg: string }[] = [];
    if (!f.version_label.trim())
      errs.push({ id: `${p}-ver`, msg: "Informe a versão/data da bula conforme o documento." });
    if (!f.checked) errs.push({ id: `${p}-chk`, msg: "Informe a data em que conferiu a fonte." });
    const s = sourceSchema.safeParse(f);
    if (!s.success) s.error.issues.forEach((i) => errs.push({ id: `${p}-url`, msg: i.message }));
    const sections = LEAFLET_SECTIONS.map((x) => ({
      key: x.key,
      title: x.title,
      content: (f.sections[x.key] ?? "").trim(),
    })).filter((x) => x.content);
    if (!sections.length)
      errs.push({
        id: `${p}-s-para_que_serve`,
        msg: "Cole o texto oficial de pelo menos uma seção.",
      });
    setErrors(errs);
    if (errs.length) return;
    const { error } = await supabase.from("leaflet_versions").insert({
      medicine_id: medicine.id,
      version_label: f.version_label.trim(),
      leaflet_kind: "paciente",
      source_url: f.source_url.trim(),
      source_type: f.source_type as "anvisa_bulario",
      source_checked_at: new Date(`${f.checked}T12:00:00-03:00`).toISOString(),
      full_text: f.full_text.trim() || null,
      sections_json: sections,
      status: "in_review",
      created_by: user!.id,
    });
    if (error) return setErrors([{ id: `${p}-ver`, msg: friendlyError(error) }]);
    setMsg("Versão enviada para revisão.");
    setF({ ...f, version_label: "", full_text: "", sections: {} });
    refresh();
  }
  async function publish(id: string) {
    const { error } = await supabase.rpc("publish_leaflet_version", { _id: id });
    setMsg(error ? friendlyError(error) : "Bula publicada.");
    refresh();
  }
  async function reject(id: string) {
    if (!rejectNote.trim()) return setMsg("Informe o motivo da rejeição.");
    const { error } = await supabase.rpc("reject_leaflet_version", { _id: id, _note: rejectNote });
    setMsg(error ? friendlyError(error) : "Versão rejeitada.");
    setRejectNote("");
    refresh();
  }
  const err = (id: string) => errors.find((x) => x.id === id)?.msg;

  return (
    <div className="mt-4 space-y-6 border-t pt-4">
      <LiveRegion message={msg} />
      <h4 className="text-lg font-semibold">Versões da bula de {medicine.brand_name}</h4>
      {list.isLoading ? (
        <Loading />
      ) : !list.data?.length ? (
        <p>Nenhuma versão cadastrada.</p>
      ) : (
        <ul className="space-y-3">
          {list.data.map((l) => (
            <li key={l.id} className="rounded-lg border p-3">
              <p>
                <strong>{l.version_label}</strong> — {ST[l.status]} · Conferida em{" "}
                {formatDate(l.source_checked_at)} · {SOURCE_TYPE_LABEL[l.source_type]}
              </p>
              <p className="text-sm">
                Seções:{" "}
                {parseSections(l.sections_json)
                  .map((s) => s.title)
                  .join(", ") || "nenhuma"}
              </p>
              {l.review_note && <p className="text-sm">Motivo: {l.review_note}</p>}
              {(l.status === "in_review" || l.status === "draft") && (
                <details className="mt-2">
                  <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-primary">
                    Revisar texto completo
                  </summary>
                  <div className="mt-2 space-y-3">
                    {parseSections(l.sections_json).map((s) => (
                      <div key={s.key}>
                        <p className="font-semibold">{s.title}</p>
                        <p className="whitespace-pre-wrap text-sm">{s.content}</p>
                      </div>
                    ))}
                    <Notice
                      tone="warning"
                      title="Antes de publicar, confira linha a linha com o documento oficial."
                    />
                    <div className="flex flex-wrap items-end gap-2">
                      <ConfirmButton
                        variant="default"
                        title="Publicar esta versão?"
                        confirmLabel="Publicar"
                        description={
                          <p>
                            Confirmo que revisei o texto contra o documento oficial em{" "}
                            {l.source_url}. A versão publicada anterior vira histórica.
                          </p>
                        }
                        onConfirm={() => publish(l.id)}
                      >
                        Publicar
                      </ConfirmButton>
                      <div className="space-y-1">
                        <Label htmlFor={`rj-${l.id}`}>Motivo da rejeição</Label>
                        <Textarea
                          id={`rj-${l.id}`}
                          value={rejectNote}
                          onChange={(e) => setRejectNote(e.target.value)}
                          className="min-h-11"
                        />
                      </div>
                      <Button variant="outline" onClick={() => reject(l.id)}>
                        Rejeitar
                      </Button>
                    </div>
                  </div>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} noValidate className="space-y-4 rounded-lg bg-surface p-4">
        <h5 className="text-lg font-semibold">Nova versão (bula do paciente)</h5>
        <Notice tone="info" title="Somente texto copiado de documento oficial.">
          A extração automática de PDF ainda não está disponível. Copie o texto do PDF oficial e
          cole em cada seção. Deixe em branco as seções que não existem no documento. Nunca use IA
          para escrever ou completar.
        </Notice>
        <ErrorSummary errors={errors} />
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            id={`${p}-ver`}
            label="Versão / data da bula (do documento)"
            required
            value={f.version_label}
            onChange={(e) => setF({ ...f, version_label: e.target.value })}
            error={err(`${p}-ver`)}
          />
          <TextField
            id={`${p}-chk`}
            label="Data da conferência com a fonte"
            type="date"
            required
            value={f.checked}
            onChange={(e) => setF({ ...f, checked: e.target.value })}
            error={err(`${p}-chk`)}
          />
          <div className="space-y-1.5">
            <Label htmlFor={`${p}-type`} className="text-base">
              Tipo de fonte
            </Label>
            <select
              id={`${p}-type`}
              className={nativeSelect}
              value={f.source_type}
              onChange={(e) => setF({ ...f, source_type: e.target.value })}
            >
              {Object.entries(SOURCE_TYPE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <TextField
            id={`${p}-url`}
            label="Link do documento original"
            type="url"
            required
            value={f.source_url}
            onChange={(e) => setF({ ...f, source_url: e.target.value })}
            error={err(`${p}-url`)}
          />
        </div>
        {LEAFLET_SECTIONS.map((s) => (
          <div key={s.key} className="space-y-1.5">
            <Label htmlFor={`${p}-s-${s.key}`} className="text-base">
              {s.title}
            </Label>
            <Textarea
              id={`${p}-s-${s.key}`}
              value={f.sections[s.key] ?? ""}
              onChange={(e) => setF({ ...f, sections: { ...f.sections, [s.key]: e.target.value } })}
              className="min-h-28 text-base"
            />
          </div>
        ))}
        <div className="space-y-1.5">
          <Label htmlFor={`${p}-full`} className="text-base">
            Texto integral (opcional, para referência da revisão)
          </Label>
          <Textarea
            id={`${p}-full`}
            value={f.full_text}
            onChange={(e) => setF({ ...f, full_text: e.target.value })}
            className="min-h-28"
          />
        </div>
        <Button type="submit">Enviar para revisão</Button>
      </form>
    </div>
  );
}
