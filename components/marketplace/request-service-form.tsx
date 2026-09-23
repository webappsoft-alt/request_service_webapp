"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, Wrench } from "lucide-react";
import { toast } from "sonner";
import {
  AddressAutocomplete,
  type PlaceAddress,
} from "@/components/shared/address-autocomplete";
import { AuthPhoneInput } from "@/components/auth/auth-phone-input";
import { PhoneOtpVerificationPanel } from "@/components/marketplace/phone-otp-verification-panel";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { CenteredSpinner } from "@/components/ui/spinner";
import { writeChatGuest } from "@/lib/booking/chat-store";
import { openPublicChatThread } from "@/lib/api/chat-client";
import { getData, postData } from "@/components/api/apiFuntions";
import { authApi, publicApi } from "@/components/api/ApiRoutesFile";
import { createFixedServiceBooking } from "@/lib/booking/create-fixed-booking";
import { createMarketplaceQuote } from "@/lib/booking/create-marketplace-quote";
import { createWebsiteLead } from "@/lib/booking/create-website-lead";
import {
  clearPendingQuote,
  formatIntakeQuote,
  readPendingQuote,
} from "@/lib/booking/format-quote-answers";
import { findPublicFixedService } from "@/lib/booking/public-services";
import { getJobRecord } from "@/lib/data/jobs";
import { getProviderBySlug } from "@/lib/data/providers";
import { serviceCategories } from "@/lib/data/services";
import { serviceUnitLabel } from "@/lib/data/portal";
import { formatStartingPrice, formatTime, isValidZip } from "@/lib/format";
import { serviceAccents, serviceIcons } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAuthUser } from "@/store/authSlice";
import {
  fetchPublicProfessionalBySlug,
  publicProfessionalToProvider,
  type PublicProfessional,
} from "@/store/publicProfessionalsSlice";
import type { Provider, ServiceCategorySlug } from "@/lib/types";

const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

function phoneDigits(value: string) {
  return String(value || "").replace(/\D/g, "");
}

function composedFullName(firstName: string, lastName: string) {
  return [firstName, lastName]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

async function resolveLiveFixedServicePath(serviceId: string) {
  const response = await getData(publicApi.fixedService(serviceId), undefined, {
    token: null,
    silent: true,
    skipLogoutOn401: true,
  });
  const root = asRecord(response) ?? {};
  const data = asRecord(root.data) ?? root;
  const slug = typeof data.slug === "string" ? data.slug.trim() : "";
  const category = asRecord(data.category);
  const categorySlug =
    typeof category?.slug === "string" ? category.slug.trim() : "";
  if (!slug || !categorySlug) return null;
  return `/services/${categorySlug}/${slug}`;
}

function hasUsableBookingAddress(input: {
  street: string;
  zip: string;
  lat: number | null;
  lng: number | null;
}) {
  const hasCoords =
    input.lat != null &&
    input.lng != null &&
    Number.isFinite(input.lat) &&
    Number.isFinite(input.lng);
  const hasStreetZip = Boolean(input.street.trim() && input.zip.trim());
  return hasCoords || hasStreetZip;
}

type BookingServiceOption = {
  id: string;
  label: string;
  slug: string;
  categorySlug: string;
  categoryId: string;
  serviceName: string;
  description: string;
  price: number;
  unit: string;
  image?: string;
};

function bookingServiceOptions(
  professional: PublicProfessional | null,
  fallbackLabels: string[] = [],
): BookingServiceOption[] {
  const primarySlug = professional?.tradeDetails.primaryCategory?.slug || "";
  const primaryId = professional?.tradeDetails.primaryCategory?.id || "";
  const services = professional?.activeServices ?? [];
  if (services.length) {
    return services.map((item) => {
      const name = item.servicesName || item.slug || "Service";
      const bullets = (item.commonServices ?? [])
        .map((entry) => entry.trim())
        .filter(Boolean);
      return {
        id: item.id,
        label: name,
        slug: item.slug || item.id,
        categorySlug: item.category?.slug || primarySlug,
        categoryId: item.category?.id || primaryId,
        serviceName: name,
        description:
          bullets.slice(0, 2).join(" · ") ||
          `${name} from this professional.`,
        price: item.price || 0,
        unit: item.unit || "job",
        image: item.images?.[0],
      };
    });
  }
  const specialties = (professional?.tradeDetails.specialties ?? [])
    .map((item) => item.trim())
    .filter(Boolean);
  if (specialties.length) {
    return specialties.map((label, index) => ({
      id: `specialty-${index}`,
      label,
      slug: primarySlug || "service",
      categorySlug: primarySlug,
      categoryId: primaryId,
      serviceName: label,
      description: `Request ${label.toLowerCase()} from this professional.`,
      price: 0,
      unit: "job",
    }));
  }
  const primary = professional?.tradeDetails.primaryCategory;
  if (primary?.name) {
    return [
      {
        id: primary.id || "primary",
        label: primary.name,
        slug: primary.slug || "service",
        categorySlug: primary.slug || "",
        categoryId: primary.id || "",
        serviceName: primary.name,
        description: `Request ${primary.name.toLowerCase()} from this professional.`,
        price: 0,
        unit: "job",
      },
    ];
  }
  return fallbackLabels
    .map((label) => label.trim())
    .filter(Boolean)
    .map((label, index) => ({
      id: `label-${index}`,
      label,
      slug: "service",
      categorySlug: "",
      categoryId: "",
      serviceName: label,
      description: `Request ${label.toLowerCase()} from this professional.`,
      price: 0,
      unit: "job",
    }));
}

function resolveServiceIcon(categorySlug: string) {
  const key = categorySlug as ServiceCategorySlug;
  return serviceIcons[key] || Wrench;
}

function resolveServiceAccent(categorySlug: string) {
  const key = categorySlug as ServiceCategorySlug;
  return serviceAccents[key] || "bg-[#003F7D]/10 text-[#003F7D]";
}

function ProviderServiceScroller({
  companyName,
  serviceOptions,
  selectedServiceId,
  onSelectService,
}: {
  companyName: string;
  serviceOptions: BookingServiceOption[];
  selectedServiceId: string;
  onSelectService: (id: string) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  function syncScrollButtons() {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanPrev(el.scrollLeft > 8);
    setCanNext(max > 8 && el.scrollLeft < max - 8);
  }

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    syncScrollButtons();
    el.addEventListener("scroll", syncScrollButtons, { passive: true });
    window.addEventListener("resize", syncScrollButtons);
    return () => {
      el.removeEventListener("scroll", syncScrollButtons);
      window.removeEventListener("resize", syncScrollButtons);
    };
  }, [serviceOptions.length]);

  function scrollByCard(direction: -1 | 1) {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-service-card]");
    const amount = card
      ? card.getBoundingClientRect().width + 16
      : el.clientWidth * 0.8;
    el.scrollBy({ left: direction * amount, behavior: "smooth" });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-[#003F7D]">
            Select a service for booking
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Only services offered by {companyName}. Scroll left to right.
          </p>
        </div>
        {serviceOptions.length > 1 ? (
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
        ) : null}
      </div>

      {serviceOptions.length ? (
        <div
          ref={scrollerRef}
          className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2"
          role="list"
          aria-label={`${companyName} services`}
        >
          {serviceOptions.map((item) => {
            const Icon = resolveServiceIcon(item.categorySlug);
            const accent = resolveServiceAccent(item.categorySlug);
            const selected = selectedServiceId === item.id;
            return (
              <article
                key={item.id}
                data-service-card
                role="listitem"
                className={cn(
                  "flex w-[min(16.5rem,78vw)] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-all duration-200",
                  selected
                    ? "border-[#003F7D] ring-2 ring-[#003F7D]/25"
                    : "border-black/10 hover:border-[#003F7D]/30",
                )}
              >
                <div
                  className={cn(
                    "relative flex h-28 items-center justify-center",
                    item.image ? "bg-[#003F7D]/5" : accent,
                  )}
                >
                  {item.image ? (
                    <Image
                      src={item.image}
                      alt={item.label}
                      fill
                      sizes="280px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="flex size-14 items-center justify-center rounded-full bg-white/80 shadow-sm">
                      <Icon className="size-7 text-[#003F7D]" aria-hidden="true" />
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2.5 p-4">
                  <div>
                    <h4 className="line-clamp-2 text-base font-semibold leading-snug text-[#003F7D]">
                      {item.label}
                    </h4>
                    <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                  {item.price > 0 ? (
                    <p className="text-sm font-semibold text-[#003F7D]">
                      {formatStartingPrice(item.price)}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        {item.unit === "hour"
                          ? "per hour"
                          : item.unit === "visit"
                            ? "per visit"
                            : "per job"}
                      </span>
                    </p>
                  ) : (
                    <p className="text-sm font-medium text-muted-foreground">
                      Quote on request
                    </p>
                  )}
                  <Button
                    type="button"
                    variant={selected ? "default" : "outline"}
                    className="mt-auto w-full"
                    onClick={() => onSelectService(item.id)}
                  >
                    {selected ? "Selected" : "Book Now"}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          This professional has not published bookable services yet. You can
          still message them from their profile.
        </p>
      )}
    </div>
  );
}

export function RequestServiceForm({
  initial = {},
}: {
  initial?: {
    service?: string;
    job?: string;
    provider?: string;
    serviceId?: string;
    intent?: string;
    date?: string;
    time?: string;
  };
}) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const authUser = useAppSelector(selectAuthUser);
  const professionalDetail = useAppSelector(
    (state) => state.publicProfessionals?.detail ?? null,
  );
  const detailLoading = useAppSelector(
    (state) => state.publicProfessionals?.detailLoading ?? false,
  );
  const searchParams = useSearchParams();
  const defaultService = searchParams.get("service") || initial.service || "";
  const defaultJob = searchParams.get("job") || initial.job || "";
  const defaultProvider =
    searchParams.get("provider") || initial.provider || "";
  const serviceId = searchParams.get("serviceId") || initial.serviceId || "";
  const intent =
    searchParams.get("intent") === "book" ||
    initial.intent === "book" ||
    Boolean(serviceId)
      ? "book"
      : "request";

  const seededProvider = defaultProvider
    ? getProviderBySlug(defaultProvider)
    : undefined;
  const isProviderBooking =
    Boolean(defaultProvider) && intent !== "book" && !serviceId;

  const liveProfessional =
    isProviderBooking &&
    professionalDetail &&
    (professionalDetail.slug === defaultProvider ||
      professionalDetail.id === defaultProvider)
      ? professionalDetail
      : null;

  const liveProvider: Provider | undefined = liveProfessional
    ? publicProfessionalToProvider(liveProfessional)
    : undefined;
  const provider = liveProvider || seededProvider;

  const jobRecord =
    defaultService && defaultJob
      ? getJobRecord(defaultService, defaultJob)
      : undefined;
  const fixedService =
    provider && serviceId
      ? findPublicFixedService(provider, serviceId)
      : undefined;
  const isFixedBooking = Boolean(provider && fixedService && intent === "book");

  const serviceOptions = useMemo(
    () =>
      bookingServiceOptions(
        liveProfessional,
        provider?.serviceLabels ?? [],
      ),
    [liveProfessional, provider?.serviceLabels],
  );

  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [service, setService] = useState(
    fixedService?.categoryName ? defaultService || "" : defaultService,
  );
  const [zip, setZip] = useState(provider?.zip ?? "");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [addressInput, setAddressInput] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [showPhoneVerify, setShowPhoneVerify] = useState(false);
  const [pendingAfterVerify, setPendingAfterVerify] = useState<
    "booking" | "marketplace" | null
  >(null);
  const [details, setDetails] = useState(
    fixedService
      ? `${fixedService.name}. ${fixedService.description}`
      : jobRecord
        ? `${jobRecord.job}. ${jobRecord.detail.description}`
        : "",
  );
  const bookedTime = searchParams.get("time") || initial.time || "";
  const [preferredDate, setPreferredDate] = useState(
    searchParams.get("date") || initial.date || "",
  );
  const [preferredTime, setPreferredTime] = useState(bookedTime);
  const [submitting, setSubmitting] = useState(false);
  const [providerLoadError, setProviderLoadError] = useState<string | null>(
    null,
  );
  const [confirmation, setConfirmation] = useState<
    | { kind: "job"; jobNumber: string; serviceName: string }
    | { kind: "lead"; requestNumber: string; serviceName: string }
    | {
        kind: "marketplace";
        requestNumber: string;
        serviceName: string;
        count: number;
      }
    | { kind: "booking"; requestNumber: string; serviceName: string }
    | null
  >(null);

  useEffect(() => {
    if (!isProviderBooking || !defaultProvider) return;
    let cancelled = false;
    setProviderLoadError(null);
    void dispatch(fetchPublicProfessionalBySlug(defaultProvider))
      .unwrap()
      .catch((error: unknown) => {
        if (cancelled) return;
        setProviderLoadError(
          typeof error === "string"
            ? error
            : "Could not load this professional.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [defaultProvider, dispatch, isProviderBooking]);

  useEffect(() => {
    if (!authUser) return;
    setFirstName((current) => current || String(authUser.firstName || ""));
    setLastName((current) => current || String(authUser.lastName || ""));
    setEmail((current) => current || String(authUser.email || ""));
    setPhone((current) => current || String(authUser.phone || ""));
  }, [authUser]);

  const fullName = composedFullName(firstName, lastName);

  const selectedBookingService = serviceOptions.find(
    (item) => item.id === selectedServiceId,
  );

  const heading = useMemo(() => {
    if (isProviderBooking && provider)
      return `Request ${provider.companyName}`;
    if (fixedService && provider) return `Book ${fixedService.name}`;
    if (provider && intent === "book") return `Book ${provider.companyName}`;
    if (provider) return `Request ${provider.companyName}`;
    if (jobRecord) return `Request ${jobRecord.job}`;
    return "Submit a marketplace request";
  }, [fixedService, intent, isProviderBooking, jobRecord, provider]);

  function applyPlace(address: PlaceAddress) {
    setStreet(address.streetAddress || address.formattedAddress || "");
    setCity(address.city || "");
    setState(address.state || "");
    setZip(address.zipCode || zip);
    setLat(
      typeof address.latitude === "number" && Number.isFinite(address.latitude)
        ? address.latitude
        : null,
    );
    setLng(
      typeof address.longitude === "number" &&
        Number.isFinite(address.longitude)
        ? address.longitude
        : null,
    );
    setAddressInput(
      address.formattedAddress ||
        [address.streetAddress, address.city, address.state, address.zipCode]
          .filter(Boolean)
          .join(", "),
    );
  }

  async function startPhoneVerification(
    next: "booking" | "marketplace",
  ): Promise<boolean> {
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();
    if (phoneDigits(trimmedPhone).length < 8) {
      toast.error("Enter a valid phone number.");
      return false;
    }
    if (!trimmedEmail) {
      toast.error("Enter your email so we can send the verification code.");
      return false;
    }
    setOtpSending(true);
    try {
      const response = await postData<{ message?: string }>(
        authApi.sendPhoneOtp,
        { phone: trimmedPhone, email: trimmedEmail },
        { token: null, skipLogoutOn401: true, silent: true },
      );
      toast.success(
        response?.message ||
          "Verification code sent. Check your email.",
      );
      setPendingAfterVerify(next);
      setShowPhoneVerify(true);
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not send verification code.",
      );
      return false;
    } finally {
      setOtpSending(false);
    }
  }

  async function submitProviderBooking() {
    if (!provider || !defaultProvider) {
      toast.error("This professional could not be loaded. Open their profile and try again.");
      return;
    }
    if (!selectedBookingService) {
      toast.error("Select a service for booking.");
      return;
    }
    if (!preferredDate) {
      toast.error("Choose a preferred date.");
      return;
    }
    if (!preferredTime) {
      toast.error("Choose a preferred time.");
      return;
    }
    if (
      !hasUsableBookingAddress({
        street,
        zip,
        lat,
        lng,
      })
    ) {
      toast.error(
        "Pick a service address from the suggestions so we can match your location.",
      );
      return;
    }
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      toast.error("Add your first name, last name, and email.");
      return;
    }
    if (!phone.trim()) {
      toast.error("Add your phone number.");
      return;
    }
    if (!details.trim()) {
      toast.error("Add a few details about the work.");
      return;
    }
    const hasCoords =
      lat != null &&
      lng != null &&
      Number.isFinite(lat) &&
      Number.isFinite(lng);
    if (!hasCoords && zip && !isValidZip(zip)) {
      toast.error("Enter a valid ZIP code or pick an address suggestion.");
      return;
    }

    setSubmitting(true);
    try {
      const serviceName = selectedBookingService.serviceName;
      const serviceSlug =
        selectedBookingService.categorySlug ||
        selectedBookingService.slug ||
        "service";
      const detailsText = [
        `Booking request for ${serviceName}.`,
        details.trim() || "",
        preferredDate ? `Preferred date: ${preferredDate}.` : "",
        preferredTime ? `Preferred time: ${preferredTime}.` : "",
        street ? `Address: ${street}.` : "",
      ]
        .filter(Boolean)
        .join(" ");

      const result = await createMarketplaceQuote({
        name: fullName,
        email,
        phone,
        zip: zip.trim() || provider.zip || "",
        street,
        city: city || provider.city,
        state: state || provider.state,
        lat: lat ?? undefined,
        lng: lng ?? undefined,
        serviceSlug,
        serviceName,
        categoryId: selectedBookingService.categoryId || undefined,
        details: detailsText,
        preferredDate,
        preferredTime,
        provider,
        answers: [
          { id: "booking_service", label: "Service", value: serviceName },
          {
            id: "booking_date",
            label: "Preferred date",
            value: preferredDate,
          },
          {
            id: "booking_time",
            label: "Preferred time",
            value: preferredTime,
          },
          ...(details.trim()
            ? [{ id: "booking_details", label: "Details", value: details.trim() }]
            : []),
        ],
      });

      if (!result.requests.length) {
        toast.error(
          "Could not create the booking request for this professional.",
        );
        return;
      }

      const request = result.requests[0];
      writeChatGuest({ name: fullName.trim(), email: email.trim() });
      try {
        const liveProviderId = OBJECT_ID_REGEX.test(request.providerId ?? "")
          ? request.providerId
          : OBJECT_ID_REGEX.test(provider.id)
            ? provider.id
            : undefined;
        await openPublicChatThread({
          providerId: liveProviderId,
          providerSlug: provider.slug,
          customerName: fullName.trim(),
          customerEmail: email.trim(),
          phone: phone.trim(),
          zip: zip.trim(),
          city: city || provider.city,
          state: state || provider.state,
          street: street.trim(),
          requestId: request.id,
          text: detailsText,
        });
      } catch {
        // Booking still succeeded if chat fails.
      }

      setConfirmation({
        kind: "booking",
        requestNumber: result.requestNumber || request.number || "",
        serviceName,
      });
      toast.success(
        `${result.requestNumber || request.number} was sent to ${provider.companyName}.`,
      );
      setShowPhoneVerify(false);
      setPendingAfterVerify(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to send the booking request.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function submitMarketplaceQuote() {
    if (!service) {
      toast.error("Choose a service category.");
      return;
    }
    if (!isValidZip(zip)) {
      toast.error("Enter a valid 5-digit ZIP code.");
      return;
    }
    const category = serviceCategories.find((item) => item.slug === service);
    const pending = readPendingQuote();
    const formatted = pending
      ? formatIntakeQuote({
          ...pending,
          zip,
          name: fullName,
          email,
          phone,
          details,
        })
      : undefined;
    const serviceName =
      jobRecord?.job ||
      formatted?.serviceName ||
      category?.name ||
      "Service request";
    const requestDetails = formatted?.details || details;
    const answers = formatted?.answers;

    setSubmitting(true);
    try {
      const result = await createMarketplaceQuote({
        name: fullName,
        email,
        phone,
        zip,
        serviceSlug: service,
        serviceName,
        details: requestDetails,
        answers,
        preferredDate,
        preferredTime: preferredTime || formatted?.preferredTime,
      });
      if (!result.requests.length) {
        toast.error(
          "No matching companies for that ZIP yet. Try another area or pick a professional.",
        );
        return;
      }
      const requestNumber =
        result.requestNumber || result.requests[0]?.number || "";
      const providerCount = result.count || result.requests.length;
      clearPendingQuote();
      setShowPhoneVerify(false);
      setPendingAfterVerify(null);
      setConfirmation({
        kind: "marketplace",
        requestNumber,
        serviceName,
        count: providerCount,
      });
      toast.success(
        `${requestNumber} was sent to ${providerCount} matching ${providerCount === 1 ? "company" : "companies"}.`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to send the quote request.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isProviderBooking) {
      if (!provider || !defaultProvider) {
        toast.error(
          "This professional could not be loaded. Open their profile and try again.",
        );
        return;
      }
      if (!selectedBookingService) {
        toast.error("Select a service for booking.");
        return;
      }
      if (!preferredDate || !preferredTime) {
        toast.error("Choose a preferred date and time.");
        return;
      }
      if (
        !hasUsableBookingAddress({
          street,
          zip,
          lat,
          lng,
        })
      ) {
        toast.error(
          "Pick a service address from the suggestions so we can match your location.",
        );
        return;
      }
      if (!firstName.trim() || !lastName.trim() || !email.trim()) {
        toast.error("Add your first name, last name, and email.");
        return;
      }
      if (phoneDigits(phone).length < 8) {
        toast.error("Add your phone number.");
        return;
      }
      if (!details.trim()) {
        toast.error("Add a few details about the work.");
        return;
      }
      await startPhoneVerification("booking");
      return;
    }

    if (isFixedBooking && provider && fixedService) {
      if (
        OBJECT_ID_REGEX.test(fixedService.id) ||
        OBJECT_ID_REGEX.test(serviceId)
      ) {
        try {
          const path = await resolveLiveFixedServicePath(
            fixedService.id || serviceId,
          );
          if (path) {
            const next = new URLSearchParams({ book: "1" });
            if (preferredDate) next.set("date", preferredDate);
            if (preferredTime) next.set("time", preferredTime);
            router.push(`${path}?${next.toString()}`);
            return;
          }
        } catch {
          // fall through
        }
        toast.error(
          "Open this service from the provider profile to complete live checkout.",
        );
        return;
      }
      if (!firstName.trim() || !lastName.trim() || !email.trim()) {
        toast.error("Add your first name, last name, and email.");
        return;
      }
      if (!isValidZip(zip)) {
        toast.error("Enter a valid 5-digit ZIP code.");
        return;
      }
      if (!street.trim()) {
        toast.error("Add the job street address.");
        return;
      }
      const { job } = createFixedServiceBooking({
        provider,
        service: fixedService,
        name: fullName,
        email,
        phone,
        street,
        zip,
        details,
        preferredDate,
        preferredTime,
      });
      setConfirmation({
        kind: "job",
        jobNumber: job.number,
        serviceName: fixedService.name,
      });
      toast.success(
        `${job.number} is on the ${provider.companyName} job board. No estimate — work can start.`,
      );
      return;
    }
    if (!service) {
      toast.error("Choose a service category.");
      return;
    }
    if (!isValidZip(zip)) {
      toast.error("Enter a valid 5-digit ZIP code.");
      return;
    }
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      toast.error("Add your first name, last name, and email.");
      return;
    }
    if (phoneDigits(phone).length < 8) {
      toast.error("Add your phone number.");
      return;
    }
    const category = serviceCategories.find((item) => item.slug === service);
    const pending = readPendingQuote();
    const formatted = pending
      ? formatIntakeQuote({ ...pending, zip, name: fullName, email, phone, details })
      : undefined;
    const serviceName =
      jobRecord?.job ||
      formatted?.serviceName ||
      category?.name ||
      "Service request";
    const requestDetails = formatted?.details || details;
    const answers = formatted?.answers;
    if (!provider) {
      await startPhoneVerification("marketplace");
      return;
    }
    let request;
    try {
      const result = await createWebsiteLead({
        provider,
        name: fullName,
        email,
        phone,
        zip,
        details: requestDetails,
        serviceSlug: service,
        serviceName,
        preferredDate,
        preferredTime: preferredTime || formatted?.preferredTime,
        answers,
      });
      request = result.request;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to send the request.",
      );
      return;
    }
    writeChatGuest({ name: fullName.trim(), email: email.trim() });
    try {
      const liveProviderId = OBJECT_ID_REGEX.test(request.providerId ?? "")
        ? request.providerId
        : undefined;
      await openPublicChatThread({
        providerId: liveProviderId,
        providerSlug: provider.slug,
        customerName: fullName.trim(),
        customerEmail: email.trim(),
        phone: phone.trim(),
        zip: zip.trim(),
        city: provider.city,
        state: provider.state,
        street: street.trim(),
        requestId: request.id,
        text: details.trim() || `Requested ${request.serviceName}.`,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The request was sent, but the chat thread could not be opened.",
      );
    }
    clearPendingQuote();
    setConfirmation({
      kind: "lead",
      requestNumber: request.number,
      serviceName: request.serviceName,
    });
    toast.success(
      `${request.number} is in the ${provider.companyName} inbox. They can send a written estimate.`,
    );
  }

  if (showPhoneVerify) {
    return (
      <PhoneOtpVerificationPanel
        phone={phone.trim()}
        email={email.trim()}
        onBack={() => {
          setShowPhoneVerify(false);
          setPendingAfterVerify(null);
        }}
        onVerified={async () => {
          if (pendingAfterVerify === "booking") {
            await submitProviderBooking();
            return;
          }
          if (pendingAfterVerify === "marketplace") {
            await submitMarketplaceQuote();
          }
        }}
      />
    );
  }

  if (confirmation && provider && confirmation.kind === "job") {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold">Booking confirmed</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          {confirmation.serviceName} is now job {confirmation.jobNumber} at{" "}
          {provider.companyName}. This is a priced fixed service, so it skipped
          the estimate pipeline and opened as field work.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={`/professionals/${provider.slug}`}>
              Back to {provider.companyName}
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/pro/dashboard/jobs">Open jobs in the portal</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (confirmation && confirmation.kind === "marketplace") {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold">Quote request sent</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          {confirmation.serviceName} is lead {confirmation.requestNumber} for{" "}
          {confirmation.count} matching{" "}
          {confirmation.count === 1 ? "company" : "companies"}. They can open
          the lead, review your answers, and send a written estimate.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/find-a-professional">See matching professionals</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (confirmation && provider && confirmation.kind === "booking") {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold">Booking request sent</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          {confirmation.serviceName} is request {confirmation.requestNumber} at{" "}
          {provider.companyName}. They can review your preferred date, time, and
          address, then follow up from Messages.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={`/professionals/${provider.slug}`}>
              Back to {provider.companyName}
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/account/dashboard/estimates?tab=requests">
              View my requests
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (confirmation && provider && confirmation.kind === "lead") {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold">Request sent</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          {confirmation.serviceName} is lead {confirmation.requestNumber} at{" "}
          {provider.companyName}. They were notified and can discuss the work
          from Messages, then send an estimate if needed.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={`/professionals/${provider.slug}`}>
              Chat with {provider.companyName}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (isProviderBooking && detailLoading && !liveProfessional) {
    return <CenteredSpinner label="Loading this professional…" />;
  }

  if (isProviderBooking && providerLoadError && !liveProfessional && !seededProvider) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold">Professional not found</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          {providerLoadError} Open their profile from Find a Professional and
          try Request service again.
        </p>
        <Button asChild>
          <Link href="/find-a-professional">Find a professional</Link>
        </Button>
      </div>
    );
  }

  // Provider-scoped booking form (Request service from a specific pro).
  if (isProviderBooking && provider) {
    const showBookingForm = Boolean(selectedBookingService);

    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-2xl font-semibold">{heading}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Swipe services left to right, tap Book Now, then complete the form
            below.
          </p>
        </div>

        <ProviderServiceScroller
          companyName={provider.companyName}
          serviceOptions={serviceOptions}
          selectedServiceId={selectedServiceId}
          onSelectService={setSelectedServiceId}
        />

        {showBookingForm ? (
          <form
            onSubmit={onSubmit}
            className="flex flex-col gap-6 border-t border-black/10 pt-6"
          >
            <div className="rounded-xl border border-[#003F7D]/15 bg-[#003F7D]/5 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-[#003F7D]/80">
                    Selected service
                  </p>
                  <p className="mt-1 text-base font-semibold text-[#003F7D]">
                    {selectedBookingService?.serviceName}
                  </p>
                  {selectedBookingService &&
                  selectedBookingService.price > 0 ? (
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {formatStartingPrice(selectedBookingService.price)}{" "}
                      {selectedBookingService.unit === "hour"
                        ? "per hour"
                        : selectedBookingService.unit === "visit"
                          ? "per visit"
                          : "per job"}
                    </p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 gap-1.5 text-[#003F7D]"
                  onClick={() => setSelectedServiceId("")}
                >
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  Change service
                </Button>
              </div>
            </div>

            <FieldGroup>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="booking-date">Preferred date</FieldLabel>
                  <Input
                    id="booking-date"
                    type="date"
                    value={preferredDate}
                    onChange={(event) => setPreferredDate(event.target.value)}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="booking-time">Preferred time</FieldLabel>
                  <NativeSelect
                    id="booking-time"
                    value={preferredTime}
                    onChange={(event) => setPreferredTime(event.target.value)}
                    className="w-full"
                    required
                  >
                    <NativeSelectOption value="">
                      Select a time
                    </NativeSelectOption>
                    {bookedTime &&
                    !["morning", "afternoon", "evening", "any"].includes(
                      bookedTime,
                    ) ? (
                      <NativeSelectOption value={bookedTime}>
                        {formatTime(bookedTime)}
                      </NativeSelectOption>
                    ) : null}
                    <NativeSelectOption value="any">Any time</NativeSelectOption>
                    <NativeSelectOption value="morning">
                      Morning
                    </NativeSelectOption>
                    <NativeSelectOption value="afternoon">
                      Afternoon
                    </NativeSelectOption>
                    <NativeSelectOption value="evening">
                      Evening
                    </NativeSelectOption>
                  </NativeSelect>
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="booking-address">
                  Location / address
                </FieldLabel>
                <AddressAutocomplete
                  id="booking-address"
                  value={addressInput}
                  onChange={setAddressInput}
                  onSelect={applyPlace}
                  placeholder="Start typing street address…"
                  required
                />
                {street || city || zip ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {[street, city, state, zip].filter(Boolean).join(", ")}
                  </p>
                ) : (
                  <FieldDescription>
                    Pick an address from the suggestions so location matching
                    stays accurate.
                  </FieldDescription>
                )}
              </Field>

              <Field>
                <FieldLabel htmlFor="booking-details">Details</FieldLabel>
                <Textarea
                  id="booking-details"
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                  placeholder="Describe the work, access notes, and anything this professional should know."
                  rows={4}
                  required
                />
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="booking-first-name">First name</FieldLabel>
                  <Input
                    id="booking-first-name"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    autoComplete="given-name"
                    placeholder="Jordan"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="booking-last-name">Last name</FieldLabel>
                  <Input
                    id="booking-last-name"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    autoComplete="family-name"
                    placeholder="Lee"
                    required
                  />
                </Field>
                <Field className="sm:col-span-2">
                  <FieldLabel htmlFor="booking-email">Email</FieldLabel>
                  <Input
                    id="booking-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    placeholder="you@email.com"
                    required
                  />
                </Field>
                <Field className="sm:col-span-2">
                  <FieldLabel htmlFor="booking-phone">Phone</FieldLabel>
                  <AuthPhoneInput
                    id="booking-phone"
                    value={phone}
                    onChange={setPhone}
                    placeholder="(512) 555-0182"
                    required
                  />
                </Field>
              </div>
            </FieldGroup>

            <Button
              type="submit"
              size="xl"
              disabled={submitting || otpSending}
            >
              {otpSending
                ? "Sending code…"
                : submitting
                  ? "Sending…"
                  : "Send Booking"}
            </Button>
          </form>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold">{heading}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {isFixedBooking && fixedService
            ? `${formatStartingPrice(fixedService.price)} ${serviceUnitLabel(fixedService.unit)}. Booking this service creates a job immediately — ${provider?.companyName} does not write an estimate first.`
            : provider
              ? "This is a direct provider request. It will be routed to this company rather than the open marketplace."
              : jobRecord
                ? `This request starts with ${jobRecord.job}. Add your ZIP and any notes so local ${jobRecord.category.name.toLowerCase()} pros can send a written estimate.`
                : "Matching companies in your ZIP receive this request. They review your answers and send a written estimate."}
        </p>
      </div>
      <FieldGroup>
        {isFixedBooking && fixedService ? (
          <Field>
            <FieldLabel>Fixed service</FieldLabel>
            <Input
              value={`${fixedService.name} · ${fixedService.categoryName}`}
              readOnly
            />
          </Field>
        ) : (
          <Field>
            <FieldLabel htmlFor="request-service">Service category</FieldLabel>
            <NativeSelect
              id="request-service"
              value={service}
              onChange={(event) => setService(event.target.value)}
              className="w-full"
              required
            >
              <NativeSelectOption value="">Select a service</NativeSelectOption>
              {serviceCategories.map((category) => (
                <NativeSelectOption key={category.id} value={category.slug}>
                  {category.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        )}
        {isFixedBooking ? (
          <Field>
            <FieldLabel htmlFor="request-street">Job address</FieldLabel>
            <Input
              id="request-street"
              value={street}
              onChange={(event) => setStreet(event.target.value)}
              autoComplete="street-address"
              placeholder="312 Congress Avenue"
              required
            />
          </Field>
        ) : null}
        <Field>
          <FieldLabel htmlFor="request-zip">ZIP code</FieldLabel>
          <Input
            id="request-zip"
            value={zip}
            onChange={(event) => setZip(event.target.value)}
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="78701"
            required
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="request-date">Preferred date</FieldLabel>
            <Input
              id="request-date"
              type="date"
              value={preferredDate}
              onChange={(event) => setPreferredDate(event.target.value)}
              required={isFixedBooking}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="request-time">Preferred time</FieldLabel>
            <NativeSelect
              id="request-time"
              value={preferredTime}
              onChange={(event) => setPreferredTime(event.target.value)}
              className="w-full"
            >
              <NativeSelectOption value="">Any time</NativeSelectOption>
              {bookedTime &&
              !["morning", "afternoon", "evening"].includes(bookedTime) ? (
                <NativeSelectOption value={bookedTime}>
                  {formatTime(bookedTime)}
                </NativeSelectOption>
              ) : null}
              <NativeSelectOption value="morning">Morning</NativeSelectOption>
              <NativeSelectOption value="afternoon">Afternoon</NativeSelectOption>
              <NativeSelectOption value="evening">Evening</NativeSelectOption>
            </NativeSelect>
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="request-details">Service details</FieldLabel>
          <Textarea
            id="request-details"
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            placeholder="Describe the work, access notes, and anything a professional should know."
            rows={6}
            required
          />
          <FieldDescription>
            {isFixedBooking
              ? "Access notes help the crew start the job on the booked day."
              : "Photos can be attached when file uploads are connected."}
          </FieldDescription>
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="request-first-name">First name</FieldLabel>
            <Input
              id="request-first-name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              autoComplete="given-name"
              placeholder="Jordan"
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="request-last-name">Last name</FieldLabel>
            <Input
              id="request-last-name"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              autoComplete="family-name"
              placeholder="Lee"
              required
            />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="request-email">Email</FieldLabel>
            <Input
              id="request-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="you@email.com"
              required
            />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="request-phone">Phone</FieldLabel>
            <AuthPhoneInput
              id="request-phone"
              value={phone}
              onChange={setPhone}
              placeholder="(512) 555-0182"
              required
            />
          </Field>
        </div>
      </FieldGroup>
      <Button
        type="submit"
        size="xl"
        disabled={submitting || otpSending}
      >
        {otpSending
          ? "Sending code…"
          : isFixedBooking
            ? "Book this job"
            : provider
              ? "Send request to this provider"
              : "Send quote request"}
      </Button>
    </form>
  );
}
