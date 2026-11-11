/**
 * Per-role session slots (client: a Technician in one tab must not replace a Pro in another tab).
 *
 * Before: every portal shared one localStorage key (`persist:userData`), so signing in as another role in
 * any tab overwrote the session of every tab on its next reload / token refresh, and signing out anywhere
 * signed every tab out.
 *
 * Now each role keeps its own saved session:
 *   persist:userData:provider | :technician | :contractor | :customer
 * and the URL decides which one a tab uses:
 *   /pro/*, /for-pros*, /for-providers → provider (Pro portal, Pro auth + Pro marketing pages)
 *   /technical/*                 → technician
 *   /contractor/*                → contractor
 *   estimate share links         → the session this tab already uses (sessionStorage)
 *   everything else (/, /account, /login, public pages) → customer
 *
 * So "/" is always the customer site: a Pro / Technician / Contractor signed in in another tab never takes
 * over the home page.
 *
 * Additive / zero-regression:
 * - The old `persist:userData` key is still written (it is the "last used" session) and is read as a
 *   fallback, so sessions that existed before this change keep working (migrated into their slot on use).
 * - Writes go to the slot of the role inside the saved session, never by URL alone.
 * - Kill switch: NEXT_PUBLIC_SCOPED_SESSIONS=off restores the single shared key exactly as before.
 */
import { decryptData } from "@/components/api/encrypted";

export type SessionRole = "provider" | "technician" | "contractor" | "customer";

export const LEGACY_SESSION_KEY = "persist:userData";
const TAB_ROLE_KEY = "rs-tab-session-role";

export const SCOPED_SESSIONS_ENABLED = process.env.NEXT_PUBLIC_SCOPED_SESSIONS !== "off";

export function slotKey(role: SessionRole) {
  return `${LEGACY_SESSION_KEY}:${role}`;
}

const under = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

/** Customer estimate links (`/e/<token>`, legacy `/<uuid>`): they work by token, for anyone. */
const SHARE_LINK = /^\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/?$/i;

/**
 * The role a URL belongs to (client: "/ is the customer, /pro the provider, /technical the technician"):
 *   /technical/*                                   → technician
 *   /contractor/*                                  → contractor
 *   /pro/*, /for-pros*, /for-providers (Pro site)  → provider   (not /pros/<slug>: a public profile)
 *   estimate share links                           → null: keep this tab's own session
 *   everything else (/, /account, /login, marketing, profiles, booking…) → customer
 */
export function scopeForPath(pathname: string): SessionRole | null {
  const path = pathname || "/";
  if (under(path, "/technical")) return "technician";
  if (under(path, "/contractor")) return "contractor";
  if (under(path, "/pro") || path.startsWith("/for-pros") || under(path, "/for-providers")) return "provider";
  if (under(path, "/e") || SHARE_LINK.test(path)) return null;
  return "customer";
}

export function normalizeSessionRole(role: unknown): SessionRole | null {
  const value = String(role || "").toLowerCase();
  if (value === "provider") return "provider";
  if (value === "technician") return "technician";
  if (value === "contractor") return "contractor";
  if (value === "customer" || value === "consumer" || value === "user") return "customer";
  return null;
}

/** The encrypted `userData` string inside a redux-persist value (`{"userData":"\"…\"","_persist":…}`). */
export function userDataOf(serialized: string | null | undefined): string | null {
  if (!serialized) return null;
  try {
    const outer = JSON.parse(serialized) as { userData?: string };
    if (typeof outer?.userData !== "string") return null;
    const inner = JSON.parse(outer.userData) as unknown;
    return typeof inner === "string" && inner ? inner : null;
  } catch {
    return null;
  }
}

/** Role of the signed-in user in a redux-persist value, or null (signed out / unreadable / other role). */
export function roleOfSerialized(serialized: string | null | undefined): SessionRole | null {
  const userData = userDataOf(serialized);
  if (!userData) return null;
  const payload = decryptData<{ token?: string; user?: { role?: unknown } }>(userData);
  if (!payload?.token || !payload.user) return null;
  return normalizeSessionRole(payload.user.role);
}

function local(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function tabStore(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

function readTabRole(): SessionRole | null {
  return normalizeSessionRole(tabStore()?.getItem(TAB_ROLE_KEY));
}

function writeTabRole(role: SessionRole | null) {
  try {
    if (role) tabStore()?.setItem(TAB_ROLE_KEY, role);
    else tabStore()?.removeItem(TAB_ROLE_KEY);
  } catch {
    // ignore (private mode / blocked storage)
  }
}

/** The slot this tab should use at `pathname` (null = public page with no session of its own → last used). */
export function slotForPath(pathname: string): SessionRole | null {
  return scopeForPath(pathname) ?? readTabRole();
}

/**
 * The saved session (redux-persist value) for a slot. A session saved before slots existed lives in the
 * legacy key: it is used when its role matches the slot (and copied into the slot on the next write).
 */
export function readSlot(role: SessionRole | null): string | null {
  const store = local();
  if (!store) return null;
  migrateLegacySession(store);
  const legacy = store.getItem(LEGACY_SESSION_KEY);
  if (!role) return legacy;
  const scoped = store.getItem(slotKey(role));
  if (scoped) return scoped;
  return legacy && roleOfSerialized(legacy) === role ? legacy : null;
}

/**
 * A session saved before slots existed (only in the legacy key) is copied into its role's slot right
 * away, so signing in as another role later (which rewrites the legacy key) can't lose it.
 */
function migrateLegacySession(store: Storage) {
  try {
    const legacy = store.getItem(LEGACY_SESSION_KEY);
    const role = roleOfSerialized(legacy);
    if (legacy && role && !store.getItem(slotKey(role))) store.setItem(slotKey(role), legacy);
  } catch {
    // ignore (quota / blocked storage): the legacy fallback still works
  }
}

/**
 * True while this tab still holds another role's session on a portal URL (e.g. a Pro tab that just moved
 * to /technical): the per-role switch is about to load that portal's own session (or none). Gates and the
 * route guard wait for it instead of redirecting with the old session.
 */
export function isSessionSwitchPending(
  pathname: string,
  role: unknown,
  signedIn: boolean,
  syncedScope: string | null | undefined,
): boolean {
  if (!SCOPED_SESSIONS_ENABLED || !signedIn) return false;
  const scope = scopeForPath(pathname);
  const current = normalizeSessionRole(role);
  // Only between moving to the portal and SessionScopeSync loading its session. Once synced, a different
  // role here is a fresh sign-in, and the usual redirects apply.
  return Boolean(scope && current && current !== scope && syncedScope !== scope);
}

/** Key SessionScopeSync records once a URL's session is in place. */
export function scopeKey(pathname: string): string {
  return scopeForPath(pathname) ?? "public";
}

/** Which slot the in-memory session of this tab came from (for sign-out). */
let activeSlot: SessionRole | null = null;

export function setActiveSlot(role: SessionRole | null) {
  activeSlot = role;
  if (role) writeTabRole(role);
}

export function getActiveSlot() {
  return activeSlot;
}

/** redux-persist storage for the auth slice: routes `persist:userData` to the per-role slots. */
export function createScopedSessionStorage(base: {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<unknown>;
  removeItem(key: string): Promise<unknown>;
}) {
  if (!SCOPED_SESSIONS_ENABLED) return base;
  return {
    getItem(key: string): Promise<string | null> {
      if (key !== LEGACY_SESSION_KEY || typeof window === "undefined") return base.getItem(key);
      const role = slotForPath(window.location.pathname);
      const value = readSlot(role);
      activeSlot = role ?? roleOfSerialized(value);
      if (role && value) writeTabRole(role);
      return Promise.resolve(value);
    },
    setItem(key: string, value: string): Promise<unknown> {
      if (key !== LEGACY_SESSION_KEY) return base.setItem(key, value);
      const store = local();
      if (!store) return base.setItem(key, value);
      const role = roleOfSerialized(value);
      const signedIn = Boolean(userDataOf(value));
      try {
        if (role) {
          // A signed-in session: its own slot + "last used", and this tab now uses that role.
          store.setItem(slotKey(role), value);
          store.setItem(LEGACY_SESSION_KEY, value);
          activeSlot = role;
          writeTabRole(role);
        } else if (signedIn) {
          // A session of another kind (e.g. admin): only the shared key, as before.
          store.setItem(LEGACY_SESSION_KEY, value);
        } else if (activeSlot) {
          // Signed out in this tab: clear only this role's slot (other roles / tabs stay signed in).
          store.removeItem(slotKey(activeSlot));
          if (roleOfSerialized(store.getItem(LEGACY_SESSION_KEY)) === activeSlot) store.setItem(LEGACY_SESSION_KEY, value);
          writeTabRole(null);
          activeSlot = null;
        } else if (!userDataOf(store.getItem(LEGACY_SESSION_KEY))) {
          // Nobody signed in anywhere: same as before. (Never wipes another tab's last-used session.)
          store.setItem(LEGACY_SESSION_KEY, value);
        }
      } catch {
        return base.setItem(key, value);
      }
      return Promise.resolve();
    },
    removeItem(key: string): Promise<unknown> {
      if (key !== LEGACY_SESSION_KEY) return base.removeItem(key);
      const store = local();
      if (!store) return base.removeItem(key);
      try {
        // purge() on sign-out: this tab's role only.
        const role = activeSlot;
        if (role) {
          store.removeItem(slotKey(role));
          if (roleOfSerialized(store.getItem(LEGACY_SESSION_KEY)) === role) store.removeItem(LEGACY_SESSION_KEY);
        } else {
          store.removeItem(LEGACY_SESSION_KEY);
        }
        writeTabRole(null);
        activeSlot = null;
      } catch {
        return base.removeItem(key);
      }
      return Promise.resolve();
    },
  };
}
