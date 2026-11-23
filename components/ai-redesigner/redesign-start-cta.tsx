"use client";

import Link from "next/link";
import { ArrowRight, LogIn, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AI_DESIGNER_PATH } from "@/lib/api/ai-redesigner-client";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";
import { selectIsAuthenticated } from "@/store/authSlice";

/**
 * Start button(s) (was used on the old Kitchen & Bath Design info page; unused now): signed-in customers go straight to the
 * tool; guests are asked to log in (or sign up) and come back to the tool afterwards.
 * Buttons keep their own width (client: the full-width button looked wrong) — previous version
 * rendered the signed-in button straight into a flex column, which stretched it.
 */
export function RedesignStartCta({ inverse = false, center = false }: { inverse?: boolean; center?: boolean }) {
  const isLoggedIn = useAppSelector(selectIsAuthenticated);
  const next = encodeURIComponent(AI_DESIGNER_PATH);

  return (
    <div className={cn("flex flex-col gap-2.5", center ? "items-center" : "items-start")}>
      <div className={cn("flex flex-wrap gap-3", center && "justify-center")}>
        {isLoggedIn ? (
          <Button size="lg" className={inverse ? "bg-white text-primary hover:bg-white/90" : undefined} asChild>
            <Link href={AI_DESIGNER_PATH}>
              <Sparkles className="size-4" aria-hidden="true" />
              Start designing
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        ) : (
          <>
            <Button size="lg" className={inverse ? "bg-white text-primary hover:bg-white/90" : undefined} asChild>
              <Link href={`/login?next=${next}`}>
                <LogIn className="size-4" aria-hidden="true" />
                Log in to start designing
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className={inverse ? "border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white" : undefined}
              asChild
            >
              <Link href={`/signup?next=${next}`}>Create a free account</Link>
            </Button>
          </>
        )}
      </div>
      {isLoggedIn ? null : (
        <p className={inverse ? "text-xs text-white/70" : "text-xs text-muted-foreground"}>
          Free for Request Service customers. Your designs are saved to your account.
        </p>
      )}
    </div>
  );
}
