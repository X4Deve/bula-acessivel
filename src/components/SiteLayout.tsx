import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, type ReactNode } from "react";
import { BookOpen } from "lucide-react";
import { useAuth, useIsAdmin, signOutClean } from "@/lib/auth";
import { BULARIO_URL } from "@/lib/medical";

const navLink =
  "inline-flex min-h-11 items-center rounded-md px-3 font-medium text-foreground hover:bg-accent aria-[current=page]:bg-secondary aria-[current=page]:text-brand aria-[current=page]:underline aria-[current=page]:underline-offset-4";

export function SiteLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { data: isAdmin } = useIsAdmin();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const first = useRef(true);

  // Em navegação interna, leva o foco ao conteúdo principal para que o leitor de telas anuncie a nova página.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    mainRef.current?.focus();
  }, [location.pathname]);

  async function logout() {
    await signOutClean(qc);
    navigate({ to: "/entrar", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo principal
      </a>
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link
            to="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-md text-xl font-bold text-brand"
          >
            <BookOpen className="size-7" aria-hidden="true" />
            Bula Acessível
          </Link>
          <nav aria-label="Navegação principal">
            <ul className="flex flex-wrap items-center gap-1">
              <li>
                <Link to="/buscar" className={navLink}>
                  Pesquisar
                </Link>
              </li>
              <li>
                <Link to="/planos" className={navLink}>
                  Planos
                </Link>
              </li>
              {user ? (
                <>
                  <li>
                    <Link to="/app" className={navLink} activeOptions={{ exact: true }}>
                      Meu painel
                    </Link>
                  </li>
                  <li>
                    <Link to="/app/minha-biblioteca" className={navLink}>
                      Biblioteca
                    </Link>
                  </li>
                  <li>
                    <Link to="/app/configuracoes" className={navLink}>
                      Configurações
                    </Link>
                  </li>
                  {isAdmin && (
                    <li>
                      <Link to="/admin" className={navLink}>
                        Gerenciar assinaturas
                      </Link>
                    </li>
                  )}
                  <li>
                    <button type="button" onClick={logout} className={navLink}>
                      Sair
                    </button>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <Link to="/entrar" className={navLink}>
                      Entrar
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/cadastro"
                      className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      Criar conta
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </nav>
        </div>
      </header>
      <main
        id="conteudo"
        ref={mainRef}
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 outline-none md:py-12"
      >
        {children}
      </main>
      <footer className="border-t bg-surface">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 md:grid-cols-3">
          <div>
            <p className="font-bold text-brand">Bula Acessível</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Acesso gratuito ao texto de bulas oficiais verificadas. Não substitui orientação
              médica.
            </p>
          </div>
          <nav aria-label="Links do rodapé">
            <ul className="space-y-1">
              <li>
                <Link to="/privacidade" className="inline-flex min-h-11 items-center underline">
                  Política de privacidade
                </Link>
              </li>
              <li>
                <Link to="/termos" className="inline-flex min-h-11 items-center underline">
                  Termos de uso
                </Link>
              </li>
              <li>
                <a
                  href={BULARIO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center underline"
                >
                  Bulário Eletrônico da Anvisa (abre em nova aba)
                </a>
              </li>
            </ul>
          </nav>
          <p className="text-sm text-muted-foreground">
            Projeto piloto. A Anvisa não é parceira nem endossa este aplicativo.
          </p>
        </div>
      </footer>
    </div>
  );
}
