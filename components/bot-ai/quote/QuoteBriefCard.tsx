"use client";

import { useState } from "react";
import { CheckCircle2, ClipboardList, Loader2, MapPin, PencilLine, Sparkles, UserCheck } from "lucide-react";
import { extractErrorMessage, postData } from "@/components/api/apiFuntions";
import { authApi } from "@/components/api/ApiRoutesFile";
import { AuthPhoneInput } from "@/components/auth/auth-phone-input";
import { cn } from "@/lib/utils";
import { selectAuthUser } from "@/store/authSlice";
import { useAppSelector } from "@/store/hooks";
import { useBot } from "../BotProvider";
import type { BotMessage, BotQuoteBrief } from "../types";
import { isValidPhone, normalizePhone } from "./phone";
import { maskPhone } from "@/lib/auth/pending-registration";
import { QuoteOtpModal } from "./QuoteOtpModal";
import { submitBotQuote, type BotQuoteLocation } from "./submitBotQuote";

const URGENCY_TONE: Record<BotQuoteBrief["urgency"], string> = {
  emergency: "bg-red-500/15 text-red-700 dark:text-red-300",
  urgent: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  this_week: "bg-primary/10 text-primary",
  flexible: "bg-muted text-muted-foreground",
  not_specified: "bg-muted text-muted-foreground",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 px-2.5 py-1.5">
      <dt className="w-[30%] shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 font-medium">{children}</dd>
    </div>
  );
}

/**
 * AI lead brief: what the pro will receive, written from the chat. The customer only
 * confirms the phone (and ZIP when the location is unknown), then verifies it in the OTP
 * modal; the existing quote API receives the brief as the request description.
 */
export function QuoteBriefCard({ message, brief }: { message: BotMessage; brief: BotQuoteBrief }) {
  const { isAuthenticated, signIn, markQuoteSubmitted, reportQuoteSubmitted } = useBot();
  const user = useAppSelector(selectAuthUser);
  const location = useAppSelector((state) => state.location);

  const profilePhone = user?.phone && isValidPhone(String(user.phone)) ? normalizePhone(String(user.phone)) : "";
  const [phone, setPhone] = useState(profilePhone);
  const [zipDraft, setZipDraft] = useState("");
  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [otpOpen, setOtpOpen] = useState(false);

  const name =
    [user?.firstName, user?.lastName].map((part) => String(part || "").trim()).filter(Boolean).join(" ") ||
    String(user?.name || "").trim();
  const email = String(user?.email || "").trim();

  const knownZip = /^\d{5}$/.test(location.zip.trim()) ? location.zip.trim() : "";
  const hasCoords = location.latitude != null && location.longitude != null;
  // The quote API needs a ZIP or map location; ask only when neither is known.
  const needsZip = !knownZip && !hasCoords;
  const zip = knownZip || zipDraft.trim();
  const cityState = [location.city, location.state].filter(Boolean).join(", ");
  const locationText =
    [location.address || cityState, zip && !location.address.includes(zip) ? zip : ""].filter(Boolean).join(" ") ||
    brief.locationLabel ||
    "";

  const subject = brief.subService || brief.trade;

  if (brief.submitted || message.quoteBrief?.submitted) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
        Quote request sent for {subject}.
      </div>
    );
  }

  function quoteLocation(): BotQuoteLocation {
    return {
      zip,
      address: location.address || "",
      city: location.city || "",
      state: location.state || "",
      lat: hasCoords ? location.latitude : null,
      lng: hasCoords ? location.longitude : null,
    };
  }

  async function sendCode() {
    if (sending) return;
    if (!isAuthenticated) {
      signIn();
      return;
    }
    if (!isValidPhone(phone)) {
      setError("Select your country and enter your full mobile number.");
      return;
    }
    if (needsZip && !/^\d{5}$/.test(zipDraft.trim())) {
      setError("Enter the 5-digit ZIP code where the work is needed.");
      return;
    }
    if (!email || !name) {
      setError("Your account needs a name and email before we can send a quote request.");
      return;
    }
    setSending(true);
    setError("");
    try {
      // Existing endpoint used by the /get-a-quote flow.
      await postData(
        authApi.sendPhoneOtp,
        { phone: normalizePhone(phone), email },
        { token: null, skipLogoutOn401: true, silent: true },
      );
      setOtpOpen(true);
    } catch (sendError) {
      setError(extractErrorMessage(sendError) || "Could not send the verification code.");
    } finally {
      setSending(false);
    }
  }

  async function submitVerified() {
    const success = await submitBotQuote({
      brief,
      contact: { name, email, phone: normalizePhone(phone) },
      location: quoteLocation(),
      locationText,
      note,
    });
    markQuoteSubmitted(message.id);
    reportQuoteSubmitted(success);
  }

  return (
    <div className="rounded-xl border border-primary/25 bg-card p-3 text-card-foreground shadow-xs">
      <div className="flex items-start gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ClipboardList className="size-3.5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs font-semibold">
            Job brief for the pros
            {brief.source === "ai" ? (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-primary uppercase">
                <Sparkles className="size-2.5" aria-hidden />
                AI summary
              </span>
            ) : null}
          </p>
          <p className="flex items-center gap-1 truncate text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
            <UserCheck className="size-2.5 shrink-0" aria-hidden />
            {brief.providerName ? `Sending to ${brief.providerName}` : "Sending to up to 5 matching pros"}
          </p>
        </div>
      </div>

      <p className="mt-2.5 text-[13px] leading-snug font-semibold">{brief.jobTitle}</p>

      <dl className="mt-2 divide-y rounded-lg border bg-background text-[11px]">
        <Row label="Service">{[brief.trade, brief.subService].filter(Boolean).join(" → ")}</Row>
        <Row label="Issue">
          <span className="font-normal leading-snug">{brief.issueSummary}</span>
        </Row>
        {brief.area ? <Row label="Area / room">{brief.area}</Row> : null}
        <Row label="Urgency">
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", URGENCY_TONE[brief.urgency])}>
            {brief.urgencyLabel}
          </span>
        </Row>
        {brief.customerDetails.length ? (
          <Row label="Details">
            <ul className="flex list-disc flex-col gap-0.5 pl-3.5 font-normal">
              {brief.customerDetails.map((item, index) => (
                <li key={`${index}-${item}`}>{item}</li>
              ))}
            </ul>
          </Row>
        ) : null}
        {brief.answers?.length ? (
          <Row label="Your answers">
            <ul className="flex flex-col gap-1 font-normal">
              {brief.answers.map((item, index) => (
                <li key={`${index}-${item.question}`} className="leading-snug">
                  <span className="text-muted-foreground">{item.question}</span>{" "}
                  <span className="font-medium text-foreground">{item.answer}</span>
                </li>
              ))}
            </ul>
          </Row>
        ) : null}
        <Row label="Address">
          <span className="flex items-start gap-1">
            <MapPin className="mt-0.5 size-3 shrink-0 text-muted-foreground" aria-hidden />
            {locationText || "Not set"}
          </span>
        </Row>
      </dl>

      {noteOpen ? (
        <label className="mt-2 flex flex-col gap-1">
          <span className="text-[11px] font-semibold">Note for the pro (optional)</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value.slice(0, 500))}
            rows={2}
            placeholder="Anything the summary missed — access, timing, photos you can share…"
            className="resize-none rounded-md border bg-background px-2.5 py-1.5 text-[12px] outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        </label>
      ) : (
        <button
          type="button"
          onClick={() => setNoteOpen(true)}
          className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
        >
          <PencilLine className="size-3" aria-hidden />
          Add a note or correct something
        </button>
      )}

      <div className="mt-2.5 flex flex-col gap-2 border-t pt-2.5">
        {needsZip ? (
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold">ZIP code of the job</span>
            <input
              value={zipDraft}
              onChange={(event) => setZipDraft(event.target.value.replace(/\D/g, "").slice(0, 5))}
              inputMode="numeric"
              placeholder="e.g. 78701"
              className="h-9 rounded-md border bg-background px-2.5 text-[13px] outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </label>
        ) : null}
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold">Mobile number</span>
          <AuthPhoneInput value={phone} onChange={setPhone} required />
        </label>
        {name || email ? (
          <p className="text-[10px] text-muted-foreground">{[name, email].filter(Boolean).join(" · ")}</p>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mt-2 rounded-md bg-destructive/10 px-2.5 py-1.5 text-[11px] font-medium text-destructive">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void sendCode()}
        disabled={sending}
        className="mt-2.5 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-primary text-[12px] font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
      >
        {sending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
        {!isAuthenticated ? "Sign in to send" : sending ? "Sending code…" : "Verify phone & send request"}
      </button>
      <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
        We&apos;ll text a verification code to {isValidPhone(phone) ? maskPhone(normalizePhone(phone)) : "your phone"} first.
      </p>

      <QuoteOtpModal
        open={otpOpen}
        onOpenChange={setOtpOpen}
        phone={normalizePhone(phone)}
        email={email}
        onSubmitVerified={submitVerified}
      />
    </div>
  );
}
