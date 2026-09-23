"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import {
  AddressAutocomplete,
  type PlaceAddress,
} from "@/components/shared/address-autocomplete";
import { AuthPhoneInput } from "@/components/auth/auth-phone-input";
import { postData } from "@/components/api/apiFuntions";
import { authApi } from "@/components/api/ApiRoutesFile";
import { PhoneOtpVerificationPanel } from "@/components/marketplace/phone-otp-verification-panel";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { readPendingQuote } from "@/lib/booking/format-quote-answers";
import {
  getIntakeEstimate,
  getIntakeSteps,
  type IntakeAnswers,
} from "@/lib/data/intake";
import { getJobRecord } from "@/lib/data/jobs";
import { isValidZip } from "@/lib/format";
import { cn } from "@/lib/utils";

function hasUsableAddress(answers: IntakeAnswers) {
  const lat = Number(answers.lat);
  const lng = Number(answers.lng);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const zipOk = isValidZip(String(answers.zip || ""));
  const streetOk = Boolean(String(answers.street || "").trim());
  return (hasCoords && streetOk) || (zipOk && streetOk);
}

function composedName(answers: IntakeAnswers) {
  return [answers.firstName, answers.lastName]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ");
}

function phoneDigits(value: string) {
  return String(value || "").replace(/\D/g, "");
}

export function RequestIntake({
  onComplete,
}: {
  onComplete: (answers: IntakeAnswers) => void | Promise<void>;
}) {
  const searchParams = useSearchParams();
  const startingService = searchParams.get("service") ?? "";
  const startingZipRaw = searchParams.get("zip") ?? "";
  const startingZip = isValidZip(startingZipRaw) ? startingZipRaw.trim() : "";
  const startingJobSlug = searchParams.get("job") ?? "";
  const startingJob =
    startingService && startingJobSlug
      ? (getJobRecord(startingService, startingJobSlug)?.job ?? "")
      : "";

  const [answers, setAnswers] = useState<IntakeAnswers>(() => {
    const pending = readPendingQuote();
    const pendingZip = String(pending?.zip || "").trim();
    const pendingName = String(pending?.name || "").trim();
    const nameParts = pendingName ? pendingName.split(/\s+/) : [];
    return {
      ...pending,
      service: startingService || pending?.service || "",
      zip: startingZip || (isValidZip(pendingZip) ? pendingZip : ""),
      street: pending?.street || "",
      city: pending?.city || "",
      state: pending?.state || "",
      lat: pending?.lat || "",
      lng: pending?.lng || "",
      addressLabel: pending?.addressLabel || "",
      job: startingJob || pending?.job || "",
      firstName: pending?.firstName || nameParts[0] || "",
      lastName: pending?.lastName || nameParts.slice(1).join(" ") || "",
      email: pending?.email || "",
      phone: pending?.phone || "",
    };
  });
  const [addressInput, setAddressInput] = useState(
    () => answers.addressLabel || answers.street || "",
  );
  const [stepIndex, setStepIndex] = useState(() => {
    const initial = getIntakeSteps(startingService, startingZip || undefined);
    const index = initial.findIndex((item) => {
      if (item.id === "service") return !startingService;
      if (item.id === "job") return !startingJob;
      if (item.id === "address") return !startingZip;
      return true;
    });
    return index < 0 ? 0 : index;
  });
  const [submitting, setSubmitting] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [showPhoneVerify, setShowPhoneVerify] = useState(false);

  const steps = useMemo(
    () => getIntakeSteps(answers.service, startingZip || undefined),
    [answers.service, startingZip],
  );

  useEffect(() => {
    setStepIndex((current) => Math.min(current, Math.max(0, steps.length - 1)));
  }, [steps.length]);

  const safeIndex = Math.min(stepIndex, Math.max(0, steps.length - 1));
  const step = steps[safeIndex];
  const progress = ((safeIndex + 1) / Math.max(1, steps.length)) * 100;
  const estimate = getIntakeEstimate(answers);
  const isLastStep = safeIndex >= steps.length - 1;

  function setAnswer(id: string, value: string) {
    setAnswers((current) => {
      const next = { ...current, [id]: value };
      if (id === "service" && value !== current.service) next.job = "";
      if (id === "firstName" || id === "lastName") {
        next.name = [next.firstName, next.lastName]
          .map((part) => String(part || "").trim())
          .filter(Boolean)
          .join(" ");
      }
      return next;
    });
  }

  function applyPlace(place: PlaceAddress) {
    const label =
      place.formattedAddress ||
      [place.streetAddress, place.city, place.state, place.zipCode]
        .filter(Boolean)
        .join(", ");
    setAddressInput(label);
    setAnswers((current) => ({
      ...current,
      addressLabel: label,
      street: place.streetAddress || place.formattedAddress || "",
      city: place.city || "",
      state: place.state || "",
      zip: place.zipCode || current.zip || "",
      lat: String(place.latitude ?? ""),
      lng: String(place.longitude ?? ""),
    }));
  }

  function canContinue() {
    if (!step) return false;
    if (step.id === "address") return hasUsableAddress(answers);
    if (step.type === "contact") {
      return Boolean(
        answers.firstName?.trim() &&
          answers.lastName?.trim() &&
          answers.email?.trim() &&
          phoneDigits(answers.phone || "").length >= 8,
      );
    }
    if (step.type === "text" && step.id === "details") return true;
    if (step.type === "text") return true;
    return Boolean(answers[step.id]);
  }

  function resetAnswers() {
    setAnswers({
      service: "",
      zip: "",
      street: "",
      city: "",
      state: "",
      lat: "",
      lng: "",
      addressLabel: "",
      job: "",
      firstName: "",
      lastName: "",
      name: "",
      email: "",
      phone: "",
      details: "",
    });
    setAddressInput("");
    setStepIndex(0);
    setShowPhoneVerify(false);
  }

  async function submitQuoteRequest() {
    const fullName = composedName(answers);
    setSubmitting(true);
    try {
      await onComplete({
        ...answers,
        name: fullName,
        zip: answers.zip || startingZip || "",
      });
      resetAnswers();
    } finally {
      setSubmitting(false);
    }
  }

  async function sendOtpAndShowVerify() {
    const phone = String(answers.phone || "").trim();
    const email = String(answers.email || "").trim();
    if (phoneDigits(phone).length < 8) {
      toast.error("Enter a valid phone number.");
      return;
    }
    if (!email) {
      toast.error("Enter your email so we can send the verification code.");
      return;
    }

    setOtpSending(true);
    try {
      const response = await postData<{ message?: string }>(
        authApi.sendPhoneOtp,
        { phone, email },
        { token: null, skipLogoutOn401: true, silent: true },
      );
      toast.success(
        response?.message ||
          "Verification code sent. Check your email.",
      );
      setShowPhoneVerify(true);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not send verification code.",
      );
    } finally {
      setOtpSending(false);
    }
  }

  async function goNext() {
    if (!step || submitting || otpSending) return;

    if (step.id === "address" && !hasUsableAddress(answers)) {
      toast.error("Select a complete service address from the suggestions.");
      return;
    }

    if (!isLastStep) {
      setStepIndex((value) => Math.min(value + 1, steps.length - 1));
      return;
    }

    if (!hasUsableAddress(answers) && !startingZip) {
      toast.error("Select a service address before sending.");
      const addressStep = steps.findIndex((item) => item.id === "address");
      if (addressStep >= 0) setStepIndex(addressStep);
      return;
    }
    if (!answers.service?.trim()) {
      toast.error("Pick a service before sending.");
      setStepIndex(0);
      return;
    }
    if (
      !answers.firstName?.trim() ||
      !answers.lastName?.trim() ||
      !answers.email?.trim()
    ) {
      toast.error("First name, last name, and email are required.");
      return;
    }
    if (phoneDigits(answers.phone || "").length < 8) {
      toast.error("Enter a valid phone number.");
      return;
    }

    await sendOtpAndShowVerify();
  }

  if (!step) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Loading questions…
      </p>
    );
  }

  if (showPhoneVerify) {
    return (
      <PhoneOtpVerificationPanel
        phone={String(answers.phone || "").trim()}
        email={String(answers.email || "").trim()}
        onBack={() => setShowPhoneVerify(false)}
        onVerified={async () => {
          await submitQuoteRequest();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-medium text-foreground">
            Question {safeIndex + 1} of {steps.length}
          </span>
          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
            {estimate?.category.shortName ?? "Choose a service"}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold tracking-tight md:text-2xl">
          {step.title}
        </h2>
        {step.hint ? (
          <p className="text-sm leading-6 text-muted-foreground">{step.hint}</p>
        ) : null}
      </div>

      {step.type === "choice" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {step.options?.map((option) => {
            const selected = answers[step.id] === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setAnswer(step.id, option.value)}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-left text-sm font-medium transition-colors",
                  selected
                    ? "border-primary bg-secondary text-foreground shadow-sm"
                    : "bg-background hover:border-foreground/20 hover:bg-muted/50",
                )}
              >
                <span>{option.label}</span>
                {selected ? (
                  <Check
                    className="size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {step.type === "text" && step.id === "details" ? (
        <Textarea
          value={answers.details ?? ""}
          onChange={(event) => setAnswer("details", event.target.value)}
          placeholder="Describe the work, access notes, or what you already tried."
          rows={5}
        />
      ) : null}

      {step.type === "text" && step.id === "address" ? (
        <Field>
          <FieldLabel htmlFor="intake-address">Service address</FieldLabel>
          <AddressAutocomplete
            id="intake-address"
            value={addressInput}
            onChange={setAddressInput}
            onSelect={applyPlace}
            placeholder="Start typing street address…"
          />
          {answers.city || answers.zip ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {[answers.street, answers.city, answers.state, answers.zip]
                .filter(Boolean)
                .join(", ")}
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              Pick an address from the suggestions so we can match nearby licensed
              professionals.
            </p>
          )}
        </Field>
      ) : null}

      {step.type === "contact" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="intake-first-name">First name</FieldLabel>
            <Input
              id="intake-first-name"
              value={answers.firstName ?? ""}
              onChange={(event) => setAnswer("firstName", event.target.value)}
              autoComplete="given-name"
              placeholder="Jordan"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="intake-last-name">Last name</FieldLabel>
            <Input
              id="intake-last-name"
              value={answers.lastName ?? ""}
              onChange={(event) => setAnswer("lastName", event.target.value)}
              autoComplete="family-name"
              placeholder="Lee"
            />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="intake-email">Email</FieldLabel>
            <Input
              id="intake-email"
              type="email"
              value={answers.email ?? ""}
              onChange={(event) => setAnswer("email", event.target.value)}
              autoComplete="email"
              placeholder="you@email.com"
            />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="intake-phone">Phone</FieldLabel>
            <AuthPhoneInput
              id="intake-phone"
              value={answers.phone ?? ""}
              onChange={(value) => setAnswer("phone", value)}
              placeholder="(512) 555-0182"
            />
          </Field>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setStepIndex((value) => Math.max(0, value - 1))}
          disabled={safeIndex === 0 || submitting || otpSending}
        >
          <ArrowLeft data-icon="inline-start" />
          Back
        </Button>
        <Button
          type="button"
          onClick={() => void goNext()}
          disabled={!canContinue() || submitting || otpSending}
        >
          {otpSending
            ? "Sending code…"
            : submitting
              ? "Sending…"
              : isLastStep
                ? "Send quote request"
                : "Continue"}
          {!otpSending && !submitting ? (
            <ArrowRight data-icon="inline-end" />
          ) : null}
        </Button>
      </div>
    </div>
  );
}
