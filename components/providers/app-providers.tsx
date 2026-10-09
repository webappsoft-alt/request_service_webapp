"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { SmoothScroll } from "@/components/layout/smooth-scroll";
import { AuthMeSync } from "@/components/auth/auth-me-sync";
import { AuthRouteGuard } from "@/components/auth/auth-route-guard";
import { RealtimeProvider } from "@/components/realtime/realtime-provider";
import { PublicDataSync } from "@/components/realtime/public-data-sync";
import { SocketProvider } from "@/components/socket";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ReduxProvider } from "@/store/redux-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <ReduxProvider>
        <TooltipProvider>
          <SmoothScroll />
          <AuthMeSync />
          <SocketProvider>
            <RealtimeProvider>
              <PublicDataSync />
              <AuthRouteGuard>{children}</AuthRouteGuard>
            </RealtimeProvider>
          </SocketProvider>
          <Toaster />
        </TooltipProvider>
      </ReduxProvider>
    </ThemeProvider>
  );
}
