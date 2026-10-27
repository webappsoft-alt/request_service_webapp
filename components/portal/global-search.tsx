"use client";

import { Fragment, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Briefcase,
  Building2,
  ClipboardList,
  CornerDownLeft,
  Handshake,
  Loader2,
  Search,
  SearchX,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { getData } from "@/components/api/apiFuntions";
import { providerCrmApi } from "@/components/api/ApiRoutesFile";
import { cn } from "@/lib/utils";

type SearchModule = "customers" | "employees" | "contractors" | "jobs" | "estimates" | "vendors";

type SearchItem = {
  id: string;
  title: string;
  subtitle?: string;
  status?: string;
  kind?: "estimate" | "opportunity";
};
type SearchGroup = { module: SearchModule; items: SearchItem[] };

const MODULES: Record<SearchModule, { label: string; icon: LucideIcon; list: string; tint: string }> = {
  customers: {
    label: "Customers",
    icon: Users,
    list: "/pro/dashboard/customers",
    tint: "bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300",
  },
  employees: {
    label: "Employees",
    icon: UserRound,
    list: "/pro/dashboard/team",
    tint: "bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300",
  },
  contractors: {
    label: "Contractors",
    icon: Handshake,
    list: "/pro/dashboard/contractors",
    tint: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  },
  jobs: {
    label: "Jobs",
    icon: Briefcase,
    list: "/pro/dashboard/jobs",
    tint: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  },
  estimates: {
    label: "Estimates",
    icon: ClipboardList,
    list: "/pro/dashboard/new-estimate",
    tint: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300",
  },
  vendors: {
    label: "Vendors",
    icon: Building2,
    list: "/pro/dashboard/vendors",
    tint: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
};

function hrefFor(module: SearchModule, item: SearchItem) {
  switch (module) {
    case "customers":
      return `/pro/dashboard/customers/${item.id}`;
    case "employees":
      return `/pro/dashboard/team/${item.id}`;
    case "contractors":
      return `/pro/dashboard/contractors/${item.id}`;
    case "jobs":
      return `/pro/dashboard/jobs/${item.id}`;
    case "estimates":
      // Written estimates open through /estimates (forwards to the workspace when there is one).
      return item.kind === "opportunity" ? `/pro/dashboard/new-estimate/${item.id}` : `/pro/dashboard/estimates/${item.id}`;
    case "vendors":
      return `/pro/dashboard/vendors/${item.id}`;
  }
}

/** "site_visit" → "Site visit". */
function statusLabel(status: string) {
  const text = status.replace(/[_-]+/g, " ").trim();
  return text ? text[0].toUpperCase() + text.slice(1) : "";
}

const DONE = /^(accepted|approved|completed|complete|paid|invoiced|won|closed)$/i;
const BAD = /^(declined|rejected|cancell?ed|lost|inactive|on[_ ]stop|archived|expired|overdue)$/i;
const ACTIVE = /^(in[_ ]progress|scheduled|sent|site[_ ]visit|dispatched|active|open)$/i;

function statusTone(status: string) {
  if (DONE.test(status)) return "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-900";
  if (BAD.test(status)) return "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:ring-rose-900";
  if (ACTIVE.test(status)) return "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:ring-sky-900";
  return "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700";
}

/** The query's matches in bold. */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig"));
  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark key={index} className="rounded-sm bg-transparent font-semibold text-foreground">
            {part}
          </mark>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}

const MIN_CHARS = 2;
const DELAY_MS = 250;

/**
 * Pro portal header search: one request searches customers, employees, contractors, jobs,
 * estimates and vendors; suggestions are grouped by module and open the record directly. A
 * record that matches in several modules shows under each, linking to that module's page.
 * Ctrl/⌘ K focuses it from anywhere in the portal.
 */
export function GlobalSearch({ className }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "failed">("idle");
  const [highlighted, setHighlighted] = useState(-1);
  const ticket = useRef(0);

  const flat = useMemo(
    () => groups.flatMap((group) => group.items.map((item) => ({ module: group.module, item }))),
    [groups],
  );

  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_CHARS) {
      ticket.current += 1;
      setGroups([]);
      setStatus("idle");
      return;
    }
    const mine = ++ticket.current;
    setStatus("loading");
    const timer = window.setTimeout(async () => {
      try {
        const response = await getData<{ data?: { groups?: SearchGroup[] } }>(
          providerCrmApi.globalSearch,
          { q, limit: 5 },
          { silent: true, cacheTtlMs: 15_000 },
        );
        if (mine !== ticket.current) return;
        const next = (response?.data?.groups || []).filter((group) => group.module in MODULES && group.items?.length);
        setGroups(next);
        setHighlighted(next.length ? 0 : -1);
        setStatus("ready");
      } catch {
        if (mine === ticket.current) setStatus("failed");
      }
    }, DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Close on navigation.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Ctrl/⌘ K anywhere focuses the search.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Keep the highlighted row in view while using the arrow keys.
  useEffect(() => {
    if (highlighted < 0) return;
    listRef.current?.querySelector(`[data-index="${highlighted}"]`)?.scrollIntoView({ block: "nearest" });
  }, [highlighted]);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    router.push(href);
  }

  /** Enter with no suggestion picked: the current module's list, filtered (previous behaviour). */
  function searchCurrentList() {
    const q = query.trim();
    const segments = pathname.split("/").filter(Boolean);
    const modulePath = segments.length >= 3 ? `/${segments.slice(0, 3).join("/")}` : "/pro/dashboard/customers";
    const listBase = modulePath === "/pro/dashboard" ? "/pro/dashboard/customers" : modulePath;
    go(q ? `${listBase}?q=${encodeURIComponent(q)}` : listBase);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setHighlighted((index) => Math.min(index + 1, flat.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const pick = open && highlighted >= 0 ? flat[highlighted] : null;
      if (pick) go(hrefFor(pick.module, pick.item));
      else searchCurrentList();
    } else if (event.key === "Escape") {
      if (query) setQuery("");
      else {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
  }

  const q = query.trim();
  const showMenu = open && q.length >= MIN_CHARS;
  let index = -1;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        type="text"
        placeholder="Search customers, jobs, estimates…"
        className={cn(
          "h-8 w-full min-w-0 rounded-lg border border-input bg-[#f7f8fa] pr-14 pl-8 text-sm outline-none transition-[color,box-shadow]",
          "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40",
          "dark:bg-slate-800/80",
        )}
        aria-label="Search records"
        role="combobox"
        aria-expanded={showMenu}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showMenu && highlighted >= 0 ? `${listId}-${highlighted}` : undefined}
        autoComplete="off"
        spellCheck={false}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      <div className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center gap-1">
        {status === "loading" && q.length >= MIN_CHARS ? (
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden />
        ) : null}
        {query ? (
          <button
            type="button"
            aria-label="Clear search"
            className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            onMouseDown={(event) => {
              event.preventDefault();
              setQuery("");
              inputRef.current?.focus();
            }}
          >
            <X className="size-3.5" />
          </button>
        ) : (
          <kbd className="pointer-events-none hidden rounded border border-input bg-card px-1 font-sans text-[10px] text-muted-foreground xl:inline">
            Ctrl K
          </kbd>
        )}
      </div>

      {showMenu ? (
        <div
          className="absolute top-full right-0 left-0 z-50 mt-1.5 overflow-hidden rounded-xl border border-input bg-popover text-popover-foreground shadow-xl ring-1 ring-black/5"
        >
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            className="max-h-[min(28rem,65vh)] overflow-y-auto overscroll-contain [scrollbar-width:thin]"
          >
            {status === "loading" && !flat.length ? (
              <div className="space-y-2 p-3" aria-label="Searching">
                {[0, 1, 2].map((row) => (
                  <div key={row} className="flex items-center gap-3">
                    <div className="size-8 animate-pulse rounded-lg bg-muted" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                      <div className="h-2.5 w-1/2 animate-pulse rounded bg-muted" />
                    </div>
                  </div>
                ))}
              </div>
            ) : status === "failed" ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                Search isn&apos;t available right now. Try again in a moment.
              </p>
            ) : !flat.length ? (
              <div className="flex flex-col items-center gap-1.5 px-4 py-7 text-center">
                <SearchX className="size-5 text-muted-foreground" aria-hidden />
                <p className="text-sm font-medium">No results for “{q}”</p>
                <p className="text-xs text-muted-foreground">Try a name, email, phone, or a number like JOB-251.</p>
              </div>
            ) : (
              groups.map((group) => {
                const meta = MODULES[group.module];
                const Icon = meta.icon;
                return (
                  <div key={group.module} role="group" aria-label={meta.label}>
                    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-input/60 bg-popover/95 px-3 py-1.5 backdrop-blur">
                      <span className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                        {meta.label}
                        <span className="ml-1.5 rounded-full bg-muted px-1.5 py-px text-[10px] tracking-normal tabular-nums">
                          {group.items.length}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="rounded px-1.5 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/10"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          go(`${meta.list}?q=${encodeURIComponent(q)}`);
                        }}
                      >
                        See all
                      </button>
                    </div>
                    <div className="p-1">
                      {group.items.map((item) => {
                        index += 1;
                        const mine = index;
                        const active = mine === highlighted;
                        return (
                          <button
                            key={`${group.module}-${item.id}`}
                            id={`${listId}-${mine}`}
                            data-index={mine}
                            type="button"
                            role="option"
                            aria-selected={active}
                            className={cn(
                              "group flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors",
                              active ? "bg-primary/10" : "hover:bg-muted/70",
                            )}
                            onMouseEnter={() => setHighlighted(mine)}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              go(hrefFor(group.module, item));
                            }}
                          >
                            <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", meta.tint)}>
                              <Icon className="size-4" aria-hidden />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm text-foreground/90">
                                <Highlight text={item.title} query={q} />
                              </span>
                              {item.subtitle ? (
                                <span className="block truncate text-xs text-muted-foreground">
                                  <Highlight text={item.subtitle} query={q} />
                                </span>
                              ) : null}
                            </span>
                            {item.status ? (
                              <span
                                className={cn(
                                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset",
                                  statusTone(item.status),
                                )}
                              >
                                {statusLabel(item.status)}
                              </span>
                            ) : null}
                            <CornerDownLeft
                              className={cn("size-3.5 shrink-0 text-primary", active ? "opacity-100" : "opacity-0")}
                              aria-hidden
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="flex items-center gap-3 border-t border-input bg-muted/40 px-3 py-1.5 text-[11px] text-muted-foreground">
            <span>
              <kbd className="rounded border border-input bg-card px-1 font-sans">↑</kbd>{" "}
              <kbd className="rounded border border-input bg-card px-1 font-sans">↓</kbd> to move
            </span>
            <span>
              <kbd className="rounded border border-input bg-card px-1 font-sans">Enter</kbd> to open
            </span>
            <span className="ml-auto">
              <kbd className="rounded border border-input bg-card px-1 font-sans">Esc</kbd> to close
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
