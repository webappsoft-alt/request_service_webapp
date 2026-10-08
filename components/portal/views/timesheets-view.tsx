"use client";

import { useEffect, useState } from "react";
import { ContractorTimesheet } from "@/components/portal/contractor-timesheet";
import { PortalPage } from "@/components/portal/portal-page";
import { TimeTrackingPanel } from "@/components/time-tracking/time-tracking-panel";
import type { EmployeeOption } from "@/components/time-tracking/timesheet-ui";
import { queryTeam } from "@/lib/api/crm-client";
import { employeeName, employeeRoleLabel } from "@/lib/data/portal";

/**
 * Global timesheet (Pro level): every technician on one week board, with
 * technician / record-type filters, a technician roster, and payouts.
 */
export function TimesheetsView() {
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    let cancelled = false;
    let loaded = false;

    function load() {
      queryTeam({ page: 1, limit: 100, silent: true })
        .then((result) => {
          if (cancelled) return;
          loaded = true;
          setEmployees(
            result.items
              .filter((item) => item.active !== false)
              .map((item) => ({
                id: item.id,
                label: employeeName(item) || item.email || "Team member",
                role: employeeRoleLabel(item.role),
                hourlyRate: item.hourlyRate,
                loginEnabled: item.loginEnabled,
              }))
              .sort((a, b) => a.label.localeCompare(b.label)),
          );
          setStatus("ready");
        })
        .catch(() => {
          if (!cancelled) setStatus("failed");
        });
    }

    // Retry the team list when the tab regains focus or the network returns (e.g. API restarted).
    function retry() {
      if (!loaded && document.visibilityState !== "hidden") load();
    }

    load();
    window.addEventListener("focus", retry);
    window.addEventListener("online", retry);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", retry);
      window.removeEventListener("online", retry);
    };
  }, []);

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
      <TimeTrackingPanel
        scopeKey="timesheets"
        defaultRange={{ preset: "week" }}
        employeeOptions={employees}
        showEmployee
        canPay
        allowStop
        hrefFor={(kind, id) => (kind === "job" ? `/pro/dashboard/jobs/${id}?tab=time` : `/pro/dashboard/new-estimate/${id}`)}
      />
      <ContractorTimesheet />
    </PortalPage>
  );
}
