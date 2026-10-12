import {
  findCategory,
  findProvider,
  findSubService,
  mockCategories,
  mockSubServices,
  providersForCategory,
  servicesForProvider,
} from "./mockData";
import {
  isGreeting,
  isOutOfScope,
  MAX_CLARIFYING_QUESTIONS,
  OUT_OF_SCOPE_REPLY,
  safetyNoteFor,
} from "./systemPromptGuide";
import type {
  BotConversationState,
  BotInput,
  BotMessage,
  BotSuggestion,
} from "./types";

/**
 * Local rule-based dispatcher used until the LLM endpoint exists. It follows the same
 * contract as BOT_SYSTEM_PROMPT: identify service → choose provider → quote / booking.
 * Swap `getBotReply` for an API call without touching the UI.
 */

export const initialConversationState: BotConversationState = {
  step: 1,
  categorySlug: null,
  subServiceId: null,
  providerId: null,
  clarifyCount: 0,
};

type BotReplyDraft = Omit<BotMessage, "id" | "role" | "createdAt">;

export type BotReply = {
  state: BotConversationState;
  messages: BotReplyDraft[];
};

/** Symptom words that appear across trades; they only break ties. */
const GENERIC_WORDS = new Set(["leak", "drip", "fix", "repair", "burst", "flood", "service", "broken"]);

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

function keywordScore(text: string, keywords: string[]) {
  let score = 0;
  for (const raw of keywords) {
    const keyword = raw.trim().toLowerCase();
    if (!keyword) continue;
    // Short words must match whole words, plural allowed ("ac" ≠ "accident", "ant" ≠ "want").
    const pattern =
      keyword.length <= 3
        ? new RegExp(`\\b${escapeRegExp(keyword)}s?\\b`, "i")
        : new RegExp(`\\b${escapeRegExp(keyword)}`, "i");
    if (pattern.test(text)) score += GENERIC_WORDS.has(keyword) ? 1 : keyword.length;
  }
  return score;
}

function bestMatch<T extends { keywords: string[] }>(text: string, items: T[]) {
  let best: T | undefined;
  let bestScore = 0;
  for (const item of items) {
    const score = keywordScore(text, item.keywords);
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }
  return best;
}

export function detectCategory(text: string) {
  return bestMatch(text, mockCategories);
}

export function detectSubService(text: string, categorySlug: string) {
  return bestMatch(
    text,
    mockSubServices.filter((sub) => sub.categorySlug === categorySlug),
  );
}

function categoryPills(): BotSuggestion[] {
  return mockCategories.slice(0, 6).map((category) => ({
    label: `${category.emoji} ${category.name}`,
    input: { type: "category", slug: category.slug },
  }));
}

function subServicePills(categorySlug: string): BotSuggestion[] {
  return mockSubServices
    .filter((sub) => sub.categorySlug === categorySlug)
    .map((sub) => ({ label: sub.name, input: { type: "subservice", id: sub.id } }));
}

function withSafety(text: string, draft: BotReplyDraft): BotReplyDraft {
  const safety = safetyNoteFor(text);
  return safety ? { ...draft, note: { tone: "warning", text: safety } } : draft;
}

function providersReply(
  state: BotConversationState,
  categorySlug: string,
  subServiceId: string | null,
  locationLabel: string,
  lead: string,
): BotReply {
  const category = findCategory(categorySlug);
  const sub = findSubService(subServiceId);
  const providers = providersForCategory(categorySlug);
  const where = locationLabel ? ` near ${locationLabel}` : " near you";
  const subject = sub?.name ?? category?.name ?? "this job";
  return {
    state: { ...state, step: 2, categorySlug, subServiceId, providerId: null },
    messages: [
      {
        text: providers.length
          ? `${lead}Here are verified ${category?.name ?? ""} pros for ${subject}${where}. Swipe to compare, then tap “Select Pro”.`
          : `${lead}I couldn't find ${category?.name ?? ""} pros${where} yet. Try another service or send a general quote request.`,
        providers,
        suggestions: [{ label: "Change service", input: { type: "browse-categories" } }],
      },
    ],
  };
}

function askSubService(state: BotConversationState, categorySlug: string, lead = ""): BotReply {
  const category = findCategory(categorySlug);
  return {
    state: {
      ...state,
      step: 1,
      categorySlug,
      subServiceId: null,
      providerId: null,
      clarifyCount: state.clarifyCount + 1,
    },
    messages: [
      {
        text: `${lead}Sounds like a ${category?.name.toLowerCase() ?? "home"} job. Which of these is closest?`,
        suggestions: subServicePills(categorySlug),
      },
    ],
  };
}

function handleText(
  state: BotConversationState,
  text: string,
  locationLabel: string,
): BotReply {
  if (isOutOfScope(text)) {
    return { state, messages: [{ text: OUT_OF_SCOPE_REPLY, suggestions: categoryPills() }] };
  }

  if (isGreeting(text)) {
    return {
      state,
      messages: [
        {
          text: "Hello! What can I help you fix or schedule today? Describe the problem or pick a service.",
          suggestions: categoryPills(),
        },
      ],
    };
  }

  // A new trade in the message wins; otherwise keep refining the current one.
  const detected = detectCategory(text);
  const categorySlug = detected?.slug ?? state.categorySlug;

  if (categorySlug) {
    const sub = detectSubService(text, categorySlug);
    if (sub) {
      const reply = providersReply(state, categorySlug, sub.id, locationLabel, `Got it — ${sub.name}. `);
      reply.messages[0] = withSafety(text, reply.messages[0]);
      return reply;
    }
    if (state.clarifyCount >= MAX_CLARIFYING_QUESTIONS) {
      const reply = providersReply(state, categorySlug, null, locationLabel, "Thanks — that's enough to get started. ");
      reply.messages[0] = withSafety(text, reply.messages[0]);
      return reply;
    }
    const reply = askSubService(state, categorySlug);
    reply.messages[0] = withSafety(text, reply.messages[0]);
    return reply;
  }

  if (state.clarifyCount >= MAX_CLARIFYING_QUESTIONS) {
    return {
      state,
      messages: [
        {
          text: "I want to get this right. Pick the closest service below, or send a free quote request and pros will follow up.",
          suggestions: [...categoryPills(), { label: "More services", input: { type: "browse-categories" } }],
        },
      ],
    };
  }

  return {
    state: { ...state, clarifyCount: state.clarifyCount + 1 },
    messages: [
      withSafety(text, {
        text: "Thanks! Which area of the home is this about? Pick one, or describe it a bit more (e.g. “water under the sink”).",
        suggestions: categoryPills(),
      }),
    ],
  };
}

export function getBotReply(
  state: BotConversationState,
  input: BotInput,
  locationLabel: string,
): BotReply {
  switch (input.type) {
    case "text":
      return handleText(state, input.text, locationLabel);

    case "browse-categories":
      return {
        state: { ...initialConversationState, clarifyCount: state.clarifyCount },
        messages: [
          {
            text: "No problem. Which service do you need?",
            suggestions: mockCategories.map((category) => ({
              label: `${category.emoji} ${category.name}`,
              input: { type: "category", slug: category.slug },
            })),
          },
        ],
      };

    case "category":
      return askSubService(state, input.slug);

    case "subservice": {
      const sub = findSubService(input.id);
      if (!sub) return { state, messages: [] };
      return providersReply(state, sub.categorySlug, sub.id, locationLabel, "");
    }

    case "provider": {
      const provider = findProvider(input.id);
      if (!provider) return { state, messages: [] };
      const categorySlug =
        state.categorySlug && provider.categorySlugs.includes(state.categorySlug)
          ? state.categorySlug
          : provider.categorySlugs[0];
      const services = servicesForProvider(provider.id, categorySlug, state.subServiceId);
      const suggestions: BotSuggestion[] = [
        state.subServiceId
          ? { label: "See other pros", input: { type: "subservice", id: state.subServiceId } }
          : { label: "See other pros", input: { type: "category", slug: categorySlug } },
        { label: "Change service", input: { type: "browse-categories" } },
      ];
      return {
        state: { ...state, step: 3, categorySlug, providerId: provider.id },
        messages: [
          {
            text: services.length
              ? `Great choice — ${provider.name}. Book a fixed-price service instantly, or request a custom quote.`
              : `${provider.name} hasn't listed fixed-price services yet. Request a quote and they'll send an itemized estimate.`,
            services,
            suggestions,
          },
        ],
      };
    }
  }
}

/** Short session title for the history drawer. */
export function sessionTitle(state: BotConversationState, firstUserText: string) {
  const sub = findSubService(state.subServiceId);
  const category = findCategory(state.categorySlug);
  if (sub) return sub.name;
  if (category) return category.name;
  const trimmed = firstUserText.trim();
  return trimmed.length > 40 ? `${trimmed.slice(0, 40)}…` : trimmed || "New conversation";
}
