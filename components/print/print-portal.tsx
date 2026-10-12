"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const ROOT_ID = "rs-print-root";
const PRINTING_CLASS = "rs-printing";

/** Resolves once every image inside `root` has loaded (or failed), capped at `timeoutMs`. */
function imagesReady(root: HTMLElement, timeoutMs = 2500) {
  const pending = [...root.querySelectorAll("img")].filter((img) => !img.complete);
  if (!pending.length) return Promise.resolve();
  return Promise.race([
    Promise.all(
      pending.map(
        (img) =>
          new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          }),
      ),
    ),
    new Promise<void>((resolve) => window.setTimeout(resolve, timeoutMs)),
  ]);
}

/**
 * Prints `children` in place — no new tab, no navigation. The content is portaled into a
 * print-only layer on <body>; while it is mounted, the rest of the page is hidden from print
 * (see `.rs-printing` in globals.css). The native print dialog opens as soon as it renders,
 * and `onDone` fires when the dialog closes.
 */
export function PrintPortal({ children, onDone }: { children: ReactNode; onDone: () => void }) {
  // Only ever mounted from a click handler, so `document` exists.
  const [root] = useState(() => {
    const element = document.createElement("div");
    element.id = ROOT_ID;
    return element;
  });
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    document.body.appendChild(root);
    document.documentElement.classList.add(PRINTING_CLASS);
    return () => {
      document.documentElement.classList.remove(PRINTING_CLASS);
      root.remove();
    };
  }, [root]);

  useEffect(() => {
    let finished = false;
    let cancelled = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      onDoneRef.current();
    };
    window.addEventListener("afterprint", finish);

    void (async () => {
      // Let React paint the document, then wait for logos / photos / signatures.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await imagesReady(root);
      if (cancelled) return;
      window.print();
      // Fallback if a browser never fires `afterprint`: clean up on the next click.
      window.addEventListener("pointerdown", finish, { once: true });
    })();

    return () => {
      cancelled = true;
      window.removeEventListener("afterprint", finish);
      window.removeEventListener("pointerdown", finish);
    };
  }, [root]);

  return createPortal(children, root);
}
