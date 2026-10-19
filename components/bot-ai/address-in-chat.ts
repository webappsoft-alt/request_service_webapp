import { normalizeUsStateCode } from "@/lib/data/us-states";

/**
 * Addresses typed straight into the chat ("8594 e nassau ave denver"). They open the
 * Location Modal prefilled with the text, so the customer confirms a real (geocoded)
 * address in one tap instead of being sent round the "Where's the job?" loop.
 */

const STREET_SUFFIX =
  "st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|way|ct|court|pl|place|pkwy|parkway|cir|circle|ter|terrace|hwy|highway|trl|trail|loop|sq|square";

/** "<number> [dir] <name…> <suffix>" anywhere in the text, e.g. "8594 e nassau ave". */
const STREET_RE = new RegExp(
  `\\b\\d{1,6}\\s+(?:[nsew]\\.?\\s+)?[a-z0-9.'-]+(?:\\s+[a-z0-9.'-]+){0,4}?\\s+(?:${STREET_SUFFIX})\\b`,
  "i",
);
const ZIP_RE = /^\d{5}(?:-\d{4})?$/;
/**
 * Whole message is "City, ST" or "City ST" with the code in capitals ("Denver CO").
 * Lower-case "denver co" without a comma is left alone so chat like "say hi" (HI) or
 * "count me in" (IN) isn't read as a place; it still counts when answering "Where's the job?".
 */
const CITY_COMMA_STATE_RE = /^[A-Za-z][A-Za-z .'-]{1,40}?,\s*([A-Za-z]{2})$/;
const CITY_CAPS_STATE_RE = /^[A-Za-z][A-Za-z .'-]{1,40}?\s+([A-Z]{2})$/;
/** "my address is …", "I'm at …" — dropped before matching. */
const LEAD_IN_RE = /^(?:(?:my|the|job)\s+)?(?:address|location)(?:\s+is)?\s*:?\s+|^(?:i'?m|we'?re|it'?s|located)\s+(?:at|in)\s+|^at\s+/i;

export type TypedAddress = {
  /** Text to prefill into the Location Modal search. */
  query: string;
  /** The message was only an address (vs. a problem description that included one). */
  wholeMessage: boolean;
};

export function detectTypedAddress(text: string): TypedAddress | null {
  const value = text.trim().replace(/[.!?]+$/, "");
  if (!value) return null;
  const stripped = value.replace(LEAD_IN_RE, "").trim();

  if (ZIP_RE.test(stripped)) return { query: stripped, wholeMessage: true };

  const stateCode = (CITY_COMMA_STATE_RE.exec(stripped) || CITY_CAPS_STATE_RE.exec(stripped))?.[1];
  if (stateCode && normalizeUsStateCode(stateCode)) {
    return { query: stripped, wholeMessage: true };
  }

  const street = STREET_RE.exec(stripped);
  if (street) {
    return {
      query: stripped.slice(street.index).trim().slice(0, 160),
      wholeMessage: street.index === 0,
    };
  }
  return null;
}

/** Reply to "Where's the job?": anything short that could be a street, city or ZIP. */
export function couldBeAddress(text: string) {
  const value = text.trim();
  if (ZIP_RE.test(value)) return true;
  return value.length >= 3 && value.length <= 160 && /[a-z]/i.test(value);
}
