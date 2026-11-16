import {
  BRAZIL_PROVIDER_HOME,
  FDA_LABEL_ENDPOINT,
  buildFdaSearchQuery,
  externalStatusMessage,
  normalizeBrazilDetail,
  normalizeBrazilSearch,
  normalizeFdaDetail,
  normalizeFdaSearch,
} from "@/lib/external-providers";
import { BULARIO_URL } from "@/lib/medical";
import type {
  ExternalLeafletResponse,
  ExternalMedicineResult,
  ExternalProvider,
  ProviderStatus,
  SearchField,
} from "@/lib/providers";

const BRAZIL_API_BASE = "https://medicamentos.api.br";
const REQUEST_TIMEOUT_MS = 8000;

type Fetcher = typeof fetch;
type SearchPart = { results: ExternalMedicineResult[]; status: ProviderStatus };

class UpstreamHttpError extends Error {
  constructor(readonly status: number) {
    super(`Upstream HTTP ${status}`);
  }
}

async function getJson(url: URL, fetcher: Fetcher, apiKey?: string) {
  const response = await fetcher(url, {
    headers: {
      Accept: "application/json",
      ...(apiKey ? { "X-API-Key": apiKey } : {}),
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) throw new UpstreamHttpError(response.status);
  return (await response.json()) as unknown;
}

function isTimeoutError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    ["AbortError", "TimeoutError"].includes(String(error.name))
  );
}

function searchError(provider: ExternalProvider, error: unknown): SearchPart {
  let message: string;
  if (error instanceof UpstreamHttpError) {
    message = externalStatusMessage(provider, error.status);
  } else if (isTimeoutError(error)) {
    message = `${provider === "openfda" ? "O FDA" : "A fonte brasileira externa"} não respondeu em 8 segundos. Tente novamente.`;
  } else {
    message = `${provider === "openfda" ? "O FDA" : "A fonte brasileira externa"} devolveu uma resposta que não pôde ser validada. Nenhum dado externo foi exibido.`;
  }
  return { results: [], status: { provider, status: "error", message } };
}

async function searchBrazil(q: string, apiKey: string, fetcher: Fetcher): Promise<SearchPart> {
  try {
    const url = new URL("/api/v1/medicamentos", BRAZIL_API_BASE);
    url.searchParams.set("nome", q);
    url.searchParams.set("porPagina", "20");
    const payload = await getJson(url, fetcher, apiKey);
    const results = normalizeBrazilSearch(payload);
    return {
      results,
      status: { provider: "medicamentos_api_br", status: "ok", count: results.length },
    };
  } catch (error) {
    return searchError("medicamentos_api_br", error);
  }
}

async function searchFda(q: string, field: SearchField, fetcher: Fetcher): Promise<SearchPart> {
  try {
    const url = new URL(FDA_LABEL_ENDPOINT);
    url.searchParams.set("search", buildFdaSearchQuery(q, field));
    url.searchParams.set("limit", "10");
    const payload = await getJson(url, fetcher);
    const results = normalizeFdaSearch(payload);
    return { results, status: { provider: "openfda", status: "ok", count: results.length } };
  } catch (error) {
    if (error instanceof UpstreamHttpError && error.status === 404) {
      return { results: [], status: { provider: "openfda", status: "ok", count: 0 } };
    }
    return searchError("openfda", error);
  }
}

/**
 * Com chave brasileira, consulta somente o provedor BR. Sem chave, openFDA é o fallback.
 * Não há cache nem persistência: pesquisas de medicamentos podem revelar dados de saúde.
 */
export async function searchExternalSources(
  q: string,
  field: SearchField,
  apiKey: string | undefined,
  fetcher: Fetcher = fetch,
): Promise<SearchPart[]> {
  if (apiKey?.trim()) {
    const brazil = await searchBrazil(q, apiKey.trim(), fetcher);
    if (brazil.status.status === "error") {
      // Falha da fonte brasileira (chave inválida, limite, indisponibilidade): FDA separado como alternativa.
      return [brazil, await searchFda(q, field, fetcher)];
    }
    return [
      brazil,
      {
        results: [],
        status: {
          provider: "openfda",
          status: "skipped",
          message: "FDA não consultado porque a fonte brasileira externa está configurada.",
        },
      },
    ];
  }
  const fda = await searchFda(q, field, fetcher);
  return [
    {
      results: [],
      status: {
        provider: "medicamentos_api_br",
        status: "not_configured",
        message:
          "Fonte brasileira externa não configurada; o FDA foi consultado como alternativa internacional.",
      },
    },
    fda,
  ];
}

function unavailable(
  provider: ExternalProvider,
  message: string,
  sourceUrl: string | null = null,
  officialUrl = BULARIO_URL,
): ExternalLeafletResponse {
  return { status: "unavailable", provider, message, officialUrl, sourceUrl };
}

function detailError(provider: ExternalProvider, error: unknown): ExternalLeafletResponse {
  if (error instanceof UpstreamHttpError) {
    if (provider === "medicamentos_api_br" && error.status === 403) {
      return unavailable(
        provider,
        "O provedor informou que a leitura da bula exige um plano Pro ou Business. A busca continua disponível; consulte a bula original no Bulário da Anvisa.",
        BRAZIL_PROVIDER_HOME,
      );
    }
    if (error.status === 404) {
      return unavailable(
        provider,
        "O provedor não encontrou uma bula para este registro. Isso não comprova que o medicamento não existe; faça uma pesquisa manual na fonte oficial.",
        provider === "medicamentos_api_br" ? BRAZIL_PROVIDER_HOME : FDA_LABEL_ENDPOINT,
      );
    }
    return unavailable(
      provider,
      externalStatusMessage(provider, error.status),
      provider === "medicamentos_api_br" ? BRAZIL_PROVIDER_HOME : FDA_LABEL_ENDPOINT,
    );
  }
  if (isTimeoutError(error)) {
    return unavailable(provider, "A fonte externa não respondeu em 8 segundos. Tente novamente.");
  }
  return unavailable(
    provider,
    "A resposta da fonte externa não passou na validação. Nenhum texto foi exibido; consulte a fonte original.",
  );
}

export async function getExternalLeaflet(
  provider: ExternalProvider,
  externalId: string,
  apiKey: string | undefined,
  fetcher: Fetcher = fetch,
): Promise<ExternalLeafletResponse> {
  try {
    if (provider === "medicamentos_api_br") {
      if (!apiKey?.trim()) {
        return unavailable(
          provider,
          "A chave do provedor brasileiro não está configurada. Consulte a bula original no Bulário da Anvisa.",
          BRAZIL_PROVIDER_HOME,
        );
      }
      const url = new URL(
        `/api/v1/medicamentos/${encodeURIComponent(externalId)}/bula`,
        BRAZIL_API_BASE,
      );
      const payload = await getJson(url, fetcher, apiKey.trim());
      const detail = normalizeBrazilDetail(payload, externalId);
      if (!detail) {
        return unavailable(
          provider,
          "O provedor devolveu um registro diferente do solicitado. O conteúdo foi bloqueado; consulte o Bulário da Anvisa.",
          BRAZIL_PROVIDER_HOME,
        );
      }
      if (!detail.sections.length) {
        return unavailable(
          provider,
          detail.extractionFailed
            ? "O provedor não conseguiu extrair o texto desta bula. Nenhuma seção foi completada ou inventada; confira o documento original da Anvisa."
            : "O provedor não forneceu seções legíveis para esta bula. Confira o documento original da Anvisa.",
          BRAZIL_PROVIDER_HOME,
          detail.medicine.officialUrl,
        );
      }
      return {
        status: "ok",
        provider,
        ...detail,
        automaticExtraction: true,
        language: "pt-BR",
        consultedAt: new Date().toISOString(),
      };
    }

    const url = new URL(FDA_LABEL_ENDPOINT);
    url.searchParams.set("search", `set_id:"${externalId}"`);
    url.searchParams.set("limit", "1");
    const payload = await getJson(url, fetcher);
    const detail = normalizeFdaDetail(payload, externalId);
    if (!detail) {
      return unavailable(
        provider,
        "O FDA não devolveu o registro solicitado. Nenhum texto foi exibido.",
        FDA_LABEL_ENDPOINT,
      );
    }
    if (!detail.sections.length) {
      return unavailable(
        provider,
        "O registro do FDA não forneceu as seções de bula aceitas pelo aplicativo. Consulte o registro original ou pesquise no Bulário da Anvisa.",
        detail.medicine.sourceUrl,
      );
    }
    return {
      status: "ok",
      provider,
      ...detail,
      missingSections: [],
      automaticExtraction: false,
      language: "en",
      consultedAt: new Date().toISOString(),
    };
  } catch (error) {
    return detailError(provider, error);
  }
}
