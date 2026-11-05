import {
  FileText,
  LayoutGrid,
  PenLine,
  Send,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Container, Section } from "@/components/layout/container";
import { customerWorkflow } from "@/lib/data/navigation";
import { cn } from "@/lib/utils";

/** Icon and status chip per step of `customerWorkflow`, in step order. */
const STEP_DETAILS: { icon: LucideIcon; status: string }[] = [
  { icon: LayoutGrid, status: "Plumbing" },
  { icon: Send, status: "Request sent" },
  { icon: Users, status: "3 local pros" },
  { icon: FileText, status: "EST-2841 · $1,840" },
  { icon: PenLine, status: "Signed" },
  { icon: Wrench, status: "In progress" },
  { icon: Wallet, status: "Settled" },
];

/**
 * "Peace of mind": the seven customer steps as one project file, laid out as a timeline card.
 * Horizontal with a connecting line on wide screens; a vertical timeline below `xl`.
 */
export function PeaceOfMindTimeline() {
  return (
    <Section density="tight" className="bg-background">
      <Container className="flex flex-col gap-8 lg:gap-10">
        <div className="flex max-w-2xl flex-col gap-3">
          <p className="eyebrow text-primary">Peace of mind</p>
          <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-[2.75rem] md:leading-[1.1]">
            You stay in control at every step.
          </h2>
          <p className="max-w-xl text-sm leading-7 text-muted-foreground md:text-base">
            Find a local pro, compare written estimates, and follow the work
            through to payment. Every step stays in one place and in writing,
            for you and your pro.
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 pb-3.5 dark:border-border/30">
            <div className="flex min-w-0 items-center gap-4">
              <span
                className="hidden items-center gap-1.5 sm:flex"
                aria-hidden="true"
              >
                <span className="size-2 rounded-full bg-muted-foreground/25" />
                <span className="size-2 rounded-full bg-muted-foreground/25" />
                <span className="size-2 rounded-full bg-muted-foreground/25" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  Your project, step by step
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  Example: water heater replacement · Aurora, IL
                </p>
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
              All in one place
            </span>
          </div>

          <ol className="grid gap-0 pt-4 sm:pt-6 xl:grid-cols-7 xl:gap-4">
            {customerWorkflow.map((item, index) => {
              const { icon: Icon, status } = STEP_DETAILS[index];
              const last = index === customerWorkflow.length - 1;
              return (
                <li
                  key={item.step}
                  className="relative flex gap-4 pb-6 last:pb-0 xl:flex-col xl:gap-3 xl:pb-0"
                >
                  {!last ? (
                    <span
                      aria-hidden="true"
                      className="absolute top-11 bottom-0 left-5 w-0.5 bg-primary/80 xl:top-5 xl:right-[-1rem] xl:bottom-auto xl:left-10 xl:h-0.5 xl:w-auto"
                    />
                  ) : null}
                  <span className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground ring-4 ring-background">
                    <Icon className="size-4.5" aria-hidden="true" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div>
                      <p className="font-mono text-[11px] tracking-[0.14em] text-muted-foreground">
                        {String(item.step).padStart(2, "0")}
                      </p>
                      <h3 className="text-base font-semibold tracking-tight xl:min-h-10 xl:text-[0.95rem] xl:leading-5">
                        {item.title}
                      </h3>
                    </div>
                    <div
                      className={cn(
                        "rounded-xl bg-muted/70 px-3 py-2.5 xl:flex-1",
                      )}
                    >
                      <p className="text-xs font-medium text-primary">
                        {status}
                      </p>
                      <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                        {item.body}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </Container>
    </Section>
  );
}
