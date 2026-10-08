"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FileText, Loader2, Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import { JobChangeOrderDialog } from "@/components/portal/job-change-order-dialog";
import { StatusPill } from "@/components/portal/status-pill";
import {
  createJobChangeOrderInvoice,
  sendJobChangeOrder,
  updateJobChangeOrderStatus,
} from "@/lib/api/crm-client";
import { formatMoney, formatShortDate } from "@/lib/format";
import type { ChangeOrder, Job } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function coStatusTone(status: ChangeOrder["status"]) {
  switch (status) {
    case "approved":
      return "success" as const;
    case "rejected":
    case "cancelled":
      return "danger" as const;
    case "pending_approval":
      return "warning" as const;
    case "draft":
    default:
      return "neutral" as const;
  }
}

function coStatusLabel(status: ChangeOrder["status"]) {
  switch (status) {
    case "pending_approval":
      return "Pending approval";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "cancelled":
      return "Cancelled";
    case "draft":
      return "Draft";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function itemKindLabel(kind?: string) {
  if (kind === "materials") return "Material";
  if (kind === "equipment") return "Equipment";
  return "Labour";
}

function sumByStatus(orders: ChangeOrder[], status: ChangeOrder["status"]) {
  return orders
    .filter((co) => co.status === status)
    .reduce((sum, co) => sum + (Number(co.total) || 0), 0);
}

/** Customer change order vs internal scope update (contractor / technician). */
function ChangeOrderKindBadge({ co }: { co: ChangeOrder }) {
  const kind = co.requestedBy?.participantType;
  const label = !kind
    ? "Customer change order"
    : kind === "contractor"
      ? "Internal scope update (Contractor)"
      : "Internal scope update (Technician)";
  const tone = !kind
    ? "bg-[#eef3f9] text-[#003f7d]"
    : kind === "contractor"
      ? "bg-[#e7f5f1] text-[#0f7b68]"
      : "bg-[#e0f5f9] text-[#0e7490]";
  return <span className={`rounded-full px-2 text-[10px] font-semibold leading-5 ${tone}`}>{label}</span>;
}

export function JobChangeOrdersPanel({
  job,
  originalAmount,
  invoiceId,
  locked = false,
  onJobUpdated,
}: {
  job: Job;
  originalAmount: number;
  invoiceId?: string;
  /** Completed job — no new change orders. */
  locked?: boolean;
  onJobUpdated?: (job: Job) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const consumedCreateParam = useRef(false);
  const orders = useMemo(() => job.changeOrders || [], [job.changeOrders]);
  // Totals are customer billing only; internal scope updates are never billed.
  const customerOrders = useMemo(() => orders.filter((co) => !co.requestedBy), [orders]);

  /** Open once from ?create=1, then strip it so the tab never reopens the modal. */
  useEffect(() => {
    if (searchParams.get("create") !== "1") return;
    if (!consumedCreateParam.current) {
      consumedCreateParam.current = true;
      setOpen(true);
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete("create");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [searchParams, pathname, router]);

  const approved = useMemo(
    () => sumByStatus(customerOrders, "approved"),
    [customerOrders],
  );
  const pending = useMemo(
    () => sumByStatus(customerOrders, "pending_approval"),
    [customerOrders],
  );
  const rejected = useMemo(
    () => sumByStatus(customerOrders, "rejected"),
    [customerOrders],
  );

  const send = async (co: ChangeOrder) => {
    setBusyId(co.id);
    try {
      const next = await sendJobChangeOrder(job.id, co.id);
      toast.success(`Sent ${co.number} to the customer.`);
      if (next) onJobUpdated?.(next);
    } catch (err) {
      toast.error(extractErrorMessage(err) || "Could not send change order.");
    } finally {
      setBusyId(null);
    }
  };

  /** Approved change orders are billed on their own invoice — never the job invoice. */
  const createInvoice = async (co: ChangeOrder) => {
    setBusyId(co.id);
    try {
      const invoice = await createJobChangeOrderInvoice(job.id, co.id);
      if (!invoice) throw new Error("Invoice was not created");
      toast.success(`${invoice.number} created for ${co.number}.`);
      onJobUpdated?.({
        ...job,
        changeOrders: orders.map((item) =>
          item.id === co.id
            ? {
                ...item,
                billingInvoiceId: invoice.id,
                billingInvoiceNumber: invoice.number,
              }
            : item,
        ),
      });
    } catch (err) {
      toast.error(extractErrorMessage(err) || "Could not create the change order invoice.");
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (co: ChangeOrder) => {
    setBusyId(co.id);
    try {
      const next = await updateJobChangeOrderStatus(
        job.id,
        co.id,
        "cancelled",
      );
      toast.success(`${co.number} cancelled.`);
      if (next) onJobUpdated?.(next);
    } catch (err) {
      toast.error(extractErrorMessage(err) || "Could not cancel change order.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-foreground">Change orders &amp; scope changes</p>
          <p className="text-xs text-muted-foreground">
            Customer change orders are approved by the customer and billed on their own invoice.
            Internal scope updates (from your contractors and technicians) are for reference only and never billed.
          </p>
        </div>
        {locked ? null : (
          <Button size="sm" className="h-8" onClick={() => setOpen(true)}>
            <Plus className="size-3.5" />
            Create change order
          </Button>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile label="Original job amount" value={originalAmount} />
        <SummaryTile
          label="Approved change orders"
          value={approved}
          prefix="+"
          emphasize
        />
        <SummaryTile
          label="Pending change orders"
          value={pending}
          prefix="+"
        />
        <SummaryTile
          label="Rejected change orders"
          value={rejected}
          prefix="+"
          muted
        />
      </div>

      {orders.length === 0 ? (
        <div className="rounded-md border border-dashed border-border-soft px-4 py-8 text-center text-sm text-muted-foreground">
          No change orders yet. Create one when the customer requests extra
          work.
        </div>
      ) : (
        <ul className="divide-y divide-border-soft rounded-md border border-border-soft">
          {orders.map((co) => (
            <li
              key={co.id}
              className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-foreground">
                    {co.number}
                  </span>
                  <ChangeOrderKindBadge co={co} />
                  {co.requestedBy ? (
                    co.fieldAcceptance?.status === "accepted" || co.status === "approved" ? (
                      <StatusPill
                        tone="success"
                        label={`Accepted by ${co.fieldAcceptance?.acceptedBy || co.requestedBy.name || co.requestedBy.participantType}`}
                      />
                    ) : co.status === "rejected" || co.status === "cancelled" ? (
                      <StatusPill label={coStatusLabel(co.status)} tone={coStatusTone(co.status)} />
                    ) : (
                      <StatusPill tone="warning" label={`Awaiting ${co.requestedBy.participantType} acceptance`} />
                    )
                  ) : (
                    <StatusPill
                      label={coStatusLabel(co.status)}
                      tone={coStatusTone(co.status)}
                    />
                  )}
                  {co.requestedBy?.name ? (
                    <span className="text-xs text-muted-foreground">Requested by {co.requestedBy.name}</span>
                  ) : null}
                </div>
                <p className="truncate text-sm text-foreground">
                  {co.title || co.description}
                </p>
                {co.customerNote ? (
                  <p className="text-xs text-muted-foreground">
                    Customer note: {co.customerNote}
                  </p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {co.sentAt
                    ? `Sent ${formatShortDate(co.sentAt)}`
                    : `Created ${formatShortDate(co.createdAt)}`}
                </p>
                {co.items.length ? (
                  <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                    {co.items.map((line) => (
                      <li key={line.id} className="flex flex-wrap gap-x-2">
                        <span className="font-medium text-foreground">
                          {itemKindLabel(line.kind)}
                        </span>
                        <span className="min-w-0 truncate">{line.description}</span>
                        <span className="tabular-nums">
                          {line.quantity} × {formatMoney(line.unitPrice)} ={" "}
                          {formatMoney(line.total)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {co.requestedBy ? (
                  <span className="text-right">
                    <span className="block text-sm font-semibold tabular-nums text-foreground">{formatMoney(co.total)}</span>
                    <span className="block text-[11px] text-muted-foreground">Not billed</span>
                  </span>
                ) : (
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    +{formatMoney(co.total)}
                  </span>
                )}
                {!co.requestedBy && co.status === "approved" && co.billingInvoiceId ? (
                  <Button size="sm" variant="outline" className="h-8" asChild>
                    <Link href={`/pro/dashboard/invoices/${co.billingInvoiceId}`}>
                      <FileText className="size-3.5" />
                      {co.billingInvoiceNumber || "Open invoice"}
                    </Link>
                  </Button>
                ) : null}
                {!co.requestedBy && co.status === "approved" && !co.billingInvoiceId ? (
                  <Button
                    size="sm"
                    className="h-8"
                    disabled={busyId === co.id}
                    onClick={() => void createInvoice(co)}
                  >
                    {busyId === co.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <FileText className="size-3.5" />
                    )}
                    Create invoice
                  </Button>
                ) : null}
                {co.status === "draft" && !co.requestedBy ? (
                  <Button
                    size="sm"
                    className="h-8"
                    disabled={busyId === co.id}
                    onClick={() => void send(co)}
                  >
                    {busyId === co.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Send className="size-3.5" />
                    )}
                    Send
                  </Button>
                ) : null}
                {!co.requestedBy && (co.status === "draft" || co.status === "pending_approval") ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    disabled={busyId === co.id}
                    onClick={() => void cancel(co)}
                  >
                    Cancel
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <JobChangeOrderDialog
        job={job}
        open={open && !locked}
        onOpenChange={setOpen}
        invoiceId={invoiceId}
        onSaved={onJobUpdated}
      />
    </div>
  );
}

function SummaryTile({
  label,
  value,
  prefix = "",
  emphasize = false,
  muted = false,
}: {
  label: string;
  value: number;
  prefix?: string;
  emphasize?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="rounded-md border border-border-soft bg-[#f7f8fa] px-3 py-2.5">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-base font-semibold tabular-nums",
          emphasize && "text-primary",
          muted && "text-muted-foreground",
          !emphasize && !muted && "text-foreground",
        )}
      >
        {prefix}
        {formatMoney(value)}
      </p>
    </div>
  );
}
