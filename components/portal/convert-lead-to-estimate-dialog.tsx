"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, FileText, Loader2, Plus, Trash2, ShieldCheck, Tag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { convertRequestToEstimate } from "@/lib/api/crm-client";
import type { PortalRequest } from "@/lib/data/portal";

function formatCurrency(amount: number) {
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

type LineDraft = {
  id: string;
  description: string;
  kind: "labor" | "material";
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
      description: lead.serviceName || "Scope & diagnostics",
      kind: "labor",
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

    if (!title.trim()) {
      toast.error("Proposal title is required.");
      return;
    }
    if (!notes.trim()) {
      toast.error("Scope & diagnostic notes are required.");
      return;
    }
    if (!terms.trim()) {
      toast.error("Terms & warranty is required.");
      return;
    }

    const invalidItem = items.find(
      (item) => !item.description.trim() || Number(item.quantity) <= 0
    );
    if (invalidItem) {
      toast.error("Please fill in all line item details.");
      return;
    }

    setSubmitting(true);
    try {
      const validItems = items.map((item) => ({
        description: item.description.trim(),
        kind: item.kind,
        quantity: Math.max(1, Number(item.quantity) || 1),
        unitPrice: Math.max(0, Number(item.unitPrice) || 0),
        taxRate: 0,
      }));

      const created = await convertRequestToEstimate(lead.id, {
        title: title.trim(),
        notes: notes.trim(),
        terms: terms.trim(),
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
      <DialogContent className="flex flex-col sm:max-w-2xl lg:max-w-3xl max-h-[90vh] h-[90vh] sm:h-auto sm:max-h-[88vh] p-0 gap-0 rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-2xl">
        <DialogHeader className="shrink-0 px-6 py-3.5 border-b border-slate-200/80 bg-white z-10 pr-12">
          <div className="flex items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#003F7D]/10 text-[#003F7D]">
              <FilePlus2 className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-semibold tracking-tight text-slate-900">
                  Convert Lead to Estimate
                </DialogTitle>
                <span className="inline-flex items-center rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-[#003F7D] ring-1 ring-inset ring-blue-700/10 shrink-0">
                  {lead.number || "Lead"}
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate mt-0.5">
                {lead.customerName} {lead.serviceName ? `· ${lead.serviceName}` : ""}
              </p>
            </div>
          </div>
          <DialogDescription className="sr-only">
            Generate an official estimate proposal.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleConvert} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4 thin-scrollbar">
            {/* General Fields */}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-xs sm:col-span-2">
                <span className="font-medium text-slate-700">Proposal Title <span className="text-red-500">*</span></span>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Water Heater Replacement & Installation"
                  className="h-9 text-sm"
                  required
                />
              </label>

              <label className="grid gap-1.5 text-xs sm:col-span-2">
                <span className="font-medium text-slate-700">
                  Scope & Diagnostic Notes <span className="text-red-500">*</span>
                </span>
                <Textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Specific job diagnostics, requirements, or inclusions..."
                  className="text-sm resize-y"
                  required
                />
              </label>

              <label className="grid gap-1.5 text-xs sm:col-span-2">
                <span className="font-medium text-slate-700 flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5 text-slate-400" />
                  Terms & Warranty <span className="text-red-500">*</span>
                </span>
                <Input
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  placeholder="e.g. Proposal valid for 30 calendar days from issue date."
                  className="h-9 text-sm"
                  required
                />
              </label>
            </div>

            {/* Line Items Section */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-slate-800">Proposal Line Items</span>
                  <p className="text-xs text-slate-500">Add labor hours or materials to this estimate.</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addItem}
                  className="h-8 gap-1 text-xs font-medium text-[#003F7D] border-[#003F7D]/20 hover:bg-[#003F7D]/5"
                >
                  <Plus className="size-3.5" /> Add line item
                </Button>
              </div>

              {/* Line items table header */}
              <div className="hidden sm:grid grid-cols-[1fr_110px_70px_100px_90px_36px] gap-2 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-50 rounded-md">
                <span>Description <span className="text-red-500">*</span></span>
                <span>Type <span className="text-red-500">*</span></span>
                <span className="text-center">Qty <span className="text-red-500">*</span></span>
                <span className="text-right">Unit Price <span className="text-red-500">*</span></span>
                <span className="text-right">Amount</span>
                <span />
              </div>

              {/* Line items list */}
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-1 sm:grid-cols-[1fr_110px_70px_100px_90px_36px] items-center gap-2 rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm transition-colors hover:border-slate-300"
                  >
                    <div>
                      <Input
                        className="h-8 bg-white text-xs"
                        value={item.description}
                        placeholder="Item description (e.g. Labor / Faucet install)"
                        onChange={(e) => updateItem(item.id, { description: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <NativeSelect
                        size="sm"
                        className="w-full [&>select]:bg-white"
                        value={item.kind}
                        required
                        onChange={(e) =>
                          updateItem(item.id, {
                            kind: e.target.value as "labor" | "material",
                          })
                        }
                      >
                        <NativeSelectOption value="labor">Labor</NativeSelectOption>
                        <NativeSelectOption value="material">Material</NativeSelectOption>
                      </NativeSelect>
                    </div>

                    <div>
                      <Input
                        type="number"
                        min="1"
                        required
                        className="h-8 w-full bg-white text-xs text-center"
                        placeholder="1"
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(item.id, { quantity: Math.max(1, Number(e.target.value) || 1) })
                        }
                      />
                    </div>

                    <div>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                          $
                        </span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          className="h-8 w-full pl-6 bg-white text-xs text-right"
                          placeholder="0.00"
                          value={item.unitPrice}
                          onChange={(e) =>
                            updateItem(item.id, { unitPrice: Math.max(0, Number(e.target.value) || 0) })
                          }
                        />
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-semibold text-slate-800 tabular-nums">
                        {formatCurrency((item.quantity || 1) * (item.unitPrice || 0))}
                      </span>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={items.length <= 1}
                        className="size-7 text-slate-400 hover:text-red-600 disabled:opacity-30"
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Financial Summary Card */}
              <div className="flex justify-end pt-3">
                <div className="w-full sm:w-72 rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-medium text-slate-900 tabular-nums">
                      {formatCurrency(subtotal)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600">
                    <span className="flex items-center gap-1">
                      <Tag className="size-3 text-slate-400" />
                      Discount:
                    </span>
                    <div className="relative w-28">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                        $
                      </span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        className="h-7 w-full pl-5 pr-2 text-xs text-right bg-white"
                        value={discount}
                        onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-bold text-slate-900">
                    <span>Estimate Total:</span>
                    <span className="text-base text-[#003F7D] tabular-nums">
                      {formatCurrency(total)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="shrink-0 px-6 py-3.5 border-t border-slate-200/80 bg-slate-50 flex flex-row items-center justify-end gap-2.5 z-10">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="text-xs h-9 px-4 rounded-lg bg-white hover:bg-slate-50"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="text-xs h-9 px-4 gap-1.5 bg-[#003F7D] text-white hover:bg-[#003264] rounded-lg shadow-xs disabled:opacity-75"
            >
              {submitting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <FileText className="size-3.5" />
              )}
              {submitting ? "Creating proposal…" : "Create Estimate Proposal"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
