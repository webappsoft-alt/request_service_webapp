import axios from "axios";
import { getData, patchData } from "@/components/api/sliceHttp";
import { AI_VOICES, DEFAULT_AI_CALLING_SETTINGS } from "./constants";
import type {
  AiCallingAdapter,
  AiCallingSettings,
  AiPhoneNumberStatus,
  AiVoiceId,
} from "./types";

export const AI_CALLING_ENDPOINT = "provider/ai-calling";

const STATUSES: AiPhoneNumberStatus[] = ["active", "pending", "unassigned"];

/** Accepts `{ data: {...} }` or a flat body and fills anything missing with defaults. */
export function parseAiCallingSettings(response: unknown): AiCallingSettings {
  const root = (response && typeof response === "object" ? response : {}) as Record<string, unknown>;
  const data = (root.data && typeof root.data === "object" ? root.data : root) as Record<string, unknown>;
  const fallback = DEFAULT_AI_CALLING_SETTINGS;

  const aiPhoneNumber = typeof data.aiPhoneNumber === "string" && data.aiPhoneNumber.trim()
    ? data.aiPhoneNumber.trim()
    : null;
  const status = STATUSES.includes(data.aiPhoneNumberStatus as AiPhoneNumberStatus)
    ? (data.aiPhoneNumberStatus as AiPhoneNumberStatus)
    : aiPhoneNumber
      ? "active"
      : "unassigned";
  const voiceId = AI_VOICES.some((voice) => voice.id === data.voiceId)
    ? (data.voiceId as AiVoiceId)
    : fallback.voiceId;

  return {
    enabled: typeof data.enabled === "boolean" ? data.enabled : fallback.enabled,
    aiPhoneNumber,
    aiPhoneNumberStatus: status,
    provisioningNote: typeof data.provisioningNote === "string" ? data.provisioningNote : "",
    escalationNumber: typeof data.escalationNumber === "string" ? data.escalationNumber : "",
    greeting: typeof data.greeting === "string" && data.greeting.trim() ? data.greeting : fallback.greeting,
    voiceId,
  };
}

/** Default adapter: GET / PATCH `provider/ai-calling`. A 404 means "not set up yet". */
export const providerAiCallingAdapter: AiCallingAdapter = {
  async load() {
    try {
      return parseAiCallingSettings(await getData(AI_CALLING_ENDPOINT, undefined, { silent: true }));
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return { ...DEFAULT_AI_CALLING_SETTINGS };
      }
      throw error;
    }
  },
  async save(update) {
    return parseAiCallingSettings(await patchData(AI_CALLING_ENDPOINT, update, { silent: true }));
  },
};
