// Contratos da camada de provedores. Compartilhados entre servidor e cliente (sem segredos).
export type MedicineResult = {
  id: string;
  brand_name: string;
  active_ingredient: string | null;
  manufacturer: string | null;
  strength: string | null;
  formulation: string | null;
  presentation: string | null;
  registration_code: string | null;
  source_type: string;
  verified_at: string | null;
  has_leaflet: boolean;
};

export type ExternalProvider = "medicamentos_api_br" | "openfda";

export type ExternalMedicineResult = {
  provider: ExternalProvider;
  externalId: string;
  name: string;
  activeIngredient: string | null;
  manufacturer: string | null;
  registration: string;
  sourceLabel: string;
  sourceUrl: string | null;
  officialUrl: string;
  updatedAt: string | null;
};

export type ExternalLeafletSection = {
  key: string;
  title: string;
  paragraphs: string[];
};

export type ExternalLeafletResponse =
  | {
      status: "ok";
      provider: ExternalProvider;
      medicine: ExternalMedicineResult;
      sections: ExternalLeafletSection[];
      missingSections: string[];
      automaticExtraction: boolean;
      language: "pt-BR" | "en";
      consultedAt: string;
    }
  | {
      status: "unavailable";
      provider: ExternalProvider;
      message: string;
      officialUrl: string;
      sourceUrl: string | null;
    };

export type ProviderStatus =
  | { provider: string; status: "ok"; count: number }
  | { provider: string; status: "not_configured"; message: string }
  | { provider: string; status: "configured_not_implemented"; message: string }
  | { provider: string; status: "skipped"; message: string }
  | { provider: string; status: "error"; message: string };

export type SearchResponse = {
  results: MedicineResult[];
  externalResults: ExternalMedicineResult[];
  providers: ProviderStatus[];
};
export type SearchField = "all" | "name" | "ingredient" | "manufacturer";
