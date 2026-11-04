"use client";

import { memo, useCallback, useMemo, useRef, useState } from "react";
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
import { CalendarDays, Loader2, Lock, RefreshCw, Search, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { BookProjectDialog } from "@/components/portal/pipeline/book-project-dialog";
import { usePipelineBoard } from "@/components/portal/pipeline/use-pipeline-board";
import { Button } from "@/components/ui/button";
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
import { invoiceStatusLabel, invoiceStatusTone, jobStatusLabel, jobStatusTone, requestStatusLabel } from "@/lib/data/portal";
import type { InvoiceStatus, JobStatus, RequestStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { columnShown } from "@/store/pipelineSlice";

const ACCENTS: Record<PipelineAccent, { tint: string; over: string; dot: string }> = {
  rose: { tint: "bg-rose-500/5", over: "ring-rose-400/70 bg-rose-500/10", dot: "bg-rose-500" },
  amber: { tint: "bg-amber-500/5", over: "ring-amber-400/70 bg-amber-500/10", dot: "bg-amber-500" },
  emerald: { tint: "bg-emerald-500/5", over: "ring-emerald-400/70 bg-emerald-500/10", dot: "bg-emerald-500" },
  violet: { tint: "bg-violet-500/5", over: "ring-violet-400/70 bg-violet-500/10", dot: "bg-violet-500" },
  sky: { tint: "bg-sky-500/5", over: "ring-sky-400/70 bg-sky-500/10", dot: "bg-sky-500" },
};

/** What happened, by where the card landed (direct moves only — flows open their page). */
function successMessage(card: PipelineCard, toGroupId: string) {
  switch (toGroupId) {
    case "leads_new":
      return "Lead marked new";
    case "leads_contacted":
      return "Lead marked contacted";
    case "estimates_never_sent":
      return card.kind === "request" ? "Draft estimate created · now on the Estimates page" : "Estimate reopened";
    case "estimates_declined":
      return "Estimate marked declined";
    case "booked_starting_soon":
      return card.kind === "estimate" ? "Job created and booked · customer and crew notified" : "Project booked · customer and crew notified";
    case "booked_updates":
      return card.kind === "estimate" ? "Job created · customer notified" : "Job put on hold";
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
function bookingBlocker(card: { kind: PipelineCardKind; blocker?: PipelineBlocker | null }, group: PipelineGroup) {
  return card.kind === "estimate" && group.kind === "job" ? (card.blocker ?? null) : null;
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
  if (!card.date || (card.kind !== "job" && card.kind !== "invoice")) return null;
  // Job dates are calendar days (midnight UTC); invoice due dates are real times.
  const label = new Date(card.date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(card.kind === "job" ? { timeZone: "UTC" } : {}),
  });
  return card.kind === "invoice" ? `Due ${label}` : label;
}

type PendingBooking = { card: PipelineCard; toGroupId: string; index: number };

export function PipelineBoard({ className }: { className?: string }) {
  const router = useRouter();
  const { board, loading, error, reload, moveCard, loadMore, loadingMore, search, setSearch, searching } = usePipelineBoard();
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
      for (const group of column.groups) for (const card of group.cards) map.set(card.key, card);
    }
    return map;
  }, [board]);

  const groupsById = useMemo(() => {
    const map = new Map<string, PipelineGroup>();
    for (const column of board?.columns ?? []) for (const group of column.groups) map.set(group.id, group);
    return map;
  }, [board]);

  const onSearchChange = (value: string) => {
    setQuery(value);
    setSearch(value);
  };

  const runMove = useCallback(
    async (card: PipelineCard, toGroupId: string, index: number, schedule?: PipelineSchedule) => {
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
      if (card) setDragging({ kind: card.kind, groupId: card.groupId, blocker: card.blocker ?? null });
    },
    [cardsByKey],
  );

  const onDragEnd = useCallback(
    (result: DropResult) => {
      setDragging(null);
      const { destination, source, draggableId } = result;
      // Reordering inside a group isn't stored (groups sort by latest activity).
      if (!destination || destination.droppableId === source.droppableId) return;
      const card = cardsByKey.get(draggableId);
      const target = groupsById.get(destination.droppableId);
      if (!card || !target) return;
      if (!target.accepts.includes(card.kind)) {
        toast.error(`That card can't move to ${target.title}.`);
        return;
      }
      // An unfinished estimate (no line items, not sent…) stays put; offer to finish it.
      const blocker = bookingBlocker(card, target);
      if (blocker) {
        toast.warning(blocker.message, {
          description: `${card.number || "This estimate"} stays in Estimates until then.`,
          action: { label: "Open estimate", onClick: () => router.push(card.href) },
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
        setBooking({ card, toGroupId: target.id, index: destination.index });
        return;
      }
      void runMove(card, target.id, destination.index);
    },
    [cardsByKey, groupsById, runMove, router],
  );

  const confirmBooking = useCallback(
    async (schedule: PipelineSchedule) => {
      if (!booking) return false;
      const ok = await runMove(booking.card, booking.toGroupId, booking.index, schedule);
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
    const el = scroller.current?.querySelector<HTMLElement>(`[data-column="${columnId}"]`);
    if (el && scroller.current) scroller.current.scrollTo({ left: el.offsetLeft - 16, behavior: "smooth" });
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
        <div className="flex items-center gap-2 sm:ml-auto">
          <label className="relative block w-full sm:w-72">
            {searching ? (
              <Loader2 className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />
            ) : (
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
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
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            onClick={() => void reload()}
            aria-label="Refresh pipeline"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} aria-hidden />
          </Button>
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
              <span className={cn("size-1.5 rounded-full", ACCENTS[column.accent].dot)} aria-hidden />
              {column.title}
              <span className="text-muted-foreground tabular-nums">{column.count}</span>
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
              const accent = ACCENTS[column.accent];
              const remaining = Math.max(0, column.count - columnShown(column));
              const fetching = loadingMore.has(column.id);
              return (
                <div
                  key={column.id}
                  data-column={column.id}
                  className="flex w-[82vw] max-w-75 shrink-0 snap-start flex-col gap-2.5 sm:w-68 2xl:w-auto 2xl:max-w-none 2xl:min-w-0"
                >
                  <header>
                    <h3 className="text-[15px] font-semibold tracking-tight">{column.title}</h3>
                    {/* What the stage holds, and the tabs where those records live */}
                    <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                      {column.description}
                      {column.links?.map((link) => (
                        <span key={link.href}>
                          {" · "}
                          <Link href={link.href} className="font-medium text-primary hover:underline">
                            {link.label}
                          </Link>
                        </span>
                      ))}
                    </p>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
                      <span>Total: {column.count}</span>
                      {column.value > 0 ? <span>Value: {money(column.value)}</span> : null}
                    </div>
                  </header>

                  {column.groups.map((group) => {
                    const blocked =
                      dragging !== null && dragging.groupId !== group.id && !group.accepts.includes(dragging.kind);
                    // Accepts estimates, but not this one yet: still droppable, so the drop explains why.
                    const locked = dragging !== null && !blocked ? bookingBlocker(dragging, group) : null;
                    const shown = group.cards;
                    return (
                      <div
                        key={group.id}
                        className={cn(
                          "rounded-lg border border-input/70 p-1.5 transition-opacity",
                          accent.tint,
                          blocked && "opacity-40",
                          locked && "border-dashed border-amber-400/80",
                        )}
                      >
                        <div className="flex items-baseline justify-between gap-2 px-1.5 pt-0.5 pb-1.5">
                          <p className="truncate text-[12px] font-semibold" title={group.hint || undefined}>
                            {group.title}
                            {group.schedule ? (
                              <CalendarDays className="ml-1 inline size-3 text-muted-foreground" aria-label="Asks for a date" />
                            ) : null}
                          </p>
                          <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                            {group.count}
                            {group.value > 0 ? ` · ${money(group.value)}` : ""}
                          </span>
                        </div>
                        {locked ? (
                          <p className="mx-1.5 mb-1.5 flex items-start gap-1.5 rounded-md bg-amber-500/10 px-2 py-1.5 text-[11px] leading-snug text-amber-800 dark:text-amber-200">
                            <Lock className="mt-px size-3 shrink-0" aria-hidden />
                            {locked.message}
                          </p>
                        ) : null}
                        <Droppable droppableId={group.id} isDropDisabled={blocked}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className={cn(
                                "min-h-11 space-y-1.5 rounded-md transition-colors",
                                snapshot.isDraggingOver &&
                                  (locked ? "bg-amber-500/10 ring-2 ring-amber-400/70" : cn("ring-2", accent.over)),
                              )}
                            >
                              {shown.map((card, index) => (
                                <PipelineCardItem key={card.key} card={card} index={index} />
                              ))}
                              {provided.placeholder}
                              {!group.cards.length && !snapshot.isDraggingOver ? (
                                <p className="rounded-md border border-dashed border-input/80 px-2 py-2.5 text-center text-[11px] text-muted-foreground">
                                  {group.count > 0 ? "Older cards · See more below" : group.hint || "Nothing here"}
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
                      {fetching ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
                      See more
                      <span className="text-muted-foreground tabular-nums">· {remaining} left</span>
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </DragDropContext>
      )}

      <BookProjectDialog card={booking?.card ?? null} onCancel={() => setBooking(null)} onConfirm={confirmBooking} />
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
      return { label: estimateStatusLabel(card.status), className: estimateStatusToneDistinct(card.status) };
    case "opportunity":
      return { label: opportunityStatusLabel(card.status), className: cn("ring-1 ring-inset", opportunityStatusTone(card.status)) };
    case "job":
      return { label: jobStatusLabel(card.status as JobStatus), className: jobStatusTone(card.status as JobStatus) };
    default:
      return { label: invoiceStatusLabel(card.status as InvoiceStatus), className: invoiceStatusTone(card.status as InvoiceStatus) };
  }
}

/** A record as its tab lists it: number + status, title, category, customer + value, property + date. */
const PipelineCardItem = memo(function PipelineCardItem({ card, index }: { card: PipelineCard; index: number }) {
  const date = cardDate(card);
  const status = cardStatus(card);
  return (
    <Draggable draggableId={card.key} index={index}>
      {(provided, snapshot) => {
        const node = (
        <Link
          href={card.href}
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={cn(
            "block rounded-md border border-input/70 bg-card px-2.5 py-2 shadow-[0_1px_1px_rgba(15,23,42,0.04)] outline-none select-none",
            // Only the shadow animates: the drag itself moves the card with transform.
            "transition-shadow focus-visible:ring-2 focus-visible:ring-ring/50",
            snapshot.isDragging
              ? "rotate-[1.5deg] shadow-lg ring-1 ring-ring/20"
              : "hover:border-input hover:shadow-[0_4px_12px_-6px_rgba(15,23,42,0.18)]",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-[12.5px] font-semibold text-primary">{card.number || "—"}</p>
            <span className={cn("shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium", status.className)}>
              {status.label}
            </span>
          </div>
          {card.title ? <p className="mt-0.5 line-clamp-2 text-[12px] font-medium wrap-break-word">{card.title}</p> : null}
          {card.category ? (
            <p className="mt-0.5 truncate text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">{card.category}</p>
          ) : null}
          <div className="mt-1 flex items-center justify-between gap-2 text-[11.5px]">
            <span className="min-w-0 truncate">{card.customerName}</span>
            {card.value > 0 ? <span className="shrink-0 font-medium tabular-nums">{money(card.value)}</span> : null}
          </div>
          {card.address || date ? (
            <div className="mt-0.5 flex items-center justify-between gap-2 text-[10.5px] text-muted-foreground">
              <span className="min-w-0 truncate" title={card.address || undefined}>
                {card.address}
              </span>
              {date ? <span className="shrink-0 tabular-nums">{date}</span> : null}
            </div>
          ) : null}
          {/* What's left before this estimate can be booked (the card opens the estimate). */}
          {card.blocker && card.blocker.code !== "declined" ? (
            <p
              className="mt-1.5 flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10.5px] font-medium text-amber-800 dark:text-amber-200"
              title={card.blocker.message}
            >
              <TriangleAlert className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{BLOCKER_HINTS[card.blocker.code]}</span>
            </p>
          ) : null}
        </Link>
        );
        // While dragged the card is position: fixed; a transformed ancestor in the portal shell
        // would offset it from the cursor, so it is drawn from <body> instead.
        return snapshot.isDragging ? createPortal(node, document.body) : node;
      }}
    </Draggable>
  );
});
