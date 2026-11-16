import type { ExternalProvider, MedicineResult, ExternalMedicineResult } from "@/lib/providers";

export type UnifiedMedicineResult = {
  key: string;
  name: string;
  activeIngredient: string | null;
  manufacturer: string | null;
  strength: string | null;
  formulation: string | null;
  presentation: string | null;
  origin: "curated" | ExternalProvider;
  localId: string | null;
  externalId: string | null;
  hasLeaflet: boolean;
};

const originOrder: Record<UnifiedMedicineResult["origin"], number> = {
  curated: 0,
  medicamentos_api_br: 1,
  openfda: 2,
};

/**
 * Monta uma única lista sem fundir apresentações: identidade local ou fonte+registro.
 * A ordenação por origem e nome é estável e não depende do tempo de resposta dos provedores.
 */
export function combineSearchResults(
  results: MedicineResult[],
  externalResults: ExternalMedicineResult[],
): UnifiedMedicineResult[] {
  const local = results.map((medicine) => ({
    key: `curated:${medicine.id}`,
    name: medicine.brand_name,
    activeIngredient: medicine.active_ingredient,
    manufacturer: medicine.manufacturer,
    strength: medicine.strength,
    formulation: medicine.formulation,
    presentation: medicine.presentation,
    origin: "curated" as const,
    localId: medicine.id,
    externalId: null,
    hasLeaflet: medicine.has_leaflet,
  }));
  const external = externalResults.map((medicine) => ({
    key: `${medicine.provider}:${medicine.externalId}`,
    name: medicine.name,
    activeIngredient: medicine.activeIngredient,
    manufacturer: medicine.manufacturer,
    strength: null,
    formulation: null,
    presentation: null,
    origin: medicine.provider,
    localId: null,
    externalId: medicine.externalId,
    hasLeaflet: true,
  }));
  const seen = new Set<string>();
  return [...local, ...external]
    .filter((medicine) => {
      if (seen.has(medicine.key)) return false;
      seen.add(medicine.key);
      return true;
    })
    .sort(
      (a, b) =>
        originOrder[a.origin] - originOrder[b.origin] ||
        a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }),
    );
}
