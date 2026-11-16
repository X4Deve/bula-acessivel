import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useProfile, friendlyError } from "@/lib/auth";
import { useMyMedications, medName } from "@/lib/mydata";
import { CHECKIN_SAFETY_MESSAGE, formatDateTime } from "@/lib/medical";
import { PageHeader, Notice, Loading, EmptyState, LiveRegion } from "@/components/common";
import { PremiumGate } from "@/components/PremiumGate";
import { nativeSelect } from "@/components/SearchPanel";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/app/acompanhamento")({
  head: () => ({
    meta: [
      { title: "Acompanhamento — Bula Acessível" },
      {
        name: "description",
        content: "Check-in pessoal e opcional sobre como você está se sentindo.",
      },
      { property: "og:title", content: "Acompanhamento — Bula Acessível" },
      { property: "og:description", content: "Check-in pessoal opcional." },
    ],
  }),
  component: () => (
    <div className="space-y-6">
      <PageHeader
        title="Acompanhamento"
        description="Registro pessoal e opcional. O aplicativo não avalia se o tratamento funciona."
      />
      <Notice tone="info" title={CHECKIN_SAFETY_MESSAGE} />
      <PremiumGate>
        <Checkins />
      </PremiumGate>
    </div>
  ),
});

const MOODS = [
  { v: "melhor", l: "Melhor" },
  { v: "igual", l: "Igual" },
  { v: "pior", l: "Pior" },
  { v: "prefiro_nao_responder", l: "Prefiro não responder" },
] as const;
type Mood = (typeof MOODS)[number]["v"];

function Checkins() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const profile = useProfile();
  const meds = useMyMedications();
  const [consent, setConsent] = useState(false);
  const [med, setMed] = useState("");
  const [mood, setMood] = useState<Mood | "">("");
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const hist = useQuery({
    queryKey: ["checkins", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("symptom_checkins")
        .select("id,mood,notes,created_at,user_medication_id")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (profile.isLoading) return <Loading />;
  if (!profile.data?.health_tracking_consent) {
    return (
      <form
        className="space-y-4 rounded-xl border p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!consent) return setErr("Marque a caixa para consentir, ou deixe para depois.");
          const { error } = await supabase
            .from("profiles")
            .update({
              health_tracking_consent: true,
              health_tracking_consent_at: new Date().toISOString(),
            })
            .eq("id", user!.id);
          if (error) return setErr(friendlyError(error));
          qc.invalidateQueries({ queryKey: ["profile"] });
        }}
      >
        <h2 className="text-2xl font-semibold">Consentimento para acompanhamento</h2>
        <p>
          Os check-ins são dados pessoais sensíveis de saúde. Ficam visíveis só para você e podem
          ser apagados a qualquer momento em Configurações.
        </p>
        <div className="flex items-start gap-3">
          <input
            id="consent"
            type="checkbox"
            className="mt-1 size-6"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            aria-describedby={err ? "consent-err" : undefined}
          />
          <label htmlFor="consent">
            Concordo em registrar check-ins sobre como me sinto, para meu uso pessoal.
          </label>
        </div>
        {err && (
          <p id="consent-err" className="font-medium text-destructive">
            Erro: {err}
          </p>
        )}
        <Button type="submit">Ativar acompanhamento</Button>
      </form>
    );
  }

  const taking = meds.data?.filter((m) => m.usage_state === "taking") ?? [];
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!med) return setErr("Escolha o medicamento.");
    if (!mood) return setErr("Escolha uma resposta.");
    const { error } = await supabase
      .from("symptom_checkins")
      .insert({ user_id: user!.id, user_medication_id: med, mood, notes: notes.trim() || null });
    if (error) return setErr(friendlyError(error));
    setErr("");
    setMood("");
    setNotes("");
    setMsg("Check-in registrado. " + CHECKIN_SAFETY_MESSAGE);
    qc.invalidateQueries({ queryKey: ["checkins"] });
  }
  const nameOf = (id: string) => {
    const m = meds.data?.find((x) => x.id === id);
    return m ? medName(m) : "Medicamento";
  };

  return (
    <div className="space-y-8">
      <LiveRegion message={msg} />
      {!taking.length ? (
        <EmptyState title="Nenhum medicamento marcado como em uso.">
          Marque um medicamento como “Estou tomando” na{" "}
          <Link to="/app/minha-biblioteca" className="text-primary underline">
            biblioteca
          </Link>
          .
        </EmptyState>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-5 rounded-xl border p-5">
          <h2 className="text-2xl font-semibold">Novo check-in</h2>
          {err && <Notice tone="error" title={err} live="assertive" />}
          <div className="space-y-1.5">
            <Label htmlFor="c-med" className="text-base">
              Medicamento
            </Label>
            <select
              id="c-med"
              className={nativeSelect}
              value={med}
              onChange={(e) => setMed(e.target.value)}
            >
              <option value="">Selecione…</option>
              {taking.map((m) => (
                <option key={m.id} value={m.id}>
                  {medName(m)}
                </option>
              ))}
            </select>
          </div>
          <fieldset>
            <legend className="font-semibold">Como você está se sentindo com o uso?</legend>
            <div className="mt-2 space-y-1">
              {MOODS.map((o) => (
                <div key={o.v} className="flex min-h-11 items-center gap-3">
                  <input
                    type="radio"
                    id={`m-${o.v}`}
                    name="mood"
                    value={o.v}
                    className="size-6"
                    checked={mood === o.v}
                    onChange={() => setMood(o.v)}
                  />
                  <label htmlFor={`m-${o.v}`}>{o.l}</label>
                </div>
              ))}
            </div>
          </fieldset>
          <div className="space-y-1.5">
            <Label htmlFor="c-notes" className="text-base">
              Observações (opcional)
            </Label>
            <Textarea
              id="c-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
              className="min-h-24 text-base"
            />
          </div>
          <Button type="submit">Registrar check-in</Button>
        </form>
      )}
      <section aria-labelledby="hist">
        <h2 id="hist" className="text-2xl font-semibold">
          Histórico
        </h2>
        {hist.isLoading ? (
          <Loading />
        ) : !hist.data?.length ? (
          <EmptyState title="Nenhum check-in registrado." />
        ) : (
          <ul className="mt-3 space-y-2">
            {hist.data.map((c) => (
              <li key={c.id} className="rounded-lg border p-3">
                <p>
                  <strong>{formatDateTime(c.created_at)}</strong> — {nameOf(c.user_medication_id)}:{" "}
                  {MOODS.find((m) => m.v === c.mood)?.l}
                </p>
                {c.notes && <p className="text-sm">{c.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
