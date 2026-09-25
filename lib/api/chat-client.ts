import { getData, patchData, postData, putData } from "@/components/api/apiFuntions";
import { chatApi, directChatApi } from "@/components/api/ApiRoutesFile";
import {
  mapAdminDirectChat,
  mapChatThread,
  mapCrmEntity,
  mapCrmList,
  mapInboxSummary,
  ADMIN_DIRECT_THREAD_ID,
} from "@/lib/api/crm-mappers";
import type { ChatAttachment } from "@/lib/booking/chat-store";

export { ADMIN_DIRECT_THREAD_ID };

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
  address?: string;
  /** @deprecated Prefer `address`. */
  street?: string;
  lat?: number;
  lng?: number;
  requestId?: string | null;
  text?: string;
  attachments?: ChatAttachment[];
};

export async function listProviderChatThreads(options?: {
  silent?: boolean;
  force?: boolean;
}) {
  const response = await getData(
    chatApi.providerThreads,
    { page: 1, limit: 100 },
    {
      silent: options?.silent ?? true,
      force: options?.force ?? true,
    },
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
  const response = await putData(chatApi.providerRead(threadId), {});
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
      force: true,
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
      address: input.address || input.street || "",
      street: input.address || input.street || "",
      lat: input.lat,
      lng: input.lng,
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
  const response = await putData(
    chatApi.publicRead(threadId),
    { customerEmail },
    {
      token: null,
      skipLogoutOn401: true,
    },
  );
  return mapCrmEntity(response, mapChatThread);
}

export async function fetchAdminDirectChatForPeer(
  viewer: "customer" | "provider",
  options?: { silent?: boolean; limit?: number },
) {
  const response = await getData(
    directChatApi.admin,
    { limit: options?.limit ?? 50 },
    {
      silent: options?.silent ?? true,
      force: true,
    },
  );
  const root =
    response && typeof response === "object"
      ? (response as Record<string, unknown>)
      : {};
  const data = root.data ?? root;
  return mapAdminDirectChat(data, viewer);
}

export async function sendAdminDirectChatMessage(
  viewer: "customer" | "provider",
  text: string,
  attachments: ChatAttachment[] = [],
) {
  const response = await postData(directChatApi.adminMessages, {
    text,
    attachments,
  });
  const root =
    response && typeof response === "object"
      ? (response as Record<string, unknown>)
      : {};
  const data = root.data ?? root;
  return mapAdminDirectChat(data, viewer);
}

export async function markAdminDirectChatReadForPeer(
  viewer: "customer" | "provider",
) {
  const response = await patchData(directChatApi.adminRead, {});
  const root =
    response && typeof response === "object"
      ? (response as Record<string, unknown>)
      : {};
  const data = root.data ?? root;
  return mapAdminDirectChat(data, viewer);
}

export async function getAdminDirectUnreadCount(options?: { silent?: boolean }) {
  try {
    const chat = await fetchAdminDirectChatForPeer("customer", {
      silent: options?.silent ?? true,
      limit: 1,
    });
    return Math.max(
      0,
      chat?.unreadForCustomer || 0,
      chat?.unreadForProvider || 0,
    );
  } catch {
    return 0;
  }
}
