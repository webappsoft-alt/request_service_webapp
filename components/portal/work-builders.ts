import { jobMoneySheet, jobCostMix, lineTotal, type JobCostLine } from "@/components/portal/use-job-costing";
import type { Estimate, EstimateItem, Invoice, InvoiceItem, Job, JobItem, ServiceAddress } from "@/lib/types";

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function nextRecordNumber(prefix: string, existing: string[]) {
  const values = existing.map((value) => Number.parseInt(value.replace(/\D/g, ""), 10)).filter((value) => !Number.isNaN(value));
  return `${prefix}-${Math.max(1000, ...values, 0) + 1}`;
}

export function addressFrom(
  street: string,
  city: string,
  state: string,
  zip: string,
  id = `addr_${Date.now().toString(36)}`,
): ServiceAddress {
  return { id, street, city, state, zip, country: "US" };
}

export function linesToEstimateItems(estimateId: string, lines: JobCostLine[]): EstimateItem[] {
  return lines.map((line) => ({
    id: line.id,
    estimateId,
    type: line.kind === "labor" ? "labor" : "materials",
    description: line.description,
    quantity: line.quantity,
    unit: line.unit,
    unitPrice: line.unitPrice,
    taxRate: 0.0825,
    discount: 0,
    total: lineTotal(line),
  }));
}

export function linesToJobItems(jobId: string, lines: JobCostLine[]): JobItem[] {
  return lines.map((line) => ({
    id: line.id,
    jobId,
    source: "estimate",
    description: line.description,
    quantity: line.quantity,
    unit: line.unit,
    unitPrice: line.unitPrice,
    total: lineTotal(line),
  }));
}

export function linesToInvoiceItems(invoiceId: string, lines: JobCostLine[]): InvoiceItem[] {
  return lines.map((line) => ({
    id: line.id,
    invoiceId,
    source: "estimate",
    description: line.description,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    total: lineTotal(line),
  }));
}

export function moneyFromLines(lines: JobCostLine[]) {
  return jobMoneySheet(jobCostMix(lines));
}

export function invoiceAsJob(invoice: Invoice, job?: Job): Job {
  return {
    id: invoice.id,
    number: invoice.number,
    providerId: invoice.providerId,
    customerId: invoice.customerId,
    estimateId: job?.estimateId ?? "",
    address: job?.address ?? { id: `addr_${invoice.id}`, street: "", city: "", state: "", zip: "", country: "US" },
    status: invoice.status === "paid" ? "paid" : invoice.status === "cancelled" ? "cancelled" : "invoiced",
    items: invoice.items.map((item) => ({
      id: item.id,
      jobId: invoice.id,
      source: item.source === "change_order" ? "change_order" : "estimate",
      description: item.description,
      quantity: item.quantity,
      unit: "ea",
      unitPrice: item.unitPrice,
      total: item.total,
    })),
    changeOrders: [],
    invoiceId: invoice.id,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
  };
}

export function estimateAsJob(estimate: Estimate): Job {
  return {
    id: estimate.id,
    number: estimate.number,
    providerId: estimate.providerId,
    customerId: estimate.customerId,
    estimateId: estimate.id,
    address: estimate.propertyAddress,
    status: "unscheduled",
    items: estimate.items.map((item) => ({
      id: item.id,
      jobId: estimate.id,
      source: "estimate",
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      total: item.total,
    })),
    changeOrders: [],
    createdAt: estimate.createdAt,
    updatedAt: estimate.updatedAt,
  };
}

export function buildEstimate(input: {
  id?: string;
  number: string;
  providerId: string;
  customerId: string;
  requestId?: string;
  address: ServiceAddress;
  status?: Estimate["status"];
  issuedAt?: string;
  expiresAt?: string;
  notes?: string;
  terms?: string;
  lines: JobCostLine[];
}): Estimate {
  const id = input.id ?? `est_${Date.now().toString(36)}`;
  const now = new Date().toISOString();
  const money = moneyFromLines(input.lines);
  return {
    id,
    number: input.number,
    providerId: input.providerId,
    customerId: input.customerId,
    requestId: input.requestId,
    propertyAddress: input.address,
    status: input.status ?? "draft",
    issuedAt: input.issuedAt || todayISO(),
    expiresAt: input.expiresAt,
    notes: input.notes,
    terms: input.terms,
    subtotal: money.subtotal,
    discount: 0,
    tax: money.tax,
    total: money.total,
    items: linesToEstimateItems(id, input.lines),
    createdAt: now,
    updatedAt: now,
  };
}

export function buildJob(input: {
  id?: string;
  number: string;
  providerId: string;
  customerId: string;
  estimateId?: string;
  serviceId?: string;
  address: ServiceAddress;
  assignedTo?: string;
  scheduledAt?: string;
  dueAt?: string;
  status?: Job["status"];
  notes?: string;
  lines: JobCostLine[];
}): Job {
  const id = input.id ?? `job_${Date.now().toString(36)}`;
  const now = new Date().toISOString();
  return {
    id,
    number: input.number,
    providerId: input.providerId,
    customerId: input.customerId,
    estimateId: input.estimateId ?? "",
    serviceId: input.serviceId,
    address: input.address,
    assignedTo: input.assignedTo,
    scheduledAt: input.scheduledAt,
    dueAt: input.dueAt,
    status: input.status ?? "unscheduled",
    notes: input.notes,
    items: linesToJobItems(id, input.lines),
    changeOrders: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function buildInvoice(input: {
  id?: string;
  number: string;
  providerId: string;
  customerId: string;
  jobId: string;
  lines: JobCostLine[];
}): Invoice {
  const id = input.id ?? `inv_${Date.now().toString(36)}`;
  const now = new Date().toISOString();
  const money = moneyFromLines(input.lines);
  return {
    id,
    number: input.number,
    providerId: input.providerId,
    customerId: input.customerId,
    jobId: input.jobId,
    status: "draft",
    issuedAt: todayISO(),
    dueAt: todayISO(),
    subtotal: money.subtotal,
    discount: 0,
    tax: money.tax,
    total: money.total,
    amountPaid: 0,
    balanceDue: money.total,
    items: linesToInvoiceItems(id, input.lines),
    createdAt: now,
    updatedAt: now,
  };
}

export function defaultWorkLines(name: string): JobCostLine[] {
  const stamp = Date.now();
  return [
    {
      id: `line_labor_${stamp}`,
      description: `${name} labor`,
      kind: "labor",
      quantity: 2,
      unit: "hr",
      unitPrice: 95,
    },
    {
      id: `line_mat_${stamp}`,
      description: `${name} materials`,
      kind: "materials",
      quantity: 1,
      unit: "ea",
      unitPrice: 85,
    },
  ];
}
