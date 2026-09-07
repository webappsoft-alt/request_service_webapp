import { BadgeDollarSign, CalendarDays, FileText, Inbox } from "lucide-react";
import { Container } from "@/components/layout/container";

const items = [
  {
    icon: Inbox,
    label: "Job requests",
    body: "Matched to your trade and ZIP, or sent to you by name.",
  },
  {
    icon: FileText,
    label: "Estimates",
    body: "Labor, materials, tax, and terms — then a signature.",
  },
  {
    icon: CalendarDays,
    label: "Schedule",
    body: "Jobs, crew, and the day roster on one calendar.",
  },
  {
    icon: BadgeDollarSign,
    label: "Get paid",
    body: "Invoice the signed scope. Track every balance.",
  },
] as const;

export function ProProof() {
  return (
    <section className="relative z-10 -mt-10 md:-mt-12">
      <Container>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <li
              key={item.label}
              className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-[0_16px_36px_rgba(4,26,54,0.10)]"
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/8 text-primary">
                <item.icon className="size-5" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-semibold">{item.label}</span>
                <span className="mt-1 block text-sm leading-5 text-muted-foreground">
                  {item.body}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
