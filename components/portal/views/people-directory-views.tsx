"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  CreateContractorDialog,
  CreateReminderDialog,
  CreateVendorDialog,
} from "@/components/portal/create-person-dialogs";
import { ReminderSubjectLink, useReminderLookups } from "@/components/portal/reminder-banner";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { PortalPage } from "@/components/portal/portal-page";
import { RecordWorkspace } from "@/components/portal/record-workspace";
import { StatusPill } from "@/components/portal/status-pill";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";
import { useCrmRecordPending } from "@/components/portal/use-crm-record-pending";
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
import {
  crmReminderStatusLabel,
  crmStatusLabel,
  reminderIsOverdue,
  reminderSubject,
  reminderSubjectKindLabel,
  type PortalContractor,
  type PortalVendor,
} from "@/lib/data/crm-people";
import { formatDate, formatMoney } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAuth, selectAuthUser } from "@/store/authSlice";
import {
  clearContractorsError,
  CONTRACTORS_DEFAULT_LIMIT,
  deleteContractorRecord,
  fetchContractors,
  setContractorsPage,
  setContractorsSearch,
} from "@/store/contractorsSlice";
import {
  clearVendorsError,
  deleteVendorRecord,
  fetchVendors,
  setVendorsPage,
  setVendorsSearch,
  VENDORS_DEFAULT_LIMIT,
} from "@/store/vendorsSlice";
import {
  clearRemindersError,
  deleteReminderRecord,
  fetchReminders,
  patchReminderStatus,
  REMINDERS_DEFAULT_LIMIT,
  setRemindersPage,
  setRemindersSearch,
} from "@/store/remindersSlice";
import { fetchTeam } from "@/store/teamSlice";

const SEARCH_DEBOUNCE_MS = 400;

function useProviderApi() {
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectAuthUser);
  return (
    auth.hydrated &&
    Boolean(auth.token) &&
    (user?.role === "provider" || auth.role === "provider")
  );
}

export function ContractorsView() {
  const dispatch = useAppDispatch();
  const useApi = useProviderApi();
  const { contractors: directoryRows, remove } = useCrmDirectory();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PortalContractor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PortalContractor | null>(null);
  const [deleting, setDeleting] = useState(false);

  const slice = useAppSelector((state) => state.contractors);
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
    limit: CONTRACTORS_DEFAULT_LIMIT,
    total: 0,
    totalPages: 1,
    search: "",
    loading: true,
    error: null,
  };

  const [searchInput, setSearchInput] = useState(search);
  const [actionLoading, setActionLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    if (!useApi) return;
    let cancelled = false;
    void dispatch(fetchContractors()).finally(() => {
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
    dispatch(clearContractorsError());
  }, [dispatch, error, loading, useApi]);

  const rows = useApi ? items : directoryRows;
  const tableLoading = actionLoading || (useApi ? loading && items.length === 0 : false);

  function onSearchChange(value: string) {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setActionLoading(true);
      dispatch(setContractorsSearch(value.trim()));
    }, SEARCH_DEBOUNCE_MS);
  }

  function onPageChange(nextPage: number) {
    if (nextPage === page) return;
    setActionLoading(true);
    dispatch(setContractorsPage(nextPage));
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    const row = deleteTarget;
    setDeleting(true);
    try {
      if (useApi) {
        await dispatch(deleteContractorRecord(row.id)).unwrap();
      } else {
        remove("contractor", row.id);
      }
      toast.success(`${row.companyName} removed.`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(typeof err === "string" ? err : "Could not delete contractor.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <PortalPage
      eyebrow="People / Contractors"
      title={`Contractors (${useApi ? total : rows.length})`}
      description="Outside trades you send to a job. Open a file for compliance, hours, pay, and assignments."
      actions={
        <Button size="sm" onClick={() => setOpen(true)}>
          + Create contractor
        </Button>
      }
    >
      <PortalDataTable
        filename="contractors"
        countLabel="Contractors"
        searchPlaceholder="Search contractors"
        loading={tableLoading}
        letters
        letterValue={(row) => row.companyName}
        rows={rows}
        rowKey={(row) => row.id}
        rowHref={(row) => `/pro/dashboard/contractors/${row.id}`}
        pageSize={limit}
        empty={
          search
            ? "No contractors match this search."
            : "No contractors yet. Create your first contractor."
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
                  dispatch(setContractorsSearch(next));
                },
              }
            : undefined
        }
        columns={contractorColumns()}
        actions={(row) => [
          { label: "Open file", href: `/pro/dashboard/contractors/${row.id}` },
          {
            label: "Edit",
            onSelect: () => setEditing(row),
          },
          {
            label: "Delete",
            variant: "destructive",
            onSelect: () => setDeleteTarget(row),
          },
        ]}
      />
      <CreateContractorDialog open={open} onOpenChange={setOpen} />
      <CreateContractorDialog
        open={Boolean(editing)}
        contractor={editing}
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
            <DialogTitle>Delete contractor?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `This will remove “${deleteTarget.companyName}” from your contractors list.`
                : "This will remove this contractor from your list."}
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
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalPage>
  );
}

export { ContractorDetailView, VendorDetailView } from "@/components/portal/views/partner-detail-views";

export function VendorsView() {
  const dispatch = useAppDispatch();
  const useApi = useProviderApi();
  const { vendors: directoryRows, remove } = useCrmDirectory();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PortalVendor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PortalVendor | null>(null);
  const [deleting, setDeleting] = useState(false);

  const slice = useAppSelector((state) => state.vendors);
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
    limit: VENDORS_DEFAULT_LIMIT,
    total: 0,
    totalPages: 1,
    search: "",
    loading: true,
    error: null,
  };

  const [searchInput, setSearchInput] = useState(search);
  const [actionLoading, setActionLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    if (!useApi) return;
    let cancelled = false;
    void dispatch(fetchVendors()).finally(() => {
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
    dispatch(clearVendorsError());
  }, [dispatch, error, loading, useApi]);

  const rows = useApi ? items : directoryRows;
  const tableLoading = actionLoading || (useApi ? loading && items.length === 0 : false);

  function onSearchChange(value: string) {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setActionLoading(true);
      dispatch(setVendorsSearch(value.trim()));
    }, SEARCH_DEBOUNCE_MS);
  }

  function onPageChange(nextPage: number) {
    if (nextPage === page) return;
    setActionLoading(true);
    dispatch(setVendorsPage(nextPage));
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    const row = deleteTarget;
    setDeleting(true);
    try {
      if (useApi) {
        await dispatch(deleteVendorRecord(row.id)).unwrap();
      } else {
        remove("vendor", row.id);
      }
      toast.success(`${row.name} removed.`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(typeof err === "string" ? err : "Could not delete vendor.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <PortalPage
      eyebrow="People / Vendors"
      title={`Vendors (${useApi ? total : rows.length})`}
      description="Supply houses and payables. Open a file for account terms, purchase orders, and related jobs."
      actions={
        <Button size="sm" onClick={() => setOpen(true)}>
          + Create vendor
        </Button>
      }
    >
      <PortalDataTable
        filename="vendors"
        countLabel="Vendors"
        searchPlaceholder="Search vendors"
        loading={tableLoading}
        letters
        letterValue={(row) => row.name}
        rows={rows}
        rowKey={(row) => row.id}
        rowHref={(row) => `/pro/dashboard/vendors/${row.id}`}
        pageSize={limit}
        empty={
          search
            ? "No vendors match this search."
            : "No vendors yet. Create your first vendor."
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
                  dispatch(setVendorsSearch(next));
                },
              }
            : undefined
        }
        columns={vendorColumns()}
        actions={(row) => [
          { label: "Open file", href: `/pro/dashboard/vendors/${row.id}` },
          {
            label: "Edit",
            onSelect: () => setEditing(row),
          },
          {
            label: "Delete",
            variant: "destructive",
            onSelect: () => setDeleteTarget(row),
          },
        ]}
      />
      <CreateVendorDialog open={open} onOpenChange={setOpen} />
      <CreateVendorDialog
        open={Boolean(editing)}
        vendor={editing}
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
            <DialogTitle>Delete vendor?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `This will remove “${deleteTarget.name}” from your vendors list.`
                : "This will remove this vendor from your list."}
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
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalPage>
  );
}

export function RemindersView() {
  const dispatch = useAppDispatch();
  const useApi = useProviderApi();
  const { reminders: directoryReminders, remove, setReminderStatus } = useCrmDirectory();
  const { employees: crewEmployees } = usePortalCrew();
  const teamItems = useAppSelector((state) => state.team?.items ?? []);
  const employees = useApi && teamItems.length > 0 ? teamItems : crewEmployees;
  const lookups = useReminderLookups();
  const [open, setOpen] = useState(false);

  const slice = useAppSelector((state) => state.reminders);
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
    limit: REMINDERS_DEFAULT_LIMIT,
    total: 0,
    totalPages: 1,
    search: "",
    loading: true,
    error: null,
  };

  const [searchInput, setSearchInput] = useState(search);
  const [actionLoading, setActionLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    if (!useApi) return;
    let cancelled = false;
    void Promise.all([dispatch(fetchReminders()), dispatch(fetchTeam())]).finally(() => {
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
    dispatch(clearRemindersError());
  }, [dispatch, error, loading, useApi]);

  const rows = useApi ? items : directoryReminders;
  const tableLoading = actionLoading || (useApi ? loading && items.length === 0 : false);

  function onSearchChange(value: string) {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setActionLoading(true);
      dispatch(setRemindersSearch(value.trim()));
    }, SEARCH_DEBOUNCE_MS);
  }

  function onPageChange(nextPage: number) {
    if (nextPage === page) return;
    setActionLoading(true);
    dispatch(setRemindersPage(nextPage));
  }

  return (
    <PortalPage
      eyebrow="People / Reminders"
      title={`Reminders (${useApi ? total : rows.length})`}
      description="Follow-ups linked to a customer, employee, contractor, vendor, estimate, lead, or job."
      actions={
        <Button size="sm" onClick={() => setOpen(true)}>
          + Set reminder
        </Button>
      }
    >
      <PortalDataTable
        filename="reminders"
        countLabel="Reminders"
        searchPlaceholder="Search reminders"
        loading={tableLoading}
        rows={rows}
        rowKey={(row) => row.id}
        rowHref={(row) => `/pro/dashboard/reminders/${row.id}`}
        pageSize={limit}
        empty={
          search
            ? "No reminders match this search."
            : "No reminders yet. Set your first reminder."
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
              }
            : undefined
        }
        columns={[
          {
            id: "title",
            header: "Reminder",
            sortValue: (row) => row.title,
            searchValue: (row) => `${row.title} ${row.note}`,
            exportValue: (row) => row.title,
            cell: (row) => (
              <Link href={`/pro/dashboard/reminders/${row.id}`} className="font-medium text-primary hover:underline">
                {row.title}
              </Link>
            ),
          },
          {
            id: "linked",
            header: "Linked to",
            sortValue: (row) => {
              const subject = reminderSubject(row);
              return `${reminderSubjectKindLabel(subject.kind)} ${lookups.label(subject.kind, subject.id)}`;
            },
            searchValue: (row) => {
              const subject = reminderSubject(row);
              return `${reminderSubjectKindLabel(subject.kind)} ${lookups.label(subject.kind, subject.id)}`;
            },
            exportValue: (row) => {
              const subject = reminderSubject(row);
              return `${reminderSubjectKindLabel(subject.kind)} · ${lookups.label(subject.kind, subject.id)}`;
            },
            cell: (row) => {
              const subject = reminderSubject(row);
              return (
                <ReminderSubjectLink
                  kind={subject.kind}
                  id={subject.id}
                  name={lookups.label(subject.kind, subject.id)}
                />
              );
            },
          },
          {
            id: "due",
            header: "Due",
            sortValue: (row) => row.dueAt,
            searchValue: (row) => formatDate(row.dueAt),
            exportValue: (row) => formatDate(row.dueAt),
            cell: (row) => formatDate(row.dueAt),
          },
          {
            id: "assigned",
            header: "Assigned",
            sortValue: (row) => {
              const employee = employees.find((item) => item.id === row.assignedEmployeeId);
              return employee ? `${employee.lastName} ${employee.firstName}` : "";
            },
            searchValue: (row) => {
              const employee = employees.find((item) => item.id === row.assignedEmployeeId);
              return employee ? `${employee.firstName} ${employee.lastName}` : "";
            },
            exportValue: (row) => {
              const employee = employees.find((item) => item.id === row.assignedEmployeeId);
              return employee ? `${employee.firstName} ${employee.lastName}` : "";
            },
            cell: (row) => {
              const employee = employees.find((item) => item.id === row.assignedEmployeeId);
              return employee ? `${employee.firstName} ${employee.lastName}` : "—";
            },
          },
          {
            id: "status",
            header: "Status",
            sortValue: (row) => row.status,
            searchValue: (row) => crmReminderStatusLabel(row.status),
            exportValue: (row) => crmReminderStatusLabel(row.status),
            cell: (row) => (
              <StatusPill
                label={
                  row.status === "open" && reminderIsOverdue(row)
                    ? "Overdue"
                    : crmReminderStatusLabel(row.status)
                }
                tone={row.status === "done" ? "success" : reminderIsOverdue(row) ? "danger" : "warning"}
              />
            ),
          },
        ]}
        actions={(row) => [
          { label: "Open", href: `/pro/dashboard/reminders/${row.id}` },
          {
            label: row.status === "open" ? "Mark done" : "Reopen",
            onSelect: () => {
              const next = row.status === "open" ? "done" : "open";
              if (useApi) {
                void dispatch(patchReminderStatus({ id: row.id, status: next }))
                  .unwrap()
                  .catch((err: string) => toast.error(err));
                return;
              }
              setReminderStatus(row.id, next);
            },
          },
          {
            label: "Delete",
            variant: "destructive",
            onSelect: () => {
              if (useApi) {
                void dispatch(deleteReminderRecord(row.id))
                  .unwrap()
                  .then(() => toast.success("Reminder removed."))
                  .catch((err: string) => toast.error(err));
                return;
              }
              remove("reminder", row.id);
              toast.success("Reminder removed.");
            },
          },
        ]}
      />
      <CreateReminderDialog open={open} onOpenChange={setOpen} />
    </PortalPage>
  );
}

export function ReminderDetailView({ id }: { id: string }) {
  const dispatch = useAppDispatch();
  const useApi = useProviderApi();
  const { reminders: directoryReminders, setReminderStatus } = useCrmDirectory();
  const { employees: crewEmployees } = usePortalCrew();
  const teamItems = useAppSelector((state) => state.team?.items ?? []);
  const reminderItems = useAppSelector((state) => state.reminders?.items ?? []);
  const employees = useApi && teamItems.length > 0 ? teamItems : crewEmployees;
  const reminders = useApi && reminderItems.length > 0 ? reminderItems : directoryReminders;
  const lookups = useReminderLookups();
  const reminder = reminders.find((item) => item.id === id);
  const pending = useCrmRecordPending();

  useEffect(() => {
    if (!useApi) return;
    void dispatch(fetchReminders());
    void dispatch(fetchTeam());
  }, [dispatch, useApi]);

  if (!reminder) {
    if (pending || (useApi && !reminderItems.length)) {
      return (
        <div className="border border-black/15 bg-card p-6">
          <h1 className="text-lg font-semibold">Loading reminder…</h1>
        </div>
      );
    }
    return <Missing href="/pro/dashboard/reminders" label="Reminder" />;
  }
  const employee = employees.find((item) => item.id === reminder.assignedEmployeeId);
  const subject = reminderSubject(reminder);
  const linkedName = lookups.label(subject.kind, subject.id);
  const overdue = reminderIsOverdue(reminder);

  function toggleStatus() {
    const next = reminder!.status === "open" ? "done" : "open";
    if (useApi) {
      void dispatch(patchReminderStatus({ id: reminder!.id, status: next }))
        .unwrap()
        .catch((err: string) => toast.error(err));
      return;
    }
    setReminderStatus(reminder!.id, next);
  }

  return (
    <RecordWorkspace
      href={`/pro/dashboard/reminders/${reminder.id}`}
      label={reminder.title}
      kind="reminder"
      tabs={[
        { id: "profile", label: "Details" },
        { id: "linked", label: "Linked record" },
      ]}
      badge={
        <StatusPill
          label={overdue ? "Overdue" : crmReminderStatusLabel(reminder.status)}
          tone={reminder.status === "done" ? "success" : overdue ? "danger" : "warning"}
        />
      }
      actions={
        <Button size="sm" onClick={toggleStatus}>
          {reminder.status === "open" ? "Mark done" : "Reopen"}
        </Button>
      }
    >
      {(tab) => {
        if (tab === "linked") {
          return (
            <div className="text-sm">
              <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                {reminderSubjectKindLabel(subject.kind)}
              </p>
              <ReminderSubjectLink kind={subject.kind} id={subject.id} name={linkedName} />
              <p className="mt-2 text-muted-foreground">
                This reminder also appears as a warning banner on that file.
              </p>
            </div>
          );
        }
        return (
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <Fact label="Due" value={formatDate(reminder.dueAt)} />
            <Fact label="Status" value={overdue ? "Overdue" : crmReminderStatusLabel(reminder.status)} />
            <Fact label="Linked to" value={`${reminderSubjectKindLabel(subject.kind)} · ${linkedName}`} />
            <Fact label="Assigned" value={employee ? `${employee.firstName} ${employee.lastName}` : "—"} />
            <Fact label="Created" value={formatDate(reminder.createdAt)} />
            <div className="sm:col-span-2">
              <Fact label="Note" value={reminder.note || "—"} />
            </div>
          </div>
        );
      }}
    </RecordWorkspace>
  );
}

function contractorColumns() {
  return [
    {
      id: "number",
      header: "ID",
      sortValue: (row: PortalContractor) => row.number,
      searchValue: (row: PortalContractor) => row.number,
      exportValue: (row: PortalContractor) => row.number,
      cell: (row: PortalContractor) => row.number,
    },
    {
      id: "company",
      header: "Company",
      sortValue: (row: PortalContractor) => row.companyName,
      searchValue: (row: PortalContractor) => `${row.companyName} ${row.firstName} ${row.lastName}`,
      exportValue: (row: PortalContractor) => row.companyName,
      cell: (row: PortalContractor) => (
        <div>
          <Link href={`/pro/dashboard/contractors/${row.id}`} className="font-medium text-primary hover:underline">
            {row.companyName}
          </Link>
          <p className="text-xs text-muted-foreground">
            {row.firstName} {row.lastName}
          </p>
        </div>
      ),
    },
    {
      id: "trade",
      header: "Trade",
      sortValue: (row: PortalContractor) => row.trade,
      searchValue: (row: PortalContractor) => row.trade,
      exportValue: (row: PortalContractor) => row.trade,
      cell: (row: PortalContractor) => row.trade,
    },
    {
      id: "license",
      header: "License",
      sortValue: (row: PortalContractor) => row.license,
      searchValue: (row: PortalContractor) => row.license,
      exportValue: (row: PortalContractor) => row.license,
      cell: (row: PortalContractor) => row.license,
    },
    {
      id: "phone",
      header: "Phone",
      sortValue: (row: PortalContractor) => row.phone,
      searchValue: (row: PortalContractor) => row.phone,
      exportValue: (row: PortalContractor) => row.phone,
      cell: (row: PortalContractor) => row.phone,
    },
    {
      id: "email",
      header: "Email",
      sortValue: (row: PortalContractor) => row.email,
      searchValue: (row: PortalContractor) => row.email,
      exportValue: (row: PortalContractor) => row.email,
      cell: (row: PortalContractor) => <span className="text-primary">{row.email}</span>,
    },
    {
      id: "city",
      header: "City",
      sortValue: (row: PortalContractor) => row.city,
      searchValue: (row: PortalContractor) => `${row.city} ${row.state} ${row.zip}`,
      exportValue: (row: PortalContractor) => `${row.city}, ${row.state}`,
      cell: (row: PortalContractor) => `${row.city}, ${row.state}`,
    },
    {
      id: "rate",
      header: "Rate",
      sortValue: (row: PortalContractor) => row.hourlyRate,
      searchValue: (row: PortalContractor) => formatMoney(row.hourlyRate),
      exportValue: (row: PortalContractor) => formatMoney(row.hourlyRate),
      className: "tabular-nums",
      cell: (row: PortalContractor) => `${formatMoney(row.hourlyRate)}/hr`,
    },
    {
      id: "insurance",
      header: "Insurance",
      sortValue: (row: PortalContractor) => row.insuranceExpires,
      searchValue: (row: PortalContractor) => formatDate(row.insuranceExpires),
      exportValue: (row: PortalContractor) => formatDate(row.insuranceExpires),
      cell: (row: PortalContractor) => formatDate(row.insuranceExpires),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (row: PortalContractor) => row.status,
      searchValue: (row: PortalContractor) => crmStatusLabel(row.status),
      exportValue: (row: PortalContractor) => crmStatusLabel(row.status),
      cell: (row: PortalContractor) => (
        <StatusPill label={crmStatusLabel(row.status)} tone={row.status === "active" ? "success" : "neutral"} />
      ),
    },
  ];
}

function vendorColumns() {
  return [
    {
      id: "number",
      header: "ID",
      sortValue: (row: PortalVendor) => row.number,
      searchValue: (row: PortalVendor) => row.number,
      exportValue: (row: PortalVendor) => row.number,
      cell: (row: PortalVendor) => row.number,
    },
    {
      id: "name",
      header: "Vendor",
      sortValue: (row: PortalVendor) => row.name,
      searchValue: (row: PortalVendor) => `${row.name} ${row.contact}`,
      exportValue: (row: PortalVendor) => row.name,
      cell: (row: PortalVendor) => (
        <Link href={`/pro/dashboard/vendors/${row.id}`} className="font-medium text-primary hover:underline">
          {row.name}
        </Link>
      ),
    },
    {
      id: "category",
      header: "Category",
      sortValue: (row: PortalVendor) => row.category,
      searchValue: (row: PortalVendor) => row.category,
      exportValue: (row: PortalVendor) => row.category,
      cell: (row: PortalVendor) => row.category,
    },
    {
      id: "contact",
      header: "Contact",
      sortValue: (row: PortalVendor) => row.contact,
      searchValue: (row: PortalVendor) => row.contact,
      exportValue: (row: PortalVendor) => row.contact,
      cell: (row: PortalVendor) => row.contact,
    },
    {
      id: "email",
      header: "Email",
      sortValue: (row: PortalVendor) => row.email,
      searchValue: (row: PortalVendor) => row.email,
      exportValue: (row: PortalVendor) => row.email,
      cell: (row: PortalVendor) => <span className="text-primary">{row.email}</span>,
    },
    {
      id: "phone",
      header: "Phone",
      sortValue: (row: PortalVendor) => row.phone,
      searchValue: (row: PortalVendor) => row.phone,
      exportValue: (row: PortalVendor) => row.phone,
      cell: (row: PortalVendor) => row.phone,
    },
    {
      id: "account",
      header: "Account #",
      sortValue: (row: PortalVendor) => row.accountNumber,
      searchValue: (row: PortalVendor) => row.accountNumber,
      exportValue: (row: PortalVendor) => row.accountNumber,
      cell: (row: PortalVendor) => row.accountNumber,
    },
    {
      id: "terms",
      header: "Terms",
      sortValue: (row: PortalVendor) => row.terms,
      searchValue: (row: PortalVendor) => row.terms,
      exportValue: (row: PortalVendor) => row.terms,
      cell: (row: PortalVendor) => row.terms,
    },
    {
      id: "balance",
      header: "Balance",
      sortValue: (row: PortalVendor) => row.balance,
      searchValue: (row: PortalVendor) => formatMoney(row.balance),
      exportValue: (row: PortalVendor) => formatMoney(row.balance),
      className: "tabular-nums",
      cell: (row: PortalVendor) => formatMoney(row.balance),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (row: PortalVendor) => row.status,
      searchValue: (row: PortalVendor) => crmStatusLabel(row.status),
      exportValue: (row: PortalVendor) => crmStatusLabel(row.status),
      cell: (row: PortalVendor) => (
        <StatusPill label={crmStatusLabel(row.status)} tone={row.status === "active" ? "success" : "neutral"} />
      ),
    },
  ];
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-0.5">{value}</p>
    </div>
  );
}

function Missing({ href, label }: { href: string; label: string }) {
  const plural =
    label.toLowerCase() === "reminder"
      ? "reminders"
      : label.toLowerCase().endsWith("s")
        ? label.toLowerCase()
        : `${label.toLowerCase()}s`;
  return (
    <div className="border border-black/15 bg-card p-6">
      <h1 className="text-lg font-semibold">{label} not found</h1>
      <Button asChild className="mt-4" size="sm">
        <Link href={href}>Back to {plural}</Link>
      </Button>
    </div>
  );
}
