"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Provider, useSelector } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { getPersistor, getStore, switchSession, type AppStore, type RootState } from "./index";
import { hydrateAuth, markSessionScope } from "./authSlice";
import { clearSessionCaches } from "@/components/api/apiFuntions";
import {
  getActiveSlot,
  readSlot,
  SCOPED_SESSIONS_ENABLED,
  scopeForPath,
  scopeKey,
  setActiveSlot,
  userDataOf,
} from "@/lib/session-scope";

const useAppSelector = <T,>(selector: (state: RootState) => T) => useSelector(selector);

function clearLegacyAuthKeys() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem("rs-auth-session");
    window.localStorage.removeItem("rs-redux-auth");
    window.localStorage.removeItem("token-rs-user");
    window.localStorage.removeItem("userData-rs-user");
    window.localStorage.removeItem("refresh-token-rs-user");
  } catch {
    // ignore
  }
}

/**
 * Portals + private links stay behind PersistGate: they fire authed API calls on mount.
 * Public pages render through it so the server HTML (hero, copy, links) is real content —
 * with `loading={null}` the SSR body was empty and LCP waited on JS + rehydrate.
 * Auth-aware UI on public pages already waits for `auth.hydrated` (set in onBeforeLift).
 */
const GATED_PREFIXES = ["/account", "/pro/dashboard", "/contractor", "/technical", "/e"];
const ESTIMATE_TOKEN_PATH = /^\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/?$/i;

function needsPersistGate(pathname: string) {
  return (
    ESTIMATE_TOKEN_PATH.test(pathname) ||
    GATED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  );
}

/**
 * Per-role sessions (lib/session-scope.ts): when this tab moves (client-side) into a portal of another
 * role — e.g. from /pro/dashboard to /technical — use that role's saved session, or none (that portal's
 * gate then shows its own login). The session of the portal left behind stays saved for other tabs.
 */
function SessionScopeSync({ store, pathname }: { store: AppStore; pathname: string }) {
  const hydrated = useAppSelector((state) => state.auth.hydrated);
  useEffect(() => {
    if (!SCOPED_SESSIONS_ENABLED || !hydrated) return;
    const scope = scopeForPath(pathname);
    if (scope && scope !== getActiveSlot()) {
      const next = userDataOf(readSlot(scope));
      setActiveSlot(scope);
      if (next !== store.getState().auth.userData) {
        clearSessionCaches();
        store.dispatch(switchSession(next));
      }
    }
    // Recorded after the swap: gates waiting for it (useSessionSwitchPending) carry on from here.
    const key = scopeKey(pathname);
    if (store.getState().auth.sessionScope !== key) store.dispatch(markSessionScope(key));
  }, [pathname, store, hydrated]);
  return null;
}

export function ReduxProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const storeRef = useRef<AppStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = getStore();
  }

  const store = storeRef.current;
  const persistor = getPersistor();

  return (
    <Provider store={store}>
      <SessionScopeSync store={store} pathname={pathname} />
      <PersistGate
        // Same element as `children`, so lifting the gate re-renders in place (no remount).
        loading={needsPersistGate(pathname) ? null : children}
        persistor={persistor}
        onBeforeLift={() => {
          clearLegacyAuthKeys();
          store.dispatch(hydrateAuth());
        }}
      >
        {children}
      </PersistGate>
    </Provider>
  );
}
