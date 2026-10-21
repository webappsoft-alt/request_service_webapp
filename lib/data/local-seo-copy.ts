/**
 * Templated titles, intros, and FAQs for the programmatic SEO pages
 * (/locations/*, /for-pros/[trade], /for-pros/locations/*).
 * Keep answers factual to how the product works — they are also emitted as FAQPage JSON-LD.
 */

import { cityLabel, type LocationCity } from "@/lib/data/locations";
import { getProTradeForCategory, type ProTrade } from "@/lib/data/pro-trades";
import type { FaqItem, ServiceCategory } from "@/lib/types";

function faq(id: string, question: string, answer: string): FaqItem {
  return { id, question, answer };
}

export function tradePeople(category: ServiceCategory) {
  return getProTradeForCategory(category.slug)?.people.toLowerCase() ?? `${category.shortName.toLowerCase()} pros`;
}

export function localServiceTitle(category: ServiceCategory, city: LocationCity, job?: string) {
  return job
    ? `${job} in ${cityLabel(city)}`
    : `Best ${category.name} in ${cityLabel(city)}`;
}

export function localServiceDescription(category: ServiceCategory, city: LocationCity, job?: string) {
  if (job) {
    return `Compare local ${tradePeople(category)} for ${job.toLowerCase()} in ${cityLabel(city)}. See starting prices, check licenses, and hire with a written, itemized estimate.`;
  }
  return `Find licensed ${tradePeople(category)} in ${cityLabel(city)} for ${category.commonServices
    .slice(0, 3)
    .map((item) => item.toLowerCase())
    .join(", ")}, and more. Compare local companies and hire with a written estimate.`;
}

export function cityFaqs(city: LocationCity): FaqItem[] {
  const place = cityLabel(city);
  return [
    faq(
      "city-how",
      `How do I hire a home service pro in ${place}?`,
      `Search for the service you need, compare the ${city.city} companies that serve your area, and request a written estimate. You review the itemized scope before any work is booked.`,
    ),
    faq(
      "city-cost",
      `Does it cost anything to request an estimate in ${city.city}?`,
      "No. Requesting and comparing estimates on Request Service is free for homeowners. You only pay the professional you choose to hire.",
    ),
    faq(
      "city-verified",
      `Are the professionals in ${city.city} licensed and insured?`,
      "Pros list their license and insurance details on their profile, and verified credentials are marked on each listing so you can check before you hire.",
    ),
  ];
}

export function localServiceFaqs(category: ServiceCategory, city: LocationCity, job?: string): FaqItem[] {
  const place = cityLabel(city);
  const people = tradePeople(category);
  const work = (job ?? category.name).toLowerCase();
  return [
    faq(
      "svc-find",
      `How do I find ${people} in ${place}?`,
      `Browse the ${city.city} ${people} listed on this page, compare ratings, service areas, and starting prices, then request a written estimate for your ${work} job.`,
    ),
    faq(
      "svc-price",
      `How much does ${work} cost in ${city.city}?`,
      `Prices depend on the size and condition of the job. Listings show a typical starting price, and every pro sends an itemized written estimate before work begins, so you know the full cost up front.`,
    ),
    faq(
      "svc-scope",
      `What is included in a written estimate?`,
      "The estimate lists each line item, materials, labor, and the payment schedule. You approve the scope in writing before the job is scheduled, and any change goes through a change order.",
    ),
    faq(
      "svc-fast",
      `Can I book ${people} in ${city.city} this week?`,
      `Many ${city.city} pros show live availability. Listings marked "Available now" can usually schedule a visit within a few days.`,
    ),
  ];
}

export function proTradeFaqs(trade: Pick<ProTrade, "people" | "person">, city?: LocationCity): FaqItem[] {
  const where = city ? ` in ${cityLabel(city)}` : "";
  return [
    faq(
      "pro-commission",
      `Does Request Service take a commission from ${trade.people.toLowerCase()}?`,
      "No. Pros pay a flat monthly plan and keep everything they invoice. There is no commission on the work you win.",
    ),
    faq(
      "pro-leads",
      `How do ${trade.people.toLowerCase()}${where} get customers?`,
      `Your company profile appears to homeowners${where} searching for ${trade.person} services in the areas you cover. They request estimates or book you directly from your profile.`,
    ),
    faq(
      "pro-tools",
      "What tools are included?",
      "Requests, written estimates, jobs and scheduling, invoices and payments, crew logins, and messaging — all from one Pro portal.",
    ),
    faq(
      "pro-start",
      "How long does it take to get listed?",
      "Create your Pro account, add your company profile and the services and areas you cover, and your profile can go live the same day.",
    ),
  ];
}
