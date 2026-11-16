import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { friendlyError } from "@/lib/auth";
import { formatDateTime } from "@/lib/medical";
import { Loading, EmptyState, LiveRegion, Notice } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ST = { pending: "Pendente", approved: "Aprovado", rejected: "Rejeitado" } as const;
type Status = keyof typeof ST;
type AdminRequest =
  Database["public"]["Functions"]["admin_list_subscription_requests"]["Returns"][number];
type ReviewSelection = { request: AdminRequest; approve: boolean };

export function AdminRequests() {
  const qc = useQueryClient();
  const [msg, setMsg] = useState("");
  const [filter, setFilter] = useState<Status>("pending");
  const [selection, setSelection] = useState<ReviewSelection | null>(null);
  const [note, setNote] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const lastTrigger = useRef<HTMLButtonElement | null>(null);
  const summaryRef = useRef<HTMLParagraphElement>(null);
  const q = useQuery({
    queryKey: ["admin-requests"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_subscription_requests");
      if (error) throw error;
      return data ?? [];
    },
  });
  const counts = useMemo(
    () => ({
      pending: q.data?.filter((request) => request.status === "pending").length ?? 0,
      approved: q.data?.filter((request) => request.status === "approved").length ?? 0,
      rejected: q.data?.filter((request) => request.status === "rejected").length ?? 0,
    }),
    [q.data],
  );
  const visible = q.data?.filter((request) => request.status === filter) ?? [];

  function openReview(request: AdminRequest, approve: boolean, trigger: HTMLButtonElement) {
    lastTrigger.current = trigger;
    setSelection({ request, approve });
    setNote("");
    setDialogError("");
    setMsg("");
  }

  function closeReview(completed = false) {
    if (submittingRef.current) return;
    setSelection(null);
    setDialogError("");
    requestAnimationFrame(() => {
      if (completed) summaryRef.current?.focus();
      else lastTrigger.current?.focus();
    });
  }

  async function confirmReview() {
    if (!selection || submittingRef.current) return;
    const trimmedNote = note.trim();
    if (!selection.approve && !trimmedNote) {
      setDialogError("Informe o motivo da rejeição.");
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setDialogError("");
    const { error } = await supabase.rpc("review_subscription_request", {
      _id: selection.request.id,
      _approve: selection.approve,
      _note: trimmedNote,
    });
    if (error) {
      const message = friendlyError(error);
      setDialogError(message);
      setMsg(message);
    } else {
      setMsg(
        selection.approve
          ? "Pedido aprovado. Premium ativado para piloto, sem cobrança ou confirmação de pagamento."
          : "Pedido rejeitado.",
      );
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin-requests"] }),
        qc.invalidateQueries({ queryKey: ["admin-stats"] }),
        qc.invalidateQueries({ queryKey: ["is-premium"] }),
      ]);
    }
    submittingRef.current = false;
    setSubmitting(false);
    if (!error) closeReview(true);
  }

  if (q.isLoading) return <Loading label="Carregando pedidos Premium…" />;
  if (q.error) return <Notice tone="error" title={friendlyError(q.error)} />;

  return (
    <div className="space-y-5">
      <LiveRegion message={msg} />
      <Notice tone="info" title="Aprovação manual, sem cobrança.">
        Aprovar ativa o Premium para piloto, sem cobrança ou confirmação de pagamento.
      </Notice>

      <p ref={summaryRef} tabIndex={-1} className="text-lg font-medium outline-none">
        {counts.pending} pedido{counts.pending === 1 ? "" : "s"} pendente
        {counts.pending === 1 ? "" : "s"}.
      </p>

      <div aria-label="Filtrar pedidos por status" className="flex flex-wrap gap-2">
        {(Object.keys(ST) as Status[]).map((status) => (
          <Button
            key={status}
            type="button"
            variant={filter === status ? "default" : "outline"}
            aria-pressed={filter === status}
            onClick={() => setFilter(status)}
          >
            {status === "pending"
              ? "Pendentes"
              : status === "approved"
                ? "Aprovados"
                : "Rejeitados"}
            <span className="sr-only">: </span>
            {counts[status]}
          </Button>
        ))}
      </div>

      {!visible.length ? (
        <EmptyState title={`Nenhum pedido ${ST[filter].toLowerCase()}.`} />
      ) : (
        <ul className="space-y-3">
          {visible.map((request) => (
            <li key={request.id} className="rounded-xl border bg-card p-5">
              <h3 className="text-lg font-semibold">
                {request.display_name || "Sem nome"} — {request.email}
              </h3>
              <p className="mt-1">
                Status: <strong>{ST[request.status]}</strong> · Pedido em{" "}
                {formatDateTime(request.created_at)}
                {request.reviewed_at ? ` · Revisado em ${formatDateTime(request.reviewed_at)}` : ""}
              </p>
              {request.admin_note && (
                <p className="mt-2 text-sm">Motivo/observação: {request.admin_note}</p>
              )}
              {request.status === "pending" && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    onClick={(event) => openReview(request, true, event.currentTarget)}
                    disabled={submitting}
                  >
                    Aprovar
                    <span className="sr-only">
                      {" "}
                      pedido de {request.display_name || request.email}
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={(event) => openReview(request, false, event.currentTarget)}
                    disabled={submitting}
                  >
                    Rejeitar
                    <span className="sr-only">
                      {" "}
                      pedido de {request.display_name || request.email}
                    </span>
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <AlertDialog
        open={!!selection}
        onOpenChange={(open) => {
          if (!open) closeReview();
        }}
      >
        <AlertDialogContent onEscapeKeyDown={(event) => submitting && event.preventDefault()}>
          {selection && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {selection.approve ? "Aprovar pedido Premium" : "Rejeitar pedido Premium"}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-base">
                  {selection.approve
                    ? "Confirme a ativação manual do Premium para piloto. Não haverá cobrança nem confirmação de pagamento."
                    : "Confirme a rejeição deste pedido. O motivo é obrigatório e ficará registrado."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <p>
                Pedido de <strong>{selection.request.display_name || "Sem nome"}</strong> —{" "}
                {selection.request.email}
              </p>
              <div className="space-y-2">
                <Label htmlFor="admin-review-note">
                  Motivo ou observação{!selection.approve ? " (obrigatório)" : " (opcional)"}
                </Label>
                <Textarea
                  id="admin-review-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={1000}
                  disabled={submitting}
                  aria-invalid={!!dialogError || undefined}
                  aria-describedby={dialogError ? "admin-review-error" : undefined}
                />
              </div>
              {dialogError && (
                <p id="admin-review-error" role="alert" className="font-medium text-destructive">
                  {dialogError}
                </p>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel className="min-h-11" disabled={submitting}>
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction
                  className="min-h-11"
                  disabled={submitting}
                  onClick={(event) => {
                    event.preventDefault();
                    void confirmReview();
                  }}
                >
                  {submitting
                    ? "Processando…"
                    : selection.approve
                      ? "Confirmar aprovação"
                      : "Confirmar rejeição"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
