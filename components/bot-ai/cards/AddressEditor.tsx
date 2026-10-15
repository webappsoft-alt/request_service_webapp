"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, X } from "lucide-react";
import { GoogleAddressAutocomplete } from "@/components/shared/google-address-autocomplete";
import { useBot } from "../BotProvider";

/**
 * In-chat address picker ("Change Address"). Uses the site's Google autocomplete and
 * Redux location, so the hero search and /services follow the new address too.
 * Opens as a raised focus card (ring, shadow, slide-in, pin nudge) with the input focused,
 * so it reads as a new action rather than part of the context card above it.
 */
export function AddressEditor() {
  const { closeAddressEditor, applyAddress } = useBot();
  const [draft, setDraft] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  // The shared autocomplete has no autoFocus prop; focus its input once on open.
  useEffect(() => {
    rootRef.current?.querySelector<HTMLInputElement>("input")?.focus();
  }, []);

  return (
    <div
      ref={rootRef}
      className="mt-2.5 rounded-xl border border-primary/50 bg-card p-3 shadow-lg ring-4 ring-primary/10 animate-in fade-in slide-in-from-top-2 duration-300 motion-reduce:animate-none"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <span className="relative flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary">
            {/* Two soft pings + two small hops on open, then still. */}
            <span
              aria-hidden
              className="absolute inset-0 rounded-full bg-primary/25 animate-ping [animation-iteration-count:2] motion-reduce:hidden"
            />
            <MapPin
              className="relative size-3.5 animate-bounce [animation-iteration-count:2] motion-reduce:animate-none"
              aria-hidden
            />
          </span>
          Where&apos;s the job?
        </p>
        <button
          type="button"
          onClick={closeAddressEditor}
          aria-label="Cancel address change"
          className="flex size-6 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
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
        placeholder="Street address, city or ZIP"
        autoComplete="off"
        hideStatus
        inputClassName="h-9 text-[13px]"
      />
      <p className="mt-1.5 text-[10px] text-muted-foreground">
        Pick a suggestion — I&apos;ll check which pros serve that address.
      </p>
    </div>
  );
}
