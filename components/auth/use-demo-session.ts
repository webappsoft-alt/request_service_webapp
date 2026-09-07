"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEMO_SESSION_EVENT,
  clearDemoSession,
  readDemoSession,
  writeDemoSession,
  type DemoSession,
} from "@/lib/auth/demo-session";

export function useDemoSession() {
  const [session, setSession] = useState<DemoSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    function sync() {
      setSession(readDemoSession());
    }

    sync();
    setReady(true);
    window.addEventListener(DEMO_SESSION_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(DEMO_SESSION_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const signIn = useCallback((next: DemoSession) => {
    writeDemoSession(next);
    setSession(next);
  }, []);

  const signOut = useCallback(() => {
    clearDemoSession();
    setSession(null);
  }, []);

  return { session, ready, signIn, signOut };
}
