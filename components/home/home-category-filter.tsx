"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type HomeSelectedCategory = {
  id: string;
  slug: string;
  name: string;
} | null;

type HomeCategoryFilterValue = {
  selected: HomeSelectedCategory;
  setSelected: (value: HomeSelectedCategory) => void;
  /** @deprecated Prefer `selected?.slug` — kept for call sites that only need the slug. */
  selectedSlug: string | null;
  setSelectedSlug: (slug: string | null) => void;
  dockPinned: boolean;
  pinDock: () => void;
  unpinDock: () => void;
};

const HomeCategoryFilterContext = createContext<HomeCategoryFilterValue | null>(null);

export function HomeCategoryFilterProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<HomeSelectedCategory>(null);
  const [dockPinned, setDockPinned] = useState(false);
  const pinDock = useCallback(() => setDockPinned(true), []);
  const unpinDock = useCallback(() => setDockPinned(false), []);

  const setSelectedSlug = useCallback((slug: string | null) => {
    if (!slug) {
      setSelected(null);
      return;
    }
    setSelected((current) =>
      current?.slug === slug ? current : { id: "", slug, name: slug },
    );
  }, []);

  const value = useMemo(
    () => ({
      selected,
      setSelected,
      selectedSlug: selected?.slug ?? null,
      setSelectedSlug,
      dockPinned,
      pinDock,
      unpinDock,
    }),
    [selected, dockPinned, pinDock, unpinDock, setSelectedSlug],
  );

  return (
    <HomeCategoryFilterContext.Provider value={value}>{children}</HomeCategoryFilterContext.Provider>
  );
}

export function useHomeCategoryFilter() {
  const context = useContext(HomeCategoryFilterContext);
  if (!context) {
    throw new Error("useHomeCategoryFilter must be used within HomeCategoryFilterProvider");
  }
  return context;
}
