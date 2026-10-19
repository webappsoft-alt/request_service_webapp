/**
 * Client-side copy for the AI assistant.
 *
 * The model guardrails (scope restriction, out-of-scope redirect, 1–3 clarifying
 * questions, JSON output contract) live on the backend in
 * request-service-backend/src/modules/bot-ai/bot.prompt.js so the OpenAI key and
 * prompt never reach the browser.
 */

export const BOT_NAME = "Your Home Service Helper";

export const BOT_STATUS = "Online · Ready to help";

export const BOT_DISCLAIMER = "AI-powered help for your home · Your pro will confirm the service details.";

export const WELCOME_MESSAGE =
  "Hi! I'm your home service helper. What do you need help with today? Pick a service below, or describe what's going on in your own words.";

/**
 * Quick-select chips on the welcome message. Sent as a plain message, so each label is
 * matched against the live catalog by name on the backend (falls back to the model).
 */
export const WELCOME_SERVICES = [
  "Plumbing",
  "HVAC",
  "Electrical",
  "Handyman",
  "House Cleaning",
  "Roofing",
  "Landscaping",
  "Painting",
] as const;
