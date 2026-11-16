import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, MedicalDisclaimer } from "@/components/common";
import { SearchPanel } from "@/components/SearchPanel";

export const Route = createFileRoute("/buscar")({
  head: () => ({
    meta: [
      { title: "Pesquisar medicamento — Bula Acessível" },
      {
        name: "description",
        content:
          "Pesquise bulas oficiais verificadas por nome comercial, princípio ativo ou fabricante.",
      },
      { property: "og:title", content: "Pesquisar medicamento — Bula Acessível" },
      { property: "og:description", content: "Busca acessível em bulas oficiais verificadas." },
    ],
  }),
  component: () => (
    <div className="space-y-6">
      <PageHeader
        title="Pesquisar medicamento"
        description="Digite o nome e pressione Enter ou o botão Buscar. Os resultados são anunciados pelo leitor de telas."
      />
      <SearchPanel />
      <MedicalDisclaimer />
    </div>
  ),
});
