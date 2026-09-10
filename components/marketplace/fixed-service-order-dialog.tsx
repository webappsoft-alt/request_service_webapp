"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import {
  AddressAutocomplete,
  type PlaceAddress,
} from "@/components/shared/address-autocomplete";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectIsAuthenticated } from "@/store/authSlice";
import {
  checkoutFixedServiceOrder,
  clearAvailability,
  clearCheckoutError,
  clearPendingOrderDraft,
  fetchBookingAvailability,
  setPendingOrderDraft,
} from "@/store/ordersSlice";
import {
  publicFixedServicePath,
  type PublicFixedService,
} from "@/store/publicFixedServicesSlice";
import type { BookingSlot } from "@/lib/types/order-booking";
import {
  clearPendingFixedOrder,
  type PendingFixedOrder,
  type PendingFixedOrderAddress,
  writePendingFixedOrder,
} from "@/lib/booking/pending-fixed-order";
import { formatStartingPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatSlotLabel(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function defaultTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Chicago";
  } catch {
    return "America/Chicago";
  }
}

const emptyAddress: PendingFixedOrderAddress = {
  label: "",
  street: "",
  city: "",
  state: "",
  zip: "",
  unit: "",
  notes: "",
  lat: null,
  lng: null,
};

export function FixedServiceOrderDialog({
  open,
  onOpenChange,
  service,
  initialDraft = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: PublicFixedService;
  /** Restored pending order after login/register. */
  initialDraft?: PendingFixedOrder | null;
}) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const availability = useAppSelector((state) => state.orders.availability);
  const availabilityLoading = useAppSelector(
    (state) => state.orders.availabilityLoading,
  );
  const availabilityError = useAppSelector(
    (state) => state.orders.availabilityError,
  );
  const checkoutLoading = useAppSelector((state) => state.orders.checkoutLoading);

  const today = useMemo(() => toDateInputValue(new Date()), []);
  const [date, setDate] = useState(today);
  const [selectedSlot, setSelectedSlot] = useState<BookingSlot | null>(null);
  const [address, setAddress] = useState<PendingFixedOrderAddress>(emptyAddress);
  const [customerNotes, setCustomerNotes] = useState("");
  const hydratedKeyRef = useRef<string | null>(null);
  const skipSlotClearRef = useRef(false);

  useEffect(() => {
    if (!open) {
      hydratedKeyRef.current = null;
      return;
    }

    const hydrateKey = initialDraft
      ? `${initialDraft.serviceId}:${initialDraft.savedAt}`
      : `fresh:${service.id}`;

    if (hydratedKeyRef.current === hydrateKey) return;
    hydratedKeyRef.current = hydrateKey;

    dispatch(clearCheckoutError());

    if (initialDraft) {
      skipSlotClearRef.current = true;
      setDate(initialDraft.date || today);
      setSelectedSlot(initialDraft.selectedSlot);
      setAddress(initialDraft.address || emptyAddress);
      setCustomerNotes(initialDraft.customerNotes || "");
      return;
    }

    setDate(today);
    setSelectedSlot(null);
    setAddress(emptyAddress);
    setCustomerNotes("");
  }, [dispatch, initialDraft, open, service.id, today]);

  useEffect(() => {
    if (!open || !service.id || !date) return;
    if (skipSlotClearRef.current) {
      skipSlotClearRef.current = false;
    } else {
      setSelectedSlot(null);
    }
    void dispatch(
      fetchBookingAvailability({
        serviceId: service.id,
        date,
        timezone: defaultTimezone(),
      }),
    );
  }, [date, dispatch, open, service.id]);

  // Re-attach the saved slot after availability reloads (post-login restore).
  useEffect(() => {
    if (!open || !initialDraft?.selectedSlot?.startTime || !availability?.slots) {
      return;
    }
    const match = availability.slots.find(
      (slot) => slot.startTime === initialDraft.selectedSlot?.startTime,
    );
    if (match) setSelectedSlot(match);
  }, [availability?.slots, initialDraft, open]);

  useEffect(() => {
    if (!open) {
      dispatch(clearAvailability());
    }
  }, [dispatch, open]);

  function onSelectPlace(place: PlaceAddress) {
    setAddress((current) => ({
      ...current,
      label: place.formattedAddress || place.streetAddress || current.label,
      street: place.streetAddress || place.formattedAddress || "",
      city: place.city || "",
      state: place.state || "",
      zip: place.zipCode || "",
      lat: place.latitude,
      lng: place.longitude,
    }));
  }

  function buildPendingDraft(): PendingFixedOrder {
    const returnPath = `${publicFixedServicePath(service)}?book=1`;
    return {
      serviceId: service.id,
      serviceSlug: service.slug,
      categorySlug: service.category?.slug || undefined,
      returnPath,
      step: "checkout",
      date,
      selectedSlot,
      address,
      customerNotes,
      timezone: defaultTimezone(),
      savedAt: Date.now(),
    };
  }

  async function onConfirm() {
    if (!selectedSlot?.isAvailable) {
      toast.error("Please select an available time slot.");
      return;
    }
    if (
      !address.street.trim() ||
      !address.city.trim() ||
      !address.zip.trim() ||
      address.lat == null ||
      address.lng == null ||
      !Number.isFinite(address.lat) ||
      !Number.isFinite(address.lng)
    ) {
      toast.error("Please select a complete service address from the suggestions.");
      return;
    }

    // Auth gate happens at submit — preserve the full form first.
    if (!isAuthenticated) {
      const draft = buildPendingDraft();
      writePendingFixedOrder(draft);
      dispatch(setPendingOrderDraft(draft));
      toast.error("Please log in first to place an order.");
      router.push(`/login?next=${encodeURIComponent(draft.returnPath)}`);
      return;
    }

    const duration =
      selectedSlot.durationMinutes || availability?.duration || 60;

    try {
      const result = await dispatch(
        checkoutFixedServiceOrder({
          serviceId: service.id,
          startTime: selectedSlot.startTime,
          duration,
          address: {
            street: address.street.trim(),
            unit: address.unit.trim() || undefined,
            city: address.city.trim(),
            state: address.state.trim() || undefined,
            zip: address.zip.trim(),
            location: {
              type: "Point",
              coordinates: [address.lng, address.lat],
            },
            notes: address.notes.trim() || undefined,
          },
          customerNotes: customerNotes.trim() || undefined,
        }),
      ).unwrap();

      clearPendingFixedOrder();
      dispatch(clearPendingOrderDraft());

      toast.success(
        result.order.orderNumber
          ? `${result.message} (${result.order.orderNumber})`
          : result.message,
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(
        typeof error === "string"
          ? error
          : "Could not place the order. Please try another slot.",
      );
    }
  }

  const slots = availability?.slots ?? [];
  const price = availability?.basePrice ?? service.price;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <div className="border-b px-5 py-4">
          <DialogTitle className="text-lg font-semibold">
            Request this job
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            {service.servicesName} · {formatStartingPrice(price)}
          </DialogDescription>
        </div>

        <div className="flex flex-col gap-5 overflow-y-auto px-5 py-4">
          <Field>
            <FieldLabel htmlFor="order-date">Appointment date</FieldLabel>
            <Input
              id="order-date"
              type="date"
              min={today}
              value={date}
              onChange={(event) => setDate(event.target.value)}
              disabled={checkoutLoading}
            />
          </Field>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">
              Available time slots{" "}
              <span className="font-normal text-muted-foreground">
                (required — tap one)
              </span>
            </p>
            {availabilityLoading ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <Spinner size="sm" label="Loading slots" />
                Loading availability…
              </div>
            ) : availabilityError ? (
              <p className="text-sm text-destructive">{availabilityError}</p>
            ) : !slots.length ? (
              <p className="text-sm text-muted-foreground">
                No slots for this date. Try another day.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {slots.map((slot) => {
                  const selected = selectedSlot?.startTime === slot.startTime;
                  return (
                    <button
                      key={slot.startTime}
                      type="button"
                      disabled={!slot.isAvailable || checkoutLoading}
                      onClick={() => setSelectedSlot(slot)}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                        slot.isAvailable
                          ? selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input bg-card hover:border-primary/40"
                          : "cursor-not-allowed border-muted bg-muted/60 text-muted-foreground",
                      )}
                      title={
                        slot.isAvailable
                          ? undefined
                          : slot.disabledReason || "Booked"
                      }
                    >
                      <span className="block font-medium">
                        {formatSlotLabel(slot.startTime)}
                      </span>
                      {!slot.isAvailable ? (
                        <span className="mt-0.5 block text-[11px]">
                          {slot.disabledReason || "Booked"}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
            {!availabilityLoading &&
            !availabilityError &&
            slots.some((slot) => slot.isAvailable) &&
            !selectedSlot ? (
              <p className="text-xs text-muted-foreground">
                Choose a time slot above to enable booking.
              </p>
            ) : null}
          </div>

          <Field>
            <FieldLabel htmlFor="order-address">Service address</FieldLabel>
            <AddressAutocomplete
              id="order-address"
              value={address.label}
              onChange={(value) =>
                setAddress((current) => ({
                  ...current,
                  label: value,
                  street: "",
                  city: "",
                  state: "",
                  zip: "",
                  lat: null,
                  lng: null,
                }))
              }
              onSelect={onSelectPlace}
              placeholder="Start typing your address"
              required
              disabled={checkoutLoading}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="order-unit">Unit / apt (optional)</FieldLabel>
              <Input
                id="order-unit"
                value={address.unit}
                onChange={(event) =>
                  setAddress((current) => ({
                    ...current,
                    unit: event.target.value,
                  }))
                }
                placeholder="Apt, suite…"
                disabled={checkoutLoading}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="order-zip">ZIP</FieldLabel>
              <Input
                id="order-zip"
                value={address.zip}
                onChange={(event) =>
                  setAddress((current) => ({
                    ...current,
                    zip: event.target.value,
                  }))
                }
                placeholder="ZIP"
                disabled={checkoutLoading}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="order-access-notes">
              Access notes (optional)
            </FieldLabel>
            <Input
              id="order-access-notes"
              value={address.notes}
              onChange={(event) =>
                setAddress((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              placeholder="Gate code, parking, etc."
              disabled={checkoutLoading}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="order-customer-notes">
              Notes for the pro (optional)
            </FieldLabel>
            <Textarea
              id="order-customer-notes"
              rows={3}
              value={customerNotes}
              onChange={(event) => setCustomerNotes(event.target.value)}
              placeholder="Anything the technician should know before arrival"
              disabled={checkoutLoading}
            />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={checkoutLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void onConfirm()}
            disabled={checkoutLoading}
          >
            {checkoutLoading ? (
              <>
                <Spinner size="sm" label="Placing order" />
                Placing order…
              </>
            ) : (
              "Confirm booking"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
