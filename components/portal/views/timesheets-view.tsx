"use client";

import { useEffect } from "react";
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
import { resolveTimeRange, type TimeRange } from "@/lib/time-tracking";
import { CenteredSpinner } from "@/components/ui/spinner";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  timesheetBundleFailed,
  timesheetBundleLoaded,
  timesheetBundleStarted,
  timesheetTeamLoaded,
} from "@/store/timeTrackingSlice";

const SCOPE_KEY = "timesheets";
const DEFAULT_RANGE: TimeRange = { preset: "week" };
const NO_EMPLOYEES: EmployeeOption[] = [];

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
 * Opens with one call (sessions + pay + contractor hours + team), kept in the time-tracking
 * slice: the first visit shows a spinner, later visits show the saved copy at once while the
 * same call refreshes it in the background. Filter changes fetch only the part that changed.
 */
export function TimesheetsView() {
  const dispatch = useAppDispatch();
  const page = useAppSelector((state) => state.timeTracking.timesheets);
  const employees = page.team ?? NO_EMPLOYEES;
  const teamMissing = page.failed || (page.loaded && !page.team);

  // Every visit: (re)load the opening bundle — in the background when a copy is already shown.
  useEffect(() => {
    let cancelled = false;
    const scope = { employeeKey: "", kindsKey: "job,estimate" };
    const range = resolveTimeRange(DEFAULT_RANGE);
    const listQuery = panelListQuery(scope, range, "board", 1);
    const ledgerQuery = panelLedgerQuery(scope, 1);
    const contractor = rangeBounds("week");

    dispatch(timesheetBundleStarted());
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
        const team = bundle.team
          ? toOptions(bundle.team.map(mapPortalEmployee).filter((item): item is PortalEmployee => Boolean(item)))
          : null;
        dispatch(
          timesheetBundleLoaded({
            listScope: boardScopeKey(SCOPE_KEY),
            listQuery,
            entries: bundle.entries,
            ledgerScope: SCOPE_KEY,
            ledgerQuery,
            ledger: bundle.ledger,
            team,
            contractorRows: bundle.contractorEntries?.items ?? null,
          }),
        );
      })
      .catch(() => {
        if (!cancelled) dispatch(timesheetBundleFailed());
      });
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  // Fallback only: the team list on its own when the bundle didn't bring it (retries on focus / network back).
  useEffect(() => {
    if (!teamMissing) return;
    let cancelled = false;

    function load() {
      queryTeam({ page: 1, limit: 100, silent: true })
        .then((result) => {
          if (!cancelled) dispatch(timesheetTeamLoaded(toOptions(result.items)));
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
  }, [dispatch, teamMissing]);

  // Spinner only on the very first visit; afterwards the saved copy shows while it refreshes.
  const ready = page.loaded || page.failed;

  return (
    <PortalPage
      eyebrow="People / Timesheets"
      title="Timesheets"
      description="Clocked hours for every technician, week by week — review sessions, compare crews, and pay what's owed."
    >
      {teamMissing && !page.team ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Could not load the team list for the technician filter. It retries automatically.
        </p>
      ) : null}
      {ready ? (
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
          <ContractorTimesheet initialRows={page.contractorRows} />
        </>
      ) : (
        <CenteredSpinner />
      )}
    </PortalPage>
  );
}
