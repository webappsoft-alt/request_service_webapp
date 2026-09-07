"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type HomeCategoryFilterValue = {
  selectedSlug: string | null;
  setSelectedSlug: (slug: string | null) => void;
  dockPinned: boolean;
  pinDock: () => void;
  unpinDock: () => void;
};

const HomeCategoryFilterContext = createContext<HomeCategoryFilterValue | null>(null);

export function HomeCategoryFilterProvider({ children }: { children: ReactNode }) {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [dockPinned, setDockPinned] = useState(false);
  const pinDock = useCallback(() => setDockPinned(true), []);
  const unpinDock = useCallback(() => setDockPinned(false), []);
  const value = useMemo(
    () => ({ selectedSlug, setSelectedSlug, dockPinned, pinDock, unpinDock }),
    [selectedSlug, dockPinned, pinDock, unpinDock]
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
