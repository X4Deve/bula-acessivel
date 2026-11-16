import { useId, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { MEDICAL_DISCLAIMER } from "@/lib/medical";

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-brand md:text-4xl">{title}</h1>
        {description && <p className="mt-2 text-lg text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}

type Tone = "info" | "success" | "warning" | "error";
const toneCls: Record<Tone, string> = {
  info: "bg-info-soft border-primary/40 text-foreground",
  success: "bg-success-soft border-success text-foreground",
  warning: "bg-warning-soft border-warning text-foreground",
  error: "bg-destructive/5 border-destructive text-foreground",
};
const toneIcon = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertTriangle,
};
const toneLabel = { info: "Informação", success: "Sucesso", warning: "Atenção", error: "Erro" };

/** Mensagem visível com rótulo textual (não depende só de cor). */
export function Notice({
  tone = "info",
  title,
  children,
  className,
  live,
}: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  className?: string;
  live?: "polite" | "assertive";
}) {
  const Icon = toneIcon[tone];
  return (
    <div
      className={cn("flex gap-3 rounded-lg border-l-4 border p-4", toneCls[tone], className)}
      role={live === "assertive" ? "alert" : live === "polite" ? "status" : undefined}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-semibold">
          <span className="sr-only">{toneLabel[tone]}: </span>
          {title}
        </p>
        {children && <div className={cn(title && "mt-1")}>{children}</div>}
      </div>
    </div>
  );
}

/** Região viva sempre presente no DOM para anúncios por leitores de tela. */
export function LiveRegion({ message, assertive }: { message: string; assertive?: boolean }) {
  return (
    <div aria-live={assertive ? "assertive" : "polite"} aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}

export function Loading({ label = "Carregando…" }: { label?: string }) {
  return (
    <p role="status" className="flex items-center gap-2 py-6 text-muted-foreground">
      <Loader2 className="size-5 animate-spin" aria-hidden="true" /> {label}
    </p>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed bg-surface p-6">
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-2 text-muted-foreground">{children}</div>}
    </div>
  );
}

export function MedicalDisclaimer() {
  return (
    <p className="rounded-md bg-surface px-4 py-3 text-sm text-muted-foreground">
      <strong className="text-foreground">Importante:</strong> {MEDICAL_DISCLAIMER}
    </p>
  );
}

export function TextField({
  label,
  error,
  hint,
  className,
  id: idProp,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
}) {
  const gen = useId();
  const id = idProp ?? gen;
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="text-base font-medium">
        {label}
        {props.required && (
          <span aria-hidden="true" className="text-destructive">
            {" "}
            *
          </span>
        )}
      </Label>
      {hint && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      <Input
        id={id}
        aria-invalid={!!error || undefined}
        aria-describedby={[hintId, errId].filter(Boolean).join(" ") || undefined}
        className="min-h-11 text-base"
        {...props}
      />
      {error && (
        <p id={errId} className="text-sm font-medium text-destructive">
          Erro: {error}
        </p>
      )}
    </div>
  );
}

export function Card({
  children,
  className,
  as: As = "section",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article" | "li";
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <As className={cn("rounded-xl border bg-card p-5 shadow-sm md:p-6", className)} {...rest}>
      {children}
    </As>
  );
}

export function ErrorSummary({
  errors,
  title = "Corrija os campos abaixo:",
}: {
  errors: { id: string; msg: string }[];
  title?: string;
}) {
  if (!errors.length) return null;
  return (
    <div
      role="alert"
      className="rounded-lg border-l-4 border border-destructive bg-destructive/5 p-4"
    >
      <p className="font-semibold">{title}</p>
      <ul className="mt-2 list-disc pl-5">
        {errors.map((e) => (
          <li key={e.id}>
            <a href={`#${e.id}`} className="text-destructive underline">
              {e.msg}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
