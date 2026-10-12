/** Shared models for the customer AI assistant (components/bot-ai). */

export type BotStep = 1 | 2 | 3;

export type MockCategory = {
  /** Matches the marketplace category slug in lib/data/services.ts. */
  slug: string;
  name: string;
  emoji: string;
  keywords: string[];
};

export type MockSubService = {
  id: string;
  categorySlug: string;
  name: string;
  keywords: string[];
};

export type MockProvider = {
  id: string;
  /** Public profile slug (/professionals/[slug]); null when no profile page exists yet. */
  slug: string | null;
  name: string;
  initials: string;
  /** Tailwind gradient classes for the logo tile. */
  accent: string;
  rating: number;
  reviewCount: number;
  verified: boolean;
  distanceMiles: number;
  city: string;
  categorySlugs: string[];
  responseTime: string;
  yearsInBusiness: number;
};

export type MockService = {
  id: string;
  providerId: string;
  categorySlug: string;
  subServiceId?: string;
  title: string;
  description: string;
  pricing: { type: "fixed"; amount: number } | { type: "range"; min: number; max: number };
  duration: string;
};

/** Structured input the conversation engine understands (typed text or a tapped pill). */
export type BotInput =
  | { type: "text"; text: string }
  | { type: "category"; slug: string }
  | { type: "subservice"; id: string }
  | { type: "provider"; id: string }
  | { type: "browse-categories" };

export type BotSuggestion = {
  label: string;
  input: BotInput;
};

export type BotAuthPrompt = {
  action: "book" | "quote";
  serviceTitle: string;
  /** Where to land after sign-in (the booking / quote form). */
  nextHref: string;
};

export type BotMessage = {
  id: string;
  role: "user" | "bot";
  text: string;
  createdAt: number;
  /** Optional emphasised line (safety note, scope reminder). */
  note?: { tone: "warning" | "info"; text: string };
  suggestions?: BotSuggestion[];
  providers?: MockProvider[];
  services?: MockService[];
  authPrompt?: BotAuthPrompt;
};

export type BotConversationState = {
  step: BotStep;
  categorySlug: string | null;
  subServiceId: string | null;
  providerId: string | null;
  /** Clarifying questions asked so far (capped by the guardrail at 2–3). */
  clarifyCount: number;
};

export type BotSession = {
  id: string;
  title: string;
  updatedAt: number;
  messages: BotMessage[];
  state: BotConversationState;
};
