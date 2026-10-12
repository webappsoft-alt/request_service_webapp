/**
 * Client-side copy for the AI assistant.
 *
 * The model guardrails (scope restriction, out-of-scope redirect, 1–3 clarifying
 * questions, JSON output contract) live on the backend in
 * request-service-backend/src/modules/bot-ai/bot.prompt.js so the OpenAI key and
 * prompt never reach the browser.
 */

export const BOT_NAME = "AI Assistant";

/** Open-ended opener: no preset category buttons — the customer describes the problem. */
export const WELCOME_MESSAGE =
  "Hi! How can I help you today? Describe what's going on at home, and I'll guide you step by step.";
