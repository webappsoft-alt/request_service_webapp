/** Shared CRM universal notes types (API contract). */

export type NotesEntityType =
  | "Customer"
  | "Vendor"
  | "Job"
  | "Estimate"
  | "Payment"
  | "Contractor"
  | "Employee"
  | "Request"
  | "Invoice"
  | "Task";

export type NotesModuleKey =
  | "customerNotes"
  | "estimateNotes"
  | "requestNotes"
  | "jobNotes"
  | "employeeNotes"
  | "contractorNotes"
  | "vendorNotes"
  | "invoiceNotes";

export type NoteAttachment = {
  url: string;
  filename: string;
  fileType: string;
  sizeBytes: number;
};

export type CrmNote = {
  id: string;
  entityType: string;
  entityId: string;
  title: string;
  content: string;
  tags: string[];
  isPinned: boolean;
  color: string | null;
  attachments: NoteAttachment[];
  authorId: string;
  authorName: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
};

export type NoteCreateInput = {
  entityId: string;
  title?: string;
  content: string;
  tags?: string[];
  isPinned?: boolean;
  color?: string | null;
  attachments?: NoteAttachment[];
};

export type NoteUpdateInput = {
  title?: string;
  content?: string;
  tags?: string[];
  isPinned?: boolean;
  color?: string | null;
  attachments?: NoteAttachment[];
};

export type NotesPaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type EntityNotesState = {
  entityId: string;
  items: CrmNote[];
  pagesCache: Record<string, CrmNote[]>;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  search: string;
  loading: boolean;
  mutating: boolean;
  error: string | null;
};

export const NOTES_DEFAULT_LIMIT = 10;

export function notesPageCacheKey(
  entityId: string,
  search: string,
  page: number,
  limit: number,
) {
  return `${entityId}|${search.trim()}|${page}|${limit}`;
}

export function createInitialEntityNotesState(): EntityNotesState {
  return {
    entityId: "",
    items: [],
    pagesCache: {},
    page: 1,
    limit: NOTES_DEFAULT_LIMIT,
    total: 0,
    totalPages: 1,
    search: "",
    loading: false,
    mutating: false,
    error: null,
  };
}
