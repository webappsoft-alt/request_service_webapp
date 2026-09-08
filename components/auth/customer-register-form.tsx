"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AuthShell, authLinkClass } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { PasswordInput } from "@/components/auth/password-input";
import { Input } from "@/components/ui/input";
import {
  AddressAutocomplete,
  type MapboxAddress,
} from "@/components/shared/address-autocomplete";
import { postData, showApiErrorToast } from "@/components/api/apiFuntions";
import { authApi } from "@/components/api/ApiRoutesFile";
import {
  savePendingRegistration,
  type PendingCustomerRegistration,
} from "@/lib/auth/pending-registration";

export function CustomerRegisterForm() {
  const router = useRouter();
  const zipRef = useRef<HTMLInputElement>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [country, setCountry] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length > 0 &&
    confirmPassword.length > 0;

  function applyAddress(address: MapboxAddress) {
    setStreetAddress(address.formattedAddress || address.streetAddress);
    setCity(address.city);
    setState(address.state);
    setZipCode(address.zipCode);
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
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
    return {
      type: "Point" as const,
      coordinates: [lng, lat] as [number, number],
      city: city || undefined,
      country: country || undefined,
      address: streetAddress || undefined,
      zip: zipCode || undefined,
      state: state || undefined,
    };
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password.length < 8) {
      toast.error("Use at least 8 characters for your password.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    const draft: PendingCustomerRegistration = {
      kind: "customer",
      email: email.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      password,
      phone: phone.trim() || undefined,
      zip: zipCode.trim() || undefined,
      location: buildLocation(),
    };

    setSubmitting(true);
    try {
      const data = await postData<{ message?: string }>(
        authApi.sendOtp,
        { email: draft.email },
        { silent: true, skipLogoutOn401: true },
      );
      savePendingRegistration(draft);
      toast.success(
        data?.message || "Check your email for a verification code.",
      );
      router.push(
        `/verify-otp?email=${encodeURIComponent(draft.email.toLowerCase())}`,
      );
    } catch (error) {
      showApiErrorToast(error, "Could not start registration.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      audience="customer"
      eyebrow="Homeowners"
      title="Create your account"
      description="Save estimates and hire a local pro. Name, email, and a password are enough to start."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className={authLinkClass}>
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <FieldGroup>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="first-name">First name</FieldLabel>
              <Input
                id="first-name"
                name="firstName"
                autoComplete="given-name"
                placeholder="Jordan"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="last-name">Last name</FieldLabel>
              <Input
                id="last-name"
                name="lastName"
                autoComplete="family-name"
                placeholder="Lee"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                required
              />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@email.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="phone">Phone</FieldLabel>
            <Input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="Optional — (512) 555-0148"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="street-address">Home address</FieldLabel>
            <AddressAutocomplete
              id="street-address"
              name="streetAddress"
              value={streetAddress}
              onChange={setStreetAddress}
              onSelect={applyAddress}
              placeholder="Start typing your street address…"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="zip">ZIP</FieldLabel>
            <Input
              ref={zipRef}
              id="zip"
              name="zipCode"
              autoComplete="postal-code"
              inputMode="numeric"
              placeholder="78701"
              value={zipCode}
              onChange={(event) => setZipCode(event.target.value)}
            />
          </Field>
          <input type="hidden" name="city" value={city} />
          <input type="hidden" name="state" value={state} />
          <input type="hidden" name="country" value={country} />
          <input type="hidden" name="latitude" value={latitude} />
          <input type="hidden" name="longitude" value={longitude} />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <PasswordInput
                id="password"
                name="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="confirm-password">Confirm password</FieldLabel>
              <PasswordInput
                id="confirm-password"
                name="confirmPassword"
                autoComplete="new-password"
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
            </Field>
          </div>
        </FieldGroup>
        <Button type="submit" size="xl" disabled={!canSubmit || submitting}>
          {submitting ? "Sending code…" : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
}
