"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  putData,
  showApiErrorToast,
} from "@/components/api/apiFuntions";
import { providerApi, userApi } from "@/components/api/ApiRoutesFile";
import {
  extractUploadedUrl,
  uploadFile,
} from "@/components/api/uploadFile";
import { AuthPhoneInput } from "@/components/auth/auth-phone-input";
import {
  AddressAutocomplete,
  type PlaceAddress,
} from "@/components/shared/address-autocomplete";
import { HoursEditor } from "@/components/portal/hours-editor";
import { PortalPage } from "@/components/portal/portal-page";
import { StatusPill } from "@/components/portal/status-pill";
import { usePortalSettings } from "@/components/portal/use-portal-settings";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cloneWorkingHours } from "@/lib/data/portal";
import { getActivePlans, formatPlanPrice } from "@/lib/data/plans";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  getUserAvatarSrc,
  selectAuthProvider,
  selectAuthUser,
  updateAuthUser,
  type AuthUser,
} from "@/store/authSlice";

export function BillingView() {
  const { subscription } = usePortalWorkspace();
  const plans = getActivePlans();
  const current = plans.find((plan) => plan.id === subscription.planId) ?? plans[0];

  return (
    <PortalPage
      eyebrow="Plan"
      title="Subscription & billing"
      description="Portal access follows subscription status. Plans are the same records shown on the public pricing page."
    >
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Current plan</CardTitle>
          <StatusPill label={subscription.status} tone="success" />
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p className="text-2xl font-semibold">{current.name}</p>
          <p>
            {formatPlanPrice(current)} / {current.interval}
          </p>
          <p className="text-muted-foreground">
            Current period {formatDate(subscription.currentPeriodStart)} –{" "}
            {formatDate(subscription.currentPeriodEnd)}
          </p>
          <p className="text-muted-foreground">Payment method · Visa ending 4242</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={cn(
              "flex flex-col gap-3 rounded-xl border border-input bg-card p-5",
              plan.id === current.id && "border-primary",
            )}
          >
            <p className="font-semibold">{plan.name}</p>
            <p className="text-2xl font-semibold">{formatPlanPrice(plan)}</p>
            <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
              {plan.features.slice(0, 4).map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
            <Button
              variant={plan.id === current.id ? "outline" : "default"}
              onClick={() =>
                toast.success(
                  plan.id === current.id
                    ? "You are already on this plan."
                    : `${plan.name} selected. Billing would update after checkout.`,
                )
              }
            >
              {plan.id === current.id
                ? "Current plan"
                : plan.price > current.price
                  ? "Upgrade"
                  : "Downgrade"}
            </Button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() =>
            toast.success(
              "Cancellation is scheduled for the period end in this demo.",
            )
          }
        >
          Cancel at period end
        </Button>
      </div>
    </PortalPage>
  );
}

function initialsFor(user: AuthUser | null): string {
  if (!user) return "P";
  const first = String(user.firstName || "").trim();
  const last = String(user.lastName || "").trim();
  if (first || last) {
    return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || first.charAt(0).toUpperCase();
  }
  return String(user.email || "P").charAt(0).toUpperCase();
}

export function SettingsView() {
  const dispatch = useAppDispatch();
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const user = useAppSelector(selectAuthUser);
  const authProvider = useAppSelector(selectAuthProvider);
  const { provider } = usePortalWorkspace();
  const { officeHours, saveOfficeHours } = usePortalSettings();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [country, setCountry] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [hours, setHours] = useState(() => cloneWorkingHours(officeHours));
  const [savingAccount, setSavingAccount] = useState(false);
  const [savingHours, setSavingHours] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const formReadyRef = useRef(false);
  const hoursSynced = useRef(false);

  useEffect(() => {
    if (!user) {
      formReadyRef.current = false;
      return;
    }
    setAvatarUrl(getUserAvatarSrc(user));
    if (formReadyRef.current) return;

    setFirstName(String(user.firstName || ""));
    setLastName(String(user.lastName || ""));
    setPhone(
      typeof user.phone === "string" && user.phone
        ? user.phone
        : String(authProvider?.phone || ""),
    );

    const loc =
      user.location &&
      typeof user.location === "object" &&
      (user.location.address || user.location.city)
        ? user.location
        : authProvider?.location;

    if (loc && typeof loc === "object") {
      setStreetAddress(typeof loc.address === "string" ? loc.address : "");
      setCity(typeof loc.city === "string" ? loc.city : "");
      setState(typeof loc.state === "string" ? loc.state : "");
      setZip(typeof loc.zip === "string" ? loc.zip : "");
      setCountry(typeof loc.country === "string" ? loc.country : "");
      if (Array.isArray(loc.coordinates) && loc.coordinates.length >= 2) {
        setLongitude(String(loc.coordinates[0] ?? ""));
        setLatitude(String(loc.coordinates[1] ?? ""));
      }
    }

    formReadyRef.current = true;
  }, [user, authProvider]);

  useEffect(() => {
    if (hoursSynced.current && officeHours.length === 0) return;
    hoursSynced.current = true;
    setHours(cloneWorkingHours(officeHours));
  }, [officeHours]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function applyAddress(address: PlaceAddress) {
    setStreetAddress(address.formattedAddress || address.streetAddress);
    setCity(address.city);
    setState(address.state);
    setZip(address.zipCode);
    setCountry(address.country || "");
    setLatitude(address.latitude != null ? String(address.latitude) : "");
    setLongitude(address.longitude != null ? String(address.longitude) : "");
    if (!address.zipCode) {
      window.setTimeout(() => zipRef.current?.focus(), 0);
    }
  }

  function buildLocation() {
    const lat = Number(latitude);
    const lng = Number(longitude);
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
    const hasText =
      streetAddress.trim() || city.trim() || zip.trim() || country.trim();
    if (!hasCoords && !hasText) return undefined;
    return {
      type: "Point" as const,
      coordinates: (hasCoords ? [lng, lat] : [0, 0]) as [number, number],
      city: city.trim() || undefined,
      country: country.trim() || undefined,
      address: streetAddress.trim() || undefined,
      zip: zip.trim() || undefined,
      state: state.trim() || undefined,
    };
  }

  async function onImageSelected(file: File | undefined) {
    if (!file || !user) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    setUploadingImage(true);

    try {
      const response = await uploadFile(file);
      const uploaded = extractUploadedUrl(response.data);
      if (!uploaded) {
        throw new Error("Upload succeeded but no image URL was returned.");
      }

      setAvatarUrl(uploaded);
      const res = await putData<{
        message?: string;
        user?: AuthUser;
        data?: AuthUser;
      }>(userApi.profile, { avatarUrl: uploaded }, { silent: true });

      const nextUser = {
        ...user,
        ...(res?.user || res?.data || {}),
        avatarUrl: uploaded,
      };
      dispatch(
        updateAuthUser({
          user: nextUser,
          provider: authProvider || undefined,
        }),
      );
      setPreviewUrl(null);
      toast.success(res?.message || "Profile photo updated");
    } catch (error) {
      setPreviewUrl(null);
      showApiErrorToast(error, "Could not upload profile photo.");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function onSaveAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;

    const nextFirst = firstName.trim();
    const nextLast = lastName.trim();
    if (!nextFirst || !nextLast) {
      toast.error("First and last name are required.");
      return;
    }

    const location = buildLocation();
    const payload: Record<string, unknown> = {
      firstName: nextFirst,
      lastName: nextLast,
      phone: phone.trim() || undefined,
      ...(location ? { location } : {}),
      ...(avatarUrl ? { avatarUrl } : {}),
    };

    setSavingAccount(true);
    try {
      const res = await putData<{
        message?: string;
        user?: AuthUser;
        data?: AuthUser;
      }>(userApi.profile, payload, { silent: true });

      const nextUser = {
        ...user,
        ...(res?.user || res?.data || {}),
        firstName: nextFirst,
        lastName: nextLast,
        phone: phone.trim() || user.phone,
        location: location || user.location,
        avatarUrl: avatarUrl || user.avatarUrl,
      };

      dispatch(
        updateAuthUser({
          user: nextUser,
          provider: authProvider || undefined,
        }),
      );
      toast.success(res?.message || "Account settings updated");
    } catch (error) {
      showApiErrorToast(error, "Could not update your account settings.");
    } finally {
      setSavingAccount(false);
    }
  }

  async function onSaveOfficeHours() {
    const workingHours = cloneWorkingHours(hours).map((entry) => ({
      day: entry.day,
      open: entry.closed ? null : entry.open,
      close: entry.closed ? null : entry.close,
      closed: entry.closed,
    }));

    setSavingHours(true);
    try {
      const res = await putData<{
        message?: string;
        workingHours?: typeof workingHours;
      }>(providerApi.officeHours, { workingHours }, { silent: true });

      const nextHours = Array.isArray(res?.workingHours)
        ? res.workingHours
        : workingHours;
      saveOfficeHours(nextHours);

      const nextProvider = {
        ...(authProvider || {}),
        settings: {
          ...(authProvider?.settings || {}),
          workingHours: nextHours,
        },
      };

      if (user) {
        dispatch(
          updateAuthUser({
            user: { ...user, providerId: nextProvider },
            provider: nextProvider,
          }),
        );
      }

      toast.success(res?.message || "Office hours updated successfully.");
    } catch (error) {
      showApiErrorToast(error, "Could not save office hours.");
    } finally {
      setSavingHours(false);
    }
  }

  const displayAvatar = previewUrl || avatarUrl;
  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    String(user?.email || "Provider");

  return (
    <PortalPage
      eyebrow="Account"
      title="Settings"
      description="Update your personal details, photo, location, and company office hours."
      actions={
        <Button asChild variant="outline">
          <Link href="/pro/dashboard/profile">Business profile</Link>
        </Button>
      }
    >
      <form
        className="max-w-2xl rounded-xl border border-input bg-card p-5"
        onSubmit={(event) => void onSaveAccount(event)}
      >
        <div className="mb-6 flex items-center gap-4">
          <div className="relative">
            <Avatar className="size-20 border border-border">
              {displayAvatar ? (
                <AvatarImage src={displayAvatar} alt={displayName} />
              ) : null}
              <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
                {initialsFor(user)}
              </AvatarFallback>
            </Avatar>
            <label
              htmlFor={fileInputId}
              className={cn(
                "absolute -right-1 -bottom-1 inline-flex size-8 cursor-pointer items-center justify-center rounded-full border border-border bg-background text-primary shadow-sm transition hover:bg-muted",
                uploadingImage && "pointer-events-none opacity-70",
              )}
              title="Change profile photo"
            >
              {uploadingImage ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Camera className="size-3.5" />
              )}
              <span className="sr-only">Upload profile photo</span>
            </label>
            <input
              id={fileInputId}
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              disabled={uploadingImage || savingAccount}
              onChange={(event) => void onImageSelected(event.target.files?.[0])}
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{displayName}</p>
            <p className="truncate text-sm text-muted-foreground">
              {String(user?.email || "")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              JPG, PNG, or WebP. Photo saves as soon as upload finishes.
            </p>
          </div>
        </div>

        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="settings-first-name">First name</FieldLabel>
              <Input
                id="settings-first-name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="settings-last-name">Last name</FieldLabel>
              <Input
                id="settings-last-name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                required
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="login-email">Login email</FieldLabel>
            <Input
              id="login-email"
              type="email"
              value={String(user?.email || "")}
              readOnly
              disabled
              className="cursor-not-allowed bg-muted/60 text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground">
              Email can’t be changed from settings.
            </p>
          </Field>

          <Field>
            <FieldLabel htmlFor="settings-phone">Phone</FieldLabel>
            <AuthPhoneInput
              id="settings-phone"
              value={phone}
              onChange={setPhone}
              placeholder="Enter phone number"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="settings-location">Location</FieldLabel>
            <AddressAutocomplete
              id="settings-location"
              value={streetAddress}
              onChange={setStreetAddress}
              onSelect={applyAddress}
              placeholder="Start typing a street address…"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="settings-city">City</FieldLabel>
              <Input
                id="settings-city"
                value={city}
                onChange={(event) => setCity(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="settings-state">State</FieldLabel>
              <Input
                id="settings-state"
                value={state}
                onChange={(event) => setState(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="settings-zip">ZIP</FieldLabel>
              <Input
                ref={zipRef}
                id="settings-zip"
                value={zip}
                onChange={(event) => setZip(event.target.value)}
              />
            </Field>
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            <Button type="submit" disabled={savingAccount || uploadingImage}>
              {savingAccount ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save account"
              )}
            </Button>
            <Button asChild type="button" variant="outline">
              <Link href="/pro/dashboard/profile">
                Edit company / business profile
              </Link>
            </Button>
          </div>
        </FieldGroup>
      </form>

      <section
        id="office-hours"
        className="max-w-2xl scroll-mt-6 rounded-xl border border-input bg-card p-5"
      >
        <p className="text-sm font-semibold">Company office hours</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Fixed services that use office hours follow this schedule for{" "}
          {provider.companyName}.
        </p>
        <div className="mt-4">
          <HoursEditor hours={hours} onChange={setHours} />
        </div>
        <Button
          type="button"
          className="mt-4"
          disabled={savingHours}
          onClick={() => void onSaveOfficeHours()}
        >
          {savingHours ? "Saving…" : "Save office hours"}
        </Button>
      </section>
    </PortalPage>
  );
}
