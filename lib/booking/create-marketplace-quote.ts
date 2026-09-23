import { postData } from "@/components/api/apiFuntions";
import { publicQuoteApi } from "@/components/api/ApiRoutesFile";
import { formatIntakeQuote, writePendingQuote, clearPendingQuote } from "@/lib/booking/format-quote-answers";
import type { IntakeAnswers } from "@/lib/data/intake";
import { getAreaName } from "@/lib/data/service-areas";
import type { PortalRequest, QuoteAnswer } from "@/lib/data/portal";
import { getProvidersByCategoryId } from "@/lib/data/providers";
import { getServiceCategoryBySlug } from "@/lib/data/services";
import type { Provider } from "@/lib/types";
import { getStore } from "@/store";

const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

function matchQuoteProviders(categoryId: string, zip: string, limit = 6) {
  const all = getProvidersByCategoryId(categoryId);
  const local = all.filter((provider) => provider.zip === zip || provider.serviceArea.includes(zip));
  return (local.length ? local : all).slice(0, limit);
}

function isObjectId(value: string | null | undefined) {
  return OBJECT_ID_REGEX.test(String(value || "").trim());
}

function resolveCategoryId(serviceSlug: string) {
  const liveCategories = (() => {
    try {
      const state = getStore().getState() as {
        categories?: {
          parents?: Array<{ id: string; slug: string }>;
          subcategoriesByParent?: Record<string, Array<{ id: string; slug: string }>>;
        };
      };
      const parents = state.categories?.parents ?? [];
      const subcategories = Object.values(state.categories?.subcategoriesByParent ?? {}).flat();
      return [...parents, ...subcategories];
    } catch {
      return [] as Array<{ id: string; slug: string }>;
    }
  })();
  const liveMatch = liveCategories.find((item) => item.slug === serviceSlug);
  if (isObjectId(liveMatch?.id)) return liveMatch?.id;

  const seededCategory = getServiceCategoryBySlug(serviceSlug);
  return isObjectId(seededCategory?.id) ? seededCategory?.id : undefined;
}

export async function createMarketplaceQuote(input: {
  name: string;
  email: string;
  phone?: string;
  zip: string;
  /** Preferred street line key */
  address?: string;
  /** @deprecated Prefer `address` */
  street?: string;
  city?: string;
  state?: string;
  lat?: number;
  lng?: number;
  radius?: number;
  serviceSlug: string;
  serviceName?: string;
  /** Optional live category ObjectId from a provider service. */
  categoryId?: string;
  details: string;
  answers?: QuoteAnswer[];
  preferredDate?: string;
  preferredTime?: string;
  provider?: Provider;
}) {
  if (typeof window === "undefined") {
    throw new Error("Marketplace quotes can only be created in the browser.");
  }

  const category = getServiceCategoryBySlug(input.serviceSlug);
  const resolvedCategoryId = isObjectId(input.categoryId)
    ? input.categoryId
    : resolveCategoryId(input.serviceSlug);
  const providers = input.provider
    ? [input.provider]
    : category
      ? matchQuoteProviders(category.id, input.zip)
      : [];

  const addressLine = String(input.address || input.street || "").trim();
  const payload = {
    name: input.name.trim(),
    email: input.email.trim(),
    phone: input.phone?.trim() || "",
    zip: input.zip.trim(),
    address: addressLine,
    street: addressLine,
    city: input.city?.trim() || "",
    state: input.state?.trim() || "",
    lat:
      input.lat != null && Number.isFinite(input.lat) ? input.lat : undefined,
    lng:
      input.lng != null && Number.isFinite(input.lng) ? input.lng : undefined,
    radius: input.radius,
    serviceSlug: input.serviceSlug,
    serviceName: input.serviceName?.trim() || category?.name || "Service request",
    categoryId: resolvedCategoryId,
    providerId: isObjectId(input.provider?.id)
      ? input.provider?.id
      : undefined,
    providerSlug: input.provider?.slug || undefined,
    details: input.details.trim(),
    preferredDate: input.preferredDate || undefined,
    preferredTime: input.preferredTime || undefined,
    preferredTimeWindow: undefined,
    photos: [],
    answers: input.answers ?? [],
  };
  const response = await postData<{
    message?: string;
    data?: {
      count?: number;
      requestNumber?: string;
      requests?: Array<{
        id: string;
        number: string;
        providerId: string;
        providerSlug?: string;
        status: PortalRequest["status"];
        channel?: PortalRequest["channel"];
      }>;
    };
  }>(publicQuoteApi.requests, payload, {
    token: null,
    skipLogoutOn401: true,
  });
  const requests = (response?.data?.requests ?? []).map((item) => {
    const matchedProvider = providers.find(
      (provider) => provider.id === item.providerId || provider.slug === item.providerSlug,
    );
    return {
      id: item.id,
      number: item.number,
      customerId: "",
      providerId: item.providerId,
      categoryId: resolvedCategoryId || "",
      channel: item.channel || (input.provider ? "direct" : "marketplace"),
      zip: payload.zip,
      city: matchedProvider?.city || "",
      state: matchedProvider?.state || "",
      details: payload.details,
      preferredDate: input.preferredDate || undefined,
      preferredTimeWindow: input.preferredTime || undefined,
      photoUrls: [],
      status: item.status || "new",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      customerName: payload.name,
      customerEmail: payload.email,
      customerPhone: payload.phone,
      serviceName: payload.serviceName,
      categoryName: category?.name || "Service",
      neighborhood: getAreaName(payload.zip),
      answers: input.answers?.length ? input.answers : undefined,
    } satisfies PortalRequest;
  });

  return {
    requests,
    providers,
    count: response?.data?.count ?? requests.length,
    requestNumber: response?.data?.requestNumber ?? requests[0]?.number ?? "",
    message: response?.message ?? "",
  };
}

export async function createQuoteFromIntake(answers: IntakeAnswers) {
  writePendingQuote(answers);
  const formatted = formatIntakeQuote(answers);
  const zip = String(formatted.zip || answers.zip || "").trim();
  const lat = Number(answers.lat);
  const lng = Number(answers.lng);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  if (!zip && !hasCoords) {
    throw new Error("Select a service address from the suggestions before sending.");
  }
  if (zip && !/^\d{5}$/.test(zip) && !hasCoords) {
    throw new Error("Select a complete service address that includes a ZIP code.");
  }
  try {
    const result = await createMarketplaceQuote({
      name:
        [answers.firstName, answers.lastName]
          .map((part) => String(part || "").trim())
          .filter(Boolean)
          .join(" ") ||
        answers.name ||
        "",
      email: answers.email ?? "",
      phone: answers.phone,
      zip: zip || "00000",
      address: answers.address || answers.street || formatted.street,
      street: answers.street || answers.address || formatted.street,
      city: answers.city || formatted.city,
      state: answers.state || formatted.state,
      lat: hasCoords ? lat : undefined,
      lng: hasCoords ? lng : undefined,
      serviceSlug: formatted.serviceSlug,
      serviceName: formatted.serviceName,
      details: formatted.details,
      answers: formatted.answers,
      preferredTime: formatted.preferredTime,
    });
    clearPendingQuote();
    return result;
  } catch (error) {
    // Keep pending answers so the customer can retry after fixing the issue.
    throw error;
  }
}
