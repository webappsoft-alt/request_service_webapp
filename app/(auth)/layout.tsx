import type { ReactNode } from "react";
import { PageEnter } from "@/components/layout/page-enter";
import { SiteHeader } from "@/components/layout/site-header";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      {/* Mobile: allow main to grow so the page scrolls. Desktop: keep flex height for AuthShell centering. */}
      <main id="main-content" className="flex flex-1 flex-col lg:min-h-0">
        <PageEnter className="page-enter flex flex-1 flex-col lg:min-h-0">{children}</PageEnter>
      </main>
    </>
  );
}
