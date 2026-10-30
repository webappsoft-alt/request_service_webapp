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
    id: "iris",
    label: "Iris",
    gender: "female",
    tone: "Steady & relatable",
    accentClassName: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  },
  {
    id: "cindy",
    label: "Cindy",
    gender: "female",
    tone: "Smooth & welcoming",
    accentClassName: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  {
    id: "morgan",
    label: "Morgan",
    gender: "female",
    tone: "Polished & professional",
    accentClassName: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300",
  },
  {
    id: "parker",
    label: "Parker",
    gender: "male",
    tone: "Relaxed & conversational",
    accentClassName: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  {
    id: "kenneth",
    label: "Kenneth",
    gender: "male",
    tone: "Clear & approachable",
    accentClassName: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  },
  {
    id: "wyatt",
    label: "Wyatt",
    gender: "male",
    tone: "Friendly, light Southern",
    accentClassName: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  },
  {
    id: "heath",
    label: "Heath",
    gender: "male",
    tone: "Calm & composed",
    accentClassName: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
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
