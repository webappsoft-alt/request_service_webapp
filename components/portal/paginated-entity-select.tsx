"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDownIcon } from "lucide-react";
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
};

function isNearBottom(el: HTMLElement, threshold = 72) {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
}

/**
 * Single-select dropdown with infinite scroll (same pattern as category select).
 * Appends pages via onLoadMore; does not replace existing options.
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
}: PaginatedEntitySelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  const loadingMoreRef = useRef(Boolean(loadingMore));
  const hasMoreRef = useRef(Boolean(hasMore));
  const [open, setOpen] = useState(false);

  onLoadMoreRef.current = onLoadMore;
  loadingMoreRef.current = Boolean(loadingMore);
  hasMoreRef.current = Boolean(hasMore);

  const busy = Boolean(loading || loadingMore);
  const selected = options.find((item) => item.id === value);
  const label = selected
    ? selected.label
    : value && selectedLabel
      ? selectedLabel
      : placeholder;

  function tryLoadMore() {
    if (!hasMoreRef.current || loadingMoreRef.current) return;
    onLoadMoreRef.current();
  }

  useEffect(() => {
    if (!open) return;
    function onDocPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
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
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => {
      if (isNearBottom(el)) tryLoadMore();
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [open, options.length]);

  // Short lists that don't scroll still need a first "load more" when hasMore.
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

  return (
    <div ref={rootRef} className={cn("relative z-[1200] w-full", className)}>
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
          "flex h-10 w-full min-w-0 items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-left text-sm transition-colors outline-none select-none",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
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

      {open ? (
        <div
          id={listId}
          role="listbox"
          aria-labelledby={id}
          ref={listRef}
          className="absolute z-[1300] mt-1 max-h-48 w-full overflow-y-auto overscroll-contain rounded-lg border border-input bg-popover text-popover-foreground shadow-md"
        >
          {loading && options.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center gap-2 px-4 py-6 text-center">
              <Spinner size="sm" label="Loading" />
              <p className="text-xs text-muted-foreground">Loading…</p>
            </div>
          ) : null}

          {!loading && !loadingMore && options.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center gap-1 px-4 py-6 text-center">
              <p className="text-sm font-medium text-foreground">No results</p>
              <p className="max-w-[14rem] text-xs text-muted-foreground">
                {emptyLabel}
              </p>
            </div>
          ) : null}

          {options.map((option) => {
            const active = option.id === value;
            return (
              <button
                key={option.id || "__empty__"}
                type="button"
                role="option"
                data-paginated-option=""
                aria-selected={active}
                className={cn(
                  "flex w-full px-3 py-2 text-left text-sm hover:bg-muted/60",
                  active && "bg-muted font-medium",
                )}
                onClick={() => {
                  onChange(option.id, option);
                  setOpen(false);
                }}
              >
                {option.label}
              </button>
            );
          })}

          {loadingMore ? (
            <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
              <SelectLoadingDots />
              <span>Loading more…</span>
            </div>
          ) : null}

          {!loadingMore && hasMore ? (
            <div
              aria-hidden
              className="h-1 w-full"
              data-paginated-sentinel=""
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
