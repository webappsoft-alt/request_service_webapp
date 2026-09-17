"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { extractErrorMessage } from "@/components/api/apiFuntions";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { StatusPill } from "@/components/portal/status-pill";
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
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/format";
import type { ReminderSubjectKind } from "@/lib/data/crm-people";
import { reminderSubjectKindLabel } from "@/lib/data/crm-people";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  getNotesModuleForSubject,
  NOTES_ENTITY_BY_SUBJECT,
  notesModuleKeyBySubject,
} from "@/store/notes/modules";
import type { CrmNote } from "@/store/notes/types";
import { createInitialEntityNotesState } from "@/store/notes/types";

const SEARCH_DEBOUNCE_MS = 400;

function noteDisplayTitle(note: CrmNote) {
  return note.title.trim() || note.content.trim() || "Note";
}

export function CreateUniversalNoteDialog({
  open,
  onOpenChange,
  subjectKind,
  entityId,
  note,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectKind: ReminderSubjectKind;
  entityId: string;
  note?: CrmNote | null;
}) {
  const dispatch = useAppDispatch();
  const module = getNotesModuleForSubject(subjectKind);
  const stateKey = notesModuleKeyBySubject[subjectKind];
  const mutating = useAppSelector(
    (state) => state[stateKey]?.mutating ?? false,
  );
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const label = reminderSubjectKindLabel(subjectKind).toLowerCase();

  useEffect(() => {
    if (!open) return;
    setTitle(note?.title ?? "");
    setBody(note?.content ?? "");
    setSaving(false);
  }, [note, open]);

  async function save() {
    if (saving || mutating) return;
    const nextTitle = title.trim();
    const nextBody = body.trim();
    if (!nextTitle && !nextBody) return;

    const content = nextBody || nextTitle;
    setSaving(true);
    try {
      if (note) {
        const result = await dispatch(
          module.updateNote({
            id: note.id,
            title: nextTitle,
            content,
          }),
        );
        if (!module.updateNote.fulfilled.match(result)) {
          throw new Error(
            typeof result.payload === "string"
              ? result.payload
              : "Could not update this note.",
          );
        }
        toast.success("Note updated.");
      } else {
        const result = await dispatch(
          module.createNote({
            entityId,
            title: nextTitle,
            content,
          }),
        );
        if (!module.createNote.fulfilled.match(result)) {
          throw new Error(
            typeof result.payload === "string"
              ? result.payload
              : "Could not save this note.",
          );
        }
        toast.success(`Note added to this ${label}.`);
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(
        extractErrorMessage(error) || "Could not save this note.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg" data-lenis-prevent>
        <DialogHeader>
          <DialogTitle>{note ? "Edit note" : "Add note"}</DialogTitle>
          <DialogDescription>
            {note
              ? `Update the office note on this ${label}.`
              : `A short office note on this ${label}. It stays on the file.`}
          </DialogDescription>
        </DialogHeader>
        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel htmlFor="universal-note-title">Title</FieldLabel>
            <Input
              id="universal-note-title"
              value={title}
              onChange={(change) => setTitle(change.target.value)}
              placeholder="Access, billing, follow-up…"
            />
          </Field>
          <Field className="w-full">
            <FieldLabel htmlFor="universal-note-body">Note</FieldLabel>
            <Textarea
              id="universal-note-body"
              className="w-full min-h-24"
              value={body}
              onChange={(change) => setBody(change.target.value)}
              rows={5}
              placeholder="Gate code, billing preference, access…"
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            disabled={saving || (!title.trim() && !body.trim())}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : note ? "Save changes" : "Save note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Shared CRM Notes UI. Parent supplies subjectKind + entityId;
 * each module keeps its own Redux slice (Customer / Estimate / Lead / …).
 */
export function UniversalNotesPanel({
  subjectKind,
  entityId,
  empty,
}: {
  subjectKind: ReminderSubjectKind;
  entityId: string;
  empty?: string;
}) {
  const dispatch = useAppDispatch();
  const module = getNotesModuleForSubject(subjectKind);
  const stateKey = notesModuleKeyBySubject[subjectKind];
  const entityType = NOTES_ENTITY_BY_SUBJECT[subjectKind];
  const label = reminderSubjectKindLabel(subjectKind).toLowerCase();

  const slice = useAppSelector(
    (state) => state[stateKey] ?? createInitialEntityNotesState(),
  );
  const {
    items,
    page,
    limit,
    total,
    totalPages,
    search,
    loading,
    mutating,
    error,
  } = slice;

  const [searchInput, setSearchInput] = useState(search);
  const [actionLoading, setActionLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CrmNote | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CrmNote | null>(null);
  const [deleting, setDeleting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    dispatch(module.actions.setEntity(entityId));
  }, [dispatch, entityId, module.actions]);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  // Always refetch when this panel mounts or page/search changes.
  // Slice pending only sets loading when items are empty → existing rows
  // stay visible while the GET runs in the background.
  useEffect(() => {
    if (!entityId) return;
    void dispatch(module.fetchNotes({ entityId, force: true }));
  }, [dispatch, entityId, page, search, limit, module.fetchNotes]);

  useEffect(() => {
    if (!loading) setActionLoading(false);
  }, [loading]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (!error || loading || mutating) return;
    toast.error(error);
    dispatch(module.actions.clearError());
  }, [dispatch, error, loading, mutating, module.actions]);

  const tableLoading = actionLoading || (loading && items.length === 0);

  function onSearchChange(value: string) {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setActionLoading(true);
      dispatch(module.actions.setSearch(value));
    }, SEARCH_DEBOUNCE_MS);
  }

  function onPageChange(nextPage: number) {
    if (nextPage === page) return;
    setActionLoading(true);
    dispatch(module.actions.setPage(nextPage));
  }

  async function togglePin(row: CrmNote) {
    const nextPinned = !row.isPinned;
    dispatch(
      module.actions.optimisticTogglePin({
        id: row.id,
        isPinned: nextPinned,
      }),
    );
    const result = await dispatch(
      module.updateNote({ id: row.id, isPinned: nextPinned }),
    );
    if (module.updateNote.fulfilled.match(result)) {
      toast.success(nextPinned ? "Note pinned to the top." : "Note unpinned.");
      return;
    }
    dispatch(
      module.actions.optimisticTogglePin({
        id: row.id,
        isPinned: row.isPinned,
      }),
    );
    toast.error(
      typeof result.payload === "string"
        ? result.payload
        : "Could not update pin status.",
    );
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    const row = deleteTarget;
    setDeleting(true);
    try {
      const result = await dispatch(module.deleteNote(row.id));
      if (module.deleteNote.fulfilled.match(result)) {
        setDeleteTarget(null);
        toast.success("Note removed.");
        if (items.length <= 1 && page > 1) {
          dispatch(module.actions.setPage(page - 1));
          void dispatch(
            module.fetchNotes({
              entityId,
              page: page - 1,
            }),
          );
        }
        return;
      }
      toast.error(
        typeof result.payload === "string"
          ? result.payload
          : "Could not delete this note.",
      );
    } finally {
      setDeleting(false);
    }
  }

  function copyNote(row: CrmNote) {
    const text = [noteDisplayTitle(row), row.content]
      .filter(Boolean)
      .join("\n\n");
    void navigator.clipboard.writeText(text).then(
      () => toast.success("Note copied."),
      () => toast.error("Could not copy this note."),
    );
  }

  return (
    <div className="space-y-3">
      <PortalDataTable
        rows={items}
        rowKey={(row) => row.id}
        filename={`${entityType.toLowerCase()}-notes`}
        countLabel="Notes"
        searchPlaceholder="Search notes"
        empty={empty ?? `No notes on this ${label} yet.`}
        loading={tableLoading}
        pageSize={limit}
        toolbar={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            Add note
          </Button>
        }
        serverPagination={{
          page,
          pageSize: limit,
          total,
          totalPages,
          onPageChange,
          search: searchInput,
          onSearchChange,
        }}
        columns={[
          {
            id: "title",
            header: "Title",
            sortValue: (row) => noteDisplayTitle(row),
            searchValue: (row) => noteDisplayTitle(row),
            exportValue: (row) => noteDisplayTitle(row),
            cell: (row) => (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{noteDisplayTitle(row)}</span>
                {row.isPinned ? (
                  <StatusPill label="Pinned" tone="primary" />
                ) : null}
              </div>
            ),
          },
          {
            id: "note",
            header: "Note",
            sortValue: (row) => row.content,
            searchValue: (row) => row.content,
            exportValue: (row) => row.content,
            cell: (row) => (
              <span className="line-clamp-2 text-muted-foreground">
                {row.content || "—"}
              </span>
            ),
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
          row.isPinned
            ? {
                label: "Unpin",
                onSelect: () => {
                  void togglePin(row);
                },
              }
            : {
                label: "Pin",
                onSelect: () => {
                  void togglePin(row);
                },
              },
          { label: "Copy", onSelect: () => copyNote(row) },
          {
            label: "Delete",
            variant: "destructive",
            onSelect: () => {
              setDeleteTarget(row);
            },
          },
        ]}
      />

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <DialogContent showCloseButton={!deleting} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete note?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `This will remove “${noteDisplayTitle(deleteTarget)}” from this ${label} file.`
                : `This will remove this note from the ${label} file.`}
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

      <CreateUniversalNoteDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        subjectKind={subjectKind}
        entityId={entityId}
      />
      <CreateUniversalNoteDialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        subjectKind={subjectKind}
        entityId={entityId}
        note={editing}
      />
    </div>
  );
}
