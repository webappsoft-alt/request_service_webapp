"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AuthShell, authLinkClass } from "@/components/auth/auth-shell";
import { useDemoSession } from "@/components/auth/use-demo-session";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { PasswordInput } from "@/components/auth/password-input";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  AddressAutocomplete,
  type MapboxAddress,
} from "@/components/shared/address-autocomplete";
import { serviceCategories } from "@/lib/data/services";
import { cn } from "@/lib/utils";

const STEPS = ["account", "business", "services", "profile", "coverage"] as const;
type Step = (typeof STEPS)[number];

const OPTIONAL_STEPS: Step[] = ["services", "profile", "coverage"];

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

type Draft = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  companyName: string;
  tagline: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  latitude: string;
  longitude: string;
  categoryIds: string[];
  jobs: string[];
  startingPrice: string;
  description: string;
  yearsInBusiness: string;
  licensed: boolean;
  insured: boolean;
  employeeCount: string;
  website: string;
  contactRole: string;
  areaNames: string[];
};

const emptyDraft: Draft = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
  companyName: "",
  tagline: "",
  street: "",
  city: "",
  state: "TX",
  zip: "",
  country: "",
  latitude: "",
  longitude: "",
  categoryIds: [],
  jobs: [],
  startingPrice: "",
  description: "",
  yearsInBusiness: "",
  licensed: false,
  insured: false,
  employeeCount: "",
  website: "",
  contactRole: "",
  areaNames: [],
};

function stepCopy(step: Step) {
  switch (step) {
    case "account":
      return {
        title: "Create your pro account",
        description: "This is the only required step besides your company name. Everything else can wait.",
      };
    case "business":
      return {
        title: "Your company",
        description: "Customers see this name on your profile. Location helps match nearby jobs.",
      };
    case "services":
      return {
        title: "Services you offer",
        description: "Pick from our catalog. These become the fixed services on your profile.",
      };
    case "profile":
      return {
        title: "Profile details",
        description: "A short intro and credentials help homeowners trust the listing.",
      };
    case "coverage":
      return {
        title: "Where you work",
        description: "Choose neighborhoods you cover. You can change this anytime.",
      };
    default: {
      const _never: never = step;
      return _never;
    }
  }
}

function toggleValue(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function ProviderRegisterWizard() {
  const router = useRouter();
  const { signIn } = useDemoSession();
  const zipRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("account");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const stepIndex = STEPS.indexOf(step);
  const copy = stepCopy(step);
  const selectedCategories = serviceCategories.filter((category) =>
    draft.categoryIds.includes(category.id)
  );

  function patch(partial: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...partial }));
  }

  function applyAddress(address: MapboxAddress) {
    patch({
      street: address.formattedAddress || address.streetAddress,
      city: address.city,
      state: address.state,
      zip: address.zipCode,
      country: address.country || "",
      latitude: address.latitude != null ? String(address.latitude) : "",
      longitude: address.longitude != null ? String(address.longitude) : "",
    });
    if (!address.zipCode) {
      window.setTimeout(() => zipRef.current?.focus(), 0);
    }
  }

  function goTo(next: Step) {
    setStep(next);
  }

  function finish() {
    if (!draft.firstName || !draft.email || !draft.companyName) {
      toast.error("Add your name, email, and company name to create the account.");
      goTo(draft.companyName ? "account" : "business");
      return;
    }

    signIn({
      role: "provider",
      firstName: draft.firstName,
      lastName: draft.lastName,
      email: draft.email,
      companyName: draft.companyName,
    });
    toast.success("Your business account is ready. Open the dashboard to manage requests and services.");
    router.push("/pro/dashboard");
  }

  function validateAccount() {
    if (draft.password.length < 8) {
      toast.error("Use at least 8 characters for your password.");
      return false;
    }
    if (draft.password !== draft.confirmPassword) {
      toast.error("Passwords do not match.");
      return false;
    }
    return true;
  }

  function onContinue() {
    if (step === "account") {
      if (!validateAccount()) return;
      goTo("business");
      return;
    }
    if (step === "business") {
      if (!draft.companyName.trim()) {
        toast.error("Add a company name to create the account.");
        return;
      }
      goTo("services");
      return;
    }
    if (step === "services") {
      goTo("profile");
      return;
    }
    if (step === "profile") {
      goTo("coverage");
      return;
    }
    finish();
  }

  let canContinue = true;
  switch (step) {
    case "account":
      canContinue =
        draft.firstName.trim().length > 0 &&
        draft.lastName.trim().length > 0 &&
        draft.email.trim().length > 0 &&
        draft.password.length > 0 &&
        draft.confirmPassword.length > 0;
      break;
    case "business":
      canContinue = draft.companyName.trim().length > 0;
      break;
    case "services":
    case "profile":
    case "coverage":
      canContinue = true;
      break;
    default: {
      const _never: never = step;
      return _never;
    }
  }

  function onBack() {
    if (stepIndex <= 0) return;
    goTo(STEPS[stepIndex - 1]);
  }

  return (
    <AuthShell
      audience="provider"
      size="lg"
      eyebrow="Join as Pro"
      title={copy.title}
      description={copy.description}
      footer={
        <>
          Already have an account?{" "}
          <Link href="/pro/login" className={authLinkClass}>
            Log in
          </Link>
        </>
      }
    >
      <ol className="mb-6 grid grid-cols-5 gap-2">
        {STEPS.map((item, index) => {
          const current = item === step;
          const done = index < stepIndex;
          return (
            <li key={item} className="flex flex-col gap-1.5">
              <span
                className={cn(
                  "h-1.5 rounded-full",
                  current || done ? "bg-primary" : "bg-border"
                )}
              />
              <span
                className={cn(
                  "hidden text-[11px] font-medium capitalize sm:block",
                  current ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {item}
                {OPTIONAL_STEPS.includes(item) ? " · optional" : ""}
              </span>
            </li>
          );
        })}
      </ol>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          onContinue();
        }}
        className="flex flex-col gap-5"
      >
        {step === "account" ? (
          <FieldGroup>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="pro-first">First name</FieldLabel>
                <Input
                  id="pro-first"
                  name="firstName"
                  value={draft.firstName}
                  onChange={(event) => patch({ firstName: event.target.value })}
                  autoComplete="given-name"
                  placeholder="Enter your first name"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="pro-last">Last name</FieldLabel>
                <Input
                  id="pro-last"
                  name="lastName"
                  value={draft.lastName}
                  onChange={(event) => patch({ lastName: event.target.value })}
                  autoComplete="family-name"
                  placeholder="Enter your last name"
                  required
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="pro-email">Work email</FieldLabel>
              <Input
                id="pro-email"
                name="email"
                type="email"
                value={draft.email}
                onChange={(event) => patch({ email: event.target.value })}
                autoComplete="email"
                placeholder="Enter your work email"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="pro-phone">Phone</FieldLabel>
              <Input
                id="pro-phone"
                name="phone"
                type="tel"
                value={draft.phone}
                onChange={(event) => patch({ phone: event.target.value })}
                autoComplete="tel"
                placeholder="Enter your phone number"
              />
              <FieldDescription>Skip if you’d rather add this on the profile later.</FieldDescription>
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="pro-password">Password</FieldLabel>
                <PasswordInput
                  id="pro-password"
                  name="password"
                  value={draft.password}
                  onChange={(event) => patch({ password: event.target.value })}
                  autoComplete="new-password"
                  placeholder="Enter your password"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="pro-confirm">Confirm password</FieldLabel>
                <PasswordInput
                  id="pro-confirm"
                  name="confirmPassword"
                  value={draft.confirmPassword}
                  onChange={(event) => patch({ confirmPassword: event.target.value })}
                  autoComplete="new-password"
                  placeholder="Confirm your password"
                  required
                />
              </Field>
            </div>
          </FieldGroup>
        ) : null}

        {step === "business" ? (
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="company">Company name</FieldLabel>
              <Input
                id="company"
                value={draft.companyName}
                onChange={(event) => patch({ companyName: event.target.value })}
                autoComplete="organization"
                placeholder="Summit Home Systems"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="tagline">Tagline</FieldLabel>
              <Input
                id="tagline"
                value={draft.tagline}
                onChange={(event) => patch({ tagline: event.target.value })}
                placeholder="Optional — Plumbing and HVAC for Austin homes."
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="street">Street address</FieldLabel>
              <AddressAutocomplete
                id="street"
                value={draft.street}
                onChange={(street) => patch({ street })}
                onSelect={applyAddress}
                placeholder="Start typing your business address…"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="zip">ZIP</FieldLabel>
              <Input
                ref={zipRef}
                id="zip"
                value={draft.zip}
                onChange={(event) => patch({ zip: event.target.value })}
                autoComplete="postal-code"
                placeholder="Optional — 78701"
              />
            </Field>
            {/* Kept in draft/payload only — auto-filled from Mapbox, not shown in UI */}
            <input type="hidden" name="city" value={draft.city} readOnly />
            <input type="hidden" name="state" value={draft.state} readOnly />
            <input type="hidden" name="country" value={draft.country} readOnly />
            <input type="hidden" name="latitude" value={draft.latitude} readOnly />
            <input type="hidden" name="longitude" value={draft.longitude} readOnly />
          </FieldGroup>
        ) : null}

        {step === "services" ? (
          <FieldGroup>
            <div className="grid gap-3 sm:grid-cols-2">
              {serviceCategories.map((category) => {
                const checked = draft.categoryIds.includes(category.id);
                return (
                  <label
                    key={category.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
                      checked ? "border-primary bg-primary/5" : "border-foreground/20 hover:border-foreground/35"
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() =>
                        patch({
                          categoryIds: toggleValue(draft.categoryIds, category.id),
                          jobs: checked
                            ? draft.jobs.filter((job) => !category.commonServices.includes(job))
                            : draft.jobs,
                        })
                      }
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{category.name}</span>
                      <span className="block text-xs text-muted-foreground">{category.tagline}</span>
                    </span>
                  </label>
                );
              })}
            </div>

            {selectedCategories.length ? (
              <div className="flex flex-col gap-4 rounded-xl border bg-muted/30 p-4">
                <p className="text-sm font-medium">Fixed catalog services</p>
                <p className="text-sm text-muted-foreground">
                  These are the standard jobs we already list. Check the ones you want on your profile.
                </p>
                {selectedCategories.map((category) => (
                  <div key={category.id} className="flex flex-col gap-2">
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      {category.name}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {category.commonServices.map((job) => (
                        <label key={job} className="flex items-start gap-2 text-sm">
                          <Checkbox
                            checked={draft.jobs.includes(job)}
                            onCheckedChange={() => patch({ jobs: toggleValue(draft.jobs, job) })}
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
                Choose at least one category, or skip and add services later.
              </p>
            )}

            <Field>
              <FieldLabel htmlFor="starting-price">Starting price</FieldLabel>
              <Input
                id="starting-price"
                inputMode="numeric"
                value={draft.startingPrice}
                onChange={(event) => patch({ startingPrice: event.target.value })}
                placeholder="Optional — e.g. 129"
              />
              <FieldDescription>Shown as “Starting from” on your public profile.</FieldDescription>
            </Field>
          </FieldGroup>
        ) : null}

        {step === "profile" ? (
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="description">About the company</FieldLabel>
              <Textarea
                id="description"
                value={draft.description}
                onChange={(event) => patch({ description: event.target.value })}
                placeholder="Optional — what you do, how you work, and who you serve."
                rows={4}
              />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="years">Years in business</FieldLabel>
                <Input
                  id="years"
                  inputMode="numeric"
                  value={draft.yearsInBusiness}
                  onChange={(event) => patch({ yearsInBusiness: event.target.value })}
                  placeholder="Optional — 8"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="team">Team size</FieldLabel>
                <NativeSelect
                  id="team"
                  value={draft.employeeCount}
                  onChange={(event) => patch({ employeeCount: event.target.value })}
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
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 rounded-xl border p-3 text-sm">
                <Checkbox
                  checked={draft.licensed}
                  onCheckedChange={(value) => patch({ licensed: value === true })}
                />
                Licensed
              </label>
              <label className="flex items-center gap-2 rounded-xl border p-3 text-sm">
                <Checkbox
                  checked={draft.insured}
                  onCheckedChange={(value) => patch({ insured: value === true })}
                />
                Insured
              </label>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="website">Website</FieldLabel>
                <Input
                  id="website"
                  type="url"
                  value={draft.website}
                  onChange={(event) => patch({ website: event.target.value })}
                  placeholder="Optional — https://"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="role">Your role</FieldLabel>
                <Input
                  id="role"
                  value={draft.contactRole}
                  onChange={(event) => patch({ contactRole: event.target.value })}
                  placeholder="Optional — Owner, dispatcher…"
                />
              </Field>
            </div>
          </FieldGroup>
        ) : null}

        {step === "coverage" ? (
          <FieldGroup>
            <div className="flex flex-wrap gap-2">
              {SERVICE_AREAS.map((area) => {
                const checked = draft.areaNames.includes(area);
                return (
                  <button
                    key={area}
                    type="button"
                    onClick={() => patch({ areaNames: toggleValue(draft.areaNames, area) })}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-sm",
                      checked
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-card hover:border-foreground/20"
                    )}
                  >
                    {area}
                  </button>
                );
              })}
            </div>
            <p className="text-sm text-muted-foreground">
              Skip if you serve a wider area. You can add hours and more neighborhoods later.
            </p>
          </FieldGroup>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            {stepIndex > 0 ? (
              <Button type="button" variant="outline" size="xl" onClick={onBack}>
                Back
              </Button>
            ) : null}
            {OPTIONAL_STEPS.includes(step) ? (
              <Button type="button" variant="ghost" size="xl" onClick={finish}>
                Skip and finish
              </Button>
            ) : null}
          </div>
          <Button type="submit" size="xl" disabled={!canContinue}>
            {step === "coverage"
              ? "Finish and go home"
              : step === "business"
                ? "Save and continue"
                : "Continue"}
          </Button>
        </div>

        {step === "business" ? (
          <button
            type="button"
            onClick={() => {
              if (!draft.companyName.trim()) {
                toast.error("Add a company name to create the account.");
                return;
              }
              finish();
            }}
            className="text-center text-sm text-muted-foreground hover:text-foreground"
          >
            Create the account now and finish the rest later
          </button>
        ) : null}
      </form>
    </AuthShell>
  );
}
