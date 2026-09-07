"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";
import { useJobFile, type EstimateSettingsDraft } from "@/components/portal/use-job-file";
import { usePortalRecords } from "@/components/portal/use-portal-records";
import { estimateAsJob } from "@/components/portal/work-builders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
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
}: {
  estimate: Estimate;
  job?: Job;
  service: string;
}) {
  const { customers } = useCrmDirectory();
  const records = usePortalRecords();
  const asJob = estimateAsJob(estimate);
  const file = useJobFile(asJob, estimate, undefined, "");
  const selected = customers.find((item) => item.id === estimate.customerId);
  const [draft, setDraft] = useState<EstimateSettingsDraft>(() => ({
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
  }));

  function patch(next: Partial<EstimateSettingsDraft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  return (
    <div className="rounded-[4px] border border-black/10 bg-card p-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Estimate settings</h2>
        <Button
          size="sm"
          onClick={() => {
            file.saveEstimateSettings(draft);
            records.setStatus("estimate", estimate.id, draft.status);
            toast.success("Estimate settings saved.");
          }}
        >
          Save settings
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Estimate name">
          <Input value={draft.name} onChange={(event) => patch({ name: event.target.value })} />
        </Field>
        <Field label="Status">
          <NativeSelect
            className="w-full"
            value={draft.status}
            onChange={(event) => patch({ status: event.target.value as EstimateStatus })}
          >
            {ESTIMATE_STATUSES.map((status) => (
              <NativeSelectOption key={status} value={status}>
                {estimateStatusLabel(status)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Customer">
          <NativeSelect className="w-full" value={draft.customerId} onChange={(event) => patch({ customerId: event.target.value })}>
            {customers.map((item) => (
              <NativeSelectOption key={item.id} value={item.id}>
                {crmCustomerName(item)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Issued">
          <Input type="date" value={draft.issuedAt} onChange={(event) => patch({ issuedAt: event.target.value })} />
        </Field>
        <Field label="Expires">
          <Input type="date" value={draft.expiresAt} onChange={(event) => patch({ expiresAt: event.target.value })} />
        </Field>
        {selected?.phone ? (
          <Field label="Customer phone">
            <Input readOnly value={selected.phone} />
          </Field>
        ) : null}
        {selected?.email ? (
          <Field label="Customer email">
            <Input readOnly value={selected.email} />
          </Field>
        ) : null}
        <Field label="Job address">
          <Input value={draft.street} onChange={(event) => patch({ street: event.target.value })} />
        </Field>
        <Field label="City">
          <Input value={draft.city} onChange={(event) => patch({ city: event.target.value })} />
        </Field>
        <Field label="State">
          <Input value={draft.state} onChange={(event) => patch({ state: event.target.value })} />
        </Field>
        <Field label="ZIP">
          <Input value={draft.zip} onChange={(event) => patch({ zip: event.target.value })} />
        </Field>
        <label className="grid gap-1.5 text-sm sm:col-span-2">
          <span className="font-medium">Notes</span>
          <Textarea rows={3} value={draft.notes} onChange={(event) => patch({ notes: event.target.value })} />
        </label>
        <label className="grid gap-1.5 text-sm sm:col-span-2">
          <span className="font-medium">Terms</span>
          <Textarea rows={3} value={draft.terms} onChange={(event) => patch({ terms: event.target.value })} />
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
