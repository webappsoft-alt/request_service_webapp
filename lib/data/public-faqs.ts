import { publicApi } from "@/components/api/ApiRoutesFile";
import type { FaqItem } from "@/lib/types";

/** Admin FAQ "Domain / Category" value for the Kitchen & Bath Design page. */
export const KITCHEN_BATH_FAQ_DOMAIN = "kitchen-bath-design";

/**
 * Active customer FAQs for one admin domain, for server rendering (in the HTML for SEO and the
 * FAQPage JSON-LD). Same public endpoint as the FAQ page (`GET public/faqs?audience=&domain=`),
 * ordered by the admin's sort order. Never throws: empty on failure. Revalidates every 5 minutes,
 * so admin edits show up without a deploy.
 */
export async function fetchFaqsForDomain(domain: string): Promise<FaqItem[]> {
  const base = String(process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
  if (!base) return [];
  try {
    const params = new URLSearchParams({ audience: "customer", domain });
    const response = await fetch(`${base}/${publicApi.faqs}?${params}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    });
    if (!response.ok) return [];
    const body: unknown = await response.json();
    const record = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
    const list = Array.isArray(body) ? body : Array.isArray(record?.data) ? (record.data as unknown[]) : [];
    return list.flatMap((raw) => {
      if (!raw || typeof raw !== "object") return [];
      const item = raw as Record<string, unknown>;
      const id = String(item.id || item._id || "");
      const question = typeof item.question === "string" ? item.question.trim() : "";
      const answer = typeof item.answer === "string" ? item.answer.trim() : "";
      return id && question && answer ? [{ id, question, answer }] : [];
    });
  } catch {
    return [];
  }
}
