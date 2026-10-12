/**
 * Elevated modal look shared by the sign-in and OTP verification dialogs. Both open on
 * top of the AI assistant panel (z-61), so the backdrop sits just above it and blurs it.
 */
export const elevatedModalOverlay = "z-69 bg-black/40 backdrop-blur-md supports-backdrop-filter:backdrop-blur-md";

export const elevatedModalContent =
  "z-70 rounded-2xl border border-primary/15 bg-popover shadow-2xl shadow-black/20 ring-1 ring-primary/10 dark:border-primary/25 dark:shadow-black/60 dark:ring-white/5";

/** Thin brand-colour glow along the top edge of the card. */
export const elevatedModalAccent =
  "pointer-events-none absolute inset-x-6 top-0 h-px bg-linear-to-r from-transparent via-primary/70 to-transparent";

export const elevatedModalButton =
  "transition-all duration-200 hover:-translate-y-px hover:shadow-lg hover:shadow-primary/25 active:translate-y-0 active:shadow-none";

export const elevatedModalInput =
  "h-10 rounded-lg transition-[border-color,box-shadow] duration-200 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15";
