"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CreateCustomerDialog } from "@/components/portal/create-person-dialogs";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { PortalPage } from "@/components/portal/portal-page";
import { StatusPill } from "@/components/portal/status-pill";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";
import { usePortalRecords } from "@/components/portal/use-portal-records";
import { Button } from "@/components/ui/button";
import { crmCustomerName, crmSourceLabel, crmTypeLabel } from "@/lib/data/crm-people";
import { formatDate, formatMoney } from "@/lib/format";

export function CustomersView() {
  const { customers, remove } = useCrmDirectory();
  const records = usePortalRecords();
  const rows = records.keep("customer", customers);
  const [open, setOpen] = useState(false);

  return (
    <PortalPage
      eyebrow="People / Customers"
      title={`Customers (${rows.length})`}
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
        letters
        letterValue={(row) => crmCustomerName(row)}
        rows={rows}
        rowKey={(row) => row.id}
        rowHref={(row) => `/pro/dashboard/customers/${row.id}`}
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
            id: "credit",
            header: "Credit limit",
            sortValue: (row) => row.creditLimit,
            searchValue: (row) => formatMoney(row.creditLimit),
            exportValue: (row) => formatMoney(row.creditLimit),
            className: "tabular-nums",
            cell: (row) => formatMoney(row.creditLimit),
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
            id: "stop",
            header: "On stop",
            sortValue: (row) => (row.onStop ? 1 : 0),
            searchValue: (row) => (row.onStop ? "yes" : "no"),
            exportValue: (row) => (row.onStop ? "Yes" : "No"),
            cell: (row) =>
              row.onStop ? <StatusPill label="On stop" tone="danger" /> : <span className="text-muted-foreground">No</span>,
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
          { label: "Estimates", href: `/pro/dashboard/customers/${row.id}?tab=estimates` },
          { label: "Jobs", href: `/pro/dashboard/customers/${row.id}?tab=jobs` },
          { label: "Reminders", href: `/pro/dashboard/customers/${row.id}?tab=reminders` },
          {
            label: "Delete",
            variant: "destructive",
            onSelect: () => {
              records.remove("customer", row.id);
              remove("customer", row.id);
              toast.success(`${crmCustomerName(row)} removed from this board.`);
            },
          },
        ]}
      />
      <CreateCustomerDialog open={open} onOpenChange={setOpen} />
    </PortalPage>
  );
}
