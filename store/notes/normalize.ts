import {
  NOTES_DEFAULT_LIMIT,
  type CrmNote,
  type NoteAttachment,
  type NotesEntityType,
  type NotesPaginationMeta,
} from "@/store/notes/types";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function idOf(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  const record = asRecord(value);
  if (!record) return "";
  if (typeof record.$oid === "string" && record.$oid.trim()) return record.$oid.trim();
  for (const key of ["_id", "id"] as const) {
    const raw = record[key];
    if (typeof raw === "string" && raw.trim()) return raw.trim();
    if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
    const nested = asRecord(raw);
    if (nested && typeof nested.$oid === "string" && nested.$oid.trim()) {
      return nested.$oid.trim();
    }
  }
  return "";
}

function stringValue(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => stringValue(item).trim()).filter(Boolean);
}

function normalizeAttachment(raw: unknown): NoteAttachment | null {
  const record = asRecord(raw);
  if (!record) return null;
  const url = stringValue(record.url);
  if (!url) return null;
  return {
    url,
    filename: stringValue(record.filename),
    fileType: stringValue(record.fileType),
    sizeBytes: Number(record.sizeBytes) || 0,
  };
}

export function normalizeCrmNote(
  raw: unknown,
  fallbackEntityType: NotesEntityType,
): CrmNote | null {
  const record = asRecord(raw);
  if (!record) return null;
  const id = idOf(record);
  if (!id) return null;

  return {
    id,
    entityType: stringValue(record.entityType, fallbackEntityType),
    entityId: idOf(record.entityId) || stringValue(record.entityId),
    title: stringValue(record.title),
    content: stringValue(record.content),
    tags: toStringArray(record.tags),
    isPinned: Boolean(record.isPinned),
    color:
      typeof record.color === "string" && record.color.trim()
        ? record.color.trim()
        : null,
    attachments: Array.isArray(record.attachments)
      ? record.attachments
          .map(normalizeAttachment)
          .filter((item): item is NoteAttachment => Boolean(item))
      : [],
    authorId: idOf(record.authorId) || stringValue(record.authorId),
    authorName: stringValue(record.authorName) || "Office",
    isDeleted: Boolean(record.isDeleted),
    createdAt: stringValue(record.createdAt) || stringValue(record.updatedAt),
    updatedAt: stringValue(record.updatedAt) || stringValue(record.createdAt),
  };
}

export function extractNotesList(
  response: unknown,
  fallbackEntityType: NotesEntityType,
): { items: CrmNote[]; pagination: NotesPaginationMeta } {
  const root = asRecord(response) ?? {};
  const list =
    (Array.isArray(root.data) && root.data) ||
    (Array.isArray(response) && response) ||
    [];
  const items = list
    .map((row) => normalizeCrmNote(row, fallbackEntityType))
    .filter((item): item is CrmNote => Boolean(item));

  const paginationRaw = asRecord(root.pagination) || {};
  const page = Math.max(1, Number(paginationRaw.page) || 1);
  const limit = Math.max(1, Number(paginationRaw.limit) || NOTES_DEFAULT_LIMIT);
  const total = Math.max(
    0,
    Number(paginationRaw.total ?? paginationRaw.totalDocs ?? items.length) || 0,
  );
  const totalPages = Math.max(
    1,
    Number(paginationRaw.pages ?? paginationRaw.totalPages) ||
      Math.max(1, Math.ceil(total / limit) || 1),
  );

  return { items, pagination: { page, limit, total, totalPages } };
}

export function extractNoteEntity(
  response: unknown,
  fallbackEntityType: NotesEntityType,
): CrmNote | null {
  const root = asRecord(response);
  if (!root) return normalizeCrmNote(response, fallbackEntityType);
  const data = root.data;
  if (Array.isArray(data)) {
    return normalizeCrmNote(data[0], fallbackEntityType);
  }
  return (
    normalizeCrmNote(data, fallbackEntityType) ||
    normalizeCrmNote(root.note, fallbackEntityType) ||
    normalizeCrmNote(root, fallbackEntityType)
  );
}

export function sortCrmNotes(items: CrmNote[]) {
  return [...items].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export function replaceNoteById(items: CrmNote[], updated: CrmNote) {
  const index = items.findIndex((item) => item.id === updated.id);
  if (index < 0) return items;
  const next = [...items];
  next[index] = updated;
  return sortCrmNotes(next);
}
