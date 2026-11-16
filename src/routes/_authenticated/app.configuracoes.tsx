import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { useAuth, useProfile, friendlyError, signOutClean } from "@/lib/auth";
import { usePrefs, sanitizePrefs } from "@/lib/prefs";
import { deleteMyAccount } from "@/lib/account.functions";
import { PageHeader, Card, LiveRegion, TextField } from "@/components/common";
import { ConfirmButton } from "@/components/ConfirmButton";
import { nativeSelect } from "@/components/SearchPanel";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/app/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Bula Acessível" },
      { name: "description", content: "Acessibilidade, consentimentos e seus dados." },
      { property: "og:title", content: "Configurações — Bula Acessível" },
      { property: "og:description", content: "Preferências e privacidade." },
    ],
  }),
  component: Settings,
});

function Settings() {
  const { user } = useAuth();
  const profile = useProfile();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { prefs, setPrefs } = usePrefs();
  const delAccount = useServerFn(deleteMyAccount);
  const [msg, setMsg] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    if (!profile.data) return;
    setName(profile.data.display_name);
    const remote = profile.data.preferences as Record<string, unknown>;
    if (remote && Object.keys(remote).length) setPrefs(sanitizePrefs(remote));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.data?.id]);

  async function saveProfile(patch: TablesUpdate<"profiles">, ok: string) {
    const { error } = await supabase.from("profiles").update(patch).eq("id", user!.id);
    setMsg(error ? friendlyError(error) : ok);
    qc.invalidateQueries({ queryKey: ["profile"] });
  }
  async function exportData() {
    const tables = [
      "profiles",
      "user_medications",
      "user_medication_history",
      "categories",
      "user_medication_categories",
      "search_history",
      "subscription_requests",
      "subscription_entitlements",
      "reminder_schedules",
      "notification_events",
      "symptom_checkins",
    ] as const;
    const out: Record<string, unknown> = {
      exportado_em: new Date().toISOString(),
      email: user?.email,
    };
    for (const t of tables) {
      const { data } = await supabase.from(t).select("*");
      out[t] = data ?? [];
    }
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "meus-dados-bula-acessivel.json";
    a.click();
    setMsg("Arquivo de exportação gerado.");
  }

  const p = profile.data;
  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" />
      <LiveRegion message={msg} />
      <Card aria-labelledby="ac">
        <h2 id="ac" className="text-xl font-semibold">
          Acessibilidade
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="p-font" className="text-base">
              Tamanho da fonte
            </Label>
            <select
              id="p-font"
              className={nativeSelect}
              value={prefs.font}
              onChange={(e) => setPrefs({ font: e.target.value as typeof prefs.font })}
            >
              <option value="base">Normal (100%)</option>
              <option value="lg">Grande (112%)</option>
              <option value="xl">Maior (125%)</option>
              <option value="xxl">Muito grande (150%)</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-con" className="text-base">
              Contraste
            </Label>
            <select
              id="p-con"
              className={nativeSelect}
              value={prefs.contrast}
              onChange={(e) => setPrefs({ contrast: e.target.value as typeof prefs.contrast })}
            >
              <option value="normal">Normal</option>
              <option value="high">Alto</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-sp" className="text-base">
              Espaçamento
            </Label>
            <select
              id="p-sp"
              className={nativeSelect}
              value={prefs.spacing}
              onChange={(e) => setPrefs({ spacing: e.target.value as typeof prefs.spacing })}
            >
              <option value="normal">Normal</option>
              <option value="wide">Amplo</option>
            </select>
          </div>
        </div>
        <Button
          className="mt-4"
          onClick={() => saveProfile({ preferences: prefs }, "Preferências salvas na sua conta.")}
        >
          Salvar preferências na conta
        </Button>
      </Card>

      <Card aria-labelledby="pf">
        <h2 id="pf" className="text-xl font-semibold">
          Perfil
        </h2>
        <form
          className="mt-3 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            saveProfile({ display_name: name.trim().slice(0, 120) }, "Nome atualizado.");
          }}
        >
          <TextField
            id="p-name"
            label="Nome de exibição"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            className="min-w-64 flex-1"
          />
          <Button type="submit">Salvar nome</Button>
        </form>
      </Card>

      <Card aria-labelledby="cs">
        <h2 id="cs" className="text-xl font-semibold">
          Consentimentos
        </h2>
        <ul className="mt-3 space-y-3">
          <li className="flex items-start gap-3">
            <input
              id="c-hist"
              type="checkbox"
              className="mt-1 size-6"
              checked={!!p?.save_search_history}
              onChange={(e) =>
                saveProfile(
                  { save_search_history: e.target.checked },
                  e.target.checked
                    ? "Histórico de buscas ativado."
                    : "Histórico de buscas desativado.",
                )
              }
            />
            <label htmlFor="c-hist">Guardar meu histórico de buscas (desligado por padrão).</label>
          </li>
          <li className="flex items-start gap-3">
            <input
              id="c-health"
              type="checkbox"
              className="mt-1 size-6"
              checked={!!p?.health_tracking_consent}
              onChange={(e) =>
                saveProfile(
                  {
                    health_tracking_consent: e.target.checked,
                    health_tracking_consent_at: e.target.checked ? new Date().toISOString() : null,
                  },
                  e.target.checked
                    ? "Consentimento de acompanhamento dado."
                    : "Consentimento de acompanhamento retirado. Novos check-ins ficam bloqueados.",
                )
              }
            />
            <label htmlFor="c-health">
              Permitir registrar check-ins de bem-estar (dados de saúde).
            </label>
          </li>
        </ul>
        <p className="mt-2 text-sm text-muted-foreground">
          Termos aceitos: versão {p?.terms_version ?? "—"}.
        </p>
      </Card>

      <Card aria-labelledby="dd">
        <h2 id="dd" className="text-xl font-semibold">
          Meus dados
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportData}>
            Exportar meus dados (JSON)
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              await supabase.from("search_history").delete().eq("user_id", user!.id);
              setMsg("Histórico de buscas apagado.");
            }}
          >
            Apagar histórico de buscas
          </Button>
          <ConfirmButton
            variant="destructive"
            title="Apagar todos os dados pessoais?"
            confirmLabel="Apagar dados"
            description={
              <p>
                Biblioteca, categorias, histórico, lembretes e check-ins serão apagados. A conta e
                os pedidos de assinatura continuam.
              </p>
            }
            onConfirm={async () => {
              const { error } = await supabase.rpc("delete_my_personal_data");
              setMsg(error ? friendlyError(error) : "Dados pessoais apagados.");
              qc.invalidateQueries();
            }}
          >
            Apagar dados pessoais
          </ConfirmButton>
          <ConfirmButton
            variant="destructive"
            title="Excluir minha conta?"
            confirmLabel="Excluir conta definitivamente"
            description={
              <p>Todos os seus dados e a conta serão excluídos. Esta ação não pode ser desfeita.</p>
            }
            onConfirm={async () => {
              try {
                await delAccount();
                await signOutClean(qc);
                navigate({ to: "/", replace: true });
              } catch (e) {
                setMsg(friendlyError(e));
              }
            }}
          >
            Excluir conta
          </ConfirmButton>
        </div>
      </Card>
    </div>
  );
}
