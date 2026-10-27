"use client";

import { useEffect, useState } from "react";
import { ContractorTimesheet, rangeBounds } from "@/components/portal/contractor-timesheet";
import { PortalPage } from "@/components/portal/portal-page";
import {
  TIMESHEET_BOARD_LIMIT,
  TIMESHEET_PAGE_SIZE,
  TimeTrackingPanel,
  boardScopeKey,
  panelLedgerQuery,
  panelListQuery,
} from "@/components/time-tracking/time-tracking-panel";
import type { EmployeeOption } from "@/components/time-tracking/timesheet-ui";
import { queryTeam } from "@/lib/api/crm-client";
import { mapPortalEmployee } from "@/lib/api/crm-mappers";
import { getTimesheetBundle } from "@/lib/api/technician-client";
import { employeeName, employeeRoleLabel, type PortalEmployee } from "@/lib/data/portal";
import { resolveTimeRange, type TimeEntry, type TimeRange } from "@/lib/time-tracking";
import { CenteredSpinner } from "@/components/ui/spinner";
import { useAppDispatch } from "@/store/hooks";
import { timesheetSeeded } from "@/store/timeTrackingSlice";

const SCOPE_KEY = "timesheets";
const DEFAULT_RANGE: TimeRange = { preset: "week" };

function toOptions(items: PortalEmployee[]): EmployeeOption[] {
  return items
    .filter((item) => item.active !== false)
    .map((item) => ({
      id: item.id,
      label: employeeName(item) || item.email || "Team member",
      role: employeeRoleLabel(item.role),
      hourlyRate: item.hourlyRate,
      loginEnabled: item.loginEnabled,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Global timesheet (Pro level): every technician on one week board, with
 * technician / record-type filters, a technician roster, and payouts.
 *
 * Opens with one call (sessions + pay + contractor hours + team); later filter
 * changes fetch only the part that changed.
 */
export function TimesheetsView() {
  const dispatch = useAppDispatch();
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [contractorRows, setContractorRows] = useState<TimeEntry[] | null>(null);
  /** First load settled (bundle in, or it failed and each section loads on its own). */
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const scope = { employeeKey: "", kindsKey: "job,estimate" };
    const range = resolveTimeRange(DEFAULT_RANGE);
    const listQuery = panelListQuery(scope, range, "board", 1);
    const ledgerQuery = panelLedgerQuery(scope, 1);
    const contractor = rangeBounds("week");

    getTimesheetBundle({
      from: listQuery.from,
      to: listQuery.to,
      kinds: listQuery.kinds,
      limit: TIMESHEET_BOARD_LIMIT,
      paymentsLimit: TIMESHEET_PAGE_SIZE,
      contractorFrom: contractor.from.toISOString(),
      contractorTo: contractor.to.toISOString(),
      contractorLimit: 200,
    })
      .then((bundle) => {
        if (cancelled) return;
        dispatch(
          timesheetSeeded({
            listScope: boardScopeKey(SCOPE_KEY),
            listQuery,
            entries: bundle.entries,
            ledgerScope: SCOPE_KEY,
            ledgerQuery,
            ledger: bundle.ledger,
          }),
        );
        setContractorRows(bundle.contractorEntries?.items ?? null);
        if (bundle.team) {
          setEmployees(toOptions(bundle.team.map(mapPortalEmployee).filter((item): item is PortalEmployee => Boolean(item))));
          setStatus("ready");
        } else {
          setStatus("failed");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("failed");
      })
      .finally(() => {
        if (!cancelled) setOpened(true);
      });
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  // Fallback only: the team list on its own when the bundle didn't bring it (retries on focus / network back).
  useEffect(() => {
    if (status !== "failed") return;
    let cancelled = false;

    function load() {
      queryTeam({ page: 1, limit: 100, silent: true })
        .then((result) => {
          if (cancelled) return;
          setEmployees(toOptions(result.items));
          setStatus("ready");
        })
        .catch(() => {});
    }

    function retry() {
      if (document.visibilityState !== "hidden") load();
    }

    load();
    window.addEventListener("focus", retry);
    window.addEventListener("online", retry);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", retry);
      window.removeEventListener("online", retry);
    };
  }, [status]);

  return (
    <PortalPage
      eyebrow="People / Timesheets"
      title="Timesheets"
      description="Clocked hours for every technician, week by week — review sessions, compare crews, and pay what's owed."
    >
      {status === "failed" ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Could not load the team list for the technician filter. It retries automatically.
        </p>
      ) : null}
      {opened ? (
        <>
          <TimeTrackingPanel
            scopeKey={SCOPE_KEY}
            defaultRange={DEFAULT_RANGE}
            employeeOptions={employees}
            showEmployee
            canPay
            allowStop
            hrefFor={(kind, id) => (kind === "job" ? `/pro/dashboard/jobs/${id}?tab=time` : `/pro/dashboard/estimates/${id}`)}
          />
          <ContractorTimesheet initialRows={contractorRows} />
        </>
      ) : (
        <CenteredSpinner />
      )}
    </PortalPage>
  );
}
