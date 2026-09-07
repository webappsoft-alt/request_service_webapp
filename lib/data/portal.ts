import type { DemoSession } from "@/lib/auth/demo-session";
import { getJobDetail } from "@/lib/data/jobs";
import { getActivePlans } from "@/lib/data/plans";
import { getJobImage } from "@/lib/data/provider-media";
import { getAllProviders } from "@/lib/data/providers";
import { getAreaName } from "@/lib/data/service-areas";
import { getServiceCategoryById, serviceCategories } from "@/lib/data/services";
import type {
  Customer,
  Estimate,
  EstimateItem,
  EstimateStatus,
  Invoice,
  InvoiceStatus,
  Job,
  JobStatus,
  Payment,
  PaymentMethodType,
  PaymentStatus,
  Provider,
  RequestStatus,
  ServiceAddress,
  ServiceRequest,
  Subscription,
  WorkingHours,
} from "@/lib/types";

export type QuoteAnswer = {
  id: string;
  label: string;
  value: string;
};

export type PortalRequest = ServiceRequest & {
  number: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceName: string;
  categoryName: string;
  neighborhood: string;
  answers?: QuoteAnswer[];
};

export type ServiceAvailabilityMode = "office" | "custom";

export const WEEKDAYS: WorkingHours["day"][] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export type PortalFixedService = {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  description: string;
  price: number;
  unit: "job" | "hour" | "visit";
  active: boolean;
  images: string[];
  coverage: string[];
  areaZips: string[];
  availabilityMode: ServiceAvailabilityMode;
  customHours: WorkingHours[];
};

export function cloneWorkingHours(hours: WorkingHours[] = []): WorkingHours[] {
  return WEEKDAYS.map((day) => {
    const found = hours.find((entry) => entry.day === day);
    if (found) {
      return { ...found };
    }
    const weekend = day === "saturday" || day === "sunday";
    return {
      day,
      open: weekend ? null : "08:00",
      close: weekend ? null : "17:00",
      closed: weekend,
    };
  });
}

export function serviceUnitLabel(unit: PortalFixedService["unit"]) {
  switch (unit) {
    case "job":
      return "per job";
    case "visit":
      return "per visit";
    case "hour":
      return "per hour";
    default: {
      const _exhaustive: never = unit;
      return _exhaustive;
    }
  }
}

export function serviceHours(
  service: Pick<PortalFixedService, "availabilityMode" | "customHours">,
  officeHours: WorkingHours[],
) {
  switch (service.availabilityMode) {
    case "office":
      return officeHours;
    case "custom":
      return service.customHours;
    default: {
      const _exhaustive: never = service.availabilityMode;
      return _exhaustive;
    }
  }
}

export type PortalActivity = {
  id: string;
  title: string;
  detail: string;
  at: string;
  href: string;
};

export type PortalRevenuePoint = {
  label: string;
  value: number;
};

export type PortalEmployeeRole = "owner" | "technician" | "estimator" | "dispatcher";

export type PortalEmployee = {
  id: string;
  firstName: string;
  lastName: string;
  role: PortalEmployeeRole;
  email: string;
  phone: string;
  trade: string;
  active: boolean;
  hourlyRate?: number;
  overtimeRate?: number;
  travelRate?: number;
  hireDate?: string;
  emergencyName?: string;
  emergencyPhone?: string;
};

export type PortalEventKind = "job" | "estimate" | "request" | "invoice" | "task";

export type PortalTimeWindow = "morning" | "afternoon" | "all_day";

export type PortalCalendarEvent = {
  id: string;
  kind: PortalEventKind;
  recordId: string;
  title: string;
  detail: string;
  customerName?: string;
  date?: string;
  endDate?: string;
  timeWindow: PortalTimeWindow;
  startMinutes?: number;
  endMinutes?: number;
  employeeId?: string;
  href: string;
  status: string;
};

export type PortalAssignment = {
  recordId: string;
  kind: PortalEventKind;
  date: string;
  endDate?: string;
  timeWindow: PortalTimeWindow;
  startMinutes?: number;
  endMinutes?: number;
  employeeId: string;
};

const REQUEST_STATUSES: RequestStatus[] = [
  "new",
  "viewed",
  "contacted",
  "estimate_sent",
  "accepted",
  "declined",
  "converted_to_job",
  "closed",
];

export const ESTIMATE_STATUSES: EstimateStatus[] = [
  "site_visit",
  "inspected",
  "draft",
  "finalized",
  "sent",
  "accepted",
  "rejected",
  "expired",
  "changes_requested",
];

export const ESTIMATE_STATUS_FILTERS = [
  { value: "", label: "All" },
  ...ESTIMATE_STATUSES.map((status) => ({ value: status, label: estimateStatusLabel(status) })),
];

export const JOB_STATUSES: JobStatus[] = [
  "unscheduled",
  "scheduled",
  "dispatched",
  "en_route",
  "on_site",
  "in_progress",
  "on_hold",
  "waiting_parts",
  "needs_return",
  "completed",
  "invoiced",
  "paid",
  "cancelled",
];

export const JOB_STATUS_FILTERS = [
  { value: "", label: "All" },
  ...JOB_STATUSES.map((status) => ({ value: status, label: jobStatusLabel(status) })),
];

export const ARCHIVE_FILTER = { value: "archived", label: "Archived" };

export function withArchiveFilter(options: { value: string; label: string; href?: string }[]) {
  return [...options, ARCHIVE_FILTER];
}

export const INVOICE_STATUSES: InvoiceStatus[] = [
  "draft",
  "sent",
  "partially_paid",
  "paid",
  "overdue",
  "cancelled",
];

export const INVOICE_BOARD_FILTERS = [
  { value: "", label: "All" },
  { value: "unpaid", label: "Unpaid" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "draft", label: "Draft" },
  { value: "partially_paid", label: "Partially paid" },
];

export type InvoiceKind = "draft" | "job" | "progress" | "change_order";

const EXTRA_CUSTOMERS = [
  { firstName: "Maya", lastName: "Ortiz", email: "maya.ortiz@example.com", phone: "(512) 555-0144" },
  { firstName: "Noah", lastName: "Brooks", email: "noah.brooks@example.com", phone: "(512) 555-0190" },
  { firstName: "Priya", lastName: "Shah", email: "priya.shah@example.com", phone: "(512) 555-0166" },
  { firstName: "Owen", lastName: "Keller", email: "owen.keller@example.com", phone: "(512) 555-0118" },
];

const CREW_POOL = [
  { firstName: "Luis", lastName: "Herrera", role: "technician" as const, trade: "Plumbing", phone: "(512) 555-0211" },
  { firstName: "Ava", lastName: "Chen", role: "technician" as const, trade: "HVAC", phone: "(512) 555-0218" },
  { firstName: "Marcus", lastName: "Reed", role: "technician" as const, trade: "General", phone: "(512) 555-0224" },
  { firstName: "Sofia", lastName: "Nguyen", role: "estimator" as const, trade: "Estimating", phone: "(512) 555-0230" },
];

function pad(value: number, size = 3) {
  return String(value).padStart(size, "0");
}

function money(base: number, index: number) {
  return Math.round(base + ((index * 47) % 220));
}

function dateOffset(daysAgo: number) {
  const date = new Date("2026-08-20T12:00:00");
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function addressFor(provider: Provider, zip: string, index: number): ServiceAddress {
  return {
    id: `addr_${provider.id}_${index}`,
    street: `${120 + index * 8} ${getAreaName(zip)} Ave`,
    city: provider.city,
    state: provider.state,
    zip,
    country: "US",
  };
}

export function getPortalProvider(session?: DemoSession | null): Provider {
  const all = getAllProviders();
  const byEmail = session?.email
    ? all.find((item) => item.email.toLowerCase() === session.email.toLowerCase())
    : undefined;
  const byCompany = session?.companyName
    ? all.find(
        (item) => item.companyName.toLowerCase() === session.companyName?.toLowerCase(),
      )
    : undefined;
  const base = byEmail ?? byCompany ?? all.find((item) => item.featured) ?? all[0];
  const fullName = [session?.firstName, session?.lastName].filter(Boolean).join(" ");

  return {
    ...base,
    companyName: session?.companyName || base.companyName,
    email: session?.email || base.email,
    contact: {
      name: fullName || base.contact?.name || "Owner",
      role: base.contact?.role ?? "Business owner",
    },
  };
}

export function getPortalServices(provider: Provider): PortalFixedService[] {
  return provider.categoryIds.flatMap((categoryId, categoryIndex) => {
    const category = getServiceCategoryById(categoryId);
    if (!category) return [];
    return category.commonServices.map((name, index) => {
      const detail = getJobDetail(name);
      const cover = getJobImage(category.id, name, index);
      const extra = getJobImage(category.id, name, index + 1);
      return {
        id: `svc_${category.slug}_${index + 1}`,
        name,
        categoryId: category.id,
        categoryName: category.name,
        description: detail.description,
        price: money(provider.startingPrice ?? 129, categoryIndex * 8 + index),
        unit: index % 5 === 0 ? "visit" : "job",
        active: index !== 4,
        images: [...new Set([cover, extra].filter((src): src is string => Boolean(src)))],
        coverage: detail.points,
        areaZips: [...provider.serviceArea],
        availabilityMode: "office",
        customHours: cloneWorkingHours(provider.workingHours),
      } satisfies PortalFixedService;
    });
  });
}

export function getPortalCustomers(provider: Provider): Customer[] {
  const fromReviews = provider.reviews.map((review, index) => {
    const [firstName, lastName = "Customer"] = review.customerName.replace(".", "").split(" ");
    return {
      id: `cust_${provider.id}_${index + 1}`,
      userId: `user_${provider.id}_${index + 1}`,
      firstName,
      lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
      phone: `(512) 555-01${pad(20 + index, 2)}`,
      addresses: [addressFor(provider, provider.serviceArea[index % provider.serviceArea.length], index)],
      createdAt: review.createdAt,
      updatedAt: review.createdAt,
    } satisfies Customer;
  });

  const extras = EXTRA_CUSTOMERS.map((person, index) => {
    const zip = provider.serviceArea[(index + fromReviews.length) % provider.serviceArea.length];
    return {
      id: `cust_${provider.id}_x${index + 1}`,
      userId: `user_${provider.id}_x${index + 1}`,
      firstName: person.firstName,
      lastName: person.lastName,
      email: person.email,
      phone: person.phone,
      addresses: [addressFor(provider, zip, fromReviews.length + index)],
      createdAt: dateOffset(40 + index * 6),
      updatedAt: dateOffset(12 + index),
    } satisfies Customer;
  });

  return [...fromReviews, ...extras];
}

export function getPortalRequests(provider: Provider): PortalRequest[] {
  const customers = getPortalCustomers(provider);
  const jobs = provider.categoryIds.flatMap((categoryId) => {
    const category = getServiceCategoryById(categoryId);
    return (category?.commonServices ?? []).map((job) => ({ category, job }));
  });

  return jobs.slice(0, 16).map((item, index) => {
    const customer = customers[index % customers.length];
    const zip = provider.serviceArea[index % provider.serviceArea.length];
    const category = item.category ?? serviceCategories[0];
    const createdAt = dateOffset(index * 2 + 1);
    return {
      id: `req_${pad(index + 1)}`,
      number: `RS-${2800 + index}`,
      customerId: customer.id,
      providerId: provider.id,
      categoryId: category.id,
      channel: index % 3 === 0 ? "direct" : "marketplace",
      zip,
      city: provider.city,
      state: provider.state,
      details: getJobDetail(item.job).description,
      preferredDate: dateOffset(-3 - (index % 5)),
      preferredTimeWindow: index % 2 === 0 ? "Morning" : "Afternoon",
      photoUrls: category.image ? [category.image] : [],
      status: REQUEST_STATUSES[index % REQUEST_STATUSES.length],
      createdAt,
      updatedAt: createdAt,
      customerName: `${customer.firstName} ${customer.lastName}`,
      customerEmail: customer.email,
      customerPhone: customer.phone ?? provider.phone,
      serviceName: item.job,
      categoryName: category.name,
      neighborhood: getAreaName(zip),
    } satisfies PortalRequest;
  });
}

function lineItems(estimateId: string, serviceName: string, price: number): EstimateItem[] {
  const labor = Math.round(price * 0.62);
  const materials = price - labor;
  return [
    {
      id: `${estimateId}_labor`,
      estimateId,
      type: "labor",
      description: `${serviceName} labor`,
      quantity: 1,
      unit: "job",
      unitPrice: labor,
      taxRate: 0.0825,
      discount: 0,
      total: labor,
    },
    {
      id: `${estimateId}_materials`,
      estimateId,
      type: "materials",
      description: `${serviceName} materials`,
      quantity: 1,
      unit: "lot",
      unitPrice: materials,
      taxRate: 0.0825,
      discount: 0,
      total: materials,
    },
  ];
}

export function getPortalEstimates(provider: Provider): Estimate[] {
  const requests = getPortalRequests(provider);
  const customers = getPortalCustomers(provider);
  return requests.slice(0, 8).map((request, index) => {
    const customer = customers.find((item) => item.id === request.customerId) ?? customers[0];
    const address = customer.addresses[0] ?? addressFor(provider, request.zip, index);
    const price = money(provider.startingPrice ?? 149, index + 3);
    const tax = Math.round(price * 0.0825);
    const id = `est_${pad(index + 1)}`;
    return {
      id,
      number: `EST-${1040 + index}`,
      providerId: provider.id,
      customerId: customer.id,
      requestId: request.id,
      propertyAddress: address,
      status: ESTIMATE_STATUSES[index % ESTIMATE_STATUSES.length],
      issuedAt: dateOffset(index + 2),
      expiresAt: dateOffset(index - 12),
      notes: `Written estimate for ${request.serviceName}.`,
      terms: "Valid for 14 days. Work starts after digital approval.",
      subtotal: price,
      discount: 0,
      tax,
      total: price + tax,
      items: lineItems(id, request.serviceName, price),
      signature:
        request.status === "accepted" || request.status === "converted_to_job"
          ? { signedBy: request.customerName, signedAt: dateOffset(index) }
          : undefined,
      createdAt: dateOffset(index + 2),
      updatedAt: dateOffset(index),
    } satisfies Estimate;
  });
}

export function getPortalJobs(provider: Provider): Job[] {
  const allEstimates = getPortalEstimates(provider);
  const pipeline = allEstimates.filter((estimate) => estimate.status === "accepted" || estimate.status === "sent");
  const leftover = allEstimates.filter((estimate) => !pipeline.some((item) => item.id === estimate.id));
  const estimates = [...pipeline, ...leftover];
  const customers = getPortalCustomers(provider);
  const crew = getPortalEmployees(provider);
  const owner = crew.find((item) => item.role === "owner") ?? crew[0];
  const fieldCrew = crew.filter((item) => item.role === "technician" || item.role === "owner");
  return estimates.map((estimate, index) => {
    const customer = customers.find((item) => item.id === estimate.customerId) ?? customers[0];
    const extras =
      index === 1
        ? [
            {
              id: `co_${pad(index + 1)}`,
              jobId: `job_${pad(index + 1)}`,
              number: `CO-${index + 1}`,
              description: "Additional supply line found during the visit",
              status: "approved" as const,
              items: [
                {
                  id: `co_${pad(index + 1)}_1`,
                  jobId: `job_${pad(index + 1)}`,
                  source: "change_order" as const,
                  description: "Additional pipe and fittings",
                  quantity: 1,
                  unit: "lot",
                  unitPrice: 75,
                  total: 75,
                },
              ],
              total: 75,
              createdAt: dateOffset(index),
              updatedAt: dateOffset(index),
            },
          ]
        : [];
    const start = dateOffset(-2 - (index % 8));
    return {
      id: `job_${pad(index + 1)}`,
      number: `JOB-${330 + index}`,
      providerId: provider.id,
      customerId: customer.id,
      estimateId: estimate.id,
      address: estimate.propertyAddress,
      assignedTo: employeeName(fieldCrew[index % fieldCrew.length] ?? owner),
      scheduledAt: start,
      dueAt: addIsoDays(start, index % 3 === 0 ? 3 : 1),
      status: JOB_STATUSES[index % JOB_STATUSES.length],
      notes: "Demo job created from an approved estimate.",
      items: estimate.items.map((item) => ({
        id: `jobitem_${item.id}`,
        jobId: `job_${pad(index + 1)}`,
        source: "estimate" as const,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        total: item.total,
      })),
      changeOrders: extras,
      invoiceId: `inv_${pad(index + 1)}`,
      createdAt: estimate.issuedAt,
      updatedAt: dateOffset(index),
    } satisfies Job;
  });
}

export function getPortalInvoices(provider: Provider): Invoice[] {
  const jobs = getPortalJobs(provider);
  const fromJobs = jobs.filter((job) => job.invoiceId).map((job, index) => {
      const extras = job.changeOrders.reduce((sum, order) => sum + order.total, 0);
      const estimateTotal = job.items.reduce((sum, item) => sum + item.total, 0);
      const subtotal = estimateTotal + extras;
      const tax = Math.round(subtotal * 0.0825);
      const total = subtotal + tax;
      const status = INVOICE_STATUSES[index % INVOICE_STATUSES.length];
      const amountPaid =
        status === "paid" ? total : status === "partially_paid" ? Math.round(total * 0.3) : 0;
      return {
        id: job.invoiceId ?? `inv_${pad(index + 1)}`,
        number: `INV-${910 + index}`,
        providerId: provider.id,
        customerId: job.customerId,
        jobId: job.id,
        status,
        issuedAt: dateOffset(index + 1),
        dueAt: dateOffset(index - 14),
        subtotal,
        discount: 0,
        tax,
        total,
        amountPaid,
        balanceDue: total - amountPaid,
        items: [
          ...job.items.map((item) => ({
            id: `invitem_${item.id}`,
            invoiceId: job.invoiceId ?? `inv_${pad(index + 1)}`,
            source: "estimate" as const,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
          })),
          ...job.changeOrders.flatMap((order) =>
            order.items.map((item) => ({
              id: `invitem_${item.id}`,
              invoiceId: job.invoiceId ?? `inv_${pad(index + 1)}`,
              source: "change_order" as const,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.total,
            })),
          ),
        ],
        createdAt: dateOffset(index + 1),
        updatedAt: dateOffset(index),
      } satisfies Invoice;
    });

  const invoicedEstimateIds = new Set(jobs.map((job) => job.estimateId));
  const fromEstimates = getPortalEstimates(provider)
    .filter((estimate) => !invoicedEstimateIds.has(estimate.id))
    .map((estimate, index) => {
      const offset = fromJobs.length + index;
      const subtotal = estimate.subtotal;
      const tax = estimate.tax;
      const total = estimate.total;
      const status = INVOICE_STATUSES[offset % INVOICE_STATUSES.length];
      const amountPaid =
        status === "paid" ? total : status === "partially_paid" ? Math.round(total * 0.3) : 0;
      const invoiceId = `inv_est_${pad(index + 1)}`;
      return {
        id: invoiceId,
        number: `INV-${910 + offset}`,
        providerId: provider.id,
        customerId: estimate.customerId,
        jobId: estimate.id,
        status,
        issuedAt: estimate.issuedAt,
        dueAt: dateOffset(offset - 10),
        subtotal,
        discount: estimate.discount,
        tax,
        total,
        amountPaid,
        balanceDue: total - amountPaid,
        items: estimate.items.map((item) => ({
          id: `invitem_${item.id}`,
          invoiceId,
          source: "estimate" as const,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
        })),
        createdAt: estimate.issuedAt,
        updatedAt: estimate.updatedAt,
      } satisfies Invoice;
    });

  return [...fromJobs, ...fromEstimates];
}

export function getPortalPayments(provider: Provider): Payment[] {
  return getPortalInvoices(provider).flatMap((invoice, index) => {
    if (invoice.amountPaid <= 0) return [];
    const deposit = invoice.status === "partially_paid";
    return [
      {
        id: `pay_${pad(index + 1)}`,
        invoiceId: invoice.id,
        amount: invoice.amountPaid,
        method: index % 2 === 0 ? "card" : "ach",
        status: "succeeded",
        paidAt: invoice.issuedAt,
        createdAt: invoice.issuedAt,
        scheduleId: deposit ? "sched_deposit" : undefined,
      } satisfies Payment,
    ];
  });
}

export function getPortalSubscription(provider: Provider): Subscription {
  const plan = getActivePlans().find((item) => item.highlighted) ?? getActivePlans()[0];
  return {
    id: `sub_${provider.id}`,
    providerId: provider.id,
    planId: plan.id,
    status: "active",
    currentPeriodStart: "2026-08-01",
    currentPeriodEnd: "2026-09-01",
    cancelAtPeriodEnd: false,
    createdAt: "2026-03-12",
    updatedAt: "2026-08-01",
  };
}

export function getPortalActivity(provider: Provider): PortalActivity[] {
  const requests = getPortalRequests(provider);
  const estimates = getPortalEstimates(provider);
  const jobs = getPortalJobs(provider);
  const invoices = getPortalInvoices(provider);
  return [
    requests[0]
      ? {
          id: "act_request",
          title: "New request",
          detail: `${requests[0].serviceName} · ${requests[0].neighborhood}`,
          at: requests[0].createdAt,
          href: `/pro/dashboard/requests/${requests[0].id}`,
        }
      : null,
    estimates.find((item) => item.status === "sent")
      ? {
          id: "act_estimate",
          title: "Estimate sent",
          detail: estimates.find((item) => item.status === "sent")?.number ?? "",
          at: estimates.find((item) => item.status === "sent")?.issuedAt ?? "",
          href: `/pro/dashboard/estimates/${estimates.find((item) => item.status === "sent")?.id}`,
        }
      : null,
    estimates.find((item) => item.status === "accepted")
      ? {
          id: "act_approved",
          title: "Estimate approved",
          detail: estimates.find((item) => item.status === "accepted")?.number ?? "",
          at: estimates.find((item) => item.status === "accepted")?.updatedAt ?? "",
          href: `/pro/dashboard/estimates/${estimates.find((item) => item.status === "accepted")?.id}`,
        }
      : null,
    jobs.find((item) => item.status === "completed")
      ? {
          id: "act_job",
          title: "Job completed",
          detail: jobs.find((item) => item.status === "completed")?.number ?? "",
          at: jobs.find((item) => item.status === "completed")?.updatedAt ?? "",
          href: `/pro/dashboard/jobs/${jobs.find((item) => item.status === "completed")?.id}`,
        }
      : null,
    invoices.find((item) => item.status === "paid")
      ? {
          id: "act_paid",
          title: "Invoice paid",
          detail: invoices.find((item) => item.status === "paid")?.number ?? "",
          at: invoices.find((item) => item.status === "paid")?.updatedAt ?? "",
          href: `/pro/dashboard/invoices/${invoices.find((item) => item.status === "paid")?.id}`,
        }
      : null,
    jobs.find((item) => item.changeOrders.length)
      ? {
          id: "act_material",
          title: "Material added",
          detail: jobs.find((item) => item.changeOrders.length)?.changeOrders[0]?.description ?? "",
          at: jobs.find((item) => item.changeOrders.length)?.updatedAt ?? "",
          href: `/pro/dashboard/jobs/${jobs.find((item) => item.changeOrders.length)?.id}`,
        }
      : null,
  ].filter((item): item is PortalActivity => Boolean(item));
}

export function getPortalRevenue(provider: Provider): PortalRevenuePoint[] {
  const paid = getPortalInvoices(provider)
    .filter((invoice) => invoice.status === "paid" || invoice.status === "partially_paid")
    .reduce((sum, invoice) => sum + invoice.amountPaid, 0);
  const months = ["Mar", "Apr", "May", "Jun", "Jul", "Aug"];
  return months.map((label, index) => ({
    label,
    value: Math.round(paid * (0.55 + index * 0.12) + (provider.startingPrice ?? 129) * index),
  }));
}

export function getPortalStats(provider: Provider) {
  const requests = getPortalRequests(provider);
  const jobs = getPortalJobs(provider);
  const estimates = getPortalEstimates(provider);
  const invoices = getPortalInvoices(provider);
  const payments = getPortalPayments(provider);
  const outstanding = invoices.reduce((sum, invoice) => sum + invoice.balanceDue, 0);
  const revenue = payments.reduce((sum, payment) => sum + payment.amount, 0);
  return {
    newRequests: requests.filter((item) => item.status === "new" || item.status === "viewed").length,
    awaitingReply: requests.filter((item) => item.status === "new").length,
    activeJobs: jobs.filter(
      (item) => item.status !== "completed" && item.status !== "invoiced" && item.status !== "paid" && item.status !== "cancelled",
    ).length,
    scheduledThisWeek: jobs.filter((item) => item.status === "scheduled").length,
    pendingEstimates: estimates.filter((item) => item.status === "sent" || item.status === "draft").length,
    pendingEstimateValue: estimates
      .filter((item) => item.status === "sent" || item.status === "draft")
      .reduce((sum, item) => sum + item.total, 0),
    outstanding,
    overdueInvoices: invoices.filter((item) => item.status === "overdue").length,
    revenue,
    upcomingJobs: jobs.filter((item) => item.status === "scheduled"),
  };
}

export function getPortalEmployees(provider: Provider): PortalEmployee[] {
  const [first = "Owner", ...rest] = (provider.contact?.name ?? "Owner").split(" ");
  const owner: PortalEmployee = {
    id: `emp_${provider.id}_owner`,
    firstName: first,
    lastName: rest.join(" "),
    role: "owner",
    email: provider.email,
    phone: provider.phone,
    trade: "Operations",
    active: true,
  };
  const count = provider.categoryIds.length > 1 ? 3 : 2;
  const crew = CREW_POOL.slice(0, count).map((person, index) => ({
    id: `emp_${provider.id}_${index + 1}`,
    firstName: person.firstName,
    lastName: person.lastName,
    role: person.role,
    email: `${person.firstName.toLowerCase()}.${person.lastName.toLowerCase()}@${provider.slug}.example`,
    phone: person.phone,
    trade: person.trade,
    active: true,
  })) satisfies PortalEmployee[];
  return [owner, ...crew];
}

export function employeeName(employee?: PortalEmployee | null) {
  if (!employee) return "Unassigned";
  return `${employee.firstName} ${employee.lastName}`.trim();
}

function timeWindowFrom(value?: string): PortalTimeWindow {
  const label = value?.toLowerCase() ?? "";
  if (label.includes("morning")) return "morning";
  if (label.includes("afternoon") || label.includes("evening")) return "afternoon";
  return "all_day";
}

export function minutesForWindow(window: PortalTimeWindow, index = 0) {
  switch (window) {
    case "morning": {
      const start = 8 * 60 + (index % 4) * 30;
      return { startMinutes: start, endMinutes: start + 90 };
    }
    case "afternoon": {
      const start = 13 * 60 + (index % 4) * 30;
      return { startMinutes: start, endMinutes: start + 90 };
    }
    case "all_day":
      return { startMinutes: 8 * 60, endMinutes: 17 * 60 };
    default: {
      const _never: never = window;
      return _never;
    }
  }
}

export function windowFromMinutes(start?: number, end?: number): PortalTimeWindow {
  if (start == null) return "all_day";
  if (end != null && end - start >= 8 * 60) return "all_day";
  if (start < 12 * 60) return "morning";
  return "afternoon";
}

export function formatClock(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour = ((hours + 11) % 12) + 1;
  return mins ? `${hour}:${String(mins).padStart(2, "0")} ${suffix}` : `${hour} ${suffix}`;
}

export function getPortalCalendarEvents(provider: Provider): PortalCalendarEvent[] {
  const requests = getPortalRequests(provider);
  const estimates = getPortalEstimates(provider);
  const jobs = getPortalJobs(provider);
  const crew = getPortalEmployees(provider);
  const fieldCrew = crew.filter((item) => item.role === "technician" || item.role === "owner");
  const jobEstimateIds = new Set(jobs.map((job) => job.estimateId));
  const jobRequestIds = new Set(
    estimates.filter((estimate) => jobEstimateIds.has(estimate.id)).map((estimate) => estimate.requestId),
  );

  const jobEvents = jobs.map((job, index) => {
    const request = requests.find((item) => item.id === estimates.find((estimate) => estimate.id === job.estimateId)?.requestId);
    const employee =
      crew.find((item) => employeeName(item) === job.assignedTo) ?? fieldCrew[index % fieldCrew.length];
    return {
      id: `cal_${job.id}`,
      kind: "job" as const,
      recordId: job.id,
      title: job.number,
      detail: request ? `${request.serviceName} · ${request.neighborhood}` : job.address.city,
      customerName: request?.customerName ?? getPortalCustomerName(provider, job.customerId),
      date: job.scheduledAt,
      endDate: job.dueAt ?? (job.scheduledAt ? addIsoDays(job.scheduledAt, index % 3 === 0 ? 2 : 0) : undefined),
      timeWindow: timeWindowFrom(request?.preferredTimeWindow),
      ...minutesForWindow(timeWindowFrom(request?.preferredTimeWindow), index),
      employeeId: employee?.id,
      href: `/pro/dashboard/jobs/${job.id}`,
      status: job.status,
    } satisfies PortalCalendarEvent;
  });

  const estimateEvents = estimates
    .filter((estimate) => !jobEstimateIds.has(estimate.id))
    .map((estimate, index) => {
      const request = requests.find((item) => item.id === estimate.requestId);
      const estimator = crew.find((item) => item.role === "estimator") ?? crew[0];
      const timeWindow = timeWindowFrom(request?.preferredTimeWindow);
      return {
        id: `cal_${estimate.id}`,
        kind: "estimate" as const,
        recordId: estimate.id,
        title: estimate.number,
        detail: request ? `${request.serviceName} · site visit` : "Estimate visit",
        customerName: request?.customerName ?? getPortalCustomerName(provider, estimate.customerId),
        date: request?.preferredDate,
        timeWindow,
        ...minutesForWindow(timeWindow, index),
        employeeId: estimator.id,
        href: `/pro/dashboard/estimates/${estimate.id}`,
        status: estimate.status,
      } satisfies PortalCalendarEvent;
    });

  const requestEvents = requests
    .filter((request) => !jobRequestIds.has(request.id) && !estimates.some((estimate) => estimate.requestId === request.id))
    .map((request, index) => ({
      id: `cal_${request.id}`,
      kind: "request" as const,
      recordId: request.id,
      title: request.number,
      detail: `${request.serviceName} · ${request.neighborhood}`,
      customerName: request.customerName,
      date: request.preferredDate,
      timeWindow: timeWindowFrom(request.preferredTimeWindow),
      ...minutesForWindow(timeWindowFrom(request.preferredTimeWindow), index),
      employeeId: fieldCrew[index % fieldCrew.length]?.id,
      href: `/pro/dashboard/requests/${request.id}`,
      status: request.status,
    })) satisfies PortalCalendarEvent[];

  const invoices = getPortalInvoices(provider);
  const invoiceEvents = invoices.map((invoice) => ({
    id: `cal_${invoice.id}`,
    kind: "invoice" as const,
    recordId: invoice.id,
    title: invoice.number,
    detail: `Balance ${invoice.balanceDue ? "due" : "current"}`,
    customerName: getPortalCustomerName(provider, invoice.customerId),
    date: invoice.dueAt ?? invoice.issuedAt,
    timeWindow: "all_day" as const,
    ...minutesForWindow("all_day"),
    employeeId: crew[0]?.id,
    href: `/pro/dashboard/invoices/${invoice.id}`,
    status: invoice.status,
  })) satisfies PortalCalendarEvent[];

  return [...jobEvents, ...estimateEvents, ...requestEvents, ...invoiceEvents];
}

function addIsoDays(value: string, days: number) {
  if (!days) return value;
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getPortalWorkspace(session?: DemoSession | null) {
  const provider = getPortalProvider(session);
  const customers = getPortalCustomers(provider);
  const requests = getPortalRequests(provider);
  const estimates = getPortalEstimates(provider);
  const jobs = getPortalJobs(provider);
  const invoices = getPortalInvoices(provider);
  const payments = getPortalPayments(provider);
  const employees = getPortalEmployees(provider);
  return {
    provider,
    customers,
    requests,
    estimates,
    jobs,
    invoices,
    payments,
    employees,
    calendarEvents: getPortalCalendarEvents(provider),
    services: getPortalServices(provider),
    subscription: getPortalSubscription(provider),
    activity: getPortalActivity(provider),
    revenue: getPortalRevenue(provider),
    stats: getPortalStats(provider),
    categories: provider.categoryIds
      .map((id) => getServiceCategoryById(id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item)),
  };
}

export function getPortalCustomerName(provider: Provider, customerId: string) {
  const customer = getPortalCustomers(provider).find((item) => item.id === customerId);
  return customer ? `${customer.firstName} ${customer.lastName}` : "Customer";
}

export function jobTotal(job: Job) {
  return job.items.reduce((sum, item) => sum + item.total, 0) + job.changeOrders.reduce((sum, order) => sum + order.total, 0);
}

export function jobServiceLabel(job: Job, estimates: Estimate[], requests: PortalRequest[]) {
  if (job.serviceId) {
    return job.items[0]?.description.replace(/ labor$/i, "") || "Fixed service";
  }
  const estimate = estimates.find((item) => item.id === job.estimateId);
  const request = requests.find((item) => item.id === estimate?.requestId);
  if (request?.serviceName) return request.serviceName;
  return job.items[0]?.description.replace(/ labor$/i, "") || "Service";
}

export function requestStatusLabel(status: RequestStatus) {
  switch (status) {
    case "new":
      return "New";
    case "viewed":
      return "Viewed";
    case "contacted":
      return "Contacted";
    case "estimate_sent":
      return "Estimate sent";
    case "accepted":
      return "Accepted";
    case "declined":
      return "Declined";
    case "converted_to_job":
      return "Converted to job";
    case "closed":
      return "Closed";
    default: {
      const _never: never = status;
      return _never;
    }
  }
}

export function estimateStatusLabel(status: EstimateStatus) {
  switch (status) {
    case "site_visit":
      return "Site visit";
    case "inspected":
      return "Inspected";
    case "draft":
      return "Draft";
    case "finalized":
      return "Finalized";
    case "sent":
      return "Sent";
    case "accepted":
      return "Accepted";
    case "rejected":
      return "Rejected";
    case "expired":
      return "Expired";
    case "changes_requested":
      return "Changes requested";
    default: {
      const _never: never = status;
      return _never;
    }
  }
}

export function estimateStatusTone(status: EstimateStatus) {
  switch (status) {
    case "site_visit":
      return "bg-indigo-50 text-indigo-800";
    case "inspected":
      return "bg-teal-50 text-teal-800";
    case "draft":
      return "bg-slate-100 text-slate-700";
    case "finalized":
      return "bg-[#e8eef5] text-[#003F7D]";
    case "sent":
      return "bg-sky-50 text-sky-800";
    case "accepted":
      return "bg-emerald-50 text-emerald-800";
    case "rejected":
      return "bg-red-50 text-red-800";
    case "expired":
      return "bg-orange-50 text-orange-800";
    case "changes_requested":
      return "bg-amber-50 text-amber-900";
    default: {
      const _never: never = status;
      return _never;
    }
  }
}

export function estimateCanShare(status: EstimateStatus) {
  switch (status) {
    case "finalized":
    case "sent":
    case "accepted":
    case "changes_requested":
      return true;
    case "site_visit":
    case "inspected":
    case "draft":
    case "rejected":
    case "expired":
      return false;
    default: {
      const _never: never = status;
      return _never;
    }
  }
}

export function estimateCanConvert(status: EstimateStatus, signed: boolean) {
  return signed || status === "accepted";
}

export function jobStatusLabel(status: JobStatus) {
  switch (status) {
    case "unscheduled":
      return "Unscheduled";
    case "scheduled":
      return "Scheduled";
    case "dispatched":
      return "Dispatched";
    case "en_route":
      return "En route";
    case "on_site":
      return "On site";
    case "in_progress":
      return "In progress";
    case "on_hold":
      return "On hold";
    case "waiting_parts":
      return "Waiting on parts";
    case "needs_return":
      return "Needs return";
    case "completed":
      return "Completed";
    case "invoiced":
      return "Invoiced";
    case "paid":
      return "Paid";
    case "cancelled":
      return "Cancelled";
    default: {
      const _never: never = status;
      return _never;
    }
  }
}

export function jobStatusTone(status: JobStatus) {
  switch (status) {
    case "unscheduled":
      return "bg-slate-100 text-slate-700";
    case "scheduled":
      return "bg-sky-50 text-sky-800";
    case "dispatched":
      return "bg-indigo-50 text-indigo-800";
    case "en_route":
      return "bg-cyan-50 text-cyan-800";
    case "on_site":
      return "bg-teal-50 text-teal-800";
    case "in_progress":
      return "bg-amber-50 text-amber-900";
    case "on_hold":
      return "bg-orange-50 text-orange-800";
    case "waiting_parts":
      return "bg-violet-50 text-violet-800";
    case "needs_return":
      return "bg-rose-50 text-rose-800";
    case "completed":
      return "bg-emerald-50 text-emerald-800";
    case "invoiced":
      return "bg-[#e8eef5] text-[#003F7D]";
    case "paid":
      return "bg-green-50 text-green-800";
    case "cancelled":
      return "bg-red-50 text-red-800";
    default: {
      const _never: never = status;
      return _never;
    }
  }
}

export function employeeRoleLabel(role: PortalEmployeeRole) {
  switch (role) {
    case "owner":
      return "Owner";
    case "technician":
      return "Technician";
    case "estimator":
      return "Estimator";
    case "dispatcher":
      return "Dispatcher";
    default: {
      const _never: never = role;
      return _never;
    }
  }
}

export function calendarEventStatusLabel(kind: PortalEventKind, status: string) {
  switch (kind) {
    case "job":
      return JOB_STATUSES.includes(status as JobStatus) ? jobStatusLabel(status as JobStatus) : status;
    case "estimate":
      return ESTIMATE_STATUSES.includes(status as EstimateStatus)
        ? estimateStatusLabel(status as EstimateStatus)
        : status;
    case "request":
      return REQUEST_STATUSES.includes(status as RequestStatus) ? requestStatusLabel(status as RequestStatus) : status;
    case "invoice":
      return INVOICE_STATUSES.includes(status as InvoiceStatus) ? invoiceStatusLabel(status as InvoiceStatus) : status;
    case "task":
      switch (status) {
        case "open":
          return "Open";
        case "in_progress":
          return "In progress";
        case "blocked":
          return "Blocked";
        case "done":
          return "Done";
        default:
          return status;
      }
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

export function calendarEventKindLabel(kind: PortalEventKind) {
  switch (kind) {
    case "job":
      return "Job";
    case "estimate":
      return "Estimate";
    case "request":
      return "Request";
    case "invoice":
      return "Invoice";
    case "task":
      return "Task";
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

export function calendarEventTone(kind: PortalEventKind) {
  switch (kind) {
    case "job":
      return "bg-[#003F7D] text-white";
    case "estimate":
      return "bg-[#0f766e] text-white";
    case "request":
      return "bg-[#64748b] text-white";
    case "invoice":
      return "bg-[#047857] text-white";
    case "task":
      return "bg-[#6d28d9] text-white";
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

export function timeWindowLabel(window: PortalTimeWindow) {
  switch (window) {
    case "morning":
      return "Morning";
    case "afternoon":
      return "Afternoon";
    case "all_day":
      return "All day";
    default: {
      const _never: never = window;
      return _never;
    }
  }
}

export function invoiceStatusTone(status: InvoiceStatus) {
  switch (status) {
    case "draft":
      return "bg-slate-100 text-slate-700";
    case "sent":
      return "bg-sky-50 text-sky-800";
    case "partially_paid":
      return "bg-amber-50 text-amber-900";
    case "paid":
      return "bg-green-50 text-green-800";
    case "overdue":
      return "bg-orange-50 text-orange-800";
    case "cancelled":
      return "bg-red-50 text-red-800";
    default: {
      const _never: never = status;
      return _never;
    }
  }
}

export function invoiceStatusLabel(status: InvoiceStatus) {
  switch (status) {
    case "draft":
      return "Draft";
    case "sent":
      return "Sent";
    case "partially_paid":
      return "Partially paid";
    case "paid":
      return "Paid";
    case "overdue":
      return "Overdue";
    case "cancelled":
      return "Cancelled";
    default: {
      const _never: never = status;
      return _never;
    }
  }
}

export function invoiceIsUnpaid(status: InvoiceStatus) {
  switch (status) {
    case "draft":
    case "sent":
    case "partially_paid":
    case "overdue":
      return true;
    case "paid":
    case "cancelled":
      return false;
    default: {
      const _never: never = status;
      return _never;
    }
  }
}

export function invoiceDaysOverdue(invoice: Pick<Invoice, "dueAt" | "status">, today = new Date()) {
  if (!invoice.dueAt || invoice.status === "paid" || invoice.status === "cancelled") return 0;
  const due = new Date(`${invoice.dueAt.slice(0, 10)}T00:00:00`);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.floor((start.getTime() - due.getTime()) / 86_400_000);
  return days > 0 ? days : 0;
}

export function invoiceKind(invoice: Invoice): InvoiceKind {
  if (invoice.status === "draft") return "draft";
  if (invoice.items.some((item) => item.source === "change_order")) return "change_order";
  if (invoice.amountPaid > 0 && invoice.balanceDue > 0) return "progress";
  return "job";
}

export function invoiceKindLabel(kind: InvoiceKind) {
  switch (kind) {
    case "draft":
      return "Draft invoice";
    case "job":
      return "Job invoice";
    case "progress":
      return "Progress invoice";
    case "change_order":
      return "Change order";
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

export function invoiceMatchesBoardFilter(invoice: Pick<Invoice, "status">, filter: string) {
  if (!filter || filter === "archived") return true;
  if (filter === "unpaid") return invoiceIsUnpaid(invoice.status);
  return invoice.status === filter;
}

export function invoiceStatusAfterPayment(status: InvoiceStatus, balanceDue: number): InvoiceStatus {
  if (balanceDue <= 0) return "paid";
  switch (status) {
    case "overdue":
      return "overdue";
    case "cancelled":
      return "cancelled";
    case "draft":
    case "sent":
    case "partially_paid":
    case "paid":
      return "partially_paid";
    default: {
      const _never: never = status;
      return _never;
    }
  }
}

export const PAYMENT_STATUSES: PaymentStatus[] = [
  "pending",
  "processing",
  "succeeded",
  "failed",
  "refunded",
];

export const PAYMENT_BOARD_FILTERS = [
  { value: "", label: "All" },
  { value: "succeeded", label: "Succeeded" },
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" },
];

export type PaymentKind = "payment" | "deposit";

export function paymentNumber(payment: Pick<Payment, "id">) {
  return `PMT-${payment.id.replace(/^pay_?/, "")}`;
}

export function paymentStatusLabel(status: PaymentStatus) {
  switch (status) {
    case "pending":
      return "Pending";
    case "processing":
      return "Processing";
    case "succeeded":
      return "Succeeded";
    case "failed":
      return "Failed";
    case "refunded":
      return "Refunded";
    default: {
      const _never: never = status;
      return _never;
    }
  }
}

export function paymentStatusTone(status: PaymentStatus) {
  switch (status) {
    case "pending":
    case "processing":
      return "bg-amber-50 text-amber-900";
    case "succeeded":
      return "bg-green-50 text-green-800";
    case "failed":
      return "bg-red-50 text-red-800";
    case "refunded":
      return "bg-slate-100 text-slate-700";
    default: {
      const _never: never = status;
      return _never;
    }
  }
}

export function paymentMethodLabel(method: PaymentMethodType) {
  switch (method) {
    case "card":
      return "Card";
    case "ach":
      return "ACH";
    case "check":
      return "Check";
    case "cash":
      return "Cash";
    default: {
      const _never: never = method;
      return _never;
    }
  }
}

export function paymentKind(payment: Payment): PaymentKind {
  return payment.scheduleId ? "deposit" : "payment";
}

export function paymentKindLabel(kind: PaymentKind) {
  switch (kind) {
    case "deposit":
      return "Deposit";
    case "payment":
      return "Payment";
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

export function paymentMatchesBoardFilter(payment: Pick<Payment, "status">, filter: string) {
  if (!filter || filter === "archived") return true;
  return payment.status === filter;
}

export function invoiceItemSourceLabel(source: Invoice["items"][number]["source"]) {
  switch (source) {
    case "estimate":
      return "Estimate";
    case "change_order":
      return "Change order";
    case "adjustment":
      return "Adjustment";
    default: {
      const _never: never = source;
      return _never;
    }
  }
}
