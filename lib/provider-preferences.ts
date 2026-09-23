/** Shared Pro language + payment method options (registration + profile). */

export const PROVIDER_LANGUAGES = ["English", "Spanish"] as const;
export type ProviderLanguage = (typeof PROVIDER_LANGUAGES)[number];

export const PROVIDER_PAYMENT_METHODS = [
  "Check",
  "Cash",
  "PayPal",
  "Square",
  "Venmo",
  "Zelle",
] as const;
export type ProviderPaymentMethod = (typeof PROVIDER_PAYMENT_METHODS)[number];

export function isProviderLanguage(value: string): value is ProviderLanguage {
  return (PROVIDER_LANGUAGES as readonly string[]).includes(value);
}

export function isProviderPaymentMethod(
  value: string,
): value is ProviderPaymentMethod {
  return (PROVIDER_PAYMENT_METHODS as readonly string[]).includes(value);
}

export function normalizePaymentMethods(values: unknown): ProviderPaymentMethod[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<ProviderPaymentMethod>();
  for (const item of values) {
    const raw = String(item || "").trim();
    if (isProviderPaymentMethod(raw)) seen.add(raw);
  }
  return PROVIDER_PAYMENT_METHODS.filter((method) => seen.has(method));
}

export function formatPaymentMethodsLabel(
  methods: readonly string[] | null | undefined,
): string {
  const normalized = normalizePaymentMethods(methods);
  return normalized.join(" • ");
}
