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

/**
 * Registered platform account behind a CRM customer (from the list API).
 * "guest" = came in through the website with no customer account; "none" = no account.
 */
export type CustomerAccount = "registered" | "guest" | "none";
export type CustomerAccountFilter = Exclude<CustomerAccount, "none">;
/** One value for the Customers "Source" dropdown: a source group or an account filter. */
export type CustomerListFilter = CustomerOrigin | CustomerAccountFilter;

export const CUSTOMER_ACCOUNT_OPTIONS: Array<{ value: CustomerAccountFilter; label: string; hint: string }> = [
  { value: "registered", label: "Has account", hint: "Signed up on Request Services as a customer" },
  { value: "guest", label: "Guest", hint: "Website quote or chat with no customer account" },
];

/** Customers dropdown: Source group first, then Account. */
export const CUSTOMER_FILTER_OPTIONS: Array<{
  value: CustomerListFilter;
  label: string;
  hint: string;
  group: string;
}> = [
  ...CUSTOMER_ORIGIN_OPTIONS.map((option) => ({ ...option, group: "Source" })),
  ...CUSTOMER_ACCOUNT_OPTIONS.map((option) => ({ ...option, group: "Account" })),
];

export function isCustomerAccount(value: unknown): value is CustomerAccount {
  return value === "registered" || value === "guest" || value === "none";
}

export function isAccountFilter(value: unknown): value is CustomerAccountFilter {
  return value === "registered" || value === "guest";
}

export function customerFilterLabel(value: CustomerListFilter) {
  return isAccountFilter(value)
    ? CUSTOMER_ACCOUNT_OPTIONS.find((option) => option.value === value)!.label
    : originLabel(value);
}
