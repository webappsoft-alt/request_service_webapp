"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";
import { useCrmApiData } from "@/components/portal/use-crm-api-data";
import { useJobFile, type EstimateSettingsDraft } from "@/components/portal/use-job-file";
import { usePortalRecords } from "@/components/portal/use-portal-records";
import { estimateAsJob } from "@/components/portal/work-builders";
import { JobSummaryTab } from "@/components/portal/job-file";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { UnsavedChangesDialog } from "@/components/ui/unsaved-changes-dialog";
import { updateEstimate as updateEstimateApi, updateEstimateSettings as updateEstimateSettingsApi } from "@/lib/api/crm-client";
import { crmCustomerName, type PortalCustomerCrm } from "@/lib/data/crm-people";
import { ESTIMATE_STATUSES, estimateStatusLabel } from "@/lib/data/portal";
import { formatDate, formatLocation } from "@/lib/format";
import type { Estimate, EstimateStatus, Job } from "@/lib/types";
import { cn } from "@/lib/utils";

export function EstimateFileChrome({
  estimate,
  customer,
  customerLabel,
  service,
  job,
}: {
  estimate: Estimate;
  customer?: PortalCustomerCrm;
  customerLabel: string;
  service: string;
  job?: Job;
}) {
  const [open, setOpen] = useState(false);
  const contact = customer ? `${customer.firstName} ${customer.lastName}`.trim() : "";
  const address = estimate.propertyAddress;

  return (
    <div>
      <nav aria-label="Estimate breadcrumb" className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
        <Link href="/pro/dashboard/estimates" className="font-semibold text-primary hover:underline">
          Estimates
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium text-foreground">
          {customerLabel} – {service}
        </span>
        <span className="text-muted-foreground">/</span>
        <span className="font-semibold text-primary">{estimate.number}</span>
        {job ? (
          <>
            <span className="text-muted-foreground">/</span>
            <Link href={`/pro/dashboard/jobs/${job.id}`} className="font-semibold text-primary hover:underline">
              {job.number}
            </Link>
          </>
        ) : null}
      </nav>
      <button
        type="button"
        aria-expanded={open}
        className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Hide estimate details" : "Show estimate details"}
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="mt-3 grid gap-3 border border-black/10 bg-[#f8fafc] p-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <Detail
            label="Customer"
            value={
              <Link href={`/pro/dashboard/customers/${estimate.customerId}`} className="font-semibold text-primary hover:underline">
                {customerLabel}
              </Link>
            }
          />
          {customer && customer.entityKind === "company" && contact ? <Detail label="Contact" value={contact} /> : null}
          <Detail label="Service" value={service} />
          <Detail
            label="Address"
            value={`${address.street}, ${formatLocation(address.city, address.state, address.zip)}`}
          />
          <Detail label="Issued" value={formatDate(estimate.issuedAt)} />
          <Detail label="Expires" value={estimate.expiresAt ? formatDate(estimate.expiresAt) : "—"} />
          {customer?.phone ? <Detail label="Phone" value={customer.phone} /> : null}
          {customer?.email ? <Detail label="Email" value={customer.email} /> : null}
        </div>
      ) : null}
    </div>
  );
}

export function EstimateSettingsTab({
  estimate,
  job,
  service,
  locked = false,
  onSave,
}: {
  estimate: Estimate;
  job?: Job;
  service: string;
  locked?: boolean;
  onSave?: (updated: Estimate) => void;
}) {
  const { customers, loading: customersLoading } = useCrmDirectory();
  const crm = useCrmApiData();
  const loading = customersLoading && customers.length === 0;
  const records = usePortalRecords();
  const asJob = estimateAsJob(estimate);
  const file = useJobFile(asJob, estimate, undefined, "");
  const apiReady = crm.enabled;

  const fallback = useMemo<EstimateSettingsDraft>(() => ({
    name: service,
    customerId: estimate.customerId,
    street: estimate.propertyAddress.street,
    city: estimate.propertyAddress.city,
    state: estimate.propertyAddress.state,
    zip: estimate.propertyAddress.zip,
    issuedAt: estimate.issuedAt.slice(0, 10),
    expiresAt: estimate.expiresAt?.slice(0, 10) ?? "",
    status: estimate.status,
    notes: estimate.notes ?? "",
    terms: estimate.terms ?? "",
  }), [estimate, service]);

  const [draft, setDraft] = useState<EstimateSettingsDraft>(fallback);
  const selected = customers.find((item) => item.id === draft.customerId) ?? customers.find((item) => item.id === estimate.customerId);
  const isKnownCustomer = customers.some((item) => item.id === draft.customerId);
  const [saving, setSaving] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  const pendingActionRef = useRef<(() => void) | null>(null);
  const bypassingRef = useRef(false);

  useEffect(() => {
    setDraft(fallback);
  }, [fallback]);

  const isLocked = Boolean(job) || estimate.status === "converted_to_job" || locked;

  const isDirty = useMemo(() => {
    if (isLocked) return false;
    return (
      (draft.name || "").trim() !== (fallback.name || "").trim() ||
      (draft.street || "").trim() !== (fallback.street || "").trim() ||
      (draft.city || "").trim() !== (fallback.city || "").trim() ||
      (draft.state || "").trim() !== (fallback.state || "").trim() ||
      (draft.zip || "").trim() !== (fallback.zip || "").trim() ||
      (draft.expiresAt || "") !== (fallback.expiresAt || "") ||
      (draft.notes || "").trim() !== (fallback.notes || "").trim() ||
      (draft.terms || "").trim() !== (fallback.terms || "").trim()
    );
  }, [draft, fallback, isLocked]);

  // Window beforeunload (tab close / refresh)
  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Intercept navigation or tab change when form has unsaved changes
  useEffect(() => {
    if (!isDirty) return;

    const handleClickCapture = (event: MouseEvent) => {
      if (bypassingRef.current) return;

      const target = event.target as HTMLElement | null;
      if (!target) return;

      // Allow clicks within the estimate settings form, modals, dropdowns, selects, toasts
      if (
        target.closest("[data-estimate-settings-form]") ||
        target.closest("[role='dialog']") ||
        target.closest("[role='listbox']") ||
        target.closest("[data-radix-popper-content-wrapper]") ||
        target.closest("[data-radix-focus-guard]") ||
        target.closest("[data-radix-portal]") ||
        target.closest("[data-sonner-toaster]") ||
        target.closest(".sonner-toast")
      ) {
        return;
      }

      const interactiveEl = target.closest(
        "button, a[href], [role='tab'], [role='button'], [data-tab-id]"
      ) as HTMLElement | null;

      if (!interactiveEl) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      pendingActionRef.current = () => {
        interactiveEl.click();
      };

      setShowUnsavedDialog(true);
    };

    document.addEventListener("click", handleClickCapture, true);
    return () => {
      document.removeEventListener("click", handleClickCapture, true);
    };
  }, [isDirty]);

  function executePending() {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    setShowUnsavedDialog(false);
    if (action) {
      bypassingRef.current = true;
      setTimeout(() => {
        action();
        setTimeout(() => {
          bypassingRef.current = false;
        }, 150);
      }, 0);
    }
  }

  function patch(next: Partial<EstimateSettingsDraft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  async function persist(settingsDraft: EstimateSettingsDraft) {
    file.saveEstimateSettings(settingsDraft);
    const chosenCustomer = customers.find((item) => item.id === settingsDraft.customerId);
    const customerName = chosenCustomer ? crmCustomerName(chosenCustomer) : estimate.customerName;

    const patchedEstimate: Estimate = {
      ...estimate,
      title: settingsDraft.name.trim() || estimate.title,
      customerId: settingsDraft.customerId,
      customerName,
      propertyAddress: {
        ...estimate.propertyAddress,
        street: settingsDraft.street,
        city: settingsDraft.city,
        state: settingsDraft.state,
        zip: settingsDraft.zip,
      },
      issuedAt: settingsDraft.issuedAt || estimate.issuedAt,
      expiresAt: settingsDraft.expiresAt || undefined,
      status: settingsDraft.status,
      notes: settingsDraft.notes || undefined,
      terms: settingsDraft.terms || undefined,
    };
    crm.patchEstimate(estimate.id, patchedEstimate);
    records.setStatus("estimate", estimate.id, settingsDraft.status);
    onSave?.(patchedEstimate);

    if (estimate?.id) {
      const updated = await updateEstimateSettingsApi(estimate.id, {
        title: settingsDraft.name.trim() || estimate.title,
        customerId: settingsDraft.customerId,
        propertyAddress: {
          street: settingsDraft.street,
          city: settingsDraft.city,
          state: settingsDraft.state,
          zip: settingsDraft.zip,
        },
        issuedAt: settingsDraft.issuedAt || estimate.issuedAt,
        expiresAt: settingsDraft.expiresAt || null,
        status: settingsDraft.status,
        notes: settingsDraft.notes || "",
        terms: settingsDraft.terms || "",
      });
      if (updated) {
        crm.patchEstimate(estimate.id, updated);
        onSave?.(updated);
      }
    }
  }

  async function handleManualSave() {
    if (saving || isLocked) return;
    try {
      setSaving(true);
      await persist(draft);
      toast.success("Estimate settings saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save this estimate.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAndLeave() {
    try {
      setSaving(true);
      await persist(draft);
      toast.success("Estimate settings saved.");
      executePending();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save this estimate.");
    } finally {
      setSaving(false);
    }
  }

  function handleDiscardAndLeave() {
    setDraft(fallback);
    executePending();
  }

  function handleCancelDialog() {
    pendingActionRef.current = null;
    setShowUnsavedDialog(false);
  }

  const customerName = selected ? crmCustomerName(selected) : estimate.customerName || "Customer";
  const customerPhone = selected?.phone || estimate.customerPhone || "";
  const customerEmail = selected?.email || estimate.customerEmail || "";

  return (
    <div data-estimate-settings-form className="rounded-[4px] border border-black/10 bg-card p-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Estimate settings</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isLocked ? "This estimate is signed/locked. Settings cannot be edited." : "Manage editable quote settings."}
          </p>
        </div>
        <Button
          size="sm"
          disabled={isLocked || saving || !isDirty}
          onClick={handleManualSave}
        >
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
          {saving ? "Saving…" : isLocked ? "Locked" : "Save settings"}
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Estimate name">
          <Input disabled={isLocked || saving} value={draft.name} onChange={(event) => patch({ name: event.target.value })} />
        </Field>
        <Field label="Status">
          <Select
            disabled
            value={draft.status}
          >
            <SelectTrigger className="w-full bg-muted/50 cursor-not-allowed">
              <SelectValue placeholder={estimateStatusLabel(draft.status)} />
            </SelectTrigger>
            <SelectContent
              position="popper"
              align="start"
              className="z-[100] w-[var(--radix-select-trigger-width)]"
            >
              {ESTIMATE_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {estimateStatusLabel(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Customer">
          <Input disabled className="bg-muted/50 cursor-not-allowed" value={customerName} />
        </Field>
        <Field label="Issued date">
          <Input type="date" disabled className="bg-muted/50 cursor-not-allowed" value={draft.issuedAt} />
        </Field>
        <Field label="Expires date">
          <Input type="date" disabled={isLocked || saving} value={draft.expiresAt} onChange={(event) => patch({ expiresAt: event.target.value })} />
        </Field>
        {customerPhone ? (
          <Field label="Customer phone">
            <Input disabled className="bg-muted/50 cursor-not-allowed" value={customerPhone} />
          </Field>
        ) : null}
        {customerEmail ? (
          <Field label="Customer email">
            <Input disabled className="bg-muted/50 cursor-not-allowed" value={customerEmail} />
          </Field>
        ) : null}
        <Field label="Job address">
          <Input disabled={isLocked || saving} value={draft.street} onChange={(event) => patch({ street: event.target.value })} />
        </Field>
        <Field label="City">
          <Input disabled={isLocked || saving} value={draft.city} onChange={(event) => patch({ city: event.target.value })} />
        </Field>
        <Field label="State">
          <Input disabled={isLocked || saving} value={draft.state} onChange={(event) => patch({ state: event.target.value })} />
        </Field>
        <Field label="ZIP">
          <Input disabled={isLocked || saving} value={draft.zip} onChange={(event) => patch({ zip: event.target.value })} />
        </Field>
        <label className="grid gap-1.5 text-sm sm:col-span-2">
          <span className="font-medium">Notes</span>
          <Textarea disabled={isLocked || saving} rows={3} value={draft.notes} onChange={(event) => patch({ notes: event.target.value })} />
        </label>
        <label className="grid gap-1.5 text-sm sm:col-span-2">
          <span className="font-medium">Terms</span>
          <Textarea disabled={isLocked || saving} rows={3} value={draft.terms} onChange={(event) => patch({ terms: event.target.value })} />
        </label>
        {job ? (
          <p className="text-sm text-muted-foreground sm:col-span-2">
            Converted to{" "}
            <Link href={`/pro/dashboard/jobs/${job.id}`} className="font-semibold text-primary hover:underline">
              {job.number}
            </Link>
            . The written quote stays on file.
          </p>
        ) : null}
      </div>

      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onOpenChange={(open) => {
          if (!open) handleCancelDialog();
        }}
        onSave={handleSaveAndLeave}
        onDiscard={handleDiscardAndLeave}
        onCancel={handleCancelDialog}
        saving={saving}
      />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">{label}</p>
      <div className="mt-1 font-medium text-foreground">{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}

export function EstimateSummaryTab({
  estimate,
  job,
}: {
  estimate: Estimate;
  job?: Job;
}) {
  const asJob = job ?? estimateAsJob(estimate);
  return <JobSummaryTab job={asJob} estimate={estimate} technician="" noun="estimate" />;
}
