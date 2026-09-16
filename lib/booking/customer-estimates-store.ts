const STORAGE_KEY = "rs-customer-estimate-tokens";

function normalizeToken(token: string) {
  return String(token || "")
    .trim()
    .replace(/^.*\/e\//i, "")
    .replace(/^.*\/estimates\//i, "")
    .split(/[?#]/)[0]
    .trim();
}

export function readCustomerEstimateTokens(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const tokens = parsed
      .map((item) => normalizeToken(String(item || "")))
      .filter(Boolean);
    return [...new Set(tokens)];
  } catch {
    return [];
  }
}

export function rememberCustomerEstimateToken(token: string) {
  if (typeof window === "undefined") return;
  const next = normalizeToken(token);
  if (!next) return;
  const existing = readCustomerEstimateTokens();
  if (existing[0] === next) return;
  const merged = [next, ...existing.filter((item) => item !== next)].slice(
    0,
    40,
  );
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
}

export function forgetCustomerEstimateToken(token: string) {
  if (typeof window === "undefined") return;
  const target = normalizeToken(token);
  if (!target) return;
  const next = readCustomerEstimateTokens().filter((item) => item !== target);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function extractEstimateTokenFromInput(value: string) {
  return normalizeToken(value);
}
