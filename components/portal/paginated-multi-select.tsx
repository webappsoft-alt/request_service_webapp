"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronDownIcon, Plus } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { toTitleCase } from "@/lib/format";

export type PaginatedOption = {
  id: string;
  name: string;
};

type PaginatedMultiSelectProps = {
  id?: string;
  values: string[];
  options: PaginatedOption[];
  disabled?: boolean;
  placeholder?: string;
  loading?: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  onChange: (ids: string[]) => void;
  onLoadMore: () => void;
  className?: string;
  emptyLabel?: string;
  emptyAction?: {
    label: string;
    href: string;
  };
};

function isNearBottom(el: HTMLElement, threshold = 72) {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
}

/**
 * Multi-select dropdown with infinite scroll (same pattern as category/sub-category).
 */
export function PaginatedMultiSelect({
  id,
  values,
  options,
  disabled,
  placeholder = "Select options",
  loading,
  loadingMore,
  hasMore,
  onChange,
  onLoadMore,
  className,
  emptyLabel = "No options found.",
  emptyAction,
}: PaginatedMultiSelectProps) {
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

  const selectedOptions = options.filter((item) => values.includes(item.id));
  const label = selectedOptions.length
    ? selectedOptions.length === 1
      ? toTitleCase(selectedOptions[0].name)
      : `${selectedOptions.length} selected`
    : loading && !options.length
      ? "Loading…"
      : placeholder;

  function tryLoadMore() {
    if (!hasMoreRef.current || loadingMoreRef.current) return;
    onLoadMoreRef.current();
  }

  function toggle(idValue: string) {
    if (values.includes(idValue)) {
      onChange(values.filter((item) => item !== idValue));
    } else {
      onChange([...values, idValue]);
    }
    setOpen(false);
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
        onClick={() => {
          if (disabled) return;
          setOpen((current) => !current);
        }}
        className={cn(
          "flex h-10 w-full min-w-0 items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-left text-sm transition-colors outline-none select-none",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
          !selectedOptions.length && "text-muted-foreground",
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
          aria-multiselectable="true"
          aria-labelledby={id}
          ref={listRef}
          className="absolute z-[1300] mt-1 max-h-60 w-full overflow-y-auto overscroll-contain rounded-lg border border-input bg-popover text-popover-foreground shadow-md"
        >
          {values.length ? (
            <button
              type="button"
              className="flex w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted/60"
              onClick={() => {
                onChange([]);
                setOpen(false);
              }}
            >
              Clear selection
            </button>
          ) : null}

          {options.map((option) => {
            const active = values.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                role="option"
                data-paginated-option=""
                aria-selected={active}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60",
                  active && "bg-muted font-medium",
                )}
                onClick={() => toggle(option.id)}
              >
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded border",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input",
                  )}
                  aria-hidden
                >
                  {active ? <Check className="size-3" /> : null}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {toTitleCase(option.name)}
                </span>
              </button>
            );
          })}

          {loadingMore ? (
            <div className="flex items-center justify-center py-2">
              <Spinner size="sm" label="Loading more" />
            </div>
          ) : null}

          {!loading && !options.length ? (
            emptyAction ? (
              <div className="p-1">
                <p className="px-2.5 py-1.5 text-xs text-muted-foreground">
                  {emptyLabel}
                </p>
                <Link
                  href={emptyAction.href}
                  onClick={() => setOpen(false)}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm font-medium text-primary hover:bg-muted/60"
                >
                  <Plus className="size-4 shrink-0" aria-hidden />
                  {emptyAction.label}
                </Link>
              </div>
            ) : (
              <div className="px-3 py-3 text-sm text-muted-foreground">
                {emptyLabel}
              </div>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
