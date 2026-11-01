import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  Building2,
  CalendarCheck,
  CreditCard,
  HardHat,
  LayoutDashboard,
  MapPinned,
  Smartphone,
  Truck,
  UserRound,
  Users,
} from "lucide-react";
import { Container, Section } from "@/components/layout/container";
import { proPaths } from "@/lib/pro-paths";

/** Everything else in the portal (same areas as the live page's desk tabs), as a plain index. */
const AREAS = [
  { icon: LayoutDashboard, title: "Dashboard", body: "What needs attention today — overdue invoices, unassigned work, and the lead pipeline." },
  { icon: UserRound, title: "Customers", body: "Contact details, the service address, amount owing, and every past estimate and job." },
  { icon: Users, title: "Employees", body: "Technicians, estimators, dispatchers, and office staff — assign work without a text thread." },
  { icon: HardHat, title: "Contractors", body: "Partners on file with trade, rate, and insurance, handed jobs from the same board." },
  { icon: Truck, title: "Vendors", body: "Your supply houses, the parts you buy, stock on hand, and purchase orders." },
  { icon: BellRing, title: "Reminders & tasks", body: "Owners, due dates, and priority — overdue items stay on the dashboard until cleared." },
  { icon: CalendarCheck, title: "Online booking", body: "Publish fixed-price services; homeowners book a slot inside your working hours." },
  { icon: CreditCard, title: "Payments", body: "Card, check, cash, or transfer — each logged on its invoice until the job is settled." },
  { icon: Building2, title: "Business profile", body: "Licenses, hours, categories, gallery, and portfolio — it feeds your public page." },
  { icon: MapPinned, title: "Service areas", body: "Requests route to you only when the address is inside your coverage." },
  { icon: BarChart3, title: "Reports", body: "Collected, outstanding, estimate conversion, and monthly volume at month end." },
  { icon: Smartphone, title: "On your phone", body: "Technicians open today's jobs, update status from the driveway, and message the customer." },
] as const;

export function ProPortalIndex() {
  return (
    <Section className="bg-muted/50">
      <Container className="grid gap-12 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.6fr)] lg:gap-20">
        <div className="flex flex-col gap-4 lg:sticky lg:top-28 lg:self-start">
          <p className="eyebrow text-primary">Also in the portal</p>
          <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-[2.5rem] md:leading-[1.1]">
            Everything else the office needs.
          </h2>
          <p className="max-w-sm text-sm leading-7 text-muted-foreground">
            Customers, crew, subs, suppliers, and the books — on the same login as your leads and jobs.
          </p>
          <Link
            href={proPaths.register}
            className="mt-1 inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            Start free
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>

        <ul className="grid gap-x-12 sm:grid-cols-2">
          {AREAS.map((area) => {
            const Icon = area.icon;
            return (
              <li key={area.title} className="flex gap-4 border-t border-border py-5">
                <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                <div className="flex min-w-0 flex-col gap-1">
                  <h3 className="text-[15px] font-semibold tracking-tight">{area.title}</h3>
                  <p className="text-sm leading-6 text-muted-foreground">{area.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </Container>
    </Section>
  );
}
