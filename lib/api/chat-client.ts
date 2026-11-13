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
import type { ChatAttachment, ChatThread } from "@/lib/booking/chat-store";
// 
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
  /** Default 100 (unchanged for existing callers); the dashboard asks for 10. */
  limit?: number;
  /** "unread": unread threads first, then newest (server-side, so a short page is the right top N). */
  sort?: "recent" | "unread";
}) {
  const response = await getData(
    chatApi.providerThreads,
    { page: 1, limit: options?.limit ?? 100, ...(options?.sort ? { sort: options.sort } : {}) },
    {
      silent: options?.silent ?? true,
      force: options?.force ?? true,
    },
  );
  return mapCrmList(response, mapChatThread).items;
}

export const PROVIDER_CHAT_PAGE_SIZE = 10;

export type ProviderChatFilter = "all" | "unread" | "leads";

export type ProviderChatPage = {
  items: ChatThread[];
  page: number;
  total: number;
  hasMore: boolean;
  /** Inbox tab totals (all / unread / with a request), when asked for. */
  counts: { all: number; unread: number; leads: number } | null;
};

/**
 * One page of the Pro's chat threads (10 by default), unread first then newest. Optional search
 * (`q`: name, email or message text), tab filter, and lookup by request / customer email.
 */
export async function listProviderChatThreadsPage(query: {
  page?: number;
  limit?: number;
  q?: string;
  filter?: ProviderChatFilter;
  requestId?: string | null;
  email?: string | null;
  counts?: boolean;
  silent?: boolean;
}): Promise<ProviderChatPage> {
  const page = Math.max(1, query.page ?? 1);
  const limit = query.limit ?? PROVIDER_CHAT_PAGE_SIZE;
  const q = (query.q || "").trim().slice(0, 100);
  const response = (await getData(
    chatApi.providerThreads,
    {
      page,
      limit,
      sort: "unread",
      ...(q ? { q } : {}),
      ...(query.filter && query.filter !== "all" ? { filter: query.filter } : {}),
      ...(query.requestId ? { requestId: query.requestId } : {}),
      ...(query.email ? { email: query.email } : {}),
      ...(query.counts ? { counts: true } : {}),
    },
    { silent: query.silent ?? true, force: true },
  )) as {
    pagination?: { total?: number; hasMore?: boolean; pages?: number };
    counts?: { all?: number; unread?: number; leads?: number };
  } | null;
  const items = mapCrmList(response, mapChatThread).items;
  const total = Number(response?.pagination?.total) || 0;
  const hasMore =
    typeof response?.pagination?.hasMore === "boolean"
      ? response.pagination.hasMore
      : page * limit < total;
  const counts = response?.counts
    ? {
        all: Number(response.counts.all) || 0,
        unread: Number(response.counts.unread) || 0,
        leads: Number(response.counts.leads) || 0,
      }
    : null;
  return { items, page, total, hasMore, counts };
}

export async function getProviderChatThread(threadId: string) {
  const response = await getData(chatApi.providerThread(threadId), undefined, {
    silent: true,
    force: true,
  });
  return mapCrmEntity(response, mapChatThread);
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

export async function listPublicChatThreads(
  email: string,
  options?: { silent?: boolean; page?: number; limit?: number },
) {
  const normalizedEmail = email.trim();
  if (!normalizedEmail) {
    return { items: [] as ChatThread[], pagination: null as null | {
      page: number;
      limit: number;
      total: number;
      pages: number;
      hasAdminChat?: boolean;
    }, unread: 0 };
  }
  const response = await getData(
    chatApi.publicThreads,
    {
      email: normalizedEmail,
      page: options?.page ?? 1,
      limit: options?.limit ?? 10,
    },
    {
      silent: options?.silent ?? true,
      token: null,
      skipLogoutOn401: true,
      force: true,
    },
  );
  const listed = mapCrmList(response, mapChatThread);
  const root =
    response && typeof response === "object"
      ? (response as Record<string, unknown>)
      : {};
  const pagination =
    root.pagination && typeof root.pagination === "object"
      ? (root.pagination as {
          page: number;
          limit: number;
          total: number;
          pages: number;
          hasAdminChat?: boolean;
        })
      : null;
  return {
    items: listed.items,
    pagination,
    unread: Number(root.unread || 0),
  };
}

export async function fetchPublicChatThread(
  threadId: string,
  options?: { silent?: boolean; limit?: number },
) {
  const id = String(threadId || "").trim();
  if (!id) return null;
  const response = await getData(
    chatApi.publicThread(id),
    {
      limit: options?.limit ?? 50,
    },
    {
      silent: options?.silent ?? true,
      force: true,
    },
  );
  return mapCrmEntity(response, mapChatThread);
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
