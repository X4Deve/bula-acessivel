import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, ShieldCheck, BellRing, BookOpen } from "lucide-react";
import { BULARIO_URL } from "@/lib/medical";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bula Acessível — bulas oficiais em texto acessível e gratuito" },
      {
        name: "description",
        content:
          "Leia bulas oficiais verificadas, com navegação por títulos para NVDA, VoiceOver e leitores de tela. Grátis, sem inventar conteúdo.",
      },
      { property: "og:title", content: "Bula Acessível" },
      {
        property: "og:description",
        content: "Bulas oficiais verificadas em texto acessível, grátis para todos.",
      },
    ],
  }),
  component: Home,
});

const steps = [
  {
    icon: Search,
    t: "Pesquise",
    d: "Digite o nome do medicamento ou o princípio ativo e pressione Buscar.",
  },
  {
    icon: ShieldCheck,
    t: "Confira a fonte",
    d: "Cada bula mostra de onde veio o texto, quem revisou e quando foi conferida.",
  },
  {
    icon: BookOpen,
    t: "Leia por seções",
    d: "Use a tecla H do seu leitor de telas para pular entre as seções da bula.",
  },
];

function Home() {
  const { user } = useAuth();
  return (
    <div className="space-y-16">
      <section
        aria-labelledby="titulo"
        className="rounded-2xl bg-brand px-6 py-12 text-brand-foreground md:px-12 md:py-16"
      >
        <h1 id="titulo" className="max-w-3xl text-4xl font-bold leading-tight md:text-5xl">
          Bulas oficiais, em texto acessível e gratuito.
        </h1>
        <p className="mt-4 max-w-2xl text-lg md:text-xl">
          Feito para quem usa leitor de telas ou tem baixa visão. Mostramos somente textos
          conferidos a partir de fontes oficiais — nunca criados por inteligência artificial.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/buscar"
            className="inline-flex min-h-12 items-center gap-2 rounded-md bg-background px-6 text-lg font-semibold text-brand hover:bg-surface"
          >
            <Search className="size-5" aria-hidden="true" /> Pesquisar medicamento
          </Link>
          {!user && (
            <>
              <Link
                to="/entrar"
                className="inline-flex min-h-12 items-center rounded-md border-2 border-brand-foreground px-6 text-lg font-semibold hover:bg-brand-foreground/10"
              >
                Entrar
              </Link>
              <Link
                to="/cadastro"
                className="inline-flex min-h-12 items-center rounded-md border-2 border-brand-foreground px-6 text-lg font-semibold hover:bg-brand-foreground/10"
              >
                Criar conta
              </Link>
            </>
          )}
        </div>
      </section>

      <section aria-labelledby="como">
        <h2 id="como" className="text-3xl font-bold text-brand">
          Como funciona
        </h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.t} className="rounded-xl border bg-card p-6">
              <s.icon className="size-8 text-primary" aria-hidden="true" />
              <h3 className="mt-3 text-xl font-semibold">
                {i + 1}. {s.t}
              </h3>
              <p className="mt-2 text-muted-foreground">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="gratis" className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border bg-surface p-6">
          <h2 id="gratis" className="text-2xl font-bold text-brand">
            Bula sempre grátis
          </h2>
          <p className="mt-2">
            Ler bulas não exige cadastro nem pagamento. Criar conta serve apenas para salvar sua
            biblioteca e preferências.
          </p>
          <p className="mt-2">
            Se ainda não tivermos uma bula, indicamos o{" "}
            <a
              href={BULARIO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-primary underline"
            >
              Bulário Eletrônico da Anvisa (abre em nova aba)
            </a>
            .
          </p>
        </div>
        <div className="rounded-xl border bg-surface p-6">
          <h2 className="flex items-center gap-2 text-2xl font-bold text-brand">
            <BellRing className="size-6" aria-hidden="true" /> Premium opcional
          </h2>
          <p className="mt-2">
            Organização de lembretes com os horários que você mesmo define a partir da sua receita,
            e acompanhamento pessoal opcional.
          </p>
          <Link
            to="/planos"
            className="mt-3 inline-flex min-h-11 items-center font-semibold text-primary underline"
          >
            Comparar planos
          </Link>
        </div>
      </section>
    </div>
  );
}
