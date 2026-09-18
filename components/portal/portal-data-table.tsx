"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Loader2, MoreHorizontal, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type PortalTableColumn<T> = {
  id: string;
  header: string;
  sortValue?: (row: T) => string | number;
  searchValue?: (row: T) => string;
  exportValue?: (row: T) => string;
  className?: string;
  cell: (row: T) => ReactNode;
};

export type PortalTableAction<T> = {
  label: string;
  href?: string;
  onSelect?: (row: T) => void;
  variant?: "default" | "destructive";
  icon?: ReactNode;
  quick?: boolean;
};

export type PortalTableServerPagination = {
  page: number;
  pageSize: number;
  total: number;
  /** Prefer backend `pagination.totalPages` when provided. */
  totalPages?: number;
  onPageChange: (page: number) => void;
  search: string;
  onSearchChange: (value: string) => void;
  /** Active A–Z letter (`""` = All). When set with `onLetterChange`, letter clicks are parent-driven. */
  letter?: string;
  onLetterChange?: (letter: string) => void;
};

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function PortalDataTable<T>({
  rows,
  rowKey,
  columns,
  actions,
  searchPlaceholder = "Search records…",
  filename,
  empty = "No records found.",
  rowHref,
  toolbar,
  letters,
  letterValue,
  pageSize = 20,
  countLabel,
  serverPagination,
  loading = false,
  busyRowIds,
  isRowBusy,
}: {
  rows: T[];
  rowKey: (row: T) => string;
  columns: PortalTableColumn<T>[];
  actions?: (row: T) => PortalTableAction<T>[];
  searchPlaceholder?: string;
  filename: string;
  empty?: string;
  rowHref?: (row: T) => string;
  toolbar?: ReactNode;
  letters?: boolean;
  letterValue?: (row: T) => string;
  pageSize?: number;
  countLabel?: string;
  /** When set, search + page controls are driven by the parent (API pagination). */
  serverPagination?: PortalTableServerPagination;
  /** Shows a spinner over the table body without hiding the toolbar. */
  loading?: boolean;
  /** Row IDs currently undergoing asynchronous action (e.g. status update) */
  busyRowIds?: string[];
  /** Predicate to determine if a specific row is busy */
  isRowBusy?: (row: T) => boolean;
}) {
  const router = useRouter();
  const isServer = Boolean(serverPagination);
  const [query, setQuery] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return new URLSearchParams(window.location.search).get("q") ?? "";
    } catch {
      return "";
    }
  });
  const [letter, setLetter] = useState("");
  const [sortId, setSortId] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const letterControlled = Boolean(serverPagination?.onLetterChange);
  const activeLetter = letterControlled ? (serverPagination?.letter ?? "") : letter;

  function applyLetter(next: string) {
    if (serverPagination?.onLetterChange) {
      serverPagination.onLetterChange(next);
      return;
    }
    setLetter(next);
    setPage(1);
  }

  const filtered = useMemo(() => {
    if (isServer) {
      const next = [...rows];
      const column = columns.find((item) => item.id === sortId);
      if (column?.sortValue) {
        next.sort((a, b) => {
          const left = column.sortValue?.(a);
          const right = column.sortValue?.(b);
          if (left === undefined || right === undefined) return 0;
          if (left < right) return sortDir === "asc" ? -1 : 1;
          if (left > right) return sortDir === "asc" ? 1 : -1;
          return 0;
        });
      }
      return next;
    }

    const needle = query.trim().toLowerCase();
    const withLetter = activeLetter
      ? rows.filter((row) => {
          const source = (letterValue ? letterValue(row) : String(columns[0]?.sortValue?.(row) ?? "")).trim();
          return source.toUpperCase().startsWith(activeLetter);
        })
      : rows;

    const withSearch = needle
      ? withLetter.filter((row) =>
          columns.some((column) => {
            const raw = column.searchValue?.(row) ?? column.sortValue?.(row);
            return String(raw ?? "").toLowerCase().includes(needle);
          }),
        )
      : withLetter;

    const sorted = [...withSearch];
    const column = columns.find((item) => item.id === sortId);
    if (column?.sortValue) {
      sorted.sort((a, b) => {
        const left = column.sortValue?.(a);
        const right = column.sortValue?.(b);
        if (left === undefined || right === undefined) return 0;
        if (left < right) return sortDir === "asc" ? -1 : 1;
        if (left > right) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }

    return sorted;
  }, [activeLetter, columns, isServer, letterValue, query, rows, sortDir, sortId]);

  const totalCount = isServer ? (serverPagination?.total ?? 0) : filtered.length;
  const pageCount = isServer
    ? (serverPagination?.totalPages ?? Math.max(1, Math.ceil(totalCount / pageSize)))
    : Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = isServer ? (serverPagination?.page ?? 1) : page;

  const pageRows = useMemo(() => {
    if (isServer) return rows;
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [currentPage, filtered, isServer, pageSize, rows]);

  function toggleSort(id: string) {
    if (sortId !== id) {
      setSortId(id);
      setSortDir("asc");
      return;
    }
    if (sortDir === "asc") {
      setSortDir("desc");
      return;
    }
    setSortId(null);
    setSortDir("asc");
  }

  function exportCsv() {
    const exportColumns = columns.filter((col) => col.exportValue);
    const header = exportColumns.map((col) => csvCell(col.header)).join(",");
    const lines = filtered.map((row) =>
      exportColumns.map((col) => csvCell(col.exportValue?.(row) ?? "")).join(","),
    );
    const content = [header, ...lines].join("\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const from = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, totalCount);

  function goToPage(next: number) {
    const bounded = Math.max(1, Math.min(pageCount, next));
    if (isServer && serverPagination?.onPageChange) {
      serverPagination.onPageChange(bounded);
      return;
    }
    setPage(bounded);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={isServer ? (serverPagination?.search ?? "") : query}
              onChange={(event) => {
                const next = event.target.value;
                if (isServer && serverPagination?.onSearchChange) {
                  serverPagination.onSearchChange(next);
                  return;
                }
                setQuery(next);
                setPage(1);
              }}
              placeholder={searchPlaceholder}
              className="h-8.5 pl-8 text-xs"
            />
          </div>
          {countLabel ? (
            <p className="text-xs text-muted-foreground">{countLabel}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {totalCount} {totalCount === 1 ? "record" : "records"}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {toolbar}
          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            className="h-8.5 text-xs"
          >
            <Download className="size-3.5" />
            Export
          </Button>
        </div>
      </div>

      {letters ? (
        <div className="flex flex-wrap items-center gap-1 border-y border-black/10 py-1.5 text-xs">
          <button
            type="button"
            onClick={() => applyLetter("")}
            className={cn(
              "rounded px-1.5 py-0.5 text-xs font-medium",
              activeLetter === ""
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            All
          </button>
          {LETTERS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => applyLetter(item)}
              className={cn(
                "rounded px-1.5 py-0.5 text-xs font-medium",
                activeLetter === item
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {item}
            </button>
          ))}
        </div>
      ) : null}

      <div className="relative overflow-x-auto rounded-lg border border-black/10 bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((column) => {
                const sortable = Boolean(column.sortValue);
                const active = sortId === column.id;
                return (
                  <TableHead
                    key={column.id}
                    className={cn(
                      "h-8 bg-[#f7f8fa] px-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase",
                      column.className,
                    )}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column.id)}
                        className="inline-flex items-center gap-1 hover:text-primary"
                      >
                        {column.header}
                        {active && sortDir === "asc" ? (
                          <ArrowUp className="size-3" />
                        ) : active && sortDir === "desc" ? (
                          <ArrowDown className="size-3" />
                        ) : (
                          <ArrowUpDown className="size-3 text-muted-foreground/70" />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </TableHead>
                );
              })}
              {actions ? (
                <TableHead className="h-8 min-w-[4.5rem] bg-[#f7f8fa] px-2.5 text-right text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  Options
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length ? (
              pageRows.map((row) => {
                const rowActions = actions?.(row) ?? [];
                const href = rowHref?.(row);
                return (
                  <TableRow
                    key={rowKey(row)}
                    className={cn(href && "cursor-pointer")}
                    onClick={
                      href
                        ? () => {
                            router.push(href);
                          }
                        : undefined
                    }
                  >
                    {columns.map((column) => (
                      <TableCell key={column.id} className={cn("px-2.5 py-1.5", column.className)}>
                        {column.cell(row)}
                      </TableCell>
                    ))}
                    {actions ? (
                      <TableCell
                        className="px-2.5 py-1.5 text-right whitespace-nowrap"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <RowActions
                          row={row}
                          actions={rowActions}
                          busy={(busyRowIds && busyRowIds.includes(rowKey(row))) || (isRowBusy ? isRowBusy(row) : false)}
                        />
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (actions ? 1 : 0)}
                  className="px-4 py-16 text-center text-sm text-muted-foreground"
                >
                  {loading ? "\u00a0" : empty}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {loading ? (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center bg-card/70"
            aria-busy="true"
          >
            <Spinner label="Loading" />
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 border-t border-black/10 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {totalCount ? `Showing ${from}–${to} of ${totalCount}` : "No results"}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => goToPage(currentPage - 1)}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {currentPage} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= pageCount}
            onClick={() => goToPage(currentPage + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

function RowActions<T>({
  row,
  actions,
  busy = false,
}: {
  row: T;
  actions: PortalTableAction<T>[];
  busy?: boolean;
}) {
  const router = useRouter();
  if (!actions.length) return null;

  if (busy) {
    return (
      <div className="inline-flex items-center justify-end">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="size-7 opacity-90 cursor-wait pointer-events-none"
          disabled
          aria-label="Updating row…"
        >
          <Loader2 className="size-4 animate-spin text-primary" />
        </Button>
      </div>
    );
  }

  const quickAction = actions.find((a) => a.quick);

  return (
    <div className="inline-flex items-center justify-end gap-1">
      {quickAction ? (
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="size-7 text-[#003F7D] hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/60"
          title={quickAction.label}
          aria-label={quickAction.label}
          onClick={(event) => {
            event.stopPropagation();
            if (quickAction.href) router.push(quickAction.href);
            quickAction.onSelect?.(row);
          }}
        >
          {quickAction.icon ?? <MoreHorizontal className="size-4" />}
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon-sm"
            className="size-7"
            aria-label="Row actions"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          {actions.map((action, index) => {
            const previous = actions[index - 1];
            const split = action.variant === "destructive" && previous?.variant !== "destructive";
            return (
              <Fragment key={`${action.label}-${index}`}>
                {split ? <DropdownMenuSeparator /> : null}
                <DropdownMenuItem
                  variant={action.variant}
                  className="flex items-center gap-2 cursor-pointer text-xs"
                  onClick={() => {
                    if (action.href) router.push(action.href);
                    action.onSelect?.(row);
                  }}
                >
                  {action.icon ? (
                    <span className="shrink-0 text-muted-foreground">{action.icon}</span>
                  ) : null}
                  <span>{action.label}</span>
                </DropdownMenuItem>
              </Fragment>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function csvCell(value: string) {
  const next = value.replaceAll('"', '""');
  return /[",\n]/.test(next) ? `"${next}"` : next;
}
