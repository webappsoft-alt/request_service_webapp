"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { appendChatMessage, ensureChatThread, writeChatGuest } from "@/lib/booking/chat-store";
import { createFixedServiceBooking } from "@/lib/booking/create-fixed-booking";
import { createMarketplaceQuote } from "@/lib/booking/create-marketplace-quote";
import { createWebsiteLead } from "@/lib/booking/create-website-lead";
import { clearPendingQuote, formatIntakeQuote, readPendingQuote } from "@/lib/booking/format-quote-answers";
import { findPublicFixedService } from "@/lib/booking/public-services";
import { getJobRecord } from "@/lib/data/jobs";
import { getProviderBySlug } from "@/lib/data/providers";
import { serviceCategories } from "@/lib/data/services";
import { serviceUnitLabel } from "@/lib/data/portal";
import { formatStartingPrice, formatTime, isValidZip } from "@/lib/format";

export function RequestServiceForm({
  initial = {},
}: {
  initial?: {
    service?: string;
    job?: string;
    provider?: string;
    serviceId?: string;
    intent?: string;
    date?: string;
    time?: string;
  };
}) {
  const searchParams = useSearchParams();
  const defaultService = searchParams.get("service") || initial.service || "";
  const defaultJob = searchParams.get("job") || initial.job || "";
  const defaultProvider = searchParams.get("provider") || initial.provider || "";
  const serviceId = searchParams.get("serviceId") || initial.serviceId || "";
  const intent =
    searchParams.get("intent") === "book" || initial.intent === "book" || Boolean(serviceId)
      ? "book"
      : "request";
  const provider = defaultProvider ? getProviderBySlug(defaultProvider) : undefined;
  const jobRecord = defaultService && defaultJob ? getJobRecord(defaultService, defaultJob) : undefined;
  const fixedService = provider && serviceId ? findPublicFixedService(provider, serviceId) : undefined;
  const isFixedBooking = Boolean(provider && fixedService && intent === "book");

  const [service, setService] = useState(fixedService?.categoryName ? defaultService || "" : defaultService);
  const [zip, setZip] = useState(provider?.zip ?? "");
  const [street, setStreet] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [details, setDetails] = useState(
    fixedService
      ? `${fixedService.name}. ${fixedService.description}`
      : jobRecord
        ? `${jobRecord.job}. ${jobRecord.detail.description}`
        : "",
  );
  const bookedTime = searchParams.get("time") || initial.time || "";
  const [preferredDate, setPreferredDate] = useState(searchParams.get("date") || initial.date || "");
  const [preferredTime, setPreferredTime] = useState(bookedTime);
  const [confirmation, setConfirmation] = useState<
    | { kind: "job"; jobNumber: string; serviceName: string }
    | { kind: "lead"; requestNumber: string; serviceName: string }
    | { kind: "marketplace"; requestNumber: string; serviceName: string; count: number }
    | null
  >(null);

  const heading = useMemo(() => {
    if (fixedService && provider) return `Book ${fixedService.name}`;
    if (provider && intent === "book") return `Book ${provider.companyName}`;
    if (provider) return `Request ${provider.companyName}`;
    if (jobRecord) return `Request ${jobRecord.job}`;
    return "Submit a marketplace request";
  }, [fixedService, intent, jobRecord, provider]);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isFixedBooking && provider && fixedService) {
      if (!name.trim() || !email.trim()) {
        toast.error("Add your name and email.");
        return;
      }
      if (!isValidZip(zip)) {
        toast.error("Enter a valid 5-digit ZIP code.");
        return;
      }
      if (!street.trim()) {
        toast.error("Add the job street address.");
        return;
      }
      const { job } = createFixedServiceBooking({
        provider,
        service: fixedService,
        name,
        email,
        phone,
        street,
        zip,
        details,
        preferredDate,
        preferredTime,
      });
      setConfirmation({ kind: "job", jobNumber: job.number, serviceName: fixedService.name });
      toast.success(`${job.number} is on the ${provider.companyName} job board. No estimate — work can start.`);
      return;
    }
    if (!service) {
      toast.error("Choose a service category.");
      return;
    }
    if (!isValidZip(zip)) {
      toast.error("Enter a valid 5-digit ZIP code.");
      return;
    }
    if (!name.trim() || !email.trim()) {
      toast.error("Add your name and email.");
      return;
    }
    const category = serviceCategories.find((item) => item.slug === service);
    const pending = readPendingQuote();
    const formatted = pending ? formatIntakeQuote({ ...pending, zip, name, email, phone, details }) : undefined;
    const serviceName = jobRecord?.job || formatted?.serviceName || category?.name || "Service request";
    const requestDetails = formatted?.details || details;
    const answers = formatted?.answers;
    if (!provider) {
      const result = createMarketplaceQuote({
        name,
        email,
        phone,
        zip,
        serviceSlug: service,
        serviceName,
        details: requestDetails,
        answers,
        preferredDate,
        preferredTime: preferredTime || formatted?.preferredTime,
      });
      if (!result.requests.length) {
        toast.error("No matching companies for that ZIP yet. Try another area or pick a professional.");
        return;
      }
      clearPendingQuote();
      setConfirmation({
        kind: "marketplace",
        requestNumber: result.requests[0]?.number ?? "",
        serviceName,
        count: result.requests.length,
      });
      toast.success(`${result.requests[0]?.number} was sent to ${result.requests.length} matching companies.`);
      return;
    }
    const { request } = createWebsiteLead({
      provider,
      name,
      email,
      phone,
      zip,
      details: requestDetails,
      serviceSlug: service,
      serviceName,
      preferredDate,
      preferredTime: preferredTime || formatted?.preferredTime,
      answers,
    });
    writeChatGuest({ name: name.trim(), email: email.trim() });
    const thread = ensureChatThread({
      providerEmail: provider.email,
      providerId: provider.id,
      customerName: name.trim(),
      customerEmail: email.trim(),
      requestId: request.id,
    });
    appendChatMessage({
      providerEmail: provider.email,
      threadId: thread.id,
      from: "customer",
      text: details.trim() || `Requested ${request.serviceName}.`,
    });
    clearPendingQuote();
    setConfirmation({ kind: "lead", requestNumber: request.number, serviceName: request.serviceName });
    toast.success(`${request.number} is in the ${provider.companyName} inbox. They can send a written estimate.`);
  }

  if (confirmation && provider && confirmation.kind === "job") {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold">Booking confirmed</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          {confirmation.serviceName} is now job {confirmation.jobNumber} at {provider.companyName}.
          This is a priced fixed service, so it skipped the estimate pipeline and opened as field work.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={`/professionals/${provider.slug}`}>Back to {provider.companyName}</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/pro/dashboard/jobs">Open jobs in the portal</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (confirmation && confirmation.kind === "marketplace") {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold">Quote request sent</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          {confirmation.serviceName} is lead {confirmation.requestNumber} for {confirmation.count}{" "}
          matching {confirmation.count === 1 ? "company" : "companies"}. They can open the lead, review
          your answers, and send a written estimate.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/find-a-professional">See matching professionals</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/pro/dashboard/requests?status=new">Open new leads</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (confirmation && provider && confirmation.kind === "lead") {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold">Request sent</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          {confirmation.serviceName} is lead {confirmation.requestNumber} at {provider.companyName}.
          They were notified and can discuss the work from Messages, then send an estimate if needed.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={`/professionals/${provider.slug}`}>Chat with {provider.companyName}</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/pro/dashboard/messages">Open messages in the portal</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/pro/dashboard/requests?status=new">Open new leads</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold">{heading}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {isFixedBooking && fixedService
            ? `${formatStartingPrice(fixedService.price)} ${serviceUnitLabel(fixedService.unit)}. Booking this service creates a job immediately — ${provider?.companyName} does not write an estimate first.`
            : provider
              ? "This is a direct provider request. It will be routed to this company rather than the open marketplace."
              : jobRecord
                ? `This request starts with ${jobRecord.job}. Add your ZIP and any notes so local ${jobRecord.category.name.toLowerCase()} pros can send a written estimate.`
                : "Matching companies in your ZIP receive this request. They review your answers and send a written estimate."}
        </p>
      </div>
      <FieldGroup>
        {isFixedBooking && fixedService ? (
          <Field>
            <FieldLabel>Fixed service</FieldLabel>
            <Input value={`${fixedService.name} · ${fixedService.categoryName}`} readOnly />
          </Field>
        ) : (
          <Field>
            <FieldLabel htmlFor="request-service">Service category</FieldLabel>
            <NativeSelect
              id="request-service"
              value={service}
              onChange={(event) => setService(event.target.value)}
              className="w-full"
              required
            >
              <NativeSelectOption value="">Select a service</NativeSelectOption>
              {serviceCategories.map((category) => (
                <NativeSelectOption key={category.id} value={category.slug}>
                  {category.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        )}
        {isFixedBooking ? (
          <Field>
            <FieldLabel htmlFor="request-street">Job address</FieldLabel>
            <Input
              id="request-street"
              value={street}
              onChange={(event) => setStreet(event.target.value)}
              autoComplete="street-address"
              placeholder="312 Congress Avenue"
              required
            />
          </Field>
        ) : null}
        <Field>
          <FieldLabel htmlFor="request-zip">ZIP code</FieldLabel>
          <Input
            id="request-zip"
            value={zip}
            onChange={(event) => setZip(event.target.value)}
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="78701"
            required
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="request-date">Preferred date</FieldLabel>
            <Input
              id="request-date"
              type="date"
              value={preferredDate}
              onChange={(event) => setPreferredDate(event.target.value)}
              required={isFixedBooking}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="request-time">Preferred time</FieldLabel>
            <NativeSelect
              id="request-time"
              value={preferredTime}
              onChange={(event) => setPreferredTime(event.target.value)}
              className="w-full"
            >
              <NativeSelectOption value="">Any time</NativeSelectOption>
              {bookedTime && !["morning", "afternoon", "evening"].includes(bookedTime) ? (
                <NativeSelectOption value={bookedTime}>{formatTime(bookedTime)}</NativeSelectOption>
              ) : null}
              <NativeSelectOption value="morning">Morning</NativeSelectOption>
              <NativeSelectOption value="afternoon">Afternoon</NativeSelectOption>
              <NativeSelectOption value="evening">Evening</NativeSelectOption>
            </NativeSelect>
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="request-details">Service details</FieldLabel>
          <Textarea
            id="request-details"
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            placeholder="Describe the work, access notes, and anything a professional should know."
            rows={6}
            required
          />
          <FieldDescription>
            {isFixedBooking
              ? "Access notes help the crew start the job on the booked day."
              : "Photos can be attached when file uploads are connected."}
          </FieldDescription>
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="request-name">Your name</FieldLabel>
            <Input
              id="request-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="request-email">Email</FieldLabel>
            <Input
              id="request-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="request-phone">Phone</FieldLabel>
          <Input
            id="request-phone"
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            autoComplete="tel"
            placeholder="(512) 555-0182"
          />
        </Field>
      </FieldGroup>
      <Button type="submit" size="xl">
        {isFixedBooking
          ? "Book this job"
          : provider
            ? "Send request to this provider"
            : "Send quote request"}
      </Button>
    </form>
  );
}
