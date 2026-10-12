"use client";

import { useEffect, useRef, useState } from "react";

const BASE_CHARS_PER_SECOND = 55;
/** Never lag the incoming stream by more than about this long. */
const MAX_LAG_SECONDS = 0.7;

/**
 * Replies that already finished their reveal in this page view. Re-mounting the chat
 * (reopen, minimise, history reload) must never replay them.
 */
const revealedIds = new Set<string>();
/** Reveal progress per reply, so closing and reopening mid-reveal resumes instead of restarting. */
const progressById = new Map<string, number>();

/**
 * Reveals the current live reply at a steady reading pace instead of in network-sized
 * bursts, speeding up when the stream gets ahead. Everything else — history, older
 * replies, anything already revealed once — renders instantly.
 *
 * @param id       Message id (stable across the streamed placeholder and the final reply).
 * @param animate  True only for the newest reply that arrived live.
 * @param final    False while chunks are still streaming in.
 */
export function useSmoothText(id: string, text: string, animate: boolean, final: boolean) {
  const active = animate && !revealedIds.has(id);
  const [shown, setShown] = useState(() => progressById.get(id) ?? 0);
  // Progress survives the effect restarting on every streamed chunk.
  const progressRef = useRef(progressById.get(id) ?? 0);

  useEffect(() => {
    if (!active) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const elapsed = Math.min(80, now - last);
      last = now;
      const remaining = text.length - progressRef.current;
      if (remaining <= 0) {
        progressRef.current = text.length;
        setShown(text.length);
        progressById.set(id, text.length);
        if (final) {
          revealedIds.add(id);
          progressById.delete(id);
        }
        return;
      }
      const rate = Math.max(BASE_CHARS_PER_SECOND, remaining / MAX_LAG_SECONDS);
      progressRef.current = Math.min(text.length, progressRef.current + Math.max(1, Math.round((rate * elapsed) / 1000)));
      setShown(progressRef.current);
      progressById.set(id, progressRef.current);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, final, id, text]);

  // A newer reply arrived (or the chat re-rendered it as history): finish instantly.
  useEffect(() => {
    if (!animate && progressRef.current > 0) {
      revealedIds.add(id);
      progressById.delete(id);
    }
  }, [animate, id]);

  if (!active) return { text, done: true };
  const visible = Math.min(shown, text.length);
  return { text: text.slice(0, visible), done: visible >= text.length };
}
