import { Container, Section } from "@/components/layout/container";
import { cn } from "@/lib/utils";

const stats = [
  { label: "New requests", value: "12", note: "4 awaiting a reply" },
  { label: "Active jobs", value: "8", note: "3 on the calendar this week" },
  { label: "Open estimates", value: "$18,420", note: "5 waiting on a signature" },
  { label: "Outstanding", value: "$6,150", note: "2 invoices past due" },
];

const rows = [
  { id: "RS-2841", job: "Water heater replacement — Austin, TX", amount: "$1,840.00", status: "Paid", tone: "success" as const },
  { id: "RS-2838", job: "Drain line inspection — Round Rock, TX", amount: "$420.00", status: "Awaiting signature", tone: "pending" as const },
  { id: "RS-2835", job: "AC condenser service — Austin, TX", amount: "$965.00", status: "Scheduled", tone: "neutral" as const },
  { id: "RS-2831", job: "Fixture replacement — Pflugerville, TX", amount: "$310.00", status: "Paid", tone: "success" as const },
];

export function ProPreview() {
  return (
    <Section id="desk" tone="muted" density="tight">
      <Container className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <p className="eyebrow text-muted-foreground">The desk</p>
          <h2 className="text-3xl font-semibold md:text-[2.5rem]">See the work and the money in one place.</h2>
          <p className="max-w-xl text-sm leading-6 text-muted-foreground">
            Requests waiting on a reply, jobs on the calendar, and invoices still open — the same numbers your office
            already tracks.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border bg-card shadow-[0_16px_40px_rgba(4,26,54,0.08)]">
          <div className="flex items-center justify-between border-b px-5 py-3.5">
            <p className="text-sm font-medium">Summit Home Systems</p>
            <span className="rounded-full bg-secondary px-2.5 py-1 font-mono text-xs text-muted-foreground">
              Sample desk
            </span>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-lg border bg-background px-4 py-4">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">{stat.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{stat.note}</p>
              </div>
            ))}
          </div>
          <div className="border-t p-5">
            <div className="flex items-center justify-between pb-3">
              <p className="text-sm font-medium">Recent activity</p>
              <p className="font-mono text-xs text-muted-foreground">Last 7 days</p>
            </div>
            <ul className="flex flex-col">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t py-3 text-sm first:border-t-0"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="font-mono text-xs text-muted-foreground">{row.id}</span>
                    <span className="truncate">{row.job}</span>
                  </span>
                  <span className="flex items-center gap-4">
                    <span className="font-mono text-sm">{row.amount}</span>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-medium",
                        row.tone === "success" && "bg-success/10 text-success",
                        row.tone === "pending" && "bg-accent-amber/10 text-accent-amber",
                        row.tone === "neutral" && "bg-secondary text-muted-foreground",
                      )}
                    >
                      {row.status}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </Section>
  );
}
