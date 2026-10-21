/**
 * Runs `callback` after the window `load` event, in the browser's next idle period,
 * so non-critical setup stays off the main thread during hydration. Returns a cancel function.
 */
export function afterLoadIdle(callback: () => void, timeout = 2000): () => void {
  let cancelled = false;
  let idleHandle: number | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const schedule = () => {
    if (cancelled) return;
    if (typeof window.requestIdleCallback === "function") {
      idleHandle = window.requestIdleCallback(() => !cancelled && callback(), { timeout });
    } else {
      timer = setTimeout(() => !cancelled && callback(), 1);
    }
  };

  if (document.readyState === "complete") schedule();
  else window.addEventListener("load", schedule, { once: true });

  return () => {
    cancelled = true;
    window.removeEventListener("load", schedule);
    if (idleHandle !== undefined) window.cancelIdleCallback?.(idleHandle);
    if (timer !== undefined) clearTimeout(timer);
  };
}
