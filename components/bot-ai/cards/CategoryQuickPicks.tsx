"use client";

import { useEffect, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchParentCategories, selectParentCategories } from "@/store/categoriesSlice";
import { WELCOME_SERVICES } from "../systemPromptGuide";

/**
 * Main services from the live Admin catalog as tap-to-pick pills, pinned under the
 * step header so a customer can choose a category before (or while) typing. Each
 * pill is sent as a plain message; the backend matches it to the catalog by name.
 */
export function CategoryQuickPicks({ onPick, disabled }: { onPick: (name: string) => void; disabled?: boolean }) {
  const dispatch = useAppDispatch();
  const parents = useAppSelector(selectParentCategories);

  useEffect(() => {
    void dispatch(fetchParentCategories());
  }, [dispatch]);

  const names = useMemo(() => {
    const live = parents
      .filter((item) => String(item.status || "active").toLowerCase() !== "inactive")
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((item) => item.name.trim())
      .filter(Boolean);
    // Static names only until the catalog loads (or if it can't).
    return live.length ? [...new Set(live)] : [...WELCOME_SERVICES];
  }, [parents]);

  return (
    <div className="mt-2" role="group" aria-label="Pick a service">
      <p className="mb-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        Pick a service
      </p>
      {/* One scrollable row keeps the sticky header short on phones. */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
        {names.map((name) => (
          <button
            key={name}
            type="button"
            disabled={disabled}
            onClick={() => onPick(name)}
            className="shrink-0 rounded-full border border-primary/25 bg-primary/5 px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap text-primary transition hover:-translate-y-px hover:border-primary/50 hover:bg-primary/10 active:translate-y-0 disabled:pointer-events-none disabled:opacity-50"
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}
