"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Provider } from "react-redux";
import { getStore, type AppStore } from "./index";
import { hydrateAuth } from "./authSlice";

export function ReduxProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<AppStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = getStore();
  }

  useEffect(() => {
    storeRef.current?.dispatch(hydrateAuth());
  }, []);

  return <Provider store={storeRef.current}>{children}</Provider>;
}
