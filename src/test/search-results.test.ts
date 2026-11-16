import { describe, expect, it } from "vitest";
import { combineSearchResults } from "@/lib/search-results";
import type { ExternalMedicineResult, MedicineResult } from "@/lib/providers";

const local: MedicineResult = {
  id: "local-1",
  brand_name: "Zetia",
  active_ingredient: "Ativo local",
  manufacturer: "Fabricante local",
  strength: "10 mg",
  formulation: "Comprimido",
  presentation: "30 comprimidos",
  registration_code: null,
  source_type: "anvisa_bulario",
  verified_at: null,
  has_leaflet: true,
};

function external(
  provider: ExternalMedicineResult["provider"],
  externalId: string,
  name: string,
): ExternalMedicineResult {
  return {
    provider,
    externalId,
    name,
    activeIngredient: null,
    manufacturer: null,
    registration: externalId,
    sourceLabel: "Fonte de teste",
    sourceUrl: null,
    officialUrl: "https://consultas.anvisa.gov.br/#/bulario/",
    updatedAt: null,
  };
}

describe("lista unificada da busca", () => {
  it("mantém verificados primeiro, ordena por nome e conserva as rotas de cada origem", () => {
    const results = combineSearchResults(
      [local],
      [
        external("openfda", "fda-1", "Aspirin"),
        external("medicamentos_api_br", "br-1", "Dipirona"),
      ],
    );
    expect(results.map((item) => item.key)).toEqual([
      "curated:local-1",
      "medicamentos_api_br:br-1",
      "openfda:fda-1",
    ]);
    expect(results[0]?.localId).toBe("local-1");
    expect(results[2]?.externalId).toBe("fda-1");
  });

  it("não duplica a mesma identidade nem funde registros de apresentações distintas", () => {
    const results = combineSearchResults(
      [],
      [
        external("medicamentos_api_br", "registro-1", "Produto A"),
        external("medicamentos_api_br", "registro-1", "Produto A repetido"),
        external("medicamentos_api_br", "registro-2", "Produto A"),
      ],
    );
    expect(results).toHaveLength(2);
    expect(results.map((item) => item.externalId)).toEqual(["registro-1", "registro-2"]);
  });
});
