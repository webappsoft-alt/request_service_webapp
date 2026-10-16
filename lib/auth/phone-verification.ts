/**
 * The API refuses a pro's requests with this code until their business phone
 * is verified by SMS (see backend middlewares/auth.js).
 */
export const PHONE_VERIFICATION_REQUIRED = "PHONE_VERIFICATION_REQUIRED";

/** Window event fired when a request hits the phone gate, so the portal can open the modal. */
export const PHONE_VERIFICATION_EVENT = "rs:phone-verification-required";

export function requestPhoneVerification(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PHONE_VERIFICATION_EVENT));
}

/** Digits only, for comparing two spellings of the same number. */
export function phoneDigits(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

/** True when `next` is a different number from `current` (empty `next` means "no change"). */
export function isPhoneChanged(next: unknown, current: unknown): boolean {
  const a = phoneDigits(next);
  return Boolean(a) && a !== phoneDigits(current);
}
