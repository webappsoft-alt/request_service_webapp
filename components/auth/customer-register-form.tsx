"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AuthShell, authLinkClass } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { PasswordInput } from "@/components/auth/password-input";
import { AuthPhoneInput } from "@/components/auth/auth-phone-input";
import { Input } from "@/components/ui/input";
import {
  AddressFields,
  type AddressFieldsValue,
} from "@/components/shared/address-fields";
import { postData, showApiErrorToast } from "@/components/api/apiFuntions";
import { authApi } from "@/components/api/ApiRoutesFile";
import {
  savePendingRegistration,
  type PendingCustomerRegistration,
} from "@/lib/auth/pending-registration";

const emptyAddress: AddressFieldsValue = {
  address: "",
  city: "",
  state: "",
  zip: "",
  lat: null,
  lng: null,
  label: "",
};

export function CustomerRegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next")?.trim() || "";
  const safeNext =
    nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : null;
  const loginHref = safeNext
    ? `/login?next=${encodeURIComponent(safeNext)}`
    : "/login";
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [addressFields, setAddressFields] =
    useState<AddressFieldsValue>(emptyAddress);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length > 0 &&
    confirmPassword.length > 0;

  function buildLocation() {
    const lat = addressFields.lat;
    const lng = addressFields.lng;
    const hasCoords =
      lat != null &&
      lng != null &&
      Number.isFinite(lat) &&
      Number.isFinite(lng);
    const hasText =
      addressFields.address.trim() ||
      addressFields.city.trim() ||
      addressFields.zip.trim();
    if (!hasCoords && !hasText) return undefined;
    return {
      type: "Point" as const,
      coordinates: (hasCoords ? [lng!, lat!] : [0, 0]) as [number, number],
      city: addressFields.city || undefined,
      address: addressFields.address || undefined,
      zip: addressFields.zip || undefined,
      state: addressFields.state || undefined,
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
      zip: addressFields.zip.trim() || undefined,
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
        `/verify-otp?email=${encodeURIComponent(draft.email.toLowerCase())}${
          safeNext ? `&next=${encodeURIComponent(safeNext)}` : ""
        }`,
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
          <Link href={loginHref} className={authLinkClass}>
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
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="phone">Phone</FieldLabel>
            <AuthPhoneInput
              id="phone"
              value={phone}
              onChange={setPhone}
              placeholder="Optional"
            />
          </Field>
          <AddressFields
            idPrefix="customer-register"
            value={addressFields}
            onChange={setAddressFields}
            addressPlaceholder="Start typing your address…"
          />
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
