export const DEMO_SESSION_KEY = "rs-demo-session";
export const DEMO_SESSION_EVENT = "rs-demo-session";

export type DemoRole = "customer" | "provider";

export type DemoSession = {
  role: DemoRole;
  firstName: string;
  lastName: string;
  email: string;
  companyName?: string;
};

export function readDemoSession(): DemoSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DEMO_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DemoSession;
    if (!parsed?.email || !parsed.firstName) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeDemoSession(session: DemoSession) {
  window.localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event(DEMO_SESSION_EVENT));
}

export function clearDemoSession() {
  window.localStorage.removeItem(DEMO_SESSION_KEY);
  window.dispatchEvent(new Event(DEMO_SESSION_EVENT));
}
