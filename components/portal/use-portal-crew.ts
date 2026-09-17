"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";
import { useCrmApiData } from "@/components/portal/use-crm-api-data";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import { assignSchedule as assignScheduleApi, updateSchedule as updateScheduleApi, deleteSchedule as deleteScheduleApi, createEmployee as createEmployeeApi, updateEmployee as updateEmployeeApi, deleteEmployee as deleteEmployeeApi } from "@/lib/api/crm-client";
import type { PortalAssignment, PortalCalendarEvent, PortalEmployee, PortalEmployeeRole } from "@/lib/data/portal";
import { employeeName, minutesForWindow } from "@/lib/data/portal";

const CREW_EVENT = "rs-portal-crew";

type CrewStore = {
  extras: PortalEmployee[];
  assignments: PortalAssignment[];
  removedIds: string[];
  patches: Record<string, Partial<PortalEmployee>>;
};

const EMPTY: CrewStore = { extras: [], assignments: [], removedIds: [], patches: {} };

function normalizeScheduleStatus(value?: string) {
  switch (value) {
    case "scheduled":
    case "confirmed":
    case "in_progress":
    case "completed":
    case "cancelled":
      return value;
    default:
      return "scheduled";
  }
}

function storageKey(email?: string) {
  return `rs-portal-crew:${email ?? "guest"}`;
}

const snapshots = new Map<string, { raw: string; value: CrewStore }>();

function readStore(key: string): CrewStore {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(key) ?? "";
    const cached = snapshots.get(key);
    if (cached && cached.raw === raw) return cached.value;
    if (!raw) {
      snapshots.set(key, { raw, value: EMPTY });
      return EMPTY;
    }
    const parsed = JSON.parse(raw) as CrewStore;
    const value: CrewStore = {
      extras: parsed.extras ?? [],
      assignments: parsed.assignments ?? [],
      removedIds: parsed.removedIds ?? [],
      patches: parsed.patches ?? {},
    };
    snapshots.set(key, { raw, value });
    return value;
  } catch {
    return EMPTY;
  }
}

function writeStore(key: string, next: CrewStore) {
  window.localStorage.setItem(key, JSON.stringify(next));
  window.dispatchEvent(new Event(CREW_EVENT));
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener(CREW_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(CREW_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

export function usePortalCrew() {
  const workspace = usePortalWorkspace();
  const { tasks, contractors } = useCrmDirectory();
  const crm = useCrmApiData();
  const key = storageKey(workspace.session?.email);
  const store = useSyncExternalStore(
    subscribe,
    () => readStore(key),
    () => EMPTY,
  );
  const apiReady = crm.enabled && crm.ready;
  const loading = crm.enabled && (!crm.ready || crm.loading);
  const suppressSeedData = Boolean(workspace.session) || (crm.enabled && !crm.ready);

  const employees = useMemo(() => {
    if (apiReady) {
      return crm.employees
        .filter((item) => !store.removedIds.includes(item.id))
        .map((item) => ({ ...item, ...store.patches[item.id] }));
    }
    if (suppressSeedData) return [];
    const seeded = workspace.employees.filter((item) => !store.removedIds.includes(item.id));
    return [...seeded, ...store.extras].map((item) => ({ ...item, ...store.patches[item.id] }));
  }, [
    apiReady,
    crm.employees,
    store.extras,
    store.patches,
    store.removedIds,
    suppressSeedData,
    workspace.employees,
  ]);

  const events = useMemo(() => {
    const taskEvents: PortalCalendarEvent[] = tasks.map((task) => {
      const customer = workspace.customers.find((item) => item.id === task.customerId);
      return {
        id: `cal_${task.id}`,
        kind: "task" as const,
        recordId: task.id,
        title: task.number,
        detail: task.title,
        customerName: customer ? `${customer.firstName} ${customer.lastName}` : undefined,
        date: String(task.dueAt || "").slice(0, 10),
        timeWindow: "all_day" as const,
        startMinutes: 8 * 60,
        endMinutes: 9 * 60,
        employeeId: task.assignedEmployeeId,
        href: `/pro/dashboard/tasks/${task.id}`,
        status: task.status,
      };
    });
    return [...workspace.calendarEvents, ...taskEvents].map((event) => {
      const override = store.assignments.find(
        (item) => item.kind === event.kind && item.recordId === event.recordId,
      );
      if (!override) return event;
      return {
        ...event,
        date: override.date || undefined,
        endDate: override.endDate || undefined,
        timeWindow: override.timeWindow,
        startMinutes: override.startMinutes ?? event.startMinutes,
        endMinutes: override.endMinutes ?? event.endMinutes,
        employeeId: override.employeeId,
      };
    });
  }, [store.assignments, tasks, workspace.calendarEvents, workspace.customers]);

  const assign = useCallback(
    async (assignment: PortalAssignment) => {
      if (apiReady) {
        const fallbackWindow = minutesForWindow(assignment.timeWindow);
        const sourceEvent =
          events.find((item) => item.kind === assignment.kind && item.recordId === assignment.recordId) ??
          workspace.calendarEvents.find((item) => item.kind === assignment.kind && item.recordId === assignment.recordId) ??
          (() => {
            switch (assignment.kind) {
              case "job": {
                const job = workspace.jobs.find((item) => item.id === assignment.recordId);
                return job
                  ? {
                      id: `cal_${job.id}`,
                      kind: "job",
                      recordId: job.id,
                      title: job.number,
                      detail: job.notes || job.address.city,
                      customerName: undefined,
                      date: assignment.date,
                      endDate: assignment.endDate,
                      timeWindow: assignment.timeWindow,
                      startMinutes: fallbackWindow.startMinutes,
                      endMinutes: fallbackWindow.endMinutes,
                      employeeId: assignment.employeeId,
                      href: `/pro/dashboard/jobs/${job.id}`,
                      status: job.status,
                    }
                  : undefined;
              }
              case "estimate": {
                const estimate = workspace.estimates.find((item) => item.id === assignment.recordId);
                return estimate
                  ? {
                      id: `cal_${estimate.id}`,
                      kind: "estimate",
                      recordId: estimate.id,
                      title: estimate.number,
                      detail: "Estimate visit",
                      customerName: undefined,
                      date: assignment.date,
                      endDate: assignment.endDate,
                      timeWindow: assignment.timeWindow,
                      startMinutes: fallbackWindow.startMinutes,
                      endMinutes: fallbackWindow.endMinutes,
                      employeeId: assignment.employeeId,
                      href: `/pro/dashboard/estimates/${estimate.id}`,
                      status: estimate.status,
                    }
                  : undefined;
              }
              case "request": {
                const request = workspace.requests.find((item) => item.id === assignment.recordId);
                return request
                  ? {
                      id: `cal_${request.id}`,
                      kind: "request",
                      recordId: request.id,
                      title: request.number,
                      detail: request.serviceName,
                      customerName: request.customerName,
                      date: assignment.date,
                      endDate: assignment.endDate,
                      timeWindow: assignment.timeWindow,
                      startMinutes: fallbackWindow.startMinutes,
                      endMinutes: fallbackWindow.endMinutes,
                      employeeId: assignment.employeeId,
                      href: `/pro/dashboard/requests/${request.id}`,
                      status: request.status,
                    }
                  : undefined;
              }
              case "invoice": {
                const invoice = workspace.invoices.find((item) => item.id === assignment.recordId);
                return invoice
                  ? {
                      id: `cal_${invoice.id}`,
                      kind: "invoice",
                      recordId: invoice.id,
                      title: invoice.number,
                      detail: "Invoice follow-up",
                      customerName: undefined,
                      date: assignment.date,
                      endDate: assignment.endDate,
                      timeWindow: assignment.timeWindow,
                      startMinutes: fallbackWindow.startMinutes,
                      endMinutes: fallbackWindow.endMinutes,
                      employeeId: assignment.employeeId,
                      href: `/pro/dashboard/invoices/${invoice.id}`,
                      status: invoice.status,
                    }
                  : undefined;
              }
              case "task": {
                const task = tasks.find((item) => item.id === assignment.recordId);
                return task
                  ? {
                      id: `cal_${task.id}`,
                      kind: "task",
                      recordId: task.id,
                      title: task.number,
                      detail: task.title,
                      customerName: undefined,
                      date: assignment.date,
                      endDate: assignment.endDate,
                      timeWindow: assignment.timeWindow,
                      startMinutes: fallbackWindow.startMinutes,
                      endMinutes: fallbackWindow.endMinutes,
                      employeeId: assignment.employeeId,
                      href: `/pro/dashboard/tasks/${task.id}`,
                      status: task.status,
                    }
                  : undefined;
              }
              default: {
                const _never: never = assignment.kind;
                return _never;
              }
            }
          })();
        if (!sourceEvent) {
          throw new Error("Could not find the calendar item to assign.");
        }

        const existingSchedule = workspace.calendarEvents.find(
          (item) => item.kind === assignment.kind && item.recordId === assignment.recordId,
        );
        const contractor = contractors.find((item) => item.id === assignment.employeeId);
        const startMinutes = assignment.startMinutes ?? sourceEvent.startMinutes ?? fallbackWindow.startMinutes;
        const endMinutes = assignment.endMinutes ?? sourceEvent.endMinutes ?? fallbackWindow.endMinutes;
        const payload = {
          title: sourceEvent.title,
          date: assignment.date,
          endDate: assignment.endDate ?? null,
          startMinutes,
          endMinutes,
          timeWindow: assignment.timeWindow,
          employeeId: contractor ? null : assignment.employeeId,
          contractorId: contractor ? assignment.employeeId : null,
          status: normalizeScheduleStatus(sourceEvent.status),
        } as const;

        if (existingSchedule) {
          await updateScheduleApi(existingSchedule.id, payload);
        } else {
          await assignScheduleApi({
            recordId: assignment.recordId,
            kind: assignment.kind,
            ...payload,
          });
        }

        await crm.refresh();
        return;
      }

      const current = readStore(key);
      writeStore(key, {
        ...current,
        assignments: [
          ...current.assignments.filter(
            (item) => !(item.kind === assignment.kind && item.recordId === assignment.recordId),
          ),
          assignment,
        ],
      });
    },
    [apiReady, contractors, crm, events, key, tasks, workspace.calendarEvents, workspace.estimates, workspace.invoices, workspace.jobs, workspace.requests],
  );

  const addEmployee = useCallback(
    (input: {
      firstName: string;
      lastName: string;
      role: PortalEmployeeRole;
      email: string;
      phone: string;
      trade: string;
    }) => {
      if (apiReady) {
        return (async () => {
          const created = await createEmployeeApi({
            firstName: input.firstName.trim(),
            lastName: input.lastName.trim(),
            role: input.role,
            email: input.email.trim(),
            phone: input.phone.trim(),
            trade: input.trade.trim() || "General",
            active: true,
          });
          await crm.refresh();
          return created;
        })();
      }
      const current = readStore(key);
      const employee: PortalEmployee = {
        id: `emp_custom_${Date.now()}`,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        role: input.role,
        email: input.email.trim(),
        phone: input.phone.trim(),
        trade: input.trade.trim() || "General",
        active: true,
      };
      writeStore(key, { ...current, extras: [...current.extras, employee] });
      return employee;
    },
    [apiReady, crm, key],
  );

  const removeEmployee = useCallback(
    (id: string) => {
      if (apiReady) {
        return (async () => {
          await deleteEmployeeApi(id);
          await crm.refresh();
        })();
      }
      const current = readStore(key);
      const seeded = workspace.employees.some((item) => item.id === id);
      const patches = { ...current.patches };
      delete patches[id];
      writeStore(key, {
        extras: current.extras.filter((item) => item.id !== id),
        assignments: current.assignments.filter((item) => item.employeeId !== id),
        removedIds: seeded && !current.removedIds.includes(id) ? [...current.removedIds, id] : current.removedIds,
        patches,
      });
    },
    [apiReady, crm, key, workspace.employees],
  );

  const updateEmployee = useCallback(
    (id: string, patch: Partial<PortalEmployee>) => {
      if (apiReady) {
        return (async () => {
          const currentEmployee = employees.find((item) => item.id === id);
          if (!currentEmployee) throw new Error("Employee not found");
          const updated = await updateEmployeeApi(id, { ...currentEmployee, ...patch });
          await crm.refresh();
          return updated;
        })();
      }
      const current = readStore(key);
      const extra = current.extras.find((item) => item.id === id);
      writeStore(key, {
        ...current,
        extras: extra
          ? current.extras.map((item) => (item.id === id ? { ...item, ...patch } : item))
          : current.extras,
        patches: extra ? current.patches : { ...current.patches, [id]: { ...current.patches[id], ...patch } },
      });
    },
    [apiReady, crm, employees, key],
  );

  const removeSchedule = useCallback(
    (scheduleId: string) => {
      if (apiReady) {
        return (async () => {
          await deleteScheduleApi(scheduleId);
          await crm.refresh();
        })();
      }
      const current = readStore(key);
      writeStore(key, {
        ...current,
        assignments: current.assignments.filter((item) => item.recordId !== scheduleId),
      });
    },
    [apiReady, crm, key],
  );

  const employeeById = useCallback(
    (id?: string) => employees.find((item) => item.id === id),
    [employees],
  );

  return {
    ...workspace,
    employees,
    events,
    assign,
    addEmployee,
    updateEmployee,
    removeEmployee,
    removeSchedule,
    employeeById,
    employeeLabel: (id?: string) => {
      const employee = employeeById(id);
      if (employee) return employeeName(employee);
      const contractor = contractors.find((item) => item.id === id);
      return contractor ? contractor.companyName : "Unassigned";
    },
    loading,
    ready: !crm.enabled || crm.ready,
    apiReady,
  };
}
