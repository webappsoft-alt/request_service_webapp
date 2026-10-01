"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import { AssignEventDialog } from "@/components/portal/assign-event-dialog";
import { EventCalendar, EventCalendarSkeleton, type CalendarMove } from "@/components/portal/event-calendar";
import { PortalPage } from "@/components/portal/portal-page";
import { useCrmApiData } from "@/components/portal/use-crm-api-data";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";
import { usePortalCrew } from "@/components/portal/use-portal-crew";
import { Button } from "@/components/ui/button";
import { querySchedule } from "@/lib/api/crm-client";
import type { PortalCalendarEvent, PortalEventKind } from "@/lib/data/portal";
import {
  calendarEventKindLabel,
  employeeName,
  formatClock,
  windowFromMinutes,
} from "@/lib/data/portal";
import { formatDate } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchTeam } from "@/store/teamSlice";

export type ScheduleMemberOption = {
  id: string;
  label: string;
  kind: "employee" | "contractor";
};

function formatScheduleError(error: unknown): string {
  const raw = extractErrorMessage(error);
  const match = raw.match(
    /already has appointment ['"]?([^'"]+)['"]? booked between minutes (\d+) and (\d+)/i,
  );
  if (match) {
    const [, label, startRaw, endRaw] = match;
    const fmt = (total: number) => {
      const hours24 = Math.floor(total / 60) % 24;
      const minutes = total % 60;
      const period = hours24 >= 12 ? "PM" : "AM";
      const hours12 = hours24 % 12 || 12;
      return `${hours12}:${String(minutes).padStart(2, "0")} ${period}`;
    };
    return `This person already has ${label} booked (${fmt(Number(startRaw))}–${fmt(Number(endRaw))}). Pick another time or assignee.`;
  }
  return raw || "Could not update the schedule.";
}

export function ScheduleView() {
  const searchParams = useSearchParams();
  const initialEmployeeId =
    searchParams.get("employeeId")?.trim() || searchParams.get("employee")?.trim() || "";
  const dispatch = useAppDispatch();
  const crm = useCrmApiData();
  const crmEnabled = crm.enabled;
  const ensureCrmLoaded = crm.ensureLoaded;
  const team = useAppSelector((state) => state.team.items);
  const teamLoading = useAppSelector((state) => state.team.loading);
  const { contractors } = useCrmDirectory();
  const { assign, employeeLabel, removeSchedule } = usePortalCrew();

  const [events, setEvents] = useState<PortalCalendarEvent[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [memberFilter, setMemberFilter] = useState(initialEmployeeId);
  const [kindFilter, setKindFilter] = useState<PortalEventKind | "">("");
  const [editing, setEditing] = useState<PortalCalendarEvent | null>(null);

  const memberOptions = useMemo<ScheduleMemberOption[]>(() => {
    const employeeRows = (team.length ? team : []).filter((item) => item.active !== false).map(
      (item) => ({
        id: item.id,
        label: employeeName(item),
        kind: "employee" as const,
      }),
    );
    const contractorRows = contractors
      .filter((item) => item.status === "active")
      .map((item) => ({
        id: item.id,
        label: `${item.companyName} · Contractor`,
        kind: "contractor" as const,
      }));
    return [...employeeRows, ...contractorRows];
  }, [contractors, team]);

  const memberOptionsRef = useRef(memberOptions);
  memberOptionsRef.current = memberOptions;

  const enrichedEvents = useMemo(() => {
    const formatAddrObj = (addr?: { address?: string; street?: string; city?: string; state?: string; zip?: string } | null) => {
      if (!addr) return undefined;
      const street = (addr.address || addr.street || "").trim();
      const city = (addr.city || "").trim();
      const state = (addr.state || "").trim();
      const zip = (addr.zip || "").trim();
      const loc = city && state ? `${city}, ${state}` : city || state;
      const parts = [street, loc, zip].filter(Boolean);
      return parts.length ? parts.join(" ") : undefined;
    };

    return events.map((event) => {
      let notes = event.notes;
      let detail = event.detail;
      let customerName = event.customerName;
      let serviceAddress = event.serviceAddress;
      let price = event.price;
      let category = event.category;
      let foundCustomerId: string | undefined;

      if ((event.kind === "job" || event.kind === "fixed_service") && event.recordId) {
        const job = crm.jobs.find((j) => j.id === event.recordId);
        if (job) {
          if (!notes) notes = job.notes || (job as unknown as Record<string, unknown>).description ? String(job.notes || (job as unknown as Record<string, unknown>).description) : "";
          if (!customerName && ((job as unknown as Record<string, unknown>).customerName || job.assignedTo)) {
            customerName = String((job as unknown as Record<string, unknown>).customerName || "");
          }
          const jobName =
            job.title && job.title !== job.number
              ? job.title
              : (job as unknown as Record<string, unknown>).serviceName
                ? String((job as unknown as Record<string, unknown>).serviceName)
                : job.items?.[0]?.description || undefined;
          if (!detail || detail === event.title) detail = jobName || detail;
          if (!serviceAddress && job.address) serviceAddress = formatAddrObj(job.address);
          if (!price) {
            const rawJobTotal =
              (job as unknown as Record<string, unknown>).totalAmount ??
              (job as unknown as Record<string, unknown>).total ??
              (job as unknown as Record<string, unknown>).price ??
              (Array.isArray(job.items)
                ? job.items.reduce(
                    (s: number, it) =>
                      s + (Number(it.total) || (Number(it.quantity) || 1) * (Number(it.unitPrice) || 0) || 0),
                    0,
                  )
                : 0);
            const jobNum = Number(rawJobTotal);
            if (!Number.isNaN(jobNum) && jobNum > 0) price = `$${jobNum.toFixed(2)}`;
          }
          if (!category) category = jobName || undefined;
          foundCustomerId = job.customerId;
        }
      } else if (event.kind === "estimate" && event.recordId) {
        const est = crm.estimates.find((e) => e.id === event.recordId);
        if (est) {
          if (!notes) notes = est.notes || est.terms || "";
          if (!customerName && est.customerName) customerName = est.customerName;
          const estName =
            est.title && est.title !== est.number
              ? est.title
              : est.items?.[0]?.name || est.items?.[0]?.description || undefined;
          if (!detail || detail === event.title) detail = estName || detail;
          if (!serviceAddress && est.propertyAddress) serviceAddress = formatAddrObj(est.propertyAddress);
          if (!price) {
            const rawEstTotal =
              est.total ??
              est.subtotal ??
              (Array.isArray(est.items)
                ? est.items.reduce(
                    (s: number, it) =>
                      s + (Number(it.total) || (Number(it.quantity) || 1) * (Number(it.unitPrice) || 0) || 0),
                    0,
                  )
                : 0);
            const estNum = Number(rawEstTotal);
            if (!Number.isNaN(estNum) && estNum > 0) price = `$${estNum.toFixed(2)}`;
          }
          if (!category) category = estName || undefined;
          foundCustomerId = est.customerId;
        }
      } else if (event.kind === "request" && event.recordId) {
        const req = crm.requests.find((r) => r.id === event.recordId);
        if (req) {
          if (!notes) notes = req.notes || req.description || "";
          if (!customerName && req.customerName) customerName = req.customerName;
          const reqName = req.serviceName || req.title || undefined;
          if (!detail || detail === event.title) detail = reqName || detail;
          if (!serviceAddress && req.address) {
            serviceAddress =
              typeof req.address === "string" ? req.address : formatAddrObj(req.address);
          }
          if (!price) {
            const reqBudget =
              (req as unknown as Record<string, unknown>).budget ??
              (req as unknown as Record<string, unknown>).startingPrice ??
              (req as unknown as Record<string, unknown>).price;
            const reqNum = Number(reqBudget);
            if (!Number.isNaN(reqNum) && reqNum > 0) price = `$${reqNum.toFixed(2)}`;
          }
          if (!category) category = reqName || undefined;
          foundCustomerId = req.customerId;
        }
      } else if (event.kind === "task" && event.recordId) {
        const task = crm.tasks.find((t) => t.id === event.recordId);
        if (task) {
          if (!notes) notes = task.notes || task.description || "";
          if (!customerName && task.customerName) customerName = task.customerName;
          const taskName = task.title && task.title !== task.number ? task.title : undefined;
          if (!detail || detail === event.title) detail = taskName || detail;
          if (!category) category = taskName || undefined;
          foundCustomerId = task.customerId;
        }
      } else if (event.kind === "invoice" && event.recordId) {
        const inv = crm.invoices.find((i) => i.id === event.recordId);
        if (inv) {
          if (!notes) notes = inv.notes || "";
          if (!customerName && inv.customerName) customerName = inv.customerName;
          if (!price && typeof inv.total === "number" && inv.total > 0) {
            price = `$${inv.total.toFixed(2)}`;
          }
          foundCustomerId = inv.customerId;
        }
      }

      // If serviceAddress is still missing, fallback to customer profile primary address
      if (!serviceAddress && foundCustomerId) {
        const cust = crm.customers.find((c) => c.id === foundCustomerId);
        if (cust?.addresses?.[0]) {
          serviceAddress = formatAddrObj(cust.addresses[0]);
        }
      }

      return {
        ...event,
        notes: notes || undefined,
        detail,
        customerName,
        serviceAddress: serviceAddress || undefined,
        price: price || undefined,
        category: category || undefined,
      };
    });
  }, [crm.customers, crm.estimates, crm.invoices, crm.jobs, crm.requests, crm.tasks, events]);

  const employeesForCalendar = useMemo(
    () =>
      memberOptions.map((item) => ({
        id: item.id,
        firstName: item.label,
        lastName: "",
        role: "technician" as const,
        trade: item.kind === "contractor" ? "Contractor" : "",
        email: "",
        phone: "",
        active: true,
      })),
    [memberOptions],
  );

  const resolveMemberLabel = useCallback(
    (id?: string) => {
      if (!id) return "Unassigned";
      const hit = memberOptions.find((item) => item.id === id);
      if (hit) return hit.label;
      return employeeLabel(id);
    },
    [employeeLabel, memberOptions],
  );

  useEffect(() => {
    void dispatch(fetchTeam({ limit: 100 }));
    if (crmEnabled) void ensureCrmLoaded();
  }, [crmEnabled, dispatch, ensureCrmLoaded]);

  const loadSchedule = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!opts?.quiet) setScheduleLoading(true);
    try {
      const selected = memberOptionsRef.current.find((item) => item.id === memberFilter);
      const items = await querySchedule({
        employeeId:
          selected?.kind === "employee"
            ? memberFilter
            : memberFilter && !selected
              ? memberFilter
              : undefined,
        contractorId: selected?.kind === "contractor" ? memberFilter : undefined,
        kind: kindFilter || undefined,
        force: true,
        silent: true,
      });
      setEvents(items);
    } catch (error) {
      toast.error(formatScheduleError(error));
      setEvents([]);
    } finally {
      setScheduleLoading(false);
    }
  }, [kindFilter, memberFilter]);

  useEffect(() => {
    void loadSchedule();
  }, [loadSchedule]);

  useEffect(() => {
    if (initialEmployeeId) setMemberFilter(initialEmployeeId);
  }, [initialEmployeeId]);

  function moveEvent(event: PortalCalendarEvent, move: CalendarMove) {
    // Optimistically update schedule-view's events state immediately
    setEvents((prev) =>
      prev.map((e) =>
        e.id === event.id ||
        (e.kind === event.kind && e.recordId && e.recordId === event.recordId)
          ? {
              ...e,
              date: move.date,
              endDate: move.endDate,
              startMinutes: move.startMinutes ?? e.startMinutes,
              endMinutes: move.endMinutes ?? e.endMinutes,
              timeWindow:
                windowFromMinutes(move.startMinutes, move.endMinutes) || e.timeWindow,
            }
          : e,
      ),
    );

    return assign({
      kind: event.kind,
      recordId: event.recordId,
      title: event.title,
      status: event.status,
      date: move.date,
      endDate: move.endDate,
      startMinutes: move.startMinutes,
      endMinutes: move.endMinutes,
      timeWindow: windowFromMinutes(move.startMinutes, move.endMinutes) || event.timeWindow,
      employeeId: event.employeeId ?? memberOptionsRef.current[0]?.id ?? "",
    })
      .then((saved) => {
        if (saved) {
          setEvents((prev) =>
            prev.map((e) =>
              e.id === event.id ||
              e.id === saved.id ||
              (e.kind === saved.kind && e.recordId && e.recordId === saved.recordId)
                ? {
                    ...e,
                    ...saved,
                    date: saved.date || move.date,
                    endDate: saved.endDate ?? move.endDate,
                    startMinutes: saved.startMinutes ?? move.startMinutes ?? e.startMinutes,
                    endMinutes: saved.endMinutes ?? move.endMinutes ?? e.endMinutes,
                    timeWindow:
                      saved.timeWindow ||
                      windowFromMinutes(move.startMinutes, move.endMinutes) ||
                      e.timeWindow,
                  }
                : e,
            ),
          );
        }
        if (move.date) {
          const time =
            move.startMinutes != null && move.endMinutes != null
              ? ` ${formatClock(move.startMinutes)}–${formatClock(move.endMinutes)}`
              : "";
          toast.success(
            `${calendarEventKindLabel(event.kind)} ${event.title} moved to ${formatDate(move.date)}${move.endDate && move.endDate !== move.date ? `–${formatDate(move.endDate)}` : ""}${time}.`,
          );
        }
      })
      .catch((error) => {
        toast.error(formatScheduleError(error));
        void loadSchedule({ quiet: true });
      });
  }

  return (
    <PortalPage
      eyebrow="Work / Schedules"
      title="Schedule"
      description="Day, week, and month views. Drag a job to any time, or pull the edge to extend it."
      actions={
        editing ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const toRemove = editing;
              setEditing(null);
              // Optimistically remove from state
              setEvents((prev) =>
                prev.filter(
                  (e) =>
                    e.id !== toRemove.id &&
                    !(e.kind === toRemove.kind && e.recordId && e.recordId === toRemove.recordId),
                ),
              );
              void Promise.resolve(removeSchedule(toRemove.id))
                .then(() => {
                  toast.success(`${toRemove.title} removed from the schedule.`);
                })
                .catch((error) => {
                  toast.error(formatScheduleError(error));
                  void loadSchedule({ quiet: true });
                });
            }}
          >
            Remove from calendar
          </Button>
        ) : null
      }
    >
      <EventCalendar
        events={enrichedEvents}
        employees={employeesForCalendar}
        memberOptions={memberOptions}
        employeeLabel={resolveMemberLabel}
        initialEmployeeId={initialEmployeeId}
        serverFiltered
        employeeFilter={memberFilter}
        onEmployeeFilterChange={setMemberFilter}
        kindFilter={kindFilter}
        onKindFilterChange={setKindFilter}
        loading={scheduleLoading}
        onMove={moveEvent}
        onEventOpen={setEditing}
        onEventRemove={(event) => {
          // Optimistically remove from state
          setEvents((prev) =>
            prev.filter(
              (e) =>
                e.id !== event.id &&
                !(e.kind === event.kind && e.recordId && e.recordId === event.recordId),
            ),
          );
          if (editing?.id === event.id) setEditing(null);
          void Promise.resolve(removeSchedule(event.id))
            .then(() => {
              toast.success(`${event.title} removed from the schedule.`);
            })
            .catch((error) => {
              toast.error(formatScheduleError(error));
              void loadSchedule({ quiet: true });
            });
        }}
      />

      <AssignEventDialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
          }
        }}
        event={editing}
        events={enrichedEvents}
        employees={team}
        defaultEmployeeId={memberFilter || undefined}
        onSave={async (assignment) => {
          const saved = await assign(assignment);
          if (saved) {
            setEvents((prev) => {
              const exists = prev.some(
                (e) =>
                  e.id === saved.id ||
                  (e.kind === saved.kind && e.recordId && e.recordId === saved.recordId),
              );
              if (exists) {
                return prev.map((e) =>
                  e.id === saved.id ||
                  (e.kind === saved.kind && e.recordId && e.recordId === saved.recordId)
                    ? { ...e, ...saved }
                    : e,
                );
              }
              return [...prev, saved];
            });
          } else {
            setEvents((prev) =>
              prev.map((e) =>
                e.kind === assignment.kind && e.recordId === assignment.recordId
                  ? {
                      ...e,
                      date: assignment.date,
                      endDate: assignment.endDate,
                      employeeId: assignment.employeeId,
                      timeWindow: assignment.timeWindow,
                      startMinutes: assignment.startMinutes ?? e.startMinutes,
                      endMinutes: assignment.endMinutes ?? e.endMinutes,
                    }
                  : e,
              ),
            );
          }
          const label = resolveMemberLabel(assignment.employeeId);
          toast.success(
            `${calendarEventKindLabel(assignment.kind)} assigned to ${label} on ${formatDate(assignment.date)}.`,
          );
        }}
      />
    </PortalPage>
  );
}
