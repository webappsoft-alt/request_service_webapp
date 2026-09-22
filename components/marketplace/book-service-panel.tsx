"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Image from "next/image";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { FixedServiceOrderDialog } from "@/components/marketplace/fixed-service-order-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { serviceUnitLabel, type PortalFixedService } from "@/lib/data/portal";
import { formatStartingPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Provider } from "@/lib/types";
import {
  type PublicFixedService,
} from "@/store/publicFixedServicesSlice";

type BookServiceContextValue = {
  openBooking: (serviceId?: string) => void;
  /** @deprecated Calendar flow removed — kept for API compatibility. */
  openCalendar: (serviceId?: string) => void;
  calendar: ReactNode;
};

const BookServiceContext = createContext<BookServiceContextValue | null>(null);

type LivePortalFixedService = PortalFixedService & {
  liveCategorySlug?: string;
  liveSlug?: string;
};

export function toPublicFixedService(
  provider: Provider,
  service: LivePortalFixedService,
): PublicFixedService {
  const categorySlug = service.liveCategorySlug?.trim() || "";
  const serviceSlug = service.liveSlug?.trim() || service.id;

  return {
    id: service.id,
    servicesName: service.name,
    slug: serviceSlug,
    category: service.categoryId || service.categoryName
      ? {
          id: service.categoryId || service.categoryName,
          name: service.categoryName || "Service",
          slug: categorySlug,
        }
      : null,
    subcategory: null,
    price: service.price,
    unit: service.unit,
    images: service.images,
    covered: service.coverage,
    commonServices: service.coverage,
    workingArea: service.areaZips,
    availabilityType: service.availabilityMode || "office",
    provider: {
      id: provider.id,
      companyName: provider.companyName,
      slug: provider.slug,
      tagline: provider.tagline,
      avatarUrl: provider.logoUrl,
      coverImage: provider.coverImage,
      rating: {
        average: provider.rating,
        totalReviews: provider.reviewCount,
      },
      location: {
        city: provider.city,
        state: provider.state,
        country: "",
        zip: provider.zip,
        address: provider.street,
        coordinates: [provider.lng, provider.lat],
      },
      profile: {
        yearsInBusiness: provider.yearsInBusiness,
        licensed: provider.licensed,
        insured: provider.insured,
      },
    },
    distanceMiles: null,
  };
}

export function BookServiceProvider({
  provider,
  slug,
  workingHours: _workingHours,
  services = [],
  children,
}: {
  provider: Provider;
  /** @deprecated Prefer `provider.slug` — kept for call-site compatibility. */
  slug?: string;
  /** @deprecated Calendar hours no longer used for this button flow. */
  workingHours?: Provider["workingHours"];
  services?: PortalFixedService[];
  children: ReactNode;
}) {
  void slug;
  void _workingHours;

  const [pickerOpen, setPickerOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bookingService, setBookingService] = useState<PublicFixedService | null>(
    null,
  );
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const activeServices = useMemo(
    () => services.filter((item) => item.active !== false),
    [services],
  );

  const updateScrollState = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) {
      setCanPrev(false);
      setCanNext(false);
      return;
    }
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    if (!pickerOpen) return;
    const el = scrollerRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [pickerOpen, activeServices.length, updateScrollState]);

  function scrollByCard(direction: -1 | 1) {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-service-card]");
    const amount = card ? card.offsetWidth + 16 : el.clientWidth * 0.8;
    el.scrollBy({ left: direction * amount, behavior: "smooth" });
  }

  const startOrder = useCallback(
    (service: PortalFixedService) => {
      const publicService = toPublicFixedService(
        provider,
        service as LivePortalFixedService,
      );
      setBookingService(publicService);
      setPickerOpen(false);
      setOrderOpen(true);
    },
    [provider],
  );

  const openBooking = useCallback(
    (serviceId?: string) => {
      if (serviceId) {
        const match = activeServices.find((item) => item.id === serviceId);
        if (match) {
          startOrder(match);
          return;
        }
      }
      if (activeServices.length === 1) {
        startOrder(activeServices[0]);
        return;
      }
      setSelectedId(activeServices[0]?.id ?? null);
      setPickerOpen(true);
    },
    [activeServices, startOrder],
  );

  const selectedService = activeServices.find((item) => item.id === selectedId);

  const value = useMemo<BookServiceContextValue>(
    () => ({
      openBooking,
      openCalendar: openBooking,
      calendar: null,
    }),
    [openBooking],
  );

  return (
    <BookServiceContext.Provider value={value}>
      {children}

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="flex max-h-[min(90dvh,40rem)] w-[min(100%,42rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-b border-black/10 px-5 py-4 text-left">
            <DialogTitle>Book a service</DialogTitle>
            <DialogDescription>
              Choose a priced service from {provider.companyName}, then complete
              booking on the next step.
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 px-5 py-4">
            {activeServices.length > 1 ? (
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  Swipe or use arrows to browse services
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Previous services"
                    disabled={!canPrev}
                    onClick={() => scrollByCard(-1)}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Next services"
                    disabled={!canNext}
                    onClick={() => scrollByCard(1)}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            ) : null}

            {activeServices.length ? (
              <div
                ref={scrollerRef}
                className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-1"
                role="list"
                aria-label={`${provider.companyName} services`}
              >
                {activeServices.map((service) => {
                  const selected = selectedId === service.id;
                  const photo = service.images[0];
                  return (
                    <article
                      key={service.id}
                      data-service-card
                      role="listitem"
                      className={cn(
                        "flex w-[min(15.5rem,72vw)] shrink-0 snap-start flex-col overflow-hidden rounded-xl border bg-card transition-all duration-200",
                        selected
                          ? "border-[#003F7D] ring-2 ring-[#003F7D]/20"
                          : "border-black/10 hover:border-[#003F7D]/35",
                      )}
                    >
                      <button
                        type="button"
                        className="flex flex-1 flex-col text-left"
                        onClick={() => setSelectedId(service.id)}
                      >
                        <div className="relative aspect-[2/1] bg-[#003F7D]/10">
                          {photo ? (
                            <Image
                              src={photo}
                              alt={service.name}
                              fill
                              sizes="250px"
                              className="object-cover"
                            />
                          ) : null}
                          {service.categoryName ? (
                            <span className="absolute top-2 left-2 rounded-md bg-white/95 px-2 py-0.5 text-[10px] font-semibold text-[#003F7D]">
                              {service.categoryName}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex flex-1 flex-col gap-2 p-3.5">
                          <div>
                            <h4 className="line-clamp-2 text-sm font-semibold text-[#003F7D]">
                              {service.name}
                            </h4>
                            {service.description ? (
                              <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                                {service.description}
                              </p>
                            ) : null}
                          </div>
                          <p className="text-sm font-semibold text-[#003F7D]">
                            {formatStartingPrice(service.price)}{" "}
                            <span className="text-xs font-normal text-muted-foreground">
                              {serviceUnitLabel(service.unit)}
                            </span>
                          </p>
                          {service.coverage?.length ? (
                            <ul className="flex flex-col gap-1">
                              {service.coverage.slice(0, 2).map((item) => (
                                <li
                                  key={item}
                                  className="flex items-start gap-1.5 text-xs text-muted-foreground"
                                >
                                  <Check
                                    className="mt-0.5 size-3 shrink-0 text-[#003F7D]"
                                    aria-hidden="true"
                                  />
                                  <span className="line-clamp-1">{item}</span>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                          <span
                            className={cn(
                              "mt-auto inline-flex h-8 items-center justify-center rounded-md border text-xs font-medium",
                              selected
                                ? "border-[#003F7D] bg-[#003F7D] text-white"
                                : "border-input bg-background text-foreground",
                            )}
                          >
                            {selected ? "Selected" : "Select"}
                          </span>
                        </div>
                      </button>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-black/15 bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                This professional has not published bookable services yet.
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-black/10 px-5 py-3.5">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPickerOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!selectedService}
              onClick={() => {
                if (selectedService) startOrder(selectedService);
              }}
            >
              Continue to booking
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {bookingService ? (
        <FixedServiceOrderDialog
          open={orderOpen}
          onOpenChange={(next) => {
            setOrderOpen(next);
            if (!next) setBookingService(null);
          }}
          service={bookingService}
        />
      ) : null}
    </BookServiceContext.Provider>
  );
}

function useBookService() {
  const context = useContext(BookServiceContext);
  if (!context) {
    throw new Error("Book service controls must be used inside BookServiceProvider.");
  }
  return context;
}

export function BookServiceButton({
  serviceId,
  label = "Book service",
  className,
  size = "xl",
}: {
  serviceId?: string;
  label?: string;
  className?: string;
  size?: "sm" | "xl";
}) {
  const { openBooking } = useBookService();
  return (
    <Button
      variant="outline"
      size={size}
      type="button"
      className={className}
      onClick={() => openBooking(serviceId)}
    >
      {label}
    </Button>
  );
}

/** Calendar inline panel removed — booking uses the modal + order form flow. */
export function BookServiceCalendar() {
  return null;
}
