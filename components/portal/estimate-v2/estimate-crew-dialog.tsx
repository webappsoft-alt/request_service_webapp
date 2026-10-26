"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { extractErrorMessage } from "@/components/api/apiFuntions";
import { PaginatedEntitySelect } from "@/components/portal/paginated-entity-select";
import { usePaginatedCrmOptions } from "@/components/portal/use-paginated-crm-options";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { assignEstimateV2Crew, type EstimateV2Opportunity } from "@/lib/api/estimate-v2-client";

export type EstimateCrewMode = "technician" | "contractor";

/**
 * Assign technician / Assign contractor on the estimate page (same buttons as on a job).
 * Optionally moves every open site visit, and its calendar entry, to the same person.
 */
export function EstimateCrewDialog({
  open,
  onOpenChange,
  mode,
  opportunity,
  currentId,
  currentLabel,
  openVisitCount,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: EstimateCrewMode;
  opportunity: EstimateV2Opportunity;
  currentId: string;
  currentLabel: string;
  /** Scheduled / rescheduled visits that would follow the new assignment. */
  openVisitCount: number;
  onSaved: (opportunity: EstimateV2Opportunity) => void;
}) {
  const paging = usePaginatedCrmOptions(open ? (mode === "technician" ? "employee" : "contractor") : null, open);
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const [applyToVisits, setApplyToVisits] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValue(currentId);
    setLabel(currentLabel);
    setApplyToVisits(true);
    setSaving(false);
  }, [open, currentId, currentLabel]);

  const noun = mode === "technician" ? "technician" : "contractor";

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const next = value || null;
      const updated = await assignEstimateV2Crew(opportunity.id, {
        ...(mode === "technician" ? { employeeId: next } : { contractorId: next }),
        applyToVisits: openVisitCount > 0 && applyToVisits,
      });
      toast.success(next ? `${label || `The ${noun}`} assigned to ${opportunity.number || "this estimate"}.` : `${noun[0].toUpperCase()}${noun.slice(1)} removed.`);
      onSaved(updated);
      onOpenChange(false);
    } catch (error) {
      toast.error(extractErrorMessage(error) || `Could not assign the ${noun}.`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md" data-lenis-prevent>
        <DialogHeader>
          <DialogTitle>
            {currentId ? `Change ${noun}` : `Assign ${noun}`} · {opportunity.number}
          </DialogTitle>
          <DialogDescription>
            {mode === "technician"
              ? "The technician who visits and prices this estimate. They carry over to the job."
              : "A contractor handling this estimate. On-stop or uninsured contractors can't be assigned."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field>
            <FieldLabel htmlFor="estimate-crew-person">{mode === "technician" ? "Technician" : "Contractor"}</FieldLabel>
            <PaginatedEntitySelect
              id="estimate-crew-person"
              value={value}
              selectedLabel={label}
              options={[{ id: "", label: "Unassigned" }, ...paging.options]}
              placeholder="Unassigned"
              emptyLabel={mode === "technician" ? "No team members found." : "No contractors found."}
              loading={paging.loading}
              loadingMore={paging.loadingMore}
              hasMore={paging.hasMore}
              onLoadMore={paging.loadMore}
              searchable
              searchValue={paging.search}
              onSearchChange={paging.setSearch}
              searchPlaceholder={mode === "technician" ? "Search team…" : "Search contractors…"}
              onChange={(id, option) => {
                setValue(id);
                setLabel(id ? option?.label || "" : "");
              }}
            />
          </Field>
          {openVisitCount > 0 ? (
            <label className="flex items-start gap-2.5 text-sm">
              <Checkbox
                checked={applyToVisits}
                onCheckedChange={(checked) => setApplyToVisits(checked === true)}
                className="mt-0.5"
              />
              <span>
                Also assign {openVisitCount === 1 ? "the open site visit" : `all ${openVisitCount} open site visits`}
                <span className="block text-xs text-muted-foreground">Their Schedule entries move to this {noun}.</span>
              </span>
            </label>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving || (value === currentId && openVisitCount === 0)}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
