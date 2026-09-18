"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { convertRequestToEstimate } from "@/lib/api/crm-client";
import type { PortalRequest } from "@/lib/data/portal";

function formatCurrency(amount: number) {
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type LineDraft = {
  id: string;
  description: string;
  kind: "labor" | "material" | "service";
  quantity: number;
  unitPrice: number;
};

export function ConvertLeadToEstimateDialog({
  open,
  onOpenChange,
  lead,
  onConverted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: PortalRequest;
  onConverted?: (estimateId: string) => void;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState(
    () => `${lead.serviceName || "Service"} Proposal`,
  );
  const [notes, setNotes] = useState(() => lead.details || "");
  const [terms, setTerms] = useState(
    "Proposal valid for 30 calendar days from issue date.",
  );
  const [discount, setDiscount] = useState<number>(0);
  const [items, setItems] = useState<LineDraft[]>([
    {
      id: "item_1",
      description: lead.serviceName || "Service scope & diagnostics",
      kind: "service",
      quantity: 1,
      unitPrice: 0,
    },
  ]);

  const subtotal = items.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    0,
  );
  const total = Math.max(0, subtotal - (Number(discount) || 0));

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        id: `item_${Date.now()}`,
        description: "",
        kind: "labor",
        quantity: 1,
        unitPrice: 0,
      },
    ]);
  }

  function removeItem(id: string) {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  function updateItem(id: string, patch: Partial<LineDraft>) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  async function handleConvert(e: React.FormEvent) {
    e.preventDefault();
    if (!lead.id) return;
    setSubmitting(true);
    try {
      const validItems = items
        .filter((item) => item.description.trim())
        .map((item) => ({
          description: item.description.trim(),
          kind: item.kind,
          quantity: Number(item.quantity) || 1,
          unitPrice: Number(item.unitPrice) || 0,
          taxRate: 0,
        }));

      const created = await convertRequestToEstimate(lead.id, {
        title: title.trim() || undefined,
        notes: notes.trim() || undefined,
        terms: terms.trim() || undefined,
        discount: Number(discount) || 0,
        items: validItems.length ? validItems : undefined,
      });

      toast.success(
        created?.number
          ? `Proposal ${created.number} created successfully!`
          : "Request successfully converted to Estimate proposal.",
      );

      onOpenChange(false);
      if (created?.id) {
        if (onConverted) onConverted(created.id);
        router.push(`/pro/dashboard/estimates/${created.id}`);
      }
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Could not convert request to estimate.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Convert Lead to Estimate Proposal</DialogTitle>
          <DialogDescription>
            Generate a formal estimate proposal directly from {lead.number} ({lead.customerName}).
            Address and diagnostic answers are automatically imported.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleConvert} className="space-y-4 pt-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm sm:col-span-2">
              <span className="font-medium text-slate-700">Proposal Title</span>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Water Heater Replacement & Installation"
                required
              />
            </label>

            <label className="grid gap-1.5 text-sm sm:col-span-2">
              <span className="font-medium text-slate-700">Scope Notes</span>
              <Textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Diagnostic scope notes or inclusions"
              />
            </label>

            <label className="grid gap-1.5 text-sm sm:col-span-2">
              <span className="font-medium text-slate-700">Terms & Warranty</span>
              <Input
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                placeholder="e.g. Valid for 30 calendar days"
              />
            </label>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-800">Proposal Line Items</span>
              <Button type="button" size="xs" variant="outline" onClick={addItem}>
                <Plus className="size-3.5 mr-1" /> Add item
              </Button>
            </div>

            <div className="space-y-2">
              {items.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex flex-wrap sm:flex-nowrap items-center gap-2 rounded border border-slate-200 p-2 bg-slate-50 text-sm"
                >
                  <Input
                    className="flex-1 min-w-[140px] bg-white text-xs sm:text-sm"
                    value={item.description}
                    placeholder="Description of work or material"
                    onChange={(e) => updateItem(item.id, { description: e.target.value })}
                    required
                  />
                  <NativeSelect
                    className="w-24 bg-white text-xs"
                    value={item.kind}
                    onChange={(e) =>
                      updateItem(item.id, {
                        kind: e.target.value as "labor" | "material" | "service",
                      })
                    }
                  >
                    <NativeSelectOption value="service">Service</NativeSelectOption>
                    <NativeSelectOption value="labor">Labor</NativeSelectOption>
                    <NativeSelectOption value="material">Material</NativeSelectOption>
                  </NativeSelect>
                  <Input
                    type="number"
                    min="1"
                    className="w-16 bg-white text-xs text-center"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(item.id, { quantity: Math.max(1, Number(e.target.value) || 1) })
                    }
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-24 bg-white text-xs text-right"
                    placeholder="$ Unit"
                    value={item.unitPrice}
                    onChange={(e) =>
                      updateItem(item.id, { unitPrice: Math.max(0, Number(e.target.value) || 0) })
                    }
                  />
                  <span className="w-20 text-right text-xs font-semibold text-slate-700">
                    {formatCurrency((item.quantity || 1) * (item.unitPrice || 0))}
                  </span>
                  {items.length > 1 ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-7 text-red-500 hover:text-red-700"
                      onClick={() => removeItem(item.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="flex flex-col items-end pt-2 text-sm text-slate-600 space-y-1">
              <div className="flex justify-between w-48 text-xs">
                <span>Subtotal:</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between w-48 text-xs">
                <span>Discount ($):</span>
                <Input
                  type="number"
                  min="0"
                  className="w-20 h-6 text-xs text-right bg-white"
                  value={discount}
                  onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
                />
              </div>
              <div className="flex justify-between w-48 font-bold text-slate-900 pt-1 border-t border-slate-200">
                <span>Estimate Total:</span>
                <span className="text-[#003F7D]">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating proposal…" : "Create Estimate Proposal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
