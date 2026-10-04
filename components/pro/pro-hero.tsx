"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";
import { proPaths } from "@/lib/pro-paths";
import { useAppSelector } from "@/store/hooks";
import {
  selectAuth,
  selectAuthUser,
  selectIsAuthenticated,
} from "@/store/authSlice";
import { HERO_PRO_IMAGE } from "@/lib/site";
import { ProScreenshot } from "@/components/pro/pro-screenshot";

const heroStats = [
  { value: "Leads → paid", label: "One record, start to finish" },
  { value: "0%", label: "Commission on the work you win" },
  { value: "20+", label: "Tools in the pro portal" },
];

export function ProHero() {
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectAuthUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isProvider =
    auth.hydrated &&
    isAuthenticated &&
    (user?.role === "provider" || auth.role === "provider");

  return (
    <section className="relative isolate">
      <div className="relative w-full overflow-hidden pt-12 pb-40 sm:pt-16 sm:pb-48 lg:pt-20 lg:pb-56">
        <Image
          src={HERO_PRO_IMAGE}
          alt=""
          fill
          preload
          sizes="100vw"
          className="object-cover object-[62%_26%]"
        />
        <div
          className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,16,36,0.9)_0%,rgba(2,20,44,0.86)_55%,rgba(0,63,125,0.78)_100%)]"
          aria-hidden="true"
        />

        <Container className="relative">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center text-white">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/85 ring-1 ring-white/20 backdrop-blur-sm">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              For licensed local companies
            </span>

            <h1 className="text-[2rem] leading-[1.06] tracking-tight text-white sm:text-[2.6rem] lg:text-[3.4rem]">
              More local jobs.
              <span className="block text-white/65">One system to run them.</span>
            </h1>

            <p className="max-w-xl text-sm text-white/80 sm:text-base md:text-lg">
              Leads, estimates, scheduling, jobs, invoices, payments, and your crew — the
              whole office in one portal. No commission on the work you win.
            </p>

            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                {isProvider ? (
                  <>
                    <Button size="lg" className="bg-white text-primary hover:bg-white/90" asChild>
                      <Link href={proPaths.dashboard}>
                        Open dashboard
                        <ArrowRight data-icon="inline-end" />
                      </Link>
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      className="border-white/35 bg-white/8 text-white backdrop-blur-sm hover:bg-white/16 hover:text-white"
                      asChild
                    >
                      <Link href="/pro/dashboard/profile">View profile</Link>
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="lg" className="bg-white text-primary hover:bg-white/90" asChild>
                      <Link href={proPaths.register}>
                        Start getting jobs
                        <ArrowRight data-icon="inline-end" />
                      </Link>
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      className="border-white/35 bg-white/8 text-white backdrop-blur-sm hover:bg-white/16 hover:text-white"
                      asChild
                    >
                      <Link href={proPaths.login}>Log in</Link>
                    </Button>
                  </>
                )}
              </div>

              <dl className="mt-3 grid w-full max-w-2xl grid-cols-3 divide-x divide-white/15 rounded-xl bg-white/8 ring-1 ring-white/15 backdrop-blur-sm">
                {heroStats.map((stat) => (
                  <div key={stat.label} className="flex flex-col gap-0.5 px-3 py-3 sm:px-5">
                    <dt className="order-2 text-[11px] leading-4 text-white/65 sm:text-xs">
                      {stat.label}
                    </dt>
                    <dd className="order-1 text-base font-semibold tracking-tight text-white sm:text-lg">
                      {stat.value}
                    </dd>
                  </div>
                ))}
              </dl>
          </div>
        </Container>
      </div>

      <Container className="relative z-10 -mt-28 mb-20 sm:-mt-36 sm:mb-28 lg:-mt-44 lg:mb-36">
        <ProScreenshot
          name="dashboard-main"
          alt="Request Services pro dashboard showing today's overview, lead pipeline, incoming requests, and revenue"
          mobileName="m-dashboard-main"
          mobileAlt="The same dashboard on a phone"
          priority
          sizes="(min-width: 1280px) 1200px, 100vw"
        />
      </Container>
    </section>
  );
}
