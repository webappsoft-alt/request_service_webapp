"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { SmoothScroll } from "@/components/layout/smooth-scroll";
import { AuthMeSync } from "@/components/auth/auth-me-sync";
import { AuthRouteGuard } from "@/components/auth/auth-route-guard";
import { RealtimeProvider } from "@/components/realtime/realtime-provider";
import { PublicDataSync } from "@/components/realtime/public-data-sync";
import { ReduxProvider } from "@/store/redux-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ReduxProvider>
      <TooltipProvider>
        <SmoothScroll />
        <AuthMeSync />
        <RealtimeProvider>
          <PublicDataSync />
          <AuthRouteGuard>{children}</AuthRouteGuard>
        </RealtimeProvider>
        <Toaster />
      </TooltipProvider>
    </ReduxProvider>
  );
}
