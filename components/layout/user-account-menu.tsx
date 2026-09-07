"use client";

import Link from "next/link";
import { LogOut, Settings } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getUserAvatarSrc, type AuthUser } from "@/store/authSlice";
import { handleUserLogout } from "@/components/api/apiFuntions";
import { cn } from "@/lib/utils";

function initialsFor(user: AuthUser | null | undefined): string {
  const first = String(user?.firstName || "").trim();
  const last = String(user?.lastName || "").trim();
  const email = String(user?.email || "").trim();
  if (first || last) {
    return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || first.charAt(0).toUpperCase();
  }
  return email.charAt(0).toUpperCase() || "U";
}

function displayName(user: AuthUser | null | undefined): string {
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
  return name || String(user?.email || "Account");
}

export function UserAccountMenu({
  user,
  className,
  align = "end",
}: {
  user: AuthUser;
  className?: string;
  align?: "start" | "center" | "end";
}) {
  const isProvider = user.role === "provider";
  const settingsHref = isProvider
    ? "/pro/dashboard/settings"
    : "/account/settings";
  const avatarUrl = getUserAvatarSrc(user);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "relative size-9 rounded-full border border-border p-0 hover:bg-muted",
            className,
          )}
          aria-label="Open account menu"
        >
          <Avatar size="sm" className="size-8">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
              {initialsFor(user)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="min-w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-foreground">
              {displayName(user)}
            </span>
            {user.email ? (
              <span className="truncate text-xs text-muted-foreground">
                {String(user.email)}
              </span>
            ) : null}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={settingsHref}>
            <Settings />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => handleUserLogout()}
        >
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
