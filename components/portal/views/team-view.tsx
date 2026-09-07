"use client";

import { useState } from "react";
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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { PortalEmployeeRole } from "@/lib/data/portal";
import { employeeRoleLabel } from "@/lib/data/portal";

const ROLES: PortalEmployeeRole[] = ["technician", "estimator", "dispatcher", "owner"];

export function TeamView() {
  const { employees, events, addEmployee, removeEmployee } = usePortalCrew();
  const [open, setOpen] = useState(false);

  return (
    <PortalPage
      eyebrow="People / Employees"
      title={`Employees (${employees.length})`}
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
        letters
        letterValue={(row) => row.lastName}
        rows={employees}
        rowKey={(row) => row.id}
        rowHref={(row) => `/pro/dashboard/team/${row.id}`}
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
          ...(row.role === "owner"
            ? []
            : [
                {
                  label: "Remove",
                  variant: "destructive" as const,
                  onSelect: () => {
                    removeEmployee(row.id);
                    toast.success(`${row.firstName} removed from the crew list.`);
                  },
                },
              ]),
        ]}
      />

      <EmployeeFormDialog
        open={open}
        onOpenChange={setOpen}
        onSave={(input) => {
          const employee = addEmployee(input);
          toast.success(`${employee.firstName} ${employee.lastName} added. Assign them from Schedule.`);
        }}
      />

    </PortalPage>
  );
}

export { TeamMemberView } from "@/components/portal/views/employee-detail-view";

function EmployeeFormDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: {
    firstName: string;
    lastName: string;
    role: PortalEmployeeRole;
    email: string;
    phone: string;
    trade: string;
  }) => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<PortalEmployeeRole>("technician");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [trade, setTrade] = useState("");

  function reset() {
    setFirstName("");
    setLastName("");
    setRole("technician");
    setEmail("");
    setPhone("");
    setTrade("");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md" data-lenis-prevent>
        <DialogHeader>
          <DialogTitle>Add employee</DialogTitle>
          <DialogDescription>They will appear in the assign list on jobs, estimates, and the calendar.</DialogDescription>
        </DialogHeader>
        <FieldGroup className="gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="emp-first">First name</FieldLabel>
              <Input id="emp-first" value={firstName} onChange={(change) => setFirstName(change.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="emp-last">Last name</FieldLabel>
              <Input id="emp-last" value={lastName} onChange={(change) => setLastName(change.target.value)} />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="emp-role">Role</FieldLabel>
            <NativeSelect id="emp-role" className="w-full" value={role} onChange={(change) => setRole(change.target.value as PortalEmployeeRole)}>
              {ROLES.map((item) => (
                <NativeSelectOption key={item} value={item}>
                  {employeeRoleLabel(item)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="emp-trade">Trade</FieldLabel>
            <Input id="emp-trade" value={trade} placeholder="Plumbing, HVAC, General…" onChange={(change) => setTrade(change.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="emp-email">Email</FieldLabel>
            <Input id="emp-email" type="email" value={email} onChange={(change) => setEmail(change.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="emp-phone">Phone</FieldLabel>
            <Input id="emp-phone" type="tel" value={phone} onChange={(change) => setPhone(change.target.value)} />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!firstName.trim() || !lastName.trim()}
            onClick={() => {
              onSave({ firstName, lastName, role, email, phone, trade });
              reset();
              onOpenChange(false);
            }}
          >
            Add to team
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
