import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useSettings, friendlyError } from "@/lib/auth";
import {
  BULARIO_URL,
  NOT_AVAILABLE_MESSAGE,
  SOURCE_TYPE_LABEL,
  USAGE_LABEL,
  formatDate,
  isCurationStale,
  isOfficialAnvisaUrl,
  parseSections,
} from "@/lib/medical";
import { Loading, Notice, MedicalDisclaimer, LiveRegion } from "@/components/common";
import { ReadingControls } from "@/components/ReadingControls";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Button } from "@/components/ui/button";

type Search = { versao?: string };

export const Route = createFileRoute("/medicamentos/$id/bula")({
  validateSearch: (s: Record<string, unknown>): Search =>
    typeof s["versao"] === "string" && /^[0-9a-f-]{36}$/i.test(s["versao"])
      ? { versao: s["versao"] }
      : {},
  head: () => ({
    meta: [
      { title: "Bula do paciente — Bula Acessível" },
      {
        name: "description",
        content:
          "Texto da bula do paciente, conferido a partir de fonte oficial, com navegação por seções.",
      },
      { property: "og:title", content: "Bula do paciente — Bula Acessível" },
      { property: "og:description", content: "Bula oficial verificada em texto acessível." },
    ],
  }),
  component: BulaPage,
});

function BulaPage() {
  const { id } = Route.useParams();
  const { versao } = Route.useSearch();
  const { user } = useAuth();
  const qc = useQueryClient();
  const settings = useSettings();
  const [msg, setMsg] = useState("");

  const med = useQuery({
    queryKey: ["medicine", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medicine_catalog")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const leaflets = useQuery({
    queryKey: ["leaflets", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leaflet_versions")
        .select(
          "id,version_label,leaflet_kind,source_url,source_type,source_checked_at,sections_json,approved_at,status,verified_by",
        )
        .eq("medicine_id", id)
        .eq("leaflet_kind", "paciente")
        .in("status", ["published", "superseded"])
        .order("approved_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const mine = useQuery({
    queryKey: ["user-med-by-medicine", user?.id, id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_medications")
        .select("*")
        .eq("medicine_id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const current = leaflets.data?.find((l) => l.status === "published");
  const shown = versao ? leaflets.data?.find((l) => l.id === versao) : current;

  // Registra consulta (somente para usuário autenticado; não presume uso).
  useEffect(() => {
    if (!user || !current || !med.data) return;
    (async () => {
      const { data: existing } = await supabase
        .from("user_medications")
        .select("id")
        .eq("medicine_id", id)
        .maybeSingle();
      if (existing)
        await supabase
          .from("user_medications")
          .update({ last_accessed_at: new Date().toISOString() })
          .eq("id", existing.id);
      else {
        const { data: created } = await supabase
          .from("user_medications")
          .insert({ user_id: user.id, medicine_id: id, leaflet_version_id: current.id })
          .select("id")
          .single();
        if (created)
          await supabase.from("user_medication_history").insert({
            user_id: user.id,
            user_medication_id: created.id,
            event: `Bula consultada (versão ${current.version_label})`,
          });
      }
      qc.invalidateQueries({ queryKey: ["user-med-by-medicine", user.id, id] });
    })();
  }, [user, current, med.data, id, qc]);

  async function update(
    patch: { is_saved?: boolean; usage_state?: "taking" | "stopped" | "none" },
    event: string,
    okMsg: string,
  ) {
    if (!user || !mine.data) return;
    const now = new Date().toISOString();
    const full = {
      ...patch,
      ...(patch.usage_state === "taking" ? { started_at: now, stopped_at: null } : {}),
      ...(patch.usage_state === "stopped" ? { stopped_at: now } : {}),
    };
    const { error } = await supabase.from("user_medications").update(full).eq("id", mine.data.id);
    if (error) {
      setMsg(friendlyError(error));
      return;
    }
    await supabase
      .from("user_medication_history")
      .insert({ user_id: user.id, user_medication_id: mine.data.id, event });
    setMsg(okMsg);
    qc.invalidateQueries();
  }

  if (med.isLoading || leaflets.isLoading) return <Loading label="Carregando bula…" />;
  if (med.error || leaflets.error)
    return (
      <Notice tone="error" title="Não foi possível carregar a bula." live="assertive">
        Tente novamente em instantes.
      </Notice>
    );
  if (!med.data) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-brand">Medicamento não encontrado</h1>
        <Notice tone="info" title={NOT_AVAILABLE_MESSAGE}>
          <a
            href={BULARIO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary underline"
          >
            Consultar no Bulário da Anvisa (abre em nova aba)
          </a>
        </Notice>
      </div>
    );
  }
  const m = med.data;
  const officialLabel = (url: string, type: string) =>
    type === "anvisa_bulario" && isOfficialAnvisaUrl(url)
      ? "Bula original no Bulário da Anvisa"
      : `Documento original — ${SOURCE_TYPE_LABEL[type] ?? "fonte externa"}`;
  const sections = shown ? parseSections(shown.sections_json) : [];
  const stale = shown
    ? isCurationStale(shown.source_checked_at, settings.data?.validityDays ?? 180)
    : false;
  const sectionId = (i: number) => `secao-${i + 1}`;

  return (
    <article className="space-y-6" aria-labelledby="titulo-bula">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Bula do paciente
        </p>
        <h1 id="titulo-bula" className="text-3xl font-bold text-brand md:text-4xl">
          {m.brand_name}
          {m.strength ? ` ${m.strength}` : ""}
        </h1>
        <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {m.active_ingredient && (
            <div>
              <dt className="inline font-medium">Princípio ativo: </dt>
              <dd className="inline">{m.active_ingredient}</dd>
            </div>
          )}
          {(m.formulation || m.presentation) && (
            <div>
              <dt className="inline font-medium">Forma e apresentação: </dt>
              <dd className="inline">
                {[m.formulation, m.presentation].filter(Boolean).join(" — ")}
              </dd>
            </div>
          )}
          {m.manufacturer && (
            <div>
              <dt className="inline font-medium">Fabricante: </dt>
              <dd className="inline">{m.manufacturer}</dd>
            </div>
          )}
          {m.registration_code && (
            <div>
              <dt className="inline font-medium">Registro: </dt>
              <dd className="inline">{m.registration_code}</dd>
            </div>
          )}
        </dl>
      </header>

      <MedicalDisclaimer />
      <ReadingControls />
      <LiveRegion message={msg} />

      {!shown ? (
        <Notice tone="info" title={NOT_AVAILABLE_MESSAGE}>
          <a
            href={m.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary underline"
          >
            {officialLabel(m.source_url, m.source_type)} (abre em nova aba)
          </a>
        </Notice>
      ) : (
        <>
          {shown.status === "superseded" && (
            <Notice
              tone="warning"
              title="Você está vendo uma versão anterior (registro histórico)."
            >
              Esta não é a bula atual.{" "}
              {current && (
                <Link
                  to="/medicamentos/$id/bula"
                  params={{ id }}
                  className="font-semibold text-primary underline"
                >
                  Abrir a versão mais recente ({current.version_label})
                </Link>
              )}
            </Notice>
          )}
          {stale && (
            <Notice tone="warning" title="A conferência deste texto está vencida.">
              A última verificação foi em {formatDate(shown.source_checked_at)}. O texto pode estar
              desatualizado; confira a bula original.
            </Notice>
          )}
          <section aria-labelledby="fonte" className="rounded-lg border bg-surface p-4">
            <h2 id="fonte" className="text-lg font-semibold">
              Fonte e verificação
            </h2>
            <ul className="mt-2 space-y-1">
              <li>Fonte: {SOURCE_TYPE_LABEL[shown.source_type] ?? shown.source_type}</li>
              <li>Versão da bula: {shown.version_label}</li>
              <li>Última conferência com a fonte: {formatDate(shown.source_checked_at)}</li>
              <li>Aprovado pela curadoria em: {formatDate(shown.approved_at)}</li>
              <li>
                <a
                  href={shown.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-1 font-semibold text-primary underline"
                >
                  {officialLabel(shown.source_url, shown.source_type)}{" "}
                  <ExternalLink className="size-4" aria-hidden="true" />
                  <span className="sr-only">(abre em nova aba)</span>
                </a>
              </li>
            </ul>
          </section>

          <ActionsBar user={!!user} mine={mine.data} onUpdate={update} />

          <nav aria-labelledby="sumario" className="rounded-lg border p-4">
            <h2 id="sumario" className="text-lg font-semibold">
              Sumário
            </h2>
            <ol className="mt-2 list-decimal space-y-1 pl-6">
              {sections.map((s, i) => (
                <li key={s.key}>
                  <a
                    href={`#${sectionId(i)}`}
                    className="inline-flex min-h-9 items-center text-primary underline"
                  >
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="prose-bula">
            {sections.map((s, i) => (
              <section
                key={s.key}
                id={sectionId(i)}
                aria-labelledby={`${sectionId(i)}-t`}
                className="scroll-mt-4 border-t py-6"
              >
                <h2 id={`${sectionId(i)}-t`} className="mb-3 text-2xl font-bold text-brand">
                  {s.title}
                </h2>
                {s.content.split(/\n{2,}/).map((p, j) => (
                  <p key={j}>{p}</p>
                ))}
                <p className="mt-2 text-sm text-muted-foreground">
                  Fonte: {SOURCE_TYPE_LABEL[shown.source_type]}, conferida em{" "}
                  {formatDate(shown.source_checked_at)}.
                </p>
                <p className="flex flex-wrap gap-4 text-sm">
                  {i < sections.length - 1 && (
                    <a
                      href={`#${sectionId(i + 1)}`}
                      className="inline-flex min-h-11 items-center text-primary underline"
                    >
                      Pular para a próxima seção: {sections[i + 1]?.title}
                    </a>
                  )}
                  <a
                    href="#sumario"
                    className="inline-flex min-h-11 items-center text-primary underline"
                  >
                    Voltar ao sumário
                  </a>
                </p>
              </section>
            ))}
          </div>

          {leaflets.data && leaflets.data.length > 1 && (
            <section aria-labelledby="versoes">
              <h2 id="versoes" className="text-xl font-semibold">
                Versões registradas
              </h2>
              <ul className="mt-2 space-y-1">
                {leaflets.data.map((l) => (
                  <li key={l.id}>
                    <Link
                      to="/medicamentos/$id/bula"
                      params={{ id }}
                      search={l.status === "published" ? {} : { versao: l.id }}
                      className="inline-flex min-h-11 items-center text-primary underline"
                    >
                      {l.version_label} — {l.status === "published" ? "atual" : "histórica"}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {mine.data?.leaflet_version_id &&
            current &&
            mine.data.leaflet_version_id !== current.id && (
              <Notice tone="info" title="A bula foi atualizada desde a sua primeira consulta.">
                <Link
                  to="/medicamentos/$id/bula"
                  params={{ id }}
                  search={{ versao: mine.data.leaflet_version_id }}
                  className="text-primary underline"
                >
                  Ver a versão que você consultou antes
                </Link>
              </Notice>
            )}
        </>
      )}
      <MedicalDisclaimer />
    </article>
  );
}

function ActionsBar({
  user,
  mine,
  onUpdate,
}: {
  user: boolean;
  mine: { is_saved: boolean; usage_state: string; id: string } | null | undefined;
  onUpdate: (
    p: { is_saved?: boolean; usage_state?: "taking" | "stopped" | "none" },
    event: string,
    ok: string,
  ) => void;
}) {
  if (!user) {
    return (
      <p className="rounded-lg border bg-surface p-4">
        Para salvar esta bula na sua biblioteca,{" "}
        <Link to="/entrar" className="font-semibold text-primary underline">
          entre
        </Link>{" "}
        ou{" "}
        <Link to="/cadastro" className="font-semibold text-primary underline">
          crie uma conta
        </Link>
        . A leitura continua gratuita sem cadastro.
      </p>
    );
  }
  if (!mine) return null;
  return (
    <section aria-labelledby="minhas-acoes" className="rounded-lg border p-4">
      <h2 id="minhas-acoes" className="text-lg font-semibold">
        Minha biblioteca
      </h2>
      <p className="mt-1">
        Situação: <strong>{USAGE_LABEL[mine.usage_state]}</strong>
        {mine.is_saved ? ", salvo na biblioteca" : ""}.
      </p>
      <p className="text-sm text-muted-foreground">
        Salvar não significa que você está usando o medicamento.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {mine.is_saved ? (
          <Button
            variant="outline"
            onClick={() =>
              onUpdate({ is_saved: false }, "Removido dos salvos", "Removido dos salvos.")
            }
          >
            Remover dos salvos
          </Button>
        ) : (
          <Button
            onClick={() =>
              onUpdate({ is_saved: true }, "Salvo na biblioteca", "Bula salva na sua biblioteca.")
            }
          >
            Salvar na minha biblioteca
          </Button>
        )}
        {mine.usage_state !== "taking" ? (
          <ConfirmButton
            title="Marcar como “Estou tomando”?"
            confirmLabel="Sim, estou tomando"
            description={
              <p>
                Isto apenas organiza sua biblioteca pessoal. Não é uma orientação de uso. Siga a
                prescrição recebida.
              </p>
            }
            onConfirm={() =>
              onUpdate(
                { usage_state: "taking", is_saved: true },
                "Marcado como em uso",
                "Marcado como em uso.",
              )
            }
          >
            Marcar como estou tomando
          </ConfirmButton>
        ) : (
          <ConfirmButton
            title="Registrar que deixou de usar?"
            confirmLabel="Registrar"
            description={
              <p>
                Isto só altera sua organização pessoal. Mudanças no tratamento devem ser combinadas
                com um profissional de saúde.
              </p>
            }
            onConfirm={() =>
              onUpdate(
                { usage_state: "stopped" },
                "Uso encerrado",
                "Registrado como uso encerrado.",
              )
            }
          >
            Deixar de usar
          </ConfirmButton>
        )}
        <Link
          to="/app/medicamentos/$id"
          params={{ id: mine.id }}
          className="inline-flex min-h-11 items-center px-2 font-semibold text-primary underline"
        >
          Ver meu registro
        </Link>
      </div>
    </section>
  );
}
