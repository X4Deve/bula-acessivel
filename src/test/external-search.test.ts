import { describe, expect, it, vi } from "vitest";
import {
  buildFdaSearchQuery,
  normalizeBrazilSearch,
  normalizeFdaSearch,
  safeAnvisaUrl,
} from "@/lib/external-providers";
import { getExternalLeaflet, searchExternalSources } from "@/lib/external-search.server";
import { BULARIO_URL } from "@/lib/medical";

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const fdaPayload = {
  results: [
    {
      set_id: "021cd76a-b093-4704-8410-5e7d01e20a54",
      effective_time: "20260827",
      openfda: {
        brand_name: ["Losartan Potassium"],
        generic_name: ["LOSARTAN POTASSIUM"],
        manufacturer_name: ["Example manufacturer"],
        substance_name: ["LOSARTAN POTASSIUM"],
      },
      indications_and_usage: ["Original FDA text, unchanged."],
    },
  ],
};

describe("normalização e segurança dos provedores", () => {
  it("filtra registros brasileiros sem nome ou registro e deduplica por fonte e registro", () => {
    const results = normalizeBrazilSearch({
      resultados: [
        { registro: "123", nome: "Produto A", principioAtivo: "Ativo A" },
        { registro: "123", nome: "Produto A repetido" },
        { registro: "", nome: "Sem registro" },
        { registro: "456", nome: " " },
      ],
    });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      provider: "medicamentos_api_br",
      externalId: "123",
      name: "Produto A",
      activeIngredient: "Ativo A",
    });
  });

  it("mantém set_id, fabricante e data do FDA sem fundir apresentações", () => {
    const results = normalizeFdaSearch(fdaPayload);
    expect(results[0]).toMatchObject({
      provider: "openfda",
      externalId: "021cd76a-b093-4704-8410-5e7d01e20a54",
      manufacturer: "Example manufacturer",
      updatedAt: "2026-08-27",
    });
  });

  it("usa manufacturer_name em pesquisa por fabricante", () => {
    const query = buildFdaSearchQuery("Example Labs", "manufacturer");
    expect(query).toContain('openfda.manufacturer_name:"Example Labs"');
    expect(query).not.toContain("openfda.brand_name");
  });

  it("só preserva URL Anvisa HTTPS no host oficial do Bulário", () => {
    expect(safeAnvisaUrl("https://consultas.anvisa.gov.br/#/bulario/123")).toContain(
      "consultas.anvisa.gov.br",
    );
    expect(safeAnvisaUrl("https://consultas.anvisa.gov.br.evil.example/bula")).toBe(BULARIO_URL);
    expect(safeAnvisaUrl("http://consultas.anvisa.gov.br/bula")).toBe(BULARIO_URL);
  });
});

describe("isolamento e falhas da busca externa", () => {
  it("sem chave consulta o FDA e informa que a fonte brasileira não está configurada", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(fdaPayload),
    );
    const parts = await searchExternalSources(
      "losartan",
      "ingredient",
      undefined,
      fetcher as typeof fetch,
    );

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0]?.[0])).toContain("https://api.fda.gov/drug/label.json");
    expect(parts[0]?.status).toMatchObject({
      provider: "medicamentos_api_br",
      status: "not_configured",
    });
    expect(parts[1]?.status).toMatchObject({ provider: "openfda", status: "ok", count: 1 });
    expect(parts[1]?.results[0]?.name).toBe("Losartan Potassium");
  });

  it("com chave consulta somente a fonte brasileira e não mistura resultados FDA", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({
        resultados: [{ registro: "123456", nome: "Produto brasileiro", fabricante: "Fabricante" }],
      }),
    );
    const parts = await searchExternalSources(
      "losartana",
      "all",
      "chave-de-teste",
      fetcher as typeof fetch,
    );

    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(String(url)).toBe(
      "https://medicamentos.api.br/api/v1/medicamentos?nome=losartana&porPagina=20",
    );
    expect(new Headers(init?.headers).get("X-API-Key")).toBe("chave-de-teste");
    expect(parts[0]?.results).toHaveLength(1);
    expect(parts[1]?.status).toMatchObject({ provider: "openfda", status: "skipped" });
    expect(
      parts
        .flatMap((part) => part.results)
        .every((item) => item.provider === "medicamentos_api_br"),
    ).toBe(true);
  });

  it("401 brasileiro é falha do provedor, não ausência do medicamento", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ erro: "nao_autorizado" }, 401),
    );
    const parts = await searchExternalSources(
      "losartana",
      "all",
      "chave-de-teste",
      fetcher as typeof fetch,
    );
    expect(parts[0]?.status).toMatchObject({ status: "error" });
    expect(parts[0]?.results).toEqual([]);
    expect(parts[0]?.status.status === "error" && parts[0]?.status.message).toContain(
      "recusou a chave",
    );
    expect(parts[0]?.status.status === "error" && parts[0]?.status.message).not.toContain(
      "não encontrado",
    );
  });

  it("falha da fonte brasileira consulta o FDA separadamente como alternativa", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) =>
      String(input).startsWith("https://medicamentos.api.br")
        ? jsonResponse({ erro: "limite_excedido" }, 429)
        : jsonResponse(fdaPayload),
    );
    const parts = await searchExternalSources("losartan", "all", "chave-de-teste", fetcher as typeof fetch);
    expect(parts[0]?.status.status).toBe("error");
    expect(parts[1]?.status).toMatchObject({ provider: "openfda", status: "ok", count: 1 });
    expect(parts[1]?.results.every((r) => r.provider === "openfda")).toBe(true);
  });

  it("429 do FDA é limite do provedor e preserva o estado de erro", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ error: "limite" }, 429),
    );
    const parts = await searchExternalSources(
      "losartan",
      "all",
      undefined,
      fetcher as typeof fetch,
    );
    expect(parts[1]?.status).toMatchObject({ provider: "openfda", status: "error" });
    expect(parts[1]?.status.status === "error" && parts[1]?.status.message).toContain("HTTP 429");
    expect(parts[1]?.results).toEqual([]);
  });

  it("404 de pesquisa no FDA significa zero resultados apenas naquela fonte", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ error: { code: "NOT_FOUND" } }, 404),
    );
    const parts = await searchExternalSources(
      "termo-sem-resultado",
      "all",
      undefined,
      fetcher as typeof fetch,
    );
    expect(parts[1]?.status).toEqual({ provider: "openfda", status: "ok", count: 0 });
  });

  it("timeout é informado sem transformar a falha em lista vazia bem-sucedida", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      throw new DOMException("Tempo esgotado", "TimeoutError");
    });
    const parts = await searchExternalSources(
      "losartan",
      "all",
      undefined,
      fetcher as typeof fetch,
    );
    expect(parts[1]?.status).toMatchObject({ status: "error" });
    expect(parts[1]?.status.status === "error" && parts[1]?.status.message).toContain("8 segundos");
  });
});

describe("detalhe da bula externa", () => {
  it("403 do plano brasileiro explica a dependência e oferece a Anvisa", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ erro: "tier_insuficiente" }, 403),
    );
    const detail = await getExternalLeaflet(
      "medicamentos_api_br",
      "123456",
      "chave-de-teste",
      fetcher as typeof fetch,
    );
    expect(detail.status).toBe("unavailable");
    expect(detail.status === "unavailable" && detail.message).toContain("Pro ou Business");
    expect(detail.status === "unavailable" && detail.officialUrl).toBe(BULARIO_URL);
  });

  it("detalhe FDA mantém o texto original em inglês", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(fdaPayload),
    );
    const detail = await getExternalLeaflet(
      "openfda",
      "021cd76a-b093-4704-8410-5e7d01e20a54",
      undefined,
      fetcher as typeof fetch,
    );
    expect(detail.status).toBe("ok");
    if (detail.status === "ok") {
      expect(detail.language).toBe("en");
      expect(detail.sections[0]?.paragraphs).toEqual(["Original FDA text, unchanged."]);
      expect(detail.automaticExtraction).toBe(false);
    }
  });
});
