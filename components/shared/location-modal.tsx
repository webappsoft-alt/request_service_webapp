"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { GoogleAddressAutocomplete } from "@/components/shared/google-address-autocomplete";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PlaceAddress } from "@/lib/google-places";
import { useAppDispatch } from "@/store/hooks";
import { setLocationFromPlace } from "@/store/locationSlice";

export type LocationModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefills the search (e.g. an address typed in chat) so suggestions load immediately. */
  initialQuery?: string;
  /** Called after the pick is saved to the Redux location slice (lat/lng + formatted address). */
  onSelect?: (place: PlaceAddress) => void;
  title?: string;
  description?: string;
};

/**
 * Site location picker: Google autocomplete in a dialog, saved to the shared Redux
 * location (same as the hero search and /services). Sits above the AI assistant panel.
 * On phones it's pinned to the top so the on-screen keyboard can't cover the suggestions.
 */
export function LocationModal({
  open,
  onOpenChange,
  initialQuery = "",
  onSelect,
  title = "Where's the job?",
  description = "Pick your address from the list — we'll only show pros who serve it.",
}: LocationModalProps) {
  const dispatch = useAppDispatch();

  function handleSelect(place: PlaceAddress) {
    dispatch(setLocationFromPlace(place));
    onSelect?.(place);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="top-4 w-[calc(100%-2rem)] max-w-md translate-y-0 data-open:slide-in-from-top-4 sm:top-1/2 sm:max-w-md sm:-translate-y-1/2"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MapPin className="size-4" aria-hidden />
            </span>
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {/* Content unmounts on close, so each open starts from the latest prefill. */}
        <LocationSearch initialQuery={initialQuery} onSelect={handleSelect} />
      </DialogContent>
    </Dialog>
  );
}

function LocationSearch({
  initialQuery,
  onSelect,
}: {
  initialQuery: string;
  onSelect: (place: PlaceAddress) => void;
}) {
  const [draft, setDraft] = useState(initialQuery);
  const rootRef = useRef<HTMLDivElement>(null);

  // Focusing the prefilled input makes the autocomplete fetch suggestions right away.
  useEffect(() => {
    const timer = setTimeout(() => {
      const input = rootRef.current?.querySelector<HTMLInputElement>("input");
      input?.focus();
      input?.setSelectionRange(input.value.length, input.value.length);
    }, 60);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div ref={rootRef}>
      <GoogleAddressAutocomplete
        id="location-modal-address"
        name="location-modal-address"
        value={draft}
        onChange={setDraft}
        onSelect={onSelect}
        placeholder="Street address, city or ZIP"
        autoComplete="off"
        // 16px on phones so iOS doesn't zoom the page on focus.
        inputClassName="h-10 text-base sm:text-sm"
      />
    </div>
  );
}
