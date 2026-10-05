"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import { PortalPage } from "@/components/portal/portal-page";
import { StatusPill } from "@/components/portal/status-pill";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getCustomerChangeOrder,
  respondCustomerChangeOrder,
  type CustomerChangeOrder,
} from "@/lib/api/customer-change-orders";
import { customerPaths } from "@/lib/customer-paths";
import { formatMoney, formatShortDate } from "@/lib/format";

function isPending(status: string) {
  return ["pending", "pending_approval"].includes(
    String(status || "").toLowerCase(),
  );
}

export function CustomerChangeOrderDetailView({
  jobId,
  orderId,
}: {
  jobId: string;
  orderId: string;
}) {
  const [item, setItem] = useState<CustomerChangeOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState<"approve" | "reject" | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void getCustomerChangeOrder(jobId, orderId)
      .then((row) => {
        if (!cancelled) setItem(row);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [jobId, orderId]);

  const respond = async (approved: boolean) => {
    setSaving(approved ? "approve" : "reject");
    try {
      const next = await respondCustomerChangeOrder(jobId, orderId, {
        approved,
        customerNote: note.trim(),
      });
      if (next) setItem(next);
      toast.success(
        approved ? "Change order approved." : "Change order rejected.",
      );
    } catch (err) {
      toast.error(extractErrorMessage(err) || "Could not submit your response.");
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <PortalPage title="Change order">
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading…
        </div>
      </PortalPage>
    );
  }

  if (!item) {
    return (
      <PortalPage title="Change order">
        <div className="rounded-md border border-dashed border-border-soft px-4 py-10 text-center text-sm text-muted-foreground">
          Change order not found.{" "}
          <Link
            href={customerPaths.changeOrders}
            className="font-medium text-primary hover:underline"
          >
            Back to list
          </Link>
        </div>
      </PortalPage>
    );
  }

  const pending = isPending(item.status);

  return (
    <PortalPage
      title={item.number || "Change order"}
      description="Review the additional work and amount before you approve."
      actions={
        <Button size="sm" variant="outline" className="h-8" asChild>
          <Link href={customerPaths.changeOrders}>All change orders</Link>
        </Button>
      }
    >
      <div className="mx-auto max-w-2xl space-y-5">
        {pending ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-semibold">Action required</p>
            <p className="mt-0.5">
              This change order needs your approval before the provider can
              proceed with the additional work.
            </p>
          </div>
        ) : null}

        <div className="rounded-md border border-border-soft px-4 py-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight">
              {item.number}
            </h2>
            <StatusPill
              label={
                pending
                  ? "Pending approval"
                  : item.status === "approved"
                    ? "Approved"
                    : item.status === "rejected"
                      ? "Rejected"
                      : item.status
              }
              tone={
                pending
                  ? "warning"
                  : item.status === "approved"
                    ? "success"
                    : "danger"
              }
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Job {item.jobNumber || "—"}
            {item.customerName ? ` · ${item.customerName}` : ""}
          </p>
          {item.propertyAddress ? (
            <p className="text-sm text-muted-foreground">{item.propertyAddress}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Reason
          </p>
          <p className="text-sm font-medium text-foreground">
            {item.title || "Additional work"}
          </p>
        </div>

        {item.description ? (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Scope of change
            </p>
            <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
              {item.description}
            </p>
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Line items
          </p>
          <ul className="divide-y divide-border-soft rounded-md border border-border-soft">
            {(item.items || []).map((line, index) => (
              <li
                key={line.id || `${index}`}
                className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">{line.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {line.kind || "item"} · qty {line.quantity ?? 1}
                  </p>
                </div>
                <span className="shrink-0 font-semibold tabular-nums">
                  {formatMoney(Number(line.total) || 0)}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-right text-base font-semibold tabular-nums">
            Additional amount: {formatMoney(item.amount)}
          </p>
        </div>

        {item.customerNotes ? (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Notes from provider
            </p>
            <p className="text-sm text-foreground">{item.customerNotes}</p>
          </div>
        ) : null}

        {item.customerNote ? (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Your comment
            </p>
            <p className="text-sm text-foreground">{item.customerNote}</p>
          </div>
        ) : null}

        {!pending && item.approvedAt ? (
          <p className="text-xs text-muted-foreground">
            Approved {formatShortDate(item.approvedAt)}
            {item.approvedBy ? ` by ${item.approvedBy}` : ""}
          </p>
        ) : null}
        {!pending && item.rejectedAt ? (
          <p className="text-xs text-muted-foreground">
            Rejected {formatShortDate(item.rejectedAt)}
            {item.rejectedBy ? ` by ${item.rejectedBy}` : ""}
          </p>
        ) : null}

        {pending ? (
          <div className="space-y-3 rounded-md border border-border-soft p-4">
            <div className="space-y-1.5">
              <Label htmlFor="co-note">Comment (optional)</Label>
              <Textarea
                id="co-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Add a note if you reject or want to leave a comment…"
                disabled={Boolean(saving)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={Boolean(saving)}
                onClick={() => void respond(true)}
              >
                {saving === "approve" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : null}
                Approve change order
              </Button>
              <Button
                variant="outline"
                disabled={Boolean(saving)}
                onClick={() => void respond(false)}
              >
                {saving === "reject" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : null}
                Reject change order
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </PortalPage>
  );
}
