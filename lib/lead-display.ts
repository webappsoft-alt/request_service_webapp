/** Synthetic CRM emails used for anonymous / guest browsing leads. */
export function isSyntheticLeadEmail(email?: string | null) {
  const value = String(email || "")
    .trim()
    .toLowerCase();
  return value.endsWith("@lead.local");
}

export function isGuestBrowsingName(name?: string | null) {
  const value = String(name || "")
    .trim()
    .toLowerCase();
  if (!value) return true;
  return (
    value === "guest" ||
    value === "temp" ||
    value.includes("prospective lead") ||
    value.includes("browsing lead") ||
    value === "customer"
  );
}

/** Pro UI label for lead customer name. */
export function displayLeadCustomerName(name?: string | null, email?: string | null) {
  if (isSyntheticLeadEmail(email) || isGuestBrowsingName(name)) return "Guest";
  const value = String(name || "").trim();
  return value || "Customer";
}

/** Hide generated visitor/guest emails in the UI. */
export function displayLeadEmail(email?: string | null) {
  if (isSyntheticLeadEmail(email)) return "";
  return String(email || "").trim();
}

/**
 * Area for leads: real customer location only.
 * Guest/synthetic leads without a zip stay blank (no provider-city fallback).
 */
export function displayLeadArea(input: {
  neighborhood?: string | null;
  city?: string | null;
  zip?: string | null;
  email?: string | null;
}) {
  const zip = String(input.zip || "").trim();
  const city = String(input.neighborhood || input.city || "").trim();
  if (isSyntheticLeadEmail(input.email) && !zip) {
    return { label: "", zip: "" };
  }
  return { label: city, zip };
}

const GUEST_ID_KEY = "rs-guest-lead-id";

/** Stable anonymous id so the same browser creates one guest browsing lead per pro. */
export function getOrCreateGuestLeadId() {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(GUEST_ID_KEY);
    if (existing && /^[a-z0-9-]{8,64}$/i.test(existing)) return existing;
    const created =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID().replace(/-/g, "").slice(0, 24)
        : `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(GUEST_ID_KEY, created);
    return created;
  } catch {
    return `g${Date.now().toString(36)}`;
  }
}

export function guestLeadEmail(guestId: string) {
  const id = String(guestId || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 32);
  return id ? `guest_${id}@lead.local` : "";
}
