"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  FilePlus2,
  Info,
  Loader2,
  MapPin,
  MessageSquare,
  Paperclip,
  Receipt,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import { PortalPage } from "@/components/portal/portal-page";
import { StatusPill } from "@/components/portal/status-pill";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CenteredSpinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  getCustomerChangeOrder,
  respondCustomerChangeOrder,
  type CustomerChangeOrder,
} from "@/lib/api/customer-change-orders";
import { customerPaths } from "@/lib/customer-paths";
import { formatMoney, formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  isPendingChangeOrderStatus,
  selectCustomerChangeOrders,
  upsertCustomerChangeOrder,
} from "@/store/customerChangeOrdersSlice";
import { selectCustomerOrders } from "@/store/ordersSlice";

type LineKind = "labor" | "material" | "equipment" | "other";

function lineKind(kind?: string): LineKind {
  const value = String(kind || "labor").toLowerCase();
  if (value === "material" || value === "materials") return "material";
  if (value === "equipment") return "equipment";
  if (value === "labor" || value === "labour" || value === "service") return "labor";
  return "other";
}

const KIND_LABEL: Record<LineKind, string> = {
  labor: "Labour",
  material: "Material",
  equipment: "Equipment",
  other: "Other",
};

function statusLabel(status: string) {
  const clean = String(status || "").toLowerCase();
  if (isPendingChangeOrderStatus(clean)) return "Awaiting your approval";
  if (clean === "approved") return "Approved";
  if (clean === "rejected") return "Rejected";
  if (clean === "cancelled") return "Cancelled";
  return clean || "—";
}

function statusTone(status: string) {
  const clean = String(status || "").toLowerCase();
  if (isPendingChangeOrderStatus(clean)) return "warning" as const;
  if (clean === "approved") return "success" as const;
  return "danger" as const;
}

function isImageUrl(url: string) {
  return /\.(png|jpe?g|gif|webp|bmp|svg|heic)(\?|$)/i.test(url);
}

export function CustomerChangeOrderDetailView({
  jobId,
  orderId,
}: {
  jobId: string;
  orderId: string;
}) {
  const dispatch = useAppDispatch();
  const cachedList = useAppSelector(selectCustomerChangeOrders);
  const orders = useAppSelector(selectCustomerOrders);
  const cached = useMemo(
    () =>
      cachedList.find(
        (co) => String(co.jobId) === String(jobId) && String(co.id) === String(orderId),
      ) ?? null,
    [cachedList, jobId, orderId],
  );
  const [fetched, setFetched] = useState<CustomerChangeOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState<"approve" | "reject" | null>(null);
  const item = fetched ?? cached;

  useEffect(() => {
    let cancelled = false;
    void getCustomerChangeOrder(jobId, orderId)
      .then((row) => {
        if (cancelled || !row) return;
        setFetched(row);
        dispatch(upsertCustomerChangeOrder(row));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dispatch, jobId, orderId]);

  const totals = useMemo(() => {
    const sums: Record<LineKind, number> = { labor: 0, material: 0, equipment: 0, other: 0 };
    for (const line of item?.items || []) {
      sums[lineKind(line.kind)] += Number(line.total) || 0;
    }
    return sums;
  }, [item?.items]);

  const provider = useMemo(
    () => orders.find((order) => String(order.id) === String(jobId))?.provider ?? null,
    [jobId, orders],
  );

  const respond = async (approved: boolean) => {
    setSaving(approved ? "approve" : "reject");
    try {
      const next = await respondCustomerChangeOrder(jobId, orderId, {
        approved,
        customerNote: note.trim(),
      });
      if (next) {
        setFetched(next);
        dispatch(upsertCustomerChangeOrder(next));
      }
      setNote("");
      toast.success(approved ? "Change order approved." : "Change order rejected.");
    } catch (err) {
      toast.error(extractErrorMessage(err) || "Could not submit your response.");
    } finally {
      setSaving(null);
    }
  };

  if (!item && loading) {
    return (
      <PortalPage eyebrow="Change order" title="Change order">
        <CenteredSpinner label="Loading change order…" className="min-h-64" />
      </PortalPage>
    );
  }

  if (!item) {
    return (
      <PortalPage eyebrow="Change order" title="Change order">
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

  const pending = isPendingChangeOrderStatus(item.status);
  const approved = String(item.status || "").toLowerCase() === "approved";
  const breakdown = (Object.keys(KIND_LABEL) as LineKind[]).filter(
    (kind) => kind === "labor" || kind === "material" || totals[kind] > 0,
  );

  return (
    <PortalPage
      eyebrow="Change order"
      title={`${item.number || "Change order"}${item.title ? ` · ${item.title}` : ""}`}
      description={`Additional work on Job ${item.jobNumber || "—"} — priced, approved, and paid separately from the original job.`}
      badge={<StatusPill label={statusLabel(item.status)} tone={statusTone(item.status)} />}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {item.jobId ? (
            <Button size="sm" variant="outline" className="h-8" asChild>
              <Link href={customerPaths.order(item.jobId)}>
                View job {item.jobNumber || ""}
              </Link>
            </Button>
          ) : null}
          <Button size="sm" variant="outline" className="h-8" asChild>
            <Link href={customerPaths.changeOrders}>All change orders</Link>
          </Button>
        </div>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-5">
          {pending ? (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <Info className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-semibold">Your approval is needed</p>
                <p className="mt-0.5">
                  Your provider has requested additional work. Review the scope and
                  price below, then approve or reject it.
                </p>
              </div>
            </div>
          ) : null}

          <div className="flex items-start gap-3 rounded-xl border border-[#003F7D]/20 bg-[#e8eef5] px-4 py-3 text-sm text-[#003F7D]">
            <FilePlus2 className="mt-0.5 size-4 shrink-0" />
            <p>
              <span className="font-semibold">This is a change order, not part of your original job amount.</span>{" "}
              It has its own price, its own invoice, and is paid separately.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-input bg-card px-4 py-3 shadow-xs">
              <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                Change order total
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-[#003F7D]">
                {formatMoney(item.amount)}
              </p>
            </div>
            {breakdown.map((kind) => (
              <div key={kind} className="rounded-xl border border-input bg-card px-4 py-3 shadow-xs">
                <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                  {KIND_LABEL[kind]}
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                  {formatMoney(totals[kind])}
                </p>
              </div>
            ))}
          </div>

          <section className="rounded-xl border border-input bg-card p-5 shadow-xs">
            <h2 className="text-base font-semibold text-foreground">What was requested</h2>
            <dl className="mt-4 space-y-4 text-sm">
              <div>
                <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                  Reason
                </dt>
                <dd className="mt-1 font-medium text-foreground">
                  {item.title || "Additional work"}
                </dd>
              </div>
              {item.description && item.description !== item.title ? (
                <div>
                  <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                    Scope of change
                  </dt>
                  <dd className="mt-1 whitespace-pre-wrap leading-6 text-foreground">
                    {item.description}
                  </dd>
                </div>
              ) : null}
              {item.customerNotes ? (
                <div>
                  <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                    Notes from your provider
                  </dt>
                  <dd className="mt-1 whitespace-pre-wrap text-foreground">{item.customerNotes}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="overflow-hidden rounded-xl border border-input bg-card shadow-xs">
            <div className="border-b border-input px-5 py-3">
              <h2 className="text-base font-semibold text-foreground">Labour & material</h2>
              <p className="text-xs text-muted-foreground">Itemised cost of the additional work.</p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(item.items || []).length ? (
                    item.items.map((line, index) => {
                      const kind = lineKind(line.kind);
                      return (
                        <TableRow key={line.id || `${index}`}>
                          <TableCell>
                            <span
                              className={cn(
                                "inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                                kind === "labor" && "bg-[#e8eef5] text-[#003F7D]",
                                kind === "material" && "bg-emerald-50 text-emerald-800",
                                kind === "equipment" && "bg-amber-50 text-amber-800",
                                kind === "other" && "bg-muted text-foreground",
                              )}
                            >
                              {KIND_LABEL[kind]}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium whitespace-normal">
                            {line.description}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {line.quantity ?? 1}
                            {line.unit ? ` ${line.unit}` : ""}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatMoney(Number(line.unitPrice) || 0)}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            {formatMoney(Number(line.total) || 0)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                        No itemised lines — see the total above.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between border-t border-input bg-muted/30 px-5 py-3 text-sm">
              <span className="text-muted-foreground">Change order total (separate from job)</span>
              <span className="text-base font-semibold tabular-nums text-[#003F7D]">
                {formatMoney(item.amount)}
              </span>
            </div>
          </section>

          {(item.attachments || []).length ? (
            <section className="rounded-xl border border-input bg-card p-5 shadow-xs">
              <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                <Paperclip className="size-4 text-primary" />
                Attachments
              </h2>
              <div className="mt-3 flex flex-wrap gap-3">
                {(item.attachments || []).map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-block"
                  >
                    {isImageUrl(url) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={url}
                        alt="Change order attachment"
                        className="h-24 w-auto rounded border border-input object-cover group-hover:border-primary/60"
                      />
                    ) : (
                      <span className="text-sm text-primary hover:underline">View attachment</span>
                    )}
                  </a>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-4">
          {pending ? (
            <section className="rounded-xl border-2 border-amber-300 bg-card p-5 shadow-xs">
              <h2 className="text-base font-semibold text-foreground">Your decision</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Approving adds {formatMoney(item.amount)} of extra work, billed on its own
                invoice. Rejecting leaves your original job unchanged.
              </p>
              <div className="mt-4 space-y-1.5">
                <Label htmlFor="co-note">Comment (optional)</Label>
                <Textarea
                  id="co-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Add a note for your provider…"
                  disabled={Boolean(saving)}
                />
              </div>
              <div className="mt-4 grid gap-2">
                <Button disabled={Boolean(saving)} onClick={() => void respond(true)}>
                  {saving === "approve" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-3.5" />
                  )}
                  Approve change order
                </Button>
                <Button
                  variant="outline"
                  className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                  disabled={Boolean(saving)}
                  onClick={() => void respond(false)}
                >
                  {saving === "reject" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <XCircle className="size-3.5" />
                  )}
                  Reject change order
                </Button>
              </div>
            </section>
          ) : (
            <section className="rounded-xl border border-input bg-card p-5 shadow-xs">
              <h2 className="text-base font-semibold text-foreground">Decision</h2>
              <div className="mt-2 text-sm">
                <StatusPill label={statusLabel(item.status)} tone={statusTone(item.status)} />
                {item.approvedAt ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Approved {formatShortDate(item.approvedAt)}
                    {item.approvedBy ? ` by ${item.approvedBy}` : ""}
                  </p>
                ) : null}
                {item.rejectedAt ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Rejected {formatShortDate(item.rejectedAt)}
                    {item.rejectedBy ? ` by ${item.rejectedBy}` : ""}
                  </p>
                ) : null}
                {item.customerNote ? (
                  <p className="mt-3 rounded-md bg-muted/40 px-3 py-2 text-xs text-foreground">
                    <span className="font-semibold">Your comment:</span> {item.customerNote}
                  </p>
                ) : null}
              </div>
            </section>
          )}

          <section className="rounded-xl border border-input bg-card p-5 shadow-xs">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Receipt className="size-4 text-primary" />
              Separate billing
            </h2>
            {item.billingInvoiceId ? (
              <div className="mt-3 space-y-3 text-sm">
                <p className="text-muted-foreground">
                  Invoice{" "}
                  <span className="font-semibold text-foreground">
                    {item.billingInvoiceNumber || "—"}
                  </span>{" "}
                  covers this change order only — pay it separately from your job invoice.
                </p>
                <Button size="sm" className="h-8 w-full" asChild>
                  <Link href={customerPaths.invoice(item.billingInvoiceId)}>View invoice</Link>
                </Button>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                {approved
                  ? "Your provider will send a separate invoice for this change order."
                  : "If approved, this change order is billed on its own invoice — never added to your original job total."}
              </p>
            )}
          </section>

          <section className="rounded-xl border border-input bg-card p-5 shadow-xs">
            <h2 className="text-sm font-semibold text-foreground">Job</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Job</dt>
                <dd>
                  {item.jobId ? (
                    <Link
                      href={customerPaths.order(item.jobId)}
                      className="font-semibold text-primary hover:underline"
                    >
                      {item.jobNumber || "View job"}
                    </Link>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              {item.sentAt ? (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Sent</dt>
                  <dd className="font-medium">{formatShortDate(item.sentAt)}</dd>
                </div>
              ) : null}
              {item.propertyAddress ? (
                <div className="flex items-start gap-2 pt-1 text-muted-foreground">
                  <MapPin className="mt-0.5 size-3.5 shrink-0" />
                  <span>{item.propertyAddress}</span>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="rounded-xl border border-input bg-card p-5 shadow-xs">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Building2 className="size-4 text-primary" />
              Service professional
            </h2>
            <p className="mt-3 font-semibold text-foreground">
              {provider?.companyName || "Your service professional"}
            </p>
            {provider?.phone ? (
              <p className="text-xs text-muted-foreground">{provider.phone}</p>
            ) : null}
            <Button asChild size="sm" variant="outline" className="mt-3 h-8 w-full">
              <Link href={customerPaths.messages}>
                <MessageSquare className="size-3.5" />
                Message provider
              </Link>
            </Button>
          </section>
        </aside>
      </div>
    </PortalPage>
  );
}
