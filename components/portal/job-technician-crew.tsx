"use client";

import { useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { extractErrorMessage } from "@/components/api/apiFuntions";
import { PaginatedEntitySelect } from "@/components/portal/paginated-entity-select";
import { usePaginatedCrmOptions } from "@/components/portal/use-paginated-crm-options";
import { TechChatButton } from "@/components/tech-chat/tech-chat-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { employeeName, type PortalEmployee } from "@/lib/data/portal";
import type { Job } from "@/lib/types";
import { useAppDispatch } from "@/store/hooks";
import { fetchJobDetail, updateJobRecord } from "@/store/jobsSlice";

/**
 * More than one technician on a job: everyone besides the lead (the person on the calendar row),
 * each with Chat and Remove, plus "Add technician". The server refuses someone already booked at
 * the job's calendar time.
 */
export function JobTechnicianCrew({
  job,
  leadId,
  employees,
  locked = false,
  lockedHint,
  onChanged,
}: {
  job: Job;
  /** The lead technician (shown in the card above). */
  leadId: string;
  employees: PortalEmployee[];
  locked?: boolean;
  lockedHint?: string;
  onChanged?: () => void;
}) {
  const dispatch = useAppDispatch();
  const crewIds = Array.from(new Set([leadId, ...(job.assignedEmployeeIds || [])].filter(Boolean)));
  const others = crewIds.filter((id) => id !== leadId);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const nameOf = (id: string) => {
    const member = employees.find((item) => item.id === id);
    return member ? employeeName(member) : "Technician";
  };

  async function saveCrew(nextIds: string[]) {
    await dispatch(
      updateJobRecord({
        id: job.id,
        employees,
        // Lead stays first; jobPayload sends the whole list when it includes the lead.
        job: { ...job, assignedEmployeeId: nextIds[0] || "", assignedEmployeeIds: nextIds },
      }),
    ).unwrap();
    void dispatch(fetchJobDetail(job.id));
    onChanged?.();
  }

  async function remove(id: string) {
    if (removing) return;
    setRemoving(id);
    try {
      await saveCrew(crewIds.filter((item) => item !== id));
      toast.success(`${nameOf(id)} removed from ${job.number || "this job"}.`);
    } catch (error) {
      toast.error(typeof error === "string" ? error : extractErrorMessage(error) || "Could not remove the technician.");
    } finally {
      setRemoving(null);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-t border-primary/10 pt-2">
        <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          {others.length ? "Also on this job" : "Crew"}
        </p>
        {others.map((id) => (
          <span
            key={id}
            className="inline-flex items-center gap-1 rounded-full border border-input bg-background py-0.5 pr-1 pl-2.5 text-xs font-medium"
          >
            {nameOf(id)}
            <TechChatButton
              side="provider"
              contextType="job"
              contextId={job.id}
              employeeId={id}
              iconOnly
              variant="ghost"
              className="size-6"
            />
            <Button
              size="icon"
              variant="ghost"
              className="size-6 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              aria-label={`Remove ${nameOf(id)}`}
              disabled={locked || removing === id}
              title={locked ? lockedHint : undefined}
              onClick={() => void remove(id)}
            >
              {removing === id ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}
            </Button>
          </span>
        ))}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 px-2 text-xs text-primary"
          disabled={locked}
          title={locked ? lockedHint : undefined}
          onClick={() => setAdding(true)}
        >
          <Plus className="size-3.5" />
          Add technician
        </Button>
      </div>
      {adding ? (
        <AddTechnicianDialog
          job={job}
          exclude={crewIds}
          onClose={() => setAdding(false)}
          onAdd={async (id) => {
            await saveCrew([...crewIds, id]);
            toast.success(`${nameOf(id)} added to ${job.number || "this job"}.`);
          }}
        />
      ) : null}
    </>
  );
}

function AddTechnicianDialog({
  job,
  exclude,
  onClose,
  onAdd,
}: {
  job: Job;
  exclude: string[];
  onClose: () => void;
  onAdd: (employeeId: string) => Promise<void>;
}) {
  const paging = usePaginatedCrmOptions("employee", true);
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!value || saving) return;
    setSaving(true);
    try {
      await onAdd(value);
      onClose();
    } catch (error) {
      toast.error(typeof error === "string" ? error : extractErrorMessage(error) || "Could not add the technician.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent className="sm:max-w-md" data-lenis-prevent>
        <DialogHeader>
          <DialogTitle>Add technician · {job.number}</DialogTitle>
          <DialogDescription>
            They join the job alongside the current crew and see it on their schedule. Someone already booked at the job&apos;s time can&apos;t be added.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="job-add-technician">Technician</FieldLabel>
          <PaginatedEntitySelect
            id="job-add-technician"
            value={value}
            selectedLabel={label}
            options={paging.options.filter((option) => !exclude.includes(option.id))}
            placeholder="Select person"
            emptyLabel="No other team members found."
            loading={paging.loading}
            loadingMore={paging.loadingMore}
            hasMore={paging.hasMore}
            onLoadMore={paging.loadMore}
            searchable
            searchValue={paging.search}
            onSearchChange={paging.setSearch}
            searchPlaceholder="Search team…"
            onChange={(id, option) => {
              setValue(id);
              setLabel(option?.label || "");
            }}
          />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={!value || saving}>
            {saving ? "Adding…" : "Add technician"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
