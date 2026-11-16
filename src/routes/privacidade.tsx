import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Notice } from "@/components/common";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de privacidade — Bula Acessível" },
      {
        name: "description",
        content: "Como o Bula Acessível trata seus dados pessoais e de saúde.",
      },
      { property: "og:title", content: "Política de privacidade — Bula Acessível" },
      { property: "og:description", content: "Tratamento de dados no Bula Acessível." },
    ],
  }),
  component: () => (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Política de privacidade"
        description="Texto introdutório do projeto piloto. Deve ser revisado por profissional jurídico antes de uso em produção."
      />
      <Notice
        tone="warning"
        title="Este texto não representa certificação de conformidade com a LGPD."
      />
      <section>
        <h2 className="text-2xl font-semibold">Quais dados guardamos</h2>
        <p className="mt-2">
          Nome, email, preferências de acessibilidade e o que você decidir registrar: bulas salvas,
          medicamentos marcados como em uso, categorias, lembretes e check-ins. A consulta de bulas
          sem conta não guarda dados pessoais.
        </p>
      </section>
      <section>
        <h2 className="text-2xl font-semibold">Dados de saúde</h2>
        <p className="mt-2">
          Medicamentos em uso e check-ins são dados pessoais sensíveis. São visíveis apenas para
          você, protegidos por regras de acesso no banco de dados. O acompanhamento exige
          consentimento específico, que pode ser retirado a qualquer momento.
        </p>
      </section>
      <section>
        <h2 className="text-2xl font-semibold">Histórico de buscas</h2>
        <p className="mt-2">Desligado por padrão. Só é guardado se você ativar em Configurações.</p>
      </section>
      <section>
        <h2 className="text-2xl font-semibold">Seus direitos</h2>
        <p className="mt-2">
          Em Configurações você pode exportar seus dados, apagar dados pessoais e excluir a conta.
          Administradores veem apenas nome e email em pedidos de Premium, e números agregados.
        </p>
      </section>
      <section>
        <h2 className="text-2xl font-semibold">Rastreadores</h2>
        <p className="mt-2">
          Não usamos rastreadores de publicidade nem enviamos dados de saúde a ferramentas de
          análise.
        </p>
      </section>
    </div>
  ),
});
