import { getData, patchData, postData, putData } from "@/components/api/sliceHttp";

/**
 * Technician ↔ provider chat. The same thread shape is used from both
 * portals; `side` picks the API prefix (technician token vs provider token).
 */
export type TechChatSide = "technician" | "provider";
export type TechChatContextType = "job" | "estimate" | "payment" | "general";

export type TechChatMessage = {
  id: string;
  /** admin = Platform Support posting into the thread. */
  from: "technician" | "provider" | "admin";
  senderName: string;
  text: string;
  at: string;
  isRead: boolean;
  readAt: string | null;
};

export type TechChatThread = {
  id: string;
  providerId: string;
  employeeId: string;
  technicianUserId: string;
  technicianName: string;
  providerName: string;
  contextType: TechChatContextType;
  contextId: string | null;
  contextNumber: string;
  contextTitle: string;
  unreadForProvider: number;
  unreadForTechnician: number;
  lastMessageAt: string | null;
  lastMessageText: string;
  lastMessageFrom: "technician" | "provider" | "admin" | null;
};

export type TechChatThreadDetail = TechChatThread & { messages: TechChatMessage[]; hasMore: boolean };

export type TechnicianLocation = {
  employeeId: string;
  name: string;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  at: string | null;
};

const base = (side: TechChatSide) => (side === "technician" ? "technician/chats" : "provider/technician-chats");
const quiet = { silent: true, force: true } as const;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function dataOf(response: unknown) {
  const root = asRecord(response);
  return root.data !== undefined ? root.data : response;
}

/** Conversations page size — the inbox loads 10 at a time and fetches more on scroll. */
export const TECH_CHAT_PAGE_SIZE = 10;

export async function listTechChats(
  side: TechChatSide,
  params: { page?: number; limit?: number; search?: string; unread?: boolean } = {},
): Promise<{ threads: TechChatThread[]; unread: number; page: number; totalPages: number; total: number }> {
  const query: Record<string, string | number | boolean> = { limit: TECH_CHAT_PAGE_SIZE, page: 1, ...params };
  if (!query.search) delete query.search;
  if (!query.unread) delete query.unread;
  const root = asRecord(await getData(base(side), query, quiet));
  const pagination = asRecord(root.pagination);
  const threads = (Array.isArray(root.data) ? root.data : []) as TechChatThread[];
  return {
    threads,
    unread: Number(root.unread) || 0,
    page: Number(pagination.page) || Number(query.page) || 1,
    totalPages: Number(pagination.totalPages) || 1,
    total: Number(pagination.total) || threads.length,
  };
}

export async function getTechChatUnread(side: TechChatSide): Promise<number> {
  return Number(asRecord(dataOf(await getData(`${base(side)}/unread`, undefined, quiet))).total) || 0;
}

export async function openTechChat(
  side: TechChatSide,
  body: { contextType: TechChatContextType; contextId?: string | null; employeeId?: string },
): Promise<TechChatThreadDetail> {
  return dataOf(await postData(`${base(side)}/open`, body, { silent: true })) as TechChatThreadDetail;
}

export async function getTechChat(side: TechChatSide, id: string): Promise<TechChatThreadDetail> {
  return dataOf(await getData(`${base(side)}/${id}`, undefined, quiet)) as TechChatThreadDetail;
}

export async function sendTechChatMessage(
  side: TechChatSide,
  id: string,
  text: string,
): Promise<{ thread: TechChatThread; message: TechChatMessage }> {
  return dataOf(await postData(`${base(side)}/${id}/messages`, { text }, { silent: true })) as {
    thread: TechChatThread;
    message: TechChatMessage;
  };
}

export async function markTechChatRead(side: TechChatSide, id: string) {
  return dataOf(await patchData(`${base(side)}/${id}/read`, {}, { silent: true }));
}

/** Technician portal: share the current device position with the provider. */
export async function shareTechnicianLocation(body: { lat: number; lng: number; accuracy?: number | null }) {
  return dataOf(await putData("technician/location", body, { silent: true }));
}

/** Provider: last shared position of the given technicians. */
export async function getTechnicianLocations(employeeIds: string[]): Promise<TechnicianLocation[]> {
  const ids = [...new Set(employeeIds.filter((id) => /^[0-9a-f]{24}$/i.test(id)))];
  if (!ids.length) return [];
  const data = dataOf(
    await getData("provider/technician-chats/locations", { employeeIds: ids.join(",") }, quiet),
  );
  return (Array.isArray(data) ? data : []) as TechnicianLocation[];
}

type ContextFields = Pick<TechChatThread, "contextType" | "contextId" | "contextNumber" | "contextTitle">;

/** "JOB-492 · Replace bathroom" — the record reference shown under the name. */
export function techChatContextLabel(thread: Omit<ContextFields, "contextId">) {
  const ref = [thread.contextNumber, thread.contextTitle].filter(Boolean).join(" · ");
  if (thread.contextType === "payment") return ref ? `Pay · ${ref}` : "Pay & payments";
  if (thread.contextType === "general") return "General";
  return ref || (thread.contextType === "job" ? "Job" : "Estimate");
}

/** Where the record behind a thread lives, for the side that is reading it. */
export function techChatContextHref(thread: ContextFields, side: TechChatSide): { href: string; label: string } | null {
  const id = thread.contextId;
  if (side === "technician") {
    if (thread.contextType === "job" && id) return { href: `/technical/jobs/${id}`, label: "Open job" };
    if (thread.contextType === "estimate" && id) return { href: `/technical/estimates/${id}`, label: "Open estimate" };
    if (thread.contextType === "payment") {
      return id ? { href: `/technical/jobs/${id}?tab=time`, label: "Open job pay" } : { href: "/technical/payments", label: "Open payments" };
    }
    return null;
  }
  if (thread.contextType === "job" && id) return { href: `/pro/dashboard/jobs/${id}`, label: "Open job" };
  if (thread.contextType === "estimate" && id) return { href: `/pro/dashboard/estimates/${id}`, label: "Open estimate" };
  if (thread.contextType === "payment") {
    return id ? { href: `/pro/dashboard/jobs/${id}`, label: "Open job" } : { href: "/pro/dashboard/timesheets", label: "Open timesheets" };
  }
  return null;
}
