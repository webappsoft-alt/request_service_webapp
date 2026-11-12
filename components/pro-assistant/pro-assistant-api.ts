import { deleteData, getData, patchData, postData } from "@/components/api/sliceHttp";

/**
 * Pro operations assistant — API + types. Separate from the customer bot (components/bot-ai).
 * Backend: request-service-backend/src/modules/pro-assistant (socket namespace /pro-assistant,
 * REST /api/provider/assistant/*).
 */

export const PRO_ASSISTANT_API = {
  message: "provider/assistant/message",
  customers: "provider/assistant/customers",
  estimates: "provider/assistant/estimates",
  conversations: "provider/assistant/conversations",
  conversation: (id: string) => `provider/assistant/conversations/${id}`,
} as const;

export type PaRecord = { id: string; title: string; subtitle: string; href: string };

export type PaDraftItem = {
  description: string;
  kind: "labor" | "material" | "equipment";
  quantity: number;
  unit: string;
  unitPrice: number;
};

export type PaCustomerAddress = { id: string; label: string; line: string };
export type PaCustomerOption = {
  id: string;
  name: string;
  subtitle?: string;
  hasAddress?: boolean;
  /** Service addresses (the estimate's property). */
  addresses?: PaCustomerAddress[];
};

export type PaEstimateDraft = {
  title: string;
  customerName: string | null;
  /** Trade the AI read from the scope (matched to the Pro's categories in the card). */
  serviceCategory?: string;
  customer: PaCustomerOption | null;
  customerCandidates: PaCustomerOption[];
  items: Array<PaDraftItem & { total?: number }>;
  subtotal: number;
  notes: string;
};

export type PaAction =
  | { type: "navigate"; href: string; label: string }
  | { type: "choices"; entity: string; items: PaRecord[] }
  | { type: "estimate_draft"; draft: PaEstimateDraft };

export type PaReply = {
  messageId: string;
  replyText: string;
  action: PaAction | null;
  suggestions: string[];
  /** Saved conversation this turn belongs to (new chats get one on the first reply). */
  conversationId?: string;
};

export type PaConversationSummary = {
  id: string;
  title: string;
  messageCount: number;
  lastMessageAt: string;
  preview: string;
};

export type PaMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  action?: PaAction | null;
  suggestions?: string[];
  /** Estimate card created → its link. */
  created?: { href: string; number: string } | null;
  pending?: boolean;
  error?: boolean;
  at: number;
};

function unwrap<T>(response: unknown): T {
  const root = (response && typeof response === "object" ? response : {}) as Record<string, unknown>;
  return (root.data !== undefined ? root.data : root) as T;
}

/** REST fallback when the socket isn't connected. */
export async function sendAssistantMessageRest(
  message: string,
  history: Array<{ role: string; text: string }>,
  conversationId: string | null,
  clientMessageId: string,
) {
  return unwrap<PaReply>(
    await postData(PRO_ASSISTANT_API.message, { message, history, conversationId, clientMessageId }, { silent: true }),
  );
}

export async function listAssistantConversations(q = "") {
  const res = (await getData(PRO_ASSISTANT_API.conversations, { limit: 50, q }, { silent: true, force: true })) as {
    data?: PaConversationSummary[];
  };
  return Array.isArray(res?.data) ? res.data : [];
}

export async function getAssistantConversation(id: string) {
  return unwrap<{ id: string; title: string; messages: PaMessage[] }>(
    await getData(PRO_ASSISTANT_API.conversation(id), undefined, { silent: true, force: true }),
  );
}

export async function renameAssistantConversation(id: string, title: string) {
  return unwrap<{ id: string; title: string }>(await patchData(PRO_ASSISTANT_API.conversation(id), { title }, { silent: true }));
}

export async function deleteAssistantConversation(id: string) {
  return deleteData(PRO_ASSISTANT_API.conversation(id), { silent: true });
}

/** Customers tab list (same customers), 20 per page. */
export async function searchAssistantCustomers(q: string, page = 1) {
  const res = (await getData(PRO_ASSISTANT_API.customers, { q, page, limit: 20 }, { silent: true, force: true })) as {
    data?: PaCustomerOption[];
    pagination?: { hasMore?: boolean; total?: number };
  };
  return {
    items: Array.isArray(res?.data) ? res.data : [],
    hasMore: Boolean(res?.pagination?.hasMore),
    total: Number(res?.pagination?.total) || 0,
  };
}

export async function createAssistantEstimate(body: {
  customerId: string;
  title: string;
  items: PaDraftItem[];
  notes: string;
  conversationId?: string | null;
  messageId?: string;
  addressId?: string;
  categoryName: string;
  subcategoryName?: string;
}) {
  return unwrap<{ opportunityId: string; estimateId: string; number: string; href: string }>(
    await postData(PRO_ASSISTANT_API.estimates, body, { silent: true }),
  );
}

/** Only portal pages may be opened from an assistant reply. */
export function isSafePortalHref(href: unknown): href is string {
  return typeof href === "string" && /^\/pro\/dashboard(?:\/[A-Za-z0-9/_-]*)?(?:\?[^\s]*)?$/.test(href);
}
