/** SessionStorage draft for the 3-step registration OTP lifecycle. */

export const PENDING_REGISTRATION_KEY = "rs-pending-registration";

export const REGISTRATION_OTP_LENGTH = 4;

/** Seconds before another code can be texted (matches the API cooldown). */
export const OTP_RESEND_SECONDS = 60;

/** A full international number from AuthPhoneInput ("+" country code + number), not just a dial code. */
export function isValidMobileNumber(value: string | undefined): boolean {
  return /^\+[1-9]\d{7,14}$/.test(String(value || "").trim());
}

/** "•••• 4567" — how the API shows a number a code was texted to. */
export function maskPhone(value: string | undefined): string {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 4 ? `•••• ${digits.slice(-4)}` : "your phone";
}

export type PendingCustomerRegistration = {
  kind: "customer";
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  zip?: string;
  location?: {
    type: "Point";
    coordinates: [number, number];
    city?: string;
    country?: string;
    address?: string;
    zip?: string;
    state?: string;
  };
};

export type PendingProviderRegistration = {
  kind: "provider";
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  companyName: string;
  tagline?: string;
  /** Preferred street line (API key: address). */
  address?: string;
  /** @deprecated Prefer `address`. */
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  lat?: number;
  lng?: number;
  location?: PendingCustomerRegistration["location"];
  categoryIds?: string[];
  offeredJobs?: string[];
  description?: string;
  yearsInBusiness?: number;
  employeeCount?: string;
  language?: string;
  paymentMethods?: string[];
  licensed?: boolean;
  insured?: boolean;
  website?: string;
  contactRole?: string;
  serviceArea?: string[];
};

export type PendingRegistration =
  | PendingCustomerRegistration
  | PendingProviderRegistration;
export function savePendingRegistration(draft: PendingRegistration): void {
  try {
    sessionStorage.setItem(PENDING_REGISTRATION_KEY, JSON.stringify(draft));
  } catch {
    // ignore quota / private mode
  }
}

export function readPendingRegistration(): PendingRegistration | null {
  try {
    const raw = sessionStorage.getItem(PENDING_REGISTRATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingRegistration;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.kind !== "customer" && parsed.kind !== "provider") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingRegistration(): void {
  try {
    sessionStorage.removeItem(PENDING_REGISTRATION_KEY);
  } catch {
    // ignore
  }
}
