"use client";

import dynamic from "next/dynamic";
import type { Provider } from "@/lib/types";

const ServiceAreaMap = dynamic(
  () => import("@/components/marketplace/service-area-map").then((mod) => mod.ServiceAreaMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-80 items-center justify-center rounded-xl border border-input bg-muted text-sm text-muted-foreground">
        Loading service area…
      </div>
    ),
  }
);

export function ServiceAreaMapLazy({ provider }: { provider: Provider }) {
  return <ServiceAreaMap provider={provider} />;
}
