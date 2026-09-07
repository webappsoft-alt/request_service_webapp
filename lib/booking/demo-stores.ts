export const RECORDS_EVENT = "rs-portal-records";
export const CRM_EVENT = "rs-crm-directory";
export const CHAT_EVENT = "rs-chat-threads";

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as T) };
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown, event: string) {
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event(event));
}

export function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "Customer",
    lastName: parts.slice(1).join(" ") || "Guest",
  };
}
