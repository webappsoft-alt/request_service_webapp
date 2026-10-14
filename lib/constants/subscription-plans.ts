/**
 * Platform → Pro SaaS membership tiers shown on /pro/dashboard/subscription.
 *
 * Static for now. When the Super Admin plan APIs land, fetch records in this
 * same shape and drop them into the view — nothing else needs to change.
 * (Unrelated to customer job billing under Money → Invoices / Payments.)
 */

export type ProPlanId = "free" | "starter" | "growth" | "scale";

export type ProPlanBillingCycle = "monthly" | "annual";

export type ProPlanStatus = "active" | "coming_soon" | "retired";

export type ProPlanFeature = {
  label: string;
  included: boolean;
};

export type ProSubscriptionPlan = {
  id: ProPlanId;
  name: string;
  /** Short audience label shown under the plan name. */
  tagline: string;
  /** Monthly price in USD. */
  monthlyPrice: number;
  /** Full-year price in USD when billed annually. */
  annualPrice: number;
  description: string;
  /** Included inbound AI voice minutes per month; 0 = AI receptionist not included. */
  callingMinutes: number;
  features: ProPlanFeature[];
  badge?: string;
  highlighted?: boolean;
  ctaLabel: string;
  status: ProPlanStatus;
  sortOrder: number;
};

export const proSubscriptionPlans: ProSubscriptionPlan[] = [
  {
    id: "free",
    name: "Free",
    tagline: "Explorer / Registration",
    monthlyPrice: 0,
    annualPrice: 0,
    description: "Create your account and explore the platform before going live.",
    callingMinutes: 0,
    features: [
      { label: "Account registration & public business profile", included: true },
      { label: "Pro portal & dashboard access", included: false },
      { label: "Lead matching & direct job requests", included: false },
      { label: "Employee / Technician dashboard", included: false },
      { label: "Schedules, Timesheets & Dispatching", included: false },
      { label: "Invoicing, Estimates & Payments", included: false },
      { label: "AI Voice Receptionist", included: false },
    ],
    ctaLabel: "Current Tier",
    status: "active",
    sortOrder: 1,
  },
  {
    id: "starter",
    name: "Starter",
    tagline: "Solo Operator",
    monthlyPrice: 29,
    annualPrice: 290,
    description: "Everything you need to run jobs and win local leads.",
    callingMinutes: 0,
    features: [
      { label: "Full Pro Dashboard & Operational tools", included: true },
      { label: "Lead matching & Fixed Service Orders", included: true },
      { label: "Estimates, Invoices & Job Management", included: true },
      { label: "1 Admin / Solo Account (No crew login)", included: true },
      { label: "Pro Mobile App access (iOS & Android)", included: true },
      { label: "Technician / Employee Sub-accounts", included: false },
      { label: "Subcontractor Portal & Timesheets", included: false },
      { label: "24/7 AI Voice Receptionist", included: false },
    ],
    ctaLabel: "Upgrade to Starter",
    status: "active",
    sortOrder: 2,
  },
  {
    id: "growth",
    name: "Growth",
    tagline: "Growing Crew",
    monthlyPrice: 79,
    annualPrice: 790,
    description: "Never miss a call — AI answers, qualifies, and books for you.",
    callingMinutes: 200,
    features: [
      { label: "Everything in Starter", included: true },
      { label: "24/7 AI Voice Receptionist (200 Inbound mins/mo)", included: true },
      { label: "Dedicated Virtual Business Phone Number", included: true },
      { label: "Technician & Employee Mobile/Web logins (Up to 5 seats)", included: true },
      { label: "Crew Scheduling, Calendar & Timesheets", included: true },
      { label: "Contractor & Vendor Management", included: true },
      { label: "Priority Local Lead Matching", included: true },
      { label: "Advanced Custom Voice / Unlimited Seats", included: false },
    ],
    badge: "Most Popular",
    highlighted: true,
    ctaLabel: "Upgrade to Growth",
    status: "active",
    sortOrder: 3,
  },
  {
    id: "scale",
    name: "Scale",
    tagline: "High Volume Operations",
    monthlyPrice: 149,
    annualPrice: 1490,
    description: "For busy crews handling high call volume across the area.",
    callingMinutes: 500,
    features: [
      { label: "Everything in Growth", included: true },
      { label: "24/7 AI Voice Receptionist (500 Inbound mins/mo)", included: true },
      { label: "Unlimited Employee & Technician Logins", included: true },
      { label: "Subcontractor portal & dispatch management", included: true },
      { label: "Multi-crew GPS Scheduling & Advanced Timesheets", included: true },
      { label: "Lower platform processing fees", included: true },
      { label: "Dedicated Onboarding & VIP Priority Support", included: true },
    ],
    ctaLabel: "Upgrade to Scale",
    status: "active",
    sortOrder: 4,
  },
];

/** Static until the provider's live subscription is wired in. */
export const DEFAULT_PRO_PLAN_ID: ProPlanId = "free";

/** Price to show per month for the chosen cycle (annual shown as monthly equivalent). */
export function proPlanMonthlyRate(plan: ProSubscriptionPlan, cycle: ProPlanBillingCycle) {
  return cycle === "annual" ? Math.round(plan.annualPrice / 12) : plan.monthlyPrice;
}

/** Whole-percent saving of annual vs. 12 × monthly; 0 for free plans. */
export function proPlanAnnualSavingsPercent(plan: ProSubscriptionPlan) {
  const yearly = plan.monthlyPrice * 12;
  if (!yearly) return 0;
  return Math.round(((yearly - plan.annualPrice) / yearly) * 100);
}
