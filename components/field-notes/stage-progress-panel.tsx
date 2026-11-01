"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Layers, Loader2, MessageSquarePlus, Pencil, Play, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import { subscribeRealtime } from "@/components/realtime/realtime-provider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { noteRoleLabel, type StageNote } from "@/lib/field-notes";
import {
  formatStageDuration,
  stageDateRange,
  stageDisplayStatus,
  stageProgress,
  stageStatusLabel,
  stageStatusTone,
  type ProjectStage,
  type StageBundle,
  type StageProgressInput,
} from "@/lib/project-stages";
import { cn } from "@/lib/utils";

function formatNoteTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Realtime events after which the stages may have changed (office edits, another crew member). */
const REFRESH_EVENTS = new Set(["TECHNICIAN_REFRESH", "CONTRACTOR_REFRESH", "ESTIMATE_UPDATED"]);

/**
 * Project stages on an assigned job / estimate for technicians and contractors: mark each stage
 * In progress or Completed, or leave a note (e.g. why it is late). Every update reaches the office
 * and the customer. Hidden when the work has no stages.
 */
export function StageProgressPanel({
  recordKey,
  load,
  update,
  editNote,
  deleteNote,
  className,
}: {
  /** Stages reload when this changes (the record id). */
  recordKey: string;
  load: () => Promise<StageBundle>;
  update: (stageId: string, input: StageProgressInput) => Promise<StageBundle>;
  /** Edit / delete the viewer's own stage notes. */
  editNote?: (noteId: string, content: string) => Promise<StageBundle>;
  deleteNote?: (noteId: string) => Promise<StageBundle>;
  className?: string;
}) {
  const [stages, setStages] = useState<ProjectStage[]>([]);
  const [notes, setNotes] = useState<StageNote[]>([]);
  const [editing, setEditing] = useState<{ id: string; content: string } | null>(null);
  const [noteBusy, setNoteBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");

  // Latest callbacks without refetching on every render.
  const loadRef = useRef(load);
  const updateRef = useRef(update);
  const editRef = useRef(editNote);
  const deleteRef = useRef(deleteNote);
  useEffect(() => {
    loadRef.current = load;
    updateRef.current = update;
    editRef.current = editNote;
    deleteRef.current = deleteNote;
  });

  const apply = (bundle: StageBundle) => {
    setStages(bundle.stages);
    setNotes(bundle.notes);
  };

  useEffect(() => {
    let cancelled = false;
    const refresh = (initial: boolean) => {
      if (initial) setStatus("loading");
      loadRef.current()
        .then((bundle) => {
          if (cancelled) return;
          setStages(bundle.stages);
          setNotes(bundle.notes);
          setStatus("ready");
        })
        .catch(() => {
          if (!cancelled && initial) setStatus("failed");
        });
    };
    refresh(true);
    const unsubscribe = subscribeRealtime((detail) => {
      if (REFRESH_EVENTS.has(String(detail.type || ""))) refresh(false);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [recordKey]);

  async function send(stage: ProjectStage, input: StageProgressInput, done: string) {
    if (busyId) return;
    setBusyId(stage.id);
    try {
      apply(await updateRef.current(stage.id, input));
      if (input.note) {
        setNoteFor(null);
        setNote("");
      }
      toast.success(done, { description: "The office and the customer have been notified." });
    } catch (error) {
      toast.error("Couldn't update the stage", { description: extractErrorMessage(error) || "Please try again." });
    } finally {
      setBusyId(null);
    }
  }

  async function saveEdit() {
    if (!editing || !editRef.current || noteBusy) return;
    const content = editing.content.trim();
    if (!content) return;
    setNoteBusy(editing.id);
    try {
      apply(await editRef.current(editing.id, content));
      setEditing(null);
      toast.success("Note updated.");
    } catch (error) {
      toast.error("Couldn't update the note", { description: extractErrorMessage(error) || "Please try again." });
    } finally {
      setNoteBusy(null);
    }
  }

  async function removeNote(noteId: string) {
    if (!deleteRef.current || noteBusy) return;
    if (!window.confirm("Delete this note? The office and the customer will no longer see it.")) return;
    setNoteBusy(noteId);
    try {
      apply(await deleteRef.current(noteId));
      if (editing?.id === noteId) setEditing(null);
      toast.success("Note deleted.");
    } catch (error) {
      toast.error("Couldn't delete the note", { description: extractErrorMessage(error) || "Please try again." });
    } finally {
      setNoteBusy(null);
    }
  }

  if (status === "ready" && !stages.length) return null;
  const progress = stageProgress(stages);

  return (
    <section className={cn("rounded-md border border-input bg-card", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border-soft px-4 py-2.5">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <Layers className="size-4 text-primary" aria-hidden />
            Project stages
          </h3>
          <p className="text-xs text-muted-foreground">
            Start and complete each stage, or add a note when one is delayed. The office and the customer see every update.
          </p>
        </div>
        {stages.length ? <span className="text-xs font-semibold">{progress}% complete</span> : null}
      </div>
      {status === "loading" ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">Loading stages…</p>
      ) : status === "failed" ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">Couldn&apos;t load the stages. They&apos;ll show when you reopen this page.</p>
      ) : (
        <ol className="divide-y divide-border-soft">
          {stages.map((stage, index) => {
            const shown = stageDisplayStatus(stage);
            const busy = busyId === stage.id;
            return (
              <li key={stage.id} className="space-y-2 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {index + 1}. {stage.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatStageDuration({ days: stage.durationDays, hours: stage.durationHours })}
                      {stage.startDate ? ` · ${stageDateRange(stage)}` : " · dates to be scheduled"}
                      {stage.statusUpdatedBy && stage.status !== "pending" ? ` · updated by ${stage.statusUpdatedBy}` : ""}
                    </p>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", stageStatusTone(shown))}>
                    {stageStatusLabel(shown)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {stage.status === "pending" ? (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => void send(stage, { status: "in_progress" }, `${stage.name} started.`)}>
                      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                      Mark in progress
                    </Button>
                  ) : null}
                  {stage.status !== "completed" ? (
                    <Button size="sm" disabled={busy} onClick={() => void send(stage, { status: "completed" }, `${stage.name} completed.`)}>
                      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                      Mark completed
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => void send(stage, { status: "in_progress" }, `${stage.name} reopened.`)}>
                      <RotateCcw className="size-3.5" />
                      Reopen
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      setNoteFor(noteFor === stage.id ? null : stage.id);
                      setNote("");
                    }}
                  >
                    <MessageSquarePlus className="size-3.5" />
                    Add note
                  </Button>
                </div>
                {notes.filter((item) => item.stageId === stage.id).length ? (
                  <ul className="space-y-1.5">
                    {notes
                      .filter((item) => item.stageId === stage.id)
                      .map((item) => (
                        <li key={item.id} className="rounded-md bg-muted/60 px-3 py-2 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs text-muted-foreground">
                              <span className="font-semibold text-foreground">{item.authorName || noteRoleLabel(item.authorRole)}</span>
                              {item.createdAt ? ` · ${formatNoteTime(item.createdAt)}` : ""}
                              {item.edited ? " · edited" : ""}
                            </p>
                            {item.mine && (editNote || deleteNote) && editing?.id !== item.id ? (
                              <div className="flex items-center gap-1">
                                {editNote ? (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="size-7"
                                    disabled={noteBusy === item.id}
                                    aria-label="Edit note"
                                    onClick={() => setEditing({ id: item.id, content: item.content })}
                                  >
                                    <Pencil className="size-3.5" />
                                  </Button>
                                ) : null}
                                {deleteNote ? (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="size-7 text-destructive hover:text-destructive"
                                    disabled={noteBusy === item.id}
                                    aria-label="Delete note"
                                    onClick={() => void removeNote(item.id)}
                                  >
                                    {noteBusy === item.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                                  </Button>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                          {editing?.id === item.id ? (
                            <div className="mt-2 space-y-2">
                              <Textarea
                                value={editing.content}
                                onChange={(event) => setEditing({ id: item.id, content: event.target.value })}
                                rows={3}
                                maxLength={2000}
                                autoFocus
                              />
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="outline" disabled={noteBusy === item.id} onClick={() => setEditing(null)}>
                                  Cancel
                                </Button>
                                <Button size="sm" disabled={noteBusy === item.id || !editing.content.trim()} onClick={() => void saveEdit()}>
                                  {noteBusy === item.id ? <Loader2 className="size-3.5 animate-spin" /> : null}
                                  Save
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <p className="mt-0.5 whitespace-pre-wrap break-words">{item.content}</p>
                          )}
                        </li>
                      ))}
                  </ul>
                ) : null}
                {noteFor === stage.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder={`e.g. Waiting on parts — ${stage.name} needs one more day.`}
                      rows={3}
                      maxLength={2000}
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => setNoteFor(null)}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        disabled={busy || !note.trim()}
                        onClick={() => void send(stage, { note: note.trim() }, `Note added to ${stage.name}.`)}
                      >
                        {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
                        Share note
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
