import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsPremium, useProfile } from "@/lib/auth";
import { useMyMedications, medName } from "@/lib/mydata";
import { nextOccurrences, WEEKDAYS } from "@/lib/reminders";
import { formatDate } from "@/lib/medical";
import { Card, EmptyState, Loading, MedicalDisclaimer } from "@/components/common";
import { SearchPanel } from "@/components/SearchPanel";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({
    meta: [
      { title: "Meu painel — Bula Acessível" },
      { name: "description", content: "Seu painel pessoal no Bula Acessível." },
      { property: "og:title", content: "Meu painel — Bula Acessível" },
      { property: "og:description", content: "Painel pessoal." },
    ],
  }),
  component: Dashboard,
});

const linkCls = "inline-flex min-h-11 items-center font-semibold text-primary underline";

function Dashboard() {
  const { user } = useAuth();
  const profile = useProfile();
  const premium = useIsPremium();
  const meds = useMyMedications();
  const reminders = useQuery({
    queryKey: ["reminders", user?.id],
    enabled: !!user && premium.data === true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reminder_schedules")
        .select("*, um:user_medications(medicine:medicine_catalog(brand_name,strength))")
        .eq("active", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const taking = meds.data?.filter((m) => m.usage_state === "taking") ?? [];
  const recent = meds.data?.slice(0, 5) ?? [];
  const saved = meds.data?.filter((m) => m.is_saved) ?? [];
  const upcoming = (reminders.data ?? [])
    .flatMap((r) =>
      nextOccurrences(r, new Date(), 2).map((o) => ({
        ...o,
        name: r.um?.medicine ? `${r.um.medicine.brand_name}` : "",
        label: r.label,
      })),
    )
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .slice(0, 5);

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-brand md:text-4xl">
        Olá{profile.data?.display_name ? `, ${profile.data.display_name}` : ""}!
      </h1>
      <section aria-labelledby="pesq">
        <h2 id="pesq" className="mb-3 text-2xl font-semibold">
          Pesquisar medicamento
        </h2>
        <SearchPanel headingLevel={3} />
      </section>

      {meds.isLoading ? (
        <Loading />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card aria-labelledby="uso">
            <h2 id="uso" className="text-xl font-semibold">
              Em uso atualmente
            </h2>
            <p className="text-sm text-muted-foreground">
              Somente os que você marcou como “Estou tomando”.
            </p>
            {taking.length ? (
              <ul className="mt-3 space-y-1">
                {taking.map((m) => (
                  <li key={m.id}>
                    <Link to="/app/medicamentos/$id" params={{ id: m.id }} className={linkCls}>
                      {medName(m)}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Nenhum medicamento marcado como em uso.">
                Abra uma bula e use “Marcar como estou tomando”, se quiser.
              </EmptyState>
            )}
          </Card>
          <Card aria-labelledby="recentes">
            <h2 id="recentes" className="text-xl font-semibold">
              Consultados recentemente
            </h2>
            {recent.length ? (
              <ul className="mt-3 space-y-1">
                {recent.map((m) => (
                  <li key={m.id}>
                    <Link
                      to="/medicamentos/$id/bula"
                      params={{ id: m.medicine_id }}
                      className={linkCls}
                    >
                      {medName(m)}
                    </Link>{" "}
                    <span className="text-sm text-muted-foreground">
                      — {formatDate(m.last_accessed_at)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Você ainda não consultou bulas com a conta conectada.">
                <Link to="/buscar" className={linkCls}>
                  Pesquisar agora
                </Link>
              </EmptyState>
            )}
          </Card>
          <Card aria-labelledby="salvos">
            <h2 id="salvos" className="text-xl font-semibold">
              Salvos
            </h2>
            <p className="mt-1">{saved.length} bula(s) salva(s).</p>
            <Link to="/app/minha-biblioteca" className={linkCls}>
              Abrir minha biblioteca e categorias
            </Link>
          </Card>
          <Card aria-labelledby="assin">
            <h2 id="assin" className="text-xl font-semibold">
              Assinatura
            </h2>
            <p className="mt-1">
              Plano atual:{" "}
              <strong>
                {premium.data ? "Premium (aprovação administrativa, sem pagamento)" : "Gratuito"}
              </strong>
            </p>
            <Link to="/app/assinatura" className={linkCls}>
              Ver minha assinatura
            </Link>
          </Card>
          {premium.data && (
            <Card aria-labelledby="prox" className="lg:col-span-2">
              <h2 id="prox" className="text-xl font-semibold">
                Próximos lembretes
              </h2>
              <p className="text-sm text-muted-foreground">
                Exibidos apenas aqui no aplicativo. Alertas externos ainda não estão configurados.
              </p>
              {upcoming.length ? (
                <ul className="mt-3 space-y-1">
                  {upcoming.map((o, i) => (
                    <li key={i}>
                      {WEEKDAYS[o.weekday]}, {o.date.split("-").reverse().join("/")} às {o.time} —{" "}
                      {o.name}
                      {o.label ? ` (${o.label})` : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="Nenhum lembrete nos próximos dias.">
                  <Link to="/app/lembretes" className={linkCls}>
                    Configurar lembretes
                  </Link>
                </EmptyState>
              )}
              <div className="mt-2 flex flex-wrap gap-4">
                <Link to="/app/lembretes" className={linkCls}>
                  Lembretes
                </Link>
                <Link to="/app/acompanhamento" className={linkCls}>
                  Acompanhamento
                </Link>
              </div>
            </Card>
          )}
        </div>
      )}
      <MedicalDisclaimer />
    </div>
  );
}
