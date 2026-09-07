"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { readPendingQuote } from "@/lib/booking/format-quote-answers";
import { getIntakeEstimate, getIntakeSteps, type IntakeAnswers } from "@/lib/data/intake";
import { getJobRecord } from "@/lib/data/jobs";
import { isValidZip } from "@/lib/format";
import { cn } from "@/lib/utils";

export function RequestIntake({
  onComplete,
}: {
  onComplete: (answers: IntakeAnswers) => void;
}) {
  const searchParams = useSearchParams();
  const startingService = searchParams.get("service") ?? "";
  const startingZip = searchParams.get("zip") ?? "";
  const startingJobSlug = searchParams.get("job") ?? "";
  const startingJob =
    startingService && startingJobSlug
      ? (getJobRecord(startingService, startingJobSlug)?.job ?? "")
      : "";

  const [answers, setAnswers] = useState<IntakeAnswers>(() => {
    const pending = readPendingQuote();
    return {
      ...pending,
      service: startingService || pending?.service || "",
      zip: startingZip || pending?.zip || "",
      job: startingJob || pending?.job || "",
    };
  });
  const [stepIndex, setStepIndex] = useState(() => {
    const initial = getIntakeSteps(startingService, startingZip);
    const index = initial.findIndex((item) => {
      if (item.id === "service") return !startingService;
      if (item.id === "job") return !startingJob;
      if (item.id === "zip") return !isValidZip(startingZip);
      return true;
    });
    return index < 0 ? 0 : index;
  });

  const steps = useMemo(
    () => getIntakeSteps(answers.service, answers.zip),
    [answers.service, answers.zip]
  );
  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const progress = ((stepIndex + 1) / steps.length) * 100;
  const estimate = getIntakeEstimate(answers);

  function setAnswer(id: string, value: string) {
    setAnswers((current) => {
      const next = { ...current, [id]: value };
      if (id === "service" && value !== current.service) next.job = "";
      return next;
    });
  }

  function canContinue() {
    if (!step) return false;
    if (step.id === "zip") return isValidZip(answers.zip ?? "");
    if (step.type === "contact") return Boolean(answers.name?.trim() && answers.email?.trim());
    if (step.type === "text") return true;
    return Boolean(answers[step.id]);
  }

  function goNext() {
    if (step.id === "zip" && !isValidZip(answers.zip ?? "")) {
      toast.error("Enter a valid 5-digit ZIP code.");
      return;
    }
    if (stepIndex >= steps.length - 1) {
      onComplete(answers);
      return;
    }
    setStepIndex((value) => value + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-medium text-foreground">
            Question {Math.min(stepIndex + 1, steps.length)} of {steps.length}
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
        <h2 className="text-xl font-semibold tracking-tight md:text-2xl">{step.title}</h2>
        {step.hint ? <p className="text-sm leading-6 text-muted-foreground">{step.hint}</p> : null}
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
                    : "bg-background hover:border-foreground/20 hover:bg-muted/50"
                )}
              >
                <span>{option.label}</span>
                {selected ? <Check className="size-4 shrink-0 text-primary" aria-hidden="true" /> : null}
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

      {step.type === "text" && step.id === "zip" ? (
        <Field>
          <FieldLabel htmlFor="intake-zip">ZIP code</FieldLabel>
          <Input
            id="intake-zip"
            value={answers.zip ?? ""}
            onChange={(event) => setAnswer("zip", event.target.value)}
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="78701"
          />
        </Field>
      ) : null}

      {step.type === "contact" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="intake-name">Your name</FieldLabel>
            <Input
              id="intake-name"
              value={answers.name ?? ""}
              onChange={(event) => setAnswer("name", event.target.value)}
              autoComplete="name"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="intake-email">Email</FieldLabel>
            <Input
              id="intake-email"
              type="email"
              value={answers.email ?? ""}
              onChange={(event) => setAnswer("email", event.target.value)}
              autoComplete="email"
            />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="intake-phone">Phone</FieldLabel>
            <Input
              id="intake-phone"
              type="tel"
              value={answers.phone ?? ""}
              onChange={(event) => setAnswer("phone", event.target.value)}
              autoComplete="tel"
              placeholder="(512) 555-0182"
            />
          </Field>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="ghost" onClick={() => setStepIndex((value) => Math.max(0, value - 1))} disabled={stepIndex === 0}>
          <ArrowLeft data-icon="inline-start" />
          Back
        </Button>
        <Button type="button" onClick={goNext} disabled={!canContinue()}>
          {stepIndex >= steps.length - 1 ? "Send quote request" : "Continue"}
          <ArrowRight data-icon="inline-end" />
        </Button>
      </div>
    </div>
  );
}
