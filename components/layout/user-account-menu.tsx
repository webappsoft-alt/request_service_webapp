"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  LifeBuoy,
  LogOut,
  MessageCircle,
  Settings,
  Store,
} from "lucide-react";
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
import { listPublicChatThreads } from "@/lib/api/chat-client";
import { readChatGuest } from "@/lib/booking/chat-store";
import { customerPaths } from "@/lib/customer-paths";
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

function listingEmailFor(user: AuthUser) {
  const fromAuth = String(user.email || "").trim();
  if (fromAuth) return fromAuth;
  return String(readChatGuest()?.email || "").trim();
}

export function UserAccountMenu({
  user,
  className,
  align = "end",
  hideAvatarBadge = false,
}: {
  user: AuthUser;
  className?: string;
  align?: "start" | "center" | "end";
  /** Hide the unread-messages count on the avatar (the count stays on "Messages" in the menu). */
  hideAvatarBadge?: boolean;
}) {
  const isProvider = user.role === "provider";
  const settingsHref = isProvider
    ? "/pro/dashboard/settings"
    : customerPaths.settings;
  const avatarUrl = getUserAvatarSrc(user);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    if (isProvider) return;
    const email = listingEmailFor(user);
    if (!email) return;
    let cancelled = false;
    void (async () => {
      try {
        const threads = await listPublicChatThreads(email, { silent: true });
        if (cancelled) return;
        const total = threads.items.reduce(
          (sum, thread) => sum + (thread.unreadForCustomer || 0),
          0,
        );
        setUnreadMessages(total);
      } catch {
        if (!cancelled) setUnreadMessages(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isProvider, user.email]);

  const avatarButton = (
    <Avatar size="sm" className="size-7">
      {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
      <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
        {initialsFor(user)}
      </AvatarFallback>
    </Avatar>
  );

  const menu = (
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
      {!isProvider ? (
        <DropdownMenuItem asChild>
          <Link href={customerPaths.messages}>
            <MessageCircle />
            <span className="flex-1">Messages</span>
            {unreadMessages > 0 ? (
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                {unreadMessages > 9 ? "9+" : unreadMessages}
              </span>
            ) : null}
          </Link>
        </DropdownMenuItem>
      ) : null}
      <DropdownMenuItem asChild>
        <Link href={settingsHref}>
          {isProvider ? <Store /> : <Settings />}
          {isProvider ? "Business Profile" : "Settings"}
        </Link>
      </DropdownMenuItem>
      {/* Customers: Support lives here now (moved out of the dashboard sidebar — client). */}
      {!isProvider ? (
        <DropdownMenuItem asChild>
          <Link href={customerPaths.support}>
            <LifeBuoy />
            Support
          </Link>
        </DropdownMenuItem>
      ) : null}
      <DropdownMenuSeparator />
      <DropdownMenuItem
        variant="destructive"
        onSelect={() => handleUserLogout()}
      >
        <LogOut />
        Log out
      </DropdownMenuItem>
    </DropdownMenuContent>
  );

  if (isProvider) {
    return (
      <div className="flex items-center">
        <Button
          asChild
          variant="ghost"
          size="icon"
          className={cn(
            "relative size-9 rounded-full border border-border p-0 hover:bg-muted",
            className,
          )}
        >
          <Link href={settingsHref} aria-label="Business Profile">
            {avatarButton}
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground"
              aria-label="Open account menu"
            >
              <ChevronDown className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          {menu}
        </DropdownMenu>
      </div>
    );
  }

  // Customers: avatar + dropdown arrow in one pill (client: show the arrow). Previous trigger was
  // the round avatar only — `relative size-9 rounded-full border border-border p-0`.
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          // Borderless, like the technician / contractor header (client). Interim version was a
          // bordered pill: "h-9 rounded-full border border-border bg-card p-0.5 pr-2".
          className={cn(
            "group relative inline-flex h-8 items-center gap-1.5 rounded-md px-1.5 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none data-[state=open]:bg-muted",
            className,
          )}
          aria-label="Open account menu"
        >
          {avatarButton}
          <ChevronDown
            className="size-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180"
            aria-hidden="true"
          />
          {unreadMessages > 0 && !hideAvatarBadge ? (
            <span className="absolute -top-0.5 left-6 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {unreadMessages > 9 ? "9+" : unreadMessages}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      {menu}
    </DropdownMenu>
  );
}
