import { Check } from "lucide-react";
import { Container, Section } from "@/components/layout/container";
import { ProDeskTabs } from "@/components/pro/pro-desk-tabs";
import { ProScreenshot } from "@/components/pro/pro-screenshot";
import { cn } from "@/lib/utils";

const featured = [
  {
    id: "leads",
    number: "01",
    label: "Leads & requests",
    title: "Every lead lands in one inbox.",
    body: "Marketplace requests matched to your trade and ZIP, plus the homeowners who booked your company by name. Photos, notes, and the address arrive attached.",
    points: [
      "Pipeline view — new, contacted, estimate sent, accepted, converted",
      "Reply with an estimate or a message in one click",
      "Nothing goes cold: reminders and follow-ups sit on the same lead",
    ],
    shot: "leads",
    alt: "Leads board listing incoming service requests with status, service, and location",
    url: "…/pro/dashboard/requests",
  },
  {
    id: "estimates",
    number: "02",
    label: "Estimates",
    title: "Send a scope they can accept in one tap.",
    body: "Labor, materials, equipment, and tax on one page. Share a link — the customer reviews, accepts, or requests changes without creating an account. Every revision is tracked, and they always see what changed.",
    points: [
      "Sectioned line items with images, per-line type and unit",
      "Shareable customer link with accept / request changes / decline",
      "Activity log and change history on every send",
    ],
    shot: "estimate-workspace",
    alt: "Estimate workspace with sectioned line items, totals, and send actions",
    url: "…/pro/dashboard/new-estimate",
    secondaryShot: "customer-estimate-public",
    secondaryAlt: "What the customer sees: the public estimate page with Accept and Request changes buttons",
    secondaryUrl: "requestservices.com/e/…",
    secondaryCaption: "The customer's view",
  },
  {
    id: "schedule",
    number: "03",
    label: "Schedule",
    title: "Fill every tech's week in minutes.",
    body: "Jobs, estimates, site visits, tasks, and invoice due dates on one calendar. Drag a job to another day, filter by team member, and see who is free before you promise a time.",
    points: [
      "Day, week, and month views",
      "Color-coded by type: job, fixed service, estimate, site visit, task, invoice",
      "Filter by work type or by technician",
    ],
    shot: "schedule-week",
    alt: "Weekly schedule calendar with color-coded jobs, estimates, and tasks",
    url: "…/pro/dashboard/schedule",
  },
  {
    id: "jobs",
    number: "04",
    label: "Jobs",
    title: "The accepted estimate becomes the work.",
    body: "Once they accept, the file is a job on the board with the assigned technician, approved scope, cost mix, and a running activity log. Change orders sit beside the original — they never overwrite it.",
    points: [
      "Assign a technician or a contractor, reschedule, convert to invoice",
      "Labor and material, logs, notes, attachments, and settings tabs",
      "Status flows from scheduled to in progress to completed",
    ],
    shot: "job-detail",
    alt: "Job detail showing assigned technician, cost mix chart, line items, and activity",
    url: "…/pro/dashboard/jobs",
  },
  {
    id: "invoices",
    number: "05",
    label: "Invoices & payments",
    title: "Bill the file they already accepted.",
    body: "The invoice is the estimate plus approved change orders. Record deposits, progress payments, and the balance — every payment stays on the invoice until the job is settled.",
    points: [
      "Progress or final invoices from any job",
      "Payments by card, check, cash, or transfer, each logged",
      "Overdue, outstanding, and collected totals on the dashboard",
    ],
    shot: "invoice-detail",
    alt: "Invoice summary with price, paid, balance, and line items from the job",
    url: "…/pro/dashboard/invoices",
  },
  {
    id: "messages",
    number: "06",
    label: "Messages",
    title: "Every conversation next to the job it's about.",
    body: "Two-way chat with customers and leads, unread counts, and a thread per contact. Reply from the desk or from your phone — the message history stays on the customer.",
    points: [
      "Lead inquiries and customer threads in one inbox",
      "Unread and lead filters, search across contacts",
      "Message a customer straight from their estimate or job",
    ],
    shot: "messages",
    alt: "Messages inbox with a customer conversation open",
    url: "…/pro/dashboard/messages",
  },
] as const;

export function ProWorkflow() {
  return (
    <Section id="how-it-works" density="tight" className="scroll-mt-24">
      <Container className="flex flex-col gap-12 lg:gap-16">
        <div className="flex max-w-xl flex-col gap-3">
          <p className="eyebrow text-primary">The portal</p>
          <h2 className="text-3xl font-semibold tracking-tight md:text-[2.5rem]">
            The office, in one login.
          </h2>
          <p className="text-sm leading-7 text-muted-foreground">
            The full field-service desk — leads through payment — on the same record. Real
            screens from the pro portal, not mock-ups.
          </p>
        </div>

        <div className="flex flex-col gap-16 lg:gap-24">
          {featured.map((item, index) => (
            <article
              key={item.id}
              className={cn(
                "grid items-center gap-8 lg:gap-12",
                "secondaryShot" in item
                  ? "lg:grid-cols-1"
                  : "lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]",
              )}
            >
              <div
                className={cn(
                  "flex flex-col gap-4",
                  !("secondaryShot" in item) && index % 2 === 1 && "lg:order-2",
                  "secondaryShot" in item && "max-w-xl",
                )}
              >
                <p className="inline-flex w-fit rounded-full bg-primary/10 px-3 py-1 font-mono text-[0.7rem] tracking-[0.16em] text-primary uppercase">
                  {item.number} · {item.label}
                </p>
                <h3 className="text-2xl font-semibold tracking-tight md:text-[1.85rem]">
                  {item.title}
                </h3>
                <p className="max-w-md text-sm leading-7 text-muted-foreground">{item.body}</p>
                <ul className="flex flex-col gap-2">
                  {item.points.map((point) => (
                    <li key={point} className="flex items-start gap-2.5 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
              <div
                className={cn(
                  "relative",
                  !("secondaryShot" in item) && index % 2 === 1 && "lg:order-1",
                )}
              >
                <span
                  className="pointer-events-none absolute -inset-x-3 -inset-y-4 -z-10 rounded-[2rem] bg-primary/[0.06] sm:-inset-x-6 sm:-inset-y-6"
                  aria-hidden="true"
                />
                {"secondaryShot" in item ? (
                  <div className="grid items-start gap-5 lg:grid-cols-2">
                    <ProScreenshot
                      name={item.shot}
                      alt={item.alt}
                      url={item.url}
                      sizes="(min-width: 1024px) 48vw, 100vw"
                    />
                    <figure>
                      <ProScreenshot
                        name={item.secondaryShot}
                        alt={item.secondaryAlt}
                        url={item.secondaryUrl}
                        sizes="(min-width: 1024px) 48vw, 100vw"
                      />
                      <figcaption className="mt-2 text-center text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                        {item.secondaryCaption}
                      </figcaption>
                    </figure>
                  </div>
                ) : (
                  <ProScreenshot
                    name={item.shot}
                    alt={item.alt}
                    url={item.url}
                    sizes="(min-width: 1024px) 55vw, 100vw"
                  />
                )}
              </div>
            </article>
          ))}
        </div>

        <div id="product" className="scroll-mt-24">
          <ProDeskTabs />
        </div>
      </Container>
    </Section>
  );
}
