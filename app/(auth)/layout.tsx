import type { ReactNode } from "react";
import { PageEnter } from "@/components/layout/page-enter";
import { SiteHeader } from "@/components/layout/site-header";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="flex min-h-0 flex-1 flex-col">
        <PageEnter className="page-enter flex min-h-0 flex-1 flex-col">{children}</PageEnter>
      </main>
    </>
  );
}
