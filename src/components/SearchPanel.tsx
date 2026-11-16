import { useId, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice, LiveRegion } from "@/components/common";
import { SearchResults } from "@/components/ExternalResults";
import { searchMedicines } from "@/lib/search.functions";
import { combineSearchResults } from "@/lib/search-results";
import type { SearchField, SearchResponse } from "@/lib/providers";
import { BULARIO_URL, BULARIO_HELP_URL, NOT_AVAILABLE_MESSAGE } from "@/lib/medical";
import { useAuth, friendlyError } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const nativeSelect =
  "min-h-11 w-full rounded-md border border-input bg-background px-3 text-base";

const providerNames: Record<string, string> = {
  catalogo_curado: "Catálogo verificado do Bula Acessível",
  medicamentos_api_br: "medicamentos.api.br (fonte brasileira independente)",
  openfda: "openFDA (fonte internacional dos Estados Unidos)",
};

export function SearchPanel({ headingLevel = 2 }: { headingLevel?: 2 | 3 }) {
  const id = useId();
  const search = useServerFn(searchMedicines);
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [field, setField] = useState<SearchField>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [res, setRes] = useState<SearchResponse | null>(null);
  const [lastQ, setLastQ] = useState("");
  const [announce, setAnnounce] = useState("");
  const H = headingLevel === 2 ? "h2" : "h3";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (term.length < 2) {
      setError("Digite pelo menos 2 letras para pesquisar.");
      setAnnounce("");
      return;
    }
    setError("");
    setRes(null);
    setLoading(true);
    setAnnounce("Buscando medicamentos…");
    try {
      const response = await search({ data: { q: term, field } });
      const total = combineSearchResults(response.results, response.externalResults).length;
      const failed = response.providers.some((provider) => provider.status === "error");
      setRes(response);
      setLastQ(term);
      setAnnounce(
        `${total} medicamento${total === 1 ? "" : "s"} encontrado${total === 1 ? "" : "s"} para ${term}.` +
          (failed ? " Algumas fontes não responderam; os resultados podem estar incompletos." : ""),
      );
      if (user) {
        // Evita até a tentativa de escrita quando o histórico está desativado; o banco mantém a mesma regra.
        const { data: profile } = await supabase
          .from("profiles")
          .select("save_search_history")
          .eq("id", user.id)
          .maybeSingle();
        if (profile?.save_search_history) {
          await supabase
            .from("search_history")
            .insert({ user_id: user.id, query: term })
            .then(() => undefined);
        }
      }
    } catch (err) {
      setError(friendlyError(err));
      setAnnounce("Não foi possível concluir a pesquisa. Ouça a mensagem de erro no formulário.");
    } finally {
      setLoading(false);
    }
  }

  const medicines = res ? combineSearchResults(res.results, res.externalResults) : [];
  const hasProviderError = res?.providers.some((provider) => provider.status === "error") ?? false;

  return (
    <div>
      <form
        role="search"
        aria-label="Pesquisar medicamento"
        onSubmit={onSubmit}
        noValidate
        className="grid gap-4 rounded-xl border bg-surface p-5 md:grid-cols-[1fr_14rem_auto] md:items-end"
      >
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-q`} className="text-base font-medium">
            Nome do medicamento ou princípio ativo
          </Label>
          <Input
            id={`${id}-q`}
            type="search"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            maxLength={80}
            autoComplete="off"
            aria-invalid={!!error || undefined}
            aria-describedby={error ? `${id}-err` : undefined}
            className="text-base"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-f`} className="text-base font-medium">
            Pesquisar em
          </Label>
          <select
            id={`${id}-f`}
            className={nativeSelect}
            value={field}
            onChange={(event) => setField(event.target.value as SearchField)}
          >
            <option value="all">Todos os campos</option>
            <option value="name">Nome comercial</option>
            <option value="ingredient">Princípio ativo</option>
            <option value="manufacturer">Fabricante</option>
          </select>
        </div>
        <Button type="submit" size="lg" disabled={loading} aria-disabled={loading}>
          <Search aria-hidden="true" /> {loading ? "Buscando…" : "Buscar"}
        </Button>
        {error && (
          <p id={`${id}-err`} role="alert" className="font-medium text-destructive md:col-span-3">
            Erro: {error}
          </p>
        )}
      </form>
      <LiveRegion message={announce} />

      {res && (
        <section aria-labelledby={`${id}-results`} className="mt-8" aria-busy={loading}>
          <H id={`${id}-results`} className="text-2xl font-semibold">
            {medicines.length} medicamento{medicines.length === 1 ? "" : "s"} encontrado
            {medicines.length === 1 ? "" : "s"} para “{lastQ}”
          </H>

          {hasProviderError && (
            <Notice
              tone="warning"
              title={
                medicines.length
                  ? "Algumas fontes não responderam"
                  : "Não foi possível concluir a busca"
              }
              className="mt-4"
            >
              <p>
                {medicines.length
                  ? "Os resultados abaixo podem estar incompletos. Tente novamente mais tarde se não encontrar o medicamento."
                  : "Uma ou mais fontes estão indisponíveis. Isso não significa que o medicamento não existe."}
              </p>
              <OfficialLinks />
            </Notice>
          )}

          <SearchResults medicines={medicines} />

          {!medicines.length && !hasProviderError && (
            <Notice tone="info" title={NOT_AVAILABLE_MESSAGE} className="mt-4">
              <p>Nenhuma fonte consultada devolveu resultados para este termo.</p>
              <OfficialLinks />
            </Notice>
          )}

          {medicines.length > 0 && (
            <p className="mt-5 text-sm text-muted-foreground">
              Confira nome, princípio ativo e fabricante. Medicamentos com nomes parecidos podem ser
              produtos diferentes. <OfficialLinks />
            </p>
          )}

          <details className="mt-6 text-sm text-muted-foreground">
            <summary className="inline-flex min-h-11 cursor-pointer items-center">
              Detalhes das fontes consultadas
            </summary>
            <p className="mt-1">
              Informações técnicas e eventuais limitações desta pesquisa. Fontes externas não são
              validadas pelo Bula Acessível nem equivalem a uma bula oficial da Anvisa.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {res.providers.map((provider) => (
                <li key={provider.provider}>
                  {providerNames[provider.provider] ?? provider.provider}: {statusText(provider)}
                </li>
              ))}
            </ul>
          </details>
        </section>
      )}
    </div>
  );
}

function OfficialLinks() {
  return (
    <span className="mt-2 block">
      Consulte o{" "}
      <a
        href={BULARIO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-primary underline"
      >
        Bulário Eletrônico da Anvisa (abre em nova aba)
      </a>
      .{" "}
      <a
        href={BULARIO_HELP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline"
      >
        Como usar o Bulário (abre em nova aba)
      </a>
      .
    </span>
  );
}

function statusText(status: SearchResponse["providers"][number]) {
  if (status.status === "ok") return `${status.count} resultado(s)`;
  return status.message;
}
