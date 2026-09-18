"use client";

import { Archive, ArchiveRestore, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { usePortalRecords, type PortalRecordKind } from "@/components/portal/use-portal-records";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusPill } from "@/components/portal/status-pill";

export function ConfirmArchiveDialog({
  open,
  onOpenChange,
  title,
  description,
  kind = "estimate",
  number,
  loading = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  kind?: PortalRecordKind;
  number?: string;
  loading?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title || `Archive ${kind}`}</DialogTitle>
          <DialogDescription>
            {description ||
              `Are you sure you want to archive ${number ? `${kind} ${number}` : `this ${kind}`}? It will be hidden from the active board.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                Archiving...
              </span>
            ) : (
              `Archive ${kind}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function archiveRowAction(
  records: ReturnType<typeof usePortalRecords>,
  kind: PortalRecordKind,
  id: string,
  number: string,
  onTriggerArchive?: (id: string, number: string) => void,
) {
  if (records.isArchived(kind, id)) {
    return {
      label: "Restore",
      icon: <ArchiveRestore className="size-3.5 text-muted-foreground" />,
      onSelect: () => {
        records.unarchive(kind, id);
        toast.success(`${number} restored.`);
      },
    };
  }
  return {
    label: "Archive",
    icon: <Archive className="size-3.5 text-muted-foreground" />,
    onSelect: () => {
      if (onTriggerArchive) {
        onTriggerArchive(id, number);
        return;
      }
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
