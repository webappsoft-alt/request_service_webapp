import { getAuthToken } from "@/components/api/apiFuntions";
import { AI_CALLING_ENDPOINT } from "./api";
import type { AiVoiceId } from "./types";

const API_BASE_URL = String(process.env.NEXT_PUBLIC_API_BASE_URL || "").trim().replace(/\/+$/, "");

function apiUrl(path: string) {
  return `${API_BASE_URL}/${path.replace(/^\/+/, "")}`;
}

async function fetchAudio(path: string, init: RequestInit = {}): Promise<Blob> {
  const token = getAuthToken();
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: {
      ...(init.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message || `Audio request failed (${response.status})`);
  }
  return response.blob();
}

/** Short sample of a receptionist voice (cached by the server). */
export function fetchVoiceSample(voiceId: AiVoiceId) {
  return fetchAudio(`${AI_CALLING_ENDPOINT}/voices/${voiceId}/sample`);
}

/** The provider's own greeting text spoken with a voice. */
export function fetchGreetingPreview(voiceId: AiVoiceId, text: string) {
  return fetchAudio(`${AI_CALLING_ENDPOINT}/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ voiceId, text }),
  });
}

/** WebSocket URL of the browser voice test harness (`/api/ai-calling/test-stream`). */
export function testStreamUrl() {
  const base = API_BASE_URL || `${window.location.origin}/api`;
  const url = new URL(`${base}/ai-calling/test-stream`, window.location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("token", getAuthToken() || "");
  return url.toString();
}
