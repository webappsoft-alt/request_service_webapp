import { invalidateGetCache, postData } from "@/components/api/apiFuntions";
import { publicQuoteApi, userApi } from "@/components/api/ApiRoutesFile";
import type { QuoteAnswer } from "@/lib/data/portal";
import type { BotQuoteBrief, BotQuoteSuccess } from "../types";

const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

export type BotQuoteContact = { name: string; email: string; phone: string };

export type BotQuoteLocation = {
  zip: string;
  address: string;
  city: string;
  state: string;
  lat: number | null;
  lng: number | null;
};

/** Plain-text brief the pro reads on the request (the quote's `details`). */
export function composeBriefDetails(brief: BotQuoteBrief, locationText: string, note: string) {
  const service = [brief.trade, brief.subService].filter(Boolean).join(" → ");
  const lines = [
    `Job: ${brief.jobTitle}`,
    `Service: ${service}`,
    `Issue: ${brief.issueSummary}`,
    brief.area ? `Area / room: ${brief.area}` : "",
    `Urgency: ${brief.urgencyLabel}`,
    locationText ? `Address: ${locationText}` : "",
    brief.customerDetails.length ? `Customer details:\n${brief.customerDetails.map((item) => `• ${item}`).join("\n")}` : "",
    brief.answers?.length
      ? `Customer's answers:\n${brief.answers.map((item) => `• ${item.question} — ${item.answer}`).join("\n")}`
      : "",
    note.trim() ? `Customer note: ${note.trim()}` : "",
    "— Summary prepared by the Request Service AI Assistant from the customer's chat.",
  ];
  return lines.filter(Boolean).join("\n");
}

/**
 * Send the AI brief through the existing public quote pipeline (POST public/quote-requests),
 * the same endpoint and payload shape as /get-a-quote. The backend re-checks that the phone
 * was OTP-verified before creating the request.
 */
export async function submitBotQuote({
  brief,
  contact,
  location,
  locationText,
  note,
}: {
  brief: BotQuoteBrief;
  contact: BotQuoteContact;
  location: BotQuoteLocation;
  locationText: string;
  note: string;
}): Promise<BotQuoteSuccess> {
  const job = brief.subService || brief.categoryName;
  const answers: QuoteAnswer[] = [
    // "job" is what the backend uses to match pros to the job (same id as the page).
    { id: "job", label: "Job", value: job },
    { id: "urgency", label: "Timeline", value: brief.urgencyLabel },
    ...(brief.area ? [{ id: "area", label: "Where", value: brief.area }] : []),
    // Quick diagnosis answers, shown to the pro like the /get-a-quote question answers.
    ...(brief.answers ?? []).map((item, index) => ({
      id: `diagnosis-${index + 1}`,
      label: item.question,
      value: item.answer,
    })),
  ];
  const hasCoords = location.lat != null && location.lng != null;

  const payload = {
    name: contact.name.trim(),
    email: contact.email.trim(),
    phone: contact.phone.trim(),
    zip: location.zip.trim(),
    address: location.address.trim(),
    street: location.address.trim(),
    city: location.city.trim(),
    state: location.state.trim(),
    lat: hasCoords ? location.lat : undefined,
    lng: hasCoords ? location.lng : undefined,
    serviceSlug: brief.categorySlug || undefined,
    serviceName: job,
    categoryId: brief.categoryId && OBJECT_ID_REGEX.test(brief.categoryId) ? brief.categoryId : undefined,
    providerId: brief.providerId && OBJECT_ID_REGEX.test(brief.providerId) ? brief.providerId : undefined,
    providerSlug: brief.providerSlug || undefined,
    details: composeBriefDetails(brief, locationText, note),
    preferredTime: brief.preferredTime || undefined,
    photos: [],
    answers,
  };

  const response = await postData<{
    message?: string;
    data?: {
      count?: number;
      requestNumber?: string;
      quoteBatchId?: string;
      requests?: Array<{ id: string; number: string; providerId: string; quoteBatchId?: string }>;
    };
  }>(publicQuoteApi.requests, payload, { token: null, skipLogoutOn401: true, silent: true });

  // Same as the standalone flow: refresh the customer dashboard's request list.
  invalidateGetCache(userApi.quoteRequests);

  const data = response?.data ?? {};
  const requests = data.requests ?? [];
  return {
    requestNumber: data.requestNumber || requests[0]?.number || "",
    providerName: brief.providerName,
    count: data.count ?? (requests.length || 1),
    quoteBatchId: data.quoteBatchId || requests[0]?.quoteBatchId || null,
  };
}
