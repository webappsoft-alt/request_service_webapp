/**
 * International number from the country-picker input ("+447911123456"). Local formats
 * without a country code (e.g. "07911123456") are not guessed — the customer picks the
 * country in the same phone input the /get-a-quote page uses.
 */
export function normalizePhone(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  return trimmed.startsWith("+") && digits ? `+${digits}` : "";
}

/** E.164: "+", a country code that doesn't start with 0, 8–15 digits in total. */
export function isValidPhone(value: string) {
  return /^\+[1-9]\d{7,14}$/.test(normalizePhone(value));
}
