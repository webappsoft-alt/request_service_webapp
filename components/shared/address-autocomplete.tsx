"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  searchMapboxAddresses,
  type MapboxAddress,
  type MapboxSuggestion,
} from "@/lib/mapbox-geocoding";
import { cn } from "@/lib/utils";

export type { MapboxAddress };

type AddressAutocompleteProps = {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  onSelect: (address: MapboxAddress) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  "aria-invalid"?: boolean;
};

export function AddressAutocomplete({
  id,
  name,
  value,
  onChange,
  onSelect,
  placeholder = "Search city or full address worldwide…",
  autoComplete = "street-address",
  required,
  disabled,
  className,
  inputClassName,
  "aria-invalid": ariaInvalid,
}: AddressAutocompleteProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<MapboxSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const skipSearchRef = useRef(false);

  useEffect(() => {
    if (skipSearchRef.current) {
      skipSearchRef.current = false;
      return;
    }

    const query = value.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setLoading(false);
      setError(null);
      return;
    }

    if (!process.env.NEXT_PUBLIC_MAPBOX_PLACES_API_KEY?.trim()) {
      setError("Address search is unavailable. Enter your address manually.");
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const results = await searchMapboxAddresses(query, controller.signal);
        if (controller.signal.aborted) return;
        setSuggestions(results);
        setOpen(true);
        setActiveIndex(-1);
      } catch (err) {
        if (controller.signal.aborted) return;
        setSuggestions([]);
        setError(
          err instanceof Error
            ? err.message
            : "Could not load address suggestions.",
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 280);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [value]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function choose(suggestion: MapboxSuggestion) {
    skipSearchRef.current = true;
    onChange(suggestion.formattedAddress || suggestion.streetAddress);
    onSelect(suggestion);
    setSuggestions([]);
    setOpen(false);
    setActiveIndex(-1);
    setError(
      suggestion.zipCode
        ? null
        : "No postal code found for this place — please enter it manually if needed.",
    );
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      choose(suggestions[activeIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div className="relative">
        <MapPin
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          id={id}
          name={name}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          disabled={disabled}
          aria-invalid={ariaInvalid || undefined}
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open && suggestions.length > 0}
          role="combobox"
          className={cn("pr-9 pl-8", inputClassName)}
        />
        {loading ? (
          <Loader2
            className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
        ) : null}
      </div>

      {open && suggestions.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-[calc(100%+0.35rem)] right-0 left-0 z-50 max-h-64 overflow-y-auto rounded-lg border border-border bg-card py-1 shadow-lg"
        >
          {suggestions.map((suggestion, index) => (
            <li key={suggestion.id} role="option" aria-selected={index === activeIndex}>
              <button
                type="button"
                className={cn(
                  "flex w-full flex-col gap-0.5 px-3 py-2.5 text-left text-sm transition-colors",
                  index === activeIndex
                    ? "bg-primary/10 text-foreground"
                    : "hover:bg-muted/70",
                )}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(suggestion)}
              >
                <span className="font-medium">{suggestion.formattedAddress}</span>
                <span className="text-xs text-muted-foreground">
                  {[suggestion.city, suggestion.state, suggestion.zipCode, suggestion.country]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p className="mt-1.5 text-xs text-muted-foreground" role="status">
          {error}
        </p>
      ) : null}
    </div>
  );
}
