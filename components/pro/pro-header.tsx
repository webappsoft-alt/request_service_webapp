"use client";

import { useEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, type LucideIcon } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { handleUserLogout } from "@/components/api/apiFuntions";
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
import {
  getProIndustryLinks,
  proProductLinks,
  proResourceFeature,
  proResourceGroups,
  proResourceLinks,
} from "@/lib/data/pro-nav";
import { proPaths } from "@/lib/pro-paths";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";
import {
  selectAuth,
  selectAuthUser,
  selectIsAuthenticated,
} from "@/store/authSlice";
import type { AuthUser } from "@/store/authSlice";

type PanelId = "industries" | "product" | "resources";

const industries = getProIndustryLinks();

export function ProHeader() {
  const pathname = usePathname();
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectAuthUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const providerUser =
    auth.hydrated &&
    isAuthenticated &&
    (user?.role === "provider" || auth.role === "provider")
      ? user
      : null;
  const [open, setOpen] = useState<PanelId | null>(null);
  const closeTimer = useRef<number>(0);

  function show(id: PanelId) {
    window.clearTimeout(closeTimer.current);
    setOpen(id);
  }

  function hide() {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(null), 220);
  }

  useEffect(() => {
    setOpen(null);
  }, [pathname]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header
      className="relative sticky top-0 z-40 border-b bg-card"
      onMouseLeave={hide}
    >
      <div className="container-site flex h-17 items-center justify-between gap-6">
        <div className="flex min-w-0 items-center gap-8">
          <Logo href={proPaths.home} />
          <nav className="hidden items-center gap-0.5 lg:flex" aria-label="For professionals">
            <NavTrigger
              label="Industries"
              active={open === "industries"}
              onEnter={() => show("industries")}
            />
            <NavTrigger
              label="Products"
              active={open === "product"}
              onEnter={() => show("product")}
            />
            <Link
              href={`${proPaths.home}#plans`}
              onMouseEnter={() => setOpen(null)}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Pricing
            </Link>
            <NavTrigger
              label="Resources"
              active={open === "resources"}
              onEnter={() => show("resources")}
            />
          </nav>
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <ProActions user={providerUser} onSignOut={() => handleUserLogout()} />
        </div>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open menu">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-80">
            <SheetHeader>
              <SheetTitle>For professionals</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-5 overflow-y-auto px-4 pb-6">
              <MobileGroup title="Industries">
                {industries.map((item) => (
                  <MobileLink key={item.label} href={item.href} label={item.label} />
                ))}
              </MobileGroup>
              <MobileGroup title="Products">
                {proProductLinks.map((item) => (
                  <MobileLink key={item.label} href={item.href} label={item.label} />
                ))}
              </MobileGroup>
              <MobileLink href={`${proPaths.home}#plans`} label="Pricing" />
              <MobileGroup title="Resources">
                {proResourceLinks.map((item) => (
                  <MobileLink key={item.label} href={item.href} label={item.label} />
                ))}
              </MobileGroup>
              <Separator />
              <ProActions
                user={providerUser}
                onSignOut={() => handleUserLogout()}
                stacked
                closeOnNavigate
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {open ? (
        <div
          className="absolute inset-x-0 top-full hidden border-b bg-card shadow-[0_18px_40px_rgba(4,26,54,0.10)] lg:block"
          onMouseEnter={() => open && show(open)}
        >
          <div className="container-site py-6">
            {open === "industries" ? <IndustriesMega /> : null}
            {open === "product" ? (
              <MegaGrid
                links={proProductLinks}
                footer={{ href: `${proPaths.home}#product`, label: "See everything in the portal" }}
              />
            ) : null}
            {open === "resources" ? <ResourcesMega /> : null}
          </div>
        </div>
      ) : null}
    </header>
  );
}

function NavTrigger({
  label,
  active,
  onEnter,
}: {
  label: string;
  active: boolean;
  onEnter: () => void;
}) {
  return (
    <button
      type="button"
      onMouseEnter={onEnter}
      onFocus={onEnter}
      aria-expanded={active}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
      <ChevronDown className={cn("size-3.5 transition-transform", active && "rotate-180")} aria-hidden="true" />
    </button>
  );
}

function IndustriesMega() {
  return (
    <div className="flex flex-col gap-5">
      <ul className="grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-5">
        {industries.map((item) => (
          <li key={item.label}>
            <Link href={item.href} className="flex items-center gap-2.5 rounded-lg px-1 py-1 hover:bg-muted">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/8 text-primary">
                <item.icon className="size-3.5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{item.label}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{item.hint}</span>
              </span>
            </Link>
            <ul className="mt-1.5 flex flex-col pl-10">
              {item.jobs.map((job) => (
                <li key={job} className="truncate px-1 py-1 text-[13px] text-muted-foreground">
                  {job}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <div className="border-t border-black/10 pt-4">
        <Link href={`${proPaths.home}#process`} className="text-sm font-medium text-brand hover:text-foreground">
          See how every trade runs on one file
        </Link>
      </div>
    </div>
  );
}

function ResourcesMega() {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(16rem,0.85fr)]">
      {proResourceGroups.map((group) => (
        <div key={group.title}>
          <p className="mb-3 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            {group.title}
          </p>
          <ul className="flex flex-col gap-0.5">
            {group.links.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="block rounded-xl px-3 py-2.5 hover:bg-muted">
                  <span className="block text-sm font-medium">{item.label}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{item.hint}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="rounded-2xl bg-primary px-5 py-5 text-primary-foreground">
        <p className="text-base font-semibold">{proResourceFeature.title}</p>
        <p className="mt-2 text-sm leading-6 text-white/75">{proResourceFeature.body}</p>
        <Link
          href={proResourceFeature.href}
          className="mt-4 inline-flex rounded-md bg-white px-3 py-2 text-sm font-medium text-primary"
        >
          {proResourceFeature.cta}
        </Link>
        <Link
          href={proResourceFeature.secondaryHref}
          className="mt-3 block text-sm text-white/80 hover:text-white"
        >
          {proResourceFeature.secondary}
        </Link>
      </div>
    </div>
  );
}

function MegaGrid({
  links,
  footer,
}: {
  links: readonly { href: string; label: string; hint?: string; icon: LucideIcon }[];
  footer: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col gap-5">
      <ul className="grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
        {links.map((item) => (
          <li key={item.label}>
            <Link
              href={item.href}
              className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted"
            >
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
                <item.icon className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{item.label}</span>
                {item.hint ? (
                  <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                    {item.hint}
                  </span>
                ) : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="border-t border-black/10 pt-4">
        <Link href={footer.href} className="text-sm font-medium text-brand hover:text-foreground">
          {footer.label}
        </Link>
      </div>
    </div>
  );
}

function MobileGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="px-2 text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">{title}</p>
      {children}
    </div>
  );
}

function MobileLink({ href, label }: { href: string; label: string }) {
  return (
    <SheetClose asChild>
      <Link href={href} className="rounded-md px-2 py-2 text-sm font-medium hover:bg-muted">
        {label}
      </Link>
    </SheetClose>
  );
}

function ProActions({
  user,
  onSignOut,
  stacked = false,
  closeOnNavigate = false,
}: {
  user: AuthUser | null;
  onSignOut: () => void;
  stacked?: boolean;
  closeOnNavigate?: boolean;
}) {
  const wrap = (node: ReactElement) =>
    closeOnNavigate ? <SheetClose asChild>{node}</SheetClose> : node;

  if (user?.role === "provider") {
    return (
      <>
        <p className={cn("text-sm text-muted-foreground", stacked ? "px-2" : "max-w-40 truncate")}>
          Hi, {String(user.firstName || "there")}
        </p>
        {wrap(
          <Button asChild>
            <Link href={proPaths.dashboard}>Dashboard</Link>
          </Button>,
        )}
        {closeOnNavigate ? (
          <SheetClose asChild>
            <Button variant="ghost" onClick={onSignOut}>
              Log out
            </Button>
          </SheetClose>
        ) : (
          <Button variant="ghost" onClick={onSignOut}>
            Log out
          </Button>
        )}
      </>
    );
  }

  return (
    <>
      {wrap(
        <Button
          variant="outline"
          asChild
          className="border-primary text-primary hover:bg-primary/5 hover:text-primary"
        >
          <Link href={proPaths.login}>Log in</Link>
        </Button>,
      )}
      {wrap(
        <Button asChild>
          <Link href={proPaths.register}>Sign up</Link>
        </Button>,
      )}
    </>
  );
}
