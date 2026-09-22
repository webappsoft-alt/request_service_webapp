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

const deskSteps = [
  {
    title: "Request in your ZIP",
    detail: "Matched to your trade and service area",
  },
  {
    title: "You send the estimate",
    detail: "They review the scope and sign",
  },
  {
    title: "Schedule and invoice",
    detail: "Same job file · no commission",
  },
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
      <div className="relative h-[18rem] w-full overflow-hidden sm:h-[20rem] lg:h-[22rem] xl:h-[24rem]">
        <Image
          src={HERO_PRO_IMAGE}
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

        <Container className="relative flex h-full items-center">
          <div className="grid w-full items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,21rem)] lg:gap-8">
            <div className="flex flex-col items-start gap-3 text-white">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/85 ring-1 ring-white/20 backdrop-blur-sm">
                <ShieldCheck className="size-3.5" aria-hidden="true" />
                For licensed local companies
              </span>

              <h1 className="text-[1.85rem] leading-[1.08] tracking-tight text-white sm:text-[2.35rem] lg:text-[3rem]">
                More local jobs.
                <span className="block text-white/65">One system to run them.</span>
              </h1>

              <p className="hidden max-w-lg text-sm text-white/80 sm:block md:text-base">
                Matched requests land in your inbox. Quote, schedule, and invoice on one job file.
              </p>

              <div className="flex flex-col gap-2 sm:flex-row">
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
            </div>

            <aside
              className="relative hidden w-full lg:block lg:justify-self-end"
              aria-hidden="true"
            >
              <div className="overflow-hidden rounded-2xl border border-white/15 bg-[rgba(6,18,36,0.72)] shadow-[0_24px_48px_rgba(2,16,36,0.45)] ring-1 ring-white/10 backdrop-blur-md">
                <div className="flex items-end justify-between px-5 pt-4 pb-3">
                  <div>
                    <p className="text-[10px] font-medium tracking-[0.18em] text-white/50 uppercase">
                      Any trade you run
                    </p>
                    <p className="mt-1 text-base font-semibold tracking-tight text-white">
                      Your desk
                    </p>
                  </div>
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/80">
                    One job file
                  </span>
                </div>
                <ol className="relative mx-5 mb-4 border-l border-white/15 pl-5">
                  {deskSteps.map((step, index) => (
                    <li
                      key={step.title}
                      className={index < deskSteps.length - 1 ? "pb-3.5" : "pb-1"}
                    >
                      <span className="absolute -left-[9px] mt-0.5 flex size-[17px] items-center justify-center rounded-full bg-[#0a2744] text-[10px] font-semibold text-white ring-2 ring-white/70">
                        {index + 1}
                      </span>
                      <p className="text-sm font-medium text-white">{step.title}</p>
                      <p className="mt-0.5 text-[12px] leading-5 text-white/60">{step.detail}</p>
                    </li>
                  ))}
                </ol>
              </div>
            </aside>
          </div>
        </Container>
      </div>
    </section>
  );
}
