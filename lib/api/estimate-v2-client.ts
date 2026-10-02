import {
  deleteData,
  getData,
  invalidateGetCache,
  patchData,
  postData,
} from "@/components/api/apiFuntions";
import { providerCrmApi } from "@/components/api/ApiRoutesFile";
import { mapEstimate } from "@/lib/api/crm-mappers";
import type { Estimate } from "@/lib/types";

export type OpportunityStatus =
  | "new"
  | "assessment_scheduled"
  | "assessment_completed"
  | "estimate_draft"
  | "estimate_sent"
  | "won"
  | "lost";

export type PrepChoice =
  | "schedule_assessment"
  | "have_information"
  | "create_now"
  | "request_customer_info";

export type OpportunityPropertyAddress = {
  label?: string;
  addressId?: string | null;
  address?: string;
  street?: string;
  unit?: string;
  city?: string;
  state?: string;
  zip?: string;
  lat?: number;
  lng?: number;
};

export type OpportunityMeasurement = {
  id?: string;
  label: string;
  value?: string;
  unit?: string;
};

export type OpportunityAttachment = {
  id?: string;
  name?: string;
  url: string;
  type?: string;
  size?: number;
  addedAt?: string;
};

export type EstimateV2Opportunity = {
  id: string;
  number: string;
  customerId:
    | string
    | {
        id?: string;
        _id?: string;
        firstName?: string;
        lastName?: string;
        companyName?: string;
        email?: string;
        phone?: string;
        serviceAddresses?: OpportunityPropertyAddress[];
      };
  propertyAddress: OpportunityPropertyAddress;
  categoryId?: string | null;
  categoryName?: string;
  title: string;
  description?: string;
  source?: string;
  requestId?: string | null;
  status: OpportunityStatus;
  prepChoice?: PrepChoice | null;
  /** Captured for have_information / create_now (no visit). */
  prepFindings?: string;
  prepMeasurements?: OpportunityMeasurement[];
  workItems?: AssessmentWorkItem[];
  customerAttachments?: OpportunityAttachment[];
  internalNotes?: string;
  followUpAt?: string | null;
  followUpNotes?: string;
  siteAssessments?: EstimateV2SiteAssessment[];
  estimates?: Estimate[];
  activities?: Array<{ action?: string; details?: string; at?: string }>;
  estimateIds?: string[];
  createdAt?: string;
  updatedAt?: string;
};

export type VisitType =
  | "initial_assessment"
  | "follow_up_assessment"
  | "measurement"
  | "inspection"
  | "customer_walkthrough"
  | "estimate_review"
  | "other";

export type VisitStatus =
  | "scheduled"
  | "rescheduled"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show";

export type AssessmentWorkItemType = "labor" | "material" | "equipment";

export type AssessmentWorkItem = {
  id?: string;
  description: string;
  type?: AssessmentWorkItemType;
  quantity?: number;
  unit?: string;
  unitPrice?: number | null;
  notes?: string;
  catalogItemId?: string;
  catalogLabel?: string;
  customerVisible?: boolean;
};

export type EstimateV2SiteAssessment = {
  id: string;
  number: string;
  opportunityId: string;
  sequenceNumber?: number;
  visitType?: VisitType;
  visitTypeLabel?: string;
  assignedEmployeeId?: string | null;
  assignedEmployeeName?: string;
  scheduledAt?: string | null;
  durationMinutes?: number;
  instructions?: string;
  status: VisitStatus;
  photos?: Array<{ url: string; caption?: string }>;
  notes?: string;
  findings?: string;
  customerRequirements?: string;
  measurements?: Array<{ label: string; value?: string; unit?: string }>;
  workItems?: AssessmentWorkItem[];
  existingEquipment?: Record<string, string>;
  completedAt?: string | null;
  cancellationReason?: string;
  scheduleHistory?: Array<{
    action?: string;
    fromScheduledAt?: string | null;
    toScheduledAt?: string | null;
    reason?: string;
    actor?: string;
    at?: string;
  }>;
  scheduleId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

function unwrapData<T>(response: unknown): T {
  const root = (response || {}) as Record<string, unknown>;
  return (root.data ?? root) as T;
}

function bustEstimateV2Cache() {
  invalidateGetCache("provider/estimate-v2");
}

function mapOpportunityEstimates(raw: unknown): Estimate[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => mapEstimate(item))
    .filter((item): item is Estimate => Boolean(item));
}

function normalizeOpportunity(raw: EstimateV2Opportunity): EstimateV2Opportunity {
  return {
    ...raw,
    id: raw.id || String((raw as { _id?: string })._id || ""),
    estimates: mapOpportunityEstimates(raw.estimates),
  };
}

export async function listEstimateV2Opportunities(params?: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  customerId?: string;
  requestId?: string;
}) {
  const response = await getData(providerCrmApi.estimateV2Opportunities, params || {});
  const data = unwrapData<{
    items?: EstimateV2Opportunity[];
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  }>(response);
  return {
    items: Array.isArray(data.items)
      ? data.items.map((item) => normalizeOpportunity(item))
      : [],
    total: Number(data.total) || 0,
    page: Number(data.page) || 1,
    limit: Number(data.limit) || 20,
    totalPages: Number(data.totalPages) || 1,
  };
}

export async function getOpportunityByEstimateId(
  estimateId: string,
  options?: { force?: boolean; silent?: boolean },
) {
  const response = await getData(
    providerCrmApi.estimateV2OpportunityByEstimate(estimateId),
    undefined,
    {
      force: options?.force ?? true,
      silent: options?.silent,
    },
  );
  return normalizeOpportunity(unwrapData<EstimateV2Opportunity>(response));
}

export async function getEstimateV2Opportunity(
  id: string,
  options?: { force?: boolean; silent?: boolean },
) {
  const response = await getData(providerCrmApi.estimateV2Opportunity(id), undefined, {
    force: options?.force ?? true,
    silent: options?.silent,
  });
  return normalizeOpportunity(unwrapData<EstimateV2Opportunity>(response));
}

export async function createEstimateV2Opportunity(input: {
  customerId: string;
  propertyAddress: OpportunityPropertyAddress;
  title: string;
  description?: string;
  categoryId?: string;
  categoryName?: string;
  source?: string;
  requestId?: string;
  internalNotes?: string;
}) {
  const response = await postData(providerCrmApi.estimateV2Opportunities, input);
  return normalizeOpportunity(unwrapData<EstimateV2Opportunity>(response));
}

export async function updateEstimateV2Opportunity(
  id: string,
  patch: Partial<{
    title: string;
    description: string;
    categoryName: string;
    categoryId: string | null;
    propertyAddress: OpportunityPropertyAddress;
    prepChoice: PrepChoice;
    status: OpportunityStatus;
    internalNotes: string;
    followUpAt: string | null;
    followUpNotes: string;
    prepFindings: string;
    prepMeasurements: OpportunityMeasurement[];
    workItems: AssessmentWorkItem[];
    customerAttachments: OpportunityAttachment[];
  }>,
) {
  const response = await patchData(providerCrmApi.estimateV2Opportunity(id), patch);
  return normalizeOpportunity(unwrapData<EstimateV2Opportunity>(response));
}

export async function deleteEstimateV2Opportunity(id: string) {
  const response = await deleteData(providerCrmApi.estimateV2Opportunity(id), {
    silent: false,
  });
  bustEstimateV2Cache();
  return unwrapData<{ id: string; number?: string; deleted: boolean }>(response);
}

export async function createEstimateV2SiteAssessment(
  opportunityId: string,
  input: {
    assignedEmployeeId?: string;
    assignedEmployeeName?: string;
    scheduledAt?: string;
    durationMinutes?: number;
    instructions?: string;
    internalNotes?: string;
    findings?: string;
    customerRequirements?: string;
    visitType?: VisitType;
    visitTypeLabel?: string;
    reason?: string;
    status?: EstimateV2SiteAssessment["status"];
  },
) {
  const response = await postData(
    providerCrmApi.estimateV2OpportunityAssessments(opportunityId),
    input,
  );
  bustEstimateV2Cache();
  return unwrapData<EstimateV2SiteAssessment>(response);
}

export async function updateEstimateV2SiteAssessment(
  assessmentId: string,
  patch: Partial<EstimateV2SiteAssessment> & {
    reschedule?: boolean;
    rescheduleReason?: string;
    reason?: string;
  },
) {
  const response = await patchData(
    providerCrmApi.estimateV2Assessment(assessmentId),
    patch,
  );
  bustEstimateV2Cache();
  return unwrapData<EstimateV2SiteAssessment>(response);
}

export async function deleteEstimateV2SiteAssessment(assessmentId: string) {
  const response = await deleteData(providerCrmApi.estimateV2Assessment(assessmentId), {
    silent: false,
  });
  bustEstimateV2Cache();
  return unwrapData<{ id: string; number?: string; deleted: boolean }>(response);
}

export async function createEstimateV2Estimate(
  opportunityId: string,
  input?: {
    title?: string;
    notes?: string;
    terms?: string;
    discount?: number;
    items?: Array<{
      description: string;
      kind: "labor" | "material" | "equipment";
      quantity: number;
      unitPrice: number;
      taxRate?: number;
      images?: string[];
    }>;
    /** Used when falling back to legacy estimate create (remote without v2 estimate route). */
    customerId?: string;
    propertyAddress?: OpportunityPropertyAddress;
  },
) {
  try {
    const response = await postData(
      providerCrmApi.estimateV2OpportunityEstimates(opportunityId),
      input || {},
    );
    const data = unwrapData<{
      estimate: unknown;
      opportunity: EstimateV2Opportunity;
      reused?: boolean;
    }>(response);
    return {
      estimate: mapEstimate(data.estimate),
      opportunity: normalizeOpportunity(data.opportunity),
      reused: Boolean(data.reused),
    };
  } catch (err) {
    // Remote may not have the linking endpoint yet — create via classic estimates API.
    const { createEstimate } = await import("@/lib/api/crm-client");
    if (!input?.customerId) throw err;
    const created = await createEstimate({
      id: `est_temp_${Date.now()}`,
      number: "EST-TEMP",
      title: input.title || "Estimate",
      providerId: "",
      customerId: input.customerId,
      propertyAddress: {
        id: input.propertyAddress?.addressId || `addr_${Date.now()}`,
        address: input.propertyAddress?.address || input.propertyAddress?.street || "",
        street: input.propertyAddress?.street || input.propertyAddress?.address || "",
        city: input.propertyAddress?.city || "",
        state: input.propertyAddress?.state || "",
        zip: input.propertyAddress?.zip || "",
        country: "US",
        lat: input.propertyAddress?.lat ?? null,
        lng: input.propertyAddress?.lng ?? null,
        latitude: input.propertyAddress?.lat ?? null,
        longitude: input.propertyAddress?.lng ?? null,
      },
      status: "draft",
      issuedAt: new Date().toISOString().slice(0, 10),
      notes: input.notes || "",
      terms: input.terms || "Proposal valid for 30 calendar days from issue date.",
      subtotal: 0,
      discount: Number(input.discount) || 0,
      tax: 0,
      total: 0,
      items: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    if (!created?.id) throw err;
    try {
      await patchData(providerCrmApi.estimateV2Opportunity(opportunityId), {
        status: "estimate_draft",
      });
    } catch {
      /* status update optional on older backends */
    }
    return {
      estimate: created,
      opportunity: {
        id: opportunityId,
        number: "",
        customerId: input.customerId,
        propertyAddress: input.propertyAddress || {},
        title: input.title || "",
        status: "estimate_draft",
        estimates: [created],
      },
      reused: false,
    };
  }
}

export async function resolveEstimateV2Acceptance(
  opportunityId: string,
  input: {
    estimateId?: string;
    nextAction: "start_now" | "schedule_later" | "skip_job";
    markAccepted?: boolean;
    forceConvert?: boolean;
    signedBy?: string;
    title?: string;
  },
) {
  try {
    const response = await postData(
      providerCrmApi.estimateV2ResolveAcceptance(opportunityId),
      input,
    );
    const data = unwrapData<{
      opportunity: EstimateV2Opportunity;
      estimate: unknown;
      job: { id?: string; number?: string; status?: string } | null;
      nextAction: string;
    }>(response);
    return {
      opportunity: normalizeOpportunity(data.opportunity),
      estimate: mapEstimate(data.estimate),
      job: data.job,
      nextAction: data.nextAction,
    };
  } catch (err) {
    if (!input.estimateId) throw err;
    const { convertEstimateToJob, updateEstimateStatus } = await import(
      "@/lib/api/crm-client"
    );
    if (input.markAccepted) {
      try {
        await updateEstimateStatus(input.estimateId, "accepted");
      } catch {
        /* may already be accepted */
      }
    }
    const job =
      input.nextAction === "skip_job"
        ? null
        : await convertEstimateToJob(input.estimateId, {
            title: input.title,
          } as never);
    try {
      await patchData(providerCrmApi.estimateV2Opportunity(opportunityId), {
        status: "won",
      });
    } catch {
      /* optional */
    }
    return {
      opportunity: {
        id: opportunityId,
        number: "",
        customerId: "",
        propertyAddress: {},
        title: input.title || "",
        status: "won" as const,
      },
      estimate: null,
      job: job
        ? { id: job.id, number: job.number, status: job.status }
        : null,
      nextAction: input.nextAction,
    };
  }
}
