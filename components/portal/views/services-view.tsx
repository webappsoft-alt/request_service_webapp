"use client";

import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { PortalPage } from "@/components/portal/portal-page";
import { StatusPill } from "@/components/portal/status-pill";
import { usePortalRecords } from "@/components/portal/use-portal-records";
import { usePortalSettings } from "@/components/portal/use-portal-settings";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import { Button } from "@/components/ui/button";
import { serviceHours, serviceUnitLabel } from "@/lib/data/portal";
import { getAreaName } from "@/lib/data/service-areas";
import { formatMoney, groupWorkingHours } from "@/lib/format";

export function ServicesView() {
  const { services } = usePortalWorkspace();
  const records = usePortalRecords();
  const { officeHours } = usePortalSettings();
  const rows = records.mergeServices(services);

  return (
    <PortalPage
      eyebrow="Catalog"
      title="Fixed services"
      description="Priced offerings customers can request from your profile. Open a service to edit photos, coverage, areas, and hours."
      actions={
        <Button asChild>
          <Link href="/pro/dashboard/services/new">Add service</Link>
        </Button>
      }
    >
      <PortalDataTable
        filename="services"
        searchPlaceholder="Search services"
        rows={rows}
        rowKey={(row) => row.id}
        columns={[
          {
            id: "name",
            header: "Service",
            sortValue: (row) => row.name,
            searchValue: (row) => `${row.name} ${row.description} ${(row.coverage ?? []).join(" ")}`,
            exportValue: (row) => row.name,
            cell: (row) => (
              <div className="flex items-center gap-3">
                <span className="relative size-12 shrink-0 overflow-hidden rounded-md bg-[#003F7D]">
                  {row.images?.[0] ? (
                    <Image src={row.images[0]} alt="" fill sizes="48px" className="object-cover" />
                  ) : null}
                </span>
                <div>
                  <Link href={`/pro/dashboard/services/${row.id}`} className="font-medium text-primary hover:underline">
                    {row.name}
                  </Link>
                  <p className="max-w-md truncate text-xs text-muted-foreground">{row.description}</p>
                </div>
              </div>
            ),
          },
          {
            id: "category",
            header: "Category",
            sortValue: (row) => row.categoryName,
            searchValue: (row) => row.categoryName,
            exportValue: (row) => row.categoryName,
            cell: (row) => row.categoryName,
          },
          {
            id: "price",
            header: "Price",
            sortValue: (row) => row.price,
            searchValue: (row) => `${formatMoney(row.price)} ${row.unit}`,
            exportValue: (row) => `${formatMoney(row.price)} ${serviceUnitLabel(row.unit)}`,
            className: "tabular-nums",
            cell: (row) => `${formatMoney(row.price)} ${serviceUnitLabel(row.unit)}`,
          },
          {
            id: "areas",
            header: "Areas",
            sortValue: (row) => row.areaZips.length,
            searchValue: (row) => row.areaZips.map((zip) => `${getAreaName(zip)} ${zip}`).join(" "),
            exportValue: (row) => row.areaZips.map((zip) => `${getAreaName(zip)} ${zip}`).join(", "),
            cell: (row) =>
              row.areaZips.length
                ? `${row.areaZips.length} ${row.areaZips.length === 1 ? "area" : "areas"}`
                : "None",
          },
          {
            id: "hours",
            header: "Availability",
            sortValue: (row) => row.availabilityMode,
            searchValue: (row) => (row.availabilityMode === "office" ? "Office hours" : "Custom hours"),
            exportValue: (row) =>
              groupWorkingHours(serviceHours(row, officeHours))
                .map((group) => `${group.label} ${group.value}`)
                .join("; "),
            cell: (row) => (row.availabilityMode === "office" ? "Office hours" : "Custom hours"),
          },
          {
            id: "status",
            header: "Status",
            sortValue: (row) => (row.active ? "active" : "hidden"),
            searchValue: (row) => (row.active ? "Active" : "Hidden"),
            exportValue: (row) => (row.active ? "Active" : "Hidden"),
            cell: (row) => (
              <StatusPill label={row.active ? "Active" : "Hidden"} tone={row.active ? "success" : "neutral"} />
            ),
          },
        ]}
        actions={(row) => [
          { label: "Edit", href: `/pro/dashboard/services/${row.id}` },
          {
            label: row.active ? "Hide" : "Show",
            onSelect: () => {
              records.setStatus("service", row.id, row.active ? "hidden" : "active");
              toast.success(row.active ? "Service hidden from the catalog." : "Service is active again.");
            },
          },
          {
            label: "Delete",
            variant: "destructive",
            onSelect: () => {
              records.remove("service", row.id);
              toast.success(`${row.name} removed from this catalog.`);
            },
          },
        ]}
      />
    </PortalPage>
  );
}

export { ServiceFormView } from "@/components/portal/service-file";
