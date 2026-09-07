import { createWebsiteLead } from "@/lib/booking/create-website-lead";
import { formatIntakeQuote, writePendingQuote } from "@/lib/booking/format-quote-answers";
import type { IntakeAnswers } from "@/lib/data/intake";
import type { QuoteAnswer } from "@/lib/data/portal";
import { getProvidersByCategoryId } from "@/lib/data/providers";
import { getServiceCategoryBySlug } from "@/lib/data/services";
import type { Provider } from "@/lib/types";

function matchQuoteProviders(categoryId: string, zip: string, limit = 6) {
  const all = getProvidersByCategoryId(categoryId);
  const local = all.filter((provider) => provider.zip === zip || provider.serviceArea.includes(zip));
  return (local.length ? local : all).slice(0, limit);
}

export function createMarketplaceQuote(input: {
  name: string;
  email: string;
  phone?: string;
  zip: string;
  serviceSlug: string;
  serviceName?: string;
  details: string;
  answers?: QuoteAnswer[];
  preferredDate?: string;
  preferredTime?: string;
  provider?: Provider;
}) {
  const category = getServiceCategoryBySlug(input.serviceSlug);
  const providers = input.provider
    ? [input.provider]
    : category
      ? matchQuoteProviders(category.id, input.zip)
      : [];

  const requests = providers.map((provider) =>
    createWebsiteLead({
      provider,
      name: input.name,
      email: input.email,
      phone: input.phone,
      zip: input.zip,
      details: input.details,
      serviceSlug: input.serviceSlug,
      serviceName: input.serviceName,
      preferredDate: input.preferredDate,
      preferredTime: input.preferredTime,
      channel: input.provider ? "direct" : "marketplace",
      answers: input.answers,
    }).request,
  );

  return { requests, providers };
}

export function createQuoteFromIntake(answers: IntakeAnswers) {
  writePendingQuote(answers);
  const formatted = formatIntakeQuote(answers);
  return createMarketplaceQuote({
    name: answers.name ?? "",
    email: answers.email ?? "",
    phone: answers.phone,
    zip: formatted.zip,
    serviceSlug: formatted.serviceSlug,
    serviceName: formatted.serviceName,
    details: formatted.details,
    answers: formatted.answers,
    preferredTime: formatted.preferredTime,
  });
}
