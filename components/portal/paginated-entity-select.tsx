"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDownIcon, Plus } from "lucide-react";
import { SelectLoadingDots } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export type PaginatedEntityOption = {
  id: string;
  label: string;
};

type PaginatedEntitySelectProps = {
  id?: string;
  value: string;
  options: PaginatedEntityOption[];
  disabled?: boolean;
  placeholder?: string;
  /** Shown when value is set but not yet present in loaded options. */
  selectedLabel?: string;
  loading?: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  onChange: (id: string, option?: PaginatedEntityOption) => void;
  onLoadMore: () => void;
  className?: string;
  emptyLabel?: string;
  /** Show a search field when the menu is open (API-backed lists). */
  searchable?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  /**
   * When set, an Add action is shown in the menu (always at the bottom,
   * and also as the primary empty-state CTA when there are no options).
   */
  onAdd?: () => void;
  addLabel?: string;
};

function isNearBottom(el: HTMLElement, threshold = 72) {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
}

function isInsideMenu(node: EventTarget | null) {
  return (
    node instanceof Element &&
    Boolean(node.closest("[data-paginated-entity-menu]"))
  );
}

const triggerClassName = cn(
  "flex h-10 w-full min-w-0 items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-left text-sm transition-colors outline-none select-none",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

/**
 * Single-select with infinite scroll.
 * Menu is portaled to body (avoids dialog overflow clip) and marked so Dialog
 * does not treat clicks as "outside".
 *
 * Search uses a combobox pattern: the search input replaces the trigger while
 * open so it stays inside Dialog focus scope (portaled inputs cannot receive
 * keystrokes when a modal Dialog traps focus).
 */
export function PaginatedEntitySelect({
  id,
  value,
  options,
  disabled,
  placeholder = "Select…",
  selectedLabel,
  loading,
  loadingMore,
  hasMore,
  onChange,
  onLoadMore,
  className,
  emptyLabel = "No options found.",
  searchable = false,
  searchValue = "",
  onSearchChange,
  searchPlaceholder = "Search…",
  onAdd,
  addLabel = "Add",
}: PaginatedEntitySelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  const onLoadMoreRef = useRef(onLoadMore);
  const loadingMoreRef = useRef(Boolean(loadingMore));
  const hasMoreRef = useRef(Boolean(hasMore));
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const [mounted, setMounted] = useState(false);

  onChangeRef.current = onChange;
  onLoadMoreRef.current = onLoadMore;
  loadingMoreRef.current = Boolean(loadingMore);
  hasMoreRef.current = Boolean(hasMore);

  useEffect(() => {
    setMounted(true);
  }, []);

  const busy = Boolean(loading || loadingMore);
  const selected = options.find((item) => item.id === value);
  const label = selected
    ? selected.label
    : value && selectedLabel
      ? selectedLabel
      : placeholder;
  const showSearch = Boolean(open && searchable);

  function tryLoadMore() {
    if (!hasMoreRef.current || loadingMoreRef.current) return;
    onLoadMoreRef.current();
  }

  function closeMenu() {
    setOpen(false);
  }

  function selectOption(option: PaginatedEntityOption) {
    onChangeRef.current(option.id, option);
    closeMenu();
  }

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
    if (!open) return;
    updateMenuPosition();
  }, [open, options.length, searchable]);

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
  }, [open, searchable]);

  useEffect(() => {
    if (!open) return;
    function onDocPointer(event: MouseEvent) {
      if (isInsideMenu(event.target)) return;
      if (rootRef.current?.contains(event.target as Node)) return;
      closeMenu();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu();
    }
    // Bubble phase so option handlers run first.
    document.addEventListener("mousedown", onDocPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !searchable) return;
    const frame = window.requestAnimationFrame(() => {
      searchRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, searchable]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => {
      if (isNearBottom(el)) tryLoadMore();
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [open, options.length]);

  useEffect(() => {
    if (!open || loadingMore || !hasMore) return;
    const el = listRef.current;
    if (!el) return;
    const frame = window.requestAnimationFrame(() => {
      if (isNearBottom(el)) tryLoadMore();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, loadingMore, hasMore, options.length]);

  useEffect(() => {
    if (!open || !hasMore) return;
    const root = listRef.current;
    if (!root) return;
    const lastOption = root.querySelector<HTMLElement>(
      "[data-paginated-option]:last-of-type",
    );
    if (!lastOption) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) tryLoadMore();
      },
      { root, rootMargin: "0px 0px 48px 0px", threshold: 0 },
    );
    observer.observe(lastOption);
    return () => observer.disconnect();
  }, [open, options.length, hasMore, loadingMore]);

  const menu = open ? (
    <div
      id={listId}
      role="listbox"
      aria-labelledby={id}
      style={menuStyle}
      data-paginated-entity-menu=""
      data-lenis-prevent=""
      className="flex flex-col overflow-hidden rounded-lg border border-input bg-popover text-popover-foreground shadow-md"
      onWheel={(event) => {
        event.stopPropagation();
      }}
    >
      <div
        ref={listRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        {loading && options.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center gap-2 px-4 py-6 text-center">
            <Spinner size="sm" label="Loading" />
            <p className="text-xs text-muted-foreground">Loading…</p>
          </div>
        ) : null}

        {!loading && !loadingMore && options.length === 0 ? (
          <div className="flex min-h-32 flex-col items-center justify-center gap-3 px-4 py-6 text-center">
            <div>
              <p className="text-sm font-medium text-foreground">No results</p>
              <p className="mx-auto mt-1 max-w-[14rem] text-xs text-muted-foreground">
                {emptyLabel}
              </p>
            </div>
            {onAdd ? (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-primary/25 bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10"
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  closeMenu();
                  onAdd();
                }}
              >
                <Plus className="size-3.5" aria-hidden />
                {addLabel}
              </button>
            ) : null}
          </div>
        ) : null}

        {options.map((option) => {
          const active = option.id === value;
          return (
            <div
              key={option.id || "__empty__"}
              role="option"
              tabIndex={-1}
              data-paginated-option=""
              aria-selected={active}
              className={cn(
                "flex w-full cursor-pointer px-3 py-2 text-left text-sm hover:bg-muted/60",
                active && "bg-muted font-medium",
              )}
              onMouseDown={(event) => {
                // mousedown (not click): Dialog may swallow click on portaled nodes.
                event.preventDefault();
                event.stopPropagation();
                selectOption(option);
              }}
            >
              {option.label}
            </div>
          );
        })}

        {loadingMore ? (
          <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
            <SelectLoadingDots />
            <span>Loading more…</span>
          </div>
        ) : null}

        {!loadingMore && hasMore ? (
          <div aria-hidden className="h-1 w-full" data-paginated-sentinel="" />
        ) : null}
      </div>
      {onAdd && options.length > 0 ? (
        <div className="shrink-0 border-t border-border bg-muted/30 p-1.5">
          <button
            type="button"
            className="flex w-full items-center gap-1.5 rounded-md px-2.5 py-2 text-left text-sm font-medium text-primary hover:bg-primary/5"
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              closeMenu();
              onAdd();
            }}
          >
            <Plus className="size-3.5 shrink-0" aria-hidden />
            {addLabel}
          </button>
        </div>
      ) : null}
    </div>
  ) : null;

  return (
    <div ref={rootRef} className={cn("relative w-full", className)}>
      {showSearch ? (
        <div className="relative w-full">
          <input
            ref={searchRef}
            id={id}
            type="search"
            value={searchValue}
            disabled={disabled}
            placeholder={searchPlaceholder}
            autoComplete="off"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-busy={busy || undefined}
            className={cn(
              triggerClassName,
              "pr-9 select-text",
            )}
            onChange={(event) => onSearchChange?.(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                closeMenu();
              }
            }}
          />
          <ChevronDownIcon
            className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 rotate-180 text-muted-foreground"
            aria-hidden
          />
        </div>
      ) : (
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-busy={busy || undefined}
          data-loading={busy ? "" : undefined}
          onClick={() => {
            if (disabled) return;
            setOpen((current) => !current);
          }}
          className={cn(
            triggerClassName,
            !selected && !selectedLabel && "text-muted-foreground",
          )}
        >
          <span className="line-clamp-1 min-w-0 flex-1">{label}</span>
          <span className="flex shrink-0 items-center gap-1.5">
            {busy ? (
              <>
                <SelectLoadingDots />
                <span aria-hidden className="h-4 w-px shrink-0 bg-border" />
              </>
            ) : null}
            <ChevronDownIcon
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform",
                open && "rotate-180",
              )}
              aria-hidden
            />
          </span>
        </button>
      )}

      {mounted && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
