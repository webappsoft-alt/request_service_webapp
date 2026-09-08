import type { ReactNode } from "react";
import { PageEnter } from "@/components/layout/page-enter";
import { SiteHeader } from "@/components/layout/site-header";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      {/* min-h-0 lets AuthShell lock to the viewport; form column owns scrolling. */}
      <main id="main-content" className="flex min-h-0 flex-1 flex-col">
        <PageEnter className="page-enter flex min-h-0 flex-1 flex-col">
          {children}
        </PageEnter>
      </main>
    </>
  );
}
