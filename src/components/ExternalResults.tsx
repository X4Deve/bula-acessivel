import { Link } from "@tanstack/react-router";
import type { UnifiedMedicineResult } from "@/lib/search-results";

const provenance: Record<UnifiedMedicineResult["origin"], string> = {
  curated: "Bula verificada",
  medicamentos_api_br: "Fonte externa brasileira — confira na Anvisa",
  openfda: "Fonte internacional (EUA) — não é bula aprovada no Brasil",
};

export function SearchResults({ medicines }: { medicines: UnifiedMedicineResult[] }) {
  if (!medicines.length) return null;
  return (
    <ul className="mt-5 space-y-3">
      {medicines.map((medicine) => (
        <li key={medicine.key} className="rounded-xl border bg-card p-5">
          <h3 className="text-xl font-semibold">{medicine.name}</h3>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            {provenance[medicine.origin]}
          </p>
          <dl className="mt-3 grid gap-x-6 gap-y-1 text-base sm:grid-cols-2">
            <Def label="Princípio ativo" value={medicine.activeIngredient} />
            <Def label="Fabricante" value={medicine.manufacturer} />
            <Def label="Concentração" value={medicine.strength} />
            <Def
              label="Forma / apresentação"
              value={
                [medicine.formulation, medicine.presentation].filter(Boolean).join(" — ") || null
              }
            />
          </dl>
          <div className="mt-3">
            {medicine.origin === "curated" && medicine.localId && medicine.hasLeaflet ? (
              <Link
                to="/medicamentos/$id/bula"
                params={{ id: medicine.localId }}
                className="inline-flex min-h-11 items-center font-semibold text-primary underline"
              >
                Consultar bula<span className="sr-only"> de {medicine.name}</span>
              </Link>
            ) : medicine.origin !== "curated" && medicine.externalId ? (
              <Link
                to="/medicamentos/externos/$provider/$externalId"
                params={{ provider: medicine.origin, externalId: medicine.externalId }}
                className="inline-flex min-h-11 items-center font-semibold text-primary underline"
              >
                Consultar bula<span className="sr-only"> de {medicine.name}</span>
              </Link>
            ) : (
              <p className="text-muted-foreground">
                Ainda não temos esta bula em texto acessível no aplicativo.
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function Def({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-1">
      <dt className="font-medium">{label}:</dt>
      <dd className="min-w-0 break-words">{value}</dd>
    </div>
  );
}
