/**
 * Full U.S. states + DC for address forms.
 * Dropdown lists show full names; the selected value is the 2-letter code (CA, TX, FL).
 */

export type UsState = {
  code: string;
  name: string;
};

export const US_STATES: readonly UsState[] = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "DC", name: "District of Columbia" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
] as const;

const STATE_BY_CODE = Object.fromEntries(
  US_STATES.map((state) => [state.code, state]),
) as Record<string, UsState>;

const STATE_BY_NAME = Object.fromEntries(
  US_STATES.map((state) => [state.name.toLowerCase(), state.code]),
) as Record<string, string>;

/** Normalize free-text / Places output to a 2-letter code, or "". */
export function normalizeUsStateCode(value?: string | null): string {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (trimmed.length === 2) {
    const code = trimmed.toUpperCase();
    return STATE_BY_CODE[code] ? code : "";
  }
  return STATE_BY_NAME[trimmed.toLowerCase()] || "";
}

export function usStateName(code?: string | null): string {
  const normalized = normalizeUsStateCode(code);
  return normalized ? STATE_BY_CODE[normalized]?.name || "" : "";
}

/** Filter states by code or full name (case-insensitive). */
export function filterUsStates(query: string): UsState[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...US_STATES];
  return US_STATES.filter(
    (state) =>
      state.code.toLowerCase().includes(q) ||
      state.name.toLowerCase().includes(q),
  );
}
