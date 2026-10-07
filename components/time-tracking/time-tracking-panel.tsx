"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { CalendarDays, List, Wallet } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchLedger,
  fetchTimeEntries,
  selectLedger,
  selectTimeList,
  stopTimeEntryThunk,
} from "@/store/timeTrackingSlice";
import { subscribeRealtime } from "@/components/realtime/realtime-provider";
import { resolveTimeRange, type TimeEntry, type TimeRange } from "@/lib/time-tracking";
import type { LedgerRow } from "@/lib/api/technician-client";
import { TimeEntriesTable, TimeRangeFilter } from "@/components/time-tracking/time-tracking-ui";
import {
  LedgerTable,
  PayTechnicianDialog,
  PaymentHistoryTable,
  RecordTypeFilter,
  TechnicianMultiSelect,
  TimesheetKpis,
  WeekBoard,
  ledgerRowKey,
  ledgerRowKind,
  sumLedger,
  usePayDialog,
  type EmployeeOption,
  type HrefFor,
  type RecordKind,
} from "@/components/time-tracking/timesheet-ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;
/** The week board loads every session in range (the API caps this at 500). */
const BOARD_LIMIT = 500;

export type TimesheetView = "board" | "sessions" | "payments";

export type TimeTrackingPanelProps = {
  /** Slice cache key, e.g. `tech`, `employee:<id>`, `job:<id>`, `timesheets`. */
  scopeKey: string;
  /** Technician portal (own data) vs provider portal (scoped by ids below). */
  technician?: boolean;
  employeeId?: string;
  jobId?: string;
  estimateId?: string;
  defaultRange?: TimeRange;
  defaultView?: TimesheetView;
  payRate?: number;
  /** Global timesheet: technician multi-select (hidden when scoped to one employee). */
  employeeOptions?: EmployeeOption[];
  /** Show the technician name on cards / rows. */
  showEmployee?: boolean;
  /** Provider only: record technician payouts. */
  canPay?: boolean;
  /** Provider only: allow stopping a technician's running timer. */
  allowStop?: boolean;
  hrefFor?: HrefFor;
  header?: ReactNode;
};

const VIEWS: { id: TimesheetView; label: string; icon: typeof List }[] = [
  { id: "board", label: "Week board", icon: CalendarDays },
  { id: "sessions", label: "Sessions", icon: List },
  { id: "payments", label: "Payments", icon: Wallet },
];

/**
 * One timesheet used everywhere (global Timesheets page, employee detail, job
 * detail, technician portal): filters → KPI ribbon → week board / sessions
 * table / pay ledger. Hours, pay and payouts all come from the same entries.
 */
export function TimeTrackingPanel({
  scopeKey,
  technician = false,
  employeeId,
  jobId,
  estimateId,
  defaultRange = { preset: "week" },
  defaultView = "board",
  payRate,
  employeeOptions,
  showEmployee = false,
  canPay = false,
  allowStop = false,
  hrefFor,
  header,
}: TimeTrackingPanelProps) {
  const dispatch = useAppDispatch();
  const [range, setRange] = useState<TimeRange>(defaultRange);
  const [view, setView] = useState<TimesheetView>(defaultView);
  const [kinds, setKinds] = useState<RecordKind[]>(["job", "estimate"]);
  const [employeeIds, setEmployeeIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsTab, setPaymentsTab] = useState<"balances" | "history">("balances");
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  const pay = usePayDialog();

  const resolved = useMemo(() => resolveTimeRange(range), [range]);
  const listScope = view === "sessions" ? scopeKey : `${scopeKey}:board`;
  const list = useAppSelector((state) => selectTimeList(state, listScope));
  const ledgerState = useAppSelector((state) => selectLedger(state, scopeKey));
  const version = useAppSelector((state) => state.timeTracking?.version ?? 0);
  const paymentVersion = useAppSelector((state) => state.timeTracking?.paymentVersion ?? 0);

  const kindsKey = kinds.join(",");
  const employeeKey = employeeIds.join(",");
  const query = useMemo(
    () => ({
      employeeId,
      employeeIds: employeeId || !employeeKey ? undefined : employeeKey.split(","),
      jobId,
      estimateId,
      kinds: kindsKey.split(",") as RecordKind[],
      from: resolved.from,
      to: resolved.to,
      page: view === "sessions" ? page : 1,
      limit: view === "sessions" ? PAGE_SIZE : BOARD_LIMIT,
    }),
    [employeeId, employeeKey, jobId, estimateId, kindsKey, resolved.from, resolved.to, page, view],
  );
  // Payment history is paged + filtered by the API; earned / remaining per job always cover everything.
  const ledgerQuery = useMemo(
    () => ({
      technician,
      employeeId,
      employeeIds: employeeId || !employeeKey ? undefined : employeeKey.split(","),
      jobId,
      estimateId,
      paymentsPage,
      paymentsLimit: PAGE_SIZE,
      kinds: kindsKey.split(",") as RecordKind[],
    }),
    [technician, employeeId, employeeKey, jobId, estimateId, paymentsPage, kindsKey],
  );

  useEffect(() => {
    void dispatch(fetchTimeEntries({ scopeKey: listScope, query, technician }));
  }, [dispatch, listScope, query, technician]);

  useEffect(() => {
    void dispatch(fetchLedger({ scopeKey, query: ledgerQuery }));
  }, [dispatch, scopeKey, ledgerQuery]);

  // A clock-in/out anywhere (this tab, another device, or the office) refreshes hours and pay.
  useEffect(() => {
    if (!version) return;
    void dispatch(fetchTimeEntries({ scopeKey: listScope, query, technician, force: true }));
    void dispatch(fetchLedger({ scopeKey, query: ledgerQuery, force: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch only when version bumps
  }, [version]);

  // A payout (here or from another device) refreshes paid / remaining immediately.
  useEffect(() => {
    if (!paymentVersion) return;
    void dispatch(fetchLedger({ scopeKey, query: ledgerQuery, force: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch only when a payout lands
  }, [paymentVersion]);

  // Provider pages do not mount the technician bridge, so listen for socket updates here.
  useEffect(() => {
    if (technician) return;
    return subscribeRealtime((detail) => {
      const type = detail?.type;
      if (type !== "TIME_ENTRY_UPDATED" && type !== "TECHNICIAN_PAYMENT_UPDATED") return;
      // Refs may be ids or populated objects — match on the serialized payload.
      const text = detail.payload ? JSON.stringify(detail.payload) : "";
      const ids = [employeeId, jobId, estimateId].filter(Boolean) as string[];
      if (ids.length && !ids.some((id) => text.includes(id))) return;
      if (type === "TIME_ENTRY_UPDATED") {
        void dispatch(fetchTimeEntries({ scopeKey: listScope, query, technician, force: true }));
      }
      void dispatch(fetchLedger({ scopeKey, query: ledgerQuery, force: true }));
    });
  }, [dispatch, technician, scopeKey, listScope, query, ledgerQuery, employeeId, jobId, estimateId]);

  // Ledger rows follow the Jobs / Estimates toggles; totals are re-added from the visible rows.
  const ledgerRows = useMemo(
    () => ledgerState.data.byJob.filter((row) => kinds.includes(ledgerRowKind(row))),
    [ledgerState.data.byJob, kinds],
  );
  const ledgerSummary = useMemo(() => sumLedger(ledgerRows), [ledgerRows]);
  const ledgerByKey = useMemo(
    () => new Map<string, LedgerRow>(ledgerRows.map((row) => [ledgerRowKey(row.employeeId, row.jobId, row.estimateId), row])),
    [ledgerRows],
  );
  const payments = ledgerState.data.payments;
  const paymentsPagination = ledgerState.data.paymentsPagination;

  const hasError = Boolean(list.error || ledgerState.error);
  function retry() {
    void dispatch(fetchTimeEntries({ scopeKey: listScope, query, technician, force: true }));
    void dispatch(fetchLedger({ scopeKey, query: ledgerQuery, force: true }));
  }

  // After a dropped connection (e.g. the API restarting), retry when the tab regains focus or the network returns.
  useEffect(() => {
    if (!hasError) return;
    const onBack = () => {
      if (document.visibilityState === "hidden") return;
      void dispatch(fetchTimeEntries({ scopeKey: listScope, query, technician, force: true }));
      void dispatch(fetchLedger({ scopeKey, query: ledgerQuery, force: true }));
    };
    window.addEventListener("online", onBack);
    window.addEventListener("focus", onBack);
    return () => {
      window.removeEventListener("online", onBack);
      window.removeEventListener("focus", onBack);
    };
  }, [hasError, dispatch, listScope, query, technician, scopeKey, ledgerQuery]);

  async function stop(entry: TimeEntry) {
    setStoppingId(entry.id);
    const result = await dispatch(stopTimeEntryThunk(entry.id));
    setStoppingId(null);
    if (stopTimeEntryThunk.rejected.match(result)) {
      toast.error(result.payload || "Could not stop the timer.");
    } else {
      toast.success("Timer stopped and time entry saved.");
    }
  }

  const onPay = canPay ? (row: LedgerRow) => pay.start(row) : undefined;
  const onStop = allowStop ? (entry: TimeEntry) => void stop(entry) : undefined;
  const showTechFilter = Boolean(employeeOptions && !employeeId);
  const loadingFirst = list.loading && !list.items.length;

  return (
    <div className="space-y-3">
      {header}

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border-soft bg-card p-2">
        <TimeRangeFilter
          value={range}
          onChange={(next) => {
            setRange(next);
            setPage(1);
          }}
        />
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          {showTechFilter ? (
            <TechnicianMultiSelect
              options={employeeOptions ?? []}
              value={employeeIds}
              onChange={(next) => {
                setEmployeeIds(next);
                setPage(1);
                setPaymentsPage(1);
              }}
            />
          ) : null}
          {!jobId && !estimateId ? (
            <RecordTypeFilter
              value={kinds}
              onChange={(next) => {
                setKinds(next);
                setPage(1);
                setPaymentsPage(1);
              }}
            />
          ) : null}
        </div>
      </div>

      <TimesheetKpis summary={list.summary} ledger={ledgerSummary} payRate={payRate} />

      {hasError ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <span>{list.error || ledgerState.error}</span>
          <Button size="xs" variant="outline" className="h-7 border-red-300 bg-white" onClick={retry} disabled={list.loading}>
            {list.loading ? "Retrying…" : "Retry"}
          </Button>
        </div>
      ) : null}


      <div className="inline-flex rounded-md border border-input bg-card p-0.5" role="tablist" aria-label="Timesheet view">
        {VIEWS.map((item) => {
          const Icon = item.icon;
          const active = view === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setView(item.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[4px] px-3 py-1.5 text-xs font-medium transition-colors",
                active ? "bg-[#003F7D] text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" aria-hidden />
              {item.label}
              {item.id === "payments" && ledgerSummary.remaining > 0 ? (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
                    active ? "bg-white/20" : "bg-amber-100 text-amber-800",
                  )}
                >
                  {ledgerRows.filter((row) => row.remaining > 0).length}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {view === "board" ? (
        <WeekBoard
          entries={list.items}
          from={resolved.from}
          to={resolved.to}
          loading={list.loading}
          showEmployee={showEmployee}
          hrefFor={hrefFor}
          ledgerByKey={ledgerByKey}
          onPay={onPay}
          onStop={onStop}
          stoppingId={stoppingId}
        />
      ) : null}

      {view === "sessions" ? (
        <TimeEntriesTable
          entries={list.items}
          loading={list.loading}
          empty={loadingFirst ? "Loading time entries…" : "No time tracked in this period."}
          showEmployee={showEmployee}
          hrefFor={hrefFor}
          onStop={onStop}
          stoppingId={stoppingId}
          pagination={{
            page: list.page,
            pageSize: PAGE_SIZE,
            total: list.total,
            totalPages: list.totalPages,
            onPageChange: setPage,
          }}
        />
      ) : null}

      {view === "payments" ? (
        <div className="space-y-3">
          {/* Inner tabs: balances to pay vs. payouts already made. */}
          <div className="flex gap-1 border-b border-[#94a3b8] dark:border-border" role="tablist" aria-label="Payments">
            {[
              {
                id: "balances" as const,
                label: `Payement  remaining by ${jobId ? "technician" : "job"}`,
                count: ledgerRows.length,
                owed: ledgerRows.filter((row) => row.remaining > 0).length,
              },
              { id: "history" as const, label: "Payment history", count: paymentsPagination.total, owed: 0 },
            ].map((tab) => {
              const active = paymentsTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setPaymentsTab(tab.id)}
                  className={cn(
                    "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "border-[#003F7D] text-[#003F7D] dark:text-blue-200"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab.label}
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                      active ? "bg-[#e8eef5] text-[#003F7D]" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {tab.count}
                  </span>
                  {tab.owed ? (
                    <span className="rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-800">
                      {tab.owed} unpaid
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {paymentsTab === "balances" ? (
            <LedgerTable
              rows={ledgerRows}
              loading={ledgerState.loading && !ledgerState.loaded}
              showEmployee={showEmployee}
              hrefFor={hrefFor}
              onPay={onPay}
            />
          ) : (
            <PaymentHistoryTable
              payments={payments}
              showEmployee={showEmployee}
              hrefFor={hrefFor}
              loading={ledgerState.loading}
              pagination={{
                page: paymentsPagination.page,
                pageSize: PAGE_SIZE,
                total: paymentsPagination.total,
                totalPages: paymentsPagination.totalPages,
                onPageChange: setPaymentsPage,
              }}
            />
          )}
        </div>
      ) : null}

      {canPay ? <PayTechnicianDialog key={pay.key} row={pay.row} open={pay.open} onOpenChange={pay.setOpen} /> : null}
    </div>
  );
}
