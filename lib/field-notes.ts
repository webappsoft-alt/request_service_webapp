/**
 * Notes written from the field (technician / contractor portals) on a job or estimate, and the
 * project updates a customer sees. Shared by both portals and the customer estimate page.
 */

export type FieldNote = {
  id: string;
  content: string;
  authorName: string;
  authorRole: "provider" | "technician" | "contractor";
  visibleToCustomer: boolean;
  createdAt: string;
};

/** A shared note as the customer sees it. */
export type ProjectUpdate = {
  id: string;
  content: string;
  authorName: string;
  authorRole: FieldNote["authorRole"];
  createdAt: string;
  /** Written on the estimate or on the job it became. */
  on: "estimate" | "job";
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

const roleOf = (value: unknown): FieldNote["authorRole"] =>
  value === "technician" || value === "contractor" ? value : "provider";

export function mapFieldNote(raw: unknown): FieldNote | null {
  const row = asRecord(raw);
  const id = String(row.id || row._id || "");
  if (!id) return null;
  return {
    id,
    content: String(row.content || ""),
    authorName: String(row.authorName || ""),
    authorRole: roleOf(row.authorRole),
    visibleToCustomer: row.visibleToCustomer === true,
    createdAt: String(row.createdAt || ""),
  };
}

export function mapFieldNotes(raw: unknown): FieldNote[] {
  return (Array.isArray(raw) ? raw : []).map(mapFieldNote).filter((note): note is FieldNote => Boolean(note));
}

export function mapProjectUpdates(raw: unknown): ProjectUpdate[] {
  return (Array.isArray(raw) ? raw : [])
    .map((item) => {
      const row = asRecord(item);
      const id = String(row.id || "");
      if (!id || !row.content) return null;
      return {
        id,
        content: String(row.content),
        authorName: String(row.authorName || ""),
        authorRole: roleOf(row.authorRole),
        createdAt: String(row.createdAt || ""),
        on: row.on === "job" ? "job" : "estimate",
      } satisfies ProjectUpdate;
    })
    .filter((update): update is ProjectUpdate => Boolean(update));
}

export function noteRoleLabel(role: FieldNote["authorRole"]) {
  return role === "technician" ? "Technician" : role === "contractor" ? "Contractor" : "Office";
}
