import { deleteData, getData, patchData, postData, putData } from "@/components/api/sliceHttp";

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
  /** Save Draft + AI estimate history. */
  drafts: "provider/assistant/drafts",
  draft: (id: string) => `provider/assistant/drafts/${id}`,
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
  /** Material photo (one, like the estimate builder) — saved on the created estimate's line. */
  images?: string[];
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
  /** Reopened from History (Save Draft): the saved draft's id + the choices saved with it. */
  savedDraftId?: string | null;
  savedAt?: string | null;
  categoryName?: string;
  subcategoryName?: string;
  addressId?: string;
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

/**
 * The estimate a draft card created or updated. `estimateId` / `opportunityId` link revised drafts
 * in the same chat to it (older chats only have href + number; the workspace id is in the href).
 */
export type PaCreatedEstimate = {
  href: string;
  number: string;
  estimateId?: string;
  opportunityId?: string | null;
  mode?: "created" | "updated";
};

/** Lock state of the estimate a revised draft is linked to. */
export type PaLinkedEstimate = {
  estimateId: string;
  opportunityId: string | null;
  number: string;
  href: string;
  status: string;
  editable: boolean;
  /** e.g. "is now a job", "was approved", "was declined", "has expired". */
  lockedReason: string | null;
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
  /** Estimate card created (or a revised card updated it) → its link. */
  created?: PaCreatedEstimate | null;
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
  /** Saved draft this came from (marked "created" in History). */
  draftId?: string | null;
}) {
  return unwrap<{ opportunityId: string; estimateId: string; number: string; href: string; mode?: "created" }>(
    await postData(PRO_ASSISTANT_API.estimates, body, { silent: true }),
  );
}

/** One row of the AI estimate history: a saved draft, or a draft the co-pilot generated in a chat. */
export type PaEstimateHistoryItem = {
  id: string;
  source: "saved" | "generated";
  title: string;
  customerName: string;
  total: number;
  itemCount: number;
  created: { href: string; number: string } | null;
  conversationId: string | null;
  messageId: string;
  at: string;
};

/** A saved draft, ready to reload into the card. */
export type PaSavedDraft = PaEstimateHistoryItem & {
  customer: PaCustomerOption | null;
  addressId: string;
  categoryName: string;
  subcategoryName: string;
  items: PaDraftItem[];
  notes: string;
  pricing: PaEstimateDraft["pricing"];
};

export type PaSaveDraftBody = {
  title: string;
  customerId?: string | null;
  addressId?: string;
  categoryName: string;
  subcategoryName?: string;
  items: PaDraftItem[];
  notes: string;
  pricing?: PaEstimateDraft["pricing"];
  conversationId?: string | null;
  messageId?: string;
};

export async function listAssistantEstimateHistory(q = "") {
  const res = (await getData(PRO_ASSISTANT_API.drafts, { q, limit: 50 }, { silent: true, force: true })) as { data?: PaEstimateHistoryItem[] };
  return Array.isArray(res?.data) ? res.data : [];
}

export async function getAssistantDraft(id: string) {
  return unwrap<PaSavedDraft>(await getData(PRO_ASSISTANT_API.draft(id), undefined, { silent: true, force: true }));
}

/** Save Draft — new (no id) or over the same saved draft. */
export async function saveAssistantDraft(body: PaSaveDraftBody, id?: string | null) {
  return unwrap<PaEstimateHistoryItem>(
    id ? await putData(PRO_ASSISTANT_API.draft(id), body, { silent: true }) : await postData(PRO_ASSISTANT_API.drafts, body, { silent: true }),
  );
}

export async function deleteAssistantDraft(id: string) {
  return deleteData(PRO_ASSISTANT_API.draft(id), { silent: true });
}

export async function getLinkedAssistantEstimate(id: string) {
  return unwrap<PaLinkedEstimate>(await getData(`${PRO_ASSISTANT_API.estimates}/${id}/link`, undefined, { silent: true, force: true }));
}

/** Revised draft → update the linked estimate in place (no duplicate). */
export async function updateAssistantEstimate(
  id: string,
  body: { title: string; items: PaDraftItem[]; notes: string; conversationId?: string | null; messageId?: string; draftId?: string | null },
) {
  return unwrap<PaCreatedEstimate>(await putData(`${PRO_ASSISTANT_API.estimates}/${id}`, body, { silent: true }));
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
