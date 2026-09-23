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
import { AddressFields } from "@/components/shared/address-fields";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectIsAuthenticated } from "@/store/authSlice";
import { invalidatePublicCatalog } from "@/components/realtime/public-data-sync";
import {
  checkoutFixedServiceOrder,
  clearAvailability,
  clearCheckoutError,
  clearPendingOrderDraft,
  fetchBookingAvailability,
  fetchCustomerOrders,
  selectCustomerOrders,
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
import { findOpenOrderForService } from "@/lib/orders/order-status";
import { formatStartingPrice } from "@/lib/format";
import { customerPaths } from "@/lib/customer-paths";
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

function formatSlotDisabledLabel(reason?: string | null) {
  const code = String(reason || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  if (code === "PAST_TIME" || code === "PAST") {
    return {
      /** Short label inside the compact slot card */
      text: "Passed",
      tone: "past" as const,
    };
  }
  if (code === "BOOKED" || code === "UNAVAILABLE" || !code) {
    return { text: "Booked", tone: "muted" as const };
  }
  const humanized = code
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return { text: humanized || "Unavailable", tone: "muted" as const };
}

function isPastSlotReason(reason?: string | null) {
  const code = String(reason || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  return code === "PAST_TIME" || code === "PAST";
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
  address: "",
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
  const customerOrders = useAppSelector(selectCustomerOrders);

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
      !String(address.address || address.street || "").trim() ||
      !address.city.trim() ||
      !address.state.trim() ||
      address.lat == null ||
      address.lng == null ||
      !Number.isFinite(address.lat) ||
      !Number.isFinite(address.lng)
    ) {
      toast.error("Please select a complete service address from the suggestions.");
      return;
    }
    // Many places (esp. non-US) omit postal codes — coords + address/city/state are enough.
    const zip = address.zip.trim() || "00000";
    const addressLine = String(address.address || address.street || "").trim();

    // Auth gate happens at submit — preserve the full form first.
    if (!isAuthenticated) {
      const draft = buildPendingDraft();
      writePendingFixedOrder(draft);
      dispatch(setPendingOrderDraft(draft));
      toast.error("Please log in first to place an order.");
      router.push(`/login?next=${encodeURIComponent(draft.returnPath)}`);
      return;
    }

    const existing = findOpenOrderForService(customerOrders, service.id);
    if (existing) {
      toast.error("You already have an open order for this service.");
      onOpenChange(false);
      router.push(customerPaths.order(existing.id));
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
            address: addressLine,
            street: addressLine,
            unit: address.unit.trim() || undefined,
            city: address.city.trim(),
            state: address.state.trim(),
            zip,
            lat: address.lat,
            lng: address.lng,
            notes: address.notes.trim() || undefined,
          },
          customerNotes: customerNotes.trim() || undefined,
        }),
      ).unwrap();

      clearPendingFixedOrder();
      dispatch(clearPendingOrderDraft());
      invalidatePublicCatalog();
      void dispatch(fetchCustomerOrders({ page: 1, limit: 50 }));

      toast.success(
        result.order.orderNumber
          ? `${result.message} (${result.order.orderNumber})`
          : result.message,
      );
      onOpenChange(false);
      if (result.order.id) {
        router.push(customerPaths.order(result.order.id));
      }
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
        <div className="shrink-0 border-b px-5 py-4 pr-12 sm:px-6">
          <DialogTitle className="text-lg font-semibold tracking-tight">
            Request this job
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm leading-5 text-muted-foreground">
            {service.servicesName} · {formatStartingPrice(price)}
          </DialogDescription>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-5 sm:gap-6 sm:px-6">
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

          <div className="flex flex-col gap-2.5">
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-medium">Available time slots</p>
              <p className="text-xs text-muted-foreground">
                Required — select one available time
              </p>
            </div>
            {availabilityLoading ? (
              <div className="flex min-h-[5.5rem] items-center justify-center rounded-lg border border-input bg-muted/30">
                <Spinner size="md" label="Loading slots" />
              </div>
            ) : availabilityError ? (
              <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-3.5 py-3">
                <p className="text-sm text-destructive">{availabilityError}</p>
              </div>
            ) : !slots.length ? (
              <div className="rounded-lg border border-input bg-muted/30 px-3.5 py-3">
                <p className="text-sm text-muted-foreground">
                  No slots for this date. Try another day.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {slots.some((slot) => !slot.isAvailable && isPastSlotReason(slot.disabledReason)) &&
                !slots.some((slot) => slot.isAvailable) ? (
                  <p className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] leading-snug text-red-700">
                    These times have passed for today. Please book the next available date.
                  </p>
                ) : null}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {slots.map((slot) => {
                    const selected = selectedSlot?.startTime === slot.startTime;
                    const disabledLabel = !slot.isAvailable
                      ? formatSlotDisabledLabel(slot.disabledReason)
                      : null;
                    return (
                      <button
                        key={slot.startTime}
                        type="button"
                        disabled={!slot.isAvailable || checkoutLoading}
                        onClick={() => setSelectedSlot(slot)}
                        className={cn(
                          "flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg border px-3 py-2 text-center text-sm transition-colors",
                          slot.isAvailable
                            ? selected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input bg-card hover:border-primary/40 hover:bg-muted/40"
                            : "cursor-not-allowed border-muted bg-muted/50 text-muted-foreground",
                        )}
                        title={
                          disabledLabel?.tone === "past"
                            ? "This slot has passed for today. Please book the next available date."
                            : disabledLabel?.text
                        }
                      >
                        <span className="font-medium leading-none">
                          {formatSlotLabel(slot.startTime)}
                        </span>
                        {disabledLabel ? (
                          <span
                            className={cn(
                              "text-[9px] font-normal leading-none",
                              disabledLabel.tone === "past"
                                ? "text-black/40"
                                : "opacity-80",
                            )}
                          >
                            {disabledLabel.text}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {!availabilityLoading &&
            !availabilityError &&
            slots.some((slot) => slot.isAvailable) &&
            !selectedSlot ? (
              <p className="text-xs text-muted-foreground">
                Select a time slot to continue.
              </p>
            ) : null}
          </div>

          <AddressFields
            idPrefix="order"
            value={{
              label: address.label,
              address: address.address || address.street || "",
              city: address.city,
              state: address.state,
              zip: address.zip,
              lat: address.lat,
              lng: address.lng,
            }}
            onChange={(next) =>
              setAddress((current) => ({
                ...current,
                label: next.label || next.address,
                address: next.address,
                street: next.address,
                city: next.city,
                state: next.state,
                zip: next.zip,
                lat: next.lat,
                lng: next.lng,
              }))
            }
            required
            disabled={checkoutLoading}
            addressLabel="Address"
            addressPlaceholder="Start typing your address"
          />

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
              autoComplete="address-line2"
            />
          </Field>

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
              className="min-h-[5.5rem] resize-none"
            />
          </Field>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t bg-card px-5 py-4 sm:px-6">
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
            className="min-w-[9.5rem]"
          >
            {checkoutLoading ? (
              <Spinner size="sm" label="Placing order" />
            ) : (
              "Confirm booking"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
