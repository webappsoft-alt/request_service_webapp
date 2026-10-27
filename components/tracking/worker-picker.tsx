"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { listWorkers, type WorkerOption, type WorkerType } from "@/lib/tracking";

const PAGE_SIZE = 20;
const SEARCH_DELAY_MS = 250;

/** "Jane Doe (plumbing)"; the type is added only in the combined list. */
function optionLabel(worker: WorkerOption, mixed: boolean) {
  const kind = worker.participantType === "contractor" ? "Subcontractor" : "Employee";
  const extra = [worker.trade, worker.active ? "" : "inactive"].filter(Boolean).join(", ");
  return `${worker.name}${mixed ? ` — ${kind}` : ""}${extra ? ` (${extra})` : ""}`;
}

/**
 * Employee / subcontractor picker: server-side search (debounced) and infinite scroll, so it
 * stays instant with any team size. Value is `{ id, participantType }`.
 */
export function WorkerPicker({
  id,
  value,
  valueLabel,
  onChange,
  type = "all",
  placeholder = "All employees & subcontractors",
  className,
}: {
  id?: string;
  value: { id: string; participantType: WorkerType } | null;
  /** Name to show for a value that isn't in the loaded page (e.g. from the URL). */
  valueLabel?: string;
  onChange: (worker: WorkerOption | null) => void;
  type?: "all" | WorkerType;
  placeholder?: string;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<WorkerOption[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<WorkerOption | null>(null);
  /** Ignore responses for an older query / page. */
  const requestRef = useRef(0);

  const load = useCallback(
    async (q: string, nextPage: number) => {
      const ticket = ++requestRef.current;
      setLoading(true);
      try {
        const result = await listWorkers({ q, type, page: nextPage, limit: PAGE_SIZE });
        if (ticket !== requestRef.current) return;
        setItems((current) => (nextPage === 1 ? result.items : [...current, ...result.items]));
        setPage(nextPage);
        setHasMore(result.hasMore);
      } catch {
        if (ticket === requestRef.current) setHasMore(false);
      } finally {
        if (ticket === requestRef.current) setLoading(false);
      }
    },
    [type],
  );

  // First page, and again (debounced) whenever the search text changes.
  useEffect(() => {
    const timer = window.setTimeout(() => void load(query, 1), query ? SEARCH_DELAY_MS : 0);
    return () => window.clearTimeout(timer);
  }, [query, load]);

  const options = useMemo(
    () => items.map((worker) => ({ value: worker.id, label: optionLabel(worker, type === "all") })),
    [items, type],
  );

  const fallbackLabel = picked && picked.id === value?.id ? optionLabel(picked, type === "all") : valueLabel;

  return (
    <SearchableSelect
      id={id}
      className={className}
      options={options}
      value={value?.id ?? null}
      selectedLabel={fallbackLabel}
      placeholder={placeholder}
      emptyMessage={
        query
          ? "No one matches that search."
          : type === "contractor"
            ? "No subcontractors yet."
            : type === "technician"
              ? "No employees yet."
              : "No employees or subcontractors yet."
      }
      loading={loading}
      onSearchChange={setQuery}
      hasMore={hasMore}
      onLoadMore={() => {
        if (!loading && hasMore) void load(query, page + 1);
      }}
      onChange={(next) => {
        const worker = next ? items.find((item) => item.id === next) || null : null;
        setPicked(worker);
        onChange(worker);
      }}
    />
  );
}
