"use client";

import { useState } from "react";
import { MapPin, X } from "lucide-react";
import { GoogleAddressAutocomplete } from "@/components/shared/google-address-autocomplete";
import { useBot } from "../BotProvider";

/**
 * In-chat address picker ("Change Address"). Uses the site's Google autocomplete and
 * Redux location, so the hero search and /services follow the new address too.
 */
export function AddressEditor() {
  const { closeAddressEditor, applyAddress } = useBot();
  const [draft, setDraft] = useState("");

  return (
    <div className="mt-2 rounded-xl border border-primary/30 bg-card p-2.5 shadow-sm">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold">
          <MapPin className="size-3.5 text-primary" aria-hidden />
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
