/**
 * Where a lead or customer came from — the Pro portal's "Source" filter.
 * Matches the backend `origin` query param (modules/crm/lead-origins.js).
 */
export type CustomerOrigin = "ai_call" | "website" | "manual" | "external";
export type LeadOrigin = CustomerOrigin | "messages";

const LABELS: Record<LeadOrigin, string> = {
  ai_call: "AI call",
  website: "Website",
  messages: "Messages",
  manual: "Added by you",
  external: "Request Services",
};

export function originLabel(origin: LeadOrigin) {
  return LABELS[origin];
}

export const CUSTOMER_ORIGIN_OPTIONS: Array<{ value: CustomerOrigin; label: string; hint: string }> = [
  { value: "ai_call", label: LABELS.ai_call, hint: "Created by the AI receptionist during a call" },
  { value: "website", label: LABELS.website, hint: "Quote requests and website chat" },
  { value: "manual", label: LABELS.manual, hint: "Entered by you (phone, referral, walk-in)" },
  { value: "external", label: LABELS.external, hint: "Assigned to you by Request Services" },
];

export const LEAD_ORIGIN_OPTIONS: Array<{ value: LeadOrigin; label: string; hint: string }> = [
  { value: "ai_call", label: LABELS.ai_call, hint: "Captured by the AI receptionist" },
  { value: "website", label: LABELS.website, hint: "Quote requests, profile and service views" },
  { value: "messages", label: LABELS.messages, hint: "Started from a direct chat message" },
  { value: "manual", label: LABELS.manual, hint: "Created by you (phone, walk-in)" },
  { value: "external", label: LABELS.external, hint: "Assigned to you by Request Services" },
];

export function isCustomerOrigin(value: unknown): value is CustomerOrigin {
  return CUSTOMER_ORIGIN_OPTIONS.some((option) => option.value === value);
}

export function isLeadOrigin(value: unknown): value is LeadOrigin {
  return LEAD_ORIGIN_OPTIONS.some((option) => option.value === value);
}
