import { postData } from "@/components/api/apiFuntions";
import { publicQuoteApi } from "@/components/api/ApiRoutesFile";
import type { PortalCustomerCrm } from "@/lib/data/crm-people";
import type { PortalRequest, QuoteAnswer } from "@/lib/data/portal";
import { getAreaName } from "@/lib/data/service-areas";
import { getServiceCategoryBySlug } from "@/lib/data/services";
import type { Provider, RequestChannel } from "@/lib/types";

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "Customer",
    lastName: parts.slice(1).join(" "),
  };
}

function providerSelector(provider: Provider) {
  return /^[a-f\d]{24}$/i.test(provider.id)
    ? { providerId: provider.id }
    : { providerSlug: provider.slug };
}

function buildOptimisticCustomer(input: {
  provider: Provider;
  name: string;
  email: string;
  phone?: string;
  zip: string;
}): PortalCustomerCrm {
  const { firstName, lastName } = splitName(input.name);
  const now = new Date().toISOString();
  return {
    id: "",
    userId: "",
    firstName,
    lastName,
    email: input.email.trim(),
    phone: input.phone?.trim() || undefined,
    addresses: [
      {
        id: "",
        street: "",
        city: input.provider.city,
        state: input.provider.state,
        zip: input.zip,
        country: "US",
      },
    ],
    createdAt: now,
    updatedAt: now,
    customerNumber: "",
    entityKind: "individual",
    customerType: "residential",
    source: "website",
    doNotCall: false,
    taxCode: "",
    laborTaxCode: "",
    creditLimit: 0,
    onStop: false,
    membership: "none",
    tags: ["Website request"],
    notes: "",
    amountOwing: 0,
  };
}

export async function createWebsiteLead(input: {
  provider: Provider;
  name: string;
  email: string;
  phone?: string;
  zip: string;
  details: string;
  serviceSlug?: string;
  serviceName?: string;
  preferredDate?: string;
  preferredTime?: string;
  channel?: RequestChannel;
  answers?: QuoteAnswer[];
}) {
  if (typeof window === "undefined") {
    throw new Error("Website leads can only be created in the browser.");
  }

  const category =
    (input.serviceSlug ? getServiceCategoryBySlug(input.serviceSlug) : undefined) ??
    undefined;
  const payload = {
    name: input.name.trim(),
    email: input.email.trim(),
    phone: input.phone?.trim() || "",
    zip: input.zip.trim(),
    city: input.provider.city,
    state: input.provider.state,
    street: "",
    serviceSlug: input.serviceSlug || "",
    serviceName: input.serviceName?.trim() || category?.name || "Service request",
    categoryId: /^[a-f\d]{24}$/i.test(category?.id ?? "") ? category?.id : undefined,
    details: input.details.trim(),
    preferredDate: input.preferredDate || undefined,
    preferredTime: input.preferredTime || undefined,
    preferredTimeWindow: undefined,
    photos: [],
    answers: input.answers ?? [],
    ...providerSelector(input.provider),
  };
  const response = await postData<{
    data?: {
      requests?: Array<{
        id: string;
        number: string;
        providerId: string;
        status: PortalRequest["status"];
        channel: RequestChannel;
      }>;
    };
  }>(publicQuoteApi.requests, payload, {
    token: null,
    skipLogoutOn401: true,
  });
  const first = response?.data?.requests?.[0];
  if (!first) {
    throw new Error("The quote request was accepted but no request id was returned.");
  }

  const customer = buildOptimisticCustomer({
    provider: input.provider,
    name: input.name,
    email: input.email,
    phone: input.phone,
    zip: input.zip,
  });
  const request: PortalRequest = {
    id: first.id,
    number: first.number,
    customerId: customer.id || undefined,
    providerId: first.providerId || input.provider.id,
    categoryId: payload.categoryId || "",
    channel: first.channel || input.channel || "direct",
    zip: input.zip.trim(),
    city: input.provider.city,
    state: input.provider.state,
    details: payload.details,
    preferredDate: input.preferredDate || undefined,
    preferredTimeWindow: input.preferredTime || undefined,
    photoUrls: [],
    status: first.status || "new",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customerName: input.name.trim(),
    customerEmail: input.email.trim(),
    customerPhone: input.phone?.trim() || "",
    serviceName: payload.serviceName,
    categoryName: category?.name || "Service",
    neighborhood: getAreaName(input.zip.trim()),
    answers: input.answers?.length ? input.answers : undefined,
  };

  return { request, customer };
}
