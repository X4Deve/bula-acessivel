import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { LiveRegion, MedicalDisclaimer, Notice } from "@/components/common";
import { ReadingControls } from "@/components/ReadingControls";
import { getExternalLeaflet } from "@/lib/search.functions";
import { formatExternalDate } from "@/lib/external-providers";
import { BULARIO_URL } from "@/lib/medical";
import type { ExternalProvider } from "@/lib/providers";

const externalQuery = (provider: ExternalProvider, externalId: string) =>
  queryOptions({
    queryKey: ["external-leaflet", provider, externalId],
    queryFn: () => getExternalLeaflet({ data: { provider, externalId } }),
    staleTime: 0,
    gcTime: 0,
  });

export const Route = createFileRoute("/medicamentos/externos/$provider/$externalId")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      externalQuery(params.provider as ExternalProvider, params.externalId),
    ),
  head: () => ({
    meta: [
      { title: "Bula externa — Bula Acessível" },
      {
        name: "description",
        content:
          "Texto externo identificado por provedor, sem validação pelo Bula Acessível e com link para a fonte original.",
      },
      { property: "og:title", content: "Bula externa — Bula Acessível" },
      {
        property: "og:description",
        content: "Leitura acessível de dados externos, com origem e limitações explícitas.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExternalLeafletPage,
});

function ExternalLeafletPage() {
  const params = Route.useParams();
  const provider = params.provider as ExternalProvider;
  const { data } = useSuspenseQuery(externalQuery(provider, params.externalId));
  const sourceName = provider === "openfda" ? "FDA (Estados Unidos)" : "medicamentos.api.br";

  if (data.status === "unavailable") {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-brand">Bula externa indisponível</h1>
        <LiveRegion message="A bula externa não está disponível. Ouça a explicação e os links para as fontes." />
        <Notice tone="warning" title={`Não foi possível obter o texto em ${sourceName}.`}>
          <p>{data.message}</p>
        </Notice>
        <SourceLinks
          officialUrl={data.officialUrl}
          sourceUrl={data.sourceUrl}
          provider={provider}
        />
        <BackToSearch />
      </div>
    );
  }

  const { medicine } = data;
  const isFda = provider === "openfda";

  return (
    <article className="space-y-6" aria-labelledby="titulo-bula-externa">
      <header className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Conteúdo externo não validado pelo Bula Acessível
        </p>
        <h1 id="titulo-bula-externa" className="text-3xl font-bold text-brand md:text-4xl">
          {medicine.name}
        </h1>
        <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {medicine.activeIngredient && (
            <Def label="Princípio ativo" value={medicine.activeIngredient} />
          )}
          {medicine.manufacturer && <Def label="Fabricante" value={medicine.manufacturer} />}
          <Def
            label={isFda ? "Identificador FDA (set_id)" : "Registro"}
            value={medicine.registration}
          />
          <Def label="Fonte" value={medicine.sourceLabel} />
        </dl>
      </header>

      <Notice
        tone="warning"
        title={
          isFda
            ? "FDA (Estados Unidos); não é bula aprovada no Brasil."
            : "Extração automática não revisada."
        }
      >
        {isFda ? (
          <p>
            Texto original em inglês; confira correspondente da Anvisa. Não equipare composição,
            concentração ou recomendações a um produto brasileiro. Este conteúdo não é orientação de
            uso no Brasil.
          </p>
        ) : (
          <p>
            Texto extraído automaticamente pelo provedor e não revisado pelo Bula Acessível. Confira
            a bula original da Anvisa antes de usar qualquer informação.
          </p>
        )}
      </Notice>

      <MedicalDisclaimer />
      <ReadingControls />

      <section aria-labelledby="origem-externa" className="rounded-lg border bg-surface p-4">
        <h2 id="origem-externa" className="text-lg font-semibold">
          Fonte e datas
        </h2>
        <ul className="mt-2 space-y-1">
          <li>Provedor: {medicine.sourceLabel}</li>
          <li>Atualização informada pela fonte: {formatExternalDate(medicine.updatedAt)}</li>
          <li>Consulta ao provedor nesta data: {formatExternalDate(data.consultedAt)}</li>
          <li>
            Situação:{" "}
            {data.automaticExtraction
              ? "extração automática não revisada"
              : "texto original fornecido pela API; sem tradução ou revisão local"}
            .
          </li>
        </ul>
        <SourceLinks
          officialUrl={medicine.officialUrl}
          sourceUrl={medicine.sourceUrl}
          provider={provider}
        />
      </section>

      {data.missingSections.length > 0 && (
        <Notice tone="info" title="O provedor marcou seções como ausentes">
          <p>
            {data.missingSections.join(", ")}. Nenhuma seção ausente foi completada pelo aplicativo.
          </p>
        </Notice>
      )}

      <nav aria-labelledby="sumario-externo" className="rounded-lg border p-4">
        <h2 id="sumario-externo" className="text-lg font-semibold">
          Sumário das seções fornecidas
        </h2>
        <ol className="mt-2 list-decimal space-y-1 pl-6">
          {data.sections.map((section, index) => (
            <li key={section.key}>
              <a
                href={`#externa-${index + 1}`}
                className="inline-flex min-h-9 items-center text-primary underline"
              >
                {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div lang={data.language} className="prose-bula">
        {data.sections.map((section, index) => (
          <section
            key={section.key}
            id={`externa-${index + 1}`}
            aria-labelledby={`externa-${index + 1}-titulo`}
            className="scroll-mt-4 border-t py-6"
          >
            <h2 id={`externa-${index + 1}-titulo`} className="mb-3 text-2xl font-bold text-brand">
              {section.title}
            </h2>
            {section.paragraphs.map((paragraph, paragraphIndex) => (
              <p key={paragraphIndex} className="whitespace-pre-line">
                {paragraph}
              </p>
            ))}
            <p className="mt-3">
              <a
                href="#sumario-externo"
                className="inline-flex min-h-11 items-center text-primary underline"
              >
                Voltar ao sumário
              </a>
            </p>
          </section>
        ))}
      </div>

      <BackToSearch />
    </article>
  );
}

function SourceLinks({
  officialUrl,
  sourceUrl,
  provider,
}: {
  officialUrl: string;
  sourceUrl: string | null;
  provider: ExternalProvider;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
      {sourceUrl && (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-1 font-semibold text-primary underline"
        >
          {provider === "openfda"
            ? "Abrir registro original no FDA (JSON, em inglês)"
            : "Visitar o provedor brasileiro externo"}
          <ExternalLink className="size-4" aria-hidden="true" />
          <span className="sr-only">(abre em nova aba)</span>
        </a>
      )}
      <a
        href={officialUrl || BULARIO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center gap-1 font-semibold text-primary underline"
      >
        Conferir bula original no Bulário da Anvisa
        <ExternalLink className="size-4" aria-hidden="true" />
        <span className="sr-only">(abre em nova aba)</span>
      </a>
    </div>
  );
}

function BackToSearch() {
  return (
    <Link
      to="/buscar"
      className="inline-flex min-h-11 items-center font-semibold text-primary underline"
    >
      Voltar à pesquisa
    </Link>
  );
}

function Def({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="inline font-medium">{label}: </dt>
      <dd className="inline break-words">{value}</dd>
    </div>
  );
}
