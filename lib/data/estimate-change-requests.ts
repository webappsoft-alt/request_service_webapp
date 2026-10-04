import type { EstimateChangeRequest } from "@/lib/types";

export type { EstimateChangeRequest };

const CHANGE_REQUEST_LINE =
  /^\[Customer change request\s+([^\]]+)\]\s*(.*)$/i;

function toIso(value: string) {
  const stamp = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(stamp)) {
    const date = new Date(`${stamp}T12:00:00.000Z`);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  const date = new Date(stamp);
  if (!Number.isNaN(date.getTime())) return date.toISOString();
  return new Date().toISOString();
}

export function stripChangeRequestLinesFromNotes(notes?: string | null) {
  const raw = String(notes || "").trim();
  if (!raw) return "";
  const kept: string[] = [];
  for (const block of raw.split(/\n{2,}/)) {
    const rebuilt = block
      .split("\n")
      .filter((line) => !CHANGE_REQUEST_LINE.test(line.trim()));
    const next = rebuilt.join("\n").trim();
    if (next) kept.push(next);
  }
  return kept.join("\n\n").trim();
}

export function splitEstimateNotesAndChangeRequests(
  notes?: string | null,
  existing: EstimateChangeRequest[] = [],
) {
  const raw = String(notes || "").trim();
  const extracted: EstimateChangeRequest[] = [];
  const kept: string[] = [];
  if (raw) {
    for (const block of raw.split(/\n{2,}/)) {
      const rebuilt: string[] = [];
      for (const line of block.split("\n")) {
        const match = line.trim().match(CHANGE_REQUEST_LINE);
        if (match) {
          const reason = String(match[2] || "").trim();
          if (reason) {
            extracted.push({ reason, at: toIso(match[1]) });
          }
          continue;
        }
        rebuilt.push(line);
      }
      const next = rebuilt.join("\n").trim();
      if (next) kept.push(next);
    }
  }

  const merged = [...existing];
  for (const extra of extracted) {
    const duplicate = merged.some(
      (row) => row.reason === extra.reason && row.at.slice(0, 10) === extra.at.slice(0, 10),
    );
    if (!duplicate) merged.push(extra);
  }

  return {
    notes: kept.join("\n\n").trim(),
    changeRequests: merged.sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    ),
  };
}
