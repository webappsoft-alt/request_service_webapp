"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, X } from "lucide-react";
import { GoogleAddressAutocomplete } from "@/components/shared/google-address-autocomplete";
import { useBot } from "../BotProvider";

/**
 * In-chat address picker (header badge / "Change Address"). Uses the site's Google
 * autocomplete and Redux location, so the hero search and /services follow the new address too.
 * Opens as a raised focus card (ring, shadow, slide-in, pin nudge) with the input focused,
 * so it reads as a new action rather than part of the context card above it.
 */
export function AddressEditor() {
  const { closeAddressEditor, applyAddress, addressDraft } = useBot();
  // Prefilled with an address typed in chat that couldn't be found on its own.
  const [draft, setDraft] = useState(addressDraft);
  const rootRef = useRef<HTMLDivElement>(null);

  // The shared autocomplete has no autoFocus prop; focus its input once on open
  // (a prefilled value makes it fetch suggestions right away).
  useEffect(() => {
    const input = rootRef.current?.querySelector<HTMLInputElement>("input");
    input?.focus();
    input?.setSelectionRange(input.value.length, input.value.length);
  }, []);

  return (
    <div
      ref={rootRef}
      // Solid, elevated card: nothing from the (blurred) chat shows through or blends with it.
      className="relative mt-2.5 rounded-xl border border-primary/40 bg-white p-3 shadow-[0_18px_40px_-16px_rgba(0,40,90,0.35)] ring-4 ring-primary/10 animate-in fade-in slide-in-from-top-2 duration-300 motion-reduce:animate-none dark:bg-card"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <span className="relative flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary">
            {/* Two soft pings + two small hops on open, then still. */}
            <span
              aria-hidden
              className="absolute inset-0 rounded-full bg-primary/25 animate-ping repeat-2 motion-reduce:hidden"
            />
            <MapPin className="relative size-3.5 animate-bounce repeat-2 motion-reduce:animate-none" aria-hidden />
          </span>
          Where&apos;s the job?
        </p>
        <button
          type="button"
          onClick={closeAddressEditor}
          aria-label="Cancel address change"
          className="flex size-7 items-center justify-center rounded-full text-foreground/70 transition hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
      <GoogleAddressAutocomplete
        id="bot-address"
        name="bot-address"
        value={draft}
        onChange={setDraft}
        onSelect={applyAddress}
        placeholder="Street address, city or ZIP Code"
        autoComplete="off"
        hideStatus
        // 16px on phones so iOS doesn't zoom in on focus.
        inputClassName="h-10 border-foreground/25 bg-white text-base shadow-sm focus-visible:border-primary sm:text-[13px] dark:bg-background"
      />
      <p className="mt-1.5 text-[10px] text-muted-foreground">
        Pick a suggestion — I&apos;ll check which pros serve that address.
      </p>
    </div>
  );
}
