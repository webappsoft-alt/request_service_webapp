"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CreateCustomerDialog } from "@/components/portal/create-person-dialogs";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { PortalPage } from "@/components/portal/portal-page";
import { useCrmApiData } from "@/components/portal/use-crm-api-data";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";
import { useCrmRecordPending } from "@/components/portal/use-crm-record-pending";
import { usePortalRecords } from "@/components/portal/use-portal-records";
import { Button } from "@/components/ui/button";
import {
  crmCustomerName,
  crmSourceLabel,
  crmTypeLabel,
  type PortalCustomerCrm,
} from "@/lib/data/crm-people";
import { formatDate, formatMoney } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  clearCustomersError,
  customersApiSearch,
  fetchCustomers,
  invalidateCustomersCache,
  setCustomersLetter,
  setCustomersPage,
  setCustomersSearch,
} from "@/store/customersSlice";

const SEARCH_DEBOUNCE_MS = 400;

export function CustomersView() {
  const dispatch = useAppDispatch();
  const { customers, remove } = useCrmDirectory();
  const crm = useCrmApiData();
  const records = usePortalRecords();
  const directoryRows = records.keep("customer", customers);
  const pending = useCrmRecordPending();
  const useApi = crm.enabled && crm.ready;

  const slice = useAppSelector((state) => state.customers);
  const {
    items,
    page,
    limit,
    total,
    totalPages,
    search,
    letter,
    loading,
    error,
  } = slice ?? {
    items: [],
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
    search: "",
    letter: "",
    loading: true,
    error: null,
  };

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PortalCustomerCrm | null>(null);
  const [searchInput, setSearchInput] = useState(search);
  const [actionLoading, setActionLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const apiSearch = customersApiSearch(search, letter);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    if (!useApi) return;
    let cancelled = false;
    void dispatch(fetchCustomers()).finally(() => {
      if (!cancelled) setActionLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [dispatch, useApi, page, search, letter, limit]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (!useApi || !error || loading) return;
    toast.error(error);
    dispatch(clearCustomersError());
  }, [dispatch, error, loading, useApi]);

  const rows = useApi ? items : directoryRows;
  // Cached remount → no loader. Search / letter / page → soft overlay via actionLoading.
  const tableLoading =
    actionLoading ||
    (useApi ? loading && items.length === 0 : pending && directoryRows.length === 0);

  function onLetterChange(next: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearchInput("");
    setActionLoading(true);
    dispatch(setCustomersLetter(next));
  }

  function onSearchChange(value: string) {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setActionLoading(true);
      dispatch(setCustomersSearch(value.trim()));
    }, SEARCH_DEBOUNCE_MS);
  }

  function onPageChange(nextPage: number) {
    if (nextPage === page) return;
    setActionLoading(true);
    dispatch(setCustomersPage(nextPage));
  }

  function refreshList() {
    if (!useApi) return;
    setActionLoading(true);
    dispatch(invalidateCustomersCache());
    void dispatch(fetchCustomers({ force: true })).finally(() => {
      setActionLoading(false);
    });
  }

  return (
    <PortalPage
      eyebrow="People / Customers"
      title={`Customers (${useApi ? total : rows.length})`}
      description="Website requests and office-created accounts. Click a row to open the full customer file."
      actions={
        <Button size="sm" onClick={() => setOpen(true)}>
          + Create customer
        </Button>
      }
    >
      <PortalDataTable
        filename="customers"
        countLabel="Customers"
        searchPlaceholder="Search name, email, address, ID…"
        loading={tableLoading}
        letters
        letterValue={(row) => crmCustomerName(row)}
        rows={rows}
        rowKey={(row) => row.id}
        rowHref={(row) => `/pro/dashboard/customers/${row.id}`}
        pageSize={limit}
        empty={
          apiSearch
            ? "No customers match this search."
            : "No customers yet. Create your first customer."
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
                letter,
                onLetterChange,
              }
            : undefined
        }
        columns={[
          {
            id: "number",
            header: "ID",
            sortValue: (row) => row.customerNumber,
            searchValue: (row) => row.customerNumber,
            exportValue: (row) => row.customerNumber,
            cell: (row) => <span className="tabular-nums text-muted-foreground">{row.customerNumber}</span>,
          },
          {
            id: "name",
            header: "Customer",
            sortValue: (row) => crmCustomerName(row),
            searchValue: (row) =>
              `${crmCustomerName(row)} ${row.firstName} ${row.lastName} ${row.email} ${row.phone ?? ""}`,
            exportValue: (row) => crmCustomerName(row),
            cell: (row) => (
              <div>
                <Link href={`/pro/dashboard/customers/${row.id}`} className="font-medium text-primary hover:underline">
                  {crmCustomerName(row)}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {row.entityKind === "company" ? `${row.firstName} ${row.lastName}` : row.email}
                </p>
              </div>
            ),
          },
          {
            id: "street",
            header: "Street",
            sortValue: (row) => row.addresses[0]?.street ?? "",
            searchValue: (row) => row.addresses[0]?.street ?? "",
            exportValue: (row) => row.addresses[0]?.street ?? "",
            cell: (row) => row.addresses[0]?.street ?? "—",
          },
          {
            id: "city",
            header: "City",
            sortValue: (row) => row.addresses[0]?.city ?? "",
            searchValue: (row) => row.addresses[0]?.city ?? "",
            exportValue: (row) => row.addresses[0]?.city ?? "",
            cell: (row) => row.addresses[0]?.city ?? "—",
          },
          {
            id: "state",
            header: "ST",
            sortValue: (row) => row.addresses[0]?.state ?? "",
            searchValue: (row) => row.addresses[0]?.state ?? "",
            exportValue: (row) => row.addresses[0]?.state ?? "",
            cell: (row) => row.addresses[0]?.state ?? "—",
          },
          {
            id: "zip",
            header: "ZIP",
            sortValue: (row) => row.addresses[0]?.zip ?? "",
            searchValue: (row) => row.addresses[0]?.zip ?? "",
            exportValue: (row) => row.addresses[0]?.zip ?? "",
            cell: (row) => row.addresses[0]?.zip ?? "—",
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
            sortValue: (row) => row.phone ?? "",
            searchValue: (row) => row.phone ?? "",
            exportValue: (row) => row.phone ?? "",
            cell: (row) => row.phone ?? "—",
          },
          {
            id: "type",
            header: "Type",
            sortValue: (row) => row.customerType,
            searchValue: (row) => crmTypeLabel(row.customerType),
            exportValue: (row) => crmTypeLabel(row.customerType),
            cell: (row) => crmTypeLabel(row.customerType),
          },
          {
            id: "source",
            header: "Source",
            sortValue: (row) => row.source,
            searchValue: (row) => crmSourceLabel(row.source),
            exportValue: (row) => crmSourceLabel(row.source),
            cell: (row) => crmSourceLabel(row.source),
          },
          {
            id: "owing",
            header: "Amount owing",
            sortValue: (row) => row.amountOwing,
            searchValue: (row) => formatMoney(row.amountOwing),
            exportValue: (row) => formatMoney(row.amountOwing),
            className: "tabular-nums",
            cell: (row) => (
              <span className={row.amountOwing > 0 ? "font-medium text-primary" : undefined}>
                {formatMoney(row.amountOwing)}
              </span>
            ),
          },
          {
            id: "tax",
            header: "Tax code",
            sortValue: (row) => row.taxCode,
            searchValue: (row) => `${row.taxCode} ${row.laborTaxCode}`,
            exportValue: (row) => row.taxCode,
            cell: (row) => row.taxCode,
          },
          {
            id: "added",
            header: "Date created",
            sortValue: (row) => row.createdAt,
            searchValue: (row) => formatDate(row.createdAt),
            exportValue: (row) => formatDate(row.createdAt),
            cell: (row) => formatDate(row.createdAt),
          },
        ]}
        actions={(row) => [
          { label: "Open file", href: `/pro/dashboard/customers/${row.id}` },
          {
            label: "Edit",
            onSelect: () => setEditing(row),
          },
          { label: "Estimates", href: `/pro/dashboard/customers/${row.id}?tab=estimates` },
          { label: "Jobs", href: `/pro/dashboard/customers/${row.id}?tab=jobs` },
          { label: "Reminders", href: `/pro/dashboard/customers/${row.id}?tab=reminders` },
          {
            label: "Delete",
            variant: "destructive",
            onSelect: () => {
              records.remove("customer", row.id);
              void Promise.resolve(remove("customer", row.id)).then(() => {
                refreshList();
              });
              toast.success(`${crmCustomerName(row)} removed from this board.`);
            },
          },
        ]}
      />
      <CreateCustomerDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) refreshList();
        }}
      />
      <CreateCustomerDialog
        open={Boolean(editing)}
        customer={editing}
        onOpenChange={(next) => {
          if (!next) {
            setEditing(null);
            refreshList();
          }
        }}
      />
    </PortalPage>
  );
}
