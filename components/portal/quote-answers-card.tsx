"use client";

import { cn } from "@/lib/utils";

export function visibleQuoteAnswers(
  answers?: Array<{ id?: string; label: string; value: string }> | null,
) {
  return (answers || []).filter(
    (item) => String(item.label || "").trim() && String(item.value || "").trim(),
  );
}

export function quoteNotesFromDetails(details?: string | null) {
  const raw = String(details || "").trim();
  if (!raw || /^answers\b/i.test(raw)) return "";
  return raw.split("\n\n")[0].trim();
}

export function QuoteAnswersCard({
  answers,
  notes,
  photos,
  compact = false,
  className,
}: {
  answers?: Array<{ id?: string; label: string; value: string }> | null;
  notes?: string | null;
  photos?: string[] | null;
  compact?: boolean;
  className?: string;
}) {
  const listed = visibleQuoteAnswers(answers);
  const note = String(notes || "").trim();
  const images = (photos || []).map((src) => String(src || "").trim()).filter(Boolean);
  if (!listed.length && !note && !images.length) return null;

  return (
    <div
      className={cn(
        "rounded-xl border border-[#d7e2ef] bg-[#f7f9fc]",
        compact ? "px-3 py-3" : "px-4 py-4",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-[0.08em] text-[#003F7D] uppercase">
          Customer answers
        </p>
        {listed.length ? (
          <span className="text-[11px] font-medium text-muted-foreground">
            {listed.length} question{listed.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>
      {listed.length ? (
        <dl
          className={cn(
            "mt-3 grid gap-2",
            compact ? "grid-cols-1" : "sm:grid-cols-2",
          )}
        >
          {listed.map((item) => (
            <div
              key={item.id || item.label}
              className="min-w-0 rounded-lg border border-white bg-white px-3 py-2.5"
            >
              <dt className="text-[11px] font-medium text-muted-foreground">{item.label}</dt>
              <dd className="mt-1 text-sm font-semibold leading-snug text-foreground wrap-break-word">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {note ? (
        <div className={cn(listed.length ? "mt-3 pt-3 border-t border-[#d7e2ef]" : "mt-2")}>
          <p className="text-[11px] font-medium text-muted-foreground">Notes</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {note}
          </p>
        </div>
      ) : null}
      {images.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {images.map((src) => (
            <a
              key={src}
              href={src}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-md border border-[#d7e2ef] bg-white"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="Customer photo" className="size-16 object-cover" />
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
