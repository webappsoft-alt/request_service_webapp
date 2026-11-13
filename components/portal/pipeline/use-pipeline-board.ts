"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { onSocketEvent } from "@/components/socket";
import type { PipelineCard, PipelineSchedule } from "@/lib/api/pipeline-client";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchPipelineBoard,
  fetchPipelineColumnPage,
  movePipelineCardThunk,
  pipelineCardSettled,
  pipelineRefetchStarted,
  pipelineRefetchWanted,
  selectPipeline,
} from "@/store/pipelineSlice";

/** Socket invalidations arrive in bursts (a conversion touches several records). */
const REFETCH_DEBOUNCE_MS = 400;
/** Coming back to the tab after this long refetches (events may have been missed). */
const STALE_AFTER_MS = 30_000;
/** A socket (re)connect this soon after a load has nothing new to fetch. */
const RECONNECT_DEDUPE_MS = 5_000;
/** Search waits for a pause in typing. */
const SEARCH_DEBOUNCE_MS = 350;

export type PipelineMoveOutcome =
  { ok: true; warning?: string | null } | { ok: false; error: string };

/**
 * Pipeline board on the `pipeline` slice: the cached board shows at once when the page opens and
 * refreshes silently; other sessions' moves apply as they happen, and the board refetches when
 * records change anywhere else (PIPELINE_INVALIDATE) — after any move / page load in flight.
 */
export function usePipelineBoard() {
  const dispatch = useAppDispatch();
  const {
    data: board,
    loading,
    error,
    fetchedAt,
    loadingMore,
    pending,
    refetchWanted,
    search,
    appliedSearch,
    quietUntil,
  } = useAppSelector(selectPipeline);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef(pending);
  const fetchedAtRef = useRef(fetchedAt);
  const quietUntilRef = useRef(quietUntil);
  useEffect(() => {
    pendingRef.current = pending;
    fetchedAtRef.current = fetchedAt;
    quietUntilRef.current = quietUntil;
  }, [pending, fetchedAt, quietUntil]);

  const reload = useCallback(() => {
    if (pendingRef.current > 0) {
      dispatch(pipelineRefetchWanted());
      return;
    }
    void dispatch(fetchPipelineBoard({ force: true }));
  }, [dispatch]);

  const scheduleLoad = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      reload();
    }, REFETCH_DEBOUNCE_MS);
  }, [reload]);

  // The refresh that waited for moves / page loads runs once they're done.
  useEffect(() => {
    if (pending === 0 && refetchWanted) {
      dispatch(pipelineRefetchStarted());
      scheduleLoad();
    }
  }, [pending, refetchWanted, dispatch, scheduleLoad]);

  useEffect(() => {
    // Cached board stays on screen; this refresh is silent.
    reload();
    const offUpdated = onSocketEvent("PIPELINE_UPDATED", (result) =>
      dispatch(pipelineCardSettled(result)),
    );
    // The echo of a record we just added from its create response is skipped (already on the board).
    const offInvalidate = onSocketEvent("PIPELINE_INVALIDATE", () => {
      if (Date.now() < quietUntilRef.current) return;
      scheduleLoad();
    });
    const onRealtime = (event: Event) => {
      if (
        (event as CustomEvent<{ type?: string }>).detail?.type ===
          "SOCKET_RECONNECTED" &&
        // The first connect right after opening the board has nothing to catch up on
        // (it used to download the board a second time).
        Date.now() - (fetchedAtRef.current ?? 0) > RECONNECT_DEDUPE_MS
      )
        scheduleLoad();
    };
    const onVisible = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - (fetchedAtRef.current ?? 0) > STALE_AFTER_MS
      )
        scheduleLoad();
    };
    window.addEventListener("rs-realtime", onRealtime);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      offUpdated();
      offInvalidate();
      window.removeEventListener("rs-realtime", onRealtime);
      document.removeEventListener("visibilitychange", onVisible);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [dispatch, reload, scheduleLoad]);

  const moveCard = useCallback(
    async (
      card: PipelineCard,
      toGroupId: string,
      index: number,
      schedule?: PipelineSchedule | null,
    ): Promise<PipelineMoveOutcome> => {
      const action = await dispatch(
        movePipelineCardThunk({ card, toGroupId, index, schedule }),
      );
      if (movePipelineCardThunk.fulfilled.match(action))
        return { ok: true, warning: action.payload.warning };
      return {
        ok: false,
        error: action.payload || "The board is still loading.",
      };
    },
    [dispatch],
  );

  /** "See more" on a column: appends its next 10 cards in place. Returns an error message, or null. */
  const loadMore = useCallback(
    async (columnId: string): Promise<string | null> => {
      const action = await dispatch(fetchPipelineColumnPage(columnId));
      return fetchPipelineColumnPage.rejected.match(action) &&
        !action.meta.condition
        ? action.payload || "Couldn't load more cards."
        : null;
    },
    [dispatch],
  );

  /** Server-side search (customer, EST-883, JOB-…, status words); typing is debounced. */
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setSearch = useCallback(
    (term: string) => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(() => {
        searchTimer.current = null;
        void dispatch(fetchPipelineBoard({ force: true, search: term }));
      }, SEARCH_DEBOUNCE_MS);
    },
    [dispatch],
  );
  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    [],
  );

  const loadingMoreSet = useMemo(() => new Set(loadingMore), [loadingMore]);

  return {
    board,
    loading,
    error,
    reload,
    moveCard,
    loadMore,
    loadingMore: loadingMoreSet,
    search,
    appliedSearch,
    setSearch,
    /** A new search is loading (the board still shows the previous results). */
    searching: search !== appliedSearch,
  };
}
