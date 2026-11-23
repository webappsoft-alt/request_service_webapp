import type { RoomType } from "@/lib/api/ai-redesigner-client";

/** Section the designer sits in on the Kitchen & Bath Design page. */
export const DESIGNER_ANCHOR = "demo";

/** Fired by the styles showcase; the designer picks that room + style. */
export const PICK_STYLE_EVENT = "rs-ai-designer:pick-style";
export type PickStyleDetail = { roomType: RoomType; styleId: string };

/** Smooth-scroll to the designer (and put #demo in the URL without a jump). */
export function scrollToDesigner() {
  const el = document.getElementById(DESIGNER_ANCHOR);
  if (!el) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  try {
    history.replaceState(null, "", `#${DESIGNER_ANCHOR}`);
  } catch {
    /* ignore */
  }
}

/** "Try this style": select it in the designer, then scroll there. */
export function tryStyleInDesigner(detail: PickStyleDetail) {
  window.dispatchEvent(new CustomEvent<PickStyleDetail>(PICK_STYLE_EVENT, { detail }));
  scrollToDesigner();
}
