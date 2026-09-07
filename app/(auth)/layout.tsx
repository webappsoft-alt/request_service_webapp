import type { ReactNode } from "react";
import { PageEnter } from "@/components/layout/page-enter";
import { SiteHeader } from "@/components/layout/site-header";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      {/* Grow with content so the document can scroll when the auth form is tall. */}
      <main id="main-content" className="flex flex-1 flex-col">
        <PageEnter className="page-enter flex flex-1 flex-col">{children}</PageEnter>
      </main>
    </>
  );
}
