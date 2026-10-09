"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ThemeToggle({
  className,
  variant = "ghost",
  size = "icon",
}: {
  className?: string;
  variant?: "ghost" | "outline" | "default" | "secondary";
  size?: "icon" | "icon-sm" | "sm" | "default";
}) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Normalize any legacy 'system' preference to default light
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("theme");
        if (stored === "system") {
          setTheme("light");
        }
      } catch {
        // ignore localStorage access errors
      }
    }
  }, [setTheme]);

  const activeTheme = mounted ? resolvedTheme || theme || "light" : "light";
  const isDark = activeTheme === "dark";

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn(
        "relative size-8 sm:size-9 shrink-0 text-muted-foreground hover:text-foreground transition-colors cursor-pointer",
        className,
      )}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      disabled={!mounted}
    >
      {isDark ? (
        <Sun className="size-4 text-amber-400 transition-transform duration-200" />
      ) : (
        <Moon className="size-4 transition-transform duration-200" />
      )}
      <span className="sr-only">
        {isDark ? "Switch to light mode" : "Switch to dark mode"}
      </span>
    </Button>
  );
}

/** Theme selector in dropdowns is retired in favor of the header toggle icon. */
export function ThemeMenuItems() {
  return null;
}
