"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDownIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type SearchableSelectOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

type CommonProps = {
  id?: string;
  options: SearchableSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  emptyMessage?: string;
  /** Render at most this many matches (large lists, e.g. every city in a state). */
  maxResults?: number;
  /**
   * Server-side search: called as the user types (and with "" on close).
   * Options are then shown as given — no client-side filtering.
   */
  onSearchChange?: (query: string) => void;
  /** Shown instead of the empty message while server results load. */
  loading?: boolean;
};

export type SearchableSelectProps = CommonProps & {
  value: string | null;
  onChange: (value: string | null) => void;
};

export type SearchableMultiSelectProps = CommonProps & {
  value: string[];
  onChange: (value: string[]) => void;
};

const triggerClassName = cn(
  "flex h-10 w-full min-w-0 items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-left text-sm transition-colors outline-none select-none",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function filterOptions(options: SearchableSelectOption[], query: string) {
  const q = normalize(query);
  if (!q) return options;
  return options.filter((option) =>
    normalize(
      `${option.label} ${option.description ?? ""} ${option.value}`,
    ).includes(q),
  );
}

function isInsideSearchableMenu(node: EventTarget | null) {
  return (
    node instanceof Element &&
    Boolean(node.closest("[data-searchable-select-menu]"))
  );
}

function useFixedMenuStyle(
  open: boolean,
  rootRef: React.RefObject<HTMLDivElement | null>,
  deps: unknown[] = [],
) {
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);

  function updateMenuPosition() {
    const trigger = rootRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const maxH = 240;
    const gap = 4;
    const spaceBelow = window.innerHeight - rect.bottom - gap - 8;
    const spaceAbove = rect.top - gap - 8;
    const openUp = spaceBelow < Math.min(maxH, 140) && spaceAbove > spaceBelow;
    const maxHeight = Math.max(
      96,
      Math.min(maxH, openUp ? spaceAbove : spaceBelow),
    );

    setMenuStyle({
      position: "fixed",
      left: rect.left,
      width: Math.max(rect.width, 160),
      zIndex: 200000,
      maxHeight,
      pointerEvents: "auto",
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + gap, top: "auto" }
        : { top: rect.bottom + gap, bottom: "auto" }),
    });
  }

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return;
    }
    updateMenuPosition();
    const frame = window.requestAnimationFrame(() => {
      updateMenuPosition();
      window.requestAnimationFrame(updateMenuPosition);
    });
    const t1 = window.setTimeout(updateMenuPosition, 60);
    const t2 = window.setTimeout(updateMenuPosition, 200);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps passed by caller
  }, [open, ...deps]);

  useEffect(() => {
    if (!open) return;
    function onReposition() {
      updateMenuPosition();
    }
    window.addEventListener("resize", onReposition);
    document.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      document.removeEventListener("scroll", onReposition, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return menuStyle;
}

/** Global single searchable dropdown — closed until clicked; menu portaled flush under field. */
export function SearchableSelect({
  id,
  options,
  value,
  onChange,
  placeholder = "Select…",
  disabled,
  className,
  emptyMessage = "No options found.",
  maxResults,
  onSearchChange,
  loading = false,
}: SearchableSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  // Latest server-search callback, so closing the menu does not depend on its identity.
  const searchChangeRef = useRef(onSearchChange);
  useEffect(() => {
    searchChangeRef.current = onSearchChange;
  }, [onSearchChange]);
  const [mounted, setMounted] = useState(false);
  const menuStyle = useFixedMenuStyle(open, rootRef, [options.length, query]);

  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  const matches = useMemo(
    () => (onSearchChange ? options : filterOptions(options, query)),
    [options, query, onSearchChange],
  );
  const filtered = useMemo(
    () => (maxResults ? matches.slice(0, maxResults) : matches),
    [matches, maxResults],
  );
  const hiddenCount = matches.length - filtered.length;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setHighlighted(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    function onDocPointer(event: MouseEvent) {
      if (isInsideSearchableMenu(event.target)) return;
      if (rootRef.current?.contains(event.target as Node)) return;
      closeMenu();
    }
    function onKey(event: Event) {
      if ((event as globalThis.KeyboardEvent).key === "Escape") closeMenu();
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
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  function closeMenu() {
    setOpen(false);
    setQuery("");
    searchChangeRef.current?.("");
  }

  function changeQuery(next: string) {
    setQuery(next);
    onSearchChange?.(next);
  }

  /**
   * Opens only from a press on the field itself (or the keyboard) — a click on
   * its <label> is a plain click event and is ignored.
   */
  function onTriggerPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    openMenu();
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
      event.preventDefault();
      openMenu();
    }
  }

  /** Clicking the open field again closes it (unless the user is mid-search). */
  function onOpenFieldPointerDown(event: PointerEvent<HTMLElement>) {
    if (event.button !== 0 || query) return;
    event.preventDefault();
    closeMenu();
  }

  function openMenu() {
    if (disabled) return;
    setOpen(true);
  }

  function pick(next: string) {
    onChange(next);
    closeMenu();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = filtered[highlighted];
      if (option && !option.disabled) pick(option.value);
    } else if (event.key === "Escape") {
      event.stopPropagation();
      closeMenu();
    }
  }

  const menu =
    open && menuStyle ? (
      <div
        id={listId}
        role="listbox"
        data-searchable-select-menu=""
        data-lenis-prevent=""
        style={menuStyle}
        className="overflow-y-auto overscroll-contain rounded-lg border border-input bg-popover text-popover-foreground shadow-md"
        onWheel={(event) => event.stopPropagation()}
      >
        {hiddenCount > 0 ? (
          <div className="border-b border-input px-3 py-1.5 text-xs text-muted-foreground">
            Showing {filtered.length} of {matches.length} — type to narrow the list.
          </div>
        ) : null}
        {filtered.length === 0 ? (
          <div className="px-3 py-2.5 text-sm text-muted-foreground">
            {loading ? "Searching…" : emptyMessage}
          </div>
        ) : (
          filtered.map((option, index) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                disabled={option.disabled}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60 disabled:opacity-50",
                  (active || index === highlighted) && "bg-muted",
                )}
                onMouseEnter={() => setHighlighted(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (!option.disabled) pick(option.value);
                }}
              >
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {active ? <Check className="size-4 shrink-0" /> : null}
              </button>
            );
          })
        )}
      </div>
    ) : null;

  return (
    <div ref={rootRef} className={cn("relative w-full", className)}>
      {open ? (
        <div className="relative w-full">
          <input
            ref={inputRef}
            id={id}
            type="search"
            value={query}
            disabled={disabled}
            placeholder={placeholder}
            autoComplete="off"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={listId}
            className={cn(triggerClassName, "pr-9 select-text")}
            onChange={(event) => changeQuery(event.target.value)}
            onPointerDown={onOpenFieldPointerDown}
            onKeyDown={onKeyDown}
          />
          <button
            type="button"
            tabIndex={-1}
            aria-label="Close"
            className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onPointerDown={(event) => {
              event.preventDefault();
              closeMenu();
            }}
          >
            <ChevronDownIcon className="size-4 rotate-180" aria-hidden />
          </button>
        </div>
      ) : (
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={false}
          onPointerDown={onTriggerPointerDown}
          onKeyDown={onTriggerKeyDown}
          className={cn(
            triggerClassName,
            !selected && "text-muted-foreground",
          )}
        >
          <span className="line-clamp-1 min-w-0 flex-1">
            {selected?.label || placeholder}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {value ? (
              <span
                role="button"
                tabIndex={-1}
                aria-label="Clear"
                className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onChange(null);
                }}
              >
                <X className="size-3.5" />
              </span>
            ) : null}
            <ChevronDownIcon className="size-4 text-muted-foreground" aria-hidden />
          </span>
        </button>
      )}

      {mounted && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}

/** Global multi searchable dropdown — closed until clicked; menu portaled flush under field. */
export function SearchableMultiSelect({
  id,
  options,
  value,
  onChange,
  placeholder = "Select…",
  disabled,
  className,
  emptyMessage = "No options found.",
  maxResults,
  onSearchChange,
  loading = false,
}: SearchableMultiSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  // Latest server-search callback, so closing the menu does not depend on its identity.
  const searchChangeRef = useRef(onSearchChange);
  useEffect(() => {
    searchChangeRef.current = onSearchChange;
  }, [onSearchChange]);
  const [mounted, setMounted] = useState(false);
  const menuStyle = useFixedMenuStyle(open, rootRef, [options.length, query, value.length]);

  const selected = useMemo(
    () => options.filter((option) => value.includes(option.value)),
    [options, value],
  );

  const matches = useMemo(
    () => (onSearchChange ? options : filterOptions(options, query)),
    [options, query, onSearchChange],
  );
  const filtered = useMemo(
    () => (maxResults ? matches.slice(0, maxResults) : matches),
    [matches, maxResults],
  );
  const hiddenCount = matches.length - filtered.length;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setHighlighted(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    function onDocPointer(event: MouseEvent) {
      if (isInsideSearchableMenu(event.target)) return;
      if (rootRef.current?.contains(event.target as Node)) return;
      closeMenu();
    }
    function onKey(event: Event) {
      if ((event as globalThis.KeyboardEvent).key === "Escape") closeMenu();
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
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  function closeMenu() {
    setOpen(false);
    setQuery("");
    searchChangeRef.current?.("");
  }

  function changeQuery(next: string) {
    setQuery(next);
    onSearchChange?.(next);
  }

  /**
   * Opens only from a press on the field itself (or the keyboard) — a click on
   * its <label> is a plain click event and is ignored.
   */
  function onTriggerPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    openMenu();
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
      event.preventDefault();
      openMenu();
    }
  }

  /** Clicking the open field again closes it (unless the user is mid-search). */
  function onOpenFieldPointerDown(event: PointerEvent<HTMLElement>) {
    if (event.button !== 0 || query) return;
    event.preventDefault();
    closeMenu();
  }

  function openMenu() {
    if (disabled) return;
    setOpen(true);
  }

  function toggle(optionValue: string) {
    if (value.includes(optionValue)) {
      onChange(value.filter((item) => item !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
    closeMenu();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = filtered[highlighted];
      if (option && !option.disabled) toggle(option.value);
    } else if (event.key === "Escape") {
      event.stopPropagation();
      closeMenu();
    } else if (event.key === "Backspace" && !query && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  const menu =
    open && menuStyle ? (
      <div
        id={listId}
        role="listbox"
        aria-multiselectable
        data-searchable-select-menu=""
        data-lenis-prevent=""
        style={menuStyle}
        className="overflow-y-auto overscroll-contain rounded-lg border border-input bg-popover text-popover-foreground shadow-md"
        onWheel={(event) => event.stopPropagation()}
      >
        {hiddenCount > 0 ? (
          <div className="border-b border-input px-3 py-1.5 text-xs text-muted-foreground">
            Showing {filtered.length} of {matches.length} — type to narrow the list.
          </div>
        ) : null}
        {filtered.length === 0 ? (
          <div className="px-3 py-2.5 text-sm text-muted-foreground">
            {loading ? "Searching…" : emptyMessage}
          </div>
        ) : (
          filtered.map((option, index) => {
            const active = value.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                disabled={option.disabled}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60 disabled:opacity-50",
                  (active || index === highlighted) && "bg-muted",
                )}
                onMouseEnter={() => setHighlighted(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (!option.disabled) toggle(option.value);
                }}
              >
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded border",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input",
                  )}
                >
                  {active ? <Check className="size-3" /> : null}
                </span>
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
              </button>
            );
          })
        )}
      </div>
    ) : null;

  return (
    <div ref={rootRef} className={cn("relative w-full", className)}>
      {open ? (
        <div
          className={cn(
            "flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm",
            "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
            disabled && "cursor-not-allowed opacity-50",
          )}
        >
          {selected.map((option) => (
            <span
              key={option.value}
              className="inline-flex max-w-full items-center gap-1 rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-xs"
            >
              <span className="truncate">{option.label}</span>
              <button
                type="button"
                disabled={disabled}
                aria-label={`Remove ${option.label}`}
                className="rounded-full p-0.5 hover:bg-muted"
                onClick={(event) => {
                  event.stopPropagation();
                  onChange(value.filter((item) => item !== option.value));
                }}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          <input
            id={id}
            ref={inputRef}
            type="search"
            disabled={disabled}
            value={query}
            placeholder={selected.length ? "Search…" : placeholder}
            autoComplete="off"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={listId}
            className="h-7 min-w-28 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
            onChange={(event) => changeQuery(event.target.value)}
            onPointerDown={onOpenFieldPointerDown}
            onKeyDown={onKeyDown}
          />
          <button
            type="button"
            tabIndex={-1}
            aria-label="Close"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            onPointerDown={(event) => {
              event.preventDefault();
              closeMenu();
            }}
          >
            <ChevronDownIcon className="size-4 rotate-180" aria-hidden />
          </button>
        </div>
      ) : (
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={false}
          onPointerDown={onTriggerPointerDown}
          onKeyDown={onTriggerKeyDown}
          className={cn(
            triggerClassName,
            !selected.length && "text-muted-foreground",
          )}
        >
          <span className="line-clamp-1 min-w-0 flex-1">
            {selected.length === 0
              ? placeholder
              : selected.map((option) => option.label).join(", ")}
          </span>
          <ChevronDownIcon className="size-4 text-muted-foreground" aria-hidden />
        </button>
      )}

      {mounted && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
