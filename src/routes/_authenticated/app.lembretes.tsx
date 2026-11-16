import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, friendlyError } from "@/lib/auth";
import { useMyMedications, medName } from "@/lib/mydata";
import { WEEKDAYS, TZ, isValidTime, nextOccurrences } from "@/lib/reminders";
import {
  PageHeader,
  Notice,
  Loading,
  EmptyState,
  ErrorSummary,
  LiveRegion,
  TextField,
  MedicalDisclaimer,
} from "@/components/common";
import { PremiumGate } from "@/components/PremiumGate";
import { ConfirmButton } from "@/components/ConfirmButton";
import { nativeSelect } from "@/components/SearchPanel";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/app/lembretes")({
  head: () => ({
    meta: [
      { title: "Lembretes — Bula Acessível" },
      { name: "description", content: "Lembretes com horários definidos por você." },
      { property: "og:title", content: "Lembretes — Bula Acessível" },
      { property: "og:description", content: "Organização de lembretes." },
    ],
  }),
  component: () => (
    <div className="space-y-6">
      <PageHeader
        title="Lembretes"
        description="Use os horários que constam na prescrição que você recebeu. O aplicativo não sugere horários nem doses."
      />
      <Notice tone="warning" title="Alertas externos ainda não estão disponíveis.">
        Os lembretes ficam salvos e aparecem no seu painel. Envio por email ou notificação estará
        disponível após a configuração do canal de envio — por enquanto nada é enviado para fora do
        aplicativo.
      </Notice>
      <PremiumGate>
        <Reminders />
      </PremiumGate>
      <MedicalDisclaimer />
    </div>
  ),
});

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());

function Reminders() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const meds = useMyMedications();
  const list = useQuery({
    queryKey: ["reminders-all", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reminder_schedules")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
  const [f, setF] = useState({
    med: "",
    label: "",
    times: [""],
    days: [] as number[],
    start: today(),
    end: "",
  });
  const [errors, setErrors] = useState<{ id: string; msg: string }[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: { id: string; msg: string }[] = [];
    if (!f.med) errs.push({ id: "r-med", msg: "Escolha o medicamento." });
    f.times.forEach((t, i) => {
      if (!isValidTime(t))
        errs.push({ id: `r-time-${i}`, msg: `Informe o horário ${i + 1} no formato HH:MM.` });
    });
    if (!f.days.length) errs.push({ id: "r-day-0", msg: "Escolha pelo menos um dia da semana." });
    if (!f.start) errs.push({ id: "r-start", msg: "Informe a data de início." });
    if (f.end && f.end < f.start)
      errs.push({ id: "r-end", msg: "A data de término deve ser depois do início." });
    setErrors(errs);
    if (errs.length) return;
    setBusy(true);
    const { error } = await supabase.from("reminder_schedules").insert({
      user_id: user!.id,
      user_medication_id: f.med,
      label: f.label.trim() || null,
      local_times: [...new Set(f.times)].sort(),
      weekdays: [...f.days].sort(),
      start_date: f.start,
      end_date: f.end || null,
      timezone: TZ,
      delivery_channel: "in_app",
    });
    setBusy(false);
    if (error) return setErrors([{ id: "r-med", msg: friendlyError(error) }]);
    setMsg("Lembrete salvo.");
    setF({ ...f, label: "", times: [""], days: [] });
    qc.invalidateQueries({ queryKey: ["reminders-all"] });
    qc.invalidateQueries({ queryKey: ["reminders"] });
  }
  async function toggle(id: string, active: boolean) {
    const { error } = await supabase.from("reminder_schedules").update({ active }).eq("id", id);
    setMsg(error ? friendlyError(error) : active ? "Lembrete reativado." : "Lembrete pausado.");
    qc.invalidateQueries();
  }
  async function remove(id: string) {
    const { error } = await supabase.from("reminder_schedules").delete().eq("id", id);
    setMsg(error ? friendlyError(error) : "Lembrete excluído.");
    qc.invalidateQueries();
  }
  const err = (id: string) => errors.find((x) => x.id === id)?.msg;
  const nameOf = (umId: string) => {
    const m = meds.data?.find((x) => x.id === umId);
    return m ? medName(m) : "Medicamento";
  };
  const available = meds.data?.filter((m) => m.usage_state === "taking" || m.is_saved) ?? [];

  return (
    <div className="space-y-8">
      <LiveRegion message={msg} />
      <section aria-labelledby="novo" className="rounded-xl border p-5">
        <h2 id="novo" className="text-2xl font-semibold">
          Novo lembrete
        </h2>
        {meds.isLoading ? (
          <Loading />
        ) : !available.length ? (
          <EmptyState title="Nenhum medicamento salvo ou em uso.">
            Abra uma bula e salve na biblioteca primeiro.{" "}
            <Link to="/buscar" className="text-primary underline">
              Pesquisar
            </Link>
          </EmptyState>
        ) : (
          <form onSubmit={submit} noValidate className="mt-4 space-y-5">
            <ErrorSummary errors={errors} />
            <div className="space-y-1.5">
              <Label htmlFor="r-med" className="text-base">
                Medicamento *
              </Label>
              <select
                id="r-med"
                className={nativeSelect}
                value={f.med}
                onChange={(e) => setF({ ...f, med: e.target.value })}
                aria-invalid={!!err("r-med") || undefined}
              >
                <option value="">Selecione…</option>
                {available.map((m) => (
                  <option key={m.id} value={m.id}>
                    {medName(m)}
                  </option>
                ))}
              </select>
            </div>
            <TextField
              id="r-label"
              label="Descrição pessoal (opcional)"
              hint="Ex.: “conforme receita do Dr. Silva”. Não informe dados de terceiros."
              value={f.label}
              onChange={(e) => setF({ ...f, label: e.target.value })}
              maxLength={120}
            />
            <fieldset className="space-y-3">
              <legend className="font-semibold">Horários (fuso de Brasília) *</legend>
              {f.times.map((t, i) => (
                <div key={i} className="flex flex-wrap items-end gap-2">
                  <TextField
                    id={`r-time-${i}`}
                    label={`Horário ${i + 1}`}
                    type="time"
                    value={t}
                    error={err(`r-time-${i}`)}
                    onChange={(e) => {
                      const times = [...f.times];
                      times[i] = e.target.value;
                      setF({ ...f, times });
                    }}
                  />
                  {f.times.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setF({ ...f, times: f.times.filter((_, j) => j !== i) })}
                    >
                      <Trash2 aria-hidden="true" /> Remover horário {i + 1}
                    </Button>
                  )}
                </div>
              ))}
              {f.times.length < 12 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setF({ ...f, times: [...f.times, ""] })}
                >
                  <Plus aria-hidden="true" /> Adicionar horário
                </Button>
              )}
            </fieldset>
            <fieldset>
              <legend className="font-semibold">Dias da semana *</legend>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {WEEKDAYS.map((d, i) => (
                  <div key={d} className="flex min-h-11 items-center gap-2">
                    <input
                      id={`r-day-${i}`}
                      type="checkbox"
                      className="size-6"
                      checked={f.days.includes(i)}
                      onChange={(e) =>
                        setF({
                          ...f,
                          days: e.target.checked ? [...f.days, i] : f.days.filter((x) => x !== i),
                        })
                      }
                    />
                    <label htmlFor={`r-day-${i}`}>{d}</label>
                  </div>
                ))}
              </div>
              {err("r-day-0") && (
                <p className="text-sm font-medium text-destructive">Erro: {err("r-day-0")}</p>
              )}
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id="r-start"
                label="Início *"
                type="date"
                value={f.start}
                onChange={(e) => setF({ ...f, start: e.target.value })}
                error={err("r-start")}
              />
              <TextField
                id="r-end"
                label="Término (opcional)"
                type="date"
                value={f.end}
                onChange={(e) => setF({ ...f, end: e.target.value })}
                error={err("r-end")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-ch" className="text-base">
                Canal
              </Label>
              <select
                id="r-ch"
                className={nativeSelect}
                value="in_app"
                disabled
                aria-describedby="r-ch-h"
              >
                <option value="in_app">Somente no aplicativo</option>
              </select>
              <p id="r-ch-h" className="text-sm text-muted-foreground">
                Email: disponível após configuração do canal de envio (pendente).
              </p>
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? "Salvando…" : "Salvar lembrete"}
            </Button>
          </form>
        )}
      </section>

      <section aria-labelledby="meus">
        <h2 id="meus" className="text-2xl font-semibold">
          Meus lembretes
        </h2>
        {list.isLoading ? (
          <Loading />
        ) : !list.data?.length ? (
          <EmptyState title="Nenhum lembrete cadastrado." />
        ) : (
          <ul className="mt-3 space-y-3">
            {list.data.map((r) => {
              const next = nextOccurrences(r, new Date(), 7).slice(0, 3);
              return (
                <li key={r.id} className="rounded-xl border p-4">
                  <h3 className="text-lg font-semibold">
                    {nameOf(r.user_medication_id)}
                    {r.label ? ` — ${r.label}` : ""}
                  </h3>
                  <p>
                    {r.active ? "Ativo" : "Pausado"} · Horários: {r.local_times.join(", ")} · Dias:{" "}
                    {r.weekdays.map((d) => WEEKDAYS[d]).join(", ")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    De {r.start_date.split("-").reverse().join("/")}
                    {r.end_date
                      ? ` até ${r.end_date.split("-").reverse().join("/")}`
                      : ", sem término"}{" "}
                    · Canal: somente no aplicativo
                  </p>
                  {next.length > 0 && (
                    <p className="text-sm">
                      Próximas ocorrências:{" "}
                      {next
                        .map(
                          (o) =>
                            `${WEEKDAYS[o.weekday]} ${o.date.slice(8)}/${o.date.slice(5, 7)} às ${o.time}`,
                        )
                        .join("; ")}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => toggle(r.id, !r.active)}>
                      {r.active ? "Pausar" : "Reativar"}
                      <span className="sr-only"> lembrete de {nameOf(r.user_medication_id)}</span>
                    </Button>
                    <ConfirmButton
                      title="Excluir lembrete?"
                      confirmLabel="Excluir"
                      description={<p>Esta ação não pode ser desfeita.</p>}
                      onConfirm={() => remove(r.id)}
                    >
                      Excluir
                      <span className="sr-only"> lembrete de {nameOf(r.user_medication_id)}</span>
                    </ConfirmButton>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
