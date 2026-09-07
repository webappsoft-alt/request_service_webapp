"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import type { PortalAssignment, PortalCalendarEvent, PortalEmployee, PortalEmployeeRole } from "@/lib/data/portal";
import { employeeName } from "@/lib/data/portal";

const CREW_EVENT = "rs-portal-crew";

type CrewStore = {
  extras: PortalEmployee[];
  assignments: PortalAssignment[];
  removedIds: string[];
  patches: Record<string, Partial<PortalEmployee>>;
};

const EMPTY: CrewStore = { extras: [], assignments: [], removedIds: [], patches: {} };

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
  const key = storageKey(workspace.session?.email);
  const store = useSyncExternalStore(
    subscribe,
    () => readStore(key),
    () => EMPTY,
  );

  const employees = useMemo(() => {
    const seeded = workspace.employees.filter((item) => !store.removedIds.includes(item.id));
    return [...seeded, ...store.extras].map((item) => ({ ...item, ...store.patches[item.id] }));
  }, [store.extras, store.patches, store.removedIds, workspace.employees]);

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
        date: task.dueAt,
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
    (assignment: PortalAssignment) => {
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
    [key],
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
    [key],
  );

  const removeEmployee = useCallback(
    (id: string) => {
      const current = readStore(key);
      const seeded = workspace.employees.some((item) => item.id === id);
      const { [id]: _removed, ...patches } = current.patches;
      writeStore(key, {
        extras: current.extras.filter((item) => item.id !== id),
        assignments: current.assignments.filter((item) => item.employeeId !== id),
        removedIds: seeded && !current.removedIds.includes(id) ? [...current.removedIds, id] : current.removedIds,
        patches,
      });
    },
    [key, workspace.employees],
  );

  const updateEmployee = useCallback(
    (id: string, patch: Partial<PortalEmployee>) => {
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
    [key],
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
    employeeById,
    employeeLabel: (id?: string) => {
      const employee = employeeById(id);
      if (employee) return employeeName(employee);
      const contractor = contractors.find((item) => item.id === id);
      return contractor ? contractor.companyName : "Unassigned";
    },
  };
}
