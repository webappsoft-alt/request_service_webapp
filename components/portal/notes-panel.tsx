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
  locked = false,
  showAddInToolbar = true,
}: {
  kind: ReminderSubjectKind;
  id: string;
  empty?: string;
  locked?: boolean;
  /** When false, Add note lives in the parent RecordWorkspace subnav. */
  showAddInToolbar?: boolean;
}) {
  return (
    <UniversalNotesPanel
      subjectKind={kind}
      entityId={id}
      empty={empty}
      locked={locked}
      showAddInToolbar={showAddInToolbar}
    />
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
