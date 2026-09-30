"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  GoogleAddressAutocomplete,
  type PlaceAddress,
} from "@/components/shared/google-address-autocomplete";
import { UsStateSelect } from "@/components/shared/us-state-select";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";
import { useCrmApiData } from "@/components/portal/use-crm-api-data";
import { CrmMark } from "@/components/portal/crm-mark";
import { useJobFile, type EstimateSettingsDraft } from "@/components/portal/use-job-file";
import { estimateAsJob } from "@/components/portal/work-builders";
import { JobSummaryTab } from "@/components/portal/job-file";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { UnsavedChangesDialog } from "@/components/ui/unsaved-changes-dialog";
import { updateEstimateSettings as updateEstimateSettingsApi } from "@/lib/api/crm-client";
import { crmCustomerName, type PortalCustomerCrm } from "@/lib/data/crm-people";
import { estimateStatusLabel } from "@/lib/data/portal";
import { normalizeUsStateCode } from "@/lib/data/us-states";
import { formatDate, formatLocation } from "@/lib/format";
import type { Estimate, Job } from "@/lib/types";
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
  const contact = customer ? `${customer.firstName} ${customer.lastName}`.trim() : "";
  const address = estimate.propertyAddress;
  const addressLine = [
    address.address || address.street,
    formatLocation(address.city, address.state, address.zip),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="w-full overflow-hidden rounded-lg border border-border-soft bg-card">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border-soft bg-[#f5f5f5] px-5 py-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <CrmMark
            name={customerLabel}
            kind={customer?.entityKind === "company" ? "company" : "person"}
            photoUrl={customer?.avatarUrl}
            size="lg"
          />
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold tracking-tight text-foreground">
              {estimate.customerId ? (
                <Link
                  href={`/pro/dashboard/customers/${estimate.customerId}`}
                  className="hover:text-primary hover:underline"
                >
                  {customerLabel}
                </Link>
              ) : (
                customerLabel
              )}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {[customer?.phone, customer?.email].filter(Boolean).join(" · ") ||
                "Customer details for this estimate"}
            </p>
          </div>
        </div>
        {estimate.customerId ? (
          <Button size="sm" variant="outline" className="h-8 shrink-0 border-border-soft" asChild>
            <Link href={`/pro/dashboard/customers/${estimate.customerId}`}>
              Open customer file
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="grid gap-x-8 gap-y-3.5 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
        {customer && customer.entityKind === "company" && contact ? (
          <Detail label="Contact" value={contact} />
        ) : null}
        <Detail label="Phone" value={customer?.phone || "—"} />
        <Detail
          label="Email"
          value={
            customer?.email ? (
              <span className="text-primary">{customer.email}</span>
            ) : (
              "—"
            )
          }
        />
        <Detail label="Service" value={service || "—"} />
        <Detail label="Address" value={addressLine || "—"} />
        <Detail label="Issued" value={formatDate(estimate.issuedAt)} />
        <Detail
          label="Expires"
          value={estimate.expiresAt ? formatDate(estimate.expiresAt) : "—"}
        />
        <Detail
          label="Status"
          value={
            <span className="capitalize">
              {estimateStatusLabel(estimate.status)}
            </span>
          }
        />
        {job ? (
          <Detail
            label="Linked job"
            value={
              <Link
                href={`/pro/dashboard/jobs/${job.id}`}
                className="font-semibold text-primary hover:underline"
              >
                {job.number}
              </Link>
            }
          />
        ) : null}
      </div>
    </div>
  );
}

export function EstimateSettingsTab({
  estimate,
  job,
  service,
  locked = false,
  compact = false,
  onSave,
}: {
  estimate: Estimate;
  job?: Job;
  service: string;
  locked?: boolean;
  compact?: boolean;
  onSave?: (updated: Estimate) => void;
}) {
  const { customers } = useCrmDirectory();
  const crm = useCrmApiData();
  const asJob = estimateAsJob(estimate);
  const file = useJobFile(asJob, estimate, undefined, "");

  const fallback = useMemo<EstimateSettingsDraft>(() => ({
    name: service,
    customerId: estimate.customerId,
    street: estimate.propertyAddress.address || estimate.propertyAddress.street,
    city: estimate.propertyAddress.city,
    state: normalizeUsStateCode(estimate.propertyAddress.state) || estimate.propertyAddress.state,
    zip: estimate.propertyAddress.zip,
    issuedAt: estimate.issuedAt.slice(0, 10),
    expiresAt: estimate.expiresAt?.slice(0, 10) ?? "",
    status: estimate.status,
    notes: estimate.notes ?? "",
    terms: estimate.terms ?? "",
  }), [estimate, service]);

  const [draft, setDraft] = useState<EstimateSettingsDraft>(fallback);
  const selected = customers.find((item) => item.id === draft.customerId) ?? customers.find((item) => item.id === estimate.customerId);
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
      (draft.expiresAt || "") !== (fallback.expiresAt || "")
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
        target.closest("[data-us-state-select-menu]") ||
        target.closest("[data-searchable-select-menu]") ||
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
    if (!estimate?.id) {
      throw new Error("Estimate not found.");
    }

    const chosenCustomer = customers.find((item) => item.id === settingsDraft.customerId);
    const customerName = chosenCustomer ? crmCustomerName(chosenCustomer) : estimate.customerName;
    const existingAddress = estimate.propertyAddress || {};
    const latRaw = existingAddress.lat ?? existingAddress.latitude;
    const lngRaw = existingAddress.lng ?? existingAddress.longitude;
    const lat = typeof latRaw === "number" && Number.isFinite(latRaw) ? latRaw : null;
    const lng = typeof lngRaw === "number" && Number.isFinite(lngRaw) ? lngRaw : null;

    const stateCode = normalizeUsStateCode(settingsDraft.state) || "";

    // Do not send notes/terms/status/customerId — settings-only fields that can break PUT.
    const updated = await updateEstimateSettingsApi(estimate.id, {
      title: settingsDraft.name.trim() || estimate.title,
      propertyAddress: {
        address: settingsDraft.street,
        street: settingsDraft.street,
        city: settingsDraft.city,
        state: stateCode,
        zip: settingsDraft.zip,
        lat,
        lng,
        latitude: lat,
        longitude: lng,
      },
      issuedAt: settingsDraft.issuedAt || estimate.issuedAt,
      ...(settingsDraft.expiresAt?.trim()
        ? { expiresAt: settingsDraft.expiresAt.trim() }
        : {}),
    });

    if (!updated) {
      throw new Error("Could not save this estimate.");
    }

    // Apply local UI only after the API succeeds so failures keep previous data.
    const savedDraft: EstimateSettingsDraft = {
      ...settingsDraft,
      notes: estimate.notes ?? "",
      terms: estimate.terms ?? "",
      status: updated.status || settingsDraft.status,
    };
    file.saveEstimateSettings(savedDraft);
    crm.patchEstimate(estimate.id, {
      ...updated,
      notes: updated.notes ?? estimate.notes,
      terms: updated.terms ?? estimate.terms,
      customerName: updated.customerName || customerName,
    });
    onSave?.({
      ...updated,
      notes: updated.notes ?? estimate.notes,
      terms: updated.terms ?? estimate.terms,
      customerName: updated.customerName || customerName,
    });
    return updated;
  }

  async function handleManualSave() {
    if (saving || isLocked) return;
    try {
      setSaving(true);
      await persist(draft);
      toast.success("Estimate settings saved.");
    } catch (error) {
      setDraft(fallback);
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
      setDraft(fallback);
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

  function applyAddress(address: PlaceAddress) {
    patch({
      street: address.streetAddress.trim(),
      city: address.city || "",
      state: normalizeUsStateCode(address.state) || "",
      ...(address.zipCode ? { zip: address.zipCode } : {}),
    });
  }

  const customerName = selected ? crmCustomerName(selected) : estimate.customerName || "Customer";
  const customerPhone = selected?.phone || estimate.customerPhone || "";
  const customerEmail = selected?.email || estimate.customerEmail || "";

  return (
    <div
      data-estimate-settings-form
      className={cn(
        compact ? "space-y-4" : "border border-border-soft bg-card p-4",
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        {compact ? (
          <p className="text-xs text-muted-foreground">
            {isLocked
              ? "This estimate is signed/locked. Settings cannot be edited."
              : "Update quote details, then save."}
          </p>
        ) : (
          <div>
            <h2 className="text-sm font-semibold">Estimate settings</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {isLocked
                ? "This estimate is signed/locked. Settings cannot be edited."
                : "Manage editable quote settings."}
            </p>
          </div>
        )}
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
          <Input
            disabled
            className="bg-muted/50 cursor-not-allowed"
            value={estimateStatusLabel(draft.status)}
          />
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
        <Field label="Address" className="sm:col-span-2">
          <GoogleAddressAutocomplete
            id="estimate-settings-address"
            value={draft.street}
            onChange={(street) => patch({ street })}
            onSelect={applyAddress}
            placeholder="Start typing your address…"
            autoComplete="off"
            disabled={isLocked || saving}
          />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-3">
          <Field label="City">
            <Input
              disabled={isLocked || saving}
              value={draft.city}
              placeholder="City"
              onChange={(event) => patch({ city: event.target.value })}
            />
          </Field>
          <Field label="State">
            <UsStateSelect
              value={normalizeUsStateCode(draft.state)}
              onChange={(code) => patch({ state: code })}
              placeholder="State"
              disabled={isLocked || saving}
            />
          </Field>
          <Field label="ZIP">
            <Input
              disabled={isLocked || saving}
              value={draft.zip}
              placeholder="ZIP"
              onChange={(event) => patch({ zip: event.target.value })}
              inputMode="numeric"
            />
          </Field>
        </div>
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
    <div className="min-w-0">
      <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </p>
      <div className="mt-1 text-sm font-medium leading-snug text-foreground break-words">
        {value}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("grid gap-1.5 text-sm", className)}>
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}

export function EstimateSettingsDialog({
  open,
  onOpenChange,
  estimate,
  job,
  service,
  locked = false,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estimate: Estimate;
  job?: Job;
  service: string;
  locked?: boolean;
  onSave?: (updated: Estimate) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit estimate</DialogTitle>
          <DialogDescription>
            Update estimate details and address.
          </DialogDescription>
        </DialogHeader>
        <EstimateSettingsTab
          estimate={estimate}
          job={job}
          service={service}
          locked={locked}
          compact
          onSave={(updated) => {
            onSave?.(updated);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
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
