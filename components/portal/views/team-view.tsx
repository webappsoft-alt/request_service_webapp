"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { PortalPage } from "@/components/portal/portal-page";
import { StatusPill } from "@/components/portal/status-pill";
import { usePortalCrew } from "@/components/portal/use-portal-crew";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AuthPhoneInput } from "@/components/auth/auth-phone-input";
import type { PortalEmployee, PortalEmployeeRole } from "@/lib/data/portal";
import { employeeRoleLabel } from "@/lib/data/portal";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAuth, selectAuthUser } from "@/store/authSlice";
import {
  clearTeamError,
  createTeamMember,
  deleteTeamMember,
  fetchTeam,
  setTeamPage,
  setTeamSearch,
  TEAM_DEFAULT_LIMIT,
  updateTeamMember,
} from "@/store/teamSlice";

const ROLES: PortalEmployeeRole[] = ["technician", "estimator", "dispatcher", "owner"];
const SEARCH_DEBOUNCE_MS = 400;

export function TeamView() {
  const dispatch = useAppDispatch();
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectAuthUser);
  const { employees: directoryEmployees, events, removeEmployee } = usePortalCrew();

  const useApi =
    auth.hydrated &&
    Boolean(auth.token) &&
    (user?.role === "provider" || auth.role === "provider");

  const slice = useAppSelector((state) => state.team);
  const {
    items,
    page,
    limit,
    total,
    totalPages,
    search,
    loading,
    error,
  } = slice ?? {
    items: [],
    page: 1,
    limit: TEAM_DEFAULT_LIMIT,
    total: 0,
    totalPages: 1,
    search: "",
    loading: true,
    error: null,
  };

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PortalEmployee | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PortalEmployee | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchInput, setSearchInput] = useState(search);
  const [actionLoading, setActionLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    if (!useApi) return;
    let cancelled = false;
    void dispatch(fetchTeam()).finally(() => {
      if (!cancelled) setActionLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [dispatch, useApi, page, search]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (!useApi || !error || loading) return;
    toast.error(error);
    dispatch(clearTeamError());
  }, [dispatch, error, loading, useApi]);

  const rows = useApi ? items : directoryEmployees;
  const tableLoading = actionLoading || (useApi ? loading && items.length === 0 : false);

  function onSearchChange(value: string) {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setActionLoading(true);
      dispatch(setTeamSearch(value.trim()));
    }, SEARCH_DEBOUNCE_MS);
  }

  function onPageChange(nextPage: number) {
    if (nextPage === page) return;
    setActionLoading(true);
    dispatch(setTeamPage(nextPage));
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    const row = deleteTarget;
    setDeleting(true);
    try {
      if (useApi) {
        await dispatch(deleteTeamMember(row.id)).unwrap();
      } else {
        await Promise.resolve(removeEmployee(row.id));
      }
      toast.success(`${row.firstName} removed from the crew list.`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(typeof err === "string" ? err : "Could not remove employee.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <PortalPage
      eyebrow="People / Employees"
      title={`Employees (${useApi ? total : rows.length})`}
      description="Office and field crew. Open an employee for settings, hours, pay, schedule, and assigned work."
      actions={
        <Button size="sm" onClick={() => setOpen(true)}>
          + Create employee
        </Button>
      }
    >
      <PortalDataTable
        filename="employees"
        countLabel="Employees"
        searchPlaceholder="Search employees"
        loading={tableLoading}
        letters
        letterValue={(row) => row.lastName}
        rows={rows}
        rowKey={(row) => row.id}
        rowHref={(row) => `/pro/dashboard/team/${row.id}`}
        pageSize={limit}
        empty={
          search
            ? "No employees match this search."
            : "No employees yet. Create your first employee."
        }
        serverPagination={
          useApi
            ? {
                page,
                pageSize: limit,
                total,
                totalPages,
                onPageChange,
                search: searchInput,
                onSearchChange,
                letter: search.length === 1 && search === search.toUpperCase() ? search : "",
                onLetterChange: (next) => {
                  if (debounceRef.current) clearTimeout(debounceRef.current);
                  setSearchInput(next);
                  setActionLoading(true);
                  dispatch(setTeamSearch(next));
                },
              }
            : undefined
        }
        columns={[
          {
            id: "name",
            header: "Employee",
            sortValue: (row) => `${row.lastName} ${row.firstName}`,
            searchValue: (row) => `${row.firstName} ${row.lastName} ${row.email} ${row.phone}`,
            exportValue: (row) => `${row.firstName} ${row.lastName}`,
            cell: (row) => (
              <div>
                <Link href={`/pro/dashboard/team/${row.id}`} className="font-medium text-primary hover:underline">
                  {row.firstName} {row.lastName}
                </Link>
                <p className="text-xs text-muted-foreground">{row.email}</p>
              </div>
            ),
          },
          {
            id: "role",
            header: "Role",
            sortValue: (row) => row.role,
            searchValue: (row) => employeeRoleLabel(row.role),
            exportValue: (row) => employeeRoleLabel(row.role),
            cell: (row) => (
              <StatusPill label={employeeRoleLabel(row.role)} tone={row.role === "owner" ? "primary" : "neutral"} />
            ),
          },
          {
            id: "trade",
            header: "Trade",
            sortValue: (row) => row.trade,
            searchValue: (row) => row.trade,
            exportValue: (row) => row.trade,
            cell: (row) => row.trade,
          },
          {
            id: "email",
            header: "Email",
            sortValue: (row) => row.email,
            searchValue: (row) => row.email,
            exportValue: (row) => row.email,
            cell: (row) => <span className="text-primary">{row.email}</span>,
          },
          {
            id: "phone",
            header: "Phone",
            sortValue: (row) => row.phone,
            searchValue: (row) => row.phone,
            exportValue: (row) => row.phone,
            cell: (row) => row.phone,
          },
          {
            id: "status",
            header: "Active",
            sortValue: (row) => (row.active ? 1 : 0),
            searchValue: (row) => (row.active ? "active" : "inactive"),
            exportValue: (row) => (row.active ? "Active" : "Inactive"),
            cell: (row) => <StatusPill label={row.active ? "Active" : "Inactive"} tone={row.active ? "success" : "neutral"} />,
          },
          {
            id: "assigned",
            header: "Scheduled",
            sortValue: (row) => events.filter((item) => item.employeeId === row.id && item.date).length,
            searchValue: (row) => String(events.filter((item) => item.employeeId === row.id && item.date).length),
            exportValue: (row) => String(events.filter((item) => item.employeeId === row.id && item.date).length),
            cell: (row) => events.filter((item) => item.employeeId === row.id && item.date).length,
          },
        ]}
        actions={(row) => [
          { label: "View schedule", href: `/pro/dashboard/team/${row.id}` },
          { label: "Open calendar", href: `/pro/dashboard/schedule?employee=${row.id}` },
          {
            label: "Edit",
            onSelect: () => setEditing(row),
          },
          ...(row.role === "owner"
            ? []
            : [
                {
                  label: "Remove",
                  variant: "destructive" as const,
                  onSelect: () => setDeleteTarget(row),
                },
              ]),
        ]}
      />

      <EmployeeFormDialog open={open} onOpenChange={setOpen} useApi={useApi} />
      <EmployeeFormDialog
        open={Boolean(editing)}
        employee={editing}
        useApi={useApi}
        onOpenChange={(next) => {
          if (!next) setEditing(null);
        }}
      />

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(next) => {
          if (!next && !deleting) setDeleteTarget(null);
        }}
      >
        <DialogContent showCloseButton={!deleting} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove employee?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `This will remove “${deleteTarget.firstName} ${deleteTarget.lastName}” from your crew list.`
                : "This will remove this employee from your crew list."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() => {
                void confirmDelete();
              }}
            >
              {deleting ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalPage>
  );
}

export { TeamMemberView } from "@/components/portal/views/employee-detail-view";

function EmployeeFormDialog({
  open,
  onOpenChange,
  useApi,
  employee = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  useApi: boolean;
  employee?: PortalEmployee | null;
}) {
  const dispatch = useAppDispatch();
  const { addEmployee, updateEmployee } = usePortalCrew();
  const mutating = useAppSelector((state) => state.team?.mutating ?? false);
  const isEdit = Boolean(employee);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<PortalEmployeeRole>("technician");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [trade, setTrade] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setFirstName("");
    setLastName("");
    setRole("technician");
    setEmail("");
    setPhone("");
    setTrade("");
    setSaving(false);
  }

  useEffect(() => {
    if (!open) return;
    if (!employee) {
      reset();
      return;
    }
    setFirstName(employee.firstName);
    setLastName(employee.lastName);
    setRole(employee.role);
    setEmail(employee.email);
    setPhone(employee.phone);
    setTrade(employee.trade);
    setSaving(false);
  }, [open, employee]);

  async function save() {
    if (saving || mutating) return;
    const input = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      role,
      email: email.trim(),
      phone: phone.trim(),
      trade: trade.trim() || "General",
      active: true as const,
    };
    if (!input.firstName || !input.lastName) return;

    setSaving(true);
    try {
      if (isEdit && employee) {
        if (useApi) {
          const updated = await dispatch(
            updateTeamMember({ id: employee.id, patch: { ...employee, ...input } }),
          ).unwrap();
          toast.success(`${updated.firstName} ${updated.lastName} updated.`);
        } else {
          await Promise.resolve(updateEmployee(employee.id, input));
          toast.success(`${input.firstName} ${input.lastName} updated.`);
        }
      } else if (useApi) {
        const created = await dispatch(createTeamMember(input)).unwrap();
        toast.success(`${created.firstName} ${created.lastName} added. Assign them from Schedule.`);
      } else {
        const created = await Promise.resolve(addEmployee(input));
        if (!created) return;
        toast.success(`${created.firstName} ${created.lastName} added. Assign them from Schedule.`);
      }
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(typeof err === "string" ? err : "Could not save employee.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving || mutating) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md" data-lenis-prevent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit employee" : "Add employee"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update crew member details used on jobs, estimates, and the calendar."
              : "They will appear in the assign list on jobs, estimates, and the calendar."}
          </DialogDescription>
        </DialogHeader>
        <FieldGroup className="gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="emp-first">First name</FieldLabel>
              <Input
                id="emp-first"
                value={firstName}
                placeholder="Marcus"
                onChange={(change) => setFirstName(change.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="emp-last">Last name</FieldLabel>
              <Input
                id="emp-last"
                value={lastName}
                placeholder="Technician"
                onChange={(change) => setLastName(change.target.value)}
              />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="emp-role">Role</FieldLabel>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as PortalEmployeeRole)}
            >
              <SelectTrigger id="emp-role" className="w-full">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                align="start"
                className="z-[100] w-[var(--radix-select-trigger-width)]"
              >
                {ROLES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {employeeRoleLabel(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="emp-trade">Trade</FieldLabel>
            <Input
              id="emp-trade"
              value={trade}
              placeholder="Plumbing, HVAC, General…"
              onChange={(change) => setTrade(change.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="emp-email">Email</FieldLabel>
            <Input
              id="emp-email"
              type="email"
              value={email}
              placeholder="marcus@company.com"
              onChange={(change) => setEmail(change.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="emp-phone">Phone</FieldLabel>
            <AuthPhoneInput
              id="emp-phone"
              value={phone}
              onChange={setPhone}
              placeholder="(555) 123-4567"
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving || mutating}>
            Cancel
          </Button>
          <Button
            disabled={saving || mutating || !firstName.trim() || !lastName.trim()}
            onClick={() => void save()}
          >
            {saving || mutating ? "Saving…" : isEdit ? "Save changes" : "Add to team"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
