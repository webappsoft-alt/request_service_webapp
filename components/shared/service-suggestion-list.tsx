"use client";

import { highlightQuery, type ServiceMatch } from "@/lib/search";
import { cn } from "@/lib/utils";

export function ServiceSuggestionList({
  id,
  hits,
  query,
  activeIndex,
  optionIdPrefix,
  onHover,
  onChoose,
}: {
  id: string;
  hits: ServiceMatch[];
  query: string;
  activeIndex: number;
  optionIdPrefix: string;
  onHover: (index: number) => void;
  onChoose: (hit: ServiceMatch) => void;
}) {
  return (
    <ul
      id={id}
      role="listbox"
      className="absolute top-full left-0 z-50 mt-1 max-h-80 w-full min-w-64 overflow-y-auto rounded-xl border bg-card py-1 shadow-xl sm:w-[22.5rem]"
    >
      {hits.map((hit, index) => (
        <li key={`${hit.service}-${hit.label}`} role="presentation">
          <button
            type="button"
            id={`${optionIdPrefix}-${index}`}
            role="option"
            aria-selected={index === activeIndex}
            className={cn(
              "flex w-full px-3.5 py-2.5 text-left text-sm hover:bg-muted",
              index === activeIndex && "bg-muted"
            )}
            onMouseEnter={() => onHover(index)}
            onClick={() => onChoose(hit)}
          >
            <span>
              {highlightQuery(hit.label, query).map((part, partIndex) =>
                part.match ? (
                  <strong key={`${hit.label}-${partIndex}`} className="font-semibold">
                    {part.text}
                  </strong>
                ) : (
                  <span key={`${hit.label}-${partIndex}`}>{part.text}</span>
                )
              )}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
