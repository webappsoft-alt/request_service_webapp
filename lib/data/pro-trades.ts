/**
 * Trade landing pages for Pro acquisition: /for-pros/[trade].
 * One trade per service category; the slug is the plural "people" noun.
 */

import { getServiceCategoryBySlug } from "@/lib/data/services";
import type { ServiceCategory, ServiceCategorySlug } from "@/lib/types";

export type ProTrade = {
  slug: string;
  categorySlug: ServiceCategorySlug;
  /** Plural, title case: "Plumbers". */
  people: string;
  /** Singular, lower case: "plumber". */
  person: string;
};

export const proTrades: ProTrade[] = [
  { slug: "plumbers", categorySlug: "plumbing", people: "Plumbers", person: "plumber" },
  { slug: "hvac-technicians", categorySlug: "hvac", people: "HVAC Technicians", person: "HVAC technician" },
  { slug: "electricians", categorySlug: "electrical", people: "Electricians", person: "electrician" },
  { slug: "handymen", categorySlug: "handyman", people: "Handymen", person: "handyman" },
  { slug: "house-cleaners", categorySlug: "house-cleaning", people: "House Cleaners", person: "house cleaner" },
  { slug: "roofers", categorySlug: "roofing", people: "Roofers", person: "roofer" },
  { slug: "landscapers", categorySlug: "landscaping", people: "Landscapers", person: "landscaper" },
  { slug: "painters", categorySlug: "painting", people: "Painters", person: "painter" },
  {
    slug: "bathroom-remodelers",
    categorySlug: "bathroom-remodeling",
    people: "Bathroom Remodelers",
    person: "bathroom remodeler",
  },
  {
    slug: "pest-control-pros",
    categorySlug: "pest-control",
    people: "Pest Control Pros",
    person: "pest control pro",
  },
];

export function getProTrade(slug: string): (ProTrade & { category: ServiceCategory }) | undefined {
  const trade = proTrades.find((item) => item.slug === slug);
  const category = trade ? getServiceCategoryBySlug(trade.categorySlug) : undefined;
  return trade && category ? { ...trade, category } : undefined;
}

export function getProTradeForCategory(categorySlug: string): ProTrade | undefined {
  return proTrades.find((item) => item.categorySlug === categorySlug);
}
