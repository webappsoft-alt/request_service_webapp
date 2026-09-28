"use client";

import dynamic from "next/dynamic";
import type { Provider, ServiceAddress } from "@/lib/types";

const CustomerLocationMap = dynamic(
  () => import("@/components/portal/customer-location-map").then((mod) => mod.CustomerLocationMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-72 items-center justify-center rounded-xl bg-muted/40 text-sm text-muted-foreground">
        Loading map…
      </div>
    ),
  },
);

export function CustomerLocationMapLazy({
  provider,
  address,
  name,
  simpro = false,
  plain = false,
}: {
  provider: Provider;
  address: ServiceAddress;
  name: string;
  simpro?: boolean;
  plain?: boolean;
}) {
  return (
    <CustomerLocationMap
      provider={provider}
      address={address}
      name={name}
      simpro={simpro}
      plain={plain}
    />
  );
}
