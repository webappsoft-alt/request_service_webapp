"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, FileText, Loader2, Plus, ShieldCheck, Tag } from "lucide-react";
import { toast } from "sonner";
import {
  createEmptyLine,
  LineItemsEditor,
} from "@/components/portal/line-items-editor";
import { jobCostMix, writeCostLines, type JobCostLine } from "@/components/portal/use-job-costing";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { convertRequestToEstimate } from "@/lib/api/crm-client";
import type { PortalRequest } from "@/lib/data/portal";
import { formatMoney } from "@/lib/format";
import { stashEstimateMaterialImages } from "@/components/portal/line-item-images";

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
  const [items, setItems] = useState<JobCostLine[]>([
    {
      id: "item_1",
      description: lead.serviceName || "Scope & diagnostics",
      kind: "labor",
      quantity: 1,
      unit: "hr",
      unitPrice: 0,
    },
  ]);

  const mix = useMemo(() => jobCostMix(items), [items]);
  const total = Math.max(0, mix.total - (Number(discount) || 0));

  function addItem() {
    setItems((prev) => [...prev, createEmptyLine("labor")]);
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
      (item) => !item.description.trim() || Number(item.quantity) <= 0,
    );
    if (invalidItem) {
      toast.error("Please fill in all line item details.");
      return;
    }

    setSubmitting(true);
    try {
      const validItems = items.map((item) => {
        const isMaterial = item.kind !== "labor";
        const images = isMaterial
          ? (item.images ?? [])
              .map((src) => String(src || "").trim())
              .filter(Boolean)
          : [];
        return {
          description: item.description.trim(),
          kind: (item.kind === "labor" ? "labor" : "material") as "labor" | "material",
          quantity: Math.max(1, Number(item.quantity) || 1),
          unitPrice: Math.max(0, Number(item.unitPrice) || 0),
          taxRate: 0,
          ...(isMaterial ? { images } : {}),
        };
      });

      const created = await convertRequestToEstimate(lead.id, {
        title: title.trim(),
        notes: notes.trim(),
        terms: terms.trim(),
        discount: Number(discount) || 0,
        items: validItems.length ? validItems : undefined,
      });

      // Keep converted line-item images available for the estimate materials tab.
      if (created?.id) {
        stashEstimateMaterialImages(created.id, items);
        try {
          writeCostLines(undefined, created.id, items);
        } catch {
          /* non-blocking */
        }
      }

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
      <DialogContent className="flex flex-col sm:max-w-2xl lg:max-w-4xl max-h-[90vh] h-[90vh] sm:h-auto sm:max-h-[88vh] p-0 gap-0 rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-2xl">
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
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-xs sm:col-span-2">
                <span className="font-medium text-slate-700">
                  Proposal Title <span className="text-red-500">*</span>
                </span>
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
                  rows={6}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Specific job diagnostics, requirements, or inclusions..."
                  className="min-h-[9rem] text-sm resize-y leading-6"
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

            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-sm font-semibold text-slate-800">Proposal Line Items</span>
                  <p className="text-xs text-slate-500">
                    Add labor hours or materials to this estimate.
                  </p>
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

              <LineItemsEditor
                lines={items}
                onChange={setItems}
                showUnit
                allowMaterialImages
                minLines={1}
                wideDescription
              />

              <div className="flex justify-end pt-3">
                <div className="w-full sm:w-72 rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-medium text-slate-900 tabular-nums">
                      {formatMoney(mix.total)}
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
                      {formatMoney(total)}
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
