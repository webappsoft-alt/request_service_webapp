"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { CustomerLoginDialogProvider } from "@/components/auth/customer-login-dialog";
import { BotProvider, BotWidget } from "@/components/bot-ai";
import { HomeMotion } from "@/components/home/home-motion";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { DeferredHydration } from "@/components/shared/deferred-hydration";
import { useAppDispatch } from "@/store/hooks";
import { fetchSiteBranding } from "@/store/siteBrandingSlice";

/** Customer dashboard + every portal (Pro, Contractor, Technician, Admin) never get the AI assistant. */
const BOT_EXCLUDED_PREFIXES = [
  "/account",
  "/dashboard",
  "/customer",
  "/pro",
  "/for-pros",
  "/contractor",
  "/technical",
  "/technician",
  "/admin",
];

function isBotRoute(pathname: string) {
  return !BOT_EXCLUDED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function MarketingShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const isExplorer =
    pathname === "/find-a-professional" ||
    pathname === "/get-a-quote" ||
    /^\/services\/[^/]+$/.test(pathname);
  const showBot = isBotRoute(pathname);

  useEffect(() => {
    void dispatch(fetchSiteBranding());
  }, [dispatch]);

  const content = (
    <>
      <SiteHeader />
      <main key={pathname} id="main-content" className="page-enter flex-1">
        <HomeMotion>{children}</HomeMotion>
      </main>
      {isExplorer ? null : (
        <DeferredHydration>
          <SiteFooter />
        </DeferredHydration>
      )}
    </>
  );

  return (
    // Website-level sign-in modal (opened from the AI assistant and other guest prompts).
    <CustomerLoginDialogProvider>
      {showBot ? (
        // Provider wraps the page too, so the home hero search can hand off to the assistant.
        <BotProvider>
          {content}
          <BotWidget />
        </BotProvider>
      ) : (
        content
      )}
    </CustomerLoginDialogProvider>
  );
}
