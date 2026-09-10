"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, Download, MoreHorizontal, Search } from "lucide-react";
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
};

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function PortalDataTable<T>({
  rows,
  rowKey,
  columns,
  actions,
  searchPlaceholder = "Search",
  filename,
  empty = "No records match this view.",
  rowHref,
  toolbar,
  letters,
  letterValue,
  pageSize = 20,
  countLabel,
  serverPagination,
  loading = false,
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
}) {
  const router = useRouter();
  const isServer = Boolean(serverPagination);
  const [query, setQuery] = useState("");
  const [letter, setLetter] = useState("");
  const [sortId, setSortId] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (isServer) {
      const next = [...rows];
      const column = columns.find((item) => item.id === sortId);
      if (column?.sortValue) {
        next.sort((a, b) => {
          const left = column.sortValue?.(a);
          const right = column.sortValue?.(b);
          const compared =
            typeof left === "number" && typeof right === "number"
              ? left - right
              : String(left ?? "").localeCompare(String(right ?? ""), undefined, {
                  numeric: true,
                });
          return sortDir === "asc" ? compared : -compared;
        });
      }
      return next;
    }

    const needle = query.trim().toLowerCase();
    const next = rows.filter((row) => {
      const matchesQuery = needle
        ? columns.some((column) => (column.searchValue?.(row) ?? "").toLowerCase().includes(needle))
        : true;
      const initial = (letterValue?.(row) ?? "").trim().charAt(0).toUpperCase();
      const matchesLetter = letter ? initial === letter : true;
      return matchesQuery && matchesLetter;
    });

    const column = columns.find((item) => item.id === sortId);
    if (column?.sortValue) {
      next.sort((a, b) => {
        const left = column.sortValue?.(a);
        const right = column.sortValue?.(b);
        const compared =
          typeof left === "number" && typeof right === "number"
            ? left - right
            : String(left ?? "").localeCompare(String(right ?? ""), undefined, { numeric: true });
        return sortDir === "asc" ? compared : -compared;
      });
    }
    return next;
  }, [columns, isServer, letter, letterValue, query, rows, sortDir, sortId]);

  const effectivePageSize = serverPagination?.pageSize ?? pageSize;
  const totalCount = serverPagination?.total ?? filtered.length;
  const pageCount = Math.max(
    1,
    serverPagination?.totalPages ?? Math.ceil(totalCount / effectivePageSize),
  );
  const currentPage = Math.min(serverPagination?.page ?? page, pageCount);
  const pageRows = isServer
    ? filtered
    : filtered.slice((currentPage - 1) * effectivePageSize, currentPage * effectivePageSize);
  const from = totalCount ? (currentPage - 1) * effectivePageSize + 1 : 0;
  const to = Math.min(currentPage * effectivePageSize, totalCount);
  const searchValue = serverPagination?.search ?? query;

  function toggleSort(id: string) {
    if (sortId === id) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortId(id);
    setSortDir("asc");
  }

  function exportCsv() {
    const headers = columns.map((column) => column.header);
    const body = filtered.map((row) =>
      columns.map((column) => csvCell(column.exportValue?.(row) ?? column.searchValue?.(row) ?? "")),
    );
    const csv = [headers.join(","), ...body.map((line) => line.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function goToPage(nextPage: number) {
    if (serverPagination) {
      serverPagination.onPageChange(nextPage);
      return;
    }
    setPage(nextPage);
  }

  return (
    <div className="overflow-hidden border border-black/15 bg-card">
      {letters && !isServer ? (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-black/10 px-3 py-1.5">
          <button
            type="button"
            onClick={() => {
              setLetter("");
              setPage(1);
            }}
            className={cn(
              "px-1.5 text-[11px] font-semibold tracking-wide uppercase",
              letter ? "text-muted-foreground hover:text-foreground" : "text-primary",
            )}
          >
            All
          </button>
          {LETTERS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setLetter(item);
                setPage(1);
              }}
              className={cn(
                "px-1.5 text-[11px] font-semibold",
                letter === item ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 border-b border-black/10 bg-card px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchValue}
              onChange={(change) => {
                const next = change.target.value;
                if (serverPagination) {
                  serverPagination.onSearchChange(next);
                  return;
                }
                setQuery(next);
                setPage(1);
              }}
              placeholder={searchPlaceholder}
              className="h-8 bg-card pl-8 text-sm"
              aria-label={searchPlaceholder}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {countLabel ?? filename} ({totalCount})
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {toolbar}
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
            <Download />
            Export
          </Button>
        </div>
      </div>

      <div className="relative min-h-[160px]">
        <Table className={cn("text-[13px]", loading && pageRows.length ? "opacity-40" : undefined)}>
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
                <TableHead className="h-8 w-12 bg-[#f7f8fa] px-2.5 text-right text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
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
                        className="px-2.5 py-1.5 text-right"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <RowActions row={row} actions={rowActions} />
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (actions ? 1 : 0)}
                  className="px-4 py-10 text-center text-muted-foreground"
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

function RowActions<T>({ row, actions }: { row: T; actions: PortalTableAction<T>[] }) {
  const router = useRouter();
  if (!actions.length) return null;

  return (
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
                onClick={() => {
                  if (action.href) router.push(action.href);
                  action.onSelect?.(row);
                }}
              >
                {action.label}
              </DropdownMenuItem>
            </Fragment>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function csvCell(value: string) {
  const next = value.replaceAll('"', '""');
  return /[",\n]/.test(next) ? `"${next}"` : next;
}
