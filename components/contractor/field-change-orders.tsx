"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { LineItemsEditor } from "@/components/portal/line-items-editor";
import { StatusPill } from "@/components/portal/status-pill";
import type { JobCostLine } from "@/components/portal/use-job-costing";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { ContractorJobChangeOrder } from "@/lib/api/contractor-portal-client";
import { formatDate } from "@/lib/format";

const noop = () => undefined;

function toLines(order: ContractorJobChangeOrder): JobCostLine[] {
  return order.items.map((item, index) => {
    const kind = item.kind === "labor" ? "labor" : item.kind === "equipment" ? "equipment" : "materials";
    return {
      id: item.id || `${order.id}_${index}`,
      description: item.description,
      kind,
      quantity: item.quantity,
      unit: kind === "labor" ? "hr" : "ea",
      unitPrice: 0,
      section: "",
    };
  });
}

/**
 * Extra labour / material the office added for a request this person sent —
 * one table per change order, same layout as the job's own lines, no prices.
 * They confirm it with "Accept"; that approves it on the office side.
 */
export function FieldExtraWork({
  orders,
  onAccept,
}: {
  orders: ContractorJobChangeOrder[];
  onAccept: (order: ContractorJobChangeOrder) => Promise<void>;
}) {
  const [accepting, setAccepting] = useState<string | null>(null);
  if (!orders.length) return null;

  async function accept(order: ContractorJobChangeOrder) {
    setAccepting(order.id);
    try {
      await onAccept(order);
      toast.success(`You accepted ${order.number || "the extra work"}.`);
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : "Could not accept this change order.");
    } finally {
      setAccepting(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {orders.map((order) => {
        const accepted = order.acceptance === "accepted" || order.status === "approved";
        return (
          <div key={order.id} className="overflow-hidden rounded-lg border border-[#94a3b8] bg-card">
            <div className="flex flex-wrap items-center gap-2 border-b border-[#94a3b8] bg-[#f7f8fa] px-3 py-2">
              <p className="min-w-0 flex-1 text-sm font-semibold text-foreground">
                Extra · {order.number || "Change order"}
                {order.title ? <span className="font-normal text-muted-foreground"> — {order.title}</span> : null}
              </p>
              {accepted ? (
                <StatusPill
                  tone="success"
                  label={order.acceptedAt ? `Accepted ${formatDate(order.acceptedAt)}` : "Accepted"}
                />
              ) : (
                <Button size="sm" className="h-8" onClick={() => void accept(order)} disabled={accepting === order.id}>
                  {accepting === order.id ? <Spinner /> : <CheckCircle2 />}
                  Accept
                </Button>
              )}
            </div>
            {order.items.length ? (
              <LineItemsEditor lines={toLines(order)} onChange={noop} locked showPricing={false} allowMaterialImages={false} className="rounded-none border-0" />
            ) : (
              <p className="px-3 py-3 text-xs text-muted-foreground">The office hasn&apos;t added lines yet.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
