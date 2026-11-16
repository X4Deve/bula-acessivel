import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import type { MedicineResult, ProviderStatus, SearchResponse } from "./providers";
import { sanitizeExternalTerm } from "./external-providers";

const Input = z.object({
  q: z
    .string()
    .trim()
    .min(2, "Digite pelo menos 2 letras")
    .max(80)
    .refine((value) => sanitizeExternalTerm(value).length >= 2, "Digite pelo menos 2 letras"),
  field: z.enum(["all", "name", "ingredient", "manufacturer"]).default("all"),
});

const ExternalInput = z.object({
  provider: z.enum(["medicamentos_api_br", "openfda"]),
  externalId: z.string().regex(/^[A-Za-z0-9._-]{1,128}$/, "Identificador externo inválido"),
});

// Limite por instância, deliberadamente sem termos pesquisados. Em Workers é uma proteção
// adicional de curta duração, não um limite distribuído nem um registro permanente.
const searchWindows = new Map<string, { startedAt: number; count: number }>();
function assertSearchRateLimit() {
  const ip =
    getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for") ?? "desconhecido";
  const key = ip.split(",")[0]?.trim() || "desconhecido";
  const now = Date.now();
  const current = searchWindows.get(key);
  if (!current || now - current.startedAt >= 60_000) {
    searchWindows.set(key, { startedAt: now, count: 1 });
  } else {
    if (current.count >= 30) {
      throw new Error("Muitas buscas em pouco tempo. Aguarde um minuto e tente novamente.");
    }
    current.count += 1;
  }
  if (searchWindows.size > 5000) searchWindows.clear();
}

function publicClient() {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
          h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

/** Provedor 1: catálogo curado e verificado no banco (fonte primária). */
async function curatedCatalog(
  q: string,
  field: z.infer<typeof Input>["field"],
): Promise<{ results: MedicineResult[]; status: ProviderStatus }> {
  const safe = q
    .replace(/[^\p{L}\p{N}\s\-.]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (safe.length < 2)
    return { results: [], status: { provider: "catalogo_curado", status: "ok", count: 0 } };
  const like = `%${safe}%`;
  const sb = publicClient();
  let query = sb
    .from("medicine_catalog")
    .select(
      "id,brand_name,active_ingredient,manufacturer,strength,formulation,presentation,registration_code,source_type,verified_at,leaflet_versions(id,status)",
    )
    .eq("status", "published")
    .order("brand_name")
    .limit(50);
  if (field === "name") query = query.ilike("brand_name", like);
  else if (field === "ingredient") query = query.ilike("active_ingredient", like);
  else if (field === "manufacturer") query = query.ilike("manufacturer", like);
  else
    query = query.or(
      `brand_name.ilike.${like},active_ingredient.ilike.${like},manufacturer.ilike.${like}`,
    );
  const { data, error } = await query;
  if (error) {
    console.error("catalog search failed", error.code);
    return {
      results: [],
      status: {
        provider: "catalogo_curado",
        status: "error",
        message:
          "Falha ao consultar o catálogo local. Isso não significa que o medicamento não existe.",
      },
    };
  }
  const results: MedicineResult[] = (data ?? []).map((r) => ({
    id: r.id,
    brand_name: r.brand_name,
    active_ingredient: r.active_ingredient,
    manufacturer: r.manufacturer,
    strength: r.strength,
    formulation: r.formulation,
    presentation: r.presentation,
    registration_code: r.registration_code,
    source_type: r.source_type,
    verified_at: r.verified_at,
    has_leaflet: (r.leaflet_versions ?? []).some(
      (l: { status: string }) => l.status === "published",
    ),
  }));
  return { results, status: { provider: "catalogo_curado", status: "ok", count: results.length } };
}

export const searchMedicines = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<SearchResponse> => {
    setResponseHeader("Cache-Control", "private, no-store");
    assertSearchRateLimit();
    const apiKey = process.env["MEDICAMENTOS_API_KEY"];
    const [cat, externalModule] = await Promise.all([
      curatedCatalog(data.q, data.field),
      import("./external-search.server"),
    ]);
    const external = await externalModule.searchExternalSources(data.q, data.field, apiKey);
    return {
      results: cat.results,
      externalResults: external.flatMap((part) => part.results),
      providers: [cat.status, ...external.map((part) => part.status)],
    };
  });

export const getExternalLeaflet = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => ExternalInput.parse(input))
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "private, no-store");
    assertSearchRateLimit();
    const apiKey = process.env["MEDICAMENTOS_API_KEY"];
    const externalModule = await import("./external-search.server");
    return externalModule.getExternalLeaflet(data.provider, data.externalId, apiKey);
  });
