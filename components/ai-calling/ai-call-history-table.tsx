"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, Headphones, PhoneIncoming, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DeleteConfirmDialog } from "@/components/portal/delete-confirm-dialog";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  AI_CALLS_PAGE_SIZE,
  fetchAiCallsPage,
  removeAiCall,
  selectAiCallDeletingId,
  selectAiCallsPage,
} from "@/store/aiCallsSlice";
import { cn } from "@/lib/utils";
import { AiCallOutcomeBadge, CALL_HISTORY_PATH } from "./ai-call-history";
import { callNumberOf, isStaleCall, type AiCallSummary } from "./call-logs";
import { formatPhone } from "./phone";

function customerLabel(call: AiCallSummary) {
  if (call.customerName) return call.customerName;
  if (call.channel === "browser_test") return "Browser test call";
  return call.callerPhone ? formatPhone(call.callerPhone) : "Unknown caller";
}

function dateTime(value: string) {
  const date = new Date(value);
  return {
    date: date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    time: date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

/** Radix Select can't use "" as a value, so "All calls" is this sentinel. */
const ALL = "all";

const FILTER_GROUPS = [
  {
    label: "Type",
    options: [
      { value: "channel:phone", label: "Phone calls" },
      { value: "channel:browser_test", label: "Test calls" },
    ],
  },
  {
    label: "Outcome",
    options: [
      { value: "outcome:lead_captured", label: "Lead / estimate saved" },
      { value: "outcome:transferred", label: "Transferred" },
      { value: "outcome:caller_hung_up", label: "Caller hung up" },
      { value: "outcome:out_of_scope", label: "Out of scope" },
      { value: "outcome:no_response", label: "No response" },
    ],
  },
];

/** "All calls" dropdown next to Export (same place and style as the Leads "All sources" filter). */
function CallFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <Select
      value={value || ALL}
      onValueChange={(next) => onChange(next === ALL ? "" : next)}
    >
      <SelectTrigger size="sm" className="w-48" aria-label="Filter calls">
        <SelectValue placeholder="All calls" />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value={ALL}>All calls</SelectItem>
        {FILTER_GROUPS.map((group) => (
          <Fragment key={group.label}>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>{group.label}</SelectLabel>
              {group.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </Fragment>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Running calls can't be deleted (a dropped call left "in progress" for hours can). */
const deletable = (call: AiCallSummary) =>
  call.status !== "in_progress" || isStaleCall(call);

/**
 * Call history (portal table): customer, call number, date & time, what the AI did. The row opens
 * the call; the eye button too; delete is in the row menu. Pages are cached in the store
 * (aiCallsSlice): coming back shows them at once and refreshes in the background.
 */
export function AiCallHistoryTable() {
  const dispatch = useAppDispatch();
  const [page, setPage] = useState(1);
  // Search box text, and the debounced value that is sent (one request per pause in typing).
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState(""); // "" | "channel:phone" | "outcome:transferred" …
  const [filterKind, filterValue] = filter.split(":");
  const query = useMemo(
    () => ({
      page,
      search,
      channel: filterKind === "channel" ? filterValue : "",
      outcome: filterKind === "outcome" ? filterValue : "",
    }),
    [page, search, filterKind, filterValue],
  );
  const current = useAppSelector((state) => selectAiCallsPage(state, query));
  const deletingId = useAppSelector(selectAiCallDeletingId);
  const [toDelete, setToDelete] = useState<AiCallSummary | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    void dispatch(fetchAiCallsPage(query));
  }, [dispatch, query]);

  // A page emptied by deletes: step back to the previous one.
  useEffect(() => {
    if (
      current.loaded &&
      !current.items.length &&
      page > 1 &&
      current.total > 0
    )
      setPage((p) => p - 1);
  }, [current.loaded, current.items.length, current.total, page]);

  async function confirmDelete() {
    if (!toDelete) return;
    const result = await dispatch(removeAiCall({ id: toDelete.id }));
    if (removeAiCall.fulfilled.match(result)) {
      toast.success(`${callNumberOf(toDelete)} deleted.`);
      setToDelete(null);
      void dispatch(fetchAiCallsPage(query));
    } else {
      toast.error(result.payload || "Could not delete this call. Try again.");
    }
  }

  return (
    <>
      <PortalDataTable
        filename="ai-call-history"
        countLabel="Calls"
        searchPlaceholder="Search calls"
        // Previous: hideSearch (no search on the API then).
        empty={
          search || filter
            ? "No calls match this search."
            : "No calls yet. Every call the AI receptionist answers (including browser test calls) shows up here."
        }
        toolbar={
          <CallFilter
            value={filter}
            onChange={(next) => {
              setFilter(next);
              setPage(1);
            }}
          />
        }
        // Skeleton only until this page was loaded once; later visits show the cached rows.
        loading={!current.loaded}
        pageSize={AI_CALLS_PAGE_SIZE}
        busyRowIds={deletingId ? [deletingId] : []}
        serverPagination={{
          page,
          pageSize: AI_CALLS_PAGE_SIZE,
          total: current.total,
          totalPages: current.totalPages,
          onPageChange: setPage,
          search: searchInput,
          onSearchChange: setSearchInput,
        }}
        rows={current.items}
        rowKey={(call) => call.id}
        rowHref={(call) => `${CALL_HISTORY_PATH}/${call.id}`}
        actions={(call) => [
          {
            label: "View call history",
            href: `${CALL_HISTORY_PATH}/${call.id}`,
            icon: <Eye className="size-3.5" />,
            quick: true,
          },
          ...(deletable(call)
            ? [
                {
                  label: "Delete",
                  variant: "destructive" as const,
                  icon: <Trash2 className="size-3.5" />,
                  onSelect: () => setToDelete(call),
                },
              ]
            : []),
        ]}
        columns={[
          {
            id: "customer",
            header: "Customer name",
            className: "min-w-52",
            sortValue: (call) => customerLabel(call).toLowerCase(),
            exportValue: (call) => customerLabel(call),
            cell: (call) => {
              const isTest = call.channel === "browser_test";
              return (
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full",
                      isTest
                        ? "bg-violet-500/10 text-violet-600 dark:text-violet-300"
                        : "bg-primary/10 text-primary",
                    )}
                    aria-hidden="true"
                  >
                    {isTest ? (
                      <Headphones className="size-3.5" />
                    ) : (
                      <PhoneIncoming className="size-3.5" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {customerLabel(call)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {isTest
                        ? "Test call"
                        : call.callerPhone
                          ? formatPhone(call.callerPhone)
                          : "—"}
                    </p>
                  </div>
                </div>
              );
            },
          },
          {
            id: "number",
            header: "Call no.",
            sortValue: (call) => callNumberOf(call),
            exportValue: (call) => callNumberOf(call),
            cell: (call) => (
              <span className="font-medium whitespace-nowrap text-primary">
                {callNumberOf(call)}
              </span>
            ),
          },
          {
            id: "date",
            header: "Date & time",
            sortValue: (call) => new Date(call.startedAt).getTime(),
            exportValue: (call) =>
              `${dateTime(call.startedAt).date} ${dateTime(call.startedAt).time}`,
            cell: (call) => {
              const when = dateTime(call.startedAt);
              return (
                <div className="whitespace-nowrap">
                  <p className="text-foreground">{when.date}</p>
                  <p className="text-xs text-muted-foreground">{when.time}</p>
                </div>
              );
            },
          },
          {
            id: "summary",
            header: "Summary",
            className: "min-w-72 max-w-[30rem] whitespace-normal",
            exportValue: (call) => call.summary || "",
            cell: (call) => (
              <div className="flex flex-col items-start gap-1">
                <AiCallOutcomeBadge call={call} />
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {call.summary || call.preview || "—"}
                </p>
              </div>
            ),
          },
        ]}
      />

      <DeleteConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(value) => {
          if (!value) setToDelete(null);
        }}
        title="Delete call record?"
        description={
          toDelete
            ? `${callNumberOf(toDelete)} with ${customerLabel(toDelete)} — the conversation and activity log are removed. Leads, estimates and visits it created stay.`
            : ""
        }
        loading={Boolean(deletingId)}
        onConfirm={confirmDelete}
      />
    </>
  );
}
