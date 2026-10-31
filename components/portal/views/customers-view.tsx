"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CreateCustomerDialog } from "@/components/portal/create-person-dialogs";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { PortalPage } from "@/components/portal/portal-page";
import { SourceFilter } from "@/components/portal/source-filter";
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
import { CUSTOMER_FILTER_OPTIONS, customerFilterLabel, originLabel } from "@/lib/data/lead-origins";
import { AccountBadge } from "@/components/portal/account-badge";
import { LocationCell, locationText } from "@/components/portal/location-cell";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAuth, selectAuthUser } from "@/store/authSlice";
import {
  clearCustomersError,
  customersApiSearch,
  fetchCustomers,
  invalidateCustomersCache,
  setCustomersLetter,
  setCustomersOrigin,
  setCustomersPage,
  setCustomersSearch,
} from "@/store/customersSlice";

const SEARCH_DEBOUNCE_MS = 400;

/** "AI call" / "Website" / "Request Services" from the API; the Pro's own pick otherwise. */
function customerSourceLabel(row: PortalCustomerCrm) {
  if (row.origin && row.origin !== "manual") return originLabel(row.origin);
  return crmSourceLabel(row.source);
}
const CUSTOMERS_PAGE_SIZE = 10;

export function CustomersView() {
  const dispatch = useAppDispatch();
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectAuthUser);
  // Live, this page lists its own paginated customers; `customers` only feeds offline mode.
  const { customers, remove } = useCrmDirectory({ customerLookup: false });
  const records = usePortalRecords();
  const directoryRows = records.keep("customer", customers);
  const pending = useCrmRecordPending();

  // Customers list uses its own Redux API — do not wait for the full CRM snapshot.
  const useApi =
    auth.hydrated &&
    Boolean(auth.token) &&
    (user?.role === "provider" || auth.role === "provider");

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
    limit: CUSTOMERS_PAGE_SIZE,
    total: 0,
    totalPages: 1,
    search: "",
    letter: "",
    loading: true,
    error: null,
  };

  const origin = slice?.origin ?? "";
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PortalCustomerCrm | null>(null);
  const [searchInput, setSearchInput] = useState(search);
  const [actionLoading, setActionLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const apiSearch = customersApiSearch(search, letter);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  // Active Customers tab → always hit customers API (limit 10).
  useEffect(() => {
    if (!useApi) return;
    let cancelled = false;
    void dispatch(
      fetchCustomers({
        force: true,
        limit: CUSTOMERS_PAGE_SIZE,
      }),
    ).finally(() => {
      if (!cancelled) setActionLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [dispatch, useApi, page, search, letter, origin]);

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
  const tableLoading =
    actionLoading ||
    (useApi
      ? loading && items.length === 0
      : pending && directoryRows.length === 0);

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

  function onOriginChange(next: typeof origin) {
    if (next === origin) return;
    setActionLoading(true);
    dispatch(setCustomersOrigin(next));
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
    void dispatch(
      fetchCustomers({ force: true, limit: CUSTOMERS_PAGE_SIZE }),
    ).finally(() => {
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
        toolbar={
          useApi ? (
            <SourceFilter value={origin} options={CUSTOMER_FILTER_OPTIONS} onChange={onOriginChange} />
          ) : null
        }
        empty={
          apiSearch
            ? "No customers match this search."
            : origin
              ? `No customers match "${customerFilterLabel(origin)}".`
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
                <div className="flex flex-wrap items-center gap-1.5">
                  <Link href={`/pro/dashboard/customers/${row.id}`} className="font-medium text-primary hover:underline">
                    {crmCustomerName(row)}
                  </Link>
                  <AccountBadge account={row.account} />
                </div>
                {/* Email has its own column; a company still shows its contact person. */}
                {row.entityKind === "company" ? (
                  <p className="text-xs text-muted-foreground">
                    {row.firstName} {row.lastName}
                  </p>
                ) : null}
              </div>
            ),
          },
          {
            id: "address",
            header: "Address",
            sortValue: (row) => locationText(...row.addresses),
            searchValue: (row) => locationText(...row.addresses),
            exportValue: (row) => locationText(...row.addresses),
            cell: (row) => <LocationCell candidates={row.addresses} map={{ customerName: crmCustomerName(row) }} />,
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
            sortValue: (row) => customerSourceLabel(row),
            searchValue: (row) => customerSourceLabel(row),
            exportValue: (row) => customerSourceLabel(row),
            cell: (row) => customerSourceLabel(row),
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
        onOpenChange={setOpen}
      />
      <CreateCustomerDialog
        open={Boolean(editing)}
        customer={editing}
        onOpenChange={(next) => {
          if (!next) setEditing(null);
        }}
        onSaved={refreshList}
      />
    </PortalPage>
  );
}
