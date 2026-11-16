import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Notice } from "@/components/common";
import { MEDICAL_DISCLAIMER } from "@/lib/medical";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de uso — Bula Acessível" },
      { name: "description", content: "Condições de uso do Bula Acessível." },
      { property: "og:title", content: "Termos de uso — Bula Acessível" },
      { property: "og:description", content: "Condições de uso do projeto piloto." },
    ],
  }),
  component: () => (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Termos de uso"
        description="Texto introdutório do projeto piloto, sujeito a revisão jurídica."
      />
      <Notice tone="info" title={MEDICAL_DISCLAIMER} />
      <section>
        <h2 className="text-2xl font-semibold">O que o serviço oferece</h2>
        <p className="mt-2">
          Reprodução em texto acessível de bulas obtidas de fontes oficiais e revisadas por pessoas.
          Não criamos, resumimos nem interpretamos conteúdo clínico.
        </p>
      </section>
      <section>
        <h2 className="text-2xl font-semibold">Acesso gratuito</h2>
        <p className="mt-2">
          A leitura de bulas é e continuará gratuita. O plano Premium cobre apenas organização de
          lembretes e acompanhamento pessoal.
        </p>
      </section>
      <section>
        <h2 className="text-2xl font-semibold">Pagamentos</h2>
        <p className="mt-2">
          Nesta fase piloto não há cobrança. Pedidos de Premium são aprovados manualmente e nenhum
          valor é cobrado.
        </p>
      </section>
      <section>
        <h2 className="text-2xl font-semibold">Lembretes</h2>
        <p className="mt-2">
          Os horários são definidos por você a partir da sua prescrição. Alertas externos (email,
          notificações) não estão garantidos enquanto o canal de envio não for configurado.
        </p>
      </section>
    </div>
  ),
});
