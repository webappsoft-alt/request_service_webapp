"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import { AddressFields } from "@/components/shared/address-fields";
import { BusinessGalleryEditor } from "@/components/portal/business-gallery-editor";
import { HoursEditor } from "@/components/portal/hours-editor";
import { PortalPage } from "@/components/portal/portal-page";
import { PortfolioFormView } from "@/components/portal/portfolio-file";
import { usePortalSettings } from "@/components/portal/use-portal-settings";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  PROVIDER_LANGUAGES,
  PROVIDER_PAYMENT_METHODS,
  normalizePaymentMethods,
  type ProviderLanguage,
  type ProviderPaymentMethod,
} from "@/lib/provider-preferences";
import {
  getServiceCategoryById,
  serviceCategories,
} from "@/lib/data/services";
import { cloneWorkingHours, PROVIDER_CONTACT_ROLES, normalizeProviderContactRole } from "@/lib/data/portal";
import {
  asAuthProvider,
  type AuthProviderRecord,
} from "@/lib/auth/provider-profile";
import {
  coverageNeighborhoodIds,
} from "@/lib/coverage-areas";
import {
  galleryIsReady,
  normalizeBusinessGallery,
  type BusinessGalleryImage,
} from "@/lib/business-gallery";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  getUserAvatarSrc,
  selectAuthProvider,
  selectAuthUser,
  updateAuthUser,
  type AuthUser,
} from "@/store/authSlice";
import {
  fetchServiceAreasPicker,
  type ServiceArea,
} from "@/store/serviceAreasSlice";

const TEAM_SIZES = ["Just me", "2–5", "6–10", "11–20", "21+"] as const;

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

const STEPS = [
  "account",
  "business",
  "profile",
  "hours",
  "categories",
  "subservices",
  "portfolio",
] as const;
type Step = (typeof STEPS)[number];

const STEP_LABELS: Record<Step, string> = {
  account: "Account",
  business: "Business",
  profile: "Profile",
  hours: "Hours",
  categories: "Services",
  subservices: "Sub-services",
  portfolio: "Portfolio",
};

const LEGACY_STEP_MAP: Record<string, Step> = {
  basic: "account",
  services: "categories",
  gallery: "profile",
};

function parseStep(value: string | null): Step {
  if (!value) return "account";
  if ((STEPS as readonly string[]).includes(value)) {
    return value as Step;
  }
  if (value in LEGACY_STEP_MAP) {
    return LEGACY_STEP_MAP[value];
  }
  return "account";
}

function toggleValue(list: string[], value: string) {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

/** Prefer user.phone (API /me) — provider/profile.phone is often empty. */
function resolveProfilePhone(
  provider: AuthProviderRecord | null | undefined,
  user: { phone?: unknown; profile?: unknown } | null | undefined,
) {
  const nestedProfile =
    user?.profile && typeof user.profile === "object"
      ? (user.profile as { phone?: unknown })
      : null;
  const providerProfile =
    provider?.profile && typeof provider.profile === "object"
      ? (provider.profile as { phone?: unknown })
      : null;

  for (const candidate of [
    user?.phone,
    provider?.phone,
    nestedProfile?.phone,
    providerProfile?.phone,
  ]) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return "";
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
    contactRole: normalizeProviderContactRole(provider?.contactRole),
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
    language: (PROVIDER_LANGUAGES as readonly string[]).includes(
      String(provider?.profile?.language || "").trim(),
    )
      ? (String(provider?.profile?.language).trim() as ProviderLanguage)
      : ("" as const),
    paymentMethods: normalizePaymentMethods(provider?.profile?.paymentMethods),
    categoryIds: Array.isArray(provider?.services?.categoryIds)
      ? [...provider.services.categoryIds]
      : [],
    jobs: Array.isArray(provider?.services?.offeredJobs)
      ? provider.services.offeredJobs.filter(
          (job): job is string => typeof job === "string",
        )
      : [],
    areaIds: coverageNeighborhoodIds(provider?.coverage?.neighborhoods),
    gallery: normalizeBusinessGallery(provider?.businessGallery),
  };
}

export function ProfileView() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const user = useAppSelector(selectAuthUser);
  const authProvider = useAppSelector(selectAuthProvider);
  const { officeHours, saveOfficeHours } = usePortalSettings();
  const formReadyRef = useRef(false);
  const hoursSynced = useRef(false);
  const portfolioSubmitRef = useRef<(() => Promise<boolean>) | null>(null);

  const step = parseStep(searchParams.get("step"));
  const stepIndex = STEPS.indexOf(step);
  const isLastStep = stepIndex === STEPS.length - 1;

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
  const [language, setLanguage] = useState<ProviderLanguage | "">("");
  const [paymentMethods, setPaymentMethods] = useState<ProviderPaymentMethod[]>(
    [],
  );
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [jobs, setJobs] = useState<string[]>([]);
  const [areaIds, setAreaIds] = useState<string[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [hours, setHours] = useState(() => cloneWorkingHours(officeHours));
  const [gallery, setGallery] = useState<BusinessGalleryImage[]>([]);

  const pickerItems = useAppSelector(
    (state) => state.serviceAreas?.pickerItems ?? [],
  );
  const listItems = useAppSelector((state) => state.serviceAreas?.items ?? []);
  const pickerPage = useAppSelector(
    (state) => state.serviceAreas?.pickerPage ?? 0,
  );
  const pickerTotalPages = useAppSelector(
    (state) => state.serviceAreas?.pickerTotalPages ?? 1,
  );
  const pickerLoading = useAppSelector(
    (state) => state.serviceAreas?.pickerLoading ?? false,
  );

  const coverageAreas = useMemo(() => {
    const byId = new Map<string, ServiceArea>();
    for (const area of [...listItems, ...pickerItems]) {
      if (area?.id) byId.set(area.id, area);
    }
    return Array.from(byId.values()).sort((a, b) =>
      a.title.localeCompare(b.title),
    );
  }, [listItems, pickerItems]);

  const areasById = useMemo(() => {
    const map = new Map<string, string>();
    for (const area of coverageAreas) {
      if (area.id && area.title) map.set(area.id, area.title);
    }
    return map;
  }, [coverageAreas]);

  const selectedCategories = useMemo(
    () =>
      categoryIds
        .map((id) => getServiceCategoryById(id))
        .filter((category): category is NonNullable<typeof category> =>
          Boolean(category),
        ),
    [categoryIds],
  );

  const authPhone = useMemo(
    () => resolveProfilePhone(authProvider, user),
    [authProvider, user],
  );

  /** Prefer the longer auth number if local state was wiped to dial-only (+92). */
  const phoneFieldValue = useMemo(() => {
    const localDigits = phone.replace(/\D/g, "");
    const authDigits = authPhone.replace(/\D/g, "");
    if (authDigits && authDigits.length > localDigits.length) return authPhone;
    if (authDigits && localDigits.length <= 3) return authPhone;
    return phone || authPhone;
  }, [phone, authPhone]);

  function goTo(next: Step) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("step", next);
    router.replace(`/pro/dashboard/profile?${params.toString()}`, {
      scroll: false,
    });
  }

  useEffect(() => {
    void dispatch(fetchServiceAreasPicker());
  }, [dispatch]);

  useEffect(() => {
    if (!user && !authProvider) {
      formReadyRef.current = false;
      return;
    }

    const next = hydrateFromProvider(authProvider);
    const resolvedPhone = resolveProfilePhone(authProvider, user);

    // First paint: fill the whole form once.
    if (!formReadyRef.current) {
      setFirstName(String(user?.firstName || ""));
      setLastName(String(user?.lastName || ""));
      setAvatarUrl(getUserAvatarSrc(user));
      setCompanyName(next.companyName);
      setTagline(next.tagline);
      setDescription(next.description);
      setPhone(resolvedPhone);
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
      setLanguage(next.language);
      setPaymentMethods(next.paymentMethods);
      setCategoryIds(next.categoryIds);
      setJobs(next.jobs);
      setAreaIds(next.areaIds);
      setGallery(next.gallery);
      formReadyRef.current = true;
      return;
    }

    // /me often arrives after first hydrate with user.phone while provider.phone is "".
    if (resolvedPhone) {
      setPhone((current) => {
        const digits = current.replace(/\D/g, "");
        const nextDigits = resolvedPhone.replace(/\D/g, "");
        if (!digits || digits.length <= 3) return resolvedPhone;
        if (nextDigits.length > digits.length) return resolvedPhone;
        return current;
      });
    }
  }, [authProvider, user]);

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
      setPreviewUrl(null);
      toast.success("Photo uploaded. It will save when you Submit.");
    } catch (error) {
      setPreviewUrl(null);
      showApiErrorToast(error, "Could not upload profile photo.");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function saveProfile(): Promise<boolean> {
    const nextFirst = firstName.trim();
    const nextLast = lastName.trim();
    if (!nextFirst || !nextLast) {
      toast.error("First and last name are required.");
      goTo("account");
      return false;
    }
    if (!companyName.trim()) {
      toast.error("Company name is required.");
      goTo("business");
      return false;
    }

    const years = Number(yearsInBusiness);
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
      contactRole: normalizeProviderContactRole(contactRole) || undefined,
      ...(location ? { location } : {}),
      categoryIds,
      offeredJobs: jobs,
      neighborhoods: areaIds,
      serviceArea: areaIds,
      yearsInBusiness: Number.isFinite(years) ? years : undefined,
      employeeCount:
        EMPLOYEE_TO_API[employeeCount] || employeeCount.trim() || undefined,
      language: language || "",
      paymentMethods,
      licensed,
      insured,
      businessGallery: gallery,
      profile: {
        ...(Number.isFinite(years) ? { yearsInBusiness: years } : {}),
        employeeCount:
          EMPLOYEE_TO_API[employeeCount] || employeeCount.trim() || undefined,
        licensed,
        insured,
        language: language || "",
        paymentMethods,
      },
    };

    const accountChanged =
      nextFirst !== String(user?.firstName || "").trim() ||
      nextLast !== String(user?.lastName || "").trim() ||
      nextPhone !== String(user?.phone || "").trim() ||
      (avatarUrl && avatarUrl !== getUserAvatarSrc(user));

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

      const fromApi = asAuthProvider(providerRes);
      const nextProvider = {
        ...(authProvider || {}),
        ...(fromApi || {}),
        companyName: companyName.trim(),
        tagline: tagline.trim(),
        description: description.trim(),
        phone: nextPhone,
        email: email.trim(),
        website: website.trim(),
        contactRole: normalizeProviderContactRole(contactRole),
        location: location || fromApi?.location || authProvider?.location,
        services: fromApi?.services || {
          categoryIds,
          offeredJobs: jobs,
        },
        profile: fromApi?.profile || {
          ...(Number.isFinite(years) ? { yearsInBusiness: years } : {}),
          employeeCount:
            EMPLOYEE_TO_API[employeeCount] ||
            employeeCount.trim() ||
            undefined,
          licensed,
          insured,
          language: language || "",
          paymentMethods,
        },
        coverage: fromApi?.coverage || {
          neighborhoods: areaIds,
        },
        businessGallery: Array.isArray(fromApi?.businessGallery)
          ? fromApi.businessGallery
          : gallery,
      } as AuthProviderRecord;

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
      }
      if (savedCoverage && Array.isArray(savedCoverage.neighborhoods)) {
        setAreaIds(coverageNeighborhoodIds(savedCoverage.neighborhoods));
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

      return true;
    } catch (error) {
      showApiErrorToast(error, "Could not update your business profile.");
      return false;
    }
  }

  async function persistOfficeHours(): Promise<boolean> {
    const workingHours = cloneWorkingHours(hours).map((entry) => ({
      day: entry.day,
      open: entry.closed ? null : entry.open,
      close: entry.closed ? null : entry.close,
      closed: entry.closed,
    }));

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

      return true;
    } catch (error) {
      showApiErrorToast(error, "Could not save office hours.");
      return false;
    }
  }

  async function onFinalSubmit() {
    if (!validateStep("account") || !validateStep("business")) return;
    if (!galleryIsReady(gallery)) {
      toast.error("Add 3–7 gallery photos and choose a main banner on the Profile step.");
      goTo("profile");
      return;
    }

    setSaving(true);
    try {
      const profileOk = await saveProfile();
      if (!profileOk) return;

      const hoursOk = await persistOfficeHours();
      if (!hoursOk) return;

      if (portfolioSubmitRef.current) {
        const portfolioOk = await portfolioSubmitRef.current();
        if (!portfolioOk) return;
      }

      toast.success("Business profile updated successfully");
      router.push("/pro/dashboard/settings");
    } finally {
      setSaving(false);
    }
  }

  function onBack() {
    if (stepIndex <= 0) {
      router.push("/pro/dashboard/settings");
      return;
    }
    goTo(STEPS[stepIndex - 1]);
  }

  function validateStep(current: Step): boolean {
    if (current === "account" && (!firstName.trim() || !lastName.trim())) {
      toast.error("First and last name are required.");
      return false;
    }
    if (current === "business" && !companyName.trim()) {
      toast.error("Company name is required.");
      return false;
    }
    if (current === "profile" && !galleryIsReady(gallery)) {
      toast.error("Add at least 3 gallery photos and choose a main banner.");
      return false;
    }
    return true;
  }

  function onNext() {
    if (!validateStep(step)) return;
    if (stepIndex < STEPS.length - 1) {
      goTo(STEPS[stepIndex + 1]);
    }
  }

  const displayAvatar = previewUrl || avatarUrl;
  const displayName =
    [firstName, lastName].filter(Boolean).join(" ").trim() ||
    String(user?.email || "Provider");
  const initials =
    `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() ||
    displayName.charAt(0).toUpperCase();

  const busy = saving || uploadingImage;

  return (
    <PortalPage
      eyebrow="Public listing"
      title="Edit business profile"
      description="One section at a time. Changes stay on this page until you Submit on the last step."
      actions={
        <Button asChild variant="outline">
          <Link href="/pro/dashboard/settings">Back</Link>
        </Button>
      }
    >
      <div className="flex w-full flex-col gap-5">
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {STEPS.map((item, index) => {
            const current = item === step;
            const done = index < stepIndex;
            return (
              <li key={item} className="flex flex-col gap-1.5">
                <span
                  className={cn(
                    "h-1.5 rounded-full",
                    current || done ? "bg-primary" : "bg-border",
                  )}
                />
                <span
                  className={cn(
                    "text-[11px] font-medium",
                    current ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {STEP_LABELS[item]}
                </span>
              </li>
            );
          })}
        </ol>

        {step === "account" ? (
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
                    JPG, PNG, or WebP. Uploads now; saves with Submit.
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
                    value={phoneFieldValue}
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
                    disabled
                    readOnly
                  />
                </Field>
              </div>
            </FieldGroup>
          </section>
        ) : null}

        {step === "business" ? (
          <div className="grid gap-4 lg:grid-cols-2">
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
                <AddressFields
                  idPrefix="profile-business"
                  value={{
                    address: streetAddress,
                    city,
                    state,
                    zip,
                    lat: Number.isFinite(Number(latitude))
                      ? Number(latitude)
                      : null,
                    lng: Number.isFinite(Number(longitude))
                      ? Number(longitude)
                      : null,
                    label: streetAddress,
                  }}
                  onChange={(next) => {
                    setStreetAddress(next.address);
                    setCity(next.city);
                    setState(next.state);
                    setZip(next.zip);
                    setLatitude(next.lat != null ? String(next.lat) : "");
                    setLongitude(next.lng != null ? String(next.lng) : "");
                    if (next.state && !country) setCountry("US");
                  }}
                  addressPlaceholder="Start typing your address…"
                />
              </FieldGroup>
            </section>

            <section className="rounded-xl border border-input bg-card p-5">
              <p className="text-sm font-semibold">Coverage</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Select from your service areas. Manage zones on the Service Areas
                page.
              </p>
              {coverageAreas.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {coverageAreas.map((area) => {
                    const checked = areaIds.includes(area.id);
                    return (
                      <button
                        key={area.id}
                        type="button"
                        onClick={() =>
                          setAreaIds((current) => toggleValue(current, area.id))
                        }
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-sm",
                          checked
                            ? "border-primary bg-primary text-primary-foreground"
                            : "bg-card hover:border-foreground/20",
                        )}
                      >
                        {area.title || "Untitled area"}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  {pickerLoading
                    ? "Loading service areas…"
                    : "No service areas yet. Add coverage zones first."}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {pickerPage < pickerTotalPages ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pickerLoading}
                    onClick={() =>
                      void dispatch(fetchServiceAreasPicker({ append: true }))
                    }
                  >
                    {pickerLoading ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    ) : null}
                    Load more areas
                  </Button>
                ) : null}
                <Button asChild variant="link" size="sm" className="h-auto px-0">
                  <Link href="/pro/dashboard/service-areas">
                    Manage service areas
                  </Link>
                </Button>
              </div>
              {areaIds.length > 0 &&
              areaIds.some((id) => !areasById.has(id)) ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Some selected areas are still loading names…
                </p>
              ) : null}
            </section>
          </div>
        ) : null}

        {step === "profile" ? (
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
                    onChange={(event) =>
                      setYearsInBusiness(event.target.value)
                    }
                    placeholder="Optional — 8"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="team">Team size</FieldLabel>
                  <Select
                    value={employeeCount || undefined}
                    onValueChange={setEmployeeCount}
                  >
                    <SelectTrigger id="team" className="w-full">
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      align="start"
                      className="z-[100] w-[var(--radix-select-trigger-width)]"
                    >
                      {TEAM_SIZES.map((size) => (
                        <SelectItem key={size} value={size}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
              <Field>
                <FieldLabel htmlFor="profile-language">Language</FieldLabel>
                <Select
                  value={language || undefined}
                  onValueChange={(value) =>
                    setLanguage(value as ProviderLanguage)
                  }
                >
                  <SelectTrigger id="profile-language" className="w-full">
                    <SelectValue placeholder="Select a language" />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    align="start"
                    className="z-[100] w-[var(--radix-select-trigger-width)]"
                  >
                    {PROVIDER_LANGUAGES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Shown on your public business information card.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel>Payment methods</FieldLabel>
                <FieldDescription>
                  Select every payment method you accept.
                </FieldDescription>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {PROVIDER_PAYMENT_METHODS.map((method) => {
                    const checked = paymentMethods.includes(method);
                    return (
                      <label
                        key={method}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm transition-colors",
                          checked
                            ? "border-primary bg-primary/5"
                            : "border-foreground/20 hover:border-foreground/35",
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => {
                            const on = value === true;
                            setPaymentMethods((current) =>
                              on
                                ? normalizePaymentMethods([...current, method])
                                : current.filter((item) => item !== method),
                            );
                          }}
                        />
                        {method}
                      </label>
                    );
                  })}
                </div>
              </Field>
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
                  <Select
                    value={normalizeProviderContactRole(contactRole) || undefined}
                    onValueChange={setContactRole}
                  >
                    <SelectTrigger id="contact-role" className="w-full">
                      <SelectValue placeholder="Optional — select a role" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      align="start"
                      className="z-[100] w-[var(--radix-select-trigger-width)]"
                    >
                      {PROVIDER_CONTACT_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </FieldGroup>
            <div className="mt-6 border-t border-border pt-5">
              <p className="text-sm font-semibold">Main business gallery</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Upload 3–7 photos. Set one as the main banner for your public profile.
              </p>
              <div className="mt-4">
                <BusinessGalleryEditor images={gallery} onChange={setGallery} />
              </div>
            </div>
          </section>
        ) : null}

        {step === "hours" ? (
          <section className="rounded-xl border border-input bg-card p-5">
            <p className="text-sm font-semibold">Working hours</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Set when customers can expect you to be available. Saved on Submit.
            </p>
            <div className="mt-4">
              <HoursEditor hours={hours} onChange={setHours} />
            </div>
          </section>
        ) : null}

        {step === "categories" ? (
          <section className="rounded-xl border border-input bg-card p-5">
            <p className="text-sm font-semibold">Services you offer</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose the categories that appear on your public profile.
            </p>
            <FieldGroup className="mt-4">
              <div className="grid gap-3 lg:grid-cols-2">
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
            </FieldGroup>
          </section>
        ) : null}

        {step === "subservices" ? (
          <section className="rounded-xl border border-input bg-card p-5">
            <p className="text-sm font-semibold">Jobs you offer</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Pick the catalog jobs customers should see under each service.
            </p>
            <FieldGroup className="mt-4">
              {selectedCategories.length ? (
                <div className="flex flex-col gap-5">
                  {selectedCategories.map((category) => {
                    const selectedCount = category.commonServices.filter((job) =>
                      jobs.includes(job),
                    ).length;
                    return (
                      <div key={category.id} className="flex flex-col gap-3">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="text-sm font-semibold">{category.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {selectedCount} of {category.commonServices.length} selected
                          </p>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {category.commonServices.map((job) => {
                            const checked = jobs.includes(job);
                            return (
                              <label
                                key={job}
                                className={cn(
                                  "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                                  checked
                                    ? "border-primary bg-primary/5 font-medium"
                                    : "border-input bg-card hover:border-foreground/30",
                                )}
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() =>
                                    setJobs((current) => toggleValue(current, job))
                                  }
                                />
                                <span className="leading-5">{job}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No categories selected yet. Go back to Services to choose at
                  least one category.
                </p>
              )}
            </FieldGroup>
          </section>
        ) : null}

        {step === "portfolio" ? (
          <PortfolioFormView
            embedded
            deferSubmit
            submitRef={portfolioSubmitRef}
            allowedCategoryIds={categoryIds}
          />
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <Button
            type="button"
            size="xl"
            variant="outline"
            className="min-w-[7.5rem]"
            onClick={onBack}
            disabled={busy}
          >
            Back
          </Button>

          {isLastStep ? (
            <Button
              type="button"
              size="xl"
              className="min-w-[7.5rem]"
              disabled={busy}
              onClick={() => void onFinalSubmit()}
            >
              {saving ? (
                <Spinner
                  size="sm"
                  label="Submitting"
                  className="text-primary-foreground [&>span]:border-primary-foreground/25 [&>span]:border-t-primary-foreground [&>span:last-of-type]:border-b-primary-foreground/70"
                />
              ) : (
                "Submit"
              )}
            </Button>
          ) : (
            <Button
              type="button"
              size="xl"
              className="min-w-[7.5rem]"
              disabled={busy}
              onClick={onNext}
            >
              Next
            </Button>
          )}
        </div>
      </div>
    </PortalPage>
  );
}
