"use client";

import { useRef, type ReactNode } from "react";
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

export function ReduxProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<AppStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = getStore();
  }

  const store = storeRef.current;
  const persistor = getPersistor();

  return (
    <Provider store={store}>
      <PersistGate
        loading={null}
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
