import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useIsPremium } from "@/lib/auth";
import { Loading, Notice } from "@/components/common";

export function PremiumGate({ children }: { children: ReactNode }) {
  const p = useIsPremium();
  if (p.isLoading) return <Loading label="Verificando plano…" />;
  if (!p.data) {
    return (
      <Notice tone="info" title="Recurso do plano Premium.">
        A leitura de bulas continua gratuita.{" "}
        <Link to="/planos" className="font-semibold text-primary underline">
          Ver planos e solicitar Premium
        </Link>
        .
      </Notice>
    );
  }
  return <>{children}</>;
}
