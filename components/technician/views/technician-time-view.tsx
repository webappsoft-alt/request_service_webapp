"use client";

import { PortalPage } from "@/components/portal/portal-page";
import { TimeTrackingPanel } from "@/components/time-tracking/time-tracking-panel";
import { formatMoney } from "@/lib/format";
import { technicianPaths } from "@/lib/technician-paths";
import { useAppSelector } from "@/store/hooks";

/**
 * Technician timesheet — the same card-based week board the office uses,
 * locked to the logged-in technician. "This month" gives the monthly view.
 */
export function TechnicianTimeView() {
  const payRate = useAppSelector((state) => Number(state.technician.profile.data?.employee?.hourlyRate) || 0);

  return (
    <PortalPage
      eyebrow="Technician / Time tracking"
      title="My timesheet"
      description={`Every clock-in and clock-out you've recorded, with hours and pay${payRate ? ` (${formatMoney(payRate)}/hr)` : ""}.`}
    >
      <TimeTrackingPanel
        scopeKey="tech"
        technician
        defaultRange={{ preset: "week" }}
        payRate={payRate}
        hrefFor={(kind, id) => (kind === "job" ? technicianPaths.job(id) : technicianPaths.estimate(id))}
      />
    </PortalPage>
  );
}
