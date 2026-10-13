"use client";

import { useId } from "react";
import { AlertCircle, AudioLines, Bot, Loader2, PhoneForwarded, PhoneIncoming, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { AiCallPreview } from "./ai-call-preview";
import { AiCallingSwitch } from "./ai-calling-switch";
import { AiPhoneNumberDisplay } from "./ai-phone-number-display";
import { AiVoicePicker } from "./ai-voice-picker";
import { DEFAULT_GREETING, GREETING_MAX_LENGTH } from "./constants";
import { formatPhone } from "./phone";
import { useAiCallingSettings } from "./use-ai-calling-settings";
import type { AiCallingAdapter } from "./types";

type AiCallingSettingsPanelProps = {
  /** Data source; defaults to this app's `provider/ai-calling` API. Define it once (not inline). */
  adapter?: AiCallingAdapter;
  className?: string;
};

const cardClass = "rounded-xl border-border-soft";

const HOW_IT_WORKS = [
  { icon: PhoneIncoming, text: "A customer calls your AI number (or your forwarded business line)." },
  { icon: Bot, text: "The AI greets them, answers questions, and captures the job as a lead." },
  { icon: PhoneForwarded, text: "If they ask for a person, the call transfers to your forwarding number." },
];

function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    </div>
  );
}

/** AI Voice Receptionist settings: master switch, AI number, forwarding number, voice and greeting. */
export function AiCallingSettingsPanel({ adapter, className }: AiCallingSettingsPanelProps) {
  const ids = useId();
  const { saved, draft, errors, loading, loadError, saving, dirty, update, reset, save, setEnabled, reload } =
    useAiCallingSettings(adapter);

  async function onToggle(next: boolean) {
    try {
      const ok = await setEnabled(next);
      if (ok) toast.success(next ? "AI receptionist turned on" : "AI receptionist turned off");
      else {
        toast.error("Add a forwarding number first.");
        document.getElementById(`${ids}-escalation`)?.focus();
      }
    } catch (error) {
      toast.error(extractErrorMessage(error) || "Could not update the AI receptionist.");
    }
  }

  async function onSave() {
    try {
      const ok = await save();
      if (ok) toast.success("AI receptionist settings saved");
      else toast.error("Fix the highlighted fields before saving.");
    } catch (error) {
      toast.error(extractErrorMessage(error) || "Could not save AI receptionist settings.");
    }
  }

  if (loading) return <PanelSkeleton />;

  if (loadError) {
    return (
      <Card className={cn(cardClass, className)}>
        <CardContent className="flex flex-col items-start gap-3 py-6 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {loadError}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={reload}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const live = saved.enabled;
  const greetingLength = draft.greeting.trim().length;

  return (
    <form
      className={cn("flex flex-col gap-4", className)}
      onSubmit={(event) => {
        event.preventDefault();
        void onSave();
      }}
    >
      {/* Status / master switch */}
      <Card className={cn(cardClass, "overflow-hidden py-0")}>
        <div
          className={cn(
            "flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between",
            live && "bg-linear-to-r from-primary/[0.07] via-primary/[0.03] to-transparent dark:from-primary/20 dark:via-primary/5",
          )}
        >
          <div className="flex min-w-0 items-center gap-4">
            <span
              className={cn(
                "relative flex size-12 shrink-0 items-center justify-center rounded-xl",
                live ? "bg-primary text-primary-foreground shadow-md shadow-primary/25" : "bg-muted text-muted-foreground",
              )}
            >
              <Bot className="size-6" aria-hidden="true" />
              {live ? (
                <span className="absolute -top-0.5 -right-0.5 flex size-3">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-3 rounded-full border-2 border-card bg-emerald-500" />
                </span>
              ) : null}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-foreground">AI Voice Receptionist</h2>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    live
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {live ? "Live" : "Off"}
                </span>
              </div>
              <p id={`${ids}-status`} className="mt-1 text-sm text-muted-foreground">
                {live
                  ? saved.aiPhoneNumber
                    ? `Answering calls on ${formatPhone(saved.aiPhoneNumber)}.`
                    : "On. Your AI number is being set up."
                  : "Turn on to let AI answer calls, capture leads, and hand off to your team."}
              </p>
            </div>
          </div>
          <label className="flex shrink-0 cursor-pointer items-center gap-3 self-start rounded-lg border border-border-soft bg-card px-3 py-2 sm:self-auto">
            <span className="text-sm font-medium">{draft.enabled ? "On" : "Off"}</span>
            {saving ? <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" /> : null}
            <AiCallingSwitch
              checked={draft.enabled}
              onCheckedChange={(next) => void onToggle(next)}
              disabled={saving}
              aria-label="AI voice receptionist"
              aria-describedby={`${ids}-status`}
            />
          </label>
        </div>
      </Card>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* Phone line */}
          <Card className={cardClass}>
            <CardHeader className="border-b border-border-soft">
              <CardTitle className="flex items-center gap-2">
                <PhoneIncoming className="size-4 text-muted-foreground" aria-hidden="true" />
                Phone line
              </CardTitle>
              <CardDescription>Where calls come in, and where they go when a person is needed.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5 pt-5">
              <AiPhoneNumberDisplay
                phoneNumber={saved.aiPhoneNumber}
                status={saved.aiPhoneNumberStatus}
                note={saved.provisioningNote}
              />

              <Field data-invalid={Boolean(errors.escalationNumber)}>
                <FieldLabel htmlFor={`${ids}-escalation`}>Forward to a person</FieldLabel>
                <InputGroup className="h-11">
                  <InputGroupAddon>
                    <PhoneForwarded className="size-4" aria-hidden="true" />
                  </InputGroupAddon>
                  <InputGroupInput
                    id={`${ids}-escalation`}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="+1 (512) 555-0123"
                    value={draft.escalationNumber}
                    onChange={(event) => update("escalationNumber", event.target.value)}
                    aria-invalid={Boolean(errors.escalationNumber)}
                  />
                </InputGroup>
                {errors.escalationNumber ? (
                  <FieldError>{errors.escalationNumber}</FieldError>
                ) : (
                  <FieldDescription className="text-xs">
                    Calls transfer here when a caller asks for a person or the AI can&apos;t resolve the request.
                  </FieldDescription>
                )}
              </Field>
            </CardContent>
          </Card>

          {/* Voice & greeting */}
          <Card className={cardClass}>
            <CardHeader className="border-b border-border-soft">
              <CardTitle className="flex items-center gap-2">
                <AudioLines className="size-4 text-muted-foreground" aria-hidden="true" />
                Voice &amp; greeting
              </CardTitle>
              <CardDescription>How your receptionist sounds and what callers hear first.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6 pt-5">
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p id={`${ids}-voice`} className="text-sm font-medium">
                    Voice
                  </p>
                  <span className="text-xs text-muted-foreground">Powered by Cartesia Sonic</span>
                </div>
                <AiVoicePicker
                  value={draft.voiceId}
                  onChange={(voiceId) => update("voiceId", voiceId)}
                  labelledBy={`${ids}-voice`}
                />
              </div>

              <Field data-invalid={Boolean(errors.greeting)}>
                <div className="flex items-center justify-between gap-2">
                  <FieldLabel htmlFor={`${ids}-greeting`}>Greeting message</FieldLabel>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => update("greeting", DEFAULT_GREETING)}
                    disabled={draft.greeting === DEFAULT_GREETING}
                  >
                    <Sparkles className="size-3" aria-hidden="true" />
                    Use default
                  </Button>
                </div>
                <Textarea
                  id={`${ids}-greeting`}
                  rows={4}
                  maxLength={GREETING_MAX_LENGTH}
                  className="min-h-28 resize-y leading-6"
                  value={draft.greeting}
                  onChange={(event) => update("greeting", event.target.value)}
                  aria-invalid={Boolean(errors.greeting)}
                />
                <div className="flex items-start justify-between gap-3">
                  {errors.greeting ? (
                    <FieldError>{errors.greeting}</FieldError>
                  ) : (
                    <FieldDescription className="text-xs">Keep it short and friendly. Callers hear this first.</FieldDescription>
                  )}
                  <span
                    className={cn(
                      "shrink-0 text-xs tabular-nums",
                      greetingLength > GREETING_MAX_LENGTH * 0.9 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
                    )}
                  >
                    {greetingLength}/{GREETING_MAX_LENGTH}
                  </span>
                </div>
              </Field>
            </CardContent>
          </Card>
        </div>

        {/* Preview + how it works */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-20">
          <Card className={cardClass}>
            <CardHeader className="border-b border-border-soft">
              <CardTitle>Call preview</CardTitle>
              <CardDescription>Updates as you edit.</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <AiCallPreview
                greeting={draft.greeting}
                voiceId={draft.voiceId}
                aiPhoneNumber={saved.aiPhoneNumber}
                escalationNumber={draft.escalationNumber}
                enabled={live}
              />
            </CardContent>
          </Card>

          <Card className={cardClass}>
            <CardHeader className="border-b border-border-soft">
              <CardTitle>How it works</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <ol className="flex flex-col gap-3">
                {HOW_IT_WORKS.map((step, index) => (
                  <li key={step.text} className="flex items-start gap-3 text-sm">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <step.icon className="size-3.5" aria-hidden="true" />
                    </span>
                    <span className="pt-1 leading-5 text-muted-foreground">
                      <span className="sr-only">Step {index + 1}: </span>
                      {step.text}
                    </span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Save bar: only while there are unsaved edits */}
      {dirty ? (
        <div className="sticky bottom-4 z-30 flex flex-col gap-3 rounded-xl border border-border-soft bg-card/95 p-3 shadow-lg backdrop-blur supports-backdrop-filter:bg-card/80 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="size-2 rounded-full bg-amber-500" aria-hidden="true" />
            You have unsaved changes
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={reset} disabled={saving}>
              Discard
            </Button>
            <Button type="submit" size="sm" className="flex-1 sm:flex-none" disabled={saving}>
              {saving ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      ) : null}
    </form>
  );
}
