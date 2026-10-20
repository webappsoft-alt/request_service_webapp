import type { AiCallingSettings, AiVoiceOption } from "./types";

/** Cartesia Sonic voices (keys match the backend's `ai-calling/voices.js`). */
export const AI_VOICES: AiVoiceOption[] = [
  {
    id: "skylar",
    label: "Skylar",
    gender: "female",
    tone: "Warm & friendly",
    accentClassName: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  },
  {
    id: "max",
    label: "Max",
    gender: "male",
    tone: "Warm & engaging",
    accentClassName: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  },
  {
    id: "gemma",
    label: "Gemma",
    gender: "female",
    tone: "Bright & upbeat",
    accentClassName: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  {
    id: "parker",
    label: "Parker",
    gender: "male",
    tone: "Relaxed & conversational",
    accentClassName: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
];

export const GREETING_MAX_LENGTH = 300;

export const DEFAULT_GREETING =
  "Thanks for calling! How can I help you today?";

/** Used until the backend sends this business's own options (same wording, without the name). */
export const DEFAULT_GREETING_OPTIONS = [
  "Thanks for calling our office! How can I help you today?",
  "Hi, thank you for reaching out to our office. What can we assist you with today?",
  "Good day! You've reached our office. Are you looking to schedule a service or get an estimate?",
  "Thanks for calling our office. My name is your front-desk assistant—how may I direct your service request today?",
  "Hi there! Thanks for calling our office. How can we take care of your home services today?",
];

export const DEFAULT_AI_CALLING_SETTINGS: AiCallingSettings = {
  enabled: false,
  aiPhoneNumber: null,
  aiPhoneNumberStatus: "unassigned",
  planActive: true,
  provisioningNote: "",
  escalationNumber: "",
  greeting: DEFAULT_GREETING,
  defaultGreeting: DEFAULT_GREETING,
  greetingOptions: DEFAULT_GREETING_OPTIONS,
  voiceId: "skylar",
};
