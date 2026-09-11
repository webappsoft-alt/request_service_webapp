"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Check,
  ExternalLink,
  Globe,
  MapPin,
  Phone,
} from "lucide-react";
import { Container, Section } from "@/components/layout/container";
import { ImageGallerySlider } from "@/components/shared/image-gallery-slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CenteredSpinner } from "@/components/ui/spinner";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAuth, selectIsAuthenticated } from "@/store/authSlice";
import {
  customerOrderDetailFromListItem,
  fetchCustomerOrderById,
  selectCustomerOrderDetail,
  selectCustomerOrderDetailError,
  selectCustomerOrderDetailLoading,
  selectCustomerOrders,
  setCustomerOrderDetail,
} from "@/store/ordersSlice";
import {
  formatOrderAddressLine,
  formatOrderDateTime,
  formatOrderMoney,
  formatOrderWindow,
} from "@/lib/orders/order-display";
import {
  formatOrderStatus,
  formatPaymentStatus,
  orderStatusBadgeVariant,
} from "@/lib/orders/order-status";
import { cn } from "@/lib/utils";

function SideCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-card p-4 sm:p-5",
        className,
      )}
    >
      <h2 className="text-sm font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      <div className="mt-3 space-y-2.5">{children}</div>
    </section>
  );
}

function MetaRow({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  if (value == null || value === "" || value === "—") return null;
  return (
    <div className="flex gap-2.5 text-sm">
      {icon ? (
        <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
      ) : null}
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

function normalizeWebsiteUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

export function CustomerOrderDetailView({ orderId }: { orderId: string }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const auth = useAppSelector(selectAuth);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const order = useAppSelector(selectCustomerOrderDetail);
  const list = useAppSelector(selectCustomerOrders);
  const loading = useAppSelector(selectCustomerOrderDetailLoading);
  const error = useAppSelector(selectCustomerOrderDetailError);
  const nextPath = `/account/orders/${encodeURIComponent(orderId)}`;

  const activeOrder = useMemo(() => {
    if (order?.id === orderId) return order;
    return null;
  }, [order, orderId]);

  useEffect(() => {
    if (!auth.hydrated) return;
    if (!isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
    }
  }, [auth.hydrated, isAuthenticated, router, nextPath]);

  useEffect(() => {
    if (!auth.hydrated || !isAuthenticated || !orderId) return;

    // Instant paint from list/card stash (same pattern as services → detail).
    if (order?.id !== orderId) {
      const fromList = list.find((item) => item.id === orderId);
      if (fromList) {
        dispatch(
          setCustomerOrderDetail(customerOrderDetailFromListItem(fromList)),
        );
      }
    }

    // Enrich with full GET payload (provider avatar/website, audit, etc.).
    void dispatch(fetchCustomerOrderById(orderId));
    // Intentionally omit `order` / `list` identity churn — open once per orderId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.hydrated, isAuthenticated, orderId, dispatch]);

  if (!auth.hydrated || !isAuthenticated) {
    return (
      <Section tone="muted">
        <Container>
          <CenteredSpinner label="Loading order" className="min-h-64" />
        </Container>
      </Section>
    );
  }

  if (loading && !activeOrder) {
    return (
      <Section tone="muted">
        <Container className="max-w-6xl">
          <CenteredSpinner label="Loading order" className="min-h-72" />
        </Container>
      </Section>
    );
  }

  if (error && !activeOrder) {
    return (
      <Section tone="muted">
        <Container className="max-w-3xl space-y-4">
          <Button variant="ghost" size="sm" className="w-fit gap-1.5" asChild>
            <Link href="/account/orders">
              <ArrowLeft className="size-3.5" />
              Back to orders
            </Link>
          </Button>
          <div className="space-y-4 rounded-xl border border-border bg-card px-5 py-12 text-center">
            <p className="text-base font-medium text-foreground">
              Couldn’t load this order
            </p>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              {error}
            </p>
            <Button
              type="button"
              onClick={() => void dispatch(fetchCustomerOrderById(orderId))}
            >
              Try again
            </Button>
          </div>
        </Container>
      </Section>
    );
  }

  if (!activeOrder) {
    return (
      <Section tone="muted">
        <Container className="max-w-3xl space-y-4">
          <Button variant="ghost" size="sm" className="w-fit gap-1.5" asChild>
            <Link href="/account/orders">
              <ArrowLeft className="size-3.5" />
              Back to orders
            </Link>
          </Button>
          <CenteredSpinner label="Loading order" className="min-h-64" />
        </Container>
      </Section>
    );
  }

  const title = activeOrder.service?.title || "Order details";
  const images = activeOrder.service?.images?.filter(Boolean) ?? [];
  const addressLine = formatOrderAddressLine(activeOrder.address);
  const pricing = activeOrder.pricing;
  const covered = activeOrder.service?.covered?.filter(Boolean) ?? [];
  const provider = activeOrder.provider;
  const websiteUrl = provider?.website
    ? normalizeWebsiteUrl(provider.website)
    : "";
  const taxPercent =
    pricing.taxRate != null && Number.isFinite(pricing.taxRate)
      ? `${(pricing.taxRate * 100).toFixed(2)}%`
      : null;

  return (
    <Section tone="muted" density="tight">
      <Container className="max-w-6xl space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" className="-ml-2 w-fit gap-1.5" asChild>
            <Link href="/account/orders">
              <ArrowLeft className="size-3.5" />
              Back to orders
            </Link>
          </Button>
          <span className="text-muted-foreground/50" aria-hidden="true">
            /
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {activeOrder.orderNumber || "Order"}
          </span>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,22rem)] lg:gap-8">
          <div className="flex flex-col gap-5">
            <ImageGallerySlider images={images} alt={title} priority />

            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {activeOrder.service?.category ? (
                  <Badge variant="secondary">
                    {activeOrder.service.category}
                  </Badge>
                ) : null}
                {activeOrder.service?.subcategory ? (
                  <Badge variant="outline">
                    {activeOrder.service.subcategory}
                  </Badge>
                ) : null}
                <Badge variant={orderStatusBadgeVariant(activeOrder.status)}>
                  {formatOrderStatus(activeOrder.status)}
                </Badge>
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {title}
              </h1>
              {activeOrder.service?.unit ? (
                <p className="text-sm text-muted-foreground">
                  {activeOrder.service.unit}
                  {activeOrder.service.basePrice != null
                    ? ` · Base ${formatOrderMoney(activeOrder.service.basePrice, pricing.currency)}`
                    : ""}
                </p>
              ) : null}
            </div>

            {covered.length > 0 ? (
              <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
                <h2 className="text-sm font-semibold text-foreground">
                  What’s included
                </h2>
                <ul className="mt-3 space-y-2">
                  {covered.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {activeOrder.lifecycleAudit.length > 0 ? (
              <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
                <h2 className="text-sm font-semibold text-foreground">
                  Status history
                </h2>
                <ol className="mt-3 space-y-3">
                  {activeOrder.lifecycleAudit.map((entry, index) => (
                    <li
                      key={`${entry.toStatus}-${entry.timestamp}-${index}`}
                      className="border-l-2 border-border pl-3"
                    >
                      <p className="text-sm font-medium text-foreground">
                        {formatOrderStatus(entry.toStatus)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatOrderDateTime(entry.timestamp)}
                      </p>
                      {entry.notes ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {entry.notes}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>

          <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
            <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Order total
              </p>
              <p className="mt-1 text-3xl font-semibold tracking-tight text-primary">
                {formatOrderMoney(pricing.totalAmount, pricing.currency)}
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {activeOrder.orderNumber}
              </p>
              <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
                {pricing.basePrice != null ? (
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Base</span>
                    <span className="font-medium">
                      {formatOrderMoney(pricing.basePrice, pricing.currency)}
                    </span>
                  </div>
                ) : null}
                {pricing.taxAmount != null ? (
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">
                      Tax{taxPercent ? ` (${taxPercent})` : ""}
                    </span>
                    <span className="font-medium">
                      {formatOrderMoney(pricing.taxAmount, pricing.currency)}
                    </span>
                  </div>
                ) : null}
                {pricing.platformFee != null && pricing.platformFee > 0 ? (
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Platform fee</span>
                    <span className="font-medium">
                      {formatOrderMoney(pricing.platformFee, pricing.currency)}
                    </span>
                  </div>
                ) : null}
                {activeOrder.payment?.status ? (
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Payment</span>
                    <span className="font-medium">
                      {formatPaymentStatus(activeOrder.payment.status)}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            <SideCard title="Timing">
              <MetaRow
                icon={<CalendarDays className="size-3.5" />}
                label="Appointment"
                value={formatOrderWindow(
                  activeOrder.booking?.startTime,
                  activeOrder.booking?.endTime,
                )}
              />
              <MetaRow
                label="Requested"
                value={
                  activeOrder.createdAt
                    ? formatOrderDateTime(activeOrder.createdAt)
                    : null
                }
              />
              <MetaRow
                label="Duration"
                value={
                  activeOrder.booking?.duration != null
                    ? `${activeOrder.booking.duration} min`
                    : null
                }
              />
            </SideCard>

            {provider ? (
              <SideCard title="Provider" className="animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
                <div className="flex items-start gap-3">
                  <div className="relative size-12 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
                    {provider.avatarUrl ? (
                      <Image
                        src={provider.avatarUrl}
                        alt=""
                        fill
                        sizes="48px"
                        className="object-cover"
                        unoptimized={provider.avatarUrl.startsWith("http")}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <Building2 className="size-4 opacity-60" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="font-semibold capitalize text-foreground">
                      {provider.companyName}
                    </p>
                    {provider.phone ? (
                      <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Phone className="size-3.5" />
                        {provider.phone}
                      </p>
                    ) : null}
                  </div>
                </div>
                {websiteUrl ? (
                  <a
                    href={websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-2 hover:underline"
                  >
                    <Globe className="size-3.5" />
                    Visit website
                    <ExternalLink className="size-3" />
                  </a>
                ) : null}
              </SideCard>
            ) : null}

            <SideCard title="Service location">
              <MetaRow
                icon={<MapPin className="size-3.5" />}
                label="Address"
                value={addressLine || null}
              />
              <MetaRow label="Access notes" value={activeOrder.address?.notes} />
              <MetaRow label="Notes for pro" value={activeOrder.customerNotes} />
            </SideCard>

            {activeOrder.changeOrders.length > 0 ? (
              <SideCard title="Change orders">
                {activeOrder.changeOrders.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-border bg-muted/30 p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">
                        {item.description || "Change order"}
                      </p>
                      <Badge variant="outline">
                        {formatOrderStatus(item.status)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm font-semibold">
                      {formatOrderMoney(
                        item.additionalAmount,
                        pricing.currency,
                      )}
                    </p>
                  </div>
                ))}
              </SideCard>
            ) : null}

            {activeOrder.completionDetails?.proofOfWorkImages?.length ? (
              <SideCard title="Proof of work">
                <div className="grid grid-cols-2 gap-2">
                  {activeOrder.completionDetails.proofOfWorkImages.map(
                    (src) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={src}
                        src={src}
                        alt="Proof of work"
                        className="aspect-square w-full rounded-lg border border-border object-cover"
                      />
                    ),
                  )}
                </div>
              </SideCard>
            ) : null}
          </aside>
        </div>
      </Container>
    </Section>
  );
}
