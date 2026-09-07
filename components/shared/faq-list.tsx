import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import type { FaqItem } from "@/lib/types";

export function FaqList({
  items,
  variant = "list",
}: {
  items: FaqItem[];
  variant?: "list" | "cards";
}) {
  const cards = variant === "cards";

  return (
    <Accordion type="single" collapsible className={cards ? "gap-2" : "border-t"}>
      {items.map((item, index) => {
        const number = String(index + 1).padStart(2, "0");
        return (
          <AccordionItem
            key={item.id}
            value={item.id}
            className={cn(
              cards &&
                "overflow-hidden rounded-xl border border-black/15 not-last:border-b not-last:border-b-black/15 last:border-b last:border-b-black/15 bg-card px-3.5 shadow-[0_1px_2px_rgb(0_63_125/6%),0_6px_14px_-6px_rgb(0_63_125/12%)] transition-shadow duration-200 hover:shadow-[0_1px_3px_rgb(0_63_125/8%),0_10px_20px_-8px_rgb(0_63_125/16%)] data-[state=open]:shadow-[0_1px_3px_rgb(0_63_125/8%),0_10px_20px_-8px_rgb(0_63_125/16%)]",
            )}
          >
            <AccordionTrigger
              className={cn(
                "py-4 text-base font-semibold hover:no-underline",
                cards && "items-center gap-3 py-3.5 text-sm",
              )}
            >
              {cards ? (
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-[0.6rem] font-semibold text-primary-foreground">
                    {number}
                  </span>
                  <span className="text-left leading-snug">{item.question}</span>
                </span>
              ) : (
                item.question
              )}
            </AccordionTrigger>
            <AccordionContent
              className={cn(
                "text-muted-foreground leading-7",
                cards && "pb-3.5 pl-10 text-sm leading-6",
              )}
            >
              {item.answer}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
