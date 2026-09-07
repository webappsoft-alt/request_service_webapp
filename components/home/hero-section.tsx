import Image from "next/image";
import { FileCheck2, ShieldCheck, Wallet } from "lucide-react";
import { Container } from "@/components/layout/container";

const trustMarkers = [
  { icon: ShieldCheck, label: "Licensed and insured" },
  { icon: FileCheck2, label: "Itemized estimates" },
  { icon: Wallet, label: "Flexible payment schedules" },
];

export function HeroSection() {
  return (
    <section className="relative isolate">
      <div className="relative h-[18rem] w-full sm:h-[20rem] lg:h-[22rem] xl:h-[24rem]">
        <Image
          src="/images/home/hero-home.jpg"
          alt=""
          fill
          preload
          sizes="100vw"
          className="object-cover object-[66%_22%]"
        />

        {/* Navy scrim: a wide side-lit wash on desktop so the copy sits on the
            bright half of the photo, a flat wash on narrow screens where the
            copy spans the full width. */}
        <div
          className="absolute inset-0 bg-[rgba(4,26,54,0.55)] lg:hidden"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 hidden bg-[linear-gradient(100deg,rgba(4,26,54,0.88)_0%,rgba(4,26,54,0.66)_26%,rgba(4,26,54,0.28)_46%,rgba(4,26,54,0.04)_64%,transparent_78%)] lg:block"
          aria-hidden="true"
        />
        <div
          className="absolute inset-x-0 bottom-0 h-28 bg-linear-to-t from-[rgba(4,26,54,0.5)] to-transparent"
          aria-hidden="true"
        />

        <Container className="relative flex h-full items-center pb-16 lg:pb-18">
          <div className="enter-stagger flex max-w-3xl flex-col items-start gap-3 text-white">
            <span className="flex items-center gap-3">
              <span className="h-px w-8 bg-white/50" aria-hidden="true" />
              <span className="eyebrow text-white/80">Homeowners hire. Pros get the work.</span>
            </span>

            <h1 className="text-[1.85rem] leading-[1.08] text-white sm:text-[2.35rem] lg:text-[3rem]">
              <span className="block">Hire a licensed local pro.</span>
              <span className="block">Get the work in writing.</span>
            </h1>

            <p className="max-w-2xl text-sm text-white/80 md:text-base">
              Search by service and ZIP. Compare estimates. Hire with a signed scope.
            </p>

            <ul className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
              {trustMarkers.map((marker) => (
                <li key={marker.label} className="flex items-center gap-2 text-sm text-white/75">
                  <marker.icon className="size-4 text-white/60" aria-hidden="true" />
                  {marker.label}
                </li>
              ))}
            </ul>
          </div>
        </Container>

      </div>
    </section>
  );
}
