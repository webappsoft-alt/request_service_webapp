"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { HomeMotion } from "@/components/home/home-motion";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export function MarketingShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isExplorer =
    pathname === "/find-a-professional" ||
    pathname === "/get-a-quote" ||
    /^\/services\/[^/]+$/.test(pathname);

  return (
    <>
      <SiteHeader />
      <main key={pathname} id="main-content" className="page-enter flex-1">
        <HomeMotion>{children}</HomeMotion>
      </main>
      {isExplorer ? null : <SiteFooter />}
    </>
  );
}
