import { getData, patchData, postData } from "@/components/api/apiFuntions";
import { chatApi } from "@/components/api/ApiRoutesFile";
import { mapChatThread, mapCrmEntity, mapCrmList, mapInboxSummary } from "@/lib/api/crm-mappers";
import type { ChatAttachment } from "@/lib/booking/chat-store";

type ProviderThreadInput = {
  customerName: string;
  customerEmail: string;
  customerId?: string | null;
  requestId?: string | null;
};

type PublicThreadInput = {
  providerId?: string;
  providerSlug?: string;
  customerName: string;
  customerEmail: string;
  phone?: string;
  zip?: string;
  city?: string;
  state?: string;
  street?: string;
  requestId?: string | null;
  text?: string;
  attachments?: ChatAttachment[];
};

export async function listProviderChatThreads(options?: { silent?: boolean }) {
  const response = await getData(
    chatApi.providerThreads,
    { page: 1, limit: 100 },
    { silent: options?.silent ?? true },
  );
  return mapCrmList(response, mapChatThread).items;
}

export async function ensureProviderChatThread(input: ProviderThreadInput) {
  const response = await postData(chatApi.providerThreads, {
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerId: input.customerId || undefined,
    requestId: input.requestId || null,
  });
  return mapCrmEntity(response, mapChatThread);
}

export async function sendProviderChatMessage(
  threadId: string,
  text: string,
  attachments: ChatAttachment[] = [],
) {
  const response = await postData(chatApi.providerMessages(threadId), {
    text,
    attachments,
  });
  return mapCrmEntity(response, mapChatThread);
}

export async function markProviderChatRead(threadId: string) {
  const response = await patchData(chatApi.providerRead(threadId), {});
  return mapCrmEntity(response, mapChatThread);
}

export async function getProviderInboxSummary(options?: { silent?: boolean }) {
  const response = await getData(chatApi.providerInboxSummary, undefined, {
    silent: options?.silent ?? true,
  });
  return mapInboxSummary(response);
}

export async function listPublicChatThreads(email: string, options?: { silent?: boolean }) {
  const normalizedEmail = email.trim();
  if (!normalizedEmail) return [];
  const response = await getData(
    chatApi.publicThreads,
    { email: normalizedEmail },
    {
      silent: options?.silent ?? true,
      token: null,
      skipLogoutOn401: true,
    },
  );
  return mapCrmList(response, mapChatThread).items;
}

export async function openPublicChatThread(input: PublicThreadInput) {
  const response = await postData(
    chatApi.publicThreads,
    {
      providerId: input.providerId || undefined,
      providerSlug: input.providerSlug || undefined,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      phone: input.phone || "",
      zip: input.zip || "",
      city: input.city || "",
      state: input.state || "",
      street: input.street || "",
      requestId: input.requestId || null,
      text: input.text || "",
      attachments: input.attachments ?? [],
    },
    {
      token: null,
      skipLogoutOn401: true,
    },
  );
  return mapCrmEntity(response, mapChatThread);
}

export async function sendPublicChatMessage(
  threadId: string,
  customerEmail: string,
  text: string,
  attachments: ChatAttachment[] = [],
) {
  const response = await postData(
    chatApi.publicMessages(threadId),
    {
      customerEmail,
      text,
      attachments,
    },
    {
      token: null,
      skipLogoutOn401: true,
    },
  );
  return mapCrmEntity(response, mapChatThread);
}

export async function markPublicChatRead(threadId: string, customerEmail: string) {
  const response = await patchData(
    chatApi.publicRead(threadId),
    { customerEmail },
    {
      token: null,
      skipLogoutOn401: true,
    },
  );
  return mapCrmEntity(response, mapChatThread);
}
