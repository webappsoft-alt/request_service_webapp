"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { getQualifyQuestions } from "@/lib/data/service-directory";
import { getServiceCategoryBySlug, serviceCategories } from "@/lib/data/services";
import { cn } from "@/lib/utils";

export function ServicesQualifyDialog({
  open,
  categorySlug,
  initialAnswers = {},
  onClose,
  onComplete,
}: {
  open: boolean;
  categorySlug: string;
  initialAnswers?: Record<string, string>;
  onClose: () => void;
  onComplete: (answers: Record<string, string>, categorySlug: string) => void;
}) {
  const [pickedCategory, setPickedCategory] = useState(categorySlug);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);

  useEffect(() => {
    if (!open) return;
    setPickedCategory(categorySlug);
    setStep(0);
    setAnswers(initialAnswers);
  }, [categorySlug, initialAnswers, open]);

  const needsService = !categorySlug && !pickedCategory;
  const knownSubService =
    Boolean(initialAnswers["sub-service"]) && (pickedCategory || categorySlug) === categorySlug;
  const questions = useMemo(
    () =>
      getQualifyQuestions(pickedCategory || categorySlug, {
        subService: knownSubService,
      }),
    [categorySlug, knownSubService, pickedCategory]
  );
  const steps = needsService
    ? [{ id: "service", title: "What service do you need?", options: [] }, ...questions]
    : questions;
  const current = steps[step];
  const progress = steps.length ? ((step + 1) / steps.length) * 100 : 0;
  const category = getServiceCategoryBySlug(pickedCategory || categorySlug);
  const selected = current ? answers[current.id] ?? "" : "";

  function goNext() {
    if (step < steps.length - 1) {
      setStep((value) => value + 1);
      return;
    }
    onComplete(answers, pickedCategory || categorySlug);
  }

  function goBack() {
    if (step === 0) {
      onClose();
      return;
    }
    setStep((value) => value - 1);
  }

  function choose(value: string) {
    if (!current) return;
    if (current.id === "service") {
      setPickedCategory(value);
      setAnswers({});
      setStep(0);
      return;
    }
    setAnswers((currentAnswers) => ({ ...currentAnswers, [current.id]: value }));
    if (current.id === "sub-service" && step < steps.length - 1) {
      setStep((value) => value + 1);
    }
  }

  if (!current) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="top-[50%] max-w-lg gap-0 overflow-hidden rounded-xl p-0 sm:max-w-lg"
      >
        <div className="flex items-center justify-between gap-3 border-b px-5 py-3.5">
          <button
            type="button"
            onClick={goBack}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={step === 0 ? "Close" : "Back"}
          >
            {step === 0 ? <X className="size-4" /> : <ChevronLeft className="size-4" />}
          </button>
          <div className="min-w-0 text-center">
            <DialogTitle className="text-sm font-semibold">
              {category?.name ?? "Find a service"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              A few questions so we can show the right companies and filters.
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Skip questions"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="h-1 bg-[#f5f5f5]">
          <div className="h-full bg-primary transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]" style={{ width: `${progress}%` }} />
        </div>

        <div key={current.id} className="dialog-step flex flex-col gap-5 px-5 py-6">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{current.title}</h2>
            {current.id !== "service" && "hint" in current && current.hint ? (
              <p className="mt-1 text-sm text-muted-foreground">{current.hint}</p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                We’ll use this to show matching work and the right filters.
              </p>
            )}
          </div>

          {current.id === "service" ? (
            <div className="grid grid-cols-2 gap-2">
              {serviceCategories.map((item) => (
                <button
                  key={item.slug}
                  type="button"
                  onClick={() => choose(item.slug)}
                  className={cn(
                    "rounded-xl border px-3 py-3 text-left text-sm font-medium transition-colors hover:border-primary/40 hover:bg-primary/5",
                    pickedCategory === item.slug && "border-primary bg-primary/5 text-primary"
                  )}
                >
                  {item.name}
                </button>
              ))}
            </div>
          ) : current.id === "sub-service" ? (
            <div className="max-h-72 overflow-y-auto pr-1">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {current.options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => choose(option.value)}
                    className={cn(
                      "rounded-xl border px-3 py-3 text-left text-sm font-medium transition-colors hover:border-primary/40 hover:bg-primary/5",
                      selected === option.value && "border-primary bg-primary/5 text-primary"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <RadioGroup value={selected} onValueChange={choose} className="gap-2">
              {current.options.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors hover:border-primary/30 hover:bg-primary/5",
                    selected === option.value && "border-primary bg-primary/5"
                  )}
                >
                  <RadioGroupItem value={option.value} className="mt-0.5" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{option.label}</span>
                    {option.hint ? (
                      <span className="mt-0.5 block text-sm text-muted-foreground">{option.hint}</span>
                    ) : null}
                  </span>
                </label>
              ))}
            </RadioGroup>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t px-5 py-3.5">
          <Button type="button" variant="ghost" onClick={goNext}>
            Skip
          </Button>
          <Button type="button" onClick={goNext} disabled={current.id !== "service" && !selected}>
            {step === steps.length - 1 ? "See matches" : "Next"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
