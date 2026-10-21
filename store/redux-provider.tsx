"use client";

import { useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { getPersistor, getStore, type AppStore } from "./index";
import { hydrateAuth } from "./authSlice";

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
