"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import {
  filterUsStates,
  normalizeUsStateCode,
  type UsState,
} from "@/lib/data/us-states";
import { cn } from "@/lib/utils";

type UsStateSelectProps = {
  id?: string;
  value: string;
  onChange: (code: string, state?: UsState) => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
};

/**
 * Searchable U.S. state dropdown. Displays and stores 2-letter codes (CA, TX, …).
 */
export function UsStateSelect({
  id,
  value,
  onChange,
  disabled = false,
  required = false,
  placeholder = "State",
  className,
}: UsStateSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const code = normalizeUsStateCode(value);
  const options = useMemo(() => filterUsStates(query), [query]);

  useEffect(() => {
    if (!open) return;
    function onDocPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDocPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const idFrame = window.requestAnimationFrame(() => {
      searchRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(idFrame);
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative z-[40] w-full", className)}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-required={required || undefined}
        onClick={() => {
          if (disabled) return;
          setOpen((current) => !current);
          setQuery("");
        }}
        className={cn(
          "flex h-10 w-full min-w-0 items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-left text-sm transition-colors outline-none select-none",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
          !code && "text-muted-foreground",
        )}
      >
        <span className="line-clamp-1 flex-1 font-medium tracking-wide">
          {code || placeholder}
        </span>
        <ChevronDownIcon
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          id={listId}
          role="listbox"
          aria-labelledby={id}
          className="absolute z-[50] mt-1 w-full overflow-hidden rounded-lg border border-input bg-popover text-popover-foreground shadow-md"
        >
          <div className="border-b border-input p-2">
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search states…"
              className="h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
              autoComplete="off"
            />
          </div>
          <div className="max-h-56 overflow-y-auto overscroll-contain">
            {!required ? (
              <button
                type="button"
                role="option"
                aria-selected={!code}
                className={cn(
                  "flex w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted/60",
                  !code && "bg-muted/40",
                )}
                onClick={() => {
                  onChange("");
                  setOpen(false);
                  setQuery("");
                }}
              >
                {placeholder}
              </button>
            ) : null}

            {options.map((state) => {
              const active = state.code === code;
              return (
                <button
                  key={state.code}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60",
                    active && "bg-muted font-medium",
                  )}
                  onClick={() => {
                    onChange(state.code, state);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <span className="font-medium tracking-wide">{state.code}</span>
                  <span className="truncate text-muted-foreground">
                    {state.name}
                  </span>
                </button>
              );
            })}

            {!options.length ? (
              <div className="px-3 py-3 text-sm text-muted-foreground">
                No states match.
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
