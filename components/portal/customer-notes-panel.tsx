"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
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
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  clearCustomerNotesError,
  createCustomerNote,
  deleteCustomerNote,
  fetchCustomerNotes,
  optimisticToggleNotePin,
  setCustomerNotesEntity,
  setCustomerNotesPage,
  setCustomerNotesSearch,
  updateCustomerNote,
  type CustomerNote,
} from "@/store/customerNotesSlice";
import { NOTES_DEFAULT_LIMIT } from "@/store/notes/types";

const SEARCH_DEBOUNCE_MS = 400;
/** Customer Notes always request page size 10 (never 100). */
const CUSTOMER_NOTES_LIMIT = NOTES_DEFAULT_LIMIT;

function noteDisplayTitle(note: CustomerNote) {
  return note.title.trim() || note.content.trim() || "Note";
}

export function CreateCustomerNoteDialog({
  open,
  onOpenChange,
  customerId,
  note,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  note?: CustomerNote | null;
}) {
  const dispatch = useAppDispatch();
  const mutating = useAppSelector((state) => state.customerNotes.mutating);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

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
          updateCustomerNote({
            id: note.id,
            title: nextTitle,
            content,
          }),
        );
        if (!updateCustomerNote.fulfilled.match(result)) {
          throw new Error(
            typeof result.payload === "string"
              ? result.payload
              : "Could not update this note.",
          );
        }
        toast.success("Note updated.");
      } else {
        const result = await dispatch(
          createCustomerNote({
            entityId: customerId,
            title: nextTitle,
            content,
          }),
        );
        if (!createCustomerNote.fulfilled.match(result)) {
          throw new Error(
            typeof result.payload === "string"
              ? result.payload
              : "Could not save this note.",
          );
        }
        toast.success("Note added to this customer.");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save this note.",
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
              ? "Update the office note on this customer."
              : "A short office note on this customer. It stays on the file."}
          </DialogDescription>
        </DialogHeader>
        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel htmlFor="customer-note-title">Title</FieldLabel>
            <Input
              id="customer-note-title"
              value={title}
              onChange={(change) => setTitle(change.target.value)}
              placeholder="Access, billing, follow-up…"
            />
          </Field>
          <Field className="w-full">
            <FieldLabel htmlFor="customer-note-body">Note</FieldLabel>
            <Textarea
              id="customer-note-body"
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
 * Customer → Notes tab.
 * Uses only the `customerNotes` Redux slice (no localStorage).
 * - Existing rows → background GET, no loading flash
 * - Empty slice → GET with loading
 * - Always `limit=10`
 * - No polling / interval / auto-repeat fetches
 */
export function CustomerNotesPanel({
  customerId,
  empty = "Add the first note on this customer.",
}: {
  customerId: string;
  empty?: string;
}) {
  const dispatch = useAppDispatch();
  const {
    items,
    page,
    total,
    totalPages,
    search,
    loading,
    mutating,
    error,
  } = useAppSelector((state) => state.customerNotes);

  const [searchInput, setSearchInput] = useState(search);
  const [actionLoading, setActionLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerNote | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomerNote | null>(null);
  const [deleting, setDeleting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    dispatch(setCustomerNotesEntity(customerId));
  }, [customerId, dispatch]);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  // Fetch once on mount / when page or search changes — not on a timer.
  // Do not depend on `limit` (API used to return 100 and retrigger this effect).
  useEffect(() => {
    if (!customerId) return;
    void dispatch(
      fetchCustomerNotes({
        entityId: customerId,
        limit: CUSTOMER_NOTES_LIMIT,
        force: true,
      }),
    );
  }, [customerId, dispatch, page, search]);

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
    dispatch(clearCustomerNotesError());
  }, [dispatch, error, loading, mutating]);

  // Existing data → keep rows visible (slice pending skips loading when items exist).
  const tableLoading = actionLoading || (loading && items.length === 0);

  function onSearchChange(value: string) {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Debounce only — not polling. Clears on unmount.
    debounceRef.current = setTimeout(() => {
      setActionLoading(true);
      dispatch(setCustomerNotesSearch(value));
    }, SEARCH_DEBOUNCE_MS);
  }

  function onPageChange(nextPage: number) {
    if (nextPage === page) return;
    setActionLoading(true);
    dispatch(setCustomerNotesPage(nextPage));
  }

  async function togglePin(row: CustomerNote) {
    const nextPinned = !row.isPinned;
    dispatch(
      optimisticToggleNotePin({
        id: row.id,
        isPinned: nextPinned,
      }),
    );
    const result = await dispatch(
      updateCustomerNote({ id: row.id, isPinned: nextPinned }),
    );
    if (updateCustomerNote.fulfilled.match(result)) {
      toast.success(nextPinned ? "Note pinned to the top." : "Note unpinned.");
      return;
    }
    dispatch(
      optimisticToggleNotePin({
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
      const result = await dispatch(deleteCustomerNote(row.id));
      if (deleteCustomerNote.fulfilled.match(result)) {
        setDeleteTarget(null);
        toast.success("Note removed.");
        if (items.length <= 1 && page > 1) {
          dispatch(setCustomerNotesPage(page - 1));
          void dispatch(
            fetchCustomerNotes({
              entityId: customerId,
              page: page - 1,
              limit: CUSTOMER_NOTES_LIMIT,
              force: true,
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

  function copyNote(row: CustomerNote) {
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
        filename="customer-notes"
        countLabel="Notes"
        searchPlaceholder="Search notes"
        empty={empty}
        loading={tableLoading}
        pageSize={CUSTOMER_NOTES_LIMIT}
        toolbar={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            Add note
          </Button>
        }
        serverPagination={{
          page,
          pageSize: CUSTOMER_NOTES_LIMIT,
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
                ? `This will remove “${noteDisplayTitle(deleteTarget)}” from this customer file.`
                : "This will remove this note from the customer file."}
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

      <CreateCustomerNoteDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        customerId={customerId}
      />
      <CreateCustomerNoteDialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        customerId={customerId}
        note={editing}
      />
    </div>
  );
}
