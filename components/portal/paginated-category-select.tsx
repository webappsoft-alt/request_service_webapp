"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { toTitleCase } from "@/lib/format";

export type CategoryOption = {
  id: string;
  name: string;
};

type PaginatedCategorySelectProps = {
  id?: string;
  value: string;
  options: CategoryOption[];
  disabled?: boolean;
  placeholder?: string;
  loading?: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  onChange: (id: string, option?: CategoryOption) => void;
  onLoadMore: () => void;
  className?: string;
};

function isNearBottom(el: HTMLElement, threshold = 72) {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
}

/**
 * Category / sub-category dropdown with infinite scroll.
 * Calls onLoadMore when the user reaches the bottom; keeps calling while
 * still at the bottom after each page until hasMore is false.
 */
export function PaginatedCategorySelect({
  id,
  value,
  options,
  disabled,
  placeholder = "Select category",
  loading,
  loadingMore,
  hasMore,
  onChange,
  onLoadMore,
  className,
}: PaginatedCategorySelectProps) {
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

  const selected = options.find((item) => item.id === value);
  const label = selected
    ? toTitleCase(selected.name)
    : loading && !options.length
      ? "Loading…"
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

  // Native scroll listener (more reliable than React onScroll for nested buttons).
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

  // After each page finishes (or list grows), if still at bottom keep loading.
  useEffect(() => {
    if (!open || loadingMore || !hasMore) return;
    const el = listRef.current;
    if (!el) return;

    const id = window.requestAnimationFrame(() => {
      if (isNearBottom(el)) tryLoadMore();
    });
    return () => window.cancelAnimationFrame(id);
  }, [open, loadingMore, hasMore, options.length]);

  // Observe the last real option — when it enters view, fetch next page.
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
        onClick={() => {
          if (disabled) return;
          setOpen((current) => !current);
        }}
        className={cn(
          "flex h-10 w-full min-w-0 items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-left text-sm transition-colors outline-none select-none",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
          !selected && "text-muted-foreground",
        )}
      >
        <span className="line-clamp-1 flex-1">{label}</span>
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
          ref={listRef}
          className="absolute z-[1300] mt-1 max-h-60 w-full overflow-y-auto overscroll-contain rounded-lg border border-input bg-popover text-popover-foreground shadow-md"
        >
          <button
            type="button"
            role="option"
            aria-selected={!value}
            className={cn(
              "flex w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted/60",
              !value && "bg-muted/40",
            )}
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
          >
            {placeholder}
          </button>

          {options.map((option) => {
            const active = option.id === value;
            return (
              <button
                key={option.id}
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
                {toTitleCase(option.name)}
              </button>
            );
          })}

          {loadingMore ? (
            <div className="flex items-center justify-center py-2">
              <Spinner size="sm" label="Loading more" />
            </div>
          ) : null}

          {!loading && !options.length ? (
            <div className="px-3 py-3 text-sm text-muted-foreground">
              No options found.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
