/**
 * Platform → Pro SaaS membership tiers shown on /pro/dashboard/subscription.
 *
 * Plans are managed by the Super Admin (admin → Subscription Plans) and served by
 * `GET /api/public/subscription-plans`. This file only holds the card shape, the
 * API → card mapper, and price helpers.
 * (Unrelated to customer job billing under Money → Invoices / Payments.)
 */

export type ProPlanBillingCycle = "monthly" | "annual";

export type ProPlanFeature = {
  label: string;
  included: boolean;
};

export type ProSubscriptionPlan = {
  id: string;
  slug: string;
  name: string;
  /** Short audience label shown under the plan name. */
  tagline: string;
  /** Monthly price in USD. */
  monthlyPrice: number;
  /** Per-month price in USD when billed annually (yearly total ÷ 12). */
  annualMonthlyPrice: number;
  /** Full-year amount in USD on annual billing. */
  annualTotal: number;
  description: string;
  /** Included inbound AI voice minutes per month; 0 = AI receptionist not included. */
  callingMinutes: number;
  features: ProPlanFeature[];
  badge?: string;
  highlighted?: boolean;
  ctaLabel: string;
  sortOrder: number;
};

/** Raw plan record from the backend `SubscriptionPlan` model. */
export type ApiSubscriptionPlan = {
  _id?: string;
  id?: string;
  slug?: string;
  tierName?: string;
  tagline?: string;
  shortMarketingPitch?: string;
  monthlyPrice?: number | null;
  yearlyPrice?: number | null;
  badge?: string;
  isPopular?: boolean;
  isActive?: boolean;
  ctaButtonLabel?: string;
  sortOrder?: number;
  aiVoiceEnabled?: boolean;
  aiVoiceMinutes?: number;
  customFeatures?: { label?: string; included?: boolean }[];
  includedFeatures?: string[];
};

/** Static until the provider's live subscription is wired in. */
export const DEFAULT_PRO_PLAN_SLUG = "free";

const roundCents = (value: number) => Math.round(value * 100) / 100;

export function mapApiSubscriptionPlan(row: ApiSubscriptionPlan): ProSubscriptionPlan {
  const monthly = Number(row.monthlyPrice) || 0;
  const yearly = Number(row.yearlyPrice) || 0;
  // No yearly price set → annual billing is just 12 × monthly.
  const annualTotal = yearly > 0 ? yearly : roundCents(monthly * 12);
  const features =
    Array.isArray(row.customFeatures) && row.customFeatures.length
      ? row.customFeatures
          .filter((item) => item?.label)
          .map((item) => ({ label: String(item.label), included: item.included !== false }))
      : (row.includedFeatures || []).map((label) => ({ label, included: true }));
  const name = row.tierName || "Plan";

  return {
    id: String(row._id || row.id || row.slug || name),
    slug: String(row.slug || ""),
    name,
    tagline: row.tagline || "",
    monthlyPrice: monthly,
    annualMonthlyPrice: roundCents(annualTotal / 12),
    annualTotal,
    description: row.shortMarketingPitch || "",
    callingMinutes: row.aiVoiceEnabled ? Math.max(0, Number(row.aiVoiceMinutes) || 0) : 0,
    features,
    badge: row.badge || (row.isPopular ? "Most Popular" : undefined),
    highlighted: Boolean(row.isPopular),
    ctaLabel: row.ctaButtonLabel || `Upgrade to ${name}`,
    sortOrder: Number(row.sortOrder) || 0,
  };
}

/** Price to show per month for the chosen cycle (annual shown as monthly equivalent). */
export function proPlanMonthlyRate(plan: ProSubscriptionPlan, cycle: ProPlanBillingCycle) {
  return cycle === "annual" ? plan.annualMonthlyPrice : plan.monthlyPrice;
}

/** Whole-percent saving of annual vs. monthly billing; 0 for free plans. */
export function proPlanAnnualSavingsPercent(plan: ProSubscriptionPlan) {
  if (!plan.monthlyPrice) return 0;
  return Math.max(
    0,
    Math.round(((plan.monthlyPrice - plan.annualMonthlyPrice) / plan.monthlyPrice) * 100),
  );
}

/** Splits a USD amount into whole dollars and cents for display, e.g. 29.99 → ["29", "99"]. */
export function splitUsd(amount: number): [string, string] {
  const [dollars, cents] = amount.toFixed(2).split(".");
  return [Number(dollars).toLocaleString("en-US"), cents];
}
