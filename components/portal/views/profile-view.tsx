"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthPhoneInput } from "@/components/auth/auth-phone-input";
import {
  putData,
  showApiErrorToast,
} from "@/components/api/apiFuntions";
import { providerApi, userApi } from "@/components/api/ApiRoutesFile";
import {
  extractUploadedUrl,
  uploadFile,
} from "@/components/api/uploadFile";
import {
  AddressAutocomplete,
  type PlaceAddress,
} from "@/components/shared/address-autocomplete";
import { PortalPage } from "@/components/portal/portal-page";
import { usePortalSettings } from "@/components/portal/use-portal-settings";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  getServiceCategoryById,
  serviceCategories,
} from "@/lib/data/services";
import {
  asAuthProvider,
  type AuthProviderRecord,
} from "@/lib/auth/provider-profile";
import { formatWorkingDay, formatHoursValue } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  getUserAvatarSrc,
  selectAuthProvider,
  selectAuthUser,
  updateAuthUser,
  type AuthUser,
} from "@/store/authSlice";
import Link from "next/link";

const TEAM_SIZES = ["Just me", "2–5", "6–10", "11–20", "21+"] as const;

const SERVICE_AREAS = [
  "Downtown",
  "East Austin",
  "Clarksville",
  "Zilker",
  "West Campus",
  "Northwest Hills",
  "South Austin",
  "West Lake Hills",
  "Crestview",
  "Arboretum",
] as const;

const EMPLOYEE_TO_API: Record<string, string> = {
  "Just me": "1",
  "2–5": "2-5",
  "6–10": "6-10",
  "11–20": "11-20",
  "21+": "21+",
};

const API_TO_EMPLOYEE: Record<string, string> = {
  "1": "Just me",
  "2-5": "2–5",
  "6-10": "6–10",
  "11-20": "11–20",
  "21+": "21+",
};

function toggleValue(list: string[], value: string) {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

function hydrateFromProvider(provider: AuthProviderRecord | null) {
  const loc = provider?.location;
  const coords = Array.isArray(loc?.coordinates) ? loc.coordinates : [];
  const employeeRaw = String(provider?.profile?.employeeCount || "");
  return {
    companyName: String(provider?.companyName || ""),
    tagline: String(provider?.tagline || ""),
    description: String(provider?.description || ""),
    phone: String(provider?.phone || ""),
    email: String(provider?.email || ""),
    website: String(provider?.website || ""),
    contactRole: String(provider?.contactRole || ""),
    streetAddress: String(loc?.address || ""),
    city: String(loc?.city || ""),
    state: String(typeof loc?.state === "string" ? loc.state : ""),
    zip: String(loc?.zip || ""),
    country: String(loc?.country || ""),
    latitude: coords.length >= 2 ? String(coords[1] ?? "") : "",
    longitude: coords.length >= 2 ? String(coords[0] ?? "") : "",
    licensed: Boolean(provider?.profile?.licensed),
    insured: Boolean(provider?.profile?.insured),
    yearsInBusiness:
      typeof provider?.profile?.yearsInBusiness === "number"
        ? String(provider.profile.yearsInBusiness)
        : "",
    employeeCount: API_TO_EMPLOYEE[employeeRaw] || employeeRaw,
    startingPrice:
      typeof provider?.services?.startingPrice === "number"
        ? String(provider.services.startingPrice)
        : "",
    categoryIds: Array.isArray(provider?.services?.categoryIds)
      ? [...provider.services.categoryIds]
      : [],
    jobs: Array.isArray(provider?.services?.offeredJobs)
      ? provider.services.offeredJobs.filter(
          (job): job is string => typeof job === "string",
        )
      : [],
    areaNames: Array.isArray(provider?.coverage?.neighborhoods)
      ? provider.coverage.neighborhoods.filter(
          (area): area is string => typeof area === "string",
        )
      : [],
  };
}

export function ProfileView() {
  const dispatch = useAppDispatch();
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const user = useAppSelector(selectAuthUser);
  const authProvider = useAppSelector(selectAuthProvider);
  const { provider } = usePortalWorkspace();
  const { officeHours } = usePortalSettings();
  const zipRef = useRef<HTMLInputElement>(null);
  const formReadyRef = useRef(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [contactRole, setContactRole] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [country, setCountry] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [licensed, setLicensed] = useState(false);
  const [insured, setInsured] = useState(false);
  const [yearsInBusiness, setYearsInBusiness] = useState("");
  const [employeeCount, setEmployeeCount] = useState("");
  const [startingPrice, setStartingPrice] = useState("");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [jobs, setJobs] = useState<string[]>([]);
  const [areaNames, setAreaNames] = useState<string[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const selectedCategories = useMemo(
    () =>
      categoryIds
        .map((id) => getServiceCategoryById(id))
        .filter((category): category is NonNullable<typeof category> =>
          Boolean(category),
        ),
    [categoryIds],
  );

  useEffect(() => {
    if (!user && !authProvider) {
      formReadyRef.current = false;
      return;
    }
    if (formReadyRef.current) return;

    setFirstName(String(user?.firstName || ""));
    setLastName(String(user?.lastName || ""));
    setAvatarUrl(getUserAvatarSrc(user));

    const next = hydrateFromProvider(authProvider);
    setCompanyName(next.companyName);
    setTagline(next.tagline);
    setDescription(next.description);
    setPhone(next.phone || String(user?.phone || ""));
    setEmail(next.email || String(user?.email || ""));
    setWebsite(next.website);
    setContactRole(next.contactRole);
    setStreetAddress(next.streetAddress);
    setCity(next.city);
    setState(next.state);
    setZip(next.zip);
    setCountry(next.country);
    setLatitude(next.latitude);
    setLongitude(next.longitude);
    setLicensed(next.licensed);
    setInsured(next.insured);
    setYearsInBusiness(next.yearsInBusiness);
    setEmployeeCount(next.employeeCount);
    setStartingPrice(next.startingPrice);
    setCategoryIds(next.categoryIds);
    setJobs(next.jobs);
    setAreaNames(next.areaNames);
    formReadyRef.current = true;
  }, [authProvider, user]);

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

  function toggleCategory(categoryId: string) {
    const category = getServiceCategoryById(categoryId);
    const checked = categoryIds.includes(categoryId);
    setCategoryIds((current) => toggleValue(current, categoryId));
    if (checked && category) {
      setJobs((current) =>
        current.filter((job) => !category.commonServices.includes(job)),
      );
    }
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

      dispatch(
        updateAuthUser({
          user: {
            ...user,
            ...(res?.user || res?.data || {}),
            avatarUrl: uploaded,
          },
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

  async function onSaveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextFirst = firstName.trim();
    const nextLast = lastName.trim();
    if (!nextFirst || !nextLast) {
      toast.error("First and last name are required.");
      return;
    }
    if (!companyName.trim()) {
      toast.error("Company name is required.");
      return;
    }

    const years = Number(yearsInBusiness);
    const price = Number(startingPrice);
    const location = buildLocation();
    const nextPhone = phone.trim();

    // Backend expects flat service/coverage fields (not nested services/coverage objects).
    const providerPayload: Record<string, unknown> = {
      companyName: companyName.trim(),
      tagline: tagline.trim() || undefined,
      description: description.trim() || undefined,
      phone: nextPhone || undefined,
      email: email.trim() || undefined,
      website: website.trim() || undefined,
      contactRole: contactRole.trim() || undefined,
      ...(location ? { location } : {}),
      categoryIds,
      offeredJobs: jobs,
      ...(Number.isFinite(price) ? { startingPrice: price } : {}),
      neighborhoods: areaNames,
      serviceArea: areaNames,
      yearsInBusiness: Number.isFinite(years) ? years : undefined,
      employeeCount:
        EMPLOYEE_TO_API[employeeCount] || employeeCount.trim() || undefined,
      licensed,
      insured,
      profile: {
        ...(Number.isFinite(years) ? { yearsInBusiness: years } : {}),
        employeeCount:
          EMPLOYEE_TO_API[employeeCount] || employeeCount.trim() || undefined,
        licensed,
        insured,
      },
    };

    const accountChanged =
      nextFirst !== String(user?.firstName || "").trim() ||
      nextLast !== String(user?.lastName || "").trim() ||
      nextPhone !== String(user?.phone || "").trim() ||
      (avatarUrl && avatarUrl !== getUserAvatarSrc(user));

    setSaving(true);
    try {
      const providerRes = await putData<AuthProviderRecord>(
        providerApi.profile,
        providerPayload,
        { silent: true },
      );

      let nextUser: AuthUser = {
        ...(user || {}),
        firstName: nextFirst,
        lastName: nextLast,
        phone: nextPhone || user?.phone,
        avatarUrl: avatarUrl || user?.avatarUrl,
      };

      if (accountChanged) {
        const userRes = await putData<{
          user?: AuthUser;
          data?: AuthUser;
          message?: string;
        }>(
          userApi.profile,
          {
            firstName: nextFirst,
            lastName: nextLast,
            phone: nextPhone || undefined,
            ...(avatarUrl ? { avatarUrl } : {}),
          },
          { silent: true },
        );
        nextUser = {
          ...nextUser,
          ...(userRes?.user || userRes?.data || {}),
          firstName: nextFirst,
          lastName: nextLast,
          phone: nextPhone || nextUser.phone,
          avatarUrl: avatarUrl || nextUser.avatarUrl,
        };
      }

      const nextProvider =
        asAuthProvider(providerRes) ||
        ({
          ...(authProvider || {}),
          companyName: companyName.trim(),
          tagline: tagline.trim(),
          description: description.trim(),
          phone: nextPhone,
          email: email.trim(),
          website: website.trim(),
          contactRole: contactRole.trim(),
          location: location || authProvider?.location,
          services: {
            categoryIds,
            offeredJobs: jobs,
            ...(Number.isFinite(price) ? { startingPrice: price } : {}),
          },
          profile: {
            ...(Number.isFinite(years) ? { yearsInBusiness: years } : {}),
            employeeCount:
              EMPLOYEE_TO_API[employeeCount] ||
              employeeCount.trim() ||
              undefined,
            licensed,
            insured,
          },
          coverage: {
            neighborhoods: areaNames,
          },
        } as AuthProviderRecord);

      // Prefer API nested shape when present; otherwise keep what we just saved.
      const savedServices = asAuthProvider(providerRes)?.services;
      const savedCoverage = asAuthProvider(providerRes)?.coverage;
      if (savedServices) {
        setCategoryIds(
          Array.isArray(savedServices.categoryIds)
            ? [...savedServices.categoryIds]
            : categoryIds,
        );
        setJobs(
          Array.isArray(savedServices.offeredJobs)
            ? savedServices.offeredJobs.filter(
                (job): job is string => typeof job === "string",
              )
            : jobs,
        );
        if (typeof savedServices.startingPrice === "number") {
          setStartingPrice(String(savedServices.startingPrice));
        }
      }
      if (savedCoverage && Array.isArray(savedCoverage.neighborhoods)) {
        setAreaNames(
          savedCoverage.neighborhoods.filter(
            (area): area is string => typeof area === "string",
          ),
        );
      }

      dispatch(
        updateAuthUser({
          user: {
            ...nextUser,
            providerId: nextProvider,
          },
          provider: nextProvider,
        }),
      );

      toast.success("Business profile updated successfully");
    } catch (error) {
      showApiErrorToast(error, "Could not update your business profile.");
    } finally {
      setSaving(false);
    }
  }

  const displayAvatar = previewUrl || avatarUrl;
  const displayName =
    [firstName, lastName].filter(Boolean).join(" ").trim() ||
    String(user?.email || "Provider");
  const initials =
    `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() ||
    displayName.charAt(0).toUpperCase();

  return (
    <PortalPage
      eyebrow="Public listing"
      title="Business profile"
      description="Same sections as Pro registration — account, business, services, profile, and coverage."
      actions={
        provider.slug ? (
          <Button asChild variant="outline">
            <Link href={`/pro/dashboard/settings`}>Back</Link>
          </Button>
        ) : null
      }
    >
      <form
        className="grid gap-4 lg:grid-cols-[1.3fr_1fr]"
        onSubmit={(event) => void onSaveProfile(event)}
      >
        <div className="flex flex-col gap-4">
          {/* Account */}
          <section className="rounded-xl border border-input bg-card p-5">
            <p className="text-sm font-semibold">Account</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Owner details from registration.
            </p>
            <FieldGroup className="mt-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Avatar className="size-20 border border-border">
                    {displayAvatar ? (
                      <AvatarImage src={displayAvatar} alt={displayName} />
                    ) : null}
                    <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
                      {initials}
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
                    disabled={uploadingImage || saving}
                    onChange={(event) =>
                      void onImageSelected(event.target.files?.[0])
                    }
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Profile photo</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    JPG, PNG, or WebP. Saves as soon as the upload finishes.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="owner-first">First name</FieldLabel>
                  <Input
                    id="owner-first"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="owner-last">Last name</FieldLabel>
                  <Input
                    id="owner-last"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    required
                  />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="phone">Phone</FieldLabel>
                  <AuthPhoneInput
                    id="phone"
                    value={phone}
                    onChange={setPhone}
                    placeholder="Enter phone number"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="email">Work email</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </Field>
              </div>
            </FieldGroup>
          </section>

          {/* Business */}
          <section className="rounded-xl border border-input bg-card p-5">
            <p className="text-sm font-semibold">Business</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Company name and service location.
            </p>
            <FieldGroup className="mt-4">
              <Field>
                <FieldLabel htmlFor="company">Company name</FieldLabel>
                <Input
                  id="company"
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="tagline">Tagline</FieldLabel>
                <Input
                  id="tagline"
                  value={tagline}
                  onChange={(event) => setTagline(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="street">Street address</FieldLabel>
                <AddressAutocomplete
                  id="street"
                  value={streetAddress}
                  onChange={setStreetAddress}
                  onSelect={applyAddress}
                  placeholder="Start typing a street address…"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="city">City</FieldLabel>
                  <Input
                    id="city"
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="state">State</FieldLabel>
                  <Input
                    id="state"
                    value={state}
                    onChange={(event) => setState(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="zip">ZIP</FieldLabel>
                  <Input
                    ref={zipRef}
                    id="zip"
                    value={zip}
                    onChange={(event) => setZip(event.target.value)}
                  />
                </Field>
              </div>
            </FieldGroup>
          </section>

          {/* Profile details */}
          <section className="rounded-xl border border-input bg-card p-5">
            <p className="text-sm font-semibold">Profile</p>
            <p className="mt-1 text-xs text-muted-foreground">
              About the company, team, and credentials.
            </p>
            <FieldGroup className="mt-4">
              <Field>
                <FieldLabel htmlFor="about">About the company</FieldLabel>
                <Textarea
                  id="about"
                  rows={4}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Optional — what you do, how you work, and who you serve."
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="years">Years in business</FieldLabel>
                  <Input
                    id="years"
                    inputMode="numeric"
                    value={yearsInBusiness}
                    onChange={(event) => setYearsInBusiness(event.target.value)}
                    placeholder="Optional — 8"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="team">Team size</FieldLabel>
                  <NativeSelect
                    id="team"
                    value={employeeCount}
                    onChange={(event) => setEmployeeCount(event.target.value)}
                    className="w-full"
                  >
                    <NativeSelectOption value="">Optional</NativeSelectOption>
                    {TEAM_SIZES.map((size) => (
                      <NativeSelectOption key={size} value={size}>
                        {size}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              </div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={licensed}
                    onCheckedChange={(value) => setLicensed(value === true)}
                  />
                  Licensed
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={insured}
                    onCheckedChange={(value) => setInsured(value === true)}
                  />
                  Insured
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="website">Website</FieldLabel>
                  <Input
                    id="website"
                    value={website}
                    onChange={(event) => setWebsite(event.target.value)}
                    placeholder="https://"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="contact-role">Your role</FieldLabel>
                  <Input
                    id="contact-role"
                    value={contactRole}
                    onChange={(event) => setContactRole(event.target.value)}
                    placeholder="Owner, Manager…"
                  />
                </Field>
              </div>
            </FieldGroup>
          </section>

          {/* Coverage */}
          <section className="rounded-xl border border-input bg-card p-5">
            <p className="text-sm font-semibold">Coverage</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Neighborhoods you serve (same as registration).
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {SERVICE_AREAS.map((area) => {
                const checked = areaNames.includes(area);
                return (
                  <button
                    key={area}
                    type="button"
                    onClick={() =>
                      setAreaNames((current) => toggleValue(current, area))
                    }
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-sm",
                      checked
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-card hover:border-foreground/20",
                    )}
                  >
                    {area}
                  </button>
                );
              })}
            </div>
          </section>

          <div className="flex justify-start">
            <Button type="submit" disabled={saving || uploadingImage}>
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save profile"
              )}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {/* Services — same as register */}
          <section className="rounded-xl border border-input bg-card p-5">
            <p className="text-sm font-semibold">Services you offer</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose categories, then the fixed catalog jobs for your profile.
            </p>
            <FieldGroup className="mt-4">
              <div className="grid gap-3">
                {serviceCategories.map((category) => {
                  const checked = categoryIds.includes(category.id);
                  return (
                    <label
                      key={category.id}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
                        checked
                          ? "border-primary bg-primary/5"
                          : "border-foreground/20 hover:border-foreground/35",
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleCategory(category.id)}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">
                          {category.name}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {category.tagline}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>

              {selectedCategories.length ? (
                <div className="flex flex-col gap-4 rounded-xl border bg-muted/30 p-4">
                  <p className="text-sm font-medium">Fixed catalog services</p>
                  <p className="text-sm text-muted-foreground">
                    These are the standard jobs we already list. Check the ones
                    you want on your profile.
                  </p>
                  {selectedCategories.map((category) => (
                    <div key={category.id} className="flex flex-col gap-2">
                      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        {category.name}
                      </p>
                      <div className="grid gap-2">
                        {category.commonServices.map((job) => (
                          <label
                            key={job}
                            className="flex items-start gap-2 text-sm"
                          >
                            <Checkbox
                              checked={jobs.includes(job)}
                              onCheckedChange={() =>
                                setJobs((current) => toggleValue(current, job))
                              }
                            />
                            <span>{job}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Choose at least one category to pick fixed catalog services.
                </p>
              )}

              <Field>
                <FieldLabel htmlFor="starting-price">Starting price</FieldLabel>
                <Input
                  id="starting-price"
                  inputMode="numeric"
                  value={startingPrice}
                  onChange={(event) => setStartingPrice(event.target.value)}
                  placeholder="Optional — e.g. 129"
                />
                <FieldDescription>
                  Shown as “Starting from” on your public profile.
                </FieldDescription>
              </Field>
            </FieldGroup>
          </section>

          {/* Hours summary */}
          <section className="rounded-xl border border-input bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Working hours</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Edit hours in Settings.
                </p>
              </div>
              <Button asChild type="button" variant="outline" size="sm">
                <a href="/pro/dashboard/settings#office-hours">Edit hours</a>
              </Button>
            </div>
            <ul className="mt-3 flex flex-col gap-1.5 text-sm">
              {officeHours.map((hours) => (
                <li key={hours.day} className="flex justify-between gap-3">
                  <span className="text-muted-foreground">
                    {formatWorkingDay(hours.day)}
                  </span>
                  <span className="tabular-nums">{formatHoursValue(hours)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </form>
    </PortalPage>
  );
}
