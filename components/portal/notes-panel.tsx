"use client";

import {
  CreateUniversalNoteDialog,
  UniversalNotesPanel,
} from "@/components/portal/universal-notes-panel";
import type { ReminderSubjectKind } from "@/lib/data/crm-people";

/**
 * Shared CRM Notes panel (API-backed).
 * Prefer this everywhere Notes are shown on entity detail screens.
 */
export function NotesPanel({
  kind,
  id,
  empty,
}: {
  kind: ReminderSubjectKind;
  id: string;
  empty?: string;
}) {
  return (
    <UniversalNotesPanel subjectKind={kind} entityId={id} empty={empty} />
  );
}

export function CreateNoteDialogForSubject({
  open,
  onOpenChange,
  subjectKind,
  subjectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectKind: ReminderSubjectKind;
  subjectId: string;
}) {
  return (
    <CreateUniversalNoteDialog
      open={open}
      onOpenChange={onOpenChange}
      subjectKind={subjectKind}
      entityId={subjectId}
    />
  );
}
