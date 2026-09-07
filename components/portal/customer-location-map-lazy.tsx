"use client";

import dynamic from "next/dynamic";
import type { Provider, ServiceAddress } from "@/lib/types";

const CustomerLocationMap = dynamic(
  () => import("@/components/portal/customer-location-map").then((mod) => mod.CustomerLocationMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-72 items-center justify-center rounded-lg border border-black/10 bg-card text-sm text-muted-foreground">
        Loading map…
      </div>
    ),
  },
);

export function CustomerLocationMapLazy({
  provider,
  address,
  name,
}: {
  provider: Provider;
  address: ServiceAddress;
  name: string;
}) {
  return <CustomerLocationMap provider={provider} address={address} name={name} />;
}
