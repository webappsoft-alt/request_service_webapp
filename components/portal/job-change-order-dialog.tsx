"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type LineDraft = {
  key: string;
  description: string;
  kind: NonNullable<JobChangeOrderInput["items"]>[number]["kind"];
  quantity: string;
  unitPrice: string;
};

function emptyLine(): LineDraft {
  return {
    key: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    description: "",
    kind: "labor",
    quantity: "1",
    unitPrice: "",
  };
}

function lineTotal(line: LineDraft) {
  const qty = Number(line.quantity);
  const price = Number(line.unitPrice);
  if (!Number.isFinite(qty) || !Number.isFinite(price)) return 0;
  return Math.round(qty * price * 100) / 100;
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
  const [customerNotes, setCustomerNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [saving, setSaving] = useState<"draft" | "send" | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setCustomerNotes("");
    setInternalNotes("");
    setLines([emptyLine()]);
    setSaving(null);
  }, [open, job?.id]);

  const total = useMemo(
    () => lines.reduce((sum, line) => sum + lineTotal(line), 0),
    [lines],
  );

  if (!job) return null;

  const buildPayload = (send: boolean): JobChangeOrderInput | null => {
    if (!title.trim()) {
      toast.error("Add a short reason / summary for this change order.");
      return null;
    }
    const items = lines
      .map((line) => ({
        description: line.description.trim(),
        kind: line.kind || "labor",
        quantity: Number(line.quantity) || 1,
        unitPrice: Number(line.unitPrice) || 0,
        total: lineTotal(line),
        unit: "ea",
      }))
      .filter((item) => item.description && item.total >= 0);

    if (!items.length) {
      toast.error("Add at least one line item.");
      return null;
    }
    if (total <= 0) {
      toast.error("Change order total must be greater than zero.");
      return null;
    }

    return {
      title: title.trim(),
      description: description.trim(),
      items,
      amount: total,
      customerNotes: customerNotes.trim(),
      internalNotes: internalNotes.trim(),
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
      onSaved?.(next);
      onOpenChange(false);
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not save change order."));
    } finally {
      setSaving(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create change order</DialogTitle>
          <DialogDescription>
            Additional work for {job.number}. This does not edit the original
            estimate or invoice.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-md border border-border-soft bg-[#f7f8fa] px-3 py-2 text-sm">
            <p>
              <span className="text-muted-foreground">Job:</span>{" "}
              <span className="font-semibold">{job.number}</span>
            </p>
            {job.customerName ? (
              <p>
                <span className="text-muted-foreground">Customer:</span>{" "}
                <span className="font-medium">{job.customerName}</span>
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="co-title">Reason / summary</Label>
            <Input
              id="co-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Additional shutoff valves"
              disabled={Boolean(saving)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="co-scope">Scope of change</Label>
            <Textarea
              id="co-scope"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the additional or changed work…"
              rows={3}
              disabled={Boolean(saving)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Line items</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => setLines((prev) => [...prev, emptyLine()])}
                disabled={Boolean(saving)}
              >
                <Plus className="size-3.5" />
                Add line
              </Button>
            </div>
            <div className="space-y-2">
              {lines.map((line) => (
                <div
                  key={line.key}
                  className="grid gap-2 rounded-md border border-border-soft p-2 sm:grid-cols-[1fr_7.5rem_5rem_5.5rem_auto]"
                >
                  <Input
                    value={line.description}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((row) =>
                          row.key === line.key
                            ? { ...row, description: e.target.value }
                            : row,
                        ),
                      )
                    }
                    placeholder="Description"
                    disabled={Boolean(saving)}
                  />
                  <Select
                    value={line.kind}
                    onValueChange={(value) =>
                      setLines((prev) =>
                        prev.map((row) =>
                          row.key === line.key
                            ? {
                                ...row,
                                kind: value as LineDraft["kind"],
                              }
                            : row,
                        ),
                      )
                    }
                    disabled={Boolean(saving)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="labor">Labor</SelectItem>
                      <SelectItem value="material">Material</SelectItem>
                      <SelectItem value="equipment">Equipment</SelectItem>
                      <SelectItem value="service">Service</SelectItem>
                      <SelectItem value="fee">Fee</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={line.quantity}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((row) =>
                          row.key === line.key
                            ? { ...row, quantity: e.target.value }
                            : row,
                        ),
                      )
                    }
                    disabled={Boolean(saving)}
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unitPrice}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((row) =>
                          row.key === line.key
                            ? { ...row, unitPrice: e.target.value }
                            : row,
                        ),
                      )
                    }
                    placeholder="Price"
                    disabled={Boolean(saving)}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-9 shrink-0"
                    disabled={lines.length <= 1 || Boolean(saving)}
                    onClick={() =>
                      setLines((prev) =>
                        prev.filter((row) => row.key !== line.key),
                      )
                    }
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <p className="text-right text-sm font-semibold tabular-nums">
              Additional cost: {formatMoney(total)}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="co-customer-notes">Customer notes</Label>
              <Textarea
                id="co-customer-notes"
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                rows={2}
                disabled={Boolean(saving)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="co-internal-notes">Internal notes</Label>
              <Textarea
                id="co-internal-notes"
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                rows={2}
                disabled={Boolean(saving)}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            disabled={Boolean(saving)}
            onClick={() => void submit(false)}
          >
            {saving === "draft" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : null}
            Save draft
          </Button>
          <Button
            type="button"
            disabled={Boolean(saving)}
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
