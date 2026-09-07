"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { SmoothScroll } from "@/components/layout/smooth-scroll";
import { ReduxProvider } from "@/store/redux-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ReduxProvider>
      <TooltipProvider>
        <SmoothScroll />
        {children}
        <Toaster />
      </TooltipProvider>
    </ReduxProvider>
  );
}
