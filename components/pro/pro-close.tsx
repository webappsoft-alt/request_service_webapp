import Link from "next/link";
import { ArrowRight, BadgeCheck, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";
import { testimonials } from "@/lib/data/content";
import { proPaths } from "@/lib/pro-paths";

const featured =
  testimonials.find((item) => item.audience === "provider") ?? testimonials[0];

const assurances = [
  "No commission on the jobs you win",
  "Cancel the subscription anytime",
  "Your estimates and customers stay yours",
] as const;

export function ProClose() {
  return (
    <section className="pb-14 md:pb-20">
      <Container>
        <div className="overflow-hidden rounded-3xl bg-[linear-gradient(150deg,#003F7D_0%,#01305f_55%,#02203f_100%)] text-primary-foreground">
          <div className="grid gap-10 p-8 sm:p-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-16 lg:p-14">
            <figure className="flex flex-col gap-5">
              <Quote className="size-7 text-white/35" aria-hidden="true" />
              <blockquote className="text-xl leading-[1.35] font-semibold tracking-tight text-white md:text-2xl">
                &ldquo;{featured.quote}&rdquo;
              </blockquote>
              <figcaption className="text-sm text-white/60">
                {featured.name} · {featured.role}
                {featured.company ? ` · ${featured.company}` : ""}
              </figcaption>
            </figure>

            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <p className="eyebrow text-white/60">Get started</p>
                <h2 className="text-2xl font-semibold tracking-tight text-white md:text-[2rem]">
                  Open your account today.
                </h2>
              </div>

              <ul className="flex flex-col gap-2.5">
                {assurances.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-white/75">
                    <BadgeCheck className="mt-0.5 size-4 shrink-0 text-white/50" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>

              <div className="mt-1 flex flex-col gap-2.5 sm:flex-row">
                <Button size="xl" className="bg-white text-primary hover:bg-white/90" asChild>
                  <Link href={proPaths.register}>
                    Create your account
                    <ArrowRight data-icon="inline-end" />
                  </Link>
                </Button>
                <Button
                  size="xl"
                  variant="outline"
                  className="border-white/30 bg-white/5 text-white hover:bg-white/12 hover:text-white"
                  asChild
                >
                  <Link href={proPaths.login}>Log in</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
