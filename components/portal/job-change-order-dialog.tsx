"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import { SectionedLineItemsEditor } from "@/components/portal/estimate-v2/sectioned-line-items-editor";
import {
  createEmptyLine,
  LineItemsActions,
} from "@/components/portal/line-items-editor";
import {
  jobCostMix,
  lineTotal,
  type JobCostKind,
  type JobCostLine,
} from "@/components/portal/use-job-costing";
import {
  createJobChangeOrder,
  type JobChangeOrderInput,
} from "@/lib/api/crm-client";
import { formatMoney } from "@/lib/format";
import type { Job } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function seedLines(): JobCostLine[] {
  return [
    { ...createEmptyLine("labor"), section: "Additional work" },
  ];
}

function toApiKind(
  kind: JobCostKind,
): NonNullable<JobChangeOrderInput["items"]>[number]["kind"] {
  switch (kind) {
    case "labor":
      return "labor";
    case "equipment":
      return "equipment";
    case "materials":
      return "material";
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

export function JobChangeOrderDialog({
  job,
  open,
  onOpenChange,
  invoiceId,
  onSaved,
}: {
  job: Job | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId?: string;
  onSaved?: (job: Job) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<JobCostLine[]>(seedLines);
  const [saving, setSaving] = useState<"draft" | "send" | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setLines(seedLines());
    setSaving(null);
  }, [open, job?.id]);

  const mix = useMemo(() => jobCostMix(lines), [lines]);
  const locked = Boolean(saving);

  const addLabor = () => {
    if (locked) return;
    setLines((prev) => {
      const section = prev.find((line) => line.section)?.section || "Additional work";
      return [...prev, { ...createEmptyLine("labor"), section }];
    });
  };

  const addMaterial = () => {
    if (locked) return;
    setLines((prev) => {
      const section = prev.find((line) => line.section)?.section || "Additional work";
      return [...prev, { ...createEmptyLine("materials"), section }];
    });
  };

  if (!job) return null;

  const buildPayload = (send: boolean): JobChangeOrderInput | null => {
    if (!title.trim()) {
      toast.error("Add a short reason / summary for this change order.");
      return null;
    }

    const items = lines
      .filter(
        (line) =>
          Boolean((line.description || "").trim()) && Number(line.quantity) > 0,
      )
      .map((line) => ({
        description: line.description.trim(),
        kind: toApiKind(line.kind),
        quantity: Number(line.quantity) || 1,
        unitPrice: Number(line.unitPrice) || 0,
        total: lineTotal(line),
        unit: line.unit || (line.kind === "labor" ? "hr" : "ea"),
        section: String(line.section || "").trim(),
      }));

    if (!items.length) {
      toast.error("Add at least one labour, material, or equipment line.");
      return null;
    }

    const amount =
      Math.round(items.reduce((sum, item) => sum + item.total, 0) * 100) / 100;
    if (amount <= 0) {
      toast.error("Change order total must be greater than zero.");
      return null;
    }

    return {
      title: title.trim(),
      description: description.trim(),
      items,
      amount,
      ...(invoiceId ? { invoiceId } : {}),
      send,
      status: send ? "pending" : "draft",
    };
  };

  const submit = async (send: boolean) => {
    const payload = buildPayload(send);
    if (!payload) return;
    setSaving(send ? "send" : "draft");
    try {
      const next = await createJobChangeOrder(job.id, payload);
      toast.success(
        send
          ? "Change order sent to the customer."
          : "Change order saved as draft.",
      );
      if (next) onSaved?.(next);
      onOpenChange(false);
    } catch (err) {
      toast.error(extractErrorMessage(err) || "Could not save change order.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[min(94vh,920px)] w-[min(96vw,72rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
        shell={false}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border-soft px-5 py-4 pr-12">
          <DialogHeader className="gap-1 text-left">
            <DialogTitle>Create change order</DialogTitle>
            <DialogDescription>
              Additional work for {job.number}
              {invoiceId ? " · from invoice" : ""}. This does not edit the
              original estimate or invoice.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-md border border-border-soft bg-[#f7f8fa] px-3 py-2 text-sm">
              <span>
                <span className="text-muted-foreground">Job:</span>{" "}
                <span className="font-semibold">{job.number}</span>
              </span>
              {job.customerName ? (
                <span>
                  <span className="text-muted-foreground">Customer:</span>{" "}
                  <span className="font-medium">{job.customerName}</span>
                </span>
              ) : null}
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
              <div className="space-y-1.5">
                <Label htmlFor="co-title">Reason / summary</Label>
                <Input
                  id="co-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Additional shutoff valves"
                  disabled={locked}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="co-scope">Scope of change</Label>
                <Textarea
                  id="co-scope"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the additional or changed work…"
                  rows={2}
                  disabled={locked}
                  className="min-h-[2.75rem] resize-y"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-soft pb-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">
                    Labour & Material
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Use sections. Descriptions can be long — Type, Qty, Unit,
                    and Price stay on the right.
                  </p>
                </div>
                <LineItemsActions
                  locked={locked}
                  saving={Boolean(saving)}
                  onAddLabor={addLabor}
                  onAddMaterial={addMaterial}
                  className="shrink-0"
                />
              </div>

              <SectionedLineItemsEditor
                lines={lines}
                onChange={setLines}
                locked={locked}
              />

              <dl className="ml-auto w-full max-w-sm overflow-hidden rounded-lg border border-border-soft bg-card text-sm">
                <div className="grid grid-cols-2 gap-x-4 px-3 py-2">
                  <dt className="text-muted-foreground">Labour</dt>
                  <dd className="text-right tabular-nums">
                    {formatMoney(mix.labor)}
                  </dd>
                </div>
                <div className="grid grid-cols-2 gap-x-4 border-t border-border-soft px-3 py-2">
                  <dt className="text-muted-foreground">Material</dt>
                  <dd className="text-right tabular-nums">
                    {formatMoney(mix.materials)}
                  </dd>
                </div>
                <div className="grid grid-cols-2 gap-x-4 border-t border-border-soft px-3 py-2">
                  <dt className="text-muted-foreground">Equipment</dt>
                  <dd className="text-right tabular-nums">
                    {formatMoney(mix.equipment || 0)}
                  </dd>
                </div>
                <div className="grid grid-cols-2 gap-x-4 border-t border-border-soft bg-[#f7f8fa] px-3 py-2.5">
                  <dt className="font-semibold">Additional cost</dt>
                  <dd className="text-right font-semibold tabular-nums text-primary">
                    {formatMoney(mix.total)}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-border-soft px-5 py-3 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={locked}
            onClick={() => void submit(false)}
          >
            {saving === "draft" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : null}
            Save draft
          </Button>
          <Button
            type="button"
            disabled={locked}
            onClick={() => void submit(true)}
          >
            {saving === "send" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : null}
            Send to customer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
