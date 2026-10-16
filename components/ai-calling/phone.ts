/** Keep digits and a single leading "+" (what Twilio expects, E.164). */
export function normalizePhone(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  if (trimmed.startsWith("+")) return `+${digits}`;
  // Bare 10-digit numbers are treated as US/Canada.
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

export function isValidE164(value: string) {
  return /^\+[1-9]\d{7,14}$/.test(value);
}

/** "+15125550123" → "+1 (512) 555-0123"; other countries are left as E.164. */
export function formatPhone(value: string | null | undefined) {
  if (!value) return "";
  const normalized = normalizePhone(value);
  const match = normalized.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return match ? `+1 (${match[1]}) ${match[2]}-${match[3]}` : normalized;
}
