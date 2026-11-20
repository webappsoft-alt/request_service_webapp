import Image from "next/image";
import { FileCheck2, ShieldCheck, Wallet } from "lucide-react";
import { Container } from "@/components/layout/container";
import { HERO_BANNER_IMAGE } from "@/lib/site";

const trustMarkers = [
  { icon: ShieldCheck, label: "Local professionals" },
  { icon: FileCheck2, label: "Written estimates" },
  { icon: Wallet, label: "Clear project details" },
];

export function HeroSection() {
  return (
    <section className="relative isolate">
      {/* Phones: content-sized (min 18rem) so the eyebrow/headline never clip under the header. */}
      {/* Desktop is a little taller (26 / 28rem, was 22 / 24rem) so the full-width photo shows more of the
          house — roof to porch — without stretching. (A split layout with a navy block was tried; the client
          prefers the full-width photo.) */}
      <div className="relative min-h-72 w-full sm:h-[20rem] lg:h-[26rem] xl:h-[28rem]">
        <Image
          // Local daylight photo of a family home (3200×2133; Next serves sized AVIF/WebP).
          src={HERO_BANNER_IMAGE}
          alt=""
          fill
          preload
          sizes="100vw"
          quality={80}
          className="object-cover object-[55%_60%] lg:object-[50%_50%]"
        />

        {/* Navy scrim: a wide side-lit wash on desktop so the copy stays crisp on the left, a flat wash on
            narrow screens where the copy spans the full width. */}
        <div
          className="absolute inset-0 bg-[rgba(4,26,54,0.66)] lg:hidden"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 hidden bg-[linear-gradient(100deg,rgba(4,26,54,0.88)_0%,rgba(4,26,54,0.74)_30%,rgba(4,26,54,0.46)_54%,rgba(4,26,54,0.14)_74%,rgba(4,26,54,0.02)_90%)] lg:block"
          aria-hidden="true"
        />
        <div
          className="absolute inset-x-0 bottom-0 h-28 bg-linear-to-t from-[rgba(4,26,54,0.5)] to-transparent"
          aria-hidden="true"
        />

        <Container className="relative flex min-h-72 items-center pt-8 pb-20 sm:h-full sm:min-h-0 sm:pt-0 sm:pb-16 lg:pb-18">
          <div className="enter-stagger flex max-w-3xl flex-col items-start gap-3 text-white">
            <span className="flex items-center gap-3">
              <span className="h-px w-8 bg-white/50" aria-hidden="true" />
              <span className="eyebrow text-white/80">Home services, made simple.</span>
            </span>

            <h1 className="text-[1.85rem] leading-[1.08] text-white sm:text-[2.35rem] lg:text-[3rem]">
              <span className="block">Big Project. Small Repair.</span>
              <span className="block">Find the Right Pro.</span>
            </h1>

            <p className="max-w-2xl text-sm text-white/80 md:text-base">
              Connect with local home service professionals for repairs, maintenance, and
              remodeling. Explore profiles, compare written estimates, and choose with confidence.
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
