"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";
import { usePortalCrew } from "@/components/portal/use-portal-crew";
import { usePortalRecords } from "@/components/portal/use-portal-records";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import { writeCostLines, type JobCostLine } from "@/components/portal/use-job-costing";
import { writeSiteVisit } from "@/components/portal/use-job-file";
import {
  addressFrom,
  buildEstimate,
  buildJob,
  defaultWorkLines,
  nextRecordNumber,
  todayISO,
} from "@/components/portal/work-builders";
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
import { crmCustomerName } from "@/lib/data/crm-people";
import { employeeName, JOB_STATUSES, jobStatusLabel, type PortalRequest } from "@/lib/data/portal";
import { formatMoney } from "@/lib/format";
import type { Estimate, JobStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type EstimateTab = "customer" | "scope" | "visit" | "review";
type EstimatePath = "site_visit" | "office";
type JobTab = "customer" | "schedule" | "review";

export function CreateEstimateDialog({
  open,
  onOpenChange,
  customerId,
  requestId,
  requestName,
  requestNotes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId?: string;
  requestId?: string;
  requestName?: string;
  requestNotes?: string;
}) {
  const router = useRouter();
  const { session, provider, estimates } = usePortalWorkspace();
  const { customers } = useCrmDirectory();
  const { employees } = usePortalCrew();
  const records = usePortalRecords();
  const all = records.mergeEstimates(estimates);
  const first = customers[0];
  const [tab, setTab] = useState<EstimateTab>("customer");
  const [path, setPath] = useState<EstimatePath>("site_visit");
  const [name, setName] = useState("Service visit");
  const [selectedCustomer, setSelectedCustomer] = useState(customerId ?? first?.id ?? "");
  const customer = customers.find((item) => item.id === selectedCustomer) ?? first;
  const address = customer?.addresses[0];
  const [street, setStreet] = useState(address?.street ?? "");
  const [city, setCity] = useState(address?.city ?? "");
  const [state, setState] = useState(address?.state ?? "CO");
  const [zip, setZip] = useState(address?.zip ?? "");
  const [issuedAt, setIssuedAt] = useState(todayISO());
  const [expiresAt, setExpiresAt] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [visitedAt, setVisitedAt] = useState(todayISO());
  const [accessNotes, setAccessNotes] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("Valid for 30 days. Materials may change after site inspection.");
  const [lines, setLines] = useState<JobCostLine[]>(() => defaultWorkLines("Service visit"));
  const technician = employees.find((item) => item.id === employeeId);
  const nextTab = (current: EstimateTab): EstimateTab => {
    if (current === "customer") return path === "site_visit" ? "visit" : "scope";
    if (current === "visit" || current === "scope") return "review";
    return "review";
  };
  const prevTab = (current: EstimateTab): EstimateTab => {
    if (current === "review") return path === "site_visit" ? "visit" : "scope";
    return "customer";
  };

  useEffect(() => {
    if (!open) {
      setTab("customer");
      return;
    }
    if (requestName) {
      setName(requestName);
      setLines(defaultWorkLines(requestName));
    }
    if (requestNotes) setNotes(requestNotes);
    if (customerId) pickCustomer(customerId);
  }, [customerId, open, requestName, requestNotes]);

  useEffect(() => {
    if (!open || selectedCustomer || !customers[0]) return;
    pickCustomer(customerId ?? customers[0].id);
  }, [customerId, customers, open, selectedCustomer]);

  function pickCustomer(id: string) {
    setSelectedCustomer(id);
    const next = customers.find((item) => item.id === id);
    const nextAddress = next?.addresses[0];
    if (nextAddress) {
      setStreet(nextAddress.street);
      setCity(nextAddress.city);
      setState(nextAddress.state);
      setZip(nextAddress.zip);
    }
  }

  function create() {
    const customerIdValue = selectedCustomer || customers[0]?.id || "";
    if (!customerIdValue || !name.trim()) {
      toast.error("Customer and estimate name are required.");
      setTab("customer");
      return;
    }
    const estimate = buildEstimate({
      number: nextRecordNumber("EST", all.map((item) => item.number)),
      providerId: provider.id,
      customerId: customerIdValue,
      requestId,
      address: addressFrom(street, city, state, zip),
      status: path === "site_visit" ? "site_visit" : "draft",
      issuedAt,
      expiresAt: expiresAt || undefined,
      notes,
      terms,
      lines: lines.length ? lines : defaultWorkLines(name),
    });
    records.addEstimate(estimate);
    if (requestId) records.setStatus("request", requestId, "estimate_sent");
    writeCostLines(session?.email, estimate.id, estimate.items.map((item) => ({
      id: item.id,
      description: item.description,
      kind: item.type === "labor" ? "labor" : "materials",
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
    })));
    if (path === "site_visit") {
      writeSiteVisit(session?.email, estimate.id, {
        employeeId,
        technician: technician ? employeeName(technician) : "",
        visitedAt,
        accessNotes,
        findings: "",
        recommendations: "",
        measurements: "",
        photos: [],
      });
    }
    onOpenChange(false);
    toast.success(`${estimate.number} created.`);
    router.push(`/pro/dashboard/estimates/${estimate.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create estimate</DialogTitle>
          <DialogDescription>
            Send a technician for a site visit, or write the quote in the office. The customer signs the finalized estimate
            before the job starts.
          </DialogDescription>
        </DialogHeader>
        <WizardTabs
          value={tab}
          onChange={setTab}
          options={
            path === "site_visit"
              ? [
                  { id: "customer", label: "Customer" },
                  { id: "visit", label: "Site visit" },
                  { id: "review", label: "Review" },
                ]
              : [
                  { id: "customer", label: "Customer" },
                  { id: "scope", label: "Line items" },
                  { id: "review", label: "Review" },
                ]
          }
        />
        {tab === "customer" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
              <button
                type="button"
                className={cn(
                  "rounded-[4px] border px-3 py-3 text-left",
                  path === "site_visit" ? "border-[#003F7D] bg-[#e8eef5]" : "border-black/15 bg-card",
                )}
                onClick={() => {
                  setPath("site_visit");
                  setTab((current) => (current === "scope" ? "visit" : current));
                }}
              >
                <p className="text-sm font-semibold">Site visit first</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Send a technician to inspect, take photos, then finalize in the office.
                </p>
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-[4px] border px-3 py-3 text-left",
                  path === "office" ? "border-[#003F7D] bg-[#e8eef5]" : "border-black/15 bg-card",
                )}
                onClick={() => {
                  setPath("office");
                  setTab((current) => (current === "visit" ? "scope" : current));
                }}
              >
                <p className="text-sm font-semibold">Write in the office</p>
                <p className="mt-1 text-xs text-muted-foreground">Price the quote now, finalize, and send it for signature.</p>
              </button>
            </div>
            <Field label="Customer">
              <NativeSelect className="w-full" value={selectedCustomer} onChange={(event) => pickCustomer(event.target.value)}>
                {customers.map((item) => (
                  <NativeSelectOption key={item.id} value={item.id}>
                    {crmCustomerName(item)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Estimate name">
              <Input
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setLines((current) =>
                    current.map((line) =>
                      line.description.endsWith(" labor") || line.description.endsWith(" materials")
                        ? { ...line, description: `${event.target.value} ${line.kind === "labor" ? "labor" : "materials"}` }
                        : line,
                    ),
                  );
                }}
              />
            </Field>
            <Field label="Issued">
              <Input type="date" value={issuedAt} onChange={(event) => setIssuedAt(event.target.value)} />
            </Field>
            <Field label="Expires">
              <Input type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
            </Field>
            <Field label="Job address">
              <Input value={street} onChange={(event) => setStreet(event.target.value)} />
            </Field>
            <Field label="City">
              <Input value={city} onChange={(event) => setCity(event.target.value)} />
            </Field>
            <Field label="State">
              <Input value={state} onChange={(event) => setState(event.target.value)} />
            </Field>
            <Field label="ZIP">
              <Input value={zip} onChange={(event) => setZip(event.target.value)} />
            </Field>
          </div>
        ) : null}
        {tab === "visit" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Technician">
              <NativeSelect className="w-full" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
                <NativeSelectOption value="">Assign later</NativeSelectOption>
                {employees.map((item) => (
                  <NativeSelectOption key={item.id} value={item.id}>
                    {employeeName(item)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Visit date">
              <Input type="date" value={visitedAt} onChange={(event) => setVisitedAt(event.target.value)} />
            </Field>
            <Field label="Access / site notes" className="sm:col-span-2">
              <Textarea
                rows={3}
                placeholder="Gate code, pets, parking, who to ask for"
                value={accessNotes}
                onChange={(event) => setAccessNotes(event.target.value)}
              />
            </Field>
            <p className="sm:col-span-2 text-sm text-muted-foreground">
              Photos and findings are captured on the estimate after the technician is on site.
            </p>
          </div>
        ) : null}
        {tab === "scope" ? <LineEditor lines={lines} onChange={setLines} /> : null}
        {tab === "review" ? (
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">
              {name} for {customer ? crmCustomerName(customer) : "customer"} · {street || "No street"}
            </p>
            <Field label="Notes">
              <Textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
            </Field>
            <Field label="Terms">
              <Textarea rows={3} value={terms} onChange={(event) => setTerms(event.target.value)} />
            </Field>
          </div>
        ) : null}
        <DialogFooter>
          {tab !== "customer" ? (
            <Button variant="outline" onClick={() => setTab(prevTab(tab))}>
              Back
            </Button>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}
          {tab === "review" ? (
            <Button data-action="submit-estimate" onClick={create}>
              Create estimate
            </Button>
          ) : (
            <Button onClick={() => setTab(nextTab(tab))}>Continue</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CreateJobDialog({
  open,
  onOpenChange,
  customerId,
  estimate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId?: string;
  estimate?: Estimate;
}) {
  const router = useRouter();
  const { session, provider, estimates, jobs } = usePortalWorkspace();
  const { customers } = useCrmDirectory();
  const { employees } = usePortalCrew();
  const records = usePortalRecords();
  const allEstimates = records.mergeEstimates(estimates);
  const allJobs = records.mergeJobs(jobs);
  const first = customers[0];
  const [tab, setTab] = useState<JobTab>("customer");
  const [sourceId, setSourceId] = useState(estimate?.id ?? "");
  const source = allEstimates.find((item) => item.id === sourceId);
  const [name, setName] = useState(source?.items[0]?.description.replace(/ labor$/i, "") ?? "Service visit");
  const [selectedCustomer, setSelectedCustomer] = useState(estimate?.customerId ?? customerId ?? first?.id ?? "");
  const customer = customers.find((item) => item.id === selectedCustomer) ?? first;
  const address = source?.propertyAddress ?? customer?.addresses[0];
  const [street, setStreet] = useState(address?.street ?? "");
  const [city, setCity] = useState(address?.city ?? "");
  const [state, setState] = useState(address?.state ?? "CO");
  const [zip, setZip] = useState(address?.zip ?? "");
  const [start, setStart] = useState(todayISO());
  const [due, setDue] = useState("");
  const [status, setStatus] = useState<JobStatus>("unscheduled");
  const [employeeId, setEmployeeId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<JobCostLine[]>(() =>
    source
      ? source.items.map((item) => ({
          id: item.id,
          description: item.description,
          kind: item.type === "labor" ? "labor" : "materials",
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
        }))
      : defaultWorkLines("Service visit"),
  );

  const assignedTo = useMemo(() => {
    const match = employees.find((item) => item.id === employeeId);
    return match ? employeeName(match) : "";
  }, [employeeId, employees]);

  useEffect(() => {
    if (!open) {
      setTab("customer");
      return;
    }
    if (estimate?.id) pickSource(estimate.id);
  }, [estimate, open]);

  useEffect(() => {
    if (!open || selectedCustomer || !customers[0]) return;
    setSelectedCustomer(estimate?.customerId ?? customerId ?? customers[0].id);
  }, [customerId, customers, estimate, open, selectedCustomer]);

  function pickSource(id: string) {
    setSourceId(id);
    const next = allEstimates.find((item) => item.id === id);
    if (!next) return;
    setSelectedCustomer(next.customerId);
    setStreet(next.propertyAddress.street);
    setCity(next.propertyAddress.city);
    setState(next.propertyAddress.state);
    setZip(next.propertyAddress.zip);
    setName(next.items[0]?.description.replace(/ labor$/i, "") ?? name);
    setLines(
      next.items.map((item) => ({
        id: item.id,
        description: item.description,
        kind: item.type === "labor" ? "labor" : "materials",
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
      })),
    );
  }

  function create() {
    if (!selectedCustomer || !name.trim()) {
      toast.error("Customer and job name are required.");
      setTab("customer");
      return;
    }
    const workLines = lines.length ? lines : defaultWorkLines(name);
    const linked =
      source ??
      buildEstimate({
        number: nextRecordNumber("EST", allEstimates.map((item) => item.number)),
        providerId: provider.id,
        customerId: selectedCustomer,
        address: addressFrom(street, city, state, zip),
        status: "accepted",
        notes,
        lines: workLines,
      });
    if (!source) records.addEstimate(linked);
    const job = buildJob({
      number: nextRecordNumber("JOB", allJobs.map((item) => item.number)),
      providerId: provider.id,
      customerId: selectedCustomer,
      estimateId: linked.id,
      address: addressFrom(street, city, state, zip),
      assignedTo,
      scheduledAt: start,
      dueAt: due || undefined,
      status,
      notes,
      lines: workLines,
    });
    records.addJob(job);
    records.linkRecords("estimate", linked.id, job.id);
    records.setStatus("estimate", linked.id, "accepted");
    writeCostLines(session?.email, linked.id, workLines);
    writeCostLines(session?.email, job.id, workLines);
    onOpenChange(false);
    toast.success(`${job.number} created.`);
    router.push(`/pro/dashboard/jobs/${job.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create job</DialogTitle>
          <DialogDescription>Open field work from a written estimate, or start a job and keep a quote on file.</DialogDescription>
        </DialogHeader>
        <WizardTabs
          value={tab}
          onChange={setTab}
          options={[
            { id: "customer", label: "Customer" },
            { id: "schedule", label: "Schedule" },
            { id: "review", label: "Review" },
          ]}
        />
        {tab === "customer" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="From estimate">
              <NativeSelect className="w-full" value={sourceId} onChange={(event) => pickSource(event.target.value)}>
                <NativeSelectOption value="">New job (creates a draft quote)</NativeSelectOption>
                {allEstimates.map((item) => (
                  <NativeSelectOption key={item.id} value={item.id}>
                    {item.number}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Customer">
              <NativeSelect className="w-full" value={selectedCustomer} onChange={(event) => setSelectedCustomer(event.target.value)}>
                {customers.map((item) => (
                  <NativeSelectOption key={item.id} value={item.id}>
                    {crmCustomerName(item)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Job name">
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
            <Field label="Job address">
              <Input value={street} onChange={(event) => setStreet(event.target.value)} />
            </Field>
            <Field label="City">
              <Input value={city} onChange={(event) => setCity(event.target.value)} />
            </Field>
            <Field label="State">
              <Input value={state} onChange={(event) => setState(event.target.value)} />
            </Field>
            <Field label="ZIP">
              <Input value={zip} onChange={(event) => setZip(event.target.value)} />
            </Field>
          </div>
        ) : null}
        {tab === "schedule" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Start">
              <Input type="date" value={start} onChange={(event) => setStart(event.target.value)} />
            </Field>
            <Field label="Due">
              <Input type="date" value={due} onChange={(event) => setDue(event.target.value)} />
            </Field>
            <Field label="Technician">
              <NativeSelect className="w-full" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
                <NativeSelectOption value="">Unassigned</NativeSelectOption>
                {employees.map((item) => (
                  <NativeSelectOption key={item.id} value={item.id}>
                    {employeeName(item)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Status">
              <NativeSelect className="w-full" value={status} onChange={(event) => setStatus(event.target.value as JobStatus)}>
                {JOB_STATUSES.map((item) => (
                  <NativeSelectOption key={item} value={item}>
                    {jobStatusLabel(item)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <div className="sm:col-span-2">
              <LineEditor lines={lines} onChange={setLines} />
            </div>
          </div>
        ) : null}
        {tab === "review" ? (
          <Field label="Notes">
            <Textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Field>
        ) : null}
        <DialogFooter>
          {tab !== "customer" ? (
            <Button variant="outline" onClick={() => setTab(tab === "review" ? "schedule" : "customer")}>
              Back
            </Button>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}
          {tab === "review" ? (
            <Button data-action="submit-job" onClick={create}>
              Create job
            </Button>
          ) : (
            <Button onClick={() => setTab(tab === "customer" ? "schedule" : "review")}>Continue</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LineEditor({ lines, onChange }: { lines: JobCostLine[]; onChange: (lines: JobCostLine[]) => void }) {
  function patch(id: string, next: Partial<JobCostLine>) {
    onChange(lines.map((line) => (line.id === id ? { ...line, ...next } : line)));
  }

  return (
    <div className="space-y-2">
      {lines.map((line) => (
        <div key={line.id} className="grid grid-cols-[1fr_4.5rem_5.5rem_auto_auto] items-center gap-2">
          <Input
            placeholder={line.kind === "labor" ? "Additional labor" : "Additional material"}
            value={line.description}
            onChange={(event) => patch(line.id, { description: event.target.value })}
          />
          <Input
            type="number"
            min={0}
            step="0.25"
            value={line.quantity}
            onChange={(event) => patch(line.id, { quantity: Number(event.target.value) || 0 })}
          />
          <Input
            type="number"
            min={0}
            placeholder="0"
            step="1"
            value={line.unitPrice ? line.unitPrice : ""}
            onChange={(event) => patch(line.id, { unitPrice: Number(event.target.value) || 0 })}
          />
          <span className="text-sm tabular-nums">{formatMoney(line.quantity * line.unitPrice)}</span>
          <Button
            aria-label={`Remove ${line.description || line.kind}`}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            size="icon-sm"
            variant="ghost"
            onClick={() => onChange(lines.filter((item) => item.id !== line.id))}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            onChange([
              ...lines,
              { id: `line_${Date.now()}`, description: "", kind: "labor", quantity: 1, unit: "hr", unitPrice: 0 },
            ])
          }
        >
          Add labor
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            onChange([
              ...lines,
              { id: `line_m_${Date.now()}`, description: "", kind: "materials", quantity: 1, unit: "ea", unitPrice: 0 },
            ])
          }
        >
          Add material
        </Button>
      </div>
    </div>
  );
}

const LEAD_WINDOWS = ["Morning", "Afternoon", "Evening", "Flexible"];

export function CreateLeadDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { provider, requests } = usePortalWorkspace();
  const { customers } = useCrmDirectory();
  const records = usePortalRecords();
  const all = records.mergeRequests(requests);
  const first = customers[0];
  const [customerId, setCustomerId] = useState(first?.id ?? "");
  const [serviceName, setServiceName] = useState("");
  const [details, setDetails] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTimeWindow, setPreferredTimeWindow] = useState("Morning");
  const customer = customers.find((item) => item.id === customerId) ?? first;
  const address = customer?.addresses[0];

  useEffect(() => {
    if (!open) return;
    setCustomerId(customers[0]?.id ?? "");
    setServiceName("");
    setDetails("");
    setPreferredDate("");
    setPreferredTimeWindow("Morning");
  }, [customers, open]);

  function save() {
    if (!customer || !serviceName.trim()) {
      toast.error("Customer and service are required.");
      return;
    }
    const request: PortalRequest = {
      id: `req_${Date.now().toString(36)}`,
      number: nextRecordNumber("RS", all.map((item) => item.number)),
      customerId: customer.id,
      providerId: provider.id,
      categoryId: provider.categoryIds[0] ?? "plumbing",
      channel: "direct",
      zip: address?.zip ?? "",
      city: address?.city ?? provider.city,
      state: address?.state ?? provider.state,
      details: details.trim() || `${serviceName.trim()} requested by phone.`,
      preferredDate: preferredDate || undefined,
      preferredTimeWindow,
      photoUrls: [],
      status: "new",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      customerName: crmCustomerName(customer),
      customerEmail: customer.email,
      customerPhone: customer.phone ?? "",
      serviceName: serviceName.trim(),
      categoryName: "Service",
      neighborhood: address?.city ?? provider.city,
    };
    records.addRequest(request);
    toast.success(`${request.number} added to leads.`);
    onOpenChange(false);
    router.push(`/pro/dashboard/requests/${request.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-lenis-prevent>
        <DialogHeader>
          <DialogTitle>Create lead</DialogTitle>
          <DialogDescription>Log a phone, walk-in, or referral request before you write the estimate.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Customer">
            <NativeSelect className="w-full" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
              {customers.map((item) => (
                <NativeSelectOption key={item.id} value={item.id}>
                  {crmCustomerName(item)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Service">
            <Input value={serviceName} placeholder="Leak detection and repair" onChange={(event) => setServiceName(event.target.value)} />
          </Field>
          <Field label="What they asked for">
            <Textarea value={details} onChange={(event) => setDetails(event.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Preferred date">
              <Input type="date" value={preferredDate} onChange={(event) => setPreferredDate(event.target.value)} />
            </Field>
            <Field label="Window">
              <NativeSelect
                className="w-full"
                value={preferredTimeWindow}
                onChange={(event) => setPreferredTimeWindow(event.target.value)}
              >
                {LEAD_WINDOWS.map((item) => (
                  <NativeSelectOption key={item} value={item}>
                    {item}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!serviceName.trim() || !customerId} onClick={save}>
            Save lead
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WizardTabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <div className="flex gap-1 border-b border-black/10 pb-2">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={cn(
            "rounded-[4px] px-3 py-1.5 text-sm",
            value === option.id ? "bg-[#e8eef5] font-semibold text-[#003F7D]" : "text-muted-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("grid gap-1.5 text-sm", className)}>
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}
