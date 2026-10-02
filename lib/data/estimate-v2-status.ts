import type { OpportunityStatus } from "@/lib/api/estimate-v2-client";
import type { EstimateStatus } from "@/lib/types";

export function opportunityStatusLabel(status: OpportunityStatus | string) {
  switch (status as OpportunityStatus) {
    case "new":
      return "New";
    case "assessment_scheduled":
      return "Assessment scheduled";
    case "assessment_completed":
      return "Assessment completed";
    case "estimate_draft":
      return "Estimate draft";
    case "estimate_sent":
      return "Sent to customer";
    case "won":
      return "Won";
    case "lost":
      return "Lost";
    default:
      return String(status || "Unknown").replace(/_/g, " ");
  }
}

/** Distinct badge tones so every opportunity status is identifiable at a glance. */
export function opportunityStatusTone(status: OpportunityStatus | string) {
  switch (status as OpportunityStatus) {
    case "new":
      return "bg-slate-100 text-slate-700 ring-slate-200/80";
    case "assessment_scheduled":
      return "bg-sky-50 text-sky-800 ring-sky-200/80";
    case "assessment_completed":
      return "bg-teal-50 text-teal-800 ring-teal-200/80";
    case "estimate_draft":
      return "bg-amber-50 text-amber-900 ring-amber-200/80";
    case "estimate_sent":
      return "bg-[#e8eef5] text-[#003F7D] ring-[#003F7D]/25";
    case "won":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200/80";
    case "lost":
      return "bg-rose-50 text-rose-800 ring-rose-200/80";
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200/80";
  }
}

export function estimateStatusLabel(status: EstimateStatus | string) {
  switch (status as EstimateStatus) {
    case "site_visit":
      return "Site visit";
    case "inspected":
      return "Inspected";
    case "draft":
      return "Draft";
    case "scheduled":
      return "Scheduled";
    case "finalized":
      return "Ready to send";
    case "sent":
      return "Sent to customer";
    case "accepted":
      return "Accepted";
    case "rejected":
      return "Rejected";
    case "expired":
      return "Expired";
    case "changes_requested":
      return "Changes requested";
    case "converted_to_job":
      return "Converted to job";
    default:
      return String(status || "Unknown").replace(/_/g, " ");
  }
}

/** Ensure classic estimate statuses stay mutually distinct (scheduled ≠ sent). */
export function estimateStatusToneDistinct(status: EstimateStatus) {
  switch (status) {
    case "site_visit":
      return "bg-indigo-50 text-indigo-800";
    case "inspected":
      return "bg-teal-50 text-teal-800";
    case "draft":
      return "bg-amber-50 text-amber-900";
    case "scheduled":
      return "bg-violet-50 text-violet-800";
    case "finalized":
      return "bg-cyan-50 text-cyan-900";
    case "sent":
      return "bg-[#e8eef5] text-[#003F7D]";
    case "accepted":
      return "bg-emerald-50 text-emerald-800";
    case "rejected":
      return "bg-red-50 text-red-800";
    case "expired":
      return "bg-orange-50 text-orange-800";
    case "changes_requested":
      return "bg-amber-50 text-amber-900";
    case "converted_to_job":
      return "bg-green-50 text-green-900";
    default: {
      const _never: never = status;
      return _never;
    }
  }
}

/**
 * Map classic estimate status → opportunity pipeline status so list + workspace stay aligned.
 */
export function opportunityStatusForEstimateStatus(
  status: EstimateStatus | string | undefined | null,
): OpportunityStatus | null {
  switch (status as EstimateStatus) {
    case "sent":
    case "changes_requested":
      return "estimate_sent";
    case "accepted":
    case "converted_to_job":
      return "won";
    case "rejected":
    case "expired":
      return "lost";
    case "draft":
    case "site_visit":
    case "inspected":
    case "scheduled":
    case "finalized":
      return "estimate_draft";
    default:
      return null;
  }
}
