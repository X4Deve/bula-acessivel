import { z } from "zod";
import { BULARIO_URL } from "@/lib/medical";
import type {
  ExternalLeafletSection,
  ExternalMedicineResult,
  ExternalProvider,
  SearchField,
} from "@/lib/providers";

export const BRAZIL_PROVIDER_LABEL = "medicamentos.api.br (não é API oficial da Anvisa)";
export const FDA_PROVIDER_LABEL = "FDA (Estados Unidos)";
export const BRAZIL_PROVIDER_HOME = "https://medicamentos.api.br/";
export const FDA_LABEL_ENDPOINT = "https://api.fda.gov/drug/label.json";

const optionalText = z.string().trim().max(5000).nullish();
const textList = z.array(z.string()).max(100).nullish();
const clean = (value: string | null | undefined) => value?.trim() || null;
const first = (value: string[] | null | undefined) => clean(value?.[0]);

function deduplicate(results: ExternalMedicineResult[]) {
  const seen = new Set<string>();
  return results.filter((result) => {
    const key = `${result.provider}:${result.externalId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function sanitizeExternalTerm(term: string) {
  return term
    .replace(/[^\p{L}\p{N}\s\-.]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

/** Só aceita URL específica do Bulário em HTTPS; qualquer outro valor volta à raiz oficial. */
export function safeAnvisaUrl(value: unknown): string {
  if (typeof value !== "string") return BULARIO_URL;
  try {
    const url = new URL(value);
    if (
      url.protocol === "https:" &&
      url.hostname === "consultas.anvisa.gov.br" &&
      !url.username &&
      !url.password
    ) {
      return url.href;
    }
  } catch {
    // A raiz oficial é o fallback seguro.
  }
  return BULARIO_URL;
}

export function fdaLabelUrl(setId: string) {
  const url = new URL(FDA_LABEL_ENDPOINT);
  url.searchParams.set("search", `set_id:"${setId}"`);
  url.searchParams.set("limit", "1");
  return url.href;
}

function fdaDate(value: string | null | undefined) {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(value ?? "");
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

export function formatExternalDate(value: string | null) {
  if (!value) return "Não informada";
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Não informada"
    : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(date);
}

const BrazilRecordSchema = z.object({
  registro: z.union([z.string(), z.number()]).nullish(),
  nome: optionalText,
  fabricante: optionalText,
  principioAtivo: optionalText,
});

const BrazilSearchSchema = z.object({
  resultados: z.array(BrazilRecordSchema).max(100),
});

export function normalizeBrazilSearch(payload: unknown): ExternalMedicineResult[] {
  const parsed = BrazilSearchSchema.parse(payload);
  return deduplicate(
    parsed.resultados.flatMap((record) => {
      const registration = clean(record.registro == null ? null : String(record.registro));
      const name = clean(record.nome);
      if (!registration || !name) return [];
      return [
        {
          provider: "medicamentos_api_br" as const,
          externalId: registration,
          name,
          activeIngredient: clean(record.principioAtivo),
          manufacturer: clean(record.fabricante),
          registration,
          sourceLabel: BRAZIL_PROVIDER_LABEL,
          sourceUrl: BRAZIL_PROVIDER_HOME,
          officialUrl: BULARIO_URL,
          updatedAt: null,
        },
      ];
    }),
  );
}

const FdaLabelSchema = z.object({
  set_id: optionalText,
  effective_time: optionalText,
  brand_name: textList,
  generic_name: textList,
  active_ingredient: textList,
  openfda: z
    .object({
      brand_name: textList,
      generic_name: textList,
      manufacturer_name: textList,
      substance_name: textList,
    })
    .nullish(),
  indications_and_usage: textList,
  contraindications: textList,
  adverse_reactions: textList,
  warnings: textList,
  dosage_and_administration: textList,
  purpose: textList,
  do_not_use: textList,
  ask_doctor: textList,
  ask_doctor_or_pharmacist: textList,
  stop_use: textList,
  keep_out_of_reach_of_children: textList,
  inactive_ingredient: textList,
});

const FdaResponseSchema = z.object({ results: z.array(FdaLabelSchema).max(10) });

type FdaLabel = z.infer<typeof FdaLabelSchema>;

function fdaMedicine(label: FdaLabel): ExternalMedicineResult | null {
  const setId = clean(label.set_id);
  const name =
    first(label.openfda?.brand_name) ??
    first(label.brand_name) ??
    first(label.openfda?.generic_name) ??
    first(label.generic_name);
  if (!setId || !name) return null;
  return {
    provider: "openfda",
    externalId: setId,
    name,
    activeIngredient:
      first(label.active_ingredient) ??
      first(label.openfda?.substance_name) ??
      first(label.openfda?.generic_name) ??
      first(label.generic_name),
    manufacturer: first(label.openfda?.manufacturer_name),
    registration: setId,
    sourceLabel: FDA_PROVIDER_LABEL,
    sourceUrl: fdaLabelUrl(setId),
    officialUrl: BULARIO_URL,
    updatedAt: fdaDate(label.effective_time),
  };
}

export function normalizeFdaSearch(payload: unknown): ExternalMedicineResult[] {
  const parsed = FdaResponseSchema.parse(payload);
  return deduplicate(
    parsed.results.flatMap((label) => {
      const medicine = fdaMedicine(label);
      return medicine ? [medicine] : [];
    }),
  );
}

const FDA_SECTIONS = [
  ["indications_and_usage", "Indications and usage"],
  ["contraindications", "Contraindications"],
  ["adverse_reactions", "Adverse reactions"],
  ["warnings", "Warnings"],
  ["dosage_and_administration", "Dosage and administration"],
  ["active_ingredient", "Active ingredient"],
  ["purpose", "Purpose"],
  ["do_not_use", "Do not use"],
  ["ask_doctor", "Ask a doctor"],
  ["ask_doctor_or_pharmacist", "Ask a doctor or pharmacist"],
  ["stop_use", "Stop use"],
  ["keep_out_of_reach_of_children", "Keep out of reach of children"],
  ["inactive_ingredient", "Inactive ingredients"],
] as const;

export function normalizeFdaDetail(payload: unknown, expectedId: string) {
  const parsed = FdaResponseSchema.parse(payload);
  const label = parsed.results.find((item) => item.set_id === expectedId) ?? parsed.results[0];
  const medicine = label ? fdaMedicine(label) : null;
  if (!label || !medicine || medicine.externalId !== expectedId) return null;
  const sections: ExternalLeafletSection[] = FDA_SECTIONS.flatMap(([key, title]) => {
    const paragraphs = (label[key] ?? []).filter((text) => text.trim().length > 0);
    return paragraphs.length ? [{ key, title, paragraphs }] : [];
  });
  return { medicine, sections };
}

const BrazilLeafletSchema = z.object({
  registro: z.union([z.string(), z.number()]).nullish(),
  secoes: z
    .object({
      paraQueServe: optionalText,
      comoTomar: optionalText,
      contraindicacoes: optionalText,
      efeitosColaterais: optionalText,
      composicao: optionalText,
      precaucoes: optionalText,
    })
    .nullish(),
  secoesAusentes: z.array(z.string()).max(30).nullish(),
  extracaoFalhou: z.boolean().nullish(),
  atualizadoEm: optionalText,
  urlBulaOficial: optionalText,
});

const BRAZIL_SECTIONS = [
  ["paraQueServe", "Para que serve"],
  ["comoTomar", "Como tomar"],
  ["contraindicacoes", "Contraindicações"],
  ["efeitosColaterais", "Efeitos colaterais"],
  ["composicao", "Composição"],
  ["precaucoes", "Precauções"],
] as const;

export function normalizeBrazilDetail(payload: unknown, requestedRegistration: string) {
  const parsed = BrazilLeafletSchema.parse(payload);
  const registration = clean(
    parsed.registro == null ? requestedRegistration : String(parsed.registro),
  );
  if (!registration || registration !== requestedRegistration) return null;
  const sections: ExternalLeafletSection[] = BRAZIL_SECTIONS.flatMap(([key, title]) => {
    const content = clean(parsed.secoes?.[key]);
    return content ? [{ key, title, paragraphs: [content] }] : [];
  });
  const medicine: ExternalMedicineResult = {
    provider: "medicamentos_api_br",
    externalId: registration,
    name: `Registro ${registration}`,
    activeIngredient: null,
    manufacturer: null,
    registration,
    sourceLabel: BRAZIL_PROVIDER_LABEL,
    sourceUrl: BRAZIL_PROVIDER_HOME,
    officialUrl: safeAnvisaUrl(parsed.urlBulaOficial),
    updatedAt: clean(parsed.atualizadoEm),
  };
  return {
    medicine,
    sections,
    missingSections: (parsed.secoesAusentes ?? []).filter((key) => key.trim().length > 0),
    extractionFailed: parsed.extracaoFalhou === true,
  };
}

export function externalStatusMessage(provider: ExternalProvider, status: number) {
  const source = provider === "openfda" ? "O FDA" : "A fonte brasileira externa";
  if (status === 401 || status === 403) {
    return provider === "openfda"
      ? `${source} recusou a consulta (HTTP ${status}). Tente novamente mais tarde.`
      : `${source} recusou a chave ou o plano de acesso (HTTP ${status}). Nenhum resultado brasileiro externo foi obtido.`;
  }
  if (status === 429) {
    return `${source} atingiu o limite de consultas (HTTP 429). Tente novamente mais tarde; isso não significa que o medicamento não existe.`;
  }
  if (status >= 500) {
    return `${source} está temporariamente indisponível (HTTP ${status}). Tente novamente mais tarde.`;
  }
  return `${source} não conseguiu concluir a consulta (HTTP ${status}).`;
}

/** Usa somente campos documentados e mantém o termo dentro de uma frase Lucene escapada. */
export function buildFdaSearchQuery(term: string, field: SearchField) {
  const safe = sanitizeExternalTerm(term).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const quoted = `"${safe}"`;
  const fields =
    field === "manufacturer"
      ? ["openfda.manufacturer_name"]
      : field === "ingredient"
        ? ["openfda.generic_name", "generic_name", "openfda.substance_name"]
        : field === "name"
          ? ["openfda.brand_name", "brand_name"]
          : [
              "openfda.brand_name",
              "openfda.generic_name",
              "brand_name",
              "generic_name",
              "openfda.manufacturer_name",
            ];
  // O openFDA rejeita combinações com _exists_ em consultas OR reais. Registros sem set_id
  // são descartados na normalização, sem restringir incorretamente os demais resultados.
  return fields.map((name) => `${name}:${quoted}`).join(" OR ");
}
