"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clock3, Mail, Phone } from "lucide-react";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { PortalPage } from "@/components/portal/portal-page";
import { RecordWorkspace } from "@/components/portal/record-workspace";
import {
  ClockControl,
  DetailCard,
  EmptyNote,
  EstimateStatusPill,
  JobStatusPill,
  KeyValue,
  LocationBlock,
  customerName,
} from "@/components/technician/tech-ui";
import { MetaItem, TabHeading, TechLabourMaterial } from "@/components/technician/views/technician-job-detail-view";
import { useTechSectionSeen } from "@/components/technician/use-tech-section-seen";
import { TimeTrackingPanel } from "@/components/time-tracking/time-tracking-panel";
import { Button } from "@/components/ui/button";
import { CenteredSpinner } from "@/components/ui/spinner";
import { formatClock } from "@/lib/data/portal";
import { formatDate, formatMoney } from "@/lib/format";
import { technicianPaths } from "@/lib/technician-paths";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  TECH_PAGE_SIZE,
  fetchTechEstimate,
  fetchTechEstimates,
} from "@/store/technicianSlice";

export function TechnicianEstimatesView() {
  const dispatch = useAppDispatch();
  const { data, loading, error } = useAppSelector((state) => state.technician.estimates);
  const version = useAppSelector((state) => state.technician.versions.estimates);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);

  useTechSectionSeen("estimates");

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(search), 300);
    return () => window.clearTimeout(id);
  }, [search]);

  useEffect(() => {
    // Fresh data on every visit; cached rows stay visible while it loads.
    void dispatch(fetchTechEstimates({ page, limit: TECH_PAGE_SIZE, search: debounced, force: true }));
  }, [dispatch, page, debounced, version]);

  return (
    <PortalPage
      eyebrow="Technician / Estimates"
      title={`My estimates${data ? ` (${data.total})` : ""}`}
      description="Site visits and estimates assigned to you, or linked to jobs you work on."
    >
      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
      <PortalDataTable
        filename="my-estimates"
        countLabel="Estimates"
        searchPlaceholder="Search estimate # or customer"
        loading={loading && !data}
        empty={debounced ? "No estimates match your search." : "No estimates assigned to you yet."}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        rowHref={(row) => technicianPaths.estimate(row.id)}
        serverPagination={{
          page,
          pageSize: TECH_PAGE_SIZE,
          total: data?.total ?? 0,
          totalPages: data?.totalPages ?? 1,
          onPageChange: setPage,
          search,
          onSearchChange: (value) => {
            setSearch(value);
            setPage(1);
          },
        }}
        columns={[
          {
            id: "number",
            header: "Estimate #",
            sortValue: (row) => row.number,
            exportValue: (row) => row.number,
            cell: (row) => (
              <div>
                <Link href={technicianPaths.estimate(row.id)} className="font-semibold text-primary hover:underline">
                  {row.number}
                </Link>
                {row.title ? <p className="truncate text-xs text-muted-foreground">{row.title}</p> : null}
              </div>
            ),
          },
          {
            id: "customer",
            header: "Customer",
            sortValue: (row) => customerName(row.customer, row.customerSnapshot),
            exportValue: (row) => customerName(row.customer, row.customerSnapshot),
            cell: (row) => customerName(row.customer, row.customerSnapshot),
          },
          {
            id: "address",
            header: "Property",
            className: "min-w-56",
            exportValue: (row) => String(row.propertyAddress?.address || ""),
            cell: (row) => (
              <LocationBlock
                location={row.propertyAddress}
                compact
                record={{ recordType: "estimate", recordNumber: row.number, customerName: customerName(row.customer, row.customerSnapshot) }}
              />
            ),
          },
          {
            id: "visit",
            header: "Visit date",
            sortValue: (row) => row.scheduledDate || "",
            exportValue: (row) => (row.scheduledDate ? formatDate(row.scheduledDate) : ""),
            cell: (row) => (row.scheduledDate ? formatDate(row.scheduledDate) : "—"),
          },
          {
            id: "status",
            header: "Status",
            sortValue: (row) => row.status,
            exportValue: (row) => row.status,
            cell: (row) => <EstimateStatusPill status={row.status} />,
          },
        ]}
        actions={(row) => [{ label: "Open estimate", href: technicianPaths.estimate(row.id) }]}
      />
    </PortalPage>
  );
}

export function TechnicianEstimateDetailView({ id }: { id: string }) {
  const dispatch = useAppDispatch();
  const entry = useAppSelector((state) => state.technician.estimateDetails[id]);
  const version = useAppSelector((state) => state.technician.versions.estimates);
  const timeVersion = useAppSelector((state) => state.timeTracking.version);

  useEffect(() => {
    void dispatch(fetchTechEstimate(id));
  }, [dispatch, id, version, timeVersion]);

  const data = entry?.data;
  const items = useMemo(() => data?.estimate.items ?? [], [data]);

  if (!data) {
    if (!entry || entry.loading) {
      return (
        <div className="rounded-md border border-input bg-card">
          <CenteredSpinner label="Loading estimate" className="min-h-[22rem]" />
        </div>
      );
    }
    return (
      <PortalPage eyebrow="Technician / Estimates" title="Estimate not available">
        <EmptyNote>{entry.error || "This estimate is not assigned to you."}</EmptyNote>
        <Button asChild size="sm" className="h-8 w-fit">
          <Link href={technicianPaths.estimates}>Back to my estimates</Link>
        </Button>
      </PortalPage>
    );
  }

  const { estimate, job, schedule } = data;
  const snapshot = (estimate.customerSnapshot || {}) as Record<string, unknown>;
  const customer = estimate.customer;
  const name = customerName(customer, snapshot);
  const phone = customer?.phone || String(snapshot.phone || "");
  const email = customer?.email || String(snapshot.email || "");
  const visit = (estimate.siteVisit || {}) as Record<string, unknown>;
  const location =
    estimate.propertyAddress && Object.keys(estimate.propertyAddress).length
      ? estimate.propertyAddress
      : (snapshot.address as Record<string, unknown>) || null;
  const notes = estimate.notes ? String(estimate.notes).replace(/<[^>]+>/g, "") : "";

  const tabs = [
    { id: "summary", label: "Summary" },
    { id: "visit", label: "Site visit" },
    { id: "materials", label: `Labour & Material (${items.length})` },
    { id: "time", label: "My time", icon: Clock3 },
    ...(notes ? [{ id: "notes", label: "Notes" }] : []),
  ];

  return (
    <div className="overflow-hidden rounded-md border border-input">
      <RecordWorkspace
        href={technicianPaths.estimate(estimate.id)}
        label={`${estimate.number}${estimate.title ? ` · ${estimate.title}` : ""}`}
        kind="estimate"
        trackOpen={false}
        badge={<EstimateStatusPill status={estimate.status} />}
        actions={
          <Button asChild size="sm" variant="outline" className="h-8">
            <Link href={technicianPaths.estimates}>
              <ArrowLeft className="size-3.5" /> My estimates
            </Link>
          </Button>
        }
        metaBar={
          <>
            <MetaItem label="Customer" value={name} />
            <MetaItem label="Visit" value={estimate.scheduledDate ? formatDate(estimate.scheduledDate) : "Not scheduled"} />
            <MetaItem label="Total" value={formatMoney(Number(estimate.total) || 0)} />
          </>
        }
        tabs={tabs}
        subnavTabs={["materials", "time"]}
        subnav={(tab) =>
          tab === "materials" ? (
            <TabHeading title="Labour & Material" hint="Scope priced by the office. Read only." />
          ) : (
            <TabHeading title="My time on this estimate" hint="Every clock-in on this estimate, with hours and pay." />
          )
        }
      >
        {(tab) => {
          if (tab === "visit") {
            return (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <KeyValue label="Visit date" value={estimate.scheduledDate ? formatDate(estimate.scheduledDate) : "—"} />
                  <KeyValue label="Access notes" value={String(visit.accessNotes || "")} />
                  <KeyValue label="Measurements" value={String(visit.measurements || "")} />
                  <KeyValue label="Findings" value={String(visit.findings || "")} />
                  <KeyValue label="Recommendations" value={String(visit.recommendations || "")} />
                </div>
                <DetailCard title="Booked visits">
                  {schedule.length ? (
                    <ul className="divide-y divide-border-soft text-sm">
                      {schedule.map((row) => (
                        <li key={row.id} className="flex justify-between gap-2 py-2">
                          <span className="font-medium">{formatDate(row.date)}</span>
                          <span className="text-muted-foreground tabular-nums">
                            {formatClock(row.startMinutes)}–{formatClock(row.endMinutes)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No visit booked for you yet.</p>
                  )}
                </DetailCard>
              </div>
            );
          }
          if (tab === "materials") {
            return (
              <TechLabourMaterial
                items={items}
                noun="estimate"
                tax={Number(estimate.tax) || 0}
                total={Number(estimate.total) || undefined}
              />
            );
          }
          if (tab === "time") {
            return (
              <TimeTrackingPanel
                scopeKey={`tech:estimate:${estimate.id}`}
                technician
                estimateId={estimate.id}
                defaultRange={{ preset: "all" }}
                defaultView="sessions"
                hrefFor={(kind, recordId) => (kind === "job" ? technicianPaths.job(recordId) : technicianPaths.estimate(recordId))}
              />
            );
          }
          if (tab === "notes") {
            return <p className="text-sm whitespace-pre-wrap">{notes}</p>;
          }
          return (
            <div className="space-y-3">
              <ClockControl target={{ kind: "estimate", id: estimate.id }} />
              <div className="grid gap-3 lg:grid-cols-3">
                <DetailCard title="Customer">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">{name}</p>
                    {phone ? (
                      <a href={`tel:${phone}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                        <Phone className="size-3.5" aria-hidden /> {phone}
                      </a>
                    ) : null}
                    {email ? (
                      <a href={`mailto:${email}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                        <Mail className="size-3.5" aria-hidden /> {email}
                      </a>
                    ) : null}
                  </div>
                </DetailCard>
                <DetailCard title="Property" className="lg:col-span-2">
                  <LocationBlock
                    location={location}
                    record={{ recordType: "estimate", recordNumber: estimate.number, customerName: name }}
                  />
                </DetailCard>
              </div>
              {job ? (
                <DetailCard title="Linked job">
                  <span className="flex items-center gap-2 text-sm">
                    <Link href={technicianPaths.job(job.id)} className="font-semibold text-primary hover:underline">
                      {job.number || "Job"}
                    </Link>
                    {job.title ? <span className="text-muted-foreground">· {job.title}</span> : null}
                    {job.status ? <JobStatusPill status={job.status} /> : null}
                  </span>
                </DetailCard>
              ) : null}
            </div>
          );
        }}
      </RecordWorkspace>
    </div>
  );
}
