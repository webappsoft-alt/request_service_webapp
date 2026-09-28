"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
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
 * Searchable U.S. state dropdown.
 * List shows full names; the closed field shows only the 2-letter code (CA, TX, …).
 * Value stored is always the 2-letter code.
 * Menu is portaled so it is not clipped by dialog/overflow containers.
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
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);

  const code = normalizeUsStateCode(value);
  const options = useMemo(() => filterUsStates(query), [query]);

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

  useEffect(() => {
    setMounted(true);
  }, []);

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
    return () => window.cancelAnimationFrame(frame);
  }, [open, options.length, query]);

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
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDocPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
      setQuery("");
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

  function closeMenu() {
    setOpen(false);
    setQuery("");
  }

  const menu =
    open && menuStyle ? (
      <div
        ref={menuRef}
        id={listId}
        role="listbox"
        aria-labelledby={id}
        data-us-state-select-menu=""
        data-searchable-select-menu=""
        style={menuStyle}
        className="flex flex-col overflow-hidden rounded-lg border border-input bg-popover text-popover-foreground shadow-md"
      >
        <div className="shrink-0 border-b border-input p-2">
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
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
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
                closeMenu();
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
                  closeMenu();
                }}
              >
                <span className="min-w-0 flex-1 truncate">{state.name}</span>
                <span className="shrink-0 text-xs tracking-wide text-muted-foreground">
                  {state.code}
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
    ) : null;

  return (
    <div ref={rootRef} className={cn("relative w-full", className)}>
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
        <span className="line-clamp-1 flex-1 tracking-wide">
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

      {mounted && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
