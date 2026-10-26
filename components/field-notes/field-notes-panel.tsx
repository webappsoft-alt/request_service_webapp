"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { noteRoleLabel, type FieldNote } from "@/lib/field-notes";
import { cn } from "@/lib/utils";

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * Notes on an assigned job / estimate for technicians and contractors: add updates (delays,
 * extra days needed, progress) and read the crew's notes. The office sees every note on the
 * record; ticking "Visible to the customer" also shows it on the customer's estimate page.
 */
export function FieldNotesPanel({
  noun,
  recordKey,
  load,
  add,
  className,
}: {
  /** "job" or "estimate", for the wording. */
  noun: string;
  /** Notes reload when this changes (the record id). */
  recordKey: string;
  load: () => Promise<FieldNote[]>;
  add: (input: { content: string; visibleToCustomer: boolean }) => Promise<FieldNote | null>;
  className?: string;
}) {
  const [notes, setNotes] = useState<FieldNote[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [content, setContent] = useState("");
  const [shared, setShared] = useState(true);
  const [saving, setSaving] = useState(false);

  // Latest callbacks without refetching on every render.
  const loadRef = useRef(load);
  const addRef = useRef(add);
  useEffect(() => {
    loadRef.current = load;
    addRef.current = add;
  });

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    loadRef.current()
      .then((list) => {
        if (cancelled) return;
        setNotes(list);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("failed");
      });
    return () => {
      cancelled = true;
    };
  }, [recordKey]);

  async function save() {
    const text = content.trim();
    if (!text || saving) return;
    setSaving(true);
    try {
      const note = await addRef.current({ content: text, visibleToCustomer: shared });
      if (note) setNotes((prev) => [note, ...prev]);
      setContent("");
      toast.success(shared ? "Note added — the office and the customer can see it." : "Note added — the office can see it.");
    } catch (error) {
      toast.error("Couldn't add the note", { description: extractErrorMessage(error) || "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={cn("rounded-md border border-input bg-card", className)}>
      <div className="border-b border-border-soft px-4 py-2.5">
        <h3 className="text-sm font-semibold">Notes &amp; updates</h3>
        <p className="text-xs text-muted-foreground">
          Delays, extra days needed, progress — the office sees every note on this {noun}.
        </p>
      </div>
      <div className="space-y-2 px-4 py-3">
        <Textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={`e.g. Waiting on parts — need one extra day to finish this ${noun}.`}
          rows={3}
          maxLength={2000}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox checked={shared} onCheckedChange={(value) => setShared(value === true)} />
            Visible to the customer
          </label>
          <Button size="sm" disabled={!content.trim() || saving} onClick={() => void save()}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <MessageSquarePlus className="size-3.5" />}
            Add note
          </Button>
        </div>
      </div>
      <div className="border-t border-border-soft">
        {status === "loading" ? (
          <p className="px-4 py-4 text-sm text-muted-foreground">Loading notes…</p>
        ) : status === "failed" ? (
          <p className="px-4 py-4 text-sm text-muted-foreground">Couldn&apos;t load notes. They&apos;ll show when you reopen this page.</p>
        ) : !notes.length ? (
          <p className="px-4 py-4 text-sm text-muted-foreground">No notes yet.</p>
        ) : (
          <ul className="divide-y divide-border-soft">
            {notes.map((note) => (
              <li key={note.id} className="space-y-1 px-4 py-3">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{note.authorName || noteRoleLabel(note.authorRole)}</span>
                  <span>{noteRoleLabel(note.authorRole)}</span>
                  <span>· {formatWhen(note.createdAt)}</span>
                  {note.visibleToCustomer ? (
                    <span className="rounded-full bg-emerald-50 px-1.5 py-px text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                      Customer can see
                    </span>
                  ) : null}
                </p>
                <p className="text-sm whitespace-pre-wrap">{note.content}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
