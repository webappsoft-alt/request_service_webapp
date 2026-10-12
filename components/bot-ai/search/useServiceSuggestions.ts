"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getData } from "@/components/api/apiFuntions";
import type { BotSearchSuggestion } from "../types";

const DEBOUNCE_MS = 300;
export const MIN_SUGGEST_LENGTH = 3;

type SuggestResponse = {
  data?: { query: string; source: "ai" | "keywords" | "none"; suggestions: BotSearchSuggestion[] };
};

/**
 * Debounced plain-language suggestions for the hero search (GET bot-ai/suggest).
 * Only the latest query's answer is applied, so fast typing never shows stale results.
 */
export function useServiceSuggestions() {
  const [suggestions, setSuggestions] = useState<BotSearchSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [settledQuery, setSettledQuery] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef("");

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const update = useCallback((value: string) => {
    const query = value.trim();
    latestRef.current = query;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (query.length < MIN_SUGGEST_LENGTH) {
      setSuggestions([]);
      setLoading(false);
      setSettledQuery("");
      return;
    }
    setLoading(true);
    timerRef.current = setTimeout(() => {
      void getData<SuggestResponse>("bot-ai/suggest", { q: query }, { silent: true, skipLogoutOn401: true, token: null })
        .then((response) => {
          if (latestRef.current !== query) return;
          setSuggestions(response?.data?.suggestions ?? []);
        })
        .catch(() => {
          if (latestRef.current === query) setSuggestions([]);
        })
        .finally(() => {
          if (latestRef.current !== query) return;
          setLoading(false);
          setSettledQuery(query);
        });
    }, DEBOUNCE_MS);
  }, []);

  return { suggestions, loading, settledQuery, update };
}
