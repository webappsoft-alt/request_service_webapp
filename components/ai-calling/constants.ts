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
    id: "daniel",
    label: "Daniel",
    gender: "male",
    tone: "Calm & professional",
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
  "Thanks for calling! I'm the virtual assistant. I can help you book a service, get a quote, or answer questions. How can I help you today?";

export const DEFAULT_AI_CALLING_SETTINGS: AiCallingSettings = {
  enabled: false,
  aiPhoneNumber: null,
  aiPhoneNumberStatus: "unassigned",
  provisioningNote: "",
  escalationNumber: "",
  greeting: DEFAULT_GREETING,
  voiceId: "skylar",
};
