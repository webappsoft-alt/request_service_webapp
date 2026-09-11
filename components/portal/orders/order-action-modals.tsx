"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Crosshair,
  Loader2,
  MapPin,
  Navigation,
  Plus,
  Trash2,
  UploadCloud,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { extractUploadedUrl, uploadFile } from "@/components/api/uploadFile";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ProviderOrder } from "@/lib/types/provider-order";
import { OrderStatusPill } from "./order-status-pill";

// ==========================================
// 1. ACCEPT MODAL
// ==========================================
export function AcceptOrderModal({
  order,
  isOpen,
  onClose,
  onConfirm,
  loading = false,
}: {
  order: ProviderOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  loading?: boolean;
}) {
  if (!order) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 sm:mx-0">
            <CheckCircle2 className="size-6" />
          </div>
          <DialogTitle className="text-lg font-semibold">
            Accept Booking Request
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            You are about to accept order{" "}
            <span className="font-semibold text-foreground">
              {order.orderNumber}
            </span>
            . This confirms the appointment on your operational calendar and
            notifies the customer.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border/80 bg-muted/40 p-3.5 text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Service:</span>
            <span className="font-medium text-foreground">
              {order.service?.title || "Operational Service"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Location:</span>
            <span className="font-medium text-foreground">
              {order.address?.city}, {order.address?.state}
            </span>
          </div>
          <div className="flex justify-between border-t border-border/60 pt-2">
            <span className="text-muted-foreground">Total Payout:</span>
            <span className="font-semibold text-emerald-700">
              ${order.pricing?.totalAmount?.toFixed(2) || "0.00"}
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            Accept & Confirm Booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==========================================
// 2. REJECT MODAL
// ==========================================
export function RejectOrderModal({
  order,
  isOpen,
  onClose,
  onConfirm,
  loading = false,
}: {
  order: ProviderOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  loading?: boolean;
}) {
  const [reason, setReason] = useState("");

  if (!order) return null;

  const quickReasons = [
    "Schedule conflict with existing off-platform job",
    "Customer property is outside active operational territory",
    "Emergency technical equipment maintenance",
    "Capacity limit reached for requested temporal slot",
  ];

  const handleSubmit = async () => {
    if (reason.trim().length < 3) {
      toast.error("Please enter a decline reason (at least 3 characters).");
      return;
    }
    await onConfirm(reason.trim());
    setReason("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-red-100 text-red-600 sm:mx-0">
            <XCircle className="size-6" />
          </div>
          <DialogTitle className="text-lg font-semibold text-foreground">
            Decline Booking Request
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Decline order <span className="font-semibold text-foreground">{order.orderNumber}</span> and release the temporal booking slot.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="reject-reason" className="text-xs font-semibold uppercase text-muted-foreground">
              Decline Reason <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="reject-reason"
              placeholder="State the operational reason for declining this request..."
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="resize-none text-sm"
              disabled={loading}
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">Quick suggestions:</span>
            <div className="flex flex-wrap gap-1.5">
              {quickReasons.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setReason(q)}
                  disabled={loading}
                  className="rounded-full border border-border/80 bg-muted/30 px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={loading || reason.trim().length < 3}
            className="gap-1.5"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            Decline Booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==========================================
// 3. START TRANSIT MODAL
// ==========================================
export function TransitOrderModal({
  order,
  isOpen,
  onClose,
  onConfirm,
  loading = false,
}: {
  order: ProviderOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (coords: [number, number]) => Promise<void>;
  loading?: boolean;
}) {
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [locationAddress, setLocationAddress] = useState<string | null>(null);
  const [resolvingAddress, setResolvingAddress] = useState(false);
  const [detectingGps, setDetectingGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isPermissionDenied, setIsPermissionDenied] = useState(false);

  const fetchAddress = async (lat: number, lng: number) => {
    setResolvingAddress(true);

    // 1. Try Mapbox Geocoding if API key is configured
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_PLACES_API_KEY;
    if (mapboxToken) {
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxToken}&language=en`,
        );
        if (res.ok) {
          const data = await res.json();
          if (data?.features?.[0]?.place_name) {
            setLocationAddress(data.features[0].place_name);
            setResolvingAddress(false);
            return;
          }
        }
      } catch {
        // Continue
      }
    }

    // 2. Try BigDataCloud reverse geocode client (free, client-safe)
    try {
      const url = new URL("https://api.bigdatacloud.net/data/reverse-geocode-client");
      url.searchParams.set("latitude", String(lat));
      url.searchParams.set("longitude", String(lng));
      url.searchParams.set("localityLanguage", "en");
      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json();
        const parts = [
          data.locality || data.city,
          data.principalSubdivision,
          data.countryName,
        ].filter(Boolean);
        if (parts.length) {
          setLocationAddress(parts.join(", "));
          setResolvingAddress(false);
          return;
        }
      }
    } catch {
      // Continue
    }

    // 3. Try OpenStreetMap Nominatim reverse geocode
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=en`,
      );
      if (res.ok) {
        const data = await res.json();
        if (data?.display_name) {
          setLocationAddress(data.display_name);
          setResolvingAddress(false);
          return;
        }
      }
    } catch {
      // Continue
    }

    // 4. Try Google Places Geocoder
    try {
      const { reverseGeocodeCoordinates } = await import("@/lib/google-places");
      const place = await reverseGeocodeCoordinates(lat, lng);
      if (place.formattedAddress) {
        setLocationAddress(place.formattedAddress);
        setResolvingAddress(false);
        return;
      }
    } catch {
      // Fallback
    }

    // Never display raw lat/lng coordinates to the user
    setLocationAddress("Current verified location (GPS locked)");
    setResolvingAddress(false);
  };

  const handleDetectGps = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      const msg = "Geolocation is not supported by your browser.";
      setGpsError(msg);
      toast.error(msg);
      return;
    }
    setDetectingGps(true);
    setGpsError(null);
    setIsPermissionDenied(false);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDetectingGps(false);
        const numLng = pos.coords.longitude;
        const numLat = pos.coords.latitude;
        setCoords([numLng, numLat]);
        setGpsError(null);
        setIsPermissionDenied(false);
        toast.success("Departure origin acquired");
        void fetchAddress(numLat, numLng);
      },
      (err) => {
        setDetectingGps(false);
        if (err.code === 1) {
          setIsPermissionDenied(true);
          const msg =
            "Location access was blocked or denied. Please allow location permissions in your browser or device settings to start departure.";
          setGpsError(msg);
          toast.error(
            "Please allow location permissions in your browser to start departure.",
          );
        } else if (err.code === 2) {
          const msg =
            "Device location is turned off or unavailable. Please turn on location / GPS on your device.";
          setGpsError(msg);
          toast.error("Device location is turned off.");
        } else if (err.code === 3) {
          const msg = "Location detection timed out. Click 'Retry' to try again.";
          setGpsError(msg);
          toast.error(msg);
        } else {
          setGpsError(`Could not detect location: ${err.message}`);
          toast.error(err.message);
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  // Auto-detect location when the modal opens
  useEffect(() => {
    if (isOpen) {
      setCoords(null);
      setLocationAddress(null);
      setResolvingAddress(false);
      setGpsError(null);
      setIsPermissionDenied(false);
      handleDetectGps();
    }
  }, [isOpen]);

  if (!order) return null;

  const handleSubmit = async () => {
    if (!coords || !Number.isFinite(coords[0]) || !Number.isFinite(coords[1])) {
      if (detectingGps) {
        toast.info("Acquiring GPS location, please wait a moment...");
        return;
      }
      if (isPermissionDenied || gpsError) {
        toast.error(
          "Location access is required for order departure. Please allow location in your browser.",
        );
        return;
      }
      handleDetectGps();
      return;
    }

    await onConfirm(coords);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 sm:mx-0">
            <Navigation className="size-6" />
          </div>
          <DialogTitle className="text-lg font-semibold">
            Depart for Job Location
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground flex flex-wrap items-center gap-1">
            Mark order <span className="font-semibold text-foreground">{order.orderNumber}</span> as{" "}
            <OrderStatusPill status="IN_TRANSIT" />. Customer will be notified that you are en route.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {/* Unified Dispatch Route Card */}
          <div className="rounded-xl border border-border/80 bg-muted/30 p-3.5 space-y-3">
            {/* 1. Departure Origin */}
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className="flex size-7 items-center justify-center rounded-full bg-blue-100 text-blue-600 ring-4 ring-blue-50/80">
                  <Navigation className="size-3.5" />
                </div>
                <div className="w-0.5 h-7 my-1 border-l-2 border-dashed border-border" />
              </div>

              <div className="flex-1 min-w-0 pt-0.5 space-y-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Departure Origin
                  </span>
                  {coords && !detectingGps ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleDetectGps}
                        disabled={detectingGps || loading}
                        className="text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-0.5"
                        title="Re-sync GPS location"
                      >
                        <Crosshair className="size-2.5" /> Re-sync
                      </button>
                    </div>
                  ) : null}
                </div>

                {detectingGps ? (
                  <div className="flex items-center gap-2 text-xs text-blue-600 py-0.5">
                    <Loader2 className="size-3.5 animate-spin shrink-0" />
                    <span>Detecting departure origin via GPS...</span>
                  </div>
                ) : resolvingAddress ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-0.5">
                    <Loader2 className="size-3.5 animate-spin shrink-0" />
                    <span>Resolving departure address...</span>
                  </div>
                ) : (
                  <p className="text-xs font-semibold text-foreground leading-relaxed">
                    {locationAddress || "Departure location verified"}
                  </p>
                )}
              </div>
            </div>

            {/* 2. Job Destination */}
            <div className="flex items-start gap-3">
              <div className="flex size-7 items-center justify-center rounded-full bg-rose-100 text-rose-600 ring-4 ring-rose-50/80 shrink-0">
                <MapPin className="size-3.5" />
              </div>

              <div className="flex-1 min-w-0 pt-0.5 space-y-0.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Job Destination
                </span>
                <p className="text-xs font-medium text-foreground leading-relaxed">
                  {order.address?.street
                    ? `${order.address.street}, ${order.address.city}, ${order.address.state} ${order.address.zip || ""}`
                    : `${order.address?.city || ""}, ${order.address?.state || ""}`}
                </p>
              </div>
            </div>
          </div>

          {/* Location Status Feedback / GPS Error */}
          {gpsError ? (
            <div className="rounded-lg border border-red-200 bg-red-50/90 p-3 text-xs text-red-800 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="size-4 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-red-900">Location Access Required</p>
                  <p className="text-[11px] leading-relaxed text-red-700">
                    {gpsError}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDetectGps}
                className="h-7 text-xs border-red-300 bg-white text-red-800 hover:bg-red-100 gap-1 font-medium"
              >
                <Crosshair className="size-3" /> Allow / Retry Location Access
              </Button>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || detectingGps || (!coords && Boolean(gpsError))}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 font-medium"
          >
            {loading || detectingGps ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Navigation className="size-3.5" />
            )}
            {detectingGps ? "Detecting Location..." : "Start Transit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==========================================
// 4. ARRIVE (GEOFENCE) MODAL
// ==========================================
export function ArriveOrderModal({
  order,
  isOpen,
  onClose,
  onConfirm,
  loading = false,
}: {
  order: ProviderOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (coords: [number, number]) => Promise<void>;
  loading?: boolean;
}) {
  const propertyCoords = order?.address?.location?.coordinates;
  const [lng, setLng] = useState<string>("");
  const [lat, setLat] = useState<string>("");
  const [detectingGps, setDetectingGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (propertyCoords && propertyCoords.length === 2) {
        setLng(String(propertyCoords[0]));
        setLat(String(propertyCoords[1]));
        setGpsError(null);
      } else {
        setLng("");
        setLat("");
        setGpsError(null);
      }
    }
  }, [isOpen, propertyCoords]);

  if (!order) return null;

  const handleDetectGps = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      const msg = "Geolocation is not supported by your browser.";
      setGpsError(msg);
      toast.error(msg);
      return;
    }
    setDetectingGps(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDetectingGps(false);
        setLng(pos.coords.longitude.toFixed(6));
        setLat(pos.coords.latitude.toFixed(6));
        setGpsError(null);
        toast.success("Live GPS coordinates acquired.");
      },
      (err) => {
        setDetectingGps(false);
        if (err.code === 1) {
          const msg =
            "Location access was denied. Please allow location permissions in your browser.";
          setGpsError(msg);
          toast.error(msg);
        } else if (err.code === 2) {
          const msg = "Device location is unavailable or turned off.";
          setGpsError(msg);
          toast.error(msg);
        } else {
          setGpsError(`Could not read GPS: ${err.message}`);
          toast.error(err.message);
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  const handleUsePropertyCoords = () => {
    if (propertyCoords) {
      setLng(String(propertyCoords[0]));
      setLat(String(propertyCoords[1]));
      setGpsError(null);
      toast.info("Filled customer property coordinates (valid for 200m geofence).");
    }
  };

  const handleSubmit = async () => {
    const numLng = Number(lng);
    const numLat = Number(lat);
    if (!lng || !lat || !Number.isFinite(numLng) || !Number.isFinite(numLat)) {
      toast.error("Please provide valid GPS coordinates to verify arrival.");
      return;
    }
    await onConfirm([numLng, numLat]);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 sm:mx-0">
            <MapPin className="size-6" />
          </div>
          <DialogTitle className="text-lg font-semibold">
            Verify On-Site Arrival
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground flex flex-wrap items-center gap-1">
            Verify presence within the 200m geofence to mark order as{" "}
            <OrderStatusPill status="ARRIVED" />.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-1">
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900 space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <AlertTriangle className="size-3.5 text-amber-600" /> Geofence Rule
            </div>
            <p className="text-[11px] leading-relaxed">
              Ensure you are within 200m of the customer destination. If developing or testing off-site, click &ldquo;Use Property Coords&rdquo; below to satisfy the geofence check.
            </p>
          </div>

          {gpsError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-800 flex items-start gap-2">
              <AlertTriangle className="size-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-red-700">{gpsError}</p>
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">
                Arrival Coordinates [Lng, Lat]
              </Label>
              <div className="flex gap-1">
                {propertyCoords ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleUsePropertyCoords}
                    disabled={loading}
                    className="h-7 text-xs"
                  >
                    Use Property Coords
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDetectGps}
                  disabled={detectingGps || loading}
                  className="h-7 text-xs gap-1"
                >
                  {detectingGps ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Crosshair className="size-3" />
                  )}
                  Detect GPS
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="arrive-lng" className="text-[11px] text-muted-foreground">
                  Longitude
                </Label>
                <Input
                  id="arrive-lng"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  placeholder="Auto-detected"
                  className="font-mono text-xs"
                  disabled={loading}
                />
              </div>
              <div>
                <Label htmlFor="arrive-lat" className="text-[11px] text-muted-foreground">
                  Latitude
                </Label>
                <Input
                  id="arrive-lat"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="Auto-detected"
                  className="font-mono text-xs"
                  disabled={loading}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || (!lng && !lat)}
            className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            Verify & Mark Arrived
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==========================================
// 5. START WORK MODAL
// ==========================================
export function StartWorkOrderModal({
  order,
  isOpen,
  onClose,
  onConfirm,
  loading = false,
}: {
  order: ProviderOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  loading?: boolean;
}) {
  if (!order) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-purple-100 text-purple-600 sm:mx-0">
            <CheckCircle2 className="size-6" />
          </div>
          <DialogTitle className="text-lg font-semibold">
            Start Physical Work
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground flex flex-wrap items-center gap-1">
            You are beginning physical execution on order{" "}
            <span className="font-semibold text-foreground">{order.orderNumber}</span>. Status will change to{" "}
            <OrderStatusPill status="IN_PROGRESS" />.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border/80 bg-muted/40 p-3 text-sm space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Service:</span>
            <span className="font-medium text-foreground">{order.service?.title || "Service"}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Property:</span>
            <span className="font-medium text-foreground">{order.address?.street}, {order.address?.city}</span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            Start Work
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==========================================
// 6. PROPOSE CHANGE ORDER MODAL
// ==========================================
export function ChangeOrderModal({
  order,
  isOpen,
  onClose,
  onConfirm,
  loading = false,
}: {
  order: ProviderOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    description: string;
    reason: string;
    additionalAmount: number;
    evidencePhotos: string[];
  }) => Promise<void>;
  loading?: boolean;
}) {
  const [description, setDescription] = useState("");
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");

  if (!order) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const res = await uploadFile(file);
        const url = extractUploadedUrl(res.data);
        if (url) {
          setPhotos((prev) => [...prev, url]);
        }
      }
      toast.success("Photo(s) uploaded successfully.");
    } catch (err: unknown) {
      const msg = typeof err === "object" && err && "message" in err ? String((err as { message: unknown }).message) : "Failed to upload photo.";
      toast.error(msg);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleAddUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    if (!/^https?:\/\//i.test(trimmed)) {
      toast.error("Please enter a valid URL starting with http:// or https://");
      return;
    }
    setPhotos((prev) => [...prev, trimmed]);
    setUrlInput("");
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast.error("Please provide a description of the change order.");
      return;
    }
    if (!reason.trim()) {
      toast.error("Please provide an operational reason for the additional scope.");
      return;
    }
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      toast.error("Please enter a valid positive additional amount ($).");
      return;
    }

    await onConfirm({
      description: description.trim(),
      reason: reason.trim(),
      additionalAmount: numAmount,
      evidencePhotos: photos,
    });

    setDescription("");
    setReason("");
    setAmount("");
    setPhotos([]);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            Propose In-App Change Order
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Submit extra scope, parts, or labor requiring customer authorization before proceeding.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="co-desc" className="text-xs font-semibold uppercase text-muted-foreground">
              Scope Description <span className="text-red-500">*</span>
            </Label>
            <Input
              id="co-desc"
              placeholder="e.g. Corroded main shutoff valve replacement"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="co-reason" className="text-xs font-semibold uppercase text-muted-foreground">
              Reason / Justification <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="co-reason"
              placeholder="e.g. Existing gate valve cannot isolate water line for water heater tank replacement"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={loading}
              className="resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="co-amount" className="text-xs font-semibold uppercase text-muted-foreground">
              Additional Amount ($ USD) <span className="text-red-500">*</span>
            </Label>
            <Input
              id="co-amount"
              type="number"
              min="1"
              step="0.01"
              placeholder="85.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">
              Evidence Photos (Optional)
            </Label>

            <div className="flex gap-2">
              <label className="flex items-center gap-1.5 cursor-pointer rounded-md border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors">
                <UploadCloud className="size-3.5" />
                <span>Upload Photos</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={uploading || loading}
                  className="hidden"
                />
              </label>
              <div className="flex-1 flex gap-1">
                <Input
                  placeholder="Or paste photo URL..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="h-8 text-xs"
                  disabled={loading}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleAddUrl}
                  disabled={!urlInput.trim() || loading}
                  className="h-8 text-xs"
                >
                  Add
                </Button>
              </div>
            </div>

            {uploading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                <Loader2 className="size-3.5 animate-spin" /> Uploading photos...
              </div>
            ) : null}

            {photos.length > 0 ? (
              <div className="grid grid-cols-4 gap-2 pt-1">
                {photos.map((url, i) => (
                  <div key={i} className="group relative aspect-square rounded-md overflow-hidden border border-border bg-muted">
                    <img src={url} alt="evidence" className="size-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(i)}
                      className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                    >
                      <Trash2 className="size-4 text-red-300" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || uploading || !description.trim() || !amount}
            className="bg-[#003F7D] hover:bg-[#003160] text-white gap-1.5"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            Propose Change Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==========================================
// 7. COMPLETE WORK MODAL
// ==========================================
export function CompleteWorkModal({
  order,
  isOpen,
  onClose,
  onConfirm,
  loading = false,
}: {
  order: ProviderOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    completionNotes: string;
    beforePhotos: string[];
    afterPhotos: string[];
  }) => Promise<void>;
  loading?: boolean;
}) {
  const [notes, setNotes] = useState("");
  const [beforePhotos, setBeforePhotos] = useState<string[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<string[]>([]);
  const [uploadingType, setUploadingType] = useState<"before" | "after" | null>(null);

  if (!order) return null;

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "before" | "after",
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingType(type);
    try {
      for (const file of Array.from(files)) {
        const res = await uploadFile(file);
        const url = extractUploadedUrl(res.data);
        if (url) {
          if (type === "before") {
            setBeforePhotos((prev) => [...prev, url]);
          } else {
            setAfterPhotos((prev) => [...prev, url]);
          }
        }
      }
      toast.success(`${type === "before" ? "Before" : "After"} photo uploaded.`);
    } catch (err: unknown) {
      const msg = typeof err === "object" && err && "message" in err ? String((err as { message: unknown }).message) : "Failed to upload image.";
      toast.error(msg);
    } finally {
      setUploadingType(null);
      e.target.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!notes.trim()) {
      toast.error("Please provide completion notes summarizing the work.");
      return;
    }
    if (afterPhotos.length === 0) {
      toast.error("At least one proof-of-work 'After' photo is mandatory.");
      return;
    }

    await onConfirm({
      completionNotes: notes.trim(),
      beforePhotos,
      afterPhotos,
    });

    setNotes("");
    setBeforePhotos([]);
    setAfterPhotos([]);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 sm:mx-0">
            <CheckCircle2 className="size-6" />
          </div>
          <DialogTitle className="text-lg font-semibold">
            Submit Work Completion
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground flex flex-wrap items-center gap-1">
            Submit photographic evidence and work notes to transition to{" "}
            <OrderStatusPill status="WORK_COMPLETED" /> for customer sign-off.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="complete-notes" className="text-xs font-semibold uppercase text-muted-foreground">
              Completion Notes <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="complete-notes"
              placeholder="e.g. Installed new 50-gallon Rheem tank, pressure tested lines, verified 125F output temperature."
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={loading}
              className="resize-none"
            />
          </div>

          {/* Before Photos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">
                Before Photos (Optional)
              </Label>
              <label className="cursor-pointer text-xs text-primary font-medium hover:underline flex items-center gap-1">
                <Camera className="size-3" />
                <span>+ Upload</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, "before")}
                  disabled={Boolean(uploadingType) || loading}
                  className="hidden"
                />
              </label>
            </div>
            {uploadingType === "before" ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="size-3 animate-spin" /> Uploading before photos...
              </p>
            ) : null}
            {beforePhotos.length > 0 ? (
              <div className="grid grid-cols-4 gap-2">
                {beforePhotos.map((url, i) => (
                  <div key={i} className="group relative aspect-square rounded-md overflow-hidden border border-border bg-muted">
                    <img src={url} alt="before" className="size-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setBeforePhotos((p) => p.filter((_, idx) => idx !== i))}
                      className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                    >
                      <Trash2 className="size-3.5 text-red-300" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground italic">No before photos added.</p>
            )}
          </div>

          {/* After Photos */}
          <div className="space-y-2 border-t border-border/60 pt-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">
                Proof of Work / After Photos <span className="text-red-500">* (Min 1)</span>
              </Label>
              <label className="cursor-pointer text-xs text-emerald-600 font-medium hover:underline flex items-center gap-1">
                <Camera className="size-3" />
                <span>+ Upload Proof</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, "after")}
                  disabled={Boolean(uploadingType) || loading}
                  className="hidden"
                />
              </label>
            </div>
            {uploadingType === "after" ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="size-3 animate-spin" /> Uploading after photos...
              </p>
            ) : null}
            {afterPhotos.length > 0 ? (
              <div className="grid grid-cols-4 gap-2">
                {afterPhotos.map((url, i) => (
                  <div key={i} className="group relative aspect-square rounded-md overflow-hidden border border-emerald-300 bg-muted">
                    <img src={url} alt="after" className="size-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setAfterPhotos((p) => p.filter((_, idx) => idx !== i))}
                      className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                    >
                      <Trash2 className="size-3.5 text-red-300" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-red-200 bg-red-50/40 p-2 text-center text-xs text-red-600">
                Mandatory: Upload at least 1 after photo demonstrating completed physical work.
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || Boolean(uploadingType) || !notes.trim() || afterPhotos.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            Submit Completed Work
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==========================================
// 8. EMERGENCY CANCEL MODAL
// ==========================================
export function CancelOrderModal({
  order,
  isOpen,
  onClose,
  onConfirm,
  loading = false,
}: {
  order: ProviderOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  loading?: boolean;
}) {
  const [reason, setReason] = useState("");

  if (!order) return null;

  const handleSubmit = async () => {
    if (reason.trim().length < 5) {
      toast.error("Please enter a cancellation reason (minimum 5 characters).");
      return;
    }
    await onConfirm(reason.trim());
    setReason("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-red-100 text-red-600 sm:mx-0">
            <AlertTriangle className="size-6" />
          </div>
          <DialogTitle className="text-lg font-semibold text-destructive">
            Emergency Order Cancellation
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Cancelling order <span className="font-semibold text-foreground">{order.orderNumber}</span> will release the customer slot and record an emergency event on the operational audit ledger.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-1">
          <Label htmlFor="cancel-reason" className="text-xs font-semibold uppercase text-muted-foreground">
            Cancellation Reason <span className="text-red-500">*</span>
          </Label>
          <Textarea
            id="cancel-reason"
            placeholder="e.g. Technician service van transmission breakdown en route to customer property"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={loading}
            className="resize-none"
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Back
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={loading || reason.trim().length < 5}
            className="gap-1.5"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            Cancel Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
