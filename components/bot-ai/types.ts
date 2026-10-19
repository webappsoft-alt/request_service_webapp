/** Shared models for the customer AI assistant (components/bot-ai ↔ backend /bot-ai). */

import type { PlaceSuggestion } from "@/lib/google-places";

export type BotStep = "identifying" | "provider_selection" | "quote_or_booking";

export type BotProviderCard = {
  id: string;
  /** Public profile slug (/professionals/[slug]). */
  slug: string | null;
  name: string;
  avatarUrl: string | null;
  rating: number;
  reviewCount: number;
  completedJobs: number;
  verified: boolean;
  licensed: boolean;
  insured: boolean;
  distanceMiles: number | null;
  city: string;
  startingPrice: number | null;
  activeServicesCount: number;
};

export type BotServiceCard = {
  id: string;
  slug: string | null;
  title: string;
  description: string;
  price: number | null;
  unit: string;
  categorySlug: string | null;
  categoryName: string | null;
  subCategoryName: string | null;
  image: string | null;
  distanceMiles: number | null;
  provider: {
    id: string;
    slug: string | null;
    name: string;
    avatarUrl: string | null;
    rating: number;
    reviewCount: number;
  } | null;
};

/** Hand-off into the existing quote request flow. */
export type BotHandoff = {
  type: "quote";
  providerId: string | null;
  providerSlug: string | null;
  providerName: string | null;
  categorySlug: string | null;
};

export type BotConversationContext = {
  step: BotStep;
  categoryId?: string | null;
  subCategoryId?: string | null;
  categorySlug: string | null;
  categoryName: string | null;
  subCategorySlug: string | null;
  subCategoryName: string | null;
  providerId: string | null;
  providerName: string | null;
  providerSlug: string | null;
};

/** Details for an in-chat quote request (confirmed by the customer, then OTP-verified). */
export type BotQuoteDraft = {
  providerId: string | null;
  providerSlug: string | null;
  providerName: string | null;
  categoryId: string | null;
  categorySlug: string | null;
  categoryName: string | null;
  subCategoryName: string | null;
  /** Fixed service the quote started from, if any. */
  serviceTitle: string | null;
};

/** 3-way choice once the job is known — only pathways that exist near the customer. */
export type BotChoices = {
  subject: string;
  categoryName: string;
  locationLabel: string | null;
  pros: { count: number; more: boolean } | null;
  services: { count: number; more: boolean; fromPrice: number | null } | null;
  /** Hidden when no pro covers the area; count = pros the quote would reach (null = unknown). */
  quote: {
    available: boolean;
    count?: number | null;
    /** No open-request match here: the request goes straight to this nearest listed pro. */
    direct?: { name: string } | null;
  };
};

export type BotPath = "pros" | "services" | "quote";

export type BotUrgency = "emergency" | "urgent" | "this_week" | "flexible" | "not_specified";

/** AI-written, pro-ready job brief (sent as the quote request's description). */
export type BotQuoteBrief = {
  source: "ai" | "summary";
  jobTitle: string;
  trade: string;
  subService: string | null;
  issueSummary: string;
  area: string | null;
  urgency: BotUrgency;
  urgencyLabel: string;
  preferredTime: string | null;
  customerDetails: string[];
  /** The customer's answers to the quick diagnostic questions (sent to the pro verbatim). */
  answers?: { question: string; answer: string }[];
  locationLabel: string | null;
  categoryId: string | null;
  categorySlug: string | null;
  categoryName: string;
  subCategoryId: string | null;
  subCategoryName: string | null;
  serviceTitle: string | null;
  providerId: string | null;
  providerSlug: string | null;
  providerName: string | null;
  /** Set once this brief was sent (server-side too, so history can't resend it). */
  submitted: boolean;
};

/** Hero search-bar suggestion (GET /api/bot-ai/suggest). */
export type BotSearchSuggestion = {
  id: string;
  label: string;
  categoryId: string;
  categorySlug: string;
  categoryName: string;
  subCategoryId: string | null;
  subCategorySlug: string | null;
  subCategoryName: string | null;
};

export type BotQuoteSuccess = {
  requestNumber: string;
  providerName: string | null;
  count: number;
  quoteBatchId: string | null;
};

/** Built-in emergency guidance (gas, electrical, flooding) shown before any services. */
export type BotSafetyAlert = {
  kind: string;
  level: "emergency";
  title: string;
  text: string;
};

export type BotAuthPrompt = {
  action: "book" | "quote";
  title: string;
};

export type BotMessage = {
  id: string;
  role: "user" | "bot";
  text: string;
  createdAt: number;
  /** True while the reply is still streaming in. */
  streaming?: boolean;
  /** Arrived live in this page view (revealed smoothly); history replays instantly. */
  live?: boolean;
  /** Failed turn — shows a retry pill. */
  error?: boolean;
  safety?: BotSafetyAlert[];
  /** Quick-reply pills (sent back as plain messages). */
  suggestions?: string[];
  providers?: BotProviderCard[];
  services?: BotServiceCard[];
  handoff?: BotHandoff | null;
  authPrompt?: BotAuthPrompt;
  /** Browse pros / fixed-price services / custom quote. */
  choices?: BotChoices | null;
  /** AI lead brief to confirm, verify by OTP and send. */
  quoteBrief?: BotQuoteBrief | null;
  quoteSuccess?: BotQuoteSuccess | null;
  /** Client-only: address candidates to confirm in the chat (tap one to set it). */
  addressOptions?: PlaceSuggestion[];
  /** Client-only: message to send once the confirmed address is set (address was inside it). */
  addressPendingText?: string | null;
};

export type BotSessionSummary = {
  sessionId: string;
  title: string;
  updatedAt: string;
  messageCount: number;
};

/** `bot:response` payload from the backend. */
export type BotServerReply = {
  sessionId: string;
  clientMessageId: string | null;
  messageId: string;
  replyText: string;
  createdAt: string;
  step: BotStep;
  intent: string;
  context: Partial<BotConversationContext>;
  providers: BotProviderCard[];
  services: BotServiceCard[];
  suggestedPills: string[];
  handoff: BotHandoff | null;
  safety: BotSafetyAlert[];
  choices: BotChoices | null;
  quoteBrief: BotQuoteBrief | null;
  quoteSuccess: BotQuoteSuccess | null;
};

/** Stored message from GET /bot-ai/history/:sessionId. */
export type BotServerMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  payload: Partial<Pick<BotServerReply, "providers" | "services" | "suggestedPills" | "handoff" | "step" | "safety" | "choices" | "quoteBrief" | "quoteSuccess">> | null;
};
