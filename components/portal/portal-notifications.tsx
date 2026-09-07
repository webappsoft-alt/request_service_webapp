"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { usePortalInbox } from "@/components/portal/use-portal-inbox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function PortalNotifications() {
  const inbox = usePortalInbox();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell />
          {inbox.total ? (
            <span className="absolute top-1 right-1 min-w-4 rounded-full bg-[#c2410c] px-1 text-[10px] font-semibold text-white">
              {inbox.total}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Inbox</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {inbox.items.length ? (
          inbox.items.slice(0, 8).map((item) => (
            <DropdownMenuItem key={item.id} asChild>
              <Link href={item.href} className="flex flex-col items-start gap-0.5">
                <span className="text-sm font-medium">{item.title}</span>
                <span className="line-clamp-2 text-xs text-muted-foreground">{item.detail}</span>
              </Link>
            </DropdownMenuItem>
          ))
        ) : (
          <p className="px-2 py-3 text-sm text-muted-foreground">No new website requests or chats.</p>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/pro/dashboard/messages">Open messages</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/pro/dashboard/requests?status=new">Open new leads</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
