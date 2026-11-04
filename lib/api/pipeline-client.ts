import { getData, invalidateGetCache, patchData } from "@/components/api/apiFuntions";
import { providerCrmApi } from "@/components/api/ApiRoutesFile";

export type PipelineCardKind = "request" | "estimate" | "job" | "invoice";

export type PipelineCard = {
  /** `${kind}:${id}` — unique across the board. */
  key: string;
  kind: PipelineCardKind;
  /** Record id — for "estimate" cards, the estimate workspace (a row of the Estimates page). */
  id: string;
  groupId: string;
  /** As its tab shows it: REQ-…, EST-… (the newest estimate), JOB-…, INV-…. */
  number: string;
  /** Service (lead), estimate / job title, change-order title (invoice); may be empty. */
  title: string;
  /** Service category (estimates). */
  category: string;
  customerName: string;
  /** Property / job-site line, e.g. "Address pending, Jaranwala AL, 38000". */
  address: string;
  status: string;
  /** Which status labels apply — "opportunity" for an estimate workspace without an estimate yet. */
  statusOf: PipelineCardKind | "opportunity";
  /**
   * Estimates only: why it can't move on to Scheduled jobs yet (no estimate, no line items,
   * not sent, declined), or null when it can. The server enforces the same rule.
   */
  blocker?: PipelineBlocker | null;
  value: number;
  date: string | null;
  updatedAt: string;
  href: string;
};

export type PipelineBlocker = {
  code: "no_estimate" | "no_items" | "not_sent" | "declined";
  message: string;
};

export type PipelineGroup = {
  id: string;
  title: string;
  hint: string;
  kind: PipelineCardKind;
  /** Card kinds that may be dropped here. */
  accepts: PipelineCardKind[];
  /** Kinds whose drop opens the app's own page for that step (`:id` → the card's id). */
  flows: Partial<Record<PipelineCardKind, string>>;
  /** Dropping here books the project: ask for a date and time first. */
  schedule: boolean;
  count: number;
  value: number;
  cards: PipelineCard[];
};

export type PipelineAccent = "rose" | "amber" | "emerald" | "violet" | "sky";

export type PipelineColumn = {
  id: string;
  title: string;
  accent: PipelineAccent;
  /** What the column holds, in plain words ("Jobs on the schedule, not started yet"). */
  description: string;
  /** The tabs where these records live (Jobs, Schedule, …). */
  links: { label: string; href: string }[];
  count: number;
  value: number;
  groups: PipelineGroup[];
};

export type PipelineBoard = {
  generatedAt: string;
  columns: PipelineColumn[];
};

export type PipelineSchedule = {
  /** "YYYY-MM-DD" */
  date: string;
  startMinutes: number;
  endMinutes: number;
  employeeId?: string | null;
};

/** Result of a move — also the PIPELINE_UPDATED socket payload (minus `warning`). */
export type PipelineMoveResult = {
  removed: string[];
  /** Where the record sits now; null when it left the board. */
  card: PipelineCard | null;
  by: string;
  at: string;
  warning?: string | null;
};

function unwrapData<T>(response: unknown): T {
  const root = (response || {}) as Record<string, unknown>;
  return (root.data ?? root) as T;
}

/** Cards per column on first load and per "See more" (matches the server). */
export const PIPELINE_PAGE_SIZE = 10;

/** { leads_new: 10, leads_contacted: 0 } → "leads_new:10,leads_contacted:0" */
function depthParam(depths: Record<string, number>) {
  return Object.entries(depths)
    .map(([groupId, n]) => `${groupId}:${Math.min(Math.max(0, n), 200)}`)
    .join(",");
}

/**
 * The board — 10 cards per column at first. `depths` ({ groupId: cardsShown }) keeps columns
 * opened with "See more" at their size, so a refresh replaces cards in place, never collapsing.
 */
export async function getPipelineBoard(depths: Record<string, number> = {}, search = ""): Promise<PipelineBoard> {
  const depth = depthParam(depths);
  const params = { ...(depth ? { depth } : {}), ...(search ? { search } : {}) };
  const response = await getData(providerCrmApi.pipeline, Object.keys(params).length ? params : undefined, {
    force: true,
    silent: true,
  });
  return unwrapData<PipelineBoard>(response);
}

export type PipelineColumnPage = {
  id: string;
  /** Per group: its current count / value and the cards to append. */
  groups: Pick<PipelineGroup, "id" | "count" | "value" | "cards">[];
};

/** "See more": a column's next 10 cards across its groups (`loaded` = cards each group shows). */
export async function getPipelineColumnPage(columnId: string, loaded: Record<string, number>, search = "") {
  const response = await getData(
    providerCrmApi.pipelineColumn(columnId),
    { loaded: depthParam(loaded), limit: PIPELINE_PAGE_SIZE, ...(search ? { search } : {}) },
    { force: true, silent: true },
  );
  return unwrapData<PipelineColumnPage>(response);
}

export async function movePipelineCard(
  card: Pick<PipelineCard, "kind" | "id" | "groupId">,
  toGroupId: string,
  schedule?: PipelineSchedule | null,
): Promise<PipelineMoveResult> {
  const response = await patchData(
    providerCrmApi.pipelineCard(card.kind, card.id),
    { fromGroupId: card.groupId, toGroupId, schedule: schedule ?? null },
    { silent: true },
  );
  // A move converts / books / invoices records, so the list pages refetch next time.
  for (const root of ["provider/requests", "provider/estimates", "provider/estimate-v2", "provider/jobs", "provider/invoices", "provider/schedule", "provider/dashboard"]) {
    invalidateGetCache(root);
  }
  return unwrapData<PipelineMoveResult>(response);
}
