"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CreateNoteDialog } from "@/components/portal/create-person-dialogs";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { StatusPill } from "@/components/portal/status-pill";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";
import { Button } from "@/components/ui/button";
import {
  noteTitle,
  notesFor,
  reminderSubjectKindLabel,
  type PortalNote,
  type ReminderSubjectKind,
} from "@/lib/data/crm-people";
import { formatDate } from "@/lib/format";

export function NotesPanel({
  kind,
  id,
  empty,
}: {
  kind: ReminderSubjectKind;
  id: string;
  empty?: string;
}) {
  const { notes, remove, updateNote } = useCrmDirectory();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PortalNote | null>(null);
  const rows = notesFor(notes, kind, id);
  const label = reminderSubjectKindLabel(kind).toLowerCase();

  function copyNote(row: PortalNote) {
    const text = [noteTitle(row), row.body].filter(Boolean).join("\n\n");
    void navigator.clipboard.writeText(text).then(
      () => toast.success("Note copied."),
      () => toast.error("Could not copy this note."),
    );
  }

  return (
    <div className="space-y-3">
      <PortalDataTable
        rows={rows}
        rowKey={(row) => row.id}
        filename={`${kind}-notes`}
        countLabel="Notes"
        searchPlaceholder="Search notes"
        empty={empty ?? `No notes on this ${label} yet.`}
        toolbar={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            Add note
          </Button>
        }
        columns={[
          {
            id: "title",
            header: "Title",
            sortValue: (row) => noteTitle(row),
            searchValue: (row) => noteTitle(row),
            exportValue: (row) => noteTitle(row),
            cell: (row) => (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{noteTitle(row)}</span>
                {row.pinned ? <StatusPill label="Pinned" tone="primary" /> : null}
              </div>
            ),
          },
          {
            id: "note",
            header: "Note",
            sortValue: (row) => row.body,
            searchValue: (row) => row.body,
            exportValue: (row) => row.body,
            cell: (row) => <span className="line-clamp-2 text-muted-foreground">{row.body || "—"}</span>,
          },
          {
            id: "author",
            header: "Author",
            sortValue: (row) => row.authorName,
            searchValue: (row) => row.authorName,
            exportValue: (row) => row.authorName,
            cell: (row) => row.authorName,
          },
          {
            id: "date",
            header: "Date",
            sortValue: (row) => row.createdAt,
            searchValue: (row) => formatDate(row.createdAt),
            exportValue: (row) => formatDate(row.createdAt),
            cell: (row) => formatDate(row.createdAt),
          },
        ]}
        actions={(row) => [
          { label: "Edit", onSelect: () => setEditing(row) },
          row.pinned
            ? {
                label: "Unpin",
                onSelect: () => {
                  updateNote(row.id, { pinned: false });
                  toast.success("Note unpinned.");
                },
              }
            : {
                label: "Pin",
                onSelect: () => {
                  updateNote(row.id, { pinned: true });
                  toast.success("Note pinned to the top.");
                },
              },
          { label: "Copy", onSelect: () => copyNote(row) },
          {
            label: "Delete",
            variant: "destructive",
            onSelect: () => {
              remove("note", row.id);
              toast.success("Note removed.");
            },
          },
        ]}
      />
      <CreateNoteDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        subjectKind={kind}
        subjectId={id}
      />
      <CreateNoteDialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        subjectKind={kind}
        subjectId={id}
        note={editing}
      />
    </div>
  );
}
