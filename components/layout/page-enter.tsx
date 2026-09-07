"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

export function PageEnter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  return (
    <div key={pathname} className={className}>
      {children}
    </div>
  );
}
