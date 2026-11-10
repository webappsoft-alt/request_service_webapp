"use client";

import { Fragment, memo, useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DragStart,
  type DropResult,
} from "@hello-pangea/dnd";
import {
  ArrowRight,
  Bot,
  CalendarDays,
  ExternalLink,
  Globe,
  Loader2,
  Lock,
  MoreHorizontal,
  PencilLine,
  Search,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { BookProjectDialog } from "@/components/portal/pipeline/book-project-dialog";
import { CreateNewMenu } from "@/components/portal/pipeline/create-new-menu";
import { usePipelineBoard } from "@/components/portal/pipeline/use-pipeline-board";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  PipelineAccent,
  PipelineBlocker,
  PipelineCard,
  PipelineCardKind,
  PipelineGroup,
  PipelineSchedule,
} from "@/lib/api/pipeline-client";
import {
  estimateStatusLabel,
  estimateStatusToneDistinct,
  opportunityStatusLabel,
  opportunityStatusTone,
} from "@/lib/data/estimate-v2-status";
import {
  invoiceStatusLabel,
  invoiceStatusTone,
  jobStatusLabel,
  jobStatusTone,
  requestStatusLabel,
} from "@/lib/data/portal";
import type { InvoiceStatus, JobStatus, RequestStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { columnShown } from "@/store/pipelineSlice";

/** Per column: card-area tint, drop highlight, dot, header underline, and group border. */
const ACCENTS: Record<
  PipelineAccent,
  { tint: string; over: string; dot: string; bar: string; edge: string }
> = {
  rose: {
    tint: "bg-rose-500/5",
    over: "ring-rose-400/70 bg-rose-500/10",
    dot: "bg-rose-500",
    bar: "border-rose-500",
    edge: "border-rose-200 dark:border-rose-500/30",
  },
  amber: {
    tint: "bg-amber-500/5",
    over: "ring-amber-400/70 bg-amber-500/10",
    dot: "bg-amber-500",
    bar: "border-amber-500",
    edge: "border-amber-200 dark:border-amber-500/30",
  },
  emerald: {
    tint: "bg-emerald-500/5",
    over: "ring-emerald-400/70 bg-emerald-500/10",
    dot: "bg-emerald-500",
    bar: "border-emerald-500",
    edge: "border-emerald-200 dark:border-emerald-500/30",
  },
  violet: {
    tint: "bg-violet-500/5",
    over: "ring-violet-400/70 bg-violet-500/10",
    dot: "bg-violet-500",
    bar: "border-violet-500",
    edge: "border-violet-200 dark:border-violet-500/30",
  },
  sky: {
    tint: "bg-sky-500/5",
    over: "ring-sky-400/70 bg-sky-500/10",
    dot: "bg-sky-500",
    bar: "border-sky-500",
    edge: "border-sky-200 dark:border-sky-500/30",
  },
};

/** How a lead came in: incoming (website, messages, AI calls, sent by RS) or added by the pro. */
type LeadOrigin = {
  label: string;
  incoming: boolean;
  icon: typeof Globe;
  className: string;
};

const WEB_ORIGIN = {
  incoming: true,
  icon: Globe,
  className: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
};
const LEAD_ORIGINS: Record<string, LeadOrigin> = {
  quote_request: { label: "Web", ...WEB_ORIGIN },
  profile_view: { label: "Web", ...WEB_ORIGIN },
  fixed_service_view: { label: "Web", ...WEB_ORIGIN },
  direct_message: { label: "Message", ...WEB_ORIGIN },
  external: { label: "From RS", ...WEB_ORIGIN },
  ai_receptionist: {
    label: "AI call",
    incoming: true,
    icon: Bot,
    className: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  ai_phone_call: {
    label: "AI call",
    incoming: true,
    icon: Bot,
    className: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  phone: {
    label: "Manual",
    incoming: false,
    icon: PencilLine,
    className:
      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
  walk_in: {
    label: "Walk-in",
    incoming: false,
    icon: PencilLine,
    className:
      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
};

function leadOrigin(card: PipelineCard): LeadOrigin | null {
  if (card.kind !== "request" || !card.source) return null;
  return LEAD_ORIGINS[card.source] ?? null;
}

/**
 * Sub-stages drawn inside a group: leads split by how they came in, and "Sent" estimates split
 * into waiting vs accepted. Display only; the group (and its count) stays the server's.
 */
type Section = {
  id: string;
  title: string;
  dot: string;
  cards: PipelineCard[];
};

function groupSections(group: PipelineGroup): Section[] | null {
  if (group.kind === "request") {
    // Older servers don't send the source: no split then.
    if (!group.cards.some((card) => card.source)) return null;
    const incoming = group.cards.filter(
      (card) => leadOrigin(card)?.incoming ?? true,
    );
    const manual = group.cards.filter(
      (card) => !(leadOrigin(card)?.incoming ?? true),
    );
    return [
      {
        id: "incoming",
        title: "Incoming · web & calls",
        dot: "bg-sky-500",
        cards: incoming,
      },
      {
        id: "manual",
        title: "Added by you",
        dot: "bg-slate-400",
        cards: manual,
      },
    ];
  }
  if (group.id === "estimates_sent") {
    const accepted = group.cards.filter((card) => card.status === "accepted");
    const waiting = group.cards.filter((card) => card.status !== "accepted");
    return [
      {
        id: "waiting",
        title: "Waiting on customer",
        dot: "bg-amber-500",
        cards: waiting,
      },
      {
        id: "accepted",
        title: "Accepted · ready to book",
        dot: "bg-emerald-500",
        cards: accepted,
      },
    ];
  }
  return null;
}

const KIND_NOUN: Record<PipelineCardKind, string> = {
  request: "lead",
  estimate: "estimate",
  job: "job",
  invoice: "invoice",
};

/** What happened, by where the card landed (direct moves only — flows open their page). */
function successMessage(card: PipelineCard, toGroupId: string) {
  switch (toGroupId) {
    case "leads_new":
      return "Lead marked new";
    case "leads_contacted":
      return "Lead marked contacted";
    case "estimates_never_sent":
      return card.kind === "request"
        ? "Draft estimate created · now on the Estimates page"
        : "Estimate reopened";
    case "estimates_declined":
      return "Estimate marked declined";
    case "booked_starting_soon":
      return card.kind === "estimate"
        ? "Job created and booked · customer and crew notified"
        : "Project booked · customer and crew notified";
    case "booked_updates":
      return card.kind === "estimate"
        ? "Job created · customer notified"
        : "Job put on hold";
    case "progress_completed":
      return "Job completed · customer notified";
    default:
      return "Job in progress · customer notified";
  }
}

/** Where a flow drop goes, and what the toast says on the way. */
const FLOW_NOTES: Partial<Record<PipelineCardKind, string>> = {
  estimate: "Opening the estimate — send it from there.",
  job: "Opening the job — create the invoice from there.",
  invoice: "Opening the invoice — send it from there.",
};

/** The short line an estimate card shows while it can't move on to Scheduled jobs. */
const BLOCKER_HINTS: Record<PipelineBlocker["code"], string> = {
  no_estimate: "Build the estimate to book it",
  no_items: "Add line items to book it",
  not_sent: "Send the estimate to book it",
  declined: "Declined · reopen to book it",
};

/** An estimate dropped on a job group is the move to Scheduled jobs (accept → job). */
function bookingBlocker(
  card: { kind: PipelineCardKind; blocker?: PipelineBlocker | null },
  group: PipelineGroup,
) {
  return card.kind === "estimate" && group.kind === "job"
    ? (card.blocker ?? null)
    : null;
}

const compactMoney = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

function money(value: number) {
  return compactMoney.format(value).replace("K", "k");
}

function cardDate(card: PipelineCard) {
  if (!card.date || card.kind === "estimate") return null;
  // Job dates are calendar days (midnight UTC); invoice due dates are real times.
  const label = new Date(card.date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(card.kind === "job" ? { timeZone: "UTC" } : {}),
  });
  if (card.kind === "invoice") return `Due ${label}`;
  // Leads: when the request came in.
  return card.kind === "request" ? `Rec'd ${label}` : label;
}

type PendingBooking = { card: PipelineCard; toGroupId: string; index: number };

export function PipelineBoard({ className }: { className?: string }) {
  const router = useRouter();
  const {
    board,
    error,
    reload,
    moveCard,
    loadMore,
    loadingMore,
    search,
    setSearch,
    searching,
  } = usePipelineBoard();
  // Starts from the search the board was left with (kept in the store).
  const [query, setQuery] = useState(search);
  const [dragging, setDragging] = useState<{
    kind: PipelineCardKind;
    groupId: string;
    blocker: PipelineBlocker | null;
  } | null>(null);
  const [booking, setBooking] = useState<PendingBooking | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const cardsByKey = useMemo(() => {
    const map = new Map<string, PipelineCard>();
    for (const column of board?.columns ?? []) {
      for (const group of column.groups)
        for (const card of group.cards) map.set(card.key, card);
    }
    return map;
  }, [board]);

  const groupsById = useMemo(() => {
    const map = new Map<string, PipelineGroup>();
    for (const column of board?.columns ?? [])
      for (const group of column.groups) map.set(group.id, group);
    return map;
  }, [board]);

  const onSearchChange = (value: string) => {
    setQuery(value);
    setSearch(value);
  };

  const runMove = useCallback(
    async (
      card: PipelineCard,
      toGroupId: string,
      index: number,
      schedule?: PipelineSchedule,
    ) => {
      const outcome = await moveCard(card, toGroupId, index, schedule);
      if (!outcome.ok) {
        toast.error(outcome.error);
        return false;
      }
      if (outcome.warning) toast.warning(outcome.warning);
      else toast.success(successMessage(card, toGroupId));
      return true;
    },
    [moveCard],
  );

  const onDragStart = useCallback(
    (start: DragStart) => {
      const card = cardsByKey.get(start.draggableId);
      if (card)
        setDragging({
          kind: card.kind,
          groupId: card.groupId,
          blocker: card.blocker ?? null,
        });
    },
    [cardsByKey],
  );

  /** A card arriving in a group, by drag or from its "⋯" menu: the same rules either way. */
  const dropCard = useCallback(
    (card: PipelineCard, target: PipelineGroup, index: number) => {
      if (!target.accepts.includes(card.kind)) {
        toast.error(`That card can't move to ${target.title}.`);
        return;
      }
      // An unfinished estimate (no line items, not sent…) stays put; offer to finish it.
      const blocker = bookingBlocker(card, target);
      if (blocker) {
        toast.warning(blocker.message, {
          description: `${card.number || "This estimate"} stays in Estimates until then.`,
          action: {
            label: "Open estimate",
            onClick: () => router.push(card.href),
          },
        });
        return;
      }
      // Steps the app already has a flow for (estimate wizard, send, invoice) open that page.
      const flow = target.flows?.[card.kind];
      if (flow) {
        toast.info(FLOW_NOTES[card.kind] || "Opening…");
        router.push(flow.replace(":id", encodeURIComponent(card.id)));
        return;
      }
      if (target.schedule) {
        setBooking({ card, toGroupId: target.id, index });
        return;
      }
      void runMove(card, target.id, index);
    },
    [runMove, router],
  );

  const onDragEnd = useCallback(
    (result: DropResult) => {
      setDragging(null);
      const { destination, source, draggableId } = result;
      // Reordering inside a group isn't stored (groups sort by latest activity).
      if (!destination || destination.droppableId === source.droppableId)
        return;
      const card = cardsByKey.get(draggableId);
      const target = groupsById.get(destination.droppableId);
      if (card && target) dropCard(card, target, destination.index);
    },
    [cardsByKey, groupsById, dropCard],
  );

  /** "⋯ → Move to": lands at the top of the group. */
  const moveFromMenu = useCallback(
    (card: PipelineCard, groupId: string) => {
      const target = groupsById.get(groupId);
      if (target) dropCard(card, target, 0);
    },
    [groupsById, dropCard],
  );

  /** Every group with its column's name, for the "Move to" list. */
  const moveTargets = useMemo(
    () =>
      (board?.columns ?? []).flatMap((column) =>
        column.groups.map((group) => ({
          group,
          column: column.title,
          dot: "bg-muted-foreground/40",
        })),
      ),
    [board],
  );

  const confirmBooking = useCallback(
    async (schedule: PipelineSchedule) => {
      if (!booking) return false;
      const ok = await runMove(
        booking.card,
        booking.toGroupId,
        booking.index,
        schedule,
      );
      if (ok) setBooking(null);
      return ok;
    },
    [booking, runMove],
  );

  const seeMore = useCallback(
    async (groupId: string) => {
      const error = await loadMore(groupId);
      if (error) toast.error(error);
    },
    [loadMore],
  );

  const jumpTo = (columnId: string) => {
    const el = scroller.current?.querySelector<HTMLElement>(
      `[data-column="${columnId}"]`,
    );
    if (el && scroller.current)
      scroller.current.scrollTo({
        left: el.offsetLeft - 16,
        behavior: "smooth",
      });
  };

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-input/80 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        className,
      )}
      aria-label="Pipeline"
    >
      <div className="flex flex-col gap-2 border-b border-input/70 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        {/* Client: too busy — lead colour key removed (2026-11-10).
                <ul
          className="hidden items-center gap-3 text-[11px] text-muted-foreground lg:flex"
          aria-label="Lead key"
        >
          <li className="flex items-center gap-1.5">
            <span className="h-3 w-0.75 rounded-full bg-sky-500" aria-hidden />
            Incoming lead (web, message, AI call)
          </li>
          <li className="flex items-center gap-1.5">
            <span
              className="h-3 w-0.75 rounded-full bg-slate-400"
              aria-hidden
            />
            Added by you
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" aria-hidden />
            New in the last 24 hours
          </li>
        </ul>
        */}
        <div className="flex items-center gap-2 sm:ml-auto">
          <label className="relative block w-full sm:w-72">
            {searching ? (
              <Loader2
                className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground"
                aria-hidden
              />
            ) : (
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
            )}
            <input
              type="search"
              value={query}
              onChange={(event) => onSearchChange(event.target.value)}
              maxLength={80}
              placeholder="Search customer, EST-883, JOB-…, status…"
              aria-label="Search your pipeline by customer, number, address or status"
              className="h-8 w-full rounded-md border border-input bg-background pr-2 pl-8 text-[12px] outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </label>
          {/* Client: refresh button removed — the board updates itself live (socket + on return to the tab).
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            onClick={() => void reload()}
            aria-label="Refresh pipeline"
          >
            <RefreshCw
              className={cn("size-3.5", loading && "animate-spin")}
              aria-hidden
            />
          </Button>
          */}
          <CreateNewMenu className="shrink-0" />
        </div>
      </div>

      {/* Phones: jump between columns */}
      {board ? (
        <div className="flex gap-1.5 overflow-x-auto border-b border-input/60 px-4 py-2 lg:hidden">
          {board.columns.map((column) => (
            <button
              key={column.id}
              type="button"
              onClick={() => jumpTo(column.id)}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-input/80 px-2.5 py-1 text-[11px] font-medium hover:bg-muted/50"
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  ACCENTS[column.accent].dot,
                )}
                aria-hidden
              />
              {column.title}
              <span className="text-muted-foreground tabular-nums">
                {column.count}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {error && !board ? (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button size="sm" variant="outline" onClick={() => void reload()}>
            Try again
          </Button>
        </div>
      ) : !board ? (
        <div className="flex gap-3 overflow-hidden px-4 py-3 2xl:grid 2xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="w-70 shrink-0 space-y-2 2xl:w-auto">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-44 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
            </div>
          ))}
        </div>
      ) : (
        <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div
            ref={scroller}
            className={cn(
              // Wide screens: the five columns share the width. Narrower: fixed columns scroll sideways.
              "flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-4 pt-3 pb-4 lg:snap-none",
              "2xl:grid 2xl:grid-cols-5 2xl:overflow-x-visible",
              // Snapping fights the auto-scroll while a card is carried to another column.
              dragging && "snap-none",
            )}
          >
            {board.columns.map((column) => {
              const remaining = Math.max(0, column.count - columnShown(column));
              const fetching = loadingMore.has(column.id);
              return (
                <div
                  key={column.id}
                  data-column={column.id}
                  className="flex w-[82vw] max-w-75 shrink-0 snap-start flex-col gap-2.5 sm:w-68 2xl:w-auto 2xl:max-w-none 2xl:min-w-0"
                >
                  <header className={"border-b border-input pb-1.5"}>
                    <h3 className="text-[15px] font-semibold tracking-tight">
                      {column.title}
                    </h3>
                    {/* What the stage holds, and the tabs where those records live */}
                    <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                      {column.description}
                      {column.links?.map((link) => (
                        <span key={link.href}>
                          {" · "}
                          <Link
                            href={link.href}
                            className="font-medium text-primary hover:underline"
                          >
                            {link.label}
                          </Link>
                        </span>
                      ))}
                    </p>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
                      <span>
                        Total:{" "}
                        <span className="font-semibold text-foreground">
                          {column.count}
                        </span>
                      </span>
                      {column.value > 0 ? (
                        <span>
                          Value:{" "}
                          <span className="font-semibold text-foreground">
                            {money(column.value)}
                          </span>
                        </span>
                      ) : null}
                    </div>
                  </header>

                  {column.groups.map((group) => {
                    const blocked =
                      dragging !== null &&
                      dragging.groupId !== group.id &&
                      !group.accepts.includes(dragging.kind);
                    // Accepts estimates, but not this one yet: still droppable, so the drop explains why.
                    const locked =
                      dragging !== null && !blocked
                        ? bookingBlocker(dragging, group)
                        : null;
                    const sections = groupSections(group);
                    // One continuous index across sections, as the drag list needs.
                    const ordered = sections
                      ? sections.flatMap((section) => section.cards)
                      : group.cards;
                    const indexOf = new Map(
                      ordered.map((card, i) => [card.key, i]),
                    );
                    const renderCard = (card: PipelineCard) => (
                      <PipelineCardItem
                        key={card.key}
                        card={card}
                        index={indexOf.get(card.key) ?? 0}
                        targets={moveTargets}
                        onMove={moveFromMenu}
                      />
                    );
                    return (
                      <div
                        key={group.id}
                        className={cn(
                          "rounded-lg border p-1.5 transition-opacity",
                          "border-input/70 bg-muted/30",
                          blocked && "opacity-40",
                          locked && "border-dashed border-amber-400/80",
                        )}
                      >
                        <div className="flex items-baseline justify-between gap-2 px-1.5 pt-0.5 pb-1.5">
                          <p
                            className="truncate text-[12px] font-semibold"
                            title={group.hint || undefined}
                          >
                            {group.title}
                            {group.schedule ? (
                              <CalendarDays
                                className="ml-1 inline size-3 text-muted-foreground"
                                aria-label="Asks for a date"
                              />
                            ) : null}
                          </p>
                          <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                            {group.count}
                            {group.value > 0 ? ` · ${money(group.value)}` : ""}
                          </span>
                        </div>
                        {locked ? (
                          <p className="mx-1.5 mb-1.5 flex items-start gap-1.5 rounded-md bg-amber-500/10 px-2 py-1.5 text-[11px] leading-snug text-amber-800 dark:text-amber-200">
                            <Lock
                              className="mt-px size-3 shrink-0"
                              aria-hidden
                            />
                            {locked.message}
                          </p>
                        ) : null}
                        <Droppable
                          droppableId={group.id}
                          isDropDisabled={blocked}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className={cn(
                                "min-h-11 space-y-1.5 rounded-md transition-colors",
                                snapshot.isDraggingOver &&
                                  (locked
                                    ? "bg-amber-500/10 ring-2 ring-amber-400/70"
                                    : "bg-primary/5 ring-2 ring-primary/30"),
                              )}
                            >
                              {sections
                                ? sections.map((section) =>
                                    section.cards.length ? (
                                      <Fragment key={section.id}>
                                        <p className="flex items-center gap-1.5 px-1 pt-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                                          {section.title}
                                          <span className="font-medium tabular-nums">
                                            · {section.cards.length}
                                          </span>
                                        </p>
                                        {section.cards.map(renderCard)}
                                      </Fragment>
                                    ) : null,
                                  )
                                : group.cards.map(renderCard)}
                              {provided.placeholder}
                              {!group.cards.length &&
                              !snapshot.isDraggingOver ? (
                                <p className="rounded-md border border-dashed border-input/80 px-2 py-2.5 text-center text-[11px] text-muted-foreground">
                                  {group.count > 0
                                    ? "Older cards · See more below"
                                    : group.hint || "Nothing here"}
                                </p>
                              ) : null}
                            </div>
                          )}
                        </Droppable>
                      </div>
                    );
                  })}

                  {/* 10 cards per column; the next 10 (across its groups) load in place */}
                  {remaining > 0 ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void seeMore(column.id)}
                      disabled={fetching}
                      className="h-8 w-full text-[12px]"
                    >
                      {fetching ? (
                        <Loader2
                          className="size-3.5 animate-spin"
                          aria-hidden
                        />
                      ) : null}
                      See more
                      <span className="text-muted-foreground tabular-nums">
                        · {remaining} left
                      </span>
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </DragDropContext>
      )}

      <BookProjectDialog
        card={booking?.card ?? null}
        onCancel={() => setBooking(null)}
        onConfirm={confirmBooking}
      />
    </section>
  );
}

/** The status pill each record's own tab shows (same labels and colours). */
function cardStatus(card: PipelineCard): { label: string; className: string } {
  switch (card.statusOf) {
    case "request":
      return {
        label: requestStatusLabel(card.status as RequestStatus),
        className:
          card.status === "new"
            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
      };
    case "estimate":
      return {
        label: estimateStatusLabel(card.status),
        className: estimateStatusToneDistinct(card.status),
      };
    case "opportunity":
      return {
        label: opportunityStatusLabel(card.status),
        className: cn("ring-1 ring-inset", opportunityStatusTone(card.status)),
      };
    case "job":
      return {
        label: jobStatusLabel(card.status as JobStatus),
        className: jobStatusTone(card.status as JobStatus),
      };
    default:
      return {
        label: invoiceStatusLabel(card.status as InvoiceStatus),
        className: invoiceStatusTone(card.status as InvoiceStatus),
      };
  }
}

type MoveTarget = { group: PipelineGroup; column: string; dot: string };

/** The card's "⋯": open the record, or move it to any group that takes it (same rules as dragging). */
function CardMenu({
  card,
  targets,
  onMove,
}: {
  card: PipelineCard;
  targets: MoveTarget[];
  onMove: (card: PipelineCard, groupId: string) => void;
}) {
  const noun = KIND_NOUN[card.kind];
  const moves = targets.filter(
    ({ group }) =>
      group.id !== card.groupId && group.accepts.includes(card.kind),
  );
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Actions for ${card.number || noun}`}
          className="absolute top-1.5 right-1 flex size-6 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 data-[state=open]:bg-muted data-[state=open]:text-foreground"
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="truncate text-[11px] text-muted-foreground">
          {card.number || noun} · {card.customerName}
        </DropdownMenuLabel>
        <DropdownMenuItem asChild className="text-[12px] font-medium">
          <Link href={card.href}>
            <ExternalLink aria-hidden />
            Open {noun}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[11px] text-muted-foreground">
          Move to
        </DropdownMenuLabel>
        {moves.length ? (
          moves.map(({ group, column, dot }) => {
            const locked = bookingBlocker(card, group);
            const opensPage = Boolean(group.flows?.[card.kind]);
            return (
              <DropdownMenuItem
                key={group.id}
                onSelect={() => onMove(card, group.id)}
                title={locked?.message || group.hint || undefined}
                className="text-[12px]"
              >
                <span
                  className={cn("size-1.5 shrink-0 rounded-full", dot)}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">
                  {column}{" "}
                  <span className="text-muted-foreground">· {group.title}</span>
                </span>
                {locked ? (
                  <Lock className="text-amber-600" aria-label="Not ready yet" />
                ) : group.schedule ? (
                  <CalendarDays aria-label="Asks for a date" />
                ) : opensPage ? (
                  <ArrowRight aria-label={`Opens the ${noun}`} />
                ) : null}
              </DropdownMenuItem>
            );
          })
        ) : (
          <DropdownMenuItem disabled className="text-[12px]">
            Moves on from its own page
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** A record as its tab lists it: number + status, title, category, customer + value, property + date. */
const PipelineCardItem = memo(function PipelineCardItem({
  card,
  index,
  targets,
  onMove,
}: {
  card: PipelineCard;
  index: number;
  targets: MoveTarget[];
  onMove: (card: PipelineCard, groupId: string) => void;
}) {
  const date = cardDate(card);
  const status = cardStatus(card);
  const origin = leadOrigin(card);
  return (
    <Draggable draggableId={card.key} index={index}>
      {(provided, snapshot) => {
        const node = (
          // The whole card drags; the link and the "⋯" button sit side by side inside it.
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            className={cn(
              "relative rounded-md border border-input/70 bg-card shadow-[0_1px_1px_rgba(15,23,42,0.04)] outline-none select-none",
              // Only the shadow animates: the drag itself moves the card with transform.
              "transition-shadow focus-visible:ring-2 focus-visible:ring-ring/50",
              snapshot.isDragging
                ? "rotate-[1.5deg] shadow-lg ring-1 ring-ring/20"
                : "hover:border-input hover:shadow-[0_4px_12px_-6px_rgba(15,23,42,0.18)]",
            )}
          >
            <Link
              href={card.href}
              draggable={false}
              className="block rounded-md px-2.5 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <div className="flex items-center justify-between gap-2 pr-6">
                <p className="flex min-w-0 items-center gap-1.5 truncate text-[12.5px] font-semibold text-primary">
                  <span className="truncate">{card.number || "—"}</span>
                </p>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium",
                    status.className,
                  )}
                >
                  {status.label}
                </span>
              </div>
              {card.title ? (
                <p className="mt-0.5 line-clamp-2 text-[12px] font-medium wrap-break-word">
                  {card.title}
                </p>
              ) : null}
              {card.category || origin ? (
                <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                  {origin ? (
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-px text-[10px] font-semibold",
                        "bg-muted text-muted-foreground",
                      )}
                    >
                      <origin.icon className="size-2.5" aria-hidden />
                      {origin.label}
                    </span>
                  ) : null}
                  {card.category ? (
                    <p className="truncate text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                      {card.category}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <div className="mt-1 flex items-center justify-between gap-2 text-[11.5px]">
                <span className="min-w-0 truncate">{card.customerName}</span>
                {card.value > 0 ? (
                  <span className="shrink-0 font-medium tabular-nums">
                    {money(card.value)}
                  </span>
                ) : null}
              </div>
              {card.address || date ? (
                <div className="mt-0.5 flex items-center justify-between gap-2 text-[10.5px] text-muted-foreground">
                  <span
                    className="min-w-0 truncate"
                    title={card.address || undefined}
                  >
                    {card.address}
                  </span>
                  {date ? (
                    <span className="shrink-0 tabular-nums">{date}</span>
                  ) : null}
                </div>
              ) : null}
              {/* What's left before this estimate can be booked (the card opens the estimate). */}
              {card.blocker && card.blocker.code !== "declined" ? (
                <p
                  className="mt-1.5 flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10.5px] font-medium text-amber-800 dark:text-amber-200"
                  title={card.blocker.message}
                >
                  <TriangleAlert className="size-3 shrink-0" aria-hidden />
                  <span className="truncate">
                    {BLOCKER_HINTS[card.blocker.code]}
                  </span>
                </p>
              ) : null}
            </Link>
            {snapshot.isDragging ? null : (
              <CardMenu card={card} targets={targets} onMove={onMove} />
            )}
          </div>
        );
        // While dragged the card is position: fixed; a transformed ancestor in the portal shell
        // would offset it from the cursor, so it is drawn from <body> instead.
        return snapshot.isDragging ? createPortal(node, document.body) : node;
      }}
    </Draggable>
  );
});
