"use client";

import { toast } from "sonner";
import { usePortalRecords, type PortalRecordKind } from "@/components/portal/use-portal-records";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/portal/status-pill";

export function archiveRowAction(records: ReturnType<typeof usePortalRecords>, kind: PortalRecordKind, id: string, number: string) {
  if (records.isArchived(kind, id)) {
    return {
      label: "Restore",
      onSelect: () => {
        records.unarchive(kind, id);
        toast.success(`${number} restored.`);
      },
    };
  }
  return {
    label: "Archive",
    onSelect: () => {
      records.archive(kind, id);
      toast.success(`${number} archived.`);
    },
  };
}

export function ArchiveButton({
  kind,
  id,
  label,
}: {
  kind: PortalRecordKind;
  id: string;
  label: string;
}) {
  const records = usePortalRecords();
  const archived = records.isArchived(kind, id);
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => {
        if (archived) {
          records.unarchive(kind, id);
          toast.success(`${label} restored.`);
          return;
        }
        records.archive(kind, id);
        toast.success(`${label} archived.`);
      }}
    >
      {archived ? "Restore" : "Archive"}
    </Button>
  );
}

export function ArchiveBadge({ kind, id }: { kind: PortalRecordKind; id: string }) {
  const records = usePortalRecords();
  if (!records.isArchived(kind, id)) return null;
  return <StatusPill label="Archived" className="bg-slate-100 text-slate-700" />;
}

export function matchesArchiveFilter<T extends { id: string; status?: string }>(
  records: ReturnType<typeof usePortalRecords>,
  kind: PortalRecordKind,
  row: T,
  filter: string,
) {
  const archived = records.isArchived(kind, row.id);
  if (filter === "archived") return archived;
  return !archived && (!filter || row.status === filter);
}
