"use client";

import type { ReactElement } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Logo } from "@/components/layout/logo";
import { UserAccountMenu } from "@/components/layout/user-account-menu";
import { ProHeader } from "@/components/pro/pro-header";
import { primaryNav, secondaryNav } from "@/lib/data/navigation";
import { proPaths } from "@/lib/pro-paths";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";
import {
  selectAuth,
  selectAuthUser,
  selectIsAuthenticated,
} from "@/store/authSlice";
import { handleUserLogout } from "@/components/api/apiFuntions";

export function SiteHeader() {
  const pathname = usePathname();
  const onPro = pathname === proPaths.home || pathname.startsWith(`${proPaths.home}/`);

  if (onPro) {
    return <ProHeader />;
  }

  return <CustomerSiteHeader pathname={pathname} />;
}

function CustomerSiteHeader({ pathname }: { pathname: string }) {
  const auth = useAppSelector(selectAuth);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const user = useAppSelector(selectAuthUser);
  const showAccount = Boolean(user && (isAuthenticated || auth.token));

  return (
    <header className="sticky top-0 z-40 border-b bg-card">
      <div className="container-site flex h-17 items-center justify-between gap-6">
        <Logo />
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {primaryNav.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative px-3 py-2 text-sm font-medium transition-colors hover:text-foreground",
                  isActive
                    ? "text-foreground after:absolute after:bottom-0.5 after:left-1/2 after:h-0.5 after:w-4 after:-translate-x-1/2 after:rounded-full after:bg-primary"
                    : "text-muted-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          {!auth.hydrated ? (
            <div
              className="size-9 animate-pulse rounded-full bg-muted"
              aria-hidden="true"
            />
          ) : (
            <HeaderActions showAccount={showAccount} user={user} />
          )}
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="lg:hidden"
              aria-label="Open menu"
            >
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-80">
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-1 overflow-y-auto px-4 pb-6">
              {[...primaryNav, ...secondaryNav].map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <SheetClose asChild key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "rounded-md px-2 py-2 text-sm font-medium hover:bg-muted",
                        isActive && "bg-muted text-foreground ring-1 ring-border",
                      )}
                    >
                      {item.label}
                    </Link>
                  </SheetClose>
                );
              })}
              <Separator className="my-3" />
              {auth.hydrated ? (
                <HeaderActions
                  showAccount={showAccount}
                  user={user}
                  stacked
                  closeOnNavigate
                />
              ) : (
                <p className="px-2 text-sm text-muted-foreground">Loading…</p>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}

function HeaderActions({
  showAccount,
  user,
  stacked = false,
  closeOnNavigate = false,
}: {
  showAccount: boolean;
  user: ReturnType<typeof selectAuthUser>;
  stacked?: boolean;
  closeOnNavigate?: boolean;
}) {
  const wrap = (node: ReactElement) =>
    closeOnNavigate ? <SheetClose asChild>{node}</SheetClose> : node;

  if (showAccount && user) {
    const isProvider = user.role === "provider";
    const settingsHref = isProvider
      ? "/pro/dashboard/settings"
      : "/account/settings";

    const onLogout = () =>
      handleUserLogout({
        skipRedirect: false,
      });

    if (stacked) {
      return (
        <div className="flex flex-col gap-2">
          <p className="px-2 text-sm font-medium">
            {[user.firstName, user.lastName].filter(Boolean).join(" ") ||
              String(user.email || "Account")}
          </p>
          {user.email ? (
            <p className="px-2 text-xs text-muted-foreground">{String(user.email)}</p>
          ) : null}
          {isProvider
            ? wrap(
                <Button asChild>
                  <Link href={proPaths.dashboard}>Dashboard</Link>
                </Button>,
              )
            : wrap(
                <Button variant="outline" asChild>
                  <Link href="/account/orders">My orders</Link>
                </Button>,
              )}
          {wrap(
            <Button variant="outline" asChild>
              <Link href={settingsHref}>Settings</Link>
            </Button>,
          )}
          {closeOnNavigate ? (
            <SheetClose asChild>
              <Button variant="ghost" onClick={onLogout}>
                Log out
              </Button>
            </SheetClose>
          ) : (
            <Button variant="ghost" onClick={onLogout}>
              Log out
            </Button>
          )}
        </div>
      );
    }

    return <UserAccountMenu user={user} />;
  }

  return (
    <>
      {wrap(
        <Button
          variant="outline"
          asChild
          className="border-primary text-primary hover:bg-primary/5 hover:text-primary"
        >
          <Link href="/login">Login/ Signup</Link>
        </Button>,
      )}
      {wrap(
        <Button asChild>
          <Link href={proPaths.home}>Join as Pro</Link>
        </Button>,
      )}
    </>
  );
}
