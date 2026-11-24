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
  confirm: (id: string) => `provider/assistant/actions/${id}/confirm`,
  cancel: (id: string) => `provider/assistant/actions/${id}/cancel`,
} as const;

export type PaRecord = { id: string; title: string; subtitle: string; href: string };

export type PaDraftItem = {
  description: string;
  kind: "labor" | "material" | "equipment";
  quantity: number;
  unit: string;
  unitPrice: number;
  /** Work / trade section (e.g. Plumbing, Flooring, Shower) — saved as the estimate line's section; "" = General. */
  section?: string;
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
  /** Site-photo estimates: how the AI priced it (shown as a note on the card). */
  pricing?: {
    label: string;
    basis: "history" | "market";
    market: string | null;
    historyCount: number;
    historyMatch: "category" | "any" | null;
    dimensions: string | null;
    dimensionsSource: "ai" | "pro" | null;
  } | null;
};

/** Site-photo scope chips (backend site-scope.js). A click is sent back as a PaVisionAction. */
export type PaQuickReplyKind = "confirm" | "reject" | "upload_more" | "enter_dimensions" | "use_ai_dimensions" | "draft" | "revise";
/** `revise` chips (one-tap "+ Haul-away", "Budget option"…) carry the instruction in `value`. */
export type PaQuickReply = { id: string; kind: PaQuickReplyKind; label: string; value?: string };
export type PaVisionAction = {
  kind: "more_photos" | "confirm" | "reject" | "describe" | "dimensions" | "use_ai" | "draft" | "revise" | "set_customer";
  value?: string;
};
/** Extras sent with a message: site photos (our upload URLs) and/or a clicked scope chip. */
export type PaSendExtras = { images?: string[]; visionAction?: PaVisionAction | null };

/** What the co-pilot read from the site photos (AI Vision Estimator, Phase 1). */
export type PaSiteScope = {
  type: "site_scope";
  status: "awaiting_confirmation" | "awaiting_request" | "awaiting_dimensions" | "ready" | "drafted";
  photoCount: number;
  trade: string;
  area: string;
  summary: string;
  findings: string[];
  scopeItems: string[];
  dimensions: { label: string; source: "ai" | "pro" | "ai_suggested"; confidence: "high" | "medium" | "low" | null; basis: string } | null;
  missing: string[];
};

export type PaConfirmStatus = "pending" | "running" | "done" | "failed" | "cancelled";

export type PaAction =
  | { type: "navigate"; href: string; label: string; /** Show a button instead of opening at once. */ manual?: boolean }
  | { type: "choices"; entity: string; items: PaRecord[] }
  | { type: "estimate_draft"; draft: PaEstimateDraft }
  | PaSiteScope
  /** Live list from the CRM (overdue invoices, new leads, today's schedule…). */
  | { type: "list"; title: string; total: number; amountDue?: number | null; items: PaRecord[]; href: string }
  /** Facts card (timesheet summary, live status, business snapshot, suggestion). */
  | { type: "info"; title: string; rows: Array<[string, string]>; href?: string; hrefLabel?: string; autoOpen?: boolean }
  /** A change prepared by the co-pilot, run only when the Pro confirms. */
  | {
      type: "confirm";
      actionId: string;
      title: string;
      details: Array<[string, string]>;
      confirmLabel: string;
      status: PaConfirmStatus;
      result?: { replyText?: string; href?: string; hrefLabel?: string; error?: string } | null;
    };

export type PaReply = {
  messageId: string;
  replyText: string;
  action: PaAction | null;
  suggestions: string[];
  quickReplies?: PaQuickReply[];
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
  /** Site photos on a user message. */
  images?: string[];
  /** Structured chips on an assistant reply (site-photo loop). */
  quickReplies?: PaQuickReply[];
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
  extras: PaSendExtras = {},
) {
  return unwrap<PaReply>(
    await postData(
      PRO_ASSISTANT_API.message,
      { message, history, conversationId, clientMessageId, images: extras.images || [], visionAction: extras.visionAction || null },
      { silent: true },
    ),
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

/** Run a prepared co-pilot action (the server runs its stored arguments, once). */
export async function confirmAssistantAction(id: string) {
  return unwrap<{ replyText: string; href?: string; hrefLabel?: string; status: string }>(
    await postData(PRO_ASSISTANT_API.confirm(id), {}, { silent: true }),
  );
}

export async function cancelAssistantAction(id: string) {
  return unwrap<{ status: string }>(await postData(PRO_ASSISTANT_API.cancel(id), {}, { silent: true }));
}
