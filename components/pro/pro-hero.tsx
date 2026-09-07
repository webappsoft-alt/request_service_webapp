import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MapPin, ShieldCheck, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";
import { proPaths } from "@/lib/pro-paths";

const trades = ["Plumbing", "HVAC", "Water heaters"];

export function ProHero() {
  return (
    <section className="relative isolate overflow-hidden">
      <Image
        src="/images/home/split-provider.jpg"
        alt=""
        fill
        preload
        sizes="100vw"
        className="object-cover object-[62%_26%]"
      />
      <div
        className="absolute inset-0 bg-[rgba(2,16,36,0.82)] lg:hidden"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 hidden bg-[linear-gradient(100deg,rgba(2,16,36,0.95)_0%,rgba(2,20,44,0.88)_34%,rgba(0,63,125,0.62)_58%,rgba(0,63,125,0.30)_78%,rgba(0,63,125,0.18)_100%)] lg:block"
        aria-hidden="true"
      />

      <Container className="relative grid items-center gap-12 py-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14 lg:py-20 xl:py-24">
        <div className="flex flex-col items-start gap-5">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/85 ring-1 ring-white/20 backdrop-blur-sm">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            For licensed local companies
          </span>

          <h1 className="text-[2.15rem] leading-[1.04] tracking-tight text-white sm:text-[2.75rem] lg:text-[3.4rem]">
            More local jobs.
            <span className="block text-white/65">One system to run them.</span>
          </h1>

          <p className="max-w-lg text-base leading-7 text-white/80">
            Homeowners in your service area send you the work. You quote it, schedule the crew, and
            invoice the scope they signed — all on the same job file. No commission on what you win.
          </p>

          <div className="flex flex-col gap-2.5 sm:flex-row">
            <Button size="xl" className="bg-white text-primary hover:bg-white/90" asChild>
              <Link href={proPaths.register}>
                Start getting jobs
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
            <Button
              size="xl"
              variant="outline"
              className="border-white/35 bg-white/8 text-white backdrop-blur-sm hover:bg-white/16 hover:text-white"
              asChild
            >
              <Link href={proPaths.login}>Log in</Link>
            </Button>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="flex items-center gap-2 text-sm text-white/70">
              <span className="flex items-center gap-0.5" aria-hidden="true">
                {Array.from({ length: 5 }, (_, index) => (
                  <Star key={index} className="size-3.5 fill-white/85 text-white/85" />
                ))}
              </span>
              Trusted by licensed pros across Colorado
            </span>
            <span className="text-sm text-white/60">No setup fee · Cancel anytime</span>
          </div>
        </div>

        <div className="relative max-w-md lg:justify-self-end">
          <p className="mb-3 text-[11px] font-medium tracking-[0.16em] text-white/55 uppercase">
            How homeowners find you
          </p>
          <div className="overflow-hidden rounded-2xl border border-white/20 bg-card text-card-foreground shadow-[0_36px_80px_rgba(2,16,36,0.45)]">
            <div className="flex items-start gap-3 px-5 pt-5 pb-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
                SH
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold">Summit Home Systems</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Star className="size-3 fill-primary text-primary" aria-hidden="true" />
                  4.9 · 128 reviews · Licensed
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-primary/8 px-2 py-1 text-[10px] font-medium text-primary">
                Live page
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 px-5">
              {trades.map((trade) => (
                <span
                  key={trade}
                  className="rounded-full bg-[#F3F7FB] px-2.5 py-1 text-[11px] font-medium text-primary"
                >
                  {trade}
                </span>
              ))}
            </div>

            <p className="flex items-center gap-1.5 px-5 pt-3 text-xs text-muted-foreground">
              <MapPin className="size-3.5" aria-hidden="true" />
              Serves Aurora, Lakewood, and Denver
            </p>

            <div className="grid grid-cols-2 gap-2 px-5 pt-4 pb-5">
              <span className="rounded-lg bg-primary px-3 py-2.5 text-center text-[12px] font-medium text-primary-foreground">
                Get an estimate
              </span>
              <span className="rounded-lg border border-black/12 px-3 py-2.5 text-center text-[12px] font-medium">
                Book a time
              </span>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
