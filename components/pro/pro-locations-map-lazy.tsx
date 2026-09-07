"use client";

import dynamic from "next/dynamic";

const ProLocationsMap = dynamic(
  () => import("@/components/pro/pro-locations-map").then((mod) => mod.ProLocationsMap),
  {
    ssr: false,
    loading: () => <div className="h-[268px] w-full bg-[#F3F7FB]" />,
  },
);

export function ProLocationsMapLazy({
  active,
  onPick,
}: {
  active: number;
  onPick: (value: number) => void;
}) {
  return <ProLocationsMap active={active} onPick={onPick} />;
}
