import type { SubscriptionPlan } from "@/lib/types";

export const subscriptionPlans: SubscriptionPlan[] = [
  {
    id: "plan_starter",
    slug: "starter",
    name: "Starter",
    description: "For independent operators building a professional presence.",
    price: 49,
    currency: "USD",
    interval: "month",
    features: [
      "Public marketplace profile",
      "Matched service requests",
      "Unlimited estimates",
      "Digital customer approval",
      "Job tracking",
      "Basic invoicing",
    ],
    limits: {
      teamSeats: 1,
      activeJobs: 25,
      storageGb: 5,
      reports: "standard",
    },
    ctaLabel: "Start with Starter",
    isActive: true,
    sortOrder: 1,
  },
  {
    id: "plan_professional",
    slug: "professional",
    name: "Professional",
    description: "For growing teams that need a complete operations workflow.",
    price: 99,
    currency: "USD",
    interval: "month",
    features: [
      "Everything in Starter",
      "Priority request matching",
      "Change orders and extra materials",
      "Payment schedules and deposits",
      "Customer history and notes",
      "Revenue and job reports",
    ],
    limits: {
      teamSeats: 5,
      activeJobs: 100,
      storageGb: 25,
      reports: "advanced",
    },
    highlighted: true,
    ctaLabel: "Choose Professional",
    isActive: true,
    sortOrder: 2,
  },
  {
    id: "plan_business",
    slug: "business",
    name: "Business",
    description: "For established companies managing volume across crews.",
    price: 199,
    currency: "USD",
    interval: "month",
    features: [
      "Everything in Professional",
      "Multi-crew job assignment",
      "Expanded reporting",
      "Priority support",
      "Custom service categories",
      "Higher document storage",
    ],
    limits: {
      teamSeats: 15,
      activeJobs: "unlimited",
      storageGb: 100,
      reports: "full",
    },
    ctaLabel: "Choose Business",
    isActive: true,
    sortOrder: 3,
  },
];

export function getActivePlans() {
  return subscriptionPlans
    .filter((plan) => plan.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getPlanBySlug(slug: string) {
  return subscriptionPlans.find((plan) => plan.slug === slug);
}

export function formatPlanPrice(plan: SubscriptionPlan) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: plan.currency,
    maximumFractionDigits: 0,
  }).format(plan.price);
}
